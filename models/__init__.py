# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Models Package
Domain-Driven Design Data Models & Evidence Registry
"""

import os
from typing import Dict, Optional, Type, Union

from models.base import BaseEntity, BaseEvidenceModel
from models.quotes import QuotesEvidence
from models.erp import ErpEvidence
from models.imis import ImisEvidence
from models.msc import MscEvidence
from models.ecom import EcomEvidence
from models.synthesis import SynthesisEvidence
from models.item import DossierItem
from models.project import ProjectDossier

# Registry ánh xạ giữa tên cột chứng cứ / tên tệp và Model tương ứng
EVIDENCE_REGISTRY: Dict[str, Type[BaseEvidenceModel]] = {
    "quotes": QuotesEvidence,
    "chung_cu_quotes.json": QuotesEvidence,
    "erp": ErpEvidence,
    "chung_cu_erp.json": ErpEvidence,
    "imis": ImisEvidence,
    "chung_cu_imis.json": ImisEvidence,
    "msc": MscEvidence,
    "muasamcong": MscEvidence,
    "chung_cu_muasamcong.json": MscEvidence,
    "ecom": EcomEvidence,
    "chung_cu_ecom.json": EcomEvidence,
    "synthesis": SynthesisEvidence,
    "chung_cu_synthesis.json": SynthesisEvidence,
}


def get_evidence_model_cls(identifier: str) -> Type[BaseEvidenceModel]:
    """Tìm lớp Model tương ứng từ tên pillar hoặc tên file."""
    key = str(identifier or "").lower().strip()
    base_name = os.path.basename(key)
    if base_name in EVIDENCE_REGISTRY:
        return EVIDENCE_REGISTRY[base_name]
    if key in EVIDENCE_REGISTRY:
        return EVIDENCE_REGISTRY[key]
    return BaseEvidenceModel


def load_evidence_file(file_path: str) -> BaseEvidenceModel:
    """Tự động phát hiện loại chứng cứ từ đường dẫn và nạp vào Model tương ứng."""
    cls = get_evidence_model_cls(file_path)
    return cls.from_file(file_path)


def save_evidence_file(model: BaseEvidenceModel, file_path: str) -> bool:
    """Lưu trữ Model an toàn xuống file trên đĩa."""
    return model.save_to_file(file_path)


__all__ = [
    "BaseEntity",
    "BaseEvidenceModel",
    "QuotesEvidence",
    "ErpEvidence",
    "ImisEvidence",
    "MscEvidence",
    "EcomEvidence",
    "SynthesisEvidence",
    "DossierItem",
    "ProjectDossier",
    "EVIDENCE_REGISTRY",
    "get_evidence_model_cls",
    "load_evidence_file",
    "save_evidence_file",
]
