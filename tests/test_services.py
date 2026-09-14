# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Unit Tests for Services Layer
Kiểm thử tính đúng đắn và chuẩn hóa đầu ra của các dịch vụ nghiệp vụ.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from models import (
    DossierItem,
    ErpEvidence,
    ImisEvidence,
    MscEvidence,
    QuotesEvidence,
    SynthesisEvidence,
)
from services import (
    AiSynthesisService,
    ErpService,
    ImisService,
    MscService,
    QuoteService,
)


class TestServices(unittest.TestCase):
    """Kiểm thử hoạt động của từng dịch vụ nghiệp vụ."""

    def test_erp_service_deselect(self):
        """Kiểm tra ErpService khi truyền cờ hủy chọn."""
        evidence = ErpService.search(
            keyword="Cáp điều khiển",
            selected_record="NONE",
            item={"id": 10, "don_gia_trinh": 500000},
        )
        self.assertIsInstance(evidence, ErpEvidence)
        self.assertTrue(evidence.is_deselected)
        self.assertEqual(evidence.selected_record, "NONE")
        self.assertEqual(evidence.item_id, 10)

    def test_imis_service_deselect(self):
        """Kiểm tra ImisService khi truyền cờ hủy chọn."""
        evidence = ImisService.search(
            keyword="Van bướm",
            item={"id": 12, "don_gia_trinh": 1200000},
            is_deselected=True,
        )
        self.assertIsInstance(evidence, ImisEvidence)
        self.assertTrue(evidence.is_deselected)
        self.assertEqual(evidence.selected_record, "NONE")
        self.assertEqual(evidence.item_id, 12)

    def test_quote_service_type(self):
        """Kiểm tra QuoteService trả về đúng kiểu QuotesEvidence."""
        item = DossierItem(id=1, ten_vt="Vật tư kiểm thử", don_gia_trinh=1000000)
        # Giả lập thư mục không tồn tại để kiểm tra độ an toàn (graceful fallback)
        evidence = QuoteService.match_item(item, folder_path="C:\\ThuMucKhongTonTai_Test")
        self.assertIsInstance(evidence, QuotesEvidence)
        self.assertEqual(evidence.item_id, 1)

    def test_ai_synthesis_service(self):
        """Kiểm tra AiSynthesisService tổng hợp và trả về SynthesisEvidence chuẩn."""
        item = DossierItem(id=6, ten_vt="GEFA DG1 Ball Valve", don_gia_trinh=61250000, so_luong=1)
        pillars = {
            "p1": {"price": 8910000, "desc": "Báo giá chào thấp nhất", "has": True, "name": "Báo giá gốc"},
            "p2": {"price": 0, "desc": "", "has": False, "name": "ERP"},
            "p3": {"price": 0, "desc": "", "has": False, "name": "IMIS"},
            "p4": {"price": 0, "desc": "", "has": False, "name": "MSC"},
            "p5": {"price": 0, "desc": "", "has": False, "name": "TMĐT"},
        }
        evidence = AiSynthesisService.synthesize(item, pillars, config={"enable_ai": False})
        self.assertIsInstance(evidence, SynthesisEvidence)
        self.assertEqual(evidence.item_id, 6)
        self.assertGreater(evidence.coverage_score, 0)
        self.assertGreater(len(evidence.summary_text), 0)


if __name__ == "__main__":
    unittest.main()
