"""Import the bundled Ao Dai and Ao Tu Than pilot data into Cultural Data V3."""
from __future__ import annotations

import argparse
import json

from app.core.database import init_database
from app.modules.cultural_data_v3.importers.pilot_packages import (
    PACKAGE_FILES,
    activate_pilot_packages_for_local_demo,
    import_pilot_packages,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "package",
        nargs="?",
        default="all",
        choices=["all", *PACKAGE_FILES],
        help="Pilot package to import (default: all)",
    )
    parser.add_argument(
        "--activate-local-demo",
        action="store_true",
        help="Publish bundled pilot records in a development/test database for generation testing",
    )
    args = parser.parse_args()
    init_database()
    names = None if args.package == "all" else [args.package]
    result = {"imports": import_pilot_packages(names)}
    if args.activate_local_demo:
        result["local_demo_activation"] = activate_pilot_packages_for_local_demo(names)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
