# Tiến độ remediation — 19/09/2026

Mục tiêu: thực hiện tuần tự `remediation_optimization_plan_20260919.md`. Chưa hoàn thành toàn bộ kế hoạch; chưa commit/push/deploy bản sửa.

## Nền working tree

- Branch làm việc: `fix/remediation-20260919`, tạo từ `backend/acceptance-fixes-20260917` với nguyên trạng thay đổi V3 của người dùng.
- Các thay đổi có trước: migrations.py, main.py, shared/openapi.json; module/scripts/tests V3, docs và composer frontend chưa tracked.
- Đã giữ patch của ba file tracked có trước trong thư mục bằng chứng ngoài repo. Không reset/rebase/ghi đè thay đổi đó.

## Giai đoạn 0 — đã xử lý local, phạm vi deployment còn cần xác định

- File `frontend/public/images/temp_coccoc.db` được chuyển khỏi repo vào `%LOCALAPPDATA%/VietStylist/security-review/20260919/`, ACL chỉ tài khoản Windows hiện tại và SYSTEM. SHA-256 trước/sau khớp.
- Đã stage riêng việc xóa file khỏi Git index. Blob vẫn còn trong lịch sử Git; việc stage xóa không xóa lịch sử hoặc thay đổi remote.
- Sau `git fetch origin`, commit thêm file `6290179` vẫn thuộc remote ref `origin/backend/acceptance-fixes-20260917`. Chưa rewrite/force-push lịch sử.
- Chốt kiểm tra `frontend/scripts/check-public-assets.mjs`: quét tên database/backup/log/key/env và chữ ký SQLite dù đổi extension; không in nội dung. Chạy trước dev/build/start và có workflow CI.
- Unit test chốt kiểm tra pass; Playwright GET và HEAD `/images/temp_coccoc.db` đều 404, 1 test pass.
- Đã hỏi tình trạng deployment/URL. Chưa có bằng chứng về deployment/CDN/log truy cập, nên chưa kết luận phạm vi rò rỉ ngoài local đã được khép lại.
- Rollback code không được khôi phục database vào public. Bản cách ly chỉ phục vụ xử lý sự cố, không đóng gói trong artifact.

## Giai đoạn 1 — đã có bản sửa và kiểm thử local

- Public entity API chỉ trả `published`; query status khác không làm lộ draft. Token sai vẫn trả 401.
- Ghi entity yêu cầu editor/admin. Editor tạo draft/under_review; admin có quyền verified/published/deprecated. Chuyển trạng thái dùng version và trả 409 khi stale.
- Đường editor list/education riêng có RBAC; dual-run audit yêu cầu editor/admin.
- Resolver public lọc definition chưa active, entity/qualifier/reference chưa publish, assertion/source chưa publish; redaction cả payload withheld do importer cũ tạo.
- Repository kiểm tra type/enum/reference/qualifier/candidate/cardinality trong cùng transaction. Single-cardinality xét context đã chuẩn hóa; số bool không được nhận thành number.
- Public DTO decode trường JSON, không xuất extensions nội bộ. Seed pilot thật không bị tự động publish để làm test pass; test mô phỏng bước duyệt trong DB tạm.
- Đã cập nhật contract cùng các route generation giai đoạn 3. Khi mở rộng resolver phải tiếp tục kiểm tra publication trên mọi đường kế thừa, context và evidence.

## Giai đoạn 2 — đã có implementation, còn nghiệm thu bổ sung

- `useStudioDocument` quản lý toàn bộ document/history, draft theo owner, guest claim sau login, create/update theo revision và bảo toàn edit khi save response về muộn.
- Canvas commit transform vào snapshot sau gesture; export nhúng ảnh vào SVG trước khi tạo PNG.
- Đã có test cho refresh, undo/redo, lưu transform, conflict và hết phiên. Harness backend thật dùng SQLite/media tạm, không dùng dữ liệu/tài khoản production.
- Đã kiểm chứng nháp chưa lưu gặp `loadOutfit` chỉ bị thay khi người dùng chọn rõ; response tải outfit về muộn không đè edit; đổi account từ tab khác trong lúc save không đưa kết quả của A vào B.
- Smoke production với backend thật đã pass luồng hai tab cùng sửa: tab cũ nhận 409 và giữ nội dung; server giữ phiên bản đã lưu ở tab còn lại.

## Giai đoạn 3 — đã có contract/workflow, chưa khép lại nghiệm thu

