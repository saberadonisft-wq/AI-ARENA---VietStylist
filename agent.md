# Bàn giao thay đổi Backend cho Frontend

Cập nhật: **17/09/2026** — dự án Việt phục Remix / VietStylist.

Tài liệu này ghi lại trạng thái sau đợt sửa lỗi nghiệm thu để đồng nghiệp Frontend cập nhật client, type và giao diện. Quy ước cộng tác vẫn theo [rule.md](rule.md).

## 1. Trạng thái bàn giao

- Backend đã sửa các mục F01–F16 của đợt nghiệm thu. Thay đổi nằm trong `backend/**` và `shared/openapi.json`; đợt sửa không chỉnh Frontend.
- Branch hiện tại: `backend/acceptance-fixes-20260917`, nền commit `c3d49b2`. Tại thời điểm viết, các thay đổi **chưa commit, push, merge hoặc deploy**. Đồng nghiệp ở checkout khác cần nhận commit Backend/contract đã được review trước khi tích hợp; chỉ pull branch lúc này chưa chắc nhận được các sửa đổi trong working tree.
- Frontend chưa được xác nhận tương thích hoặc chạy E2E với toàn bộ thay đổi bên dưới.
- Runtime M1 hiện dùng SQLite. Việc chuyển sang Supabase/multi-host và AI try-on thật chưa thuộc đợt sửa này.

Các tài liệu cần đọc:

| Tài liệu | Dùng để làm gì |
| --- | --- |
| [shared/openapi.json](shared/openapi.json) | Nguồn contract: method, endpoint, request, response, trường bắt buộc |
| [handoff_fe.md](backend/docs/handoff_fe.md) | Chi tiết tích hợp API sau sửa nghiệm thu |
| [remediation_results_20260917.md](backend/docs/remediation_results_20260917.md) | Đối chiếu F01–F16, kết quả test và giới hạn nghiệm thu |
| [Backend README](backend/README.md) | Chạy backend, cấu hình, migration và triển khai |

Frontend cập nhật `frontend/**`; Backend quản lý API, migration và OpenAPI. Không sửa OpenAPI bằng tay để khớp mock UI. Nếu cần đổi contract, trao đổi với người phụ trách Backend theo `rule.md`.

## 2. Những thay đổi cần chú ý ngay

| Khu vực | Hành vi Backend hiện tại | Frontend cần làm |
| --- | --- | --- |
| Auth | Không chấp nhận token giả `dev-user-*`; kiểm tra tài khoản/quyền từ DB mỗi request | Dùng tài khoản và JWT thật; xử lý 401, giữ draft |
| Tài nguyên cá nhân | Yêu cầu Bearer JWT và đúng owner | Không lưu tài nguyên guest bằng một user dùng chung |
| Upload | Tạo session → gửi bytes → complete → lấy access URL | Tách từng bước, chỉ báo thành công khi asset `ready` |
| Media private/unlisted | Đọc qua URL ký ngắn hạn, owner lấy quyền truy cập | Lưu `media_id`, xin lại URL khi hết hạn |
| Local upload cũ | `/api/media/local-upload?key=...` đã bị tắt | Dùng nguyên `upload_url` do session trả về |
| Lookbook unlisted | Biết ID không đủ để đọc; người khác cần share token | Phân biệt trang của owner và trang share |
| Lưu đồng thời | Revision cũ trả 409, không ghi đè âm thầm | Giữ nội dung đang sửa, cho người dùng xử lý xung đột |
| Nội dung chưa publish | Bị loại cả ở dữ liệu lồng nhau và gợi ý | Xử lý empty/404; cập nhật cache phù hợp |
| AI/provider lỗi | Có fallback chỉ rõ `source`; try-on chưa có provider trả 503 | Hiển thị nguồn và trạng thái khả dụng đúng response |
| Lỗi API | Envelope có `code`, `status_code`, `request_id`, `details` | Giữ thông tin lỗi để UI xử lý và Backend truy vết |

## 3. Auth, draft và lưu dữ liệu

