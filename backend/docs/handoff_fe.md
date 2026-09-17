# Bàn giao API sau sửa nghiệm thu — 17/09/2026

Contract runtime: `shared/openapi.json`. Phạm vi thay đổi là Backend; FE01–FE05 bên dưới là công việc tích hợp của Frontend, chưa được xác nhận E2E. Chưa commit/push/deploy trong đợt sửa này.

## FE01 — Draft và tài nguyên cá nhân

Guest vẫn có thể dùng Studio và export ở trình duyệt. Các API lưu tài nguyên cá nhân yêu cầu Bearer JWT thật: `/api/outfits`, `/api/lookbooks`, `/api/media/uploads`, `/api/solution-form` (số ít), `/api/ai/jobs/{id}`. Không dùng token `dev-user-*`; hãy đăng ký/đăng nhập tài khoản local hoặc Google đã cấu hình. Quyền được đọc lại từ DB mỗi request.

Giữ draft bằng key hiện có `viet_stylist_current_draft`. Giữ snapshot và transform khi nhận 401/409; chỉ xóa draft sau khi API lưu thành công. Token sai không tự hạ xuống guest. Guest nhận 401 ở tài nguyên private; người đăng nhập khác owner nhận 404. Backend không sửa client hoặc localStorage của Frontend.

## FE02 — Upload và đọc media

1. Gọi `POST /api/media/uploads` với Bearer và JSON sau (ảnh PNG hợp lệ):

```json
{
  "filename": "portrait.png",
  "media_type": "image",
  "mime_type": "image/png",
  "size_bytes": 1024,
  "visibility": "private"
}
```

`size_bytes` là khai báo; server luôn kiểm tra bytes thực tế. Có thể bỏ trường này nếu chưa biết dung lượng. Visibility chỉ nhận `private`, `unlisted`, `public`; public và SVG chỉ dành cho admin/editor. PNG/JPEG/WebP ≤10 MiB, ảnh ≤40 triệu pixel; MP4 ≤50 MiB, ≤10 phút và cần ffprobe trên máy chủ. SVG giới hạn hình học tĩnh, không script/link/style/filter. Ảnh raster được decode và encode lại, bỏ metadata/appended bytes; animation không được hỗ trợ.

2. Response `UploadUrlResponse` có `media_id`, `upload_url`, `method`, `object_key`, `bucket`, `expires_in`, `storage_type`. Không có `upload_headers`. `object_key`/`bucket` ở bước này là staging PRIVATE; không dùng làm URL ảnh.

- `storage_type=local`, `method=POST`: gửi multipart `FormData` với field `file` đến **nguyên URL được cấp**, có grant. Không tự đặt Content-Type multipart (trình duyệt cần tạo boundary). URL dùng một lần; replay trả 409. Thiếu/sai grant trả 422/403.
- `storage_type=r2`, `method=PUT`: gửi raw bytes của File, header `Content-Type` đúng `mime_type` lúc tạo session, tới nguyên presigned URL. Không gửi JWT app đến R2. URL PUT có thể dùng lại tới khi hết TTL 900 giây, nhưng chỉ ghi vào staging; không ghi đè key final.
- Endpoint legacy `/api/media/local-upload?key=...` đã tắt: dev 410; production 404. Production không có local upload/file routes trong OpenAPI.

3. Upload bytes thành công rồi gọi `POST /api/media/{media_id}/complete`, Bearer và body `{}`. Width/height do server xác minh; client không thể đặt metadata giả. Server trả `MediaAssetResponse` với `status=ready` và key final khác key staging. Chỉ bước complete thành công mới được báo upload hoàn tất. Complete lại file ready trả cùng asset; pending chưa upload/processing/deleting/deleted trả 409. Dữ liệu sai trả 422, quá lớn 413; storage/validator chưa sẵn sàng 503.

4. Gọi `GET /api/media/{media_id}/access` để lấy `{access_url, expires_in: 300}`. Private/unlisted cần owner JWT. Local trả read grant; R2 trả signed GET. Giữ media_id lâu dài, không lưu URL ngắn hạn làm định danh. Grant hết hạn thì xin URL mới; không retry vô hạn khi file đã xóa.

