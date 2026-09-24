# VietStylist Backend

FastAPI/Python, PostgreSQL trên Supabase cho runtime, SQLite chỉ cho test. Cloudflare R2 lưu bytes ảnh/video; PostgreSQL lưu metadata, tài khoản, bộ phối và dữ liệu V3. API xác thực tài khoản trong database ứng dụng; kết nối database này không tự chuyển sang Supabase Auth.

## Supabase PostgreSQL: chỉ tạo bảng, không chuyển dữ liệu

Lấy URI **Session pooler, port 5432** từ Supabase Connect, lưu vào `SUPABASE_DATABASE_URL` trong `backend/.env`. Có thể dùng `DATABASE_URL` PostgreSQL thay thế; `SUPABASE_DATABASE_URL` được ưu tiên ngoài môi trường test. Kết nối từ xa bắt buộc SSL, tự động prepare tắt để tương thích pooler. `DATABASE_POOL_SIZE=8` giới hạn số kết nối mỗi process.

Chạy từ `backend`:

```powershell
python scripts/migrate.py --dry-run
python scripts/migrate.py
python scripts/migrate.py --check
python scripts/seed_occasions.py
python -m uvicorn app.main:app --host 127.0.0.1 --port 4000
```

`seed_occasions.py` chỉ bổ sung 8 hoàn cảnh sử dụng còn thiếu (kỷ yếu, Tết, lễ hội trường, dạo phố, cưới hỏi, tốt nghiệp, biểu diễn, tham quan di sản). Có thể chạy lại; dữ liệu hoàn cảnh đã có được giữ nguyên. Lệnh không thêm tài khoản, trang phục mẫu hoặc dữ liệu văn hóa.

Migration tạo **45 bảng** trong schema riêng `vietstylist` (`DATABASE_SCHEMA`), bao gồm một bảng lịch sử migration. Trong Supabase Table Editor, chọn schema này để xem bảng. Nguồn schema runtime là `app/data/postgres_schema.sql`; không chạy lại migration PostgreSQL M1 cũ ở `supabase/migrations/20260916_init_schema.sql` vì kiểu ID và cấu trúc không còn khớp runtime.

Migration nguyên tử, có checksum, không seed, không đọc/copy database SQLite, không thay bảng đã tồn tại có schema không tương thích. Dry-run thực thi DDL rồi rollback. RLS bật trên các bảng; schema không cấp quyền cho `anon`/`authenticated`/`PUBLIC`. Backend kiểm tra quyền người dùng qua API. Startup chỉ kiểm tra schema PostgreSQL, không chạy migration hay seed. Database ứng dụng rỗng đồng nghĩa chưa có tài khoản, trang phục hoặc dữ liệu văn hóa; bổ sung dữ liệu nghiệp vụ bằng luồng quản trị riêng.

JSON giữ dạng text và cờ giữ dạng số để bảo toàn contract hiện tại; ngày giờ PostgreSQL dùng UTC. Các transaction ghi được tuần tự hóa bằng advisory lock theo schema để giữ tính nguyên tử của các luồng vốn dùng SQLite `BEGIN IMMEDIATE`. Không giữ transaction trong lúc gọi Gemini/R2. Đây là giới hạn throughput ghi cần đo lại trước khi mở rộng tải.

Kiểm chứng PostgreSQL tùy chọn từ repo root: đặt `TEST_POSTGRES_URL` qua môi trường rồi chạy `python -m pytest backend/tests/test_postgres_runtime.py`. Test tạo schema trong giao dịch rollback và bảng TEMP chỉ tồn tại trong kết nối; không lưu dữ liệu thử vào schema ứng dụng. Không đưa URI/mật khẩu vào log hoặc Git.

## Chạy local trên Windows

Từ thư mục `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -c constraints-py313-windows.txt ".[dev]"
Copy-Item .env.example .env
python -m uvicorn app.main:app --host 127.0.0.1 --port 4000 --reload
```

Constraints được kiểm chứng trên CPython 3.13/Windows. Đặt `JWT_SIGNING_SECRET` riêng. Chỉ môi trường `test` với SQLite mới tự migrate/seed. Development/staging/production phải cấu hình PostgreSQL và chạy migration rõ ràng trước startup.

