# -*- coding: utf-8 -*-
"""
quote_matcher.py - Module quét và đối chiếu đơn giá dự toán với các file Báo giá PDF
Phục vụ kiểm tra nguồn gốc giá và quy tắc chọn đơn giá thấp nhất giữa các báo giá.
"""

import os
import re
import glob
import json
import pdfplumber

CACHE_FILE = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", ".quotes_cache.json")
DEFAULT_QUOTES_DIR = r"D:\onedrive_hieuna\OneDrive - EVN\Tổ Thẩm định\Năm 2026\Thẩm định 308_hieuna\Các Báo giá gửi Thẩm định"


def parse_price(val_str):
    """Chuyển đổi chuỗi giá tiền dạng '13.559.000' hoặc '16,000,000' thành số thực."""
    if not val_str:
        return 0.0
    s = str(val_str).strip()
    s = re.sub(r'[^\d.,]', '', s)
    if not s:
        return 0.0
    if '.' in s and ',' in s:
        if s.rfind(',') > s.rfind('.'):
            s = s.replace('.', '').replace(',', '.')
        else:
            s = s.replace(',', '')
    elif '.' in s:
        parts = s.split('.')
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            s = s.replace('.', '')
    elif ',' in s:
        parts = s.split(',')
        if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
            s = s.replace(',', '')
        else:
            s = s.replace(',', '.')
            
    try:
        return float(s)
    except:
        return 0.0


def extract_supplier_info(first_page_text, filename):
    """Trích xuất tên nhà thầu / công ty từ trang đầu của báo giá."""
    if not first_page_text:
        return os.path.splitext(filename)[0]
    
    lines = [l.strip() for l in first_page_text.split('\n') if l.strip()]
    company_name = ""
    for l in lines[:10]:
        l_upper = l.upper()
        if "CÔNG TY" in l_upper or "DOANH NGHIỆP" in l_upper or "TỔNG CÔNG TY" in l_upper or "CORP" in l_upper or "CO., LTD" in l_upper or "ENGINEERING" in l_upper:
            company_name = l
            break
            
    if not company_name:
        bname = os.path.splitext(filename)[0]
        company_name = bname.replace("BÁO GIÁ", "").replace("Báo giá", "").replace("Bang bao gia", "").strip()
        
    return company_name


_MEMORY_CACHE = {}


def get_folder_signature(folder, overrides=None):
    """Tính signature của folder báo giá dựa trên danh sách file, mtime và overrides."""
    if not folder or not os.path.exists(folder):
        return ""
    sig_parts = []
    try:
        files = sorted(os.listdir(folder))
        for f in files:
            if f.lower().endswith(".pdf"):
                fp = os.path.join(folder, f)
                st = os.stat(fp)
                sig_parts.append(f"{f}:{st.st_mtime}:{st.st_size}")
    except Exception:
        pass
    
    if overrides:
        sig_parts.append(f"overrides:{json.dumps(overrides, sort_keys=True)}")
        
    return "|".join(sig_parts)


def clear_quotes_cache():
    """Xóa bộ đệm cache khi cần làm mới dữ liệu."""
    global _MEMORY_CACHE
    _MEMORY_CACHE.clear()
    if os.path.exists(CACHE_FILE):
        try:
            os.remove(CACHE_FILE)
        except Exception:
            pass


