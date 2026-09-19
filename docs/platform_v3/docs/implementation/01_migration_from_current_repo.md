# 01 — Migration từ repository hiện tại

## Những phần giữ nguyên trong giai đoạn đầu
- auth
- media storage
- lookbooks
- shares
- phần lớn admin
- SQLite runtime
- API v1

## Những phần tạo song song
- `cultural_data_v3`
- registry tables
- context entities
- projection services
- composer_v2
- generation orchestration

## Mapping legacy

### `garment_types`
Giữ để compatibility. Dần map sang canonical garment taxonomy.

### `items`
Không còn là source of truth.
Map:
```text
legacy item
→ canonical_entity_id
→ optional canonical_variant_id
→ renderable_item_id
```

### `item_variants`
Dần trở thành renderable variant / style option.

### `heritage_sources`
Có thể migrate metadata sang SourceRecord.

### `heritage_articles`
Giữ làm editorial content.
Không auto-convert toàn paragraph thành assertion.

### `cultural_rules`
Dual-run V1/V3. Rule mới dùng data-driven rule engine.

### `outfit_versions`
Read V1 bằng adapter, write V2.

## Legacy `era`
Không coi là canonical period.
Migration:
- giữ `legacy_era_text`
- mapping curated sang `period_id`
- nếu claim quan trọng, tạo assertion + evidence
- nếu chưa biết mapping: `not_collected`

## Legacy region
Nếu không có, tuyệt đối không đoán.
State = `not_collected`.

## Frontend

Giai đoạn 1:
```text
legacy studio
+ new data backend
```

Giai đoạn 2:
```text
new Composer reducer
+ old Canvas2D adapter
```

Giai đoạn 3:
```text
new Composer
+ projection API
+ generation pipeline
```

## Không làm Big Bang Migration
Không drop bảng, không đổi URL, không rewrite tất cả outfit trong sprint đầu.
