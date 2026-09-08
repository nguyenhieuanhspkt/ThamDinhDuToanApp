# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Máy chủ Flask Server
Phục vụ quản lý cơ sở giá và luồng trao đổi KHVT vs TTĐ
"""
import os
import sys
import json
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage
import imis_core
import quote_matcher
import msc_matcher
import ai_synthesis
import pdf_report_generator
import onedrive_sync

app = Flask(__name__, static_folder='frontend/dist', static_url_path='')
app.config['JSON_AS_ASCII'] = False
CORS(app)

DATA_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data")
PROJECTS_DIR = os.path.join(DATA_DIR, "projects")
os.makedirs(PROJECTS_DIR, exist_ok=True)
DATA_FILE = os.path.join(DATA_DIR, "current_dossier.json")
ACTIVE_PROJECT_FILE = os.path.join(DATA_DIR, "active_project.json")


def load_dossier_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    # Dữ liệu mẫu ban đầu mô phỏng Gói 308
    return {
        "dossier_name": "Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026",
        "creator": "Nguyễn Anh Hiếu",
        "department": "Tổ Thẩm định Dự toán - NMNĐ Vĩnh Tân 4",
        "items": [
            {
                "id": 1,
                "ma_vt": "3.82.63.134.ENG.00.000",
                "part_no": "IUX 760 MI",
                "ten_vt": "Module đầu vào input IUX 760 MI dùng cho hệ thống DCS Foxboro",
                "dvt": "Cái",
                "so_luong": 4,
                "don_gia_trinh": 13559000,
                "thanh_tien_trinh": 54236000,
                "danh_gia_ttd": "Đơn giá ERP nhập kho lần gần nhất (HĐ 115/2023) là 6.015.000 VNĐ/Cái. Đơn giá dự toán trình tăng 125% (+50.14%/năm) là chưa phù hợp. Đề nghị xem lại.",
                "phan_bien_khvt": "Đề xuất giữ nguyên. Chỉ số CPI không áp dụng cho vật tư đặc thù như vật tư đang xem xét. Đơn giá vật tư ERP thấp nhất không phải đơn giá trong vòng 12 tháng nên không thể áp dụng để lập dự toán.",
                "don_gia_thong_nhat": 13559000,
                "thanh_tien_thong_nhat": 54236000,
                "gia_tri_giam": 0,
                "co_so_thong_nhat": "Đơn giá dự toán 13.559.000 đ thấp hơn mức giá cao nhất Nhà máy từng mua năm 2024 (17.670.000 đ theo HĐ 132/2023) là -23,2%."
            },
            {
                "id": 2,
                "ma_vt": "3.34.40.292.VIE.00.000",
                "part_no": "6802",
                "ten_vt": "Mặt công tắc dùng cho 2 thiết bị",
                "dvt": "Cái",
                "so_luong": 5,
                "don_gia_trinh": 45000,
                "thanh_tien_trinh": 225000,
                "danh_gia_ttd": "Hợp đồng IMIS EVN gần nhất là 25.000 đ (Công ty Thủy điện Đồng Nai - HĐ 72/2025/HĐ-ĐN-MN ký ngày 04/09/2025). Đề nghị áp dụng theo giá IMIS.",
                "phan_bien_khvt": "Đồng ý điều chỉnh theo đơn giá HĐ IMIS của Thủy điện Đồng Nai.",
                "don_gia_thong_nhat": 25000,
                "thanh_tien_thong_nhat": 125000,
                "gia_tri_giam": 100000,
                "co_so_thong_nhat": "Thống nhất theo HĐ 72/2025/HĐ-ĐN-MN của Công ty Thủy điện Đồng Nai."
            }
        ]
    }


def save_dossier_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    # Tự động đồng bộ ngay lập tức sang file dự án đang hoạt động nếu có
    if os.path.exists(ACTIVE_PROJECT_FILE):
        try:
            with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as fp:
                act = json.load(fp)
            act_id = act.get("active_id")
            if act_id:
                p_path = os.path.join(PROJECTS_DIR, act_id)
                with open(p_path, "w", encoding="utf-8") as fp:
                    json.dump(data, fp, ensure_ascii=False, indent=2)
        except Exception:
            pass
    try:
        onedrive_sync.push_to_onedrive()
    except Exception:
        pass


@app.route("/")
def index():
    dist_index = os.path.join(app.static_folder, "index.html")
    if os.path.exists(dist_index):
        return send_file(dist_index)
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def api_status():
    info = imis_core.get_token_status_info()
    cached = imis_core.get_erp_cached_records()
    info["erp_cache_count"] = len(cached)
    return jsonify(info)


@app.route("/api/imis/config-status", methods=["GET"])
def api_imis_config_status():
    status = imis_core.get_imis_config_status()
    return jsonify(status)



@app.route("/api/refresh-token", methods=["POST"])
def api_refresh_token():
    ok, msg = imis_core.refresh_imis_token()
    info = imis_core.get_imis_config_status()
    return jsonify({"success": ok, "message": msg, "info": info})


@app.route("/api/imis/login", methods=["POST"])
def api_login_imis():
    req_data = request.get_json() or {}
    username = req_data.get("username", "").strip()
    password = req_data.get("password", "")
    remember = req_data.get("remember", True)
    if not username or not password:
        return jsonify({"success": False, "message": "Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu"}), 400
    
    ok, msg = imis_core.login_imis(username, password, remember)
    info = imis_core.get_imis_config_status()
    return jsonify({"success": ok, "message": msg, "info": info})



@app.route("/api/dossier", methods=["GET"])
def api_get_dossier():
    return jsonify(load_dossier_data())


@app.route("/api/dossier", methods=["POST"])
def api_save_dossier():
    req_data = request.get_json()
    if not req_data:
        return jsonify({"success": False, "message": "Dữ liệu không hợp lệ"}), 400
    save_dossier_data(req_data)
    
    # Nếu có project đang active, tự động cập nhật vào file project đó
    if os.path.exists(ACTIVE_PROJECT_FILE):
        try:
            with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as fp:
                act = json.load(fp)
            act_id = act.get("active_id")
            if act_id:
                p_path = os.path.join(PROJECTS_DIR, act_id)
                with open(p_path, "w", encoding="utf-8") as fp:
                    json.dump(req_data, fp, ensure_ascii=False, indent=2)
        except Exception:
            pass
            
    return jsonify({"success": True, "message": "Đã lưu hồ sơ thành công"})


@app.route("/api/projects", methods=["GET"])
def api_list_projects():
    """Liệt kê danh sách tất cả các dự án đã lưu trong data/projects/."""
    os.makedirs(PROJECTS_DIR, exist_ok=True)
    res = []
    for f in os.listdir(PROJECTS_DIR):
        if f.endswith(".json"):
            fpath = os.path.join(PROJECTS_DIR, f)
            try:
                mtime = os.path.getmtime(fpath)
                mtime_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                with open(fpath, "r", encoding="utf-8") as fp:
                    pdata = json.load(fp)
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
                    "updated_at": mtime_str
                })
            except Exception:
                pass
    res.sort(key=lambda x: x["updated_at"], reverse=True)
    return jsonify(res)


@app.route("/api/projects/save-as", methods=["POST"])
def api_save_as_project():
    """Lưu dự án hiện tại thành một file dự án mới (Save As Project)."""
    req = request.get_json() or {}
    name = req.get("name", "").strip()
    if not name:
        return jsonify({"success": False, "message": "Tên dự án không được để trống"}), 400
        
    safe_name = re.sub(r'[\\/*?:"<>| ]', "_", name)
    filename = f"{safe_name}.json"
    fpath = os.path.join(PROJECTS_DIR, filename)
    
    data = req.get("data", {})
    data["dossier_name"] = name
    if req.get("creator"):
        data["creator"] = req["creator"]
        
    with open(fpath, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
        
    save_dossier_data(data)
    with open(ACTIVE_PROJECT_FILE, "w", encoding="utf-8") as fp:
        json.dump({"active_id": filename, "name": name}, fp, ensure_ascii=False, indent=2)

    # Tự động sao chép thư mục tài liệu & hình ảnh chứng cứ sang dự án mới
    try:
        new_files_dir = os.path.join(PROJECTS_DIR, f"{safe_name}_files")
        os.makedirs(new_files_dir, exist_ok=True)
        cur_files_dir = get_project_files_dir()
        dirs_to_copy = [cur_files_dir, os.path.join(DATA_DIR, "current_dossier_files")]
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
        "name": name
    })




@app.route("/api/projects/load/<filename>", methods=["GET"])
def api_load_project(filename):
    """Nạp một dự án đã lưu để tiếp tục làm việc."""
    fpath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(fpath):
        return jsonify({"success": False, "message": "Không tìm thấy file dự án"}), 404
        
    try:
        with open(fpath, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        save_dossier_data(data)
        with open(ACTIVE_PROJECT_FILE, "w", encoding="utf-8") as fp:
            json.dump({"active_id": filename, "name": data.get("dossier_name", filename)}, fp, ensure_ascii=False, indent=2)
        return jsonify({"success": True, "dossier": data, "project_id": filename})
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi đọc dự án: {e}"}), 500

@app.route("/api/project/quotes-path", methods=["GET", "POST"])
def api_project_quotes_path():
    """Đọc hoặc cập nhật đường dẫn thư mục báo giá của dự án đang active trong active_project.json"""
    if not os.path.exists(ACTIVE_PROJECT_FILE):
        return jsonify({"success": False, "message": "Chưa có dự án active"}), 404
        
    try:
        with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as f:
            proj_config = json.load(f)
    except Exception:
        proj_config = {}

    if request.method == "POST":
        req_data = request.get_json() or {}
        new_path = req_data.get("folder_path", "").strip()
        if new_path:
            proj_config["active_quotes_folder_path"] = new_path
            with open(ACTIVE_PROJECT_FILE, "w", encoding="utf-8") as f:
                json.dump(proj_config, f, ensure_ascii=False, indent=2)
            return jsonify({"success": True, "message": "Đã lưu đường dẫn báo giá vào active_project.json"})
        return jsonify({"success": False, "message": "Đường dẫn không hợp lệ"}), 400

    # Phương thức GET: trả về path đang lưu (nếu có)
    return jsonify({
        "success": True, 
        "active_quotes_folder_path": proj_config.get("active_quotes_folder_path", "")
    })
@app.route("/api/projects/delete/<filename>", methods=["DELETE"])
def api_delete_project(filename):
    """Xóa một dự án đã lưu."""
    fpath = os.path.join(PROJECTS_DIR, filename)
    if os.path.exists(fpath):
        try:
            os.remove(fpath)
            return jsonify({"success": True, "message": "Đã xóa dự án thành công"})
        except Exception as e:
            return jsonify({"success": False, "message": f"Lỗi xóa: {e}"}), 500
    return jsonify({"success": False, "message": "Dự án không tồn tại"}), 404


def get_project_files_dir(project_id=None):
    """Lấy thư mục lưu trữ media & file đính kèm của dự án hiện tại."""
    if not project_id and os.path.exists(ACTIVE_PROJECT_FILE):
        try:
            with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as fp:
                act = json.load(fp)
            project_id = act.get("active_id")
        except Exception:
            pass
    if not project_id:
        project_id = "current_dossier"
    base_name = project_id.replace(".json", "")
    p_dir = os.path.join(DATA_DIR, "projects", f"{base_name}_files")
    os.makedirs(p_dir, exist_ok=True)
    return p_dir


@app.route("/api/items/<int:item_id>/upload-attachment", methods=["POST"])
def api_upload_attachment(item_id):
    """Upload file ảnh, PDF hoặc tài liệu đính kèm cho 1 mục vật tư."""
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "Không có file"}), 400
    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({"success": False, "message": "Chưa chọn file"}), 400
    
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    
    safe_filename = re.sub(r'[\\/*?:"<>| ]', "_", file.filename)
    dest_path = os.path.join(item_dir, safe_filename)
    file.save(dest_path)
    
    rel_path = f"item_{item_id}/{safe_filename}"
    file_type = "image" if safe_filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.gif')) else ("pdf" if safe_filename.lower().endswith('.pdf') else "other")
    
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            if "attachments" not in it:
                it["attachments"] = []
            it["attachments"].append({
                "name": file.filename,
                "rel_path": rel_path,
                "type": file_type,
                "size": os.path.getsize(dest_path),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            break
    save_dossier_data(data)
    return jsonify({"success": True, "rel_path": rel_path, "type": file_type, "name": file.filename})


@app.route("/api/items/<int:item_id>/paste-image", methods=["POST"])
def api_paste_image(item_id):
    """Lưu ảnh chụp màn hình từ Clipboard (Ctrl + V) thành file chứng cứ của mục."""
    req = request.get_json() or {}
    img_b64 = req.get("image_base64", "")
    if not img_b64:
        return jsonify({"success": False, "message": "Không có dữ liệu ảnh"}), 400
        
    if "," in img_b64:
        img_b64 = img_b64.split(",")[1]
        
    import base64
    try:
        img_bytes = base64.b64decode(img_b64)
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi giải mã ảnh: {e}"}), 400
        
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"clip_{timestamp}.png"
    dest_path = os.path.join(item_dir, filename)
    with open(dest_path, "wb") as f:
        f.write(img_bytes)
        
    rel_path = f"item_{item_id}/{filename}"
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            if "attachments" not in it:
                it["attachments"] = []
            it["attachments"].append({
                "name": filename,
                "rel_path": rel_path,
                "type": "image",
                "size": len(img_bytes),
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            break
    save_dossier_data(data)
    return jsonify({"success": True, "rel_path": rel_path, "type": "image", "name": filename})


@app.route("/api/items/<int:item_id>/add-link", methods=["POST"])
def api_add_link(item_id):
    """Lưu link URL internet (trang mua sắm công, website chính hãng) cho mục."""
    req = request.get_json() or {}
    url = req.get("url", "").strip()
    title = req.get("title", "").strip() or url
    if not url:
        return jsonify({"success": False, "message": "Chưa nhập URL"}), 400
        
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            if "links" not in it:
                it["links"] = []
            it["links"].append({
                "url": url,
                "title": title,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            break
    save_dossier_data(data)
    return jsonify({"success": True})


@app.route("/api/project-files/<path:rel_path>", methods=["GET"])
def api_serve_project_file(rel_path):
    """Phục vụ file media/PDF của dự án để hiển thị trực tiếp trên trình duyệt."""
    p_dir = get_project_files_dir()
    full_path = os.path.join(p_dir, rel_path)
    if os.path.exists(full_path):
        return send_file(full_path)
    return jsonify({"error": "File not found"}), 404


@app.route("/api/items/<int:item_id>/ai-markdown", methods=["POST"])
def api_save_ai_markdown(item_id):
    """Lưu trữ bài phân tích AI dạng Markdown cho 1 mục vật tư."""
    req = request.get_json() or {}
    md_content = req.get("markdown", "")
    
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            it["ai_analysis_md"] = md_content
            break
    save_dossier_data(data)
    
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    md_file = os.path.join(item_dir, "phan_tich_ai.md")
    with open(md_file, "w", encoding="utf-8") as f:
        f.write(md_content)
        
    return jsonify({"success": True, "message": "Đã lưu bản phân tích AI"})


@app.route("/api/items/<int:item_id>/delete-attachment", methods=["POST"])
def api_delete_attachment(item_id):
    """Xóa 1 file đính kèm khỏi mục vật tư."""
    req = request.get_json() or {}
    rel_path = req.get("rel_path", "")
    
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            it["attachments"] = [a for a in it.get("attachments", []) if a.get("rel_path") != rel_path]
            break
    save_dossier_data(data)
    
    p_dir = get_project_files_dir()
    full_path = os.path.join(p_dir, rel_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except Exception:
            pass
    return jsonify({"success": True})


@app.route("/api/quotes/scan", methods=["POST"])
def api_scan_quotes():
    """Quét thư mục chứa các file PDF báo giá của các nhà thầu."""
    req = request.get_json() or {}
    folder = req.get("folder_path") or quote_matcher.DEFAULT_QUOTES_DIR
    force_rescan = bool(req.get("force_rescan", False))
    res = quote_matcher.scan_quotation_folder(folder, force_rescan=force_rescan)
    return jsonify(res)


@app.route("/api/quotes/view-pdf")
def api_view_quote_pdf():
    """Xem trực tiếp file PDF báo giá gốc trên trình duyệt để kiểm tra tổng thành tiền."""
    fpath = request.args.get("path") or ""
    filename = request.args.get("filename") or ""

    # 1. Kiểm tra fpath chuẩn hóa
    if fpath:
        # Chuẩn hóa đường dẫn
        norm_path = os.path.normpath(fpath.strip())
        if os.path.exists(norm_path) and os.path.isfile(norm_path):
            return send_file(norm_path, mimetype="application/pdf")
            
    # 2. Nếu path bị lỗi hoặc mất gạch chéo do JS escape, tìm theo tên file
    target_fn = filename.strip() if filename else ""
    if not target_fn and fpath:
        # Nếu fpath bị dính liền nhưng có đuôi .pdf, trích xuất tên file
        m = re.search(r'([^\\/]+\.pdf)$', fpath, re.IGNORECASE)
        if m:
            target_fn = m.group(1)

    if target_fn:
        quotes_dir = quote_matcher.DEFAULT_QUOTES_DIR
        candidate = os.path.join(quotes_dir, target_fn)
        if os.path.exists(candidate) and os.path.isfile(candidate):
            return send_file(candidate, mimetype="application/pdf")

        # Quét thư mục tìm file khớp tên không phân biệt hoa thường
        for root, dirs, files in os.walk(quotes_dir):
            for f in files:
                if f.lower() == target_fn.lower() or target_fn.lower().endswith(f.lower()) or f.lower().endswith(target_fn.lower()):
                    full_match = os.path.join(root, f)
                    if os.path.exists(full_match) and os.path.isfile(full_match):
                        return send_file(full_match, mimetype="application/pdf")

    return f"Không tìm thấy file PDF: {filename or fpath}", 404


def get_project_quote_overrides():
    """Lấy dữ liệu hiệu chỉnh báo giá thủ công đã lưu của dự án."""
    p_dir = get_project_files_dir()
    fpath = os.path.join(p_dir, "quote_overrides.json")
    if os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


@app.route("/api/quotes/save-edited-quote", methods=["POST"])
@app.route("/api/quotes/save-override", methods=["POST"])
def api_save_edited_quote():
    """Lưu dữ liệu báo giá đã được người dùng chỉnh sửa/bổ sung và tính lại thành tiền."""
    req = request.get_json() or {}
    quote_obj = req.get("quote", {})
    filename = req.get("filename") or quote_obj.get("filename")
    items = req.get("items") or quote_obj.get("items") or []
    total_amount = float(req.get("total_amount") or quote_obj.get("total_amount") or 0)
    
    if not filename:
        return jsonify({"success": False, "message": "Thiếu tên file báo giá"}), 400

    p_dir = get_project_files_dir()
    os.makedirs(p_dir, exist_ok=True)
    fpath = os.path.join(p_dir, "quote_overrides.json")
    overrides = get_project_quote_overrides()
    overrides[filename] = {
        "items": items,
        "item_count": len(items),
        "total_amount": total_amount,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(overrides, f, ensure_ascii=False, indent=2)

    # Xóa cache để lượt quét tới áp dụng override mới ngay lập tức
    quote_matcher.clear_quotes_cache()

    return jsonify({"success": True, "message": f"Đã lưu thành công {len(items)} dòng dữ liệu hiệu chỉnh cho báo giá [{filename}]!"})


@app.route("/api/quotes/get-full-quote", methods=["GET", "POST"])
@app.route("/api/quotes/item-data", methods=["GET", "POST"])
def api_get_full_quote():
    """Lấy dữ liệu đầy đủ tất cả các dòng đã pandas hóa của 1 file báo giá."""
    req = request.get_json(silent=True) or {}
    filename = req.get("filename") or request.args.get("filename")
    folder = req.get("folder_path") or request.args.get("folder_path")
    
    if not folder:
        p_dir = get_project_files_dir()
        approved_file = os.path.join(p_dir, "bao_gia_project.json")
        if os.path.exists(approved_file):
            try:
                with open(approved_file, "r", encoding="utf-8") as f:
                    folder = json.load(f).get("folder_nguon")
            except Exception:
                pass
                
    folder = folder or quote_matcher.DEFAULT_QUOTES_DIR
    overrides = get_project_quote_overrides()
    scanned = quote_matcher.scan_quotation_folder(folder, overrides=overrides)
    for q in scanned.get("quotes", []):
        if q["filename"] == filename:
            return jsonify({"success": True, "quote": q, "data": q})
    return jsonify({"success": False, "message": f"Không tìm thấy báo giá: {filename}"}), 404


@app.route("/api/quotes/dossier", methods=["GET", "POST"])
def api_quotes_dossier():
    """Lấy danh sách tất cả các file trong thư mục báo giá, phân loại và trạng thái phê duyệt."""
    req = request.get_json() if request.method == "POST" else {}
    folder = (req or {}).get("folder_path") or request.args.get("folder_path") or quote_matcher.DEFAULT_QUOTES_DIR
    overrides = get_project_quote_overrides()
    res = quote_matcher.scan_quotation_folder(folder, overrides=overrides)
    
    p_dir = get_project_files_dir()
    approved_file = os.path.join(p_dir, "bao_gia_project.json")
    approved_data = None
    if os.path.exists(approved_file):
        try:
            with open(approved_file, "r", encoding="utf-8") as f:
                approved_data = json.load(f)
        except Exception:
            pass
            
    res["approved_data"] = approved_data
    res["is_approved"] = approved_data is not None
    return jsonify(res)


@app.route("/api/quotes/approve-all", methods=["POST"])
def api_quotes_approve_all():
    """Phê duyệt bộ dữ liệu báo giá đã số hóa vào CSDL chính thức của dự án."""
    req = request.get_json() or {}
    folder = req.get("folder_path") or quote_matcher.DEFAULT_QUOTES_DIR
    overrides = get_project_quote_overrides()
    res = quote_matcher.scan_quotation_folder(folder, overrides=overrides)
    
    p_dir = get_project_files_dir()
    os.makedirs(p_dir, exist_ok=True)
    approved_file = os.path.join(p_dir, "bao_gia_project.json")
    
    save_payload = {
        "thoi_gian_duyet": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "nguoi_duyet": "Nguyễn Anh Hiếu - Tổ Thẩm định",
        "folder_nguon": folder,
        "tong_so_nha_thau": len(res.get("quotes", [])),
        "tong_so_muc": sum(q.get("item_count", 0) for q in res.get("quotes", [])),
        "tong_gia_tri": sum(q.get("total_amount", 0) for q in res.get("quotes", [])),
        "danh_sach_bao_gia": res.get("quotes", []),
        "scans": res.get("scans", []),
        "docs": res.get("docs", [])
    }
    
    with open(approved_file, "w", encoding="utf-8") as f:
        json.dump(save_payload, f, ensure_ascii=False, indent=2)

    # TỰ ĐỘNG HOÀN THIỆN CƠ SỞ 1 CHO TOÀN BỘ CÁC MỤC TRONG DỰ ÁN
    dossier = load_dossier_data()
    items = dossier.get("items", [])
    auto_matched_count = 0

    for idx, it in enumerate(items):
        item_id = it.get("id") or (idx + 1)
        item_dir = os.path.join(p_dir, f"item_{item_id}")
        os.makedirs(item_dir, exist_ok=True)
        
        # Chạy thuật toán đối chiếu báo giá cho mục này
        match_res = quote_matcher.match_item_in_quotes(it, res)
        if match_res:
            match_res["thoi_gian_tra_cuu"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            match_res["item_id"] = item_id
            
            # Ghi vào file chứng cứ Cơ sở 1
            cc_path = os.path.join(item_dir, "chung_cu_quotes.json")
            with open(cc_path, "w", encoding="utf-8") as f:
                json.dump(match_res, f, ensure_ascii=False, indent=2)
            auto_matched_count += 1

    msg = f"Đã phê duyệt CSDL Báo giá ({len(res.get('quotes', []))} nhà thầu) và tự động hoàn thiện Cơ sở 1 cho {auto_matched_count}/{len(items)} mục dự toán!"
    return jsonify({
        "success": True, 
        "message": msg, 
        "approved_summary": save_payload,
        "matched_items_count": auto_matched_count
    })


@app.route("/api/quotes/match-item", methods=["POST"])
@app.route("/api/quotes/by-item", methods=["GET", "POST"])
def api_match_item_quote():
    """Đối chiếu đơn giá trình của 1 mục với các báo giá gốc trong thư mục."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    item_id = req.get("item_id") or request.args.get("item_id")
    item = req.get("item", {})
    
    if not item and item_id:
        dossier = load_dossier_data()
        try:
            target_id = int(item_id)
            for it in dossier.get("items", []):
                if it.get("id") == target_id:
                    item = it
                    break
        except Exception:
            pass

    folder = req.get("folder_path") or request.args.get("folder_path")
    if not folder:
        p_dir = get_project_files_dir()
        approved_file = os.path.join(p_dir, "bao_gia_project.json")
        if os.path.exists(approved_file):
            try:
                with open(approved_file, "r", encoding="utf-8") as f:
                    folder = json.load(f).get("folder_nguon")
            except Exception:
                pass
                
    folder = folder or quote_matcher.DEFAULT_QUOTES_DIR
    force_rescan = bool(req.get("force_rescan", False) or request.args.get("force_rescan"))
    
    overrides = get_project_quote_overrides()
    scanned = quote_matcher.scan_quotation_folder(folder, overrides=overrides, force_rescan=force_rescan)
    match_result = quote_matcher.match_item_in_quotes(item, scanned)
    return jsonify(match_result)


