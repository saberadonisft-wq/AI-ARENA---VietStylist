# VietStylist — Việt phục Remix

VietStylist là nền tảng web hỗ trợ khám phá, phối và lưu trữ các bộ Việt phục. Dự án kết hợp Studio phối đồ 2D, kho tri thức cổ phục, kiểm tra quy tắc văn hóa, phân tích màu sắc, gợi ý theo thời tiết và quản lý lookbook trong một trải nghiệm thống nhất.

## Tính năng chính

- Phối trang phục trực quan trên canvas 2D, hỗ trợ kéo thả, biến đổi lớp, hoàn tác và làm lại.
- Duyệt danh mục Việt phục theo loại trang phục, dịp sử dụng, giới tính và biến thể màu.
- Kiểm tra mức độ phù hợp với các quy tắc văn hóa, kèm giải thích và gợi ý điều chỉnh.
- Phân tích bảng màu, độ tương phản và đề xuất phối màu.
- Gợi ý trang phục theo thời tiết thực tế từ Open-Meteo, có dữ liệu dự phòng khi mất kết nối.
- Gợi ý phối đồ bằng Gemini; tự động chuyển sang bộ luật nội bộ nếu chưa cấu hình API key hoặc API gặp lỗi.
- Lưu phiên bản bộ phối, so sánh hai bộ phối, xuất ảnh và quản lý lookbook.
- Chia sẻ lookbook bằng liên kết công khai có thời hạn.
- Đăng ký, đăng nhập email/mật khẩu, Google Sign-In và phân quyền `user`, `stylist`, `editor`, `admin`.
- Quản trị danh mục, biến thể, quy tắc văn hóa và bài viết di sản.
- Lưu media trên Cloudflare R2 hoặc thư mục local trong môi trường phát triển.

> [!NOTE]
> Tính năng AI Virtual Try-On hiện chưa nối với dịch vụ sinh ảnh và chủ động trả về HTTP `503`. Studio phối đồ 2D và xuất ảnh vẫn hoạt động bình thường.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Studio 2D | Konva, React Konva |
| Backend | Python 3.11+, FastAPI, Pydantic |
| Database local | SQLite, tự khởi tạo schema và dữ liệu mẫu |
| Xác thực | JWT HS256, Google Identity Services |
| AI | Google Gemini API, rule-based fallback |
| Thời tiết | Open-Meteo |
| Lưu trữ | Cloudflare R2, local storage fallback |
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
│   └── tests/               # Kiểm thử backend
├── frontend/                # Ứng dụng Next.js
│   ├── public/              # Tài nguyên tĩnh
│   ├── src/app/             # Các route App Router
│   ├── src/components/      # Component dùng chung
│   ├── src/features/studio/ # Studio phối đồ 2D
│   └── tests/               # Kiểm thử Playwright
├── media_storage/           # Media local khi không dùng R2
├── shared/openapi.json      # Đặc tả API dùng chung
├── supabase/                # Migration PostgreSQL và seed data
├── start_dev.bat            # Khởi động nhanh trên Windows
└── stop_dev.bat             # Dừng dịch vụ trên cổng 3000 và 4000
```

## Yêu cầu hệ thống

- Python 3.11 trở lên.
- Node.js 18.17 trở lên và npm.
- Windows PowerShell cho các lệnh minh họa bên dưới. Trên macOS/Linux, dùng lệnh kích hoạt virtual environment tương ứng.

Các dịch vụ Gemini, Supabase, Google OAuth và Cloudflare R2 là tùy chọn. Cấu hình mặc định vẫn chạy local bằng SQLite, media local và bộ gợi ý theo luật.

## Cài đặt

### 1. Backend

Từ thư mục gốc của dự án:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install "fastapi>=0.115.0" "uvicorn[standard]>=0.34.0" "pydantic>=2.10.0" "pydantic-settings>=2.7.0" "pyjwt[crypto]>=2.10.0" "httpx>=0.28.0" "boto3>=1.35.0" "python-multipart>=0.0.20" "aiofiles>=24.1.0" "pytest>=8.3.0" "pytest-asyncio>=0.24.0"
Copy-Item backend\.env.example backend\.env
```

Chỉnh `backend/.env` nếu cần tích hợp dịch vụ ngoài. Không commit file này lên Git.

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

Ở lần chạy backend đầu tiên, ứng dụng tự tạo `backend/viet_phuc_remix.db`, khởi tạo schema và nạp dữ liệu mẫu từ `supabase/seed.sql`.

### Khởi động nhanh trên Windows

