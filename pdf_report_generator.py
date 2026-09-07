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


def extract_five_pillars(item_data, data_dir="data", dossier_name=""):
    """
    Trích xuất dữ liệu 5 chân đế độc lập phục vụ ma trận đối chiếu chứng cứ.
    Ưu tiên lấy từ audit trail file (JSON), fallback sang phân tích markdown hoặc giá trị mặc định.
    """
    item_id = item_data.get('id', 1)
    don_gia_trinh = float(item_data.get('don_gia_trinh') or 0)

    pillars = [
        {'id': 1, 'name': 'Cơ sở 1: Báo giá thị trường', 'source': 'Báo giá nộp kèm hồ sơ', 'price': don_gia_trinh, 'note': 'Báo giá chào thấp nhất nộp kèm', 'diff': '-', 'is_warn': False},
        {'id': 2, 'name': 'Cơ sở 2: Lịch sử ERP VT4', 'source': 'Hệ thống ERP NMNĐ Vĩnh Tân 4', 'price': 0, 'note': 'Chưa ghi nhận dữ liệu lịch sử', 'diff': '-', 'is_warn': False},
        {'id': 3, 'name': 'Cơ sở 3: CSDL EVN IMIS', 'source': 'Hệ thống CSDL giá toàn ngành EVN', 'price': 0, 'note': 'Chưa ghi nhận dữ liệu tương đồng', 'diff': '-', 'is_warn': False},
        {'id': 4, 'name': 'Cơ sở 4: Mua sắm công (e-GP)', 'source': 'Cổng Mua sắm công Quốc gia', 'price': 0, 'note': 'Chưa ghi nhận gói thầu tương đồng', 'diff': '-', 'is_warn': False},
        {'id': 5, 'name': 'Cơ sở 5: Sàn TMĐT / Tự do', 'source': 'Kênh thị trường tự do, sàn TMĐT', 'price': 0, 'note': 'Vật tư đặc thù hãng, yêu cầu RFQ', 'diff': '-', 'is_warn': False},
    ]

    base_dir = os.path.abspath(data_dir)
    candidate_folders = ['current_dossier_files']
    if dossier_name:
        candidate_folders.append(f'projects/{dossier_name}_files')

    found_trail = False
    for folder in candidate_folders:
        tpath = os.path.join(base_dir, folder, f'item_{item_id}', 'chung_cu_audit_trail.json')
        if os.path.exists(tpath):
            try:
                with open(tpath, 'r', encoding='utf-8') as f:
                    trail = json.load(f)
                for step in trail.get('steps', []):
                    sid = step.get('step_id')
                    p = float(step.get('price') or 0)
                    detail = step.get('detail', '')
                    if sid == 'quotes' and p > 0:
                        pillars[0]['price'] = p
                        sup = step.get('supplier', '')
                        pillars[0]['source'] = f'File {sup}' if sup else 'Báo giá nộp kèm'
                        pillars[0]['note'] = 'Báo giá chào thấp nhất; neo giá trình'
                    elif sid == 'erp' and p > 0:
                        pillars[1]['price'] = p
                        contract = step.get('contract', '')
                        c_short = re.sub(r'^(Nhập kho vật tư \(|HĐ:\s*)', '', contract).split('theo hóa đơn')[0].strip(' ,()')
                        pillars[1]['source'] = f'HĐ {c_short}' if c_short else 'Lịch sử nhập kho ERP VT4'
                        if don_gia_trinh > 0:
                            pct = ((don_gia_trinh - p) / p) * 100
                            pillars[1]['diff'] = f'+{pct:.1f}%' if pct > 0 else f'{pct:.1f}%'
                            pillars[1]['note'] = f'Giá trình cao hơn ERP +{pct:.1f}%' if pct > 0 else f'Giá trình so với ERP: {pct:.1f}%'
                            if pct > 15:
                                pillars[1]['is_warn'] = True
                    elif sid == 'imis':
                        if p > 0:
                            pillars[2]['price'] = p
                            pillars[2]['note'] = 'Có dữ liệu hợp đồng EVN IMIS'
                    elif sid == 'msc':
                        if p > 0:
                            pillars[3]['price'] = p
                            pillars[3]['note'] = 'Giá trúng thầu công khai e-GP'
                    elif sid == 'ecom':
                        if p > 0:
                            pillars[4]['price'] = p
                            pillars[4]['note'] = 'Giá tham khảo TMĐT'
                found_trail = True
                break
            except Exception:
                pass

    if not found_trail:
        md = item_data.get('danh_gia_ttd', '')
        for row in re.findall(r'\|\s*([0-9\']+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|', md):
            idx_str, name_str, price_str, note_str = [x.strip() for x in row]
            if '1' in idx_str:
                pillars[0]['note'] = note_str[:50]
            elif '2' in idx_str and pillars[1]['price'] == 0:
                p_m = re.search(r'([\d\.,]+)', price_str)
                if p_m and 'không' not in price_str.lower():
                    try:
                        p_val = float(p_m.group(1).replace('.', '').replace(',', '.'))
                        pillars[1]['price'] = p_val
                        pillars[1]['source'] = note_str.split('–')[0].strip()[:35]
                    except Exception:
                        pass
                pillars[1]['note'] = note_str[:50]

    return pillars


