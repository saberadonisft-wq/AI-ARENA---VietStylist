# VietStylist — Việt phục Remix

VietStylist là nền tảng web hỗ trợ khám phá, phối và lưu trữ các bộ Việt phục. Dự án kết hợp Studio phối đồ 2D, kho tri thức cổ phục, kiểm tra quy tắc văn hóa, phân tích màu sắc, gợi ý theo thời tiết và quản lý lookbook trong một trải nghiệm thống nhất.

## Thông tin giải pháp

### Tên giải pháp

**VietStylist — Việt phục Remix**

### Nhu cầu người dùng và tình huống sử dụng

Người muốn mặc hoặc tìm hiểu Việt phục cần hình dung bộ phối, chọn trang phục phù hợp với dịp sử dụng và có thông tin văn hóa để tham khảo. VietStylist hướng tới các tình huống như chuẩn bị chụp ảnh, dự lễ hội, biểu diễn, cưới hỏi hoặc thử một cách phối mới. Người dùng có thể phối thử trực quan trước khi lựa chọn trang phục và chia sẻ kết quả với cộng đồng.

### Tóm tắt giải pháp

VietStylist kết hợp Studio phối đồ 2D với danh mục trang phục, thông tin di sản và Lookbook cộng đồng. Người dùng chọn món, điều chỉnh màu và bố cục, tham khảo kiểm tra văn hóa, hòa sắc và thời tiết, rồi xuất PNG hoặc đăng nhập để lưu bộ phối. Lookbook hỗ trợ đăng bài, chọn quyền xem, lưu yêu thích và chia sẻ liên kết. Gemini hỗ trợ gợi ý phối đồ; chức năng tạo ảnh thử đồ hoạt động khi được cấu hình, còn Studio 2D vẫn sử dụng được độc lập.

### Tác động kỳ vọng

Giải pháp kỳ vọng giúp người dùng chuẩn bị bộ phối thuận tiện hơn và tìm hiểu Việt phục thông qua trải nghiệm trực quan. Cộng đồng có thêm nơi chia sẻ cách phối, trao đổi ý tưởng và tiếp cận nội dung di sản. Việc kết nối trang phục với thông tin văn hóa có nguồn đối chiếu và quy trình biên tập có thể hỗ trợ phát huy giá trị văn hóa trong đời sống hiện đại. Các tác động này cần được đánh giá qua sử dụng thực tế; gợi ý của hệ thống không thay thế thẩm định lịch sử hoặc chuyên môn.

### Hướng tiếp cận và giải pháp kỹ thuật

Hệ thống gồm frontend Next.js 15/React 18 và backend FastAPI/Pydantic, giao tiếp qua REST API với contract OpenAPI. Studio dùng React/SVG để phối đồ và HTML Canvas để xuất PNG. PostgreSQL lưu tài khoản, danh mục, bộ phối và nội dung cộng đồng; Cloudflare R2 lưu media trong production. Backend xác thực bằng JWT, kiểm tra vai trò, quyền sở hữu và dữ liệu đầu vào. Luồng chính là chọn trang phục → dựng bộ phối → phân tích/gợi ý → xuất ảnh, lưu hoặc chia sẻ. Gemini API cung cấp gợi ý và tạo ảnh có điều kiện cấu hình; gợi ý có bộ luật dự phòng. Thông tin văn hóa được quản lý cùng dữ liệu nguồn và trạng thái biên tập.

## Tính năng chính

