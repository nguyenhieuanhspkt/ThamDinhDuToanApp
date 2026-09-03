# -*- coding: utf-8 -*-
"""
Module: imis_core.py
Lõi kỹ thuật tra cứu Live API EVN IMIS và CSDL Kế toán ERP Vĩnh Tân 4.
Kế thừa trọn vẹn logic từ imis_cli.py cho ứng dụng ThamDinhDuToanApp.
"""

import os
import sys
import json
import time
import base64
import requests
import urllib3
from datetime import datetime, timezone

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
CONFIG_FILE = os.path.join(CONFIG_DIR, "evn_imis_token.json")
ERP_EXCEL_FILE = os.path.join(BASE_DIR, "ERP.xlsx")
ERP_CACHE_FILE = os.path.join(CONFIG_DIR, ".erp_cache.json")

DEFAULT_API_URL = "https://api-imis.evn.com.vn/qlgia/GiaVttbNd/tonghop/muasam/toanbo"
AUTH_API_URL = "https://api-imis.evn.com.vn/identity/account/authenticate"
REFRESH_API_URL = "https://api-imis.evn.com.vn/identity/account/refresh-token"


def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Lỗi đọc file cấu hình {CONFIG_FILE}: {e}")
    return {}


def save_config(config_data):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_data, f, ensure_ascii=False, indent=2)


def decode_jwt_payload(token_str):
    try:
        token_clean = token_str.replace("Bearer ", "").strip()
        parts = token_clean.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            rem = len(payload_b64) % 4
            if rem > 0:
                payload_b64 += "=" * (4 - rem)
            payload_bytes = base64.urlsafe_b64decode(payload_b64.encode('utf-8'))
            return json.loads(payload_bytes.decode('utf-8'))
    except Exception:
        pass
    return {}


def get_token_status_info():
    cfg = load_config()
    token = cfg.get("bearer_token", "")
    if not token:
        return {
            "status": "missing",
            "is_valid": False,
            "message": "Chưa có Bearer Token",
            "remaining_minutes": 0,
            "user_name": cfg.get("user_name", "N/A"),
            "email": "N/A"
        }
        
    payload = decode_jwt_payload(token)
    exp_ts = payload.get("exp")
    u_name = payload.get("name", cfg.get("user_name", "N/A"))
    u_email = payload.get("email", "N/A")
    u_sub = payload.get("sub", cfg.get("last_username", "N/A"))
    
    if exp_ts:
        now_ts = int(time.time())
        diff_sec = exp_ts - now_ts
        exp_dt_utc = datetime.fromtimestamp(exp_ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        if diff_sec > 0:
            rem_min = diff_sec // 60
            return {
                "status": "valid",
                "is_valid": True,
                "message": f"TOKEN CÒN HIỆU LỰC (Còn {rem_min} phút)",
                "remaining_minutes": rem_min,
                "expire_at": exp_dt_utc,
                "user_name": u_name,
                "user_sub": u_sub,
                "email": u_email
            }
        else:
            return {
                "status": "expired",
                "is_valid": False,
                "message": f"TOKEN ĐÃ HẾT HẠN ({exp_dt_utc})",
                "remaining_minutes": 0,
                "expire_at": exp_dt_utc,
                "user_name": u_name,
                "user_sub": u_sub,
                "email": u_email
            }
            
    return {
        "status": "active",
        "is_valid": True,
        "message": "TOKEN ĐANG HOẠT ĐỘNG",
        "remaining_minutes": 60,
        "user_name": u_name,
        "user_sub": u_sub,
        "email": u_email
    }


def login_imis(username, password, remember_me=False):
    headers = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://imis.evn.com.vn',
        'referer': 'https://imis.evn.com.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    data_dict = {
        "userName": username,
        "password": password,
        "accountType": 1,
        "rememberMe": remember_me,
        "deviceId": "webapp"
    }
    cookies = {
        'Org_code': 'EVN',
        'ORG_DOMAIN': '.evn.com.vn'
    }
    
    session = requests.Session()
    try:
        resp = session.post(AUTH_API_URL, headers=headers, json=data_dict, cookies=cookies, verify=False, timeout=20)
    except Exception as e:
        return False, f"Lỗi kết nối máy chủ: {e}"
        
    if resp.status_code != 200:
        return False, f"HTTP {resp.status_code}: {resp.text[:100]}"
        
    try:
        res_data = resp.json()
    except Exception:
        return False, "Phản hồi không phải định dạng JSON"
        
    if res_data.get("statusCode") != 200:
        return False, res_data.get("message", "Đăng nhập không thành công")
        
    res_obj = res_data.get("resultObj", {})
    jwt_token = res_obj.get("jwtToken")
    if not jwt_token:
        return False, "Không tìm thấy jwtToken trong phản hồi"
        
    cookie_str = "; ".join([f"{k}={v}" for k, v in session.cookies.items()])
    if not cookie_str:
        cookie_str = resp.headers.get("Set-Cookie", "")
        
    cfg = load_config()
    cfg["bearer_token"] = f"Bearer {jwt_token}"
    if cookie_str:
        cfg["cookies"] = cookie_str
    if res_obj.get("fullName"):
        cfg["user_name"] = res_obj.get("fullName")
    if res_obj.get("refreshToken"):
        cfg["refresh_token"] = res_obj.get("refreshToken")
    if res_obj.get("refreshTokenExpire"):
        cfg["refresh_token_expire"] = res_obj.get("refreshTokenExpire")
    cfg["last_username"] = username
    save_config(cfg)
    return True, res_obj.get("fullName", username)


