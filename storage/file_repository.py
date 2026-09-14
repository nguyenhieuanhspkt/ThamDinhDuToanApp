# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - File Repository
Quản lý tập trung toàn bộ đường dẫn dữ liệu, dự án active,
cơ chế fallback 2 tầng và truy xuất chứng cứ kết hợp tầng models.
"""

import json
import os
from typing import Any, Dict, List, Optional, Union

from models import (
    BaseEvidenceModel,
    DossierItem,
    ProjectDossier,
    get_evidence_model_cls,
    load_evidence_file,
    save_evidence_file,
)
from storage.atomic_writer import read_json_safe, write_json_atomic


class FileRepository:
    """Kho lưu trữ tệp quản lý CSDL hồ sơ và chứng cứ thẩm định."""

    def __init__(self, base_dir: Optional[str] = None):
        if base_dir:
            self.base_dir = os.path.abspath(base_dir)
        else:
            # Mặc định lấy thư mục gốc của dự án
            self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        self.data_dir = os.path.join(self.base_dir, "data")
        self.projects_dir = os.path.join(self.data_dir, "projects")
        self.active_project_file = os.path.join(self.data_dir, "active_project.json")
        self.current_dossier_file = os.path.join(self.data_dir, "current_dossier.json")
        self.current_dossier_files = os.path.join(self.data_dir, "current_dossier_files")

    def get_active_project_id(self) -> Optional[str]:
        """Lấy tên file dự án đang kích hoạt (VD: 'ThamDinhDot8_lân2.json')."""
        if os.path.exists(self.active_project_file):
            try:
                data = read_json_safe(self.active_project_file)
                return data.get("active_id")
            except Exception:
                return None
        return None

    def set_active_project_id(self, project_id: str) -> bool:
        """Thiết lập dự án active."""
        if not project_id.endswith(".json"):
            project_id = f"{project_id}.json"
        return write_json_atomic(self.active_project_file, {"active_id": project_id})

    def get_project_files_dir(self) -> str:
        """Lấy thư mục chứng cứ của dự án đang active (fallback sang current_dossier_files)."""
        active_id = self.get_active_project_id()
        if active_id:
            proj_name = active_id.replace(".json", "")
            cand = os.path.join(self.projects_dir, f"{proj_name}_files")
            if os.path.exists(cand):
                return cand
            # Nếu chưa tồn tại nhưng có active_id thì tự tạo
            os.makedirs(cand, exist_ok=True)
            return cand

        # Fallback
        os.makedirs(self.current_dossier_files, exist_ok=True)
        return self.current_dossier_files

    def get_item_dir(self, item_id: int) -> str:
        """Lấy thư mục chứa các file chứng cứ của 1 mục vật tư cụ thể."""
        p_dir = self.get_project_files_dir()
        item_dir = os.path.join(p_dir, f"item_{item_id}")
        os.makedirs(item_dir, exist_ok=True)
        return item_dir

    def resolve_evidence_file(self, item_id: int, step_type: str) -> Optional[str]:
        """
        Tìm kiếm đường dẫn file chứng cứ theo cơ chế 2 tầng:
        Tầng 1: Thư mục của dự án đang active.
        Tầng 2: Fallback sang thư mục chung cũ (current_dossier_files).
        """
        # Chuẩn hóa tên bước
        norm_step = step_type.lower().strip()
        if norm_step == "msc":
            norm_step = "muasamcong"

        fname = f"chung_cu_{norm_step}.json"

        # Tầng 1: Project active
        p_dir = self.get_project_files_dir()
        f1 = os.path.join(p_dir, f"item_{item_id}", fname)
        if os.path.exists(f1):
            return f1

        # Tầng 2: Fallback
        f2 = os.path.join(self.current_dossier_files, f"item_{item_id}", fname)
        if os.path.exists(f2):
            return f2

        return None

    def load_item_evidence(self, item_id: int, step_type: str) -> BaseEvidenceModel:
        """Nạp chứng cứ của 1 mục vật tư thành Model tương ứng."""
        fpath = self.resolve_evidence_file(item_id, step_type)
        if fpath and os.path.exists(fpath):
            return load_evidence_file(fpath)

        # Nếu chưa có file trên đĩa, khởi tạo Model rỗng chuẩn với item_id
        cls = get_evidence_model_cls(step_type)
        return cls(item_id=item_id)

    def save_item_evidence(
        self,
        item_id: int,
        step_type: str,
        evidence: Union[BaseEvidenceModel, Dict[str, Any]],
    ) -> bool:
        """Lưu chứng cứ an toàn vào thư mục của dự án đang active."""
        item_dir = self.get_item_dir(item_id)
        norm_step = step_type.lower().strip()
        if norm_step == "msc":
            norm_step = "muasamcong"

        fpath = os.path.join(item_dir, f"chung_cu_{norm_step}.json")

        if isinstance(evidence, BaseEvidenceModel):
            return save_evidence_file(evidence, fpath)
        elif isinstance(evidence, dict):
            # Nạp qua Model để tự động validate và bổ sung trường
            cls = get_evidence_model_cls(norm_step)
            model = cls.from_dict(evidence)
            if model.item_id is None:
                model.item_id = item_id
            return save_evidence_file(model, fpath)
        else:
            raise TypeError(f"Dữ liệu chứng cứ không hợp lệ: {type(evidence)}")

    def load_dossier(self, custom_path: Optional[str] = None) -> ProjectDossier:
        """Nạp hồ sơ dự án (ProjectDossier)."""
        target = custom_path or self.current_dossier_file
        if not os.path.exists(target):
            return ProjectDossier()
        return ProjectDossier.from_file(target)

    def save_dossier(self, dossier: ProjectDossier, custom_path: Optional[str] = None) -> bool:
        """Lưu hồ sơ dự án an toàn xuống đĩa."""
        target = custom_path or self.current_dossier_file
        res = dossier.save_to_file(target)

        # Nếu đang active dự án thì đồng bộ cả vào file dự án tương ứng
        active_id = self.get_active_project_id()
        if active_id and not custom_path:
            proj_file = os.path.join(self.projects_dir, active_id)
            try:
                dossier.save_to_file(proj_file)
            except Exception:
                pass

        return res
