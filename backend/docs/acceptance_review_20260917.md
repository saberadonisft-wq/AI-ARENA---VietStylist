# Nghiệm thu độc lập M1-BE — 17/09/2026

> Báo cáo này ghi nhận trạng thái **trước khi sửa**. Kết quả xử lý và bằng chứng mới: [remediation_results_20260917.md](remediation_results_20260917.md).

**Kết luận: CHƯA ĐẠT M1-BE. Không xác nhận toàn bộ R01–R11/O01–O08 đã hoàn thành.**

Phạm vi kiểm tra: branch `backend/m1-be-remediation`, HEAD `c3d49b2`, bao gồm nội dung working tree tại thời điểm review. Trước review đã có thay đổi chưa commit ở `backend/README.md`, `backend/app/core/http_client.py`, `backend/docs/handoff_fe.md`; các thay đổi đó được giữ nguyên. Báo cáo này không sửa implementation hoặc checklist kế hoạch.

Đối chiếu: `docs/Ke_Hoach_Trien_Khai_Chi_Tiet_Viet_Phuc_Remix.md`, `docs/rule.md`, code và test thực tế. Những mục được đánh dấu `[x]` trong kế hoạch chưa đủ bằng chứng để coi là đã nghiệm thu.

## 1. Cách kiểm chứng và kết quả tổng quát

- Chạy toàn bộ `backend/tests` qua pytest với config tạm thiết lập trước import, DB/media trong `TemporaryDirectory`, secret giả ngẫu nhiên và vô hiệu hóa R2/Gemini thật. HTTP transport thật bị chặn trong runner.
- Kết quả cấu hình chuẩn hóa, Python 3.13 trên Windows: **57 passed, 11 failed, 1 warning**, 68 test, khoảng 5,36 giây. Cả 11 lỗi thuộc `test_reproduce_regressions.py`, vẫn assert hành vi dễ bị khai thác của baseline.
- Lần đầu để bucket lấy theo cấu hình máy cho thêm một lỗi `INVALID_BUCKET` thay `INVALID_PATH`; chạy lại với bucket mặc định tường minh còn 11 fail. Đây là bằng chứng fixture hiện còn phụ thuộc `.env`, không phải một path traversal mới.
- `export_openapi.py --check`: exit 0. Điều này chứng minh file bằng schema do app sinh, chưa chứng minh schema mô tả đúng response lỗi hoặc policy production.
- Build wheel offline từ bản sao các file backend được Git quản lý, lấy nội dung working tree hiện tại, bằng `pip wheel --no-deps --no-build-isolation --no-index`: **pass**. Chưa kiểm tra fresh dependency resolution hoặc cài/chạy wheel trong một runtime hoàn toàn mới.
- Instrument SELECT thật: catalog page dùng **3 query**, list 10 lookbook dùng **2 query**. Có tối ưu batch thực sự; chưa đạt toàn bộ benchmark p95/p99/concurrency/soak của kế hoạch.
- Probe bảo mật/nghiệp vụ riêng dùng tài khoản giả A/B, TestClient, storage fake, failure injection và fixture DB cũ. Junction chỉ trỏ đến sentinel khác trong cùng thư mục tạm, không đọc file hệ thống.
- Không gọi Google/Gemini/R2 live, không migrate DB thật, không triển khai production, không sửa frontend. Không nghiệm thu M1-FE/M2.

## 2. Phát hiện cần sửa trước nghiệm thu lại

### F01 — P1: Path helper không chặn junction/symlink

Vị trí: `backend/app/modules/media/path_utils.py:27–32`, `media/router.py:135–166`.

`safe_join_media_path` chỉ dùng `abspath` và so sánh prefix, không resolve liên kết filesystem. Tạo junction trong bucket public trỏ đến thư mục sentinel ngoài media root; GET đường dẫn qua junction trả **200** và đúng bytes sentinel ngoài root. Test này chạy local mode; không có khẳng định rằng junction được tạo từ xa qua API.

Ngoài ra public raw route cho đọc file không có record DB vì chỉ chặn khi `asset` tồn tại nhưng chưa ready. `LOCAL_MEDIA_ENABLED=True` còn có thể mở local endpoints dù environment là production.

Yêu cầu: canonical-path/realpath và kiểm tra cha, bucket/key normalization, chỉ đọc asset đã đăng ký ready/public, loại debug endpoints khỏi production. Test junction/symlink phải có trong suite, với điều kiện OS hỗ trợ và cleanup sandbox an toàn.

