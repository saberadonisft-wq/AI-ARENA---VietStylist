# Kế hoạch sửa lỗi và tối ưu VietStylist

Ngày: 19/09/2026. Trạng thái: R01–R04 có kiểm chứng local; R05–R07 đã triển khai theo từng phần; R08 đã có benchmark và một tối ưu query; R09 vẫn giữ unavailable. Toàn bộ kế hoạch chưa hoàn thành. Kết quả theo từng mốc nằm trong `remediation_progress_20260919.md`.

Kế hoạch dựa trên review working tree hiện tại, gồm mã V3 chưa commit. Tài liệu này bổ sung thứ tự sửa lỗi và nghiệm thu cho `v3_implementation_plan.md`; không coi các hạng mục trong kế hoạch V3 cũ là đã hoàn thành.

## 0. Điểm bắt đầu và thứ tự công việc tiếp theo

Working tree hiện ở `fix/remediation-20260919`, có nhiều thay đổi chưa commit. Các kết quả trong mục 2 là **baseline của lần review ban đầu**, không mô tả nguyên trạng code hiện tại. Đối chiếu code lần này xác nhận:

- File database public đã được stage xóa; guard public assets và workflow đã có. Vẫn phải khép lại phạm vi lịch sử Git/deployment.
- V3 đã có dependency quyền, lọc publication, đường chuyển trạng thái và validation repository. Cần giữ regression và rà các đường dữ liệu mới khi bổ sung resolver.
- Studio đã có `useStudioDocument`, hydrate theo owner, document history, POST/PUT theo revision và xử lý conflict. Đã kiểm chứng URL tải outfit, response muộn, hai tab và đổi tài khoản; production smoke với backend tạm đã pass.
- Grounding/prompt đã có route; synthesize chủ động trả 503. Đã có workflow test/build và harness tích hợp backend thật, nhưng file workflow không chứng minh CI remote đã chạy thành công.
- Resolver đã có context/kế thừa/cycle/provenance, conflict và citation metadata; generation kiểm tra evidence trước hard constraint. Composer đọc renderables/style/rules từ DB; dataset snapshot và replay đã có.
- `outfits/validate` kiểm tra entity/renderable/variant/evidence/rules với `not_evaluated`; Composer dùng mapping API và feature flag, citation theo entity. V3 chưa bật rộng vì pilot/evidence thật chưa được người review xác minh.

### Backlog triển khai tuần tự

| Mã | Phụ trách | Việc làm và đầu ra | Kiểm chứng bắt buộc |
| --- | --- | --- | --- |
| R01 | Người quản lý repo/deploy + FE | Hoàn tất hồ sơ P0: refs/artifact/URL bị ảnh hưởng, trạng thái CDN và deployment cũ; đề xuất riêng nếu cần xử lý lịch sử | GET/HEAD đường dẫn cũ không truy cập được ở mọi deployment thuộc phạm vi; không khôi phục DB khi rollback |
| R02 | FE | Khép lại Studio: nháp chưa lưu gặp `loadOutfit`, đổi owner khi có request chạy, hai tab cùng sửa, refresh ngay sau gesture | Response muộn không đè edit; 409 giữ bản local; tài khoản B không nhìn thấy draft A; undo/redo và PNG khớp snapshot |
| R03 | FE | Rà cache API: key hiện chỉ theo URL và được đọc trước khi dựng Authorization; quy định phạm vi cache, hủy request và invalidation khi nội dung bị gỡ | Chuyển phiên/đổi quyền không dùng lại response sai phạm vi; request đã hủy không bị cache che mất; kiểm tra fresh-data sau unpublish. Chưa kết luận có lộ dữ liệu riêng chỉ từ cấu trúc cache |
| R04 | BE + FE | Chốt bản build từ source mới nhất, canonical OpenAPI và smoke bằng production server với backend tạm | Login → save → reopen → conflict; tạo/xem lookbook → share → thu hồi; pass typecheck/test/build; CI không dựa vào `.env` cá nhân |
| R05 | BE | Resolver context + variant + provenance: định nghĩa ưu tiên trước khi code; lọc publication cho toàn bộ tổ tiên; phát hiện cycle | Context khác nhau cho kết quả đúng; dữ liệu ngang ưu tiên mâu thuẫn không bị chọn tùy tiện; unknown/disputed/withheld giữ nghĩa; không lộ tổ tiên chưa publish |
| R06 | BE + người review tri thức | Hoàn thiện dữ liệu pilot áo ngũ thân, evidence/rights, renderables/style/rules và snapshot dataset/ruleset có thể truy xuất | Bundle có dữ liệu thật đã review; cùng version tái lập grounding; nguồn bị thu hồi không tiếp tục đi vào reference AI dù còn trong snapshot lịch sử |
| R07 | BE trước, FE sau | Contract mapping legacy → canonical và validation có trạng thái chưa kiểm tra; adapter round-trip; Composer sau feature flag | Không bịa ID khi thiếu mapping; giữ transform/variant/context; badge theo API; citation theo entity; tắt flag vẫn đọc/sửa outfit V1 |
| R08 | BE + FE | Đo baseline hiệu năng rồi chọn thay đổi có lợi: SQL count, p50/p95, payload, frame time, số lần ghi draft và số request | Báo cáo trước/sau trên cùng workload; không làm suy giảm quyền, publication, fidelity hoặc khả năng khôi phục draft |
| R09 | BE + FE + người review ảnh | Đợt AI riêng: provider ảnh, job/idempotency, media thật, hậu kiểm kỹ thuật và rubric văn hóa | Ảnh decode được, media có thật, retry hữu hạn; benchmark có review người; chưa đạt thì giữ unavailable |

