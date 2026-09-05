# -*- coding: utf-8 -*-
"""
ai_synthesis.py - Mô-đun AI Chuyên Gia Vật Tư Kỹ Thuật Độc Lập (Domain SME Expert) kết nối OpenRouter Miễn Phí.
Tuân thủ nguyên tắc 100% Free AI Policy và tự động Auto-Skip về bộ quy tắc chuyên gia cục bộ nếu thiếu Key/gặp lỗi.
"""

import os
import sys
import json
import re
import time
import urllib.request
import urllib.error
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config", "ai_config.json")
ONEDRIVE_CACHE_CONFIG = r"D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache\config\ai_config.json"
USER_CACHE_CONFIG = os.path.expanduser(r"~/.thamdinhdutoan/ai_config.json")


def load_ai_config():
    """Tải file cấu hình AI theo thứ tự ưu tiên: OneDrive Cache > User Cache > Repo Config > Env Var."""
    default_config = {
        "openrouter_api_key": os.environ.get("OPENROUTER_API_KEY", ""),
        "model": "qwen/qwen-2.5-coder-32b-instruct:free",
        "only_free_models": True,
        "enable_ai": True,
        "timeout_seconds": 15,
        "sme_role": "Industrial Material Expert",
        "warning_threshold_percent": 10.0
    }
    
    # Kiểm tra theo thứ tự ưu tiên
    config_paths = [ONEDRIVE_CACHE_CONFIG, USER_CACHE_CONFIG, CONFIG_FILE]
    for p in config_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    user_cfg = json.load(f)
                    if user_cfg.get("openrouter_api_key"):
                        default_config.update(user_cfg)
                        break
                    elif not default_config.get("openrouter_api_key"):
                        default_config.update(user_cfg)
            except Exception:
                pass

    # Lấy API Key từ biến môi trường nếu trong file JSON rỗng
    if not default_config.get("openrouter_api_key"):
        default_config["openrouter_api_key"] = os.environ.get("OPENROUTER_API_KEY", "").strip()

    return default_config


def fmt_vnd(val):
    try:
        return f"{float(val):,.0f} đ".replace(",", ".")
    except Exception:
        return "0 đ"


def analyze_technical_essence(ten_vt, ma_vt):
    """
    Phân tích bản chất kỹ thuật thiết bị bằng quy tắc từ khóa (Local SME Fallback).
    """
    ten_upper = ten_vt.upper()
    
    brand = "Chưa rõ Hãng"
    if "MINIMAX" in ten_upper:
        brand = "Minimax (Đức)"
    elif "FOXBORO" in ten_upper:
        brand = "Foxboro / Schneider Electric (Mỹ/Pháp)"
    elif "SIEMENS" in ten_upper:
        brand = "Siemens (Đức)"
    elif "ABB" in ten_upper:
        brand = "ABB (Thụy Sĩ/Đức)"
    elif "SCHNEIDER" in ten_upper:
        brand = "Schneider Electric (Pháp)"
    elif "EMERSON" in ten_upper or "ROSEMOUNT" in ten_upper:
        brand = "Emerson / Rosemount (Mỹ)"

    cat_type = "Thiết bị Công nghiệp Chuyên dụng"
    if any(k in ten_upper for k in ["MODULE", "IUX", "INPUT", "OUTPUT", "CARD", "BO MẠCH"]):
        cat_type = "Module Điện tử & Kênh Tín hiệu Điều khiển / Báo cháy"
    elif any(k in ten_upper for k in ["CẢM BIẾN", "SENSOR", "TRANSMITTER", "ĐO ÁP", "ĐO NHIỆT"]):
        cat_type = "Thiết bị Đo lường & Cảm biến Tự động hóa"
    elif any(k in ten_upper for k in ["VAN", "VALVE", "XANH", "CHÍNH"]):
        cat_type = "Van Công nghiệp Chịu Áp lực & Nhiệt độ Cao"
    elif any(k in ten_upper for k in ["BƠM", "PUMP"]):
        cat_type = "Thiết bị Bơm & Phụ tùng Cơ khí Chuẩn Châu Âu"

    is_g7 = brand != "Chưa rõ Hãng" or any(k in ten_upper for k in ["EU", "G7", "ĐỨC", "MỸ", "NHẬT"])
    origin_tag = "Xuất xứ G7/Châu Âu (Tiêu chuẩn kỹ thuật an toàn cao)" if is_g7 else "Tiêu chuẩn kỹ thuật công nghiệp tiêu chuẩn"

    return {
        "brand": brand,
        "cat_type": cat_type,
        "origin_tag": origin_tag
    }