### F02 — P1: Luồng upload thực vẫn dùng endpoint legacy không grant

Vị trí: `backend/app/infrastructure/r2/client.py:61`, `backend/app/modules/media/service.py:29`, `backend/app/modules/media/router.py:105`.

`POST /media/uploads` phát URL `/media/local-upload?key=...&bucket=...`, không có grant. Endpoint legacy không xác thực owner hoặc session capability; chỉ kiểm tra tồn tại pending record. Với URL/key của session A, request **không token và không grant upload được 200**. Route mới `/local-upload/{media_id}?grant=...` chưa được nối vào URL do service phát hành.

Yêu cầu: nối luồng thật vào session/grant đã xác minh, vô hiệu hóa route legacy theo kế hoạch, kiểm tra replay/race/expiry. Không coi việc thêm một route an toàn nhưng vẫn dùng route cũ là đã sửa.

### F03 — P1: Visibility tùy ý có thể vượt quyền đọc media và lookbook

Vị trí: `backend/app/modules/media/schemas.py:5`, `media/service.py:102`, `backend/app/modules/lookbooks/schemas.py:12`, `lookbooks/service.py:93`.

Schema nhận `visibility: str`. Media `visibility="PRIVATE"` được nhận, lưu vào private bucket nhưng bỏ qua điều kiện owner chỉ kiểm tra đúng `private/unlisted`. Với fake R2, guest gọi `/access` nhận **200 và presigned GET cho object private**. Tạo lookbook với visibility không hợp lệ cũng được `200`.

Yêu cầu: Enum/Literal ở input và constraint/validation dữ liệu cũ; mọi giá trị ngoài allowlist fail closed. Kiểm tra cả create/update và row cũ, không chỉ sửa UI.

### F04 — P1: Media chưa có validation nội dung, staging/promote và giới hạn đúng

Vị trí: `backend/app/modules/media/service.py:25–75`, `backend/app/infrastructure/r2/client.py:36–58`.

Bytes `NOT_AN_IMAGE` với đuôi PNG được upload và complete thành ready **200**. Fake HEAD báo object **100 MiB, MIME text/html**, complete vẫn **200**. Không có scan bytes/type/pixel, staging private hoặc final key bất biến; key trước và sau complete bằng nhau, URL PUT cấp vào chính key đang sử dụng.

Yêu cầu: thực hiện R05 đầy đủ; validate byte/type/size, public upload policy, staging và promote đúng bytes đã kiểm tra, không cho PUT cũ ghi đè final asset. Fake R2 ở đây chỉ xác minh logic app; chưa phải thử Cloudflare thật.

### F05 — P1: Xóa media thất bại vẫn báo thành công, complete có thể hồi sinh deleting

Vị trí: `backend/app/modules/media/service.py:59–80,126–139`, `backend/app/modules/media/router.py:59–66`.

Mock `delete_object=False`: DELETE trả **200, “Đã xóa file thành công”**, record ở `deleting` và file còn tồn tại. Gọi complete lại bằng owner trả **200** và đưa record về `ready` vì complete không kiểm tra trạng thái chuyển tiếp.

Yêu cầu: state machine và transition có điều kiện atomic, không complete deleting/deleted; trả trạng thái pending-deletion hoặc storage error đúng contract, có retry/reconciliation thật. Không xóa metadata khi storage thất bại và không báo đã xóa nếu chưa xong.

### F06 — P1: Thu hồi share không ngăn đọc lookbook unlisted bằng ID

Vị trí: `backend/app/modules/lookbooks/service.py:88–96`.

Tạo lookbook unlisted, phát share rồi revoke. `/shares/{token}` trả **404**, nhưng guest GET `/lookbooks/{id}` vẫn **200** cùng nội dung. Điều kiện chỉ bảo vệ visibility `private`, trái policy unlisted owner-or-token đã chốt.

Yêu cầu: chỉ `public` đọc qua ID không auth; private/unlisted dùng owner hoặc share token hợp lệ. Đồng nhất 401/404 theo contract, kiểm thử sau revoke/expiry và không chỉ kiểm tra token endpoint riêng lẻ.

### F07 — P1: Reference trái owner từ dữ liệu cũ vẫn công khai

Vị trí: `backend/app/modules/lookbooks/repository.py:get_entries`, `lookbooks/service.py:_get_formatted_entries`, `resolve_shared_token`.

