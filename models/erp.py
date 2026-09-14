# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - ERP Evidence Model (Cơ sở 2: CSDL Kế toán ERP NMNĐ Vĩnh Tân 4)
"""

from typing import Any, Dict, List, Optional, Union
from models.base import BaseEvidenceModel


class ErpEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả tra cứu ERP Vĩnh Tân 4."""

    def __init__(
        self,
        results: Optional[List[Dict[str, Any]]] = None,
        summary: Optional[Dict[str, Any]] = None,
        summary_text: str = "",
        keyword: str = "",
        used_keyword: str = "",
        mapping: Optional[Dict[str, Any]] = None,
        selected_record: Optional[Union[Dict[str, Any], str]] = None,
        use_average: bool = False,
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
        self.results: List[Dict[str, Any]] = list(results) if results is not None else []
        self.summary: Dict[str, Any] = dict(summary) if summary is not None else {}
        self.keyword: str = str(keyword or "")
        self.used_keyword: str = str(used_keyword or "")
        self.mapping: Dict[str, Any] = dict(mapping) if mapping is not None else {}
        self.selected_record: Optional[Union[Dict[str, Any], str]] = selected_record
        self.use_average: bool = bool(use_average)
        self.is_deselected: bool = bool(is_deselected)

    def deselect(self) -> None:
        """Hủy chọn căn cứ ERP."""
        self.is_deselected = True
        self.selected_record = "NONE"
        kw = self.used_keyword or self.keyword or "từ khóa"
        self.summary_text = (
            f"Đã tra cứu CSDL ERP Vĩnh Tân 4 theo từ khóa '{kw}', "
            "các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán "
            "nên thẩm định viên không áp dụng làm căn cứ thẩm định."
        )

    def select_record(self, record: Dict[str, Any]) -> None:
        """Chọn 1 hợp đồng ERP cụ thể."""
        self.is_deselected = False
        self.use_average = False
        self.selected_record = record

    def select_average(self) -> None:
        """Chọn phương án Đơn giá trung bình (AVG)."""
        self.is_deselected = False
        self.use_average = True
        self.selected_record = "AVERAGE"
