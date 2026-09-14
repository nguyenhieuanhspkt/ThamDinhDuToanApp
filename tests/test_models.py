# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Unit & Integration Tests for Data Models
Kiểm thử toàn diện gói models trên dữ liệu thực tế 112 mục.
"""

import glob
import os
import sys
import unittest

# Đảm bảo import được package models từ thư mục gốc dự án
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from models import (
    BaseEntity,
    BaseEvidenceModel,
    DossierItem,
    EcomEvidence,
    ErpEvidence,
    ImisEvidence,
    MscEvidence,
    ProjectDossier,
    QuotesEvidence,
    SynthesisEvidence,
    load_evidence_file,
)


class TestBaseAndModels(unittest.TestCase):
    """Kiểm thử tính năng nền tảng của BaseEntity và các Model cụ thể."""

    def test_base_entity_fallback(self):
        """Kiểm tra fallback khi nạp None hoặc dict rỗng."""
        e = BaseEntity.from_dict(None)
        self.assertIsInstance(e, BaseEntity)

        # Kiểm tra bảo toàn trường mở rộng
        e2 = BaseEntity.from_dict({"custom_field_123": "GiaTriBaoMat", "so_tien": 5000})
        self.assertEqual(e2.to_dict()["custom_field_123"], "GiaTriBaoMat")
        self.assertEqual(e2.to_dict()["so_tien"], 5000)

    def test_dossier_item_savings_calculation(self):
        """Kiểm tra logic triệt tiêu tiết kiệm ảo của DossierItem."""
        # Trường hợp 1: Mục chưa duyệt (don_gia_thong_nhat = 0)
        it_unapproved = DossierItem(
            id=74,
            ten_vt="Đế gắn module IO",
            don_gia_trinh=21120000,
            so_luong=26,
            don_gia_thong_nhat=0,
            gia_tri_giam=549120000,  # Dữ liệu cũ bị lỗi ảo
        )
        # Model phải tự động triệt tiêu tiết kiệm ảo về 0
        self.assertEqual(it_unapproved.don_gia_thong_nhat, 0.0)
        self.assertEqual(it_unapproved.thanh_tien_thong_nhat, 0.0)
        self.assertEqual(it_unapproved.gia_tri_giam, 0.0)
        self.assertFalse(it_unapproved.has_approved_price)

        # Trường hợp 2: Mục đã duyệt giảm giá
        it_approved = DossierItem(
            id=6,
            ten_vt="GEFA DG1 Ball Valve",
            don_gia_trinh=61250000,
            so_luong=1,
            don_gia_thong_nhat=8910000,
        )
        self.assertEqual(it_approved.thanh_tien_thong_nhat, 8910000.0)
        self.assertEqual(it_approved.gia_tri_giam, 52340000.0)
        self.assertTrue(it_approved.has_approved_price)

    def test_synthesis_evidence_recalculate(self):
        """Kiểm tra tính năng tính lại tiết kiệm của SynthesisEvidence."""
        syn = SynthesisEvidence(item_id=1, approved_price=8910000, total_savings=0)
        savings = syn.recalculate_savings(don_gia_trinh=61250000, so_luong=2)
        self.assertEqual(savings, (61250000 - 8910000) * 2)

        # Khi xóa giá duyệt
        syn.set_approved_price(None, don_gia_trinh=61250000, so_luong=2)
        self.assertIsNone(syn.approved_price)
        self.assertEqual(syn.total_savings, 0.0)

    def test_erp_evidence_deselect(self):
        """Kiểm tra thao tác Hủy chọn ERP."""
        erp = ErpEvidence(keyword="Cáp điều khiển", selected_record={"so_hd": "123"})
        erp.deselect()
        self.assertTrue(erp.is_deselected)
        self.assertEqual(erp.selected_record, "NONE")
        self.assertIn("không áp dụng làm căn cứ thẩm định", erp.summary_text)

    def test_msc_evidence_selection(self):
        """Kiểm tra tính năng chọn kết quả và quy đổi trước thuế e-GP."""
        results = [
            {"ten_vt": "Dây cáp", "don_gia": 1080000},  # Đã có VAT 8%
        ]
        msc = MscEvidence(item_id=1, danh_sach_ket_qua=results)
        msc.select_index(0, vat_rate=0.08)
        self.assertEqual(msc.selected_index, 0)
        self.assertEqual(msc.don_gia_goc_egp, 1080000.0)
        self.assertEqual(msc.don_gia_truoc_thue, 1000000.0)
        self.assertEqual(msc.don_gia_tham_chieu, 1000000.0)

        # Hủy chọn
        msc.deselect()
        self.assertTrue(msc.is_deselected)
        self.assertIsNone(msc.selected_index)
        self.assertEqual(msc.don_gia_tham_chieu, 0.0)


class TestRealWorldDossierAndEvidence(unittest.TestCase):
    """Kiểm thử nạp và đối soát toàn bộ CSDL 112 mục thực tế của dự án."""

    def test_load_current_dossier(self):
        """Nạp toàn bộ hồ sơ current_dossier.json vào ProjectDossier Model."""
        dossier_path = os.path.join(BASE_DIR, "data", "current_dossier.json")
        if not os.path.exists(dossier_path):
            self.skipTest("Không tìm thấy current_dossier.json")

        project = ProjectDossier.from_file(dossier_path)
        self.assertEqual(project.total_items, 112)
        self.assertGreater(project.total_trinh, 0)
        self.assertGreater(project.total_thong_nhat, 0)
        self.assertGreater(project.total_savings, 0)

        # Kiểm tra mục #74 trong hồ sơ thực tế không có tiết kiệm ảo
        it_74 = project.get_item(74)
        self.assertIsNotNone(it_74)
        self.assertEqual(it_74.don_gia_thong_nhat, 0.0)
        self.assertEqual(it_74.gia_tri_giam, 0.0)

    def test_load_all_evidence_files_in_projects(self):
        """Quét và nạp toàn bộ các file chứng cứ thực tế trong thư mục projects/."""
        pattern = os.path.join(BASE_DIR, "data", "projects", "*_files", "item_*", "chung_cu_*.json")
        files = glob.glob(pattern)
        if not files:
            pattern2 = os.path.join(BASE_DIR, "data", "current_dossier_files", "item_*", "chung_cu_*.json")
            files = glob.glob(pattern2)

        self.assertGreater(len(files), 0, "Không tìm thấy file chứng cứ thực tế để test")

        loaded_count = 0
        for fpath in files:
            model = load_evidence_file(fpath)
            self.assertIsInstance(model, BaseEvidenceModel)
            loaded_count += 1

        print(f"\n[TEST TOÀN VẸN] Đã nạp thành công 100% {loaded_count} tệp chứng cứ thực tế qua Models!")


if __name__ == "__main__":
    unittest.main()
