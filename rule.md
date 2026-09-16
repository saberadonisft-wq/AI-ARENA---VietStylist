# Quy ước cộng tác VietStylist

Tài liệu này phân chia phạm vi làm việc giữa hai thành viên để hạn chế xung đột Git. Mỗi người chỉ chỉnh sửa vùng mình phụ trách; thay đổi xuyên ranh giới phải được thống nhất trước khi bắt đầu.

## 1. Phân chia quyền sở hữu

### 1.1. Ý nghĩa của “người phụ trách chính”

Người phụ trách chính của một khu vực có trách nhiệm:

- Thiết kế và triển khai thay đổi trong khu vực đó.
- Quyết định cấu trúc file, cách đặt tên và cách tổ chức code.
- Viết hoặc cập nhật test cho phần mình thay đổi.
- Review mọi pull request do người còn lại đề xuất vào khu vực mình sở hữu.
- Chịu trách nhiệm sửa lỗi nếu thay đổi của mình làm hỏng luồng tích hợp.

Người không phụ trách vẫn được đọc code, chạy test, review và gửi đề xuất. Tuy nhiên, không trực tiếp sửa hoặc commit vào khu vực của người kia nếu chưa được đồng ý.

### 1.2. Phạm vi của thành viên Frontend

Thành viên Frontend sở hữu toàn bộ `frontend/**`, bao gồm:

- `frontend/src/app/**`: page, layout, route và metadata của Next.js.
- `frontend/src/components/**`: component dùng chung, navigation, modal và UI primitives.
- `frontend/src/features/**`: state, component và hành vi của từng tính năng phía trình duyệt.
- `frontend/src/lib/api/**`: cách frontend gửi request và xử lý response từ backend.
- `frontend/src/lib/types/**`: type TypeScript được frontend sử dụng.
- `frontend/public/**`: ảnh và tài nguyên tĩnh của giao diện.
- `frontend/tests/**` và `frontend/playwright.config.ts`: kiểm thử giao diện.
- `frontend/package.json` và `frontend/package-lock.json`: dependencies và script Node.js.
- `frontend/.env.example`: tên biến môi trường công khai dành cho frontend. Không commit `.env.local`.

Frontend được quyền:

- Thay đổi giao diện, responsive, accessibility và trải nghiệm người dùng.
- Tạo component, hook, state hoặc type chỉ dùng trong frontend.
- Thay đổi cách hiển thị lỗi, loading, empty state và dữ liệu nhận từ API.
- Thêm package frontend và cập nhật đồng thời `package.json` cùng `package-lock.json`.
- Mock API trong Playwright, miễn mock vẫn tuân theo contract hiện tại.

Frontend không tự ý:

- Sửa router, schema Pydantic, service, repository hoặc database trong `backend/**`.
- Thay đổi tên endpoint, HTTP method, request body hoặc response từ phía backend.
- Sửa migration/seed để tạo dữ liệu vừa với giao diện.
- Chỉnh `shared/openapi.json` bằng tay để hợp thức hóa một mock frontend.
- Đưa secret vào biến có tiền tố `NEXT_PUBLIC_`.

Nếu UI cần dữ liệu backend chưa cung cấp, Frontend phải gửi yêu cầu contract theo mục 2. Backend triển khai và commit contract trước; Frontend cập nhật client sau.

### 1.3. Phạm vi của thành viên Backend

Thành viên Backend sở hữu toàn bộ `backend/**`, `supabase/**` và `shared/openapi.json`, bao gồm:

- `backend/app/modules/**`: router, schema, service và repository nghiệp vụ.
- `backend/app/core/**`: cấu hình, database, bảo mật và xử lý lỗi.
- `backend/app/infrastructure/**`: Gemini, Cloudflare R2 và dịch vụ ngoài.
- `backend/app/worker.py`: background worker.
- `backend/tests/**`: kiểm thử API và nghiệp vụ.
- `backend/scripts/**`: script quản trị, import/export và migration dữ liệu.
- `backend/pyproject.toml`: dependencies và cấu hình Python.
- `backend/.env.example`: tên biến môi trường backend. Không commit `.env`.
- `supabase/migrations/**` và `supabase/seed.sql`: schema và dữ liệu khởi tạo.
- `shared/openapi.json`: contract API mà Frontend sử dụng.

Backend được quyền:

- Thêm hoặc thay đổi endpoint, nghiệp vụ, schema và cơ chế lưu dữ liệu.
- Thêm dependency Python và cập nhật cấu hình backend.
- Thay đổi migration/seed, nhưng phải ghi rõ tác động và khả năng mất dữ liệu.
- Thay đổi contract API sau khi đã thông báo cho Frontend.
- Cung cấp dữ liệu fallback hoặc feature flag khi dịch vụ ngoài chưa sẵn sàng.

Backend không tự ý:

