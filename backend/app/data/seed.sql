-- Seed Data: seed.sql
-- Mô tả: Dữ liệu mẫu chuẩn xác cho Việt phục Remix (Supabase / SQLite)
-- Ngày tạo: 16/09/2026

-- 1. Garment Types
INSERT INTO garment_types (id, name, description, gender_compatibility, era, slot_schema, is_active) VALUES
('ngu_than', 'Áo ngũ thân tay chẽn', 'Trang phục truyền thống định hình thời chúa Nguyễn Phúc Khoát và phổ biến toàn quốc dưới triều vua Minh Mạng. Cổ đứng 5 thân, 5 khuy cài bên phải tượng trưng ngũ thường và ngũ luân.', 'unisex', 'Nguyễn (1744 - 1945)', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front", "accessory_back"]', TRUE),
('ao_tac', 'Áo tấc (Áo lễ ngũ thân)', 'Lễ phục trang trọng của người Việt thời Nguyễn, dạng thụng tay dài thụng qua bàn tay, dùng trong các nghi lễ trang nghiêm, tế tự, hôn lễ.', 'unisex', 'Nguyễn', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front"]', TRUE),
('nhat_binh', 'Áo Nhật bình', 'Thường phục của bậc hoàng hậu, công chúa, phi tần và mệnh phụ triều Nguyễn. Đặc trưng cổ áo to bản hình chữ nhật viền ngũ sắc tượng trưng ngũ hành.', 'female', 'Nguyễn', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front"]', TRUE),
('ao_dai_remix', 'Áo ngũ thân Remix / Đương đại', 'Phiên bản cải tiến trẻ trung phối hợp giữa phom áo ngũ thân truyền thống với phụ kiện đương đại như kính mát, túi cói, giày sneaker cho giới trẻ.', 'unisex', 'Hiện đại', '["outerwear", "undergarment", "bottom", "footwear", "headwear", "accessory_front"]', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Occasions
INSERT INTO occasions (id, name, description, formality_level, season, criteria, icon_name) VALUES
('ky_yeu', 'Chụp ảnh Kỷ yếu', 'Bối cảnh trường học, không gian lịch sử văn hóa, trang phục thanh lịch, trẻ trung, tôn vinh nét đẹp học đường.', 'formal', 'all', '{"preferred_colors": ["#1A365D", "#2B6CB0", "#E2E8F0", "#FFF5F5"], "tags": ["học sinh", "sinh viên", "thanh xuân"]}', 'GraduationCap'),
('tet', 'Lễ Tết Cổ truyền', 'Sum họp gia đình, du xuân chúc Tết, sắc màu tươi tắn may mắn, ấm cúng và tôn nghiêm.', 'ceremonial', 'spring', '{"preferred_colors": ["#C53030", "#D69E2E", "#276749", "#9B2C2C"], "tags": ["du xuân", "chúc tết", "may mắn"]}', 'Sparkles'),
('le_hoi_truong', 'Lễ hội Văn hóa Trường', 'Ngày hội truyền thống, festival học sinh - sinh viên, khuyến khích sáng tạo remix năng động.', 'casual', 'all', '{"preferred_colors": ["#2B6CB0", "#319795", "#ED8936"], "tags": ["sáng tạo", "remix", "năng động"]}', 'PartyPopper'),
('dao_pho', 'Dạo phố & Check-in', 'Dạo chơi phố cổ, check-in bảo tàng di tích, nhẹ nhàng, thoải mái, phong cách thanh lịch.', 'casual', 'all', '{"preferred_colors": ["#4A5568", "#718096", "#CBD5E0"], "tags": ["thoải mái", "dạo phố", "check-in"]}', 'Camera'),
('cuoi_hoi', 'Lễ cưới & Đính hôn', 'Nghi lễ cưới hỏi trang trọng truyền thống, chuộng màu đỏ thắm, vàng hoàng yến, ngọc bích.', 'ceremonial', 'all', '{"preferred_colors": ["#9B2C2C", "#C53030", "#ECC94B"], "tags": ["trang trọng", "lễ nghi", "cưới hỏi"]}', 'Heart'),
('tot_nghiep', 'Lễ tốt nghiệp', 'Dự lễ tốt nghiệp, nhận bằng và chụp ảnh cùng gia đình; ưu tiên bản phối gọn gàng, trang trọng và dễ di chuyển.', 'formal', 'all', '{"tags": ["tốt nghiệp", "nhận bằng", "trang trọng"]}', 'GraduationCap'),
('bieu_dien', 'Biểu diễn nghệ thuật', 'Biểu diễn sân khấu, văn nghệ hoặc trình diễn trang phục; lựa chọn theo chủ đề và yêu cầu vận động của tiết mục.', 'formal', 'all', '{"tags": ["sân khấu", "văn nghệ", "trình diễn"]}', 'Music'),
('tham_quan_di_san', 'Tham quan di sản', 'Tham quan bảo tàng, di tích và không gian văn hóa; ưu tiên sự thoải mái và tuân thủ quy định tại điểm đến.', 'casual', 'all', '{"tags": ["bảo tàng", "di tích", "tham quan"]}', 'Landmark')
ON CONFLICT (id) DO NOTHING;

-- 3. Heritage Sources
INSERT INTO heritage_sources (id, title, author, publication_year, publisher, citation_text, url, license_type) VALUES
('src_ngan_nam_ao_mu', 'Ngàn năm áo mũ', 'Trần Quang Đức', 2013, 'NXB Thế Giới', 'Khảo cứu lịch sử trang phục Việt Nam từ thời Lý, Trần, Lê đến Nguyễn dựa trên thư tịch cổ và hiện vật khảo cổ.', 'https://nhaxuatbanthegioi.vn', 'Academic Reference'),
('src_dai_nam_hoi_dien', 'Khâm định Đại Nam hội điển sự lệ', 'Nội Các Triều Nguyễn', 1851, 'Quốc Sử Quán Triều Nguyễn', 'Bộ chính sử quy chuẩn điển chế lễ nghi, phẩm phục quan lại, hoàng tộc và thường phục dân gian thời Nguyễn.', NULL, 'Public Domain Historical Document'),
('src_co_do_hue', 'Trang phục cung đình triều Nguyễn', 'Trung tâm Bảo tồn Di tích Cố đô Huế', 2015, 'NXB Thuận Hóa', 'Tư liệu khảo lục trang phục hoàng gia, cấu trúc dải ngũ sắc áo Nhật bình và lễ phục cung đình.', 'https://hueworldheritage.org.vn', 'Official Heritage Citation')
ON CONFLICT (id) DO NOTHING;

-- 4. Heritage Articles
INSERT INTO heritage_articles (id, title, slug, short_summary, full_content, structural_description, historical_context, modern_interpretation, status, version) VALUES
('art_ngu_than', 'Nguồn gốc và Cấu trúc Áo ngũ thân tay chẽn', 'nguon-goc-ao-ngu-than-tay-chen',
'Áo ngũ thân tay chẽn gồm 5 thân vải tượng trưng ngũ luân, 5 khuy tượng trưng ngũ thường, cài vạt sang nách phải kín đáo, thanh lịch.',
'Áo ngũ thân được định hình rõ nét từ năm Giáp Tý (1744) dưới thời Vũ Vương Nguyễn Phúc Khoát ở Đàng Trong, sau đó được Vua Minh Mạng ban sắc lệnh chuẩn hóa trang phục trên toàn quốc vào năm 1827 và 1837. Năm thân áo gồm 2 thân trước, 2 thân sau và 1 thân con nằm bên trong lồng ngực bên phải.',
'Cổ áo đứng vuông vức ôm sát cổ; vạt áo xòe nhẹ theo dáng chữ A; tay áo ôm gọn từ khuỷu tay đến cổ tay (tay chẽn) tiện cho sinh hoạt thường nhật. Áo lót trắng mặc lót bên trong để lộ viền trắng 1-2mm ở cổ.',
'Là quốc phục chính thức của người Việt suốt gần 2 thế kỷ, xóa bỏ sự khác biệt trang phục giữa Đàng Trong và Đàng Ngoài.',
'Ngày nay, học sinh - sinh viên ưa chuộng áo ngũ thân trong lễ tốt nghiệp, kỷ yếu và du xuân nhờ phom dáng vừa cổ kính vừa gọn gàng hiện đại.', 'published', 1),

('art_ao_tac', 'Áo tấc: Lễ phục trang nghiêm của tiền nhân', 'ao-tac-le-phuc-trang-nghiem',
'Áo tấc là lễ phục ngũ thân tay thụng dài rộng, dành cho các dịp đại lễ, tế tự thần linh tổ tiên và nghi lễ quan trọng.',
'Áo tấc (còn gọi là áo thụng, áo lễ) chia sẻ chung cấu trúc 5 thân với áo ngũ thân nhưng phần tay áo may thụng rất rộng, dài che kín bàn tay khi buông thõng. Khi hành lễ, hai tay chắp phía trước tạo phong thái uy nghiêm, thành kính.',
'Tay áo rộng từ 30 đến 40cm, vạt dài quá gối, đi kèm khăn đóng (khăn vấn) và quần trắng thụng.',
'Mọi tầng lớp từ thứ dân đến quan lại, hoàng tộc thời Nguyễn đều sử dụng áo tấc trong các dịp lễ tiết, cúng bái tổ tiên, cưới hỏi.',
'Được tái sinh mạnh mẽ trong các đám cưới truyền thống và lễ hội trường học của người trẻ muốn tìm về cội nguồn nghi lễ trang nghiêm.', 'published', 1),

('art_nhat_binh', 'Áo Nhật bình: Tuyệt tác thường phục nữ cung đình', 'ao-nhat-binh-tuyet-tac-cung-dinh',
'Áo Nhật bình là trang phục cao quý của mệnh phụ thời Nguyễn, nổi bật với cổ áo hình chữ nhật viền dải ngũ sắc ngũ hành rực rỡ.',
'Áo Nhật bình có nguồn gốc từ áo Phi phong thời Minh, được cải biến mang đậm bản sắc văn hóa Việt triều Nguyễn. Tên gọi Nhật bình xuất phát từ dạng cổ áo khoét hình chữ nhật lớn cân đối trước ngực.',
'Cổ áo dệt hoặc thêu hoa văn tinh xảo; hai vạt trước có dải ngũ sắc buông dài; hai ống tay may dải ngũ sắc (xanh, vàng, trắng, đỏ, đen) tượng trưng cho ngũ hành tương sinh.',
'Quy định chặt chẽ theo cấp bậc: Hoàng hậu dùng màu vàng chính sắc thêu phượng, Công chúa dùng màu đỏ, Quý phi dùng màu tím/xanh.',
'Áo Nhật bình hiện là biểu tượng di sản được giới trẻ đặc biệt say mê chụp ảnh kỷ yếu, lễ phục cô dâu ngày cưới và thời trang nghệ thuật.', 'published', 1)
ON CONFLICT (id) DO NOTHING;

-- 5. Link Articles with Sources
WITH source_seed (id, article_id, source_id, page_reference, quote) AS (VALUES
('091b5af9-517e-5dee-834a-d9d891611955', 'art_ngu_than', 'src_ngan_nam_ao_mu', 'Trang 225-240', 'Sắc dụ vua Minh Mạng năm 1827 về việc toàn quốc nhất luật tuân theo lối y phục cổ đứng cài khuy hữu nhậm.'),
('124ae7fb-de4b-5a2c-a11a-00401b5c9d5b', 'art_ao_tac', 'src_dai_nam_hoi_dien', 'Quyển 78 - Điển lễ phẩm phục', 'Khi vào chầu hoặc tế tự lớn, quan viên và sĩ dân đồng dùng áo thụng ngũ thân tề chỉnh.'),
('2205a5f6-6378-5d8d-80bc-f9571c8185d0', 'art_nhat_binh', 'src_co_do_hue', 'Chương 3 - Nhật bình cung đình', 'Dải ngũ sắc tượng trưng cho ngũ phương, ngũ hành, thể hiện quan niệm vũ trụ quan hài hòa của triều đại.')
)
INSERT INTO article_sources (id, article_id, source_id, page_reference, quote)
SELECT s.id, s.article_id, s.source_id, s.page_reference, s.quote FROM source_seed s
WHERE NOT EXISTS (SELECT 1 FROM article_sources old WHERE old.article_id=s.article_id AND old.source_id=s.source_id)
ON CONFLICT (id) DO NOTHING;

-- 6. Cultural Rules (Engine F10)
INSERT INTO cultural_rules (id, code, name, target_garment_type_id, target_slot, severity, condition_json, explanation, source_id, suggested_fix, version, is_active) VALUES
('rule_huu_nham', 'RULE_VAT_AO_RIGHT', 'Quy tắc cài khuy bên phải (Hữu nhậm)', 'ngu_than', 'outerwear', 'strict',
'{"field": "overlap_direction", "forbidden_value": "left_over_right"}',
'Cổ phục Việt Nam tuân thủ nguyên tắc "Hữu nhậm": vạt áo trái phủ lên vạt áo phải và cài cúc sang nách phải. Kiểu cài vạt sang trái (tả nhậm) là phong tục của cõi âm trong quan niệm cổ truyền.',
'src_ngan_nam_ao_mu',
'{"action": "set_direction", "value": "right_over_left", "label": "Chuyển vạt cài sang bên phải theo đúng quy thức"}', 1, TRUE),

('rule_ao_tac_formality', 'RULE_AO_TAC_LE_NGHI', 'Quy chuẩn lễ nghi khi mặc Áo tấc', 'ao_tac', 'headwear', 'warning',
'{"slot_required": "headwear", "required_item_tags": ["khan_van", "khan_dong"]}',
'Áo tấc là cổ phục mang tính lễ nghi trang trọng. Khi diện áo tấc trong các sự kiện trang nghiêm, cần kết hợp khăn vấn (khăn đóng) để thể hiện sự chỉn chu, tôn kính truyền thống.',
'src_dai_nam_hoi_dien',
'{"action": "equip_headwear", "item_id": "item_khan_van_den", "label": "Đội thêm khăn vấn đen truyền thống"}', 1, TRUE),

('rule_color_harmony', 'RULE_COLOR_CONTRAST', 'Lớp áo lót trong viền cổ trang nhã', 'ngu_than', 'undergarment', 'info',
'{"recommended_undergarment_color": "#FFFFFF"}',
'Nét tinh tế đặc trưng của áo ngũ thân là viền trắng của áo lót bên trong (áo cánh) hé lộ nhẹ nhàng 1-2mm quanh cổ áo ngoài, tượng trưng cho sự sạch sẽ, tinh khôi và kín đáo.',
'src_ngan_nam_ao_mu',
'{"action": "equip_undergarment", "item_id": "item_ao_lot_trang", "label": "Mặc áo lót trắng bên trong"}', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 7. Items (Trang phục, Quần, Phụ kiện)
INSERT INTO items (id, garment_type_id, slot, name, gender, description, era, is_published, metadata) VALUES
-- Áo ngũ thân Nam & Nữ
('item_ngu_than_nam_xanh', 'ngu_than', 'outerwear', 'Áo ngũ thân tay chẽn Xanh Chàm (Nam)', 'male', 'Phom dáng ngũ thân nam truyền thống, vải lụa tơ tằm dệt hoa văn chữ Thọ chìm, trang nhã.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "truyền thống"}'),
('item_ngu_than_nu_hong', 'ngu_than', 'outerwear', 'Áo ngũ thân tay chẽn Hồng Đào (Nữ)', 'female', 'Màu hồng đào dịu dàng, lụa Vạn Phúc mềm mại, thích hợp kỷ yếu và dạo xuân.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "thanh lịch"}'),
('item_ngu_than_unisex_vang', 'ngu_than', 'outerwear', 'Áo ngũ thân tay chẽn Vàng Hoàng Yến', 'unisex', 'Sắc vàng tươi ấm áp, họa tiết mây cuộn cổ điển, nổi bật trong lễ hội trường học.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "nổi bật"}'),

-- Áo tấc
('item_ao_tac_do', 'ao_tac', 'outerwear', 'Áo tấc Đỏ Chu Sa (Lễ phục)', 'unisex', 'Tay thụng rộng tôn nghiêm, sắc đỏ may mắn dành cho cưới hỏi và đại lễ tổ tiên.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "lễ nghi"}'),
('item_ao_tac_xanh_ngoc', 'ao_tac', 'outerwear', 'Áo tấc Xanh Ngọc Bích', 'unisex', 'Sắc ngọc bích nhã nhặn, chất gấm tơ tằm dệt nổi hoa văn hoa cúc triều Nguyễn.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "quý phái"}'),

-- Áo Nhật bình
('item_nhat_binh_nu_do', 'nhat_binh', 'outerwear', 'Áo Nhật bình Đỏ Phượng Hoàng (Nữ)', 'female', 'Cổ áo ngũ sắc dệt hoa văn chim phượng, tay đính ngũ hành, chuẩn mực cung đình Huế.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "cung đình"}'),
('item_nhat_binh_nu_vang', 'nhat_binh', 'outerwear', 'Áo Nhật bình Vàng Hoa Cúc (Nữ)', 'female', 'Biểu trưng quyền quý hoàng gia, hoa văn cúc đại đóa thêu tay tỉ mỉ.', 'Nguyễn', TRUE, '{"era": "Nguyễn", "style": "hoàng tộc"}'),

-- Áo lót trong (undergarment)
('item_ao_lot_trang', 'ngu_than', 'undergarment', 'Áo lót trắng cổ đứng (Bạch y)', 'unisex', 'Áo cánh lót bằng vải bông hoặc tơ trắng tinh khôi, tạo viền cổ áo thanh lịch.', 'Nguyễn', TRUE, '{}'),

-- Quần (bottom)
('item_quan_trang_lua', 'ngu_than', 'bottom', 'Quần lụa trắng ống suông', 'unisex', 'Dáng thụng rộng cổ điển, chất liệu lụa satin rủ tự nhiên, tạo bước đi thanh thoát.', 'Nguyễn', TRUE, '{}'),
('item_quan_den_ong_rong', 'ngu_than', 'bottom', 'Quần đen lụa tơ tằm', 'unisex', 'Màu đen tuyền truyền thống, dễ phối màu với mọi loại áo ngũ thân.', 'Nguyễn', TRUE, '{}'),

-- Khăn vấn / Mũ (headwear)
('item_khan_van_den', 'ngu_than', 'headwear', 'Khăn vấn đen truyền thống', 'unisex', 'Khăn quấn hình chữ Nhân hoặc chữ Nhất, nét trang nghiêm của người mặc cổ phục.', 'Nguyễn', TRUE, '{"tags": ["khan_van", "khan_dong"]}'),
('item_khan_van_xanh', 'ngu_than', 'headwear', 'Khăn vấn xanh lục bảo', 'female', 'Khăn vấn nhiều nếp nhung gấm cao cấp cho phái nữ diện cùng áo Nhật bình hoặc ngũ thân.', 'Nguyễn', TRUE, '{"tags": ["khan_van"]}'),

-- Phụ kiện trước (accessory_front)
('item_kieng_bac', 'ngu_than', 'accessory_front', 'Kiềng bạc chạm hoa mai', 'female', 'Kiềng tròn bằng bạc chạm lộng hoa mai tỉ mỉ, điểm xuyết thanh nhã trước cổ áo.', 'Nguyễn', TRUE, '{}'),
('item_quat_xep_giay_do', 'ngu_than', 'accessory_front', 'Quạt xếp giấy dó truyền thống', 'unisex', 'Nan tre cật già bồi giấy dó khắc họa cảnh sơn thủy hữu tình.', 'Nguyễn', TRUE, '{}'),
('item_tui_coi_remix', 'ao_dai_remix', 'accessory_front', 'Túi cói đan tay thủ công (Remix)', 'unisex', 'Phụ kiện dạo phố remix hiện đại, chất liệu cói tự nhiên thân thiện môi trường.', 'Hiện đại', TRUE, '{}'),

-- Giày / Guốc (footwear)
('item_guoc_moc_quai_nhung', 'ngu_than', 'footwear', 'Guốc mộc quai nhung đen', 'unisex', 'Guốc gỗ mít mộc mạc, quai nhung êm ái, âm vang tiếng gõ thân thương khi dạo phố.', 'Nguyễn', TRUE, '{}'),
('item_sneaker_trang_remix', 'ao_dai_remix', 'footwear', 'Sneaker trắng trẻ trung (Remix)', 'unisex', 'Phối cùng áo ngũ thân ngắn hoặc áo dài cách tân năng động cho học sinh - sinh viên.', 'Hiện đại', TRUE, '{}')
ON CONFLICT (id) DO NOTHING;

-- 8. Item Variants (Màu sắc, Chất liệu, Hoa văn)
INSERT INTO item_variants (id, item_id, color_name, hex_color, secondary_hex, material, thickness_level, pattern_description, is_default) VALUES
-- Áo ngũ thân nam xanh
('var_ngu_than_nam_xanh_cham', 'item_ngu_than_nam_xanh', 'Xanh Chàm Đậm', '#1A365D', '#2B6CB0', 'Lụa tơ tằm dệt gấm', 'medium', 'Họa tiết chữ Thọ chìm cổ điển', TRUE),
('var_ngu_than_nam_xanh_reu', 'item_ngu_than_nam_xanh', 'Xanh Rêu Cổ Mộc', '#276749', '#2F855A', 'Đũi tơ tằm', 'light', 'Mặt vải đũi mộc tự nhiên', FALSE),

-- Áo ngũ thân nữ hồng
('var_ngu_than_nu_hong_dao', 'item_ngu_than_nu_hong', 'Hồng Đào Dịu Dàng', '#D53F8C', '#ED64A6', 'Lụa Hà Đông cao cấp', 'light', 'Họa tiết mây cuốn thanh thoát', TRUE),
('var_ngu_than_nu_tim_hue', 'item_ngu_than_nu_hong', 'Tím Xứ Huế', '#6B46C1', '#805AD5', 'Lụa satin óng ánh', 'medium', 'Hoa sen cách điệu nhẹ nhàng', FALSE),

-- Áo ngũ thân vàng
('var_ngu_than_unisex_vang', 'item_ngu_than_unisex_vang', 'Vàng Hoàng Yến', '#D69E2E', '#ECC94B', 'Gấm tơ tằm dệt hoa', 'medium', 'Họa tiết tản vân cung đình', TRUE),

-- Áo tấc đỏ & xanh
('var_ao_tac_do_chu_sa', 'item_ao_tac_do', 'Đỏ Chu Sa', '#9B2C2C', '#C53030', 'Gấm vân hoa mẫu đơn', 'heavy', 'Hoa văn hoa dây đối xứng tôn nghiêm', TRUE),
('var_ao_tac_xanh_ngoc', 'item_ao_tac_xanh_ngoc', 'Xanh Ngọc Bích', '#2C7A7B', '#319795', 'Lụa sa trơn cao cấp', 'medium', 'Dệt vân nước thủy ba nhẹ', TRUE),

-- Áo Nhật bình
('var_nhat_binh_do', 'item_nhat_binh_nu_do', 'Đỏ Cung Đình', '#742A2A', '#E53E3E', 'Gấm dệt chỉ vàng kim tuyến', 'heavy', 'Cổ áo ngũ sắc dệt loan phượng', TRUE),
('var_nhat_binh_vang', 'item_nhat_binh_nu_vang', 'Vàng Hoàng Tộc', '#B7791F', '#F6E05E', 'Gấm thượng hạng thêu tay', 'heavy', 'Viền cổ chữ nhật ngũ sắc kết hợp hoa cúc', TRUE),

-- Quần & phụ kiện
('var_quan_trang', 'item_quan_trang_lua', 'Trắng Tinh Khôi', '#FFFFFF', '#EDF2F7', 'Lụa phi bóng mềm mại', 'light', 'Mặt trơn rủ tự nhiên', TRUE),
('var_quan_den', 'item_quan_den_ong_rong', 'Đen Tuyền', '#1A202C', '#2D3748', 'Lụa chàm mềm', 'light', 'Mặt trơn kín đáo', TRUE),
('var_ao_lot_trang', 'item_ao_lot_trang', 'Trắng Bông', '#F7FAFC', '#E2E8F0', 'Vải cotton bông dệt tay', 'light', 'Mỏng mát thấm mồ hôi', TRUE),
('var_khan_van_den', 'item_khan_van_den', 'Đen Mực', '#171923', '#2D3748', 'Vải lụa quấn nếp', 'medium', '7 nếp nam / 9 nếp nữ', TRUE),
('var_khan_van_xanh', 'item_khan_van_xanh', 'Xanh Lục Bảo', '#234E52', '#285E61', 'Nhung the cao cấp', 'medium', 'Nếp gấp đều tay mịn màng', TRUE),
('var_kieng_bac', 'item_kieng_bac', 'Bạc Trắng Sáng', '#CBD5E0', '#E2E8F0', 'Bạc ta nguyên chất 99%', 'light', 'Chạm lộng cành mai uốn lượn', TRUE),
('var_quat_xep', 'item_quat_xep_giay_do', 'Nâu Mộc Giấy Dó', '#9C4221', '#DD6B20', 'Giấy dó cổ truyền bồi nan tre', 'light', 'Thư pháp chữ Tâm sơn son', TRUE),
('var_tui_coi', 'item_tui_coi_remix', 'Màu Cói Tự Nhiên', '#B7791F', '#D69E2E', 'Cói dệt thủ công Nga Sơn', 'medium', 'Họa tiết đan mắt cáo hiện đại', TRUE),
('var_guoc_moc', 'item_guoc_moc_quai_nhung', 'Gỗ Tự Nhiên Quai Đen', '#4A5568', '#1A202C', 'Gỗ mít bào thủ công', 'medium', 'Quai nhung đen êm ái', TRUE),
('var_sneaker', 'item_sneaker_trang_remix', 'Trắng Tối Giản', '#EDF2F7', '#E2E8F0', 'Da tổng hợp bền nhẹ', 'light', 'Đế cao su đàn hồi êm chân', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 9. Item Occasion Priorities
INSERT INTO item_occasions (item_id, occasion_id, priority_score, editorial_note) VALUES
('item_ngu_than_nam_xanh', 'ky_yeu', 95, 'Lựa chọn hàng đầu cho nam sinh viên chụp ảnh tốt nghiệp thanh lịch.'),
('item_ngu_than_nu_hong', 'ky_yeu', 98, 'Dịu dàng, ăn ảnh, nổi bật trên nền kiến trúc giảng đường cổ kính.'),
('item_ngu_than_unisex_vang', 'tet', 96, 'Sắc vàng tươi tắn đem lại vượng khí và may mắn cả năm.'),
('item_ao_tac_do', 'cuoi_hoi', 100, 'Lễ phục truyền thống hoàn hảo cho đôi uyên ương trong ngày thành hôn.'),
('item_nhat_binh_nu_do', 'cuoi_hoi', 98, 'Tôn vinh nét đẹp đài các, trang quý của cô dâu Việt.'),
('item_nhat_binh_nu_vang', 'ky_yeu', 90, 'Lộng lẫy và ấn tượng cho bộ ảnh kỷ yếu phong cách hoàng gia.'),
('item_tui_coi_remix', 'dao_pho', 92, 'Phụ kiện dạo chơi check-in trẻ trung, phóng khoáng.'),
('item_sneaker_trang_remix', 'le_hoi_truong', 94, 'Kết hợp phá cách năng động cho các hoạt động diễu hành trường học.')
ON CONFLICT (item_id, occasion_id) DO NOTHING;

-- 10. Avatars (Artboard 800 x 1200 chuẩn hóa)
INSERT INTO avatars (id, name, gender, skin_tone, body_type, svg_body, dimensions) VALUES
('avatar_nu_chuan', 'Nhân vật Nữ Chuẩn (Thanh xuân)', 'female', 'light_warm', 'standard',
'<svg viewBox="0 0 800 1200" width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="skinGradNu" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#FFF0E6"/>
      <stop offset="100%" stop-color="#FCDFD0"/>
    </radialGradient>
    <linearGradient id="hairGradNu" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#211E1D"/>
      <stop offset="100%" stop-color="#12100F"/>
    </linearGradient>
  </defs>
  <!-- Bầu bóng nền mờ nghệ thuật -->
  <circle cx="400" cy="600" r="320" fill="#FBF8F3" opacity="0.8"/>
  <ellipse cx="400" cy="1120" rx="180" ry="24" fill="#E2DCD2" opacity="0.5"/>
  <!-- Thân hình & Chân -->
  <path d="M370 700 L360 1060 L385 1060 L400 700 Z" fill="#F5D5C2"/>
  <path d="M430 700 L440 1060 L415 1060 L400 700 Z" fill="#F5D5C2"/>
  <!-- Cổ & Khuôn mặt thanh tú -->
  <path d="M380 340 L380 410 Q400 425 420 410 L420 340 Z" fill="url(#skinGradNu)"/>
  <path d="M340 240 Q400 190 460 240 Q475 320 400 375 Q325 320 340 240 Z" fill="url(#skinGradNu)"/>
  <!-- Tóc mượt búi gọn phía sau -->
  <path d="M335 245 Q400 170 465 245 Q475 300 460 330 Q445 230 400 220 Q355 230 340 330 Q325 300 335 245 Z" fill="url(#hairGradNu)"/>
  <ellipse cx="400" cy="180" rx="42" ry="38" fill="url(#hairGradNu)"/>
  <!-- Mắt, mày, môi dịu dàng -->
  <path d="M365 260 Q380 256 390 262" stroke="#4A3B32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M410 262 Q420 256 435 260" stroke="#4A3B32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="378" cy="275" rx="5" ry="3.5" fill="#3D2B1F"/>
  <ellipse cx="422" cy="275" rx="5" ry="3.5" fill="#3D2B1F"/>
  <path d="M397 290 Q400 305 403 290" stroke="#E2A992" stroke-width="2" fill="none"/>
  <path d="M388 325 Q400 335 412 325 Q400 340 388 325 Z" fill="#E56A6A"/>
</svg>',
'{"width": 800, "height": 1200}'),

('avatar_nam_chuan', 'Nhân vật Nam Chuẩn (Đĩnh đạc)', 'male', 'light_warm', 'standard',
'<svg viewBox="0 0 800 1200" width="800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="skinGradNam" cx="50%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#FFEAD9"/>
      <stop offset="100%" stop-color="#F5D0B5"/>
    </radialGradient>
    <linearGradient id="hairGradNam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1A1918"/>
      <stop offset="100%" stop-color="#0D0C0C"/>
    </linearGradient>
  </defs>
  <circle cx="400" cy="600" r="320" fill="#F7F8F9" opacity="0.8"/>
  <ellipse cx="400" cy="1120" rx="190" ry="24" fill="#D7DDE2" opacity="0.5"/>
  <!-- Thân & Chân vững chãi -->
  <path d="M365 700 L350 1060 L380 1060 L400 700 Z" fill="#ECCBB2"/>
  <path d="M435 700 L450 1060 L420 1060 L400 700 Z" fill="#ECCBB2"/>
  <!-- Cổ & Khuôn mặt đĩnh đạc -->
  <path d="M375 330 L375 410 Q400 425 425 410 L425 330 Z" fill="url(#skinGradNam)"/>
  <path d="M335 235 Q400 190 465 235 Q475 315 400 375 Q325 315 335 235 Z" fill="url(#skinGradNam)"/>
  <!-- Tóc chải gọn gàng -->
  <path d="M330 240 Q400 175 470 240 Q465 210 400 185 Q335 210 330 240 Z" fill="url(#hairGradNam)"/>
  <!-- Mày kiếm, mắt sáng -->
  <path d="M360 255 L388 258" stroke="#2B211B" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M412 258 L440 255" stroke="#2B211B" stroke-width="3.5" stroke-linecap="round"/>
  <ellipse cx="375" cy="272" rx="5.5" ry="3.5" fill="#2B211B"/>
  <ellipse cx="425" cy="272" rx="5.5" ry="3.5" fill="#2B211B"/>
  <path d="M396 286 L400 305 L404 286" stroke="#DCA285" stroke-width="2" fill="none"/>
  <path d="M388 328 Q400 334 412 328" stroke="#B85D56" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>',
'{"width": 800, "height": 1200}')
ON CONFLICT (id) DO NOTHING;

-- 11. Asset Layers (SVG Vectors nhiều lớp với Artboard chuẩn xác)
INSERT INTO asset_layers (id, item_id, variant_id, avatar_id, slot, z_index, anchor_x, anchor_y, scale_x, scale_y, layer_type, svg_content) VALUES
-- Lớp Quần lụa trắng (z-index 20)
('layer_quan_trang', 'item_quan_trang_lua', 'var_quan_trang', NULL, 'bottom', 20, 0, 0, 1, 1, 'svg',
'<g id="layer-quan-trang">
  <path d="M340 680 L320 1050 L385 1050 L400 780 L415 1050 L480 1050 L460 680 Q400 695 340 680 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
  <path d="M345 740 Q335 900 330 1045" stroke="#EDF2F7" stroke-width="2" fill="none"/>
  <path d="M455 740 Q465 900 470 1045" stroke="#EDF2F7" stroke-width="2" fill="none"/>
  <path d="M400 780 L400 870" stroke="#CBD5E0" stroke-width="2" fill="none"/>
</g>'),

-- Lớp Quần lụa đen (z-index 20)
('layer_quan_den', 'item_quan_den_ong_rong', 'var_quan_den', NULL, 'bottom', 20, 0, 0, 1, 1, 'svg',
'<g id="layer-quan-den">
  <path d="M340 680 L320 1050 L385 1050 L400 780 L415 1050 L480 1050 L460 680 Q400 695 340 680 Z" fill="#1A202C" stroke="#2D3748" stroke-width="2"/>
  <path d="M345 740 Q335 900 330 1045" stroke="#2D3748" stroke-width="1.5" fill="none"/>
  <path d="M455 740 Q465 900 470 1045" stroke="#2D3748" stroke-width="1.5" fill="none"/>
</g>'),

-- Lớp Áo lót trắng cổ đứng (z-index 25)
('layer_ao_lot_trang', 'item_ao_lot_trang', 'var_ao_lot_trang', NULL, 'undergarment', 25, 0, 0, 1, 1, 'svg',
'<g id="layer-ao-lot-trang">
  <!-- Cổ đứng viền trắng hé lộ nhẹ -->
  <path d="M372 342 Q400 348 428 342 L430 380 Q400 387 370 380 Z" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
</g>'),

-- Lớp Áo ngũ thân Nam Xanh Chàm (z-index 40 - Outerwear)
('layer_ngu_than_nam_xanh', 'item_ngu_than_nam_xanh', 'var_ngu_than_nam_xanh_cham', NULL, 'outerwear', 40, 0, 0, 1, 1, 'svg',
'<g id="layer-ngu-than-nam-xanh">
  <defs>
    <linearGradient id="gradAoNamXanh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A365D"/>
      <stop offset="70%" stop-color="#2B6CB0"/>
      <stop offset="100%" stop-color="#1A365D"/>
    </linearGradient>
  </defs>
  <!-- Tay áo trái và phải (tay chẽn) -->
  <path d="M315 420 L220 610 L250 625 L325 480 Z" fill="#1A365D" stroke="#0F2442" stroke-width="2"/>
  <path d="M485 420 L580 610 L550 625 L475 480 Z" fill="#1A365D" stroke="#0F2442" stroke-width="2"/>
  <!-- Thân áo ngũ thân dáng chữ A dài qua gối -->
  <path d="M315 420 Q400 400 485 420 L510 820 Q400 840 290 820 L315 420 Z" fill="url(#gradAoNamXanh)" stroke="#0F2442" stroke-width="2.5"/>
  <!-- Cổ đứng chữ nhật cổ truyền cài khuy hữu nhậm -->
  <path d="M375 345 L425 345 L428 385 Q400 395 372 385 Z" fill="#1A365D" stroke="#0F2442" stroke-width="2"/>
  <!-- Đường nách chéo vạt phải (Hữu nhậm) -->
  <path d="M428 385 Q450 440 460 480 L460 820" stroke="#0F2442" stroke-width="2.5" fill="none"/>
  <!-- 5 khuy cúc kim loại vàng đồng -->
  <circle cx="423" cy="365" r="4.5" fill="#ECC94B" stroke="#B7791F" stroke-width="1.5"/>
  <circle cx="438" cy="405" r="4" fill="#ECC94B" stroke="#B7791F" stroke-width="1.5"/>
  <circle cx="452" cy="442" r="4" fill="#ECC94B" stroke="#B7791F" stroke-width="1.5"/>
  <circle cx="458" cy="482" r="4" fill="#ECC94B" stroke="#B7791F" stroke-width="1.5"/>
  <circle cx="459" cy="535" r="4" fill="#ECC94B" stroke="#B7791F" stroke-width="1.5"/>
  <!-- Hoa văn chữ Thọ chìm tinh tế -->
  <circle cx="400" cy="500" r="28" stroke="#2B6CB0" stroke-width="1" fill="none" opacity="0.4"/>
  <circle cx="400" cy="660" r="32" stroke="#2B6CB0" stroke-width="1" fill="none" opacity="0.4"/>
</g>'),

-- Lớp Áo ngũ thân Nữ Hồng Đào (z-index 40 - Outerwear)
('layer_ngu_than_nu_hong', 'item_ngu_than_nu_hong', 'var_ngu_than_nu_hong_dao', NULL, 'outerwear', 40, 0, 0, 1, 1, 'svg',
'<g id="layer-ngu-than-nu-hong">
  <defs>
    <linearGradient id="gradAoNuHong" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D53F8C"/>
      <stop offset="60%" stop-color="#ED64A6"/>
      <stop offset="100%" stop-color="#B83280"/>
    </linearGradient>
  </defs>
  <!-- Tay áo ôm nhẹ nữ tính -->
  <path d="M320 420 L235 600 L260 612 L330 475 Z" fill="#B83280" stroke="#97266D" stroke-width="2"/>
  <path d="M480 420 L565 600 L540 612 L470 475 Z" fill="#B83280" stroke="#97266D" stroke-width="2"/>
  <!-- Thân áo duyên dáng lượn eo nhẹ -->
  <path d="M320 420 Q400 405 480 420 L505 840 Q400 860 295 840 L320 420 Z" fill="url(#gradAoNuHong)" stroke="#97266D" stroke-width="2"/>
  <!-- Cổ đứng thanh mảnh -->
  <path d="M375 346 L425 346 L427 384 Q400 392 373 384 Z" fill="#B83280" stroke="#97266D" stroke-width="2"/>
  <!-- Vạt áo nách phải -->
  <path d="M427 384 Q445 435 455 475 L455 840" stroke="#97266D" stroke-width="2" fill="none"/>
  <!-- Khuy bọc ngọc trai hồng đào -->
  <circle cx="423" cy="365" r="4.5" fill="#FFF5F7" stroke="#ED64A6" stroke-width="1.5"/>
  <circle cx="435" cy="402" r="4" fill="#FFF5F7" stroke="#ED64A6" stroke-width="1.5"/>
  <circle cx="448" cy="438" r="4" fill="#FFF5F7" stroke="#ED64A6" stroke-width="1.5"/>
  <circle cx="454" cy="478" r="4" fill="#FFF5F7" stroke="#ED64A6" stroke-width="1.5"/>
  <circle cx="455" cy="530" r="4" fill="#FFF5F7" stroke="#ED64A6" stroke-width="1.5"/>
</g>'),

-- Lớp Áo tấc Đỏ Chu Sa (z-index 40 - Outerwear tay thụng)
('layer_ao_tac_do', 'item_ao_tac_do', 'var_ao_tac_do_chu_sa', NULL, 'outerwear', 40, 0, 0, 1, 1, 'svg',
'<g id="layer-ao-tac-do">
  <defs>
    <linearGradient id="gradAoTacDo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#9B2C2C"/>
      <stop offset="60%" stop-color="#C53030"/>
      <stop offset="100%" stop-color="#742A2A"/>
    </linearGradient>
  </defs>
  <!-- Tay áo thụng rộng rủ xuống uy nghi -->
  <path d="M320 415 L170 650 L250 670 L330 520 Z" fill="#742A2A" stroke="#63171B" stroke-width="2"/>
  <path d="M480 415 L630 650 L550 670 L470 520 Z" fill="#742A2A" stroke="#63171B" stroke-width="2"/>
  <!-- Thân áo rộng vạt dài quá gối -->
  <path d="M320 415 Q400 395 480 415 L525 870 Q400 890 275 870 L320 415 Z" fill="url(#gradAoTacDo)" stroke="#63171B" stroke-width="2.5"/>
  <!-- Cổ đứng trang trọng -->
  <path d="M374 344 L426 344 L429 386 Q400 396 371 386 Z" fill="#742A2A" stroke="#63171B" stroke-width="2"/>
  <!-- Vạt áo cúc vàng đồng triều Nguyễn -->
  <path d="M429 386 Q455 440 465 485 L465 870" stroke="#63171B" stroke-width="2" fill="none"/>
  <circle cx="424" cy="365" r="5" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
  <circle cx="440" cy="405" r="4.5" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
  <circle cx="454" cy="445" r="4.5" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
  <circle cx="462" cy="490" r="4.5" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
  <circle cx="465" cy="545" r="4.5" fill="#D69E2E" stroke="#744210" stroke-width="1.5"/>
</g>'),

-- Lớp Áo Nhật bình Đỏ Cung Đình (z-index 40 - Outerwear Nhật bình)
('layer_nhat_binh_do', 'item_nhat_binh_nu_do', 'var_nhat_binh_do', NULL, 'outerwear', 40, 0, 0, 1, 1, 'svg',
'<g id="layer-nhat-binh-do">
  <defs>
    <linearGradient id="gradNhatBinh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#742A2A"/>
      <stop offset="50%" stop-color="#9B2C2C"/>
      <stop offset="100%" stop-color="#63171B"/>
    </linearGradient>
  </defs>
  <!-- Tay áo thụng gắn dải ngũ sắc ở viền tay -->
  <path d="M315 415 L180 630 L250 650 L325 510 Z" fill="#63171B" stroke="#4A1015" stroke-width="2"/>
  <path d="M485 415 L620 630 L550 650 L475 510 Z" fill="#63171B" stroke="#4A1015" stroke-width="2"/>
  <!-- Dải ngũ sắc ống tay: Xanh, Vàng, Trắng, Đỏ, Đen -->
  <g opacity="0.95">
    <rect x="180" y="620" width="70" height="6" fill="#2B6CB0" transform="rotate(15 180 620)"/>
    <rect x="183" y="626" width="70" height="6" fill="#ECC94B" transform="rotate(15 183 626)"/>
    <rect x="186" y="632" width="70" height="6" fill="#FFFFFF" transform="rotate(15 186 632)"/>
    <rect x="189" y="638" width="70" height="6" fill="#E53E3E" transform="rotate(15 189 638)"/>
    <rect x="192" y="644" width="70" height="6" fill="#1A202C" transform="rotate(15 192 644)"/>

    <rect x="550" y="640" width="70" height="6" fill="#2B6CB0" transform="rotate(-15 550 640)"/>
    <rect x="547" y="634" width="70" height="6" fill="#ECC94B" transform="rotate(-15 547 634)"/>
    <rect x="544" y="628" width="70" height="6" fill="#FFFFFF" transform="rotate(-15 544 628)"/>
    <rect x="541" y="622" width="70" height="6" fill="#E53E3E" transform="rotate(-15 541 622)"/>
    <rect x="538" y="616" width="70" height="6" fill="#1A202C" transform="rotate(-15 538 616)"/>
  </g>
  <!-- Thân áo dáng suông rộng quý tộc -->
  <path d="M315 415 Q400 395 485 415 L525 870 Q400 885 275 870 L315 415 Z" fill="url(#gradNhatBinh)" stroke="#4A1015" stroke-width="2.5"/>
  <!-- Cổ áo hình chữ nhật đặc trưng (Nhật bình) to bản với viền ngũ sắc -->
  <path d="M355 350 L445 350 L445 520 L355 520 Z" fill="#ECC94B" stroke="#D69E2E" stroke-width="2"/>
  <rect x="365" y="360" width="70" height="150" fill="#FFFFFF" opacity="0.9"/>
  <path d="M400 360 L400 510" stroke="#9B2C2C" stroke-width="2"/>
  <circle cx="400" cy="400" r="12" fill="#E53E3E" stroke="#ECC94B" stroke-width="2"/>
  <circle cx="400" cy="460" r="12" fill="#2B6CB0" stroke="#ECC94B" stroke-width="2"/>
</g>'),

-- Lớp Khăn vấn đen (z-index 60 - Headwear)
('layer_khan_van_den', 'item_khan_van_den', 'var_khan_van_den', NULL, 'headwear', 60, 0, 0, 1, 1, 'svg',
'<g id="layer-khan-van-den">
  <ellipse cx="400" cy="220" rx="68" ry="24" fill="#171923" stroke="#2D3748" stroke-width="2"/>
  <path d="M335 220 Q400 245 465 220 Q465 205 400 185 Q335 205 335 220 Z" fill="#23272F" stroke="#1A202C" stroke-width="1.5"/>
  <!-- Nếp gấp khăn vấn chữ Nhân -->
  <path d="M350 215 Q400 235 450 215" stroke="#4A5568" stroke-width="1.5" fill="none"/>
  <path d="M360 210 Q400 228 440 210" stroke="#4A5568" stroke-width="1.5" fill="none"/>
</g>'),

-- Lớp Kiềng bạc chạm hoa mai (z-index 50 - Accessory Front)
('layer_kieng_bac', 'item_kieng_bac', 'var_kieng_bac', NULL, 'accessory_front', 50, 0, 0, 1, 1, 'svg',
'<g id="layer-kieng-bac">
  <path d="M360 380 Q400 435 440 380" stroke="#CBD5E0" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M360 380 Q400 435 440 380" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Hoa mai điểm giữa ngực -->
  <circle cx="400" cy="415" r="7" fill="#E2E8F0" stroke="#A0AEC0" stroke-width="1.5"/>
  <circle cx="400" cy="415" r="3" fill="#ECC94B"/>
</g>'),

-- Lớp Quạt xếp giấy dó (z-index 55 - Accessory Front)
('layer_quat_xep', 'item_quat_xep_giay_do', 'var_quat_xep', NULL, 'accessory_front', 55, 0, 0, 1, 1, 'svg',
'<g id="layer-quat-xep">
  <!-- Nan quạt mở hình nan quạt bán nguyệt trên tay -->
  <path d="M250 620 L200 530 A60 60 0 0 1 300 530 Z" fill="#D69E2E" stroke="#9C4221" stroke-width="2" opacity="0.95"/>
  <path d="M250 620 L215 538 M250 620 L235 532 M250 620 L250 530 M250 620 L265 532 M250 620 L285 538" stroke="#7B341E" stroke-width="1.5"/>
  <circle cx="250" cy="620" r="4" fill="#C53030"/>
</g>'),

-- Lớp Guốc mộc quai nhung (z-index 15 - Footwear)
('layer_guoc_moc', 'item_guoc_moc_quai_nhung', 'var_guoc_moc', NULL, 'footwear', 15, 0, 0, 1, 1, 'svg',
'<g id="layer-guoc-moc">
  <!-- Guốc trái & phải -->
  <ellipse cx="355" cy="1065" rx="30" ry="12" fill="#D69E2E" stroke="#7B341E" stroke-width="2"/>
  <path d="M335 1065 Q355 1052 375 1065" stroke="#1A202C" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="445" cy="1065" rx="30" ry="12" fill="#D69E2E" stroke="#7B341E" stroke-width="2"/>
  <path d="M425 1065 Q445 1052 465 1065" stroke="#1A202C" stroke-width="5" fill="none" stroke-linecap="round"/>
</g>')
ON CONFLICT (id) DO NOTHING;
