# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Dossier & Projects Routes Blueprint
Quản lý hồ sơ dự toán, lưu trữ phiên bản dự án (Save As / Load / Delete) và file đính kèm.
"""

import base64
from datetime import datetime
import json
import os
import re
import shutil
from flask import Blueprint, jsonify, request, send_file

from models import DossierItem, ProjectDossier
from services.excel_service import ExcelService
from storage import default_repo, read_json_safe, write_json_atomic

dossier_bp = Blueprint("dossier_bp", __name__)


@dossier_bp.route("/api/dossier", methods=["GET"])
def api_get_dossier():
    """Lấy toàn bộ hồ sơ dự toán đang hoạt động."""
    dossier = default_repo.load_dossier()
    return jsonify(dossier.to_dict())


@dossier_bp.route("/api/dossier", methods=["POST"])
def api_save_dossier():
    """Lưu cập nhật hồ sơ dự toán."""
    req_data = request.get_json()
    if not req_data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ"}), 400

    dossier = ProjectDossier.from_dict(req_data)
    default_repo.save_dossier(dossier)
    return jsonify({"success": True, "message": "Đã lưu hồ sơ thành công"})


@dossier_bp.route("/api/projects", methods=["GET"])
def api_list_projects():
    """Liệt kê danh sách tất cả các dự án đã lưu trong data/projects/."""
    projects_dir = default_repo.projects_dir
    os.makedirs(projects_dir, exist_ok=True)
    res = []
    for f in os.listdir(projects_dir):
        if f.endswith(".json"):
            fpath = os.path.join(projects_dir, f)
            try:
                mtime = os.path.getmtime(fpath)
                mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                pdata = read_json_safe(fpath)
                items = pdata.get("items", [])
                total_trinh = sum([it.get("thanh_tien_trinh", 0) for it in items])
                total_tn = sum([it.get("thanh_tien_thong_nhat", 0) for it in items])
                res.append({
                    "id": f,
                    "name": pdata.get("dossier_name", f.replace(".json", "")),
                    "creator": pdata.get("creator", "Nguyễn Anh Hiếu"),
                    "count": len(items),
                    "total_trinh": total_trinh,
                    "total_thong_nhat": total_tn,
                    "updated_at": mtime_str,
                })
            except Exception:
                pass
    res.sort(key=lambda x: x["updated_at"], reverse=True)
    return jsonify(res)


@dossier_bp.route("/api/projects/save-as", methods=["POST"])
def api_save_as_project():
    """Lưu dự án hiện tại thành một file dự án mới (Save As Project)."""
    req = request.get_json() or {}
    name = req.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "message": "Tên dự án không được để trống"}), 400

    safe_name = re.sub(r'[\\/*?:"<>| ]', "_", name)
    filename = f"{safe_name}.json"
    fpath = os.path.join(default_repo.projects_dir, filename)

    data = req.get("data", {})
    data["dossier_name"] = name
    if req.get("creator"):
        data["creator"] = req["creator"]

    dossier = ProjectDossier.from_dict(data)
    dossier.save_to_file(fpath)
    default_repo.save_dossier(dossier)
    default_repo.set_active_project_id(filename)

    # Tự động sao chép thư mục tài liệu & hình ảnh chứng cứ sang dự án mới
    try:
        new_files_dir = os.path.join(default_repo.projects_dir, f"{safe_name}_files")
        os.makedirs(new_files_dir, exist_ok=True)
        cur_files_dir = default_repo.get_project_files_dir()
        dirs_to_copy = [cur_files_dir, default_repo.current_dossier_files]
        for s_dir in dirs_to_copy:
            if os.path.exists(s_dir) and os.path.abspath(s_dir) != os.path.abspath(new_files_dir):
                for root, dirs, files in os.walk(s_dir):
                    rel = os.path.relpath(root, s_dir)
                    target_dir = os.path.join(new_files_dir, rel)
                    os.makedirs(target_dir, exist_ok=True)
                    for f_n in files:
                        sf = os.path.join(root, f_n)
                        df = os.path.join(target_dir, f_n)
                        if not os.path.exists(df):
                            shutil.copy2(sf, df)
    except Exception as e:
        print(f"Lưu ý sao chép tài liệu dự án mới: {e}")

    return jsonify({
        "success": True,
        "message": f"Đã lưu thành dự án: {name}",
        "project_id": filename,
        "name": name,
    })


@dossier_bp.route("/api/projects/load/<filename>", methods=["GET"])
def api_load_project(filename):
    """Nạp một dự án đã lưu để tiếp tục làm việc."""
    fpath = os.path.join(default_repo.projects_dir, filename)
    if not os.path.exists(fpath):
        return jsonify({"success": False, "message": "Không tìm thấy file dự án"}), 404

    try:
        dossier = ProjectDossier.from_file(fpath)
        default_repo.save_dossier(dossier)
        default_repo.set_active_project_id(filename)
        return jsonify({"success": True, "dossier": dossier.to_dict(), "project_id": filename})
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi đọc dự án: {e}"}), 500


@dossier_bp.route("/api/project/quotes-path", methods=["GET", "POST"])
def api_project_quotes_path():
    """Đọc hoặc cập nhật đường dẫn thư mục báo giá của dự án đang active."""
    act_file = default_repo.active_project_file
    if not os.path.exists(act_file):
        return jsonify({"success": False, "message": "Chưa có dự án active"}), 404

    proj_config = read_json_safe(act_file)
    if request.method == "POST":
        req_data = request.get_json() or {}
        new_path = req_data.get("folder_path", "").strip()
        if new_path:
            proj_config["active_quotes_folder_path"] = new_path
            write_json_atomic(act_file, proj_config)
            return jsonify({"success": True, "message": "Đã lưu đường dẫn báo giá vào active_project.json"})
        return jsonify({"success": False, "message": "Đường dẫn không hợp lệ"}), 400

    return jsonify({
        "success": True,
        "active_quotes_folder_path": proj_config.get("active_quotes_folder_path", ""),
    })


@dossier_bp.route("/api/projects/delete/<filename>", methods=["DELETE"])
def api_delete_project(filename):
    """Xóa một dự án đã lưu."""
    fpath = os.path.join(default_repo.projects_dir, filename)
    if os.path.exists(fpath):
        try:
            os.remove(fpath)
            return jsonify({"success": True, "message": "Đã xóa dự án thành công"})
        except Exception as e:
            return jsonify({"success": False, "message": f"Lỗi xóa: {e}"}), 500
    return jsonify({"success": False, "message": "Dự án không tồn tại"}), 404


@dossier_bp.route("/api/items/<int:item_id>/upload-attachment", methods=["POST"])
def api_upload_attachment(item_id):
    """Upload file ảnh, PDF hoặc tài liệu đính kèm cho 1 mục vật tư."""
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Không có file"}), 400
    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"success": False, "message": "Chưa chọn file"}), 400

    item_dir = default_repo.get_item_dir(item_id)
    safe_filename = re.sub(r'[\\/*?:"<>| ]', "_", file.filename)
    dest_path = os.path.join(item_dir, safe_filename)
    file.save(dest_path)

    rel_path = f"item_{item_id}/{safe_filename}"
    file_type = (
        "image"
        if safe_filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif"))
        else ("pdf" if safe_filename.lower().endswith(".pdf") else "other")
    )

    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item:
        if not hasattr(item, "_extra_fields"):
            item._extra_fields = {}
        attachments = item._extra_fields.get("attachments", [])
        attachments.append({
            "name": file.filename,
            "rel_path": rel_path,
            "type": file_type,
            "size": os.path.getsize(dest_path),
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
        item._extra_fields["attachments"] = attachments
        default_repo.save_dossier(dossier)

    return jsonify({"success": True, "rel_path": rel_path, "type": file_type, "name": file.filename})


@dossier_bp.route("/api/items/<int:item_id>/paste-image", methods=["POST"])
def api_paste_image(item_id):
    """Lưu ảnh chụp màn hình từ Clipboard (Ctrl + V) thành file chứng cứ của mục."""
    req = request.get_json() or {}
    img_b64 = req.get("image_base64", "")
    if not img_b64:
        return jsonify({"success": False, "message": "Không có dữ liệu ảnh"}), 400

    if "," in img_b64:
        img_b64 = img_b64.split(",")[1]

    try:
        img_bytes = base64.b64decode(img_b64)
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi giải mã ảnh: {e}"}), 400

    item_dir = default_repo.get_item_dir(item_id)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"clip_{timestamp}.png"
    dest_path = os.path.join(item_dir, filename)
    with open(dest_path, "wb") as f:
        f.write(img_bytes)

    rel_path = f"item_{item_id}/{filename}"
    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item:
        if not hasattr(item, "_extra_fields"):
            item._extra_fields = {}
        attachments = item._extra_fields.get("attachments", [])
        attachments.append({
            "name": filename,
            "rel_path": rel_path,
            "type": "image",
            "size": len(img_bytes),
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
        item._extra_fields["attachments"] = attachments
        default_repo.save_dossier(dossier)

    return jsonify({"success": True, "rel_path": rel_path, "type": "image", "name": filename})


@dossier_bp.route("/api/items/<int:item_id>/add-link", methods=["POST"])
def api_add_link(item_id):
    """Lưu link URL internet cho mục."""
    req = request.get_json() or {}
    url = req.get("url", "").strip()
    title = req.get("title", "").strip() or url
    if not url:
        return jsonify({"success": False, "message": "Chưa nhập URL"}), 400

    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item:
        if not hasattr(item, "_extra_fields"):
            item._extra_fields = {}
        links = item._extra_fields.get("links", [])
        links.append({
            "url": url,
            "title": title,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
        item._extra_fields["links"] = links
        default_repo.save_dossier(dossier)
    return jsonify({"success": True})


@dossier_bp.route("/api/project-files/<path:rel_path>", methods=["GET"])
def api_serve_project_file(rel_path):
    """Phục vụ file media/PDF của dự án để hiển thị trực tiếp trên trình duyệt."""
    p_dir = default_repo.get_project_files_dir()
    full_path = os.path.join(p_dir, rel_path)
    if os.path.exists(full_path):
        return send_file(full_path)
    return jsonify({"error": "File not found"}), 404

@dossier_bp.route("/api/items/<int:item_id>/ai-markdown", methods=["POST"])
def api_save_ai_markdown(item_id):
    """Lưu trữ bài phân tích AI dạng Markdown cho 1 mục vật tư."""
    req = request.get_json() or {}
    md_content = req.get("markdown", "")

    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item:
        if not hasattr(item, "_extra_fields"):
            item._extra_fields = {}
        item._extra_fields["ai_analysis_md"] = md_content
        default_repo.save_dossier(dossier)

    item_dir = default_repo.get_item_dir(item_id)
    md_file = os.path.join(item_dir, "phan_tich_ai.md")
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(md_content)

    return jsonify({"success": True, "message": "Đã lưu bản phân tích AI"})


@dossier_bp.route("/api/items/<int:item_id>/delete-attachment", methods=["POST"])
def api_delete_attachment(item_id):
    """Xóa 1 file đính kèm khỏi mục vật tư."""
    req = request.get_json() or {}
    rel_path = req.get("rel_path", "")
    if not rel_path:
        return jsonify({"success": False, "message": "Thiếu đường dẫn file"}), 400

    dossier = default_repo.load_dossier()
    item = dossier.get_item(item_id)
    if item and hasattr(item, "_extra_fields"):
        attachments = item._extra_fields.get("attachments", [])
        item._extra_fields["attachments"] = [a for a in attachments if a.get("rel_path") != rel_path]
        default_repo.save_dossier(dossier)

    p_dir = default_repo.get_project_files_dir()
    full_path = os.path.join(p_dir, rel_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except Exception:
            pass

    return jsonify({"success": True})


# ==============================================================================
# XUẤT / NHẬP DỮ LIỆU BẢNG TÍNH EXCEL
# ==============================================================================

@dossier_bp.route("/api/import-excel", methods=["POST"])
def api_import_excel():
    """Nạp file Excel dự toán mẫu hoặc tự do vào ứng dụng."""
    if "file" not in request.files:
        return jsonify({"success": False, "message": "Không tìm thấy file tải lên"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"success": False, "message": "Chưa chọn file"}), 400

    res = ExcelService.import_excel(file, repo=default_repo)
    status_code = 200 if res.get("success") else 500
    return jsonify(res), status_code


@dossier_bp.route("/api/export-excel", methods=["GET"])
def api_export_excel():
    """Xuất file Excel bảng thẩm định dự toán hoàn chỉnh."""
    export_path = ExcelService.export_excel(repo=default_repo)
    return send_file(export_path, as_attachment=True, download_name="Bang_Tham_Dinh_Du_Toan.xlsx")


@dossier_bp.route("/api/download-template", methods=["GET"])
def api_download_template():
    """Tải file Excel mẫu chuẩn 13 cột của EVN Vĩnh Tân 4."""
    template_path = ExcelService.download_template()
    return send_file(template_path, as_attachment=True, download_name="Mau_Bang_Du_Toan_13_Cot.xlsx")