R01 có phần phụ thuộc thông tin deployment; có thể tiếp tục kiểm chứng local R02–R04 trong lúc chờ, nhưng không đóng P0. Hoàn tất R02–R04 trước khi mở rộng V3. R05 → R06 → R07 là chuỗi phụ thuộc; R08 chỉ tối ưu sau khi có baseline đúng. R09 không nằm trong điều kiện phát hành bản sửa nền tảng nếu tính năng sinh ảnh vẫn bị tắt.

### Quyết định cần chốt trong thiết kế R05–R07

- **Ưu tiên giá trị:** đề xuất giá trị trực tiếp của variant phù hợp context ưu tiên hơn giá trị kế thừa; context cụ thể ưu tiên hơn context chung. Giá trị ngang ưu tiên mâu thuẫn phải biểu diễn conflict/disputed, không chọn theo thứ tự query. Chốt các trường context và quy tắc kế thừa trong contract trước khi triển khai.
- **Tái lập và thu hồi:** snapshot giữ nội dung/version phục vụ audit; quyền công bố và quyền dùng media vẫn được kiểm tra tại lúc phục vụ. Snapshot cũ không phải đường vòng vượt unpublish hoặc thu hồi quyền.
- **Mapping thiếu:** trả trạng thái không hỗ trợ/chưa ánh xạ, giữ nguyên snapshot V1 để người dùng tiếp tục; không tự tạo canonical ID giả.
- **Validation chưa chạy:** biểu diễn `not_evaluated` hoặc trạng thái tương đương được định nghĩa trong OpenAPI; thiếu entity và chưa có ruleset không đồng nghĩa bộ phối chuẩn văn hóa.

### Gói bàn giao cho mỗi task

Ghi rõ file thay đổi, contract/error thay đổi, bước tái hiện, bằng chứng test/build, giới hạn còn lại và rollback. Backend bàn giao OpenAPI trước FE; tách commit theo quyền sở hữu. Chỉ cập nhật trạng thái hoàn thành sau khi tiêu chí của task được kiểm chứng; số test pass không thay cho nghiệm thu ảnh, dữ liệu văn hóa hoặc deployment.

## 1. Mục tiêu và phạm vi

1. Loại bỏ rủi ro lộ dữ liệu và ghi dữ liệu không có quyền.
2. Bảo toàn toàn bộ bộ phối khi kéo đồ, undo/redo, refresh, lưu và đăng nhập lại.
3. Đồng bộ API runtime, OpenAPI và frontend.
4. Hoàn thiện nền tảng V3 theo từng phần có thể kiểm chứng.
5. Tối ưu dựa trên số đo, sau khi các luồng chính hoạt động đúng.