@app.route("/api/quotes/match-all-dossier-items", methods=["GET", "POST"])
def api_match_all_dossier_items():
    """Đọc dữ liệu đối chiếu báo giá (ưu tiên đọc từ cache/JSON đã lưu để tối ưu tốc độ)."""
    req = request.get_json(silent=True) or {}
    force_rescan = bool(req.get("force_rescan", False) or request.args.get("force_rescan", False))
    
    dossier = load_dossier_data()
    items = dossier.get("items", [])
    
    p_dir = get_project_files_dir()
    approved_file = os.path.join(p_dir, "bao_gia_project.json")
    folder = None
    if os.path.exists(approved_file):
        try:
            with open(approved_file, "r", encoding="utf-8") as f:
                folder = json.load(f).get("folder_nguon")
        except Exception:
            pass
    folder = folder or quote_matcher.DEFAULT_QUOTES_DIR
    
    overrides = get_project_quote_overrides()
    
    # QUAN TRỌNG: Nếu không yêu cầu force_rescan, quote_matcher sẽ tự dùng cache sẵn có bên trong module
    scanned = quote_matcher.scan_quotation_folder(folder, overrides=overrides, force_rescan=force_rescan)
    
    results = {}
    for idx, item in enumerate(items):
        item_id = item.get("id", idx + 1)
        res = quote_matcher.match_item_in_quotes(item, scanned)
        min_vendor = ""
        if res.get("matches"):
            min_vendor = res["matches"][0].get("company", "")
        results[item_id] = {
            "lowest_price": res.get("min_price"),
            "lowest_vendor": min_vendor,
            "co_so_don_gia": res.get("summary_text") or item.get("co_so_thong_nhat") or item.get("danh_gia_ttd") or item.get("ghi_chu") or "",
            "matches_count": len(res.get("matches", []))
        }
        
    return jsonify({"success": True, "results": results})
@app.route("/api/erp/config-status", methods=["GET"])
def api_erp_config_status():
    """Kiểm tra trạng thái CSDL ERP khi ứng dụng khởi chạy."""
    status = imis_core.get_erp_config_status()
    return jsonify(status)


@app.route("/api/erp/preview-columns", methods=["POST"])
def api_erp_preview_columns():
    """Đọc tiêu đề cột của file Excel ERP để hiển thị trên UI chọn ánh xạ."""
    req = request.get_json() or {}
    file_path = req.get("file_path", "").strip()
    res = imis_core.get_excel_headers(file_path)
    return jsonify(res)


@app.route("/api/erp/upload", methods=["POST"])
def api_erp_upload_file():
    """Tải lên file Excel CSDL ERP mới từ giao diện web."""
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "Không tìm thấy file"}), 400
    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({"success": False, "message": "Chỉ chấp nhận file Excel (.xlsx, .xls)"}), 400
        
    config_dir = os.path.join(DATA_DIR, "config")
    os.makedirs(config_dir, exist_ok=True)
    dest_path = os.path.join(config_dir, "ERP_uploaded.xlsx")
    file.save(dest_path)
    
    headers_res = imis_core.get_excel_headers(dest_path)
    headers_res["uploaded_path"] = dest_path
    return jsonify(headers_res)


@app.route("/api/erp/save-config", methods=["POST"])
def api_erp_save_config():
    """Lưu cấu hình vị trí file Excel ERP và mapping 13 cột pháp lý."""
    req = request.get_json() or {}
    file_path = req.get("file_path", "").strip()
    mapping = req.get("mapping", {})
    header_row = int(req.get("header_row", 1))
    
    if not file_path or not os.path.exists(file_path):
        return jsonify({"success": False, "message": f"Không tìm thấy file Excel: {file_path}"}), 400
        
    records = imis_core.save_erp_mapping_config(file_path, mapping, header_row=header_row)
    return jsonify({
        "success": True,
        "message": f"Đã nạp thành công CSDL ERP với {len(records)} bản ghi hợp đồng!",
        "count": len(records)
    })


