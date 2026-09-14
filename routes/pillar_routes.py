# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Pillar Routes Blueprint
Quản lý các API tra cứu cho 4 Khối Căn Cứ độc lập:
- Cơ sở 1: Báo Giá Gốc (Quotes)
- Cơ sở 2: CSDL ERP Vĩnh Tân 4
- Cơ sở 3: Hợp đồng EVN IMIS toàn ngành
- Cơ sở 4: Cổng Mua Sắm Công e-GP
"""

from datetime import datetime
import json
import os
import re
import shutil
from flask import Blueprint, jsonify, request, send_file

from models import DossierItem
from services import ErpService, ImisService, MscService, QuoteService
from storage import default_repo, read_json_safe, write_json_atomic
import imis_core
import msc_matcher
import quote_matcher

pillar_bp = Blueprint("pillar_bp", __name__)


def get_project_quote_overrides():
    """Lấy dữ liệu hiệu chỉnh báo giá thủ công của dự án."""
    p_dir = default_repo.get_project_files_dir()
    fpath = os.path.join(p_dir, "quote_overrides.json")
    if os.path.exists(fpath):
        return read_json_safe(fpath)
    return {}


# ==============================================================================
# KHỐI 1: BÁO GIÁ GỐC (QUOTES)
# ==============================================================================

@pillar_bp.route("/api/quotes/scan", methods=["POST"])
def api_scan_quotes():
    """Quét thư mục chứa các file PDF báo giá của các nhà thầu."""
    req = request.get_json() or {}
    folder = req.get("folder_path") or quote_matcher.DEFAULT_QUOTES_DIR
    force_rescan = bool(req.get("force_rescan", False))
    res = quote_matcher.scan_quotation_folder(folder, force_rescan=force_rescan)
    return jsonify(res)


@pillar_bp.route("/api/quotes/view-pdf")
def api_view_quote_pdf():
    """Xem trực tiếp file PDF báo giá gốc trên trình duyệt."""
    fpath = request.args.get("path") or ""
    filename = request.args.get("filename") or ""

    if fpath:
        norm_path = os.path.normpath(fpath.strip())
        if os.path.exists(norm_path) and os.path.isfile(norm_path):
            return send_file(norm_path, mimetype="application/pdf")

    target_fn = filename.strip() if filename else ""
    if not target_fn and fpath:
        m = re.search(r'([^\\/]+\.pdf)$', fpath, re.IGNORECASE)
        if m:
            target_fn = m.group(1)

    if target_fn:
        quotes_dir = quote_matcher.DEFAULT_QUOTES_DIR
        candidate = os.path.join(quotes_dir, target_fn)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return send_file(candidate, mimetype="application/pdf")

        for root, dirs, files in os.walk(quotes_dir):
            for f in files:
                if f.lower() == target_fn.lower() or target_fn.lower().endswith(f.lower()) or f.lower().endswith(target_fn.lower()):
                    full_match = os.path.join(root, f)
                    if os.path.exists(full_match) and os.path.isfile(full_match):
                        return send_file(full_match, mimetype="application/pdf")

    return f"Không tìm thấy file PDF: {filename or fpath}", 404


@pillar_bp.route("/api/quotes/save-edited-quote", methods=["POST"])
@pillar_bp.route("/api/quotes/save-override", methods=["POST"])
def api_save_quote_override():
    """Lưu trữ dữ liệu ghi đè/sửa đổi thủ công đối với kết quả bóc tách báo giá."""
    req = request.get_json() or {}
    overrides = req.get("overrides", {})
    p_dir = default_repo.get_project_files_dir()
    fpath = os.path.join(p_dir, "quote_overrides.json")
    write_json_atomic(fpath, overrides)
    return jsonify({"success": True, "message": "Đã lưu ghi đè báo giá thành công"})


@pillar_bp.route("/api/quotes/get-full-quote", methods=["GET", "POST"])
@pillar_bp.route("/api/quotes/item-data", methods=["GET", "POST"])
def api_get_full_quote():
    """Lấy chi tiết bảng báo giá của 1 file cụ thể."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    filename = req.get("filename") or request.args.get("filename")
    if not filename:
        return jsonify({"success": False, "message": "Thiếu filename"}), 400

    q_data = quote_matcher.scan_quotation_folder()
    for q in q_data:
        if q.get("filename") == filename or os.path.basename(q.get("filepath", "")) == filename:
            return jsonify({"success": True, "data": q})

    return jsonify({"success": False, "message": "Không tìm thấy báo giá"}), 404


