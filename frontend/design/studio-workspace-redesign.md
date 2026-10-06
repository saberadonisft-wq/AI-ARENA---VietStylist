# Studio VietStylist — giao diện light theme

Ngày kiểm tra: 07/10/2026. Phạm vi: bố cục và cách truy cập công cụ Studio. Giữ các handler, dữ liệu bản phối, API và cơ chế lưu hiện có.

## Bố cục đã thực hiện

Thanh điều hướng chung vẫn có logo, Studio Phối đồ, Thư viện Cổ phục, Lookbook, Chuyện Cổ phục, đăng nhập và đăng ký; trên màn hình hẹp dùng menu điều hướng sẵn có. Studio chiếm phần màn hình còn lại bên dưới thanh này.

Nền trắng ngà, bảng công cụ trắng, chữ tối và điểm nhấn đỏ VietStylist. Artboard giữ màu nền mà người dùng đã chọn. Canvas là bảng phối có kích thước và tỷ lệ xác định; thu phóng chỉ thay đổi vùng xem.

| Chức năng hiện có | Vị trí trong giao diện mới |
| --- | --- |
| Tên bản phối, Truyền thống / Remix / Cách tân | Thanh phía trên |
| Lưu, xuất PNG, đăng lên Lookbook, ghim/so sánh A/B | Thanh phía trên; menu Thao tác bộ phối trên điện thoại |
| Lưu thành bản mới, thử đồ AI, mở các bản khôi phục | Menu Thao tác bộ phối |
| Chọn nhóm trang phục, sáu vị trí, khóa vị trí, chọn món | Trang phục; bổ sung ô tìm theo tên |
| Mẫu phối, xác nhận thay bản hiện tại, giữ nháp cũ | Mẫu phối |
| Phân tích màu, gợi ý biến thể, năm bảng ngũ hành | Màu sắc |
| Tỷ lệ 9:16 / 1:1, nền trắng / giấy dó / theo dịp, độ mờ, căn lại | Bối cảnh |
| Dịp sử dụng, thời tiết, chọn thành phố, xác nhận thay phụ kiện | Bối cảnh |
| Hữu nhậm / Tả nhậm, giải thích, cảnh báo và sửa nhanh văn hóa | Văn hóa |
| Thẩm định V3, nguồn, bộ dữ liệu và bối cảnh riêng khi bật cờ V3 | Văn hóa |
| Bảng câu hỏi gợi ý AI, kết quả xem trước, áp dụng, lỗi và thử lại | Trợ lý AI |
| Gemini, ảnh nhân vật tùy chọn, xuất ảnh/prompt thủ công | Trợ lý AI và menu Thao tác bộ phối |
| Chọn món đang điều chỉnh, khóa/xóa, cỡ, góc xoay, dịch bước, đặt lại | Món đang chọn |
| Biến thể màu/chất liệu, về màu gốc, giới hạn đổi màu an toàn | Món đang chọn |
| Kéo, đổi cỡ, xoay trực tiếp trên artboard | Canvas |
| Hoàn tác/làm lại, mức thu phóng, vừa khung | Thanh phía dưới canvas |
| Khôi phục nháp, quyền khách, thông báo thành công | Thông báo ở góc; có nút đóng |
| Xung đột lưu, bản phối từ liên kết, món không còn xuất bản, lỗi danh mục | Vùng thông tin ngay dưới thanh thao tác |

Các bảng công cụ được giữ mounted khi đóng hoặc đổi nhóm để không làm mất lựa chọn trong bảng câu hỏi AI, tìm kiếm hoặc dữ liệu đang tải. Điều chỉnh bản phối vẫn đi qua lịch sử, khóa món và cơ chế lưu hiện có.

## Responsive và bàn phím

- Desktop rộng có bảng công cụ bên trái và thuộc tính bên phải; màn hình hẹp đóng một bảng khi mở bảng còn lại.
- Điện thoại dùng thanh công cụ dưới cùng và bảng trượt trong vùng editor. Màn hình ngang thấp dùng thanh công cụ dọc để dành chiều cao cho canvas.
- Các bảng tự cuộn. Khi phóng to artboard, vuốt vùng trống để di chuyển vùng xem; kéo trên món đồ để chỉnh vị trí.
- Dùng các phím mũi tên, Home/End để chọn nhóm công cụ; Escape đóng menu/bảng và trả focus về nút mở. Các modal giữ cơ chế khóa cuộn và focus riêng hiện có.
- Thông báo không che thanh thao tác trên điện thoại; khi mở menu, thông báo tạm ẩn và trở lại sau khi chọn/đóng menu.
- Tôn trọng `prefers-reduced-motion`. Tắt huy hiệu dev của Next vì huy hiệu này che công cụ đầu tiên trên mobile local.

## Kiểm chứng

TypeScript, lint và production build được chạy ở local. Các bộ Playwright kiểm tra bố cục ở 320–1920 px, kéo thả cảm ứng, khóa/xóa/đặt lại, lịch sử, khôi phục/lưu, nền và PNG, so sánh, menu, đăng nhập, bảng câu hỏi AI và cờ V3.

Kết quả trên phần thay đổi được chuẩn bị để commit: 96 kiểm tra qua khi tắt V3; thêm 2 kiểm tra V3 qua khi bật cờ. Kiểm tra menu mobile được chạy lại sau sửa thao tác bấm icon và đã qua. TypeScript và build qua; lint có 0 lỗi và 51 cảnh báo của checkout hiện có. Build kiểm chứng dùng API origin local; chưa push hoặc triển khai.

Playwright sử dụng API fixture. Kết quả này kiểm chứng giao diện và các nhánh tương tác; không phải bằng chứng chất lượng ảnh Gemini, kết nối R2/DB thật hay thử nghiệm trên thiết bị vật lý.

Ảnh chụp bản chạy local với dữ liệu minh họa: [Desktop](studio-workspace-light-desktop.png), [Mobile](studio-workspace-light-mobile.png).
