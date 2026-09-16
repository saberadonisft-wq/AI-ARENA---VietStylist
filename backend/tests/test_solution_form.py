import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_solution_form_get_default_and_update():
    headers = {"Authorization": "Bearer dev-user-form-1"}
    # 1. Lấy form giải pháp
    res = client.get("/api/solution-form", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["team_name"] is not None
    assert data["product_name"] is not None
    assert data["revision"] >= 1
    current_rev = data["revision"]

    # 2. Cập nhật form với revision hiện tại
    update_payload = {
        "team_name": "Đội thi Việt phục Remix 2026",
        "product_name": "Việt Dáng Remix (VietStylist)",
        "target_audience": "Học sinh sinh viên toàn quốc",
        "problem_statement": "Khó tiếp cận cổ phục do thiếu kiến thức quy chuẩn và công cụ trực quan",
        "proposed_solution": "Web app phối đồ 2D kết hợp kiểm tra quy tắc văn hóa và AI gợi ý",
        "cultural_safeguards": "Trích dẫn nguồn Ngàn năm áo mũ và Đại Nam hội điển sự lệ",
        "lookbook_references": [],
        "revision": current_rev,
        "status": "draft"
    }
    update_res = client.put("/api/solution-form", json=update_payload, headers=headers)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["team_name"] == "Đội thi Việt phục Remix 2026"
    assert updated_data["revision"] == current_rev + 1