Giữ V1 hoạt động song song V3; migration theo hướng bổ sung. Runtime hiện là SQLite. Chuyển sang Supabase là một đợt riêng, không ghép vào đợt sửa lỗi này. Không đổi model AI hoặc thêm Redis/queue framework chỉ để tối ưu khi chưa có số đo chứng minh nhu cầu.

## 2. Baseline đã kiểm tra

| Hạng mục | Kết quả review |
| --- | --- |
| Backend từ gốc repo | 166 pass, 4 fail trên 170 test |
| Backend còn fail | OpenAPI lệch runtime; 3 endpoint generation trả 404 |
| Frontend Playwright | 3 pass, 2 fail: giữ draft và lưu transform |
| Frontend typecheck | Pass |
| Production build | Chưa xác nhận; đã dừng sau hơn 4 phút ở bước tạo bundle |
| File public | `frontend/public/images/temp_coccoc.db`, 58.884.096 byte, được Git theo dõi và HEAD không đăng nhập trả 200 trên server kiểm thử |
| Quyền V3 | Guest tạo entity `published` nhận 201; guest đọc education của draft nhận 200 |
| Validator V3 | Repository chấp nhận giá trị ngoài enum đã đăng ký |
| Hậu kiểm generation | `completed` nhưng không có ảnh vẫn được đánh dấu compliant |

Các số liệu trên là bằng chứng local tại thời điểm review. Chưa nghiệm thu production, Google OAuth, Gemini hoặc R2 live. Không đưa nội dung lịch sử trình duyệt vào báo cáo, fixture hay log.

## 3. Thứ tự và phân công

| Giai đoạn | Ưu tiên | Phụ trách | Phụ thuộc | Điều kiện kết thúc |
| --- | --- | --- | --- | --- |
| 0. Chặn lộ dữ liệu | P0 | Frontend + người quản lý repo/deploy | Không | File không còn trong bản phát hành; xác định phạm vi ảnh hưởng |
| 1. Quyền và validation V3 | P1 | Backend | Không; làm ngay sau xử lý P0 | Ma trận quyền và dữ liệu bất hợp lệ được kiểm chứng |
| 2. Dữ liệu Studio | P1 | Frontend | API outfit hiện tại | Draft, transform, undo/redo, create/update và conflict đúng |
| 3. Contract và build | P1 | Backend + Frontend, commit tách biệt | 1; tích hợp với 2 | Test hiện tại xanh, contract không lệch, build hoàn tất |
| 4. Nền tảng và tích hợp V3 | P2 | Backend trước, Frontend sau | 1–3 | Một garment pilot chạy xuyên suốt |
| 5. Tối ưu có đo lường | P2 | Theo khu vực sở hữu | Baseline đúng từ 2–4 | Có số đo trước/sau, không giảm độ đúng |
| 6. AI generation thật | Đợt riêng | Backend + Frontend + review dữ liệu | 3–5 và provider được nghiệm thu | Ảnh thật, media thật, trạng thái và nguồn kiểm chứng rõ ràng |

Không ước lượng tiến độ bằng số dòng code. Chốt thời lượng triển khai sau khi xử lý phạm vi rò rỉ P0 và xác định nguyên nhân build chưa hoàn tất. Chia mỗi giai đoạn thành các thay đổi nhỏ có thể review và rollback độc lập.

## 4. Giai đoạn 0 — Chặn lộ dữ liệu

### Công việc

- Nếu có deployment chứa file, chặn truy cập đường dẫn ngay và phát hành bản loại bỏ file; kiểm tra cache/CDN và các deployment cũ còn truy cập được.
- Loại `temp_coccoc.db` khỏi `frontend/public` và bản được theo dõi hiện hành. Nếu cần giữ bằng chứng, đặt bản bảo quản ngoài Git và ngoài mọi thư mục được phục vụ web, với quyền truy cập hạn chế.
- Rà tài nguyên tracked và artifact phát hành để tìm database, backup, log và dữ liệu cá nhân tương tự. Chỉ báo đường dẫn/loại dữ liệu, không trích xuất nội dung cá nhân.
- Bổ sung quy tắc ignore và kiểm tra CI để ngăn database/backup ngoài danh sách ngoại lệ được duyệt đi vào `public`. Ignore không thay thế việc gỡ file đã tracked.
- Xác định file từng có trên remote/public deployment hay chưa. Lập danh sách commit/ref bị ảnh hưởng trước khi đề xuất làm sạch lịch sử Git.
- Việc rewrite lịch sử/force-push là thao tác riêng, cần phối hợp người quản lý repo và những người đang có checkout. Không tự động gộp vào bản sửa code thông thường.