- Grounding/prompt có endpoint; synthesize trả 503 `GENERATION_UNAVAILABLE`. Hậu kiểm trả `not_evaluated`, không suy ra compliant từ job completed.
- Đã export OpenAPI canonical; sửa subprocess test để không phụ thuộc thư mục chạy.
- API client giữ request ID/Retry-After, phân biệt hủy request với timeout. Đã tái hiện cache URL-only che lỗi token bị thu hồi và trả thành công cho request đã hủy. Bỏ cache TTL ở client, dùng no-store để kiểm tra lại publication/quyền; cả hai regression pass.
- Workflow quality đã có; chưa có bằng chứng CI remote. Production build tại mốc R04 pass; smoke với backend/DB tạm pass login, save, reopen, hai tab, tạo lookbook qua UI, guest bị chặn đọc ID unlisted nhưng xem được share, thu hồi share rồi reload không còn nội dung.

### Kết quả kiểm thử tại mốc R04

Đã chạy lại trong lượt triển khai tiếp theo, trước phần mở rộng resolver/evidence R05–R06:

- Backend: 203 pass; export OpenAPI --check pass.
- Frontend: 18 Playwright pass; typecheck pass; public-assets unit pass.
- Production build pass (.next-build); route Studio 29 kB, First Load JS 116 kB. Đây là số liệu bundle, chưa phải benchmark LCP/INP.
- Production integration: 1 kịch bản xuyên suốt pass trong 34,6 giây (test body 17,4 giây); hai server do Playwright khởi động/đóng, API dùng DB/media tạm.

## Giai đoạn 4 — đã triển khai R05 và một phần R06

- Resolver dùng context canonical, kế thừa qua known parentage, ưu tiên độ gần rồi độ cụ thể của scope; giữ provenance, xử lý conflict thành disputed; unknown/withheld không bị thay bằng giá trị known từ cha.
- Có cycle detection, depth/visit limit; không coi diamond hợp lệ là cycle; public parent/qualifier/assertion/source được lọc. Fact không được áp dụng rộng hơn qualifier của assertion hỗ trợ.
- Education không chọn context vẫn tra cứu được direct facts cùng scope; Composer/generation không chọn context chỉ nhận fact không bị giới hạn scope. API GET có query context; grounding POST dùng outfit.context; constraint gắn selection/slot.
- Projection và grounding đã có evidence metadata/locator/rights từ DB. Không copy source body; unpublish source/assertion/context làm mất fact/citation ở lần đọc tiếp. Chưa cấp reference-media permission chỉ vì có citation.
- Đã sinh lại OpenAPI và cập nhật type/client V3. Chi tiết hành vi và lỗi: `v3_resolver_contract.md`.
- Nhóm kiểm thử resolver/security/API/generation/pilot/models đã pass 88 test ở mốc R05. R06 có thêm test evidence và đang mở rộng nghiệm thu; không suy từ số test sang dữ liệu pilot đã được review.
- Sau bổ sung evidence/context, regression toàn backend pass 230 test. Sau đó siết điều kiện evidence cho hard constraint: targeted resolver/evidence/API/generation/pilot pass 57 test; typecheck pass. Các số này là các lần chạy khác nhau, không cộng thành một tổng suite.
- Người dùng xác nhận sẽ tự xác minh nội dung pilot. Đã chuẩn bị `v3_pilot_review_checklist.md` với sáu assertion, bốn nguồn, locator cần đối chiếu và quyền dùng ảnh.
- Seed mới tạo nội dung ở draft và dùng insert-only cho 10 nhóm dữ liệu để không ghi đè kết quả người dùng đã duyệt. Không chạy seed lên DB thật, không tự đổi trạng thái bản ghi đã có.
- Test seed-review/pilot/generation sau thay đổi insert-only: 16 pass.
- Composer bundle đã đọc renderables/style/rules từ DB, kiểm tra SVG và quyền media hiện tại. Validation không có rule/không đủ tri thức trả not_evaluated, giữ unevaluated_rule_ids; attribute multiple không bị ghi đè.
- Validation outfit hiện kiểm tra mapping renderable/variant, evidence và rule với trạng thái not_evaluated. Badge cố định và ID tự dựng đã được thay trong R07 bên dưới.
- Snapshot dataset/ruleset đã có content/hash, API tạo/đọc có RBAC, replay qua graph đóng băng và kiểm tra thu hồi live. Migration 011 chặn INSERT OR REPLACE vượt chốt immutable. Nhóm dataset/Composer/migration sau bản vá: 40 pass. Chi tiết: `v3_dataset_contract.md`.
- Mapping API đã có; importer được mở rộng nhập variant/profile còn thiếu, giữ mapping và nội dung đã biên tập; chưa áp dụng lên DB thật. Frontend adapter/Composer feature flag, quyền media reference và nghiệm thu xuyên suốt pilot vẫn còn việc.
- Chủ dự án phụ trách xác minh nội dung pilot; chưa tự publish dữ liệu mẫu.

## Giai đoạn 5–6 — còn thực hiện

