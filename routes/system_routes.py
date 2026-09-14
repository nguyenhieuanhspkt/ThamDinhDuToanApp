# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - System Routes Blueprint
Quản lý trang chủ tĩnh, trạng thái hệ thống và đồng bộ OneDrive EVN Cache.
"""

import os
from flask import Blueprint, jsonify, send_from_directory
from storage import OneDriveAdapter

system_bp = Blueprint("system_bp", __name__)


@system_bp.route("/")
def index():
    """Phục vụ file index.html của Frontend React (Vite build)."""
    dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    if os.path.exists(os.path.join(dist_dir, "index.html")):
        return send_from_directory(dist_dir, "index.html")
    return jsonify({
        "app": "ThamDinhDuToanApp API Server",
        "status": "online",
        "message": "Frontend chưa build. Vui lòng chạy npm run build trong thư mục frontend.",
    })


@system_bp.route("/api/status", methods=["GET"])
def api_status():
    """Kiểm tra tình trạng sức khỏe của API Server."""
    return jsonify({
        "status": "online",
        "app": "ThamDinhDuToanApp",
        "architecture": "Layered Architecture (Models, Storage, Services, Routes)",
        "version": "2.0.0",
    })


@system_bp.route("/api/sync/onedrive-status", methods=["GET"])
def api_onedrive_status():
    """Lấy thông tin trạng thái kết nối và thời gian đồng bộ OneDrive gần nhất."""
    return jsonify(OneDriveAdapter.get_status())


@system_bp.route("/api/sync/onedrive-push", methods=["POST"])
def api_onedrive_push():
    """Chủ động đẩy toàn bộ dữ liệu hiện tại sang thư mục OneDrive Cache."""
    res = OneDriveAdapter.push(force=True)
    return jsonify(res)


@system_bp.route("/api/sync/onedrive-open", methods=["POST", "GET"])
def api_onedrive_open():
    """Mở nhanh thư mục OneDrive Cache trong File Explorer của Windows."""
    res = OneDriveAdapter.open_folder()
    return jsonify(res)


@system_bp.route("/api/sync/onedrive-pull", methods=["POST"])
def api_onedrive_pull():
    """Chủ động kéo dữ liệu từ thư mục OneDrive Cache về app."""
    try:
        res = OneDriveAdapter.pull()
        return jsonify(res)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
