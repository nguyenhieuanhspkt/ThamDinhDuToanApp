# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - MSC Evidence Model (Cơ sở 4: Mua Sắm Công e-GP)
"""

from typing import Any, Dict, List, Optional
from models.base import BaseEvidenceModel


class MscEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả tra cứu Mạng Đấu thầu Quốc gia (e-GP)."""

    def __init__(
        self,
        item_id: Optional[int] = None,
        tu_khoa_tra_cuu: str = "",
        thoi_gian_tra_cuu: Optional[str] = None,
        nguon: str = "Mua Sắm Công e-GP",
        don_gia_trinh: float = 0.0,
        don_gia_tham_chieu: float = 0.0,
        chenh_lech_so_tien: float = 0.0,
        chenh_lech_phan_tram: float = 0.0,
        danh_sach_ket_qua: Optional[List[Dict[str, Any]]] = None,
        page_number: int = 1,
        page_size: int = 10,
        total_elements: int = 0,
        selected_index: Optional[int] = None,
        selected_record: Optional[Dict[str, Any]] = None,
        don_gia_truoc_thue: Optional[float] = None,
        don_gia_goc_egp: Optional[float] = None,
        is_deselected: bool = False,
        summary_text: str = "",
        thoi_gian_luu: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(
            item_id=item_id,
            summary_text=summary_text,
            thoi_gian_luu=thoi_gian_luu,
            **kwargs,
        )
        self.tu_khoa_tra_cuu: str = str(tu_khoa_tra_cuu or "")
        self.thoi_gian_tra_cuu: Optional[str] = thoi_gian_tra_cuu
        self.nguon: str = str(nguon or "Mua Sắm Công e-GP")
        self.don_gia_trinh: float = float(don_gia_trinh or 0.0)
        self.don_gia_tham_chieu: float = float(don_gia_tham_chieu or 0.0)
        self.chenh_lech_so_tien: float = float(chenh_lech_so_tien or 0.0)
        self.chenh_lech_phan_tram: float = float(chenh_lech_phan_tram or 0.0)
        self.danh_sach_ket_qua: List[Dict[str, Any]] = (
            list(danh_sach_ket_qua) if danh_sach_ket_qua is not None else []
        )
        self.page_number: int = int(page_number or 1)
        self.page_size: int = int(page_size or 10)
        self.total_elements: int = int(total_elements or len(self.danh_sach_ket_qua))
        self.selected_index: Optional[int] = (
            int(selected_index) if selected_index is not None else None
        )
        self.selected_record: Optional[Dict[str, Any]] = selected_record
        self.don_gia_truoc_thue: Optional[float] = (
            float(don_gia_truoc_thue) if don_gia_truoc_thue is not None else None
        )
        self.don_gia_goc_egp: Optional[float] = (
            float(don_gia_goc_egp) if don_gia_goc_egp is not None else None
        )
        self.is_deselected: bool = bool(is_deselected)

    def deselect(self) -> None:
        """Hủy chọn căn cứ Mua sắm công."""
        self.is_deselected = True
        self.selected_index = None
        self.selected_record = None
        self.don_gia_tham_chieu = 0.0
        self.don_gia_truoc_thue = None
        self.don_gia_goc_egp = None
        kw = self.tu_khoa_tra_cuu or "từ khóa"
        self.summary_text = (
            f"Đã tra cứu Cổng Mua Sắm Công e-GP theo từ khóa '{kw}', "
            "các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán "
            "nên thẩm định viên không áp dụng làm căn cứ thẩm định."
        )

    def select_index(self, index: int, vat_rate: float = 0.08) -> None:
        """Chọn kết quả theo chỉ mục trong danh_sach_ket_qua và quy đổi đơn giá trước thuế."""
        if 0 <= index < len(self.danh_sach_ket_qua):
            rec = self.danh_sach_ket_qua[index]
            self.is_deselected = False
            self.selected_index = index
            self.selected_record = rec
            raw_price = float(rec.get("don_gia") or rec.get("gia_trung_thau") or 0.0)
            self.don_gia_goc_egp = raw_price
            self.don_gia_truoc_thue = round(raw_price / (1.0 + vat_rate)) if raw_price > 0 else 0.0
            self.don_gia_tham_chieu = self.don_gia_truoc_thue
