import os, shutil, json, subprocess
from datetime import datetime

ONEDRIVE_ROOT = r"D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache"
BASE_DIR = r"D:\TaskApp_kiet\ThamDinhDuToanApp"
LOCAL_DATA_DIR = os.path.join(BASE_DIR, "data")
LOCAL_CONFIG_DIR = os.path.join(BASE_DIR, "config")
ONEDRIVE_DATA_DIR = os.path.join(ONEDRIVE_ROOT, "data")
ONEDRIVE_CONFIG_DIR = os.path.join(ONEDRIVE_ROOT, "config")
SYNC_STATUS_FILE = os.path.join(LOCAL_DATA_DIR, ".onedrive_sync_status.json")

def is_onedrive_available():
    return os.path.exists(ONEDRIVE_ROOT)

def get_sync_status():
    if not is_onedrive_available():
        return {
            "available": False,
            "message": "Không tìm thấy thư mục OneDrive EVN Cache trên máy.",
            "last_synced": None,
            "synced_count": 0,
            "total_files": 0
        }

    last_info = {}
    if os.path.exists(SYNC_STATUS_FILE):
        try:
            with open(SYNC_STATUS_FILE, "r", encoding="utf-8") as f:
                last_info = json.load(f)
        except Exception:
            pass

    return {
        "available": True,
        "target_dir": ONEDRIVE_ROOT,
        "last_synced": last_info.get("last_synced"),
        "synced_count": last_info.get("synced_count", 0),
        "total_files": last_info.get("total_files", 0),
        "message": "Đã kết nối thư mục OneDrive EVN Cache."
    }

def open_onedrive_folder():
    """Mở thư mục OneDrive Cache trong Windows File Explorer."""
    if not is_onedrive_available():
        return {"success": False, "message": f"Không tìm thấy thư mục: {ONEDRIVE_ROOT}"}
    try:
        os.startfile(ONEDRIVE_ROOT)
        return {"success": True, "message": f"Đã mở thư mục: {ONEDRIVE_ROOT}"}
    except Exception as e:
        try:
            subprocess.Popen(['explorer.exe', ONEDRIVE_ROOT])
            return {"success": True, "message": f"Đã mở thư mục: {ONEDRIVE_ROOT}"}
        except Exception as e2:
            return {"success": False, "message": f"Không thể mở thư mục: {e2}"}

def push_to_onedrive(verbose=False, force=False):
    if not is_onedrive_available():
        return {"success": False, "message": f"Không tìm thấy thư mục: {ONEDRIVE_ROOT}", "synced_count": 0, "total_files": 0}

    os.makedirs(ONEDRIVE_DATA_DIR, exist_ok=True)
    os.makedirs(ONEDRIVE_CONFIG_DIR, exist_ok=True)

    copied = 0
    total_files = 0
    errors = []

    # 1. Sync data/ directory
    for root, dirs, files in os.walk(LOCAL_DATA_DIR):
        rel_dir = os.path.relpath(root, LOCAL_DATA_DIR)
        target_dir = os.path.join(ONEDRIVE_DATA_DIR, rel_dir) if rel_dir != "." else ONEDRIVE_DATA_DIR
        os.makedirs(target_dir, exist_ok=True)

        for file in files:
            if file in [".onedrive_sync_status.json", ".DS_Store", "Thumbs.db"]:
                continue
            if file.endswith(".png") and "BaoCao" in file:
                continue

            total_files += 1
            src_file = os.path.join(root, file)
            dst_file = os.path.join(target_dir, file)

            should_copy = False
            if force and file in ["current_dossier.json", "active_project.json"]:
                should_copy = True
            elif not os.path.exists(dst_file):
                should_copy = True
            else:
                try:
                    if os.path.getmtime(src_file) > os.path.getmtime(dst_file) or os.path.getsize(src_file) != os.path.getsize(dst_file):
                        should_copy = True
                except Exception:
                    should_copy = True

            if should_copy:
                try:
                    shutil.copy2(src_file, dst_file)
                    copied += 1
                    if verbose:
                        print(f"[ONEDRIVE_SYNC] Copied: {rel_dir}/{file}")
                except Exception as e:
                    errors.append(f"{file}: {str(e)}")

    # 2. Sync config/ directory
    if os.path.exists(LOCAL_CONFIG_DIR):
        for file in os.listdir(LOCAL_CONFIG_DIR):
            src_file = os.path.join(LOCAL_CONFIG_DIR, file)
            if os.path.isfile(src_file):
                total_files += 1
                dst_file = os.path.join(ONEDRIVE_CONFIG_DIR, file)
                try:
                    if force or not os.path.exists(dst_file) or os.path.getmtime(src_file) > os.path.getmtime(dst_file):
                        shutil.copy2(src_file, dst_file)
                        copied += 1
                except Exception as e:
                    errors.append(f"config/{file}: {str(e)}")

    # 3. Sync root ERP.xlsx & .erp_cache.json if present
    root_files = ["ERP.xlsx", ".erp_cache.json"]
    for rf in root_files:
        src_file = os.path.join(BASE_DIR, rf)
        if os.path.isfile(src_file):
            total_files += 1
            dst_file = os.path.join(ONEDRIVE_ROOT, rf)
            try:
                if not os.path.exists(dst_file) or os.path.getmtime(src_file) > os.path.getmtime(dst_file) or os.path.getsize(src_file) != os.path.getsize(dst_file):
                    shutil.copy2(src_file, dst_file)
                    copied += 1
            except Exception as e:
                errors.append(f"{rf}: {str(e)}")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_payload = {
        "last_synced": now_str,
        "synced_count": copied,
        "total_files": total_files,
        "target_dir": ONEDRIVE_ROOT,
        "errors": errors[:5]
    }

    try:
        with open(SYNC_STATUS_FILE, "w", encoding="utf-8") as f:
            json.dump(status_payload, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    msg = f"Đã đồng bộ {copied} tệp mới sang OneDrive (Tổng số {total_files} tệp)." if copied > 0 else f"Dữ liệu OneDrive đã là mới nhất (Toàn bộ {total_files} tệp đều trùng khớp)."

    return {
        "success": len(errors) == 0,
        "synced_count": copied,
        "total_files": total_files,
        "last_synced": now_str,
        "target_dir": ONEDRIVE_ROOT,
        "message": msg,
        "errors": errors
    }

if __name__ == "__main__":
    print("--- SYNCING TO ONEDRIVE CACHE ---")
    res = push_to_onedrive(verbose=True, force=True)
    print(f"DONE: {res['message']} at {res['last_synced']}")
