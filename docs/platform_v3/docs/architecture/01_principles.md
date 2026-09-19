# 01 — Nguyên lý kiến trúc

## 1. Stable Core + Extensible Registry

Core chỉ giữ các primitive rất ổn định:

- Entity
- EntityVersion
- AttributeDefinition
- AttributeValue
- RelationDefinition
- EntityRelation
- ContextQualifier
- SourceRecord
- CulturalAssertion
- AssertionEvidence
- MediaBinding
- ReviewRecord
- DatasetSnapshot

Thuộc tính văn hóa mới không đồng nghĩa thêm column.

## 2. Không dùng “JSON tùy ý” làm giải pháp mở rộng

Mở rộng phải có governance:

```text
AttributeDefinition
  key
  type
  cardinality
  allowed values
  applies_to
  contextual
  queryable
  inheritable
  version
```

`extensions` chỉ dành cho module-specific data. Nếu dữ liệu trở thành cross-system critical thì promote thành registry definition chính thức.

## 3. Explicit Missing State

Không dùng `null` cho tất cả:

- known
- unknown
- not_collected
- not_applicable
- disputed
- inferred
- withheld

## 4. Context First

Một fact có thể chỉ đúng theo:
- period
- region
- place
- community
- occasion
- social context

Không duplicate toàn garment chỉ vì context khác.

## 5. Evidence First

```text
Claim → Evidence Locator → Source
```

Fact nào ảnh hưởng cultural warning hoặc generation hard constraint phải truy được nguồn.

## 6. Projection Over Direct Graph Consumption

Frontend không query graph thô. Backend build projection theo feature.

Feature mới phần lớn nên là:
```text
new ProjectionBuilder
```
chứ không phải:
```text
new DB columns everywhere
```

## 7. Provider Independence

Cultural data lưu semantic constraints, không lưu prompt của Gemini/Imagen.

## 8. Versioning

Version tối thiểu:
- entity
- attribute definition
- relation definition
- dataset snapshot
- ruleset
- OutfitSpec
- generation profile
- prompt template
- provider/model
- post-validator