- Phối trang phục trực quan trên canvas 2D, hỗ trợ kéo thả, biến đổi lớp, hoàn tác và làm lại.
- Duyệt danh mục Việt phục theo loại trang phục, dịp sử dụng, giới tính và biến thể màu.
- Kiểm tra mức độ phù hợp với các quy tắc văn hóa, kèm giải thích và gợi ý điều chỉnh.
- Phân tích bảng màu, độ tương phản và đề xuất phối màu.
- Gợi ý trang phục theo thời tiết thực tế từ Open-Meteo, có dữ liệu dự phòng khi mất kết nối.
- Gợi ý phối đồ bằng Gemini; tự động chuyển sang bộ luật nội bộ nếu chưa cấu hình API key hoặc API gặp lỗi.
- Lưu phiên bản bộ phối, so sánh hai bộ phối, xuất ảnh và quản lý lookbook.
- Chia sẻ lookbook bằng liên kết công khai có thời hạn.
- Lookbook cộng đồng: đăng bài với quyền xem riêng, khám phá, lưu yêu thích, hồ sơ tác giả, báo cáo và kiểm duyệt.
- Workplace Stylist: gửi trang phục vào kho, tách nền ảnh và theo dõi nội dung gửi duyệt theo quyền tài khoản.
- Đăng ký, đăng nhập email/mật khẩu, Google Sign-In và phân quyền `user`, `stylist`, `editor`, `admin`.
- Quản trị danh mục, biến thể, quy tắc văn hóa và bài viết di sản.
- Lưu media trên Cloudflare R2 hoặc thư mục local trong môi trường phát triển.

> [!NOTE]
> Thử đồ AI gửi ảnh bản phối Studio làm tham chiếu; ảnh nhân vật là tùy chọn. Có ảnh nhân vật, prompt yêu cầu giữ danh tính người đó; không có ảnh, AI chọn người mặc trưởng thành phù hợp. Sinh ảnh thử đồ bằng Gemini mặc định tắt và API trả HTTP `503` nếu chưa cấu hình. Chế độ thủ công cho tải ảnh bản phối và sao chép prompt; lưu bộ phối lên tài khoản cần đăng nhập.

### Ảnh trang phục trong phiên

Người dùng đã đăng nhập có thể tải ảnh PNG, JPEG hoặc WebP để tách nền, phối và xuất PNG; mỗi ảnh tối đa 10 MB, tối đa 12 ảnh trong phiên. Ảnh chỉ được giữ trong bộ nhớ của phiên hiện tại và được xóa khi tải lại trang, đăng xuất hoặc đổi tài khoản. Bộ phối có ảnh trong phiên cần bỏ các ảnh đó trước khi lưu, đăng Lookbook hoặc thử đồ AI.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| Studio 2D | React/SVG; HTML Canvas để xuất PNG |
| Backend | Python 3.11+, FastAPI, Pydantic |
| Database runtime | PostgreSQL trên Supabase, migration chạy tường minh |
| Xác thực | JWT HS256, Google Identity Services |
| AI | Google Gemini API, rule-based fallback |
| Thời tiết | Open-Meteo |
| Lưu trữ | Cloudflare R2; thư mục media local cho môi trường phát triển/test |
| Kiểm thử | Pytest, Playwright |

## Cấu trúc thư mục

```text
.
├── backend/                 # FastAPI API, nghiệp vụ và worker
│   ├── app/
│   │   ├── core/            # Cấu hình, database, bảo mật, xử lý lỗi
│   │   ├── infrastructure/  # Gemini và Cloudflare R2
│   │   └── modules/         # Các module nghiệp vụ
│   ├── scripts/             # Script quản trị và nhập/xuất dữ liệu
│   ├── tests/               # Kiểm thử backend
│   ├── run_app.bat          # Khởi động hệ thống trên Windows
│   ├── start_dev.bat        # Khởi động môi trường phát triển
│   └── stop_dev.bat         # Dừng dịch vụ trên cổng 3000 và 4000
├── frontend/                # Ứng dụng Next.js
│   ├── public/              # Tài nguyên tĩnh
│   ├── src/app/             # Các route App Router
│   ├── src/components/      # Component dùng chung
│   ├── src/features/studio/ # Studio phối đồ 2D
│   └── tests/               # Kiểm thử Playwright
├── media_storage/           # Media local cho test/phát triển
├── shared/openapi.json      # Đặc tả API dùng chung
├── supabase/                # Di sản migration/seed cũ; runtime schema ở backend/app/data
└── docs/                    # Quy ước, hướng dẫn Google AI Studio, nghiên cứu và kế hoạch
```

## Yêu cầu hệ thống

- Python 3.11 trở lên.
- Node.js 20 trở lên và npm; phiên bản Playwright hiện tại yêu cầu Node.js 20+.
- Windows PowerShell cho các lệnh minh họa bên dưới. Trên macOS/Linux, dùng lệnh kích hoạt virtual environment tương ứng.