### Nghiệm thu

- GET/HEAD không đăng nhập tới đường dẫn cũ trả 404/410 trên từng deployment thuộc phạm vi xử lý, kể cả đường qua CDN.
- File không có trong artifact mới hoặc danh sách tracked hiện hành.
- Có bản ghi phạm vi ảnh hưởng và trạng thái xử lý lịch sử Git; không kết luận dữ liệu chưa từng bị tải chỉ vì thiếu access log.

## 5. Giai đoạn 1 — Quyền và tính toàn vẹn V3

### Backend

- Tái sử dụng dependency JWT/RBAC hiện có cho các endpoint ghi V3. Quy định rõ editor/admin được tạo và chuyển trạng thái nào; guest/user thường không được tạo hay tự publish tri thức.
- Public list/detail/projection chỉ trả entity được publish. Lọc cả quan hệ, thuộc tính/evidence và entity liên quan theo quy tắc công bố; đọc ID trực tiếp không được vượt kiểm tra này.
- Tách quyền đọc bản nháp phục vụ biên tập khỏi API public. Phân biệt enum thiếu dữ liệu (`withheld`) với quyền công bố: không tự tiết lộ giá trị bị giữ lại qua projection.
- Dùng schema có enum/giới hạn đầu vào; trạng thái sai trả 422. Chỉ chuyển lỗi trùng dữ liệu dự kiến thành 409; không trả chuỗi exception nội bộ cho client.
- Nối validator vào đường ghi repository/service, tránh tồn tại một validator chỉ được test riêng. Bổ sung kiểm tra kiểu, enum, cardinality theo context, entity reference và loại endpoint quan hệ.
- Các thao tác ghi nhiều bảng chạy trong transaction; lỗi validation không để lại dữ liệu dở dang.

### Vị trí chính

`backend/app/modules/cultural_data_v3/{router.py,schemas.py,repository.py,domain/validators.py}` và dependency bảo mật hiện có.

### Nghiệm thu

- Guest ghi: 401; user thường ghi: 403; editor/admin theo đúng quyền đã định nghĩa.
- Guest không đọc được draft/deprecated, kể cả dữ liệu lồng nhau hoặc projection generation.
- Enum/type/reference sai bị từ chối, không ghi DB; dữ liệu hợp lệ vẫn được lưu.
- Test quyền V1 vẫn pass. Test bảo mật dùng DB tạm, không gọi provider thật.

## 6. Giai đoạn 2 — Bảo toàn dữ liệu Studio

### 2A. Một nguồn state cho tài liệu bộ phối

- Tận dụng `frontend/src/features/studio/state.ts`: reducer history, `parseDraft`, `outfitId` và `revision`; nối vào trang Studio thay vì viết thêm một state song song.
- Tài liệu bộ phối chứa title và snapshot đầy đủ: items, transform, avatar/pose, occasion, style, overlap, locked slots, background và aspect ratio.
- State UI như tab mở, hover và loading tách khỏi tài liệu lưu và history.

### 2B. Khôi phục và lưu draft

- Có trạng thái `hydrated`; đọc/validate draft trước khi cho phép autosave. Giữ key `viet_stylist_current_draft` và khả năng đọc draft cũ.
- Chấp nhận outfit rỗng hợp lệ; không yêu cầu phải có item mới cho khôi phục.
- Khi có outfit từ URL và draft chưa lưu, xác định ID/owner/revision trước khi chọn nguồn; không để response tải muộn đè thao tác mới.
- Guest đăng nhập tiếp tục được draft. Draft của tài khoản đã đăng nhập phải được phân vùng hoặc kiểm tra owner trước khi khôi phục dưới tài khoản khác.
- Lỗi 401, 409, timeout hoặc quota localStorage không được xóa nội dung hiện tại; hiển thị trạng thái lưu đúng thực tế.

### 2C. Transform và undo/redo

