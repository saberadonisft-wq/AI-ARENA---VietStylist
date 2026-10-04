# Sửa 25 lỗi giao diện — 04/10/2026

Phạm vi: Studio, hộp so sánh/xuất ảnh/thử đồ, thời tiết, phân tích màu, Lookbook, tài khoản, chi tiết trang phục và đăng nhập. Giữ luồng bản nháp, khóa trang phục, hoàn tác/làm lại và tính năng nền theo hoàn cảnh có sẵn.

Nhánh sửa: `frontend/ui-detail-fixes-20261004`. Chưa commit hoặc deploy. Các thay đổi backend, OpenAPI, trang chủ, Chuyện Cổ phục và nền Studio có sẵn trong working tree không thuộc đợt sửa này.

## Đối chiếu với báo cáo rà soát

| Mục | Thay đổi | Kiểm chứng chính |
| --- | --- | --- |
| 01 | Xóa PNG cũ khi đóng/mở hoặc bản phối đổi; bỏ kết quả xuất trả về muộn của lần trước. | Mở lại sau đổi nền; đóng khi đang xuất rồi mở lại. |
| 02 | Giới hạn chiều cao hộp xuất; body cuộn, header và hàng nút tải/chia sẻ giữ trong panel. | Viewport ngang 844×390, đo vị trí nút tải. |
| 03 | Phím tắt Studio tôn trọng `defaultPrevented`, bỏ qua điều khiển nhập và hộp thoại đang mở. | Ctrl+Z trên select model AI giữ nguyên draft. |
| 04 | Kết quả thời tiết gắn với thành phố; bỏ kết quả cũ khi đổi, tải hoặc lỗi. | Hà Nội thành công → Huế thất bại → thử lại Huế. |
| 05 | Dùng native modal dialog, giữ focus, Escape và trả focus về nút mở. | Tab nhiều vòng trong so sánh, xuất ảnh, AI, Lookbook; Escape. |
| 06 | Công cụ thời tiết, màu sắc và so sánh có thông báo lỗi cùng nút thử lại. | HTTP 503 lần đầu, lần tiếp theo thành công. |
| 07 | Chấm chủ đạo/điểm xuyết dùng kích thước 18 px hợp lệ, không bị flex co. | Đo DOM cả hai chấm màu. |
| 08 | Nhãn Việt cho slot, style, occasion, gender; tra catalog name cho item; xử lý cả API trả ID trong trường name. | So sánh, tài khoản, Lookbook, chi tiết; tên bị thiếu. |
| 09 | Nội dung so sánh có `min-width: 0`, tên dài xuống dòng; body cuộn. | Màn hình 320 px, tên dài và bảng chi tiết. |
| 10 | Không gán niên đại Nguyễn khi thiếu; không tự thêm “Thời”; giá trị X được coi là chưa rõ. | Nhánh dữ liệu thiếu era và đọc hàm định dạng chung. |
| 11 | Nhãn trung tính “Ảnh trang phục” thay khẳng định ảnh thật/hiện vật. | Studio và trang chi tiết, ảnh qua catalog media. |
| 12 | Nút đóng so sánh/xuất có tên truy cập cụ thể. | Locator theo role và tên; dùng Escape/Tab. |
| 13 | Thành phố có tên truy cập; label Lookbook nối với input/textarea/select. | Chọn/nhập bằng `getByLabel`. |
| 14 | Phong cách, slot, tỷ lệ, swatch có trạng thái `aria-pressed`. | Kiểm tra trạng thái và thao tác; đọc markup tỷ lệ. |
| 15 | Thêm ghim lại và bỏ ghim A. | Ghim lại sau đổi phong cách, kiểm tra phương án A, bỏ ghim. |
| 16 | Thanh Studio có Cách tân hiện đại; tài khoản/Lookbook dùng đúng nhãn. | Chọn modern_fusion và tải snapshot đã lưu. |
| 17 | Khóa slot là button độc lập với tên và trạng thái, không lồng trong button đổi slot. | Focus + Enter khóa/mở khóa khăn vấn. |
| 18 | Xét cả headwear/footwear; giữ slot khóa; xác nhận thay món đã có. | Khăn đóng; hủy/xác nhận thay; hoàn tác; giữ áo ngoài. |
| 19 | Lỗi tạo Lookbook nằm trong form; giữ nội dung nhập, focus/scroll đến lỗi. | POST lỗi trên màn hình ngang; kiểm tra lỗi trong viewport. |
| 20 | Banner chia sẻ stack trên mobile, URL xuống dòng, nút sao chép đủ nhãn. | Token dài tại 320 px trên danh sách và trang chi tiết. |
| 21 | Tên toàn khoảng trắng có lỗi dưới input, focus về input, không POST. | Ba dấu cách → xác nhận → số request bằng 0. |
| 22 | Thẻ thư viện, thumbnail Studio và chi tiết dùng chung hàm giải quyết ảnh từ catalog_media_id/real_image_url. | Ảnh chỉ có catalog_media_id tải PNG, naturalWidth > 0. |
| 23 | Chỉ render cụm chất liệu khi chuỗi trim có nội dung. | Variant material rỗng không tạo “()”. |
| 24 | Thông báo Google chỉ đúng lựa chọn đang có; nút fallback tải lại SDK thật. | SDK lỗi rồi thử lại với SDK mô phỏng thành công. |
| 25 | Lỗi đăng nhập có role=alert; thành công có role=status. | DOM live region khi SDK lỗi; đọc nhánh thành công. |

