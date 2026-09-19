# 03 — Context, Period, Region, Variant

## PeriodDefinition

Không dùng chỉ `era = "Nguyễn"`.

```text
id
name
parent_period_id
date_range.from
date_range.to
precision
approximate
aliases
```

Precision:
- exact_date
- year
- decade
- century
- dynasty
- period
- approximate
- unknown

## RegionDefinition

Region văn hóa có hierarchy và không bắt buộc trùng địa giới hành chính hiện đại.

## PlaceDefinition
Địa điểm cụ thể.

## CommunityDefinition
Dùng khi context là cộng đồng/nhóm văn hóa.

## Qualifiers

```json
{
  "period_ids": [],
  "region_ids": [],
  "place_ids": [],
  "community_ids": [],
  "occasion_ids": [],
  "social_context_ids": []
}
```

## Variant Inheritance

```text
Garment Family
→ Historical Variant
→ Regional Variant
→ Modern Reconstruction
```

Variant có thể lưu override thay vì copy toàn bộ parent.

Effective resolver:
```text
parent attributes
+ inherited relations
+ variant overrides
+ context-specific values
```

Quan hệ hữu ích:
- derived_from
- influenced_by
- regional_variant_of
- modern_adaptation_of
- reconstructed_from
- documented_before
- documented_after
- used_with
- layered_over
- layered_under
- made_from
- produced_by
- used_during
- associated_with
- documented_in