- Canvas đọc transform từ snapshot. Trong lúc drag có thể giữ preview tạm để hiển thị mượt; kết thúc gesture commit một thay đổi vào document/history.
- Kéo, xoay, scale, đổi màu, style và background đều có undo/redo; thao tác mới sau undo phải bỏ nhánh redo.
- Export dùng cùng snapshot với preview; mở lại outfit phải ra cùng bố cục.

### 2D. Create/update và cạnh tranh ghi

- Chưa có ID: POST tạo outfit, giữ ID/revision từ response. Đã có ID: PUT kèm revision hiện tại.
- Chặn double-submit. Nếu người dùng tiếp tục chỉnh trong lúc request lưu đang chạy, response chỉ xác nhận snapshot đã gửi, không thay thế bản đang chỉnh mới hơn.
- 409: giữ bản local, cho tải bản server hoặc lưu thành outfit mới; không tự tăng revision để ghi đè.
- Timeout sau POST không tự retry tạo mới. Nếu cần bảo đảm retry an toàn, triển khai idempotency có contract Backend trước.

### Nghiệm thu

- Hai test Playwright đang fail phải pass qua luồng UI thật.
- Refresh giữ draft đầy đủ; kéo → undo → redo → save → reload giữ đúng transform.
- Lưu hai lần cho cùng outfit tạo một POST và một PUT; revision tăng theo server.
- Hai tab sửa cùng outfit: bản cũ nhận 409, nội dung chưa lưu còn nguyên.
- Logout/đổi tài khoản không tự đưa draft/tài nguyên riêng của người trước vào tài khoản mới.
- Mock hỗ trợ test hành vi, nhưng cần thêm smoke chạy với backend thật cho login → save → reopen.

## 7. Giai đoạn 3 — Contract, test và build

### Generation contract

- Chốt scope đợt sửa: triển khai grounding và prompt từ dữ liệu hợp lệ; synthesize khi chưa có provider đã nghiệm thu trả lỗi 503 có mã rõ ràng.
- Không đưa mock fallback vào đường chạy production để trả `completed`. Mock chỉ dùng khi cấu hình kiểm thử rõ ràng.
- Backend sinh lại `shared/openapi.json` từ runtime; không sửa tay contract để khớp mock frontend.
- Test synthesize chưa bật phải kiểm tra unavailable. Khi triển khai provider thật, thêm test success với media có thật trong kho kiểm thử, không chỉ sửa kỳ vọng cho test xanh.
- Bổ sung DTO projection ổn định: decode JSON lưu trong DB, tránh để frontend phụ thuộc tên cột như `identity_json`.
- API client giữ `request_id`, phân biệt lỗi 401/409/429/503 và thời gian retry. Timeout theo loại thao tác; không áp một timeout ngắn cho mọi lời gọi AI.

### Build và môi trường kiểm thử

- Tái hiện production build với log, thời gian và môi trường rõ ràng. Kiểm tra truy cập font/dịch vụ ngoài, cấu hình, cache và tài nguyên; chưa coi font là nguyên nhân khi chưa có bằng chứng.
- Nếu tài nguyên mạng là nguyên nhân, làm build có thể tái lập bằng cách quản lý tài nguyên phù hợp; không bỏ typecheck hoặc lint để vượt lỗi.
- Sửa đường dẫn subprocess trong test thành đường dẫn dựa trên vị trí file để chạy được từ root hoặc backend.
- Chuẩn hóa dependency installation theo manifest/constraints hiện có; bổ sung CI cho test, contract và build. Kiểm tra CI không phụ thuộc `.env` cá nhân.

### Nghiệm thu

- Backend suite hiện tại và test mới pass; contract runtime trùng bản export canonical theo môi trường được quy định.
- Frontend typecheck, Playwright và production build đều hoàn tất thành công.
- Smoke bản build: Studio, auth, save/reopen, lookbook và trang share; không chỉ kiểm tra dev server.

## 8. Giai đoạn 4 — Hoàn thiện nền tảng V3

### Dữ liệu và resolver