5. `DELETE /api/media/{media_id}` cần owner. Thành công trả `{message, status: "deleted"}`. Storage lỗi trả **503 STORAGE_DELETE_FAILED** và giữ trạng thái deleting để retry; không hiển thị “đã xóa” ở trường hợp này. File đang xử lý trả 409 MEDIA_BUSY. Retry DELETE sau khi thành công là idempotent. Metadata tombstone được giữ phục vụ reconciliation. URL R2 đã ký có thể còn hiệu lực tới hết TTL, nhưng object đã xóa không còn bytes để đọc.

## FE03 — Lookbook và share

- Chỉ `public` cho phép GET bằng ID không đăng nhập. `private`/`unlisted` cần owner khi đọc bằng ID; người xem khác phải dùng token share hợp lệ. Revoke token không biến lookbook thành public.
- Create/update không nhận outfit version khác owner, version đã xóa hoặc không tồn tại: 422 INVALID_OUTFIT_VERSION. Update metadata + entries là một transaction; thất bại giữ nguyên mọi dữ liệu.
- PUT bỏ `entries` hoặc `entries:null` giữ entries hiện tại; `entries:[]` xóa có chủ đích.
- `POST /api/lookbooks/{id}/share` với `{"expires_in_days": 1..30}`, mặc định 30. URL lấy origin cấu hình; không tự nối localhost.
- `DELETE /api/lookbooks/{id}/shares` thu hồi mọi link hiện hành. Người khác owner nhận 404.
- `GET /api/shares/{token}`: missing/revoked 404; expired 410. Dữ liệu cũ tham chiếu outfit sai owner bị loại khỏi projection, bản ghi vẫn được giữ để đối soát.

## FE04 — Nội dung public và AI

Catalog/heritage chỉ trả nội dung đã publish. Color suggestions, starter outfits và recommendations cũng lọc unpublished. Một starter outfit có item bị ẩn được loại cả template.

AI response sai cấu trúc/ID hoặc upstream lỗi chuyển sang fallback và nêu `source=cultural_rule_engine`; không coi fallback là phản hồi Gemini. Locked item/variant sai trả 422 INVALID_LOCKED_ITEM, không tự đổi màu đã khóa. Thời tiết dự phòng nêu `source=sample`; cache sample 1 phút để phục hồi sớm. Try-on vẫn trả 503 TRY_ON_UNAVAILABLE khi chưa có provider thật.

## FE05 — Error envelope và retry

```json
{
  "error": {
    "code": "INVALID_UPLOAD_STATE",
    "message": "Upload chưa hoàn tất hoặc phiên không còn hợp lệ",
    "status_code": 409,
    "request_id": "req_example",
    "details": {}
  }
}
```

| HTTP | Xử lý client |
| --- | --- |
| 401 | Xin đăng nhập lại, giữ draft; không tự gửi request dưới danh nghĩa guest |
| 403 | Thiếu quyền hoặc grant sai; không retry cùng request vô hạn |
| 404 | Không có quyền thấy tài nguyên hoặc tài nguyên không tồn tại |
| 409 | CAS conflict, upload chưa xong, phiên hết hạn hoặc media đang xử lý; giữ dữ liệu và tải trạng thái mới |
| 410 | Share hết hạn hoặc endpoint upload legacy đã bị bỏ |
| 413 | Giảm dung lượng file; tạo session mới khi session cũ bị rejected |
| 422 | Hiển thị lỗi validation; hex màu chỉ nhận 3/6 ký tự hex, có/không `#` |
| 429 | Đọc `Retry-After` và `details.retry_after`, đợi trước khi gửi lại |
| 503 | Storage/provider/ffprobe chưa sẵn sàng; không báo thành công |

Auth giới hạn 20 request/phút/IP cho từng endpoint đăng ký/login/Google. AI giới hạn 10/phút và 100/ngày theo user hoặc guest IP, đồng thời tối đa 4 request gọi provider trong mỗi process. IP dùng địa chỉ kết nối đã được proxy server tin cậy xác thực; không đọc tùy ý X-Forwarded-For trong app.

Backend tests đã kiểm tra payload upload ở tài liệu này; Frontend còn cần chạy các luồng guest draft → login → sync, private media, CAS conflict, unlisted share/revoke và expired session bằng Playwright khi tích hợp contract.
