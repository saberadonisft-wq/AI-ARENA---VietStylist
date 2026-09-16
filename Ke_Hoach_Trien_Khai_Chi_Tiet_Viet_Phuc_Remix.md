# Kế hoạch sửa lỗi backend, tối ưu và hoàn thiện VietStylist

Ngày cập nhật: **16/09/2026**. Baseline kiểm tra: commit `739a73a`.

**Người thực hiện dự kiến: Gemini 3.8 theo yêu cầu chủ dự án.** Đây là tài liệu bàn giao công việc, không phải yêu cầu đổi model Gemini API trong ứng dụng.

**Trạng thái: CHƯA TRIỂN KHAI.** Lượt này chỉ cập nhật kế hoạch. Chưa sửa backend/frontend, chưa chạy migration trên dữ liệu thật, chưa triển khai production.

Tài liệu này thay thế toàn bộ kế hoạch cũ và chỉ mô tả công việc sửa lỗi, tối ưu, tích hợp và nghiệm thu dựa trên code hiện tại. Các checklist chưa đánh dấu không phải công việc đã hoàn thành.

## A0. Chỉ dẫn bắt buộc cho Gemini khi nhận việc

### A0.1. Mục tiêu và giới hạn

Hoàn thành lần lượt: đóng 11 lỗi đã xác nhận; bổ sung kiểm thử hồi quy; bảo toàn dữ liệu; đồng bộ OpenAPI; tối ưu backend có số đo; bàn giao thay đổi tích hợp cho Frontend. Không xây lại ứng dụng hoặc đổi toàn bộ stack để tránh sửa lỗi.

1. Đọc `rule.md` và `AGENTS.md` nếu có trước khi sửa. Nếu repo có `.codegraph/`, dùng CodeGraph trước để tìm hiểu code; không tự tạo index.
2. Đối chiếu lại branch, HEAD, working tree và các symbol được nêu. Số dòng là mốc review, có thể thay đổi. Nếu code đã sửa, chạy lại tình huống lỗi và ghi bằng chứng thay vì áp dụng bản vá trùng.
3. Backend phụ trách `backend/**`, `supabase/**`, `shared/openapi.json`. Frontend là task riêng; không sửa UI/type/client để che một lỗi backend hoặc làm test pass.
4. Không làm trực tiếp trên `main`. Tạo branch từ điểm tích hợp đã thống nhất; không tự chuyển branch, reset, stash, pull/rebase khi có thay đổi chưa được bảo toàn. Không `git add .`, không force-push, không commit secret/database/media.
5. Người dùng đã yêu cầu cập nhật chính tài liệu này. Với các file chung khác, thực hiện quy trình phối hợp `[LOCK]`/`[UNLOCK]` trong `rule.md`; không coi tài liệu này là quyền sửa tùy ý mọi file gốc.
6. Mỗi task gồm: xác nhận nguyên nhân → test tái hiện trên dữ liệu tạm → sửa tối thiểu đúng thiết kế → test pass → cập nhật contract nếu cần → mô tả thay đổi và giới hạn. Không xóa test bảo mật hoặc bỏ kiểm tra để lấy kết quả xanh.
7. Không đọc/ghi/xóa file thật khi thử path traversal. Chỉ tạo sentinel dưới thư mục tạm riêng và xác nhận đường dẫn nằm trong đó trước khi dọn.
8. Không gọi Google/Gemini/R2 thật trong test mặc định. Không dùng key trong `.env` cho test; cấu hình test và chặn outbound trước khi import app.
9. Không log password, JWT, header Authorization, signed URL, query chứa API key, ảnh cá nhân hoặc email thật trong tài liệu test. Dùng danh tính giả và log định danh request.
10. Không kết luận chất lượng AI hoặc sẵn sàng production chỉ từ pytest. Báo riêng unit/integration, thử trình duyệt, benchmark và thử dịch vụ thật.
11. Dừng triển khai khi người dùng yêu cầu dừng. Khi tiếp tục công việc dài, đọc trạng thái nhiệm vụ, không làm lại hoặc bỏ qua hạng mục chưa hoàn thành.

### A0.2. Hiện trạng đã xác minh

| Thành phần | Hiện trạng ở baseline | Hệ quả cho kế hoạch |
| --- | --- | --- |
| Backend | FastAPI/Pydantic, nhiều module đã có API và test | Sửa trên implementation hiện có |
| Database | `core/database.py` luôn dùng SQLite; URL không phải SQLite hiện rơi về file local | Chưa coi Supabase là runtime đã tích hợp; không đổi URL rồi tuyên bố chuyển DB thành công |
| Auth | Tài khoản local, Google ID token, access token HS256 tự phát hành | Vá auth hiện tại trước; chuyển Supabase Auth là đợt riêng |
| Media | R2 S3 client và fallback local | Hai backend lưu trữ phải có cùng quy tắc quyền và trạng thái |
| AI gợi ý | Gemini text + fallback nội bộ | Cần validate output, quản lý timeout/quota và chứng minh chất lượng riêng |
| AI try-on | API cố ý trả `503 TRY_ON_UNAVAILABLE`; worker đánh dấu failed | Chưa tích hợp, không phải lỗi phải “sửa” thành thành công giả |
| OpenAPI | Contract file lệch runtime | Phải xuất từ app và có kiểm tra drift |
| Kiểm thử | Review trước chạy `python -m pytest`: **27 passed** | Chưa bao phủ các lỗ hổng; tái lập baseline trước khi sửa |
| Frontend | Có gọi lưu outfit, đồng bộ draft, lookbook, auth, heritage | Thay đổi quyền phải có kế hoạch cập nhật client và trải nghiệm đăng nhập |

Mục tiêu kiến trúc dài hạn vẫn là: metadata/dữ liệu hệ thống ở Supabase; ảnh/video ở Cloudflare R2; frontend gọi backend qua REST/OpenAPI. Không lưu binary/base64 ảnh vào Supabase để thay cho R2. Việc vá và tối ưu đợt này không tự động chuyển dữ liệu/tài khoản sang Supabase.

### A0.3. Định nghĩa hoàn thành và thứ tự ưu tiên

- **Mốc M1-BE — ổn định backend:** R01–R11 và O01–O08 hoàn thành, migration/test/contract đầy đủ, có bằng chứng rollback và đo tải.
- **Mốc M1-FE — tích hợp giao diện:** các task FE01–FE05 được Frontend triển khai sau contract, kiểm thử luồng thật. Backend pass không đồng nghĩa mốc này đã xong.
- **Mốc M1 — phát hành tích hợp:** cả M1-BE và M1-FE đạt, các smoke test/staging/rollback ở S9 được nghiệm thu. Nếu chỉ được giao Backend, báo M1-BE hoàn thành và liệt kê handoff, không tự đánh dấu M1 đã xong.
- **Mốc M2 — Supabase:** chỉ triển khai như đợt chuyển đổi riêng theo A8; không chặn việc vá lỗ hổng M1, không đánh dấu hoàn thành khi chưa cutover và đối soát.
- P0: chặn phát hành ngay; P1: phải xử lý trước phát hành; P2: hoàn thiện hành vi/contract. Mọi mức đều cần làm, không bỏ P2 khi kết thúc.

## A1. Danh sách 11 lỗi và bằng chứng baseline

Các tình huống dưới đây đã tái hiện ở lượt review bằng FastAPI TestClient, DB/media tạm. Các thử auth/filesystem được chạy với `ENVIRONMENT=production` trong môi trường tạm; đây không phải kiểm tra hoặc khai thác server production thật.

| ID | Mức | Lỗi | Bằng chứng quan sát | Điểm bắt đầu đọc code |
| --- | --- | --- | --- | --- |
| R01 | P0 | Đọc/ghi vượt thư mục media | Không token; đọc và ghi sentinel bên ngoài media đều `200` | `modules/media/router.py:70–95` |
| R02 | P1 | Tự cấp admin qua email hardcode | DB mới: register user → `/auth/me` → login lại → API admin `200` | `modules/auth/service.py:get_me`, `google_auth` |
| R03 | P1 | Secret rỗng bỏ xác minh JWT | Token ký bằng khóa khác, tự khai admin vẫn gọi API admin `200` | `core/security.py:verify_supabase_jwt`, `core/config.py` |
| R04 | P1 | Không token vượt kiểm tra owner | User B sửa outfit A bị `403`; bỏ token sửa/xóa `200`; media complete/delete tương tự | `outfits/service.py`, `media/service.py` và router |
| R05 | P1 | File private đọc được trực tiếp | `/access` trả `403`, URL `/media/files/...` trả bytes private `200` | `media/router.py:serve_local_file`, `r2/client.py` |
| R06 | P1 | Thiếu schema blog ở DB mới | Lọc `era/category` và POST article đều `500`, thiếu cột SQL | `core/database.py`, `heritage/repository.py`, `scripts/migrate_blog_articles.py` |
| R07 | P1 | Gắn version của người khác vào lookbook | B đưa version của A vào lookbook public, nhận snapshot với `200` | `lookbooks/service.py:create_lookbook`, `update_lookbook` |
| R08 | P1 | Cập nhật lookbook lỗi làm mất entry cũ | PUT version không tồn tại → `500`; đọc lại còn 0 entry | `lookbooks/service.py:update_lookbook`, `lookbooks/repository.py` |
| R09 | P2 | Lộ nội dung draft/unpublished | Item unpublished và bài draft đọc bằng API chi tiết công khai `200` | `catalog/repository.py:get_item_by_id`, `heritage/repository.py:get_article_by_slug_or_id` |
| R10 | P2 | OpenAPI cũ | Thiếu 6 operation, 8 schema thiếu/khác runtime | `shared/openapi.json`, `app/main.py` |
| R11 | P2 | Link share hardcode localhost | Production tạm vẫn sinh `http://localhost:3000/chia-se/...` | `lookbooks/service.py:generate_share_link` |

Đường dẫn module trong bảng tương đối với `backend/app/`, trừ các đường dẫn `backend/scripts`/`shared` được ghi rõ. Bằng chứng ad hoc chưa phải test được commit: S0 phải chuyển thành regression test lặp lại được.

## A2. Thiết kế chung cần thống nhất trước khi sửa

### A2.1. Quyền, khách chưa đăng nhập và dữ liệu cũ

Chọn phương án thực thi M1: **khách phối đồ/xuất ảnh/lưu nháp trong trình duyệt; muốn lưu dữ liệu cá nhân lên server phải đăng nhập**. Không dùng UUID khó đoán làm quyền sở hữu, không tạo một owner dùng chung cho mọi khách.

| Nhóm thao tác | Khách | Chủ sở hữu | Người dùng khác | Admin/editor |
| --- | --- | --- | --- | --- |
| Catalog/heritage published | Đọc | Đọc | Đọc | Đọc; quản trị qua API riêng |
| Studio compare/color/cultural check | Cho phép dữ liệu đầu vào được validate và giới hạn | Cho phép | Cho phép | Cho phép |
| Outfit create/list/get/update/delete | `401` | Cho phép | `404` đối với tài nguyên cá nhân | Không tự có quyền đọc/sửa dữ liệu cá nhân |
| Media uploads/complete/access-private/delete | `401` | Cho phép theo trạng thái | `404` | Không bypass owner mặc định |
| Lookbook private/unlisted qua ID | `401` | Cho phép | `404` | Không bypass owner mặc định |
| Lookbook public | Đọc phần công khai | CRUD của mình | Chỉ đọc | Không bypass quyền ghi |
| `/shares/{token}` hợp lệ | Chỉ đọc projection được chia sẻ | Chỉ đọc | Chỉ đọc | Chỉ đọc |
| AI job status | `401` | Đọc job của mình | `404` | Không mặc định truy cập ảnh riêng tư |
| Solution form GET/PUT | `401` | Dữ liệu của mình | Không được truy cập owner khác | Không có form mặc định toàn cục |

