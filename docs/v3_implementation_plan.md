# Tích hợp VietStylist Data Platform v3 vào AI-ARENA---VietStylist

## Bối cảnh

Tích hợp bản thiết kế Cultural Knowledge Graph (v3 Blueprint) vào repo hiện tại — một ứng dụng FastAPI + Next.js đang hoạt động với 12+ modules, 25+ bảng SQLite, và 7 migrations đã áp dụng.

### Nguyên tắc bất biến (theo Blueprint)
- **Không Big Bang** — V1 endpoints & data phải chạy song song
- **Additive only** — Không drop bảng, không đổi URL hiện tại
- **Mỗi phase test xong mới sang phase tiếp**

---

## Gap Analysis: Current Repo vs Blueprint v3

| Khía cạnh | Repo hiện tại | Blueprint v3 |
|-----------|--------------|-------------|
| **Garment data** | `items` + `item_variants` + `garment_types` — flat tables | `entity_registry` + `attribute_definitions` + `attribute_values` — knowledge graph |
| **Cultural rules** | 3 hardcoded Python rules trong `cultural_rules/service.py` | Data-driven rule engine với operators (eq, neq, in, all, any...) |
| **Heritage sources** | `heritage_sources` — basic citation | `cultural_sources_v3` — rights management, trust tiers, review status |
| **Evidence/Assertions** | Không có | `cultural_assertions_v3` + `assertion_evidence_v3` — atomic claims truy nguồn |
| **Context** | `era` text field trên items/articles | `ContextQualifier` — period_ids, region_ids, place_ids, community_ids, occasion_ids |
| **Missing state** | `null` cho mọi thứ | 7 explicit states: known, unknown, not_collected, disputed, inferred, withheld, not_applicable |
| **Outfit schema** | `OutfitSnapshot` V1 — itemId, variantId trực tiếp | `OutfitSpecV2` — canonical_entity_id, dataset_version, ruleset_version |
| **Projections** | Frontend query trực tiếp | Projection Layer: Education, Composer, Generation, Timeline, Map, Search, RAG |
| **AI Generation** | `try_on` stub (503) | Full pipeline: GroundingBuilder → ReferenceSelector → PromptBuilder → Provider → PostValidation |
| **Contracts** | Pydantic schemas rải rác từng module | Centralized contracts: Python + TypeScript + JSON Schema |

---

## User Review Required

> [!IMPORTANT]
> **Phase A–C là nền tảng**, cần triển khai trước khi có thể dùng bất kỳ feature v3 nào. Tổng estimate: **~800–1000 LOC backend mới**, 0 breaking changes.

> [!WARNING]
> **Legacy `era` text** trên `items` và `heritage_articles` sẽ KHÔNG bị xóa. Blueprint khuyên giữ `legacy_era_text` và tạo curated mapping sang `period_id` trong V3 — chỉ khi DATA team đã nghiên cứu xong.

> [!CAUTION]
> Blueprint nói rõ: **"Không tự sang phase tiếp"**. Sau mỗi phase, tôi sẽ dừng để bạn review và xác nhận trước khi tiếp tục.

---

## Open Questions

> [!IMPORTANT]
> 1. **Pilot garment**: Blueprint gợi ý làm 1 garment pilot sâu (Phase F). Bạn muốn chọn garment nào để pilot? (VD: Áo ngũ thân — `ngu_than`, vì đã có nhiều data trong repo)
> 2. **Starter data**: Bạn muốn tôi seed dữ liệu v3 demo ngay (entity + attributes + relations cho 1–2 garments hiện có) hay chỉ tạo schema trống chờ DATA team nhập?
> 3. **Frontend v3**: Blueprint có 3 giai đoạn FE migration. Trong lần tích hợp đầu này, bạn muốn tôi chỉ làm backend (Phase A–C), hay kèm luôn TypeScript contracts cho frontend?

---

## Proposed Changes

Tôi sẽ triển khai **Phase A → B → C** (Meta-model → Storage → Projections) trong đợt đầu tiên. Đây là foundation cần có trước mọi thứ khác.

---

### Phase A — Meta-model Contracts + Validators

Tạo V3 domain models, validators, fixtures, và tests. **Không sửa bất kỳ file hiện tại nào.**