@app.route("/api/erp/search", methods=["POST"])
def api_erp_search():
    """Tra cứu lịch sử mua sắm CSDL lịch sử mua sắm ERP Vĩnh Tân 4."""
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()
    ma_vt = req.get("ma_vt", "").strip()
    item = req.get("item") or {}
    dg_trinh = float(req.get("dg_trinh") or item.get("don_gia_trinh") or 0)
    selected_record = req.get("selected_record")
    is_manual = req.get("is_manual", False)
    
    min_score = 0 if is_manual else 60
    
    if not imis_core.is_valid_erp_code(ma_vt):
        ma_vt = ""
    if not ma_vt and isinstance(item, dict) and item.get("ma_vt"):
        cand_ma = str(item.get("ma_vt", "")).strip()
        if imis_core.is_valid_erp_code(cand_ma):
            ma_vt = cand_ma
    if not ma_vt and imis_core.is_valid_erp_code(keyword):
        ma_vt = keyword

    if keyword.strip().lower().startswith("chưa") or keyword.strip().lower() in ("chưa có mã vật tư", "n/a", "none"):
        keyword = (item.get("ten_vt_goc") or item.get("ten_vt") or "").split("\n")[0].split("-")[0].strip()

    results = imis_core.search_erp_baseline(keyword, ma_vt=ma_vt, min_score=min_score)
    if not results and not is_manual and keyword:
        clean_kw = keyword.split("\n")[0].split("-")[0].strip()
        results = imis_core.search_erp_baseline(clean_kw, min_score=40)
        
    cfg = imis_core.load_erp_mapping_config()
    mapping = cfg.get("mapping", {})
    
    if selected_record == "NONE":
        summary_data = {
            "status": "ERP_DESELECTED",
            "is_deselected": True,
            "summary_text": "Qua rà soát CSDL lịch sử mua sắm ERP của NMNĐ Vĩnh Tân 4, các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này."
        }
        return jsonify({
            "success": True,
            "results": results,
            "mapping": mapping,
            "summary": summary_data,
            "summary_text": summary_data["summary_text"]
        })

    use_average = req.get("use_average", False) or selected_record == "AVERAGE"
    summary_data = imis_core.generate_erp_summary_text(item, results, dg_trinh=dg_trinh, selected_record=selected_record, use_average=use_average)
    return jsonify({
        "success": True,
        "results": results,
        "mapping": mapping,
        "summary": summary_data,
        "summary_text": summary_data.get("summary_text", "")
    })


@app.route("/api/quotes/browse-folders", methods=["GET", "POST"])
def api_quotes_browse_folders():
    """Duyệt danh sách thư mục con để hiển thị cây thư mục trên UI."""
    req = request.get_json(silent=True) or {}
    base_path = req.get("path", "").strip() or request.args.get("path", "").strip() or "D:\\"
    if not os.path.exists(base_path):
        base_path = os.path.dirname(base_path) if os.path.dirname(base_path) else "C:\\"
    
    subdirs = []
    try:
        if os.path.isdir(base_path):
            for entry in os.listdir(base_path):
                full_p = os.path.join(base_path, entry)
                if os.path.isdir(full_p) and not entry.startswith('.') and not entry.startswith('$'):
                    subdirs.append({"name": entry, "path": full_p})
    except Exception:
        pass
    
    parent_p = os.path.dirname(base_path) if os.path.dirname(base_path) != base_path else None
    return jsonify({
        "success": True,
        "current_path": base_path,
        "parent_path": parent_p,
        "subdirs": subdirs[:40]
    })