Đường tạo mới đã từ chối version người khác. Nhưng mô phỏng row cũ vốn có thể được tạo bởi lỗi baseline: lookbook public của B tham chiếu outfit version của A. Guest GET vẫn **200**, có snapshot của A.

Yêu cầu: inventory/quarantine reference cũ và kiểm tra projection khi đọc/share. Không mặc định mọi row hiện có đã đi qua validation mới. Giữ dữ liệu phục vụ đối soát, không tự đổi owner hoặc purge hàng loạt.

### F08 — P1: Migration có thể chặn startup trên DB cũ có form trùng owner

Vị trí: `backend/app/core/database.py:552,588`, `backend/app/main.py:44`, `backend/scripts/migrate.py:apply_migrations`.

Tạo DB bằng DDL đúng commit baseline `739a73a`, thêm hai solution form cùng owner — trạng thái hợp lệ ở schema cũ. `init_database()` mới lỗi **IntegrityError: UNIQUE constraint failed: solution_forms.owner_id**. App vẫn chạy migration khi startup nên không lên được với dữ liệu này. `--dry-run` chỉ liệt kê migration đã chạy, không phát hiện duplicate cần xử lý.

Yêu cầu: preflight duplicate/schema, báo cáo lựa chọn bản giữ và bảo toàn bản dư, migration runner độc lập production, kiểm tra schema readiness. Test fresh/old/partial/repeat/failure; không xóa form để làm index chạy. Không khẳng định migration an toàn chỉ vì DB mới pass.

### F09 — P1: Cleanup pending media không chạy được

Vị trí: `backend/scripts/cleanup_staged_media.py:45,52–59`.

Chỉ cần có một pending record quá hạn, cả `dry-run` cũng lỗi **KeyError: 'storage_key'**; bảng dùng `object_key`. Kế tiếp script gọi `storage.delete_file`, trong khi client có `delete_object`. Nhánh catch còn tiếp tục xóa record dù storage thất bại, sẽ mất reference phục hồi nếu chỉ sửa tên field.

Yêu cầu: sửa toàn bộ field/method/state/error flow, giới hạn prefix/batch, kiểm tra status trước mutation, không mất metadata khi object chưa được xóa; bổ sung test pending/deleting/retry/race/dry-run.

### F10 — P2: Nội dung chưa publish vẫn lọt qua gợi ý màu

Vị trí: `backend/app/modules/color_analysis/service.py:104–110`.

Lấy item từ suggested_variants, chuyển `is_published=0`. Detail catalog trả **404** đúng, nhưng POST `/color-analysis` vẫn **200** và gợi ý item vừa ẩn. Query JOIN items không có publication filter.

Yêu cầu: bảo vệ các đường đọc phụ/nested như color/starter/recommendations/cache theo R09, giữ riêng internal lookup khi cần lịch sử cá nhân.

### F11 — P1: Event loop vẫn bị chặn, O02 chưa đạt

Vị trí: `backend/app/modules/media/router.py:24–43`, `backend/app/modules/auth/router.py:19–25`, các async router gọi sync service trực tiếp.

Trong cùng một event loop ASGI, fake `generate_upload_url` chậm 0,3 giây làm timer `asyncio.sleep(0.02)` chỉ thức dậy sau **0,311 giây**. Chứng minh sync storage call trong async route chặn event loop. HTTP pooling mới không giải quyết sqlite3/boto3/PBKDF2 sync.

Yêu cầu: sync route hoặc offload bounded phù hợp, giữ nguyên connection/transaction thread ownership; đo concurrency/health timer. Không giảm hash rounds hoặc bỏ auth để tăng tốc.

### F12 — P2: Gemini output sai cấu trúc vẫn làm API trả 500

Vị trí: `backend/app/modules/recommendations/service.py:77–85`, `backend/app/infrastructure/gemini/client.py`.

Provider fake trả JSON hợp lệ `recommendations: [42]`; `/recommendations/ai` trả **500** do gọi `.get` trên phần tử không phải object. Client chỉ kiểm tra danh sách ngoài, chưa validate item/nested fields. Weather sample vẫn cache 60 phút trong source; chưa có recovery TTL như O05. Chưa thấy quota/rate-limit thực thi ở đường gọi AI/auth trong code được kiểm tra.

Yêu cầu: output schema hoàn chỉnh và fallback kiểm chứng; test malformed root/item/items/IDs, quota/deadline và weather upstream recovery. Không gọi HTTP 200 là model output hợp lệ.

### F13 — P1: Readiness báo ready khi storage production chưa cấu hình

