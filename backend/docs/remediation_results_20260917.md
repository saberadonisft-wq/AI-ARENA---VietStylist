# Kết quả sửa lỗi sau nghiệm thu — 17/09/2026

Phạm vi: sửa F01–F16 trong [báo cáo nghiệm thu độc lập](acceptance_review_20260917.md), trên branch `backend/acceptance-fixes-20260917`, nền `c3d49b2`. Backend và `shared/openapi.json` đã thay đổi; không sửa Frontend hoặc tự triển khai/migrate dữ liệu thật. Các thay đổi có sẵn ở README, HTTP client và handoff được đọc trước khi cập nhật trong phạm vi sửa lỗi này.

**Đã sửa các lỗi backend F01–F16; các kiểm tra cục bộ nêu dưới đây đã đạt.** Đây là báo cáo sửa backend cục bộ, không phải xác nhận release M1-FE/M2/production. Checkbox trong kế hoạch gốc không thay thế bằng chứng runtime ở đây.

## 1. Đối chiếu từng lỗi

| Mục | Thay đổi thực tế | Bằng chứng |
| --- | --- | --- |
| F01 — filesystem | Canonical containment, từ chối symlink/junction và Windows special paths; chỉ phục vụ asset đã đăng ký ready; production luôn tắt local routes | `test_junction_cannot_read_registered_or_unregistered_file`, `test_r01_path_traversal_attempts_blocked`, production tests |
| F02 — upload legacy | URL local thật dùng media_id + signed grant; CAS pending→uploading→uploaded, replay bị chặn; legacy dev 410/prod 404 | `test_upload_grant_replay_and_immutable_final`, `test_upload_expiry_wrong_purpose_and_parallel_replay` |
| F03 — visibility | Literal allowlist cho create/update, DB triggers cho ghi mới, policy đọc chỉ public mới cho guest; unknown legacy fail closed | `test_invalid_visibility_rejected_on_both_inputs`, `test_legacy_visibility_fails_closed` |
| F04 — validate/promote | Private staging, đọc bounded, PNG/JPEG/WebP decode/encode, MIME/extension/pixel/byte limits; SVG allowlist admin/editor; ffprobe MP4 có timeout/frame count; final key riêng | Content/limits/SVG/video tests trong `test_acceptance_fixes.py`; fake R2 promotion/oversize; giới hạn xác minh MP4 ở phần 5 |
| F05 — delete/state race | Claim lease + operation token; publish CAS; không complete deleting/deleted; storage delete lỗi trả 503 và giữ tombstone/ledger để retry | `test_media_delete_storage_failure_preserves_deleting_state`, `test_complete_delete_race_is_fenced`, fake R2 failure/retry |
| F06 — unlisted | ID private/unlisted chỉ owner; guest 401, người khác 404; share/revoke/expiry giữ policy riêng | `test_unlisted_direct_id_and_legacy_foreign_entries`, suite share links |
| F07 — legacy cross-owner | JOIN owner khi đọc đơn/list/share; loại deleted outfit; view quarantine giữ nguyên reference cũ | Legacy foreign entry test và `test_lookbook_integrity.py` |
| F08 — migration | Preflight trên bản sao; duplicate form chặn trước mutation; chọn bản giữ tường minh, archive toàn bộ field bản dư; transaction/checksum; production không tự migrate | Fresh/repeat/partial/checksum/failure/duplicate/archive/dry-run/backup/restore trong `test_migration_acceptance.py` |
| F09 — cleanup | Dùng đúng object ledger/storage API; expired/rejected/deleting/staging retry có batch/prefix/claim; không xóa metadata khi storage fail | `test_cleanup_dry_run_failure_retry_and_staging_replay`, `test_cleanup_cli_dry_run_and_apply` |
| F10 — publication | Color JOIN chỉ published; starter template chứa item ẩn bị loại; recommendation lookup chỉ published | `test_nested_publication_filters`, publication suite |
| F11 — event loop | Sync DB/boto3/PBKDF2 chạy trong bounded threadpool; async weather/AI/Google offload DB; JWT account+roles đọc chung một query; WAL thiết lập khi migration, không đổi journal mỗi connection | ASGI timer test; benchmark trước/sau, 3 rounds concurrency 10 |
| F12 — provider resilience | Pydantic schema nested output; unknown ID/variant fallback; locked item sai 422; AI deadline 30s, 4 provider calls/process; auth/AI rate limit SQLite; sample weather TTL 1 phút | Malformed provider/client tests, concurrency/429, rate-limit header, weather recovery/pool lifecycle |
| F13 — readiness | Kiểm tra migration checksum + required schema/triggers/index; storage đủ credential và HEAD hai bucket; không fallback local khi config dở/production; probe không lộ lỗi nội bộ | Missing storage credentials/auth failure/schema marker/table tests, production lifespan test |
| F14 — handoff | Đúng filename/mime_type/size_bytes/visibility, method/storage_type, multipart vs raw PUT, `/solution-form`, draft key thực tế | `test_handoff_upload_example_is_executable`; đối chiếu frontend chỉ đọc |
| F15 — error/OpenAPI | ErrorEnvelope cho status thường gặp; schema probe `/ready` riêng đúng body 503; production canonical bỏ local routes; exporter không đọc env thật | Error envelope/probe schema tests; OpenAPI equality/export check |
| F16 — evidence/harness | Chuyển đủ 11 baseline attack tests thành regression assertions; JWT/account fixtures thật tạm; cấu hình trước import; HTTPX/R2 thật bị chặn; benchmark query trace/threshold/exit code/raw samples | Full suite, benchmark JSON, fresh-venv wheel/pip-check/smoke/full-suite artifacts |

