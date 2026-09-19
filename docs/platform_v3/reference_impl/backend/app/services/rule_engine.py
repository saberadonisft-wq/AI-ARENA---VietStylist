from __future__ import annotations
from typing import Any

ALLOWED_OPERATORS = {
    "eq", "neq", "in", "not_in", "contains",
    "exists", "missing", "all", "any"
}

def get_path(data: dict[str, Any], path: str):
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current

def evaluate_condition(condition: dict[str, Any], ctx: dict[str, Any]) -> bool:
    op = condition.get("operator")
    if op not in ALLOWED_OPERATORS:
        raise ValueError(f"Unsupported operator: {op}")

    if op == "all":
        return all(evaluate_condition(x, ctx) for x in condition.get("conditions", []))
    if op == "any":
        return any(evaluate_condition(x, ctx) for x in condition.get("conditions", []))

    actual = get_path(ctx, condition["field"])
    expected = condition.get("value")

    if op == "eq":
        return actual == expected
    if op == "neq":
        return actual != expected
    if op == "in":
        return actual in (expected or [])
    if op == "not_in":
        return actual not in (expected or [])
    if op == "contains":
        return isinstance(actual, list) and expected in actual
    if op == "exists":
        return actual is not None
    if op == "missing":
        return actual is None
    return False
