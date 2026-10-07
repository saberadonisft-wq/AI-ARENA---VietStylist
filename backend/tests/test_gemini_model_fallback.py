import json
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime

import anyio
import httpx
import pytest

from app.core.http_client import close_shared_async_client, get_shared_async_client
from app.infrastructure.gemini import client as provider


MODELS = [f"gemini-{version}-flash" for version in ("3.8", "3.7", "3.6", "3.5")]
ITEMS = [{"id": "coat", "name": "Áo", "slot": "outerwear"}]
LOCKED = [{"item_id": "coat", "slot": "outerwear"}]


def success():
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{
        "text": json.dumps({"outfits": [{"title": "Phối đồ", "items": LOCKED}]}),
    }]}}]})


@pytest.fixture
def gemini(monkeypatch):
    instance = provider.GeminiClient()
    instance.is_configured = True
    instance.text_model = MODELS[0]
    monkeypatch.setattr(provider, "_provider_slots", anyio.CapacityLimiter(1))
    return instance


async def run(gemini, monkeypatch, response):
    monkeypatch.setattr(get_shared_async_client(25.0), "post", response)
    try:
        return await gemini.get_styling_recommendations("Phối như này phù hợp chưa?", None, ITEMS, LOCKED)
    finally:
        await close_shared_async_client()


@pytest.mark.parametrize("success_index", range(4))
async def test_downgrades_in_order_and_stops_without_switch_notice(gemini, monkeypatch, success_index):
    calls = []
    payloads = []

    async def response(url, **kwargs):
        calls.append(url.rsplit("/", 1)[-1].split(":")[0])
        payloads.append(kwargs["json"])
        return success() if len(calls) > success_index else httpx.Response(503)

    result = await run(gemini, monkeypatch, response)
    assert calls == MODELS[:success_index + 1]
    assert result["source"] == "gemini"
    assert result["model"] == MODELS[success_index]
    assert not result.get("notice")
    assert all(payload == payloads[0] for payload in payloads)
    content = json.loads(payloads[0]["contents"][0]["parts"][1]["text"])
    assert content["locked_items"] == LOCKED
    assert provider._provider_slots.borrowed_tokens == 0


@pytest.mark.parametrize("status", [400, 401, 402, 403])
async def test_terminal_errors_do_not_spend_more_requests(gemini, monkeypatch, status):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        return httpx.Response(status)

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 1
    assert result["source"] == "cultural_rule_engine"


async def test_all_models_unavailable_are_bounded_to_four_calls(gemini, monkeypatch):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        return httpx.Response(503)

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 4
    assert result["source"] == "cultural_rule_engine"
    assert "tạm thời" in result["notice"]


@pytest.mark.parametrize("first_failure", ["timeout", "network", "invalid_json", "invalid_schema", "missing_model"])
async def test_recoverable_failure_uses_next_model(gemini, monkeypatch, first_failure):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        if len(calls) > 1:
            return success()
        if first_failure == "timeout":
            raise httpx.ReadTimeout("private provider detail")
        if first_failure == "network":
            raise httpx.ConnectError("private provider detail")
        if first_failure == "invalid_json":
            return httpx.Response(200, content="invalid")
        if first_failure == "missing_model":
            return httpx.Response(404)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"outfits": []}'}]}}]})

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 2
    assert result["model"] == MODELS[1]
    assert not result.get("notice")


async def test_total_deadline_does_not_split_primary_budget_for_fallbacks(gemini, monkeypatch):
    monkeypatch.setattr(provider, "_RECOMMENDATION_TIMEOUT", 0.2)
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        if len(calls) == 1:
            await anyio.sleep_forever()
        return success()

    with anyio.fail_after(2):
        result = await run(gemini, monkeypatch, response)
    assert len(calls) == 1
    assert result["source"] == "cultural_rule_engine"


async def test_valid_primary_response_can_use_more_than_one_quarter_of_budget(gemini, monkeypatch):
    monkeypatch.setattr(provider, "_RECOMMENDATION_TIMEOUT", 0.8)
    calls = []

    async def response(url, **kwargs):
        calls.append(url)
        await anyio.sleep(0.3)
        return success()

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 1
    assert result["model"] == MODELS[0]


