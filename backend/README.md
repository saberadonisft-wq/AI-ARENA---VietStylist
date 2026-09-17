# VietStylist Backend API (Việt Phục Remix)

REST API phục vụ nền tảng số hóa, lưu trữ di sản và phối đồ Việt phục truyền thống.

## Công nghệ sử dụng
- **Ngôn ngữ & Framework:** Python >= 3.11, FastAPI, Pydantic v2
- **Database:** SQLite (M1-BE) với schema versioning và migration tự động
- **Media Storage:** Cloudflare R2 (S3-compatible) & Local storage an toàn
- **AI Integration:** Google Gemini 2.5 Structured Output & Di sản fallback rules

## Khởi chạy & Vận hành

### 1. Cài đặt môi trường
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -e ".[dev]"
```

### 2. Cấu hình biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

### 3. Chạy Server
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 4000 --reload
```
Tài liệu tương tác:
- Swagger UI: `http://127.0.0.1:4000/docs`
- ReDoc: `http://127.0.0.1:4000/redoc`
- OpenAPI JSON: `http://127.0.0.1:4000/openapi.json`
- Liveness Probe: `http://127.0.0.1:4000/health`
- Readiness Probe: `http://127.0.0.1:4000/ready`

### 4. Kiểm thử & Đo lường
```bash
# Chạy toàn bộ test suites
python -m pytest backend/tests

# Kiểm tra lệch contract OpenAPI
python backend/scripts/export_openapi.py --check

# Chạy benchmark hiệu năng truy vấn
python backend/scripts/benchmark.py
```
