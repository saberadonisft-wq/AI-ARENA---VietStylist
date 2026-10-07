# Cộng đồng Lookbook

Lookbook có bốn mục: Khám phá, Của tôi, Yêu thích và Bộ sưu tập. Khách xem bài công khai; đăng bài, lưu yêu thích và báo cáo cần đăng nhập. Bộ sưu tập cũ vẫn được giữ, không tự chuyển thành bài công khai.

## Đăng và quản lý bài

Từ Studio, nút Đăng lên Lookbook lưu bộ phối trước rồi mở trình soạn bài với phiên bản vừa lưu. Có thể chọn bộ phối đã lưu trực tiếp trong Lookbook. Tiêu đề, mô tả, quyền xem và ảnh được xem trước trước khi gửi. Bài mới mặc định riêng tư. Ảnh PNG dùng cùng Canvas2D và đường xuất ảnh của Studio; ảnh gốc được lưu trong bucket riêng tư.

Bài tham chiếu một outfit_version_id cố định. Sửa bộ phối trong Studio không tự sửa bài đã đăng. Chủ bài có thể cập nhật nội dung, chọn phiên bản mới, đổi quyền xem hoặc xóa bài. Xóa bài không xóa bộ phối gốc; xóa bộ phối gốc sẽ ngừng hiển thị bài và thu hồi link liên quan.

Nháp được giữ theo tài khoản trong sessionStorage; không lưu nội dung bài hoặc URL ảnh trong trạng thái danh sách. Idempotency-Key ngăn tạo hai bài khi mất phản hồi rồi gửi lại. Revision ngăn ghi đè thay đổi từ tab khác.

## Quyền xem

| Trạng thái | Khám phá/hồ sơ công khai | Chủ bài | Người khác | Lưu yêu thích |
| --- | --- | --- | --- | --- |
| Công khai | Có | Có | Xem trang bài | Có |
| Riêng tư | Không | Có | Không | Không |
| Người có liên kết | Không | Có | Link còn hiệu lực | Không |
| Bị kiểm duyệt ẩn | Không | Xem kèm lý do | Không | Không |

Bài công khai có URL cố định và metadata chia sẻ. Bài có liên kết dùng token ngẫu nhiên, server chỉ giữ hash; hạn 1/7/30 ngày, thu hồi từng link hoặc tất cả. Riêng tư không tạo link. Khi chuyển riêng tư, xóa hoặc ẩn bài, các link bị thu hồi. Link cũ của bộ sưu tập riêng tư cũng bị thu hồi trong migration.

Ảnh được phục vụ qua endpoint kiểm tra quyền hiện tại, revision, tài khoản, trạng thái bài và media. Capability ảnh có hạn 300 giây và vẫn kiểm tra quyền ở mỗi lần đọc; cache-control private, no-store và no-referrer. Việc thu hồi chặn các lượt tải tiếp theo; ảnh đã tải hoặc bản sao bên ngoài không thể thu hồi.

Yêu thích lưu tham chiếu tới bài, không sao chép bộ phối. Bài chuyển riêng tư, bị ẩn hoặc xóa sẽ thành mục không còn khả dụng, không lộ ảnh/nội dung, và người lưu có thể bỏ mục này. Hồ sơ công khai chỉ chứa tên, ảnh đại diện và giới thiệu; không trả email.

## Kiểm duyệt và vận hành

Báo cáo có giới hạn tốc độ và chống trùng. Quản trị viên xem hàng đợi, ẩn/khôi phục bài với lý do, hoặc đóng báo cáo của bài đã xóa. Tác giả sửa bài không tự gỡ trạng thái bị ẩn.

Migration SQLite 014_lookbook_community và PostgreSQL pg_003_lookbook_community là bổ sung bảng/index; không thay checksum migration cũ và không công khai dữ liệu cũ. PostgreSQL bật RLS, thu hồi quyền trực tiếp của PUBLIC/anon/authenticated; ứng dụng kiểm tra quyền qua API.

Trước phát hành, sao lưu dữ liệu và chạy theo môi trường đã cấu hình:

```powershell
python backend/scripts/migrate.py --dry-run
python backend/scripts/migrate.py
python backend/scripts/migrate.py --check
python backend/scripts/export_openapi.py --check
```

LOOKBOOK_COMMUNITY_ENABLED=false tạm tắt API cộng đồng, vẫn giữ API bộ sưu tập cũ. Giao diện báo lỗi kèm đường dẫn tới Bộ sưu tập cá nhân. Migration vẫn cần chạy trước khi khởi động phiên bản mới.

## Kiểm chứng

- Test API: quyền chủ/người khác/khách, phiên bản cố định, ảnh và link thu hồi, idempotency, tìm kiếm tiếng Việt, cursor, yêu thích, báo cáo/kiểm duyệt, feature flag và migration từ schema cũ.
- Browser mock: khám phá khách, bộ lọc, reload, yêu thích, nháp lỗi, bàn phím modal và viewport 320/375/1440.
- Browser với API thật trên DB tạm: nút đăng từ Studio, xuất/tải ảnh PNG, mất phản hồi và thử lại, nhiều tài khoản, link khách, chuyển riêng tư, metadata và mục yêu thích không còn khả dụng.
- PostgreSQL thật: test_postgres_runtime với TEST_POSTGRES_URL, schema và dữ liệu thử rollback; không áp migration lên schema ứng dụng.
- R2 thật: python backend/scripts/verify_lookbook_storage.py dùng ảnh tổng hợp nhỏ, kiểm tra byte ảnh và thu hồi rồi dọn các object thử. Không dùng ảnh người dùng.

Các phép thử không chứng minh đã phát hành production hoặc đã kiểm tra trên điện thoại thật. Bình luận, theo dõi tác giả, thông báo và tin nhắn chưa thuộc phiên bản này.