def scan_quotation_folder(folder_path=None, overrides=None, force_rescan=False):
    """
    Quét toàn bộ các file PDF báo giá trong thư mục và bóc tách bảng danh mục giá.
    Sử dụng Smart Cache để tối ưu hiệu năng.
    """
    folder = folder_path or DEFAULT_QUOTES_DIR
    if not os.path.exists(folder):
        try:
            os.makedirs(folder, exist_ok=True)
        except Exception:
            return {"success": True, "message": f"Thư mục mới chưa có file: {folder}", "quotes": [], "scans": [], "docs": [], "total_files": 0}

    sig = get_folder_signature(folder, overrides=overrides)

    # 1. Kiểm tra RAM Cache nếu không ép buộc quét lại
    if not force_rescan and sig and sig in _MEMORY_CACHE:
        return _MEMORY_CACHE[sig]

    # 2. Kiểm tra Disk Cache nếu RAM Cache rỗng và không force_rescan
    if not force_rescan and sig and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                disk_cache = json.load(f)
                if disk_cache.get("signature") == sig and "result" in disk_cache:
                    _MEMORY_CACHE[sig] = disk_cache["result"]
                    return disk_cache["result"]
        except Exception:
            pass

    PRICE_KEYWORDS = ["ĐƠN GIÁ", "Đ.GIÁ", "GIÁ TIỀN", "GIÁ CHÀO", "GIÁ ĐỀ NGHỊ", "GIÁ (VNĐ)", "TIỀN (VNĐ)", "UNIT PRICE", "ĐƠN GIÁ (VND)", "ĐƠN GIÁ CHƯA VAT"]
    TOTAL_KEYWORDS = ["THÀNH TIỀN", "T.TIỀN", "T. TIỀN", "TỔNG TIỀN", "TOTAL"]
    NAME_KEYWORDS = ["TÊN", "HÀNG HÓA", "SẢN PHẨM", "HÀNG", "DANH MỤC", "DESCRIPTION", "NỘI DUNG", "CÔNG VIỆC", "VẬT TƯ"]
    TSKT_KEYWORDS = ["THÔNG SỐ", "KỸ THUẬT", "QUY CÁCH", "MÃ HIỆU", "MODEL", "PART"]
    DVT_KEYWORDS = ["ĐƠN VỊ", "Đ.VỊ", "ĐVT", "UNIT"]
    SL_KEYWORDS = ["SỐ LƯỢNG", "S.LG", "SL", "QTY"]
    ORIGIN_KEYWORDS = ["XUẤT XỨ", "HÃNG", "HSX", "NƠI SX", "ORIGIN"]
    STT_KEYWORDS = ["TT", "STT", "NO."]

    scanned_quotes = []
    scanned_scans = []
    scanned_docs = []

    for filename in sorted(os.listdir(folder)):
        if not filename.lower().endswith(".pdf"):
            continue
            
        pdf_path = os.path.join(folder, filename)
        fn_upper = filename.upper()
        if any(k in fn_upper for k in ["CÔNG VĂN", "CONG VAN", "CHỨNG NHẬN", "UY QUYEN"]):
            scanned_docs.append({
                "filename": filename,
                "file_path": pdf_path,
                "doc_type": "Văn bản hành chính / Ủy quyền",
                "status": "DOC_ADMIN"
            })
            continue

        try:
            with pdfplumber.open(pdf_path) as pdf:
                if len(pdf.pages) == 0:
                    continue
                
                all_text = "".join(p.extract_text() or "" for p in pdf.pages)
                if not all_text.strip():
                    scanned_scans.append({
                        "filename": filename,
                        "file_path": pdf_path,
                        "status": "SCAN_IMAGE",
                        "message": "Bản scan ảnh (cần OCR hoặc nhập số dư tay)"
                    })
                    continue

                p1_text = pdf.pages[0].extract_text() or ""
                company = extract_supplier_info(p1_text, filename)
                
                date_match = re.search(r'ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})', p1_text, re.IGNORECASE)
                date_str = f"{date_match.group(1)}/{date_match.group(2)}/{date_match.group(3)}" if date_match else ""
                
                supplier_items = []
                last_col_map = None
                
                for page_idx, page in enumerate(pdf.pages):
                    tbls = page.extract_tables()
                    for tbl in tbls:
                        if not tbl or len(tbl) < 1:
                            continue
                            
                        header_idx = -1
                        col_map = {}
                        for r_i, r in enumerate(tbl[:10]):
                            r_str = " ".join([re.sub(r'\s+', ' ', str(c or "").upper()).strip() for c in r])
                            has_price = any(pk in r_str for pk in PRICE_KEYWORDS)
                            has_name = any(nk in r_str for nk in NAME_KEYWORDS)
                            if has_price and has_name:
                                header_idx = r_i
                                for c_i, col in enumerate(r):
                                    cn = re.sub(r'\s+', ' ', str(col or "").upper()).strip()
                                    if any(k in cn for k in STT_KEYWORDS) and "stt" not in col_map:
                                        col_map["stt"] = c_i
                                    elif any(k in cn for k in NAME_KEYWORDS) and "ten_vt" not in col_map:
                                        col_map["ten_vt"] = c_i
                                    elif any(k in cn for k in TSKT_KEYWORDS) and "tskt" not in col_map:
                                        col_map["tskt"] = c_i
                                    elif any(k in cn for k in DVT_KEYWORDS) and "dvt" not in col_map:
                                        col_map["dvt"] = c_i
                                    elif any(k in cn for k in SL_KEYWORDS) and "sl" not in col_map:
                                        col_map["sl"] = c_i
                                    elif any(k in cn for k in ORIGIN_KEYWORDS) and "hsx_xx" not in col_map:
                                        col_map["hsx_xx"] = c_i
                                    elif any(k in cn for k in PRICE_KEYWORDS) and "don_gia" not in col_map:
                                        col_map["don_gia"] = c_i
                                    elif any(k in cn for k in TOTAL_KEYWORDS) and "thanh_tien" not in col_map:
                                        col_map["thanh_tien"] = c_i
                                last_col_map = col_map
                                break
                                
                        active_map = col_map if header_idx != -1 else last_col_map
                        start_r = header_idx + 1 if header_idx != -1 else 0

                        if not active_map or "don_gia" not in active_map:
                            continue
                            
                        for r in tbl[start_r:]:
                            if not r or not any(r):
                                continue
                            if active_map["don_gia"] >= len(r):
                                continue

                            first_cell = str(r[0] or "").upper()
                            if "TỔNG" in first_cell or "THUẾ" in first_cell or "VAT" in first_cell:
                                continue

                            price_val = parse_price(r[active_map["don_gia"]])
                            if price_val <= 0:
                                continue
                                
                            ten_val = str(r[active_map.get("ten_vt", 1)] if active_map.get("ten_vt", 1) < len(r) else "").strip()
                            tskt_val = str(r[active_map.get("tskt", 2)] if "tskt" in active_map and active_map["tskt"] < len(r) else "").strip()
                            stt_val = str(r[active_map.get("stt", 0)] if "stt" in active_map and active_map["stt"] < len(r) else "").strip()
                            dvt_val = str(r[active_map.get("dvt", 3)] if "dvt" in active_map and active_map["dvt"] < len(r) else "").strip()
                            sl_val = parse_price(r[active_map["sl"]] if "sl" in active_map and active_map["sl"] < len(r) else 1) or 1
                            tt_val = parse_price(r[active_map["thanh_tien"]] if "thanh_tien" in active_map and active_map["thanh_tien"] < len(r) else 0)
                            if tt_val <= 0:
                                tt_val = sl_val * price_val
                            
                            ten_clean = re.sub(r'\s+', ' ', ten_val.replace('\n', ' '))
                            tskt_clean = re.sub(r'\s+', ' ', tskt_val.replace('\n', ' '))
                            
                            supplier_items.append({
                                "stt": stt_val,
                                "ten_vt": ten_clean,
                                "tskt": tskt_clean,
                                "dvt": dvt_val,
                                "so_luong": sl_val,
                                "don_gia": price_val,
                                "thanh_tien": tt_val,
                                "page": page_idx + 1,
                                "pdf_file": filename,
                                "pdf_path": pdf_path
                            })

                # Fallback for borderless quotes like Bach Viet
                if len(supplier_items) == 0:
                    for page_idx, page in enumerate(pdf.pages):
                        lines = (page.extract_text() or "").split("\n")
                        for l in lines:
                            m = re.search(r'([A-Za-z0-9\s\-_/,\.]+?)\s+([A-Za-zÀ-ỹ]+)\s+(\d+)\s+([\d\.]{7,})\s+([\d\.]{7,})', l)
                            if m:
                                name_str = m.group(1).strip()
                                dvt_str = m.group(2).strip()
                                sl_val = float(m.group(3))
                                p_val = parse_price(m.group(4))
                                tt_val = parse_price(m.group(5))
                                supplier_items.append({
                                    "stt": str(len(supplier_items) + 1),
                                    "ten_vt": "Bơm Grundfos TP400 PP (Bách Việt)" if "Grundfos" in l or "TP400" in l else name_str,
                                    "tskt": name_str,
                                    "dvt": dvt_str,
                                    "so_luong": sl_val,
                                    "don_gia": p_val,
                                    "thanh_tien": tt_val,
                                    "page": page_idx + 1,
                                    "pdf_file": filename,
                                    "pdf_path": pdf_path
                                })

                if overrides and filename in overrides:
                    ov = overrides[filename]
                    supplier_items = ov.get("items", supplier_items)
                    total_amount = ov.get("total_amount", sum(it.get("thanh_tien", 0) for it in supplier_items))
                    status_quote = "USER_EDITED"
                else:
                    total_amount = sum(it.get("thanh_tien", 0) for it in supplier_items)
                    status_quote = "PARSED_OK"

                if supplier_items:
                    scanned_quotes.append({
                        "filename": filename,
                        "file_path": pdf_path,
                        "company": company,
                        "date": date_str,
                        "item_count": len(supplier_items),
                        "total_amount": total_amount,
                        "status": status_quote,
                        "items": supplier_items
                    })
        except Exception as e:
            print(f"Lỗi khi đọc file {filename}: {e}")

    # Check if any scans or docs have user overrides to promote them
    if overrides:
        for s in list(scanned_scans):
            if s["filename"] in overrides:
                ov = overrides[s["filename"]]
                scanned_quotes.append({
                    "filename": s["filename"],
                    "file_path": s["file_path"],
                    "company": s["filename"].replace(".pdf", ""),
                    "date": "",
                    "item_count": len(ov.get("items", [])),
                    "total_amount": ov.get("total_amount", 0),
                    "status": "USER_EDITED",
                    "items": ov.get("items", [])
                })
                scanned_scans.remove(s)

    result = {
        "success": True,
        "folder": folder,
        "total_files": len(scanned_quotes) + len(scanned_scans) + len(scanned_docs),
        "quotes": scanned_quotes,
        "scans": scanned_scans,
        "docs": scanned_docs
    }

    # Lưu vào RAM Cache và Disk Cache
    if sig:
        _MEMORY_CACHE[sig] = result
        try:
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({"signature": sig, "result": result}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Lỗi khi lưu disk cache báo giá: {e}")

    return result


def normalize_code(s):
    """Chuẩn hóa part number hoặc model để so khớp không phân biệt hoa thường, khoảng trắng."""
    if not s:
        return ""
    return re.sub(r'[\s\-_\./\\]', '', str(s)).upper()


COMMON_STOPWORDS = {
    "MODEL", "TYPE", "HÃNG", "XUẤT", "XỨ", "NHIỆT", "HOẠT", "ĐỘNG", "RATING", "TORQUE",
    "NHÀ", "SẢN", "CHO", "VỚI", "ĐẾN", "THEO", "TIÊU", "CHUẨN", "BỘ", "CÁI",
    "CHIẾC", "CUỘN", "MÉT", "HỘP", "KÍCH", "THƯỚC", "CHIỀU", "TRONG", "NGOÀI", "HIỆU",
    "ÁP", "SUẤT", "VẬT", "TƯ", "THIẾT", "BỊ", "CUNG", "CẤP", "GỒM", "THÔNG", "SỐ", "KỸ", "THUẬT",
    "PHỤ", "KIỆN", "LOẠI", "BẢNG", "CHÀO", "GIÁ", "NGÀY", "ĐƠN", "THÀNH", "TIỀN", "ITEM", "PART",
    "SIZE", "BAR", "VND", "VNĐ", "INCLUDE", "MANUFACTURER", "TEST", "PRESSURE"
}

PRODUCT_FAMILIES = {
    "ACTUATOR": ["ACTUATOR", "CHẤP HÀNH"],
    "SOLENOID": ["SOLENOID", "ĐIỆN TỪ"],
    "GASKET": ["GASKET", "GIOĂNG", "SPIRAL WOUND"],
    "MODULE": ["MODULE", "MODUL", "ĐẦU VÀO INPUT"],
    "VALVE": ["VALVE", "VAN", "BALL VALVE", "CHECK VALVE"],
    "FITTING": ["FITTING", "UNION", "ELBOW", "TEE", "ĐẦU NỐI", "CÚT", "KHỚP NỐI"],
    "POSITIONER": ["POSITIONER", "ĐỊNH VỊ"],
    "TUBE": ["TUBE", "ỐNG KHÍ NÉN", "ỐNG INOX", "ỐNG ĐỒNG", "ỐNG THÉP"],
    "PUMP": ["PUMP", "BƠM"],
    "BASE": ["ĐẾ GẮN", "DE GAN"],
    "BUTTON": ["NÚT NHẤN", "NUT NHAN", "EMERGENCY"],
    "RUBBER": ["CAO SU", "GIẤY CHỐNG DÍNH"]
}

def extract_meaningful_identifiers(text):
    """Trích xuất mã hiệu kỹ thuật, part no và thương hiệu có giá trị định danh cao."""
    if not text:
        return set()
    upper = text.upper()
    codes = set()
    
    # 1. Mã có dấu gạch ngang hoặc chấm (vd: 920830-113A0532, IUX-760, SS-T6-S-065-20, G-10-PL, B-210-2394/1)
    raw_hyphenated = re.findall(r'[A-Za-z0-9]+(?:[-_/.][A-Za-z0-9]+)+', upper)
    for t in raw_hyphenated:
        clean = t.strip(" -_.,/\\")
        if len(clean) >= 4 and any(c.isdigit() for c in clean):
            codes.add(clean)
            codes.add(re.sub(r'[-_/. ]', '', clean))

    # 2. Token chữ và số đứng độc lập (vd: 920830, 113A0532, DN200, PN40, 221S25F, IUX760, TZIDC110)
    words = re.findall(r'\b[A-Za-z0-9]{4,}\b', upper)
    for w in words:
        if w not in COMMON_STOPWORDS:
            if any(c.isdigit() for c in w) and any(c.isalpha() for c in w):
                codes.add(w)
            elif any(c.isdigit() for c in w) and len(w) >= 5:
                codes.add(w)

    # 3. Thương hiệu / Dòng sản phẩm đặc thù
    for brand in ["FLOWTEK", "BRAY", "SWAGELOK", "MINIMAX", "PARKER", "GRUNDFOS", "DISCOVERY", "REMA TIPTOP", "ABB", "FLOWSERVE", "ROTORK"]:
        if brand in upper:
            codes.add(brand)

    return codes


def match_item_in_quotes(item, quotes_data):
    """
    Đối chiếu 1 mục dự toán đang thẩm định với dữ liệu báo giá đã quét:
    - Loại bỏ hoàn toàn việc cộng điểm theo STT dòng để tránh so sánh nhầm hàng hóa.
    - Phát hiện xung đột nhóm hàng (VD: Actuator vs Tube/Gasket).
    - Ưu tiên chính xác Part Number, Model và Brand.
    """
    quotes = quotes_data.get("quotes", [])
    if not quotes:
        return {
            "status": "NO_QUOTES",
            "message": "Chưa có dữ liệu báo giá trong thư mục.",
            "matches": []
        }

    part_no = str(item.get("part_no") or "").strip()
    ten_vt = str(item.get("ten_vt") or "").strip()
    dg_trinh = float(item.get("don_gia_trinh") or 0)
    target_combined = f"{ten_vt} {part_no}".upper()
    target_codes = extract_meaningful_identifiers(target_combined)

    # Xác định nhóm sản phẩm của mục thẩm định
    target_fams = [fam for fam, kws in PRODUCT_FAMILIES.items() if any(kw in target_combined for kw in kws)]

    supplier_matches = []

    for q in quotes:
        best_match = None
        best_score = 0
        best_reasons = []

        for it in q["items"]:
            cand_name = (it.get("ten_vt") or "").strip()
            cand_tskt = (it.get("tskt") or "").strip()
            cand_price = float(it.get("don_gia") or 0)
            cand_combined = f"{cand_name} {cand_tskt}".upper()

            # 1. KIỂM TRA XUNG ĐỘT CHỦNG LOẠI (Hard Conflict Exclusion)
            cand_fams = [fam for fam, kws in PRODUCT_FAMILIES.items() if any(kw in cand_combined for kw in kws)]
            if target_fams and cand_fams:
                if not any(f in cand_fams for f in target_fams):
                    continue

            score = 0
            reasons = []
            cand_codes = extract_meaningful_identifiers(cand_combined)

            # 2. SO KHỚP MÃ KỸ THUẬT & PART NO (Trọng số cao nhất)
            shared_codes = target_codes.intersection(cand_codes)
            if shared_codes:
                score += len(shared_codes) * 120
                reasons.append(f"Trùng mã Part No: {', '.join(shared_codes)}")

            # 3. SO KHỚP CHỦNG LOẠI
            common_fams = set(target_fams) & set(cand_fams)
            if target_fams and cand_fams and common_fams:
                score += 60
                reasons.append(f"Cùng chủng loại: {', '.join(common_fams)}")

            # 4. SO KHỚP TÊN VẬT TƯ (Nếu tên chứa các từ đặc thù)
            clean_name_tokens = [w for w in re.findall(r'[A-Za-z0-9]{4,}', ten_vt.upper()) if w not in COMMON_STOPWORDS]
            matched_name_tokens = [w for w in clean_name_tokens if w in cand_combined]
            if matched_name_tokens:
                score += len(matched_name_tokens) * 40
                reasons.append(f"Khớp từ khóa: {', '.join(matched_name_tokens[:3])}")

            # 5. SO KHỚP ĐƠN GIÁ TRÌNH
            if dg_trinh > 0 and cand_price > 0 and abs(dg_trinh - cand_price) < 1.0:
                if score > 0 or not target_fams:
                    score += 80
                    reasons.append("Trùng khớp đơn giá trình")

            if score > best_score:
                best_score = score
                best_match = it
                best_reasons = reasons

        # Chỉ chấp nhận báo giá có độ tương đồng thực sự cao (Score >= 80)
        if best_match and best_score >= 80:
            supplier_matches.append({
                "company": q["company"],
                "filename": q["filename"],
                "file_path": q["file_path"],
                "page": best_match["page"],
                "stt": best_match.get("stt"),
                "quoted_name": best_match["ten_vt"],
                "quoted_tskt": best_match["tskt"],
                "don_gia": best_match["don_gia"],
                "is_match_trinh": abs(best_match["don_gia"] - dg_trinh) < 1.0,
                "score": best_score,
                "match_reason": " • ".join(best_reasons) if best_reasons else "Độ tương đồng cao"
            })

    if not supplier_matches:
        return {
            "status": "NOT_FOUND",
            "message": f"Không tìm thấy mục [{part_no or ten_vt}] trong các báo giá.",
            "matches": [],
            "summary_text": f"Đơn giá trình {dg_trinh:,.0f} đ chưa tìm thấy đối chiếu trong các file báo giá hiện có."
        }

    supplier_matches.sort(key=lambda x: x["don_gia"])
    min_quote = supplier_matches[0]
    min_price = min_quote["don_gia"]

    is_min = abs(dg_trinh - min_price) < 1.0
    matched_supplier = next((m for m in supplier_matches if m["is_match_trinh"]), None)

    if matched_supplier and is_min:
        status = "MATCH_MIN"
        other_quotes_txt = []
        for other in supplier_matches:
            if other != matched_supplier:
                diff_pct = ((other["don_gia"] - min_price) / min_price) * 100 if min_price > 0 else 0
                other_quotes_txt.append(f"{other['company']} báo giá {other['don_gia']:,.0f} đ (+{diff_pct:.1f}%)")
        
        others_str = f" Ngoài ra còn có: {'; '.join(other_quotes_txt)}." if other_quotes_txt else ""
        summary_text = (
            f"Đơn giá trình ({dg_trinh:,.0f} đ) là đơn giá thấp nhất theo Báo giá của {matched_supplier['company']} "
            f"(file {matched_supplier['filename']}, Trang {matched_supplier['page']}).{others_str} "
            f"Đơn giá trình phù hợp theo quy định lựa chọn mức giá thấp nhất giữa các báo giá hợp lệ."
        )
    elif matched_supplier and not is_min:
        status = "MATCH_HIGHER"
        diff_pct = ((dg_trinh - min_price) / min_price) * 100 if min_price > 0 else 0
        summary_text = (
            f"CẢNH BÁO: Đơn giá trình ({dg_trinh:,.0f} đ) lấy từ Báo giá của {matched_supplier['company']} "
            f"nhưng KHÔNG PHẢI là đơn giá thấp nhất! Đơn giá thấp nhất là {min_price:,.0f} đ của {min_quote['company']} "
            f"(file {min_quote['filename']}). Đơn giá trình cao hơn {diff_pct:.1f}%. Đề nghị điều chỉnh theo giá thấp nhất."
        )
    else:
        status = "NO_EXACT_MATCH"
        summary_text = (
            f"Đơn giá trình ({dg_trinh:,.0f} đ) không trùng với báo giá nào. "
            f"Trong đó đơn giá thấp nhất thu thập được là {min_price:,.0f} đ của {min_quote['company']} (file {min_quote['filename']})."
        )

    all_quotes_summary = [
        {
            "filename": q["filename"],
            "file_path": q["file_path"],
            "company": q["company"],
            "item_count": q["item_count"],
            "total_amount": q.get("total_amount", 0)
        }
        for q in quotes
    ]

    return {
        "status": status,
        "is_min": is_min,
        "min_price": min_price,
        "matched_supplier": matched_supplier,
        "matches": supplier_matches,
        "summary_text": summary_text,
        "all_quotes_summary": all_quotes_summary
    }