Runtime dùng PostgreSQL (có thể dùng Supabase). Production lưu media trên Cloudflare R2; development/test có thể dùng thư mục media local. Gemini sinh ảnh và Google OAuth chỉ hoạt động khi được cấu hình; SQLite chỉ dùng cho test.

## Cài đặt

### 1. Backend

Từ thư mục gốc của dự án:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e "./backend[dev]"
Copy-Item backend\.env.example backend\.env
```

Điền URI PostgreSQL Session pooler và cấu hình storage trong `backend/.env` trước khi chạy các lệnh migration bên dưới; không commit file này lên Git. Chi tiết cấu hình và lệnh kiểm tra kết nối có trong [backend/README.md](backend/README.md).

```powershell
Set-Location backend
python scripts/migrate.py --dry-run
python scripts/migrate.py
python scripts/migrate.py --check
Set-Location ..
```

Migration chỉ tạo/kiểm tra schema, không tự nạp tài khoản, trang phục hoặc dữ liệu văn hóa. Bổ sung dữ liệu nghiệp vụ qua luồng quản trị và các bước nhập dữ liệu trong hướng dẫn backend.

### 2. Frontend

```powershell
Copy-Item frontend\.env.example frontend\.env.local
Set-Location frontend
npm ci
Set-Location ..
```

Giá trị mặc định `NEXT_PUBLIC_API_ORIGIN=http://localhost:4000` đã phù hợp với môi trường local.

## Chạy ứng dụng

Mở hai cửa sổ terminal tại thư mục gốc.

Terminal 1 — Backend:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --app-dir backend --env-file backend\.env --host 127.0.0.1 --port 4000 --reload
```

Terminal 2 — Frontend:

```powershell
Set-Location frontend
npm run dev
```

Sau khi khởi động:

- Giao diện: <http://localhost:3000>
- API health check: <http://localhost:4000/health>
- Swagger UI: <http://localhost:4000/docs>
- ReDoc: <http://localhost:4000/redoc>

Trước lần chạy backend đầu tiên, cấu hình PostgreSQL Supabase rồi chạy migration từ thư mục `backend` như hướng dẫn trên; startup chỉ kiểm tra schema, không tự tạo bảng hoặc nạp dữ liệu mẫu. SQLite chỉ dùng trong test.

### Khởi động nhanh trên Windows

Các script Windows dùng `python` trong `PATH` và kế thừa biến môi trường của terminal. Trước khi chạy, kích hoạt `.venv`, nạp cấu hình backend vào môi trường và bảo đảm migration đã hoàn tất. Script hiện không tự đọc `backend/.env`.

```powershell
.\.venv\Scripts\Activate.ps1
.\backend\start_dev.bat
```

Để dừng các tiến trình đang lắng nghe trên cổng 3000 và 4000:

```powershell
.\backend\stop_dev.bat
```

Quy trình hai terminal ở trên nạp `backend/.env` tường minh bằng `--env-file` và là cách khởi động phù hợp với cấu hình cài đặt mẫu.

### Phát triển với Google AI Studio

Công cụ hỗ trợ phát triển được chủ dự án chọn là [Google AI Studio](https://aistudio.google.com/). Cung cấp yêu cầu, source liên quan và [hướng dẫn làm việc](./docs/google-ai-studio.md) cho từng task; phần frontend có [hướng dẫn riêng](./docs/google-ai-studio-frontend.md).

Sau khi áp dụng thay đổi, chạy các lệnh kiểm thử tương ứng trong repository. Khởi động ứng dụng bằng quy trình hai terminal hoặc script Windows ở trên. Quy ước cộng tác và hướng dẫn Git nằm trong [`docs/rule.md`](./docs/rule.md).

## Cấu hình môi trường

### Backend — `backend/.env`

| Biến | Mục đích | Bắt buộc |
| --- | --- | --- |
| `ENVIRONMENT`, `HOST`, `PORT`, `DEBUG` | Cấu hình máy chủ FastAPI | Không |
| `CORS_ORIGINS` | Danh sách origin được phép truy cập API | Không |
| `SUPABASE_DATABASE_URL` | URI PostgreSQL ưu tiên cho runtime; có thể dùng `DATABASE_URL` PostgreSQL thay thế | Có nếu chưa đặt `DATABASE_URL` PostgreSQL |
| `DATABASE_SCHEMA`, `DATABASE_POOL_SIZE` | Schema riêng và giới hạn kết nối mỗi process; mặc định `vietstylist` và `8` | Không |
| `JWT_SIGNING_SECRET` | Ký và xác minh access token của ứng dụng | Có cho production |
| `FRONTEND_PUBLIC_ORIGIN`, `API_PUBLIC_ORIGIN` | Origin HTTPS thật để tạo link chia sẻ và URL API | Có cho production |
| `GOOGLE_CLIENT_ID` | Xác minh Google ID token ở backend | Chỉ khi dùng Google Sign-In |
| `GEMINI_API_KEY` | Bật gợi ý phối đồ qua Gemini | Không |
| `GEMINI_MODEL_TEXT` | Model Gemini dùng cho gợi ý văn bản | Không |
| `GEMINI_MODEL_IMAGE` | Model Gemini có khả năng trả về ảnh | Chỉ khi dùng AI Virtual Try-On |
| `GEMINI_TRY_ON_ENABLED` | Bật API sinh ảnh V3 sau khi kiểm tra provider; endpoint F05 cũ vẫn chưa triển khai | Không |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Lưu ảnh và video trên Cloudflare R2 | Có cho production |
| `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_PUBLIC_DOMAIN` | Bucket riêng/công khai và domain HTTPS cho ảnh công khai | Có cho production |
| `LOCAL_MEDIA_DIR` | Cache ảnh tách nền trên backend; media local chỉ dùng cho test/development | Không |
| `LOOKBOOK_COMMUNITY_ENABLED` | Bật Lookbook cộng đồng; mặc định `true` | Không |
| `FFPROBE_PATH` | Đường dẫn `ffprobe` để kiểm tra video nếu binary không nằm trong `PATH` | Khi nhận video |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` dành cho tích hợp mở rộng. Backend dùng PostgreSQL ở runtime; chạy migration tường minh theo [hướng dẫn backend](backend/README.md) trước khi khởi động. Không chuyển dữ liệu từ SQLite test sang Supabase.