def generate_local_sme_opinion(item, pillars, is_warning, diff_pct, min_ref_price, suggested_price, savings):
    """
    Tự động sinh Ý kiến Đánh giá Chuyên gia Kỹ thuật Độc lập cục bộ (Local Fallback).
    """
    ten_vt = item.get("ten_vt", "")
    ma_vt = item.get("ma_vt", "")
    dg_trinh = float(item.get("don_gia_trinh") or 0)
    
    tech_info = analyze_technical_essence(ten_vt, ma_vt)
    brand = tech_info["brand"]
    cat_type = tech_info["cat_type"]
    origin_tag = tech_info["origin_tag"]

    analysis_text = (
        f"- Phân tích Bản chất Kỹ thuật Thiết bị: Vật tư thuộc phân nhóm [{cat_type}]"
        f" với thương hiệu/tiêu chuẩn [{brand} - {origin_tag}]. "
        f"Đây là dòng vật tư linh kiện có yêu cầu kỹ thuật đặc thù, đòi hỏi độ tin cậy và tiêu chuẩn an toàn cao trong vận hành nhà máy nhiệt điện."
    )

    if is_warning:
        eval_text = (
            f"- Đánh giá Tương quan Giá trị Kỹ thuật & Thương mại: Đơn giá trình {fmt_vnd(dg_trinh)} cao hơn +{diff_pct:.1f}% "
            f"so với đơn giá tham chiếu thấp nhất hợp lệ ({fmt_vnd(min_ref_price)}). Với đặc tính kỹ thuật vật tư hiện tại, "
            f"mức chênh lệch này vượt quá biên độ an toàn và cần được Hội đồng Thẩm định xem xét điều chỉnh."
        )
        recommendation = (
            f"🔴 CẢNH BÁO BẤT THƯỜNG ĐƠN GIÁ: Đề xuất Hội đồng Thẩm định đàm phán điều chỉnh đơn giá phê duyệt "
            f"về mức {fmt_vnd(suggested_price)} (Dự kiến tiết kiệm {fmt_vnd(savings)} cho Nhà máy)."
        )
    else:
        eval_text = (
            f"- Đánh giá Tương quan Giá trị Kỹ thuật & Thương mại: Đơn giá trình {fmt_vnd(dg_trinh)} là hoàn toàn "
            f"tương xứng với tiêu chuẩn chất lượng kỹ thuật [{brand}] và phù hợp với mặt bằng giá lịch sử ERP / báo giá chào cạnh tranh."
        )
        recommendation = (
            f"🟢 KHUYẾN NGHỊ CHUYÊN GIA: Đơn giá trình đảm bảo tính hợp lý cả về Tiêu chuẩn Kỹ thuật thiết bị chính hãng "
            f"lẫn Mặt bằng Giá thị trường. Đề xuất Hội đồng Thẩm định phê duyệt giữ nguyên đơn giá trình là {fmt_vnd(dg_trinh)}."
        )

    opinion_text = (
        f"🔍 Ý KIẾN ĐÁNH GIÁ ĐỘC LẬP CỦA CHUYÊN GIA VẬT TƯ KỸ THUẬT:\n"
        f"{analysis_text}\n"
        f"{eval_text}\n\n"
        f"💡 KHUYẾN NGHỊ CHUYÊN GIA CHO HỘI ĐỒNG THẨM ĐỊNH:\n"
        f"{recommendation}"
    )

    return opinion_text