#### [NEW] [models.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/domain/models.py)
V3 Pydantic models (từ blueprint `contracts/python/models.py`):
- `Entity`, `AttributeDefinition`, `AttributeValue` (với `@model_validator` cho known→value, disputed→candidates)
- `RelationDefinition`, `EntityRelation`, `ContextQualifier`
- `CulturalAssertion`, `EvidenceRef`, `SourceRecord`
- `OutfitSpecV2`, `OutfitSelection`
- `MissingState` type

#### [NEW] [validators.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/domain/validators.py)
Registry validation logic:
- Reject unknown attribute keys
- Reject invalid relation endpoints (wrong source/target types)
- Enforce missing-state semantics
- Validate allowed_values cho enum types

#### [NEW] [vocabularies.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/domain/vocabularies.py)
Core vocabulary constants (từ blueprint `data/vocabularies/core.json`):
- `ENTITY_TYPES`, `MISSING_STATES`, `SOURCE_TYPES`, `RELATION_TYPES`

#### [NEW] Fixtures directory
- `backend/app/modules/cultural_data_v3/fixtures/entity.demo.json`
- `backend/app/modules/cultural_data_v3/fixtures/attribute_definitions.demo.json`
- `backend/app/modules/cultural_data_v3/fixtures/attribute_values.demo.json`
- `backend/app/modules/cultural_data_v3/fixtures/relation_definitions.demo.json`

#### [NEW] [test_v3_models.py](file:///d:/AI-ARENA---VietStylist/backend/tests/test_v3_models.py)
Tests:
- `known` without value → raises
- `disputed` without candidates → raises  
- Unknown registry key → rejected
- Invalid relation endpoint → rejected
- Valid entity + attributes → passes

---

### Phase B — Additive DB Migration + Repositories

Thêm V3 tables song song, KHÔNG đụng bảng cũ. V1 regression phải green.

#### [MODIFY] [migrations.py](file:///d:/AI-ARENA---VietStylist/backend/app/core/migrations.py)
Thêm 2 migration functions vào `MIGRATIONS` list:

**`008_cultural_data_v3`** — 11 bảng mới:
| Bảng | Mô tả |
|------|-------|
| `entity_registry` | Canonical cultural entities |
| `attribute_definitions` | Attribute registry (key, type, cardinality, allowed_values) |
| `attribute_values` | Attribute values với state + qualifiers + assertion_ids |
| `relation_definitions` | Relation registry |
| `entity_relations` | Relations giữa entities |
| `cultural_sources_v3` | Sources với rights, trust_tier |
| `cultural_assertions_v3` | Atomic cultural claims |
| `assertion_evidence_v3` | Evidence linking assertion → source |
| `cultural_media_bindings_v3` | Media gắn entity + source |
| `dataset_snapshots_v3` | Dataset version snapshots |
| `legacy_entity_mappings_v3` | Map bảng legacy → canonical entity |

**`009_render_generation_v3`** — 4 bảng:
| Bảng | Mô tả |
|------|-------|
| `renderable_items_v3` | Renderable items gắn canonical entity |
| `renderable_variants_v3` | Style variants |
| `render_profiles_v3` | Render profiles (avatar, pose) |
| `generation_profiles_v3` | AI generation profiles |

#### [NEW] [repository.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/repository.py)
V3 repository với registry validation:
- `add_entity()`, `get_entity()`
- `add_attribute_definition()`, `add_attribute_value()` — reject unknown key, wrong applies_to
- `add_relation_definition()`, `add_relation()` — reject wrong source/target types
- `values_for()`, `relations_from()`
- `add_source()`, `add_assertion()`
- `create_legacy_mapping()`

#### [NEW] [test_v3_migration.py](file:///d:/AI-ARENA---VietStylist/backend/tests/test_v3_migration.py)
- V3 tables exist after migration
- V1 tables unmodified
- Foreign keys enforced
- Legacy mapping works

---

### Phase C — Projection Builders + API

V3 API endpoints song song V1. Frontend không cần đọc graph raw.

#### [NEW] [resolver.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/services/resolver.py)
`EffectiveEntityResolver` — resolve entity + attributes + relations, hỗ trợ variant inheritance.

#### [NEW] [projections.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/services/projections.py)
3 projection builders:
- `EducationProjectionBuilder` — cho trang chi tiết trang phục
- `ComposerBundleBuilder` — cho Studio composer
- `GenerationProfileBuilder` — cho AI generation (must_preserve, may_vary, forbidden)

