# -*- coding: utf-8 -*-
"""
Module xuất báo cáo Lãnh đạo (Executive Report)
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


@executive_bp.route("/api/export-executive-report", methods=["GET"])
def api_export_executive_report():
    """Xuất Bản Lãnh Đạo - Báo cáo Excel 3 sheet trình lãnh đạo Nhà máy."""
    # Import các hàm dùng chung từ app chính hoặc truyền dữ liệu
    from app import load_dossier_data, ACTIVE_PROJECT_FILE, PROJECTS_DIR, _get_active_project_files_dir
    
    data = load_dossier_data()
    items = data.get("items", [])
    dossier_name = data.get("dossier_name", "Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026")
    creator = data.get("creator", "Nguyễn Anh Hiếu")
    
    # Hàm hỗ trợ lấy thư mục project files bên trong module này
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

    # Style definitions
    font_title_gov = Font(name='Times New Roman', size=10, bold=True, color='333333')
    font_title_main = Font(name='Times New Roman', size=14, bold=True, color='003366')
    font_sub = Font(name='Times New Roman', size=10, italic=True, color='555555')
    font_hdr = Font(name='Times New Roman', size=10, bold=True, color='FFFFFF')
    font_bold_navy = Font(name='Times New Roman', size=10, bold=True, color='003366')
    font_data = Font(name='Times New Roman', size=10)
    font_data_bold = Font(name='Times New Roman', size=10, bold=True)
    font_saving = Font(name='Times New Roman', size=10, bold=True, color='15803D')
    font_link = Font(name='Times New Roman', size=10, color='0055AA', underline='single')

    fill_navy = PatternFill(start_color='003366', end_color='003366', fill_type='solid')
    fill_navy_light = PatternFill(start_color='EBF3FA', end_color='EBF3FA', fill_type='solid')
    fill_kpi = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    fill_kpi_hl = PatternFill(start_color='ECFDF5', end_color='ECFDF5', fill_type='solid')
    fill_group_hdr = PatternFill(start_color='E2E8F0', end_color='E2E8F0', fill_type='solid')

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Tính toán KPI
    appraised_items = [it for it in items if it.get('gia_tri_giam', 0) > 0 or (it.get('co_so_thong_nhat') and it.get('don_gia_thong_nhat') and it.get('id', 999) <= 10)]
    total_items = len(items)
    sum_trinh = sum([it.get('thanh_tien_trinh', 0) for it in items])
    sum_tn = sum([it.get('thanh_tien_thong_nhat', it.get('thanh_tien_trinh', 0)) for it in items])
    sum_giam = sum([it.get('gia_tri_giam', 0) for it in items])
    pct_giam = (sum_giam / sum_trinh * 100) if sum_trinh > 0 else 0
    now_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    # ========================================================================
    # SHEET 1: Báo Cáo Tổng Hợp
    # ========================================================================
    ws1 = wb.active
    ws1.title = '1. Báo Cáo Tổng Hợp'
    ws1.sheet_view.showGridLines = True
    ws1.freeze_panes = 'A13'

    ws1['A1'] = 'TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM'
    ws1['A1'].font = font_title_gov
    ws1['A2'] = 'NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4'
    ws1['A2'].font = font_title_gov
    ws1['A3'] = 'TỔ THẨM ĐỊNH DỰ TOÁN'
    ws1['A3'].font = Font(name='Times New Roman', size=10, bold=True, color='003366', underline='single')

    ws1.merge_cells('H1:K1')
    ws1['H1'] = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'
    ws1['H1'].font = font_title_gov
    ws1['H1'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('H2:K2')
    ws1['H2'] = 'Độc lập - Tự do - Hạnh phúc'
    ws1['H2'].font = Font(name='Times New Roman', size=10, bold=True, underline='single')
    ws1['H2'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('H3:K3')
    now_dt = datetime.now()
    ws1['H3'] = f'Lâm Đồng, ngày {now_dt.day:02d} tháng {now_dt.month:02d} năm {now_dt.year}'
    ws1['H3'].font = font_sub
    ws1['H3'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A5:L5')
    ws1['A5'] = 'BÁO CÁO KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ DỰ TOÁN MUA SẮM VẬT TƯ'
    ws1['A5'].font = font_title_main
    ws1['A5'].alignment = Alignment(horizontal='center', vertical='center')

    ws1.merge_cells('A6:L6')
    ws1['A6'] = f'Hồ sơ: {dossier_name} | Người thực hiện: {creator}'
    ws1['A6'].font = font_sub
    ws1['A6'].alignment = Alignment(horizontal='center', vertical='center')

    # KPI Table
    ws1.merge_cells('A8:C8'); ws1['A8'] = 'QUY MÔ DANH MỤC'; ws1['A8'].font = font_hdr; ws1['A8'].fill = fill_navy; ws1['A8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D8:G8'); ws1['D8'] = 'TỔNG DỰ TOÁN TRÌNH & THẨM ĐỊNH'; ws1['D8'].font = font_hdr; ws1['D8'].fill = fill_navy; ws1['D8'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H8:L8'); ws1['H8'] = 'HIỆU QUẢ TIẾT GIẢM CHI PHÍ (TIẾT KIỆM)'; ws1['H8'].font = font_hdr; ws1['H8'].fill = fill_navy; ws1['H8'].alignment = Alignment(horizontal='center')

    ws1.merge_cells('A9:C9'); ws1['A9'] = f'Tổng số: {total_items} mục (Đã chốt: {len(appraised_items)} mục)'; ws1['A9'].font = font_data_bold; ws1['A9'].fill = fill_kpi; ws1['A9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('D9:G9'); ws1['D9'] = f'Trình: {sum_trinh:,.0f} đ  -->  Thẩm định: {sum_tn:,.0f} đ'.replace(',', '.'); ws1['D9'].font = font_data_bold; ws1['D9'].fill = fill_kpi; ws1['D9'].alignment = Alignment(horizontal='center')
    ws1.merge_cells('H9:L9'); ws1['H9'] = f'TIẾT KIỆM CHO NHÀ MÁY: -{sum_giam:,.0f} đ  ({pct_giam:.2f}%)'.replace(',', '.'); ws1['H9'].font = Font(name='Times New Roman', size=11, bold=True, color='15803D'); ws1['H9'].fill = fill_kpi_hl; ws1['H9'].alignment = Alignment(horizontal='center')

    for r in range(8, 10):
        for c in range(1, 13):
            ws1.cell(row=r, column=c).border = border_thin

    ws1.merge_cells('A11:L11')
    ws1['A11'] = 'I. DANH MỤC CÁC MẶT HÀNG ĐÃ HOÀN THÀNH THẨM ĐỊNH & CHỐT ĐƠN GIÁ'
    ws1['A11'].font = Font(name='Times New Roman', size=11, bold=True, color='003366')

    headers_s1 = [
        'STT', 'Mã Vật Tư', 'Tên Vật Tư', 'Quy Cách Kỹ Thuật', 'Hãng SX/Xuất Xứ', 'ĐVT', 'SL',
        'Đơn Giá Trình', 'Đơn Giá Thẩm Định', 'Thành Tiền Thẩm Định', 'Giá Trị Giảm',
        'Ý Kiến Đánh Giá Của Tổ Thẩm Định'
    ]
    for c_idx, h_text in enumerate(headers_s1, 1):
        c = ws1.cell(row=12, column=c_idx, value=h_text)
        c.font = font_hdr
        c.fill = fill_navy
        c.border = border_thin
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws1.row_dimensions[12].height = 28

    cur_r = 13
    for idx, it in enumerate(appraised_items, 1):
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        dgtn = it.get('don_gia_thong_nhat', dgt)
        tttn = it.get('thanh_tien_thong_nhat', sl * dgtn)
        giam = it.get('gia_tri_giam', 0)
        eval_text = "Chi tiết xin xem sheet Hồ sơ chứng cứ & Hình ảnh"

        vals = [
            idx,
            it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'),
            sl, dgt, dgtn, tttn, giam, eval_text
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws1.cell(row=cur_r, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if c_idx in (7, 8, 9, 10, 11):
                c.number_format = '#,##0'
            if c_idx in (1, 6):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 12:
                c.font = Font(name='Times New Roman', size=10, italic=True, color='0055AA', underline='single')
                c.alignment = Alignment(horizontal='center', vertical='center')
                c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{4 + idx}"
            else:
                c.alignment = Alignment(horizontal='right', vertical='center')
            if c_idx == 11 and giam > 0:
                c.font = font_saving
        ws1.row_dimensions[cur_r].height = 28
        cur_r += 1

    # Summary row
    ws1.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=9)
    ws1.cell(row=cur_r, column=1, value='TỔNG CỘNG CÁC MỤC ĐÃ CHỐT THẨM ĐỊNH:').font = font_bold_navy
    ws1.cell(row=cur_r, column=1).alignment = Alignment(horizontal='right', vertical='center')
    sum_tttn_appraised = sum([it.get('thanh_tien_thong_nhat', 0) for it in appraised_items])
    sum_giam_appraised = sum([it.get('gia_tri_giam', 0) for it in appraised_items])
    ws1.cell(row=cur_r, column=10, value=sum_tttn_appraised).font = font_bold_navy
    ws1.cell(row=cur_r, column=10).number_format = '#,##0'
    ws1.cell(row=cur_r, column=10).alignment = Alignment(horizontal='right', vertical='center')
    ws1.cell(row=cur_r, column=11, value=sum_giam_appraised).font = font_saving
    ws1.cell(row=cur_r, column=11).number_format = '#,##0'
    ws1.cell(row=cur_r, column=11).alignment = Alignment(horizontal='right', vertical='center')
    for c_idx in range(1, 13):
        cell = ws1.cell(row=cur_r, column=c_idx)
        cell.border = border_thin
        cell.fill = fill_navy_light
    ws1.row_dimensions[cur_r].height = 24
    cur_r += 3

    # Signatures
    ws1.cell(row=cur_r, column=2, value='NGƯỜI LẬP BÁO CÁO / THƯ KÝ TỔ TTĐ').font = font_bold_navy
    ws1.cell(row=cur_r, column=10, value='TỔ TRƯỞNG TỔ THẨM ĐỊNH DỰ TOÁN').font = font_bold_navy
    ws1.cell(row=cur_r+1, column=2, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+1, column=10, value='(Ký và ghi rõ họ tên)').font = font_sub
    ws1.cell(row=cur_r+6, column=2, value=creator).font = font_data_bold
    ws1.cell(row=cur_r+6, column=10, value='...................................................').font = font_data_bold

    for col_letter, w in [('A',6),('B',18),('C',30),('D',36),('E',20),('F',8),('G',8),('H',16),('I',16),('J',18),('K',16),('L',38)]:
        ws1.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 2: Danh Mục Chi Tiết
    # ========================================================================
    ws2 = wb.create_sheet(title='2. Danh Mục Chi Tiết')
    ws2.sheet_view.showGridLines = True
    ws2.freeze_panes = 'A5'

    ws2['A1'] = f'BẢNG THEO DÕI CHI TIẾT TIẾN ĐỘ & KẾT QUẢ THẨM ĐỊNH ({total_items} MỤC)'
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
    for idx, it in enumerate(items, 1):
        sl = it.get('so_luong', 1)
        dgt = it.get('don_gia_trinh', 0)
        tt_tr = it.get('thanh_tien_trinh', sl * dgt)
        dgtn = it.get('don_gia_thong_nhat', dgt)
        tt_tn = it.get('thanh_tien_thong_nhat', sl * dgtn)
        giam = it.get('gia_tri_giam', 0)
        is_done = (giam > 0) or (it.get('co_so_thong_nhat') and dgtn > 0 and idx <= 10)
        status_str = 'ĐÃ CHỐT' if is_done else 'Đang rà soát'
        cs_note = 'Chi tiết xem sheet Hồ sơ chứng cứ & Hình ảnh' if is_done else it.get('ghi_chu', '')

        vals = [
            idx, it.get('ma_vt', ''),
            it.get('ten_vt_goc') or it.get('ten_vt', ''),
            it.get('thong_so_kt') or it.get('part_no', ''),
            it.get('hsx_xx', ''),
            it.get('dvt', 'Cái'), sl, dgt, tt_tr, dgtn, tt_tn, giam, status_str, cs_note
        ]
        for c_idx, val in enumerate(vals, 1):
            c = ws2.cell(row=r_idx, column=c_idx, value=val)
            c.font = font_data
            c.border = border_thin
            if is_done:
                c.fill = fill_navy_light
            if c_idx in (7, 8, 9, 10, 11, 12):
                c.number_format = '#,##0'
            if c_idx in (1, 6, 13):
                c.alignment = Alignment(horizontal='center', vertical='center')
            elif c_idx in (2, 5):
                c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            elif c_idx in (3, 4):
                c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            elif c_idx == 14:
                if is_done:
                    c.font = Font(name='Times New Roman', size=10, italic=True, color='0055AA', underline='single')
                    c.alignment = Alignment(horizontal='center', vertical='center')
                    if it in appraised_items:
                        s3_row = 4 + (appraised_items.index(it) + 1)
                        c.hyperlink = f"#'3. Hồ Sơ Chứng Cứ & Hình Ảnh'!A{s3_row}"
                else:
                    c.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            else:
                c.alignment = Alignment(horizontal='right', vertical='center')
            if c_idx == 12 and giam > 0:
                c.font = font_saving
            if c_idx == 13 and is_done:
                c.font = Font(name='Times New Roman', size=9, bold=True, color='15803D')
        ws2.row_dimensions[r_idx].height = 24
        r_idx += 1

    # Summary Row Sheet 2
    ws2.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=8)
    ws2.cell(row=r_idx, column=1, value=f'TỔNG CỘNG TOÀN BỘ {total_items} MỤC:').font = font_bold_navy
    ws2.cell(row=r_idx, column=1).alignment = Alignment(horizontal='right', vertical='center')
    ws2.cell(row=r_idx, column=9, value=sum_trinh).font = font_bold_navy
    ws2.cell(row=r_idx, column=9).number_format = '#,##0'
    ws2.cell(row=r_idx, column=11, value=sum_tn).font = font_bold_navy
    ws2.cell(row=r_idx, column=11).number_format = '#,##0'
    ws2.cell(row=r_idx, column=12, value=sum_giam).font = font_saving
    ws2.cell(row=r_idx, column=12).number_format = '#,##0'
    for c_idx in range(1, 15):
        c = ws2.cell(row=r_idx, column=c_idx)
        c.border = border_thin
        c.fill = fill_group_hdr
    ws2.row_dimensions[r_idx].height = 24

    for col_letter, w in [('A',6),('B',18),('C',28),('D',32),('E',18),('F',8),('G',8),('H',16),('I',18),('J',16),('K',18),('L',16),('M',14),('N',34)]:
        ws2.column_dimensions[col_letter].width = w

    # ========================================================================
    # SHEET 3: Hồ Sơ Chứng Cứ & Hình Ảnh
    # ========================================================================
    ws3 = wb.create_sheet(title='3. Hồ Sơ Chứng Cứ & Hình Ảnh')
    ws3.sheet_view.showGridLines = True
    ws3.freeze_panes = 'A5'

    ws3['A1'] = 'HỒ SƠ BẰNG CHỨNG & HÌNH ẢNH TRA CỨU ĐỐI SOÁT CỦA TỔ THẨM ĐỊNH'
    ws3['A1'].font = font_title_main
    ws3['A2'] = 'Trích xuất chi tiết hồ sơ chứng cứ, hóa đơn, hợp đồng ERP và hình ảnh đối soát thị trường cho các mục chốt giá'
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
    for idx, it in enumerate(appraised_items, 1):
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

        if cs1_txt == '—' and it.get('don_gia_trinh'):
            cs1_txt = f"Báo giá đề nghị nộp kèm: {it.get('don_gia_trinh'):,.0f} đ".replace(',', '.')
        # Lấy thông tin cơ sở chốt từ trường co_so_thong_nhat của item hoặc từ file synthesis
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
        
        basis_display = f"({co_so})" if co_so else "(Cơ sở: Tự động/Rà soát nhanh)"
        name_str = f"{it.get('ten_vt_goc') or it.get('ten_vt')}\n({it.get('thong_so_kt') or it.get('part_no') or ''})"
        dgtn = it.get('don_gia_thong_nhat', 0)
        giam = it.get('gia_tri_giam', 0)
        
        # Kết hợp thêm thông tin cơ sở vào chuỗi kết luận
        ket_luan = f"Đơn giá chốt: {dgtn:,.0f} đ\n{basis_display}\n(Tiết kiệm: {giam:,.0f} đ)".replace(',', '.')    

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

    # Save & Return
    export_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), "data", "Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")
    wb.save(export_path)
    return send_file(export_path, as_attachment=True, download_name="Bao_Cao_Tham_Dinh_Trinh_Lanh_Dao.xlsx")