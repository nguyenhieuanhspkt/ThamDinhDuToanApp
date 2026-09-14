# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Quote Matching Service
Dịch vụ bóc tách PDF báo giá và đối chiếu vật tư (Cơ sở 1).
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from models import DossierItem, QuotesEvidence, ProjectDossier
import quote_matcher


class QuoteService:
    """Dịch vụ nghiệp vụ đối chiếu và quản trị Báo giá gốc."""

    @staticmethod
    def match_item(
        item: Union[DossierItem, Dict[str, Any]],
        folder_path: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> QuotesEvidence:
        """
        Quét thư mục báo giá và ghép nối đơn giá cho vật tư dự toán.
        Trả về thực thể QuotesEvidence chuẩn hóa.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item)
        item_id = item_dict.get("id")

        # 1. Quét hoặc tải cache danh sách báo giá
        quotes_data = quote_matcher.scan_quotation_folder(
            folder_path=folder_path,
            overrides=overrides,
        )

        # 2. Đối chiếu
        res = quote_matcher.match_item_in_quotes(item_dict, quotes_data)

        # 3. Đóng gói vào Model QuotesEvidence
        res["item_id"] = item_id
        return QuotesEvidence.from_dict(res)

    @staticmethod
    def match_all_dossier_items(
        items: List[Union[DossierItem, Dict[str, Any]]],
        folder_path: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Tự động đối chiếu toàn bộ danh mục vật tư trong dự án với các file Báo giá gốc.
        """
        folder = folder_path or quote_matcher.DEFAULT_QUOTES_DIR
        scanned = quote_matcher.scan_quotation_folder(folder, overrides=overrides)

        results = {}
        for idx, item in enumerate(items):
            it_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item)
            item_id = it_dict.get("id", idx + 1)
            res = quote_matcher.match_item_in_quotes(it_dict, scanned)
            min_vendor = ""
            if res.get("matches"):
                min_vendor = res["matches"][0].get("vendor", "")
            results[str(item_id)] = {
                "has_quote": len(res.get("matches", [])) > 0,
                "match_count": len(res.get("matches", [])),
                "min_price": res.get("min_price", 0),
                "min_vendor": min_vendor,
                "matches": res.get("matches", []),
            }

        return {
            "success": True,
            "results": results,
            "folder": folder,
            "total_items": len(items),
        }

    @staticmethod
    def get_quotes_dossier(
        folder_path: Optional[str] = None,
        project_files_dir: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Lấy danh sách tất cả các file trong thư mục báo giá, phân loại và trạng thái phê duyệt.
        """
        folder = folder_path or quote_matcher.DEFAULT_QUOTES_DIR
        res = quote_matcher.scan_quotation_folder(folder, overrides=overrides)

        approved_data = None
        if project_files_dir:
            approved_file = os.path.join(project_files_dir, "bao_gia_project.json")
            if os.path.exists(approved_file):
                try:
                    with open(approved_file, "r", encoding="utf-8") as f:
                        approved_data = json.load(f)
                except Exception:
                    pass

        res["approved_data"] = approved_data
        res["is_approved"] = approved_data is not None
        return res

    @staticmethod
    def approve_all_quotes(
        folder_path: Optional[str] = None,
        project_files_dir: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
        approver: str = "Nguyễn Anh Hiếu - Tổ Thẩm định",
    ) -> Dict[str, Any]:
        """
        Phê duyệt bộ dữ liệu báo giá đã số hóa vào CSDL chính thức của dự án.
        """
        folder = folder_path or quote_matcher.DEFAULT_QUOTES_DIR
        res = quote_matcher.scan_quotation_folder(folder, overrides=overrides)

        save_payload = {
            "thoi_gian_duyet": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nguoi_duyet": approver,
            "folder_nguon": folder,
            "tong_so_nha_thau": len(res.get("quotes", [])),
            "tong_so_muc": sum(q.get("item_count", 0) for q in res.get("quotes", [])),
            "tong_gia_tri": sum(q.get("total_amount", 0) for q in res.get("quotes", [])),
            "danh_sach_bao_gia": res.get("quotes", []),
            "scans": res.get("scans", []),
            "docs": res.get("docs", []),
        }

        if project_files_dir:
            os.makedirs(project_files_dir, exist_ok=True)
            approved_file = os.path.join(project_files_dir, "bao_gia_project.json")
            with open(approved_file, "w", encoding="utf-8") as f:
                json.dump(save_payload, f, ensure_ascii=False, indent=2)

        return {
            "success": True,
            "message": "Đã phê duyệt toàn bộ báo giá vào dự án thành công!",
            "data": save_payload,
        }

    @staticmethod
    def browse_folders(base_path: Optional[str] = None) -> Dict[str, Any]:
        """Duyệt danh sách thư mục con để hiển thị cây thư mục trên UI."""
        clean_path = (base_path or "").strip() or "D:\\"
        if not os.path.exists(clean_path):
            clean_path = os.path.dirname(clean_path) if os.path.dirname(clean_path) else "C:\\"

        subdirs = []
        try:
            if os.path.isdir(clean_path):
                for entry in os.listdir(clean_path):
                    full_p = os.path.join(clean_path, entry)
                    if os.path.isdir(full_p) and not entry.startswith(".") and not entry.startswith("$"):
                        subdirs.append({"name": entry, "path": full_p})
        except Exception:
            pass

        parent_p = os.path.dirname(clean_path) if os.path.dirname(clean_path) != clean_path else None
        return {
            "success": True,
            "current_path": clean_path,
            "parent_path": parent_p,
            "subdirs": subdirs,
        }

    @staticmethod
    def native_browse_folder() -> Dict[str, Any]:
        """Mở cửa sổ Windows Explorer Native Folder Picker Dialog chuẩn của hệ điều hành."""
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            selected_dir = filedialog.askdirectory(title="Chọn thư mục chứa các file Báo Giá Gốc (PDF)")
            root.destroy()
            if selected_dir:
                norm_path = os.path.normpath(selected_dir)
                return {"success": True, "folder_path": norm_path}
            return {"success": False, "message": "Người dùng đã hủy chọn thư mục"}
        except Exception as e:
            return {"success": False, "message": f"Lỗi mở cửa sổ Windows: {str(e)}"}
