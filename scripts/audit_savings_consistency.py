# -*- coding: utf-8 -*-
"""
Script đối soát và chuẩn hóa giá trị tiết kiệm (Savings Consistency Audit & Normalization)
Đảm bảo 100% khớp số giữa current_dossier.json và các tệp chung_cu_synthesis.json.
Triệt tiêu hoàn toàn lỗi trừ tiền ảo khi chưa duyệt giá (don_gia_thong_nhat = 0).
"""
import os
import json
import glob
import sys

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dossier_path = os.path.join(base_dir, "data", "current_dossier.json")
    active_proj_path = os.path.join(base_dir, "data", "active_project.json")

    print("=" * 65)
    print(" BẮT ĐẦU RÀ SOÁT VÀ CHUẨN HÓA DỮ LIỆU TIẾT KIỆM (112 MỤC)")
    print("=" * 65)

    if not os.path.exists(dossier_path):
        print(f"LỖI: Không tìm thấy tệp hồ sơ tại {dossier_path}")
        return

    with open(dossier_path, "r", encoding="utf-8") as f:
        dossier = json.load(f)

    # Xác định thư mục project_files tương ứng
    active_project_id = None
    if os.path.exists(active_proj_path):
        try:
            with open(active_proj_path, "r", encoding="utf-8") as f:
                act = json.load(f)
                active_project_id = act.get("active_id")
        except Exception:
            pass

    pdirs = []
    if active_project_id:
        p_name = active_project_id.replace(".json", "")
        cand = os.path.join(base_dir, "data", "projects", f"{p_name}_files")
        if os.path.exists(cand):
            pdirs.append(cand)

    # Thêm các thư mục files tìm thấy
    for d in glob.glob(os.path.join(base_dir, "data", "projects", "*_files")):
        if os.path.isdir(d) and d not in pdirs:
            pdirs.append(d)

    print(f"Đã tìm thấy các thư mục lưu trữ chứng cứ: {len(pdirs)}")
    for d in pdirs:
        print(f" - {os.path.basename(d)}")

    items = dossier.get("items", [])
    total_items = len(items)
    print(f"\nTổng số mục trong hồ sơ: {total_items}")

    fixed_unapproved = 0
    synced_synthesis = 0

    for idx, it in enumerate(items):
        item_id = it.get("id", idx + 1)
        dg_trinh = float(it.get("don_gia_trinh") or 0)
        dg_tn = float(it.get("don_gia_thong_nhat") or 0)
        sl = float(it.get("so_luong") or 1)
        giam_current = float(it.get("gia_tri_giam") or 0)

        # 1. Xử lý mục CHƯA DUYỆT (dg_tn <= 0)
        if dg_tn <= 0:
            it["don_gia_thong_nhat"] = 0
            it["thanh_tien_thong_nhat"] = 0
            if giam_current > 0:
                print(f"[FIX TIẾT KIỆM ẢO] Mục #{item_id} ({it.get('ten_vt','')[:30]}): Đã sửa giam từ {giam_current:,.0f} đ -> 0 đ")
                it["gia_tri_giam"] = 0
                fixed_unapproved += 1
            else:
                it["gia_tri_giam"] = 0

            # Cập nhật trong các tệp synthesis tương ứng nếu có
            for pd in pdirs:
                sf = os.path.join(pd, f"item_{item_id}", "chung_cu_synthesis.json")
                if os.path.exists(sf):
                    try:
                        with open(sf, "r", encoding="utf-8") as sfp:
                            sdata = json.load(sfp)
                        if float(sdata.get("total_savings") or 0) > 0 or float(sdata.get("approved_price") or 0) > 0:
                            sdata["approved_price"] = None
                            sdata["total_savings"] = 0
                            with open(sf, "w", encoding="utf-8") as sfp:
                                json.dump(sdata, sfp, ensure_ascii=False, indent=2)
                    except Exception as ex:
                        print(f"  Lỗi ghi tệp synthesis mục #{item_id}: {ex}")

        # 2. Xử lý mục ĐÃ DUYỆT (dg_tn > 0)
        else:
            tt_tn = dg_tn * sl
            it["thanh_tien_thong_nhat"] = tt_tn
            expected_savings = max(0.0, (dg_trinh - dg_tn) * sl)
            it["gia_tri_giam"] = expected_savings

            # Đồng bộ sang các file chung_cu_synthesis.json
            for pd in pdirs:
                item_folder = os.path.join(pd, f"item_{item_id}")
                if os.path.exists(item_folder):
                    sf = os.path.join(item_folder, "chung_cu_synthesis.json")
                    sdata = {}
                    if os.path.exists(sf):
                        try:
                            with open(sf, "r", encoding="utf-8") as sfp:
                                sdata = json.load(sfp)
                        except Exception:
                            sdata = {}

                    syn_p = float(sdata.get("approved_price") or 0)
                    syn_s = float(sdata.get("total_savings") or 0)

                    if abs(syn_p - dg_tn) > 1 or abs(syn_s - expected_savings) > 1:
                        sdata["item_id"] = item_id
                        sdata["approved_price"] = dg_tn
                        sdata["total_savings"] = expected_savings
                        if it.get("co_so_thong_nhat"):
                            sdata["co_so_thong_nhat"] = it["co_so_thong_nhat"]
                        if it.get("danh_gia_ttd"):
                            sdata["summary_text"] = it["danh_gia_ttd"]
                        with open(sf, "w", encoding="utf-8") as sfp:
                            json.dump(sdata, sfp, ensure_ascii=False, indent=2)
                        synced_synthesis += 1

    # Lưu lại hồ sơ current_dossier.json
    with open(dossier_path, "w", encoding="utf-8") as f:
        json.dump(dossier, f, ensure_ascii=False, indent=2)

    # Đồng bộ vào file project json đang active (nếu có)
    if active_project_id:
        act_file = os.path.join(base_dir, "data", "projects", active_project_id)
        if os.path.exists(act_file):
            with open(act_file, "w", encoding="utf-8") as f:
                json.dump(dossier, f, ensure_ascii=False, indent=2)
            print(f"Đã cập nhật đồng bộ vào dự án: {active_project_id}")

    print("\n" + "=" * 65)
    print(" KẾT QUẢ ĐỐI SOÁT & CHUẨN HÓA:")
    print(f" - Đã sửa lỗi tiết kiệm ảo cho: {fixed_unapproved} mục (chưa duyệt)")
    print(f" - Đã đồng bộ khớp Synthesis cho: {synced_synthesis} lượt tệp chứng cứ")

    # KIỂM CHỨNG LẠI TOÀN BỘ 112 MỤC
    diff_count = 0
    fake_saving_count = 0
    for idx, it in enumerate(items):
        item_id = it.get("id", idx + 1)
        dg_trinh = float(it.get("don_gia_trinh") or 0)
        dg_tn = float(it.get("don_gia_thong_nhat") or 0)
        sl = float(it.get("so_luong") or 1)
        giam = float(it.get("gia_tri_giam") or 0)

        if dg_tn <= 0 and giam > 0:
            fake_saving_count += 1

        for pd in pdirs:
            sf = os.path.join(pd, f"item_{item_id}", "chung_cu_synthesis.json")
            if os.path.exists(sf):
                try:
                    with open(sf, "r", encoding="utf-8") as sfp:
                        sd = json.load(sfp)
                    sp = float(sd.get("approved_price") or 0)
                    ss = float(sd.get("total_savings") or 0)
                    if abs(sp - dg_tn) > 1 or abs(ss - giam) > 1:
                        diff_count += 1
                except Exception:
                    pass

    print("-" * 65)
    print(f" Số mục chưa duyệt có giá trị giảm > 0: {fake_saving_count} mục")
    print(f" Số mục sai lệch giữa Dossier và Synthesis: {diff_count} mục")
    if diff_count == 0 and fake_saving_count == 0:
        print(" => TỔNG KẾT: CSDL ĐÃ ĐẠT 100% TIÊU CHÍ NGHIỆM THU (Diff count = 0)")
    else:
        print(" => CẢNH BÁO: Vẫn còn mục chưa khớp.")
    print("=" * 65)

if __name__ == "__main__":
    main()