Kiểm thử hồi quy nằm trong `tests/ui-detail-fixes.spec.ts`. Hai bài Studio cũ được cập nhật theo nhãn Remix mới; các bài còn lại được giữ.

## Kết quả kiểm chứng

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, exit 0. |
| `npm run lint` | Đạt kiểm tra chặn lỗi: 0 errors, 48 warnings. Cảnh báo chủ yếu về hook dependencies và img; không coi đây là lint không có cảnh báo. |
| `NEXT_DIST_DIR=.next-build npm run build` | Đạt, exit 0; public asset safety check và production compilation/type checking thành công. Trên PowerShell đặt `$env:NEXT_DIST_DIR = '.next-build'` trước khi chạy. |
| `npx playwright test --reporter=line` | 138 passed, 2 skipped, 0 failed; 12.9 phút. Hai bài UI Composer V3 bỏ qua vì `NEXT_PUBLIC_STUDIO_V3` không bật. |
| `npx playwright test --config playwright.ui-detail-fixes.config.ts --reporter=line` | 13/13 passed, 0 skipped/failed; 47.7 giây trên mã và kiểm thử cuối. |
| `git diff --check` | Đạt; chỉ có thông báo chuẩn hóa LF/CRLF của working tree Windows. |

Profile `playwright.ui-detail-fixes.config.ts` dùng output `.next-ui-detail-fixes` riêng, vẫn mô phỏng API ở cổng 4100. `tsconfig.json` có thêm đường dẫn types do Next sinh cho profile này. Lượt full suite được chạy trước khi bổ sung bài PNG trả về muộn; lượt hồi quy cuối bao gồm bài mới và các kiểm tra bổ sung.

Trong một lượt lặp với cache `.next-test`, lần tải đầu từng ghi nhận client SyntaxError và chưa hydrate Studio; các lần tải sau hoạt động. Bundle hiện tại kiểm tra bằng `node --check` hợp lệ, và lượt output riêng chạy từ đầu đạt 13/13. Chưa xác định được nguyên nhân của lần lỗi dev đó; không dùng nó để kết luận lỗi production đã được sửa hoặc đã được tái hiện.

## Giới hạn bằng chứng

Playwright dùng API và danh tính giả trong browser context riêng. Không tạo tài khoản, Lookbook hay ảnh AI thật. Kết quả chứng minh thao tác frontend và cách xử lý các trạng thái đã mô phỏng; chưa chứng minh đăng nhập Google thực, chất lượng Gemini, dữ liệu production, thiết bị vật lý hoặc trình đọc màn hình thực.

Ảnh kiểm tra được sinh trong `test-results/` (thư mục bỏ qua bởi Git). Các cảnh chính: xuất ảnh ngang, so sánh 320 px, lỗi Lookbook ngang và banner chia sẻ 320 px.
