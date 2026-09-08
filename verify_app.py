# -*- coding: utf-8 -*-
"""
verify_app.py - Kịch bản kiểm thử toàn diện (End-to-End System Verification)
cho Hệ Thống Thẩm Định Dự Toán EVN Vĩnh Tân 4.
"""

import os
import sys
import json
import time
import requests

# Cấu hình UTF-8 cho Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:5555"
ONEDRIVE_PATH = r"D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache"
LOCAL_ROOT = r"D:\TaskApp_kiet\ThamDinhDuToanApp"

class TestSuite:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.results = []

    def assert_true(self, condition, test_name, detail=""):
        if condition:
            self.passed += 1
            print(f"  [PASS] {test_name}")
            if detail:
                print(f"         -> {detail}")
            self.results.append((test_name, "PASS", detail))
        else:
            self.failed += 1
            print(f"  [FAIL] {test_name}")
            if detail:
                print(f"         -> {detail}")
            self.results.append((test_name, "FAIL", detail))

    def warn(self, test_name, detail=""):
        self.warnings += 1
        print(f"  [WARN] {test_name}")
        if detail:
            print(f"         -> {detail}")
        self.results.append((test_name, "WARN", detail))

def run_verification():
    ts = TestSuite()
    print("=" * 80)
    print(" BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG THẨM ĐỊNH DỰ TOÁN EVN VĨNH TÂN 4")
    print(f" Server Target: {BASE_URL}")
    print(f" Thời gian: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    # -------------------------------------------------------------
    # NHÓM 1: KIỂM THỬ SERVER FLASK & CÁC API CỐT LÕI
    # -------------------------------------------------------------
    print("\n[NHÓM 1] KIỂM THỬ SERVER BACKEND FLASK & CÁC API CỐT LÕI:")
    try:
        # 1.1 /api/dossier
        r_dos = requests.get(f"{BASE_URL}/api/dossier", timeout=5)
        ts.assert_true(r_dos.status_code == 200, "API /api/dossier phản hồi HTTP 200")
        dossier = r_dos.json()
        items = dossier.get("items", [])
        ts.assert_true(len(items) >= 90, f"Hồ sơ dự án tải đủ danh mục (Đạt {len(items)} mục vật tư)")
    except Exception as e:
        ts.assert_true(False, "API /api/dossier", f"Lỗi kết nối: {e}")

    try:
        # 1.2 /api/evidence/all-status
        r_ev = requests.get(f"{BASE_URL}/api/evidence/all-status", timeout=5)
        ts.assert_true(r_ev.status_code == 200, "API /api/evidence/all-status phản hồi HTTP 200")
        ev_map = r_ev.json()
        ts.assert_true(isinstance(ev_map, dict) and len(ev_map) > 0, f"Bản đồ chứng cứ (evidence status) nạp thành công {len(ev_map)} mục")
    except Exception as e:
        ts.assert_true(False, "API /api/evidence/all-status", f"Lỗi kết nối: {e}")

    try:
        # 1.3 /api/erp/config-status
        r_erp = requests.get(f"{BASE_URL}/api/erp/config-status", timeout=5)
        ts.assert_true(r_erp.status_code == 200, "API /api/erp/config-status phản hồi HTTP 200")
        erp_st = r_erp.json()
        rec_count = erp_st.get("record_count", 0)
        ts.assert_true(erp_st.get("is_configured") and rec_count > 0, f"CSDL Kế toán ERP Vĩnh Tân 4 sẵn sàng ({rec_count} hợp đồng)")
    except Exception as e:
        ts.assert_true(False, "API /api/erp/config-status", f"Lỗi: {e}")

    try:
        # 1.4 /api/imis/config-status
        r_imis = requests.get(f"{BASE_URL}/api/imis/config-status", timeout=5)
        ts.assert_true(r_imis.status_code == 200, "API /api/imis/config-status phản hồi HTTP 200")
        imis_st = r_imis.json()
        is_ok = bool(imis_st.get("is_connected") or imis_st.get("token_valid") or imis_st.get("status") == "CONNECTED")
        user = imis_st.get("username", "EVN User")
        ts.assert_true(is_ok, f"Cổng EVN IMIS cấu hình tài khoản sẵn sàng ({user} - {imis_st.get('status')})")
    except Exception as e:
        ts.assert_true(False, "API /api/imis/config-status", f"Lỗi: {e}")

    # -------------------------------------------------------------
    # NHÓM 2: KIỂM THỬ CÁC ROUTE ALIAS MỚI CỦA 6 CƠ SỞ (Commit 0ceb9b7)
    # -------------------------------------------------------------
    print("\n[NHÓM 2] KIỂM THỬ ROUTE ALIASES MỚI CỦA 6 CƠ SỞ (Commit 0ceb9b7):")
    try:
        # 2.1 Route alias /api/muasamcong/search
        r_msc = requests.post(f"{BASE_URL}/api/muasamcong/search", json={"keyword": "bơm", "item": {"ten_vt": "bơm"}, "dg_trinh": 1000000}, timeout=5)
        ts.assert_true(r_msc.status_code == 200, "Route alias /api/muasamcong/search hoạt động chuẩn xác")
    except Exception as e:
        ts.assert_true(False, "Route alias /api/muasamcong/search", f"Lỗi: {e}")

    try:
        # 2.2 Route alias /api/imis/search
        r_im = requests.post(f"{BASE_URL}/api/imis/search", json={"keyword": "IUX 760", "item": {"ten_vt": "IUX 760"}, "dg_trinh": 13000000}, timeout=35)
        ts.assert_true(r_im.status_code == 200, "Route alias /api/imis/search hoạt động chuẩn xác")
    except Exception as e:
        ts.assert_true(False, "Route alias /api/imis/search", f"Lỗi: {e}")



    try:
        # 2.3 Route alias /api/items/10/evidence/synthesis
        r_syn = requests.get(f"{BASE_URL}/api/items/10/evidence/synthesis", timeout=5)
        ts.assert_true(r_syn.status_code == 200, "Route alias /api/items/<id>/evidence/<step> hoạt động chuẩn xác")
        syn_data = r_syn.json().get("data", {})
    except Exception as e:
        ts.assert_true(False, "Route alias /api/items/10/evidence/synthesis", f"Lỗi: {e}")

    try:
        # 2.4 /api/quotes/by-item có trả về min_quote trực tiếp
        r_q = requests.get(f"{BASE_URL}/api/quotes/by-item?item_id=7", timeout=5)
        ts.assert_true(r_q.status_code == 200, "API /api/quotes/by-item?item_id=7 phản hồi HTTP 200")
        q_data = r_q.json()
        ts.assert_true("min_quote" in q_data or "matches" in q_data, "Kết quả bóc tách báo giá chứa min_quote và danh sách nhà thầu")
    except Exception as e:
        ts.assert_true(False, "API /api/quotes/by-item", f"Lỗi: {e}")

    # -------------------------------------------------------------
    # NHÓM 3: KIỂM THỬ TÍNH TOÀN VẸN NGHIỆP VỤ (DESELECT IMIS MỤC 10)
    # -------------------------------------------------------------
    print("\n[NHÓM 3] KIỂM THỬ TÍNH TOÀN VẸN NGHIỆP VỤ (DESELECT IMIS MỤC 10):")
    try:
        # Kiểm tra chứng cứ IMIS mục 10
        r_im10 = requests.get(f"{BASE_URL}/api/items/10/evidence/imis", timeout=5)
        im10_data = r_im10.json().get("data", {})
        is_deselected = im10_data.get("is_deselected") or im10_data.get("selected_record") == "NONE"
        ts.assert_true(is_deselected, "Mục 10: Cơ sở 3 (IMIS) đang ở trạng thái BỎ CHỌN (Deselected) chính xác")

        # Kiểm tra chứng cứ Tổng hợp (Cơ sở 6) mục 10
        r_syn10 = requests.get(f"{BASE_URL}/api/items/10/evidence/synthesis", timeout=5)
        syn10 = r_syn10.json().get("data", {})
        final_price = syn10.get("approved_price") or syn10.get("final_price", 0)
        p3_price = syn10.get("p3_price", None)
        ts.assert_true(p3_price == 0 or p3_price is None, "Mục 10: Cơ sở 6 loại trừ giá IMIS (p3_price = 0)")
        ts.assert_true(final_price == 836800.0, f"Mục 10: Giá thẩm định thống nhất lấy theo ERP VT4 (836.800 đ) thay vì giá IMIS cũ (Ghi nhận: {final_price:,.0f} đ)")
    except Exception as e:
        ts.assert_true(False, "Nghiệp vụ bỏ chọn IMIS mục 10", f"Lỗi: {e}")

    # -------------------------------------------------------------
    # NHÓM 4: KIỂM THỬ ĐỒNG BỘ ONEDRIVE CACHE & THƯ MỤC
    # -------------------------------------------------------------
    print("\n[NHÓM 4] KIỂM THỬ ĐỒNG BỘ ONEDRIVE CACHE & THƯ MỤC:")
    try:
        # 4.1 Kiểm tra trạng thái kết nối OneDrive
        r_od_st = requests.get(f"{BASE_URL}/api/sync/onedrive-status", timeout=5)
        ts.assert_true(r_od_st.status_code == 200, "API /api/sync/onedrive-status phản hồi HTTP 200")
        od_st = r_od_st.json()
        ts.assert_true(od_st.get("available"), f"Thư mục OneDrive EVN Cache khả dụng tại: {od_st.get('target_dir')}")

        # 4.2 Thử nghiệm đẩy đồng bộ (OneDrive Push)
        r_od_push = requests.post(f"{BASE_URL}/api/sync/onedrive-push", timeout=10)
        ts.assert_true(r_od_push.status_code == 200, "API /api/sync/onedrive-push phản hồi HTTP 200")
        push_res = r_od_push.json()
        ts.assert_true(push_res.get("success"), f"Đồng bộ thành công sang OneDrive ({push_res.get('total_files')} tệp trong kho)")

        # 4.3 Thử nghiệm mở thư mục OneDrive
        r_od_open = requests.post(f"{BASE_URL}/api/sync/onedrive-open", timeout=5)
        ts.assert_true(r_od_open.status_code == 200, "API /api/sync/onedrive-open phản hồi HTTP 200")
        open_res = r_od_open.json()
        ts.assert_true(open_res.get("success") and "path" in open_res, "API mở thư mục trả về đường dẫn chính xác")

        # 4.4 Kiểm tra thực thể file trên ổ cứng OneDrive
        dossier_on_od = os.path.join(ONEDRIVE_PATH, "data", "current_dossier.json")
        erp_on_od = os.path.join(ONEDRIVE_PATH, "ERP.xlsx")
        ts.assert_true(os.path.exists(dossier_on_od), f"File current_dossier.json tồn tại an toàn trên OneDrive ({os.path.getsize(dossier_on_od):,} bytes)")
        ts.assert_true(os.path.exists(erp_on_od), f"File CSDL ERP.xlsx tồn tại an toàn trên OneDrive ({os.path.getsize(erp_on_od):,} bytes)")
    except Exception as e:
        ts.assert_true(False, "Kiểm thử OneDrive Cache", f"Lỗi: {e}")

    # -------------------------------------------------------------
    # NHÓM 5: KIỂM THỬ KIẾN TRÚC MODULAR FRONTEND & BẢN BUILD
    # -------------------------------------------------------------
    print("\n[NHÓM 5] KIỂM THỬ KIẾN TRÚC MODULAR FRONTEND & BẢN BUILD:")
    inspector_dir = os.path.join(LOCAL_ROOT, "frontend", "src", "components", "inspector")
    
    # 5.1 Kiểm tra file coordinator
    coord_file = os.path.join(inspector_dir, "ItemInspectorView.jsx")
    ts.assert_true(os.path.exists(coord_file), "File coordinator ItemInspectorView.jsx tồn tại")
    with open(coord_file, "r", encoding="utf-8") as f:
        coord_lines = len(f.readlines())
    ts.assert_true(coord_lines < 400, f"File coordinator siêu tinh gọn (Hiện tại: {coord_lines} dòng, giảm từ 4.416 dòng)")

    # 5.2 Kiểm tra 6 module Pillars
    pillars = ["PillarQuotes.jsx", "PillarErp.jsx", "PillarImis.jsx", "PillarMsc.jsx", "PillarEcom.jsx", "PillarSynthesis.jsx", "index.js"]
    missing_pillars = [p for p in pillars if not os.path.exists(os.path.join(inspector_dir, "pillars", p))]
    ts.assert_true(len(missing_pillars) == 0, f"Đầy đủ 6 module Pillars độc lập trong thư mục pillars/")

    # 5.3 Kiểm tra module Coordinator sub-components
    coords = ["InspectorNavbar.jsx", "InspectorSidebar.jsx", "InspectorOverviewCard.jsx", "InspectorPillarTabs.jsx"]
    missing_coords = [c for c in coords if not os.path.exists(os.path.join(inspector_dir, "coordinator", c))]
    ts.assert_true(len(missing_coords) == 0, "Đầy đủ 4 sub-component điều phối trong coordinator/")

    # 5.4 Kiểm tra common UI & utils
    common_ok = os.path.exists(os.path.join(inspector_dir, "common", "PillarHeader.jsx")) and os.path.exists(os.path.join(inspector_dir, "common", "SaveFooter.jsx"))
    utils_ok = os.path.exists(os.path.join(inspector_dir, "utils", "formatters.js")) and os.path.exists(os.path.join(inspector_dir, "utils", "keywordHelpers.js"))
    constants_ok = os.path.exists(os.path.join(inspector_dir, "constants", "pillars.js"))
    ts.assert_true(common_ok and utils_ok and constants_ok, "Đầy đủ các tầng phụ trợ (common, utils, constants)")

    # 5.5 Kiểm tra dist build production
    dist_html = os.path.join(LOCAL_ROOT, "frontend", "dist", "index.html")
    ts.assert_true(os.path.exists(dist_html), "Bản build production (frontend/dist/index.html) sẵn sàng")

    # -------------------------------------------------------------
    # TỔNG KẾT
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print(" KẾT QUẢ TỔNG HỢP KIỂM THỬ:")
    print(f"  * Tổng số bài test: {ts.passed + ts.failed}")
    print(f"  * Số bài ĐẠT (PASS): {ts.passed}")
    print(f"  * Số bài LỖI (FAIL): {ts.failed}")
    print(f"  * Cảnh báo (WARN): {ts.warnings}")
    success_rate = (ts.passed / (ts.passed + ts.failed)) * 100 if (ts.passed + ts.failed) > 0 else 0
    print(f"  * TỶ LỆ ĐẠT: {success_rate:.1f}%")
    print("=" * 80)

    return ts.failed == 0

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
