# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - IMIS Service
Dịch vụ tra cứu hợp đồng toàn ngành EVN IMIS (Cơ sở 3).
"""

from typing import Any, Dict, Optional, Union
from models import DossierItem, ImisEvidence
import imis_core


class ImisService:
    """Dịch vụ nghiệp vụ tra cứu Hợp đồng EVN IMIS."""

    @staticmethod
    def search(
        keyword: str,
        item: Optional[Union[DossierItem, Dict[str, Any]]] = None,
        tu_ngay: str = "2023-01-01",
        den_ngay: Optional[str] = None,
        ma_vt: str = "",
        selected_record: Optional[Union[Dict[str, Any], str]] = None,
        use_average: bool = False,
        is_deselected: bool = False,
    ) -> ImisEvidence:
        """
        Tra cứu hợp đồng IMIS qua Live API và sinh bài thuyết minh tương ứng.
        Trả về thực thể ImisEvidence chuẩn hóa.
        """
        kw = str(keyword or "").strip()
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item or {})
        item_id = item_dict.get("id")
        dg_trinh = float(item_dict.get("don_gia_trinh") or 0.0)

        if not kw:
            return ImisEvidence(item_id=item_id, keyword="")

        # 1. Xử lý trường hợp HỦY CHỌN
        if is_deselected or selected_record == "NONE":
            evidence = ImisEvidence(
                item_id=item_id,
                keyword=kw,
                used_keyword=kw,
                selected_record="NONE",
                is_deselected=True,
            )
            evidence.deselect()
            return evidence

        # 2. Tra cứu nguồn dữ liệu
        result = imis_core.search_item_sources(kw, tu_ngay=tu_ngay, den_ngay=den_ngay, ma_vt=ma_vt)
        imis_recs = result.get("imis", [])
        erp_recs = result.get("erp", [])
        used_kw = result.get("used_keyword") or kw

        # 3. Sinh bài thuyết minh IMIS
        summary_data = imis_core.generate_imis_summary_text(
            item_dict,
            imis_recs,
            dg_trinh=dg_trinh,
            selected_record=selected_record,
            use_average=use_average,
            tu_ngay=tu_ngay,
            den_ngay=den_ngay,
            search_keyword=used_kw,
        )

        return ImisEvidence(
            item_id=item_id,
            imis=imis_recs,
            erp=erp_recs,
            summary=summary_data,
            summary_text=summary_data.get("summary_text", ""),
            keyword=kw,
            used_keyword=used_kw,
            selected_record=selected_record,
            is_deselected=False,
        )
