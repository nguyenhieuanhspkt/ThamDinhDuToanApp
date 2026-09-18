# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Unit Tests for Storage Layer
Kiểm thử tính năng ghi đĩa nguyên tử và truy xuất chứng cứ qua FileRepository.
"""

import os
import sys
import tempfile
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from models import SynthesisEvidence
from storage import FileRepository, OneDriveAdapter, read_json_safe, write_json_atomic


class TestAtomicWriter(unittest.TestCase):
    """Kiểm thử cơ chế ghi đĩa nguyên tử."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp(prefix="test_atomic_")
        self.target_file = os.path.join(self.test_dir, "test_data.json")

    def tearDown(self):
        if os.path.exists(self.target_file):
            try:
                os.remove(self.target_file)
            except Exception:
                pass
        if os.path.exists(self.test_dir):
            try:
                os.rmdir(self.test_dir)
            except Exception:
                pass

    def test_write_and_read_atomic(self):
        """Kiểm tra ghi và đọc file JSON an toàn."""
        sample_data = {"id": 100, "name": "Vật tư thử nghiệm", "gia": 1250000.5}
        ok = write_json_atomic(self.target_file, sample_data)
        self.assertTrue(ok)
        self.assertTrue(os.path.exists(self.target_file))

        read_data = read_json_safe(self.target_file)
        self.assertEqual(read_data["id"], 100)
        self.assertEqual(read_data["name"], "Vật tư thử nghiệm")
        self.assertEqual(read_data["gia"], 1250000.5)


class TestFileRepository(unittest.TestCase):
    """Kiểm thử FileRepository trên dữ liệu thực tế."""

    def setUp(self):
        self.repo = FileRepository(BASE_DIR)

    def test_active_project_and_dirs(self):
        """Kiểm tra nhận diện dự án active và thư mục chứa file."""
        active_id = self.repo.get_active_project_id()
        self.assertIsNotNone(active_id)
        print(f"\nDự án đang active: {active_id}")

        p_dir = self.repo.get_project_files_dir()
        self.assertTrue(os.path.exists(p_dir))
        print(f"Thư mục chứng cứ: {os.path.basename(p_dir)}")

    def test_resolve_and_load_evidence(self):
        """Kiểm tra tìm và nạp file chứng cứ thực tế của Mục #6 (GEFA Valve)."""
        # Mục #6 phải có chứng cứ synthesis
        syn_file = self.repo.resolve_evidence_file(6, "synthesis")
        self.assertIsNotNone(syn_file)
        self.assertTrue(os.path.exists(syn_file))

        # Nạp qua Repository
        evidence = self.repo.load_item_evidence(6, "synthesis")
        self.assertIsInstance(evidence, SynthesisEvidence)
        self.assertEqual(evidence.item_id, 6)
        self.assertEqual(evidence.approved_price, 8910000.0)
        self.assertEqual(evidence.total_savings, 52340000.0)

    def test_load_dossier(self):
        """Kiểm tra nạp toàn bộ hồ sơ hiện tại qua Repository."""
        dossier = self.repo.load_dossier()
        self.assertEqual(dossier.total_items, 111)
        self.assertGreater(dossier.total_savings, 0)


class TestOneDriveAdapter(unittest.TestCase):
    """Kiểm thử kết nối với OneDrive EVN Cache."""

    def test_onedrive_status(self):
        status = OneDriveAdapter.get_status()
        self.assertIn("available", status)
        print(f"\nTrạng thái OneDrive EVN: {status.get('message')}")


if __name__ == "__main__":
    unittest.main()
