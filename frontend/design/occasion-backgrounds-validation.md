# Kiểm tra nền Studio theo hoàn cảnh — 03/10/2026

## Phạm vi và trạng thái

Tiếp tục phần triển khai đã có trong working tree nhánh
`frontend/occasion-background-prototypes-20261003`. Không tạo lại hay ghi đè ảnh
trong lượt kiểm tra này. Bộ ảnh, logic Studio, schema backend và OpenAPI đã có
khi bắt đầu; lượt này bổ sung kiểm tra mở lại bản lưu từ API, đối chiếu pixel nền
PNG cho toàn bộ concept và chụp kiểm tra hai tỷ lệ với trang phục catalog thật.

Ảnh nằm tại `frontend/public/images/studio/occasions/`: 8 concept × 2 tỷ lệ,
16 WebP, tổng 2.822.626 byte. Bản dọc 900 × 1600; bản vuông 1200 × 1200.
Prompt, tên nguồn và nguồn tạo ảnh `built-in image_gen` được ghi trong
[`occasion-backgrounds.prompts.json`](occasion-backgrounds.prompts.json).

## Hành vi đã kiểm tra

- Chọn hoàn cảnh bật nền tương ứng; lựa chọn Trắng/Giấy dó vẫn hoạt động.
- Bỏ chọn hoàn cảnh khôi phục nền trung tính đã dùng.
- Món đồ, transform, màu và khóa giữ nguyên khi đổi nền.
- Hoàn tác, tải lại trang và mở bản lưu API sau khi xóa draft cục bộ khôi phục nền.
- Ảnh trả về chậm không thay thế hoàn cảnh mới; ảnh lỗi về nền trung tính và vẫn xuất được.
- PNG chia sẻ có nền hoàn cảnh; ảnh tham chiếu cho thử đồ AI có nền trắng.
- Hoàn cảnh trong phiếu AI chưa tác động draft trước khi bấm Áp dụng.
- Cả 16 nền tải được và pixel ở mép PNG khớp nền canvas xem trước, có dung sai
  cho nội suy ở kích thước xuất khác nhau.
- Kiểm thử giữ nguyên đồ/khóa và mở bản lưu ở viewport 375 và 1440 px.

## Kết quả chạy local

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt, chạy lại sau khi bổ sung test |
| `npm run lint` | 0 lỗi, 47 cảnh báo trên checkout hiện tại |
| ESLint riêng test và script vừa sửa | Đạt |
| `npm run build` | Đạt; kiểm tra public assets đạt |
| `playwright test tests/studio.spec.ts` | 55/55 đạt trước khi mở rộng kiểm tra |
| Playwright lọc `occasion backgrounds preserve\|all eight scenes` | 3/3 đạt sau khi mở rộng: 2 test cập nhật và 1 test mới |
| `pytest tests/test_occasion_backgrounds.py -q` | 4/4 đạt trong môi trường test |
| `export_openapi.py --check` | Không có drift |
| Kích thước 16 WebP | Đạt |

## Quan sát hình ảnh

`node design/verify-occasion-backgrounds.cjs` dùng API local đang chạy, catalog
và ảnh tách nền thực tế cho áo giao lĩnh lót trắng, Áo Nhật Bình Đỏ và áo bào tím.
Script tạo browser context riêng, không sửa bộ phối tài khoản. Kết quả gồm 18
ảnh: 3 trang phục × 3 cảnh Dạo phố/Biểu diễn/Tết × 2 tỷ lệ.

Đã xem ảnh ghép dọc và vuông: trang phục sáng, đỏ và tím vẫn phân biệt được;
sân khấu giữ rèm tối ở rìa; nền Tết khác nền cưới với mai và hiên nhà. Lớp phủ
giảm tương phản chỉ nằm trên nền, không phủ lên ảnh trang phục.

Ảnh QA tạm nằm tại `frontend/test-results/occasion-live-visual/`, có thể bị
Playwright xóa khi chạy test lần sau. Chạy lại script sau test để tái tạo.

## Giới hạn nghiệm thu

- Studio đang truyền cố định `viewMode="flatlay"`. Component Canvas2D có nhánh
  avatar, nhưng UI chưa mở chế độ đó: chưa nghiệm thu ghép nền với người mẫu.
- Kiểm thử viewport là Chromium mô phỏng, chưa phải thiết bị di động vật lý.
- Kiểm thử xuất tham chiếu AI không chứng minh chất lượng kết quả Gemini thật.
- Kiểm thử lưu backend dùng môi trường test; không phải xác nhận lưu trên production.
- Hình kiến trúc là concept; không khẳng định mô tả đúng một di tích có tên.
- Chưa commit, push hay deploy. Các thay đổi homepage/chuyện cổ phục có sẵn nằm
  ngoài phạm vi lượt kiểm tra này.
