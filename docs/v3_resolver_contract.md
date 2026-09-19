# Resolver V3 — quy tắc và contract đã triển khai

Ngày 19/09/2026. Áp dụng cho working tree remediation; chưa phải bản phát hành.

## Context

Projection GET nhận query lặp: `period_ids`, `region_ids`, `place_ids`, `community_ids`, `occasion_ids`, `social_context_ids`. Ví dụ: `/api/v3/generation/profiles/garment_ngu_than?period_ids=period_nguyen`. Mỗi trường tối đa 32 canonical ID; ID phải đúng loại entity và đã published với public request. Sai context trả 422 `INVALID_CONTEXT` hoặc lỗi schema 422.

Grounding/prompt POST nhận cùng các trường dạng array trong `outfit.context`. Các trường trình bày như avatarId, styleMode vẫn được giữ trong outfit, nhưng không tự chuyển thành qualifier văn hóa. Adapter phải dùng mapping canonical đã kiểm chứng, không suy diễn `occasionId` của V1 thành entity V3.

Không chọn context: Composer/generation chỉ dùng fact không giới hạn context. Chọn nhiều ID trong một chiều nghĩa là fact phải áp dụng cho toàn bộ các ID được chọn. Những chiều có qualifier mà request không chọn không được coi là áp dụng.

Education không có query context là màn tra cứu: trả các fact trực tiếp cùng qualifier, `context=null`, không khẳng định tất cả cùng áp dụng. Có query context thì trả dữ liệu hiệu lực sau resolver. Vì vậy nguồn tri thức vẫn xem được mà không bị đưa thành hard constraint cho mọi bộ phối.

## Kế thừa và ưu tiên

- Duyệt các cạnh `variant_of`, `regional_variant_of`, `derived_from` có state known và definition active. Public request lọc publication của endpoint, qualifier, assertion và nguồn trước khi duyệt.
- Qualifier cạnh kế thừa giao với qualifier fact; phạm vi giao rỗng không áp dụng. `inheritable` của attribute/quan hệ thông thường quyết định có truyền fact từ tổ tiên hay không; cờ trên cạnh parentage không tắt kế thừa attribute.
- Với cardinality single: fact ở entity gần lựa chọn nhất ưu tiên. Trong cùng độ sâu, scope hẹp hơn ưu tiên scope rộng hơn. Period-only và region-only không có thứ tự ưu tiên mặc định; nếu không có fact kết hợp cụ thể hơn thì giữ các nguồn ngang ưu tiên.
- Giá trị ngang ưu tiên giống nhau gộp provenance; khác nhau tạo disputed với value null và candidates giữ state, giá trị và nguồn. Unknown/inferred/disputed không trở thành known. Withheld không cung cấp payload hoặc candidate qua nhánh khác.
- Cardinality multiple là tập cộng dồn: giữ từng fact phù hợp và provenance; không áp quy tắc ghi đè scalar. Không thay đổi schema lưu để ép dữ liệu vào một giá trị.
- Phát hiện cycle trên đường đang duyệt; graph hình thoi hợp lệ. Giới hạn độ sâu 32 và 256 lượt thăm để chặn graph quá lớn. Trả 409 `INHERITANCE_CYCLE` hoặc 422 `RESOLUTION_LIMIT`, không trả đường dẫn nội bộ trong lỗi.

## Provenance và generation

Mỗi fact hiệu lực có `provenance`: `entity_id`, `fact_id`, `entity_path`, `relation_path`, `assertion_ids`, `qualifiers`. Query được sắp xếp ổn định trước khi hợp nhất. Không dùng cache giữa request: unpublish có hiệu lực ở lần đọc tiếp theo.

Generation chỉ đưa state known có bằng chứng phù hợp vào `must_preserve` theo quy tắc feature hiện tại. Assertion phải published, có source/locator, predicate và value khớp fact, consensus không còn mixed/disputed/uncertain. Known thiếu bằng chứng vẫn giữ state gốc khi trả trong `unresolved`, kèm `generation_status=not_evaluated` và reason: missing_evidence, unavailable_evidence, uncertain_evidence, missing_evidence_locator hoặc mismatched_evidence. Những state unresolved gốc không bị đổi thành known.

Projection/grounding trả `evidence`: assertion ID, subject/predicate, qualifier/confidence/consensus và danh sách source metadata, locator, rights. Không sao chép statement/source body hoặc URL media ký. Qualifier của fact được giao với qualifier của assertion để không áp dụng rộng hơn bằng chứng. Các citation liên quan cạnh kế thừa được nối qua `relation_assertion_ids` trong provenance.

Grounding gắn `selection_id` và `slot` lên constraint; prompt giới hạn constraint theo selection để tránh trộn quy tắc của nhiều món. Đây chưa phải nghiệm thu đầy đủ quyền reference-media hoặc chất lượng ảnh.

## Kiểm chứng và phần còn thiếu

`backend/tests/test_v3_resolver.py` dùng graph trong DB tạm để kiểm tra context, ưu tiên, conflict, diamond, cycle, depth limit, publication withdrawal và grounding qua API. Test pilot truyền rõ context thời kỳ cho các fact có scope đó; seed thật không tự publish.

R06 còn cần evidence locator/rights xuyên projection, dữ liệu renderable/style/rules, snapshot dataset/ruleset có nội dung tái lập, và review tri thức pilot. Dataset version hiện chưa là bảo đảm tái lập chỉ vì resolver đã đúng. Chưa bật Composer hoặc sinh ảnh production.

## Lưu thiết lập diễn giải trong Studio

`OutfitSnapshot.culturalSettings` là trường tùy chọn additive gồm `dataset_version`, `ruleset_version` nullable và `context` sáu mảng canonical. Các ID và giới hạn 32 mục/nhóm dùng cùng domain model V3. Không lưu thêm bản sao selections; adapter tạo selections từ items hiện tại và mapping của dataset được chọn.

- Không có/null settings: Studio dùng dữ liệu hiện hành, ánh xạ occasion V1 nếu có; thiếu mapping dịp thì chưa kiểm tra.
- Có settings: context canonical là nguồn bối cảnh cho V3, thay thế occasion V1 khi tra cứu; occasion V1 vẫn được giữ cho luồng cũ. Context rỗng là lựa chọn rõ ràng chỉ dùng tri thức không giới hạn scope.
- Lưu snapshot kiểm tra cấu trúc nhưng không yêu cầu ID còn published: bộ phối lưu trữ phải còn đọc/sửa được khi dataset hoặc nguồn bị thu hồi. Projection/validation kiểm tra publication/withdrawal khi sử dụng, không tự đổi sang dev khi snapshot không đọc được.
- `GET /api/v3/entities` nhận `dataset_version` và trả tên/options theo đúng snapshot, pagination limit/offset; cùng chính sách withdrawal như projection. UI giữ ID không còn trong options để người dùng thấy và sửa thay vì âm thầm xóa.
- Settings đi qua API create/update/read và draft/history. Tắt feature flag chỉ ẩn editor, không xóa metadata khi sửa/lưu V1.
- Đây là snapshot V1 mở rộng để tích hợp Studio từng bước, chưa phải import tùy ý OutfitSpecV2 native không có bridge. Adapter tiếp tục từ chối import native không có dữ liệu ánh xạ V1.
