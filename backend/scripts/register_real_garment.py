import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('backend/viet_phuc_remix.db')
c = conn.cursor()

# 1. Thêm hoặc cập nhật Áo tấc Xanh Rêu
metadata_json = json.dumps({
    "era": "Nguyễn",
    "style": "lễ nghi",
    "real_image_url": "/garments/item_ao_tac_xanh_reu.png",
    "has_real_photo": True,
    "photo_type": "ghost_mannequin_ai"
}, ensure_ascii=False)

c.execute("""
INSERT OR REPLACE INTO items (id, garment_type_id, slot, name, gender, description, era, is_published, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    "item_ao_tac_xanh_reu",
    "ao_tac",
    "outerwear",
    "Áo tấc Xanh Rêu Cổ Mộc (Lụa sa)",
    "unisex",
    "Lễ phục tay thụng may bằng lụa sa tơ sống mỏng rủ màu xanh rêu cổ mộc, lót trong vạt tay màu cam đào, phom dáng thụng trang nhã thời Nguyễn.",
    "Nguyễn",
    1,
    metadata_json
))

# 2. Thêm biến thể màu sắc
c.execute("""
INSERT OR REPLACE INTO item_variants (id, item_id, color_name, hex_color, secondary_hex, material, thickness_level, pattern_description, price_tier, is_default)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    "var_ao_tac_xanh_reu",
    "item_ao_tac_xanh_reu",
    "Xanh Rêu Cổ Mộc",
    "#4A5D43",
    "#D98263",
    "Lụa sa tơ sống",
    "thin",
    "Vải lụa tơ sống mỏng nhẹ, lót tay áo màu cam đào",
    "premium",
    1
))

# 3. Thêm lớp asset_layer dạng ảnh transparent overlay trên Canvas
svg_layer = """<g id="layer-ao-tac-xanh-reu">
  <image href="/garments/item_ao_tac_xanh_reu_transparent.png" x="140" y="338" width="520" height="520" preserveAspectRatio="xMidYMid meet" />
</g>"""

c.execute("""
INSERT OR REPLACE INTO asset_layers (id, item_id, variant_id, slot, z_index, anchor_x, anchor_y, scale_x, scale_y, layer_type, svg_content)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (
    "layer_ao_tac_xanh_reu",
    "item_ao_tac_xanh_reu",
    "var_ao_tac_xanh_reu",
    "outerwear",
    30,
    0, 0, 1.0, 1.0,
    "image_png",
    svg_layer
))

# 4. Gắn luôn real_image_url cho item_ngu_than_xanh_reu nếu muốn liên kết
c.execute("""
UPDATE items
SET metadata = json_set(metadata, '$.real_image_url', '/garments/item_ao_tac_xanh_reu.png')
WHERE id = 'item_ngu_than_xanh_reu'
""")

conn.commit()
print("Đã đăng ký thành công Áo tấc Xanh Rêu Cổ Mộc kèm ảnh thật minh họa!")

# Kiểm tra lại danh mục
c.execute("SELECT id, name, metadata FROM items WHERE id IN ('item_ao_tac_xanh_reu', 'item_ngu_than_xanh_reu')")
for r in c.fetchall():
    print("Item:", r[0], "| Tên:", r[1], "| Metadata:", r[2])

conn.close()

