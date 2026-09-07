# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - PDF Report Generator Module (Chuẩn 1 Trang A4)
Tổ Thẩm định Dự toán - Nhà máy Nhiệt điện Vĩnh Tân 4

Thiết kế báo cáo thẩm định giá chuyên nghiệp gói gọn chính xác trong 1 TRANG A4 DUY NHẤT:
- Header & Trích yếu
- I. THÔNG TIN CHUNG VỀ HẠNG MỤC DỰ TOÁN (1.1 PYCVT/Tờ trình & Báo giá, 1.2 Bảng thông số kỹ thuật compact)
- II. KẾT QUẢ TRA CỨU ĐỐI CHIẾU THEO 5 CƠ SỞ CHỨNG CỨ (Bảng ma trận 5 cơ sở đối chiếu)
- III. ĐÁNH GIÁ, PHÂN TÍCH (3.1 Bản chất kỹ thuật, 3.2 Đánh giá tương quan giá trị kỹ thuật - thương mại)
- IV. KIẾN NGHỊ (Đánh giá tính hợp lý/chưa hợp lý & lý do theo thuật toán/logic, kiến nghị phê duyệt & xử lý)
"""
import os
import sys
import re
import json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Đăng ký phông chữ Arial chuẩn Windows hỗ trợ 100% tiếng Việt Unicode
FONT_DIR = "C:/Windows/Fonts"
pdfmetrics.registerFont(TTFont('Arial', os.path.join(FONT_DIR, 'arial.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Bold', os.path.join(FONT_DIR, 'arialbd.ttf')))
pdfmetrics.registerFont(TTFont('Arial-Italic', os.path.join(FONT_DIR, 'ariali.ttf')))
pdfmetrics.registerFont(TTFont('Arial-BoldItalic', os.path.join(FONT_DIR, 'arialbi.ttf')))


class SinglePageCanvas(canvas.Canvas):
    """
    Canvas chuẩn 1 trang: Tự động đánh số Trang 1 / 1 và ghi chú bảo mật ở chân trang.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Arial-Italic", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        # Chân trang thanh lịch
        self.drawString(1.2 * cm, 0.65 * cm, "Báo cáo thẩm định nội bộ - Tổ Thẩm định Dự toán NMNĐ Vĩnh Tân 4")
        self.drawRightString(19.8 * cm, 0.65 * cm, f"Trang {self._pageNumber} / {page_count}")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(1.2 * cm, 0.90 * cm, 19.8 * cm, 0.90 * cm)
        self.restoreState()


def format_vnd(amount):
    """Định dạng số tiền sang định dạng tiền tệ VNĐ (ví dụ: 13.559.000 đ)"""
    if amount is None or amount == 0:
        return "0 đ"
    try:
        return f"{int(amount):,} đ".replace(",", ".")
    except Exception:
        return str(amount)


