# Phiếu xác minh pilot V3

Người xác minh: chủ dự án (theo xác nhận trong phiên làm việc). Trạng thái: chờ xác minh.

Các tên nguồn, trang/quyển và mã hiện vật dưới đây được chép từ **seed đang có**, chưa được đối chiếu tài liệu gốc. Chúng là mục cần kiểm tra, không phải citation đã được xác nhận. Không công bố chỉ vì seed trước đây ghi `verified`, confidence cao hoặc trust tier A/B.

## Sáu assertion cần đối chiếu

| ID | Nội dung cần xác minh và giới hạn | Locator seed đang khai báo — chưa xác minh | Kết quả |
| --- | --- | --- | --- |
| `assert_ngu_than_5_panels` | Cấu tạo năm thân; từng thân gồm phần nào; đúng loại áo và thời kỳ nào | Ngàn năm áo mũ, tr. 195–202; Đại Nam hội điển, quyển 78 | Chờ |
| `assert_ngu_than_huu_nham` | Hướng khép vạt/cài khuy theo góc nhìn người mặc; tách cấu tạo khỏi khẳng định về tang phục/cấm kỵ | Ngàn năm áo mũ, tr. 182; Đại Nam hội điển, quyển 78 | Chờ |
| `assert_ngu_than_co_dung` | Cổ đứng; phạm vi loại áo/thời kỳ; không suy ra độ cao 3,5 cm từ claim chỉ nói kiểu cổ | Ngàn năm áo mũ, tr. 210–215 | Chờ |
| `assert_ngu_than_5_buttons` | Số khuy; tách bằng chứng cấu tạo khỏi diễn giải biểu tượng Ngũ luân/Ngũ thường | Trang phục Việt Nam qua các thời đại, tr. 84 | Chờ |
| `assert_ao_tac_tay_thung` | Kiểu tay thụng; kiểm tra riêng kích thước 30–40 cm và mức độ áp dụng | Ngàn năm áo mũ, tr. 206; hồ sơ hiện vật mã BTLS-0924 | Chờ |
| `assert_bach_y_inner_collar` | Có bắt buộc áo lót hay chỉ thường gặp; áp dụng trong dịp nào; kiểm tra riêng số đo 1–2 mm | Ngàn năm áo mũ, tr. 188 | Chờ |

Với từng dòng, ghi: chấp nhận / sửa / chưa đủ bằng chứng / bác bỏ; bản in/phiên bản nguồn; trang hoặc mã hiện vật thực; URL bền vững nếu có; period/region/occasion; ý kiến khác biệt giữa nguồn; người kiểm tra và ngày kiểm tra. Không cần sao chép toàn bộ tài liệu vào repo.

## Bốn nguồn cần kiểm tra danh tính và quyền

| Source ID | Metadata seed cần đối chiếu |
| --- | --- |
| `source_ngan_nam_ao_mu` | Tên sách, Trần Quang Đức, 2013, nhà xuất bản, bản in và đánh số trang |
| `source_dai_nam_hoi_dien` | Tên đầy đủ, tác giả/cơ quan biên soạn, niên đại, bản dịch/bản in; quyển 78 có đúng nội dung được viện dẫn |
| `source_trang_phuc_viet` | Tên sách, Đoàn Thị Tình, năm 1987 và nhà xuất bản; đúng ấn bản chứa trang 84 |
| `source_bao_tang_lich_su` | Hồ sơ hiện vật cụ thể, mã BTLS-0924 có tồn tại và liên quan hay không; URL trang chủ không thay thế locator hiện vật |

Quyền dùng metadata citation, trích đoạn, ảnh hiển thị và ảnh tham chiếu AI cần ghi riêng. Nhãn seed “Academic Reference”, “Educational Reference”, “Public Domain historical record” hoặc `public_excerpt=true` chưa phải chứng cứ cấp quyền dùng ảnh cho AI. Cần nguồn cấp quyền/điều khoản thực trước khi bật `ai_reference_allowed`.

## Những dữ liệu ngoài sáu assertion

- Rà tên/alias/summary của 11 entity và quan hệ biến thể; không suy ra đặc trưng giới tính, nghi lễ hoặc niên đại từ tên garment.
- Rà attribute không có assertion và attribute viện dẫn sai predicate/value. Resolver có thể hiển thị dữ liệu đã công bố, nhưng generation không dùng chúng làm ràng buộc cứng khi thiếu hỗ trợ phù hợp.
- Rà các forbidden/style options trong generation profile seed: cần nguồn/context riêng, không mặc định là quy tắc phổ quát.
- `reference_media_ids` trong profile seed cũ chứa source ID: cần media asset thật, đúng binding và quyền; không được dùng source ID như media ID.

## Cách bảo toàn kết quả duyệt

Seed mới tạo entity/source/assertion ở draft, chỉ thêm bản ghi thiếu và không ghi đè kết quả đã biên tập khi chạy lại. Các bản ghi đã tồn tại trong DB không bị hạ hoặc tăng trạng thái tự động. Cần rà riêng dữ liệu cũ còn mang nhãn verified.

Sau khi bạn xác minh, kết quả được đối chiếu theo từng ID, chỉnh nội dung/locator/qualifier/quyền, rồi mới xem xét công bố với version rõ ràng. Không có thao tác tự publish trong đợt chuẩn bị phiếu này.
