# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Synthesis Evidence Model (Cơ sở 6: Tổng Hợp & Phê Duyệt Giá)
"""

from typing import Any, Dict, Optional
from models.base import BaseEvidenceModel


class SynthesisEvidence(BaseEvidenceModel):
    """Thực thể quản lý kết quả Tổng hợp & Phê duyệt Thẩm định."""

    def __init__(
        self,
        item_id: Optional[int] = None,
        approved_price: Optional[float] = None,
        total_savings: float = 0.0,
        coverage_score: int = 0,
        price_score: int = 0,
        risk_flag: str = "NORMAL",
        used_ai: bool = False,
        summary_text: str = "",
        pillars: Optional[Dict[str, Any]] = None,
        co_so_thong_nhat: str = "",
        thoi_gian_luu: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(
            item_id=item_id,
            summary_text=summary_text,
            thoi_gian_luu=thoi_gian_luu,
            **kwargs,
        )
        self.approved_price: Optional[float] = (
            float(approved_price) if approved_price is not None and float(approved_price) > 0 else None
        )
        self.total_savings: float = float(total_savings or 0.0)
        self.coverage_score: int = int(coverage_score or 0)
        self.price_score: int = int(price_score or 0)
        self.risk_flag: str = str(risk_flag or "NORMAL")
        self.used_ai: bool = bool(used_ai)
        self.pillars: Dict[str, Any] = dict(pillars) if pillars is not None else {}
        self.co_so_thong_nhat: str = str(co_so_thong_nhat or "")

    def recalculate_savings(self, don_gia_trinh: float, so_luong: float) -> float:
        """
        Tính toán lại giá trị tiết kiệm chuẩn xác (Triệt tiêu lỗi tiết kiệm ảo):
        - Nếu chưa duyệt (approved_price is None hoặc <= 0): tiết kiệm = 0 đ.
        - Nếu đã duyệt: max(0, (dg_trinh - approved_price) * sl).
        """
        dg_trinh = float(don_gia_trinh or 0.0)
        sl = float(so_luong or 1.0)

        if self.approved_price is None or self.approved_price <= 0:
            self.total_savings = 0.0
        else:
            self.total_savings = max(0.0, (dg_trinh - self.approved_price) * sl)

        return self.total_savings

    def set_approved_price(
        self,
        price: Optional[float],
        co_so: str = "",
        don_gia_trinh: float = 0.0,
        so_luong: float = 1.0,
    ) -> None:
        """Cập nhật giá duyệt và tự động đồng bộ giá trị giảm."""
        if price is not None and float(price) > 0:
            self.approved_price = float(price)
        else:
            self.approved_price = None

        if co_so:
            self.co_so_thong_nhat = co_so

        self.recalculate_savings(don_gia_trinh, so_luong)
