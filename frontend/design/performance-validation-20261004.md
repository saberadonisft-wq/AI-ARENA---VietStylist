# Kiểm chứng tối ưu hiệu năng — 04/10/2026

Đã triển khai trên nhánh `perf/studio-catalog-20261004`, từ HEAD `9a0d075`. Giữ các thay đổi chưa commit có sẵn. Chưa commit, push hoặc deploy.

## Những thay đổi đã áp dụng

- Catalog dùng một checkout cho ba truy vấn items, variants và layers, giữ nguyên nội dung API.
- Thumbnail riêng 112/224/320/640 px, WebP lossless, cache theo phiên bản nguồn; ảnh gốc và cutout Studio không bị ghi lại. Studio và thư viện chọn kích thước phù hợp, có fallback về ảnh gốc.
- PNG Studio và thumbnail có ETag/304. Backend vẫn kiểm tra xuất bản, trạng thái và quyền công khai trước khi trả dữ liệu hoặc 304. Cache thumbnail riêng, giới hạn số file và số tác vụ xử lý đồng thời.
- Kéo/resize/xoay gom pointermove theo requestAnimationFrame, cập nhật nhóm SVG đang thao tác, tính geometry một lần và commit ở cuối gesture. Hủy thao tác phục hồi cả DOM và draft.
- Bóng SVG được rasterize và cache cho lúc kéo; khi thả và khi xuất PNG vẫn sử dụng ảnh/bóng đầy đủ. Cache Blob có giới hạn; object URL được thu hồi.
- Thanh độ mờ dùng lớp phủ để xem trước, không vẽ lại canvas hoặc ghi cả document ở mỗi bước; một gesture tạo một bước undo. Lưu/reload vẫn giữ độ mờ.
- Xuất PNG dùng Blob, mã hóa trong worker và chuyển pixel bằng buffer. Trình duyệt không hỗ trợ có đường fallback. Giảm vẽ lại bóng phía sau hộp thoại và tạm hoãn tạo cache bóng trong lúc xuất. Không đổi kích thước, màu, bộ lọc hay nội dung PNG xuất.
- Danh mục dùng chung tải khi có consumer và gộp yêu cầu đồng thời; GET không có body bỏ Content-Type không cần thiết. Export/Compare/Starter modal tải mã khi mở. Tải động có Suspense riêng để giữ focus và workspace; Compare gộp yêu cầu khi Strict Mode mount lại.

## Kết quả đo local

Production build, Chromium headless, desktop 1440×1000, 6 slot dùng trang phục public thật. CPU 1× và giả lập chậm 4×. Mobile là viewport 390×844, DPR2, CPU 4×. API public được relay để cho phép CORS trên cổng kiểm chứng. Routing vô hiệu cache HTTP nên bytes/request trong browser là số của lượt có instrumentation, không phải số cache-hit production. Các lượt benchmark cuối chạy riêng sau khi test/build đã hoàn tất.

| Phép đo | Trước | Sau |
| --- | --- | --- |
| 8 ảnh nhỏ Studio, desktop DPR1 | 11.276.539 bytes | 95.172 bytes, giảm 99,16% |
| Ảnh thư viện mobile trong lượt mở đầu | 10.795.116 bytes | 2.043.954 bytes, giảm 81,07% |
| Catalog GET, 13 món | 591–693 ms | 376–480 ms; payload 19.924 bytes giống hệt |
| Catalog service PostgreSQL warm | 539–547 ms | 378–382 ms |
| Frame p95 kéo 6 món, CPU 1× | 49,9 ms | 16,8 ms |
| Frame p95 kéo 6 món, CPU 4× | 33,5 ms | 16,8 ms; có một frame 50 ms |
| Slider kéo 40 bước | 80 lần ghi localStorage, 40 drawImage | 2 lần ghi cho các key draft, 0 drawImage, một bước undo |
| Catalog request khi mở homepage mobile | 4 | 0 |
| PNG Studio GET có If-None-Match | 200, 1.541.757 bytes | 304, 0 body bytes |

Hai lần xuất cùng PNG 1400×2488 trong lượt đối chiếu gần nhất:

| CPU | Trước: tổng thời gian | Sau: tổng thời gian | Thời gian worker sau |
| --- | --- | --- | --- |
| 1× | 1,78 / 1,58 giây | 2,24 / 1,44 giây | 104 / 107 ms |
| 4× | 5,67 / 5,43 giây | 5,17 / 3,73 giây | 165 / 199 ms |

Worker loại bỏ mã hóa PNG đồng bộ khoảng 1,9 giây trên main thread ở lượt CPU 4×. Tổng thời gian còn phụ thuộc tải ảnh và rasterize SVG; kết quả CPU thường có dao động và không cho thấy mọi lần xuất đều nhanh hơn. Lượt trước gần nhất có lúc chạy cùng thử nghiệm chẩn đoán, nên không dùng bảng này làm tỷ lệ tăng tốc tuyệt đối. Không tuyên bố hết mọi giật lag.