Các luồng lưu tài nguyên cá nhân dùng Bearer JWT thật: `/api/outfits`, `/api/lookbooks`, `/api/media/uploads`, `/api/solution-form` và `/api/ai/jobs/{id}`. Endpoint solution form là **số ít** `/api/solution-form`.

- Guest vẫn dùng Studio và export tại trình duyệt. Khi cần lưu lên tài khoản, yêu cầu đăng nhập rồi đồng bộ draft.
- Giữ key draft hiện có: **`viet_stylist_current_draft`**. Không tạo thêm một key khác khiến dữ liệu cũ bị bỏ quên.
- Giữ snapshot, transform và nội dung người dùng nhập khi gặp 401, 409 hoặc lỗi mạng. Chỉ xóa draft sau khi lưu thành công và state đã đồng bộ.
- Token sai/hết hạn không tự chuyển request thành guest. Hiển thị đăng nhập lại và tiếp tục từ draft sau khi xác thực thành công.
- Với tài nguyên private: guest nhận 401; người đăng nhập khác owner nhận 404. Không diễn giải mọi 404 thành lỗi hệ thống.
- Khi cập nhật outfit/solution form, gửi `revision` theo contract. Nếu 409 `REVISION_CONFLICT`, giữ bản đang sửa, lấy bản mới từ server và cho người dùng chọn cách xử lý. Không tự tăng revision rồi ghi đè dữ liệu mới.
- Xóa hoặc phân vùng cache tài nguyên cá nhân khi logout/đổi tài khoản để không hiển thị dữ liệu của người trước.

## 4. Luồng upload media mới

### Bước 1 — Tạo phiên upload

`POST /api/media/uploads`, header `Authorization: Bearer <token>`, body JSON:

```json
{
  "filename": "portrait.png",
  "media_type": "image",
  "mime_type": "image/png",
  "size_bytes": 1024,
  "visibility": "private"
}
```

Khi dùng file thật, `size_bytes` lấy từ `file.size`; có thể bỏ trường này nếu chưa biết dung lượng. Backend vẫn kiểm tra bytes thực tế. Dùng đúng tên `filename`, `mime_type`, `size_bytes`, `visibility`; không dùng `file_name`, `content_type`, `file_size`, `purpose` thay thế.

Response có `media_id`, `upload_url`, `method`, `object_key`, `bucket`, `expires_in`, `storage_type`. **Không có `upload_headers`.** Bucket/key ở bước này là vùng staging private, chưa phải ảnh để hiển thị.

### Bước 2 — Gửi bytes theo storage_type và method

| Storage | Cách gửi | Lưu ý |
| --- | --- | --- |
| `local` / `POST` | Multipart `FormData`, field `file` | Giữ nguyên URL có grant; không tự đặt Content-Type multipart |
| `r2` / `PUT` | Raw `File` làm body; Content-Type đúng MIME đã đăng ký | Không gửi JWT ứng dụng đến R2; không bọc file trong FormData |

Ví dụ phần gửi bytes, trong đó `session` là response bước 1:

```ts
// mimeType là giá trị mime_type đã gửi khi tạo session.
let uploaded: Response;
if (session.storage_type === "local" && session.method === "POST") {
  const body = new FormData();
  body.append("file", file);
  uploaded = await fetch(session.upload_url, { method: "POST", body });
} else if (session.storage_type === "r2" && session.method === "PUT") {
  uploaded = await fetch(session.upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: file,
  });
} else {
  throw new Error("Kiểu upload chưa được hỗ trợ");
}
if (!uploaded.ok) {
  // Xử lý lỗi riêng: R2 không bảo đảm trả ErrorEnvelope JSON của app.
  throw new Error(`Không gửi được file: HTTP ${uploaded.status}`);
}
// Tiếp tục bước complete bằng API client có Bearer JWT.
```

**Không truyền upload URL vào `apiFetch` hiện tại**: helper này nối API origin/path và tự gắn token từ localStorage. Dùng `fetch` riêng cho URL cấp sẵn như ví dụ trên. Không parse JSON từ response upload R2 thành công vì body có thể rỗng.

