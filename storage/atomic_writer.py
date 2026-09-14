# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Atomic File Writer
Cung cấp cơ chế ghi đĩa nguyên tử (Atomic Write) qua file tạm và os.replace,
chống hỏng dữ liệu hoặc ghi dở file khi mất điện / crash hệ thống.
"""

import json
import os
import tempfile
from typing import Any, Dict


def write_json_atomic(
    file_path: str,
    data: Any,
    encoding: str = "utf-8",
    indent: int = 2,
) -> bool:
    """
    Ghi dữ liệu JSON an toàn xuống đĩa:
    1. Tạo file tạm cùng thư mục đích.
    2. Ghi và flush toàn bộ dữ liệu vào file tạm.
    3. Sử dụng os.replace để thay thế nguyên tử vào file đích.
    """
    dir_name = os.path.dirname(os.path.abspath(file_path))
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)

    tmp_path = None
    try:
        tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix="atomic_", suffix=".tmp")
        with open(tmp_fd, "w", encoding=encoding) as f:
            json.dump(data, f, ensure_ascii=False, indent=indent)
            f.flush()
            os.fsync(f.fileno())

        # os.replace là atomic trên cả Windows và POSIX
        os.replace(tmp_path, file_path)
        return True
    except Exception as ex:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        raise IOError(f"Lỗi ghi file nguyên tử tới {file_path}: {ex}") from ex


def read_json_safe(file_path: str, encoding: str = "utf-8") -> Dict[str, Any]:
    """Đọc file JSON an toàn, trả về dict rỗng nếu file không tồn tại hoặc lỗi cú pháp."""
    if not os.path.exists(file_path):
        return {}
    try:
        with open(file_path, "r", encoding=encoding) as f:
            content = json.load(f)
            return content if isinstance(content, dict) else {"data": content}
    except Exception:
        return {}
