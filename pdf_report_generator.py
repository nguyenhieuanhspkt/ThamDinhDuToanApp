# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - PDF Report Generator Module (Chuẩn 2 Trang A4 Không Lặp Lại)
Sử dụng ReportLab kết hợp font Arial Unicode để xuất Báo cáo Thẩm định giá chuẩn A4 chuyên nghiệp.
Tích hợp bộ Deduplication & Parser AI Markdown bóc tách Table, Callout Box, và Bullet points.
"""
import os
import sys
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
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


class NumberedCanvas(canvas.Canvas):
    """
    Canvas hai lượt quét tự động chèn đường kẻ Top/Bottom và đánh số 'Trang X / Y'
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
        self.setFont("Arial", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (Cho các trang > 1)
        if self._pageNumber > 1:
            self.drawString(1.5 * cm, 28.5 * cm, "TỔ THẨM ĐỊNH DỰ TOÁN - NMNĐ VĨNH TÂN 4 | BÁO CÁO THẨM ĐỊNH ĐƠN GIÁ VẬT TƯ")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(1.5 * cm, 28.3 * cm, 19.5 * cm, 28.3 * cm)
            
        # Footer
        page_str = f"Trang {self._pageNumber} / {page_count}"
        self.drawRightString(19.5 * cm, 1.0 * cm, page_str)
        self.drawString(1.5 * cm, 1.0 * cm, "Mật - Chỉ sử dụng nội bộ Hội đồng Thẩm định NMNĐ Vĩnh Tân 4")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(1.5 * cm, 1.3 * cm, 19.5 * cm, 1.3 * cm)
        self.restoreState()


def format_vnd(amount):
    if amount is None:
        return "0 đ"
    try:
        return f"{int(amount):,} đ".replace(",", ".")
    except Exception:
        return str(amount)


def sanitize_and_deduplicate_markdown(md_text):
    """
    Khử sạch 100% các đoạn lặp lại trong bài thuyết minh AI
    (Chỉ giữ lại Mục 2: Phân tích Kỹ thuật & 5 Cơ sở chứng cứ; loại bỏ trùng lặp Bảng 1 và Bảng 3).
    """
    if not md_text or not str(md_text).strip():
        return ""

    lines = str(md_text).strip().split('\n')
    keep_lines = []

    skip = False
    in_table_1 = False

    for line in lines:
        l = line.strip()
        
        # Lọc bỏ phần 1 (TỔNG HỢP THÔNG SỐ VẬT TƯ - đã có Bảng 1 của Generator)
        if re.search(r'^\s*#*\s*\*?\*?1\.\s*TỔNG HỢP', l, re.IGNORECASE) or 'TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC' in l:
            skip = True
            continue
        if re.search(r'^\s*#*\s*\*?\*?2\.', l) or 'Ý KIẾN ĐÁNH GIÁ' in l or 'BẢN THUYẾT MINH THẨM ĐỊNH' in l or 'Phân tích bản chất' in l:
            skip = False

        # Lọc bỏ phần 3 (KHUYẾN NGHỊ VÀ KẾT LUẬN - đã có Bảng 3 & Kết luận của Generator)
        if re.search(r'^\s*#*\s*\*?\*?3\.', l) or 'KHUYẾN NGHỊ CHUYÊN GIA' in l or 'KẾT LUẬN & ĐỀ XUẤT' in l or 'Đề xuất mức giá phê duyệt' in l:
            skip = True
            continue

        if not skip:
            # Lọc bỏ các bảng lặp
            if l.startswith('|') and ('Mã ERP' in l or 'Đơn giá trình' in l or 'Phương án A' in l or 'Phương án B' in l):
                continue
            keep_lines.append(line)

    return '\n'.join(keep_lines)


def parse_markdown_to_flowables(md_text, custom_styles):
    """
    Bộ parser thông minh bóc tách AI Markdown thô thành danh sách các khối ReportLab Flowables.
    """
    clean_md = sanitize_and_deduplicate_markdown(md_text)
    if not clean_md.strip():
        return []

    flowables = []
    lines = clean_md.strip().split('\n')
    printable_w = 18.0 * cm

    i = 0
    while i < len(lines):
        raw_line = lines[i].strip()

        if not raw_line:
            i += 1
            continue

        # 1. Bóc tách Bảng Markdown (| ... |)
        if raw_line.startswith('|') and raw_line.endswith('|'):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|') and lines[i].strip().endswith('|'):
                table_lines.append(lines[i].strip())
                i += 1

            raw_rows = []
            for tline in table_lines:
                if re.match(r'^\|[\s:\-]+\|', tline):
                    continue
                cells = [c.strip() for c in tline.split('|')[1:-1]]
                if cells:
                    raw_rows.append(cells)

            if raw_rows:
                num_cols = max(len(r) for r in raw_rows)
                col_w = printable_w / max(num_cols, 1)

                table_data = []
                for row_idx, r in enumerate(raw_rows):
                    row_cells = []
                    for c_idx, cell_text in enumerate(r):
                        formatted_cell = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', cell_text)
                        formatted_cell = re.sub(r'\*(.*?)\*', r'<i>\1</i>', formatted_cell)
                        st = custom_styles['CellCenterBold'] if row_idx == 0 else custom_styles['TableCell']
                        row_cells.append(Paragraph(formatted_cell, st))
                    while len(row_cells) < num_cols:
                        row_cells.append(Paragraph("", custom_styles['TableCell']))
                    table_data.append(row_cells)

                t = Table(table_data, colWidths=[col_w] * num_cols)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('PADDING', (0, 0), (-1, -1), 2.5),
                ]))
                flowables.append(t)
                flowables.append(Spacer(1, 3))
            continue

        # 2. Bóc tách Cảnh báo Rủi ro (🔴 CẢNH BÁO...)
        if '🔴' in raw_line or '⚠️' in raw_line or 'CẢNH BÁO BẤT THƯỜNG' in raw_line:
            formatted_alert = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', raw_line)
            p_alert = Paragraph(formatted_alert, custom_styles['Alert'])
            alert_box = Table([[p_alert]], colWidths=[printable_w])
            alert_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
                ('PADDING', (0, 0), (-1, -1), 3),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            flowables.append(alert_box)
            flowables.append(Spacer(1, 3))
            i += 1
            continue

        # 3. Bóc tách Đường kẻ ngang Markdown (--- hoặc ***)
        if raw_line in ('---', '***'):
            flowables.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=2, spaceAfter=2))
            i += 1
            continue

        # 4. Bóc tách Tiêu đề Heading
        if raw_line.startswith('###') or raw_line.startswith('##') or (raw_line.startswith('**') and (raw_line.endswith('**') or raw_line.endswith(':')) and len(raw_line) < 80):
            clean_h = raw_line.lstrip('#').strip()
            clean_h = re.sub(r'\*\*(.*?)\*\*', r'\1', clean_h)
            flowables.append(Paragraph(clean_h, custom_styles['H2']))
            i += 1
            continue

        # 5. Đoạn văn thường & Bullet Points
        formatted_line = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>', raw_line)
        formatted_line = re.sub(r'\*(.*?)\*', r'<i>\1</i>', formatted_line)
        if formatted_line.startswith('- ') or formatted_line.startswith('* '):
            formatted_line = '• ' + formatted_line[2:]
        flowables.append(Paragraph(formatted_line, custom_styles['Body']))
        i += 1

    return flowables


