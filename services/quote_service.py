# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Quote Matching Service
Dịch vụ bóc tách PDF báo giá và đối chiếu vật tư (Cơ sở 1).
"""

from typing import Any, Dict, Optional, Union
from models import DossierItem, QuotesEvidence
import quote_matcher


class QuoteService:
    """Dịch vụ nghiệp vụ đối chiếu Báo giá gốc."""

    @staticmethod
    def match_item(
        item: Union[DossierItem, Dict[str, Any]],
        folder_path: Optional[str] = None,
        overrides: Optional[Dict[str, Any]] = None,
    ) -> QuotesEvidence:
        """
        Quét thư mục báo giá và ghép nối đơn giá cho vật tư dự toán.
        Trả về thực thể QuotesEvidence chuẩn hóa.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item)
        item_id = item_dict.get("id")

        # 1. Quét hoặc tải cache danh sách báo giá
        quotes_data = quote_matcher.scan_quotation_folder(
            folder_path=folder_path,
            overrides=overrides,
        )

        # 2. Đối chiếu
        res = quote_matcher.match_item_in_quotes(item_dict, quotes_data)

        # 3. Đóng gói vào Model QuotesEvidence
        res["item_id"] = item_id
        return QuotesEvidence.from_dict(res)
