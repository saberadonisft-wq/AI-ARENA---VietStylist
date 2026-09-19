# 02 — Projection Layer

## EducationDetail

Dùng:
- canonical entity
- published attributes
- relations
- assertions
- public-display media
- source citations

Trả:
- identity
- summary
- components
- history/context
- variants
- uncertainty
- citations

## ComposerBundle

Dùng:
- canonical garment/variant
- renderable mappings
- style options
- accessory relations
- cultural rules

Trả:
- selectable options
- slot schema
- render metadata
- warnings metadata
- dataset/ruleset version

## GenerationProfile

Dùng:
- verified assertions
- generation policies
- AI-reference eligible media

Trả:
- must_preserve
- may_vary
- forbidden
- references

## TimelineView

Dùng temporal contexts + relations:
- derived_from
- documented_before
- documented_after
- modern_adaptation_of

## MapView

Dùng region/place/community qualifiers.

## Search/RAG

Dùng canonical descriptions + published assertions + source IDs.

## Cache Key

```text
projection_name
+ projection_version
+ dataset_version
+ entity_id
+ locale
```
