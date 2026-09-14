# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Storage Package
Quản lý lưu trữ tệp tin, Atomic Write và Đồng bộ đám mây OneDrive EVN.
"""

from storage.atomic_writer import read_json_safe, write_json_atomic
from storage.file_repository import FileRepository
from storage.onedrive_adapter import OneDriveAdapter

# Khởi tạo singleton repository mặc định cho toàn hệ thống
default_repo = FileRepository()

__all__ = [
    "write_json_atomic",
    "read_json_safe",
    "FileRepository",
    "OneDriveAdapter",
    "default_repo",
]
