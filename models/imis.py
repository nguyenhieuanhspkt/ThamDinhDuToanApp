# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - IMIS Evidence Model (Cơ sở 3: Hệ Thống Hợp Đồng EVN IMIS)
"""

from typing import Any, Dict, List, Optional, Union
from models.base import BaseEvidenceModel


class ImisEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả tra cứu Hợp đồng EVN IMIS toàn ngành."""

    def __init__(
        self,
        imis: Optional[List[Dict[str, Any]]] = None,
        erp: Optional[List[Dict[str, Any]]] = None,
        summary: Optional[Dict[str, Any]] = None,
        summary_text: str = "",
        keyword: str = "",
        used_keyword: str = "",
        selected_record: Optional[Union[Dict[str, Any], str]] = None,
        is_deselected: bool = False,
        item_id: Optional[int] = None,
        thoi_gian_luu: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(
            item_id=item_id,
            summary_text=summary_text,
            thoi_gian_luu=thoi_gian_luu,
            **kwargs,
        )
        self.imis: List[Dict[str, Any]] = list(imis) if imis is not None else []
        self.erp: List[Dict[str, Any]] = list(erp) if erp is not None else []
        self.summary: Dict[str, Any] = dict(summary) if summary is not None else {}
        self.keyword: str = str(keyword or "")
        self.used_keyword: str = str(used_keyword or "")
        self.selected_record: Optional[Union[Dict[str, Any], str]] = selected_record
        self.is_deselected: bool = bool(is_deselected)

    def deselect(self) -> None:
        """Hủy chọn căn cứ IMIS."""
        self.is_deselected = True
        self.selected_record = "NONE"
        kw = self.used_keyword or self.keyword or "từ khóa"
        self.summary_text = (
            f"Đã tra cứu CSDL EVN IMIS theo từ khóa '{kw}', "
            "các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán "
            "nên thẩm định viên không áp dụng làm căn cứ thẩm định."
        )

    def select_record(self, record: Dict[str, Any]) -> None:
        """Chọn 1 hợp đồng IMIS cụ thể."""
        self.is_deselected = False
        self.selected_record = record
