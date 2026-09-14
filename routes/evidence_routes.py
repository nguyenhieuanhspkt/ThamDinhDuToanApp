# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Evidence Routes Blueprint
Quản lý truy xuất, lưu trữ và đối soát tiến độ 6 Khối Chứng Cứ.
"""

from datetime import datetime
import json
import os
from flask import Blueprint, jsonify, request

from models import DossierItem, ProjectDossier, SynthesisEvidence
from services import AiSynthesisService
from storage import default_repo

evidence_bp = Blueprint("evidence_bp", __name__)


def cascade_sync_synthesis(item_id: int, item_dir: str, step_type: str, saved_payload: dict):
    """
    Tự động đồng bộ liên thông sang chung_cu_synthesis.json và dossier
    khi có bất kỳ khối chứng cứ nào được lưu.
    """
    try:
        syn_model = default_repo.load_item_evidence(item_id, "synthesis")
        pillars_data = syn_model.pillars if isinstance(syn_model, SynthesisEvidence) else {}

        pillar_map = {
            "quotes": "p1",
            "erp": "p2",
            "imis": "p3",
            "muasamcong": "p4",
            "ecom": "p5",
        }
        p_key = pillar_map.get(step_type)
        if not p_key:
            return None

        # Cập nhật thông tin cho pillar tương ứng
        is_deselected = bool(
            saved_payload.get("is_deselected")
            or saved_payload.get("selected_record") == "NONE"
            or saved_payload.get("status") in ["ERP_DESELECTED", "IMIS_DESELECTED"]
        )

        min_price = 0.0
        if not is_deselected:
            min_price = float(
                saved_payload.get("min_price")
                or saved_payload.get("don_gia_tham_chieu")
                or saved_payload.get("don_gia_truoc_thue")
                or 0.0
            )

        pillars_data[p_key] = {
            "has": min_price > 0 and not is_deselected,
            "name": f"Cơ sở {p_key[-1]}",
            "price": min_price,
            "desc": saved_payload.get("summary_text", ""),
        }

        # Tính lại điểm phủ và mốc giá gợi ý
        valid_prices = [
            float(p.get("price", 0))
            for p in pillars_data.values()
            if isinstance(p, dict) and float(p.get("price", 0)) > 0
        ]

        dossier = default_repo.load_dossier()
        target_item = dossier.get_item(item_id)
        dg_trinh = target_item.don_gia_trinh if target_item else 0.0
        qty = target_item.so_luong if target_item else 1.0

        suggested_price = min(valid_prices) if valid_prices else dg_trinh

        if isinstance(syn_model, SynthesisEvidence):
            syn_model.pillars = pillars_data
            if syn_model.approved_price is None or syn_model.approved_price <= 0:
                syn_model.set_approved_price(suggested_price, dg_trinh=dg_trinh, so_luong=qty)
            default_repo.save_item_evidence(item_id, "synthesis", syn_model)

        return syn_model.to_dict() if isinstance(syn_model, SynthesisEvidence) else None
    except Exception as ex:
        print(f"[AutoCascadeSync] Lỗi tự động đồng bộ synthesis cho item #{item_id}: {ex}")
        return None


@evidence_bp.route("/api/evidence/get", methods=["GET"])
@evidence_bp.route("/api/evidence/get-item-evidence/<int:item_id>", methods=["GET"])
@evidence_bp.route("/api/items/<int:item_id>/evidence/<step_type>", methods=["GET"])
def api_get_item_evidence(item_id=None, step_type=None):
    """Đọc toàn bộ chứng cứ 5 Cơ sở đã lưu của 1 mục vật tư (Đồng bộ tuyệt đối qua FileRepository & Models)."""
    if item_id is None:
        try:
            item_id = int(request.args.get("item_id"))
        except (TypeError, ValueError):
            item_id = None

    step_type = step_type or request.args.get("step_type")
    if not item_id:
        return jsonify({"success": False, "message": "Thiếu item_id"}), 400

    if step_type:
        fpath = default_repo.resolve_evidence_file(item_id, step_type)
        if fpath and os.path.exists(fpath):
            evidence_model = default_repo.load_item_evidence(item_id, step_type)
            data = evidence_model.to_dict()
            return jsonify({"success": True, "data": data, "payload": data})
        return jsonify({"success": True, "data": None, "payload": None})

    evidence = {}
    steps = ["quotes", "erp", "imis", "muasamcong", "ecom", "synthesis"]
    for s in steps:
        fpath = default_repo.resolve_evidence_file(item_id, s)
        if fpath and os.path.exists(fpath):
            try:
                ev_model = default_repo.load_item_evidence(item_id, s)
                evidence[s] = ev_model.to_dict()
            except Exception:
                evidence[s] = None
        else:
            evidence[s] = None

    resp = jsonify({"success": True, "evidence": evidence})
    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    resp.headers["Pragma"] = "no-cache"
    return resp


@evidence_bp.route("/api/evidence/save-step", methods=["POST"])
@evidence_bp.route("/api/items/<int:item_id>/evidence/<step_type>", methods=["POST", "DELETE"])
def api_save_evidence_step(item_id=None, step_type=None):
    """Lưu bằng chứng tiến trình tra cứu cho ERP, IMIS, MSC hoặc Báo giá."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    item_id = item_id or req.get("item_id")
    step_type = step_type or req.get("step_type")
    payload = req.get("payload", req)

    if isinstance(payload, dict) and payload.get("is_deselected") is True:
        payload["min_price"] = 0
        payload["don_gia_tham_chieu"] = 0
        if "selected_record" in payload:
            payload["selected_record"] = "NONE"

    if not item_id or not step_type:
        return jsonify({"success": False, "message": "Thiếu thông tin"}), 400

    item_dir = default_repo.get_item_dir(item_id)
    fname = f"chung_cu_{step_type}.json"

    # Nạp dữ liệu cũ để gộp nếu có
    existing_model = default_repo.load_item_evidence(item_id, step_type)
    existing_data = existing_model.to_dict()

    if isinstance(existing_data, dict) and isinstance(payload, dict):
        if payload.get("is_deselected") is True:
            existing_data["min_price"] = 0
            existing_data["don_gia_tham_chieu"] = 0
            existing_data["selected_record"] = "NONE"
        existing_data.update(payload)
        final_payload = existing_data
    else:
        final_payload = payload

    final_payload["thoi_gian_luu"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Ghi file an toàn qua cơ chế Atomic Write của FileRepository & Models
    default_repo.save_item_evidence(item_id, step_type, final_payload)

    syn_data = None
    if step_type in ["quotes", "erp", "imis", "muasamcong", "ecom"]:
        syn_data = cascade_sync_synthesis(item_id, item_dir, step_type, final_payload)
    elif step_type == "synthesis" or "approved_price" in payload:
        try:
            approved_p = float(payload.get("approved_price") if payload.get("approved_price") is not None else 0)
            sum_text = payload.get("summary_text") or ""
            dossier_model = default_repo.load_dossier()
            target_it = dossier_model.get_item(item_id)
            if target_it:
                target_it.don_gia_thong_nhat = approved_p
                target_it.danh_gia_ttd = sum_text
                if payload.get("co_so_thong_nhat"):
                    target_it.co_so_thong_nhat = payload["co_so_thong_nhat"]
                target_it.recalculate_totals()
                default_repo.save_dossier(dossier_model)
            syn_data = final_payload
        except Exception as e:
            print(f"Lỗi đồng bộ hồ sơ dự án khi lưu synthesis: {e}")

    return jsonify({"success": True, "filename": fname, "synthesis": syn_data})


@evidence_bp.route("/api/evidence/status/<int:item_id>", methods=["GET"])
def api_evidence_status(item_id):
    """Kiểm tra xem mục này đã có các chứng cứ nào được lưu."""
    k1 = default_repo.resolve_evidence_file(item_id, "quotes") is not None
    k2 = default_repo.resolve_evidence_file(item_id, "erp") is not None
    k3 = default_repo.resolve_evidence_file(item_id, "imis") is not None
    k4 = default_repo.resolve_evidence_file(item_id, "muasamcong") is not None
    k5 = default_repo.resolve_evidence_file(item_id, "ecom") is not None
    k6 = default_repo.resolve_evidence_file(item_id, "synthesis") is not None
    return jsonify({
        "has_quotes": k1,
        "has_erp": k2,
        "has_imis": k3,
        "has_msc": k4,
        "has_ecom": k5,
        "has_syn": k6,
        "done_count": sum([1 if x else 0 for x in [k1, k2, k3, k4, k5]]),
    })


@evidence_bp.route("/api/evidence/all-status", methods=["GET"])
def api_evidence_all_status():
    """Kiểm tra tiến độ 5 cơ sở của toàn bộ các mục trong dự án."""
    p_dir = default_repo.get_project_files_dir()
    fb_base = default_repo.current_dossier_files

    all_item_ids = set()
    for base in [p_dir, fb_base]:
        if os.path.exists(base):
            for entry in os.listdir(base):
                if entry.startswith("item_"):
                    try:
                        all_item_ids.add(int(entry.replace("item_", "")))
                    except Exception:
                        pass

    status_map = {}
    for i_id in sorted(all_item_ids):
        k1 = default_repo.resolve_evidence_file(i_id, "quotes") is not None
        k2 = default_repo.resolve_evidence_file(i_id, "erp") is not None
        k3 = default_repo.resolve_evidence_file(i_id, "imis") is not None
        k4 = default_repo.resolve_evidence_file(i_id, "muasamcong") is not None
        k5 = default_repo.resolve_evidence_file(i_id, "ecom") is not None
        k6 = default_repo.resolve_evidence_file(i_id, "synthesis") is not None
        status_map[str(i_id)] = {
            "has_quotes": k1,
            "has_erp": k2,
            "has_imis": k3,
            "has_msc": k4,
            "has_ecom": k5,
            "has_syn": k6,
            "done_count": sum([1 if x else 0 for x in [k1, k2, k3, k4, k5]]),
        }

    return jsonify({"success": True, "status_map": status_map, "total_items": len(status_map)})


@evidence_bp.route("/api/items/<int:item_id>/run-ai-synthesis", methods=["POST"])
def api_run_ai_synthesis(item_id):
    """Trực tiếp gọi Lõi Dịch Vụ ai_synthesis để sinh Thuyết minh Chuyên gia cho 1 mục vật tư."""
    try:
        dossier = default_repo.load_dossier()
        target_item = dossier.get_item(item_id)
        if not target_item:
            return jsonify({"success": False, "error": f"Không tìm thấy item_id={item_id}"}), 404

        # Nạp dữ liệu 5 cơ sở qua repository
        q_ev = default_repo.load_item_evidence(item_id, "quotes")
        erp_ev = default_repo.load_item_evidence(item_id, "erp")
        imis_ev = default_repo.load_item_evidence(item_id, "imis")
        msc_ev = default_repo.load_item_evidence(item_id, "muasamcong")
        ecom_ev = default_repo.load_item_evidence(item_id, "ecom")

        p1_price = getattr(q_ev, "min_price", 0.0)
        p2_price = 0.0
        if getattr(erp_ev, "results", None) and not getattr(erp_ev, "is_deselected", False):
            p2_price = float(erp_ev.results[0].get("don_gia") or erp_ev.results[0].get("donGia") or 0.0)

        p3_price = 0.0
        if getattr(imis_ev, "imis", None) and not getattr(imis_ev, "is_deselected", False):
            p3_price = float(imis_ev.imis[0].get("don_gia") or imis_ev.imis[0].get("donGia") or 0.0)

        p4_price = getattr(msc_ev, "don_gia_tham_chieu", 0.0) if not getattr(msc_ev, "is_deselected", False) else 0.0

        pillars = {
            "p1": {"price": p1_price, "desc": getattr(q_ev, "summary_text", ""), "has": p1_price > 0, "name": "Báo giá gốc"},
            "p2": {"price": p2_price, "desc": getattr(erp_ev, "summary_text", ""), "has": p2_price > 0, "name": "ERP VT4"},
            "p3": {"price": p3_price, "desc": getattr(imis_ev, "summary_text", ""), "has": p3_price > 0, "name": "EVN IMIS"},
            "p4": {"price": p4_price, "desc": getattr(msc_ev, "summary_text", ""), "has": p4_price > 0, "name": "Mua Sắm Công"},
            "p5": {"price": 0, "desc": getattr(ecom_ev, "summary_text", ""), "has": False, "name": "TMĐT Web"},
        }

        synthesis_model = AiSynthesisService.synthesize(target_item, pillars)
        default_repo.save_item_evidence(item_id, "synthesis", synthesis_model)

        return jsonify({
            "success": True,
            "analysis": synthesis_model.to_dict(),
            "summary_text": synthesis_model.summary_text,
        })
    except Exception as e:
        print(f"Lỗi chạy AI synthesis cho item {item_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
