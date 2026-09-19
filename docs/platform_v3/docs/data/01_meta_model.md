# 01 — Meta Model

## Entity

```json
{
  "id": "garment_x",
  "entity_type": "garment",
  "schema_version": "1.0",
  "identity": {
    "name_vi": "...",
    "aliases": []
  },
  "status": "draft",
  "version": 1,
  "extensions": {}
}
```

## AttributeDefinition

```json
{
  "key": "construction.closure.direction",
  "label_vi": "Hướng khép vạt",
  "value_type": "enum",
  "cardinality": "single",
  "allowed_values": ["right_over_left", "left_over_right"],
  "applies_to": ["garment", "garment_variant"],
  "contextual": true,
  "queryable": true,
  "inheritable": true,
  "status": "active",
  "version": 1
}
```

### value_type hỗ trợ

- string
- number
- boolean
- enum
- entity_ref
- entity_ref_list
- measurement
- color
- date_range
- geo_ref
- structured

## AttributeValue

```json
{
  "id": "av_1",
  "entity_id": "garment_x",
  "attribute_key": "construction.closure.direction",
  "state": "known",
  "value": "right_over_left",
  "qualifiers": {
    "period_ids": ["period_x"],
    "region_ids": ["region_y"]
  },
  "assertion_ids": ["assert_1"]
}
```

## RelationDefinition

```json
{
  "key": "regional_variant_of",
  "source_types": ["garment_variant"],
  "target_types": ["garment"],
  "directional": true,
  "contextual": true
}
```

## EntityRelation

```json
{
  "id": "rel_1",
  "subject_id": "variant_a",
  "relation_type": "regional_variant_of",
  "object_id": "garment_b",
  "state": "known",
  "qualifiers": {},
  "assertion_ids": ["assert_2"]
}
```

## Namespaces

Khuyến nghị:
- construction.*
- wearing.*
- material.*
- production.*
- visual.*
- historical.*
- social.*
- symbolism.*
- generation.*

Ví dụ:
- construction.sleeve.shape
- wearing.layer_order
- material.primary
- production.technique
- historical.first_documented
