# 05 — Attribute/Relation Registry Governance

Không cho production data tự tạo key tùy ý.

## Tạo Attribute mới

1. Proposal.
2. Nêu use case.
3. Kiểm tra có attribute tương đương chưa.
4. Chọn namespace.
5. Chọn value_type/cardinality.
6. Xác định applies_to.
7. Xác định có contextual/inheritable không.
8. Viết validator/tests.
9. Publish definition.

## Tạo Relation mới

1. Xác định source/target types.
2. Directional hay symmetric.
3. Có inverse không.
4. Contextual không.
5. Inheritable không.
6. Có evidence requirement không.
7. Tests.

## Không được làm

- `attribute_key = "abc_new_2"` chỉ vì UI cần.
- lưu cùng concept dưới nhiều key gần giống.
- dùng extensions để né governance.
