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
        Xuất file Excel bảng thẩm định dự toán đầy đủ tiêu đề, màu sắc, công thức và độ rộng cột.
        Trả về đường dẫn tệp file Excel đã lưu.
        """
        active_repo = repo or default_repo
        cur_dossier = dossier or active_repo.load_dossier()
        items = cur_dossier.items

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Tham_Dinh_Du_Toan"

        # Header Styles
        font_header = Font(name="Times New Roman", size=10, bold=True, color="FFFFFF")
        fill_header_ttd = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
        fill_header_khvt = PatternFill(start_color="1B5E20", end_color="1B5E20", fill_type="solid")
        fill_header_res = PatternFill(start_color="E65100", end_color="E65100", fill_type="solid")
        border_thin = Border(
            left=Side(style="thin", color="D0D0D0"),
            right=Side(style="thin", color="D0D0D0"),
            top=Side(style="thin", color="D0D0D0"),
            bottom=Side(style="thin", color="D0D0D0")
        )

        # Title Rows
        ws.append([cur_dossier.dossier_name or "BẢNG TỔNG HỢP Ý KIẾN THẨM ĐỊNH DỰ TOÁN"])
        ws.append(["Tổ Thẩm định Dự toán - Nhà máy Nhiệt điện Vĩnh Tân 4"])
        ws.append([])

        headers = [
            "STT", "Mã Vật Tư", "Tên Quy Cách Kỹ Thuật", "ĐVT", "Số Lượng",
            "Đơn Giá Đề Nghị (Trình)", "Thành Tiền Đề Nghị",
            "ĐÁNH GIÁ CỦA TỔ THẨM ĐỊNH (TTĐ)",
            "Ý KIẾN PHẢN BIỆN CỦA PHÒNG KHVT",
            "Đơn Giá Thống Nhất", "Thành Tiền Thống Nhất", "Giá Trị Giảm",
            "Cơ Sở Thống Nhất"
        ]
        ws.append(headers)

        row_header_idx = 4
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=row_header_idx, column=col_idx)
            cell.font = font_header
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            if col_idx in (8,):
                cell.fill = fill_header_ttd
            elif col_idx in (9,):
                cell.fill = fill_header_khvt
            elif col_idx in (10, 11, 12, 13):
                cell.fill = fill_header_res
            else:
                cell.fill = fill_header_ttd

        font_data = Font(name="Times New Roman", size=10)
        for idx, it in enumerate(items, 1):
            it_dict = it.to_dict() if isinstance(it, DossierItem) else it
            dg_trinh = float(it_dict.get("don_gia_trinh") or 0)
            sl = float(it_dict.get("so_luong") or 0)
            tt_trinh = round(sl * dg_trinh, 0)
            dg_tn = float(it_dict.get("don_gia_thong_nhat") or dg_trinh)
            tt_tn = round(sl * dg_tn, 0)
            giam = max(0.0, float(it_dict.get("gia_tri_giam") or (tt_trinh - tt_tn)))

            row_vals = [
                idx,
                it_dict.get("ma_vt", ""),
                it_dict.get("ten_vt", ""),
                it_dict.get("dvt", ""),
                sl,
                dg_trinh,
                tt_trinh,
                it_dict.get("danh_gia_ttd", ""),
                it_dict.get("phan_bien_khvt", ""),
                dg_tn,
                tt_tn,
                giam,
                it_dict.get("co_so_thong_nhat", "")
            ]
            ws.append(row_vals)
            cur_row = row_header_idx + idx
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=cur_row, column=col_idx)
                c.font = font_data
                c.border = border_thin
                if col_idx in (5, 6, 7, 10, 11, 12):
                    c.number_format = '#,##0'
                if col_idx in (1, 4):
                    c.alignment = Alignment(horizontal="center", vertical="top")
                elif col_idx in (8, 9, 13):
                    c.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                else:
                    c.alignment = Alignment(vertical="top")

        # Độ rộng cột
        ws.column_dimensions['A'].width = 6
        ws.column_dimensions['B'].width = 22
        ws.column_dimensions['C'].width = 36
        ws.column_dimensions['D'].width = 8
        ws.column_dimensions['E'].width = 8
        ws.column_dimensions['F'].width = 16
        ws.column_dimensions['G'].width = 18
        ws.column_dimensions['H'].width = 38
        ws.column_dimensions['I'].width = 38
        ws.column_dimensions['J'].width = 16
        ws.column_dimensions['K'].width = 18
        ws.column_dimensions['L'].width = 16
        ws.column_dimensions['M'].width = 38

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
