# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Dossier Item Model (Thực Thể 1 Dòng Vật Tư Thẩm Định)
"""

from typing import Any, Optional
from models.base import BaseEntity


class DossierItem(BaseEntity):
    """Thực thể đại diện cho 1 dòng vật tư trong danh mục hồ sơ thẩm định."""

    def __init__(
        self,
        id: Optional[int] = None,
        stt: Optional[int] = None,
        ma_vt: str = "",
        ten_vt: str = "",
        ten_vt_goc: str = "",
        dvt: str = "",
        so_luong: float = 1.0,
        don_gia_trinh: float = 0.0,
        thanh_tien_trinh: float = 0.0,
        don_gia_thong_nhat: float = 0.0,
        thanh_tien_thong_nhat: float = 0.0,
        gia_tri_giam: float = 0.0,
        co_so_thong_nhat: str = "",
        danh_gia_ttd: str = "",
        hsx_xx: str = "",
        part_no: str = "",
        thong_so_kt: str = "",
        ghi_chu: str = "",
        phan_bien_khvt: str = "",
        pycvt: str = "",
        search_keyword: str = "",
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.id: int = int(id) if id is not None else 0
        self.stt: Optional[int] = int(stt) if stt is not None else None
        self.ma_vt: str = str(ma_vt or "").strip()
        self.ten_vt: str = str(ten_vt or "").strip()
        self.ten_vt_goc: str = str(ten_vt_goc or "").strip()
        self.dvt: str = str(dvt or "").strip()
        self.so_luong: float = float(so_luong or 1.0)
        self.don_gia_trinh: float = float(don_gia_trinh or 0.0)
        self.thanh_tien_trinh: float = float(thanh_tien_trinh or (self.don_gia_trinh * self.so_luong))
        self.don_gia_thong_nhat: float = float(don_gia_thong_nhat or 0.0)
        self.thanh_tien_thong_nhat: float = float(thanh_tien_thong_nhat or 0.0)
        self.gia_tri_giam: float = float(gia_tri_giam or 0.0)
        self.co_so_thong_nhat: str = str(co_so_thong_nhat or "")
        self.danh_gia_ttd: str = str(danh_gia_ttd or "")
        self.hsx_xx: str = str(hsx_xx or "")
        self.part_no: str = str(part_no or "")
        self.thong_so_kt: str = str(thong_so_kt or "")
        self.ghi_chu: str = str(ghi_chu or "")
        self.phan_bien_khvt: str = str(phan_bien_khvt or "")
        self.pycvt: str = str(pycvt or "")
        self.search_keyword: str = str(search_keyword or "")
        self._extra_fields = kwargs

        # Luôn tự động tính toán lại thành tiền và giá trị giảm chuẩn xác
        self.recalculate_totals()

    @property
    def has_approved_price(self) -> bool:
        """Kiểm tra vật tư đã được chốt đơn giá duyệt hay chưa."""
        return self.don_gia_thong_nhat > 0

    def recalculate_totals(self) -> None:
        """
        Tính toán lại toàn bộ thành tiền và giá trị giảm:
        - thanh_tien_trinh = don_gia_trinh * so_luong
        - Nếu đã duyệt (don_gia_thong_nhat > 0):
            thanh_tien_thong_nhat = don_gia_thong_nhat * so_luong
            gia_tri_giam = max(0, (don_gia_trinh - don_gia_thong_nhat) * so_luong)
        - Nếu chưa duyệt:
            don_gia_thong_nhat = 0
            thanh_tien_thong_nhat = 0
            gia_tri_giam = 0 (Triệt tiêu 100% lỗi tiết kiệm ảo)
        """
        self.thanh_tien_trinh = self.don_gia_trinh * self.so_luong

        if self.don_gia_thong_nhat > 0:
            self.thanh_tien_thong_nhat = self.don_gia_thong_nhat * self.so_luong
            self.gia_tri_giam = max(0.0, (self.don_gia_trinh - self.don_gia_thong_nhat) * self.so_luong)
        else:
            self.don_gia_thong_nhat = 0.0
            self.thanh_tien_thong_nhat = 0.0
            self.gia_tri_giam = 0.0