- Sửa page, component, CSS hoặc state trong `frontend/**` để “làm cho tính năng chạy”.
- Sửa type TypeScript thay cho Frontend.
- Thêm package Node.js hoặc cập nhật `package-lock.json`.
- Đổi contract API đã được Frontend sử dụng mà không thông báo breaking change.
- Trả response tạm thời khác contract rồi yêu cầu Frontend tự xử lý ngoại lệ.

Nếu Backend thay đổi response, Backend phải cập nhật `shared/openapi.json` và gửi ví dụ payload thực tế. Frontend chịu trách nhiệm cập nhật API client, type TypeScript và UI.

### 1.4. File dùng chung cần khóa trước khi sửa

Những file sau không thuộc riêng Frontend hay Backend:

- `README.md` và `rule.md`.
- `.gitignore` và toàn bộ `.vscode/**`.
- `run_app.bat`, `start_dev.bat`, `stop_dev.bat` và các script ở thư mục gốc.
- Tài liệu nghiên cứu, kế hoạch hoặc file cấu hình được đặt tại thư mục gốc.

Trước khi sửa file dùng chung, người thực hiện gửi một thông báo theo mẫu:

```text
[LOCK] README.md
Người sửa: Frontend
Mục đích: cập nhật hướng dẫn chạy giao diện
Branch: frontend/update-readme
Dự kiến mở khóa: sau khi push commit
```

Chỉ bắt đầu sửa sau khi người còn lại xác nhận. Khi đã commit và push, gửi:

```text
[UNLOCK] README.md
Commit: <commit-hash>
Nội dung: cập nhật hướng dẫn chạy giao diện
```

“Khóa” ở đây là quy ước làm việc, không phải tính năng khóa thật của Git. Mỗi thời điểm chỉ một người được sửa một file dùng chung.

### 1.5. Cách xác định task thuộc về ai

| Tình huống | Người thực hiện | Cách phối hợp |
| --- | --- | --- |
| Đổi màu, layout, component hoặc responsive | Frontend | Không cần sửa Backend nếu contract không đổi |
| Thêm validation chỉ để hỗ trợ nhập liệu trên UI | Frontend | Validation Backend vẫn phải được giữ nguyên |
| Thêm validation nghiệp vụ hoặc quyền truy cập | Backend | Thông báo mã lỗi để Frontend hiển thị |
| Cần thêm field trong response | Backend trước, Frontend sau | Backend cập nhật contract rồi Frontend cập nhật type/UI |
| Tạo một tính năng có cả API và UI | Tách thành hai task | Thống nhất contract, Backend merge trước, Frontend tích hợp sau |
| Lỗi hiển thị nhưng API trả đúng contract | Frontend | Frontend sửa và bổ sung test giao diện |
| API trả sai dữ liệu hoặc sai status code | Backend | Backend sửa và bổ sung test API |
| Chưa rõ lỗi nằm ở đâu | Cả hai cùng chẩn đoán | Gửi request, response, log và bước tái hiện; người sở hữu nơi phát sinh lỗi sẽ sửa |
| Sửa tài liệu hoặc task VS Code | Người đã khóa file | Phải làm theo quy trình `[LOCK]`/`[UNLOCK]` |

### 1.6. Ví dụ ranh giới đúng và sai

Ví dụ đúng:

- Frontend cần thêm `avatar_url` trong trang tài khoản → gửi yêu cầu cho Backend → Backend thêm field, test và OpenAPI → Frontend pull commit rồi cập nhật UI.
- Backend đổi lỗi đăng nhập thành mã `INVALID_CREDENTIALS` → Backend báo mã lỗi và payload → Frontend quyết định nội dung hiển thị.
- Frontend phát hiện `/api/lookbooks` trả `500` → gửi request và log tái hiện → Backend sửa endpoint; Frontend không sửa service Python.

Ví dụ sai:

- Frontend sửa Pydantic schema để API chấp nhận form hiện tại.
- Backend sửa React component để hiển thị field response mới.
- Hai người cùng sửa `README.md`, sau đó một người chọn **Accept Current Change** cho toàn bộ conflict.
- Một người chạy formatter trên toàn repo và commit hàng trăm dòng không liên quan đến task.
- Frontend sửa `shared/openapi.json` trước khi endpoint thật tồn tại.

### 1.7. Quy tắc bắt buộc để tránh conflict

- Mỗi task dùng một branch riêng; không cùng làm trên một branch dùng chung.
- Không làm trực tiếp trên `main` và không force-push `main`.
- Không đồng thời chỉnh cùng một file, kể cả khi hai người sửa hai đoạn khác nhau.
- Không đổi tên, di chuyển hoặc xóa file thuộc khu vực của người kia.
- Không chạy format, lint fix hoặc thay thế chuỗi trên toàn repo nếu task chỉ thuộc một khu vực.
- Không dùng `git add .`, `git add -A` hoặc commit file ngoài phạm vi task khi working tree có thay đổi khác.
- Không commit file sinh tự động, secret, database hoặc dependency directory.
- Mọi thay đổi xuyên ranh giới phải được tách thành commit Backend và Frontend riêng.
- Người sở hữu khu vực phải review thay đổi trước khi merge nếu người còn lại có chỉnh vào khu vực đó.

