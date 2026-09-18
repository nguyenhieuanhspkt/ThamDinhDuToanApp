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

