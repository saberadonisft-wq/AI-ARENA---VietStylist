# VietStylist Data Platform v3 — COMPLETE BLUEPRINT

Bộ này là bản thiết kế dài hạn cho VietStylist, gồm nguyên lý, schema, migration, code scaffold, fixture, validator, prompt triển khai và checklist bàn giao.

## Mục tiêu

- Thu thập dữ liệu gốc một lần và tái sử dụng cho Education, Composer, AI Generation, Timeline, Map, Search, RAG và các feature tương lai.
- Không thiết kế dữ liệu theo UI hiện tại.
- Không thêm cột DB tùy tiện mỗi khi xuất hiện một đặc tính văn hóa mới.
- Hỗ trợ dữ liệu chưa thu thập, không biết, không áp dụng, tranh luận, suy luận và bị ẩn.
- Cho phép mở rộng Attribute/Relation/Context bằng registry.
- Tách tri thức văn hóa khỏi asset 2D, AI provider, 3D, commerce, wardrobe cá nhân và social.
- User tự phối đồ; AI không quyết định outfit thay user.
- Mọi claim quan trọng đều truy được về nguồn.

## Mô hình tổng thể

```text
RAW SOURCE / MEDIA
        ↓
ASSERTION / EVIDENCE
        ↓
ENTITY + ATTRIBUTE + RELATION + CONTEXT
        ↓
CANONICAL CULTURAL GRAPH
        ↓
PROJECTION LAYER
   ├─ EducationDetail
   ├─ ComposerBundle
   ├─ GenerationProfile
   ├─ TimelineView
   ├─ MapView
   ├─ SearchDocument
   └─ RAGDocument
```

## Nguyên tắc bất biến

```text
CanonicalEntity
≠ PhysicalInstance
≠ DigitalRepresentation
≠ CommercialProduct
≠ UserOwnedItem
```

Ví dụ “Áo ngũ thân” có thể liên kết tới hiện vật bảo tàng, asset 2D, model 3D, sản phẩm cửa hàng hoặc món đồ user sở hữu; nhưng các đối tượng đó không phải cùng một record.

## Cách đọc

1. `docs/architecture/01_principles.md`
2. `docs/data/01_meta_model.md`
3. `docs/data/02_missing_state.md`
4. `docs/data/03_context_variants.md`
5. `docs/data/04_sources_assertions_media.md`
6. `docs/architecture/02_projection_layer.md`
7. `docs/architecture/03_domain_boundaries.md`
8. `docs/implementation/01_migration_from_current_repo.md`
9. `docs/implementation/02_execution_plan.md`
10. `reference_impl/`
11. `prompts/MASTER_IMPLEMENTATION_PROMPT.md`

## Lưu ý

Đây là scaffold/reference implementation để BE tích hợp có kiểm soát vào repo hiện tại. Không nên copy toàn bộ vào production trong một commit.