`/docs`, `/openapi.json`, `/health`, `/ready` ở origin API. `/health` chỉ kiểm tra process; `/ready` kiểm tra schema/checksum và storage (R2 HEAD bucket có cache 15 giây, local thử ghi file tạm). Production không tự migrate/seed và không fallback sang local khi thiếu credential. R2 credential điền dở trả 503 ở cả dev. Local routes bị tắt ngoài development/test dù LOCAL_MEDIA_ENABLED=true.

Trước khi deploy, cấu hình `ENVIRONMENT=production`, `DEBUG=false`, `SUPABASE_DATABASE_URL`, JWT secret mạnh, đủ ba R2 credential, `R2_PUBLIC_DOMAIN` HTTPS và `FRONTEND_PUBLIC_ORIGIN`/`API_PUBLIC_ORIGIN` HTTPS không trỏ localhost. `CORS_ORIGINS` phải chứa chính xác origin frontend. Backend từ chối khởi động nếu thiếu các điều kiện này; `/ready` kiểm tra kết nối DB và cả hai bucket nhưng không kiểm chứng CORS trình duyệt hoặc chất lượng sinh ảnh. Build frontend sau khi đặt `NEXT_PUBLIC_API_ORIGIN` HTTPS thật. Chạy thử đăng nhập, tải ảnh, duyệt ảnh, xuất Studio và mở link Lookbook trên domain deploy.

Từ thư mục `backend`, chạy `python scripts/test_connections.py` để kiểm tra schema PostgreSQL và hai bucket R2 bằng truy vấn chỉ đọc; script không upload, xóa object hoặc in connection string.

## Kiểm tra từ repo root

```powershell
python -m pytest backend/tests -o addopts= -q
python backend/scripts/export_openapi.py --check
python backend/scripts/benchmark.py --output backend/docs/evidence/benchmark_local.json --soak-seconds 600
python backend/scripts/verify_package.py --full-tests --constraints backend/constraints-py313-windows.txt --output backend/docs/evidence/package_local.json
```

Tests/benchmark thiết lập DB, media và secret giả trước import; chặn outbound HTTP/R2. Benchmark dùng 1.000 item, 100 user, 20 outfit và 5 lookbook/user; concurrency 10, query trace thật, event-loop lag khi storage giả chậm 2 giây, RSS/connection sampling. Exit 1 nếu một ngưỡng đo được fail. Không chạy soak (`--soak-seconds 0`) sẽ báo gate memory chưa đo; không được gọi đó là pass soak. `verify_package.py` build wheel từ source sạch, cài dependency trong venv tạm (cần internet/package mirror), chạy pip check và smoke trên package đã cài; `--full-tests` còn chạy toàn bộ suite bằng interpreter mới.

## Migration SQLite cho test và dữ liệu local cũ

Các script cũ `export_catalog.py`, `add_more_garments.py`, `register_real_garment.py`, `upgrade_art_assets.py` và `purge_demo_accounts.py` dùng SQLite local; không chạy chúng để sửa dữ liệu Supabase production. Dùng API quản trị hoặc migration PostgreSQL đã được kiểm tra cho dữ liệu thật.

Chạy các lệnh sau từ `backend` với DATABASE_URL tuyệt đối trỏ đến DB được lựa chọn; dừng traffic ghi/worker và backup storage trước bảo trì. Các lệnh này không tự chạy khi server production startup.

```powershell
python scripts/migrate.py --dry-run
python scripts/migrate.py
python scripts/migrate.py --check
```

Dry-run mở source read-only rồi thử toàn bộ migration trên bản sao in-memory. Nó báo form trùng owner, reference lookbook cũ bị quarantine và lỗi schema/checksum. Upgrade thật tạo SQLite backup cạnh DB trước khi thực hiện toàn bộ DDL trong một transaction. Không tự chọn/xóa form trùng.

Nếu có duplicate form, người vận hành đối soát và tạo JSON mapping `owner_id` → `id` bản muốn giữ; các bản dư được lưu nguyên mọi field trong `solution_forms_archive.row_json` rồi mới bỏ khỏi bảng active. Chỉ dùng lựa chọn đã được xác minh:

