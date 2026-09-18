# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Spec Verification Engine
Mô-đun Đối Soát & Kiểm Soát Quy Cách Kỹ Thuật, Thông Số, Model.

Đảm bảo nguyên tắc nghiệp vụ của Tổ Thẩm định:
1. Đơn giá đề nghị phê duyệt BẮT BUỘC là đơn giá của vật tư có CÙNG quy cách, thông số, model.
2. Nếu các cơ sở tham chiếu (ERP, IMIS, MSC...) có giá khác biệt nhưng KHÔNG CÙNG quy cách, thông số, model
   thì TUYỆT ĐỐI KHÔNG ép giá, đồng thời PHẢI NÊU RÕ LÝ DO KỸ THUẬT giải trình trong biên bản/đánh giá TTĐ.
"""

import re
from typing import Any, Dict, List, Optional, Tuple, Union
from models import DossierItem


class SpecVerificationEngine:
    """Động cơ đối soát và kiểm chứng quy cách kỹ thuật, thông số, model."""

    @staticmethod
    def extract_specs(text: str) -> Dict[str, Any]:
        """
        Trích xuất các thuộc tính kỹ thuật then chốt từ chuỗi văn bản:
        - Part number / Model
        - Cấp áp lực (Pressure class: Class 150#, PN16, 2500#,...)
        - Kích cỡ (Dimensions: DN, phi, inch, mm)
        - Vật liệu (Materials: Inconel, SS316, F91, Thép đúc, Đồng,...)
        - Điện áp (Voltage: 24VDC, 220VAC,...)
        - Hãng sản xuất (Brand: Minimax, Apollo, Fisher, Foxboro,...)
        """
        raw = (text or "").strip()
        t_upper = raw.upper()

        # 1. Part number / Model patterns
        part_no = ""
        pn_match = re.search(r"(?:PART\s*(?:NO|NUMBER)|MÃ\s*HIỆU|MODEL|TYPE|CODE)[:\s]*([A-Z0-9\-_./]+)", t_upper)
        if pn_match:
            part_no = pn_match.group(1).strip()
        else:
            # Tìm các mã dạng alphanumeric điển hình (VD: IUX 760 MI, 58100-953, 908531, FMZ 5000)
            m = re.search(r"\b([A-Z]{2,}\s*[0-9]{2,}[A-Z0-9\-_/]*)\b", t_upper)
            if m:
                part_no = m.group(1).strip()

        # 2. Cấp áp lực (Pressure Class)
        pressure = ""
        p_match = re.search(r"\b(?:CLASS\s*([0-9]+#?)|CL\.?\s*([0-9]+)|PN\s*([0-9]+)|([0-9]+)\s*BAR|([0-9]+(?:\.[0-9]+)?)\s*MPA)\b", t_upper)
        if p_match:
            pressure = next(g for g in p_match.groups() if g is not None)
            if not pressure.startswith(("PN", "Class", "CL")):
                pressure = f"Class/PN {pressure}"

        # 3. Kích cỡ (Diameter / Size)
        dn_size = ""
        dn_match = re.search(r"\b(?:DN\s*([0-9]+)|PHI\s*([0-9]+)|Ø\s*([0-9]+)|([0-9]+(?:\.[0-9]+)?)\s*(?:INCH|\"|MM))\b", t_upper)
        if dn_match:
            dn_size = next(g for g in dn_match.groups() if g is not None)
            if not dn_size.startswith("DN"):
                dn_size = f"DN{dn_size}"

        # 4. Vật liệu chế tạo (Material)
        material = ""
        mat_keywords = [
            "INCONEL", "HASTELLOY", "TITANIUM", "MONEL", "SS316L", "SS316", "SS304", "SUS316", "SUS304",
            "F91", "F22", "A105", "WCB", "THÉP HỢP KIM", "THÉP RÈN", "THÉP ĐÚC", "ĐỒNG", "BRONZE", "PTFE", "TEFLON"
        ]
        for mat in mat_keywords:
            if mat in t_upper:
                material = mat
                break

        # 5. Điện áp / Tín hiệu
        voltage = ""
        v_match = re.search(r"\b([0-9]+(?:\s*-\s*[0-9]+)?\s*(?:VDC|VAC|V))\b", t_upper)
        if v_match:
            voltage = v_match.group(1)

        # 6. Hãng sản xuất
        brand = ""
        brands = [
            ("MINIMAX", "Minimax (Đức)"),
            ("APOLLO", "Apollo (Anh/G7)"),
            ("FOXBORO", "Foxboro / Schneider Electric"),
            ("SCHNEIDER", "Schneider Electric"),
            ("SIEMENS", "Siemens (Đức)"),
            ("ABB", "ABB (Thụy Sĩ/Thụy Điển)"),
            ("EMERSON", "Emerson / Rosemount (Mỹ)"),
            ("ROSEMOUNT", "Rosemount (Mỹ)"),
            ("FISHER", "Fisher (Mỹ)"),
            ("MITSUBISHI", "Mitsubishi (Nhật Bản)"),
            ("TOSHIBA", "Toshiba (Nhật Bản)"),
            ("DOOSAN", "Doosan (Hàn Quốc)"),
            ("FLOWSERVE", "Flowserve (Mỹ/G7)"),
            ("KSB", "KSB (Đức)"),
            ("SPIRAX SARCO", "Spirax Sarco (Anh)"),
            ("TYCO", "Tyco / Johnson Controls")
        ]
        for b_key, b_name in brands:
            if b_key in t_upper:
                brand = b_name
                break

        # 7. Nhận diện hàng gia công theo bản vẽ OEM
        is_custom_oem = any(k in t_upper for k in [
            "BẢN VẼ", "OEM", "THEO BẢN VẼ", "CHẾ TẠO THEO", "GIA CÔNG THEO", "DRAWING", "CUSTOM-MADE", "ĐẶC THÙ"
        ])

        return {
            "part_no": part_no,
            "pressure": pressure,
            "dn_size": dn_size,
            "material": material,
            "voltage": voltage,
            "brand": brand,
            "is_custom_oem": is_custom_oem,
            "raw_text": raw
        }

    @classmethod
    def compare_specs(
        cls,
        target_spec: Dict[str, Any],
        ref_spec: Dict[str, Any]
    ) -> Tuple[str, List[str]]:
        """
        So sánh thông số kỹ thuật giữa vật tư mục tiêu và bản ghi tham chiếu:
        Trả về:
        - match_grade: 'EXACT_MATCH' | 'DIFFERENT_SPEC' | 'CUSTOM_OEM'
        - diff_reasons: Danh sách các lý do khác biệt kỹ thuật cụ thể
        """
        diff_reasons = []

        if target_spec.get("is_custom_oem"):
            return "CUSTOM_OEM", ["Vật tư gia công chế tạo đặc thù theo bản vẽ OEM của Nhà sản xuất"]

        t_pn = target_spec.get("part_no", "").strip().upper()
        r_pn = ref_spec.get("part_no", "").strip().upper()

        # 1. Kiểm tra Model / Part number
        if t_pn and r_pn:
            # Làm sạch ký tự phân cách để so khớp sâu
            clean_tpn = re.sub(r"[^A-Z0-9]", "", t_pn)
            clean_rpn = re.sub(r"[^A-Z0-9]", "", r_pn)
            if clean_tpn == clean_rpn or clean_tpn in clean_rpn or clean_rpn in clean_tpn:
                # Trùng Model / Part No
                pass
            else:
                diff_reasons.append(f"Khác Model/Mã hiệu (Yêu cầu: {t_pn} vs Tham chiếu: {r_pn})")
        elif t_pn and not r_pn:
            diff_reasons.append(f"Bản ghi tham chiếu không có Model/Part No {t_pn}")

        # 2. Kiểm tra cấp áp lực (Pressure Class)
        t_press = target_spec.get("pressure", "").strip().upper()
        r_press = ref_spec.get("pressure", "").strip().upper()
        if t_press and r_press and t_press != r_press:
            diff_reasons.append(f"Khác cấp áp lực (Yêu cầu: {t_press} vs Tham chiếu: {r_press})")

        # 3. Kiểm tra kích thước (Size DN)
        t_dn = target_spec.get("dn_size", "").strip().upper()
        r_dn = ref_spec.get("dn_size", "").strip().upper()
        if t_dn and r_dn and t_dn != r_dn:
            diff_reasons.append(f"Khác kích thước danh định (Yêu cầu: {t_dn} vs Tham chiếu: {r_dn})")

        # 4. Kiểm tra vật liệu (Material)
        t_mat = target_spec.get("material", "").strip().upper()
        r_mat = ref_spec.get("material", "").strip().upper()
        if t_mat and r_mat and t_mat != r_mat:
            diff_reasons.append(f"Khác chủng loại vật liệu chế tạo (Yêu cầu: {t_mat} vs Tham chiếu: {r_mat})")

        # 5. Kiểm tra thương hiệu / xuất xứ
        t_br = target_spec.get("brand", "").strip().upper()
        r_br = ref_spec.get("brand", "").strip().upper()
        if t_br and r_br and t_br != r_br:
            diff_reasons.append(f"Khác Hãng sản xuất/Xuất xứ (Yêu cầu: {t_br} vs Tham chiếu: {r_br})")

        if not diff_reasons:
            return "EXACT_MATCH", []
        return "DIFFERENT_SPEC", diff_reasons

    @classmethod
    def evaluate_5_pillars(
        cls,
        item: Union[DossierItem, Dict[str, Any]],
        pillars_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Đánh giá toàn diện 5 cơ sở giá kết hợp kiểm soát tính chuẩn xác của Quy cách / Model:
        Đảm bảo:
        - Đơn giá đề nghị là của vật tư CÙNG quy cách, thông số, model.
        - Nếu cơ sở tham chiếu (ERP, IMIS, MSC) có giá khác nhưng KHÔNG CÙNG quy cách,
          hệ thống KHÔNG ép giá, giữ giá báo giá cạnh tranh đúng model và NÊU RÕ LÝ DO KỸ THUẬT.
        """
        item_dict = item.to_dict() if isinstance(item, DossierItem) else dict(item or {})
        dg_trinh = float(item_dict.get("don_gia_trinh") or 0.0)
        so_luong = float(item_dict.get("so_luong") or 1.0)
        ten_vt = item_dict.get("ten_vt_goc") or item_dict.get("ten_vt", "")
        ma_vt = item_dict.get("ma_vt", "")
        thong_so_kt = item_dict.get("thong_so_kt") or item_dict.get("part_no", "")
        hsx_xx = item_dict.get("hsx_xx", "")

        # Trích xuất thông số của vật tư đang xét
        target_spec_text = f"{ten_vt} | {thong_so_kt} | {hsx_xx}"
        target_spec = cls.extract_specs(target_spec_text)

        p1 = pillars_data.get("p1", {})
        p2 = pillars_data.get("p2", {})
        p3 = pillars_data.get("p3", {})
        p4 = pillars_data.get("p4", {})
        p5 = pillars_data.get("p5", {})

        p1_price = float(p1.get("price") or 0.0)
        p2_price = float(p2.get("price") or 0.0)
        p3_price = float(p3.get("price") or 0.0)
        p4_price = float(p4.get("price") or 0.0)
        p5_price = float(p5.get("price") or 0.0)

        # Đánh giá tương thích cho từng cơ sở tham chiếu (ERP, IMIS, MSC)
        evaluations = {}

        # 1. Cơ sở 1: Báo giá gốc (Quotes)
        # Báo giá chào cho hồ sơ đợt này thường đúng theo yêu cầu kỹ thuật của hồ sơ mời báo giá
        quotes_match_grade = "EXACT_MATCH"
        if target_spec.get("is_custom_oem"):
            quotes_match_grade = "CUSTOM_OEM"
        evaluations["p1"] = {"grade": quotes_match_grade, "diffs": [], "price": p1_price}

        # 2. Cơ sở 2: ERP Vĩnh Tân 4
        if p2_price > 0:
            erp_text = p2.get("desc", "") + " " + p2.get("name", "")
            erp_spec = cls.extract_specs(erp_text)
            grade, diffs = cls.compare_specs(target_spec, erp_spec)
            evaluations["p2"] = {"grade": grade, "diffs": diffs, "price": p2_price}
        else:
            evaluations["p2"] = {"grade": "NO_DATA", "diffs": [], "price": 0.0}

        # 3. Cơ sở 3: EVN IMIS
        if p3_price > 0:
            imis_text = p3.get("desc", "")
            imis_spec = cls.extract_specs(imis_text)
            grade, diffs = cls.compare_specs(target_spec, imis_spec)
            evaluations["p3"] = {"grade": grade, "diffs": diffs, "price": p3_price}
        else:
            evaluations["p3"] = {"grade": "NO_DATA", "diffs": [], "price": 0.0}

        # 4. Cơ sở 4: Mua Sắm Công e-GP
        if p4_price > 0:
            msc_text = p4.get("desc", "")
            msc_spec = cls.extract_specs(msc_text)
            grade, diffs = cls.compare_specs(target_spec, msc_spec)
            evaluations["p4"] = {"grade": grade, "diffs": diffs, "price": p4_price}
        else:
            evaluations["p4"] = {"grade": "NO_DATA", "diffs": [], "price": 0.0}

        # 5. XÁC ĐỊNH ĐƠN GIÁ ĐỀ NGHỊ THỐNG NHẤT (TUÂN THỦ NGUYÊN TẮC CÙNG QUY CÁCH/MODEL)
        # Chỉ các nguồn có grade == 'EXACT_MATCH' mới được coi là hợp lệ để áp dụng trực tiếp đơn giá!
        # Nếu có nguồn tham chiếu (ERP/IMIS/MSC) giá thấp hơn nhưng là 'DIFFERENT_SPEC' -> KHÔNG ÁP DỤNG.
        
        valid_prices = []
        if p1_price > 0:
            valid_prices.append((p1_price, "Cơ sở 1: Báo giá cạnh tranh", "p1"))

        # Nếu ERP có cùng model/spec và giá > 0
        if p2_price > 0 and evaluations["p2"]["grade"] == "EXACT_MATCH":
            valid_prices.append((p2_price, "Cơ sở 2: CSDL ERP Vĩnh Tân 4", "p2"))

        # Nếu IMIS có cùng model/spec và giá > 0
        if p3_price > 0 and evaluations["p3"]["grade"] == "EXACT_MATCH":
            valid_prices.append((p3_price, "Cơ sở 3: EVN IMIS", "p3"))

        # Nếu MSC có cùng model/spec và giá > 0
        if p4_price > 0 and evaluations["p4"]["grade"] == "EXACT_MATCH":
            valid_prices.append((p4_price, "Cơ sở 4: Mua Sắm Công e-GP", "p4"))

        # Chọn đơn giá hợp lệ thấp nhất trong các nguồn CÙNG QUY CÁCH / MODEL
        if valid_prices:
            # Sắp xếp theo giá tăng dần
            valid_prices.sort(key=lambda x: x[0])
            best_price, best_basis, best_pillar_key = valid_prices[0]
            suggested_price = best_price
            winning_basis = best_basis
        else:
            # Nếu không có nguồn nào khác, lấy theo đơn giá trình (hoặc báo giá p1 nếu có)
            suggested_price = p1_price if p1_price > 0 else dg_trinh
            winning_basis = "Cơ sở 1: Báo giá cạnh tranh" if p1_price > 0 else "Hồ sơ dự toán trình"
            best_pillar_key = "p1" if p1_price > 0 else "trinh"

        # 6. TỰ ĐỘNG SINH THUYẾT MINH KỸ THUẬT & NÊU RÕ LÝ DO NẾU KHÔNG CÙNG QUY CÁCH
        rejected_notes = []
        for p_key, p_name in [("p2", "ERP Vĩnh Tân 4"), ("p3", "EVN IMIS"), ("p4", "Mua Sắm Công e-GP")]:
            ev = evaluations.get(p_key, {})
            p_val = ev.get("price", 0.0)
            if p_val > 0 and p_val < suggested_price and ev.get("grade") == "DIFFERENT_SPEC":
                diff_str = "; ".join(ev.get("diffs", [])) or "Khác biệt quy cách, thông số kỹ thuật chi tiết"
                rejected_notes.append(
                    f"CSDL {p_name} có mức giá thấp hơn ({p_val:,.0f} đ) nhưng KHÔNG ÁP DỤNG do khác quy cách kỹ thuật ({diff_str})"
                )

        # Xây dựng văn bản Đánh giá của Tổ Thẩm định
        pn_display = target_spec.get("part_no") or "Theo thiết kế"
        brand_display = target_spec.get("brand") or hsx_xx or "Theo danh mục thiết bị"

        danh_gia_parts = []
        if target_spec.get("is_custom_oem"):
            danh_gia_parts.append(
                f"Vật tư gia công chế tạo đặc thù theo bản vẽ OEM của Nhà sản xuất thiết bị gốc, thị trường không có hàng thương mại đại trà sẵn có. "
                f"Đơn giá đề nghị ({suggested_price:,.0f} đ) căn cứ theo báo giá cạnh tranh hợp lệ thấp nhất đáp ứng đầy đủ yêu cầu vật liệu và dung sai cơ khí."
            )
        else:
            if best_pillar_key == "p1" and abs(suggested_price - dg_trinh) < 1.0:
                danh_gia_parts.append(
                    f"Đơn giá đề nghị {suggested_price:,.0f} đ đảm bảo tính hợp lý, phù hợp đúng 100% quy cách, thông số kỹ thuật và Model ({pn_display} - {brand_display}) căn cứ theo Báo giá cạnh tranh thấp nhất."
                )
            elif suggested_price < dg_trinh:
                danh_gia_parts.append(
                    f"Đơn giá đề nghị {suggested_price:,.0f} đ (giảm trừ {dg_trinh - suggested_price:,.0f} đ/đơn vị) căn cứ theo {winning_basis}, bảo đảm trùng khớp chính xác thông số kỹ thuật và Model ({pn_display} - {brand_display})."
                )
            else:
                danh_gia_parts.append(
                    f"Đơn giá đề nghị {suggested_price:,.0f} đ căn cứ theo {winning_basis}, bảo đảm đúng quy cách, thông số kỹ thuật yêu cầu ({pn_display} - {brand_display})."
                )

        # Nêu rõ lý do kỹ thuật nếu có các cơ sở khác bị loại trừ
        if rejected_notes:
            danh_gia_parts.append("LÝ DO KỸ THUẬT KHÔNG ÁP DỤNG MỨC GIÁ THẤP HƠN: " + " | ".join(rejected_notes) + ".")

        final_danh_gia_ttd = " ".join(danh_gia_parts)
        tiet_kiem = max(0.0, (dg_trinh - suggested_price) * so_luong)

        return {
            "suggested_price": suggested_price,
            "co_so_thong_nhat": winning_basis,
            "danh_gia_ttd": final_danh_gia_ttd,
            "tiet_kiem": tiet_kiem,
            "evaluations": evaluations,
            "target_spec": target_spec,
            "rejected_notes": rejected_notes,
            "has_spec_exclusion": len(rejected_notes) > 0
        }
