# VietStylist Backend

FastAPI/Python, SQLite cho M1, R2 hoặc local storage ở development/test. Đợt sửa nghiệm thu và bằng chứng nằm trong `docs/remediation_results_20260917.md`; contract frontend ở `docs/handoff_fe.md`. M2 Supabase và nghiệm thu Frontend/production là các đợt riêng.

## Chạy local trên Windows

Từ thư mục `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -c constraints-py313-windows.txt ".[dev]"
Copy-Item .env.example .env
python -m uvicorn app.main:app --host 127.0.0.1 --port 4000 --reload
```

Constraints được kiểm chứng trên CPython 3.13/Windows. Python hỗ trợ từ 3.11; nền tảng/Python khác cần resolve và chạy lại suite, không coi constraints Windows là lock đa nền tảng. Đặt `JWT_SIGNING_SECRET` riêng; không dùng giá trị demo ở staging/production. Development/test tự migrate và seed idempotent khi startup. Seed nằm trong package wheel (`app/data/seed.sql`), không phụ thuộc thư mục Supabase bên ngoài bản cài.

`/docs`, `/openapi.json`, `/health`, `/ready` ở origin API. `/health` chỉ kiểm tra process; `/ready` kiểm tra schema/checksum và storage (R2 HEAD bucket có cache 15 giây, local thử ghi file tạm). Production không tự migrate/seed và không fallback sang local khi thiếu credential. R2 credential điền dở trả 503 ở cả dev. Local routes bị tắt ngoài development/test dù LOCAL_MEDIA_ENABLED=true.

## Kiểm tra từ repo root

```powershell
python -m pytest backend/tests -o addopts= -q
python backend/scripts/export_openapi.py --check
python backend/scripts/benchmark.py --output backend/docs/evidence/benchmark_local.json --soak-seconds 600
python backend/scripts/verify_package.py --full-tests --constraints backend/constraints-py313-windows.txt --output backend/docs/evidence/package_local.json
```

Tests/benchmark thiết lập DB, media và secret giả trước import; chặn outbound HTTP/R2. Benchmark dùng 1.000 item, 100 user, 20 outfit và 5 lookbook/user; concurrency 10, query trace thật, event-loop lag khi storage giả chậm 2 giây, RSS/connection sampling. Exit 1 nếu một ngưỡng đo được fail. Không chạy soak (`--soak-seconds 0`) sẽ báo gate memory chưa đo; không được gọi đó là pass soak. `verify_package.py` build wheel từ source sạch, cài dependency trong venv tạm (cần internet/package mirror), chạy pip check và smoke trên package đã cài; `--full-tests` còn chạy toàn bộ suite bằng interpreter mới.

## Migration production và dữ liệu cũ

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

## Media và cleanup

Ảnh PNG/JPEG/WebP: tối đa 10 MiB và 40 triệu pixel, giải mã/encode lại trước publish. SVG chỉ admin/editor và allowlist hình học tĩnh. MP4 tối đa 50 MiB/10 phút; cần cài `ffprobe`, đặt `FFPROBE_PATH` nếu ngoài PATH. Validator quét frame với timeout 30 giây; thiếu binary trả 503, không tự đánh dấu ready. Không có ffprobe đi kèm wheel. Thiết lập reverse proxy body limit phù hợp; app cũng chặn multipart local quá 50 MiB + 64 KiB framing trước khi parser spool hết body.

Upload staging luôn private. Complete xác minh bytes và ghi key final riêng; lease + operation token chặn complete/delete cạnh tranh. Local grant upload dùng một lần, read grant 300 giây. Presigned R2 PUT 900 giây có thể ghi lại staging nhưng không thay bytes final. Backend lưu ledger các object để dọn orphan sau crash. DELETE storage thất bại trả 503, giữ deleting; retry có thể hoàn tất. Tombstone/ledger được giữ, không hard-delete metadata để mất dấu cleanup.

Chạy scheduler mỗi phút (Task Scheduler trên Windows hoặc systemd timer/cron trên Linux), dùng cùng config/identity của API:

```powershell
python scripts/cleanup_staged_media.py --dry-run --limit 100
python scripts/cleanup_staged_media.py --limit 100
```

Cleanup xử lý expired/uploading/processing quá lease, rejected, deleting, tombstone và staging của ready sau TTL. Claim retry tối thiểu 60 giây tránh nhiều janitor làm cùng hàng và tránh một nhóm hàng chiếm hết batch. Lỗi storage giữ ledger, tăng `failed`, exit 1; giám sát scheduler và tăng batch theo backlog. Bucket private phải private thật trên R2; đặt lifecycle riêng cho prefix `staging/` để dọn các upload từ client tiếp tục gửi sau timeout. Không bật public access cho staging. Local media directory chỉ cấp quyền ghi cho backend, không chia sẻ cho process/người dùng không tin cậy.

## Cấu hình triển khai và giới hạn nghiệm thu

Production dùng DEBUG=false, JWT secret ngẫu nhiên ≥32 ký tự, issuer/audience không rỗng, API/Frontend HTTPS origins, đủ ba R2 credential, public/private bucket khác nhau. Role lấy từ DB, token dev bị từ chối. Không log token/key/presigned URL; error response chỉ có request_id và thông tin an toàn. Rate limit auth/AI lưu trong SQLite dùng chung process; giới hạn concurrent provider là 4/process, timeout tổng 30 giây. Khi chạy nhiều host/DB cần rate limit tập trung, thuộc migration hạ tầng sau M1.

Backend vẫn dùng Gemini model cấu hình hiện có, không đổi sang tên model của agent thực hiện. Mock provider chứng minh error/fallback wiring; không chứng minh chất lượng AI, Google OAuth live, quyền R2 live, CDN/CORS hay khả năng vận hành production. Try-on chưa bật. Xem runbook và số đo trong báo cáo sửa nghiệm thu trước release.

Kiểm tra MP4 với binary thực được cấp sẵn (từ repo root):

```powershell
python backend/scripts/verify_video.py --ffmpeg C:/tools/ffmpeg/bin/ffmpeg.exe --ffprobe C:/tools/ffmpeg/bin/ffprobe.exe --output backend/docs/evidence/video_local.json
```

Script chỉ tạo clip tổng hợp nhỏ, DB/media tạm, chặn outbound; binary không được tự tải khi nhận request. Xem [tài liệu ffprobe](https://ffmpeg.org/ffprobe.html) và [nguồn tải FFmpeg](https://ffmpeg.org/download.html) khi chuẩn bị môi trường đích.