Sửa bổ sung khi đối soát: Google account/profile/role nằm trong cùng transaction; nested transaction dùng savepoint; connection đóng khi PRAGMA lỗi; multipart chunked bị chặn trước spool không giới hạn; mã màu sai trả 422; seed có stable IDs và không tạo thêm article source trùng với reference legacy.

## 2. Kết quả kiểm thử

Bằng chứng chính trong `evidence/` (artifact cục bộ, không commit theo mục 5 của `rule.md`; checkout mới không có các file này, cần chạy lại script kiểm chứng để tạo bằng chứng):

- `package_final.json`: build wheel từ source sạch, cài vào virtualenv không dùng system site-packages, constraints CPython 3.13/Windows; `pip check`, smoke import từ site-packages và full suite bằng interpreter mới.
- `pytest.xml`: kết quả pytest trên workspace, có từng test case/thời gian.
- `benchmark_before.json`: chạy code baseline `c3d49b2` được xuất bằng `git archive` sang TemporaryDirectory. Exit 1 đúng vì event-loop lag vượt ngưỡng; không loại gate fail để gọi baseline pass.
- `benchmark_final.json`: ba vòng load test sau tối ưu account/role và WAL. Không chạy soak ở lượt này, nên gate memory là null.
- `benchmark_final_soak.json`: workload tương tự + soak 600 giây, sample RSS/handles/connections mỗi 10 giây. Có hash source Python lúc bắt đầu.
- `benchmark_after.json`, `package_check.json`, `package_locked.json`: các checkpoint trước kiểm tra cuối; giữ để đối chiếu, không thay bằng chứng cuối.

Không có test nào bị skip/xfail để làm xanh suite. Test symlink/junction chạy bằng junction trên Windows trong vùng tạm; gỡ junction bằng `rmdir` trên link, không xóa target đệ quy. Test fake R2 không phải kiểm tra Cloudflare live. Package check tải dependency; API tests/benchmark chặn outbound service thật.

**125/125 test pass**, 0 fail/error/skip, workspace 21.382 giây; interpreter mới dùng constraints cũng **125 pass**, 21,72 giây. Wheel build, cài fresh venv, `pip check`, installed-package smoke đều pass. OpenAPI được xuất lại và check độc lập trước bàn giao.

| Chỉ số cùng workload | Baseline c3d49b2 | Sau sửa (benchmark_final) |
| --- | ---: | ---: |
| Read p95 (600 request / 3 vòng) | 130.83 ms | 121.42 ms |
| Read p99 | 143.71 ms | 151.97 ms |
| Write p95 (600 request / 3 vòng) | 145.07 ms | 223.99 ms |
| Write p99 | 215.53 ms | 249.61 ms |
| Health p95 khi storage chậm | 2.22 ms | 1.90 ms |
| Event-loop lag tối đa | 6023.78 ms | 11.19 ms |

Soak cuối **600 giây**: 11,073 request, toàn bộ HTTP 200; read p95 128.00 ms; write p95 222.93 ms; event-loop lag max 11.40 ms. RSS tăng sau warm-up **4.00 MiB**; 60 mẫu, số kết nối đang mở cuối lượt **0**, peak 10. Tất cả các gate được đo trong lượt soak đều pass. Giữ đầy đủ sample gốc và versions trong JSON.

**MP4 thực:** script `verify_video.py` dùng binary tạm `ffprobe version 6.0-essentials_build-www.gyan.dev`; tạo clip 64×48, 1 giây, upload → complete → private read trả đúng 1146 bytes. Bản cắt cụt bị 422 và giữ trạng thái rejected. Binary được lấy qua wheel `ffmpeg-binaries==1.1.0` để kiểm thử, không thêm vào dependency runtime hoặc PATH hệ thống; SHA-256 lưu ở `video_actual.json`. Kết quả này xác nhận luồng clip tổng hợp nhỏ, không phải chứng nhận mọi codec/file video hoặc cấu hình production.


## 3. Đọc số đo đúng phạm vi

Dataset thống nhất: 1.000 item tổng hợp (ngoài seed), 100 account, mỗi account 20 outfit và 5 lookbook, mỗi lookbook 4 entry. Ba vòng, 200 reads + 200 writes/vòng; concurrency 10; cùng Python/máy/versions cho baseline và working tree. Read workload gồm catalog và lookbook có auth, write workload tạo outfit mới. Provider fake delay 2 giây; timer và health chạy trên cùng một ASGI event loop.