- `401` khi thiếu/sai/hết hạn token ở API cần auth; `403` cho tài khoản đã xác thực nhưng thiếu role của một chức năng; `404` cho tài nguyên cá nhân không thuộc mình hoặc không tồn tại để giảm lộ thông tin.
- Trên API public, không có Authorization vẫn được đọc; đã gửi token sai/hết hạn thì trả `401`, không âm thầm hạ xuống guest. Frontend xử lý token stale bằng luồng đăng nhập lại.
- Request không được quyết định `owner_id`, roles hoặc trạng thái account. Owner lấy từ dependency đã xác thực.
- Outfit/media/job có `owner_id IS NULL`, hoặc solution form `team_default_owner`: lập báo cáo số lượng và cô lập khỏi đường đọc/ghi cá nhân. Không tự chuyển cho người đầu tiên biết ID; không xóa tự động. Dữ liệu được gán lại chỉ qua thao tác quản trị có căn cứ và audit.
- Share/public lookbook cũ tham chiếu dữ liệu owner khác: rà soát, tạm chặn phần tham chiếu sai trước khi tiếp tục phát hành; giữ nguyên dữ liệu để đối soát.
- Guest server persistence chỉ được bổ sung về sau nếu thiết kế đầy đủ session/capability độc lập và luồng claim; không dùng `owner_id=None` để giữ tương thích.

### A2.2. Thống nhất trạng thái, lỗi và transaction

- Media tối thiểu: `pending → ready → deleting → deleted`, thêm `rejected/expired` nếu cần. Không trả bytes hoặc cấp access URL cho `pending`, `rejected`, `deleting`.
- Dùng `Literal`/Enum cho visibility (`private`, `unlisted`, `public`), status, role và style mode theo giá trị thực tế. Giá trị không biết phải `422`, không rơi sang nhánh “không private thì public”.
- Một nghiệp vụ nhiều câu SQL dùng **một connection và một transaction**. Repository tham gia transaction không được tự mở connection/commit từng bước.
- Không giữ transaction DB trong lúc chờ Google, Gemini, R2 hoặc người dùng. Media dùng trạng thái bền vững và retry đối soát; không giả lập distributed transaction bằng cách nuốt lỗi.
- Dùng lỗi JSON thống nhất `{error:{code,message,status_code,request_id,details}}`; không trả traceback/SQL/path hệ thống cho client. `409` cho revision conflict/trạng thái không cho phép; `422` cho reference không hợp lệ; `503` cho dependency không sẵn sàng; `413` quá kích thước; `429` vượt hạn mức.
- Share token là quyền đọc có giới hạn: băm token trong DB, URL có TTL, thu hồi được; không ghi token nguyên văn vào log. Signed media URL là credential ngắn hạn, không lưu bền vững vào snapshot hay DB.

### A2.3. Breaking changes và phối hợp

Các thay đổi xác thực của R04/R05, privacy R09, status/error mới, share revoke và cấu hình URL là thay đổi contract/hành vi dù JSON cũ giữ nguyên. Backend phải xuất OpenAPI, nêu payload mẫu và thông báo cho Frontend trước khi tích hợp. Theo `rule.md`, Frontend cập nhật sau commit contract; không merge/deploy một nửa luồng guest-save rồi coi là hoàn thành.

Không đổi token sang cookie/session mới trong bản vá này. Nếu đổi cơ chế lưu token, cần task riêng về CSRF, CORS, SameSite, refresh/logout và tương thích client.

## A3. Runbook sửa từng lỗi

### R01 — Khóa đường đọc/ghi filesystem tùy ý

**File chính:** `backend/app/modules/media/router.py`, `service.py`, `repository.py`, `backend/app/infrastructure/r2/client.py`, `backend/app/core/config.py`.

**Thực hiện:**

1. Thêm `LOCAL_MEDIA_ENABLED` với mặc định tắt ngoài development/test. Không mount local routes ở production. Nếu người vận hành cần production local storage, đó là backend lưu trữ được bảo vệ riêng, không mở lại endpoint debug bằng một cờ chung.
2. Bỏ giao diện upload nhận `bucket/key` tùy ý. `POST /api/media/uploads` tạo pending media cho user; URL local mới chứa `media_id`/upload-session ID và grant ngắn hạn. Server lookup bucket/key đã phát sinh và đối chiếu owner/session; client không chọn đường dẫn.
3. Endpoint legacy `/media/local-upload?key=...&bucket=...` không được tiếp tục ghi tùy ý; trả `410` trong dev sau chuyển đổi hoặc gỡ route. Production không đăng ký route, trả `404`.
4. Dù key đến từ DB, thêm helper dùng chung kiểm tra bucket allowlist, key tương đối, cấm segment `.`/`..`, dấu `\\`, drive Windows, UNC, đường dẫn tuyệt đối, NUL và alternate data stream `:`. Xử lý theo giá trị đã được framework decode; không decode lặp tùy tiện.
5. Resolve base và đích, kiểm tra đích là con thực sự của base bằng thao tác path; không so sánh prefix chuỗi. Kiểm tra symlink/junction của các thư mục cha, không follow đường thoát. Môi trường production tắt local route là lớp bảo vệ chính; không khẳng định resolve đơn lẻ xử lý mọi race symlink.
6. Giới hạn byte khi streaming upload; ghi file tạm trong vùng đích đã kiểm tra, chỉ promote khi kiểm tra xong. Không dùng `await file.read()` không giới hạn cho toàn bộ upload.
7. `verify_object_exists`, `delete_object` và code worker/local-storage cũng đi qua cùng helper; không chỉ vá router mà để đường gọi service còn join path tùy ý.

**Test bắt buộc:** Windows/Linux path; `../`, backslash đã encode, drive/UNC, bucket ngoài allowlist, key tuyệt đối, double encoding, sibling directory cùng prefix, symlink/junction nếu OS hỗ trợ. Chỉ dùng sentinel trong sandbox tạm. Production route phải `404` cả khi R2 có/không có cấu hình. Upload hợp lệ qua grant đúng vẫn thành công; grant hết hạn/sai owner bị chặn.

**Nghiệm thu:** không có thao tác nào ghi/đọc/xóa ngoài storage root; không nhận key tùy ý từ request; có kiểm thử giới hạn upload và cleanup file tạm khi thất bại.

### R02 — Loại bỏ tự cấp admin và kiểm soát role

**File chính:** `modules/auth/service.py`, `schemas.py`, `core/security.py`; script mới dự kiến `backend/scripts/manage_roles.py`.

1. Xóa mọi nhánh cấp role dựa vào email hardcode trong cả `get_me()` và `google_auth()`. GET `/auth/me` chỉ đọc, không có side effect cấp quyền.
2. Đăng ký chỉ nhận các role tự đăng ký đã được sản phẩm cho phép (`user`, `stylist` hiện có). Không cho request tự đặt `admin`/`editor`; tiếp tục kiểm tra enum. Quyền stylist tự đăng ký không đồng nghĩa có quyền duyệt bài.
3. Cấp/thu hồi admin bằng script quản trị được chạy bởi người vận hành: account ID đã tồn tại, dry-run, audit người thực hiện/thời gian/role thay đổi, transaction. Không bootstrap theo email, không chứa password mặc định, không tự chạy lúc startup.
4. Quyền đặc biệt phải đọc từ `user_roles`/nguồn server đáng tin ở request hiện tại hoặc cache có invalidation/version. Không để JWT cũ giữ quyền admin sau khi DB đã thu hồi. Chọn DB lookup cho M1 trước khi tối ưu cache.
5. Với Google, missing `GOOGLE_CLIENT_ID` trả `503`; bỏ fallback OAuth client ID hardcode. Validate signature, issuer, audience, expiry, email verification; cache JWKS có TTL, refresh có giới hạn khi gặp `kid` mới. Không liên kết account chỉ vì email tự khai trong request.
6. Kiểm tra tài khoản active và tồn tại trước khi trả user, kể cả token hợp lệ về chữ ký. Không dùng tài khoản giả từ JWT như một account đã được provision.

**Test:** đăng ký với email giả bất kỳ không bao giờ có admin sau `/me` hoặc login lại; GET `/me` không INSERT role; role request `admin/editor` bị `422`; Google không có client ID `503`; credential sai `401`; account inactive/deleted `401`; token trước khi thu hồi admin gọi API admin phải `403` sau thu hồi.

**Dữ liệu cũ:** xuất danh sách account đã có role đặc quyền để người sở hữu đối soát; không xóa hàng loạt admin hợp lệ vì không biết nguồn cấp quyền. Có quy trình thu hồi role và token bị ảnh hưởng mà không ghi danh tính thật vào repo.

### R03 — JWT luôn xác minh và cấu hình phải fail closed

**File chính:** `core/config.py`, `core/security.py`, `main.py`, `modules/auth/service.py`, `backend/.env.example`.

1. Bỏ `verify_signature=bool(secret)`. Signature luôn phải verify; chỉ cho algorithm allowlist cố định của chế độ auth đang chạy.
2. Thêm chế độ auth rõ ràng. M1 giữ token local HS256, dùng signing secret riêng của ứng dụng (ví dụ `JWT_SIGNING_SECRET`), không mặc định coi secret đó là khóa Supabase. Cho phép alias biến cũ trong giai đoạn chuyển đổi có cảnh báo đã che giá trị; production không chấp nhận giá trị rỗng/placeholder/yếu.
3. Thêm issuer/audience ổn định cho token ứng dụng; ký và verify nhất quán, bắt buộc `sub`, `iat`, `exp`, `iss`, `aud`. Validate loại của claim và `sub` không rỗng; giới hạn clock skew có cấu hình nhỏ, không bỏ expiry.
4. Config sai phải ngăn startup/readiness trước khi mở API auth. Không sinh secret ngẫu nhiên mỗi worker trong production. Test dùng secret giả cùng fixture, không dùng key thật.
5. Bỏ dev token suy luận role theo chuỗi chứa `admin`, hoặc chỉ giữ trong test dependency override không có đường truy cập mạng production. Test nghiệp vụ dùng account/token thật của fixture.
6. Cập nhật `get_current_user_optional`: token được cung cấp nhưng không hợp lệ → `401`; không token → guest cho đúng API public. User cần tồn tại/active theo R02.
7. Không ghép verifier Supabase vào local HS256 theo kiểu “thử tất cả”. Khi M2 chuyển Supabase, dùng verifier riêng theo issuer/JWKS và chính sách key của provider.

**Test:** secret rỗng/placeholder production không khởi động; chữ ký khác, `alg=none`, algorithm không cho phép, thiếu/expired exp, sai iss/aud, sub không đúng kiểu đều bị từ chối; không token vẫn đọc public; account bị vô hiệu hóa không còn gọi API riêng tư. Đổi secret/issuer làm token cũ mất hiệu lực phải được ghi như yêu cầu đăng nhập lại trong release note.

### R04 — Sửa toàn bộ đường vượt owner khi bỏ token

**File chính:** router/service/repository của `outfits`, `media`, `try_on`, `solution_forms`; `core/security.py`.

1. Dùng `require_current_user` cho thao tác server cá nhân theo A2. Không vá riêng biểu thức `if` rồi để GET outfit vẫn public.
2. Repository hỗ trợ truy vấn theo `(resource_id, owner_id)` ngay từ đầu. Service không trả dữ liệu cá nhân trước khi kiểm tra owner. Mutation dùng owner trong WHERE và kiểm tra rowcount.
3. Thay kiểm tra `if user_id and owner_id ...` bằng policy rõ ràng. Không dùng admin bypass cho media cá nhân trừ khi có task hỗ trợ riêng và audit.
4. Bảo vệ GET/PUT/DELETE outfit, complete/delete/access media, GET job, solution form. Xóa fallback `team_default_owner` khỏi request chưa đăng nhập.
5. Giữ `compare`, color và cultural-check public theo dữ liệu đầu vào, không cho client gắn ID rồi đọc dữ liệu riêng tư qua đường phụ.
6. DELETE đã xác thực với ID không thuộc user trả `404`. Khi resource của user đã được xóa, dùng tombstone để xử lý idempotency nếu cần; không coi không token là thành công.
7. Guest draft cũ xử lý theo A2; phối hợp FE01 để lưu local và đồng bộ sau login. Không cấp quyền claim cho người biết ID cũ.

