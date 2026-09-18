# -*- coding: utf-8 -*-
"""
ThamDinhDuToanApp - Excel Service
Dịch vụ xử lý nạp dữ liệu từ file Excel, xuất báo cáo thẩm định Excel và tạo file mẫu 13 cột.
"""

import os
from typing import Any, Dict, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

from models import DossierItem, ProjectDossier
from storage import default_repo, FileRepository


class ExcelService:
    """Dịch vụ nghiệp vụ xuất nhập bảng tính Excel."""

    @staticmethod
    def import_excel(file_storage, repo: Optional[FileRepository] = None) -> Dict[str, Any]:
        """
        Đọc và phân tích file Excel dự toán từ client, hỗ trợ cả định dạng 13 cột chuẩn
        lẫn định dạng bảng dự toán tự do, sau đó lưu cập nhật vào hồ sơ hiện hành.
        """
        active_repo = repo or default_repo
        if not file_storage or not getattr(file_storage, "filename", ""):
            return {"success": False, "message": "Không tìm thấy file tải lên."}

        try:
            wb = openpyxl.load_workbook(file_storage, data_only=True)
            ws = wb.active

            items = []
            item_id = 1
            rows_list = list(ws.iter_rows(values_only=True))

            # 1. Tự động tìm dòng Tiêu đề (Header)
            start_row_idx = 0
            is_13_cols_format = False
            for idx, r in enumerate(rows_list):
                if not r:
                    continue
                r_str = " ".join([str(c or "").upper() for c in r])
                if "THÔNG SỐ KỸ THUẬT" in r_str or "ĐƠN GIÁ MIN" in r_str or ("PYCVT" in r_str and "MÃ ERP" in r_str):
                    start_row_idx = idx + 1
                    is_13_cols_format = True
                    break
                elif ("TÊN" in r_str and ("QUY CÁCH" in r_str or "VẬT TƯ" in r_str)) or ("MÃ VẬT TƯ" in r_str and "STT" in r_str):
                    start_row_idx = idx + 1
                    break

            for row in rows_list[start_row_idx:]:
                if not row or not any(row):
                    continue

                if is_13_cols_format:
                    pycvt = str(row[1] if len(row) > 1 else "").strip()
                    ten_vt_goc = str(row[2] if len(row) > 2 else "").strip()
                    thong_so_kt = str(row[3] if len(row) > 3 else "").strip()
                    dvt = str(row[4] if len(row) > 4 else "Cái").strip()
                    try:
                        sl = float(row[5] if len(row) > 5 else 1)
                    except Exception:
                        sl = 1.0
                    hsx_xx = str(row[6] if len(row) > 6 else "").strip()
                    ma_erp = str(row[7] if len(row) > 7 else "").strip()
                    try:
                        dg_trinh = float(row[8] if len(row) > 8 else 0)
                    except Exception:
                        dg_trinh = 0.0
                    try:
                        tt_trinh = float(row[9] if len(row) > 9 else round(sl * dg_trinh, 0))
                    except Exception:
                        tt_trinh = round(sl * dg_trinh, 0)
                    thue = str(row[10] if len(row) > 10 else "").strip()
                    try:
                        tien_thue = float(row[11] if len(row) > 11 else 0)
                    except Exception:
                        tien_thue = 0.0
                    ghi_chu = str(row[12] if len(row) > 12 else "").strip()

                    if not ten_vt_goc and not thong_so_kt:
                        continue
                    if ten_vt_goc.upper() in ("TÊN VẬT TƯ", "STT"):
                        continue

                    full_name = f"{ten_vt_goc} - {thong_so_kt}" if (ten_vt_goc and thong_so_kt) else (ten_vt_goc or thong_so_kt)
                    part_no = thong_so_kt or ma_erp

                    items.append({
                        "id": item_id,
                        "pycvt": pycvt,
                        "ma_vt": ma_erp,
                        "part_no": part_no,
                        "ten_vt": full_name,
                        "ten_vt_goc": ten_vt_goc,
                        "thong_so_kt": thong_so_kt,
                        "hsx_xx": hsx_xx,
                        "dvt": dvt,
                        "so_luong": sl,
                        "don_gia_trinh": dg_trinh,
                        "thanh_tien_trinh": tt_trinh,
                        "thue": thue,
                        "tien_thue": tien_thue,
                        "danh_gia_ttd": "",
                        "phan_bien_khvt": "",
                        "don_gia_thong_nhat": dg_trinh,
                        "thanh_tien_thong_nhat": tt_trinh,
                        "gia_tri_giam": 0.0,
                        "co_so_thong_nhat": "",
                        "ghi_chu": ghi_chu
                    })
                else:
                    ten_vt = str(row[2] if len(row) > 2 else (row[1] or "")).strip()
                    if not ten_vt or ten_vt.upper() in ("TÊN QUY CÁCH", "TÊN VẬT TƯ", "TÊN QUY CÁCH KỸ THUẬT VẬT TƯ"):
                        continue

                    ma_vt = str(row[1] if len(row) > 1 else "").strip()
                    dvt = str(row[3] if len(row) > 3 else "Cái").strip()
                    try:
                        sl = float(row[4] if len(row) > 4 else 1)
                    except Exception:
                        sl = 1.0
                    try:
                        dg_trinh = float(row[5] if len(row) > 5 else 0)
                    except Exception:
                        dg_trinh = 0.0

                    tt_trinh = round(sl * dg_trinh, 0)
                    dg_ttd = str(row[7] if len(row) > 7 else "").strip()
                    pb_khvt = str(row[8] if len(row) > 8 else "").strip()
                    try:
                        dg_tn = float(row[9] if len(row) > 9 else dg_trinh)
                    except Exception:
                        dg_tn = dg_trinh
                    tt_tn = round(sl * dg_tn, 0)
                    gia_giam = max(0.0, tt_trinh - tt_tn)
                    co_so_tn = str(row[12] if len(row) > 12 else "").strip()

                    items.append({
                        "id": item_id,
                        "pycvt": "",
                        "ma_vt": ma_vt,
                        "part_no": ma_vt,
                        "ten_vt": ten_vt,
                        "ten_vt_goc": ten_vt,
                        "thong_so_kt": "",
                        "hsx_xx": "",
                        "dvt": dvt,
                        "so_luong": sl,
                        "don_gia_trinh": dg_trinh,
                        "thanh_tien_trinh": tt_trinh,
                        "danh_gia_ttd": dg_ttd,
                        "phan_bien_khvt": pb_khvt,
                        "don_gia_thong_nhat": dg_tn,
                        "thanh_tien_thong_nhat": tt_tn,
                        "gia_tri_giam": gia_giam,
                        "co_so_thong_nhat": co_so_tn
                    })
                item_id += 1

            # Nạp vào dossier hiện hành
            dossier = active_repo.load_dossier()
            dossier.items = [DossierItem.from_dict(it) for it in items]
            dossier_name = os.path.splitext(file_storage.filename)[0]
            dossier.dossier_name = dossier_name
            active_repo.save_dossier(dossier)

            return {
                "success": True,
                "dossier": dossier.to_dict(),
                "count": len(items),
            }
        except Exception as e:
            return {"success": False, "message": f"Lỗi đọc file Excel: {e}"}

    @staticmethod
    def export_excel(dossier: Optional[ProjectDossier] = None, repo: Optional[FileRepository] = None) -> str:
        """
        Xuất file Excel bảng thẩm định dự toán chuẩn hóa 13 cột theo đúng giao diện hệ thống UI,
        kèm đầy đủ cơ sở đối soát pháp lý, ý kiến thẩm định, công thức và độ rộng cột tối ưu.
        Trả về đường dẫn tệp file Excel đã lưu (Bang_Tham_Dinh_Du_Toan.xlsx).
        """
        active_repo = repo or default_repo
        cur_dossier = dossier or active_repo.load_dossier()
        items = cur_dossier.items

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Bang_Tham_Dinh_13_Cot"
        ws.sheet_view.showGridLines = True
        ws.freeze_panes = 'A6'

        font_title_gov = Font(name="Times New Roman", size=10, bold=True, color="333333")
        font_title_main = Font(name="Times New Roman", size=13, bold=True, color="003366")
        font_sub = Font(name="Times New Roman", size=10, italic=True, color="555555")
        font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
        font_data = Font(name="Times New Roman", size=10)
        font_data_bold = Font(name="Times New Roman", size=10, bold=True)
        font_saving = Font(name="Times New Roman", size=10, bold=True, color="15803D")
        font_warning = Font(name="Times New Roman", size=10, bold=True, color="B91C1C")

        fill_header_main = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
        fill_header_res = PatternFill(start_color="105E3C", end_color="105E3C", fill_type="solid")
        fill_header_cs = PatternFill(start_color="78350F", end_color="78350F", fill_type="solid")
        fill_navy_light = PatternFill(start_color="EBF3FA", end_color="EBF3FA", fill_type="solid")
        fill_green_light = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
        fill_yellow_light = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
        fill_summary = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

        border_thin = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1")
        )

        def _normalize_pillar(co_so_text, is_pending=False):
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

        # Tiêu đề trang trọng
        ws['A1'] = "TẬP ĐOÀN ĐIỆN LỰC VIỆT NAM - NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4"; ws['A1'].font = font_title_gov
        ws['A2'] = "TỔ THẨM ĐỊNH DỰ TOÁN"; ws['A2'].font = Font(name="Times New Roman", size=10, bold=True, color="003366", underline="single")

        ws.merge_cells('A3:O3')
        ws['A3'] = "BẢNG TỔNG HỢP KẾT QUẢ THẨM ĐỊNH DỰ TOÁN MUA SẮM VẬT TƯ"
        ws['A3'].font = font_title_main
        ws['A3'].alignment = Alignment(horizontal="center", vertical="center")

        ws.merge_cells('A4:O4')
        creator = cur_dossier.creator or "Nguyễn Anh Hiếu"
        ws['A4'] = f"Hồ sơ: {cur_dossier.dossier_name} | Người thực hiện: {creator} | Quy mô: {len(items)} mục"
        ws['A4'].font = font_sub
        ws['A4'].alignment = Alignment(horizontal="center", vertical="center")

        # 13 Cột Chuẩn UI + 2 Cột Thẩm Định Pháp Lý
        headers = [
            "1. STT", "2. PYCVT", "3. Tên Vật Tư", "4. Thông Số Kỹ Thuật", "5. ĐVT", "6. SL",
            "7. Hãng SX / Xuất Xứ", "8. Mã ERP", "9. ĐG Trình (VNĐ)", "10. TT Trình (VNĐ)",
            "11. ĐG Thống Nhất (VNĐ)", "12. TT Thống Nhất (VNĐ)", "13. Tiền Tiết Kiệm (VNĐ)",
            "14. Cơ Sở Đơn Giá Thẩm Định", "15. Ý Kiến Đánh Giá Của Tổ Thẩm Định"
        ]

        row_hdr = 5
        for c_idx, h_text in enumerate(headers, 1):
            c = ws.cell(row=row_hdr, column=c_idx, value=h_text)
            c.font = font_header
            c.border = border_thin
            c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            if c_idx in (11, 12, 13):
                c.fill = fill_header_res
            elif c_idx == 14:
                c.fill = fill_header_cs
            else:
                c.fill = fill_header_main
        ws.row_dimensions[row_hdr].height = 28

        cur_r = 6
        for idx, it in enumerate(items, 1):
            it_dict = it.to_dict() if isinstance(it, DossierItem) else it
            sl = float(it_dict.get('so_luong', 1))
            dgt = float(it_dict.get('don_gia_trinh', 0))
            tt_tr = float(it_dict.get('thanh_tien_trinh', sl * dgt))
            dgtn = float(it_dict.get('don_gia_thong_nhat', 0))
            tt_tn = float(it_dict.get('thanh_tien_thong_nhat', 0))
            giam = float(it_dict.get('gia_tri_giam', 0))
            is_pend = (dgtn == 0)

            pillar_txt = _normalize_pillar(it_dict.get('co_so_thong_nhat', ''), is_pend)
            danh_gia_txt = it_dict.get('danh_gia_ttd', '')
            if len(danh_gia_txt) > 220:
                danh_gia_txt = danh_gia_txt[:220] + '...'

            dgtn_disp = dgtn if not is_pend else "Chờ chỉ đạo"
            tttn_disp = tt_tn if not is_pend else "Chờ duyệt"
            giam_disp = giam if not is_pend else "—"

            row_vals = [
                idx,
                it_dict.get('pycvt', ''),
                it_dict.get('ten_vt_goc') or it_dict.get('ten_vt', ''),
                it_dict.get('thong_so_kt') or it_dict.get('tskt', '') or it_dict.get('part_no', ''),
                it_dict.get('dvt', 'Cái'),
                sl,
                it_dict.get('hsx_xx', ''),
                it_dict.get('ma_vt', ''),
                dgt,
                tt_tr,
                dgtn_disp,
                tttn_disp,
                giam_disp,
                pillar_txt,
                danh_gia_txt
            ]

            for c_idx, val in enumerate(row_vals, 1):
                c = ws.cell(row=cur_r, column=c_idx, value=val)
                c.font = font_data
                c.border = border_thin
                if is_pend:
                    c.fill = fill_yellow_light
                elif giam > 0:
                    c.fill = fill_green_light
                else:
                    c.fill = fill_navy_light

                if c_idx in (1, 2, 5):
                    c.alignment = Alignment(horizontal="center", vertical="top")
                elif c_idx in (7, 8, 14):
                    c.alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
                elif c_idx in (3, 4, 15):
                    c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                else:
                    c.alignment = Alignment(horizontal="right", vertical="top")

                if c_idx in (6, 9, 10):
                    if isinstance(val, (int, float)):
                        c.number_format = '#,##0'
                elif c_idx in (11, 12, 13):
                    if isinstance(val, (int, float)):
                        c.number_format = '#,##0'
                    if c_idx == 13 and isinstance(val, (int, float)) and val > 0:
                        c.font = font_saving

                if is_pend and c_idx in (11, 12, 13, 14):
                    c.font = font_warning

            ws.row_dimensions[cur_r].height = 24
            cur_r += 1

        # Summary Row
        ws.merge_cells(start_row=cur_r, start_column=1, end_row=cur_r, end_column=9)
        ws.cell(row=cur_r, column=1, value=f"TỔNG CỘNG TOÀN BỘ ({len(items)} MỤC):").font = font_data_bold
        ws.cell(row=cur_r, column=1).alignment = Alignment(horizontal="right", vertical="center")

        sum_trinh_all = sum(float(it.to_dict().get('thanh_tien_trinh', 0) if isinstance(it, DossierItem) else it.get('thanh_tien_trinh', 0)) for it in items)
        sum_tn_all = sum(float(it.to_dict().get('thanh_tien_thong_nhat', 0) if isinstance(it, DossierItem) else it.get('thanh_tien_thong_nhat', 0)) for it in items if float(it.to_dict().get('don_gia_thong_nhat', 0) if isinstance(it, DossierItem) else it.get('don_gia_thong_nhat', 0)) > 0)
        sum_giam_all = sum(float(it.to_dict().get('gia_tri_giam', 0) if isinstance(it, DossierItem) else it.get('gia_tri_giam', 0)) for it in items)

        ws.cell(row=cur_r, column=10, value=sum_trinh_all).font = font_data_bold; ws.cell(row=cur_r, column=10).number_format = '#,##0'
        ws.cell(row=cur_r, column=11, value="—").font = font_data_bold; ws.cell(row=cur_r, column=11).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=cur_r, column=12, value=sum_tn_all).font = font_data_bold; ws.cell(row=cur_r, column=12).number_format = '#,##0'
        ws.cell(row=cur_r, column=13, value=sum_giam_all).font = font_saving; ws.cell(row=cur_r, column=13).number_format = '#,##0'

        for c_idx in range(1, 16):
            cell = ws.cell(row=cur_r, column=c_idx)
            cell.border = border_thin
            cell.fill = fill_summary
        ws.row_dimensions[cur_r].height = 26
        cur_r += 3

        # Signatures
        ws.cell(row=cur_r, column=3, value="NGƯỜI LẬP BẢNG / THƯ KÝ TỔ TTĐ").font = font_data_bold
        ws.cell(row=cur_r, column=12, value="TỔ TRƯỞNG TỔ THẨM ĐỊNH DỰ TOÁN").font = font_data_bold
        ws.cell(row=cur_r+1, column=3, value="(Ký và ghi rõ họ tên)").font = font_sub
        ws.cell(row=cur_r+1, column=12, value="(Ký và ghi rõ họ tên)").font = font_sub
        ws.cell(row=cur_r+5, column=3, value=creator).font = font_data_bold
        ws.cell(row=cur_r+5, column=12, value="...................................................").font = font_data_bold

        col_widths = [('A',6), ('B',14), ('C',28), ('D',32), ('E',8), ('F',8), ('G',18), ('H',18), ('I',16), ('J',18), ('K',16), ('L',18), ('M',16), ('N',28), ('O',36)]
        for col_letter, w in col_widths:
            ws.column_dimensions[col_letter].width = w

        export_path = os.path.join(active_repo.data_dir, "Bang_Tham_Dinh_Du_Toan.xlsx")
        wb.save(export_path)
        return export_path

    @staticmethod
    def download_template(target_dir: str = "") -> str:
        """
        Xuất file Excel mẫu chuẩn 13 cột theo đúng quy định mua sắm của EVN Vĩnh Tân 4.
        Trả về đường dẫn tệp file Excel mẫu.
        """
        out_dir = target_dir or default_repo.data_dir
        os.makedirs(out_dir, exist_ok=True)
        template_path = os.path.join(out_dir, "Mau_Bang_Du_Toan_13_Cot.xlsx")

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Mau_Du_Toan"

        font_title = Font(name="Times New Roman", size=13, bold=True, color="003366")
        font_sub = Font(name="Times New Roman", size=10, italic=True, color="555555")
        font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
        fill_header = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
        border_thin = Border(
            left=Side(style="thin", color="B0B0B0"),
            right=Side(style="thin", color="B0B0B0"),
            top=Side(style="thin", color="B0B0B0"),
            bottom=Side(style="thin", color="B0B0B0")
        )

        ws.append(["MẪU BẢNG DỰ TOÁN ĐỀ NGHỊ MUA SẮM & THẨM ĐỊNH GIÁ VẬT TƯ"])
        ws.cell(row=1, column=1).font = font_title
        ws.append(["(Điền danh mục theo đúng các cột dưới đây, sau đó dùng nút 'Nạp Excel Dự Toán' trên ứng dụng để nhập dữ liệu)"])
        ws.cell(row=2, column=1).font = font_sub
        ws.append([])

        headers = [
            "STT", "PYCVT", "Tên vật tư", "Thông số kỹ thuật", "ĐVT",
            "Số lượng mua sắm", "HSX/XX", "Mã ERP", "Đơn giá min",
            "Thành tiền", "Thuế", "Tiền thuế", "Ghi chú"
        ]
        ws.append(headers)
        row_hdr = 4

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_hdr, column=col_idx)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border_thin

        sample_data = [
            [1, "PYC 1234/VT4", "Module đầu vào input", "IUX 760 MI dùng cho hệ thống DCS Foxboro", "Cái", 4, "Foxboro / Pháp", "3.82.63.134.ENG.00.000", 13559000, "=F5*I5", 0.1, "=J5*K5", "Vật tư thay thế tủ điều khiển DCS"],
            [2, "PYC 1234/VT4", "Mặt công tắc", "Dùng cho 2 thiết bị - Model 6802", "Cái", 5, "Sino / Việt Nam", "3.34.40.292.VIE.00.000", 45000, "=F6*I6", 0.1, "=J6*K6", "Vật tư điện chiếu sáng hạ thế"],
            [3, "PYC 1234/VT4", "Hạt công tắc", "Hạt công tắc 1 chiều 16A", "Cái", 10, "Sino / Việt Nam", "3.34.40.291.VIE.00.000", 18000, "=F7*I7", 0.1, "=J7*K7", "Thiết bị đóng cắt"],
        ]

        font_data = Font(name="Times New Roman", size=10)
        for row_idx, r_vals in enumerate(sample_data, start=5):
            ws.append(r_vals)
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.font = font_data
                c.border = border_thin
                if col_idx in (1, 2, 5):
                    c.alignment = Alignment(horizontal="center", vertical="center")
                elif col_idx in (6, 9, 10, 12):
                    c.alignment = Alignment(horizontal="right", vertical="center")
                    c.number_format = '#,##0'
                elif col_idx == 11:
                    c.alignment = Alignment(horizontal="right", vertical="center")
                    c.number_format = '0.0%'
                else:
                    c.alignment = Alignment(horizontal="left", vertical="center")

        ws.column_dimensions['A'].width = 6
        ws.column_dimensions['B'].width = 16
        ws.column_dimensions['C'].width = 30
        ws.column_dimensions['D'].width = 40
        ws.column_dimensions['E'].width = 8
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 20
        ws.column_dimensions['H'].width = 24
        ws.column_dimensions['I'].width = 16
        ws.column_dimensions['J'].width = 18
        ws.column_dimensions['K'].width = 10
        ws.column_dimensions['L'].width = 16
        ws.column_dimensions['M'].width = 35

        wb.save(template_path)
        return template_path