#### [NEW] [rule_engine.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/services/rule_engine.py)
Safe data-driven rule engine (operators: eq, neq, in, not_in, contains, exists, missing, all, any).

#### [NEW] [generation.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/services/generation.py)
- `GroundingBuilder` — build grounding package từ outfit + profiles
- `GenerationProvider` protocol
- `ProviderRequest/Result` dataclasses
- `canonical_hash()` cho idempotency

#### [NEW] [mock.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/providers/mock.py)
`MockGenerationProvider` — trả kết quả mock cho testing.

#### [NEW] [router.py](file:///d:/AI-ARENA---VietStylist/backend/app/modules/cultural_data_v3/router.py)
V3 API endpoints (prefix `/api/v3`):
```
GET  /api/v3/entities/{id}/education    → EducationProjection
GET  /api/v3/composer/bundles/{id}      → ComposerBundle
GET  /api/v3/generation/profiles/{id}   → GenerationProfile
POST /api/v3/outfits/validate           → Validate OutfitSpecV2
GET  /api/v3/entities                   → List entities
POST /api/v3/entities                   → Create entity
```

#### [MODIFY] [main.py](file:///d:/AI-ARENA---VietStylist/backend/app/main.py)
Chỉ thêm 1 dòng import + 1 dòng include_router:
```python
from app.modules.cultural_data_v3.router import router as cultural_v3_router
app.include_router(cultural_v3_router, prefix=api_prefix)
```

#### [NEW] [test_v3_api.py](file:///d:/AI-ARENA---VietStylist/backend/tests/test_v3_api.py)
- Education projection returns correct format
- Composer bundle includes dataset_version
- Generation profile categorizes attributes (must_preserve vs may_vary)
- OutfitSpecV2 validation works
- Unknown entity → 404

---

### File Structure (tất cả files MỚI, không sửa files hiện tại ngoại trừ migrations.py và main.py)

```
backend/app/modules/cultural_data_v3/
├── __init__.py
├── router.py                         # V3 API endpoints
├── repository.py                     # V3 DB repository
├── domain/
│   ├── __init__.py
│   ├── models.py                     # V3 Pydantic models
│   ├── validators.py                 # Registry validation
│   └── vocabularies.py              # Core vocabulary constants
├── services/
│   ├── __init__.py
│   ├── resolver.py                   # EffectiveEntityResolver
│   ├── projections.py               # 3 projection builders
│   ├── rule_engine.py               # Data-driven rule engine
│   └── generation.py                # Grounding + provider protocol
├── providers/
│   ├── __init__.py
│   └── mock.py                       # MockGenerationProvider
└── fixtures/
    ├── entity.demo.json
    ├── attribute_definitions.demo.json
    ├── attribute_values.demo.json
    └── relation_definitions.demo.json

backend/tests/
├── test_v3_models.py                 # Domain model tests
├── test_v3_migration.py             # Migration tests  
└── test_v3_api.py                    # API endpoint tests
```

---

## Verification Plan

### Automated Tests

```bash
# Chạy toàn bộ V1 tests (phải pass, không regression)
cd d:\AI-ARENA---VietStylist\backend
python -m pytest tests/ -x -q

# Chạy riêng V3 tests
python -m pytest tests/test_v3_models.py tests/test_v3_migration.py tests/test_v3_api.py -v

# Validate V3 fixtures
python -m app.modules.cultural_data_v3.domain.validators
```

### Manual Verification
- V1 API vẫn hoạt động: `GET /api/catalog/items`, `POST /api/cultural-check`, `POST /api/outfits`
- V3 API mới hoạt động: `GET /api/v3/entities/{id}/education`
- Database migration chạy không lỗi
- Studio frontend không bị ảnh hưởng (V1 endpoints unchanged)

---

## Tổng kết Impact

| Metric | Giá trị |
|--------|---------|
| **Files mới** | ~15 files |
| **Files sửa** | 2 files (migrations.py + main.py) |
| **Dòng code mới** | ~800–1000 LOC |
| **Bảng DB mới** | 15 bảng (additive) |
| **Bảng DB sửa** | 0 |
| **V1 endpoints ảnh hưởng** | 0 |
| **Breaking changes** | 0 |
| **V3 API endpoints mới** | 6 |
