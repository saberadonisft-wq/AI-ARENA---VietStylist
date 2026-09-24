"""Preload the garment cutout model into the deploy user's rembg cache."""

import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main() -> int:
    try:
        from rembg import new_session

        new_session("isnet-general-use", providers=["CPUExecutionProvider"])
    except Exception as exc:
        print(f"Cutout model unavailable: {type(exc).__name__}", file=sys.stderr)
        return 1
    print("Cutout model ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