@app.route("/api/quotes/native-browse-folder", methods=["GET", "POST"])
def api_quotes_native_browse_folder():
    """Mở cửa sổ Windows Explorer Native Folder Picker Dialog chuẩn của hệ điều hành."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        selected_dir = filedialog.askdirectory(title="Chọn thư mục chứa các file Báo Giá Gốc (PDF)")
        root.destroy()
        if selected_dir:
            norm_path = os.path.normpath(selected_dir)
            return jsonify({"success": True, "folder_path": norm_path})
        return jsonify({"success": False, "message": "Người dùng đã hủy chọn thư mục"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi mở cửa sổ Windows: {str(e)}"})


@app.route("/api/quotes/attach-matched-pdf", methods=["POST"])
def api_attach_matched_pdf():
    """Tự động đính kèm file PDF báo giá gốc vào Kho chứng cứ của mục."""
    req = request.get_json() or {}
    item_id = req.get("item_id")
    pdf_path = req.get("pdf_path")
    if not item_id or not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"success": False, "message": "File báo giá không tồn tại"}), 400
        
    filename = os.path.basename(pdf_path)
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    
    dest_path = os.path.join(item_dir, filename)
    import shutil
    shutil.copy2(pdf_path, dest_path)
    
    rel_path = f"item_{item_id}/{filename}"
    data = load_dossier_data()
    for it in data.get("items", []):
        if it.get("id") == item_id:
            if "attachments" not in it:
                it["attachments"] = []
            if not any(a.get("rel_path") == rel_path for a in it["attachments"]):
                it["attachments"].append({
                    "name": filename,
                    "rel_path": rel_path,
                    "type": "pdf",
                    "size": os.path.getsize(dest_path),
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
            break
    save_dossier_data(data)
    return jsonify({"success": True, "rel_path": rel_path, "filename": filename})


@app.route("/api/msc/update-curl", methods=["POST"])
def api_msc_update_curl():
    """Cập nhật và kích hoạt phiên Mua Sắm Công bằng chuỗi cURL dán từ Chrome DevTools."""
    req = request.get_json() or {}
    curl_str = req.get("curl_command", "").strip()
    sess, err = msc_matcher.parse_curl_command(curl_str)
    if err:
        return jsonify({"success": False, "message": err}), 400
        
    test_res = msc_matcher.test_msc_connection(sess)
    if not test_res["active"]:
        return jsonify({"success": False, "message": test_res["message"]}), 400
        
    msc_matcher.save_msc_session(sess)
    return jsonify({"success": True, "message": "Đã cập nhật và kích hoạt phiên Mua Sắm Công thành công!"})


@app.route("/api/msc/status", methods=["GET"])
def api_msc_status():
    """Kiểm tra trạng thái kết nối Mua Sắm Công."""
    return jsonify(msc_matcher.test_msc_connection())


@app.route("/api/msc/search", methods=["POST"])
@app.route("/api/msc/search-item", methods=["POST"])
@app.route("/api/muasamcong/search", methods=["POST"])
def api_msc_search():
    """Tra cứu đơn giá trúng thầu Mua Sắm Công cho 1 mục và tự động lưu vết chứng cứ."""
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()
    item = req.get("item", {})
    save_evidence = req.get("save_evidence", True)
    page_num = int(req.get("page_number") or req.get("page_num") or 0)
    page_sz = int(req.get("page_size") or req.get("page_sz") or 20)
    
    res = msc_matcher.search_muasamcong(keyword, page_number=page_num, page_size=page_sz)
    if not res.get("success"):
        return jsonify(res)
        
    comp = msc_matcher.analyze_msc_comparison(item, res)
    
    # Tự động lưu chứng cứ vào file chung_cu_muasamcong.json
    item_id = item.get("id")
    if save_evidence and item_id:
        p_dir = get_project_files_dir()
        item_dir = os.path.join(p_dir, f"item_{item_id}")
        os.makedirs(item_dir, exist_ok=True)
        
        evidence_data = {
            "item_id": item_id,
            "tu_khoa_tra_cuu": keyword,
            "thoi_gian_tra_cuu": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nguon": "Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn)",
            "don_gia_trinh": item.get("don_gia_trinh", 0),
            "don_gia_tham_chieu": comp.get("min_price", 0),
            "chenh_lech_so_tien": comp.get("diff_amt", 0),
            "chenh_lech_phan_tram": comp.get("diff_pct", 0),
            "danh_sach_ket_qua": comp.get("items", [])
        }
        with open(os.path.join(item_dir, "chung_cu_muasamcong.json"), "w", encoding="utf-8") as f:
            json.dump(evidence_data, f, ensure_ascii=False, indent=2)
            
    return jsonify({"success": True, "analysis": comp})


@app.route("/api/evidence/save-step", methods=["POST"])
@app.route("/api/items/<int:item_id>/evidence/<step_type>", methods=["POST", "DELETE"])
def api_save_evidence_step(item_id=None, step_type=None):
    """Lưu bằng chứng tiến trình tra cứu cho ERP, IMIS hoặc Báo giá."""
    req = (request.get_json(silent=True) if request.is_json else None) or {}
    item_id = item_id or req.get("item_id")
    step_type = step_type or req.get("step_type")
    payload = req.get("payload", req)
    if not item_id or not step_type:
        return jsonify({"success": False, "message": "Thiếu thông tin"}), 400
        
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    
    fname = f"chung_cu_{step_type}.json"
    fpath = os.path.join(item_dir, fname)
    existing_data = {}
    if os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            existing_data = {}

    if isinstance(existing_data, dict) and isinstance(payload, dict):
        existing_data.update(payload)
        final_payload = existing_data
    else:
        final_payload = payload

    final_payload["thoi_gian_luu"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(final_payload, f, ensure_ascii=False, indent=2)

    # Nếu là bước synthesis (Phê duyệt 5 cơ sở), đồng bộ ngay vào CSDL Hồ sơ / Dự án
    if step_type == "synthesis" or "approved_price" in payload:
        try:
            approved_p = float(payload.get("approved_price") if payload.get("approved_price") is not None else 0)
            sum_text = payload.get("summary_text") or ""
            dossier = load_dossier_data()
            for it in dossier.get("items", []):
                if it.get("id") == item_id or dossier.get("items", []).index(it) + 1 == item_id:
                    it["don_gia_thong_nhat"] = approved_p
                    qty = float(it.get("so_luong") or 1)
                    it["thanh_tien_thong_nhat"] = approved_p * qty
                    dg_trinh = float(it.get("don_gia_trinh") or 0)
                    it["gia_tri_giam"] = (dg_trinh - approved_p) * qty
                    it["danh_gia_ttd"] = sum_text
                    if payload.get("co_so_thong_nhat"):
                        it["co_so_thong_nhat"] = payload["co_so_thong_nhat"]
                    break
            save_dossier_data(dossier)
        except Exception as e:
            print(f"Lỗi đồng bộ hồ sơ dự án khi lưu synthesis: {e}")
            
    try:
        onedrive_sync.push_to_onedrive()
    except Exception:
        pass
        
    return jsonify({"success": True, "filename": fname})


@app.route("/api/evidence/get", methods=["GET"])
@app.route("/api/evidence/get-item-evidence/<int:item_id>", methods=["GET"])
@app.route("/api/items/<int:item_id>/evidence/<step_type>", methods=["GET"])
def api_get_item_evidence(item_id=None, step_type=None):
    """Đọc toàn bộ chứng cứ 5 Cơ sở đã lưu của 1 mục vật tư."""
    if item_id is None:
        try:
            item_id = int(request.args.get("item_id"))
        except (TypeError, ValueError):
            item_id = None
            
    step_type = step_type or request.args.get("step_type")
    if not item_id:
        return jsonify({"success": False, "message": "Thiếu item_id"}), 400
        
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    fallback_dir = os.path.join(DATA_DIR, "current_dossier_files", f"item_{item_id}")
    
    def resolve_step_file(step_name):
        f1 = os.path.join(item_dir, f"chung_cu_{step_name}.json")
        if os.path.exists(f1):
            return f1
        f2 = os.path.join(fallback_dir, f"chung_cu_{step_name}.json")
        if os.path.exists(f2):
            return f2
        return None
    
    if step_type:
        fpath = resolve_step_file(step_type)
        if fpath and os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    content = json.load(f)
                    return jsonify({"success": True, "data": content, "payload": content})
            except Exception as e:
                return jsonify({"success": False, "message": str(e)}), 500
        return jsonify({"success": True, "data": None, "payload": None})
        
    evidence = {}
    steps = ["quotes", "erp", "imis", "muasamcong", "ecom", "synthesis"]
    for s in steps:
        fpath = resolve_step_file(s)
        if fpath and os.path.exists(fpath):
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    evidence[s] = json.load(f)
            except Exception:
                evidence[s] = None
        else:
            evidence[s] = None
            
    return jsonify({"success": True, "evidence": evidence})


@app.route("/api/items/<int:item_id>/run-ai-synthesis", methods=["POST"])
def api_run_ai_synthesis(item_id):
    """Trực tiếp gọi Lõi Dịch Vụ ai_synthesis để sinh Thuyết minh Chuyên gia Độc lập cho một mục vật tư."""
    try:
        dossier = load_dossier_data()
        items = dossier.get("items", [])
        item = next((i for i in items if i.get("id") == item_id), None)
        if not item:
            return jsonify({"success": False, "error": f"Không tìm thấy item_id={item_id}"}), 404

        p_dir = get_project_files_dir()
        item_dir = os.path.join(p_dir, f"item_{item_id}")
        os.makedirs(item_dir, exist_ok=True)

        # 1. Đọc dữ liệu chứng cứ thô từ các Khối
        q_file = os.path.join(item_dir, "chung_cu_quotes.json")
        erp_file = os.path.join(item_dir, "chung_cu_erp.json")
        imis_file = os.path.join(item_dir, "chung_cu_imis.json")
        msc_file = os.path.join(item_dir, "chung_cu_muasamcong.json")
        ecom_file = os.path.join(item_dir, "chung_cu_ecom.json")

        p1_price, p2_price, p3_price, p4_price = 0, 0, 0, 0
        p1_desc, p2_desc, p3_desc, p4_desc, p5_desc = "", "", "", "", ""

        if os.path.exists(q_file):
            try:
                with open(q_file, "r", encoding="utf-8") as f:
                    qd = json.load(f)
                    p1_price = float(qd.get("min_price") or 0)
                    p1_supplier = qd.get("matched_supplier", {}).get("company", "Nhà thầu chào")
                    p1_desc = f"Đã đối chiếu các báo giá thương mại; đơn giá chào thấp nhất là {p1_price:,.0f} đ từ {p1_supplier}.".replace(",", ".")
            except Exception: pass

        if os.path.exists(erp_file):
            try:
                with open(erp_file, "r", encoding="utf-8") as f:
                    ed = json.load(f)
                    is_erp_deselected = bool(ed.get("is_deselected") or ed.get("selected_record") == "NONE" or ed.get("status") == "ERP_DESELECTED")
                    if is_erp_deselected:
                        p2_price = 0
                    else:
                        sel = ed.get("selected_record")
                        if isinstance(sel, dict):
                            p2_price = float(sel.get("donGia") or sel.get("don_gia") or 0)
                        elif sel != "NONE":
                            recs = ed.get("results") or ed.get("hop_dong") or []
                            if recs: p2_price = float(recs[0].get("donGia") or recs[0].get("don_gia") or 0)
                    p2_desc = ed.get("summary_text", "")
            except Exception: pass

        if os.path.exists(imis_file):
            try:
                with open(imis_file, "r", encoding="utf-8") as f:
                    imd = json.load(f)
                    is_imis_deselected = bool(imd.get("is_deselected") or imd.get("selected_record") == "NONE" or imd.get("status") == "IMIS_DESELECTED" or imd.get("summary", {}).get("status") == "IMIS_DESELECTED")
                    if is_imis_deselected:
                        p3_price = 0
                    else:
                        sel = imd.get("selected_record")
                        if isinstance(sel, dict):
                            p3_price = float(sel.get("donGia") or sel.get("don_gia") or 0)
                        elif sel == "AVERAGE" or imd.get("use_average"):
                            p3_price = float(imd.get("summary", {}).get("avg_price") or 0)
                        elif sel != "NONE":
                            res_list = imd.get("imis", [])
                            if res_list: p3_price = float(res_list[0].get("don_gia") or res_list[0].get("donGia") or 0)
                    p3_desc = imd.get("summary_text", "")
            except Exception: pass

        if os.path.exists(msc_file):
            try:
                with open(msc_file, "r", encoding="utf-8") as f:
                    mscd = json.load(f)
                    is_msc_deselected = bool(mscd.get("is_deselected") or mscd.get("selected_record") == "NONE" or mscd.get("status") == "MSC_DESELECTED")
                    if is_msc_deselected:
                        p4_price = 0
                    else:
                        sel = mscd.get("selected_record")
                        if isinstance(sel, dict):
                            p4_price = float(sel.get("donGia") or sel.get("don_gia") or sel.get("trung_thau_don_gia") or 0)
                        elif sel != "NONE":
                            p4_price = float(mscd.get("don_gia_tham_chieu") or 0)
                    p4_desc = mscd.get("summary_text", "")
            except Exception: pass

        if os.path.exists(ecom_file):
            try:
                with open(ecom_file, "r", encoding="utf-8") as f:
                    ecd = json.load(f)
                    p5_desc = ecd.get("summary_text", "")
            except Exception: pass

        pillars_dict = {
            "p1_price": p1_price, "p2_price": p2_price, "p3_price": p3_price, "p4_price": p4_price,
            "p1_desc": p1_desc, "p2_desc": p2_desc, "p3_desc": p3_desc, "p4_desc": p4_desc, "p5_desc": p5_desc
        }

        # 2. Gọi trực tiếp Lõi Nghiệp vụ ai_synthesis
        sme_result = ai_synthesis.generate_ai_synthesis(item, pillars_dict)

        approved_price = sme_result["suggested_price"]
        savings = sme_result["estimated_savings"]
        price_score = sme_result["price_score"]
        synthesis_text = sme_result["summary_text"]
        risk_flag = sme_result["risk_flag"]

        p6_payload = {
            "item_id": item_id,
            "approved_price": approved_price,
            "total_savings": savings,
            "coverage_score": 100,
            "price_score": price_score,
            "risk_flag": risk_flag,
            "used_ai": sme_result["used_ai"],
            "summary_text": synthesis_text,
            "pillars": {
                "p1": {"name": "Cơ sở 1: Báo Giá Gốc", "price": p1_price, "has": p1_price > 0},
                "p2": {"name": "Cơ sở 2: ERP Vĩnh Tân 4", "price": p2_price, "has": p2_price > 0},
                "p3": {"name": "Cơ sở 3: EVN IMIS", "price": p3_price, "has": p3_price > 0},
                "p4": {"name": "Cơ sở 4: Mua Sắm Công e-GP", "price": p4_price, "has": p4_price > 0},
                "p5": {"name": "Cơ sở 5: Thương Mại Điện Tử", "price": 0, "has": True}
            },
            "thoi_gian_luu": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        # 3. Lưu chứng cứ synthesis
        with open(os.path.join(item_dir, "chung_cu_synthesis.json"), "w", encoding="utf-8") as f:
            json.dump(p6_payload, f, ensure_ascii=False, indent=2)

        item["don_gia_thong_nhat"] = approved_price
        item["gia_tri_giam"] = savings
        item["danh_gia_ttd"] = synthesis_text
        save_dossier_data(dossier)

        return jsonify({"success": True, "synthesis": p6_payload})
    except Exception as e:
        print(f"Lỗi chạy AI synthesis cho item {item_id}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/evidence/status/<int:item_id>", methods=["GET"])
def api_evidence_status(item_id):
    """Kiểm tra xem mục này đã có các chứng cứ nào được lưu (quét cả thư mục dự án và fallback)."""
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    fb_dir = os.path.join(DATA_DIR, "current_dossier_files", f"item_{item_id}")
    
    def check_file(fname):
        return os.path.exists(os.path.join(item_dir, fname)) or os.path.exists(os.path.join(fb_dir, fname))

    k1 = check_file("chung_cu_quotes.json")
    k2 = check_file("chung_cu_erp.json")
    k3 = check_file("chung_cu_imis.json")
    k4 = check_file("chung_cu_muasamcong.json")
    k5 = check_file("chung_cu_ecom.json")
    k6 = check_file("chung_cu_synthesis.json")
    return jsonify({
        "has_quotes": k1,
        "has_erp": k2,
        "has_imis": k3,
        "has_msc": k4,
        "has_ecom": k5,
        "has_syn": k6,
        "done_count": sum([1 if x else 0 for x in [k1, k2, k3, k4, k5]])
    })


@app.route("/api/evidence/all-status", methods=["GET"])
def api_evidence_all_status():
    """Kiểm tra tiến độ 5 cơ sở của toàn bộ các mục trong dự án."""
    p_dir = get_project_files_dir()
    fb_base = os.path.join(DATA_DIR, "current_dossier_files")
    
    all_item_ids = set()
    if os.path.exists(p_dir):
        for entry in os.listdir(p_dir):
            if entry.startswith("item_"):
                try:
                    all_item_ids.add(int(entry.replace("item_", "")))
                except Exception:
                    pass
    if os.path.exists(fb_base):
        for entry in os.listdir(fb_base):
            if entry.startswith("item_"):
                try:
                    all_item_ids.add(int(entry.replace("item_", "")))
                except Exception:
                    pass

    status_map = {}
    for i_id in sorted(all_item_ids):
        i_dir = os.path.join(p_dir, f"item_{i_id}")
        fb_dir = os.path.join(fb_base, f"item_{i_id}")
        
        def check_file(fname):
            return os.path.exists(os.path.join(i_dir, fname)) or os.path.exists(os.path.join(fb_dir, fname))

        k1 = check_file("chung_cu_quotes.json")
        k2 = check_file("chung_cu_erp.json")
        k3 = check_file("chung_cu_imis.json")
        k4 = check_file("chung_cu_muasamcong.json")
        k5 = check_file("chung_cu_ecom.json")
        k6 = check_file("chung_cu_synthesis.json")
        status_map[str(i_id)] = {
            "has_quotes": k1,
            "has_erp": k2,
            "has_imis": k3,
            "has_msc": k4,
            "has_ecom": k5,
            "has_syn": k6,
            "done_count": sum([1 if x else 0 for x in [k1, k2, k3, k4, k5]])
        }
    return jsonify(status_map)


@app.route("/api/search-item-sources", methods=["POST"])
@app.route("/api/imis/search", methods=["POST"])
def api_search_sources():
    req = request.get_json() or {}
    kw = req.get("keyword", "").strip()
    tu_ngay = req.get("tu_ngay", "2023-01-01")
    den_ngay = req.get("den_ngay")
    ma_vt = req.get("ma_vt", "")
    item = req.get("item", kw)
    if not isinstance(item, dict):
        item = {"ten_vt": str(item)}
    dg_trinh = float(req.get("dg_trinh") or item.get("don_gia_trinh") or item.get("dg_trinh") or 0)
    selected_record = req.get("selected_record")
    if req.get("is_deselected") or selected_record == "NONE":
        selected_record = "NONE"
    use_average = req.get("use_average", False)

    if not kw:
        return jsonify({"imis": [], "erp": [], "summary": None, "summary_text": ""})

    result = imis_core.search_item_sources(kw, tu_ngay=tu_ngay, den_ngay=den_ngay, ma_vt=ma_vt)
    imis_recs = result.get("imis", [])
    
    used_kw = result.get("used_keyword") or kw
    summary_data = imis_core.generate_imis_summary_text(
        item, imis_recs, dg_trinh=dg_trinh, selected_record=selected_record, use_average=use_average, tu_ngay=tu_ngay, den_ngay=den_ngay, search_keyword=used_kw
    )
    result["summary"] = summary_data
    result["summary_text"] = summary_data.get("summary_text", "")
    return jsonify(result)


def extract_default_keyword(ten_vt, part_no=""):
    raw = (part_no or "") + " " + (ten_vt or "")
    match = re.search(r'(?:Partno|Part\s*No|Model|Mã)[\s:]*([A-Za-z0-9\-_]{3,20})', raw, re.IGNORECASE)
    if match and match.group(1):
        return match.group(1).strip()
    match2 = re.search(r'\b[A-Z0-9]{3,10}(?:[\-_/]\s*[A-Z0-9]{2,10})+\b', raw)
    if match2:
        return match2.group(0).strip()
    clean = re.sub(r'[\-:;]', ' ', ten_vt or "").strip()
    words = clean.split()
    return " ".join(words[:4]) if words else (ten_vt or "")[:30]


@app.route("/api/items/<int:item_id>/update-keyword", methods=["POST"])
def api_update_item_keyword(item_id):
    req = request.get_json() or {}
    keyword = req.get("keyword", "").strip()
    dossier = load_dossier_data()
    items = dossier.get("items", [])
    target = None
    for it in items:
        if it.get("id") == item_id or items.index(it) + 1 == item_id:
            target = it
            break
    if target:
        target["search_keyword"] = keyword
        save_dossier_data(dossier)
        return jsonify({"success": True, "keyword": keyword})
    return jsonify({"success": False, "message": "Item not found"}), 404


@app.route("/api/items/<int:item_id>/run-5-pillars", methods=["POST"])
def api_run_5_pillars(item_id):
    req = request.get_json() or {}
    kw_input = req.get("keyword", "").strip()
    
    dossier = load_dossier_data()
    items = dossier.get("items", [])
    target_item = None
    for it in items:
        if it.get("id") == item_id or items.index(it) + 1 == item_id:
            target_item = it
            break
            
    if not target_item:
        return jsonify({"success": False, "message": f"Không tìm thấy mục {item_id}"}), 404
        
    raw_ten = target_item.get("ten_vt", "")
    raw_part = target_item.get("part_no", "")
    keyword = kw_input or target_item.get("search_keyword") or extract_default_keyword(raw_ten, raw_part)
    target_item["search_keyword"] = keyword
    
    p_dir = get_project_files_dir()
    item_dir = os.path.join(p_dir, f"item_{item_id}")
    os.makedirs(item_dir, exist_ok=True)
    
    fallback_dir = os.path.join(DATA_DIR, "current_dossier_files", f"item_{item_id}")
    os.makedirs(fallback_dir, exist_ok=True)

    def write_evidence(fname, payload):
        with open(os.path.join(item_dir, fname), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        try:
            with open(os.path.join(fallback_dir, fname), "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    
    # 1. Báo giá gốc
    p1_desc = "Chưa nạp dữ liệu Báo giá gốc"
    p1_price = 0
    q_matches = None
    try:
        # Ưu tiên đọc từ file chứng cứ đã đối chiếu sẵn nếu có
        existing_q_file = os.path.join(item_dir, "chung_cu_quotes.json")
        if not os.path.exists(existing_q_file):
            existing_q_file = os.path.join(fallback_dir, "chung_cu_quotes.json")
            
        if os.path.exists(existing_q_file):
            try:
                with open(existing_q_file, "r", encoding="utf-8") as f:
                    q_matches = json.load(f)
            except Exception:
                q_matches = None

        # Nếu chưa có thì quét từ folder nguồn
        if not q_matches or not q_matches.get("min_price"):
            q_folder = None
            approved_file = os.path.join(p_dir, "bao_gia_project.json")
            if os.path.exists(approved_file):
                try:
                    with open(approved_file, "r", encoding="utf-8") as f:
                        q_folder = json.load(f).get("folder_nguon")
                except Exception:
                    pass
            q_folder = q_folder or quote_matcher.DEFAULT_QUOTES_DIR
            q_overrides = get_project_quote_overrides()
            scanned_quotes = quote_matcher.scan_quotation_folder(q_folder, overrides=q_overrides)
            q_matches = quote_matcher.match_item_in_quotes(target_item, scanned_quotes)

        if q_matches and q_matches.get("min_price"):
            p1_price = float(q_matches["min_price"])
            p1_supplier = q_matches.get("matches", [{}])[0].get("company", "Nhà thầu chào") if q_matches.get("matches") else "Nhà thầu chào"
            unit_str = target_item.get("dvt") or "Cái"
            p1_desc = f"Báo giá chào thấp nhất: {p1_price:,.0f} đ/{unit_str} ({p1_supplier})".replace(",", ".")
            write_evidence("chung_cu_quotes.json", q_matches)
    except Exception as e:
        print(f"Pillar 1 error for item {item_id}: {e}")

    # 2. ERP Vĩnh Tân 4 (Ưu tiên số 1 tuyệt đối: Mã ERP ma_vt)
    p2_desc = "Chưa có dữ liệu ERP nội bộ"
    p2_price = 0
    recs = []
    try:
        ma_vt = (target_item.get("ma_vt") or "").strip()
        # Ưu tiên 1: Tra cứu trực tiếp theo Mã ERP
        if ma_vt:
            recs = imis_core.search_erp_baseline(keyword="", ma_vt=ma_vt, min_score=40)
        
        # Ưu tiên 2: Nếu chưa có, tra cứu theo Tên tiếng Việt chuẩn hóa của vật tư
        if not recs:
            clean_name = (target_item.get("ten_vt_goc") or target_item.get("ten_vt") or "").split("\n")[0].strip()
            if clean_name:
                recs = imis_core.search_erp_baseline(keyword=clean_name, ma_vt=ma_vt, min_score=40)
                
        # Ưu tiên 3: Fallback bằng keyword
        if not recs and keyword:
            recs = imis_core.search_erp_baseline(keyword=keyword, ma_vt=ma_vt, min_score=40)

        if isinstance(recs, dict):
            recs = recs.get("results", [])

        if recs:
            p2_price = float(recs[0].get("don_gia") or recs[0].get("donGia") or 0)
            hd_info = recs[0].get('so_hd') or recs[0].get('soHopDong') or recs[0].get('soPhieuNhap') or 'HĐ lưu trữ'
            date_info = recs[0].get('ngayNhapKho') or recs[0].get('ngayKyHd') or ''
            sl_info = recs[0].get('soLuong')
            dvt_item = target_item.get('dvt', 'Cái')
            sl_str = f", SL: {sl_info:g} {dvt_item}" if sl_info else ""
            date_str = f" ngày {date_info}" if date_info else ""
            
            p2_desc = f"Lịch sử nhập kho ERP Vĩnh Tân 4: {p2_price:,.0f} đ/{dvt_item} (HĐ: {hd_info}{date_str}{sl_str})".replace(",", ".")
            if len(recs) > 1:
                other_prices = [f"{float(r.get('donGia') or r.get('don_gia') or 0):,.0f} đ".replace(",", ".") for r in recs[1:3]]
                p2_desc += f"; Các đợt nhập khác: {', '.join(other_prices)}"
        else:
            p2_desc = "Vật tư chưa có lịch sử mua sắm/nhập kho trong CSDL lịch sử mua sắm ERP của NMNĐ Vĩnh Tân 4."
            
        erp_payload = {
            "results": recs if isinstance(recs, list) else [],
            "summary": {"status": "MATCHED" if recs else "NO_ERP_DATA", "summary_text": p2_desc},
            "summary_text": p2_desc,
            "keyword": ma_vt or keyword
        }
        write_evidence("chung_cu_erp.json", erp_payload)
    except Exception as e:
        print(f"Pillar 2 error for item {item_id}: {e}")

    # 3. EVN IMIS
    p3_desc = "Chưa có dữ liệu EVN IMIS"
    p3_price = 0
    try:
        imis_res = imis_core.search_item_sources(keyword, ma_vt=target_item.get("ma_vt", ""))
        imis_recs = imis_res.get("imis", [])
        if imis_recs:
            p3_price = float(imis_recs[0].get("don_gia") or 0)
            p3_desc = f"IMIS EVN: {p3_price:,.0f} đ/Cái ({imis_recs[0].get('ten_don_vi', 'Tập đoàn')})".replace(",", ".")
        else:
            p3_desc = f"Trong khoảng thời gian tra cứu từ ngày 01/01/2023 đến nay, qua đối chiếu CSDL EVN IMIS theo từ khóa [{keyword}], vật tư chưa tìm thấy dữ liệu mua sắm tương đương trên CSDL EVN IMIS."
            
        imis_payload = {
            "imis": imis_recs,
            "erp": imis_res.get("erp", []),
            "summary": {"status": "MATCHED" if imis_recs else "NO_IMIS_DATA", "summary_text": p3_desc},
            "summary_text": p3_desc,
            "keyword": keyword,
            "used_keyword": keyword
        }
        write_evidence("chung_cu_imis.json", imis_payload)
    except Exception as e:
        print(f"Pillar 3 error for item {item_id}: {e}")

    # 4. Mua sắm công e-GP
    p4_desc = "Chưa có dữ liệu Mua sắm công e-GP"
    p4_price = 0
    try:
        clean_msc_kw = (target_item.get("ten_vt_goc") or target_item.get("ten_vt") or "").split("\n")[0].strip()
        msc_analysis = msc_matcher.search_muasamcong(clean_msc_kw or keyword)
        if (not msc_analysis or not msc_analysis.get("success")) and keyword and keyword != clean_msc_kw:
            msc_analysis = msc_matcher.search_muasamcong(keyword)
            
        if msc_analysis and msc_analysis.get("success"):
            comp = msc_matcher.analyze_msc_comparison(target_item, msc_analysis)
            p4_price = float(comp.get("min_price") or 0)
            if p4_price > 0:
                p4_desc = f"e-GP MSC: {p4_price:,.0f} đ/Cái (Kết quả trúng thầu)".replace(",", ".")
            else:
                p4_desc = f"Đã tra cứu từ khóa [{clean_msc_kw or keyword}] trên Mạng Đấu thầu Quốc gia nhưng chưa ghi nhận kết quả trúng thầu tương tự."
            msc_payload = {
                "results": comp.get("items", []),
                "summary": comp.get("summary", {}),
                "summary_text": p4_desc,
                "keyword": clean_msc_kw or keyword,
                "analysis": comp
            }
            write_evidence("chung_cu_muasamcong.json", msc_payload)
    except Exception as e:
        print(f"Pillar 4 error for item {item_id}: {e}")

    # 5. Thương mại điện tử
    p5_desc = "Vật tư đặc thù - Yêu cầu báo giá riêng (Contact for Quote)"
    p5_price = 0
    try:
        ecom_res = {"keyword": keyword, "records": [], "note": "Contact for Quote"}
        write_evidence("chung_cu_ecom.json", ecom_res)
    except Exception as e:
        print(f"Pillar 5 error for item {item_id}: {e}")

    # 6. Synthesis (Tùy chọn AI - Mặc định tắt để ưu tiên rút ngắn thời gian tra cứu cơ sở 1 đến cơ sở 5)
    run_ai = bool(req.get("run_ai", False))
    pillars_dict = {
        "p1_desc": p1_desc, "p1_price": p1_price,
        "p2_desc": p2_desc, "p2_price": p2_price,
        "p3_desc": p3_desc, "p3_price": p3_price,
        "p4_desc": p4_desc, "p4_price": p4_price,
        "p5_desc": p5_desc, "p5_price": p5_price
    }
    
    if run_ai:
        sme_result = ai_synthesis.generate_ai_synthesis(target_item, pillars_dict)
    else:
        # Tổng hợp tức thời 5 cơ sở bằng quy tắc chuẩn, không mất thời gian gọi mạng AI LLM
        valid_prices = [p for p in [p1_price, p2_price, p3_price, p4_price, p5_price] if p > 0]
        dg_trinh_val = float(target_item.get("don_gia_trinh") or 0)
        suggested_price = min(valid_prices) if valid_prices else dg_trinh_val
        unit = target_item.get("dvt", "Cái")
        
        summary_lines = [
            f"TỔNG HỢP 5 CƠ SỞ CHỨNG CỨ (Đã rà soát nhanh):",
            f"• Cơ sở 1 (Báo Giá Gốc): {p1_desc}",
            f"• Cơ sở 2 (ERP Vĩnh Tân 4): {p2_desc}",
            f"• Cơ sở 3 (EVN IMIS): {p3_desc}",
            f"• Cơ sở 4 (Mua Sắm Công e-GP): {p4_desc}",
            f"• Cơ sở 5 (TMĐT & Tham Khảo Web): {p5_desc}",
            f"KẾT LUẬN: Đơn giá tham chiếu mốc thấp nhất đề xuất là {suggested_price:,.0f} đ/{unit}.".replace(",", ".")
        ]
        sme_result = {
            "suggested_price": suggested_price,
            "estimated_savings": (dg_trinh_val - suggested_price) * float(target_item.get("so_luong") or 1) if dg_trinh_val > suggested_price else 0,
            "price_score": 90 if suggested_price <= dg_trinh_val else 40,
            "coverage_score": sum([1 for p in [p1_price, p2_price, p3_price, p4_price, p5_price] if p > 0]) * 20,
            "summary_text": "\n".join(summary_lines),
            "risk_flag": "NORMAL",
            "ai_ran": False
        }

    synthesis_text = sme_result.get("summary_text", "")
    write_evidence("chung_cu_synthesis.json", sme_result)
        
    target_item["danh_gia_ttd"] = synthesis_text
    if sme_result.get("suggested_price"):
        target_item["don_gia_thong_nhat"] = float(sme_result["suggested_price"])
        sl = float(target_item.get("so_luong") or 1)
        target_item["thanh_tien_thong_nhat"] = target_item["don_gia_thong_nhat"] * sl
        dg_trinh = float(target_item.get("don_gia_trinh") or 0)
        target_item["gia_tri_giam"] = (dg_trinh - target_item["don_gia_thong_nhat"]) * sl

    # 7. Build Comprehensive Audit Trail for 100% Transparency
    dg_trinh_val = float(target_item.get("don_gia_trinh") or 0)
    dg_tn_val = float(target_item.get("don_gia_thong_nhat") or dg_trinh_val)
    sl_val = float(target_item.get("so_luong") or 1)
    giam_val = float(target_item.get("gia_tri_giam") or 0)
    pct_save = ((dg_trinh_val - dg_tn_val) / dg_trinh_val * 100) if dg_trinh_val > 0 else 0

    p1_supplier = "Chưa có"
    p1_file = ""
    p1_count = 0
    p1_item_name = ""
    p1_specs = ""
    p1_score = 0
    if 'q_matches' in locals() and q_matches:
        p1_count = len(q_matches.get("matches", []))
        if q_matches.get("matches"):
            top_m = q_matches["matches"][0]
            p1_supplier = top_m.get("company", "Nhà thầu chào")
            p1_file = top_m.get("filename", "")
            p1_item_name = top_m.get("quoted_name", "")
            p1_specs = top_m.get("quoted_tskt", "")
            p1_score = top_m.get("score", 0)

    p2_count = 0
    p2_contract = ""
    p2_year = ""
    p2_item_name = ""
    p2_specs = ""
    if 'recs' in locals() and recs:
        p2_count = len(recs)
        top_rec = recs[0]
        p2_contract = top_rec.get("so_hd") or top_rec.get("soHopDong") or top_rec.get("soPhieuNhap") or ""
        p2_year = str(top_rec.get("ngayNhapKho") or top_rec.get("ngayKyHd") or top_rec.get("nam") or top_rec.get("thang_nam") or "")
        p2_item_name = top_rec.get("ten_vt") or top_rec.get("tenVatTu") or ""
        p2_specs = top_rec.get("quyCach") or top_rec.get("tskt") or ""

    p3_count = 0
    p3_unit = ""
    p3_item_name = ""
    if 'imis_res' in locals() and imis_res and imis_res.get("imis"):
        p3_count = len(imis_res["imis"])
        top_imis = imis_res["imis"][0]
        p3_unit = top_imis.get("ten_don_vi", "")
        p3_item_name = top_imis.get("ten_hang_hoa") or top_imis.get("ten_vt") or ""

    audit_trail = {
        "item_id": item_id,
        "ten_vt": raw_ten,
        "ma_vt": target_item.get("ma_vt", ""),
        "keyword_used": keyword,
        "so_luong": sl_val,
        "dvt": target_item.get("dvt", "Cái"),
        "don_gia_trinh": dg_trinh_val,
        "don_gia_thong_nhat": dg_tn_val,
        "thanh_tien_thong_nhat": float(target_item.get("thanh_tien_thong_nhat") or (dg_tn_val * sl_val)),
        "gia_tri_giam": giam_val,
        "pct_giam": pct_save,
        "steps": [
            {
                "step_id": "quotes",
                "name": "1. Báo Giá Gốc (PDF)",
                "status": "success" if p1_price > 0 else "empty",
                "price": p1_price,
                "count": p1_count,
                "item_name": p1_item_name,
                "specs": p1_specs,
                "supplier": p1_supplier,
                "file": p1_file,
                "score": p1_score,
                "detail": p1_desc
            },
            {
                "step_id": "erp",
                "name": "2. ERP Vĩnh Tân 4",
                "status": "success" if p2_price > 0 else "empty",
                "price": p2_price,
                "count": p2_count,
                "item_name": p2_item_name,
                "specs": p2_specs,
                "contract": p2_contract,
                "contract_info": f"HĐ: {p2_contract}, {p2_year}" if p2_contract else p2_year,
                "year": p2_year,
                "detail": p2_desc
            },
            {
                "step_id": "imis",
                "name": "3. EVN IMIS Toàn Ngành",
                "status": "success" if p3_price > 0 else "empty",
                "price": p3_price,
                "count": p3_count,
                "item_name": p3_item_name,
                "unit": p3_unit,
                "supplier": p3_unit,
                "detail": p3_desc
            },
            {
                "step_id": "msc",
                "name": "4. Mua Sắm Công e-GP",
                "status": "success" if p4_price > 0 else "empty",
                "price": p4_price,
                "detail": p4_desc
            },
            {
                "step_id": "ecom",
                "name": "5. TMĐT & Tham Khảo Web",
                "status": "info",
                "price": p5_price,
                "detail": p5_desc
            },
            {
                "step_id": "synthesis",
                "name": "6. AI Thuyết Minh & Chốt Giá",
                "status": "success",
                "price": dg_tn_val,
                "coverage_score": sme_result.get("coverage_score", 85),
                "price_score": sme_result.get("price_score", 90),
                "summary_text": synthesis_text,
                "detail": f"Đơn giá thống nhất: {dg_tn_val:,.0f} đ/Cái (Tiết kiệm {giam_val:,.0f} đ)".replace(",", ".")
            }
        ]
    }

    write_evidence("chung_cu_audit_trail.json", audit_trail)

    save_dossier_data(dossier)
    
    return jsonify({
        "success": True,
        "item_id": item_id,
        "keyword": keyword,
        "audit_trail": audit_trail,
        "synthesis": sme_result,
        "item": target_item
    })


@app.route("/api/import-excel", methods=["POST"])
def api_import_excel():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "Không tìm thấy file"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "Chưa chọn file"}), 400
        
    try:
        wb = openpyxl.load_workbook(file, data_only=True)
        ws = wb.active
        
        items = []
        item_id = 1
        rows_list = list(ws.iter_rows(values_only=True))
        
        # Tự động tìm dòng Tiêu đề (Header) và phân tích các cột động
        start_row_idx = 0
        col_map = {}
        for idx, r in enumerate(rows_list):
            if not r:
                continue
            r_str = " ".join([str(c or "").upper() for c in r])
            if ("TÊN" in r_str and ("VẬT TƯ" in r_str or "QUY CÁCH" in r_str)) or ("MÃ" in r_str and "STT" in r_str) or ("THÔNG SỐ KỸ THUẬT" in r_str) or ("PYCVT" in r_str):
                start_row_idx = idx + 1
                for c_idx, val in enumerate(r):
                    val_u = str(val or "").strip().upper()
                    if not val_u:
                        continue
                    if val_u == "STT":
                        col_map["stt"] = c_idx
                    elif "PYCVT" in val_u:
                        col_map["pycvt"] = c_idx
                    elif "MÃ" in val_u and ("ERP" in val_u or "VẬT TƯ" in val_u or "VT" in val_u):
                        col_map["ma_vt"] = c_idx
                    elif "MÃ" in val_u and "ma_vt" not in col_map:
                        col_map["ma_vt"] = c_idx
                    elif ("HÃNG" in val_u or "HSX" in val_u or "XUẤT XỨ" in val_u or "NSX" in val_u):
                        col_map["hsx_xx"] = c_idx
                    elif "THÔNG SỐ" in val_u or "QUY CÁCH KỸ THUẬT" in val_u:
                        col_map["thong_so_kt"] = c_idx
                    elif "TÊN" in val_u and ("VẬT TƯ" in val_u or "QUY CÁCH" in val_u or "HÀNG" in val_u):
                        col_map["ten_vt"] = c_idx
                    elif val_u in ("ĐVT", "ĐƠN VỊ TÍNH", "ĐƠN VỊ"):
                        col_map["dvt"] = c_idx
                    elif "SỐ LƯỢNG" in val_u or val_u == "SL":
                        col_map["so_luong"] = c_idx
                    elif "ĐƠN GIÁ" in val_u and ("TRÌNH" in val_u or "ĐỀ NGHỊ" in val_u or "MIN" in val_u):
                        col_map["don_gia_trinh"] = c_idx
                    elif "THÀNH TIỀN" in val_u and ("TRÌNH" in val_u or "ĐỀ NGHỊ" in val_u or "thanh_tien_trinh" not in col_map):
                        col_map["thanh_tien_trinh"] = c_idx
                    elif "ĐÁNH GIÁ" in val_u or ("TỔ THẨM ĐỊNH" in val_u and "Ý KIẾN" in val_u) or "TTĐ" in val_u:
                        col_map["danh_gia_ttd"] = c_idx
                    elif "PHẢN BIỆN" in val_u or ("KHVT" in val_u and "Ý KIẾN" in val_u):
                        col_map["phan_bien_khvt"] = c_idx
                    elif "ĐƠN GIÁ" in val_u and "THỐNG NHẤT" in val_u:
                        col_map["don_gia_thong_nhat"] = c_idx
                    elif "THÀNH TIỀN" in val_u and "THỐNG NHẤT" in val_u:
                        col_map["thanh_tien_thong_nhat"] = c_idx
                    elif "GIẢM" in val_u:
                        col_map["gia_tri_giam"] = c_idx
                    elif "CƠ SỞ" in val_u or "CĂN CỨ" in val_u:
                        col_map["co_so_thong_nhat"] = c_idx
                    elif "GHI CHÚ" in val_u:
                        col_map["ghi_chu"] = c_idx
                break

        def get_val(row, key, default=""):
            if key in col_map and col_map[key] < len(row):
                v = row[col_map[key]]
                return default if v is None else v
            return default
                
        for row in rows_list[start_row_idx:]:
            if not row or not any(row):
                continue

            pycvt = str(get_val(row, "pycvt", "")).strip()
            ma_vt = str(get_val(row, "ma_vt", "")).strip()
            ten_vt_goc = str(get_val(row, "ten_vt", "")).strip()
            thong_so_kt = str(get_val(row, "thong_so_kt", "")).strip()
            hsx_xx = str(get_val(row, "hsx_xx", "")).strip()
            dvt = str(get_val(row, "dvt", "Cái")).strip() or "Cái"
            ghi_chu = str(get_val(row, "ghi_chu", "")).strip()

            if ten_vt_goc.upper() in ("TÊN VẬT TƯ", "STT", "TÊN QUY CÁCH", "TÊN HÀNG") or ma_vt.upper() in ("MÃ VẬT TƯ", "MÃ ERP"):
                continue
            if not ten_vt_goc and not thong_so_kt and not ma_vt:
                continue

            if not ten_vt_goc and thong_so_kt:
                ten_vt_goc = thong_so_kt
                thong_so_kt = ""

            try:
                sl = float(get_val(row, "so_luong", 1))
            except:
                sl = 1.0

            try:
                dg_trinh = float(get_val(row, "don_gia_trinh", 0))
            except:
                dg_trinh = 0.0

            try:
                tt_trinh = float(get_val(row, "thanh_tien_trinh", round(sl * dg_trinh, 0)))
            except:
                tt_trinh = round(sl * dg_trinh, 0)

            dg_ttd = str(get_val(row, "danh_gia_ttd", "")).strip()
            pb_khvt = str(get_val(row, "phan_bien_khvt", "")).strip()

            if "don_gia_thong_nhat" in col_map:
                try:
                    dg_tn_raw = get_val(row, "don_gia_thong_nhat", None)
                    if dg_tn_raw is not None and str(dg_tn_raw).strip() != "":
                        dg_tn = float(dg_tn_raw)
                    else:
                        dg_tn = dg_trinh
                except:
                    dg_tn = dg_trinh
            else:
                dg_tn = dg_trinh

            if "thanh_tien_thong_nhat" in col_map:
                try:
                    tt_tn_raw = get_val(row, "thanh_tien_thong_nhat", None)
                    if tt_tn_raw is not None and str(tt_tn_raw).strip() != "":
                        tt_tn = float(tt_tn_raw)
                    else:
                        tt_tn = round(sl * dg_tn, 0)
                except:
                    tt_tn = round(sl * dg_tn, 0)
            else:
                tt_tn = round(sl * dg_tn, 0)

            if "gia_tri_giam" in col_map:
                try:
                    gg_raw = get_val(row, "gia_tri_giam", None)
                    if gg_raw is not None and str(gg_raw).strip() != "":
                        gia_giam = float(gg_raw)
                    else:
                        gia_giam = max(0.0, tt_trinh - tt_tn)
                except:
                    gia_giam = max(0.0, tt_trinh - tt_tn)
            else:
                gia_giam = max(0.0, tt_trinh - tt_tn)

            co_so_tn = str(get_val(row, "co_so_thong_nhat", "")).strip()

            full_name = f"{ten_vt_goc} - {thong_so_kt}" if (ten_vt_goc and thong_so_kt) else (ten_vt_goc or thong_so_kt)
            part_no = thong_so_kt or ma_vt

            items.append({
                "id": item_id,
                "pycvt": pycvt,
                "ma_vt": ma_vt,
                "part_no": part_no,
                "ten_vt": full_name,
                "ten_vt_goc": ten_vt_goc,
                "thong_so_kt": thong_so_kt,
                "hsx_xx": hsx_xx,
                "dvt": dvt,
                "so_luong": sl,
                "don_gia_trinh": dg_trinh,
                "thanh_tien_trinh": tt_trinh,
                "danh_gia_ttd": dg_ttd,
                "phan_bien_khvt": pb_khvt,
                "don_gia_thong_nhat": dg_tn,
                "thanh_tien_thong_nhat": tt_tn,
                "gia_tri_giam": gia_giam,
                "co_so_thong_nhat": co_so_tn,
                "ghi_chu": ghi_chu
            })
            item_id += 1
            
        existing_data = load_dossier_data()
        existing_items = existing_data.get("items", [])
        
        # Ánh xạ các mục cũ đã thẩm định để bảo vệ 100% kết quả
        existing_map_by_id = {it.get("id"): it for it in existing_items}
        existing_map_by_key = {}
        for it in existing_items:
            m_vt = str(it.get("ma_vt") or "").strip()
            t_vt = str(it.get("ten_vt_goc") or it.get("ten_vt") or "").strip().lower()
            if m_vt:
                existing_map_by_key[f"ma:{m_vt}"] = it
            if t_vt:
                existing_map_by_key[f"ten:{t_vt}"] = it

        for it in items:
            cur_id = it.get("id")
            m_vt = str(it.get("ma_vt") or "").strip()
            t_vt = str(it.get("ten_vt_goc") or it.get("ten_vt") or "").strip().lower()

            # Tìm xem mục này có trong các mục đã thẩm định trước đó không
            matched_old = None
            if cur_id in existing_map_by_id:
                old_cand = existing_map_by_id[cur_id]
                old_m = str(old_cand.get("ma_vt") or "").strip()
                old_t = str(old_cand.get("ten_vt_goc") or old_cand.get("ten_vt") or "").strip().lower()
                if (m_vt and m_vt == old_m) or (t_vt and (t_vt in old_t or old_t in t_vt or t_vt[:25] == old_t[:25])):
                    matched_old = old_cand
            if not matched_old and m_vt and f"ma:{m_vt}" in existing_map_by_key:
                matched_old = existing_map_by_key[f"ma:{m_vt}"]
            if not matched_old and t_vt and f"ten:{t_vt}" in existing_map_by_key:
                matched_old = existing_map_by_key[f"ten:{t_vt}"]

            if matched_old:
                # Kế thừa hsx_xx, pycvt, ghi_chu nếu file import để trống
                if not it.get("hsx_xx") and matched_old.get("hsx_xx"):
                    it["hsx_xx"] = matched_old.get("hsx_xx")
                if not it.get("pycvt") and matched_old.get("pycvt"):
                    it["pycvt"] = matched_old.get("pycvt")
                if not it.get("ghi_chu") and matched_old.get("ghi_chu"):
                    it["ghi_chu"] = matched_old.get("ghi_chu")

                # Kế thừa kết quả thẩm định đã chốt nếu file import chưa có đơn giá thống nhất khác
                old_dg_tn = float(matched_old.get("don_gia_thong_nhat") or 0)
                old_co_so = matched_old.get("co_so_thong_nhat")
                old_danh_gia = matched_old.get("danh_gia_ttd")
                
                if (not it.get("don_gia_thong_nhat") or it.get("don_gia_thong_nhat") == it.get("don_gia_trinh")) and old_dg_tn > 0:
                    it["don_gia_thong_nhat"] = old_dg_tn
                    if old_co_so:
                        it["co_so_thong_nhat"] = old_co_so
                    if old_danh_gia:
                        it["danh_gia_ttd"] = old_danh_gia
                    if matched_old.get("phan_bien_khvt"):
                        it["phan_bien_khvt"] = matched_old.get("phan_bien_khvt")

            # Luôn tính toán lại thành tiền và giá trị giảm theo đơn giá trình MỚI và số lượng MỚI
            qty = float(it.get("so_luong") or 1)
            dg_trinh = float(it.get("don_gia_trinh") or 0)
            dg_tn = float(it.get("don_gia_thong_nhat") or dg_trinh)
            it["thanh_tien_trinh"] = round(qty * dg_trinh, 0)
            it["thanh_tien_thong_nhat"] = round(qty * dg_tn, 0)
            it["gia_tri_giam"] = max(0.0, it["thanh_tien_trinh"] - it["thanh_tien_thong_nhat"])

        data = existing_data
        data["items"] = items
        data["dossier_name"] = os.path.splitext(file.filename)[0]
        save_dossier_data(data)
        try:
            onedrive_sync.push_to_onedrive()
        except Exception:
            pass
        return jsonify({"success": True, "dossier": data, "count": len(items)})
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi đọc file Excel: {e}"}), 500


@app.route("/api/export-excel", methods=["GET"])
def api_export_excel():
    data = load_dossier_data()
    items = data.get("items", [])
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Tham_Dinh_Du_Toan"
    
    # Header Styles
    font_title = Font(name="Times New Roman", size=13, bold=True, color="003366")
    font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
    fill_header_ttd = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
    fill_header_khvt = PatternFill(start_color="1B5E20", end_color="1B5E20", fill_type="solid")
    fill_header_res = PatternFill(start_color="E65100", end_color="E65100", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='D0D0D0'),
        right=Side(style='thin', color='D0D0D0'),
        top=Side(style='thin', color='D0D0D0'),
        bottom=Side(style='thin', color='D0D0D0')
    )
    
    # Title Rows
    ws.append([data.get("dossier_name", "BẢNG TỔNG HỢP Ý KIẾN THẨM ĐỊNH DỰ TOÁN")])
    ws.append(["Tổ Thẩm định Dự toán - Nhà máy Nhiệt điện Vĩnh Tân 4"])
    ws.append([])
    
    headers = [
        "STT", "Mã Vật Tư", "Tên Vật Tư", "Thông Số Kỹ Thuật", "HSX/XX (Trình)", "ĐVT", "Số Lượng",
        "Đơn Giá Đề Nghị (Trình)", "Thành Tiền Đề Nghị",
        "ĐÁNH GIÁ CỦA TỔ THẨM ĐỊNH (TTĐ)",
        "Ý KIẾN PHẢN BIỆN CỦA PHÒNG KHVT",
        "Đơn Giá Thống Nhất", "Thành Tiền Thống Nhất", "Giá Trị Giảm",
        "Cơ Sở Thống Nhất", "Ghi Chú"
    ]
    ws.append(headers)
    
    row_header_idx = 4
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=row_header_idx, column=col_idx)
        cell.font = font_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        if col_idx == 11:
            cell.fill = fill_header_khvt
        elif col_idx in (12, 13, 14, 15):
            cell.fill = fill_header_res
        else:
            cell.fill = fill_header_ttd

    font_data = Font(name="Times New Roman", size=10)
    for idx, it in enumerate(items, 1):
        dg_trinh = it.get("don_gia_trinh", 0)
        sl = it.get("so_luong", 0)
        tt_trinh = round(sl * dg_trinh, 0)
        dg_tn = it.get("don_gia_thong_nhat", dg_trinh)
        tt_tn = round(sl * dg_tn, 0)
        giam = max(0, tt_trinh - tt_tn)
        
        ten_goc = it.get("ten_vt_goc") or it.get("ten_vt", "")
        ts_kt = it.get("thong_so_kt") or it.get("part_no", "")
        hsx_xx = it.get("hsx_xx", "")
        
        row_vals = [
            idx,
            it.get("ma_vt", ""),
            ten_goc,
            ts_kt,
            hsx_xx,
            it.get("dvt", ""),
            sl,
            dg_trinh,
            tt_trinh,
            it.get("danh_gia_ttd", ""),
            it.get("phan_bien_khvt", ""),
            dg_tn,
            tt_tn,
            giam,
            it.get("co_so_thong_nhat", ""),
            it.get("ghi_chu", "")
        ]
        ws.append(row_vals)
        cur_row = row_header_idx + idx
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=cur_row, column=col_idx)
            c.font = font_data
            c.border = border_thin
            if col_idx in (7, 8, 9, 12, 13, 14):
                c.number_format = '#,##0'
            if col_idx in (1, 6):
                c.alignment = Alignment(horizontal="center", vertical="top")
            elif col_idx in (2, 5):
                c.alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
            elif col_idx in (3, 4, 10, 11, 15, 16):
                c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
            else:
                c.alignment = Alignment(horizontal="right", vertical="top")

    # Tự động chỉnh độ rộng cột
    ws.column_dimensions['A'].width = 6    # STT
    ws.column_dimensions['B'].width = 20   # Mã Vật Tư
    ws.column_dimensions['C'].width = 32   # Tên Vật Tư
    ws.column_dimensions['D'].width = 40   # Thông Số Kỹ Thuật
    ws.column_dimensions['E'].width = 22   # HSX/XX (Trình)
    ws.column_dimensions['F'].width = 8    # ĐVT
    ws.column_dimensions['G'].width = 10   # Số Lượng
    ws.column_dimensions['H'].width = 18   # Đơn Giá Đề Nghị (Trình)
    ws.column_dimensions['I'].width = 20   # Thành Tiền Đề Nghị
    ws.column_dimensions['J'].width = 42   # ĐÁNH GIÁ CỦA TỔ THẨM ĐỊNH (TTĐ)
    ws.column_dimensions['K'].width = 30   # Ý KIẾN PHẢN BIỆN CỦA PHÒNG KHVT
    ws.column_dimensions['L'].width = 18   # Đơn Giá Thống Nhất
    ws.column_dimensions['M'].width = 20   # Thành Tiền Thống Nhất
    ws.column_dimensions['N'].width = 16   # Giá Trị Giảm
    ws.column_dimensions['O'].width = 38   # Cơ Sở Thống Nhất
    ws.column_dimensions['P'].width = 28   # Ghi Chú
    
    export_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "Bang_Tham_Dinh_Du_Toan.xlsx")
    wb.save(export_path)
    return send_file(export_path, as_attachment=True, download_name="Bang_Tham_Dinh_Du_Toan.xlsx")


def _clean_ai_text(text):
    """Loại bỏ từ khóa AI, markdown formatting để chuẩn hóa văn bản báo cáo."""
    if not text:
        return ''
    t = str(text)
    replacements = [
        ('Ý kiến Chuyên gia AI & Báo giá thấp nhất DTL (Khối 1)', 'Đối chiếu báo giá thấp nhất DTL & phân tích kỹ thuật của Tổ Thẩm định'),
        ('Ý kiến Chuyên gia AI & Báo giá thấp nhất DTL', 'Đối chiếu báo giá thấp nhất DTL & phân tích kỹ thuật của Tổ Thẩm định'),
        ('Ý kiến Chuyên gia AI', 'Đánh giá của Tổ Thẩm định'),
        ('Chuyên gia AI', 'Tổ Thẩm định'),
        ('AI Thuyết minh & Chốt giá', 'Ý kiến thẩm định & đề xuất chốt giá'),
        ('AI Thuyết minh', 'Tổ Thẩm định đánh giá'),
        ('CSDL Kế toán ERP', 'CSDL lịch sử mua sắm ERP'),
        ('CSDL KẾ TOÁN ERP', 'CSDL LỊCH SỬ MUA SẮM ERP'),
        ('AI', 'Tổ Thẩm định'),
        ('trên 5 cơ sở chứng cứ', 'trên các cơ sở chứng cứ thu thập được'),
        ('Prompt', ''),
        ('LLM', ''),
    ]
    for old, new in replacements:
        t = t.replace(old, new)
    t = re.sub(r'[*#_`]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _shorten_eval(text):
    """Rút gọn đánh giá thẩm định cho sheet báo cáo tổng hợp."""
    cleaned = _clean_ai_text(text)
    if not cleaned:
        return 'Thẩm định phù hợp theo hồ sơ trình và báo giá nộp kèm.'
    sentences = re.split(r'[.\n]', cleaned)
    valid_s = [
        s.strip() for s in sentences
        if len(s.strip()) > 20 and not s.strip().startswith('TỔ THẨM ĐỊNH') and not s.strip().startswith('BÁO CÁO') and not s.strip().startswith('1. TỔNG HỢP')
    ]
    if valid_s:
        res = '. '.join(valid_s[:2]) + '.'
        return res[:260]
    return cleaned[:220]


def _get_active_project_files_dir():
    """Tìm thư mục chứng cứ (item files) dựa trên active project."""
    if os.path.exists(ACTIVE_PROJECT_FILE):
        try:
            with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as fp:
                act = json.load(fp)
            act_id = act.get("active_id", "")
            if act_id:
                base_name = act_id.replace(".json", "") + "_files"
                files_dir = os.path.join(PROJECTS_DIR, base_name)
                if os.path.isdir(files_dir):
                    return files_dir
        except Exception:
            pass
    # Fallback: tìm thư mục *_files đầu tiên trong PROJECTS_DIR
    try:
        for d in sorted(os.listdir(PROJECTS_DIR)):
            dp = os.path.join(PROJECTS_DIR, d)
            if os.path.isdir(dp) and d.endswith("_files"):
                return dp
    except Exception:
        pass
    return None


@app.route("/api/export-executive-report", methods=["GET"])
def api_export_executive_report():
    """Xuất Bản Lãnh Đạo - Báo cáo Excel 3 sheet trình lãnh đạo Nhà máy."""
    data = load_dossier_data()
    items = data.get("items", [])
    dossier_name = data.get("dossier_name", "Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026")
    creator = data.get("creator", "Nguyễn Anh Hiếu")
    proj_files_dir = _get_active_project_files_dir()

    wb = openpyxl.Workbook()

    # Style definitions
    font_title_gov = Font(name='Times New Roman', size=10, bold=True, color='333333')
    font_title_main = Font(name='Times New Roman', size=14, bold=True, color='003366')
    font_sub = Font(name='Times New Roman', size=10, italic=True, color='555555')
    font_hdr = Font(name='Times New Roman', size=10, bold=True, color='FFFFFF')
    font_bold_navy = Font(name='Times New Roman', size=10, bold=True, color='003366')
    font_data = Font(name='Times New Roman', size=10)
    font_data_bold = Font(name='Times New Roman', size=10, bold=True)
    font_saving = Font(name='Times New Roman', size=10, bold=True, color='15803D')
    font_link = Font(name='Times New Roman', size=10, color='0055AA', underline='single')

    fill_navy = PatternFill(start_color='003366', end_color='003366', fill_type='solid')
    fill_navy_light = PatternFill(start_color='EBF3FA', end_color='EBF3FA', fill_type='solid')
    fill_kpi = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_kpi_hl = PatternFill(start_color='ECFDF5', end_color='ECFDF5', fill_type='solid')
    fill_group_hdr = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Tính toán KPI
    appraised_items = [it for it in items if it.get('gia_tri_giam', 0) > 0 or (it.get('co_so_thong_nhat') and it.get('don_gia_thong_nhat') and it.get('id', 999) <= 10)]
    total_items = len(items)
    sum_trinh = sum([it.get('thanh_tien_trinh', 0) for it in items])
    sum_tn = sum([it.get('thanh_tien_thong_nhat', it.get('thanh_tien_trinh', 0)) for it in items])
    sum_giam = sum([it.get('gia_tri_giam', 0) for it in items])
    pct_giam = (sum_giam / sum_trinh * 100) if sum_trinh > 0 else 0
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    # ========================================================================
    # SHEET 1: Báo Cáo Tổng Hợp
    # ========================================================================
    ws1 = wb.active
    ws1.title = '1. Báo Cáo Tổng Hợp'
    ws1.sheet_view.showGridLines = True
    ws1.freeze_panes = 'A13'

    ws1['A1'] = 'TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM'
    ws1['A1'].font = font_title_gov
    ws1['A2'] = 'NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4'
    ws1['A2'].font = font_title_gov
    ws1['A3'] = 'TỔ THẨM ĐỊNH DỰ TOÁN'
    ws1['A3'].font = Font(name='Times New Roman', size=10, bold=True, color='003366', underline='single')

    ws1.merge_cells('H1:K1')
    ws1['H1'] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'
    ws1['H1'].font = font_title_gov
    ws1['H1'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('H2:K2')
    ws1['H2'] = 'Độc lập - Tự do - Hạnh phúc'
    ws1['H2'].font = Font(name='Times New Roman', size=10, bold=True, underline='single')
    ws1['H2'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('H3:K3')
    now_dt = datetime.now()
    ws1['H3'] = f'Lâm Đồng, ngày {now_dt.day:02d} tháng {now_dt.month:02d} năm {now_dt.year}'
    ws1['H3'].font = font_sub
    ws1['H3'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A5:L5')
    ws1['A5'] = 'BÁO CÁO KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ DỰ TOÁN MUA SẮM VẬT TƯ'
    ws1['A5'].font = font_title_main
    ws1['A5'].alignment = Alignment(horizontal='center', vertical='center')

    ws1.merge_cells('A6:L6')
    ws1['A6'] = f'Hồ sơ: {dossier_name} | Người thực hiện: {creator}'
    ws1['A6'].font = font_sub
    ws1['A6'].alignment = Alignment(horizontal='center', vertical='center')

    # KPI Table
    ws1.merge_cells('A8:C8'); ws1['A8'] = 'QUY MÔ DANH MỤC'; ws1['A8'].font = font_hdr; ws1['A8'].fill = fill_navy; ws1['A8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D8:G8'); ws1['D8'] = 'TỔNG DỰ TOÁN TRÌNH & THẨM ĐỊNH'; ws1['D8'].font = font_hdr; ws1['D8'].fill = fill_navy; ws1['D8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H8:L8'); ws1['H8'] = 'HIỆU QUẢ TIẾT GIẢM CHI PHÍ (TIẾT KIỆM)'; ws1['H8'].font = font_hdr; ws1['H8'].fill = fill_navy; ws1['H8'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A9:C9'); ws1['A9'] = f'Tổng số: {total_items} mục (Đã chốt: {len(appraised_items)} mục)'; ws1['A9'].font = font_data_bold; ws1['A9'].fill = fill_kpi; ws1['A9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D9:G9'); ws1['D9'] = f'Trình: {sum_trinh:,.0f} đ  -->  Thẩm định: {sum_tn:,.0f} đ'.replace(',', '.'); ws1['D9'].font = font_data_bold; ws1['D9'].fill = fill_kpi; ws1['D9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H9:L9'); ws1['H9'] = f'TIẾT KIỆM CHO NHÀ MÁY: -{sum_giam:,.0f} đ  ({pct_giam:.2f}%)'.replace(',', '.'); ws1['H9'].font = Font(name='Times New Roman', size=11, bold=True, color='15803D'); ws1['H9'].fill = fill_kpi_hl; ws1['H9'].alignment = Alignment(horizontal='center')

    for r in range(8, 10):
        for c in range(1, 13):
            ws1.cell(row=r, column=c).border = border_thin

    ws1.merge_cells('A11:L11')
    ws1['A11'] = 'I. DANH MỤC CÁC MẶT HÀNG ĐÃ HOÀN THÀNH THẨM ĐỊNH & CHỐT ĐƠN GIÁ'
    ws1['A11'].font = Font(name='Times New Roman', size=11, bold=True, color='003366')

    headers_s1 = [
        'STT', 'Mã Vật Tư', 'Tên Vật Tư', 'Quy Cách Kỹ Thuật', 'Hãng SX/Xuất Xứ', 'ĐVT', 'SL',
        'Đơn Giá Trình', 'Đơn Giá Thẩm Định', 'Thành Tiền Thẩm Định', 'Giá Trị Giảm',
        'Ý Kiến Đánh Giá Của Tổ Thẩm Định'
    ]
    for c_idx, h_text in enumerate(headers_s1, 1):
        c = ws1.cell(row=12, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws1.row_dimensions[12].height = 28

    cur_r = 13
    for idx, it in enumerate(appraised_items, 1):
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        dgtn = it.get('don_gia_thong_nhat', dgt)
        tttn = it.get('thanh_tien_thong_nhat', sl * dgtn)
        giam = it.get('gia_tri_giam', 0)
        eval_text = "Chi tiết xin xem sheet Hồ sơ chứng cứ & Hình ảnh"

        vals = [
            idx,
            it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'),
            sl, dgt, dgtn, tttn, giam, eval_text
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws1.cell(row=cur_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if c_idx in (7, 8, 9, 10, 11):
                c.number_format = '#,##0'
            if c_idx in (1, 6):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 12:
                c.font = Font(name='Times New Roman', size=10, italic=True, color='0055AA', underline='single')
                c.alignment = Alignment(horizontal='center', vertical='center')
                c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{4 + idx}"
            else:
                c.alignment = Alignment(horizontal='right', vertical='center')
            if c_idx == 11 and giam > 0:
                c.font = font_saving
        ws1.row_dimensions[cur_r].height = 28
        cur_r += 1

    # Summary row
    ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=9)
    ws1.cell(row=cur_r, column=1, value='TỔNG CỘNG CÁC MỤC ĐÃ CHỐT THẨM ĐỊNH:').font = font_bold_navy
    ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    sum_tttn_appraised = sum([it.get('thanh_tien_thong_nhat', 0) for it in appraised_items])
    sum_giam_appraised = sum([it.get('gia_tri_giam', 0) for it in appraised_items])
    ws1.cell(row=cur_r, column=10, value=sum_tttn_appraised).font = font_bold_navy
    ws1.cell(row=cur_r, column=10).number_format = '#,##0'
    ws1.cell(row=cur_r, column=10).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=11, value=sum_giam_appraised).font = font_saving
    ws1.cell(row=cur_r, column=11).number_format = '#,##0'
    ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
    for c_idx in range(1, 13):
        cell = ws1.cell(row=cur_r, column=c_idx)
        cell.border = border_thin
        cell.fill = fill_navy_light
    ws1.row_dimensions[cur_r].height = 24
    cur_r += 3

    # Signatures
    ws1.cell(row=cur_r, column=2, value='NGƯỜI LẬP BÁO CÁO / THƯ KÝ TỔ TTĐ').font = font_bold_navy
    ws1.cell(row=cur_r, column=10, value='TỔ TRƯỞNG TỔ THẨM ĐỊNH DỰ TOÁN').font = font_bold_navy
    ws1.cell(row=cur_r+1, column=2, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+1, column=10, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+6, column=2, value=creator).font = font_data_bold
    ws1.cell(row=cur_r+6, column=10, value='...................................................').font = font_data_bold

    for col_letter, w in [('A',6),('B',18),('C',30),('D',36),('E',20),('F',8),('G',8),('H',16),('I',16),('J',18),('K',16),('L',38)]:
        ws1.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 2: Danh Mục Chi Tiết
    # ========================================================================
    ws2 = wb.create_sheet(title='2. Danh Mục Chi Tiết')
    ws2.sheet_view.showGridLines = True
    ws2.freeze_panes = 'A5'

    ws2['A1'] = f'BẢNG THEO DÕI CHI TIẾT TIẾN ĐỘ & KẾT QUẢ THẨM ĐỊNH ({total_items} MỤC)'
    ws2['A1'].font = font_title_main
    ws2['A2'] = f'Hồ sơ: {dossier_name} | Cập nhật: {now_str}'
    ws2['A2'].font = font_sub

    headers_s2 = [
        'STT', 'Mã ERP', 'Tên Vật Tư', 'Quy Cách Kỹ Thuật', 'Hãng SX / Xuất Xứ', 'ĐVT', 'SL',
        'Đơn Giá Trình', 'Thành Tiền Trình', 'Đơn Giá Thẩm Định', 'Thành Tiền Thẩm Định',
        'Chênh Lệch Giảm', 'Trạng Thái', 'Căn Cứ Thẩm Định / Ghi Chú'
    ]
    for c_idx, h_text in enumerate(headers_s2, 1):
        c = ws2.cell(row=4, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws2.row_dimensions[4].height = 26

    r_idx = 5
    for idx, it in enumerate(items, 1):
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        tt_tr = it.get('thanh_tien_trinh', sl * dgt)
        dgtn = it.get('don_gia_thong_nhat', dgt)
        tt_tn = it.get('thanh_tien_thong_nhat', sl * dgtn)
        giam = it.get('gia_tri_giam', 0)
        is_done = (giam > 0) or (it.get('co_so_thong_nhat') and dgtn > 0 and idx <= 10)
        status_str = 'ĐÃ CHỐT' if is_done else 'Đang rà soát'
        cs_note = 'Chi tiết xem sheet Hồ sơ chứng cứ & Hình ảnh' if is_done else it.get('ghi_chu', '')

        vals = [
            idx, it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'), sl, dgt, tt_tr, dgtn, tt_tn, giam, status_str, cs_note
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws2.cell(row=r_idx, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if is_done:
                c.fill = fill_navy_light
            if c_idx in (7, 8, 9, 10, 11, 12):
                c.number_format = '#,##0'
            if c_idx in (1, 6, 13):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 14:
                if is_done:
                    c.font = Font(name='Times New Roman', size=10, italic=True, color='0055AA', underline='single')
                    c.alignment = Alignment(horizontal='center', vertical='center')
                    if it in appraised_items:
                        s3_row = 4 + (appraised_items.index(it) + 1)
                        c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{s3_row}"
                else:
                    c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            else:
                c.alignment = Alignment(horizontal='right', vertical='center')
            if c_idx == 12 and giam > 0:
                c.font = font_saving
            if c_idx == 13 and is_done:
                c.font = Font(name='Times New Roman', size=9, bold=True, color='15803D')
        ws2.row_dimensions[r_idx].height = 24
        r_idx += 1

    # Summary Row Sheet 2
    ws2.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=8)
    ws2.cell(row=r_idx, column=1, value=f'TỔNG CỘNG TOÀN BỘ {total_items} MỤC:').font = font_bold_navy
    ws2.cell(row=r_idx, column=1).alignment = Alignment(horizontal='right', vertical='center')
    ws2.cell(row=r_idx, column=9, value=sum_trinh).font = font_bold_navy
    ws2.cell(row=r_idx, column=9).number_format = '#,##0'
    ws2.cell(row=r_idx, column=11, value=sum_tn).font = font_bold_navy
    ws2.cell(row=r_idx, column=11).number_format = '#,##0'
    ws2.cell(row=r_idx, column=12, value=sum_giam).font = font_saving
    ws2.cell(row=r_idx, column=12).number_format = '#,##0'
    for c_idx in range(1, 15):
        c = ws2.cell(row=r_idx, column=c_idx)
        c.border = border_thin
        c.fill = fill_group_hdr
    ws2.row_dimensions[r_idx].height = 24

    for col_letter, w in [('A',6),('B',18),('C',28),('D',32),('E',18),('F',8),('G',8),('H',16),('I',18),('J',16),('K',18),('L',16),('M',14),('N',34)]:
        ws2.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 3: Hồ Sơ Chứng Cứ & Hình Ảnh
    # ========================================================================
    ws3 = wb.create_sheet(title='3. Hồ Sơ Chứng Cứ & Hình Ảnh')
    ws3.sheet_view.showGridLines = True
    ws3.freeze_panes = 'A5'

    ws3['A1'] = 'HỒ SƠ BẰNG CHỨNG & HÌNH ẢNH TRA CỨU ĐỐI SOÁT CỦA TỔ THẨM ĐỊNH'
    ws3['A1'].font = font_title_main
    ws3['A2'] = 'Trích xuất chi tiết hồ sơ chứng cứ, hóa đơn, hợp đồng ERP và hình ảnh đối soát thị trường cho các mục chốt giá'
    ws3['A2'].font = font_sub

    headers_s3 = [
        'STT', 'Mã ERP / Thiết Bị', 'Tên Vật Tư & Quy Cách', 'Hình Ảnh Chứng Cứ (Báo Giá / ERP / Web)',
        'Liên Kết Nguồn Tra Cứu (Hyperlink)', 'Cơ Sở 1: Báo Giá Gốc', 'Cơ Sở 2: ERP Vĩnh Tân 4',
        'Cơ Sở 3: EVN IMIS', 'Cơ Sở 4: Mua Sắm Công (e-GP)', 'Cơ Sở 5: Thị Trường & Tham Khảo',
        'Kết Luận Đơn Giá Chốt'
    ]
    for c_idx, h_text in enumerate(headers_s3, 1):
        c = ws3.cell(row=4, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws3.row_dimensions[4].height = 28

    cur_s3_r = 5
    for idx, it in enumerate(appraised_items, 1):
        iid = it.get('id')
        item_files_dir = os.path.join(proj_files_dir, f'item_{iid}') if proj_files_dir else None

        img_path = None
        if item_files_dir and os.path.exists(item_files_dir):
            for fn in sorted(os.listdir(item_files_dir)):
                if fn.lower().startswith('clip_') and fn.lower().endswith(('.png', '.jpg')):
                    fp = os.path.join(item_files_dir, fn)
                    if os.path.getsize(fp) > 500:
                        img_path = fp
                        break

        web_url = None
        if item_files_dir:
            ecom_json_path = os.path.join(item_files_dir, 'chung_cu_ecom.json')
            if os.path.exists(ecom_json_path):
                try:
                    with open(ecom_json_path, 'r', encoding='utf-8') as ef:
                        edata = json.load(ef)
                        web_url = edata.get('selected_record', {}).get('url')
                except Exception:
                    pass

        def read_basis_text(fname, ifd=item_files_dir):
            if not ifd:
                return '—'
            fp = os.path.join(ifd, fname)
            if os.path.exists(fp):
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        bdata = json.load(f)
                        txt = bdata.get('summary_text') or bdata.get('summary') or ''
                        return _clean_ai_text(txt)[:220]
                except Exception:
                    pass
            return '—'

        cs1_txt = read_basis_text('chung_cu_quotes.json')
        cs2_txt = read_basis_text('chung_cu_erp.json')
        cs3_txt = read_basis_text('chung_cu_imis.json')
        cs4_txt = read_basis_text('chung_cu_muasamcong.json')
        cs5_txt = read_basis_text('chung_cu_ecom.json')

        if cs1_txt == '—' and it.get('don_gia_trinh'):
            cs1_txt = f"Báo giá đề nghị nộp kèm: {it.get('don_gia_trinh'):,.0f} đ".replace(',', '.')

        name_str = f"{it.get('ten_vt_goc') or it.get('ten_vt')}\n({it.get('thong_so_kt') or it.get('part_no') or ''})"
        dgtn = it.get('don_gia_thong_nhat', 0)
        giam = it.get('gia_tri_giam', 0)
        ket_luan = f"Đơn giá chốt: {dgtn:,.0f} đ\n(Tiết kiệm: {giam:,.0f} đ)".replace(',', '.')

        vals_s3 = [
            idx, it.get('ma_vt', ''), name_str,
            '' if img_path else '[Lưu trong hồ sơ PDF]',
            'Mở liên kết trực tuyến ↗' if web_url else '—',
            cs1_txt, cs2_txt, cs3_txt, cs4_txt, cs5_txt, ket_luan
        ]

        for c_idx, val in enumerate(vals_s3, 1):
            c = ws3.cell(row=cur_s3_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if c_idx in (1,):
                c.alignment = Alignment(horizontal='center', vertical='top')
            elif c_idx in (2,):
                c.alignment = Alignment(horizontal='center', vertical='top', wrap_text=True)
            elif c_idx == 4:
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx == 5 and web_url:
                c.font = font_link
                c.hyperlink = web_url
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx == 11:
                c.font = font_bold_navy
                c.alignment = Alignment(horizontal='center', vertical='top', wrap_text=True)
            else:
                c.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        if img_path:
            try:
                pil_img = PILImage.open(img_path)
                orig_w, orig_h = pil_img.size
                pil_img.close()
                th = 135
                tw = int(orig_w * (th / orig_h))
                if tw > 260:
                    tw = 260
                    th = int(orig_h * (tw / orig_w))
                img = OpenpyxlImage(img_path)
                img.width = tw
                img.height = th
                ws3.add_image(img, f'D{cur_s3_r}')
                ws3.row_dimensions[cur_s3_r].height = 110
            except Exception:
                ws3.cell(row=cur_s3_r, column=4, value=f'[Ảnh {os.path.basename(img_path)}]')
                ws3.row_dimensions[cur_s3_r].height = 60
        else:
            ws3.row_dimensions[cur_s3_r].height = 60

        cur_s3_r += 1

    for col_letter, w in [('A',6),('B',18),('C',30),('D',36),('E',24),('F',32),('G',32),('H',30),('I',30),('J',32),('K',24)]:
        ws3.column_dimensions[col_letter].width = w

    # Save & Return
    export_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")
    wb.save(export_path)
    return send_file(export_path, as_attachment=True, download_name="Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")


@app.route("/api/download-template", methods=["GET"])
def api_download_template():
    """Xuất file Excel mẫu chuẩn 13 cột theo đúng quy định mua sắm của EVN Vĩnh Tân 4."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Mau_Du_Toan"

    # Font & Fills
    font_title = Font(name="Times New Roman", size=13, bold=True, color="003366")
    font_sub = Font(name="Times New Roman", size=10, italic=True, color="555555")
    font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
    fill_header = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='B0B0B0'),
        right=Side(style='thin', color='B0B0B0'),
        top=Side(style='thin', color='B0B0B0'),
        bottom=Side(style='thin', color='B0B0B0')
    )

    # Title Banner
    ws.append(["MẪU BẢNG DỰ TOÁN ĐỀ NGHỊ MUA SẮM & THẨM ĐỊNH GIÁ VẬT TƯ"])
    ws.cell(row=1, column=1).font = font_title
    ws.append(["(Điền danh mục theo đúng các cột dưới đây, sau đó dùng nút 'Nạp Excel Dự Toán' trên ứng dụng để nhập dữ liệu)"])
    ws.cell(row=2, column=1).font = font_sub
    ws.append([])

    # 13 CỘT CHUẨN THEO ĐÚNG YÊU CẦU:
    headers = [
        "STT", "PYCVT", "Tên vật tư", "Thông số kỹ thuật", "ĐVT",
        "Số lượng mua sắm", "HSX/XX", "Mã ERP", "Đơn giá min",
        "Thành tiền", "Thuế", "Tiền thuế", "Ghi chú"
    ]
    ws.append(headers)
    row_hdr = 4

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=row_hdr, column=col_idx)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = border_thin

    # Dữ liệu mẫu thực tế
    sample_data = [
        [1, "PYC 1234/VT4", "Module đầu vào input", "IUX 760 MI dùng cho hệ thống DCS Foxboro", "Cái", 4, "Foxboro / Pháp", "3.82.63.134.ENG.00.000", 13559000, "=F5*I5", 0.1, "=J5*K5", "Vật tư thay thế tủ điều khiển DCS"],
        [2, "PYC 1234/VT4", "Mặt công tắc", "Dùng cho 2 thiết bị - Model 6802", "Cái", 5, "Sino / Việt Nam", "3.34.40.292.VIE.00.000", 45000, "=F6*I6", 0.1, "=J6*K6", "Vật tư điện chiếu sáng hạ thế"],
        [3, "PYC 1234/VT4", "Hạt công tắc", "Hạt công tắc 1 chiều 16A", "Cái", 10, "Sino / Việt Nam", "3.34.40.291.VIE.00.000", 18000, "=F7*I7", 0.1, "=J7*K7", "Thiết bị đóng cắt"],
    ]

    font_data = Font(name="Times New Roman", size=10)
    for row_idx, r_vals in enumerate(sample_data, start=5):
        ws.append(r_vals)
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = font_data
            c.border = border_thin
            if col_idx in (1, 2, 5):
                c.alignment = Alignment(horizontal="center", vertical="center")
            elif col_idx in (6, 9, 10, 12):
                c.alignment = Alignment(horizontal="right", vertical="center")
                c.number_format = '#,##0'
            elif col_idx == 11:
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.number_format = '0%'
            else:
                c.alignment = Alignment(horizontal="left", vertical="center")

    # Column Widths
    ws.column_dimensions['A'].width = 6
    ws.column_dimensions['B'].width = 16
    ws.column_dimensions['C'].width = 24
    ws.column_dimensions['D'].width = 38
    ws.column_dimensions['E'].width = 8
    ws.column_dimensions['F'].width = 16
    ws.column_dimensions['G'].width = 18
    ws.column_dimensions['H'].width = 24
    ws.column_dimensions['I'].width = 18
    ws.column_dimensions['J'].width = 18
    ws.column_dimensions['K'].width = 10
    ws.column_dimensions['L'].width = 16
    ws.column_dimensions['M'].width = 28

    template_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "Mau_Du_Toan_Tham_Dinh.xlsx")
    wb.save(template_path)
    return send_file(template_path, as_attachment=True, download_name="Mau_Du_Toan_Tham_Dinh.xlsx")