Grant local dùng một lần; replay trả 409, thiếu/sai grant trả 422/403. URL R2 PUT có TTL 900 giây và có thể dùng lại trong TTL, nhưng chỉ ghi vào staging. Nếu mất response upload, không tự gửi lại bytes vô hạn; xử lý trạng thái complete/session trước khi quyết định tạo phiên mới.

Endpoint local legacy trả 410 ở dev, 404 ở production. Production không cung cấp local upload/file routes trong OpenAPI canonical.

### Bước 3 — Xác nhận upload

Gọi `POST /api/media/{media_id}/complete`, có Bearer JWT, body `{}`. Width/height do server kiểm tra từ file. Response thành công là `MediaAssetResponse`, `status=ready`, bucket/key final riêng với staging.

- Chỉ báo “đã tải lên” sau bước này; gửi bytes thành công chưa đủ.
- Complete lại asset ready là idempotent. Chưa có bytes/đang xử lý/đang xóa/đã xóa hoặc phiên không hợp lệ có thể trả 409.
- Nội dung sai trả 422, quá lớn trả 413; storage hoặc validator chưa sẵn sàng trả 503.
- UI nên có trạng thái: tạo phiên → đang tải → đang xác minh → sẵn sàng hoặc lỗi. Đây là trạng thái UI đề xuất; enum từ server vẫn lấy theo OpenAPI.

### Bước 4 — Hiển thị và xóa

- `GET /api/media/{media_id}/access` trả `access_url` và `expires_in: 300`. Private/unlisted cần JWT owner. Lưu `media_id` làm định danh bền vững; URL ký chỉ dùng tạm để hiển thị.
- Khi URL hết hạn, xin lại có giới hạn; không lặp vô hạn khi API trả 401/403/404 hoặc file đã xóa.
- `DELETE /api/media/{media_id}` thành công trả `{message, status: "deleted"}`; gọi lại sau thành công là idempotent.
- 503 `STORAGE_DELETE_FAILED`: chưa xóa xong, Backend giữ trạng thái để thử lại; UI không báo thành công. 409 `MEDIA_BUSY`: file đang được xử lý.

### Giới hạn file cần phản ánh trên UI

- `visibility` chỉ nhận `private`, `unlisted`, `public`, đúng chữ thường. Tạo media public hoặc upload SVG chỉ dành cho admin/editor.
- PNG/JPEG/WebP: tối đa 10 MiB, tối đa 40 triệu pixel; không hỗ trợ animation. Backend decode/encode lại và bỏ metadata/bytes phụ; file tải về có thể khác bytes gốc.
- SVG: chỉ hình học tĩnh theo allowlist, không script/link/style/filter.
- MP4: tối đa 50 MiB, tối đa 10 phút. Môi trường server phải có ffprobe; thiếu validator trả 503.
- Validation trình duyệt giúp người dùng sửa sớm; quyết định chấp nhận cuối cùng thuộc Backend.

## 5. Lookbook và chia sẻ

- Đọc bằng ID không đăng nhập chỉ dành cho lookbook `public`. `private` và `unlisted` khi đọc bằng ID cần owner; người khác xem qua share token hợp lệ.
- Entries chỉ nhận outfit version hợp lệ, cùng owner, chưa bị xóa. Version sai trả 422 `INVALID_OUTFIT_VERSION`.
- Update metadata và entries là một transaction; request thất bại không cập nhật một nửa.
- Khi PUT: bỏ `entries` hoặc gửi `entries: null` giữ nguyên danh sách; `entries: []` chủ động xóa hết. Form chưa tải xong entries không được mặc định gửi `[]` khi chỉ sửa tiêu đề.
- `POST /api/lookbooks/{lookbook_id}/share` nhận `{"expires_in_days": 7}`; cho phép 1–30 ngày, mặc định 30. Dùng `share_url` server trả, không tự nối URL localhost.
- `DELETE /api/lookbooks/{lookbook_id}/shares` thu hồi **mọi** link hiện hành của lookbook. UI cần nói rõ phạm vi thao tác.
- `GET /api/shares/{token}`: token không có/đã thu hồi trả 404; hết hạn trả 410. Trang share là luồng xem, không suy ra quyền chỉnh sửa từ việc mở được link.
- Reference legacy sai owner/đã xóa được lọc khỏi dữ liệu đọc; UI phải xử lý danh sách có ít entry hơn dữ liệu cũ.