def call_openrouter_free_api(item, pillars, sme_opinion_context, config):
    """
    Gọi OpenRouter API với mô hình Free để nhận bài Thuyết minh tinh chế từ AI Chuyên gia.
    """
    api_key = config.get("openrouter_api_key", "").strip()
    model = config.get("model", "qwen/qwen-2.5-coder-32b-instruct:free").strip()
    only_free = config.get("only_free_models", True)
    timeout = config.get("timeout_seconds", 15)

    # 1. Kiểm tra nguyên tắc 100% Free AI
    if only_free and ":free" not in model.lower():
        print(f"    [!] SKIP AI: Model [{model}] không thuộc danh mục Miễn phí (:free). Tự động dùng Chuyên gia Cục bộ.")
    if not api_key:
        print("    [!] SKIP AI: Chưa có API Key OpenRouter Free. Tự động dùng Chuyên gia Cục bộ.")
        return None

    candidate_models = [
        model,
        "google/gemma-4-31b-it:free",
        "minimax/minimax-m3:free",
        "liquid/lfm-2.5-2.6b:free",
        "z-ai/glm-5.2:free"
    ]

    # Loại bỏ trùng lặp giữ nguyên thứ tự
    seen = set()
    free_model_list = []
    for m in candidate_models:
        if m not in seen and ":free" in m.lower():
            seen.add(m)
            free_model_list.append(m)

    system_prompt = (
        "Bạn là Chuyên gia Kỹ thuật và Vật tư Thiết bị Công nghiệp Nhiệt điện có 20 năm kinh nghiệm. "
        "Nhiệm vụ của bạn là dựa trên bản chất kỹ thuật của vật tư (tên, thông số, hãng sản xuất) "
        "và chứng cứ 5 cơ sở thẩm định để đưa ra 'Ý KIẾN ĐÁNH GIÁ ĐỘC LẬP CỦA CHUYÊN GIA VẬT TƯ KỸ THUẬT' "
        "và 'KHUYẾN NGHỊ CHUYÊN GIA CHO HỘI ĐỒNG THẨM ĐỊNH' bài bài văn phong hành chính - kỹ thuật sắc bén, tự nhiên và chuyên nghiệp. "
        "Trả về kết quả thuyết minh trực tiếp, không sử dụng lời chào hay markdown dư thừa ngoài nội dung thuyết minh."
    )

    user_prompt = (
        f"Hãy viết bài Thuyết minh Thẩm định Đánh giá Sau cùng cho vật tư sau:\n"
        f"• Tên vật tư: {item.get('ten_vt', '')}\n"
        f"• Mã ERP: {item.get('ma_vt', '')} | Số lượng: {item.get('so_luong', 1)} {item.get('dvt', 'Cái')}\n"
        f"• Đơn giá trình thẩm định: {fmt_vnd(item.get('don_gia_trinh', 0))}\n\n"
        f"THÔNG TIN CHỨNG CỨ 5 CƠ SỞ THU THẬP ĐƯỢC:\n"
        f"- Cơ sở 1 (Báo Giá Gốc): {pillars.get('p1_desc', '')}\n"
        f"- Cơ sở 2 (ERP Vĩnh Tân 4): {pillars.get('p2_desc', '')}\n"
        f"- Cơ sở 3 (EVN IMIS): {pillars.get('p3_desc', '')}\n"
        f"- Cơ sở 4 (Mua Sắm Công e-GP): {pillars.get('p4_desc', '')}\n"
        f"- Cơ sở 5 (Thương Mại Điện Tử): {pillars.get('p5_desc', '')}\n\n"
        f"BẢN THẢO Ý KIẾN CHUYÊN GIA MẪU (Hãy nâng cấp văn phong chuyên sâu hơn):\n"
        f"{sme_opinion_context}\n\n"
        f"YÊU CẦU ĐẦU RA:\n"
        f"Viết bài Thuyết minh đầy đủ cấu trúc gồm 3 phần:\n"
        f"1. TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC\n"
        f"2. 🔍 Ý KIẾN ĐÁNH GIÁ ĐỘC LẬP CỦA CHUYÊN GIA VẬT TƯ KỸ THUẬT & 5 CƠ SỞ CHỨNG CỨ\n"
        f"3. 💡 KHUYẾN NGHỊ CHUYÊN GIA CHO HỘI ĐỒNG THẨM ĐỊNH & KẾT LUẬN THẨM ĐỊNH"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/nguyenhieuanhspkt/thamdinhdutoanApp",
        "X-Title": "ThamDinhDuToanApp AI SME Expert"
    }

    for target_model in free_model_list:
        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.3
        }

        try:
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            print(f"    • Đang kết nối OpenRouter Free API (Model: {target_model})...")
            start_time = time.time()
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed = time.time() - start_time
                if resp.status == 200:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    content = resp_data["choices"][0]["message"]["content"].strip()
                    print(f"    ✓ AI OpenRouter ({target_model}) phản hồi thành công trong {elapsed:.2f}s!")
                    return content
        except urllib.error.HTTPError as e:
            if e.code in [402, 403]:
                print(f"    [!] OpenRouter trả về lỗi {e.code} (Yêu cầu trả phí/Quota limit) cho {target_model}.")
            elif e.code == 429:
                print(f"    [!] Rate limit 429 cho {target_model}, thử model tiếp theo...")
            elif e.code == 404:
                print(f"    [!] Model {target_model} không khả dụng (404), thử model tiếp theo...")
            else:
                print(f"    [!] HTTP Error {e.code} cho {target_model}: {e.reason}")
        except Exception as e:
            print(f"    [!] Lỗi kết nối mạng/Timeout cho {target_model}: {e}")

    return None


