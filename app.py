# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Main Application Entrypoint
Kiến trúc Phân tầng (Layered Architecture):
Entrypoint tinh gọn điều phối Flask App và kết nối các Blueprints.
"""

import os
from flask import Flask
from flask_cors import CORS

from models import ProjectDossier
from routes import register_all_routes
from storage import default_repo

# Tương thích ngược với các module phụ trợ
DATA_DIR = default_repo.data_dir
PROJECTS_DIR = default_repo.projects_dir
ACTIVE_PROJECT_FILE = default_repo.active_project_file


def load_dossier_data() -> dict:
    """Tương thích ngược: nạp dữ liệu dossier dạng dict."""
    return default_repo.load_dossier().to_dict()


def save_dossier_data(data: dict) -> bool:
    """Tương thích ngược: lưu dữ liệu dossier từ dict."""
    dossier = ProjectDossier.from_dict(data)
    return default_repo.save_dossier(dossier)


def _get_active_project_files_dir() -> str:
    """Tương thích ngược: lấy thư mục files của dự án active."""
    return default_repo.get_project_files_dir()


def create_app() -> Flask:
    """Khởi tạo và cấu hình Flask Application."""
    flask_app = Flask(
        __name__,
        static_folder="frontend/dist",
        static_url_path="",
    )
    flask_app.config["JSON_AS_ASCII"] = False
    CORS(flask_app)

    # Đăng ký toàn bộ Blueprints (system, dossier, evidence, pillar, pipeline, executive)
    register_all_routes(flask_app)

    return flask_app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5555))
    print("=" * 60)
    print(" ThamDinhDuToanApp v2.0 (Clean & Layered Architecture)")
    print(f" -> Đang chạy tại: http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=True)