PNG trước/sau dùng 6 trang phục thật có **cùng toàn bộ pixel và cùng bytes**, kích thước 1400×2488, dung lượng 4.525.763 bytes, SHA-256 `ce2521238b8aac497c0feadd87c91dec6172e32d449a67d11f5ffe38294a1403`. Test riêng cũng xác nhận worker và native fallback có cùng hash pixel, không đổi draft.

First Load JS Studio vẫn khoảng 164 kB sau khi thêm worker/cache; trang chủ 122 kB và thư viện 115 kB. Tải động giảm công việc chưa cần, nhưng không có bằng chứng giảm đáng kể tổng bundle ban đầu.

Thumbnail và bóng có chi phí tạo cache lần đầu. Lượt cold thumbnail đầu tiên có request khoảng 5,2 giây; lượt warm trong workload nhiều ảnh khoảng 0,54–0,89 giây. Chuẩn bị bóng trên CPU giả lập chậm còn có long task lúc khởi tạo; số frame kéo phía trên được đo sau khi cache sẵn sàng. Trong probe tắt cache HTTP, tổng bytes Studio kể cả fetch chuẩn bị bóng chưa giảm so với baseline; không đồng nhất mức giảm thumbnail với mức giảm toàn bộ mạng. 304 đã được kiểm chứng trực tiếp, nhưng chưa đo toàn bộ tải trang với cache HTTP production hoạt động bình thường.

## Kiểm tra đã hoàn tất

- Backend toàn bộ: **416 pass, 2 skip**; hai bài PostgreSQL cần `TEST_POSTGRES_URL` chưa được đặt. Public PostgreSQL đã được đo bằng truy vấn chỉ đọc và API thật; chưa chạy bộ rollback/write-runtime PostgreSQL.
- Frontend toàn bộ trước khi push lên `Linh`: **142 pass, 2 skip** trên luồng xuất cuối. Hai bài V3 bị skip do feature flag.
- Sau thay đổi worker và luồng xuất cuối: **79/79 pass** trong `studio.spec.ts`, `studio-mobile.spec.ts`, `ui-detail-fixes.spec.ts`, gồm touch, pointer cancel, undo/redo, draft, locked slots, 16 nền/tỷ lệ, PNG worker/fallback, ảnh đến muộn, AI upload mock và focus modal.
- Typecheck và production build cuối pass; lint 0 lỗi, 48 cảnh báo. OpenAPI được sinh bằng script và drift check pass. `git diff --check` pass.
- Probe browser/API cuối không ghi nhận page error. Không tạo outfit, upload hay gọi Gemini thật trong benchmark.

## Kiểm tra chuẩn bị commit và push lên Linh

- Cài mới backend bằng Python 3.13 và `constraints.txt` trong virtual environment riêng; `pip check` đạt. Chạy lại toàn bộ backend: 416 pass, 2 skip; OpenAPI không drift.
- `npm ci` trong bản sao chỉ chứa source, không sao chép `.env` hoặc cache; build với `NEXT_DIST_DIR=.next-build` và `NEXT_PUBLIC_API_ORIGIN=http://127.0.0.1:4100` đạt.
- Public asset check/unit test, TypeScript và toàn bộ Playwright đạt. Test questionnaire từng lỗi trên GitHub do đọc draft trước khi khởi tạo được sửa bằng chờ draft của tài khoản; kiểm tra lại riêng 3 lần liên tiếp đều đạt.
- `TEST_PRODUCTION=1 npm run test:integration`: 1/1 đạt với API thật và dữ liệu SQLite tạm, gồm đăng nhập, xung đột hai tab, tạo Lookbook và thu hồi liên kết chia sẻ.
- Quét 49 file văn bản trong batch ban đầu không phát hiện mẫu secret hoặc file cấm. PNG/ảnh upload local, `.env`, dependency, cache và log không được đưa vào commit.
- `npm audit --omit=dev`: 0 cảnh báo. Audit toàn bộ còn 7 cảnh báo high trong công cụ phát triển (ESLint/Tailwind và dependency gián tiếp); chưa thực hiện migration major để xử lý trong đợt này.

Đây là bản ghi kiểm tra local trước push; trạng thái GitHub Actions cho commit mới được kiểm tra riêng sau push.

Chưa kiểm chứng điện thoại vật lý, hiệu năng dưới tải nhiều người dùng, CI từ xa hoặc production. Pagination/virtualization cho danh mục lớn và các thay đổi worker/database quy mô lớn chưa nằm trong đợt này.

Bằng chứng local: `C:/Users/vhc/AppData/Local/Temp/viet-performance-implementation-20261004/` — `backend-probe.json`, `browser-probe.json`, `mobile-pages-probe.json`, `before-export-probe.json`, `after-export-probe.json`, `png-parity.json`, PNG trước/sau, `playwright.log`, `playwright-export-final.log`, `build.log`, `lint.log`. Baseline ban đầu và báo cáo review tại `C:/Users/vhc/AppData/Local/Temp/viet-performance-review-20261004/`.
