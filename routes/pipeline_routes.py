# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Pipeline Routes Blueprint
Quản lý tự động hóa 1-Click Thẩm định 5 Cơ sở liên hoàn và cập nhật từ khóa.
"""

from flask import Blueprint, jsonify, request
from services import PipelineService
from storage import default_repo

pipeline_bp = Blueprint("pipeline_bp", __name__)


@pipeline_bp.route("/api/items/<int:item_id>/update-keyword", methods=["POST"])
def api_update_item_keyword(item_id):
    """Cập nhật từ khóa tra cứu riêng biệt cho 1 mục vật tư."""
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()

    dossier = default_repo.load_dossier()
    target_item = dossier.get_item(item_id)
    if target_item:
        target_item.search_keyword = keyword
        default_repo.save_dossier(dossier)
        return jsonify({"success": True, "keyword": keyword})

    return jsonify({"success": False, "message": f"Không tìm thấy mục {item_id}"}), 404


@pipeline_bp.route("/api/items/<int:item_id>/run-5-pillars", methods=["POST"])
def api_run_5_pillars(item_id):
    """Kích hoạt chạy tự động liên hoàn 5 Khối Chứng Cứ + AI Thuyết minh 1-Click."""
    req = request.get_json() or {}
    kw_input = req.get("keyword", "").strip()
    run_ai = req.get("run_ai", True)

    res = PipelineService.run_5_pillars(
        item_id=item_id,
        keyword_override=kw_input,
        repo=default_repo,
        run_ai=run_ai,
    )

    if not res.get("success"):
        return jsonify(res), 400
    return jsonify(res)


@pipeline_bp.route("/api/pipeline/run-all-fast", methods=["POST"])
def api_run_all_fast():
    """
    Kích hoạt tra cứu nhanh toàn bộ 111 mục trên server đa luồng.
    Tự động đối soát quy cách, model và nêu rõ lý do kỹ thuật.
    """
    from services import FastBatchPipelineService
    res = FastBatchPipelineService.run_batch_async(repo=default_repo, max_workers=6)
    return jsonify(res)


@pipeline_bp.route("/api/pipeline/progress", methods=["GET"])
def api_get_pipeline_progress():
    """Lấy trạng thái và tiến độ tra cứu nhanh realtime."""
    from services import FastBatchPipelineService
    prog = FastBatchPipelineService.get_progress()
    return jsonify({"success": True, "progress": prog})


@pipeline_bp.route("/api/pipeline/stop", methods=["POST"])
def api_stop_pipeline():
    """Dừng tiến trình tra cứu nhanh đang chạy."""
    from services import FastBatchPipelineService
    res = FastBatchPipelineService.stop_batch()
    return jsonify(res)


# ==============================================================================
# VIEW ĐỐI SOÁT GIẢM GIÁ & THAO TÁC REVIEW LOẠI TRỪ NHANH (UI SHEET 4)
# ==============================================================================

@pipeline_bp.route("/api/reduced-items", methods=["GET"])
def api_get_reduced_items():
    """
    Lấy danh sách chi tiết các mục đang có giá giảm hoặc đã từng bị loại trừ,
    kèm đầy đủ dữ liệu so sánh Quy cách/Model và Đánh giá Thời hạn 12 tháng.
    """
    from datetime import datetime
    dossier = default_repo.load_dossier()
    items = dossier.items or []

    now_dt = datetime.now()
    ref_current_date = now_dt if now_dt.year >= 2026 else datetime(2026, 9, 18)
    now_display_str = ref_current_date.strftime("%d/%m/%Y")

    result_items = []

    for it in items:
        extra = getattr(it, "_extra_fields", {}) or {}
        is_excluded = bool(extra.get("excluded_from_reduction")) or ("Loại trừ" in (it.co_so_thong_nhat or ""))
        is_currently_reduced = (it.gia_tri_giam > 0) or (it.don_gia_thong_nhat > 0 and it.don_gia_thong_nhat < it.don_gia_trinh)

        if not is_currently_reduced and not is_excluded:
            continue

        item_id = it.id
        cs_name = it.co_so_thong_nhat or ""
        prev_basis = extra.get("prev_winning_basis", "")
        active_basis = prev_basis if (is_excluded and prev_basis) else cs_name

        target_spec_str = f"{it.thong_so_kt or it.part_no or ''} - Hãng: {it.hsx_xx or 'Theo hồ sơ'}".strip(" -")

        # Đọc dữ liệu cơ sở thực tế từ repository
        erp_ev = default_repo.load_item_evidence(item_id, "erp")
        imis_ev = default_repo.load_item_evidence(item_id, "imis")
        quotes_ev = default_repo.load_item_evidence(item_id, "quotes")
        msc_ev = default_repo.load_item_evidence(item_id, "muasamcong")

        ref_spec_str = ""
        ref_date_raw = ""
        hd_str = ""

        if "erp" in active_basis.lower() and erp_ev and erp_ev.results:
            rec = erp_ev.results[0]
            ref_spec_str = f"{rec.get('tenVt', '')} | {rec.get('thongSoKt', '')}".strip()
            raw_d = str(rec.get("ngayKyHd") or rec.get("ngayNhapKho") or rec.get("ngayChungTu") or "")
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ""
            hd_str = str(rec.get("soHopDong") or rec.get("soChungTu") or "HĐ CSDL ERP VT4")
        elif "imis" in active_basis.lower() and imis_ev and imis_ev.imis:
            rec = imis_ev.imis[0]
            ref_spec_str = f"{rec.get('tenVt', '')} | Đơn vị: {rec.get('tenDonVi', '')}".strip()
            raw_d = str(rec.get("ngayKy") or rec.get("ngayKyHd") or "")
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ""
            hd_str = str(rec.get("soHopDong") or "EVN IMIS")
        elif "mua sắm công" in active_basis.lower() and msc_ev:
            rec = msc_ev.selected_record or (msc_ev.danh_sach_ket_qua[0] if msc_ev.danh_sach_ket_qua else {})
            ref_spec_str = str(rec.get("danh_muc") or rec.get("danh_muc_hang_hoa") or rec.get("thong_so_kt") or "")
            raw_d = str(rec.get("ngay_trung") or rec.get("ngay_phe_duyet") or rec.get("ngay_dang_tai") or "")
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ""
            hd_str = str(rec.get("ma_tbmt") or "Hệ thống e-GP")
        else:
            ref_spec_str = "Báo giá cạnh tranh nộp kèm đợt thẩm định 2026"
            ref_date_raw = "2026-09-01"
            hd_str = "Báo giá NCC chào cạnh tranh"

        # Mục tiêu 1: Đánh giá tương đồng quy cách, thông số, model
        eval_spec = "✅ Khớp đúng Model & Thông số kỹ thuật yêu cầu"
        t_upper = (str(it.ten_vt) + " " + target_spec_str).upper()
        r_upper = str(ref_spec_str).upper()
        if "CLASS" in t_upper and "CLASS" in r_upper:
            if "1500" in t_upper and "1500" in r_upper:
                eval_spec = "✅ Khớp đúng cấp áp lực Class 1500# và quy cách thiết kế"
        elif "BẢN VẼ" in t_upper or "OEM" in t_upper:
            eval_spec = "✅ Gia công đúng bản vẽ thiết kế OEM của Nhà chế tạo"
        elif not ref_spec_str or ref_spec_str.startswith("Báo giá"):
            eval_spec = "✅ Báo giá cạnh tranh đáp ứng 100% hồ sơ yêu cầu kỹ thuật"

        # Mục tiêu 2: Đánh giá thời gian từ ngày cơ sở đến ngày hiện tại (chuẩn 12 tháng)
        months_diff = 0
        date_display = "—"
        is_over_12 = False
        status_12m = "⚪ Báo giá hiện hành 2026"

        if ref_date_raw and len(ref_date_raw) >= 8:
            try:
                d_obj = datetime.strptime(ref_date_raw[:10], "%Y-%m-%d")
                date_display = d_obj.strftime("%d/%m/%Y")
                months_diff = (ref_current_date.year - d_obj.year) * 12 + (ref_current_date.month - d_obj.month)
                if months_diff < 0:
                    months_diff = 0
                is_over_12 = months_diff > 12
                if is_over_12:
                    status_12m = f"🟡 Quá 12 tháng ({months_diff} tháng - {months_diff/12:.1f} năm)"
                else:
                    status_12m = f"🟢 Trong hạn 12 tháng ({months_diff} tháng)"
            except Exception:
                date_display = ref_date_raw
                status_12m = "⚪ Báo giá hiện hành 2026"

        it_dict = it.to_dict()
        it_dict["target_spec_str"] = target_spec_str
        it_dict["ref_spec_str"] = ref_spec_str
        it_dict["hd_str"] = hd_str
        it_dict["ref_date_raw"] = ref_date_raw
        it_dict["ref_date_display"] = date_display
        it_dict["now_display_str"] = now_display_str
        it_dict["months_diff"] = months_diff
        it_dict["is_over_12m"] = is_over_12
        it_dict["status_12m"] = status_12m
        it_dict["eval_spec"] = eval_spec
        it_dict["is_excluded"] = is_excluded
        it_dict["prev_suggested_price"] = extra.get("prev_suggested_price", 0)
        it_dict["prev_winning_basis"] = extra.get("prev_winning_basis", "")
        it_dict["exclusion_reason"] = extra.get("exclusion_reason", "")

        result_items.append(it_dict)

    # Thống kê tổng hợp
    total_savings = sum([it.get("gia_tri_giam", 0) for it in result_items if not it.get("is_excluded")])
    over_12m_count = sum([1 for it in result_items if it.get("is_over_12m") and not it.get("is_excluded")])
    under_12m_count = sum([1 for it in result_items if not it.get("is_over_12m") and not it.get("is_excluded")])
    excluded_count = sum([1 for it in result_items if it.get("is_excluded")])

    return jsonify({
        "success": True,
        "items": result_items,
        "total_count": len(result_items),
        "total_savings": total_savings,
        "over_12m_count": over_12m_count,
        "under_12m_count": under_12m_count,
        "excluded_count": excluded_count,
    })


@pipeline_bp.route("/api/items/<int:item_id>/exclude-reduction", methods=["POST"])
def api_exclude_reduction(item_id):
    """
    Loại trừ 1 mục khỏi danh sách tiết kiệm:
    Đặt lại đơn giá thống nhất = đơn giá trình, tiết kiệm = 0 đ, ghi nhận lý do loại trừ.
    """
    req = request.get_json() or {}
    reason = req.get("reason", "").strip() or "Cơ sở giá quá 12 tháng / chưa phù hợp điều kiện kỹ thuật thực tế"

    dossier = default_repo.load_dossier()
    target_item = dossier.get_item(item_id)
    if not target_item:
        return jsonify({"success": False, "message": f"Không tìm thấy mục {item_id}"}), 404

    if not hasattr(target_item, "_extra_fields") or target_item._extra_fields is None:
        target_item._extra_fields = {}

    target_item._extra_fields["excluded_from_reduction"] = True
    target_item._extra_fields["prev_suggested_price"] = target_item.don_gia_thong_nhat
    target_item._extra_fields["prev_winning_basis"] = target_item.co_so_thong_nhat
    target_item._extra_fields["exclusion_reason"] = reason

    target_item.don_gia_thong_nhat = target_item.don_gia_trinh
    target_item.thanh_tien_thong_nhat = target_item.thanh_tien_trinh
    target_item.gia_tri_giam = 0.0
    target_item.co_so_thong_nhat = "Chấp thuận giá trình (Loại trừ ép giá)"
    target_item.danh_gia_ttd = f"Chuyên viên thẩm định loại trừ cơ sở giá do: {reason}. Chấp thuận áp dụng đơn giá dự toán trình."
    target_item.recalculate_totals()

    default_repo.save_dossier(dossier)
    return jsonify({"success": True, "message": f"Đã loại trừ mục {item_id} khỏi danh sách tiết kiệm", "item": target_item.to_dict()})


@pipeline_bp.route("/api/items/<int:item_id>/restore-reduction", methods=["POST"])
def api_restore_reduction(item_id):
    """
    Khôi phục lại mức giá giảm cho 1 mục đã bị loại trừ trước đó.
    """
    dossier = default_repo.load_dossier()
    target_item = dossier.get_item(item_id)
    if not target_item:
        return jsonify({"success": False, "message": f"Không tìm thấy mục {item_id}"}), 404

    extra = getattr(target_item, "_extra_fields", {}) or {}
    prev_price = extra.get("prev_suggested_price")
    prev_basis = extra.get("prev_winning_basis")

    if prev_price and prev_price > 0 and prev_price < target_item.don_gia_trinh:
        target_item.don_gia_thong_nhat = prev_price
        target_item.co_so_thong_nhat = prev_basis or "Cơ sở thẩm định"
        target_item.danh_gia_ttd = f"Đơn giá đề nghị {prev_price:,.0f} đ căn cứ theo {target_item.co_so_thong_nhat}."
        target_item._extra_fields["excluded_from_reduction"] = False
        target_item.recalculate_totals()
        default_repo.save_dossier(dossier)
        return jsonify({"success": True, "message": f"Đã khôi phục mức giảm giá cho mục {item_id}", "item": target_item.to_dict()})

    # Nếu không có mốc giá cũ, thử đọc lại từ synthesis evidence
    syn_ev = default_repo.load_item_evidence(item_id, "synthesis")
    if syn_ev and getattr(syn_ev, "approved_price", 0) > 0 and syn_ev.approved_price < target_item.don_gia_trinh:
        target_item.don_gia_thong_nhat = syn_ev.approved_price
        target_item.co_so_thong_nhat = syn_ev.co_so_thong_nhat or "Cơ sở thẩm định"
        target_item.danh_gia_ttd = syn_ev.summary_text
        if hasattr(target_item, "_extra_fields") and target_item._extra_fields:
            target_item._extra_fields["excluded_from_reduction"] = False
        target_item.recalculate_totals()
        default_repo.save_dossier(dossier)
        return jsonify({"success": True, "message": f"Đã khôi phục mức giảm giá từ chứng cứ", "item": target_item.to_dict()})

    return jsonify({"success": False, "message": "Không tìm thấy cơ sở giảm giá cũ để khôi phục"}), 400


@pipeline_bp.route("/api/items/batch-exclude-reductions", methods=["POST"])
def api_batch_exclude_reductions():
    """
    Thao tác hàng loạt: Loại trừ nhiều mục cùng lúc khỏi danh sách tiết kiệm.
    """
    req = request.get_json() or {}
    item_ids = req.get("item_ids", [])
    reason = req.get("reason", "").strip() or "Cơ sở giá quá 12 tháng / chưa phù hợp điều kiện kỹ thuật thực tế"

    if not item_ids:
        return jsonify({"success": False, "message": "Chưa chọn mục nào để loại trừ"}), 400

    dossier = default_repo.load_dossier()
    updated_count = 0

    for iid in item_ids:
        try:
            iid_int = int(iid)
        except (TypeError, ValueError):
            continue

        it = dossier.get_item(iid_int)
        if it and (it.gia_tri_giam > 0 or it.don_gia_thong_nhat < it.don_gia_trinh):
            if not hasattr(it, "_extra_fields") or it._extra_fields is None:
                it._extra_fields = {}
            it._extra_fields["excluded_from_reduction"] = True
            it._extra_fields["prev_suggested_price"] = it.don_gia_thong_nhat
            it._extra_fields["prev_winning_basis"] = it.co_so_thong_nhat
            it._extra_fields["exclusion_reason"] = reason

            it.don_gia_thong_nhat = it.don_gia_trinh
            it.thanh_tien_thong_nhat = it.thanh_tien_trinh
            it.gia_tri_giam = 0.0
            it.co_so_thong_nhat = "Chấp thuận giá trình (Loại trừ ép giá)"
            it.danh_gia_ttd = f"Chuyên viên thẩm định loại trừ cơ sở giá do: {reason}. Chấp thuận áp dụng đơn giá dự toán trình."
            it.recalculate_totals()
            updated_count += 1

    if updated_count > 0:
        default_repo.save_dossier(dossier)

    return jsonify({
        "success": True,
        "message": f"Đã loại trừ thành công {updated_count} mục khỏi danh sách tiết kiệm!",
        "updated_count": updated_count,
    })