- R08 đã có đo trước/sau query V3 và một tối ưu chỉ mục; đã bổ sung đo Canvas/frame và draft writes. DB kích thước thật, thiết bị thật và các workload khác vẫn còn.
- Provider ảnh thật, lưu media, job/retry/idempotency và benchmark có review người còn thuộc giai đoạn riêng; giữ unavailable tới khi đạt nghiệm thu. Đã thêm contract `validate_provider_result` để chỉ chấp nhận kết quả có provider status `completed`, media record `ready` kiểu image, MIME ảnh và probe giải mã thành công; contract không tự bật provider hay tạo media giả.
- Thứ tự tiếp theo và tiêu chí cụ thể: R01–R09 trong `remediation_optimization_plan_20260919.md`.

## R07 — tích hợp frontend đang nghiệm thu

- Adapter dùng `/api/v3/legacy-mappings`; giữ toàn bộ snapshot V1 trong bridge, không bịa canonical ID hoặc làm mất item/variant chưa mapping. Chặn validation bộ phối thiếu mapping, kể cả dịp chưa mapping.
- V1 → V2 → V1 giữ transform, assetVersion, màu, khóa slot, avatar/pose, background/aspect ratio và context V1. Sửa/xóa selection có mapping được áp dụng; item chưa mapping được giữ. Reverse conversion từ V2 thuần, nhiều dịp hoặc context period/region chưa được V1 hỗ trợ trả lỗi rõ, không âm thầm bỏ dữ liệu. Cần hoàn thiện lưu V2 native nếu mở các context này trong Studio.
- `NEXT_PUBLIC_STUDIO_V3=true` bật panel dùng bundle/education/validation thật; mặc định tắt. Cần restart dev hoặc rebuild production khi đổi cờ. Không tự bật trên deployment.
- Panel lấy citation/locator theo entity được chọn, dùng cùng dataset cho projection và validation. Không còn danh sách sách/câu trích cố định hay badge clear cố định. Lỗi request cho trạng thái chưa kiểm tra và nút thử lại; response cũ không thay kết quả hiện tại.
- Panel hiện tra cứu trên bộ phối V1 trong Studio; chưa phải bộ biên tập OutfitSpecV2 native. Mapping dev không phải snapshot tái hiện. R07 còn nghiệm thu chuỗi pilot với evidence thật.
- Kiểm thử adapter hiện có 8 ca pass; chạy flag off cùng UI: 9 pass, 2 ca flag on được skip chủ ý. Lần chạy suite frontend trước đó: 25 pass, 2 skip, 1 lỗi fixture mới trả sai contract cho color-analysis; đã sửa fixture, ca flag off chạy lại pass. Không cộng các lần chạy thành tổng suite.
- UI flag on: 2 pass, 1 flag-off skip; kiểm tra citation theo entity, lỗi API/retry, response cũ và thiếu mapping không validate bộ phối một phần. Đây là mock contract, chưa chứng minh dữ liệu văn hóa thật.
- Production build flag on pass (Studio 28,6 kB, First Load JS 116 kB); production integration backend thật/SQLite tạm pass 1 ca trong 20,5 giây (body 12 giây). Ca kiểm tra mapping API thật, trạng thái thiếu mapping rồi đăng nhập/lưu/mở lại/hai tab 409/lookbook/chia sẻ/thu hồi. Không seed/publish dữ liệu pilot để làm test pass.
- R07 đã bổ sung lưu/khôi phục context và dataset trong snapshot, cùng UI lựa chọn canonical context. Việc còn lại là nghiệm thu chuỗi pilot với evidence thật; người dùng phụ trách xác minh nguồn. R09 AI thật chưa hoàn tất.

### R07 — bổ sung lưu context/dataset trong snapshot

- Backend có `OutfitSnapshot.culturalSettings` additive, validate cùng ContextQualifier V3. POST/PUT/GET giữ context/dataset/ruleset; snapshot cũ vẫn đọc được. Không bắt publication tại thời điểm lưu để không làm mất bộ phối có nguồn bị thu hồi; việc sử dụng vẫn đi qua validation/projection có withdrawal gate.
- `/api/v3/entities` nhận dataset_version để danh sách lựa chọn bối cảnh đọc đúng snapshot; regression xác nhận tên frozen không đổi khi live edit và nguồn bị thu hồi trả 409.
- Studio có editor sáu nhóm bối cảnh và lựa chọn dataset; thao tác vào cùng history/draft, giữ thiết lập khi tắt V3. Adapter round-trip extended context/dataset; không có settings vẫn giữ hành vi V1. Phạm vi từ chối context thời kỳ/vùng ghi ở mốc trước đã được thay bằng field additive này; import V2 native không bridge vẫn chưa được hỗ trợ.
- Backend dataset/API/settings: 29 test pass; OpenAPI export/check pass. Adapter: 9 ca pass. UI bật V3: 2 pass, 1 skip flag off; bao gồm chọn thời kỳ, dataset, undo/redo, refresh/khôi phục và đối chiếu payload gửi đi. Lần đầu test không tìm thấy exact label; đã đặt aria-label rõ cho select, chạy lại pass.
- Pilot thật chưa nghiệm thu; user vẫn tự xác minh nội dung. Tính năng này không tự seed/publish dữ liệu.