### Frontend — `frontend/.env.local`

| Biến | Mục đích | Bắt buộc |
| --- | --- | --- |
| `NEXT_PUBLIC_API_ORIGIN` | Origin của FastAPI backend | Có |
| `NEXT_PUBLIC_APP_NAME` | Tên hiển thị của ứng dụng | Không |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth client ID phía trình duyệt | Chỉ khi dùng Google Sign-In |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL cho tích hợp mở rộng | Không |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Không |
| `NEXT_PUBLIC_STUDIO_V3` | Bật bảng kiểm tra văn hóa V3 trong Studio; mặc định `false`, đổi giá trị cần build lại | Không |

Trong production, đặt `ENVIRONMENT=production`, `DEBUG=false`, JWT secret mạnh, origin HTTPS thật cho frontend/API/R2 và `CORS_ORIGINS` chứa origin frontend. Dùng đủ credential R2 và hai bucket public/private khác nhau; không đưa secret backend vào biến có tiền tố `NEXT_PUBLIC_`.

Chạy từ `frontend/`, thay origin ví dụ bằng origin API deploy thực tế:

```powershell
$env:NEXT_PUBLIC_API_ORIGIN = "https://api.example.com"
npm run build:production
npm run start
```

Script kiểm tra origin trước build đọc biến môi trường của process, không tự nạp `.env.local`; vì vậy cần đặt biến như trên. Lệnh từ chối URL localhost/HTTP. Đổi origin API cần build lại. Link Lookbook trong UI dùng origin của trang đang mở. Trước khi mở traffic, chuẩn bị model tách nền, cấu hình cleanup media theo [hướng dẫn backend](backend/README.md), kiểm tra `/ready` và chạy smoke trên domain deploy. Cài `ffprobe` nếu sử dụng upload video.