## 6. Catalog, heritage, AI và thời tiết

- Catalog/heritage public chỉ trả nội dung đã publish. Color suggestions, starter outfits và recommendations cũng lọc unpublished. Starter outfit có item bị ẩn bị loại cả template.
- UI cần empty state và xử lý item/detail không còn khả dụng; cache catalog/heritage không nên giữ nội dung cũ vô thời hạn.
- AI output sai cấu trúc, ID/variant không hợp lệ hoặc provider lỗi chuyển sang fallback, `source=cultural_rule_engine`. Không gắn nhãn kết quả fallback là Gemini.
- Locked item/variant không hợp lệ trả 422 `INVALID_LOCKED_ITEM`; giữ lựa chọn để người dùng sửa, không tự đổi variant đã khóa.
- Màu `hex_color` nhận 3 hoặc 6 ký tự hex, có hoặc không có `#`; sai định dạng trả 422.
- Thời tiết dự phòng có `source=sample`; Backend cache mẫu 1 phút để sớm thử lại nguồn thật. UI không trình bày mẫu như thời tiết trực tiếp đã xác nhận.
- Try-on vẫn trả 503 `TRY_ON_UNAVAILABLE` khi chưa có provider thật. Hiển thị chưa khả dụng, không spinner/retry vô hạn hoặc kết quả giả thành công.

## 7. Chuẩn lỗi và retry

Ví dụ lỗi API ứng dụng:

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

| HTTP | Hành vi UI/client cần có |
| --- | --- |
| 401 | Yêu cầu đăng nhập lại, giữ draft |
| 403 | Giải thích thiếu quyền/grant không hợp lệ; dừng retry cùng request |
| 404 | Không tồn tại hoặc không được phép thấy tài nguyên |
| 409 | Phân biệt theo `error.code`: revision conflict, upload state, media busy… |
| 410 | Share hết hạn hoặc endpoint cũ đã bị bỏ |
| 413 | Yêu cầu file nhỏ hơn; tạo session mới nếu phiên cũ đã rejected |
| 422 | Hiển thị validation từ `details` khi có; giữ dữ liệu nhập |
| 429 | Tôn trọng `Retry-After`/`details.retry_after`; có thời gian chờ trên UI |
| 503 | Báo dịch vụ chưa sẵn sàng; không chuyển sang trạng thái thành công |

Client hiện có `ApiError` giữ code/status/details; cần bổ sung giữ `request_id` và thông tin retry cho luồng hỗ trợ. Không gom mọi lỗi thành “lỗi mạng”. Request tới R2 có thể trả lỗi khác định dạng và cần parser riêng. `/ready` là probe vận hành, trả schema riêng kể cả 503; không dùng nó như API nghiệp vụ.

Auth giới hạn 20 request/phút/IP cho từng endpoint auth. AI giới hạn 10/phút và 100/ngày theo user hoặc guest IP, tối đa 4 lời gọi provider đồng thời mỗi process. Chặn double-submit, hủy request không còn cần và dùng retry có giới hạn; không tự lặp POST tạo tài nguyên khi chưa biết request trước đã thành công hay chưa.

## 8. Công việc giao cho Frontend

Các mục dưới đây là **việc còn cần làm/kiểm chứng**, không phải danh sách đã hoàn thành:

| Thứ tự | Công việc | Vị trí bắt đầu đọc |
| --- | --- | --- |
| FE01 | Rà JWT, guest draft → login → sync, bảo toàn snapshot/transform và xử lý revision conflict | [auth/context.tsx](frontend/src/lib/auth/context.tsx), [studio/state.ts](frontend/src/features/studio/state.ts) |
| FE02 | Triển khai upload session/local multipart/R2 raw PUT/complete/access/delete và lỗi từng bước | [api/client.ts](frontend/src/lib/api/client.ts), [types/api.ts](frontend/src/lib/types/api.ts), UI media liên quan |
| FE03 | Cập nhật lookbook entries, quyền unlisted, tạo/thu hồi/share hết hạn | Client, type và page lookbook/share trong `frontend/src/app/**` |
| FE04 | Empty state cho nội dung unpublished, nguồn fallback AI/weather, try-on unavailable, cache theo quyền | Các tính năng catalog/heritage/gợi ý và API client |
| FE05 | Chuẩn hóa lỗi, request_id, 429/retry; bổ sung kiểm thử tích hợp | API client và `frontend/tests/**` |