## R08 — baseline và tối ưu query V3

- Thêm migration `012_performance_indexes_v3` với bốn chỉ mục ghép cho list entity, attribute, relation và assertion. Migration additive, không sửa bảng V1 hay dữ liệu.
- Benchmark tái lập tại `backend/scripts/benchmark_v3.py`; mỗi lần dùng SQLite tạm, 3.000 entity công khai (1.500 period/1.500 region), 30 lần đo tuần tự và 10 client. Hai file JSON before/after ghi workload, query plan, p50/p95 và concurrency; không dùng DB thật.
- Query plan trước: `idx_entity_status`, `idx_attrval_entity`, `idx_rel_subject` kèm `USE TEMP B-TREE FOR ORDER BY`. Sau: chỉ mục ghép được dùng trực tiếp, không còn temp B-tree.
- Payload HTTP p50 giữ nguyên theo workload: list 31.801 bytes, education 209 bytes, composer bundle 449 bytes, validate 544 bytes. Raw SQL trước/sau ở workload này (sau 5 lượt warm-up): list entity p95 48,891 → 31,007 ms; attribute p95 19,929 → 10,610 ms; relation p95 17,017 → 15,990 ms. Đây là kết quả local của workload cố định, không phải SLO production. Độ dao động local làm latency chưa chứng minh cải thiện; chỉ kết luận chắc chắn là query plan bỏ bước sort. HTTP smoke lần chạy này có TestClient/ASGI overhead và không dùng để cam kết p95 production.
- Kết quả này cho thấy cần đo lại trên DB kích thước thật và profiler SQL trước khi tiếp tục tối ưu resolver/cache. Không giảm validation hoặc publication checks để lấy số đẹp.

- Sau R08: full backend suite `python -m pytest -q` chạy thành công (exit 0); targeted migration/settings/dataset/OpenAPI suite cũng pass. Frontend typecheck pass; adapter + UI + Studio regression chạy 24 pass, 1 skip (flag-off case chủ ý khi flag bật).
- Production build với `NEXT_PUBLIC_STUDIO_V3=true` pass sau thay đổi cuối: Studio 28,9 kB, First Load JS 116 kB. OpenAPI `--check` pass; public asset guard pass.
- Integration smoke có một lần timeout login trong test server nên không dùng làm evidence; lần chạy lại với dev server pass 1/1 trong 34,8 giây. Khi chạy production build lần đầu, `.env.local` giữ API origin 4000 nên panel không gọi được harness 4100; đã rebuild với `NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:4100` và production integration pass 1/1 trong 11,5 giây. Đây là DB/media tạm và không chứng minh deployment production; deployment phải build với API origin staging đúng.

- R08 Studio metric: một gesture kéo outerwear trên Chromium headless có 1 lần ghi draft và 89 khoảng frame; p50/p95 frame là 16,7/16,8 ms. Artifact: `docs/benchmark_studio_20260919.json`. Đây là local harness, chưa phải thiết bị 60 Hz ngoài thực tế; không thay đổi code vì số đo đã ở ngưỡng mục tiêu cục bộ.
- Sau bổ sung metric R08: test Canvas/draft pass 1 ca; frontend typecheck pass; targeted backend Studio/media/migration pass 16 ca. `git diff --check` không có lỗi whitespace (chỉ cảnh báo line ending của working tree).

## R09 — khóa đường thành công giả của provider

- `validate_provider_result` trong `backend/app/modules/cultural_data_v3/services/generation.py` kiểm tra tuần tự trạng thái provider, `result_media_id`, bản ghi media authoritative, `ready`/`image`, MIME `image/*` và probe giải mã. Mọi lỗi trả `AppError` 502 với mã riêng; thiếu probe cũng bị từ chối.
- Test mới bao phủ provider thất bại, thiếu ID, media pending/video, MIME sai, probe thất bại/thiếu và kết quả hợp lệ. `python -m pytest tests/test_v3_generation.py -q`: 17 pass.
- `/api/v3/generation/synthesize` và Gemini provider vẫn trả 503 `GENERATION_UNAVAILABLE`; chưa có provider ảnh thật, media object thật, job retry/idempotency được nối vào đường chạy, hay human review. Vì vậy R09 chưa đạt điều kiện mở tính năng.