def refresh_imis_token():
    cfg = load_config()
    rf_token = cfg.get("refresh_token")
    bearer = cfg.get("bearer_token", "").replace("Bearer ", "").strip()
    if not rf_token or not bearer:
        return False, "Chưa có refresh_token hoặc bearer_token"
        
    headers = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json',
        'origin': 'https://imis.evn.com.vn',
        'referer': 'https://imis.evn.com.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    payload = {
        "token": bearer,
        "refreshToken": rf_token,
        "deviceId": "webapp"
    }
    try:
        resp = requests.post(REFRESH_API_URL, headers=headers, json=payload, verify=False, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            res_obj = data.get("resultObj", {})
            new_jwt = res_obj.get("jwtToken")
            new_rf = res_obj.get("refreshToken")
            if new_jwt:
                cfg["bearer_token"] = f"Bearer {new_jwt}"
                if new_rf:
                    cfg["refresh_token"] = new_rf
                if res_obj.get("refreshTokenExpire"):
                    cfg["refresh_token_expire"] = res_obj.get("refreshTokenExpire")
                save_config(cfg)
                return True, "Gia hạn thành công"
        else:
            return False, f"HTTP {resp.status_code}"
    except Exception as e:
        return False, str(e)
    return False, "Lỗi gia hạn"


def extract_items_from_json(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ['resultObj', 'data', 'result', 'items', 'list']:
            val = data.get(key)
            if isinstance(val, list):
                return val
            elif isinstance(val, dict):
                sub_res = extract_items_from_json(val)
                if sub_res:
                    return sub_res
    return []


def normalize_api_record(r):
    ma_vt = r.get('maVttb') or r.get('maVt') or r.get('maVatTu') or ''
    ten_vt = r.get('tenVttb') or r.get('tenVt') or r.get('tenVatTu') or ''
    dvt = r.get('dvt') or r.get('donViTinh') or ''
    don_gia = r.get('donGia') or r.get('giaTruocThue') or r.get('gia') or 0
    so_hd = r.get('soHopDong') or r.get('soHd') or 'N/A'
    
    ngay_ky = r.get('ngayKy') or r.get('ngayHopDong') or ''
    if ngay_ky and 'T' in ngay_ky:
        ngay_ky = ngay_ky.split('T')[0]
    elif not ngay_ky:
        ngay_ky = 'N/A'
        
    ten_don_vi = r.get('tenDonVi') or r.get('donVi') or ''
    
    return {
        'maVt': ma_vt,
        'maVtShort': '.'.join(ma_vt.split('.')[:5]) if '.' in ma_vt else ma_vt,
        'tenVt': ten_vt,
        'donGia': don_gia,
        'donViTinh': dvt,
        'soHopDong': so_hd,
        'ngayKy': ngay_ky,
        'tenDonVi': ten_don_vi,
        'source_type': "IMIS (live)"
    }


def query_imis_api(keyword, tu_ngay="2023-01-01", den_ngay=None, don_vi=10000, timeout=20):
    cfg = load_config()
    token = cfg.get("bearer_token", "")
    cookies = cfg.get("cookies", "")
    url = cfg.get("api_endpoint", DEFAULT_API_URL)
    
    if not den_ngay:
        den_ngay = datetime.now().strftime("%Y-%m-%d")
        
    headers = {
        'accept': 'application/json, text/plain, */*',
        'authorization': token,
        'content-type': 'application/json',
        'cookie': cookies,
        'origin': 'https://imis.evn.com.vn',
        'referer': 'https://imis.evn.com.vn/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    payload = {
        "IdDonVi": don_vi,
        "IdNhomNuocSanXuat": 0,
        "TuNgay": tu_ngay,
        "DenNgay": den_ngay,
        "maNhomVttb": "",
        "TuKhoa": keyword,
        "IdChungLoai": 0,
        "Tskt": []
    }
    
    try:
        resp = requests.post(url, headers=headers, json=payload, verify=False, timeout=timeout)
    except Exception as e:
        return [], 0, f"Lỗi kết nối mạng: {e}"
        
    if resp.status_code in (401, 403):
        ok, _ = refresh_imis_token()
        if ok:
            cfg = load_config()
            headers['authorization'] = cfg.get("bearer_token", "")
            try:
                resp = requests.post(url, headers=headers, json=payload, verify=False, timeout=timeout)
            except Exception as e:
                return [], 0, f"Lỗi kết nối sau khi làm mới token: {e}"
                
    if resp.status_code == 200:
        try:
            data = resp.json()
            raw_items = extract_items_from_json(data)
            records = [normalize_api_record(r) for r in raw_items]
            return records, 200, "OK"
        except Exception as e:
            return [], 200, f"Lỗi parse JSON: {e}"
            
    return [], resp.status_code, f"HTTP {resp.status_code}"


def get_erp_cached_records():
    if os.path.exists(ERP_CACHE_FILE):
        try:
            with open(ERP_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
            
    if not os.path.exists(ERP_EXCEL_FILE):
        return []
        
    try:
        import openpyxl
        wb = openpyxl.load_workbook(ERP_EXCEL_FILE, read_only=True, data_only=True)
        ws = wb.active
        records = []
        for idx, row in enumerate(ws.iter_rows(min_row=4, values_only=True), start=4):
            if not row or not any(row):
                continue
            so_ct = str(row[2] or "").strip()
            ngay_ct = str(row[3] or "").strip()
            if " " in ngay_ct:
                ngay_ct = ngay_ct.split(" ")[0]
            dien_giai = str(row[5] or "").strip()
            ma_vt = str(row[6] or "").strip()
            ten_vt = str(row[7] or "").strip()
            dvt = str(row[8] or "").strip()
            try:
                sl = float(row[9] or 0)
                tien = float(row[10] or 0)
                don_gia = round(tien / sl, 2) if sl > 0 else 0
            except Exception:
                don_gia = 0
            hd_str = "HĐ ERP Vĩnh Tân 4"
            if "HĐ:" in dien_giai:
                hd_str = dien_giai.split("HĐ:")[1].split(",")[0].split(")")[0].strip()
            elif "HĐ " in dien_giai:
                hd_str = dien_giai.split("HĐ ")[1].split(",")[0].split(")")[0].strip()
            records.append({
                "row_idx": idx,
                "soChungTu": so_ct,
                "ngayChungTu": ngay_ct,
                "soHopDong": hd_str,
                "ngayKy": ngay_ct if ngay_ct else "N/A",
                "maVt": ma_vt,
                "maVtShort": '.'.join(ma_vt.split('.')[:5]) if '.' in ma_vt else ma_vt,
                "tenVt": ten_vt,
                "donViTinh": dvt,
                "donGia": don_gia,
                "dienGiai": dien_giai,
                "tenDonVi": "NMNĐ Vĩnh Tân 4",
                "source_type": "CSDL ERP Vĩnh Tân 4 (Baseline)"
            })
        with open(ERP_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=1)
        return records
    except Exception as e:
        print(f"[!] Lỗi đọc file ERP.xlsx: {e}")
        return []


def search_erp_baseline(keyword, limit=15):
    all_data = get_erp_cached_records()
    if not all_data or not keyword:
        return []
    kw_clean = keyword.strip().upper()
    tokens = [t for t in kw_clean.replace(".", " ").replace("-", " ").replace("/", " ").split() if len(t) > 1]
    matches = []
    for r in all_data:
        m_upper = r["maVt"].upper()
        t_upper = r["tenVt"].upper()
        d_upper = r.get("dienGiai", "").upper()
        full_str = f"{m_upper} {t_upper} {d_upper}"
        if kw_clean in m_upper or kw_clean in t_upper:
            matches.append((3, r))
        elif tokens and all(tok in full_str for tok in tokens):
            matches.append((2, r))
        elif tokens and any(tok in m_upper or tok in t_upper for tok in tokens):
            matches.append((1, r))
    matches.sort(key=lambda x: x[0], reverse=True)
    return [m[1] for m in matches[:limit]]


def search_item_sources(keyword, tu_ngay="2023-01-01", den_ngay=None):
    imis_records, _, _ = query_imis_api(keyword, tu_ngay=tu_ngay, den_ngay=den_ngay)
    erp_records = search_erp_baseline(keyword)
    
    now_dt = datetime.now()
    for r in (imis_records + erp_records):
        nk = r.get("ngayKy")
        if nk and nk != "N/A":
            try:
                kd = datetime.strptime(nk[:10], "%Y-%m-%d")
                months_diff = (now_dt.year - kd.year) * 12 + (now_dt.month - kd.month)
                r["months_diff"] = months_diff
                r["is_within_12m"] = (months_diff <= 12)
            except Exception:
                r["months_diff"] = None
                r["is_within_12m"] = None
        else:
            r["months_diff"] = None
            r["is_within_12m"] = None
            
    return {
        "imis": imis_records,
        "erp": erp_records
    }
