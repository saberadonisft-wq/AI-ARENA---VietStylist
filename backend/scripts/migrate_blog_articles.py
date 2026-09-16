import sys
import os

# Thêm thư mục backend vào sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import get_db_connection

def migrate_and_seed_blog():
    print("Migrating heritage_articles table for Stylist Blog...")
    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(heritage_articles)")
        existing_cols = set(r["name"] for r in cur.fetchall())

        new_columns = [
            ("author_id", "TEXT"),
            ("author_name", "TEXT"),
            ("author_role", "TEXT DEFAULT 'stylist'"),
            ("cover_image_url", "TEXT"),
            ("category", "TEXT DEFAULT 'Điển tích Cổ phục'"),
            ("era", "TEXT DEFAULT 'Triều Nguyễn'"),
            ("related_garment_id", "TEXT"),
            ("read_time_minutes", "INTEGER DEFAULT 5"),
            ("likes_count", "INTEGER DEFAULT 0"),
        ]

        for col_name, col_type in new_columns:
            if col_name not in existing_cols:
                try:
                    conn.execute(f"ALTER TABLE heritage_articles ADD COLUMN {col_name} {col_type}")
                    print(f"Added column {col_name} to heritage_articles")
                except Exception as e:
                    print(f"Column {col_name} already exists or error: {e}")

        conn.commit()

    # Seed các bài viết mẫu từ Stylist
    blog_stories = [
        {
            "id": "story_nhat_binh_phuong_o",
            "title": "Bí ẩn Nhật Bình: Ngôn ngữ sắc màu và trật tự Phượng ổ chốn cung cấm",
            "slug": "bi-an-nhat-binh-phuong-o-cung-dinh-nguyen",
            "short_summary": "Khám phá cấu trúc hoa văn Thủy Ba, Bát Cát Tường và trật tự nghiêm ngặt của ngũ sắc trên tà áo Nhật Bình - biểu tượng tối thượng của phụ nữ hoàng gia triều Nguyễn.",
            "full_content": """Áo Nhật Bình là trang phục cung đình tiêu biểu dành cho các bậc Hoàng Thái hậu, Hoàng hậu, Công chúa và các bậc mệnh phụ triều Nguyễn. Đặc trưng nổi bật nhất là dải viền cổ áo to bản tạo thành hình chữ nhật trước ngực, mang ý nghĩa 'Nhật Bình' – nhật nguyệt quang minh, vuông tròn viên mãn.

### 1. Ý nghĩa ngũ hành trên dải cổ áo
Viền cổ áo Nhật Bình là một kiệt tác dệt may khi kết hợp 5 dải màu ngũ hành: Kim (Trắng) - Mộc (Xanh) - Thủy (Đen/Tím) - Hỏa (Đỏ) - Thổ (Vàng). Mỗi dải màu không chỉ tuân thủ quy luật tương sinh tương khắc mà còn đại diện cho đức hạnh, sự hài hòa của vũ trụ và trật tự vương triều.

### 2. Họa tiết Phượng ổ và hoa văn sóng nước
Họa tiết chính trên thân áo là đồ án chim Phượng kết thành hình tròn (Phượng ổ), ngậm cành hoa mẫu đơn hoặc xâu chuỗi ngọc. Phía gấu áo là dải 'Thủy ba' (sóng nước cuộn trào) và 'Hải mã', ngụ ý giang sơn thái bình, non sông bền vững muôn đời.

### 3. Gợi ý phối đồ Stylist đương đại
Khi đưa áo Nhật Bình vào không gian nghệ thuật đương đại, stylist khuyên nên kết hợp cùng khăn vấn vành hoặc trâm cài xà cừ tối giản. Nếu remix phong cách hiện đại, có thể mở cúc áo làm khoác ngoài (duster coat) dáng dài kết hợp với áo lót lụa tơ tằm cổ thuyền đơn sắc.""",
            "historical_context": "Được quy định trong Khâm Định Đại Nam Hội Điển Sự Lệ làm thường phục cao quý của Hậu phi triều Nguyễn từ năm Gia Long thứ 6 (1807).",
            "structural_description": "Áo đối khâm vạt rộng, cổ áo viền chữ nhật bản to, tay áo viền ngũ sắc dải màu phụng mệnh.",
            "modern_interpretation": "Có thể ứng dụng làm áo choàng lễ cưới truyền thống, trang phục chụp ảnh kỷ yếu di sản hoặc áo khoác cách tân nghệ thuật.",
            "author_id": "usr_demo_stylist",
            "author_name": "Stylist Hoàng Cung (Lê Diệu Linh)",
            "author_role": "stylist",
            "cover_image_url": "https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/heritage/nhat_binh_cover.jpg",
            "category": "Điển tích Hoàng cung",
            "era": "Triều Nguyễn",
            "related_garment_id": "item_nhat_binh_red",
            "read_time_minutes": 6,
            "likes_count": 142,
        },
        {
            "id": "story_ngu_than_phong_cot",
            "title": "Áo Ngũ Thân & Phong cốt Kẻ Sĩ: Tại sao người xưa cài cúc bên hữu?",
            "slug": "ao-ngu-than-va-phong-cot-ke-si-cai-cuc-ben-huu",
            "short_summary": "Tại sao một tà áo khiêm nhường với 5 thân, 5 khuy lại được coi là đỉnh cao của sự đoan chính, tế nhị và chuẩn mực đạo đức Nho phong?",
            "full_content": """Áo ngũ thân lập lĩnh (cổ đứng) là trang phục được định hình rõ nét nhất qua hai cuộc cải cách trang phục vĩ đại: Đàng Trong thời chúa Nguyễn Phúc Khoát (1744) và toàn cõi Đại Nam thời vua Minh Mạng (1827 - 1837).

### 1. Triết lý 5 thân áo (Ngũ Thân)
Áo ngũ thân được ghép bởi 5 mảnh vải: hai thân trước, hai thân sau ghép sống lưng thành 'chính thân', và một thân con lót bên trong vạt trước (gọi là 'tạ thân'). Bốn thân ngoài tượng trưng cho tứ thân phụ mẫu (cha mẹ mình và cha mẹ người phối ngẫu), thân nhỏ bên trong tượng trưng cho chính bản thân mình được cha mẹ ôm ấp, bảo bọc.

### 2. Năm chiếc khuy cài - Ngũ Thường
Năm chiếc khuy (cúc) thường làm bằng đồng, ngọc, hổ phách hoặc ngà voi, biểu trưng cho ngũ thường của người quân tử: Nhân - Lễ - Nghĩa - Trí - Tín. Cài cúc sang bên phải (hữu nhâm) là chuẩn mực phân biệt văn minh Á Đông.

### 3. Bí quyết diện áo ngũ thân của Stylist
Để mặc áo ngũ thân đẹp chuẩn phong thái:
- Tay áo phải thẳng đứng, ve áo đứng ôm sát cổ tạo sự ngay ngắn.
- Thắt lưng bên trong kết hợp quần màu trắng hoặc đen ống rộng.
- Với nam giới, đội thêm khăn đóng (khăn xếp chữ Nhất hoặc chữ Nhân) để tôn lên vẻ thanh tao của kẻ sĩ.""",
            "historical_context": "Sắc lệnh canh tân y phục triều Nguyễn nhằm xóa bỏ sự phân biệt lối ăn mặc giữa hai miền Đàng Ngoài và Đàng Trong, tạo nên quốc phục thống nhất.",
            "structural_description": "Cổ đứng lập lĩnh cao 2-3cm, tay chẽn hoặc tay thụng, cài 5 cúc bên nách phải, vạt xòe hình cánh sen lượn sóng mềm mại.",
            "modern_interpretation": "Là tiền thân trực tiếp của Áo dài Việt Nam hiện đại, đang trở lại mạnh mẽ trong lễ hội ngoại giao và trang phục nam sinh tốt nghiệp.",
            "author_id": "usr_demo_stylist",
            "author_name": "Trần Quang Minh (Stylist Cổ phong)",
            "author_role": "stylist",
            "cover_image_url": "https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/heritage/ngu_than_nam.jpg",
            "category": "Nghiên cứu Cổ phong",
            "era": "Triều Nguyễn",
            "related_garment_id": "item_ngu_than_indigo",
            "read_time_minutes": 5,
            "likes_count": 98,
        },
        {
            "id": "story_ao_tac_le_tiet",
            "title": "Áo Tấc trong Lễ Tiết Việt: Sự khiêm nhường ẩn sau tà áo thụng",
            "slug": "ao-tac-le-tiet-khiem-nhuong-ta-ao-thung",
            "short_summary": "Đôi tay thụng buông dài cả thước không chỉ phục vụ sự trang nghiêm khi hành lễ, mà còn phản chiếu triết lý giấu đôi bàn tay để biểu đạt sự cung kính tối đa.",
            "full_content": """Áo Tấc (còn gọi là áo lễ phục, áo thụng, áo ngũ thân tay thụng) là lễ phục phổ thông nhất thời Nguyễn, dành cho mọi tầng lớp từ vua quan đến thứ dân trong các dịp lễ tết trang trọng như tế tự, nghênh hôn, sắc phong, giỗ chạp.

### 1. Nguồn gốc tên gọi 'Áo Tấc'
Tên gọi xuất phát từ viền tay áo may rộng một tấc cổ (khoảng 3.8 - 4.2cm), còn phần thụng của tay áo thả buông dài hơn đầu gối khi đứng thẳng. Khi đứng lễ, hai bàn tay đan vào nhau giấu kín trong tay áo, hơi cúi đầu tạo nên tư thế 'kháp thủ' cung kính tuyệt đối trước tổ tiên và bề trên.

### 2. Màu sắc và chất liệu truyền thống
Dân gian thường chuộng áo Tấc dệt bằng the, sa, đoạn màu xanh lam (thanh), màu tía hoặc màu huyền trầm mặc. Áo lót bên trong luôn luôn là áo đơn màu trắng tinh khiết tạo nên sự tương phản nhã nhặn tại cổ áo và cổ tay.

### 3. Ứng dụng Stylist trong ảnh cưới & lễ hỏi
Áo Tấc là lựa chọn hàng đầu của các cặp đôi Gen Z hiện nay trong lễ gia tiên. Màu sắc thịnh hành nhất là đỏ thẫm đỗ quyên kết hợp với quần lụa trắng óng ả, đem lại vẻ đẹp vừa đài các vừa thuần Việt mà không mẫu âu phục nào sánh kịp.""",
            "historical_context": "Trang phục tế lễ phổ quát ghi nhận khắp ba miền suốt thế kỷ XIX và nửa đầu thế kỷ XX.",
            "structural_description": "Tay áo thụng dài hình chữ nhật rộng bản, cổ đứng có lót ve trắng, thân áo rộng rãi tạo nếp gấp buông rủ uy nghiêm.",
            "modern_interpretation": "Xu hướng lễ phục cưới truyền thống thịnh hành nhất của giới trẻ hiện nay.",
            "author_id": "usr_demo_admin",
            "author_name": "Ban Quản trị Di sản VietStylist",
            "author_role": "admin",
            "cover_image_url": "https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/heritage/ao_tac_wedding.jpg",
            "category": "Bí quyết Phối đồ",
            "era": "Triều Nguyễn",
            "related_garment_id": "item_ao_tac_red",
            "read_time_minutes": 4,
            "likes_count": 215,
        },
        {
            "id": "story_ngu_hanh_mau_sac",
            "title": "Nghệ thuật Phối Màu Ngũ Hành: Ứng dụng thuyết Tương Sinh vào phục trang",
            "slug": "nghe-thuat-phoi-mau-ngu-hanh-tuong-sinh-co-phuc",
            "short_summary": "Tại sao áo trong màu trắng đi với áo ngoài lam sẫm? Bí quyết sử dụng Kim sinh Thủy, Mộc sinh Hỏa để tạo nên sự cân bằng khí chất trên người mặc.",
            "full_content": """Trong triết lý mỹ học phương Đông, màu sắc không chỉ để thỏa mãn thị giác mà còn là sự cân bằng năng lượng âm dương và sinh khí ngũ hành.

### 1. Thuyết ngũ sắc cổ truyền
- **Mộc (Xanh lục / Xanh chàm)**: Đại diện cho sự sinh sôi, đức Nhân, mùa Xuân.
- **Hỏa (Đỏ cờ / Đỏ thắm)**: Đại diện cho ánh sáng, danh vọng, đức Lễ, mùa Hạ.
- **Thổ (Vàng chính sắc / Vàng mơ)**: Trung tâm vũ trụ, đức Tín, sự thịnh vượng bền vững.
- **Kim (Trắng tuyết / Trắng ngà)**: Sự thanh khiết, công lý, đức Nghĩa, mùa Thu.
- **Thủy (Đen mực / Tím thẫm / Xanh sẫm)**: Chiều sâu trí tuệ, đức Trí, sự bí ẩn, mùa Đông.

### 2. Các công thức phối màu 'chuẩn Stylist'
- **Kim - Thủy (Thanh cao, trí tuệ)**: Áo lót trắng kết hợp tà áo ngoài màu chàm (indigo) hoặc tím hoa cà. Đây là công thức phối màu kinh điển của giới trí thức phong kiến.
- **Mộc - Hỏa (Nhiệt huyết, rực rỡ)**: Áo khoác đỏ kết hợp yếm xanh ngọc hoặc thắt lưng màu lục bảo, biểu trưng cho sự thăng hoa và hỷ sự.
- **Hỏa - Thổ (Vương giả, quyền quý)**: Gam màu vàng hoàng tộc viền sắc đỏ chu sa tạo nên thần thái trang trọng tuyệt đối.""",
            "historical_context": "Triết lý màu sắc chi phối từ quy chế điển lễ triều đình đến thường phục dân gian thời Lý, Trần, Lê, Nguyễn.",
            "structural_description": "Nguyên lý phối màu phân tầng từ lớp lót, lớp chính, viền cổ, khăn vấn đến phụ kiện hài guốc.",
            "modern_interpretation": "Được tích hợp trực tiếp vào thuật toán phối màu AI Studio của VietStylist.",
            "author_id": "usr_demo_stylist",
            "author_name": "Phạm Hoàng Oanh (Chuyên gia Phối màu)",
            "author_role": "stylist",
            "cover_image_url": "https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/heritage/ngu_hanh_colors.jpg",
            "category": "Bí quyết Phối đồ",
            "era": "Đương đại Remix",
            "related_garment_id": "item_ngu_than_hoa_red",
            "read_time_minutes": 7,
            "likes_count": 310,
        },
        {
            "id": "story_giao_linh_thoi_le",
            "title": "Giao Lĩnh thời Lê: Hào khí Đại Việt trên từng nếp vạt chéo",
            "slug": "giao-linh-thoi-le-hao-khi-dai-viet-vat-cheo",
            "short_summary": "Nhìn lại dáng dấp cổ phục thế kỷ XV - XVII: sự phóng khoáng, uyển chuyển của chiếc áo cổ tréo gắn liền với thời kỳ văn hóa Phục Hưng rực rỡ của đất nước.",
            "full_content": """Áo Giao Lĩnh (còn gọi là áo tràng vạt, áo cổ chéo) là một trong những dạng thức y phục cổ xưa và có sức sống lâu bền nhất trong lịch sử Việt Nam, trải dài từ thời Lý, Trần, Hậu Lê đến tận thời Nguyễn.

### 1. Đặc trưng cấu trúc Giao Lĩnh
Áo có hai vạt đan chéo vào nhau ở trước ngực, vạt bên trái đè lên vạt bên phải (tả đè hữu), tạo thành đường viền cổ chữ V thanh thoát và phóng khoáng. Khác với dáng áo ngũ thân cổ đứng nghiêm cẩn thời Nguyễn, áo Giao Lĩnh thời Lê có tay áo buông rộng, thắt dải lụa ngang eo buông thõng hai đầu dây.

### 2. Sự phục dựng của cộng đồng Cổ phong
Những năm gần đây, phong trào phục dựng cổ phục thời Lê Trung Hưng đã mang áo Giao Lĩnh trở lại các sân khấu kịch nghệ, điện ảnh lịch sử và lễ hội di sản. Đường nét vạt chéo tự do mang lại sự trẻ trung, phiêu lãng và khí khái hiệp khách.

### 3. Lời khuyên Stylist
Áo Giao Lĩnh rất hợp khi kết hợp cùng trâm cài gỗ mun, giày thêu mũi cong hoặc quạt xếp giấy dó. Khi biểu diễn hoặc dự dạ tiệc, một dải thắt lưng (thao) dệt thủ công hoa văn mây lửa sẽ là điểm nhấn thu hút mọi ánh nhìn.""",
            "historical_context": "Minh chứng qua các pho tượng chân dung thời Lê - Mạc tại chùa Dâu, chùa Bút Tháp và tranh thờ cổ.",
            "structural_description": "Cổ vạt chéo chữ V, vạt nẹp to bản, thân áo thả rộng hoặc có nẹp phụ viền đối xứng.",
            "modern_interpretation": "Là nguồn cảm hứng vô tận cho các thiết kế áo kimono cách tân, áo choàng dã ngoại phong cách Đông phương.",
            "author_id": "usr_demo_stylist",
            "author_name": "Vũ Đăng Khoa (Stylist Lịch sử)",
            "author_role": "stylist",
            "cover_image_url": "https://pub-6b5603ef95b646cdbf77ae1dc62532cb.r2.dev/heritage/giao_linh_le.jpg",
            "category": "Nghiên cứu Cổ phong",
            "era": "Triều Lê",
            "related_garment_id": "item_giao_linh_le",
            "read_time_minutes": 5,
            "likes_count": 184,
        }
    ]

    with get_db_connection() as conn:
        for s in blog_stories:
            conn.execute("""
                INSERT OR REPLACE INTO heritage_articles (
                    id, title, slug, short_summary, full_content,
                    historical_context, structural_description, modern_interpretation,
                    author_id, author_name, author_role, cover_image_url,
                    category, era, related_garment_id, read_time_minutes, likes_count,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
            """, (
                s["id"], s["title"], s["slug"], s["short_summary"], s["full_content"],
                s["historical_context"], s["structural_description"], s["modern_interpretation"],
                s["author_id"], s["author_name"], s["author_role"], s["cover_image_url"],
                s["category"], s["era"], s["related_garment_id"], s["read_time_minutes"], s["likes_count"],
            ))
        conn.commit()
    print(f"Successfully seeded {len(blog_stories)} rich stylist blog articles into heritage_articles!")

if __name__ == "__main__":
    migrate_and_seed_blog()

