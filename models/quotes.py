# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Quotes Evidence Model (Cơ sở 1: Báo Giá Gốc PDF)
"""

from typing import Any, Dict, List, Optional
from models.base import BaseEvidenceModel


class QuotesEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả đối chiếu Báo giá gốc (PDF)."""

    def __init__(
        self,
        status: str = "success",
        is_min: bool = False,
        min_quote: Optional[Dict[str, Any]] = None,
        min_price: float = 0.0,
        matched_supplier: str = "",
        matches: Optional[List[Dict[str, Any]]] = None,
        summary_text: str = "",
        all_quotes_summary: Optional[List[Dict[str, Any]]] = None,
        thoi_gian_tra_cuu: Optional[str] = None,
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
        self.status: str = str(status or "success")
        self.is_min: bool = bool(is_min)
        self.min_quote: Optional[Dict[str, Any]] = min_quote
        self.min_price: float = float(min_price or 0.0)
        self.matched_supplier: str = str(matched_supplier or "")
        self.matches: List[Dict[str, Any]] = list(matches) if matches is not None else []
        self.all_quotes_summary: List[Dict[str, Any]] = (
            list(all_quotes_summary) if all_quotes_summary is not None else []
        )
        self.thoi_gian_tra_cuu: Optional[str] = thoi_gian_tra_cuu

    @property
    def has_quotes(self) -> bool:
        """Kiểm tra có báo giá phù hợp hay không."""
        return self.min_price > 0 or len(self.matches) > 0
