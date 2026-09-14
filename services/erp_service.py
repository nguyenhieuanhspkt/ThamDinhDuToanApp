# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - ERP Service
Dịch vụ tra cứu CSDL lịch sử mua sắm ERP Vĩnh Tân 4 (Cơ sở 2).
"""

import os
from typing import Any, Dict, Optional, Union
from models import DossierItem, ErpEvidence
import imis_core


class ErpService:
    """Dịch vụ nghiệp vụ tra cứu và quản trị CSDL ERP Vĩnh Tân 4."""

    @staticmethod
    def get_config_status() -> Dict[str, Any]:
        """Lấy thông tin kiểm tra trạng thái CSDL ERP."""
        return imis_core.get_erp_config_status()

    @staticmethod
    def preview_columns(file_path: str = "") -> Dict[str, Any]:
        """Đọc tiêu đề các cột của file Excel ERP để gửi về UI cấu hình mapping."""
        clean_path = (file_path or "").strip()
        if not clean_path:
            return {"success": False, "message": "Đường dẫn file trống."}
        return imis_core.get_excel_headers(clean_path)

    @staticmethod
    def upload_file(file_storage, target_dir: str = "") -> Dict[str, Any]:
        """
        Tải lên file Excel CSDL ERP mới, lưu vào thư mục config và đọc trước tiêu đề cột.
        """
        if not file_storage or not getattr(file_storage, "filename", ""):
            return {"success": False, "message": "Không tìm thấy file tải lên."}

        filename = file_storage.filename
        if not filename.lower().endswith((".xlsx", ".xls")):
            return {"success": False, "message": "Chỉ chấp nhận file Excel (.xlsx, .xls)"}

        if not target_dir:
            target_dir = os.path.join(imis_core.BASE_DIR, "data", "config")
        os.makedirs(target_dir, exist_ok=True)

        dest_path = os.path.join(target_dir, "ERP_uploaded.xlsx")
        file_storage.save(dest_path)

        res = imis_core.get_excel_headers(dest_path)
        res["uploaded_path"] = dest_path
        return res

    @staticmethod
    def save_config(file_path: str, mapping: Dict[str, str], header_row: int = 1) -> Dict[str, Any]:
        """
        Lưu cấu hình vị trí file Excel ERP và mapping 13 cột pháp lý, đồng thời làm mới CSDL ERP.
        """
        clean_path = (file_path or "").strip()
        if not clean_path or not os.path.exists(clean_path):
            return {"success": False, "message": f"Không tìm thấy file Excel: {clean_path}"}

        records = imis_core.save_erp_mapping_config(clean_path, mapping or {}, header_row=header_row)
        return {
            "success": True,
            "message": f"Đã nạp thành công CSDL ERP với {len(records)} bản ghi hợp đồng!",
            "count": len(records),
        }

    @staticmethod
    def search(
        keyword: str = "",
        ma_vt: str = "",
        item: Optional[Union[DossierItem, Dict[str, Any]]] = None,
        selected_record: Optional[Union[Dict[str, Any], str]] = None,
        use_average: bool = False,
        min_score: int = 60,
    ) -> ErpEvidence:
        """
        Tra cứu lịch sử ERP theo mã VT hoặc từ khóa, sinh bài thuyết minh tương ứng.
        Trả về thực thể ErpEvidence chuẩn hóa.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item or {})
        item_id = item_dict.get("id")
        dg_trinh = float(item_dict.get("don_gia_trinh") or 0.0)

        search_kw = ma_vt if ma_vt else keyword
        if search_kw.strip().lower().startswith("chưa") or search_kw.strip().lower() in (
            "chưa có mã vật tư",
            "n/a",
            "none",
        ):
            search_kw = (item_dict.get("ten_vt_goc") or item_dict.get("ten_vt") or "").split("\n")[0].split("-")[0].strip()

        # 1. Tra cứu baseline ERP
        results = imis_core.search_erp_baseline(search_kw, ma_vt=ma_vt, min_score=min_score)
        if not results and search_kw:
            clean_kw = search_kw.split("\n")[0].split("-")[0].strip()
            results = imis_core.search_erp_baseline(clean_kw, min_score=40)

        cfg = imis_core.load_erp_mapping_config()
        mapping = cfg.get("mapping", {})

        # 2. Xử lý trường hợp HỦY CHỌN (NONE)
        if selected_record == "NONE":
            evidence = ErpEvidence(
                item_id=item_id,
                results=results,
                mapping=mapping,
                keyword=keyword,
                used_keyword=search_kw,
                selected_record="NONE",
                is_deselected=True,
            )
            evidence.deselect()
            return evidence

        # 3. Sinh thuyết minh
        is_avg = use_average or selected_record == "AVERAGE"
        summary_data = imis_core.generate_erp_summary_text(
            item_dict,
            results,
            dg_trinh=dg_trinh,
            selected_record=selected_record,
            use_average=is_avg,
        )

        return ErpEvidence(
            item_id=item_id,
            results=results,
            mapping=mapping,
            keyword=keyword,
            used_keyword=search_kw,
            summary=summary_data,
            summary_text=summary_data.get("summary_text", ""),
            selected_record=selected_record,
            use_average=is_avg,
            is_deselected=False,
        )
