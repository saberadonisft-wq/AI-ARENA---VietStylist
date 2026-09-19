from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
FIX = ROOT / "data" / "fixtures"

entity = json.loads((FIX / "entity.demo.json").read_text(encoding="utf-8"))
defs = json.loads((FIX / "attribute_definitions.demo.json").read_text(encoding="utf-8"))
values = json.loads((FIX / "attribute_values.demo.json").read_text(encoding="utf-8"))

errors = []
def_map = {d["key"]: d for d in defs}

for value in values:
    if value["entity_id"] != entity["id"]:
        errors.append(f"Unknown entity reference: {value['entity_id']}")

    definition = def_map.get(value["attribute_key"])
    if not definition:
        errors.append(f"Unknown attribute definition: {value['attribute_key']}")
        continue

    if entity["entity_type"] not in definition["applies_to"]:
        errors.append(
            f"{value['attribute_key']} does not apply to {entity['entity_type']}"
        )

    if value["state"] == "known" and value.get("value") is None:
        errors.append(f"{value['id']}: known requires value")

    if value["state"] == "disputed" and not value.get("candidate_values"):
        errors.append(f"{value['id']}: disputed requires candidate_values")

if errors:
    for error in errors:
        print("ERROR:", error)
    sys.exit(1)

print("OK: fixture registry and missing-state checks passed")
