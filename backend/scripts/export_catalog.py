import sqlite3
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

conn = sqlite3.connect('backend/viet_phuc_remix.db')
c = conn.cursor()

# Get Garment Types
print("=== NHÓM TRANG PHỤC (GARMENT TYPES) ===")
for r in c.execute("SELECT id, name, era, gender_compatibility, description FROM garment_types"):
    print(f"- Mã ID: `{r[0]}` | Tên: **{r[1]}** | Thời kỳ: {r[2]} | Dành cho: {r[3]}")
    print(f"  Ý nghĩa / Mô tả: {r[4]}\n")

# Get Items by slot
slots = [
    ("outerwear", "Áo khoác ngoài / Áo chính (Outerwear)"),
    ("undergarment", "Áo lót trong (Undergarment)"),
    ("bottom", "Quần / Hạ y (Bottom)"),
    ("headwear", "Khăn vấn / Nón (Headwear)"),
    ("footwear", "Giày dép / Guốc mộc (Footwear)"),
    ("accessory_front", "Phụ kiện cài / Đeo (Accessories)"),
]

for slot_key, slot_label in slots:
    print(f"\n### {slot_label}")
    rows = c.execute("""
        SELECT i.id, i.name, i.gender, i.era, gt.name, i.description,
               (SELECT group_concat(color_name || ' (' || hex_color || ')') FROM item_variants WHERE item_id = i.id)
        FROM items i
        LEFT JOIN garment_types gt ON i.garment_type_id = gt.id
        WHERE i.slot = ? AND i.id NOT LIKE '%test%' AND i.id NOT LIKE '%admin%'
        ORDER BY gt.id, i.id
    """, (slot_key,)).fetchall()
    
    for r in rows:
        colors = r[6] if r[6] else "Mặc định"
        print(f"1. **{r[1]}** (Mã: `{r[0]}`)")
        print(f"   - Phân loại: {r[4] or 'Khác'} | Thời kỳ: {r[3]} | Dành cho: {r[2]}")
        print(f"   - Màu sắc biến thể: {colors}")
        print(f"   - Mô tả hiện vật: {r[5]}")

conn.close()

