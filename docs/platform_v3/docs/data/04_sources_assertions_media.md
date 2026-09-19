# 04 — Sources, Assertions, Media

## SourceRecord

Lưu:
- source type
- title
- author/creator
- institution
- publication date
- URL/bibliographic data
- accessed date
- rights capability
- trust tier
- review status

## CulturalAssertion

Atomic claim:

```text
subject = variant_x
predicate = construction.closure.direction
value = ...
qualifiers = period/region/etc
evidence = source + locator
```

Không overwrite assertion cũ khi nguồn mới mâu thuẫn.

Lifecycle:
- draft
- under_review
- verified
- published
- disputed
- deprecated
- rejected

Consensus:
- single_source
- corroborated
- strong_consensus
- mixed
- disputed
- uncertain

## Rights

Phân biệt:
- may_store
- may_display_publicly
- may_transform
- may_use_for_ai_reference
- may_export
- attribution_required

Unknown rights => deny public/AI by default.

## MediaBinding

Media là digital representation/evidence.

Lưu:
- source
- subject entity
- view_type
- qualifiers
- quality
- usage rights

View types:
- front
- back
- left/right
- three_quarter
- full_body
- collar_detail
- closure_detail
- sleeve_detail
- fabric_detail
- pattern_detail
- construction_diagram
- historical_context
- museum_display
- modern_reconstruction

Sau này có thể thêm bounding box/polygon annotation cho CV và education.