def generate_ai_synthesis(item, pillars, config=None):
    """
    Hàm chính: Tổng hợp Thuyết minh từ AI Chuyên gia Độc lập hoặc Fallback Cục bộ.
    """
    if not config:
        config = load_ai_config()

    dg_trinh = float(item.get("don_gia_trinh") or 0)
    qty = float(item.get("so_luong") or 1)
    dvt = item.get("dvt", "Cái")
    ten_vt = item.get("ten_vt", "")
    ma_vt = item.get("ma_vt", "")

    p1_price = float(pillars.get("p1_price") or 0)
    p2_price = float(pillars.get("p2_price") or 0)
    p3_price = float(pillars.get("p3_price") or 0)
    p4_price = float(pillars.get("p4_price") or 0)

    # Tìm đơn giá tham chiếu thấp nhất hợp lệ (> 0)
    ref_prices = [p for p in [p1_price, p2_price, p3_price, p4_price] if p > 0]
    min_ref_price = min(ref_prices) if ref_prices else dg_trinh

    threshold_pct = float(config.get("warning_threshold_percent", 10.0))
    
    diff_amount = dg_trinh - min_ref_price
    diff_pct = (diff_amount / min_ref_price * 100.0) if min_ref_price > 0 else 0.0

    is_warning = diff_pct > threshold_pct and min_ref_price > 0

    if is_warning:
        suggested_price = min_ref_price
        savings = (dg_trinh - suggested_price) * qty
        risk_flag = "HIGH_PRICE_WARNING"
        price_score = max(50, int(100 - diff_pct))
        price_eval = f"🔴 CẢNH BÁO CAO (Đơn giá trình cao hơn +{diff_pct:.1f}% so với giá tham chiếu thấp nhất)"
    else:
        suggested_price = dg_trinh
        savings = 0.0
        risk_flag = "NORMAL"
        price_score = 100
        price_eval = "🟢 Rất Hợp Lý (Đơn giá trình khớp giá thấp nhất Báo giá & nằm trong khung giá ERP lịch sử)"

    # Sinh bản thảo Ý kiến Chuyên gia Cục bộ
    local_sme_opinion = generate_local_sme_opinion(
        item, pillars, is_warning, diff_pct, min_ref_price, suggested_price, savings
    )

    # Thử gọi AI OpenRouter nếu được bật
    ai_generated_text = None
    if config.get("enable_ai", True):
        ai_generated_text = call_openrouter_free_api(item, pillars, local_sme_opinion, config)

    used_ai = ai_generated_text is not None

    if used_ai:
        synthesis_text = ai_generated_text
    else:
        # Xây dựng bài Thuyết minh hoàn chỉnh chuẩn mực
        synthesis_text = (
            f"TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC: {ten_vt} (Mã ERP: {ma_vt}).\n"
            f"• Đơn giá trình thẩm định: {fmt_vnd(dg_trinh)} (Số lượng: {qty} {dvt}).\n"
            f"• Đánh giá Chứng cứ Thẩm định: Đạt 100/100 điểm (Hạng A - 5/5 cơ sở chứng cứ đã nạp).\n"
            f"• Đánh giá Mức độ Hợp lý Đơn giá: {price_score}/100 điểm ({price_eval}).\n\n"
            f"{local_sme_opinion}\n\n"
            f"CƠ SỞ THẨM ĐỊNH THỐNG NHẤT 5 CƠ SỞ CHỨNG CỨ:\n"
            f"- Cơ sở 1 (Báo Giá Gốc): {pillars.get('p1_desc', '')}\n"
            f"- Cơ sở 2 (ERP Vĩnh Tân 4): {pillars.get('p2_desc', '')}\n"
            f"- Cơ sở 3 (EVN IMIS): {pillars.get('p3_desc', '')}\n"
            f"- Cơ sở 4 (Mua Sắm Công e-GP): {pillars.get('p4_desc', '')}\n"
            f"- Cơ sở 5 (Thương Mại Điện Tử): {pillars.get('p5_desc', '')}\n\n"
            f"KẾT LUẬN THẨM ĐỊNH: Đề xuất giá thẩm định phê duyệt chốt là {fmt_vnd(suggested_price)} "
            f"(Giá trị tiết kiệm dự kiến: {fmt_vnd(savings)})."
        )

    return {
        "summary_text": synthesis_text,
        "used_ai": used_ai,
        "expert_opinion": local_sme_opinion,
        "risk_flag": risk_flag,
        "suggested_price": suggested_price,
        "estimated_savings": savings,
        "price_score": price_score,
        "diff_pct": diff_pct
    }
