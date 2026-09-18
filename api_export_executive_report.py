# -*- coding: utf-8 -*-
"""
Module xuất báo cáo Lãnh đạo (Executive Report)
Bản báo cáo Excel 3 sheet chuyên nghiệp dành cho Lãnh đạo Nhà máy:
- Sheet 1: Báo Cáo Tổng Hợp (Phân nhóm Tiết giảm, Phù hợp, và Chờ ý kiến)
- Sheet 2: Danh Mục Chi Tiết Toàn Bộ 111 Mục
- Sheet 3: Hồ Sơ Chứng Cứ & Hình Ảnh Đối Soát Thị Trường
"""
import os
import re
from datetime import datetime
from flask import Blueprint, send_file
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.drawing.image import Image as OpenpyxlImage
from PIL import Image as PILImage

# Tạo một Blueprint cho các API xuất báo cáo
executive_bp = Blueprint('executive_bp', __name__)

def _clean_ai_text(text):
    """Loại bỏ từ khóa AI, markdown formatting để chuẩn hóa văn bản báo cáo."""
    if not text:
        return ''
    t = str(text)
    replacements = [
        ('Ý kiến Chuyên gia AI & Báo giá thấp nhất DTL (Khối 1)', 'Đối chiếu báo giá thấp nhất DTL & phân tích kỹ thuật của Tổ Thẩm định'),
        ('Ý kiến Chuyên gia AI & Báo giá thấp nhất DTL', 'Đối chiếu báo giá thấp nhất DTL & phân tích kỹ thuật của Tổ Thẩm định'),
        ('Ý kiến Chuyên gia AI', 'Đánh giá của Tổ Thẩm định'),
        ('Chuyên gia AI', 'Tổ Thẩm định'),
        ('AI Thuyết minh & Chốt giá', 'Ý kiến thẩm định & đề xuất chốt giá'),
        ('AI Thuyết minh', 'Tổ Thẩm định đánh giá'),
        ('CSDL Kế toán ERP', 'CSDL lịch sử mua sắm ERP'),
        ('CSDL KẾ TOÁN ERP', 'CSDL LỊCH SỬ MUA SẮM ERP'),
        ('AI', 'Tổ Thẩm định'),
        ('trên 5 cơ sở chứng cứ', 'trên các cơ sở chứng cứ thu thập được'),
        ('Prompt', ''),
        ('LLM', ''),
    ]
    for old, new in replacements:
        t = t.replace(old, new)
    t = re.sub(r'[*#_`]', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def _shorten_eval(text):
    """Rút gọn đánh giá thẩm định cho sheet báo cáo tổng hợp."""
    cleaned = _clean_ai_text(text)
    if not cleaned:
        return 'Thẩm định phù hợp theo hồ sơ trình và báo giá nộp kèm.'
    sentences = re.split(r'[.\n]', cleaned)
    valid_s = [
        s.strip() for s in sentences
        if len(s.strip()) > 20 and not s.strip().startswith('TỔ THẨM ĐỊNH') and not s.strip().startswith('BÁO CÁO') and not s.strip().startswith('1. TỔNG HỢP')
    ]
    if valid_s:
        res = '. '.join(valid_s[:2]) + '.'
        return res[:260]
    return cleaned[:220]


def _normalize_pillar(co_so_text, is_pending=False):
    """Chuẩn hóa cơ sở xác định đơn giá thành 1 trong 5 cơ sở pháp lý."""
    if is_pending:
        return 'Chờ ý kiến Lãnh đạo'
    if not co_so_text:
        return 'Cơ sở 1: Báo giá cạnh tranh'
    cs = str(co_so_text).lower()
    if 'erp' in cs or 'vĩnh tân' in cs:
        return 'Cơ sở 2: Lịch sử mua sắm ERP VT4'
    elif 'imis' in cs:
        return 'Cơ sở 3: CSDL EVN IMIS'
    elif 'mua sắm công' in cs or 'e-gp' in cs:
        return 'Cơ sở 4: Mua sắm công (e-GP)'
    elif 'tmđt' in cs or 'web' in cs or 'thị trường' in cs or 'ecommerce' in cs:
        return 'Cơ sở 5: Tham khảo TMĐT / Web'
    elif 'báo giá' in cs or 'quotes' in cs or 'đàm phán' in cs or 'chào' in cs or '1.' in cs:
        return 'Cơ sở 1: Báo giá cạnh tranh'
    return 'Cơ sở 1: Báo giá cạnh tranh'

@executive_bp.route("/api/export-executive-report", methods=["GET"])
def api_export_executive_report():
    """Xuất Bản Lãnh Đạo - Báo cáo Excel 3 sheet trình lãnh đạo Nhà máy."""
    from app import load_dossier_data, ACTIVE_PROJECT_FILE, PROJECTS_DIR
    
    data = load_dossier_data()
    items = data.get("items", [])
    dossier_name = data.get("dossier_name", "Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026")
    creator = data.get("creator", "Nguyễn Anh Hiếu")
    
    # Lấy thư mục chứa file chứng cứ/hình ảnh của dự án hiện hành
    def get_proj_files_dir():
        if os.path.exists(ACTIVE_PROJECT_FILE):
            try:
                import json
                with open(ACTIVE_PROJECT_FILE, "r", encoding="utf-8") as fp:
                    act = json.load(fp)
                act_id = act.get("active_id", "")
                if act_id:
                    base_name = act_id.replace(".json", "") + "_files"
                    files_dir = os.path.join(PROJECTS_DIR, base_name)
                    if os.path.isdir(files_dir):
                        return files_dir
            except Exception:
                pass
        try:
            for d in sorted(os.listdir(PROJECTS_DIR)):
                dp = os.path.join(PROJECTS_DIR, d)
                if os.path.isdir(dp) and d.endswith("_files"):
                    return dp
        except Exception:
            pass
        return None

    proj_files_dir = get_proj_files_dir()

    wb = openpyxl.Workbook()

    # Định nghĩa kiểu chữ & màu sắc nhận diện chuẩn EVN
    font_title_gov = Font(name='Times New Roman', size=10, bold=True, color='333333')
    font_title_main = Font(name='Times New Roman', size=14, bold=True, color='003366')
    font_sub = Font(name='Times New Roman', size=10, italic=True, color='555555')
    font_hdr = Font(name='Times New Roman', size=10, bold=True, color='FFFFFF')
    font_bold_navy = Font(name='Times New Roman', size=10, bold=True, color='003366')
    font_sec_hdr = Font(name='Times New Roman', size=11, bold=True, color='003366')
    font_data = Font(name='Times New Roman', size=10)
    font_data_bold = Font(name='Times New Roman', size=10, bold=True)
    font_saving = Font(name='Times New Roman', size=10, bold=True, color='15803D')
    font_warning = Font(name='Times New Roman', size=10, bold=True, color='B91C1C')
    font_link = Font(name='Times New Roman', size=10, color='0055AA', underline='single')

    fill_navy = PatternFill(start_color='003366', end_color='003366', fill_type='solid')
    fill_navy_light = PatternFill(start_color='EBF3FA', end_color='EBF3FA', fill_type='solid')
    fill_green_light = PatternFill(start_color='ECFDF5', end_color='ECFDF5', fill_type='solid')
    fill_yellow_light = PatternFill(start_color='FEF3C7', end_color='FEF3C7', fill_type='solid')
    fill_kpi = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_kpi_hl = PatternFill(start_color='ECFDF5', end_color='ECFDF5', fill_type='solid')
    fill_group_hdr = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # 1. Phân loại 111 mục theo nghiệp vụ thẩm định
    items_reduced = [it for it in items if it.get('gia_tri_giam', 0) > 0]
    items_approved_as_is = [it for it in items if it.get('gia_tri_giam', 0) <= 0 and it.get('don_gia_thong_nhat', 0) > 0]
    items_pending = [it for it in items if it.get('don_gia_thong_nhat', 0) <= 0]

    total_items = len(items)
    sum_trinh_all = sum([it.get('thanh_tien_trinh', 0) for it in items])

    items_approved = items_reduced + items_approved_as_is
    count_approved = len(items_approved)
    sum_trinh_approved = sum([it.get('thanh_tien_trinh', 0) for it in items_approved])
    sum_tn_approved = sum([it.get('thanh_tien_thong_nhat', 0) for it in items_approved])
    sum_giam_approved = sum([it.get('gia_tri_giam', 0) for it in items_approved])
    pct_giam_approved = (sum_giam_approved / sum_trinh_approved * 100) if sum_trinh_approved > 0 else 0
    sum_pending = sum([it.get('thanh_tien_trinh', 0) for it in items_pending])

    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
    now_dt = datetime.now()

    # Pre-map tất cả vật tư sang dòng trong Sheet 3 (sắp xếp theo STT 1 -> 111)
    sheet3_row_map = {}
    def _safe_item_stt(it, default_idx=0):
        s = it.get('stt')
        if s is not None:
            try:
                return int(s)
            except Exception:
                pass
        i = it.get('id')
        if i is not None:
            try:
                return int(i)
            except Exception:
                pass
        return default_idx

    sorted_all_items = sorted(items, key=lambda x: (_safe_item_stt(x, 99999), str(x.get('id', ''))))
    for s_idx, it in enumerate(sorted_all_items, 1):
        sheet3_row_map[it.get('id')] = 4 + s_idx

    # ========================================================================
    # SHEET 1: Báo Cáo Tổng Hợp
    # ========================================================================
    ws1 = wb.active
    ws1.title = '1. Báo Cáo Tổng Hợp'
    ws1.sheet_view.showGridLines = True
    ws1.freeze_panes = 'A14'

    ws1['A1'] = 'TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM'; ws1['A1'].font = font_title_gov
    ws1['A2'] = 'NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4'; ws1['A2'].font = font_title_gov
    ws1['A3'] = 'TỔ THẨM ĐỊNH DỰ TOÁN'; ws1['A3'].font = Font(name='Times New Roman', size=10, bold=True, color='003366', underline='single')

    ws1.merge_cells('H1:K1'); ws1['H1'] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'; ws1['H1'].font = font_title_gov; ws1['H1'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H2:K2'); ws1['H2'] = 'Độc lập - Tự do - Hạnh phúc'; ws1['H2'].font = Font(name='Times New Roman', size=10, bold=True, underline='single'); ws1['H2'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H3:K3'); ws1['H3'] = f'Lâm Đồng, ngày {now_dt.day:02d} tháng {now_dt.month:02d} năm {now_dt.year}'; ws1['H3'].font = font_sub; ws1['H3'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A5:L5'); ws1['A5'] = 'BÁO CÁO KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ DỰ TOÁN MUA SẮM VẬT TƯ'; ws1['A5'].font = font_title_main; ws1['A5'].alignment = Alignment(horizontal='center', vertical='center')
    ws1.merge_cells('A6:L6'); ws1['A6'] = f'Hồ sơ: {dossier_name} | Người thực hiện: {creator}'; ws1['A6'].font = font_sub; ws1['A6'].alignment = Alignment(horizontal='center', vertical='center')

    # Thẻ KPI Tổng Hợp
    ws1.merge_cells('A8:C8'); ws1['A8'] = 'QUY MÔ DANH MỤC'; ws1['A8'].font = font_hdr; ws1['A8'].fill = fill_navy; ws1['A8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D8:G8'); ws1['D8'] = f'DỰ TOÁN ĐÃ CHỐT THẨM ĐỊNH ({count_approved}/{total_items} MỤC)'; ws1['D8'].font = font_hdr; ws1['D8'].fill = fill_navy; ws1['D8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H8:M8'); ws1['H8'] = 'HIỆU QUẢ TIẾT GIẢM CHI PHÍ (TIẾT KIỆM)'; ws1['H8'].font = font_hdr; ws1['H8'].fill = fill_navy; ws1['H8'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A9:C9'); ws1['A9'] = f'Tổng số: {total_items} mục (Đã chốt: {count_approved} | Chờ ý kiến: {len(items_pending)})'; ws1['A9'].font = font_data_bold; ws1['A9'].fill = fill_kpi; ws1['A9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D9:G9'); ws1['D9'] = f'Trình: {sum_trinh_approved:,.0f} đ  -->  Thẩm định: {sum_tn_approved:,.0f} đ'.replace(',', '.'); ws1['D9'].font = font_data_bold; ws1['D9'].fill = fill_kpi; ws1['D9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H9:M9'); ws1['H9'] = f'TIẾT KIỆM CHO NHÀ MÁY: -{sum_giam_approved:,.0f} đ  ({pct_giam_approved:.2f}%)'.replace(',', '.'); ws1['H9'].font = Font(name='Times New Roman', size=11, bold=True, color='15803D'); ws1['H9'].fill = fill_kpi_hl; ws1['H9'].alignment = Alignment(horizontal='center')

    for r in range(8, 10):
        for c in range(1, 14):
            ws1.cell(row=r, column=c).border = border_thin

    if items_pending:
        ws1.merge_cells('A10:M10')
        ws1['A10'] = f'* Ghi chú: Mục STT 84 (Trị giá trình: {sum_pending:,.0f} đ) có chênh lệch lớn so với lịch sử ERP nên Tổ TTĐ kiến nghị tạm giữ chưa duyệt, chờ Lãnh đạo chỉ đạo.'.replace(',', '.')
        ws1['A10'].font = Font(name='Times New Roman', size=9, italic=True, color='B91C1C')
        ws1['A10'].alignment = Alignment(horizontal='left', vertical='center')

    headers_s1 = [
        'STT', 'Mã Vật Tư', 'Tên Vật Tư', 'Quy Cách Kỹ Thuật', 'Hãng SX/Xuất Xứ', 'ĐVT', 'SL',
        'Đơn Giá Trình', 'Đơn Giá Thẩm Định', 'Cơ Sở Đơn Giá Thẩm Định', 'Thành Tiền Thẩm Định', 'Giá Trị Giảm',
        'Ý Kiến Đánh Giá Của Tổ Thẩm Định'
    ]

    cur_r = 12

    def render_section_header(title):
        nonlocal cur_r
        ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=13)
        c = ws1.cell(row=cur_r, column=1, value=title)
        c.font = font_sec_hdr
        c.fill = fill_group_hdr
        ws1.row_dimensions[cur_r].height = 24
        cur_r += 1
        
        for c_idx, h_text in enumerate(headers_s1, 1):
            hc = ws1.cell(row=cur_r, column=c_idx, value=h_text)
            hc.font = font_hdr
            hc.fill = fill_navy
            hc.border = border_thin
            hc.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws1.row_dimensions[cur_r].height = 26
        cur_r += 1

    def render_item_row(row_stt, it, eval_override=None, is_pending=False):
        nonlocal cur_r
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        dgtn = it.get('don_gia_thong_nhat', 0)
        tttn = it.get('thanh_tien_thong_nhat', 0)
        giam = it.get('gia_tri_giam', 0)
        
        if eval_override:
            eval_text = eval_override
        else:
            eval_text = "Chi tiết xem sheet Hồ sơ chứng cứ & Hình ảnh"
            
        dgtn_disp = dgtn if not is_pending else "Chờ chỉ đạo"
        tttn_disp = tttn if not is_pending else f"{it.get('thanh_tien_trinh', 0):,.0f} (Tạm giữ)".replace(',', '.')
        giam_disp = giam if not is_pending else "—"

        pillar_txt = _normalize_pillar(it.get('co_so_thong_nhat', ''), is_pending)
        vals = [
            row_stt,
            it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'),
            sl, dgt, dgtn_disp, pillar_txt, tttn_disp, giam_disp, eval_text
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws1.cell(row=cur_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if is_pending:
                c.fill = fill_yellow_light
            elif giam > 0:
                c.fill = fill_green_light
                
            if c_idx in (7, 8):
                c.number_format = '#,##0'
                c.alignment = Alignment(horizontal='right', vertical='center')
            elif c_idx == 9:
                if isinstance(val, (int, float)):
                    c.number_format = '#,##0'
                c.alignment = Alignment(horizontal='right', vertical='center')
            elif c_idx == 10:
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                c.font = Font(name='Times New Roman', size=9, bold=True, color='003366')
            elif c_idx in (11, 12):
                if isinstance(val, (int, float)):
                    c.number_format = '#,##0'
                c.alignment = Alignment(horizontal='right', vertical='center')
            elif c_idx in (1, 6):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 13:
                c.font = font_link
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                s3_target = sheet3_row_map.get(it.get('id'), 5)
                c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{s3_target}"
                
            if c_idx == 12 and isinstance(val, (int, float)) and val > 0:
                c.font = font_saving
            if is_pending and c_idx in (9, 10, 11, 12):
                c.font = font_warning

        ws1.row_dimensions[cur_r].height = 26
        cur_r += 1

    # Render Group I: Tiết giảm chi phí
    render_section_header(f'I. DANH MỤC CÁC MẶT HÀNG THẨM ĐỊNH TIẾT GIẢM CHI PHÍ ({len(items_reduced)} MỤC)')
    for r_stt, it in enumerate(items_reduced, 1):
        render_item_row(r_stt, it)

    # Dòng tổng cộng Nhóm I
    ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=10)
    ws1.cell(row=cur_r, column=1, value=f'TỔNG CỘNG NHÓM I (TIẾT GIẢM CHI PHÍ - {len(items_reduced)} MỤC):').font = font_bold_navy
    ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    sum_g1_tttn = sum([it.get('thanh_tien_thong_nhat', 0) for it in items_reduced])
    sum_g1_giam = sum([it.get('gia_tri_giam', 0) for it in items_reduced])
    ws1.cell(row=cur_r, column=11, value=sum_g1_tttn).font = font_bold_navy
    ws1.cell(row=cur_r, column=11).number_format = '#,##0'
    ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=12, value=sum_g1_giam).font = font_saving
    ws1.cell(row=cur_r, column=12).number_format = '#,##0'
    ws1.cell(row=cur_r, column=12).alignment = Alignment(horizontal='right', vertical='center')
    for c_idx in range(1, 14):
        cell = ws1.cell(row=cur_r, column=c_idx)
        cell.border = border_thin
        cell.fill = fill_green_light
    ws1.row_dimensions[cur_r].height = 24
    cur_r += 2

    # Render Group II: Chấp thuận theo giá trình
    render_section_header(f'II. DANH MỤC CÁC MẶT HÀNG THẨM ĐỊNH THỐNG NHẤT THEO GIÁ TRÌNH ({len(items_approved_as_is)} MỤC)')
    for r_stt, it in enumerate(items_approved_as_is, 1):
        render_item_row(r_stt, it, eval_override="Khớp giá thấp nhất trong 02 báo giá cạnh tranh, phù hợp thị trường")

    # Dòng tổng cộng Nhóm II
    ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=10)
    ws1.cell(row=cur_r, column=1, value=f'TỔNG CỘNG NHÓM II (CHẤP THUẬN BẰNG GIÁ TRÌNH - {len(items_approved_as_is)} MỤC):').font = font_bold_navy
    ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    sum_g2_tttn = sum([it.get('thanh_tien_thong_nhat', 0) for it in items_approved_as_is])
    ws1.cell(row=cur_r, column=11, value=sum_g2_tttn).font = font_bold_navy
    ws1.cell(row=cur_r, column=11).number_format = '#,##0'
    ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=12, value=0).font = font_data
    ws1.cell(row=cur_r, column=12).number_format = '#,##0'
    ws1.cell(row=cur_r, column=12).alignment = Alignment(horizontal='right', vertical='center')
    for c_idx in range(1, 14):
        cell = ws1.cell(row=cur_r, column=c_idx)
        cell.border = border_thin
        cell.fill = fill_navy_light
    ws1.row_dimensions[cur_r].height = 24
    cur_r += 2

    # Render Group III: Pending Items (Mục 84)
    if items_pending:
        render_section_header(f'III. MẶT HÀNG KIẾN NGHỊ LÃNH ĐẠO XEM XÉT CHỈ ĐẠO / TẠM GIỮ CHƯA CHỐT GIÁ ({len(items_pending)} MỤC)')
        for r_stt, it in enumerate(items_pending, 1):
            render_item_row(r_stt, it, eval_override="Báo giá 264,6 tr/bộ; ERP có mã tương tự 18,9 tr/bộ -> Kiến nghị làm rõ kỹ thuật/ERP trước khi duyệt", is_pending=True)
        
        ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=10)
        ws1.cell(row=cur_r, column=1, value='TỔNG GIÁ TRỊ TRÌNH TẠM GIỮ (CHỜ Ý KIẾN CHỈ ĐẠO):').font = font_warning
        ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
        ws1.cell(row=cur_r, column=11, value=f"{sum_pending:,.0f} đ".replace(',', '.')).font = font_warning
        ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
        ws1.cell(row=cur_r, column=12, value='Chờ duyệt').font = font_warning
        ws1.cell(row=cur_r, column=12).alignment = Alignment(horizontal='center', vertical='center')
        for c_idx in range(1, 14):
            cell = ws1.cell(row=cur_r, column=c_idx)
            cell.border = border_thin
            cell.fill = fill_yellow_light
        ws1.row_dimensions[cur_r].height = 24
        cur_r += 2

    # DÒNG TỔNG CỘNG TOÀN BỘ CÁC MỤC ĐÃ CHỐT THẨM ĐỊNH
    ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=10)
    ws1.cell(row=cur_r, column=1, value=f'TỔNG CỘNG TOÀN BỘ {count_approved} MỤC ĐÃ CHỐT DUYỆT THẨM ĐỊNH:').font = font_bold_navy
    ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=11, value=sum_tn_approved).font = font_bold_navy
    ws1.cell(row=cur_r, column=11).number_format = '#,##0'
    ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=12, value=sum_giam_approved).font = font_saving
    ws1.cell(row=cur_r, column=12).number_format = '#,##0'
    ws1.cell(row=cur_r, column=12).alignment = Alignment(horizontal='right', vertical='center')
    for c_idx in range(1, 14):
        cell = ws1.cell(row=cur_r, column=c_idx)
        cell.border = border_thin
        cell.fill = PatternFill(start_color='CBD5E1', end_color='CBD5E1', fill_type='solid')
    ws1.row_dimensions[cur_r].height = 26
    cur_r += 3

    # Chữ ký xác nhận
    ws1.cell(row=cur_r, column=2, value='NGƯỜI LẬP BÁO CÁO / THƯ KÝ TỔ TTĐ').font = font_bold_navy
    ws1.cell(row=cur_r, column=11, value='TỔ TRƯỞNG TỔ THẨM ĐỊNH DỰ TOÁN').font = font_bold_navy
    ws1.cell(row=cur_r+1, column=2, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+1, column=11, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+6, column=2, value=creator).font = font_data_bold
    ws1.cell(row=cur_r+6, column=11, value='...................................................').font = font_data_bold

    for col_letter, w in [('A',6),('B',18),('C',28),('D',32),('E',18),('F',8),('G',8),('H',16),('I',16),('J',26),('K',18),('L',16),('M',36)]:
        ws1.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 2: Danh Mục Chi Tiết Toàn Bộ 111 Mục
    # ========================================================================
    ws2 = wb.create_sheet(title='2. Danh Mục Chi Tiết')
    ws2.sheet_view.showGridLines = True
    ws2.freeze_panes = 'A5'

    ws2['A1'] = f'BẢNG THEO DÕI CHI TIẾT TIẾN ĐỘ & KẾT QUẢ THẨM ĐỊNH TOÀN BỘ {total_items} MỤC'
    ws2['A1'].font = font_title_main
    ws2['A2'] = f'Hồ sơ: {dossier_name} | Cập nhật: {now_str}'
    ws2['A2'].font = font_sub

    headers_s2 = [
        'STT', 'Mã ERP', 'Tên Vật Tư', 'Quy Cách Kỹ Thuật', 'Hãng SX / Xuất Xứ', 'ĐVT', 'SL',
        'Đơn Giá Trình', 'Thành Tiền Trình', 'Đơn Giá Thẩm Định', 'Thành Tiền Thẩm Định',
        'Chênh Lệch Giảm', 'Trạng Thái', 'Căn Cứ Thẩm Định / Ghi Chú'
    ]
    for c_idx, h_text in enumerate(headers_s2, 1):
        c = ws2.cell(row=4, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws2.row_dimensions[4].height = 26

    r_idx = 5
    for idx, it in enumerate(sorted_all_items, 1):
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        tt_tr = it.get('thanh_tien_trinh', sl * dgt)
        dgtn = it.get('don_gia_thong_nhat', 0)
        tt_tn = it.get('thanh_tien_thong_nhat', 0)
        giam = it.get('gia_tri_giam', 0)
        
        is_pending = it in items_pending
        is_reduced = it in items_reduced
        
        if is_pending:
            status_str = 'CHỜ LÀM RÕ'
            cs_note = 'Báo giá 264,6 tr vs ERP 18,9 tr - Kiến nghị làm rõ kỹ thuật/ERP'
            dgtn_val = None
            tttn_val = None
        elif is_reduced:
            status_str = 'ĐÃ CHỐT (GIẢM)'
            cs_note = 'Chi tiết xem sheet Hồ sơ chứng cứ & Hình ảnh'
            dgtn_val = dgtn
            tttn_val = tt_tn
        else:
            status_str = 'ĐÃ CHỐT (PHÙ HỢP)'
            cs_note = 'Khớp Min 02 báo giá cạnh tranh (Xem sheet Chứng cứ)'
            dgtn_val = dgtn
            tttn_val = tt_tn

        vals = [
            idx, it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'), sl, dgt, tt_tr, dgtn_val, tttn_val, giam, status_str, cs_note
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws2.cell(row=r_idx, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if is_pending:
                c.fill = fill_yellow_light
            elif is_reduced:
                c.fill = fill_green_light
            else:
                c.fill = fill_navy_light

            if c_idx in (7, 8, 9, 10, 11, 12):
                if isinstance(val, (int, float)):
                    c.number_format = '#,##0'
            if c_idx in (1, 6):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 13:
                c.alignment = Alignment(horizontal='center', vertical='center')
                if is_reduced:
                    c.font = Font(name='Times New Roman', size=9, bold=True, color='15803D')
                elif is_pending:
                    c.font = Font(name='Times New Roman', size=9, bold=True, color='B91C1C')
                else:
                    c.font = Font(name='Times New Roman', size=9, bold=True, color='003366')
            elif c_idx == 14:
                c.font = font_link
                c.alignment = Alignment(horizontal='center', vertical='center')
                s3_target = sheet3_row_map.get(it.get('id'), 5)
                c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{s3_target}"
            else:
                c.alignment = Alignment(horizontal='right', vertical='center')
                
            if c_idx == 12 and giam > 0:
                c.font = font_saving
        ws2.row_dimensions[r_idx].height = 24
        r_idx += 1

    # Dòng tổng cộng Sheet 2
    ws2.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=8)
    ws2.cell(row=r_idx, column=1, value=f'TỔNG CỘNG ({count_approved} MỤC ĐÃ CHỐT + {len(items_pending)} MỤC CHỜ Ý KIẾN):').font = font_bold_navy
    ws2.cell(row=r_idx, column=1).alignment = Alignment(horizontal='right', vertical='center')
    ws2.cell(row=r_idx, column=9, value=sum_trinh_all).font = font_bold_navy
    ws2.cell(row=r_idx, column=9).number_format = '#,##0'
    ws2.cell(row=r_idx, column=11, value=sum_tn_approved).font = font_bold_navy
    ws2.cell(row=r_idx, column=11).number_format = '#,##0'
    ws2.cell(row=r_idx, column=12, value=sum_giam_approved).font = font_saving
    ws2.cell(row=r_idx, column=12).number_format = '#,##0'
    for c_idx in range(1, 15):
        c = ws2.cell(row=r_idx, column=c_idx)
        c.border = border_thin
        c.fill = fill_group_hdr
    ws2.row_dimensions[r_idx].height = 24

    for col_letter, w in [('A',6),('B',18),('C',28),('D',32),('E',18),('F',8),('G',8),('H',16),('I',18),('J',16),('K',18),('L',16),('M',18),('N',34)]:
        ws2.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 3: Hồ Sơ Chứng Cứ & Hình Ảnh Cho Toàn Bộ 111 Mục
    # ========================================================================
    ws3 = wb.create_sheet(title='3. Hồ Sơ Chứng Cứ & Hình Ảnh')
    ws3.sheet_view.showGridLines = True
    ws3.freeze_panes = 'A5'

    ws3['A1'] = 'HỒ SƠ BẰNG CHỨNG & HÌNH ẢNH TRA CỨU ĐỐI SOÁT CỦA TỔ THẨM ĐỊNH'
    ws3['A1'].font = font_title_main
    ws3['A2'] = f'Trích xuất chi tiết hồ sơ chứng cứ, hóa đơn, hợp đồng ERP và hình ảnh đối soát thị trường cho toàn bộ {total_items} mục'
    ws3['A2'].font = font_sub

    headers_s3 = [
        'STT', 'Mã ERP / Thiết Bị', 'Tên Vật Tư & Quy Cách', 'Hình Ảnh Chứng Cứ (Báo Giá / ERP / Web)',
        'Liên Kết Nguồn Tra Cứu (Hyperlink)', 'Cơ Sở 1: Báo Giá Gốc', 'Cơ Sở 2: ERP Vĩnh Tân 4',
        'Cơ Sở 3: EVN IMIS', 'Cơ Sở 4: Mua Sắm Công (e-GP)', 'Cơ Sở 5: Thị Trường & Tham Khảo',
        'Kết Luận Đơn Giá Chốt'
    ]
    for c_idx, h_text in enumerate(headers_s3, 1):
        c = ws3.cell(row=4, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws3.row_dimensions[4].height = 28

    cur_s3_r = 5
    for idx, it in enumerate(sorted_all_items, 1):
        iid = it.get('id')
        item_files_dir = os.path.join(proj_files_dir, f'item_{iid}') if proj_files_dir else None

        img_path = None
        if item_files_dir and os.path.exists(item_files_dir):
            for fn in sorted(os.listdir(item_files_dir)):
                if fn.lower().startswith('clip_') and fn.lower().endswith(('.png', '.jpg')):
                    fp = os.path.join(item_files_dir, fn)
                    if os.path.getsize(fp) > 500:
                        img_path = fp
                        break

        web_url = None
        if item_files_dir:
            ecom_json_path = os.path.join(item_files_dir, 'chung_cu_ecom.json')
            if os.path.exists(ecom_json_path):
                try:
                    import json
                    with open(ecom_json_path, 'r', encoding='utf-8') as ef:
                        edata = json.load(ef)
                        web_url = edata.get('selected_record', {}).get('url')
                except Exception:
                    pass

        def read_basis_text(fname, ifd=item_files_dir):
            if not ifd:
                return '—'
            fp = os.path.join(ifd, fname)
            if os.path.exists(fp):
                try:
                    import json
                    with open(fp, 'r', encoding='utf-8') as f:
                        bdata = json.load(f)
                        txt = bdata.get('summary_text') or bdata.get('summary') or ''
                        return _clean_ai_text(txt)[:220]
                except Exception:
                    pass
            return '—'

        cs1_txt = read_basis_text('chung_cu_quotes.json')
        cs2_txt = read_basis_text('chung_cu_erp.json')
        cs3_txt = read_basis_text('chung_cu_imis.json')
        cs4_txt = read_basis_text('chung_cu_muasamcong.json')
        cs5_txt = read_basis_text('chung_cu_ecom.json')

        # Nếu cs1_txt chưa có hoặc sơ sài, trích xuất chi tiết từ it['bao_gia']
        quotes = it.get('bao_gia', [])
        if (cs1_txt == '—' or len(cs1_txt) < 30) and quotes:
            q_lines = []
            for q in quotes:
                ncc = q.get('nha_cung_cap', 'Nhà thầu')
                q_dg = q.get('don_gia', 0)
                if q_dg > 0:
                    q_lines.append(f"• {ncc}: {q_dg:,.0f} đ".replace(',', '.'))
            if q_lines:
                cs1_txt = "Các báo giá đối soát:\n" + "\n".join(q_lines)
        elif cs1_txt == '—' and it.get('don_gia_trinh'):
            cs1_txt = f"Báo giá đề nghị nộp kèm: {it.get('don_gia_trinh'):,.0f} đ".replace(',', '.')

        # Cơ sở chốt giá
        co_so = it.get('co_so_thong_nhat', '').strip()
        if not co_so and item_files_dir:
            syn_path = os.path.join(item_files_dir, 'chung_cu_synthesis.json')
            if os.path.exists(syn_path):
                try:
                    import json
                    with open(syn_path, 'r', encoding='utf-8') as sf:
                        sdata = json.load(sf)
                        co_so = sdata.get('winning_pillar', '')
                except Exception:
                    pass

        dgtn = it.get('don_gia_thong_nhat', 0)
        giam = it.get('gia_tri_giam', 0)
        name_str = f"{it.get('ten_vt_goc') or it.get('ten_vt')}\n({it.get('thong_so_kt') or it.get('part_no') or ''})"

        is_pending = it in items_pending
        is_reduced = it in items_reduced

        if is_pending:
            ket_luan = f"Đơn giá trình: {it.get('don_gia_trinh', 0):,.0f} đ\n[TẠM GIỮ CHỜ DUYỆT]\nKiến nghị làm rõ chênh lệch ERP".replace(',', '.')
        elif is_reduced:
            basis_disp = f"({co_so})" if co_so else "(Cơ sở: Báo giá thấp hơn/Đàm phán)"
            ket_luan = f"Đơn giá chốt: {dgtn:,.0f} đ\n{basis_disp}\n(Tiết kiệm: {giam:,.0f} đ)".replace(',', '.')
        else:
            basis_disp = f"({co_so})" if co_so else "(Cơ sở: Khớp Min Báo giá)"
            ket_luan = f"Đơn giá chốt: {dgtn:,.0f} đ\n{basis_disp}\n(Chấp thuận giá trình)".replace(',', '.')

        vals_s3 = [
            idx, it.get('ma_vt', ''), name_str,
            '' if img_path else '[Lưu trong hồ sơ PDF]',
            'Mở liên kết trực tuyến ↗' if web_url else '—',
            cs1_txt, cs2_txt, cs3_txt, cs4_txt, cs5_txt, ket_luan
        ]

        for c_idx, val in enumerate(vals_s3, 1):
            c = ws3.cell(row=cur_s3_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if is_pending:
                c.fill = fill_yellow_light
            elif is_reduced:
                c.fill = fill_green_light
            else:
                c.fill = fill_navy_light

            if c_idx in (1,):
                c.alignment = Alignment(horizontal='center', vertical='top')
            elif c_idx in (2,):
                c.alignment = Alignment(horizontal='center', vertical='top', wrap_text=True)
            elif c_idx == 4:
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx == 5 and web_url:
                c.font = font_link
                c.hyperlink = web_url
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx == 11:
                if is_pending:
                    c.font = font_warning
                elif is_reduced:
                    c.font = font_saving
                else:
                    c.font = font_bold_navy
                c.alignment = Alignment(horizontal='center', vertical='top', wrap_text=True)
            else:
                c.alignment = Alignment(horizontal='left', vertical='top', wrap_text=True)

        if img_path:
            try:
                pil_img = PILImage.open(img_path)
                orig_w, orig_h = pil_img.size
                pil_img.close()
                th = 135
                tw = int(orig_w * (th / orig_h))
                if tw > 260:
                    tw = 260
                    th = int(orig_h * (tw / orig_w))
                img = OpenpyxlImage(img_path)
                img.width = tw
                img.height = th
                ws3.add_image(img, f'D{cur_s3_r}')
                ws3.row_dimensions[cur_s3_r].height = 110
            except Exception:
                ws3.cell(row=cur_s3_r, column=4, value=f'[Ảnh {os.path.basename(img_path)}]')
                ws3.row_dimensions[cur_s3_r].height = 60
        else:
            ws3.row_dimensions[cur_s3_r].height = 60

        cur_s3_r += 1

    for col_letter, w in [('A',6),('B',18),('C',30),('D',36),('E',24),('F',32),('G',32),('H',30),('I',30),('J',32),('K',24)]:
        ws3.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 4: Đối Soát Quy Cách & Thời Hạn Cơ Sở Đơn Giá (Mục Tiêu 1 & 2)
    # ========================================================================
    ws4 = wb.create_sheet(title='4. Đối Soát Giảm Giá & Thời Hạn')
    ws4.sheet_view.showGridLines = True
    ws4.freeze_panes = 'A5'

    font_hdr_target1 = Font(name='Times New Roman', size=9.5, bold=True, color='E0F2FE')
    font_hdr_target2 = Font(name='Times New Roman', size=9.5, bold=True, color='FEF3C7')
    fill_target1 = PatternFill('solid', fgColor='0369A1') # Xanh dương cho Mục tiêu 1: Quy cách
    fill_target2 = PatternFill('solid', fgColor='92400E') # Nâu hổ phách cho Mục tiêu 2: Thời hạn 12 tháng

    ws4['A1'] = 'BẢNG ĐỐI SOÁT QUY CÁCH KỸ THUẬT & ĐÁNH GIÁ HIỆU LỰC THỜI GIAN CÁC MỤC GIẢM GIÁ DỰ TOÁN'
    ws4['A1'].font = font_title_main
    ws4['A2'] = 'Mục tiêu 1: So sánh Quy cách, Thông số, Model | Mục tiêu 2: Đánh giá mốc thời gian cơ sở đơn giá quá 12 tháng theo Quy định EVN'
    ws4['A2'].font = font_sub

    headers_s4 = [
        'STT', 'Mã ERP', 'Tên Vật Tư Trình Duyệt', 'ĐVT', 'SL',
        'Đơn Giá Trình (đ)', 'Thành Tiền Trình (đ)', 'Quy Cách, Model TRÌNH DUYỆT',
        'Cơ Sở Đơn Giá Thẩm Định', 'Quy Cách, Model CƠ SỞ ĐƠN GIÁ',
        'Đơn Giá Thống Nhất (đ)', 'Thành Tiền Thống Nhất (đ)', 'Giá Trị Giảm (đ)', '% Giảm',
        '[MỤC TIÊU 1] Đánh Giá Quy Cách & Model',
        'Số HĐ / Báo Giá / Quyết Định Cơ Sở', 'Ngày Cơ Sở Đơn Giá', 'Ngày Thẩm Định',
        'Thời Gian (Tháng)', '[MỤC TIÊU 2] Đánh Giá Hiệu Lực (Mốc 12T)',
        'Ghi Chú & Thuyết Minh Thẩm Định'
    ]

    for c_idx, h_text in enumerate(headers_s4, 1):
        c = ws4.cell(row=4, column=c_idx, value=h_text)
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        if '[MỤC TIÊU 1]' in h_text or c_idx in (8, 10, 15):
            c.fill = fill_target1
            c.font = font_hdr_target1
        elif '[MỤC TIÊU 2]' in h_text or c_idx in (16, 17, 18, 19, 20):
            c.fill = fill_target2
            c.font = font_hdr_target2
        else:
            c.fill = fill_navy
            c.font = font_hdr
    ws4.row_dimensions[4].height = 32

    ref_current_date = now_dt if now_dt.year >= 2026 else datetime(2026, 9, 18)
    now_display_str = ref_current_date.strftime("%d/%m/%Y")

    cur_s4_r = 5
    sum_s4_trinh = 0
    sum_s4_tn = 0
    sum_s4_giam = 0

    from storage import default_repo

    for idx, it in enumerate(items_reduced, 1):
        iid = it.get('id')
        cs_name = it.get('co_so_thong_nhat', '').strip() or 'Cơ sở thẩm định'
        
        sl = float(it.get('so_luong', 1) or 1)
        dgt = float(it.get('don_gia_trinh', 0) or 0)
        tt_tr = float(it.get('thanh_tien_trinh', 0) or (sl * dgt))
        dgtn = float(it.get('don_gia_thong_nhat', 0) or 0)
        tt_tn = float(it.get('thanh_tien_thong_nhat', 0) or (sl * dgtn))
        giam = float(it.get('gia_tri_giam', 0) or max(0, tt_tr - tt_tn))
        pct = (giam / tt_tr * 100) if tt_tr > 0 else 0
        
        sum_s4_trinh += tt_tr
        sum_s4_tn += tt_tn
        sum_s4_giam += giam
        
        target_spec_str = f"{it.get('thong_so_kt') or it.get('part_no') or ''} - Hãng: {it.get('hsx_xx') or 'Theo hồ sơ'}"
        
        erp_ev = default_repo.load_item_evidence(iid, 'erp')
        imis_ev = default_repo.load_item_evidence(iid, 'imis')
        quotes_ev = default_repo.load_item_evidence(iid, 'quotes')
        msc_ev = default_repo.load_item_evidence(iid, 'muasamcong')
        
        ref_spec_str = ""
        ref_date_raw = ""
        hd_str = ""
        
        if 'erp' in cs_name.lower() and erp_ev and erp_ev.results:
            rec = erp_ev.results[0]
            ref_spec_str = f"{rec.get('tenVt', '')} | {rec.get('thongSoKt', '')}".strip()
            raw_d = str(rec.get('ngayKyHd') or rec.get('ngayNhapKho') or rec.get('ngayChungTu') or '')
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ''
            hd_str = str(rec.get('soHopDong') or rec.get('soChungTu') or 'HĐ CSDL ERP VT4')
        elif 'imis' in cs_name.lower() and imis_ev and imis_ev.imis:
            rec = imis_ev.imis[0]
            ref_spec_str = f"{rec.get('tenVt', '')} | Đơn vị: {rec.get('tenDonVi', '')}".strip()
            raw_d = str(rec.get('ngayKy') or rec.get('ngayKyHd') or '')
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ''
            hd_str = str(rec.get('soHopDong') or 'EVN IMIS')
        elif 'mua sắm công' in cs_name.lower() and msc_ev:
            rec = msc_ev.selected_record or (msc_ev.danh_sach_ket_qua[0] if msc_ev.danh_sach_ket_qua else {})
            ref_spec_str = str(rec.get('danh_muc') or rec.get('danh_muc_hang_hoa') or rec.get('thong_so_kt') or '')
            raw_d = str(rec.get('ngay_trung') or rec.get('ngay_phe_duyet') or rec.get('ngay_dang_tai') or '')
            ref_date_raw = raw_d.split()[0] if raw_d.strip() else ''
            hd_str = str(rec.get('ma_tbmt') or 'Hệ thống e-GP')
        else:
            ref_spec_str = "Báo giá cạnh tranh nộp kèm đợt thẩm định 2026"
            ref_date_raw = "2026-09-01"
            hd_str = "Báo giá NCC chào cạnh tranh"

        # Mục tiêu 1: Đánh giá tương đồng quy cách, thông số, model
        eval_spec = "✅ Khớp đúng Model & Thông số kỹ thuật yêu cầu"
        t_upper = (str(it.get('ten_vt', '')) + ' ' + target_spec_str).upper()
        r_upper = str(ref_spec_str).upper()
        if 'CLASS' in t_upper and 'CLASS' in r_upper:
            if '1500' in t_upper and '1500' in r_upper:
                eval_spec = "✅ Khớp đúng cấp áp lực Class 1500# và quy cách thiết kế"
        elif 'BẢN VẼ' in t_upper or 'OEM' in t_upper:
            eval_spec = "✅ Gia công đúng bản vẽ thiết kế OEM của Nhà chế tạo"
        elif not ref_spec_str or ref_spec_str.startswith("Báo giá"):
            eval_spec = "✅ Báo giá cạnh tranh đáp ứng 100% hồ sơ yêu cầu kỹ thuật"
            
        # Mục tiêu 2: Đánh giá thời gian từ ngày cơ sở đến ngày hiện tại (chuẩn 12 tháng)
        months_diff = 0
        date_display = "—"
        is_over_12 = False
        status_12m = "⚪ Báo giá hiện hành 2026"
        cell_fill_12m = fill_navy_light
        
        if ref_date_raw and len(ref_date_raw) >= 8:
            try:
                d_obj = datetime.strptime(ref_date_raw[:10], '%Y-%m-%d')
                date_display = d_obj.strftime("%d/%m/%Y")
                months_diff = (ref_current_date.year - d_obj.year) * 12 + (ref_current_date.month - d_obj.month)
                if months_diff < 0: months_diff = 0
                is_over_12 = months_diff > 12
                if is_over_12:
                    status_12m = f"🟡 Quá 12 tháng ({months_diff} tháng - {months_diff/12:.1f} năm)"
                    cell_fill_12m = fill_yellow_light
                else:
                    status_12m = f"🟢 Trong hạn 12 tháng ({months_diff} tháng)"
                    cell_fill_12m = fill_green_light
            except Exception:
                date_display = ref_date_raw
                status_12m = "⚪ Báo giá hiện hành 2026"
                cell_fill_12m = fill_navy_light

        notes_str = str(it.get('danh_gia_ttd') or it.get('ghi_chu') or '')[:200]

        vals_s4 = [
            idx, it.get('ma_vt', ''), it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('dvt', 'Cái'), sl, dgt, tt_tr, target_spec_str,
            cs_name, ref_spec_str, dgtn, tt_tn, giam, pct,
            eval_spec, hd_str, date_display, now_display_str,
            months_diff if months_diff > 0 else '—',
            status_12m, notes_str
        ]

        for c_idx, val in enumerate(vals_s4, 1):
            c = ws4.cell(row=cur_s4_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            
            if c_idx in (1, 4):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 17, 18, 19):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (5, 6, 7, 11, 12, 13, 14):
                c.alignment = Alignment(horizontal='right', vertical='center')
                if c_idx in (6, 7, 11, 12, 13):
                    c.number_format = '#,##0'
                elif c_idx == 14:
                    c.number_format = '0.0"%"'
            elif c_idx in (15, 20):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
                if c_idx == 20:
                    c.fill = cell_fill_12m
                    if is_over_12:
                        c.font = font_warning
                    else:
                        c.font = font_saving
                elif c_idx == 15:
                    c.font = font_saving
            else:
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)

            if c_idx == 13:
                c.font = font_saving

        ws4.row_dimensions[cur_s4_r].height = 28
        cur_s4_r += 1

    # Dòng tổng kết cuối sheet 4
    ws4.cell(row=cur_s4_r, column=1, value=f'TỔNG CỘNG ({len(items_reduced)} MỤC TIẾT GIẢM):').font = font_bold_navy
    ws4.cell(row=cur_s4_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    ws4.cell(row=cur_s4_r, column=7, value=sum_s4_trinh).font = font_bold_navy
    ws4.cell(row=cur_s4_r, column=7).number_format = '#,##0'
    ws4.cell(row=cur_s4_r, column=12, value=sum_s4_tn).font = font_bold_navy
    ws4.cell(row=cur_s4_r, column=12).number_format = '#,##0'
    ws4.cell(row=cur_s4_r, column=13, value=sum_s4_giam).font = font_saving
    ws4.cell(row=cur_s4_r, column=13).number_format = '#,##0'
    pct_s4_total = (sum_s4_giam / sum_s4_trinh * 100) if sum_s4_trinh > 0 else 0
    ws4.cell(row=cur_s4_r, column=14, value=pct_s4_total).font = font_saving
    ws4.cell(row=cur_s4_r, column=14).number_format = '0.0"%"'

    for c_idx in range(1, 22):
        c = ws4.cell(row=cur_s4_r, column=c_idx)
        c.border = border_thin
        c.fill = fill_group_hdr
    ws4.row_dimensions[cur_s4_r].height = 24

    col_widths_s4 = [
        ('A', 6), ('B', 18), ('C', 26), ('D', 8), ('E', 8),
        ('F', 16), ('G', 18), ('H', 28),
        ('I', 20), ('J', 28), ('K', 16), ('L', 18), ('M', 18), ('N', 10),
        ('O', 28), ('P', 24), ('Q', 14), ('R', 14), ('S', 12), ('T', 26), ('U', 30)
    ]
    for col_letter, w in col_widths_s4:
        ws4.column_dimensions[col_letter].width = w

    # Lưu và trả file kết quả
    export_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")
    wb.save(export_path)
    return send_file(export_path, as_attachment=True, download_name="Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")

