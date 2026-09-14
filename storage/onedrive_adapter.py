# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - OneDrive Storage Adapter
Cung cấp giao diện kết nối đồng bộ 2 chiều với OneDrive EVN Cache.
"""

from typing import Any, Dict
import onedrive_sync


class OneDriveAdapter:
    """Adapter điều phối đồng bộ đám mây OneDrive EVN."""

    @staticmethod
    def is_available() -> bool:
        """Kiểm tra thư mục cache OneDrive EVN có khả dụng trên máy hay không."""
        return onedrive_sync.is_onedrive_available()

    @staticmethod
    def get_status() -> Dict[str, Any]:
        """Lấy thông tin trạng thái kết nối và số tệp trong kho cache."""
        return onedrive_sync.get_sync_status()

    @staticmethod
    def push(force: bool = False) -> Dict[str, Any]:
        """Đẩy toàn bộ dữ liệu hiện tại sang thư mục OneDrive EVN Cache."""
        return onedrive_sync.push_to_onedrive(force=force)

    @staticmethod
    def pull() -> Dict[str, Any]:
        """Kéo dữ liệu từ OneDrive EVN Cache về ứng dụng."""
        if hasattr(onedrive_sync, "pull_from_onedrive"):
            return onedrive_sync.pull_from_onedrive()
        return {"success": False, "message": "Hàm pull_from_onedrive chưa được cấu hình"}

    @staticmethod
    def open_folder() -> Dict[str, Any]:
        """Mở nhanh thư mục cache trong Windows File Explorer."""
        return onedrive_sync.open_onedrive_folder()