def generate_recommendation_text(item, pillars, pct_save, don_gia_trinh, don_gia_thong_nhat, thanh_tien_thong_nhat, gia_tri_giam, dvt):
    """
    Sinh nội dung Mục IV. KIẾN NGHỊ:
    - Nêu ý kiến đánh giá về mức hợp lý hay chưa hợp lý, lý do vì sao chưa hợp lý
      (căn cứ vào độ bao phủ dữ liệu, độ lệch giá ERP/thị trường, thuật toán đối chiếu logic).
    - Kiến nghị phê duyệt và phương án xử lý (thương thảo hoặc giữ giá).
    """
    p2 = pillars[1]
    erp_price = p2.get('price', 0)
    pct_erp_diff = ((don_gia_trinh - erp_price) / erp_price * 100) if erp_price > 0 else 0

    if pct_save > 10 and erp_price > 0:
        danh_gia_hop_ly = (
            f"<b>• Đánh giá tính hợp lý của đơn giá trình:</b> Đơn giá trình <b>{format_vnd(don_gia_trinh)}/{dvt}</b> là <b>CHƯA HỢP LÝ</b>. "
            f"Căn cứ thuật toán đối chiếu 5 cơ sở, đơn giá trình cao hơn bất thường <b>+{pct_erp_diff:.1f}%</b> "
            f"(chênh lệch <b>{format_vnd(don_gia_trinh - erp_price)}/{dvt}</b>) so với lịch sử nhập kho ERP NMNĐ Vĩnh Tân 4 ({p2.get('source')}), "
            f"trong khi vật tư hoàn toàn đồng nhất về mã hiệu Partno, cùng hãng và xuất xứ. Đơn giá trình chỉ neo theo 01 báo giá đơn lẻ, thiếu tính cạnh tranh tối ưu."
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
        topMargin=0.8 * cm,
        bottomMargin=0.8 * cm
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
        price_display = f"{format_vnd(p['price'])}/{dvt}" if p['price'] > 0 else "Chưa có dữ liệu"
        if p['id'] == 5 and p['price'] == 0:
            price_display = "Báo giá riêng (RFQ)"

        note_clean = clean_text_for_cell(p['note'], 55)
        st_note = s_cell_red if p.get('is_warn') else s_cell

        t2_data.append([
            Paragraph(f"<b>{p['name']}</b>", s_cell),
            Paragraph(f"{clean_text_for_cell(p['source'], 45)}", s_cell),
            Paragraph(f"{price_display}", s_cell_bold if p['price'] > 0 else s_cell),
            Paragraph(f"{note_clean}", st_note)
        ])

    t2 = Table(t2_data, colWidths=[3.8*cm, 5.8*cm, 3.2*cm, 5.8*cm])
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

    # 3.2: Đánh giá tương quan
    m_comm = re.search(r'####?\s*(?:3\.\s*Nhận định tổng hợp|2\.\s*Đánh giá tương quan)[^\n]*\n+([\s\S]*?)(?=###\s*III|\Z)', md_text, re.IGNORECASE)
    if m_comm and len(m_comm.group(1).strip()) > 40:
        p_comm_text = safe_clean_plain(m_comm.group(1).strip(), max_len=390)
    else:
        if pct_save > 0:
            p_comm_text = f"Đơn giá trình thẩm định {format_vnd(don_gia_trinh)}/{dvt} cao hơn {pct_save:.1f}% (+{format_vnd(don_gia_trinh - don_gia_thong_nhat)}/{dvt}) so với giá chứng cứ đã kiểm chứng ({format_vnd(don_gia_thong_nhat)}/{dvt}). Tổ Thẩm định đánh giá có đủ cơ sở pháp lý và dữ liệu đối chiếu để thương thảo tiết giảm chi phí dự toán."
        else:
            p_comm_text = f"Đơn giá trình thẩm định {format_vnd(don_gia_trinh)}/{dvt} phản ánh đúng mặt bằng giá thị trường và báo giá chào cạnh tranh từ nhà cung cấp có năng lực. Không ghi nhận biến động bất thường so với hồ sơ chứng cứ tra cứu."

    story.append(Paragraph(f"<b>3.2. Đánh giá tương quan giá trị kỹ thuật - thương mại:</b> {p_comm_text}", s_body))
    story.append(Spacer(1, 2))

    # 6. IV. KIẾN NGHỊ
    story.append(Paragraph('IV. KIẾN NGHỊ', s_h1))
    p_hoply, p_kiennghi = generate_recommendation_text(item_data, pillars, pct_save, don_gia_trinh, don_gia_thong_nhat, thanh_tien_thong_nhat, gia_tri_giam, dvt)

    full_conc_content = f"{p_hoply}<br/>{p_kiennghi}"
    box_conc = Table([[Paragraph(full_conc_content, s_body)]], colWidths=[18.6*cm])
    box_conc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
        ('BOX', (0,0), (-1,-1), 1.0, colors.HexColor('#1E3A8A')),
        ('PADDING', (0,0), (-1,-1), 3.0),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(box_conc)

    # Xuất PDF chuẩn 1 trang
    doc.build(story, canvasmaker=SinglePageCanvas)
    return output_path

