# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Project Dossier Model (Thực Thể Hồ Sơ Dự Án Thẩm Định)
"""

from typing import Any, Dict, List, Optional
from models.base import BaseEntity
from models.item import DossierItem


class ProjectDossier(BaseEntity):
    """Thực thể đại diện cho toàn bộ hồ sơ dự án thẩm định."""

    def __init__(
        self,
        dossier_name: str = "",
        creator: str = "",
        department: str = "",
        items: Optional[List[Any]] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.dossier_name: str = str(dossier_name or "")
        self.creator: str = str(creator or "")
        self.department: str = str(department or "")
        self.items: List[DossierItem] = []

        if items:
            for it in items:
                if isinstance(it, DossierItem):
                    self.items.append(it)
                elif isinstance(it, dict):
                    self.items.append(DossierItem.from_dict(it))
        self._extra_fields = kwargs

    def get_item(self, item_id: int) -> Optional[DossierItem]:
        """Tìm vật tư theo ID."""
        for it in self.items:
            if it.id == item_id:
                return it
        return None

    @property
    def total_items(self) -> int:
        """Tổng số vật tư trong hồ sơ."""
        return len(self.items)

    @property
    def approved_items_count(self) -> int:
        """Số vật tư đã chốt phê duyệt đơn giá."""
        return sum(1 for it in self.items if it.has_approved_price)

    @property
    def total_trinh(self) -> float:
        """Tổng thành tiền trình duyệt của toàn bộ hồ sơ."""
        return sum(it.thanh_tien_trinh for it in self.items)

    @property
    def total_thong_nhat(self) -> float:
        """Tổng thành tiền thống nhất của các mục đã thẩm định."""
        return sum(it.thanh_tien_thong_nhat for it in self.items if it.has_approved_price)

    @property
    def total_savings(self) -> float:
        """Tổng giá trị giảm trừ / tiết kiệm thực tế."""
        return sum(it.gia_tri_giam for it in self.items)

    def to_dict(self) -> Dict[str, Any]:
        """Chuyển đổi hồ sơ dự án sang dict chuẩn hóa."""
        res = super().to_dict()
        res["items"] = [it.to_dict() for it in self.items]
        return res
