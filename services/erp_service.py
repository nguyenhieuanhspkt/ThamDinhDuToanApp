# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - ERP Service
Dịch vụ tra cứu CSDL lịch sử mua sắm ERP Vĩnh Tân 4 (Cơ sở 2).
"""

from typing import Any, Dict, Optional, Union
from models import DossierItem, ErpEvidence
import imis_core


class ErpService:
    """Dịch vụ nghiệp vụ tra cứu CSDL ERP Vĩnh Tân 4."""

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