**Ma trận test cho từng operation:** thiếu token, token hỏng, owner A, user B, account disabled, owner NULL, ID không tồn tại. So sánh DB/storage trước và sau request bị từ chối để chứng minh không có side effect. Test các route liên quan chứ không chỉ gọi trực tiếp service.

### R05 — Bảo vệ file private và vòng đời media

**File chính:** `media/*`, `infrastructure/r2/client.py`, `core/config.py`; migration metadata nếu bổ sung grant/state.

1. Dỡ raw file endpoint đọc mọi bucket/key. Trong local mode, public route chỉ đọc asset `ready/public` tra từ DB; private/unlisted đi qua access grant có TTL được cấp sau kiểm tra quyền.
2. Để `<img>` có thể tải file mà không cần Authorization header, `/media/{id}/access` trả URL chứa grant ký ngắn hạn ràng buộc media ID, purpose=read, expiry; endpoint đọc verify grant và trạng thái hiện hành. Không lấy đường dẫn từ grant/request.
3. Với R2, public bucket chỉ chứa asset public đã được duyệt/promote; private bucket không mở public domain. Private/unlisted dùng presigned GET sau policy. TTL đề xuất 5 phút; backend có thể trả `expires_in` thực tế thay vì hardcode 3600.
4. Presigned URL R2 có thể dùng lại cho tới khi hết hạn: không coi nó là link dùng một lần. Upload vào key staging private; complete validate rồi copy/promote sang final key khác. Không cấp PUT vào final key để URL upload cũ ghi đè ảnh đã ready. Thiết kế này dựa trên [tài liệu presigned URL R2](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
5. Complete kiểm tra object thuộc session, còn hạn, kích thước thực, MIME và nội dung phù hợp. Không tin extension, MIME client, width/height client hoặc riêng HEAD. Giới hạn gợi ý khởi đầu: ảnh 10 MiB, video 50 MiB, trần pixel ảnh 40 MP; tất cả là cấu hình và phải công bố qua contract.
6. Ảnh cá nhân chỉ nhận loại raster được xác minh; SVG/video public của catalog đi qua quyền editor/admin và quy trình validate riêng. Không phục vụ SVG tùy ý cùng origin API; nếu cần SVG, sanitize bằng thư viện được đánh giá và test nội dung chủ động. Bảo vệ giải mã ảnh trước decompression bomb.
7. Public upload không được tự động làm ảnh cá nhân công khai: server enforce private cho luồng ảnh người dùng; asset public do role phù hợp hoặc luồng xuất bản riêng có consent. `unlisted` không đồng nghĩa public-by-ID.
8. Complete retry không tạo asset trùng/đổi final key tùy ý. Với lỗi promote sau copy hoặc trước commit, lưu trạng thái đủ để reconciler tiếp tục/cleanup mà không publish object chưa hợp lệ.
9. Delete: đánh dấu deleting làm mất khả năng cấp grant mới; gọi R2 delete; thành công mới hoàn tất metadata/tombstone. Lỗi storage không được xóa mất reference. Retry an toàn, object đã vắng là idempotent success.
10. Signed GET R2 đã phát hành có thể còn hiệu lực tới TTL; ghi rõ giới hạn thu hồi này. Không cache response private ở CDN public, không đưa signed URL vào log/snapshot/share response bền vững.

**Hai điểm triển khai không được bỏ qua:**

- Giữa validate và promote, người giữ presigned PUT có thể ghi đè staging. Final object phải chứa đúng bytes đã validate: dùng copy có điều kiện version/ETag nếu R2 hỗ trợ semantics cần thiết và kiểm thử được; nếu không, tải có giới hạn, validate rồi upload chính bytes đó bằng credential server sang final key. Không chỉ HEAD rồi copy key sau đó. ETag không mặc định là MD5 nội dung cho mọi kiểu upload.
- Upload/read grant có purpose riêng, expiry, media/session ID và key rotation strategy; không dùng access JWT của người dùng làm URL grant. Che query chứa grant trong access log/proxy. Grant upload dùng một lần phải được consume bằng thao tác atomic; R2 presigned PUT được quản lý bằng staging bất biến với final theo cơ chế trên, không gọi đó là single-use.

**Test:** GET raw private luôn bị chặn; public ready đọc được; pending không đọc; grant giả/hết hạn/sai purpose bị từ chối; B không lấy grant của A; signature đổi path bị từ chối; HEAD khác MIME/size, oversized/chunked, ảnh hỏng bị chặn; URL PUT cũ không sửa final object; delete storage lỗi giữ reference; complete/delete lặp không tạo dữ liệu mồ côi. Test R2 bằng fake/stub; kiểm tra CORS thật là bước tích hợp riêng.

### R06 — Migration blog lặp lại được, không phụ thuộc máy đã sửa tay

**File chính:** `core/database.py`, `heritage/repository.py`, `backend/scripts/migrate_blog_articles.py`, migration SQLite mới và `supabase/migrations/**`.

1. Tách schema/migration khỏi seed nội dung. Bổ sung migration có version/checksum và bảng theo dõi (ví dụ `schema_migrations`). Local/test có thể auto migrate theo cờ; production chạy bước migration riêng trước startup. Startup kiểm tra schema và báo thiếu version, không chạy DDL song song ở mọi worker.
2. Thêm đủ cột blog: `author_id`, `author_name`, `author_role`, `cover_image_url`, `category`, `era`, `related_garment_id`, `read_time_minutes`, `likes_count`; kiểu/default khớp schema và semantics. Không bịa tác giả hoặc trạng thái duyệt cho bài cũ; nullable khi chưa biết.
3. Fresh install và upgrade DB cũ phải đi đến cùng schema. Không sửa duy nhất chuỗi CREATE TABLE vì DB tồn tại sẽ bỏ qua.
4. DB từng chạy script thủ công có một phần/đủ cột: inspect cấu trúc, chỉ thêm phần thiếu, verify kiểu/constraint; không INSERT OR REPLACE bài thật. Script seed blog chuyển thành lệnh demo rõ ràng, không chạy tự động production.
5. Nếu seed lỗi: ghi statement ID/loại lỗi đã che dữ liệu, rollback hoặc fail thao tác có kiểm soát. Bỏ nuốt toàn bộ exception `except: pass` trong seed. Không dùng `COUNT(heritage_articles)==0` làm phiên bản seed của toàn hệ thống.
6. SQL PostgreSQL ở Supabase nhận migration tương ứng độc lập; chưa chạy trên Supabase thật ở M1. Không “dịch SQL” bằng thay TRUE/FALSE trên toàn nội dung vì có thể sửa cả literal text.
7. Trước upgrade dữ liệu thật, dùng SQLite backup API hoặc dừng writer và backup nhất quán cả trạng thái WAL; không chỉ copy file `.db` đang có transaction rồi cho là backup đầy đủ.

**Test:** DB trống; DB schema cũ có bài thật; DB migrate thủ công một phần; chạy migration 2 lần; lỗi giữa chừng; chạy lại sau lỗi; preserves row count/content/source links. `GET articles?era=...`, `?category=...`, POST hợp lệ trả đúng status, không còn `OperationalError`. Seed lỗi làm test fail rõ ràng.

### R07 — Lookbook chỉ tham chiếu version được phép sở hữu

**File chính:** `lookbooks/service.py`, `repository.py`, `outfits/repository.py`.

1. Batch lấy mọi `outfit_version_id` trong request, join outfits và kiểm tra owner hiện tại, `is_deleted=0`, version tồn tại. Không gọi một query cho mỗi entry.
2. Phải validate cả create và update, cả public/private/unlisted; validate lại trong transaction ghi để tránh race với delete.
3. Version user khác và version không tồn tại trả cùng lỗi `422 INVALID_OUTFIT_VERSION` không tiết lộ owner. Request bị từ chối không tạo lookbook rỗng hoặc thay entries cũ.
4. Không cho tham chiếu outfit của người khác chỉ vì đã xem được share/public. Chức năng sao chép nếu cần phải tạo snapshot mới thuộc user, giữ attribution thích hợp; không tự bổ sung như đường bypass.
5. Định nghĩa public/share projection rõ: chỉ trả snapshot phục vụ trình bày, tiêu đề, preview công khai đã kiểm tra. Không lộ account email, private object key, grant quản trị hoặc ảnh cá nhân chưa được đồng ý công khai.
6. Rà dữ liệu lookbook cũ có reference sai owner; cô lập các entry đó khỏi public/share và báo cáo đối soát. Không tự hợp thức hóa bằng đổi owner.

**Test:** A/B, version đã xóa, version giả, mix 1 hợp lệ + 1 sai, sửa public/unlisted, race delete. Payload lỗi không thay đổi DB. Snapshot người khác không xuất hiện qua create response, GET lookbook hoặc `/shares`.

### R08 — Transaction lookbook không làm mất dữ liệu khi có lỗi

**File chính:** `lookbooks/repository.py`, `service.py`, `core/database.py`; liên quan O01/O03.

1. Tạo repository operation `create_with_entries` và `update_with_entries` (tên có thể thay nhưng semantics phải giữ) nhận một connection/transaction.
2. Trong transaction: kiểm tra owner + version references → cập nhật metadata → thay entries nếu request gửi entries → commit một lần. Exception rollback toàn bộ, gồm title/visibility/cover và entries.
3. `entries` bị bỏ qua nghĩa là giữ nguyên; `entries=[]` nghĩa là xóa có chủ đích. Không biến `null` thành xóa mà không quy định contract.
4. Dùng executemany/bulk insert. Map FK violation/reference lỗi sang `422`, conflict cập nhật sang `409`; unexpected DB error log request ID và trả lỗi chuẩn, không biến mọi lỗi thành `200`.
5. Lookbook create cũng atomic: không để row mồ côi nếu entry thứ hai lỗi. Không transaction lồng ngầm bằng các helper tự mở connection.
6. Nếu bổ sung revision cho lookbook, phải có migration và contract/FE tương ứng. M1 tối thiểu bảo đảm atomicity; không mô tả nó như optimistic concurrency khi chưa có expected revision.

**Test:** lấy snapshot DB trước PUT, chèn lỗi ở metadata/entry thứ nhất/entry thứ hai/commit boundary phù hợp; sau lỗi title, visibility, entries, sort_order phải bằng trước. DELETE entries=[] hợp lệ vẫn chạy. Create lỗi không có lookbook mới. Dùng failure injection có chủ đích, không chỉ test HTTP status.

### R09 — Phân tách dữ liệu published và dữ liệu nội bộ

**File chính:** `catalog/repository.py`, `service.py`, `heritage/repository.py`, `service.py`; đường đọc từ recommendations/color/cultural/starter/share.

1. Có hàm public riêng truy vấn `is_published=1` hoặc `status='published'`. Không thay mọi internal lookup thành public vì tác giả/admin vẫn cần quản trị và version cũ có thể phải đọc lịch sử.
2. Public detail của draft/unpublished/missing trả cùng `404`. Admin preview dùng endpoint/dependency riêng; không bật bằng `?include_private=true` không auth.
3. Áp dụng policy cho nested data và đường phụ: variants, layers, nguồn gợi ý màu, starter outfit, kết quả recommendations, share projection. Không chỉ sửa 2 endpoint chi tiết.
4. Xác định chính sách lịch sử outfit chứa món đã unpublish: owner vẫn đọc snapshot của mình để phục hồi; public renderer chỉ phát hành thông tin/media được phép. Không âm thầm xóa snapshot lịch sử.
5. Với M1, giữ quy tắc quyền tạo/publish sản phẩm đang có để tránh mở rộng workflow ngoài bản vá; không tự chuyển toàn bộ bài của stylist sang draft. Sửa chắc chắn việc đọc public chỉ thấy bài đã published. Nếu chủ dự án giao thêm bước kiểm duyệt, tách task mới: stylist tạo draft/submitted, editor/admin publish, có endpoint/schema/reviewer audit và FE riêng. Đây không phải điều kiện đóng R09 và không được ghi bài đã được chuyên gia thẩm định chỉ vì status là published.
6. Cache public theo trạng thái/nội dung, invalidate khi publish/unpublish/update. Không chia sẻ cache draft hoặc signed media giữa các user.

**Test:** public list/detail không có draft; admin preview đúng role; unpublished variant không lọt qua color/recommendation/starter; cache sau unpublish không trả bản cũ; owner snapshot lịch sử vẫn đọc được theo policy đã chọn.

### R10 — OpenAPI được sinh tự động và kiểm tra drift

**File chính:** `app/main.py`, schemas/router thay đổi, `shared/openapi.json`; script mới dự kiến `backend/scripts/export_openapi.py`; test mới `backend/tests/test_openapi_contract.py`.

1. Đưa settings/app creation về cách khởi tạo không chạm DB thật, không tạo storage thật hoặc kết nối mạng khi export schema. Có app factory là phương án ưu tiên nếu singleton hiện tại cản trở test/config.
2. Script export gọi `app.openapi()` với cấu hình export/test rõ ràng, serialize UTF-8 deterministic và newline thống nhất. Không sửa JSON bằng tay để khớp mock.
3. Bổ sung 6 operation thiếu: POST register/login/google, GET me, POST heritage articles, DELETE heritage article. Đồng bộ 8 schema baseline thiếu/khác: `AuthResponse`, `CreateStoryRequest`, `GoogleAuthRequest`, `HeritageArticleDetailResponse`, `HeritageArticleSummaryResponse`, `LoginRequest`, `RegisterRequest`, `UserResponse`.
4. Sau mỗi task còn cập nhật security scheme Bearer, trường required/nullable, enums, query params, response và mã lỗi thực tế. Không chỉ so sánh tên path. Các endpoint lỗi có schema error envelope phù hợp runtime; FastAPI mặc định `422` cũng cần khớp handler tùy biến.
5. Test drift so sánh object schema đã chuẩn hóa với file trong repo, fail nếu khác. Test API thực tế validate theo contract cho luồng thành công và lỗi trọng yếu.
6. Nếu local routes phụ thuộc môi trường, chọn canonical export **production** làm `shared/openapi.json`; schema dev/local export riêng khi cần, không để máy người export quyết định contract công khai. Document rằng local upload là dev-only.
7. Tạo tài liệu handoff trong `backend/docs/` gồm endpoint trước/sau, payload ví dụ giả, breaking changes, commit contract. Không cho frontend sửa shared file.

**Nghiệm thu:** export hai lần ra JSON tương đương; CI/test drift xanh; không cần `.env`/DB/media thật để export; mọi security/error/operation của public production API hiện diện.

### R11 — Share URL theo môi trường và có vòng đời rõ ràng

**File chính:** `core/config.py`, `lookbooks/service.py`, `router.py`, `schemas.py`, `repository.py`, `backend/.env.example`.

1. Thêm `FRONTEND_PUBLIC_ORIGIN` bắt buộc production, chỉ scheme http/https hợp lệ; production yêu cầu https, không userinfo/query/fragment. Dev cho localhost rõ ràng. Ghép `/chia-se/{token}` một lần, xử lý dấu `/` cuối.
2. Không suy ra origin từ `Host`, `Origin` hoặc `X-Forwarded-Host` không được tin cậy. Origin được quản trị cấu hình cố định.
3. Validate `expires_in_days` trong khoảng 1–30 cho M1; không dùng `req.expires_in_days or 30` để âm thầm biến 0 thành 30. Nếu cần link vô thời hạn, phải mở rộng contract rõ, không lén dùng 0/null.
4. Quy định UTC aware cho expiry. Chuỗi thời gian cũ thiếu timezone được migration chuẩn hóa theo quy ước dữ liệu cũ đã xác minh; không để TypeError làm `500`.
5. Endpoint revoke đề xuất `DELETE /api/lookbooks/{lookbook_id}/shares`, chỉ owner, thu hồi mọi link active của lookbook; trả JSON theo client hiện tại. URL đã revoke/missing `404`, expired `410`. Không bắt buộc thêm share ID vào response cũ chỉ để triển khai revoke-all.
6. Lookbook private/unlisted chỉ đọc qua token hoặc owner. ID thường của unlisted không phải share token. Xóa lookbook hoặc thu hồi link phải làm public token mất hiệu lực; không lộ private media qua share như R07.

**Test:** origin production/dev/trailing slash; thiếu origin production fail cấu hình; request host giả không đổi link; expiry -1/0/31 sai `422`; hết hạn `410`; revoke đúng owner; token cũ `404`; B không revoke link A.

## A4. Tối ưu hệ thống dựa trên code và số đo

Các O-task là công việc tăng độ bền/hiệu năng phát hiện khi đọc code, không phải tất cả đã được benchmark hay chứng minh gây lỗi production. Phải đo baseline và ghi kết quả thực tế; không đưa tuyên bố “nhanh gấp X” vào báo cáo nếu chưa đo.

### O01 — Vòng đời connection, transaction và truy vấn SQLite

**Bằng chứng code:** các hàm `Database.fetch_one/fetch_all/execute/execute_many` dùng `with get_db_connection() as conn` nhưng không `close()` tường minh; catalog tải variants/layers từng item; lookbook tải entries từng lookbook; recommendations tra variants từng item. Python xác nhận context manager của connection xử lý transaction, không tự đóng connection: [sqlite3 documentation](https://docs.python.org/3/library/sqlite3.html#how-to-use-the-connection-context-manager).

**Thực hiện:**

- Tạo context manager kết hợp close và transaction; định nghĩa API nhận connection khi cần atomicity. Test đo số connection đang mở về 0 sau request/exception; không phụ thuộc garbage collection.
- Giữ transaction ngắn. Cấu hình busy timeout có giới hạn và mapping lỗi lock; không retry vô hạn. WAL thiết lập ở bước bootstrap phù hợp, không thay journal mode tùy tiện mỗi query. Không chia sẻ một connection global giữa request/thread.
- Batch catalog: tối đa 1 query item + 1 variants + 1 layers cho một trang, độc lập số item trong trang. Lookbook list: 1 query lookbook + 1 query entries cho toàn trang. Batch variants cho recommendations.
- Dùng parameter binding cho danh sách IN, chia batch khi đạt giới hạn driver; không nối trực tiếp ID vào SQL.
- Thêm index theo EXPLAIN QUERY PLAN và data size: outfits `(owner_id,is_deleted,updated_at)`, media `(owner_id,status)`, lookbooks `(owner_id,updated_at)`, entries `(lookbook_id,sort_order)`, variants `(item_id,is_default)`, layers `(item_id,z_index)`, articles `(status,era,category)` hoặc index tách nếu query plan chứng minh cần. Giữ unique index sẵn có; không thêm trùng.
- Pagination bounded cho danh sách lớn; order ổn định có ID tie-break. Không trả tất cả outfit/lookbook vô hạn. Nếu đổi response list thành envelope/page cursor, phải là contract task có FE; có thể giữ list + limit/offset ở M1 để giảm breaking.
- Đo bộ nhớ trước khi thay `PRAGMA cache_size=-64000`; không hiểu 64 MiB cache mỗi connection là bộ nhớ đã cấp ngay, nhưng phải đánh giá tổng chi phí khi nhiều connection.

**Nghiệm thu:** query count không tăng tuyến tính theo N cho hai màn hình chính; kết quả JSON/order không đổi ngoài contract được công bố; không leak connection; benchmark đọc/ghi và lock có báo cáo.

### O02 — Tránh chặn event loop và dùng lại HTTP client

**Bằng chứng code:** nhiều route `async def` gọi sqlite3/boto3/PBKDF2 sync; WeatherService và GeminiClient tạo `httpx.AsyncClient` mỗi lần. FastAPI chỉ tự đẩy path operation/dependency `def` vào threadpool; gọi helper sync bên trong `async def` không tự offload: [FastAPI async](https://fastapi.tiangolo.com/async/).

- Route hoàn toàn sync DB/CPU có thể chuyển sang `def`. Với route có HTTP await, offload cả đoạn nghiệp vụ sync bằng cơ chế threadpool có giới hạn. Không mang một connection qua nhiều thread trong cùng transaction.
- PBKDF2 login/register và boto3 phải có giới hạn đồng thời; không tăng thread vô hạn để che bottleneck. Không thay hàm hash hoặc giảm số rounds nhằm làm benchmark đẹp. Nếu nâng thuật toán hash, cần version hash và rehash-on-login riêng.
- Tạo HTTP client trong lifespan, reuse connection pool, đóng lúc shutdown. Tách timeout connect/read/pool, concurrency budget theo dependency; test inject transport/client, không monkeypatch global httpx bất chấp mọi kwargs.
- Retry có backoff/jitter và tổng deadline; chỉ retry lỗi tạm thời có semantics an toàn. Không retry tùy tiện tác vụ có thể tính phí/ghi dữ liệu mà chưa có idempotency.
- Test concurrent slow DB/R2/password + request health/catalog; đo p95 health để phát hiện starvation. Test ASGITransport đơn luồng/event-loop thực hoặc server benchmark phù hợp; TestClient nhiều instance chưa đủ chứng minh một event loop không bị chặn.

### O03 — Bảo toàn dữ liệu và chống race ngoài lookbook

**File chính:** `outfits/service.py/repository.py`, `solution_forms/*`, `auth/service.py`, `core/database.py`.

- Outfit create hiện tạo row/version/current pointer qua nhiều commit: gộp atomic. Update đang có `save_revision` transactional: giữ semantics, thêm owner predicate, không làm mất kiểm tra revision khi refactor.
- Solution form hiện đọc revision rồi UPDATE chỉ theo id: chuyển compare-and-swap `WHERE id=? AND owner_id=? AND revision=?`, increment trong SQL, rowcount=0 → `409`. GET-or-create phải atomic và có UNIQUE(owner_id).
- Trước thêm UNIQUE, dò owner có nhiều form, xuất báo cáo/dry-run; không xóa tùy ý bản nháp. Chỉ migrate sau chọn bản giữ và lưu bản dư phục hồi được.
- Local/Google account creation: accounts/profile/roles trong một transaction, xử lý race email uniqueness về lỗi có nghĩa. Google liên kết account cần chính sách danh tính đã verify, không dùng profile update để cấp role.
- Foreign keys/constraints: kiểm tra reference của occasion/variant/avatar và snapshot; không để request sai gây `500`. Không phá tính đọc snapshot lịch sử khi danh mục đổi.
- Test concurrency dùng barrier điều khiển 2 request cùng revision; chỉ 1 thành công, 1 `409`, revision tăng đúng 1. Test fault injection giữa các bước tạo outfit/account không để orphan rows.

### O04 — Validation đầu vào, lỗi thống nhất và chống lạm dụng

- Giới hạn prompt, title, summary, full_content, snapshot item count, transform finite/range, số entry lookbook, request body và pagination. Khởi điểm: prompt 2.000 ký tự, title 255, snapshot tối đa số slot hợp lệ, lookbook 100 entry; giá trị là thiết kế đề xuất, xác nhận với UI/data trước khi khóa contract.
- Validate MIME/visibility/role/status và references từ server. Không suy luận hợp lệ chỉ từ Pydantic parse thành công.
- Bổ sung handler cho lỗi không dự kiến trả error envelope `500` cùng request ID và log server đã redact; lỗi FK/unique được map cụ thể, không catch hết rồi báo “thành công”. Giới hạn format/độ dài X-Request-ID hoặc tự sinh nếu header không hợp lệ.
- Login/register/Google/media/AI có rate limit theo tài khoản + IP tin cậy, `429` + Retry-After. Giá trị ban đầu phải cấu hình, ví dụ login 10 lần thất bại/5 phút cho tổ hợp account+IP; tránh khóa toàn account bằng request giả hoặc tin X-Forwarded-For tùy ý.
- M1 một instance có thể dùng limiter local được ghi rõ giới hạn. Nếu chạy nhiều worker/instance, phải dùng limiter/quota shared hoặc edge gateway tương đương; không báo quota toàn hệ thống bằng counter từng process.
- AI gọi provider trả phí yêu cầu danh tính hoặc quota guest riêng được phê duyệt; đường guest chỉ fallback miễn phí có giới hạn cho M1. Trước bật API thật, cập nhật contract và FE tương ứng.
- Cache headers: private/auth/share nhạy cảm không public-cache; public catalog có ETag/TTL phù hợp và invalidation. Không cache lỗi auth như dữ liệu công khai.

### O05 — Độ bền Gemini, cache thời tiết và hạn mức

**File chính:** `infrastructure/gemini/client.py`, `recommendations/service.py`, `weather/service.py`, schemas tương ứng.

- Pydantic schema cho output model, validate cả root/list/item trước khi `.get()`. JSON hợp lệ về cú pháp nhưng sai cấu trúc phải fallback có lý do nội bộ, không `500`. Model trả ID lạ/unpublished, sai slot/variant phải loại bỏ và thay bằng fallback hợp lệ.
- Giữ locked item/variant/color chính xác theo input đã validate; yêu cầu khóa không tồn tại trả lỗi rõ, không tự đổi màu mà nói đã giữ. Kiểm tra số slot, tương thích giới tính/loại áo và cultural rule như guardrails; không coi giải thích từ model là nguồn lịch sử.
- Tái sử dụng catalog batch. Tránh chỉ lấy 50 item đầu rồi làm như toàn bộ catalog đã được xét; dùng truy vấn chọn ứng viên có chủ đích, deterministic, có giới hạn và đủ slot. Ghi rõ fallback không hiểu mọi prompt tự do.
- Timeout/quota: bounded concurrency, deadline tổng, fallback trên timeout/429/503; phân biệt provider thiếu config với output invalid trong metrics. Không log URL Gemini chứa key. Retry không vượt budget/request.
- AI cache nếu dùng: key gồm normalized request, gender/occasion/style, locked items/variants, catalog/rule version, model/prompt version và scope phù hợp. Không dùng cache chung cho ảnh hoặc nội dung cá nhân. Không đổi model API theo tên agent thực hiện kế hoạch.
- Weather: giữ cache key tọa độ đã sửa; validate lat/lon đủ cặp và range. Cache dữ liệu live và sample khác TTL: live đề xuất 10–30 phút, sample 30–60 giây để phục hồi nhanh. Không lưu thời tiết mẫu 60 phút rồi hiển thị như dữ liệu thật.
- Khi provider lỗi, ưu tiên stale live có nhãn/source và tuổi dữ liệu nếu policy cho phép, sau đó sample; không thay silently. Thêm single-flight có giới hạn cho cùng key để giảm request trùng; nhiều worker cần cơ chế shared hoặc chấp nhận/ghi rõ số call nhân lên.
- Test timeout, 429, JSON list/dict sai shape, thiếu candidate, unknown IDs, locked conflicts, cache invalidate, upstream recovery. Đánh giá AI thật bằng bộ input cố định có người xem chất lượng; không thay thế bằng mock.

### O06 — Dọn media/job an toàn và giữ try-on chưa tích hợp ở trạng thái đúng

- Pending upload quá hạn: cleanup job có dry-run, chỉ xóa key staging trong prefix được quản lý, đối soát DB trước khi xóa; object public/ready không bị match bởi prefix rộng.
- Cleanup/deletion có retry count, next_attempt, giới hạn batch/time, metric và audit; không mất reference khi R2 tạm lỗi. Không khởi động một infinite cleanup loop trong mỗi API worker.
- `GEMINI_TRY_ON_ENABLED` không được làm API trả succeeded khi worker chưa tích hợp. Giữ `503 TRY_ON_UNAVAILABLE` rõ ràng; GET job vẫn phải owner-safe.
- Nếu triển khai try-on ở đợt riêng: idempotency scoped owner/task; lease với fencing token; heartbeat gia hạn; update kết quả chỉ khi worker còn lease; retry giới hạn; input reference media ID đã xác thực thay URL tùy ý để tránh SSRF; kết quả lưu private R2. Không triển khai nửa cơ chế lease rồi báo xử lý exactly-once.
- M1 nghiệm thu worker hiện tại trung thực, không lộ job/private URL, cleanup test bằng fake storage. Tính năng sinh ảnh và benchmark model thuộc F05/A8, chưa được mở rộng tự động trong task vá lỗi.

### O07 — Cấu hình, quan sát, health và chạy production

- Centralize settings: validation theo environment/storage/auth mode; CORS allowlist tường minh; production không debug/reload; không có magic dev admin token. Không print toàn bộ settings.
- `DATABASE_URL` scheme chưa hỗ trợ phải fail cấu hình rõ, không im lặng ghi SQLite khi người dùng cấu hình PostgreSQL. `LOCAL_MEDIA_DIR` resolve nhất quán theo root cấu hình, không đổi vị trí do chạy từ root/backend.
- Khởi tạo DB/storage/client ở lifespan/factory phù hợp; tránh mkdir/tạo client với credential thật khi import test/export. Test fixtures không được nạp app trước khi override môi trường.
- Giữ `/health` cho liveness nhẹ; thêm `/ready` kiểm tra schema/DB và cấu hình storage bắt buộc. Dependency optional như Gemini không làm API catalog chết; R2 required lỗi báo degraded/not-ready theo policy. Probe không gọi API trả phí hoặc HEAD bucket mỗi request.
- Structured logs/metrics: request ID, route template, status, duration, DB time/query count, connection count, external latency/error category, cache hit, fallback rate, upload rejected, queue depth nếu có. Redact token, URL signed, key, email và prompt cá nhân.
- Thử shutdown đóng clients/connections; health không treo khi external timeout; không giữ unbounded in-memory cache/queue. Log và benchmark artifact có giới hạn lưu trữ.
- Chỉ thêm Redis/task queue/proxy nếu phép đo hoặc mô hình triển khai đòi hỏi. Nếu production nhiều replica, kiểm tra SQLite single-writer và local storage không chia sẻ; không tăng replica như cách tự động scale database.

### O08 — Dependency, test harness và đóng gói chạy lặp lại

- Ghi Python/platform/dependency versions dùng test, tối thiểu phiên bản production dự kiến. Không nâng tất cả package lên latest trong PR vá lỗi.
- `pyproject.toml` hiện trỏ `readme="README.md"` trong backend nhưng README ở root: kiểm tra `pip install -e ".[dev]"` và wheel build trong môi trường sạch; sửa metadata hoặc bổ sung tài liệu backend theo phạm vi để đóng gói thực sự được. Không coi cài tay vài package là kiểm chứng packaging.
- Chọn cơ chế lock/constraints phù hợp, lưu phiên bản resolve theo chính sách repo; dependency mới chỉ khi có lợi ích cụ thể và kiểm tra license/compatibility. Không commit virtualenv hoặc cache.
- Conftest: cấu hình env và dependency injection trước import app; account fixture có DB thật tạm và JWT test; lifecycle TestClient được chạy rõ. Mock HTTP/R2 injectable; thêm autouse guard không cho outbound thật ở test mặc định.
- Test file mới theo nghiệp vụ/security thay vì một file khổng lồ; dùng fixture chung, không sao chép chữ ký secret hoặc dữ liệu người dùng thật.
- CI nếu thêm workflow là file dùng chung, theo `rule.md` cần phối hợp. Local checks phải chạy được trước khi yêu cầu thêm workflow; không để task chờ CI mới viết regression tests.

## A5. Thứ tự triển khai, dependency và chia commit

### A5.1. Lộ trình bắt buộc

Không triển khai tất cả trong một lần refactor. Hoàn tất gate của một bước trước khi chuyển bước phụ thuộc. Bước S1 là chặn lỗ hổng sớm; giải pháp media đầy đủ ở S3, không đánh dấu R01/R05 hoàn thành chỉ vì đã tắt endpoint.

| Bước | Công việc | Phụ thuộc | Phạm vi dự kiến | Gate chuyển bước |
| --- | --- | --- | --- | --- |
| S0 | Xác nhận baseline, test harness tách biệt, regression tái hiện 11 lỗi | Không | `backend/tests`, ghi nhận môi trường | Test lỗi mới fail đúng nguyên nhân; 27 test cũ được tái lập hoặc khác biệt được giải thích |
| S1 | Chặn filesystem production, secret fail closed, bỏ auto-admin | S0 | R01 containment, R02, R03, O08 fixture | Không token giả/auto-admin/path debug ở production; public API và login hợp lệ vẫn chạy |
| S2 | Policy owner, đóng connection, transaction primitive, migration runner | S1 | R04, O01 nền tảng, R06 nền tảng | A/B/guest matrix pass; DB mới/cũ/partial nâng cấp được; không mất dữ liệu |
| S3 | Upload session/grant, private read, staging/promote/delete retry | S2 | R01 hoàn chỉnh, R05, O06 cleanup | Media lifecycle test local + fake R2 pass; private file không public-read |
| S4 | Blog schema đầy đủ, publish policy, lookbook ownership/atomicity, share URL | S2, S3 cho media projection | R06 hoàn chỉnh, R07, R08, R09, R11, O03 | Không lộ nội dung; failure injection giữ nguyên DB; share/revoke đúng origin/TTL |
| S5 | Xuất contract cuối đợt, fixtures payload, handoff Frontend | Cập nhật tăng dần từ S1; gate sau S4 | R10, O04 error/validation | OpenAPI deterministic, không drift; ví dụ 401/403/404/409/422/503 khớp thực tế |
| S6 | Batch SQL/index, offload blocking, HTTP pooling, AI/weather cache | Baseline trước tối ưu; S2–S5 | O01–O05 | Functional/security tests không hồi quy; benchmark trước/sau cùng điều kiện |
| S7 | Readiness/metrics, packaging, vận hành/rollback, toàn bộ regression | S6 | O06–O08, tài liệu backend | Cold start/upgrade/restore/soak pass; không outbound thật ngoài test được cho phép |
| S8 | Frontend cập nhật client/UI và kiểm thử end-to-end | Backend contract đã commit và bàn giao | FE01–FE05, người phụ trách Frontend | Guest draft, login, private media, lookbook/share và expired session chạy xuyên suốt |
| S9 | Release candidate và nghiệm thu M1 | S7 + S8 | Chủ sở hữu review, môi trường staging | 11 lỗi đóng bằng bằng chứng; không lỗi ưu tiên cao chưa xử lý; có kế hoạch rollback |
| M2 | Supabase DB/Auth cutover nếu triển khai kiến trúc đích | M1 ổn định, chuẩn bị dữ liệu/tài khoản | Theo A8 | Đối soát dữ liệu, auth và quyền trước/sau; không làm chung PR vá lỗi |

R10 không phải việc để cuối cùng mới làm: mỗi PR đổi API cập nhật OpenAPI và handoff tương ứng; S5 là gate rà tổng thể. S6 không được refactor đến mức làm mất test tái hiện S0.

### A5.2. Nhóm commit đề xuất

Tạo branch task riêng theo `rule.md`; nếu làm tuần tự một nhánh dài đã được thống nhất thì vẫn tách commit logic và không đồng thời sửa cùng file với người khác. Các tên dưới đây là đề xuất, chưa phải branch/commit đã tồn tại:

1. `test(backend): reproduce auth media and ownership regressions` — fixture an toàn và test hành vi đích; có thể squash cùng bản sửa tương ứng để không merge main đang đỏ.
2. `fix(backend): enforce token validation and explicit role grants` — R02/R03, tests, env example và contract.
3. `fix(backend): restrict local storage and personal resource access` — chặn R01 sớm và R04.
4. `fix(backend): add versioned migrations and transaction scopes` — nền tảng R06/O01, không trộn dữ liệu demo.
5. `fix(backend): protect media lifecycle and private access` — R01/R05 hoàn chỉnh + storage tests.
6. `fix(backend): validate and atomically persist lookbooks` — R07/R08.
7. `fix(backend): migrate blog fields and protect unpublished content` — R06/R09.
8. `fix(backend): configure and revoke share links` — R11.
9. `chore(backend): export and verify api contract` — tooling R10; các thay đổi contract của commit trước vẫn đi cùng implementation.
10. `perf(backend): batch reads and bound blocking work` — O01/O02 có số đo.
11. `fix(backend): harden provider fallback and concurrent writes` — O03/O05; tách thêm nếu diff lớn.
12. `chore(backend): add readiness and reproducible runtime checks` — O07/O08.

Không tự commit/push/merge/deploy chỉ vì tài liệu có tên commit. Khi người dùng giao triển khai, thực hiện trong phạm vi ủy quyền và quy trình review hiện hành; riêng lượt lập kế hoạch này không làm các thao tác đó.

### A5.3. Cách xử lý khi phát hiện lỗi mới trong lúc triển khai

- Tạo mục `NEW-xx` với request/tình huống, expected/actual, file/symbol, mức độ, bằng chứng và test. Phân biệt lỗi đã tái hiện với nghi ngờ cần đo.
- Nếu cùng nguyên nhân và cần để đóng R/O hiện tại, đưa vào task và ghi scope; nếu mở rộng tính năng/đổi kiến trúc, tách task không tự làm ngầm.
- Không che lỗi mới bằng fallback `200`, catch-all hoặc sửa frontend cho thích ứng với dữ liệu sai.
- Trường hợp auth/schema chưa thể nâng cấp an toàn, giữ tính năng bị ảnh hưởng ở trạng thái unavailable có thông báo rõ; không mở lại đường không an toàn để giữ demo.

## A6. Contract handoff và công việc Frontend

### A6.1. Bảng thay đổi API dự kiến

Đây là contract đích đề xuất để Backend triển khai và xuất OpenAPI. Nếu symbol/route khác baseline, ghi thay đổi vào handoff trước khi Frontend tích hợp; không coi bảng này là contract runtime đã có.

| Endpoint/nhóm | Thay đổi chính | Lỗi/ảnh hưởng phía client |
| --- | --- | --- |
| `POST /api/auth/register`, `/login`, `/google`; `GET /api/auth/me` | Schema vào shared OpenAPI; JWT có issuer/audience; `/me` không cấp role | Token cũ có thể cần login lại; Google thiếu cấu hình `503` |
| `GET/POST /api/outfits`, `GET/PUT/DELETE /api/outfits/{id}` | Cần Bearer, owner-aware; giữ snapshot/revision semantics | Guest `401`; resource người khác `404`; stale save `409` |
| `POST /api/media/uploads` | Cần Bearer; media session có giới hạn; upload vào staging | `422` loại/visibility sai; `429` quota; URL có TTL |
| Local upload route do server phát hành | Dev-only, ID/grant thay key/bucket client chọn | Dùng `upload_url`, `method`, `storage_type`; không tự ghép URL |
| `POST /api/media/{id}/complete` | Auth + owner; validate bytes; promote final key | `409 UPLOAD_INCOMPLETE`; `422 INVALID_MEDIA`; `503 STORAGE_UNAVAILABLE` |
| `GET /api/media/{id}/access` | Asset ready; auth với private/unlisted; trả URL ngắn hạn | `access_url`, `expires_in`; không persist signed URL |
| `DELETE /api/media/{id}` | Owner; delete state/retry có kiểm soát | Giữ JSON response; nếu async deletion thêm response status rõ, không báo đã xóa khi storage chưa xong |
| `GET /api/ai/jobs/{id}` | Cần Bearer và owner | `401/404`; không lộ result người khác |
| `POST /api/ai/try-on` | Giữ unavailable khi chưa tích hợp | `503 TRY_ON_UNAVAILABLE`, không spinner polling job giả |
| `GET/PUT /api/solution-form` | Cần Bearer; form riêng; compare-and-swap revision | Guest `401`; cạnh tranh `409`; không `team_default_owner` |
| `POST/PUT /api/lookbooks...` | Validate version owner; transaction atomic | `422 INVALID_OUTFIT_VERSION`, không mất entry cũ |
| `GET /api/lookbooks/{id}` | Public projection; private/unlisted owner-only | Guest private `401`; authenticated non-owner `404` |
| `POST /api/lookbooks/{id}/share` | Origin cấu hình, expiry 1–30 | `422` expiry sai; URL public host đúng |
| `DELETE /api/lookbooks/{id}/shares` | Mới: owner revoke tất cả link active | JSON `{message: ...}`; B `404`; token revoked `404` |
| `GET /api/shares/{token}` | Chỉ projection cho phép; check revocation/expiry | Missing/revoked `404`, expired `410` |
| Public catalog/heritage detail | Chỉ published | Draft/unpublished `404`, không đưa vào cache |
| Heritage create/detail | Giữ workflow publish hiện tại trong M1; public chỉ đọc status published | UI hiển thị trạng thái thật; workflow duyệt mới là task riêng nếu được giao |
| `/health`, `/ready` | Tách liveness/readiness | Monitoring dùng đúng mục đích, không lộ cấu hình |

Quy ước scope error: route yêu cầu auth trả `401` trước khi lookup; authenticated resource không được phép trả `404`. Public route nhận token sai cũng trả `401`. Không dùng response status ngẫu nhiên theo đường gọi service khác nhau.

### A6.2. Payload minh họa cần lưu trong handoff

Ví dụ giữ schema outfit cũ, auth qua header. Đây là dữ liệu giả, ID trong fixture phải được tạo hợp lệ trước khi chạy:

```http
POST /api/outfits
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "Bản phối kiểm thử",
  "occasion_id": "ky_yeu",
  "style_mode": "traditional",
  "snapshot": {
    "schemaVersion": 1,
    "avatarId": "avatar_nam_chuan",
    "occasionId": "ky_yeu",
    "styleMode": "traditional",
    "items": [],
    "lockedSlots": [],
    "backgroundTheme": "white",
    "aspectRatio": "9:16"
  }
}
```

Lỗi phiên bản phải giữ dữ liệu client và hiển thị lựa chọn tải lại, không retry ghi đè tự động:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "Bộ phối đã thay đổi ở phiên khác. Vui lòng tải lại trước khi lưu.",
    "status_code": 409,
    "request_id": "req_example",
    "details": {"expected_revision": 1, "current_revision": 2}
  }
}
```

`details` trên là phần đề xuất; chỉ dùng revision hiện tại sau khi đã kiểm tra owner. Nếu implementation chọn không trả details, xuất schema và cập nhật ví dụ cho đúng, không để tài liệu và runtime khác nhau.

Upload luồng chuẩn:

1. Client authenticated gọi `/media/uploads` với filename/media_type/MIME/visibility đã được UI hỗ trợ.
2. Server trả session `media_id`, `upload_url`, `method`, `object_key`, `bucket`, `expires_in`, `storage_type`. `object_key/bucket` ở bước này là staging; không giả định đó là key cuối cùng.
3. `storage_type=r2`: PUT raw bytes vào signed URL với Content-Type đúng khi ký; **không gửi Bearer token của app đến R2**. `storage_type=local`: POST multipart theo route/grant server cấp; không tự đặt Content-Type multipart thiếu boundary.
4. Gọi `/media/{id}/complete` với Bearer; chỉ khi ready mới lấy `/access`. Metadata complete phản ánh final key/bucket; lưu media ID, không lưu upload URL.
5. Private ảnh hiển thị qua access URL ngắn hạn. Khi hết hạn, client xin URL mới một lần có kiểm soát; không loop tải lại vô hạn. Không đặt token vào local URL tùy ý hoặc public URL lâu dài.

### A6.3. Ticket Frontend riêng

Các ticket dưới đây do người phụ trách `frontend/**` thực hiện sau commit contract. Backend chỉ cung cấp API/fixtures và review luồng tích hợp, không chỉnh UI trong PR backend.

| Ticket | File bắt đầu đọc | Việc cần làm | Nghiệm thu |
| --- | --- | --- | --- |
| FE01 | `src/app/page.tsx:handleSaveOutfit`, `src/app/tai-khoan/page.tsx`, `lib/auth/context.tsx` | Guest lưu local draft; giải thích cần login để sync server; giữ nguyên draft khi gặp 401/409; tránh submit trùng | Khách dùng Studio/export được; login rồi sync giữ snapshot/transform; hết phiên không mất bản phối |
| FE02 | `lib/api/client.ts`, `lib/types/api.ts`, media/try-on consumer thực tế | Cập nhật contract và upload method/body; private URL refresh; không đẩy token đến R2 | Upload dev/R2 test đúng Content-Type; private image hiển thị; expired grant refresh hữu hạn |
| FE03 | `app/lookbook/page.tsx`, `app/lookbook/[id]/page.tsx`, trang chia sẻ | Handle invalid version/atomic error; share URL từ server; revoke-all; public/private/unlisted | Sửa lỗi không làm UI xóa entries đã lưu; link copied đúng domain; revoked/expired có trạng thái rõ |
| FE04 | Heritage pages, `lib/api/client.ts:requestCache` | Filter blog, unpublished 404; invalidate public cache khi dữ liệu thay đổi; tách preview có auth khỏi cache public nếu có | Hiển thị status đúng contract hiện hành; không reuse cache riêng tư giữa user |
| FE05 | API client/auth context và `frontend/tests/**` | 401 clear/refresh theo cơ chế hiện có, không hạ guest ngầm; giữ 403/404/409/422/503 khác nhau; try-on unavailable | Các ca A/B/guest chạy trong Playwright; không báo thành công giả; không đổi contract để hợp mock |

Cache frontend hiện dựa URL cho mọi GET catalog/heritage: trước khi thêm admin preview, loại endpoint đó khỏi cache public hoặc key theo user và invalidate khi logout. Không triển khai cache riêng tư bằng chỉ thêm Authorization header mà vẫn dùng cache key URL cũ.

## A7. Kiểm thử, đo hiệu năng và bằng chứng nghiệm thu

### A7.1. Cấu trúc test đề xuất

Các file dưới đây **chưa được tạo trong lượt viết kế hoạch**. Có thể gộp theo conventions repo, nhưng không bỏ nhóm tình huống:

```text
backend/tests/
  conftest.py                      # env trước import, DB/media tạm, deny outbound
  test_auth_security.py            # R02/R03, inactive/deleted/revoked roles
  test_resource_ownership.py       # R04, A/B/guest/owner NULL, side effects
  test_media_security.py           # R01/R05, path, grants, limits, states
  test_media_storage_failures.py   # staging/promote/delete/retry/fault injection
  test_database_migrations.py      # R06, fresh/old/partial/repeat/rollback
  test_lookbook_integrity.py        # R07/R08, mixed refs, atomic rollback
  test_publication_access.py       # R09, drafts, nested leakage, cache
  test_openapi_contract.py         # R10, canonical production schema drift
  test_share_links.py              # R11, origin, TTL, revoke, private projection
  test_solution_form_concurrency.py
  test_provider_resilience.py      # O05, HTTP errors, output invalid, fallback
  test_runtime_lifecycle.py        # O01/O02/O07, cleanup, startup, readiness
```

Không viết test chỉ khẳng định tên hàm hoặc mock implementation về chính giá trị mong đợi. Quyền và transaction phải được kiểm tra qua API + DB/storage trạng thái thực trong môi trường tạm. Lỗi provider dùng mock transport/stub kiểm soát được, tách rõ khỏi chất lượng provider thật.

### A7.2. Ma trận truy vết lỗi → test → tiêu chí đóng

| ID | Negative test tối thiểu | Positive test tối thiểu | Bằng chứng đóng |
| --- | --- | --- | --- |
| R01 | Path escape mọi input, production debug routes | Local upload grant hợp lệ | Không sentinel ngoài media bị đọc/ghi/xóa; production 404 |
| R02 | Email bất kỳ không được nâng role, /me không write | Admin được cấp bằng quy trình quản trị làm việc được | DB roles trước/sau + API admin denied/allowed |
| R03 | Empty/default secret, forged/expired/wrong claims | Token app hợp lệ, account active | Startup fail closed + API 401 + valid 200 |
| R04 | A/B/guest/invalid token/owner NULL | Owner CRUD hợp lệ | Bị từ chối và không có mutation |
| R05 | Raw private/pending, expired/forged grant | Ready public/private theo quyền | Bytes không lộ, TTL/state đúng cả local và fake R2 |
| R06 | DB cũ/partial/migration fault | Fresh và upgraded blog filters/create | Schema và nội dung giữ nguyên, không SQL 500 |
| R07 | Foreign/missing/deleted version, mixed refs | Version của owner | Không lộ snapshot; không tạo dữ liệu dở dang |
| R08 | Failure sau clear/insert thứ hai | Replace/clear/no entries update | Toàn bộ state rollback hoặc commit đúng |
| R09 | Draft detail/nested/cache leak | Published public, owner/admin private policy | Public không thấy nội dung unpublished |
| R10 | Thêm route/schema mà không export | Export deterministic | Drift test fail/pass đúng, error/security schema khớp |
| R11 | Host spoof, invalid TTL, expired/revoked token | Production origin, owner share | Link đúng domain và scope đọc, revoke hoạt động |

### A7.3. Kịch bản tích hợp xuyên suốt

1. Guest mở Studio, phối/chỉnh transform, export ảnh, lưu draft local. Bấm lưu server được hướng dẫn login, draft giữ nguyên.
2. User A đăng nhập, sync draft, mở lại outfit, lưu revision mới, tạo lookbook private. User B không đọc/sửa/xóa bằng ID.
3. A tạo share link; guest đọc projection được phép; B không thêm version A vào lookbook của B; revoke link rồi guest không đọc được.
4. A upload ảnh riêng tư qua session; pending không đọc; complete ready rồi hiển thị; B không lấy grant; direct raw URL bị chặn; URL hết hạn không loop UI.
5. Stylist tạo bài theo workflow hiện tại; dùng fixture quản trị tạo published và draft riêng để kiểm tra public không đọc draft; filter era/category có kết quả; đổi trạng thái về unpublished thì cache không lộ bài. Không bổ sung workflow duyệt mới chỉ để chạy kịch bản này.
6. 2 tab cùng sửa outfit/form: một success, một conflict; bản phía server không bị ghi đè im lặng và UI giữ bản đang chỉnh.
7. Provider weather/Gemini timeout/429: response fallback có source đúng, không giả dữ liệu live; try-on chưa tích hợp vẫn unavailable rõ ràng.

### A7.4. Benchmark trước/sau — mục tiêu, không phải số đo đã có

Tạo script benchmark riêng dùng dữ liệu tổng hợp và config tạm. Benchmark **không dùng DB/media thật**, không gọi AI tính phí. Mọi số dưới đây là mục tiêu đề xuất cần chốt theo máy chạy và baseline; không tự ghi “đạt” nếu chưa chạy.

**Dataset cố định:** 1.000 item, 4 variants/item, số layer/asset nhỏ ổn định; 100 account giả; mỗi account 20 outfit và 5 lookbook x 10 entries; phiên bản SQLite và seed cố định. Chuẩn bị ngoài thời gian đo.

**Quy trình:**

- Ghi commit, OS, CPU/RAM, Python, versions, số process/thread, dataset count, cache mode. Dùng cùng máy/config cho trước và sau.
- Warm-up 10 giây, chạy từng scenario ít nhất 60 giây, 3 lần; concurrency 1/10/25; tách cold-start và warm-cache. Lưu raw histogram hoặc samples đã bỏ PII.
- Đo p50/p95/p99, throughput, tỷ lệ error, CPU/RSS, query count, open connections, SQLite busy time, event-loop lag, upstream call count.
- Scenario: catalog page 50 item; lookbook list user; outfit create/update; private media access; login/register giới hạn; weather cache hit/miss; slow R2/Google fake chạy đồng thời health.
- Không trộn 401/403/429 mong đợi vào server error rate. Báo riêng reject rate, queueing và accepted-request latency để rate limiting không làm số đo đẹp giả.

| Chỉ số | Gate đề xuất cho M1 |
| --- | --- |
| Query catalog page | ≤3 query nghiệp vụ cho item/variant/layer, không tăng theo số item trong page; auth/query nền ghi riêng |
| Query lookbook list | ≤2 query nghiệp vụ cho lookbooks/entries trong một page; không N+1 |
| Public reads local warm-cache | p95 mục tiêu ≤300 ms ở concurrency 10; nếu baseline đã nhanh, không regression >10% có ý nghĩa qua 3 lần |
| Outfit/lookbook writes | p95 mục tiêu ≤600 ms ở concurrency 10, không `database is locked` ngoài cơ chế retry/error đã quy định |
| Health khi provider fake chậm 2 giây | p95 mục tiêu ≤200 ms trên máy benchmark; không chờ đủ 2 giây vì event loop bị block |
| Server errors trong valid workload | 0 unexpected 5xx trong kịch bản cố định; conflict/rate limit mong đợi được báo riêng |
| Connections/client lifecycle | Về baseline sau shutdown/exception; không tăng tích lũy theo request count |
| Memory soak | Chạy 10 phút, sau warm-up không tăng tuyến tính không giới hạn; báo RSS/heap trend thay vì một ảnh chụp |
| AI/weather | Fallback/timeout đúng budget; số upstream request giảm có thể đo; không gán chất lượng AI từ latency |

Nếu chưa đạt mục tiêu, ghi số đo và nguyên nhân, sửa bottleneck hoặc đề xuất ngưỡng phù hợp có lý do. Không thay máy/giảm dataset/giảm kiểm tra quyền rồi so với baseline cũ. Test correctness và privacy luôn là gate cứng.

### A7.5. Lệnh kiểm tra thực thi

Chạy từ workspace gốc, PowerShell. Các lệnh dưới đây để Gemini dùng khi triển khai, không phải tất cả đã được chạy trong lượt viết tài liệu. Kiểm tra trạng thái trước thao tác branch; không chạy pull/rebase trên worktree bẩn.

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
```

Chọn Python có dependencies của dự án:

```powershell
$VietStylistPython = if (Test-Path '.\.venv\Scripts\python.exe') {
    (Resolve-Path '.\.venv\Scripts\python.exe').Path
} else {
    (Get-Command python -ErrorAction Stop).Source
}
Push-Location backend
try {
    & $VietStylistPython -m pytest
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
} finally {
    Pop-Location
}
```

Sau khi S5 tạo script export với interface dưới đây, chạy ở repo root:

```powershell
# Interface đề xuất; script hiện chưa tồn tại ở baseline.
# --check phải so sánh và exit nonzero, KHÔNG ghi lại file để che drift.
& $VietStylistPython backend/scripts/export_openapi.py --check --output shared/openapi.json
if ($LASTEXITCODE -ne 0) { throw 'OpenAPI contract drift' }
git diff --check
```

Mọi migration/benchmark script mới phải có `--help`, xác định config/DB target, dry-run hoặc đường chạy tạm nếu tác động dữ liệu. Tài liệu vận hành phải ghi đúng CLI thực đã tạo; không để những lệnh dự kiến thành lời khẳng định đã chạy.

Frontend do người phụ trách chạy sau khi cập nhật:

```powershell
Push-Location frontend
try {
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'Frontend typecheck failed' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
} finally {
    Pop-Location
}
```

Không chạy lại toàn bộ nhiều lần nếu chưa có thay đổi hoặc lỗi mới; chạy focused tests khi đang sửa, full backend trước bàn giao, frontend checks khi có thay đổi frontend. Documentation-only không cần dùng kết quả test backend để chứng minh nội dung kế hoạch đúng.

## A8. Supabase là đợt chuyển đổi riêng, không phải đổi một biến môi trường

### A8.1. Phạm vi và điều kiện bắt đầu M2

M1 giữ runtime SQLite/local auth hiện có đã được vá để không trộn sửa lỗ hổng với đổi DB/Auth. M2 là lộ trình thực hiện kiến trúc đã chọn: Supabase PostgreSQL/Auth cho dữ liệu hệ thống; R2 giữ binary. M2 chỉ bắt đầu khi có môi trường thử, phương án account migration, backup/cutover, owner review và quyền triển khai phù hợp.

Nếu người dùng giao Gemini chỉ làm M1, ghi M2 là **ngoài phạm vi triển khai đợt này**, không đánh dấu xong hoặc tự gọi Supabase thật. Nếu giao cả M2, thực hiện các gate dưới đây tuần tự.

### A8.2. Thiết kế chuyển đổi

1. **Inventory thực tế:** schema SQLite, data count, NULL/orphan/duplicates, ID format, FK graph, timestamps, roles, media reference, account providers, share expiry và job state. Không mặc định migration PostgreSQL cũ đủ cho auth/blog đang chạy.
2. **Database access:** chọn một cách nhất quán để đảm bảo transaction nhiều bảng: ưu tiên backend PostgreSQL connection/transaction qua adapter rõ ràng; nếu dùng Supabase Data API thì nghiệp vụ atomic phải nằm trong RPC transaction phía DB. Không giữ nhiều REST calls rời rồi gọi là transaction.
3. **ID mapping:** local `usr_*` khác UUID Supabase Auth. Dùng mapping bền vững `legacy_account_id → auth_user_id`, cập nhật owner/FK cùng đợt; không nối tài khoản chỉ theo email mà chưa xác minh. Content ID dạng `item_*` có thể giữ TEXT nếu phù hợp schema đích.
4. **Password/session:** không mặc định hash PBKDF2 hiện tại import thẳng vào Supabase Auth được. Xác minh cơ chế chính thức tại thời điểm triển khai; chọn reset password/re-auth nếu không tương thích. Token local cũ hết hiệu lực có thông báo; kiểm thử tài khoản Google và local liên kết đúng.
5. **JWT:** verifier Supabase theo issuer, audience và JWKS của project, validate kid/alg theo provider; cache/refresh/rotation có kiểm soát. Không tiếp tục giả định mọi Supabase JWT là HS256. Tham chiếu [Supabase JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys).
6. **Authorization/RLS:** phân biệt role PostgreSQL với role ứng dụng. RLS cho bảng exposed, quyền tối thiểu cho backend; test owner A/B/guest. Service-role key có thể bypass RLS, nên không dùng như bằng chứng quyền tự động an toàn; mọi admin/service operation phải tự enforce scope và được audit. Xem [Supabase service-role behavior](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z).
7. **Object storage:** không chuyển ảnh/video vào Supabase DB/Storage trong task này. Copy metadata bucket/key/visibility/status, kiểm tra số object và quyền R2; không copy presigned URL đã hết hạn như canonical URL.
8. **Dialect/data types:** bỏ SQL/PRAGMA chỉ dành SQLite khỏi adapter PostgreSQL, map JSON/booleans/timezone/UUID/ON CONFLICT đúng. Pagination/order/revision semantics giữ nguyên API hoặc có phiên bản contract rõ.
9. **Connection mode:** chọn direct/pooler theo topology và driver, kiểm tra transaction semantics/prepared statements theo tài liệu ở thời điểm làm. Không sao chép connection string/secret vào repo hoặc log benchmark.

### A8.3. Dry-run, cutover và rollback

- Tạo bản sao dữ liệu đã ẩn thông tin nhạy cảm để dry-run. Đo thời gian import, row counts, FK consistency, orphan count, checksum snapshot và sample owner access.
- Chạy cùng integration suite trên SQLite và PostgreSQL adapter khi còn hỗ trợ cả hai. Fixture không được skip các test quyền chỉ vì dùng backend khác.
- Chọn maintenance window/read-only ngắn cho cutover đầu tiên; không tự thiết kế dual-write nửa vời. Backup nhất quán, import delta sau khi khóa writer, đối soát rồi chuyển traffic.
- Sau cutover: login/re-auth, CRUD outfit/lookbook/form, share/revoke, private media, admin publish, provider fallback, readiness đều chạy. Quan sát latency/errors/connection pool trước mở hoàn toàn.
- Rollback sau khi DB đích đã nhận ghi cần phương án giữ/reconcile các ghi mới; không trỏ lại SQLite cũ rồi mất dữ liệu. Mốc chuyển đổi phải có quyết định read-only hoặc delta export tương ứng.
- Chỉ đóng M2 khi owner mapping, privacy, backup restore và số liệu đối soát đạt, có người phụ trách nghiệm thu. Không coi kết nối `/health=200` là hoàn tất migration.

## A9. Vận hành, rollout và gói bàn giao

### A9.1. Cấu hình đích cần ghi vào backend/.env.example

Tên dưới đây là thiết kế đề xuất; Gemini cần tránh tạo hai biến cùng nghĩa và cập nhật toàn bộ chỗ dùng. Chỉ placeholder trong repo, secret lấy từ môi trường quản trị.

| Nhóm | Biến/giá trị cần có | Quy tắc |
| --- | --- | --- |
| Runtime | `ENVIRONMENT`, `DEBUG`, `CORS_ORIGINS` | Prod debug false, allowlist thật, không wildcard credentials |
| Auth M1 | `AUTH_MODE=local`, `JWT_SIGNING_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, token TTL | Secret bắt buộc, issuer/audience ổn định, alias biến cũ có thời hạn |
| Google | `GOOGLE_CLIENT_ID` | Thiếu thì Google unavailable; không fallback ID hardcode |
| URL | `FRONTEND_PUBLIC_ORIGIN`, `API_PUBLIC_ORIGIN` | Prod HTTPS, không dựa request Host; API origin để URL local/dev nếu cần |
| Storage | `STORAGE_BACKEND=local|r2`, `LOCAL_MEDIA_ENABLED`, `LOCAL_MEDIA_DIR` | Local routes prod tắt; R2 mode thiếu credential không tự fallback âm thầm |
| R2 | Account/key/secret, public/private buckets, public domain | Không cấp public domain cho private bucket; session staging và final tách key |
| Media limits | Max image/video bytes, pixels, upload/read TTL | Đồng nhất API/client/proxy; giới hạn đo bytes thật |
| Database | `DATABASE_URL`, migrate-on-start dev flag, busy timeout | Scheme unsupported fail; prod migration riêng |
| Providers | Gemini model/key/feature flags, timeout, concurrency, quota | Không đổi model theo tên agent; try-on flag không giả dịch vụ đã tích hợp |
| Cache/rate limit | TTL live/sample, limiter backend/budgets | Ghi rõ phạm vi process hay shared |

Không yêu cầu key Gemini/R2/Google cho unit test và export OpenAPI. Development thiếu provider được fallback đúng thiết kế; production có mode yêu cầu provider thì thiếu cấu hình phải fail rõ, không che bằng fallback local ngoài ý muốn.

### A9.2. Trình tự rollout M1

1. Trước release, inventory các tài nguyên có owner NULL, admin hiện có, reference lookbook sai owner, media pending/orphan, DB schema version. Báo số lượng và hướng xử lý; không tự purge dữ liệu thật.
2. Chuẩn bị backup/restore đã thử, artifact ứng dụng và schema version. Với SQLite WAL, backup phải nhất quán; xác nhận path/target của mọi thao tác.
3. Đưa cấu hình secret/origin/storage mới vào staging; migrate một lần; start app và check `/ready`. Không công khai app với secret rỗng/default trong lúc chờ cấu hình.
4. Phát hành backend và frontend theo contract; nếu deployment tách thời điểm, dùng maintenance/feature gate cho thao tác chưa tương thích, vẫn giữ guest local draft và thông báo rõ.
5. Sau deploy, chạy smoke account A/B, read/write outfit, share/revoke, private media, draft visibility, provider fallback và production local-route 404. Dùng dữ liệu test riêng có cleanup scope, không thao tác user thật.
6. Theo dõi 401 tăng do token rotation, 5xx, quota/fallback, latency/SQLite locks/storage retries. Ghi rõ thay đổi yêu cầu đăng nhập lại để không chẩn đoán nhầm như lỗi mất tài khoản.
7. Chỉ mở tính năng khi cả BE/FE gate pass. Không sửa test fixture thành dữ liệu dễ để vượt gate, không bypass auth tạm ở production.

### A9.3. Rollback an toàn

- Ưu tiên migration additive để binary bản trước vẫn đọc được nếu chính sách bảo mật cho phép. Không tự DROP cột/bảng hoặc down migration làm mất dữ liệu mới.
- Rollback chức năng không được khôi phục endpoint filesystem mở hoặc auto-admin. Giữ containment R01–R05 bằng cấu hình/gateway đã kiểm chứng, hoặc tắt nhóm API bị lỗi trong lúc sửa forward.
- Với transaction/migration lỗi, dừng writer và đối soát; restore backup chỉ theo cửa sổ đã xác nhận, có kế hoạch bảo toàn các ghi phát sinh sau backup.
- Secret đã rotate do rủi ro không chuyển lại key cũ để cứu session; người dùng đăng nhập lại. Signed URL cũ có thời hạn được xử lý theo TTL/object deletion, không hứa thu hồi tức thời mọi URL R2.
- Nếu storage promote/delete lỗi, dùng reconciler state để tiếp tục; không xóa metadata thủ công rồi bỏ object mồ côi.

### A9.4. Gói bàn giao bắt buộc cho mỗi mốc

Tạo dưới `backend/docs/` hoặc vị trí artifact đã thống nhất; file report được commit phải không chứa secret/PII, raw logs/benchmark transient không commit nếu `rule.md` cấm báo cáo sinh tự động.

- Bảng R01–R11/O01–O08: status, file/symbol sửa, tên test, kết quả, giới hạn còn lại.
- Contract diff + payload success/error dùng dữ liệu giả + breaking changes + commit để Frontend tích hợp.
- Migration manifest: schema version, tác động, cách chạy/verify/retry/rollback, fixture DB cũ đã thử; không kèm DB người dùng.
- Benchmark: môi trường, dataset, trước/sau, p95/p99/error/query count/RSS, raw artifact location, diễn giải vừa đủ không thổi phồng.
- Vận hành: env mới, health/ready, logs/metrics, retry/cleanup, backup/restore, production local-route gate.
- Kiểm thử dịch vụ thật được thực hiện hay chưa: provider, môi trường, phạm vi, chi phí nếu có; tách rõ mock và live. Nếu chưa thử live, ghi “chưa xác minh”, không ghi hoàn tất phần đó.

Mẫu báo cáo cuối một task:

```text
Task: Rxx / Oxx
Trạng thái: TODO | IN_PROGRESS | DONE | BLOCKED
Commit/branch:
Vấn đề và hành vi sau sửa:
File/symbol:
Test: tên test + command + kết quả
Contract/migration/env thay đổi:
Tác động Frontend:
Dữ liệu cũ và rollback:
Giới hạn/chưa kiểm chứng:
Việc tiếp theo:
```

## A10. Checklist thực thi và nguồn tham chiếu

### A10.1. Checklist trạng thái — khởi đầu tất cả TODO

- [ ] S0: ghi baseline và môi trường; test mới tái hiện đúng; fixture không chạm tài nguyên thật.
- [ ] R01: chặn path traversal/read/write/delete và debug route production; local grant hợp lệ chạy.
- [ ] R02: bỏ email auto-admin, `/me` chỉ đọc, role revoke có hiệu lực.
- [ ] R03: signature/claims bắt buộc; secret sai fail startup; không magic dev admin token production.
- [ ] R04: owner policy đồng nhất outfit/media/job/form, không fallback guest owner chung.
- [ ] R05: private media/grant/TTL/staging/promote/delete retry và quota an toàn.
- [ ] R06: migration versioned fresh/old/partial/repeat, không mất nội dung, blog API hết lỗi thiếu cột.
- [ ] R07: lookbook không gắn version người khác, share projection không lộ thông tin riêng.
- [ ] R08: lookbook create/update atomic, fault injection không mất entry/metadata.
- [ ] R09: draft/unpublished không lộ qua detail/nested/cache; lịch sử owner xử lý đúng.
- [ ] R10: OpenAPI canonical có đủ routes/schemas/security/errors và drift test.
- [ ] R11: origin cấu hình, TTL validated, revoke link và expiry đúng.
- [ ] O01: close connection, transaction API, batch queries/index, số đo query/memory/lock.
- [ ] O02: sync work không chặn event loop, client reuse, timeout/concurrency có giới hạn.
- [ ] O03: outfit/account atomic, solution form unique+CAS, concurrency tests.
- [ ] O04: validation/body size/rate limit/error envelope/cache privacy.
- [ ] O05: Gemini output validation/fallback/quota; weather cache recovery; chất lượng AI báo riêng.
- [ ] O06: cleanup staging/job an toàn, try-on trung thực unavailable, không xóa rộng.
- [ ] O07: settings fail closed, unsupported DB scheme rõ lỗi, readiness/metrics/shutdown.
- [ ] O08: reproducible install/build, versions, fixture trước import, deny outbound test.
- [ ] FE01–FE05: Frontend tích hợp sau contract, giữ guest draft và xử lý session/privacy đúng.
- [ ] A7: full tests, end-to-end, benchmark trước/sau, migration restore và smoke staging.
- [ ] A9: gói bàn giao, backup/rollback, owner review và release gate.
- [ ] M1: 11 lỗi đóng, các O-task nghiệm thu, không thiếu phần BE/FE bắt buộc.
- [ ] M2 (đợt riêng nếu được giao): Supabase migration/auth cutover và đối soát dữ liệu/quyền.

### A10.2. Chỉ dẫn ngắn có thể đưa trực tiếp cho Gemini

> Đọc `rule.md` và toàn bộ kế hoạch này. Xác minh lại baseline rồi thực hiện S0–S9 theo dependency, bắt đầu bằng test tái hiện và chặn các lỗ hổng. Sửa đủ R01–R11, làm O01–O08 với số đo. Giữ đúng phạm vi Backend và bàn giao Frontend bằng contract đã commit; không tự sửa file ngoài quyền sở hữu. Mọi test dùng DB/media tạm và provider giả mặc định. Không làm Supabase cutover hoặc bật AI try-on nếu task hiện tại chỉ là M1. Không đánh dấu DONE nếu mới có mock/test đơn vị nhưng chưa đạt acceptance tương ứng. Khi báo cáo, nêu bằng chứng, thay đổi contract/migration, dữ liệu cũ, rollback và giới hạn còn lại. Không chỉ trả lời kế hoạch nếu người dùng đã giao triển khai; làm theo từng gate và bảo toàn thay đổi đang có.

### A10.3. Nguồn kỹ thuật đã đối chiếu khi lập kế hoạch

Các nguồn bổ trợ cho thiết kế, không thay thế source code trong repo. Khi đổi phiên bản dependency hoặc làm M2, kiểm tra lại tài liệu chính thức tại thời điểm thực hiện.

- [Python sqlite3 — connection context manager](https://docs.python.org/3/library/sqlite3.html#how-to-use-the-connection-context-manager): phân biệt transaction context và đóng connection; dùng cho O01.
- [FastAPI — concurrency và async/await](https://fastapi.tiangolo.com/async/): phân biệt sync path operation/dependency và helper được gọi trực tiếp; dùng cho O02.
- [Cloudflare R2 — presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): URL có thời hạn, khả năng tái sử dụng, ràng buộc upload; dùng cho R05.
- [Cloudflare R2 — CORS](https://developers.cloudflare.com/r2/buckets/cors/): cấu hình origin/method/header cho upload browser; nghiệm thu R2 live tách khỏi mock.
- [Supabase — JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys): verification và rotation cho đợt M2, không giả định HS256 cho mọi token Supabase.
- [Supabase — service role và RLS](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z): không dùng service-role bypass làm cơ chế owner authorization.

Nguồn nội bộ: `rule.md`, `backend/app/**`, `backend/tests/**`, `shared/openapi.json`, `supabase/migrations/**`, `frontend/src/lib/api/client.ts` và các consumer được liệt kê ở FE01–FE05. **Tài liệu này là kế hoạch thực thi mới; không giữ phụ lục kế hoạch cũ.**
