# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - AI Synthesis Service
Dịch vụ Tổng hợp chứng cứ 5 Cơ sở và Thuyết minh Chuyên gia Tổ Thẩm định (Cơ sở 6).
"""

from typing import Any, Dict, Optional, Union
from models import DossierItem, SynthesisEvidence
import ai_synthesis


class AiSynthesisService:
    """Dịch vụ nghiệp vụ tổng hợp đa cơ sở và sinh bài thuyết minh AI."""

    @staticmethod
    def synthesize(
        item: Union[DossierItem, Dict[str, Any]],
        pillars: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
    ) -> SynthesisEvidence:
        """
        Nhận thông tin vật tư và dữ liệu 5 cơ sở giá, gọi lõi AI sinh bài thuyết minh
        và tính toán điểm số đề xuất. Trả về thực thể SynthesisEvidence.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item or {})
        item_id = item_dict.get("id")

        # Chuẩn hóa format pillars cho ai_synthesis nếu đang ở dạng dict nested
        ai_pillars = {}
        for k, v in pillars.items():
            if isinstance(v, dict):
                ai_pillars[f"{k}_price"] = v.get("price", 0)
                ai_pillars[f"{k}_desc"] = v.get("desc", "")
            else:
                ai_pillars[k] = v

        # Gọi lõi ai_synthesis
        res = ai_synthesis.generate_ai_synthesis(item_dict, ai_pillars, config=config)

        # Tính toán điểm phủ chứng cứ (Coverage score 0-100)
        has_count = sum(1 for k, v in pillars.items() if isinstance(v, dict) and v.get("has"))
        coverage_score = int((has_count / 5.0) * 100) if has_count > 0 else 0

        # Đóng gói sang SynthesisEvidence Model
        res["item_id"] = item_id
        res["pillars"] = pillars
        res["coverage_score"] = coverage_score
        res["approved_price"] = res.get("suggested_price")
        res["co_so_thong_nhat"] = res.get("winning_pillar", "")

        model = SynthesisEvidence.from_dict(res)
        model.recalculate_savings(
            don_gia_trinh=float(item_dict.get("don_gia_trinh") or 0.0),
            so_luong=float(item_dict.get("so_luong") or 1.0),
        )
        return model
