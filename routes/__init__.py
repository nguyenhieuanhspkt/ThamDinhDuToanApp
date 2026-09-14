# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Routes Package
Tập hợp và đăng ký toàn bộ Flask Blueprints vào ứng dụng.
"""

from flask import Flask
from api_export_executive_report import executive_bp
from routes.dossier_routes import dossier_bp
from routes.evidence_routes import evidence_bp
from routes.pillar_routes import pillar_bp
from routes.pipeline_routes import pipeline_bp
from routes.system_routes import system_bp


def register_all_routes(app: Flask) -> None:
    """Đăng ký toàn bộ các Blueprint theo nhóm chức năng vào Flask app."""
    app.register_blueprint(system_bp)
    app.register_blueprint(dossier_bp)
    app.register_blueprint(evidence_bp)
    app.register_blueprint(pillar_bp)
    app.register_blueprint(pipeline_bp)
    app.register_blueprint(executive_bp)


__all__ = [
    "register_all_routes",
    "system_bp",
    "dossier_bp",
    "evidence_bp",
    "pillar_bp",
    "pipeline_bp",
]
