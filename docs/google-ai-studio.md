# Hướng dẫn phát triển VietStylist với Google AI Studio

Chủ dự án chọn [Google AI Studio](https://aistudio.google.com/) làm công cụ hỗ trợ phát triển cho các công việc tiếp theo. Cung cấp nội dung hướng dẫn này cùng yêu cầu và source liên quan trong mỗi task. Các đường dẫn source và lệnh bên dưới được tính từ thư mục gốc repository.

## Quy ước chung

Áp dụng [quy ước cộng tác](./rule.md).

- Trước khi sửa, kiểm tra branch, HEAD và working tree; bảo toàn thay đổi đang có. Không tự reset, stash, rebase hoặc đổi branch khi chưa bảo toàn công việc.
- Đọc implementation và kiểm chứng lại vấn đề trước khi sửa. Kế hoạch, báo cáo và benchmark có ngày tháng là bằng chứng của thời điểm ghi nhận, không tự động mô tả runtime hiện tại.
- Cung cấp source hiện tại và contract liên quan để phân tích; không suy ra implementation chỉ từ tên file hoặc báo cáo cũ.
- Sửa trong phạm vi task đã được chủ dự án giao. Không thay đổi contract, migration, giao diện hoặc dependency chỉ để che một lỗi ở khu vực khác.
- Không ghi secret, JWT, signed URL, thông tin tài khoản hoặc ảnh cá nhân vào code, log và tài liệu. Test mặc định dùng dữ liệu tạm và không gọi Google, Gemini hay R2 thật.
- Giữ nguyên tác giả, giấy phép và nguồn trích dẫn của bên thứ ba. Không tự sửa lịch sử Git hoặc gán nguồn gốc cho mã không có bằng chứng.
- Với thay đổi nghiệp vụ, thêm regression cho tình huống lỗi và chạy các kiểm tra liên quan. Báo rõ test nào dùng mock, SQLite hoặc PostgreSQL thật.
- Báo riêng trạng thái kiểm thử local, CI, commit, push, merge và deploy. Chỉ xác nhận chất lượng ảnh/AI khi đã thử trên dữ liệu thật phù hợp.
- Khi chủ dự án yêu cầu dừng, dừng công việc ngay.

## Cấu trúc và nguồn đối chiếu

- `backend/`: FastAPI/Pydantic, nghiệp vụ, media và worker. Hướng dẫn chạy và migration nằm trong `backend/README.md`.
- `frontend/`: Next.js/React/TypeScript. Đọc thêm [hướng dẫn frontend](./google-ai-studio-frontend.md); phiên bản thư viện lấy từ `frontend/package.json` và lockfile.
- `shared/openapi.json`: contract API sinh từ backend; không chỉnh tay để khớp mock.
- PostgreSQL/Supabase và Cloudflare R2 là dịch vụ runtime; SQLite/media local phục vụ test hoặc phát triển có kiểm soát.
- Gemini API phục vụ chức năng AI trong ứng dụng. Luồng fallback phải giữ đúng nguồn và trạng thái, không được trình bày kết quả giả như một lần gọi Gemini thành công.
- `docs/backend-frontend-handoff-20260917.md`: tài liệu bàn giao được lưu theo trạng thái ngày 17/09/2026; đối chiếu source và README trước khi sử dụng.

Lệnh khởi động và kiểm tra hiện hành nằm trong `README.md`, `backend/README.md` và các script của từng package.

## Cung cấp yêu cầu trong Google AI Studio

1. Nêu mục tiêu, hành vi hiện tại, hành vi mong muốn và phạm vi file được sửa.
2. Cung cấp source, contract và lỗi liên quan sau khi loại bỏ secret và dữ liệu cá nhân.
3. Yêu cầu thay đổi cụ thể, giải thích nguyên nhân và các bước kiểm tra; đối chiếu kết quả với repository trước khi áp dụng.
4. Ghi lại kết quả kiểm thử thực tế trước khi xác nhận hoàn thành.

Tham khảo [tài liệu Google AI Studio](https://ai.google.dev/gemini-api/docs/aistudio-build-mode) khi sử dụng chức năng tạo ứng dụng.