Sau khi đã cài dependencies, có thể chạy:

```powershell
.\start_dev.bat
```

Để dừng các tiến trình đang lắng nghe trên cổng 3000 và 4000:

```powershell
.\stop_dev.bat
```

Quy trình hai terminal ở trên được khuyến nghị khi cần chắc chắn các biến trong `backend/.env` được nạp đầy đủ.

### Chạy bằng VS Code

Sau khi hoàn tất phần cài đặt, mở thư mục gốc của dự án bằng VS Code rồi nhấn `Ctrl+Shift+B`. Task mặc định **Start VietStylist (Backend + Frontend)** sẽ chạy song song FastAPI và Next.js trong hai terminal riêng.

Task Backend ưu tiên `.venv` ở thư mục gốc (nếu không có sẽ dùng `python` trong `PATH`) và tự nạp `backend/.env`. Để dừng, nhấn `Ctrl+C` trong hai terminal hoặc chạy task **Stop VietStylist** từ Command Palette. Quy ước cộng tác và hướng dẫn Git chi tiết nằm trong [`rule.md`](./rule.md).

## Cấu hình môi trường

### Backend — `backend/.env`

| Biến | Mục đích | Bắt buộc |
| --- | --- | --- |
| `ENVIRONMENT`, `HOST`, `PORT`, `DEBUG` | Cấu hình máy chủ FastAPI | Không |
| `CORS_ORIGINS` | Danh sách origin được phép truy cập API | Không |
| `DATABASE_URL` | Đường dẫn SQLite; mặc định `sqlite:///./viet_phuc_remix.db` | Không |
| `SUPABASE_JWT_SECRET` | Ký và xác minh access token | Có cho môi trường production |
| `GOOGLE_CLIENT_ID` | Xác minh Google ID token ở backend | Chỉ khi dùng Google Sign-In |
| `GEMINI_API_KEY` | Bật gợi ý phối đồ qua Gemini | Không |
| `GEMINI_MODEL_TEXT` | Model Gemini dùng cho gợi ý văn bản | Không |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Bật lưu trữ Cloudflare R2 | Không |
| `R2_BUCKET_PUBLIC`, `R2_BUCKET_PRIVATE`, `R2_PUBLIC_DOMAIN` | Tên bucket và public domain của R2 | Không |
| `LOCAL_MEDIA_DIR` | Thư mục media fallback | Không |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` và `SUPABASE_SERVICE_ROLE_KEY` đã có chỗ cấu hình để phục vụ tích hợp mở rộng. Runtime database hiện tại của backend sử dụng lớp truy cập SQLite; migration PostgreSQL nằm trong `supabase/migrations/`.

### Frontend — `frontend/.env.local`

| Biến | Mục đích | Bắt buộc |
| --- | --- | --- |
| `NEXT_PUBLIC_API_ORIGIN` | Origin của FastAPI backend | Có |
| `NEXT_PUBLIC_APP_NAME` | Tên hiển thị của ứng dụng | Không |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | OAuth client ID phía trình duyệt | Chỉ khi dùng Google Sign-In |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL cho tích hợp mở rộng | Không |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Không |

Trong production, hãy thay toàn bộ secret mặc định, giới hạn `CORS_ORIGINS` theo domain thật và không đưa secret backend vào biến có tiền tố `NEXT_PUBLIC_`.

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
| Shares | `/api/shares` | Xem lookbook được chia sẻ công khai |
| Media | `/api/media` | Upload, truy cập và xóa media |
| Admin | `/api/admin` | Quản trị nội dung theo RBAC |

Chi tiết request/response và các endpoint còn lại được cập nhật trực tiếp tại Swagger UI khi backend đang chạy.

## Kiểm thử và kiểm tra chất lượng

Backend:

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location backend
pytest
```

Frontend:

```powershell
Set-Location frontend
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Bộ test Playwright tự khởi động frontend trên cổng 3100 và mock các API cần thiết, vì vậy không cần chạy backend riêng cho nhóm test này.

## Ghi chú phát triển

- Dữ liệu local được lưu trong SQLite và media local; cả hai đã được bỏ qua trong `.gitignore`.
- Không chỉnh sửa trực tiếp dữ liệu production bằng các script trong `backend/scripts/` nếu chưa kiểm tra tham số và sao lưu.
- Worker hiện chỉ đánh dấu tác vụ try-on là chưa khả dụng; không cần chạy worker cho luồng Studio 2D thông thường.
- Khi thay đổi contract API, cập nhật `shared/openapi.json` và các type tương ứng trong `frontend/src/lib/types/api.ts`.