```powershell
python scripts/migrate.py --dry-run --resolve-forms selected_forms.json
python scripts/migrate.py --resolve-forms selected_forms.json
```

Reference lookbook khác owner/đã xóa còn nguyên dữ liệu, xuất hiện trong view `quarantined_lookbook_entries` và không được public/share đọc. Pending media cũ không có staging contract chuyển sang deleting; key ngoài các prefix được phép cần đối soát, cleanup không tự xóa object tùy ý. Ready media cũ giữ nguyên; app không chứng nhận lại bytes của dữ liệu legacy chưa qua validator mới.

Rollback: dừng API/worker/cleanup; giữ một backup riêng của trạng thái vừa lỗi; dùng SQLite backup API để phục hồi file `.bak` đã kiểm tra sang DB đích, không copy riêng main DB đang mở/WAL đang hoạt động. Chạy dry-run/migrate/check bằng bản backend đã vá, rồi readiness/smoke A/B trước mở traffic. Không quay về backend baseline có upload không grant. Object đã xóa cần backup/versioning storage riêng; SQLite backup không khôi phục bytes.

## Dữ liệu thí điểm Áo dài và Áo tứ thân

Hai gói JSON đã được lọc nằm trong package backend; script, prompt và tài liệu hướng dẫn từ ZIP nguồn không được thực thi. Nhập cả hai gói từ thư mục `backend`:

```powershell
python scripts/import_v3_pilot_packages.py all
```

Có thể thay `all` bằng `ao-dai` hoặc `ao-tu-than`. Lệnh chạy nguyên tử và idempotent, không ghi đè chỉnh sửa biên tập hiện có. Thực thể, nguồn và khẳng định mới giữ trạng thái `under_review`; quy tắc giữ `draft`. Media candidate chỉ được lưu làm metadata để thẩm định quyền, không được tạo thành `media_assets` hay dùng làm AI reference.

## Media và cleanup

Trên máy deploy, chạy `python scripts/prepare_cutout_model.py` bằng đúng tài khoản chạy API để tải và kiểm tra model trước khi mở traffic. Sau đó thử upload ảnh thật; cache model và `LOCAL_MEDIA_DIR` phải ghi được.

Ảnh trang phục gửi từ Workspace Stylist đi qua `POST /api/stylist/garment-image`: backend kiểm tra ảnh, tách nền bằng rembg (`isnet-general-use`), cắt sát trang phục và lưu PNG vào bucket private rồi mới trả `media_id` để gửi mẫu. Ảnh chưa được duyệt không có URL công khai. Model ONNX khoảng 179 MB được tải vào cache của tài khoản chạy backend ở lần xử lý đầu; khi triển khai cần chuẩn bị cache model và thư mục ghi được, sau đó thử upload ảnh thật trước khi mở cho người dùng. Ảnh danh mục cũ được tách nền theo yêu cầu tại `GET /api/catalog/items/{item_id}/studio-image`, chỉ khi item và media đã công khai; ảnh gốc không bị ghi đè.

Ảnh PNG/JPEG/WebP: tối đa 10 MiB và 40 triệu pixel, giải mã/encode lại trước publish. SVG chỉ admin/editor và allowlist hình học tĩnh. MP4 tối đa 50 MiB/10 phút; cần cài `ffprobe`, đặt `FFPROBE_PATH` nếu ngoài PATH. Validator quét frame với timeout 30 giây; thiếu binary trả 503, không tự đánh dấu ready. Không có ffprobe đi kèm wheel. Thiết lập reverse proxy body limit phù hợp; app cũng chặn multipart local quá 50 MiB + 64 KiB framing trước khi parser spool hết body.

Upload staging luôn private. Complete xác minh bytes và ghi key final riêng; lease + operation token chặn complete/delete cạnh tranh. Local grant upload dùng một lần, read grant 300 giây. Presigned R2 PUT 900 giây có thể ghi lại staging nhưng không thay bytes final. Backend lưu ledger các object để dọn orphan sau crash. DELETE storage thất bại trả 503, giữ deleting; retry có thể hoàn tất. Tombstone/ledger được giữ, không hard-delete metadata để mất dấu cleanup.

Chạy scheduler mỗi phút (Task Scheduler trên Windows hoặc systemd timer/cron trên Linux), dùng cùng config/identity của API:

```powershell
python scripts/cleanup_staged_media.py --dry-run --limit 100
python scripts/cleanup_staged_media.py --limit 100
```

Cleanup xử lý expired/uploading/processing quá lease, rejected, deleting, tombstone và staging của ready sau TTL. Claim retry tối thiểu 60 giây tránh nhiều janitor làm cùng hàng và tránh một nhóm hàng chiếm hết batch. Lỗi storage giữ ledger, tăng `failed`, exit 1; giám sát scheduler và tăng batch theo backlog. Bucket private phải private thật trên R2; đặt lifecycle riêng cho prefix `staging/` để dọn các upload từ client tiếp tục gửi sau timeout. Không bật public access cho staging. Local media directory chỉ cấp quyền ghi cho backend, không chia sẻ cho process/người dùng không tin cậy.

## Cấu hình triển khai và giới hạn nghiệm thu

Production dùng DEBUG=false, JWT secret ngẫu nhiên ≥32 ký tự, issuer/audience không rỗng, API/Frontend HTTPS origins, đủ ba R2 credential, public/private bucket khác nhau. Role lấy từ DB, token dev bị từ chối. Không log token/key/presigned URL; error response chỉ có request_id và thông tin an toàn. Rate limit auth/AI lưu trong PostgreSQL dùng chung giữa các worker/host kết nối cùng database; giới hạn concurrent provider là 4/process, timeout tổng 30 giây. Cần đo tải và theo dõi mức tranh chấp ghi trước khi mở rộng số host.

Backend dùng riêng `GEMINI_MODEL_TEXT` cho tư vấn và `GEMINI_MODEL_IMAGE` cho sinh ảnh. Try-on chỉ hoạt động khi có `GEMINI_API_KEY` và `GEMINI_TRY_ON_ENABLED=True`; kết quả phải là ảnh hợp lệ, được lưu private và đọc kiểm chứng trước khi API báo hoàn tất. Kiểm thử mock chứng minh error/storage wiring nhưng không chứng minh chất lượng model, quota Gemini, Google OAuth live, quyền R2 live, CDN/CORS hay khả năng vận hành production. Xem runbook và số đo trong báo cáo sửa nghiệm thu trước release.

`POST /api/v3/generation/synthesize` nhận `outfit_image_id` bắt buộc của ảnh bản phối private do Studio xuất và `user_image_id` tùy chọn. Backend xác minh cả hai ảnh thuộc người gọi trước khi gửi cho Gemini; ảnh bản phối là tham chiếu đầu tiên, ảnh nhân vật là tham chiếu thứ hai nếu có. Không có ảnh nhân vật, prompt yêu cầu chọn người mặc trưởng thành phù hợp; có ảnh, prompt yêu cầu giữ danh tính và vóc dáng của người đó. Upload private và ảnh kết quả tồn tại trong kho media cho tới khi được xóa; chúng không tự biến mất sau một lần sinh ảnh.

Request có thể gửi `legacy_item_ids` của các món đã xuất bản trong kho. Nếu chưa có ánh xạ V3, backend xác minh từng món còn công khai và tạo prompt mô tả từ dữ liệu kho cộng ảnh bản phối; kết quả vẫn mang trạng thái văn hóa `not_evaluated`. `GET /api/v3/generation/status` cho UI biết cấu hình sinh ảnh đã bật hay chưa, không kiểm tra quota Gemini. Khi dịch vụ tắt hoặc hết quota, dùng chế độ thủ công trong Studio.

Kiểm tra MP4 với binary thực được cấp sẵn (từ repo root):

```powershell
python backend/scripts/verify_video.py --ffmpeg C:/tools/ffmpeg/bin/ffmpeg.exe --ffprobe C:/tools/ffmpeg/bin/ffprobe.exe --output backend/docs/evidence/video_local.json
```

Script chỉ tạo clip tổng hợp nhỏ, DB/media tạm, chặn outbound; binary không được tự tải khi nhận request. Xem [tài liệu ffprobe](https://ffmpeg.org/ffprobe.html) và [nguồn tải FFmpeg](https://ffmpeg.org/download.html) khi chuẩn bị môi trường đích.
