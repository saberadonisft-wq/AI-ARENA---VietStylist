"""Opt-in live R2 size-bound PUT probe; uses one random private key and removes it.

Run from backend: python scripts/verify_r2_upload_limit.py --live
Never prints credentials, object URLs, or provider error bodies.
"""
import argparse
import json
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Allow temporary private R2 object writes")
    args = parser.parse_args()
    if not args.live:
        parser.error("Pass --live to run the temporary-object probe")
    import httpx
    from app.core.config import settings
    from app.infrastructure.r2.client import r2_client

    if not r2_client.is_configured:
        print(json.dumps({"status": "not_configured"}))
        return 2
    bucket = settings.R2_BUCKET_PRIVATE
    key = "security-probes/upload-limit/" + uuid.uuid4().hex
    payload = b"VietStylist upload size probe"
    result = {}
    try:
        url = r2_client.generate_upload_url(bucket, key, "application/octet-stream", len(payload), 60)["upload_url"]
        with httpx.Client(timeout=20, follow_redirects=False) as client:
            headers = {"Content-Type": "application/octet-stream"}
            oversized = client.put(url, headers=headers, content=payload + b"!")
            result["oversized_status"] = oversized.status_code
            result["oversized_created_object"] = r2_client.verify_object_exists(bucket, key) is not None
            valid = client.put(url, headers=headers, content=payload)
            result["valid_status"] = valid.status_code
            head = r2_client.verify_object_exists(bucket, key)
            result["stored_bytes"] = head["size_bytes"] if head else None
            chunked = client.put(url, headers=headers, content=iter([payload]))
            result["chunked_status"] = chunked.status_code
            oversized_chunked = client.put(url, headers=headers, content=iter([payload, b"!"]))
            result["oversized_chunked_status"] = oversized_chunked.status_code
            result["final_bytes"] = r2_client.verify_object_exists(bucket, key)["size_bytes"]
            result["passed"] = (
                oversized.status_code == 403 and not result["oversized_created_object"]
                and valid.is_success and result["stored_bytes"] == len(payload)
                and oversized_chunked.status_code in (400, 403, 411)
                and result["final_bytes"] == len(payload)
            )
    except Exception as exc:
        result = {"passed": False, "error_type": type(exc).__name__}
    finally:
        result["cleaned_up"] = r2_client.delete_object(bucket, key)
        r2_client.close()
    print(json.dumps(result))
    return 0 if result.get("passed") and result["cleaned_up"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
