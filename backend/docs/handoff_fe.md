# Tài liệu bàn giao Backend Contract cho Frontend (M1 Handoff FE01–FE05)

**Dự án:** VietStylist (Việt Phục Remix)  
**Phiên bản API:** M1-BE Canonical (OpenAPI 3.1.0)  
**File Contract chuẩn:** `shared/openapi.json`  
**Ngày cập nhật:** 17/09/2026  

---

## 1. Tóm tắt các thay đổi kiến trúc và bảo mật quan trọng

1. **Khách (Guest) & Phiên đăng nhập (Authentication):**
   - Khách được tự do trải nghiệm Studio phối đồ, đổi màu sắc, xem quy tắc cổ phục và xuất ảnh hoàn toàn ở trình duyệt.
   - Các thao tác lưu trữ cá nhân lên máy chủ (`/api/outfits`, `/api/lookbooks`, `/api/media/uploads`, `/api/solution-forms`) **bắt buộc phải đăng nhập** (trả `401 UNAUTHORIZED` nếu thiếu token).
   - Tuyệt đối không fallback về một "guest owner" dùng chung trên server.
2. **Quyền sở hữu tài nguyên (Resource Ownership):**
   - Người dùng A không thể truy cập, sửa đổi, hay xóa Outfit, Form, Media hay Job của Người dùng B. Truy cập tài nguyên của người khác sẽ trả `404 NOT_FOUND` (để tránh rò rỉ sự tồn tại của dữ liệu cá nhân).
3. **An toàn Media (Signed Grants):**
   - Bucket `private` không cho phép tải trực tiếp qua URL tĩnh. Để tải/hiển thị ảnh cá nhân, Client gọi `/api/media/{media_id}/access` để nhận URL tạm kèm `grant` có thời hạn 300 giây.
4. **Chuẩn hóa phản hồi lỗi (Uniform Error Envelope):**
   Tất cả lỗi từ Backend đều tuân thủ cấu trúc JSON:
   ```json
   {
     "error": {
       "code": "MA_LOI_CHUAN",
       "message": "Thông điệp người dùng thân thiện bằng tiếng Việt",
       "status_code": 404,
       "request_id": "req_xxxxxx"
     }
   }
   ```

---

## 2. Chi tiết các Ticket tích hợp Frontend (FE01–FE05)

### FE01: Lưu bản nháp Outfit cục bộ và Đồng bộ sau Đăng nhập
- **Hiện trạng:** Trước đây khách lưu outfit gửi `owner_id=None`, server tự gán guest. Hiện tại server trả `401`.
- **Giải pháp Frontend:**
  1. Khi người dùng chưa đăng nhập bấm "Lưu bản phối", lưu snapshot vào `localStorage` (`vietstylist_draft_outfit`).
  2. Hiển thị modal/thông báo hướng dẫn đăng nhập để đồng bộ lên máy chủ và lưu trữ vĩnh viễn.
  3. Sau khi đăng nhập thành công, tự động đọc draft từ `localStorage` và gọi `POST /api/outfits` với header `Authorization: Bearer <token>`.
  4. Sau khi đồng bộ thành công, xóa draft khỏi `localStorage`.

### FE02: Tải lên Media và Hiển thị Ảnh riêng tư
- **Luồng Upload mới:**
  1. Gọi `POST /api/media/uploads` kèm body `{ "file_name": "...", "content_type": "image/png", "file_size": 123456, "purpose": "user_avatar" }`.
  2. Nhận phản hồi `{ "media_id": "...", "upload_url": "...", "upload_headers": { ... } }`.
  3. Client tải file trực tiếp lên `upload_url` theo phương thức PUT/POST được chỉ định (tại môi trường dev local, tải lên URL `/api/media/local-upload/{media_id}?grant=...`).
  4. Sau khi hoàn tất tải file, gọi `POST /api/media/{media_id}/complete` để kích hoạt trạng thái `ready`.
