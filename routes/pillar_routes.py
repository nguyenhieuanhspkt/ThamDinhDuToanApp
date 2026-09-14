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


@pillar_bp.route("/api/quotes/match-all-dossier-items", methods=["GET", "POST"])
def api_match_all_dossier_items():
    """Tự động đối chiếu toàn bộ danh mục vật tư trong dự án với các file Báo giá gốc."""
    dossier = default_repo.load_dossier()
    p_dir = default_repo.get_project_files_dir()
    approved_file = os.path.join(p_dir, "bao_gia_project.json")
    folder = None
    if os.path.exists(approved_file):
        try:
            with open(approved_file, "r", encoding="utf-8") as f:
                folder = json.load(f).get("folder_nguon")
        except Exception:
            pass
    overrides = get_project_quote_overrides()
    res = QuoteService.match_all_dossier_items(dossier.items, folder_path=folder, overrides=overrides)
    return jsonify(res)


@pillar_bp.route("/api/quotes/dossier", methods=["GET", "POST"])
def api_quotes_dossier():
    """Lấy danh sách tất cả các file trong thư mục báo giá, phân loại và trạng thái phê duyệt."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    folder = req.get("folder_path") or request.args.get("folder_path")
    p_dir = default_repo.get_project_files_dir()
    overrides = get_project_quote_overrides()
    res = QuoteService.get_quotes_dossier(folder_path=folder, project_files_dir=p_dir, overrides=overrides)
    return jsonify(res)


@pillar_bp.route("/api/quotes/approve-all", methods=["POST"])
def api_quotes_approve_all():
    """Phê duyệt bộ dữ liệu báo giá đã số hóa vào CSDL chính thức của dự án."""
    req = request.get_json(silent=True) or {}
    folder = req.get("folder_path")
    p_dir = default_repo.get_project_files_dir()
    overrides = get_project_quote_overrides()
    res = QuoteService.approve_all_quotes(folder_path=folder, project_files_dir=p_dir, overrides=overrides)
    return jsonify(res)


@pillar_bp.route("/api/quotes/browse-folders", methods=["GET", "POST"])
def api_quotes_browse_folders():
    """Duyệt danh sách thư mục con để hiển thị cây thư mục trên UI."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    base_path = req.get("path", "").strip() or request.args.get("path", "").strip()
    res = QuoteService.browse_folders(base_path)
    return jsonify(res)


@pillar_bp.route("/api/quotes/native-browse-folder", methods=["GET", "POST"])
def api_quotes_native_browse_folder():
    """Mở cửa sổ Windows Explorer Native Folder Picker Dialog chuẩn của hệ điều hành."""
    res = QuoteService.native_browse_folder()
    return jsonify(res)


# ==============================================================================
# KHỐI 2: ERP VĨNH TÂN 4
# ==============================================================================

@pillar_bp.route("/api/erp/config-status", methods=["GET"])
def api_erp_config_status():
    """Kiểm tra trạng thái cấu hình CSDL ERP."""
    return jsonify(ErpService.get_config_status())


@pillar_bp.route("/api/erp/preview-columns", methods=["POST"])
def api_erp_preview_columns():
    """Đọc tiêu đề cột của file Excel ERP (hỗ trợ cả JSON file_path và file upload)."""
    # 1. Hỗ trợ gửi file upload trực tiếp
    if "file" in request.files:
        file = request.files["file"]
        temp_path = os.path.join(default_repo.data_dir, "_temp_erp_preview.xlsx")
        file.save(temp_path)
        try:
            res = ErpService.preview_columns(temp_path)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify(res)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({"success": False, "message": str(e)}), 500

    # 2. Hỗ trợ gửi JSON body { "file_path": "..." }
    req = request.get_json(silent=True) or {}
    file_path = req.get("file_path", "").strip() or request.form.get("file_path", "").strip()
    if not file_path:
        return jsonify({"success": False, "message": "Vui lòng cung cấp file hoặc đường dẫn file_path."}), 400

    res = ErpService.preview_columns(file_path)
    return jsonify(res)


@pillar_bp.route("/api/erp/upload", methods=["POST"])
def api_erp_upload_file():
    """Tải lên file Excel CSDL ERP mới từ giao diện web."""
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Không tìm thấy file"}), 400
    file = request.files["file"]
    config_dir = os.path.join(default_repo.data_dir, "config")
    res = ErpService.upload_file(file, target_dir=config_dir)
    status_code = 200 if res.get("success", True) else 400
    return jsonify(res), status_code


@pillar_bp.route("/api/erp/save-config", methods=["POST"])
def api_erp_save_config():
    """Lưu cấu hình vị trí file Excel ERP và mapping 13 cột pháp lý."""
    req = request.get_json() or {}
    file_path = req.get("file_path", "").strip()
    mapping = req.get("mapping", {})
    header_row = int(req.get("header_row", 1))

    res = ErpService.save_config(file_path, mapping, header_row=header_row)
    status_code = 200 if res.get("success") else 400
    return jsonify(res), status_code


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
    return jsonify(ImisService.get_config_status())


@pillar_bp.route("/api/refresh-token", methods=["POST"])
def api_refresh_token():
    """Chủ động gia hạn Token IMIS."""
    res = ImisService.refresh_token()
    return jsonify(res)


@pillar_bp.route("/api/imis/login", methods=["POST"])
def api_imis_login():
    """Đăng nhập lấy Token EVN IMIS."""
    req = request.get_json() or {}
    username = req.get("username", "").strip()
    password = req.get("password", "").strip()
    remember = bool(req.get("remember", req.get("remember_me", True)))
    res = ImisService.login(username, password, remember=remember)
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


@pillar_bp.route("/api/search-item-sources", methods=["POST"])
def api_search_sources():
    """Tra cứu tổng hợp các nguồn CSDL (IMIS & ERP) theo từ khóa."""
    req = request.get_json() or {}
    kw = req.get("keyword", "").strip()
    tu_ngay = req.get("tu_ngay", "2023-01-01")
    den_ngay = req.get("den_ngay")
    ma_vt = req.get("ma_vt", "")
    item = req.get("item", kw)
    dg_trinh = float(req.get("dg_trinh") or 0)
    selected_record = req.get("selected_record")
    use_average = req.get("use_average", False)

    if not kw:
        return jsonify({"imis": [], "erp": [], "summary": None, "summary_text": ""})

    result = imis_core.search_item_sources(kw, tu_ngay=tu_ngay, den_ngay=den_ngay, ma_vt=ma_vt)
    imis_recs = result.get("imis", [])

    used_kw = result.get("used_keyword") or kw
    summary_data = imis_core.generate_imis_summary_text(
        item, imis_recs, dg_trinh=dg_trinh, selected_record=selected_record, use_average=use_average,
        tu_ngay=tu_ngay, den_ngay=den_ngay, search_keyword=used_kw
    )
    result["summary"] = summary_data
    result["summary_text"] = summary_data.get("summary_text", "")
    return jsonify(result)

