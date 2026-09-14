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
    ExcelService,
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

    def test_imis_service_config_status(self):
        """Kiểm tra ImisService.get_config_status trả về đầy đủ các trường trạng thái."""
        status = ImisService.get_config_status()
        self.assertIsInstance(status, dict)
        self.assertIn("is_connected", status)
        self.assertIn("status", status)
        self.assertIn("message", status)

    def test_imis_service_login_validation(self):
        """Kiểm tra ImisService.login khi thiếu thông tin trả về lỗi có cấu trúc chuẩn."""
        res = ImisService.login("", "")
        self.assertIsInstance(res, dict)
        self.assertFalse(res["success"])
        self.assertIn("Vui lòng nhập đầy đủ", res["message"])
        self.assertIn("info", res)

    def test_erp_service_config_status(self):
        """Kiểm tra ErpService.get_config_status trả về đầy đủ các trường trạng thái CSDL ERP."""
        status = ErpService.get_config_status()
        self.assertIsInstance(status, dict)
        self.assertIn("is_configured", status)
        self.assertIn("file_path", status)
        self.assertIn("file_exists", status)
        self.assertIn("mapping", status)

    def test_erp_service_preview_and_save(self):
        """Kiểm tra preview_columns và save_config khi đường dẫn hợp lệ hoặc không tồn tại."""
        # 1. Preview file không tồn tại
        res_fake = ErpService.preview_columns("C:\\FileKhongTonTai_Test.xlsx")
        self.assertFalse(res_fake.get("success", True))

        # 2. Save config với file không tồn tại
        res_save_fail = ErpService.save_config("C:\\FileKhongTonTai_Test.xlsx", {})
        self.assertFalse(res_save_fail.get("success"))

    def test_excel_service_template_and_export(self):
        """Kiểm tra sinh template Excel và xuất file Excel dự toán."""
        # 1. Download template
        tpl_path = ExcelService.download_template()
        self.assertTrue(os.path.exists(tpl_path))
        self.assertGreater(os.path.getsize(tpl_path), 1000)

        # 2. Export excel
        exp_path = ExcelService.export_excel()
        self.assertTrue(os.path.exists(exp_path))
        self.assertGreater(os.path.getsize(exp_path), 1000)

    def test_quote_service_batch_and_folders(self):
        """Kiểm tra QuoteService quét hàng loạt và duyệt thư mục."""
        items = [
            DossierItem(id=1, ten_vt="GEFA Ball Valve", don_gia_trinh=61250000),
            DossierItem(id=2, ten_vt="Khớp nối mềm", don_gia_trinh=5000000),
        ]
        res_batch = QuoteService.match_all_dossier_items(items)
        self.assertTrue(res_batch.get("success"))
        self.assertEqual(res_batch.get("total_items"), 2)

        res_browse = QuoteService.browse_folders("C:\\")
        self.assertTrue(res_browse.get("success"))
        self.assertIn("subdirs", res_browse)


if __name__ == "__main__":
    unittest.main()
