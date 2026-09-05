# -*- coding: utf-8 -*-
"""
check_key_health.py - Mô-đun Quản lý Sức Khỏe & Tuổi Thọ API Key OpenRouter.
Truy vấn trực tiếp OpenRouter Auth Key API để báo cáo chi tiết trạng thái, lưu lượng và hạn ngạch của Key.
"""

import os
import sys
import json
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config", "ai_config.json")
ONEDRIVE_CACHE_CONFIG = r"D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache\config\ai_config.json"
USER_CACHE_CONFIG = os.path.expanduser(r"~/.thamdinhdutoan/ai_config.json")


def check_key_health(api_key=None):
    """
    Truy vấn trực tiếp endpoint https://openrouter.ai/api/v1/auth/key
    """
    if not api_key:
        for p in [ONEDRIVE_CACHE_CONFIG, USER_CACHE_CONFIG, CONFIG_FILE]:
            if os.path.exists(p):
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                        if cfg.get("openrouter_api_key"):
                            api_key = cfg.get("openrouter_api_key", "").strip()
                            break
                except Exception:
                    pass

    if not api_key:
        api_key = os.environ.get("OPENROUTER_API_KEY", "").strip()

    print("=" * 80)
    print("MÔ-ĐUN QUẢN LÝ SỨC KHỎE & TUỔI THỌ API KEY OPENROUTER")
    print("=" * 80)

    if not api_key:
        print("❌ LỖI: Chưa có API Key nào được cấu hình trong ai_config.json hoặc biến môi trường!")
        return None

    masked_key = f"{api_key[:12]}...{api_key[-4:]}" if len(api_key) > 16 else api_key
    print(f"• Kiểm tra Key: [{masked_key}]")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "https://github.com/nguyenhieuanhspkt/thamdinhdutoanApp",
        "X-Title": "ThamDinhDuToanApp Key Manager"
    }

    try:
        req = urllib.request.Request("https://openrouter.ai/api/v1/auth/key", headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8")).get("data", {})
                
                label = data.get("label", masked_key)
                is_free = data.get("is_free_tier", True)
                usage = data.get("usage", 0)
                usage_daily = data.get("usage_daily", 0)
                limit = data.get("limit")
                expires_at = data.get("expires_at")

                print(f"🟢 TRẠNG THÁI KEY: Đang hoạt động bình thường (ACTIVE)")
                print(f"• Nhãn Key (Label): {label}")
                print(f"• Gói tài khoản: {'MIỄN PHÍ (Free Tier)' if is_free else 'Trả phí (Paid Tier)'}")
                print(f"• Tổng chi phí đã sử dụng (Usage): ${usage:.6f} USD")
                print(f"• Chi phí sử dụng hôm nay (Daily Usage): ${usage_daily:.6f} USD")
                print(f"• Hạn ngạch giới hạn (Limit): {'Không giới hạn (Unlimited / Free Allocation)' if limit is None else f'${limit} USD'}")
                print(f"• Ngày hết hạn (Expires At): {'Không hết hạn (No Expiration / Vĩnh viễn)' if not expires_at else expires_at}")
                print("=" * 80)

                # Lưu nhật ký sức khỏe vào ai_config.json
                if os.path.exists(CONFIG_FILE):
                    try:
                        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                            cfg = json.load(f)
                        cfg["key_status"] = "ACTIVE"
                        cfg["key_is_free_tier"] = is_free
                        cfg["key_last_checked"] = data.get("created_at") or "Vừa kiểm tra"
                        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                            json.dump(cfg, f, ensure_ascii=False, indent=2)
                    except Exception:
                        pass

                return data
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"❌ XÁC THỰC THẤT BẠI (401 Unauthorized): Key đã bị vô hiệu hóa, thu hồi hoặc không hợp lệ!")
        else:
            print(f"⚠️ LỖI HTTP {e.code}: {e.reason}")
    except Exception as e:
        print(f"⚠️ LỖI KẾT NỐI MẠNG: {e}")

    print("=" * 80)
    return None


if __name__ == "__main__":
    check_key_health()