@pillar_bp.route("/api/quotes/match-item", methods=["POST"])
@pillar_bp.route("/api/quotes/by-item", methods=["GET", "POST"])
def api_quotes_match_item():
    """Đối chiếu báo giá gốc cho 1 mục vật tư cụ thể."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    item = req.get("item") or req
    evidence = QuoteService.match_item(item)
    return jsonify({"success": True, "data": evidence.to_dict()})


@pillar_bp.route("/api/quotes/attach-matched-pdf", methods=["POST"])
def api_attach_matched_pdf():
    """Đính kèm file PDF báo giá gốc vào thư mục chứng cứ của mục."""
    req = request.get_json() or {}
    item_id = req.get("item_id")
    pdf_path = req.get("pdf_path")
    if not item_id or not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"success": False, "message": "File báo giá không tồn tại"}), 400

    filename = os.path.basename(pdf_path)
    item_dir = default_repo.get_item_dir(item_id)
    dest_path = os.path.join(item_dir, filename)
    shutil.copy2(pdf_path, dest_path)

    rel_path = f"item_{item_id}/{filename}"
    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item:
        if not hasattr(item, "_extra_fields"):
            item._extra_fields = {}
        attachments = item._extra_fields.get("attachments", [])
        if not any(a.get("rel_path") == rel_path for a in attachments):
            attachments.append({
                "name": filename,
                "rel_path": rel_path,
                "type": "pdf",
                "size": os.path.getsize(dest_path),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
            item._extra_fields["attachments"] = attachments
            default_repo.save_dossier(dossier)

    return jsonify({"success": True, "rel_path": rel_path, "filename": filename})


# ==============================================================================
# KHỐI 2: ERP VĨNH TÂN 4
# ==============================================================================

@pillar_bp.route("/api/erp/config-status", methods=["GET"])
def api_erp_config_status():
    """Kiểm tra trạng thái cấu hình CSDL ERP."""
    return jsonify(imis_core.get_erp_config_status())


@pillar_bp.route("/api/erp/preview-columns", methods=["POST"])
def api_erp_preview_columns():
    """Xem trước danh sách cột từ file Excel ERP tải lên."""
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Không có file được tải lên"}), 400
    file = request.files["file"]
    temp_path = os.path.join(default_repo.data_dir, "_temp_erp_preview.xlsx")
    file.save(temp_path)
    try:
        headers = imis_core.get_excel_headers(temp_path)
        os.remove(temp_path)
        return jsonify({"success": True, "headers": headers})
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"success": False, "message": str(e)}), 500


@pillar_bp.route("/api/erp/search", methods=["POST"])
def api_search_erp():
    """Tra cứu lịch sử mua sắm ERP Vĩnh Tân 4 cho một mục vật tư."""
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()
    ma_vt = req.get("ma_vt", "").strip()
    item = req.get("item", {})
    selected_record = req.get("selected_record")
    use_average = req.get("use_average", False) or selected_record == "AVERAGE"
    min_score = int(req.get("min_score", 60))

    evidence = ErpService.search(
        keyword=keyword,
        ma_vt=ma_vt,
        item=item,
        selected_record=selected_record,
        use_average=use_average,
        min_score=min_score,
    )

    return jsonify({
        "success": True,
        "results": evidence.results,
        "mapping": evidence.mapping,
        "summary": evidence.summary,
        "summary_text": evidence.summary_text,
    })


# ==============================================================================
# KHỐI 3: EVN IMIS TOÀN NGÀNH
# ==============================================================================

@pillar_bp.route("/api/imis/config-status", methods=["GET"])
def api_imis_config_status():
    """Lấy thông tin tình trạng Token và đăng nhập IMIS."""
    return jsonify(imis_core.get_imis_config_status())


@pillar_bp.route("/api/refresh-token", methods=["POST"])
def api_refresh_token():
    """Chủ động gia hạn Token IMIS."""
    res = imis_core.refresh_imis_token()
    return jsonify(res)


@pillar_bp.route("/api/imis/login", methods=["POST"])
def api_imis_login():
    """Đăng nhập lấy Token EVN IMIS."""
    req = request.get_json() or {}
    username = req.get("username", "").strip()
    password = req.get("password", "").strip()
    remember = bool(req.get("remember_me", False))
    res = imis_core.login_imis(username, password, remember_me=remember)
    return jsonify(res)


@pillar_bp.route("/api/imis/search", methods=["POST"])
def api_search_imis():
    """Tra cứu hợp đồng EVN IMIS toàn ngành theo từ khóa."""
    req = request.get_json() or {}
    kw = req.get("keyword", "").strip()
    tu_ngay = req.get("tu_ngay", "2023-01-01")
    den_ngay = req.get("den_ngay")
    ma_vt = req.get("ma_vt", "")
    item = req.get("item", kw)
    selected_record = req.get("selected_record")
    is_deselected = bool(req.get("is_deselected") or selected_record == "NONE")
    use_average = req.get("use_average", False)

    evidence = ImisService.search(
        keyword=kw,
        item=item,
        tu_ngay=tu_ngay,
        den_ngay=den_ngay,
        ma_vt=ma_vt,
        selected_record=selected_record,
        use_average=use_average,
        is_deselected=is_deselected,
    )

    return jsonify(evidence.to_dict())


# ==============================================================================
# KHỐI 4: MUA SẮM CÔNG E-GP
# ==============================================================================

@pillar_bp.route("/api/msc/update-curl", methods=["POST"])
def api_msc_update_curl():
    """Cập nhật phiên Mua Sắm Công bằng chuỗi cURL dán từ Chrome DevTools."""
    req = request.get_json() or {}
    curl_str = req.get("curl_command", "").strip()
    sess, err = msc_matcher.parse_curl_command(curl_str)
    if err:
        return jsonify({"success": False, "message": err}), 400

    test_res = msc_matcher.test_msc_connection(sess)
    return jsonify(test_res)


@pillar_bp.route("/api/msc/status", methods=["GET"])
def api_msc_status():
    """Kiểm tra trạng thái kết nối tới Cổng Mua Sắm Công."""
    return jsonify(msc_matcher.test_msc_connection())


@pillar_bp.route("/api/msc/search", methods=["POST"])
@pillar_bp.route("/api/msc/search-item", methods=["POST"])
@pillar_bp.route("/api/muasamcong/search", methods=["POST"])
def api_msc_search():
    """Tra cứu đơn giá trúng thầu Mua Sắm Công cho 1 mục vật tư."""
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()
    item = req.get("item", {})
    page_num = int(req.get("page_number") or req.get("page_num") or 0)
    page_sz = int(req.get("page_size") or req.get("page_sz") or 20)

    evidence = MscService.search(
        keyword=keyword,
        item=item,
        page_number=page_num,
        page_size=page_sz,
    )

    # Tự động lưu chứng cứ vào file nếu có item_id
    item_id = item.get("id")
    if item_id:
        default_repo.save_item_evidence(item_id, "muasamcong", evidence)

    return jsonify({"success": True, "analysis": evidence.to_dict()})