Vị trí: `backend/app/main.py:124–143`, `backend/app/infrastructure/r2/client.py:61–71`.

Production tạm không có credential R2, local endpoints tắt: `/ready` vẫn **200** với `media_storage="not_configured"`. API tạo upload vẫn **200**, cấp URL localhost đi vào endpoint local không dùng được. Readiness chỉ quyết định bởi `SELECT 1`, không kiểm tra schema version/storage readiness.

Yêu cầu: storage mode fail closed hoặc degraded policy rõ, không silent fallback sang local bị tắt; schema/required config được kiểm tra trước nhận traffic. Test production thiếu từng credential và DB sai schema.

### F14 — P1 cho bàn giao: Payload tài liệu Frontend không khớp API

Vị trí: `backend/docs/handoff_fe.md:44–51`, `backend/app/modules/media/schemas.py:5–20`.

Handoff bảo frontend gửi `file_name/content_type/file_size/purpose`; API thực yêu cầu `filename/mime_type/size_bytes/visibility`. Gửi đúng ví dụ trong handoff trả **422**. Response ví dụ nêu `upload_headers` không có trong schema. Tài liệu cũng ghi `/api/solution-forms` thay vì `/api/solution-form`.

Yêu cầu: sửa ví dụ từ request/response đã chạy thực, test contract fixture. Phân biệt local multipart và R2 raw PUT; không cho client đoán đường dẫn/grant chưa được service cấp.

### F15 — P2: OpenAPI equality pass nhưng error contract vẫn sai

Vị trí: `backend/scripts/export_openapi.py`, `backend/tests/test_openapi_contract.py`, `backend/app/main.py`, `shared/openapi.json`.

POST `/api/outfits` trong schema chỉ có response `200/422`; 422 vẫn tham chiếu `HTTPValidationError`, khác envelope `error` thực tế. 401/404/409 không được khai báo đúng như yêu cầu kế hoạch. Canonical production schema còn chứa local debug routes.

Yêu cầu: error/security schema đúng runtime, canonical production loại dev routes, test response body thực theo schema. Drift test chỉ là một gate, không thay contract conformance.

### F16 — P1 cho nghiệm thu: Suite chưa xanh và benchmark không đo đủ gate

Vị trí: `backend/tests/test_reproduce_regressions.py:16–262`, `backend/tests/conftest.py:10–40`, `backend/scripts/benchmark.py:65–68,94–107`, checklist A10.1 của kế hoạch.

11 test baseline vẫn assert lỗ hổng phải khai thác được, làm full suite fail. Cần chuyển thành regression assert hành vi an toàn với fixture đúng; không loại test khỏi pytest để tuyên bố pass.

Benchmark in literal `101 → 3`, `11 → 2` và câu “Tất cả các tiêu chí Gate O01 & O02 đều ĐẠT” vô điều kiện. Nó đo latency 50 lượt service tuần tự, không đếm query bằng instrumentation, không chạy baseline cùng dataset, không đo event-loop/concurrency/soak/gates. Review có xác minh 3/2 query độc lập, nhưng không xác nhận các kết luận rộng hơn.

Conftest chưa được chuyển sang cấu hình trước app import; còn dùng magic dev tokens ở nhiều test và phụ thuộc bucket `.env`. Fixture chưa tự đảm bảo mọi outbound bị chặn; lớp chặn HTTP trong lần nghiệm thu là runner bên ngoài.

Yêu cầu: suite deterministic xanh; test không chứa tài khoản thật; benchmark có threshold/assert/exit code và dữ liệu raw; điều chỉnh checklist theo evidence, không để toàn bộ O01–O08 là DONE khi còn các lỗi trên.

## 3. Những phần đã cải thiện đúng

- Bỏ auto-admin theo email trong auth service; `/me` đọc role từ DB. Test auth bảo vệ role/token trong suite mới pass.
- Token signature không còn tắt khi secret rỗng; production có validation secret/debug và kiểm tra account active/tồn tại. Chưa xác nhận mọi config edge-case issuer/audience đều fail closed.
- Outfit owner: guest GET `401`, user khác `404`, owner `200`. Các thao tác cá nhân chính đã thêm auth.
- Lookbook create mới với version user khác trả `422`; update title + version không tồn tại trả `422` và giữ nguyên title/entry trước đó.
- Private raw URL trong bucket private không grant bị `403`; access grant owner bình thường có tests pass. Không đồng nghĩa mọi visibility/state/storage path an toàn.
- Schema blog được tạo thêm cho DB mới; không còn lỗi thiếu cột trong positive tests. Upgrade duplicate dữ liệu cũ vẫn thất bại như F08.
- Catalog/heritage detail unpublished đã trả `404`; đường màu vẫn còn F10.
- Share origin cấu hình, expiry/revoke token đã có implementation và tests pass; unlisted direct ID còn F06.
- DB connection context manager có close; outfit create atomic và solution-form compare-and-swap đã triển khai. Google account creation vẫn nhiều `Database.execute` riêng, chưa đạt transaction toàn luồng O03.
- Batch catalog/lookbook có hiệu quả 3/2 SELECT đo được. HTTP client có reuse; chưa bounded-offload sync work.
- OpenAPI không drift; wheel build được. Chưa có cơ sở gọi toàn bộ hệ thống release-ready.

