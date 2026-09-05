# -*- coding: utf-8 -*-
"""
test_ai_synthesis.py - Bộ kịch bản kiểm thử 4 Test Cases cho mô-đun AI Chuyên Gia Vật Tư Độc Lập.
"""

import sys
import os
import json

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import ai_synthesis


def run_tests():
    print("=" * 80)
    print("BẮT ĐẦU CHẠY BỘ KIỂM THỬ 4 TEST CASES CHO MÔ-ĐUN AI CHUYÊN GIA ĐỘC LẬP")
    print("=" * 80)

    sample_item_normal = {
        "id": 1,
        "ten_vt": "Module đầu vào input IUX 760 MI - Điện áp 17-28VDC, Partno: 908531",
        "ma_vt": "3.82.63.134.ENG.00.000",
        "so_luong": 4.0,
        "dvt": "Cái",
        "don_gia_trinh": 13559000
    }

    sample_item_high_price = {
        "id": 99,
        "ten_vt": "Cảm biến đo áp suất Foxboro IGP10 - Tiêu chuẩn EU/G7",
        "ma_vt": "3.82.63.999.ENG.00.000",
        "so_luong": 5.0,
        "dvt": "Cái",
        "don_gia_trinh": 25000000  # Giá trình 25tr
    }

    pillars_sample = {
        "p1_price": 13559000,
        "p2_price": 13559000,
        "p3_price": 0,
        "p4_price": 0,
        "p5_price": 0,
        "p1_desc": "Đơn giá chào thấp nhất là 13.559.000 đ (Trang 1 Báo giá).",
        "p2_desc": "CSDL ERP Vĩnh Tân 4 ghi nhận lịch sử mua sắm dao động từ 6.015.000 đ đến 17.670.000 đ.",
        "p3_desc": "EVN IMIS: Thuộc thiết bị đặc thù, không có dữ liệu trúng thầu mua sắm ở các đơn vị khác.",
        "p4_desc": "Mua Sắm Công: Không có kết quả trúng thầu công khai trên e-GP.",
        "p5_desc": "TMĐT: Các trang web không niêm yết giá công khai (Contact for Quote)."
    }

    pillars_high_price_sample = {
        "p1_price": 15000000, # Báo giá 15tr
        "p2_price": 14000000, # ERP 14tr
        "p3_price": 0,
        "p4_price": 0,
        "p5_price": 0,
        "p1_desc": "Đơn giá chào thấp nhất là 15.000.000 đ.",
        "p2_desc": "CSDL ERP Vĩnh Tân 4 ghi nhận giá HĐ gần nhất là 14.000.000 đ.",
        "p3_desc": "EVN IMIS: Không có dữ liệu.",
        "p4_desc": "e-GP: Không có dữ liệu.",
        "p5_desc": "TMĐT: Contact for Quote."
    }

    # -------------------------------------------------------------
    # TEST CASE 1: Đơn giá Hợp lý (Fallback / Static SME Test)
    # -------------------------------------------------------------
    print("\n[TEST CASE 1] Kiểm thử Mục có Đơn giá Hợp lý (Normal Item STT 1)...")
    res1 = ai_synthesis.generate_ai_synthesis(
        sample_item_normal, pillars_sample,
        config={"enable_ai": False, "only_free_models": True}
    )
    assert res1["risk_flag"] == "NORMAL", "Fail Test 1: risk_flag phải là NORMAL"
    assert res1["suggested_price"] == 13559000, "Fail Test 1: suggested_price phải bằng giá trình"
    assert res1["estimated_savings"] == 0, "Fail Test 1: savings phải bằng 0"
    print("    ✓ PASS Test Case 1: Nhãn NORMAL, Giữ nguyên đơn giá trình 13.559.000 đ, Tiết kiệm 0 đ.")

    # -------------------------------------------------------------
    # TEST CASE 2: Đơn giá Cao Bất thường (Risk & Negotiation Test)
    # -------------------------------------------------------------
    print("\n[TEST CASE 2] Kiểm thử Mục có Đơn giá Cao Bất thường (High Price Warning)...")
    res2 = ai_synthesis.generate_ai_synthesis(
        sample_item_high_price, pillars_high_price_sample,
        config={"enable_ai": False, "warning_threshold_percent": 10.0}
    )
    assert res2["risk_flag"] == "HIGH_PRICE_WARNING", "Fail Test 2: risk_flag phải là HIGH_PRICE_WARNING"
    assert res2["suggested_price"] == 14000000, "Fail Test 2: suggested_price phải là 14tr"
    expected_savings = (25000000 - 14000000) * 5.0
    assert res2["estimated_savings"] == expected_savings, "Fail Test 2: savings không đúng"
    print(f"    ✓ PASS Test Case 2: Phát hiện CẢNH BÁO CAO (+{res2['diff_pct']:.1f}%), Gợi ý đàm phán về 14.000.000 đ, Tiết kiệm {ai_synthesis.fmt_vnd(expected_savings)}.")

    # -------------------------------------------------------------
    # TEST CASE 3: Nguyên tắc Auto-Skip Model Trả Phí (Paid Model Protection)
    # -------------------------------------------------------------
    print("\n[TEST CASE 3] Kiểm thử Nguyên tắc Auto-Skip khi cấu hình Model Trả phí (gpt-4o)...")
    res3 = ai_synthesis.generate_ai_synthesis(
        sample_item_normal, pillars_sample,
        config={
            "enable_ai": True,
            "openrouter_api_key": "sk-or-v1-fake-key",
            "model": "openai/gpt-4o",  # Model không thuộc :free
            "only_free_models": True
        }
    )
    assert res3["used_ai"] is False, "Fail Test 3: Model trả phí phải bị Skip ngay lập tục"
    print("    ✓ PASS Test Case 3: Tự động Bỏ qua (Skip) model trả phí thành công, bảo vệ an toàn 100% chi phí.")

    # -------------------------------------------------------------
    # TEST CASE 4: Kiểm thử Tích hợp AI Free (Live or Fallback Graceful)
    # -------------------------------------------------------------
    print("\n[TEST CASE 4] Kiểm thử Khả năng Chịu lỗi Graceful khi thiếu API Key...")
    res4 = ai_synthesis.generate_ai_synthesis(
        sample_item_normal, pillars_sample,
        config={
            "enable_ai": True,
            "openrouter_api_key": "",
            "model": "qwen/qwen-2.5-coder-32b-instruct:free",
            "only_free_models": True
        }
    )
    assert res4["used_ai"] is False, "Fail Test 4: Thiếu key phải dùng fallback"
    assert "Ý KIẾN ĐÁNH GIÁ ĐỘC LẬP CỦA CHUYÊN GIA VẬT TƯ KỸ THUẬT" in res4["summary_text"]
    print("    ✓ PASS Test Case 4: Xử lý ngoại lệ nhẹ nhàng, bài Thuyết minh Chuyên gia Cục bộ hoàn tất đầy đủ.")

    print("=" * 80)
    print("HOÀN THÀNH TẤT CẢ 4 TEST CASES: TẤT CẢ ĐỀU ĐẠT (ALL PASSED 100%)")
    print("=" * 80)


if __name__ == "__main__":
    run_tests()
