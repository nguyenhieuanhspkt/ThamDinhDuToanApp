# -*- coding: utf-8 -*-
# ThamDinhDuToanApp - Unit Tests for Single Source of Truth Savings Consistency
import os, sys, unittest
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path: sys.path.insert(0, BASE_DIR)
if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
from models import DossierItem, ProjectDossier
from storage import default_repo, read_json_safe

class TestSingleVariableSavings(unittest.TestCase):
    def test_item_model_pure_data_schema(self):
        it = DossierItem(
            id=6,
            ten_vt='GEFA dG1 Ball Valve',
            so_luong=1,
            don_gia_trinh=61250000,
            don_gia_thong_nhat=8910000,
            gia_tri_giam=52340000.0,
            cn_so_thong_nhat='Cơ sở 3: EVN IMIS Toàn Ngành',
        )
        self.assertEqual(it.don_gia_trinh, 61250000.0)
        self.assertEqual(it.don_gia_thong_nhat, 8910000.0)
        self.assertEqual(it.gia_tri_giam, 52340000.0)
        self.assertEqual(it.pct_giam, 85.5)
        d = it.to_dict()
        self.assertEqual(d['gia_tri_giam'], 52340000.0)
        self.assertEqual(d['pct_giam'], 85.5)
        self.assertTrue(d['has_approved_price'])

    def test_unapproved_item_zero_savings(self):
        it = DossierItem(id=99, don_gia_trinh=100000000, don_gia_thong_nhat=0, gia_tri_giam=50000000)
        self.assertEqual(it.don_gia_thong_nhat, 0.0)
        self.assertEqual(it.gia_tri_giam, 0.0)
        self.assertEqual(it.pct_giam, 0.0)
        self.assertFalse(it.has_approved_price)

    def test_item_6_database_and_evidence_integrity(self):
        dossier = default_repo.load_dossier()
        it6 = dossier.get_item(6)
        self.assertIsNotNone(it6)
        self.assertEqual(it6.don_gia_trinh, 61250000.0)
        self.assertEqual(it6.don_gia_thong_nhat, 8910000.0)
        self.assertEqual(it6.gia_tri_giam, 52340000.0)
        self.assertEqual(it6.pct_giam, 85.5)
        self.assertIn('IMIS', it6.co_so_thong_nhat)

        imis_path = default_repo.resolve_evidence_file(6, 'imis')
        self.assertTrue(os.path.exists(imis_path))
        imis_data = read_json_safe(imis_path)
        imis_list = imis_data.get('imis', [])
        self.assertGreater(len(imis_list), 0)
        first_rec = imis_list[0]
        self.assertEqual(first_rec.get('donGia') or first_rec.get('don_gia'), 8910000)

if __name__ == '__main__':
    unittest.main()