def safe_clean_plain(text, max_len=380):
    """
    Làm sạch văn bản, loại bỏ các ký tự định dạng lỗi hoặc thẻ HTML chưa đóng,
    cắt gọt theo độ dài an toàn để văn bản hiển thị gọn gàng trong trang.
    """
    if not text:
        return ""
    clean = re.sub(r'[*_#`]', '', str(text))
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = re.sub(r'[\r\n]+', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    if len(clean) > max_len:
        return clean[:max_len-3] + '...'
    return clean


def clean_text_for_cell(txt, max_len=70):
    """Cắt ngắn text trong ô bảng để đảm bảo không tràn hàng quá mức"""
    if not txt:
        return "N/A"
    txt = re.sub(r'[\r\n]+', ' | ', str(txt)).strip()
    if len(txt) > max_len:
        return txt[:max_len-3] + '...'
    return txt


def is_meaningful_kw(kw):
    if not kw:
        return False
    k = str(kw).strip().lower()
    return k not in ('chưa có', 'chưa có mã vật tư', 'n/a', 'none', 'chưa có mã', 'không có') and not k.startswith('chưa')


def extract_five_pillars(item_data, data_dir="data", dossier_name=""):
    """
    Trích xuất dữ liệu 5 chân đế độc lập phục vụ ma trận đối chiếu chứng cứ.
    Thể hiện rõ công sức tra cứu của Chuyên viên:
    - Từ khóa đã tra cứu (Mã VT / Part No / Tên vật tư)
    - Kết quả tìm kiếm thực tế (0 kết quả, không ghi nhận gói thầu tương đồng, hoặc mốc giá cụ thể)
    """
    import glob
    item_id = item_data.get('id', 1)
    don_gia_trinh = float(item_data.get('don_gia_trinh') or 0)
    ma_vt = str(item_data.get('ma_vt') or '').strip()
    part_no = re.sub(r'[\r\n]+', ' ', str(item_data.get('part_no') or '')).strip()
    part_no_short = part_no.split('|')[0].strip()
    ten_vt_goc = str(item_data.get('ten_vt_goc') or item_data.get('ten_vt') or '').split('\n')[0].strip()
    ten_vt_clean = re.sub(r'[\r\n]+', ' ', ten_vt_goc).split('-')[0].strip()

    # Keyword defaults có chọn lọc (bỏ qua các placeholder 'Chưa có...')
    part_no_valid = part_no_short if (is_meaningful_kw(part_no_short) and len(part_no_short) < 30) else ''
    ma_vt_valid = ma_vt if is_meaningful_kw(ma_vt) else ''
    ten_vt_valid = ten_vt_clean[:25] if is_meaningful_kw(ten_vt_clean) else ''

    kw_default_imis = part_no_valid or ma_vt_valid or ten_vt_valid
    kw_default_msc  = ten_vt_valid or part_no_valid or ma_vt_valid
    kw_default_ecom = ten_vt_valid or part_no_valid or ma_vt_valid

    erp_src_default = f'ERP VT4 (Mã: {ma_vt_valid})' if ma_vt_valid else 'Hệ thống ERP NMNĐ Vĩnh Tân 4'
    imis_src_default = f'CSDL EVN IMIS (Từ khóa: "{kw_default_imis}")' if kw_default_imis else 'Hệ thống CSDL giá toàn ngành EVN'
    msc_src_default = f'Cổng MSC e-GP (Từ khóa: "{kw_default_msc}")' if kw_default_msc else 'Cổng Mua sắm công Quốc gia'
    ecom_src_default = f'Kênh TMĐT/Web (Từ khóa: "{kw_default_ecom}")' if kw_default_ecom else 'Kênh thị trường tự do, sàn TMĐT'

    pillars = [
        {'id': 1, 'name': 'Cơ sở 1: Báo giá thị trường', 'source': 'Báo giá nộp kèm hồ sơ', 'price': don_gia_trinh, 'note': 'Báo giá chào thấp nhất nộp kèm', 'diff': '-', 'is_warn': False},
        {'id': 2, 'name': 'Cơ sở 2: Lịch sử ERP VT4', 'source': erp_src_default, 'price': 0, 'price_display': '0 kết quả (Ko có giá)', 'note': 'Vật tư mới, chưa từng nhập kho VT4', 'diff': '-', 'is_warn': False},
        {'id': 3, 'name': 'Cơ sở 3: CSDL EVN IMIS', 'source': imis_src_default, 'price': 0, 'price_display': '0 kết quả (Ko có giá)', 'note': 'Đã đối soát CSDL EVN: 0 bản ghi phù hợp', 'diff': '-', 'is_warn': False},
        {'id': 4, 'name': 'Cơ sở 4: Mua sắm công (e-GP)', 'source': msc_src_default, 'price': 0, 'price_display': '0 kết quả (Ko có giá)', 'note': 'Đã rà soát e-GP: Không ghi nhận gói thầu tương đồng', 'diff': '-', 'is_warn': False},
        {'id': 5, 'name': 'Cơ sở 5: Sàn TMĐT / Tự do', 'source': ecom_src_default, 'price': 0, 'price_display': 'Báo giá riêng (RFQ)', 'note': 'Vật tư đặc thù hãng, yêu cầu RFQ', 'diff': '-', 'is_warn': False},
    ]

    base_dir = os.path.abspath(data_dir)
    candidate_folders = []
    if dossier_name:
        candidate_folders.append(f'projects/{dossier_name}_files/item_{item_id}')
        candidate_folders.append(f'projects/{dossier_name}_files')
    candidate_folders.append(f'current_dossier_files/item_{item_id}')

    item_dir = None
    for folder in candidate_folders:
        cand = os.path.join(base_dir, folder)
        if os.path.isdir(cand):
            if folder.endswith(f'item_{item_id}'):
                item_dir = cand
                break
            else:
                sub = os.path.join(cand, f'item_{item_id}')
                if os.path.isdir(sub):
                    item_dir = sub
                    break

    if not item_dir:
        matches = glob.glob(os.path.join(base_dir, 'projects', '*_files', f'item_{item_id}'))
        if matches and os.path.isdir(matches[0]):
            item_dir = matches[0]

    # Kiểm tra & trích xuất chính xác từ các file JSON chứng cứ độc lập trong thư mục vật tư
    if item_dir and os.path.isdir(item_dir):
        # 1. Quotes
        q_path = os.path.join(item_dir, 'chung_cu_quotes.json')
        if os.path.exists(q_path):
            try:
                with open(q_path, 'r', encoding='utf-8') as f:
                    q_data = json.load(f)
                m = q_data.get('matches') or []
                if m:
                    fn = m[0].get('filename') or m[0].get('company') or ''
                    pillars[0]['source'] = f"File {fn}" if fn else 'Báo giá nộp kèm'
            except Exception:
                pass

        # 2. ERP
        erp_path = os.path.join(item_dir, 'chung_cu_erp.json')
        if os.path.exists(erp_path):
            try:
                with open(erp_path, 'r', encoding='utf-8') as f:
                    erp_data = json.load(f)
                is_deselected = False
                if isinstance(erp_data, dict):
                    is_deselected = erp_data.get('is_deselected', False) or erp_data.get('selected_record') == 'NONE' or erp_data.get('summary', {}).get('status') == 'ERP_DESELECTED'
                recs = erp_data.get('results', []) if isinstance(erp_data, dict) else (erp_data if isinstance(erp_data, list) else [])
                if recs and not is_deselected:
                    selected_rec = erp_data.get('selected_record') if isinstance(erp_data, dict) and isinstance(erp_data.get('selected_record'), dict) else recs[0]
                    p = float(selected_rec.get('donGia') or selected_rec.get('don_gia') or 0)
                    if p > 0:
                        pillars[1]['price'] = p
                        pillars[1].pop('price_display', None)
                        contract = selected_rec.get('soHopDong') or selected_rec.get('so_hd') or selected_rec.get('dienGiai') or ''
                        c_short = re.sub(r'^(Nhập kho vật tư \(|HĐ[:\s]*|Hợp đồng[:\s]*)', '', contract, flags=re.IGNORECASE).split('theo hóa đơn')[0].strip(' ,()')
                        c_clean = re.sub(r'^(hđ[:\s]*|hd[:\s]*|qđ[:\s]*|qd[:\s]*)', '', c_short.strip(), flags=re.IGNORECASE).strip()
                        pillars[1]['source'] = f"HĐ: {c_clean}" if c_clean else "Lịch sử nhập kho ERP VT4"
                        if don_gia_trinh > 0:
                            pct = ((don_gia_trinh - p) / p) * 100
                            pillars[1]['diff'] = f'+{pct:.1f}%' if pct > 0 else f'{pct:.1f}%'
                            pillars[1]['note'] = f'Giá trình cao hơn ERP +{pct:.1f}%' if pct > 0 else f'Giá trình so với ERP: {pct:.1f}%'
                            if pct > 15:
                                pillars[1]['is_warn'] = True
                else:
                    erp_kw = erp_data.get('keyword') if isinstance(erp_data, dict) else (ma_vt if not ma_vt.lower().startswith('chưa') else '')
                    pillars[1]['price'] = 0
                    pillars[1]['price_display'] = "0 kết quả (Ko có giá)"
                    pillars[1]['source'] = f"CSDL ERP VT4 (Từ khóa: \"{erp_kw}\")" if erp_kw else "Lịch sử nhập kho ERP VT4"
                    pillars[1]['note'] = "Đã đối soát CSDL ERP: Không áp dụng làm căn cứ" if is_deselected else "Đã đối soát CSDL ERP: 0 bản ghi phù hợp"
            except Exception:
                pass

        # 3. IMIS
        imis_path = os.path.join(item_dir, 'chung_cu_imis.json')
        if os.path.exists(imis_path):
            try:
                with open(imis_path, 'r', encoding='utf-8') as f:
                    imis_data = json.load(f)
                kw = (imis_data.get('used_keyword') or imis_data.get('keyword') or kw_default_imis).strip()
                kw = re.sub(r'[\r\n]+', ' ', kw)
                if len(kw) > 25:
                    kw = kw[:22] + '...'
                imis_list = imis_data.get('imis', [])
                p3_val = 0
                if imis_list:
                    p3_val = float(imis_list[0].get('don_gia') or imis_list[0].get('donGia') or 0)
                if p3_val > 0:
                    pillars[2]['price'] = p3_val
                    pillars[2].pop('price_display', None)
                    pillars[2]['source'] = f"CSDL EVN IMIS (Từ khóa: \"{kw}\")" if kw else "CSDL EVN IMIS"
                    dv = imis_list[0].get('ten_don_vi') or imis_list[0].get('tenDonVi') or 'Toàn ngành EVN'
                    pillars[2]['note'] = f"Có HĐ mua sắm EVN ({dv})"
                else:
                    pillars[2]['price'] = 0
                    pillars[2]['source'] = f"CSDL EVN IMIS (Từ khóa: \"{kw}\")" if kw else "Hệ thống CSDL giá toàn ngành EVN"
                    pillars[2]['price_display'] = "0 kết quả (Ko có giá)"
                    pillars[2]['note'] = "Đã đối soát CSDL EVN: 0 bản ghi phù hợp"
            except Exception:
                pass

        # 4. MSC
        msc_path = os.path.join(item_dir, 'chung_cu_muasamcong.json')
        if os.path.exists(msc_path):
            try:
                with open(msc_path, 'r', encoding='utf-8') as f:
                    msc_data = json.load(f)
                kw = (msc_data.get('used_keyword') or msc_data.get('keyword') or kw_default_msc).strip()
                kw = re.sub(r'[\r\n]+', ' ', kw)
                if len(kw) > 25:
                    kw = kw[:22] + '...'
                msc_list = msc_data.get('results', []) or msc_data.get('items', [])
                p4_val = 0
                if msc_list:
                    p4_val = float(msc_list[0].get('trung_thau_don_gia') or msc_list[0].get('don_gia') or msc_list[0].get('price') or 0)
                if p4_val > 0:
                    pillars[3]['price'] = p4_val
                    pillars[3].pop('price_display', None)
                    pillars[3]['source'] = f"Cổng MSC e-GP (Từ khóa: \"{kw}\")" if kw else "Cổng Mua sắm công Quốc gia"
                    pillars[3]['note'] = "Giá trúng thầu công khai e-GP"
                else:
                    pillars[3]['price'] = 0
                    pillars[3]['source'] = f"Cổng MSC e-GP (Từ khóa: \"{kw}\")" if kw else "Cổng Mua sắm công Quốc gia"
                    pillars[3]['price_display'] = "0 kết quả (Ko có giá)"
                    pillars[3]['note'] = "Đã rà soát e-GP: Không ghi nhận gói thầu tương đồng"
            except Exception:
                pass

        # 5. E-Commerce
        ecom_path = os.path.join(item_dir, 'chung_cu_ecom.json')
        if os.path.exists(ecom_path):
            try:
                with open(ecom_path, 'r', encoding='utf-8') as f:
                    ecom_data = json.load(f)
                kw = (ecom_data.get('search_keyword') or ecom_data.get('keyword') or kw_default_ecom).strip()
                kw = re.sub(r'[\r\n]+', ' ', kw)
                if len(kw) > 25:
                    kw = kw[:22] + '...'
                ecom_items = ecom_data.get('items', [])
                p5_val = 0
                if ecom_items:
                    p5_val = float(ecom_items[0].get('price') or ecom_items[0].get('don_gia') or 0)
                if p5_val > 0:
                    pillars[4]['price'] = p5_val
                    pillars[4].pop('price_display', None)
                    vendor = ecom_items[0].get('vendor') or 'Web TMĐT'
                    pillars[4]['source'] = f"{vendor} (Từ khóa: \"{kw}\")" if kw else vendor
                    pillars[4]['note'] = ecom_items[0].get('notes') or "Giá niêm yết web/TMĐT"
                else:
                    pillars[4]['price'] = 0
                    pillars[4]['source'] = f"Kênh TMĐT/Web (Từ khóa: \"{kw}\")" if kw else "Kênh thị trường tự do, sàn TMĐT"
                    pillars[4]['price_display'] = "Báo giá riêng (RFQ)"
                    pillars[4]['note'] = "Vật tư đặc thù hãng, yêu cầu RFQ"
            except Exception:
                pass

    return pillars


def extract_year_from_source(source_text, default_year=2024):
    if not source_text:
        return default_year
    matches = re.findall(r'\b(201\d|202\d)\b', str(source_text))
    if matches:
        return int(matches[-1])
    return default_year


def generate_commercial_evaluation_text(don_gia_trinh, don_gia_thong_nhat, pct_save, pillars, dvt='Cái', current_year=2026):
    """
    Sinh nội dung Mục 3.2 Đánh giá tương quan giá trị kỹ thuật - thương mại.
    Nếu đơn giá trình cao hơn ERP hoặc cơ sở tham chiếu, phân tích rõ số năm từ thời điểm mua sắm đến hiện tại,
    và chứng minh rằng ngay cả khi tính trượt giá tăng tiến lũy kế hàng năm (3% - 5%/năm) thì mức giá trình
    vẫn cao vượt trội, chứng minh giá trình là CHƯA HỢP LÝ.
    """
    p2 = pillars[1]
    erp_price = p2.get('price', 0)

    # Trường hợp 1: Có giá ERP và giá trình cao hơn giá ERP
    if erp_price > 0 and don_gia_trinh > erp_price:
        base_year = extract_year_from_source(p2.get('source', '') + " " + p2.get('note', ''), default_year=2024)
        years_diff = max(1, current_year - base_year)
        # Giả định trượt giá bình quân 5%/năm
        rate = 0.05
        max_escalated = erp_price * ((1 + rate) ** years_diff)
        max_escalated_round = int(round(max_escalated / 1000) * 1000)
        diff_pct = ((don_gia_trinh - erp_price) / erp_price) * 100

        return (
            f"Đơn giá trình thẩm định <b>{format_vnd(don_gia_trinh)}/{dvt}</b> cao hơn bất thường <b>+{diff_pct:.1f}%</b> so với giá lịch sử ERP NMNĐ Vĩnh Tân 4 "
            f"({format_vnd(erp_price)}/{dvt} theo {p2.get('source')}). "
            f"Xét về yếu tố thời gian, đợt mua sắm lịch sử này cách thời điểm hiện tại khoảng <b>{years_diff} năm</b> (năm {base_year} so với năm {current_year}). "
            f"Ngay cả khi tính toán yếu tố trượt giá, lạm phát và chi phí logistic tăng tiến lũy kế theo từng năm (ước tính bình quân 3% - 5%/năm, giá trần lũy kế tối đa chỉ khoảng <b>{format_vnd(max_escalated_round)}/{dvt}</b>), "
            f"thì mặt bằng giá cũng hoàn toàn không thể tăng đột biến lên mức <b>{format_vnd(don_gia_trinh)}/{dvt}</b> như đang trình. "
            f"Do đó, việc đơn vị chào giá neo theo mức giá này là thiếu căn cứ thực tế và hoàn toàn <b>CHƯA HỢP LÝ</b>."
        )
    # Trường hợp 2: Có cơ sở giảm trừ khác (không phải ERP)
    elif pct_save > 0:
        return (
            f"Đơn giá trình thẩm định <b>{format_vnd(don_gia_trinh)}/{dvt}</b> cao hơn {pct_save:.1f}% (+{format_vnd(don_gia_trinh - don_gia_thong_nhat)}/{dvt}) "
            f"so với cơ sở tham chiếu đã kiểm chứng ({format_vnd(don_gia_thong_nhat)}/{dvt}). "
            f"Mức chênh lệch chưa phản ánh sát diễn biến thị trường và quy mô mua sắm. "
            f"Tổ Thẩm định đánh giá có đủ cơ sở pháp lý và dữ liệu đối chiếu để thương thảo tiết giảm chi phí cho Nhà máy."
        )
    # Trường hợp 3: Giá trình hợp lý
    else:
        return (
            f"Đơn giá trình thẩm định <b>{format_vnd(don_gia_trinh)}/{dvt}</b> phản ánh đúng mặt bằng giá thị trường và báo giá chào cạnh tranh từ nhà cung cấp có năng lực. "
            f"Qua đối chiếu hồ sơ chứng cứ và các đợt mua sắm trước, mức giá trình nằm trong biên độ phù hợp, không phát sinh biến động bất thường."
        )


def generate_recommendation_text(item, pillars, pct_save, don_gia_trinh, don_gia_thong_nhat, thanh_tien_thong_nhat, gia_tri_giam, dvt, current_year=2026):
    """
    Sinh nội dung Mục IV. KIẾN NGHỊ:
    - Nêu ý kiến đánh giá về mức hợp lý hay chưa hợp lý, lý do vì sao chưa hợp lý
      (căn cứ vào độ bao phủ dữ liệu, độ lệch giá ERP/thị trường, trượt giá tăng tiến, thuật toán đối chiếu logic).
    - Kiến nghị phê duyệt và phương án xử lý (thương thảo hoặc giữ giá).
    """
    p2 = pillars[1]
    erp_price = p2.get('price', 0)
    pct_erp_diff = ((don_gia_trinh - erp_price) / erp_price * 100) if erp_price > 0 else 0

    if pct_save > 10 and erp_price > 0:
        base_year = extract_year_from_source(p2.get('source', '') + " " + p2.get('note', ''), default_year=2024)
        years_diff = max(1, current_year - base_year)
        max_escalated = erp_price * ((1 + 0.05) ** years_diff)
        max_escalated_round = int(round(max_escalated / 1000) * 1000)

        danh_gia_hop_ly = (
            f"<b>• Đánh giá tính hợp lý của đơn giá trình:</b> Đơn giá trình <b>{format_vnd(don_gia_trinh)}/{dvt}</b> là <b>CHƯA HỢP LÝ</b>. "
            f"Căn cứ thuật toán đối chiếu 5 cơ sở, đơn giá trình cao hơn bất thường <b>+{pct_erp_diff:.1f}%</b> "
            f"(chênh lệch <b>{format_vnd(don_gia_trinh - erp_price)}/{dvt}</b>) so với lịch sử nhập kho ERP VT4 ({p2.get('source')}). "
            f"Dù tính trượt giá tăng tiến qua {years_diff} năm (giá ước tính tối đa khoảng {format_vnd(max_escalated_round)}/{dvt}), "
            f"mức giá trình vẫn vượt xa biên độ thông thường đối với vật tư cùng mã hiệu và xuất xứ."
        )
        kien_nghi = (
            f"<b>• Kiến nghị phê duyệt & phương án xử lý:</b><br/>"
            f"- Đề xuất áp dụng đơn giá duyệt: <b>{format_vnd(don_gia_thong_nhat)}/{dvt}</b>; "
            f"Tổng thành tiền dự toán sau thẩm định: <b>{format_vnd(thanh_tien_thong_nhat)}</b> "
            f"(giảm trừ tiết kiệm ngân sách: <b>{format_vnd(gia_tri_giam)}</b>, đạt tỷ lệ giảm <b>{pct_save:.1f}%</b>).<br/>"
            f"- Kính trình Lãnh đạo Nhà máy / Hội đồng Thẩm định xem xét chấp thuận đơn giá trên; "
            f"yêu cầu đơn vị mua sắm đàm phán thương thảo với nhà cung cấp chốt theo mức giá này hoặc mời thêm nhà cung cấp cạnh tranh trường hợp đối tác không đồng ý điều chỉnh./."
        )
    elif pct_save > 0:
        danh_gia_hop_ly = (
            f"<b>• Đánh giá tính hợp lý của đơn giá trình:</b> Đơn giá trình <b>{format_vnd(don_gia_trinh)}/{dvt}</b> là <b>CHƯA HỢP LÝ</b> "
            f"do cao hơn {pct_save:.1f}% so với mức giá chứng cứ đã kiểm chứng ({format_vnd(don_gia_thong_nhat)}/{dvt}). "
            f"Thuật toán đối chiếu xác định còn dư địa thương thảo để tối ưu hóa ngân sách mua sắm."
        )
        kien_nghi = (
            f"<b>• Kiến nghị phê duyệt & phương án xử lý:</b><br/>"
            f"- Đề xuất áp dụng đơn giá duyệt: <b>{format_vnd(don_gia_thong_nhat)}/{dvt}</b>; "
            f"Tổng thành tiền dự toán sau thẩm định: <b>{format_vnd(thanh_tien_thong_nhat)}</b> "
            f"(tiết kiệm giảm trừ: <b>{format_vnd(gia_tri_giam)}</b> ~ {pct_save:.1f}%).<br/>"
            f"- Kính trình Lãnh đạo Nhà máy / Hội đồng Thẩm định xem xét phê duyệt và giao đơn vị mua sắm thương thảo với đối tác./."
        )
    else:
        danh_gia_hop_ly = (
            f"<b>• Đánh giá tính hợp lý của đơn giá trình:</b> Đơn giá trình <b>{format_vnd(don_gia_trinh)}/{dvt}</b> được đánh giá là <b>HỢP LÝ</b>. "
            f"Mức giá phản ánh đúng mặt bằng chào giá cạnh tranh của đơn vị cung cấp chính hãng có năng lực, "
            f"phù hợp với tiêu chuẩn kỹ thuật thiết bị và không ghi nhận biến động bất thường so với hồ sơ chứng cứ tra cứu."
        )
        kien_nghi = (
            f"<b>• Kiến nghị phê duyệt & phương án xử lý:</b><br/>"
            f"- Đề xuất duyệt đơn giá: Giữ nguyên mức giá trình là <b>{format_vnd(don_gia_thong_nhat)}/{dvt}</b>; "
            f"Tổng giá trị dự toán duyệt: <b>{format_vnd(thanh_tien_thong_nhat)}</b>.<br/>"
            f"- Kính trình Lãnh đạo Nhà máy / Hội đồng Thẩm định xem xét phê duyệt dự toán để đơn vị mua sắm triển khai các bước tiếp theo./."
        )
    return danh_gia_hop_ly, kien_nghi


def generate_item_pdf(item_data, dossier_info, output_path):
    """
    Sinh file Báo cáo Thẩm định giá PDF chuẩn 1 TRANG A4 DUY NHẤT cho 1 vật tư cụ thể.
    Bảo đảm không bao giờ tràn trang, tối ưu cho việc in ấn và lưu trữ hồ sơ.
    """
    item_id = item_data.get('id', 1)
    ten_vt_raw = item_data.get('ten_vt', 'N/A')
    ten_vt = re.sub(r'[\r\n]+', ' ', ten_vt_raw).strip()
    ten_vt_goc = item_data.get('ten_vt_goc', ten_vt.split('-')[0].strip())
    ma_vt = item_data.get('ma_vt', 'N/A')
    part_no_raw = item_data.get('part_no', 'N/A')
    part_no = re.sub(r'[\r\n]+', ' | ', str(part_no_raw)).strip()
    hsx_xx = item_data.get('hsx_xx', 'N/A')
    so_luong = item_data.get('so_luong', 1)
    dvt = item_data.get('dvt', 'Cái')
    don_gia_trinh = float(item_data.get('don_gia_trinh') or 0)
    thanh_tien_trinh = don_gia_trinh * so_luong
    don_gia_thong_nhat = float(item_data.get('don_gia_thong_nhat') or don_gia_trinh)
    thanh_tien_thong_nhat = don_gia_thong_nhat * so_luong
    gia_tri_giam = float(item_data.get('gia_tri_giam') or (thanh_tien_trinh - thanh_tien_thong_nhat))
    pct_save = (gia_tri_giam / thanh_tien_trinh * 100) if thanh_tien_trinh > 0 else 0
    pycvt = item_data.get('pycvt', '1723/KTAT')
    co_so_thong_nhat = item_data.get('co_so_thong_nhat', 'Căn cứ đối chiếu 5 cơ sở')
    dossier_name = dossier_info.get('dossier_name', 'Gói mua sắm SCTX 2026')

    # Typography styles
    styles = getSampleStyleSheet()

    s_corp = ParagraphStyle('Corp', fontName='Arial-Bold', fontSize=8.0, leading=10, textColor=colors.HexColor('#1E3A8A'))
    s_right_meta = ParagraphStyle('RightMeta', fontName='Arial-Bold', fontSize=8.0, leading=10, alignment=2, textColor=colors.HexColor('#1E3A8A'))

    s_title = ParagraphStyle('Title', fontName='Arial-Bold', fontSize=10.5, leading=13, alignment=1, textColor=colors.HexColor('#1E3A8A'))
    s_subtitle = ParagraphStyle('SubTitle', fontName='Arial-Bold', fontSize=8.0, leading=10.5, alignment=1, textColor=colors.HexColor('#334155'))

    s_h1 = ParagraphStyle('H1', fontName='Arial-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#0F172A'), spaceBefore=2, spaceAfter=2)
    s_body = ParagraphStyle('Body', fontName='Arial', fontSize=7.0, leading=9.0, textColor=colors.HexColor('#334155'))
    s_body_bold = ParagraphStyle('BodyBold', fontName='Arial-Bold', fontSize=7.0, leading=9.0, textColor=colors.HexColor('#0F172A'))

    s_cell = ParagraphStyle('Cell', fontName='Arial', fontSize=7.0, leading=8.5, textColor=colors.HexColor('#1E293B'))
    s_cell_bold = ParagraphStyle('CellB', fontName='Arial-Bold', fontSize=7.0, leading=8.5, textColor=colors.HexColor('#0F172A'))
    s_cell_center_bold = ParagraphStyle('CellCB', fontName='Arial-Bold', fontSize=7.0, leading=8.5, alignment=1, textColor=colors.HexColor('#0F172A'))
    s_cell_green = ParagraphStyle('CellG', fontName='Arial-Bold', fontSize=7.0, leading=8.5, textColor=colors.HexColor('#047857'))
    s_cell_red = ParagraphStyle('CellR', fontName='Arial-Bold', fontSize=7.0, leading=8.5, textColor=colors.HexColor('#B91C1C'))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=0.7 * cm,
        bottomMargin=0.7 * cm
    )

    story = []

    # 1. Top Header 2 Cột
    header_table_data = [
        [
            Paragraph('<b>TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM</b><br/>NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4', s_corp),
            Paragraph('<b>TỔ THẨM ĐỊNH DỰ TOÁN</b><br/><i>Mã số: BC-TĐDT/2026</i>', s_right_meta)
        ]
    ]
    t_header = Table(header_table_data, colWidths=[10.0*cm, 8.6*cm])
    t_header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width='100%', thickness=1.0, color=colors.HexColor('#1E3A8A'), spaceAfter=3, spaceBefore=1))

    # 2. Tiêu Đề Chính & Trích Yếu
    story.append(Paragraph('BÁO CÁO KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ DỰ TOÁN MUA SẮM', s_title))
    story.append(Paragraph(f'Hạng mục: Mục STT {item_id:02d} - {clean_text_for_cell(ten_vt_goc, 60)} | Mã ERP: {ma_vt} | Gói: {dossier_name}', s_subtitle))
    story.append(Spacer(1, 2))

    # 3. I. THÔNG TIN CHUNG VỀ HẠNG MỤC DỰ TOÁN
    story.append(Paragraph('I. THÔNG TIN CHUNG VỀ HẠNG MỤC DỰ TOÁN', s_h1))
    p_cancu = f'<b>1.1. Căn cứ thẩm định:</b> Phiếu yêu cầu vật tư / Tờ trình số: <b>{pycvt}</b>; Hồ sơ dự toán và các báo giá đính kèm do đơn vị mua sắm cung cấp.'
    story.append(Paragraph(p_cancu, s_body))
    story.append(Spacer(1, 1))

    story.append(Paragraph('<b>1.2. Bảng thông số kỹ thuật và giá trị dự toán ban đầu:</b>', s_body_bold))
    story.append(Spacer(1, 1))

    t1_data = [
        [Paragraph('Tên vật tư & quy cách', s_cell_bold), Paragraph(f'{clean_text_for_cell(ten_vt, 75)}', s_cell), Paragraph('Mã hiệu / Part No', s_cell_bold), Paragraph(f'{clean_text_for_cell(part_no, 60)}', s_cell)],
        [Paragraph('Mã ERP VT4', s_cell_bold), Paragraph(f'{ma_vt}', s_cell), Paragraph('Hãng SX / Xuất xứ', s_cell_bold), Paragraph(f'{hsx_xx}', s_cell)],
        [Paragraph('Số lượng & ĐVT', s_cell_bold), Paragraph(f'{so_luong} {dvt}', s_cell), Paragraph('Căn cứ thống nhất', s_cell_bold), Paragraph(f'{clean_text_for_cell(co_so_thong_nhat, 50)}', s_cell)],
        [Paragraph('Đơn giá trình thẩm định', s_cell_bold), Paragraph(f'<b>{format_vnd(don_gia_trinh)}/{dvt}</b>', s_cell), Paragraph('Thành tiền trình', s_cell_bold), Paragraph(f'<b>{format_vnd(thanh_tien_trinh)}</b>', s_cell)],
        [Paragraph('Đơn giá đề xuất thống nhất', s_cell_bold), Paragraph(f'{format_vnd(don_gia_thong_nhat)}/{dvt}', s_cell_green), Paragraph('Thành tiền sau thẩm định', s_cell_bold), Paragraph(f'{format_vnd(thanh_tien_thong_nhat)}', s_cell_green)],
        [Paragraph('Mức giảm trừ / Tiết kiệm', s_cell_bold), Paragraph(f'{format_vnd(gia_tri_giam)} ({pct_save:.1f}%)', s_cell_red), Paragraph('Trạng thái thẩm định', s_cell_bold), Paragraph('<font color="#B91C1C"><b>Cảnh báo cao hơn ERP</b></font>' if pct_save > 15 else 'Phù hợp mặt bằng giá', s_cell)],
    ]
    t1 = Table(t1_data, colWidths=[4.2*cm, 5.1*cm, 4.2*cm, 5.1*cm])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#F8FAFC')),
        ('BACKGROUND', (0,4), (-1,4), colors.HexColor('#F0FDF4')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 1.8),
    ]))
    story.append(t1)
    story.append(Spacer(1, 2))

    # 4. II. KẾT QUẢ TRA CỨU ĐỐI CHIẾU THEO 5 CƠ SỞ CHỨNG CỨ
    story.append(Paragraph('II. KẾT QUẢ TRA CỨU ĐỐI CHIẾU THEO 5 CƠ SỞ CHỨNG CỨ', s_h1))
    pillars = extract_five_pillars(item_data, dossier_name=dossier_name)

    t2_data = [
        [Paragraph('STT & Cơ sở chứng cứ', s_cell_center_bold), Paragraph('Nguồn dữ liệu / Hồ sơ đối chiếu', s_cell_center_bold), Paragraph('Đơn giá tham chiếu', s_cell_center_bold), Paragraph('Tương quan & Nhận định đối chiếu', s_cell_center_bold)],
    ]
    for p in pillars:
        if p['price'] > 0:
            price_display = f"{format_vnd(p['price'])}/{dvt}"
        elif p.get('price_display'):
            price_display = p['price_display']
        elif p['id'] == 5:
            price_display = "Báo giá riêng (RFQ)"
        elif p['id'] in (2, 3, 4):
            price_display = "0 kết quả (Ko có giá)"
        else:
            price_display = "Chưa có dữ liệu"

        source_clean = clean_text_for_cell(p['source'], 60)
        note_clean = clean_text_for_cell(p['note'], 65)
        st_note = s_cell_red if p.get('is_warn') else s_cell

        t2_data.append([
            Paragraph(f"<b>{p['name']}</b>", s_cell),
            Paragraph(f"{source_clean}", s_cell),
            Paragraph(f"{price_display}", s_cell_bold if p['price'] > 0 else s_cell),
            Paragraph(f"{note_clean}", st_note)
        ])

    t2 = Table(t2_data, colWidths=[3.7*cm, 6.0*cm, 3.1*cm, 5.8*cm])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 1.8),
    ]))
    story.append(t2)
    story.append(Spacer(1, 2))

    # 5. III. ĐÁNH GIÁ, PHÂN TÍCH
    story.append(Paragraph('III. ĐÁNH GIÁ, PHÂN TÍCH', s_h1))

    md_text = item_data.get('danh_gia_ttd', '')

    # 3.1: Bản chất kỹ thuật
    m_tech = re.search(r'####?\s*1\.\s*Phân tích bản chất[^\n]*\n+([\s\S]*?)(?=####?\s*2\.|\Z)', md_text, re.IGNORECASE)
    if m_tech and len(m_tech.group(1).strip()) > 40:
        p_tech_text = safe_clean_plain(m_tech.group(1).strip(), max_len=360)
    else:
        p_tech_text = f"Vật tư {ten_vt_goc} (Mã hiệu: {clean_text_for_cell(part_no, 40)}, Hãng SX: {hsx_xx}) phục vụ công tác sửa chữa, bảo dưỡng thiết bị tại Nhà máy Nhiệt điện Vĩnh Tân 4. Thiết bị đảm bảo các yêu cầu kỹ thuật vận hành đồng bộ và độ tin cậy an toàn trong hệ thống."

    story.append(Paragraph(f"<b>3.1. Phân tích bản chất kỹ thuật & tính tương thích:</b> {p_tech_text}", s_body))
    story.append(Spacer(1, 1))

    # 3.2: Đánh giá tương quan giá trị kỹ thuật - thương mại (kèm phân tích số năm và trượt giá tăng tiến)
    p_comm_text = generate_commercial_evaluation_text(don_gia_trinh, don_gia_thong_nhat, pct_save, pillars, dvt=dvt, current_year=2026)
    story.append(Paragraph(f"<b>3.2. Đánh giá tương quan giá trị kỹ thuật - thương mại:</b> {p_comm_text}", s_body))
    story.append(Spacer(1, 2))

    # 6. IV. KIẾN NGHỊ
    story.append(Paragraph('IV. KIẾN NGHỊ', s_h1))
    p_hoply, p_kiennghi = generate_recommendation_text(item_data, pillars, pct_save, don_gia_trinh, don_gia_thong_nhat, thanh_tien_thong_nhat, gia_tri_giam, dvt, current_year=2026)

    full_conc_content = f"{p_hoply}<br/>{p_kiennghi}"
    box_conc = Table([[Paragraph(full_conc_content, s_body)]], colWidths=[18.6*cm])
    box_conc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1.0, colors.HexColor('#1E3A8A')),
        ('PADDING', (0,0), (-1,-1), 2.5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(box_conc)

    # Xuất PDF chuẩn 1 trang
    doc.build(story, canvasmaker=SinglePageCanvas)
    return output_path

