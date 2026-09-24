# Studio garment recoloring gate

Photographic garment recoloring remains disabled until an item passes an
independent real-image review. A bare `studio_recolor_approved: true` value is
not sufficient for normal catalog creation or editing: those endpoints reject
new approvals and only preserve an existing approval while both
`catalog_media_id` and `catalog_image_version` stay unchanged. Replacing the
source requires a new review. The preview endpoint and PNG endpoint both enforce
the approval gate, so editing a request URL cannot bypass it.

An item should be approved only after reviewers compare the original and
recolored image against independently annotated fabric, embroidery, trim, and
transparent regions. The recolor algorithm's own mask is not ground truth.
Keep samples with embroidery, multiple fabric colors, metallic trim, and varied
lighting. A failed or ambiguous sample must stay unapproved; preview should
return `supported: false` and the original image must remain unchanged.

SVG recoloring is enabled only when its source explicitly marks a primary fabric
region with `VAR_COLOR_PRIMARY`. The renderer never replaces a common hex color
across the full SVG, which could recolor a motif or border that happens to use
the same color.

The current automated checks use synthetic images and verify motif pixels,
alpha, and out-of-mask preservation. They do not qualify real catalog photos.
Until an independently annotated real-image review is recorded, photographic
items must remain unapproved.

## Independent-mask evaluation

Use `scripts/evaluate_studio_recolor.py` from the backend directory with a
reviewer-authored JSON manifest. Each sample points to the exact cutout PNG sent
to the algorithm and four same-sized grayscale masks: `fabric_safe` identifies
only pixels allowed to change; `embroidery` and `trim` identify protected
details; `transparent` identifies transparent source pixels. White mask pixels
are in the region. Masks must come from independent visual annotation, not the
algorithm's candidate mask. The evaluator rejects overlapping safe/protected
labels and visible pixels labeled transparent.

Example structure (paths are relative to the manifest):

```json
{
  "schema_version": 1,
  "algorithm_version": "automatic-fabric-recolor-v2",
  "asset_kind": "real_catalog_photo",
  "samples": [
    {
      "id": "catalog-item-source-version",
      "image": "images/item-cutout.png",
      "target_hex": "#B32645",
      "expected_supported": true,
      "coverage_tags": ["embroidery", "multi_fabric", "metallic_trim", "varied_lighting"],
      "annotation": {"method": "manual_independent", "reviewer": "reviewer-id"},
      "masks": {
        "fabric_safe": "masks/item-fabric.png",
        "embroidery": "masks/item-embroidery.png",
        "trim": "masks/item-trim.png",
        "transparent": "masks/item-transparent.png"
      }
    }
  ]
}
```

Run:

```powershell
python scripts/evaluate_studio_recolor.py path/to/manifest.json --report path/to/report.json
```

The report checks that at least half of the independently labeled safe-fabric
pixels change, and that embroidery, trim, visible pixels outside the safe mask,
and alpha remain unchanged. A successful report only makes the dataset eligible
for human review; it never writes `studio_recolor_approved` or updates catalog
metadata. The admin catalog form is not an approval workflow. It also requires coverage tags for embroidery, multiple fabric
regions, metallic trim, and varied lighting. No real-image annotation set is
currently checked into this repository, so the current images have not passed
this gate and photographic recoloring stays disabled.
