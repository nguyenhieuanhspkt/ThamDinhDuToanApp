# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Ecom Evidence Model (Cơ sở 5: TMĐT & Giá Web)
"""

from typing import Any, Dict, List, Optional
from models.base import BaseEvidenceModel


class EcomEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả tra cứu Thương mại điện tử & Web."""

    def __init__(
        self,
        keyword: str = "",
        records: Optional[List[Dict[str, Any]]] = None,
        note: str = "",
        item_id: Optional[int] = None,
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
        self.keyword: str = str(keyword or "")
        self.records: List[Dict[str, Any]] = list(records) if records is not None else []
        self.note: str = str(note or "")
