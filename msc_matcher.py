# -*- coding: utf-8 -*-
"""
msc_matcher.py - Module tích hợp Mạng Đấu Thầu Quốc Gia (Mua Sắm Công - muasamcong.mpi.gov.vn)
Hỗ trợ bóc tách cURL từ DevTools, tra cứu đơn giá trúng thầu và lưu vết bằng chứng.
"""

import os
import re
import json
import requests
import urllib3

import ssl
from requests.adapters import HTTPAdapter

urllib3.disable_warnings()

class MSCSSLAdapter(HTTPAdapter):
    """
    Adapter xử lý ciphers SSL legacy cho Cổng Mua Sắm Công (muasamcong.mpi.gov.vn)
    Khắc phục triệt để lỗi SSL: DH_KEY_TOO_SMALL trên OpenSSL 3.0+ / Python 3.10+.
    """
    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        try:
            ctx.set_ciphers('DEFAULT@SECLEVEL=1')
        except Exception:
            try:
                ctx.set_ciphers('DEFAULT')
            except Exception:
                pass
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)

def get_msc_requests_session():
    """Tạo requests Session với SSL Adapter tùy chỉnh cho Mua Sắm Công."""
    s = requests.Session()
    s.mount("https://", MSCSSLAdapter())
    return s

CONFIG_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "config")
os.makedirs(CONFIG_DIR, exist_ok=True)
MSC_CONFIG_FILE = os.path.join(CONFIG_DIR, "muasamcong_session.json")

DEFAULT_ENDPOINT = "https://muasamcong.mpi.gov.vn/o/egp-portal-personal-page/services/smart/search_prc"


from datetime import datetime