- **Hiển thị ảnh Private:**
  1. Thay vì dùng trực tiếp URL lưu trong DB, gọi `GET /api/media/{media_id}/access` để lấy `access_url`.
  2. Nếu token grant hết hạn sau 300 giây, Client tự động fetch lại `access_url` mới.

### FE03: Quản lý Lookbook toàn vẹn, URL Chia sẻ & Thu hồi Share
- **Toàn vẹn Lookbook (R07, R08):**
  - Không thể thêm phiên bản phối đồ của người khác hoặc đã bị xóa vào Lookbook. Nếu gửi phiên bản không hợp lệ, API trả `422 INVALID_OUTFIT_VERSION`. Giao diện giữ nguyên danh sách entries đã có, không xóa mất dữ liệu của người dùng.
  - Khi cập nhật Lookbook (`PUT /api/lookbooks/{id}`):
    - Bỏ qua trường `entries` (hoặc gửi `null`) -> Server chỉ cập nhật tiêu đề, mô tả, ảnh bìa; giữ nguyên toàn bộ entries.
    - Gửi `entries: []` -> Server xóa toàn bộ entries có chủ đích.
- **Chia sẻ Lookbook (R11):**
  - Tạo link chia sẻ: `POST /api/lookbooks/{id}/share` với body `{"expires_in_days": 1..30}` (mặc định 30).
  - Thu hồi liên kết: Gọi `DELETE /api/lookbooks/{id}/shares` để hủy kích hoạt tất cả share links của lookbook đó.
  - Người xem truy cập link `https://vietstylist.vn/chia-se/{token}`:
    - Nếu link bị thu hồi: API trả `404 SHARE_NOT_FOUND`.
    - Nếu link hết hạn: API trả `410 SHARE_EXPIRED`.

### FE04: Hiển thị Bài viết Di sản & Sản phẩm Catalog
- **Bộ lọc công khai (R09):**
  - Sản phẩm chưa duyệt (`is_published = 0`) và bài viết nháp (`status != 'published'`) sẽ tự động ẩn khỏi danh sách và trả về `404` khi truy cập trang chi tiết.
  - Client không cần tự lọc client-side; nếu nhận `404`, hiển thị màn hình "Trang không tìm thấy hoặc nội dung đang được cập nhật".

### FE05: Bản đồ Mã lỗi và Xử lý Trạng thái
| HTTP Status | Error Code | Ý nghĩa & Hướng xử lý Frontend |
|---|---|---|
| `401` | `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED` | Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Xóa token lưu trữ và điều hướng về luồng đăng nhập. Giữ lại dữ liệu nháp đang chỉnh sửa. |
| `403` | `FORBIDDEN` | Tài khoản không đủ quyền (ví dụ người dùng thường gọi API admin). Hiển thị thông báo không có quyền truy cập. |
| `404` | `NOT_FOUND`, `ITEM_NOT_FOUND`, `LOOKBOOK_NOT_FOUND` | Tài nguyên không tồn tại hoặc thuộc người dùng khác. Hiển thị trang 404. |
| `409` | `REVISION_CONFLICT` | Xung đột cập nhật đồng thời (CAS). Thông báo người dùng tải lại bản mới nhất hoặc giữ bản chỉnh sửa hiện tại. |
| `410` | `SHARE_EXPIRED` | Link chia sẻ đã hết hạn. Hiển thị thông báo yêu cầu người chia sẻ cấp link mới. |
| `422` | `INVALID_OUTFIT_VERSION`, `VALIDATION_ERROR` | Dữ liệu đầu vào không hợp lệ. Hiển thị lỗi form trực tiếp cho người dùng. |
| `503` | `TRY_ON_UNAVAILABLE` | Tính năng AI Try-on ảo đang bảo trì hoặc chưa tích hợp. Hiển thị thông báo "Tính năng đang được hoàn thiện". |
