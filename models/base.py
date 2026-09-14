# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Base Model Architecture
Cung cấp lớp trừu tượng BaseEntity và BaseEvidenceModel.
Thực hiện cơ chế "Cổng Kiểm Soát Biên 2 Chiều":
- from_dict: Tự động ép kiểu, fallback giá trị mặc định, bảo toàn trường mở rộng.
- to_dict: Chuẩn hóa dữ liệu đầu ra trước khi ghi đĩa hoặc gửi qua API.
"""

import json
import os
import tempfile
from typing import Any, Dict, Optional, Type, TypeVar

T = TypeVar("T", bound="BaseEntity")


class BaseEntity:
    """Lớp cơ sở cho toàn bộ các thực thể dữ liệu trong hệ thống."""

    def __init__(self, **kwargs: Any):
        # Lưu các trường không thuộc khai báo chính thức vào extra_fields để bảo toàn 100% dữ liệu
        self._extra_fields: Dict[str, Any] = dict(kwargs)

    @classmethod
    def from_dict(cls: Type[T], data: Optional[Dict[str, Any]]) -> T:
        """Khởi tạo thực thể từ dictionary với cơ chế tự bù đắp giá trị thiếu."""
        if data is None:
            return cls()
        if not isinstance(data, dict):
            raise TypeError(f"Dữ liệu nạp vào {cls.__name__} phải là dict, nhận được: {type(data)}")
        return cls(**data)

    def to_dict(self) -> Dict[str, Any]:
        """Chuyển đổi thực thể thành dictionary chuẩn hóa."""
        res: Dict[str, Any] = {}
        for key, val in self.__dict__.items():
            if key == "_extra_fields":
                continue
            if hasattr(val, "to_dict") and callable(val.to_dict):
                res[key] = val.to_dict()
            elif isinstance(val, list):
                res[key] = [
                    item.to_dict() if hasattr(item, "to_dict") and callable(item.to_dict) else item
                    for item in val
                ]
            else:
                res[key] = val
        # Gộp các trường mở rộng
        if hasattr(self, "_extra_fields") and isinstance(self._extra_fields, dict):
            for k, v in self._extra_fields.items():
                if k not in res:
                    res[k] = v
        return res

    @classmethod
    def from_file(cls: Type[T], file_path: str, encoding: str = "utf-8") -> T:
        """Đọc an toàn từ file JSON trên đĩa."""
        if not os.path.exists(file_path):
            return cls()
        try:
            with open(file_path, "r", encoding=encoding) as f:
                data = json.load(f)
            return cls.from_dict(data)
        except Exception:
            return cls()

    def save_to_file(self, file_path: str, encoding: str = "utf-8", indent: int = 2) -> bool:
        """
        Ghi đĩa an toàn (Atomic Write):
        Ghi trước ra file tạm, sau đó replace vào file đích để chống mất dữ liệu khi crash/mất điện.
        """
        dir_name = os.path.dirname(os.path.abspath(file_path))
        if dir_name and not os.path.exists(dir_name):
            os.makedirs(dir_name, exist_ok=True)

        data = self.to_dict()
        tmp_fd = None
        tmp_path = None
        try:
            tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix="tmp_model_", suffix=".json")
            with open(tmp_fd, "w", encoding=encoding) as f:
                json.dump(data, f, ensure_ascii=False, indent=indent)
            tmp_fd = None  # Đã đóng bởi with
            # Thay thế nguyên tử
            if os.path.exists(file_path):
                os.replace(tmp_path, file_path)
            else:
                os.rename(tmp_path, file_path)
            return True
        except Exception as ex:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
            raise IOError(f"Lỗi ghi file an toàn tới {file_path}: {ex}") from ex


class BaseEvidenceModel(BaseEntity):
    """Lớp cơ sở chuyên trách cho 6 Khối Chứng Cứ (Pillars)."""

    def __init__(
        self,
        item_id: Optional[int] = None,
        summary_text: str = "",
        thoi_gian_luu: Optional[str] = None,
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.item_id: Optional[int] = int(item_id) if item_id is not None else None
        self.summary_text: str = str(summary_text or "")
        self.thoi_gian_luu: Optional[str] = thoi_gian_luu
        self._extra_fields = kwargs