def parse_curl_command(curl_str):
    """
    Bóc tách lệnh cURL (sao chép từ Chrome/Edge DevTools) thành URL, Headers và Cookies.
    """
    if not curl_str:
        return None, "Chuỗi cURL trống"

    # Tìm URL
    url = DEFAULT_ENDPOINT
    url_match = re.search(r"--url\s+['\"]([^'\"]+)['\"]", curl_str)
    if not url_match:
        url_match = re.search(r"curl\s+['\"]([^'\"]+)['\"]", curl_str)
    if url_match:
        url = url_match.group(1)

    headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://muasamcong.mpi.gov.vn',
        'Referer': 'https://muasamcong.mpi.gov.vn/web/guest/profile-info?p_p_id=egpportalpersonalpage_WAR_egpportalpersonalpage&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_egpportalpersonalpage_WAR_egpportalpersonalpage_render=personalUrl&menu=bid-pricing',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
    }

    # Bóc tách tất cả các header -H 'Header-Name: Value'
    for match in re.finditer(r"-H\s+['\"]([^:]+):\s*([^'\"]+)['\"]", curl_str):
        k, v = match.group(1).strip(), match.group(2).strip()
        if k.lower() != 'cookie':
            headers[k] = v

    # Bóc tách Cookie từ -b '...' hoặc -H 'Cookie: ...'
    cookie_str = ""
    b_match = re.search(r"-b\s+['\"]([^'\"]+)['\"]", curl_str)
    if b_match:
        cookie_str = b_match.group(1)
    else:
        c_match = re.search(r"-H\s+['\"]Cookie:\s*([^'\"]+)['\"]", curl_str, re.IGNORECASE)
        if c_match:
            cookie_str = c_match.group(1)

    if not cookie_str:
        return None, "Không tìm thấy chuỗi Cookie trong lệnh cURL"

    headers['Cookie'] = cookie_str

    session_data = {
        "url": url,
        "headers": headers,
        "cookie": cookie_str,
        "raw_curl": curl_str,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    return session_data, None


def save_msc_session(session_data):
    """Lưu session Mua Sắm Công vào file cấu hình kèm mốc thời gian."""
    if "created_at" not in session_data:
        session_data["created_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(MSC_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(session_data, f, ensure_ascii=False, indent=2)


def load_msc_session():
    """Đọc session Mua Sắm Công từ file cấu hình."""
    if os.path.exists(MSC_CONFIG_FILE):
        try:
            with open(MSC_CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def test_msc_connection(session_data=None):
    """Kiểm tra xem Session Cookie Mua Sắm Công có còn hiệu lực (200 OK) không."""
    sess = session_data or load_msc_session()
    if not sess:
        return {"active": False, "message": "Chưa thiết lập cURL / Cookie Mua Sắm Công", "created_at": "N/A", "age_str": ""}

    url = sess.get("url", DEFAULT_ENDPOINT)
    headers = sess.get("headers", {})
    created_at = sess.get("created_at") or "N/A"
    age_str = ""

    if created_at != "N/A":
        try:
            dt = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            diff_min = int((datetime.now() - dt).total_seconds() / 60)
            if diff_min < 60:
                age_str = f"({diff_min} phút trước)"
            else:
                age_str = f"({diff_min // 60}h{diff_min % 60}m trước)"
        except Exception:
            pass

    test_payload = [{
        "pageSize": 1,
        "pageNumber": 0,
        "query": [{
            "index": "es-smart-pricing",
            "keyWord": "test",
            "keyWordNotMatch": "",
            "matchType": "all-1",
            "matchFields": ["danh_muc_hang_hoa"],
            "filters": [
                {"fieldName": "type", "searchType": "in", "fieldValues": ["HANG_HOA"]},
                {"fieldName": "tab", "searchType": "in", "fieldValues": ["HANG_HOA"]}
            ]
        }]
    }]

    try:
        s = get_msc_requests_session()
        resp = s.post(url, headers=headers, json=test_payload, timeout=25, verify=False)
        if resp.status_code == 200:
            return {
                "active": True,
                "created_at": created_at,
                "age_str": age_str,
                "message": f"Kích hoạt lúc {created_at} {age_str} - Kết nối Mua Sắm Công hoạt động tốt (200 OK)"
            }
        elif resp.status_code in (401, 403):
            return {
                "active": False,
                "created_at": created_at,
                "age_str": age_str,
                "message": f"Cookie hết hạn phiên (Mã lỗi {resp.status_code}). Kích hoạt từ {created_at} {age_str}. Cần dán cURL mới!"
            }
        else:
            return {
                "active": False,
                "created_at": created_at,
                "age_str": age_str,
                "message": f"Máy chủ phản hồi mã lỗi {resp.status_code}"
            }
    except Exception as e:
        return {
            "active": False,
            "created_at": created_at,
            "age_str": age_str,
            "message": f"Lỗi kết nối: {str(e)}"
        }


def search_muasamcong(keyword, page_number=0, page_size=20):
    """
    Tra cứu đơn giá trúng thầu vật tư trên Mạng Đấu Thầu Quốc Gia e-GP có phân trang.
    """
    if not keyword or not keyword.strip():
        return {"success": False, "message": "Từ khóa trống", "items": [], "total": 0, "page_number": 0, "page_size": page_size, "total_pages": 0}

    sess = load_msc_session()
    if not sess:
        return {"success": False, "message": "Chưa có cấu hình cURL Mua Sắm Công", "items": [], "total": 0, "page_number": 0, "page_size": page_size, "total_pages": 0}

    url = sess.get("url", DEFAULT_ENDPOINT)
    headers = sess.get("headers", {})

    payload = [{
        "pageSize": page_size,
        "pageNumber": page_number,
        "query": [{
            "index": "es-smart-pricing",
            "keyWord": keyword.strip(),
            "keyWordNotMatch": "",
            "matchType": "all-1",
            "matchFields": [
                "danh_muc_hang_hoa",
                "ma_hs",
                "xuat_xu",
                "ma_tbmt",
                "ky_ma_hieu",
                "nhan_hieu",
                "hang_san_xuat"
            ],
            "filters": [
                {"fieldName": "type", "searchType": "in", "fieldValues": ["HANG_HOA"]},
                {"fieldName": "tab", "searchType": "in", "fieldValues": ["HANG_HOA"]}
            ]
        }]
    }]

    try:
        s = get_msc_requests_session()
        resp = s.post(url, headers=headers, json=payload, timeout=20, verify=False)
        if resp.status_code != 200:
            return {
                "success": False,
                "status_code": resp.status_code,
                "message": f"Cổng Mua Sắm Công trả về mã lỗi {resp.status_code}. Vui lòng dán cURL mới!",
                "items": [],
                "total": 0,
                "page_number": page_number,
                "page_size": page_size,
                "total_pages": 0
            }

        data = resp.json()
        page_info = data.get("page", {})
        raw_items = page_info.get("content", [])
        total = page_info.get("totalElements", 0)
        total_pages = page_info.get("totalPages", 1)

        cleaned_items = []
        for it in raw_items:
            price = float(it.get("donGiaDuThau") or 0.0)
            cleaned_items.append({
                "id": it.get("id"),
                "ma_tbmt": it.get("maTbmt", ""),
                "danh_muc": (it.get("danhMucHangHoa") or "").strip().replace('_x000D_', ''),
                "dvt": it.get("donViTinh", ""),
                "so_luong": float(it.get("khoiLuongDouble") or 1.0),
                "don_gia": price,
                "xuat_xu": (it.get("xuatXu") or "").strip().replace('_x000D_', ''),
                "hang_sx": it.get("hangSanXuat", "")
            })

        return {
            "success": True,
            "keyword": keyword,
            "total": total,
            "page_number": page_number,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": cleaned_items
        }
    except Exception as e:
        return {"success": False, "message": f"Lỗi gọi API: {str(e)}", "items": [], "total": 0, "page_number": page_number, "page_size": page_size, "total_pages": 0}


def analyze_msc_comparison(item, msc_results):
    """
    So sánh đơn giá trình của mục với kết quả Mua Sắm Công và sinh báo cáo bằng chứng kèm mốc thời gian và phân trang.
    """
    dg_trinh = float(item.get("don_gia_trinh") or 0.0)
    items = msc_results.get("items", [])
    keyword = msc_results.get("keyword", "")
    total = msc_results.get("total", len(items))
    page_number = msc_results.get("page_number", 0)
    page_size = msc_results.get("page_size", 20)
    total_pages = msc_results.get("total_pages", 1)
    thoi_gian_tra_cuu = datetime.now().strftime("%H:%M ngày %d/%m/%Y")

    if not items:
        return {
            "has_data": False,
            "keyword": keyword,
            "total": total,
            "page_number": page_number,
            "page_size": page_size,
            "total_pages": total_pages,
            "thoi_gian_tra_cuu": thoi_gian_tra_cuu,
            "summary_text": f"Đã tra cứu từ khóa [{keyword}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc {thoi_gian_tra_cuu} nhưng chưa ghi nhận kết quả trúng thầu tương tự."
        }

    valid_prices = [it for it in items if it["don_gia"] > 0]
    if not valid_prices:
        return {
            "has_data": False,
            "keyword": keyword,
            "total": total,
            "page_number": page_number,
            "page_size": page_size,
            "total_pages": total_pages,
            "thoi_gian_tra_cuu": thoi_gian_tra_cuu,
            "summary_text": f"Đã tra cứu từ khóa [{keyword}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc {thoi_gian_tra_cuu} nhưng không có đơn giá dự thầu hợp lệ."
        }

    valid_prices.sort(key=lambda x: x["don_gia"])
    min_msc = valid_prices[0]
    min_price = min_msc["don_gia"]

    diff_amt = dg_trinh - min_price
    diff_pct = ((dg_trinh - min_price) / min_price * 100) if min_price > 0 else 0.0

    if diff_amt <= 0:
        summary_text = (
            f"Đã tra cứu từ khóa [{keyword}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc {thoi_gian_tra_cuu}; "
            f"ghi nhận mức giá trúng thầu tham chiếu thấp nhất là {min_price:,.0f} đ (Mã TBMT: {min_msc['ma_tbmt']}). "
            f"Đơn giá trình ({dg_trinh:,.0f} đ) thấp hơn hoặc tương đương giá trúng thầu công khai trên toàn quốc."
        )
    else:
        summary_text = (
            f"Đã tra cứu từ khóa [{keyword}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc {thoi_gian_tra_cuu}; "
            f"ghi nhận đơn giá trúng thầu tham chiếu thấp nhất là {min_price:,.0f} đ (Mã TBMT: {min_msc['ma_tbmt']}). "
            f"Đơn giá trình ({dg_trinh:,.0f} đ) hiện cao hơn {diff_pct:.1f}% (+{diff_amt:,.0f} đ). "
            f"Tổ Thẩm định đề nghị xem xét tham chiếu giá Mua sắm công để tối ưu chi phí."
        )

    return {
        "has_data": True,
        "keyword": keyword,
        "total": total,
        "page_number": page_number,
        "page_size": page_size,
        "total_pages": total_pages,
        "thoi_gian_tra_cuu": thoi_gian_tra_cuu,
        "min_price": min_price,
        "min_msc": min_msc,
        "diff_amt": diff_amt,
        "diff_pct": diff_pct,
        "summary_text": summary_text,
        "items": items
    }