@app.route("/api/items/<int:item_id>/export-pdf", methods=["GET"])
@app.route("/api/export-pdf-item/<int:item_id>", methods=["GET"])
def api_export_item_pdf(item_id):
    dossier = load_dossier_data()
    items = dossier.get("items", [])
    target_item = None
    for item in items:
        if item.get("id") == item_id:
            target_item = item
            break
            
    if not target_item:
        if items and 0 <= item_id - 1 < len(items):
            target_item = items[item_id - 1]
        else:
            return jsonify({"error": f"Item {item_id} not found"}), 404
            
    raw_title = target_item.get('ten_vt', f'Muc_{item_id}')
    clean_title = re.sub(r'[\r\n]+', ' ', raw_title)
    safe_title = re.sub(r'[\\/*?:"<>|]', '_', clean_title)[:100].strip()
    pdf_filename = f"Báo Cáo Thẩm Định - {safe_title}.pdf"
    output_pdf_path = os.path.join(DATA_DIR, f"BaoCao_ThamDinh_Muc_{target_item.get('id', item_id):02d}.pdf")
    
    try:
        pdf_report_generator.generate_item_pdf(target_item, dossier, output_pdf_path)
        return send_file(output_pdf_path, as_attachment=True, download_name=pdf_filename)
    except Exception as e:
        return jsonify({"error": f"Failed to generate PDF: {str(e)}"}), 500


