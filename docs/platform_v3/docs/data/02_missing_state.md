# 02 — Missing State

## known
Có value được chấp nhận.

## unknown
Đã nghiên cứu nhưng chưa thể xác định.

## not_collected
Chưa nghiên cứu.

## not_applicable
Không áp dụng.

## disputed
Có nhiều candidate values hoặc nguồn mâu thuẫn.

## inferred
Suy luận từ dữ liệu khác; không phải direct evidence.

## withheld
Có dữ liệu nhưng không public vì policy/quyền.

### Ví dụ disputed

```json
{
  "attribute_key": "material.primary",
  "state": "disputed",
  "value": null,
  "candidate_values": [
    {"value": "material_a", "assertion_ids": ["assert_a"]},
    {"value": "material_b", "assertion_ids": ["assert_b"]}
  ]
}
```

UI không được hiển thị `not_collected` như “không tồn tại”.