- Pilot trước với áo ngũ thân đã có seed; đánh dấu rõ dữ liệu demo, chưa tự coi seed là tri thức được thẩm định.
- Resolve variant và kế thừa có quy tắc ưu tiên, phát hiện cycle; giữ provenance của giá trị được chọn.
- Lọc theo context thời kỳ/vùng/dịp; không gom các giá trị trái ngược từ mọi context thành ràng buộc đồng thời.
- Giữ các trạng thái unknown/disputed/inferred/withheld; disputed không trở thành hard constraint và không bị biến thành known chỉ vì có một candidate.
- Đọc renderables, style options và rules từ dữ liệu thật. Không trả mảng rỗng cố định để coi bundle là hoàn chỉnh.
- Nguồn, evidence locator và quyền sử dụng phải đi theo projection cần chúng. Generation chỉ nhận media có quyền dùng cho mục đích tương ứng; `public_excerpt` không tự tương đương quyền đưa vào AI.
- Quy định dataset/ruleset version có thể truy xuất lại nội dung. Chuỗi version hoặc hash đơn thuần không thay thế snapshot dữ liệu có thể tái hiện.

### Frontend

- Backend cung cấp mapping legacy → canonical; loại bỏ việc tự dựng ID không tồn tại ở adapter.
- Kiểm thử chuyển V1 → V2 → V1 giữ items, variants, transform và context; không mất dữ liệu ngoài phạm vi adapter hỗ trợ.
- Gắn Composer vào Studio sau khi contract/bundle ổn định, có cờ bật/tắt để rollback giao diện.
- Badge phản ánh kết quả validation thực. Khi API lỗi/chưa có dữ liệu hiển thị chưa kiểm tra, không hardcode `clear`.
- Citation lấy từ dữ liệu/evidence đã review; không cố định thư mục sách hoặc câu trích cho mọi garment.

### Nghiệm thu

- Một garment pilot có đủ chuỗi: entity → context/variant → evidence → bundle → chọn/sửa/lưu/mở lại.
- Cùng outfit + dataset/ruleset version tái tạo được grounding tương ứng.
- V1 tiếp tục hoạt động khi tắt V3; outfit cũ đọc được.
- Dual-run kiểm tra cả khác biệt chủ ý và regression trên nhiều context, không chỉ đòi mọi luật V3 giống V1.

## 9. Giai đoạn 5 — Tối ưu có đo trước/sau

Các ngưỡng dưới đây là mục tiêu nghiệm thu đề xuất, chưa phải hiệu năng hiện tại. Ghi thiết bị, browser, commit, kích thước dữ liệu, concurrency và trạng thái cache cho mỗi phép đo.

| Khu vực | Cách đo và mục tiêu đề xuất | Hướng tối ưu nếu số đo chứng minh cần |
| --- | --- | --- |
| Canvas | Frame time p95 ≤ 16,7 ms ở màn hình 60 Hz trên thiết bị mục tiêu; đo riêng mobile | Giảm rerender, preview theo animation frame, commit history một lần mỗi gesture |
| Lưu draft | Đếm lần stringify/write; một gesture không sinh hàng trăm lần ghi | Debounce có giới hạn, flush ở ranh giới thao tác/đổi trang phù hợp; test refresh nhanh để tránh mất dữ liệu |
| Cultural check | Kết quả mới nhất luôn thắng; đo số request khi kéo đồ/đổi màu liên tục | Debounce, hủy hoặc bỏ response cũ; chỉ gọi khi đầu vào liên quan thay đổi |
| Catalog/V3 đọc | Ghi p50/p95, SQL count, payload; mục tiêu ban đầu p95 ≤ 300 ms local ở 10 client đồng thời | Batch truy vấn, index theo query plan, pagination, bỏ N+1 |
| Projection cache | Kiểm tra hit/miss và tính đúng khi publish/unpublish | Key có dataset/context/quyền; invalidation rõ ràng; không cache lẫn dữ liệu public và editor |
| Bundle frontend | Đo JS theo route, LCP/INP trên thiết bị/mạng đã chọn | Lazy-load modal/tính năng ít dùng, kích thước ảnh hợp lý, xử lý font theo kết quả build |
| Tác vụ AI | Tách thời gian queue/provider/storage, tỷ lệ lỗi/retry và chi phí | Giới hạn concurrency/quota, timeout và retry có giới hạn; không đổi model trước benchmark |