## Các nhóm API

Tất cả API nghiệp vụ sử dụng tiền tố `/api`:

| Nhóm | Prefix | Chức năng |
| --- | --- | --- |
| Authentication | `/api/auth` | Đăng ký, đăng nhập, Google auth, thông tin tài khoản |
| Catalog | `/api/catalog` | Loại trang phục, dịp, item, avatar, bộ phối mẫu |
| Heritage | `/api/heritage` | Bài viết và nguồn tư liệu di sản |
| Cultural Check | `/api/cultural-check` | Kiểm tra quy tắc văn hóa |
| Color Analysis | `/api/color-analysis` | Phân tích hòa sắc và tương phản |
| Weather | `/api/weather` | Thời tiết và lời khuyên trang phục |
| Recommendations | `/api/recommendations` | Gợi ý theo ngữ cảnh hoặc prompt |
| Outfits | `/api/outfits` | CRUD, phiên bản và so sánh bộ phối |
| Lookbooks | `/api/lookbooks` | CRUD lookbook và tạo liên kết chia sẻ |
| Lookbook Community | `/api/lookbook-posts` | Bài đăng, quyền xem, yêu thích, hồ sơ, chia sẻ và kiểm duyệt |
| Shares | `/api/shares` | Xem lookbook được chia sẻ công khai |
| Media | `/api/media` | Upload, truy cập và xóa media |
| Admin | `/api/admin` | Quản trị nội dung theo RBAC |
| Stylist | `/api/stylist` | Tách nền ảnh và gửi trang phục duyệt vào kho |
| Cultural Data V3 | `/api/v3` | Dữ liệu văn hóa có nguồn, kiểm tra bộ phối và tác vụ sinh ảnh |
| Solution Form | `/api/solution-form` | Đọc/cập nhật form trình bày giải pháp của tài khoản |
| Legacy Try-On | `/api/ai` | Tạo tác vụ thử đồ cũ trả `503 TRY_ON_UNAVAILABLE`; đọc trạng thái tác vụ cũ |

Chi tiết request/response và các endpoint còn lại được cập nhật trực tiếp tại Swagger UI khi backend đang chạy.

## Kiểm thử và kiểm tra chất lượng

Backend, chạy từ thư mục gốc:

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location backend
pytest
Set-Location ..
python backend/scripts/export_openapi.py --check
```

Frontend, chạy từ thư mục gốc; kích hoạt `.venv` để nhóm integration dùng đúng Python backend:

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location frontend
npm run check:public
npm run test:public
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm test
npm run test:integration
Set-Location ..
```

`npm test` tự khởi động frontend trên cổng 3100 và mock API. `npm run test:integration` tự khởi động frontend trên 3100 cùng backend thật trên 4100, dùng SQLite/media tạm và provider giả. Không cần khởi động backend riêng cho hai nhóm này. Các probe PostgreSQL chạy khi đặt `TEST_POSTGRES_URL`; xem [hướng dẫn backend](backend/README.md). Kết quả mock hoặc SQLite không thay thế kiểm chứng PostgreSQL, Gemini, Google OAuth và R2 trên môi trường deploy.

## Ghi chú phát triển

- Development dùng PostgreSQL; SQLite chỉ phục vụ test. Database SQLite tạm và thư mục media local được bỏ qua trong `.gitignore`.
- Bản phối chưa lưu chỉ ở bộ nhớ phiên của ứng dụng khi chuyển trang; tải lại/đóng tab, đăng xuất hoặc đổi tài khoản sẽ xóa bản chưa lưu. Bộ phối đã lưu được tải lại từ server.
- Không chỉnh sửa trực tiếp dữ liệu production bằng các script trong `backend/scripts/` nếu chưa kiểm tra tham số và sao lưu.
- `backend/app/worker.py` thuộc luồng try-on cũ và đánh dấu tác vụ là chưa khả dụng. Luồng sinh ảnh V3 được quản lý trong process API; Studio 2D không cần chạy worker này.
- Khi thay đổi contract API, cập nhật `shared/openapi.json` và các type tương ứng trong `frontend/src/lib/types/api.ts`.
