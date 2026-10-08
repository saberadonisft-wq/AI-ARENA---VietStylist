# Hướng dẫn frontend cho Google AI Studio

Áp dụng [hướng dẫn Google AI Studio](./google-ai-studio.md) và [quy ước cộng tác](./rule.md). Cung cấp nội dung này cùng source frontend và yêu cầu của từng task. Các lệnh bên dưới chạy từ thư mục `frontend/`.

- Đọc phiên bản Next.js, React và dependency trong `package.json` cùng lockfile trước khi thay đổi API hoặc cấu hình. Dùng tài liệu đi kèm package nếu có, hoặc tài liệu chính thức phù hợp với phiên bản đang cài.
- Giữ cấu trúc App Router, component, hook và API client hiện có. Không thay đổi backend hay OpenAPI để hợp thức hóa mock frontend.
- Giữ luồng outfit/draft, dữ liệu trong bộ nhớ phiên, đăng nhập, chuyển tài khoản và optimistic revision lock khi sửa Studio.
- Với thay đổi giao diện, kiểm tra responsive, bàn phím, accessibility và các trạng thái loading, empty, retry, error. Không đưa chi tiết triển khai vào luồng sử dụng nếu người dùng không cần biết.
- Khi thay đổi logic, chạy `npm run typecheck` và các test liên quan; kiểm tra production build khi thay đổi ảnh hưởng bundle hoặc cấu hình. Kiểm thử tích hợp dùng `npm run test:integration` với backend tạm.
- Phân biệt kết quả provider, fallback và mock. Không kết luận chất lượng Gemini hoặc nghiệm thu thiết bị thật chỉ từ fixture trình duyệt.
- Không commit `.env.local`, dependency directory, build output, cache, screenshot hoặc báo cáo test sinh tự động.