Catalog 50 item = 3 SELECT, list 5 lookbook = 2 SELECT ở **cả baseline Gemini và bản sửa này**. Không nhận công giảm 101→3/11→2 cho đợt sửa; đó là tối ưu đã có trước. Tối ưu lần này tập trung event-loop, truy vấn auth, lifecycle, consistency và đo đạc thật.

Mục tiêu gate: read p95 ≤300 ms, write p95 ≤600 ms, health p95 ≤200 ms, max event-loop lag ≤200 ms, không 5xx/reject, connections cuối lượt =0. Memory gate là RSS tăng ≤32 MiB sau phút warm-up đầu, đọc cùng chuỗi handles/connections; một soak 10 phút không chứng minh không bao giờ rò rỉ. Benchmark chạy trên máy dev có tác vụ nền; không diễn giải chênh lệch nhỏ là cải thiện có ý nghĩa thống kê.

Read/write p95 phải xem riêng: chuyển sang threadpool bảo vệ event loop nhưng không đảm bảo mọi request ghi nhanh hơn baseline. Kết quả write tăng nếu có được ghi nguyên trong bảng, không che bằng throughput đọc hoặc việc reject request sớm. p95/99 và từng sample đều có trong JSON.

Lượt soak cuối được khởi chạy trước bổ sung **schema OpenAPI riêng cho response `/ready`** và điều chỉnh seed tránh duplicate legacy; các thay đổi này không nằm trong workload đo (không gọi `/ready`, không seed lại trong soak). Full suite và build/cài package cuối kiểm tra các thay đổi đó. Không sửa hash trong artifact thành hash của code mới hơn.

## 4. Migration và thao tác triển khai cần làm

Hướng dẫn đầy đủ: [Backend README](../README.md), [handoff frontend](handoff_fe.md). Các lệnh migrate/cleanup chưa chạy trên DB/media thật.

1. Chốt contract/Frontend handoff theo `rule.md`; không dùng checklist gốc để khẳng định đã E2E.
2. Bảo trì dừng ghi, backup DB bằng SQLite backup và backup/versioning object storage. Chạy `migrate.py --dry-run` trên cấu hình đích, đối soát duplicate/legacy references.
3. Nếu duplicate form: chọn `owner_id → keep_id` tường minh, dry-run với `--resolve-forms`; apply archive nguyên field của các bản dư. Không tự chọn bản mới nhất hoặc đổi owner.
4. Apply migration bằng CLI, kiểm tra checksum/schema và `/ready`. App production chỉ đọc schema, không tạo/seed bảng khi startup.
5. Cấu hình R2 private thật, HTTPS origins, JWT secret riêng, CORS upload, ffprobe nếu dùng MP4. Scheduler cleanup mỗi phút, theo dõi `failed`/exit code và backlog; dùng lifecycle `staging/` ở R2.
6. Smoke A/B/guest bằng tài khoản staging: upload/access/delete, outfit CAS, share/revoke/expired, unpublished và provider outage.

Rollback phải khôi phục bản sao đã kiểm tra trong thời gian dừng traffic; giữ backup của trạng thái lỗi để đối soát. Không rollback về baseline có upload không grant. Metadata backup không khôi phục bytes R2 đã bị xóa; cần chính sách storage riêng.

## 5. Giới hạn và điều kiện release

- Backend fixes và regression cục bộ không đồng nghĩa M1 production đã nghiệm thu. Frontend chưa được sửa/chạy E2E ở đợt này; Google/Gemini/R2 live, CDN, proxy/CORS và chất lượng AI thực chưa kiểm tra.
- MP4 cần `FFPROBE_PATH` trỏ tới binary được vận hành cung cấp. Tests mặc định kiểm tra missing-validator 503, probe arguments/timeout và error/metadata contract bằng subprocess fake. Kiểm tra MP4 với binary thực đã chạy riêng và lưu `evidence/video_actual.json`; binary chỉ dùng trong thư mục tạm cho kiểm thử, môi trường đích vẫn cần provision ffprobe.
- Ready media legacy chưa được scan lại bytes. Unknown visibility fail closed khi đọc API; reference/unsafe key legacy được giữ để đối soát. Bucket/CDN từng công khai dữ liệu cần xử lý tại môi trường đích, không thể chứng minh sửa bằng unit test.
- Tombstone/object ledger được giữ để dọn staging bị PUT lại sau delete hoặc worker kết thúc muộn. Cần scheduler hoạt động và storage lifecycle; DELETE 503 không phải “đã xóa”.
- M1 dùng SQLite trên một database dùng chung cho các process. Multi-host/Redis/Supabase/JWKS cutover, AI try-on live và migration M2 không thuộc đợt vá này.
- Chưa commit, push, merge hoặc deploy. Working tree là kết quả để người dùng review.

Tham chiếu công cụ video: [tài liệu ffprobe](https://ffmpeg.org/ffprobe.html), [trang tải FFmpeg](https://ffmpeg.org/download.html). Các nguồn này mô tả công cụ; bằng chứng ứng dụng nằm trong test/artifact của repository.