Checklist bàn giao lại sau khi Frontend hoàn tất:

- [ ] Guest tạo draft, chỉnh transform, đăng nhập rồi lưu: không mất nội dung và không tạo bản lưu lặp vì double-submit.
- [ ] JWT hết hạn giữa phiên: nhận 401, draft vẫn còn; login lại tiếp tục được.
- [ ] Hai tab sửa cùng outfit/solution form: revision cũ nhận 409, không ghi đè bản mới, nội dung tab lỗi vẫn còn.
- [ ] Upload ảnh local và R2 đều chạy đủ bước; dùng đúng MIME, method và body. Upload bytes xong nhưng complete lỗi không báo thành công.
- [ ] File sai MIME/quá lớn, grant hết hạn/replay, validator/storage lỗi: UI có thông báo phù hợp, không treo loading.
- [ ] Media private: owner đọc được, guest/người khác không đọc qua API; URL hết hạn được xin lại có giới hạn.
- [ ] DELETE thất bại không báo “đã xóa”; retry khi phù hợp, asset đã xóa không còn bị tải lại vô hạn.
- [ ] Lookbook unlisted không đọc trực tiếp bằng ID với guest/tài khoản khác; share hợp lệ đọc được, revoke 404, expired 410.
- [ ] Chỉ sửa metadata lookbook không làm mất entries; `entries: []` chỉ được gửi khi người dùng chủ động xóa danh sách.
- [ ] Logout/đổi tài khoản không hiển thị dữ liệu cá nhân của tài khoản trước.
- [ ] Dữ liệu unpublished không tái xuất hiện trong suggestions; fallback AI/weather và try-on unavailable hiển thị đúng nguồn/trạng thái.
- [ ] 429 tuân thủ thời gian chờ; lỗi có request_id để gửi Backend. Mock Playwright khớp OpenAPI hiện tại.
- [ ] Chạy smoke với Backend staging và R2/CORS thật; ghi rõ môi trường, commit, kết quả và các phần vẫn dùng mock.

## 9. Backend đã xác minh đến đâu?

Theo [báo cáo và bằng chứng lưu trong repository](backend/docs/remediation_results_20260917.md):

- 125/125 test pass, không fail/error/skip; môi trường cài mới từ wheel cũng đạt 125 test và `pip check`.
- Soak cục bộ 600 giây: 11.073 request, toàn bộ HTTP 200, các ngưỡng đo đều đạt. Đây là workload kiểm thử cục bộ, không phải cam kết tải production.
- Đã kiểm thử một MP4 nhỏ bằng ffprobe thật: upload → complete → đọc private thành công; bản cắt cụt bị từ chối 422.
- OpenAPI đã đồng bộ/check; đã sửa an toàn đường dẫn, quyền truy cập, staging/validation/xóa media, transaction/migration, xử lý provider và tránh chặn event loop.

Chưa nghiệm thu Frontend E2E, Google/Gemini/R2 live, proxy/CDN/CORS hoặc migration trên dữ liệu thật. Production cần Backend/vận hành chuẩn bị migration, credentials, R2 private/CORS, ffprobe và cleanup scheduler theo README. Frontend dùng API origin phù hợp qua `NEXT_PUBLIC_API_ORIGIN`; không đưa JWT secret, R2 secret hoặc service key vào biến công khai của trình duyệt.

Khi báo lỗi tích hợp, gửi: commit FE/BE, môi trường, bước tái hiện, method/path, request đã che thông tin nhạy cảm, HTTP status, `error.code`, `request_id`, kết quả mong đợi và thực tế. Không gửi JWT, secret hoặc URL ký còn hiệu lực vào tài liệu/log chia sẻ.
