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
        self.assertEqual(len(items), 112)

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


if __name__ == "__main__":
    unittest.main()
