# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - MSC Service
Dịch vụ tra cứu Mua Sắm Công e-GP (Cơ sở 4).
"""

from typing import Any, Dict, Optional, Union
from models import DossierItem, MscEvidence
import msc_matcher


class MscService:
    """Dịch vụ nghiệp vụ tra cứu Cổng Mua Sắm Công e-GP."""

    @staticmethod
    def search(
        keyword: str,
        item: Optional[Union[DossierItem, Dict[str, Any]]] = None,
        page_number: int = 0,
        page_size: int = 20,
    ) -> MscEvidence:
        """
        Tra cứu Mua sắm công theo từ khóa, quy đổi trước thuế và trả về MscEvidence.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item or {})
        item_id = item_dict.get("id")

        # 1. Gọi tra cứu qua msc_matcher
        raw_res = msc_matcher.search_muasamcong(keyword, page_number=page_number, page_size=page_size)
        if not raw_res.get("success"):
            return MscEvidence(
                item_id=item_id,
                tu_khoa_tra_cuu=keyword,
                danh_sach_ket_qua=[],
                summary_text=raw_res.get("message", "Tra cứu e-GP không thành công"),
            )

        # 2. Phân tích đối chiếu
        comp = msc_matcher.analyze_msc_comparison(item_dict, raw_res)
        raw_min = comp.get("don_gia_goc_egp", comp.get("min_price", 0))
        pre_tax_min = comp.get("don_gia_truoc_thue", comp.get("min_price", 0))

        items_list = comp.get("items", [])
        selected_rec = comp.get("selected_record") or (items_list[0] if items_list else None)

        return MscEvidence(
            item_id=item_id,
            tu_khoa_tra_cuu=keyword,
            page_number=page_number,
            page_size=page_size,
            selected_index=0 if items_list else None,
            total_elements=comp.get("total", len(items_list)),
            nguon="Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn)",
            don_gia_trinh=float(item_dict.get("don_gia_trinh") or 0.0),
            don_gia_tham_chieu=float(pre_tax_min or 0.0),
            don_gia_truoc_thue=float(pre_tax_min or 0.0),
            don_gia_goc_egp=float(raw_min or 0.0),
            selected_record=selected_rec,
            chenh_lech_so_tien=float(comp.get("diff_amt") or 0.0),
            chenh_lech_phan_tram=float(comp.get("diff_pct") or 0.0),
            danh_sach_ket_qua=items_list,
        )
