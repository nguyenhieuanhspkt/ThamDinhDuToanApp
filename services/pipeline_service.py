# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Pipeline Service
Dịch vụ Điều phối Tự động hóa Liên hoàn 5 Khối Chứng Cứ (1-Click Automation).
"""

import os
from datetime import datetime
from typing import Any, Dict, Optional

from models import (
    DossierItem,
    EcomEvidence,
    ErpEvidence,
    ImisEvidence,
    MscEvidence,
    ProjectDossier,
    QuotesEvidence,
    SynthesisEvidence,
)
from services.ai_synthesis_service import AiSynthesisService
from services.erp_service import ErpService
from services.imis_service import ImisService
from services.msc_service import MscService
from services.quote_service import QuoteService
from storage import FileRepository, default_repo


class PipelineService:
    """Dịch vụ điều phối luồng chạy thẩm định liên hoàn."""

    @staticmethod
    def run_5_pillars(
        item_id: int,
        keyword_override: str = "",
        repo: Optional[FileRepository] = None,
        run_ai: bool = True,
    ) -> Dict[str, Any]:
        """
        Kích hoạt chạy tự động 5 cơ sở cho 1 mục vật tư:
        1. Báo giá gốc (Quotes)
        2. ERP Vĩnh Tân 4
        3. EVN IMIS toàn ngành
        4. Mua Sắm Công e-GP
        5. TMĐT & Web
        6. Tổng hợp & Sinh AI Thuyết minh (Synthesis)
        Lưu vết toàn bộ vào thư mục chứng cứ của dự án active qua FileRepository.
        """
        repository = repo or default_repo
        dossier = repository.load_dossier()
        target_item = dossier.get_item(item_id)

        if not target_item:
            return {"success": False, "message": f"Không tìm thấy vật tư có ID={item_id}"}

        # 1. Xác định từ khóa tra cứu chuyên biệt
        raw_ten = target_item.ten_vt or target_item.ten_vt_goc or ""
        ma_vt_val = target_item.ma_vt.strip()
        general_kw = keyword_override.strip() or target_item.search_keyword or raw_ten.split("\n")[0][:40].strip()
        erp_kw = ma_vt_val if (ma_vt_val and "chưa" not in ma_vt_val.lower()) else general_kw
        msc_kw = (target_item.ten_vt_goc or target_item.ten_vt or "").split("\n")[0].strip() or general_kw

        target_item.search_keyword = general_kw

        # 2. Khối 1: Báo giá gốc
        quotes_ev = repository.load_item_evidence(item_id, "quotes")
        if not isinstance(quotes_ev, QuotesEvidence) or not quotes_ev.has_quotes:
            try:
                quotes_ev = QuoteService.match_item(target_item)
                repository.save_item_evidence(item_id, "quotes", quotes_ev)
            except Exception as ex:
                quotes_ev = QuotesEvidence(item_id=item_id, summary_text=f"Lỗi đối chiếu báo giá: {ex}")

        # 3. Khối 2: ERP Vĩnh Tân 4
        erp_ev = repository.load_item_evidence(item_id, "erp")
        if not isinstance(erp_ev, ErpEvidence) or not erp_ev.results:
            try:
                erp_ev = ErpService.search(keyword=general_kw, ma_vt=erp_kw, item=target_item)
                repository.save_item_evidence(item_id, "erp", erp_ev)
            except Exception as ex:
                erp_ev = ErpEvidence(item_id=item_id, summary_text=f"Lỗi tra cứu ERP: {ex}")

        # 4. Khối 3: EVN IMIS Toàn ngành
        imis_ev = repository.load_item_evidence(item_id, "imis")
        if not isinstance(imis_ev, ImisEvidence) or not imis_ev.imis:
            try:
                imis_ev = ImisService.search(keyword=general_kw, item=target_item, ma_vt=ma_vt_val)
                repository.save_item_evidence(item_id, "imis", imis_ev)
            except Exception as ex:
                imis_ev = ImisEvidence(item_id=item_id, summary_text=f"Lỗi tra cứu IMIS: {ex}")

        # 5. Khối 4: Mua Sắm Công e-GP
        msc_ev = repository.load_item_evidence(item_id, "muasamcong")
        if not isinstance(msc_ev, MscEvidence) or not msc_ev.danh_sach_ket_qua:
            try:
                msc_ev = MscService.search(keyword=msc_kw, item=target_item)
                repository.save_item_evidence(item_id, "muasamcong", msc_ev)
            except Exception as ex:
                msc_ev = MscEvidence(item_id=item_id, summary_text=f"Lỗi tra cứu MSC: {ex}")

        # 6. Khối 5: TMĐT & Web
        ecom_ev = repository.load_item_evidence(item_id, "ecom")
        if not isinstance(ecom_ev, EcomEvidence):
            ecom_ev = EcomEvidence(item_id=item_id, keyword=general_kw)
            repository.save_item_evidence(item_id, "ecom", ecom_ev)

        # 7. Tổng hợp Pillars Dictionary
        p1_price = quotes_ev.min_price if isinstance(quotes_ev, QuotesEvidence) else 0.0
        p2_price = 0.0
        if isinstance(erp_ev, ErpEvidence) and not erp_ev.is_deselected and erp_ev.results:
            p2_price = float(erp_ev.results[0].get("don_gia") or erp_ev.results[0].get("donGia") or 0.0)

        p3_price = 0.0
        if isinstance(imis_ev, ImisEvidence) and not imis_ev.is_deselected and imis_ev.imis:
            p3_price = float(imis_ev.imis[0].get("don_gia") or imis_ev.imis[0].get("donGia") or 0.0)

        p4_price = msc_ev.don_gia_tham_chieu if isinstance(msc_ev, MscEvidence) and not msc_ev.is_deselected else 0.0

        pillars = {
            "p1": {"price": p1_price, "desc": quotes_ev.summary_text, "has": p1_price > 0, "name": "Báo giá gốc"},
            "p2": {"price": p2_price, "desc": erp_ev.summary_text, "has": p2_price > 0, "name": "ERP VT4"},
            "p3": {"price": p3_price, "desc": imis_ev.summary_text, "has": p3_price > 0, "name": "EVN IMIS"},
            "p4": {"price": p4_price, "desc": msc_ev.summary_text, "has": p4_price > 0, "name": "Mua Sắm Công"},
            "p5": {"price": 0, "desc": ecom_ev.summary_text or ecom_ev.note, "has": False, "name": "TMĐT Web"},
        }

        # 8. Khối 6: AI Thuyết minh Tổng hợp
        synthesis_ev = repository.load_item_evidence(item_id, "synthesis")
        if run_ai or not isinstance(synthesis_ev, SynthesisEvidence) or not synthesis_ev.summary_text:
            try:
                synthesis_ev = AiSynthesisService.synthesize(target_item, pillars)
                repository.save_item_evidence(item_id, "synthesis", synthesis_ev)
            except Exception as ex:
                if not isinstance(synthesis_ev, SynthesisEvidence):
                    synthesis_ev = SynthesisEvidence(item_id=item_id, pillars=pillars, summary_text=f"Lỗi AI: {ex}")

        # 9. Đồng bộ lại vào hồ sơ DossierItem
        if synthesis_ev.approved_price and synthesis_ev.approved_price > 0:
            target_item.don_gia_thong_nhat = synthesis_ev.approved_price
            target_item.co_so_thong_nhat = synthesis_ev.co_so_thong_nhat or "Đề xuất AI"
            target_item.danh_gia_ttd = synthesis_ev.summary_text
            target_item.recalculate_totals()
            repository.save_dossier(dossier)

        return {
            "success": True,
            "item_id": item_id,
            "keyword": general_kw,
            "quotes": quotes_ev.to_dict(),
            "erp": erp_ev.to_dict(),
            "imis": imis_ev.to_dict(),
            "msc": msc_ev.to_dict(),
            "ecom": ecom_ev.to_dict(),
            "synthesis": synthesis_ev.to_dict(),
        }