## 4. Trạng thái theo kế hoạch

| Mục | Nghiệm thu | Ghi chú |
| --- | --- | --- |
| R01 | Chưa đạt | F01/F02, containment tốt hơn nhưng còn junction và legacy upload |
| R02 | Lỗi chính đã sửa | Auth tests pass; Google live/admin ops end-to-end chưa kiểm chứng |
| R03 | Lỗi chính đã sửa, chưa đủ gate cấu hình | Signature/account check có hiệu lực; verifier còn cho tắt issuer/audience bằng config rỗng |
| R04 | Đạt phần outfit/media/job/form chính, chưa đủ policy tổng thể | Unlisted/visibility invalid/legacy lookbook còn F03/F06/F07 |
| R05 | Chưa đạt | F02–F05, thiếu validation/staging/state machine |
| R06 | Một phần | Fresh DB được, DB cũ có duplicates không migrate an toàn |
| R07 | Một phần | New writes chặn, dữ liệu cũ còn bị lộ |
| R08 | Đạt tình huống đã kiểm tra | Invalid update không mất entry/metadata; chưa tuyên bố mọi race đã chứng minh |
| R09 | Một phần | Detail chặn, color nested vẫn lộ |
| R10 | Một phần | Drift pass, error schema và dev-route policy chưa đúng |
| R11 | Một phần | Domain/TTL/revoke token có, unlisted direct ID bypass |
| O01 | Một phần | Close + batch + index có; load/soak/query gates toàn bộ chưa chứng minh |
| O02 | Chưa đạt | Event loop stall tái hiện được |
| O03 | Một phần | Outfit/CAS có; Google multi-write chưa atomic, chưa đủ concurrency coverage |
| O04 | Chưa đạt | Visibility/body/reference/rate-limit còn thiếu, lỗi validation gây 500 |
| O05 | Chưa đạt | Malformed output 500, weather TTL/sample/quota chưa đủ |
| O06 | Chưa đạt | Cleanup crash; retry/delete lifecycle chưa đủ |
| O07 | Chưa đạt | Production readiness sai, migration còn trong startup |
| O08 | Một phần | Wheel build pass; suite fail, fixture/config/live HTTP isolation chưa đạt |
| M1-FE/M2/live providers | Chưa nghiệm thu | Ngoài phạm vi kiểm tra lần này |

## 5. Thứ tự sửa tiếp và gate nghiệm thu lại

1. F01–F07: đóng đường filesystem/grant/visibility/unlisted/legacy leak và media state machine. Test thêm lỗi đã tái hiện, không chỉ sửa assertion hiện có.
2. F08/F09/F13: migration preflight dữ liệu cũ, cleanup/retry đúng API và production readiness.
3. F10–F12: publication đường phụ, validation provider, offload sync/blocking có số đo.
4. F14/F15: sửa handoff từ payload thực, error contract và canonical schema.
5. F16: full suite xanh deterministic, benchmark có đo/threshold thật, checklist từng mục đúng trạng thái. Các sửa production không đợi đến lúc benchmark xong mới đóng lỗ hổng.

Điều kiện nhận lại: full pytest xanh; tái chạy các probe F01–F15 không còn hành vi sai; migration DB cũ/fresh/partial có bằng chứng; export schema pass và request/response tuân thủ schema; benchmark concurrency/health/soak theo A7 hoặc có giới hạn chưa đạt được ghi rõ. Chỉ đánh dấu M1-BE hoàn thành khi không còn gate bắt buộc bỏ trống.

**Báo cáo này ghi nhận kết quả kiểm tra code tại thời điểm nêu trên, không phải cam kết không còn lỗi khác và không phải bằng chứng dịch vụ production đã được kiểm thử.**