## 2. Contract giữa Frontend và Backend

`shared/openapi.json` là nguồn mô tả API dùng chung và do Backend quản lý.

Khi thay đổi endpoint, Backend thực hiện theo thứ tự:

1. Sửa implementation, schema và test trong `backend/`.
2. Cập nhật `shared/openapi.json` trong cùng commit hoặc một commit contract ngay sau đó.
3. Ghi rõ endpoint thay đổi, request/response mới và breaking change trong nội dung commit hoặc pull request.
4. Đẩy commit để Frontend cập nhật branch trước khi sửa client.

Sau đó Frontend mới cập nhật `frontend/src/lib/api/client.ts`, `frontend/src/lib/types/api.ts` và UI liên quan. Không dựa vào thay đổi API chưa được commit.

Nếu cần một endpoint mới, Frontend nên gửi trước một contract ngắn gồm:

```text
METHOD /api/path
Request: { ... }
Success response: { ... }
Error cases: 400 | 401 | 403 | 404 | 409 | 422 | 500
```

## 3. Quy trình Git cho mỗi task

Không làm trực tiếp trên `main`. Mỗi task dùng một branch riêng:

```powershell
# Frontend
git switch main
git pull --rebase origin main
git switch -c frontend/ten-task

# Backend
git switch main
git pull --rebase origin main
git switch -c backend/ten-task
```

Trước khi lấy thay đổi mới, working tree phải sạch:

```powershell
git status
git pull --rebase origin main
```

Chỉ stage đúng file thuộc task. Không dùng `git add .` khi trong working tree có thay đổi của người khác:

```powershell
git add frontend/src/app/page.tsx
git commit -m "feat(frontend): mo ta ngan gon"
```

Ví dụ commit Backend:

```powershell
git add backend/app/modules shared/openapi.json
git commit -m "feat(backend): mo ta ngan gon"
```

Prefix commit khuyến nghị:

- `feat(frontend): ...`, `fix(frontend): ...`, `test(frontend): ...`
- `feat(backend): ...`, `fix(backend): ...`, `test(backend): ...`
- `docs: ...`, `chore: ...` cho file dùng chung đã được thống nhất.

Mỗi commit nên chỉ giải quyết một thay đổi logic. Không trộn refactor, format và tính năng vào cùng commit.

## 4. Trước khi merge

Frontend chạy:

```powershell
Set-Location frontend
npm run typecheck
npm run build
npm test
```

Backend chạy:

```powershell
.\.venv\Scripts\Activate.ps1
Set-Location backend
pytest
```

Trước khi tạo pull request hoặc merge:

```powershell
git fetch origin
git rebase origin/main
git status
```

Nếu có conflict trong file dùng chung, dừng lại và trao đổi người đang sở hữu thay đổi. Không tự động chọn toàn bộ `ours` hoặc `theirs`.

## 5. Những file không được commit

- `backend/.env`, `frontend/.env.local` và mọi file chứa secret.
- `.venv/`, `node_modules/`, `.next/`, cache và báo cáo test.
- Database SQLite local, media upload local và log.
- API key, access token, JWT secret hoặc thông tin tài khoản thật trong code, test hay tài liệu.

Chỉ cập nhật `.env.example` bằng placeholder khi bổ sung biến môi trường mới.

## 6. Chạy toàn bộ dự án bằng `Ctrl+Shift+B`

Repo đã có task mặc định tại `.vscode/tasks.json` để chạy Backend và Frontend song song. Task Backend ưu tiên `.venv` ở thư mục gốc; nếu không tìm thấy, task dùng lệnh `python` trong `PATH`.

Chuẩn bị một lần:

1. Tạo virtual environment `.venv` ở thư mục gốc và cài dependencies Backend theo README.
2. Tạo `backend/.env` từ `backend/.env.example`.
3. Tạo `frontend/.env.local` từ `frontend/.env.example`.
4. Chạy `npm ci` trong `frontend/`.
5. Mở đúng thư mục gốc `AI-ARENA---VietStylist` bằng VS Code.

Khởi động:

1. Nhấn `Ctrl+Shift+B`.
2. Nếu VS Code hỏi chọn task, chọn **Start VietStylist (Backend + Frontend)**.
3. VS Code sẽ mở hai terminal: FastAPI tại <http://127.0.0.1:4000> và Next.js tại <http://localhost:3000>.

Dừng ứng dụng bằng `Ctrl+C` trong hai terminal đang chạy, hoặc mở Command Palette và chọn **Tasks: Run Task** → **Stop VietStylist**.

Không nhấn `Ctrl+Shift+B` lần nữa khi hai server vẫn đang chạy. Task đã giới hạn một instance, nhưng nên dừng phiên cũ trước khi khởi động lại.