Mục tiêu trải nghiệm ban đầu: LCP ≤ 2,5 giây, INP ≤ 200 ms ở điều kiện đo đã thống nhất. Đây không phải cam kết production hay kết luận từ một lần chạy Lighthouse. Sau khi có traffic thực, đối chiếu số đo người dùng thực tế.

Không tối ưu bằng cách bỏ validation, giảm kiểm tra quyền, bỏ evidence hoặc thay kết quả thật bằng fallback không ghi rõ nguồn. Mỗi thay đổi hiệu năng phải đi kèm số đo và regression test liên quan, không cần lặp toàn bộ soak sau mọi thay đổi nhỏ.

## 10. Giai đoạn 6 — AI generation thật

- Tách thành đợt sau khi phần nền tảng ổn định. Giữ trạng thái unavailable trong sản phẩm cho đến khi đạt nghiệm thu.
- Pipeline: kiểm tra quyền ảnh người dùng → grounding/evidence → chọn reference theo quyền → prompt → job/provider → kiểm tra ảnh → lưu media → kết quả.
- Provider thành công phải có ảnh decode được và media record có thật; HTTP 200 hoặc text advice không đồng nghĩa ảnh đã tạo. Trước khi ghi trạng thái thành công, dùng contract kiểm tra `completed`, `result_media_id`, media `ready` kiểu image, MIME `image/*` và probe giải mã.
- Job có idempotency theo owner và input/version/options; trạng thái retry, timeout, thất bại và hết hạn rõ ràng. Không log API key hoặc URL ký còn hiệu lực.
- Hậu kiểm tách kiểm tra kỹ thuật khỏi đánh giá văn hóa. Nếu chưa có bộ đánh giá đáng tin cậy, trả `not_evaluated` hoặc `needs_review`, không suy ra compliant từ trạng thái job.
- Benchmark bằng bộ ảnh Việt phục cố định và rubric về cổ, khuy, tay, tà, lớp áo, hoa văn, bố cục; có review người, thống kê lỗi/latency/chi phí. Test mock không chứng minh chất lượng ảnh.
- Tất cả lỗi AI phải giữ nguyên outfit và ảnh đầu vào theo chính sách lưu trữ đã định nghĩa.

## 11. Cách triển khai và điều kiện phát hành

- Trước khi sửa, lập danh sách thay đổi V3 đang có trong working tree, không reset hoặc ghi đè. Tách nền thay đổi sẵn có khỏi từng đợt remediation.
- Backend và Frontend có branch/commit riêng theo `rule.md`; Backend bàn giao contract trước phần tích hợp FE. File dùng chung thực hiện đúng quy ước phối hợp hiện có.
- Mỗi đợt bàn giao gồm vấn đề, thay đổi, test đã chạy, phần chưa xác minh và cách rollback. Không cộng việc CI pass thành bằng chứng chất lượng AI hoặc vận hành production.
- Giai đoạn 0–3 là điều kiện bắt buộc trước khi cân nhắc phát hành bản sửa ổn định. V3 chỉ bật sau giai đoạn 4; AI ảnh chỉ bật sau giai đoạn 6.
- Trước deployment: backup theo phạm vi DB/media, kiểm tra migration trên bản sao, `/ready`, CORS, quyền media và luồng đăng nhập thật trong staging. Hoàn thành artifact và bằng chứng trước bước quyết định phát hành.

### Checklist kết thúc đợt sửa nền tảng

- [ ] File lịch sử không còn được phục vụ; phạm vi lịch sử Git/deployment đã được đánh giá.
- [ ] API V3 có RBAC và lọc publication, kể cả dữ liệu lồng nhau.
- [ ] Repository thực thi validation; lỗi không tạo dữ liệu dở dang.
- [ ] Draft/transform/undo/redo giữ đúng qua refresh và mở lại.
- [ ] Save đúng POST/PUT/revision; 401/409/timeout không làm mất nội dung.
- [ ] OpenAPI đúng runtime; generation chưa bật trả unavailable rõ ràng.
- [ ] Backend tests, frontend typecheck/Playwright/build pass.
- [ ] Smoke frontend với backend thật và bản build thành công.
- [ ] Có báo cáo số đo trước/sau cho thay đổi hiệu năng đã thực hiện.
- [ ] Các giới hạn live provider, chất lượng tri thức và production được ghi riêng.
