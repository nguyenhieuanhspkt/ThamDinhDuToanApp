# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Unit & Integration Tests for API Routes
Kiểm thử toàn bộ các Endpoint API thông qua Flask Test Client.
"""

import os
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app import app


class TestApiRoutes(unittest.TestCase):
    """Kiểm thử phản hồi của các Blueprint API."""

    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_api_status(self):
        """Kiểm tra Endpoint /api/status."""
        res = self.client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "online")
        self.assertEqual(data.get("app"), "ThamDinhDuToanApp")

    def test_api_dossier(self):
        """Kiểm tra Endpoint /api/dossier."""
        res = self.client.get("/api/dossier")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        items = data.get("items", [])
        self.assertEqual(len(items), 111)

    def test_api_projects(self):
        """Kiểm tra Endpoint /api/projects."""
        res = self.client.get("/api/projects")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_api_evidence_get(self):
        """Kiểm tra Endpoint /api/evidence/get cho Mục #6."""
        res = self.client.get("/api/evidence/get?item_id=6")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        evidence = data.get("evidence", {})
        self.assertIn("synthesis", evidence)
        self.assertIsNotNone(evidence["synthesis"])

    def test_api_evidence_status(self):
        """Kiểm tra Endpoint /api/evidence/status/6."""
        res = self.client.get("/api/evidence/status/6")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("has_syn"))

    def test_api_evidence_all_status(self):
        """Kiểm tra Endpoint /api/evidence/all-status."""
        res = self.client.get("/api/evidence/all-status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertGreater(data.get("total_items", 0), 0)

    def test_api_onedrive_status(self):
        """Kiểm tra Endpoint /api/sync/onedrive-status."""
        res = self.client.get("/api/sync/onedrive-status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("available", data)

    def test_api_imis_routes(self):
        """Kiểm tra Endpoints /api/imis/config-status và /api/imis/login."""
        res_cfg = self.client.get("/api/imis/config-status")
        self.assertEqual(res_cfg.status_code, 200)
        cfg_data = res_cfg.get_json()
        self.assertIn("status", cfg_data)
        self.assertIn("is_connected", cfg_data)

        # Test login với payload rỗng -> phải trả về Dictionary có success: False
        res_login = self.client.post("/api/imis/login", json={"username": "", "password": ""})
        self.assertEqual(res_login.status_code, 200)
        login_data = res_login.get_json()
        self.assertIsInstance(login_data, dict)
        self.assertFalse(login_data.get("success"))
        self.assertIn("Vui lòng nhập đầy đủ", login_data.get("message"))

    def test_api_erp_routes(self):
        """Kiểm tra các Endpoints ERP: /api/erp/config-status, preview-columns, save-config."""
        # 1. Config status
        res_cfg = self.client.get("/api/erp/config-status")
        self.assertEqual(res_cfg.status_code, 200)
        cfg_data = res_cfg.get_json()
        self.assertIn("is_configured", cfg_data)
        self.assertIn("file_path", cfg_data)

        # 2. Preview columns với body rỗng -> HTTP 400
        res_prev_bad = self.client.post("/api/erp/preview-columns", json={})
        self.assertEqual(res_prev_bad.status_code, 400)

        # 3. Preview columns với file_path giả định -> HTTP 200 (hoặc success: False)
        res_prev = self.client.post("/api/erp/preview-columns", json={"file_path": "C:\\fake.xlsx"})
        self.assertEqual(res_prev.status_code, 200)
        prev_data = res_prev.get_json()
        self.assertFalse(prev_data.get("success", True))

        # 4. Save config với file không tồn tại -> HTTP 400
        res_save = self.client.post("/api/erp/save-config", json={"file_path": "C:\\fake.xlsx", "mapping": {}})
        self.assertEqual(res_save.status_code, 400)

    def test_api_excel_routes(self):
        """Kiểm tra các endpoints Excel: /api/download-template, /api/export-excel, /api/import-excel."""
        # 1. Download template -> 200 attachment
        res_tpl = self.client.get("/api/download-template")
        self.assertEqual(res_tpl.status_code, 200)
        self.assertGreater(len(res_tpl.data), 1000)

        # 2. Export excel -> 200 attachment
        res_exp = self.client.get("/api/export-excel")
        self.assertEqual(res_exp.status_code, 200)
        self.assertGreater(len(res_exp.data), 1000)

        # 3. Import excel không có file -> 400
        res_imp_bad = self.client.post("/api/import-excel")
        self.assertEqual(res_imp_bad.status_code, 400)

    def test_api_quote_extended_routes(self):
        """Kiểm tra các endpoints Quotes mở rộng: match-all-dossier-items, browse-folders, dossier."""
        res_batch = self.client.post("/api/quotes/match-all-dossier-items", json={})
        self.assertEqual(res_batch.status_code, 200)
        batch_data = res_batch.get_json()
        self.assertTrue(batch_data.get("success"))
        self.assertIn("results", batch_data)

        res_browse = self.client.post("/api/quotes/browse-folders", json={"path": "C:\\"})
        self.assertEqual(res_browse.status_code, 200)
        browse_data = res_browse.get_json()
        self.assertTrue(browse_data.get("success"))

        res_dossier = self.client.get("/api/quotes/dossier")
        self.assertEqual(res_dossier.status_code, 200)


if __name__ == "__main__":
    unittest.main()