async def test_slow_failures_leave_time_for_the_last_model_to_answer(gemini, monkeypatch):
    # Reproduce a busy primary followed by two timeouts, then a valid answer.
    # Scale the production deadline so this regression does not take 100 seconds.
    budget_ratio = provider._RECOMMENDATION_TIMEOUT / provider._MODEL_ATTEMPT_TIMEOUT
    monkeypatch.setattr(provider, "_MODEL_ATTEMPT_TIMEOUT", 0.2)
    monkeypatch.setattr(provider, "_RECOMMENDATION_TIMEOUT", budget_ratio * 0.2)
    calls = []

    async def response(url, **kwargs):
        calls.append(url.rsplit("/", 1)[-1].split(":")[0])
        if len(calls) == 1:
            await anyio.sleep(0.03)
            return httpx.Response(503)
        if len(calls) < 4:
            await anyio.sleep_forever()
        await anyio.sleep(0.1)
        return success()

    result = await run(gemini, monkeypatch, response)
    assert calls == MODELS
    assert result["source"] == "gemini"
    assert result["model"] == MODELS[-1]
    assert provider._provider_slots.borrowed_tokens == 0


@pytest.mark.parametrize("attempt_timeout", [0.03, 25.0])
async def test_all_timeouts_obey_total_deadline_and_release_slot(gemini, monkeypatch, attempt_timeout):
    monkeypatch.setattr(provider, "_RECOMMENDATION_TIMEOUT", 0.1)
    monkeypatch.setattr(provider, "_MODEL_ATTEMPT_TIMEOUT", attempt_timeout)
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        await anyio.sleep_forever()

    # TLS/client construction is test setup, outside the recommendation deadline.
    # Keep the one-second guard focused on cancellation of the mocked provider.
    get_shared_async_client(25.0)
    with anyio.fail_after(1):
        result = await run(gemini, monkeypatch, response)
    assert 1 <= len(calls) <= 4
    assert result["source"] == "cultural_rule_engine"
    assert "quá chậm" in result["notice"]
    assert provider._provider_slots.borrowed_tokens == 0


async def test_retry_after_beyond_budget_stops_without_another_call(gemini, monkeypatch):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        return httpx.Response(429, headers={"Retry-After": "120"})

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 1
    assert "hạn mức" in result["notice"]


async def test_retry_after_is_observed_before_next_model(gemini, monkeypatch):
    sleeps = []
    calls = []

    async def sleep(delay):
        sleeps.append(delay)

    async def response(*args, **kwargs):
        calls.append(args)
        if len(calls) == 1:
            return httpx.Response(503, headers={"Retry-After": "1"})
        assert sleeps == [1.0]
        return success()

    monkeypatch.setattr(provider.anyio, "sleep", sleep)
    result = await run(gemini, monkeypatch, response)
    assert result["model"] == MODELS[1]


def test_http_date_retry_after():
    retry_at = datetime.now(timezone.utc) + timedelta(seconds=60)
    delay = provider._retry_after_seconds(httpx.Response(503, headers={"Retry-After": format_datetime(retry_at)}))
    assert 58 < delay <= 60


async def test_blocked_answer_is_not_retried(gemini, monkeypatch):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        return httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})

    result = await run(gemini, monkeypatch, response)
    assert len(calls) == 1
    assert result["source"] == "cultural_rule_engine"


async def test_external_cancellation_does_not_start_more_calls(gemini, monkeypatch):
    calls = []

    async def response(*args, **kwargs):
        calls.append(args)
        await anyio.sleep_forever()

    with anyio.move_on_after(0.02) as scope:
        await run(gemini, monkeypatch, response)
        pytest.fail("Cancellation must propagate")
    assert scope.cancel_called
    assert len(calls) == 1
    assert provider._provider_slots.borrowed_tokens == 0


def test_configured_lower_model_never_upgrades_and_custom_model_is_preserved(gemini):
    gemini.text_model = MODELS[2]
    assert gemini.text_models == tuple(MODELS[2:])
    gemini.text_model = "custom-model"
    assert gemini.text_models == ("custom-model",)