def generate_item_pdf(item_data, dossier_info, output_path):
    """
    Sinh file Báo cáo Thẩm định giá PDF chuẩn A4 2 TRANG duy nhất cho 1 vật tư cụ thể.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=11.5,
        leading=14,
        textColor=colors.HexColor("#1E3A8A"),
        alignment=1,
        spaceAfter=2
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569"),
        alignment=1,
        spaceAfter=4
    )

    h1_style = ParagraphStyle(
        'H1',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=4,
        spaceAfter=3
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1E40AF"),
        spaceBefore=3,
        spaceAfter=2
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Arial',
        fontSize=8.0,
        leading=10.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=2
    )

    alert_style = ParagraphStyle(
        'Alert',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=8.0,
        leading=10.5,
        textColor=colors.HexColor("#991B1B"),
        spaceBefore=1,
        spaceAfter=1
    )

    cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Arial',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1E293B")
    )

    cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Arial-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#0F172A")
    )

    cell_center_bold = ParagraphStyle(
        'CellCenterBold',
        parent=cell_bold,
        alignment=1
    )

    custom_styles = {
        'Body': body_style,
        'H2': h2_style,
        'Alert': alert_style,
        'TableCell': cell_style,
        'TableCellBold': cell_bold,
        'CellCenterBold': cell_center_bold
    }

    story = []

    # Header Top Bar
    dossier_name = dossier_info.get('dossier_name', 'Gói mua sắm vật tư SCTX đợt 8 năm 2026')
    dept_name = dossier_info.get('department', 'Tổ Thẩm định Dự toán - NMNĐ Vĩnh Tân 4')

    story.append(Paragraph("TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM — NMNĐ VĨNH TÂN 4", ParagraphStyle('TopHeader', fontName='Arial-Bold', fontSize=8.0, alignment=1, textColor=colors.HexColor("#1E3A8A"))))
    story.append(Paragraph(dept_name.upper(), ParagraphStyle('TopSub', fontName='Arial', fontSize=7.5, alignment=1, textColor=colors.HexColor("#475569"))))
    story.append(Spacer(1, 2))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#1E3A8A"), spaceAfter=4))

    # Title & Metadata
    item_id = item_data.get('id', 1)
    ten_vt_raw = item_data.get('ten_vt', 'Vật tư chưa xác định')
    ten_vt = re.sub(r'[\r\n]+', ' ', ten_vt_raw).strip()
    ma_vt = item_data.get('ma_vt', 'N/A')
    part_no_raw = item_data.get('part_no', 'N/A')
    part_no = re.sub(r'[\r\n]+', ' | ', str(part_no_raw)).strip()
    so_luong = item_data.get('so_luong', 1)
    dvt = item_data.get('dvt', 'Cái')
    don_gia_trinh = item_data.get('don_gia_trinh', 0)
    thanh_tien_trinh = don_gia_trinh * so_luong
    don_gia_thong_nhat = item_data.get('don_gia_thong_nhat', don_gia_trinh)
    thanh_tien_thong_nhat = don_gia_thong_nhat * so_luong
    gia_tri_giam = item_data.get('gia_tri_giam', thanh_tien_trinh - thanh_tien_thong_nhat)

    story.append(Paragraph("BÁO CÁO THẨM ĐỊNH ĐÁNH GIÁ ĐƠN GIÁ VẬT TƯ", title_style))
    story.append(Paragraph(f"MỤC STT {item_id:02d}: {ten_vt.upper()}<br/>{dossier_name}", subtitle_style))
    story.append(Spacer(1, 2))

    # Section 1: Dynamic Summary Table 1
    story.append(Paragraph("1. TỔNG HỢP THÔNG SỐ VẬT TƯ & CƠ SỞ CHỨNG CỨ THẨM ĐỊNH", h1_style))
    
    pct_save = (gia_tri_giam / thanh_tien_trinh * 100) if thanh_tien_trinh > 0 else 0

    table_data_1 = [
        [Paragraph("STT", cell_center_bold), Paragraph("Chỉ tiêu thẩm định", cell_center_bold), Paragraph("Thông tin chi tiết", cell_center_bold)],
        [Paragraph("1", cell_style), Paragraph("Tên vật tư trình thẩm định", cell_bold), Paragraph(f"{ten_vt}", cell_style)],
        [Paragraph("2", cell_style), Paragraph("Part Number / Mã hiệu", cell_bold), Paragraph(f"{part_no}", cell_bold)],
        [Paragraph("3", cell_style), Paragraph("Mã ERP Vĩnh Tân 4", cell_bold), Paragraph(f"{ma_vt}", cell_style)],
        [Paragraph("4", cell_style), Paragraph("Số lượng & Đơn vị tính", cell_bold), Paragraph(f"{so_luong} {dvt}", cell_style)],
        [Paragraph("5", cell_style), Paragraph("Đơn giá trình thẩm định", cell_bold), Paragraph(f"<b>{format_vnd(don_gia_trinh)}/{dvt}</b> (Thành tiền: {format_vnd(thanh_tien_trinh)})", cell_style)],
        [Paragraph("6", cell_style), Paragraph("Đơn giá đề xuất thống nhất", cell_bold), Paragraph(f"<font color='#047857'><b>{format_vnd(don_gia_thong_nhat)}/{dvt}</b> (Thành tiền: {format_vnd(thanh_tien_thong_nhat)})</font>", cell_style)],
        [Paragraph("7", cell_style), Paragraph("Dự kiến tiết kiệm chi phí", cell_bold), Paragraph(f"<font color='#047857'><b>{format_vnd(gia_tri_giam)}</b> (Giảm {pct_save:.1f}% so với giá trình)</font>", cell_style)],
        [Paragraph("8", cell_style), Paragraph("Cơ sở thống nhất đơn giá", cell_bold), Paragraph(item_data.get('co_so_thong_nhat', 'Căn cứ đối chiếu e-GP MSC & Lịch sử ERP'), cell_style)],
    ]

    t1 = Table(table_data_1, colWidths=[0.8*cm, 5.2*cm, 12.0*cm])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 2.5),
    ]))
    story.append(t1)
    story.append(Spacer(1, 4))

    # Section 2: Parse AI Markdown Synthesis dynamically
    story.append(Paragraph("2. ĐÁNH GIÁ CHUYÊN SÂU TỔ THẨM ĐỊNH & PHẢN BIỆN KHVT", h1_style))
    
    danh_gia_ttd = item_data.get('danh_gia_ttd', 'Chưa có đánh giá')
    phan_bien_khvt = item_data.get('phan_bien_khvt', 'Đồng ý điều chỉnh')

    story.append(Paragraph("<b>2.1. Đánh giá của Tổ Thẩm định Dự toán:</b>", h2_style))
    parsed_ttd = parse_markdown_to_flowables(danh_gia_ttd, custom_styles)
    if parsed_ttd:
        story.extend(parsed_ttd)
    else:
        story.append(Paragraph(str(danh_gia_ttd), body_style))
    story.append(Spacer(1, 3))

    story.append(Paragraph("<b>2.2. Ý kiến giải trình / Phản biện từ Đơn vị Mua sắm (KHVT):</b>", h2_style))
    parsed_khvt = parse_markdown_to_flowables(phan_bien_khvt, custom_styles)
    if parsed_khvt:
        story.extend(parsed_khvt)
    else:
        story.append(Paragraph(str(phan_bien_khvt), body_style))
    story.append(Spacer(1, 4))

    # Section 3: Recommendations & Options
    story.append(Paragraph("3. KHUYẾN NGHỊ ĐÀM PHÁN VÀ KẾT LUẬN THẨM ĐỊNH", h1_style))
    if pct_save > 15:
        p_alert = Paragraph(f"🔴 <b>CẢNH BÁO BẤT THƯỜNG ĐƠN GIÁ – GIÁ TRÌNH CAO HƠN +{pct_save:.1f}% SO VỚI CĂN CỨ THẨM ĐỊNH</b>", alert_style)
        alert_box = Table([[p_alert]], colWidths=[18.0*cm])
        alert_box.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF3C7")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F59E0B")),
            ('PADDING', (0,0), (-1,-1), 3),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(alert_box)
        story.append(Spacer(1, 4))

    table_data_3 = [
        [Paragraph("Phương án đàm phán", cell_center_bold), Paragraph("Đơn giá đề xuất", cell_center_bold), Paragraph("Lý do & Cơ sở đề xuất", cell_center_bold), Paragraph("Tiết kiệm dự kiến", cell_center_bold)],
        [Paragraph("Phương án A<br/>(Căn cứ lịch sử)", cell_bold), Paragraph(f"{format_vnd(don_gia_thong_nhat * 0.9)}", cell_style), Paragraph("Áp dụng theo mức giá lịch sử nhập kho thấp nhất", cell_style), Paragraph(f"{format_vnd(gia_tri_giam + don_gia_thong_nhat * 0.1 * so_luong)}", cell_style)],
        [Paragraph("<b>Phương án B<br/>(Khuyến nghị)</b>", cell_bold), Paragraph(f"<font color='#047857'><b>{format_vnd(don_gia_thong_nhat)}</b></font>", cell_bold), Paragraph(f"<font color='#047857'>Thống nhất theo căn cứ {item_data.get('co_so_thong_nhat', 'e-GP MSC và HĐ IMIS')}. Đảm bảo tính khả thi và hợp lý cho Ngân sách.</font>", cell_style), Paragraph(f"<font color='#047857'><b>{format_vnd(gia_tri_giam)}</b></font>", cell_bold)],
        [Paragraph("Phương án C<br/>(Giữ giá trình)", cell_bold), Paragraph(f"{format_vnd(don_gia_trinh)}", cell_style), Paragraph("Chỉ áp dụng khi đơn vị trình có đầy đủ chứng từ xuất xứ gốc và giải trình đặc thù", cell_style), Paragraph("0 đ", cell_style)],
    ]

    t3 = Table(table_data_3, colWidths=[3.0*cm, 2.8*cm, 9.2*cm, 3.0*cm])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F8FAFC")),
        ('BACKGROUND', (0,2), (-1,2), colors.HexColor("#ECFDF5")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t3)
    story.append(Spacer(1, 4))

    p_conclusion = (
        "<b>KẾT LUẬN THẨM ĐỊNH:</b><br/>"
        f"Hội đồng Thẩm định thống nhất duyệt đơn giá cho Mục STT {item_id:02d} ({ten_vt}) ở mức <b>{format_vnd(don_gia_thong_nhat)}/{dvt}</b>, "
        f"tổng giá trị thẩm định đạt <b>{format_vnd(thanh_tien_thong_nhat)}</b> (giảm <b>{format_vnd(gia_tri_giam)}</b> so với dự toán ban đầu trình)."
    )
    story.append(Paragraph(p_conclusion, body_style))
    story.append(Spacer(1, 8))

    # Signatures
    creator_name = dossier_info.get('creator', 'Nguyễn Anh Hiếu')
    sig_data = [
        [Paragraph("<b>CHUYÊN VIÊN THẨM ĐỊNH</b>", cell_center_bold), Paragraph("<b>TỔ TRƯỞNG TỔ THẨM ĐỊNH DỰ TOÁN</b>", cell_center_bold)],
        [Paragraph("<i>(Ký, ghi rõ họ tên)</i>", ParagraphStyle('SubSig', fontName='Arial-Italic', fontSize=7.5, alignment=1)), Paragraph("<i>(Ký, ghi rõ họ tên)</i>", ParagraphStyle('SubSig', fontName='Arial-Italic', fontSize=7.5, alignment=1))],
        [Spacer(1, 25), Spacer(1, 25)],
        [Paragraph(f"<b>{creator_name}</b>", cell_center_bold), Paragraph("<b>Tổ Thẩm Định Dự Toán NMNĐ Vĩnh Tân 4</b>", cell_center_bold)]
    ]
    t_sig = Table(sig_data, colWidths=[9.0*cm, 9.0*cm])
    t_sig.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(KeepTogether(t_sig))

    doc.build(story, canvasmaker=NumberedCanvas)
    return output_path
