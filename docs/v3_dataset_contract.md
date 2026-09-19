# Dataset V3 — trạng thái triển khai

Working tree remediation, chưa phát hành. Nội dung tri thức pilot do chủ dự án tự xác minh; các kiểm thử bên dưới dùng DB tạm và claim tổng hợp.

## API và phiên bản

- Admin gọi `POST /api/v3/editor/datasets` với `{ "label": "Tên bản dữ liệu" }` để chụp nội dung cultural graph đã công bố trong một transaction.
- `GET /api/v3/datasets` và `GET /api/v3/datasets/{version}` trả metadata; nội dung đầy đủ chỉ ở `GET /api/v3/editor/datasets/{version}/content`, yêu cầu editor/admin.
- ID dataset là `ds_` + SHA-256 của nội dung canonical JSON. Ruleset có hash riêng. Tạo lại cùng nội dung trả cùng dataset, không thay label hay timestamp đã lưu.
- GET education/composer/generation profile nhận query `dataset_version`. Grounding/validation nhận `outfit.dataset_version` và kiểm tra `ruleset_version` nếu được chỉ định.
- `dev` là đọc live, trả `reproducible=false`. Version không tồn tại hoặc manifest cũ không có content trả 404; ruleset không khớp trả 422. Không chấp nhận chuỗi version tùy ý như bảo đảm tái lập.

## Bất biến và thu hồi

Snapshot lưu nội dung public đã lọc, schema-format/resolver version và checksum. Không chụp bảng user, token, credentials hoặc media assets private. Extension nội bộ và payload withheld được redaction.

Replay dựng graph chỉ đọc trong SQLite memory từ giá trị đã lưu; tên bảng/cột lấy từ schema ứng dụng, không chạy SQL từ snapshot. Fact, evidence, locator, style và rule được lấy theo nội dung đóng băng. Chỉnh sửa thông thường trên live data tạo phiên bản mới, không sửa phiên bản cũ.

Nếu dependency bị unpublish/xóa/withheld hoặc quyền nguồn thay đổi, version cũ trả 409 `DATASET_WITHDRAWN`. Không lọc một phần rồi vẫn trả cùng version như thể kết quả không đổi. Cơ chế hiện tại bảo thủ: một dependency bất kỳ trong dataset bị thu hồi có thể làm cả version chưa khả dụng; chưa có phân vùng dataset theo garment.

Migration 010 thêm bảng content/rules cùng trigger chặn UPDATE/DELETE. Migration 011 bổ sung BEFORE INSERT khi trùng khóa để chặn cả `INSERT OR REPLACE` lúc SQLite tắt recursive triggers. Migration cũ không bị sửa checksum để áp bản vá này.

## Composer và validation

Bundle đã đọc renderable/variant/profile và rules từ DB thay vì mảng rỗng cố định. Profile SVG được kiểm tra bằng allowlist; media cần public/ready ở hiện tại. Không đưa URL ký vào snapshot.

Rule phải published, có assertion/source/locator khả dụng và context phù hợp. AST được giới hạn operator, độ sâu và số node. Thiếu rule phù hợp hoặc thiếu tri thức dùng trong rule trả `not_evaluated`, kèm `unevaluated_rule_ids`; không gọi thiếu dữ liệu là đạt chuẩn. Vi phạm có thật trả warning/error. Attribute multiple được đánh giá dưới dạng tập giá trị, không bị ghi đè bằng hàng cuối.

Mapping API `/api/v3/legacy-mappings` trả canonical ID và render ID từ bản ghi thực. Thiếu mapping/metadata thì không tự dựng ID. Frontend còn cần hoàn tất adapter và tích hợp có feature flag; chưa bật V3 production.

## Import legacy và kiểm chứng

Importer tạo canonical/source mới ở draft. Mapping đã có được giữ lại. Các variant/profile còn thiếu được nhập với ID ổn định và metadata gốc: legacy ID, anchor, scale, avatar, z-index, SVG/media. Không ghi đè tên/màu/geometry đã biên tập hoặc tự bật lại renderable đã tắt. Mapping hiện hành mâu thuẫn với renderable đã có làm transaction thất bại để xử lý rõ ràng.

Chưa chạy importer hoặc migration mới lên DB thật trong đợt kiểm thử. Trước áp dụng cần migration dry-run/backup và review mapping conflict.

Test liên quan: `test_v3_datasets.py`, `test_v3_composer.py`, `test_v3_legacy_render_import.py`, `test_migration_acceptance.py`. Đã kiểm chứng replay sau đổi live data, withdrawal, checksum/version, RBAC, REPLACE bypass, rules ba giá trị và bảo toàn dữ liệu import. Đây không phải bằng chứng chất lượng tri thức hoặc provider AI.