@app.route("/api/sync/onedrive-status", methods=["GET"])
def api_onedrive_status():
    """Lấy thông tin trạng thái kết nối và thời gian đồng bộ OneDrive gần nhất."""
    return jsonify(onedrive_sync.get_sync_status())


@app.route("/api/sync/onedrive-push", methods=["POST"])
def api_onedrive_push():
    """Chủ động đẩy toàn bộ dữ liệu hiện tại sang thư mục OneDrive Cache."""
    res = onedrive_sync.push_to_onedrive(force=True)
    return jsonify(res)



@app.route("/api/sync/onedrive-open", methods=["POST", "GET"])
def api_onedrive_open():
    """Mở nhanh thư mục OneDrive Cache trong File Explorer của Windows."""
    res = onedrive_sync.open_onedrive_folder()
    return jsonify(res)

# Thêm vào app.py
@app.route("/api/sync/onedrive-pull", methods=["POST"])
def api_onedrive_pull():
    """Chủ động kéo dữ liệu từ thư mục OneDrive Cache về app."""
    try:
        # Giả sử trong onedrive_sync.py bạn có hàm pull_from_onedrive() 
        # hoặc hàm copy file từ đường dẫn cache về DATA_DIR
        res = onedrive_sync.pull_from_onedrive() 
        
        # Sau khi kéo về, load lại dữ liệu mới để trả về cho giao diện nếu cần
        dossier_data = load_dossier_data()
        
        return jsonify({
            "success": True, 
            "message": "Đã đồng bộ và tải dữ liệu từ cache/OneDrive về thành công!",
            "dossier": dossier_data
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"Lỗi kéo dữ liệu: {str(e)}"}), 500

if __name__ == "__main__":

    print("=" * 70)
    print("ThamDinhDuToanApp - To Tham Dinh Du Toan NMND Vinh Tan 4")
    print("Dia chi: http://localhost:5555")
    print("=" * 70)
    app.run(host="0.0.0.0", port=5555, debug=False, threaded=True)
