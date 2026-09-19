# MASTER IMPLEMENTATION PROMPT

Bạn đang tích hợp VietStylist Data Platform v3 vào repository VietStylist hiện tại.

## Trước khi sửa code

Đọc package này và các vùng source hiện tại:
- backend/app/main.py
- backend/app/core/database.py
- backend/app/core/migrations.py
- backend/app/modules/catalog/
- backend/app/modules/cultural_rules/
- backend/app/modules/heritage/
- backend/app/modules/outfits/
- backend/app/modules/media/
- backend/app/modules/try_on/
- frontend/src/app/page.tsx
- frontend/src/features/studio/state.ts
- frontend/src/features/studio/Canvas2D.tsx
- frontend/src/lib/api/client.ts
- shared/openapi.json

Báo mapping current → target trước. Chưa sửa code.

## Luật cứng

1. Không rewrite project.
2. Không destructive V1 migrations.
3. V1 endpoints phải còn hoạt động.
4. Cultural core không chứa provider-specific prompt.
5. Cultural core không chứa commerce/social/3D/wardrobe data.
6. Không dùng null thay mọi loại missing.
7. Attribute/relation mới phải qua registry.
8. Không hard-code cultural fact trong React.
9. Không hard-code garment-specific rule nếu rule engine biểu diễn được.
10. Không gửi media cho AI nếu rights không cho phép.
11. Không external AI call trong unit tests.
12. Mỗi phase test xong phải dừng.

## Phase order

A. Meta-model contracts + validator  
B. Additive DB + repositories  
C. Legacy adapters  
D. Projection builders  
E. OutfitSpec + Composer state  
F. Rule engine  
G. Generation mock  
H. Real provider  
I. Pilot data  
J. Switch default UI  

## Output cuối mỗi phase

- Summary
- Files added
- Files modified
- DB migration
- API changes
- Tests run
- Test results
- Known limitations
- Rollback
- Next prerequisites

Không tự sang phase tiếp.
