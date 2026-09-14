# 🌟 DẤU ẤN KỶ NIỆM: ĐẠI PHẪU KIẾN TRÚC & NGUYÊN TẮC "1 BIẾN TỪ CHA ĐẾN CON"
**Dự án:** `ThamDinhDuToanApp v2.0` — Hệ Thống Thẩm Định Dự Toán & So Sánh Giá Đa Nguồn EVN Vĩnh Tân 4  
**Thời khắc hoàn thành:** 14/09/2026  
**Nhánh Git:** `refactor/architecture-upgrade`  
**Kiến trúc sư & Kỹ sư:** Anh Hiếu & Antigravity (Google DeepMind)

---

## 📜 I. BỐI CẢNH & NGUYÊN NHÂN SỰ CỐ
Trước đợt tái cấu trúc này, hệ thống gặp phải hai vấn đề nan giải:
1. **Lệch số liệu tiết kiệm ở Mục STT 6 (Van bi GEFA DG1)**: 
   - Trên bảng Grid Matrix hiển thị tiết kiệm **52.340.000 đ** (-85.5%), nhưng khi mở Modal đối soát thì giá trị giảm bị nhảy về **0 đ**.
   - **Nguyên nhân cốt lõi**: Vi phạm nguyên tắc luồng dữ liệu một chiều *"1 biến từ Cha đến Con"*. Modal con tự khai báo và tính toán lại biến cục bộ `giaTriGiam`, trong khi Backend Model `DossierItem` lại tự ý chạy hàm `recalculate_totals()` ngầm trong `__init__`, gây xung đột và sai lệch trạng thái thực tế lưu trữ trong CSDL.
2. **Khuyết thiếu dịch vụ sau khi tách Blueprint**:
   - Khi tách file nguyên khối `app.py` thành các Flask Blueprints (`pillar_routes.py`, `dossier_routes.py`), nhiều endpoint cốt lõi (IMIS login/token, ERP upload/mapping, Excel import/export/template, Quotes match-all/browse) bị bỏ quên hoặc chưa được đóng gói vào tầng Service.

---

## 🎯 II. HAI NGUYÊN TẮC VÀNG ĐÃ THIẾT LẬP
1. **Nguyên tắc "1 biến từ Cha đến Con" (Single Source of Truth - Props Down, Events Up)**:
   - Dữ liệu giá duyệt (`don_gia_thong_nhat`), cơ sở duyệt (`co_so_thong_nhat`) và giá trị tiết kiệm (`gia_tri_giam`) chỉ có **duy nhất một nguồn chân lý**.
   - Bảng Grid (Cha) truyền nguyên vẹn biến chuẩn này xuống Modal (Con) qua props. Modal tuyệt đối không tự tính toán ngầm ghi đè, chỉ tính lại khi người dùng trực tiếp bấm chọn/hủy chứng cứ.
2. **Không computed ngầm ở Backend Models (Pure Data Schema)**:
   - `DossierItem` đóng vai trò là Schema dữ liệu thuần khiết (Pure Data Model), trung thực tuyệt đối với CSDL JSON.
   - Loại bỏ hoàn toàn việc tự gán hay tự tính toán lại dữ liệu trong hàm khởi tạo `__init__`. Mọi logic suy diễn chỉ được cung cấp qua `@property` đọc (như `pct_giam`).

---

## 🏛️ III. KIẾN TRÚC 4 PHÂN TẦNG HOÀN HẢO (LAYERED ARCHITECTURE)
Hệ thống được chuẩn hóa triệt để thành 4 phân tầng độc lập, mạch lạc:
1. **Tầng Thực Thể (Models)**:
   - `ProjectDossier`, `DossierItem`, `QuotesEvidence`, `ErpEvidence`, `ImisEvidence`, `MscEvidence`, `SynthesisEvidence`.
2. **Tầng Lưu Trữ (Storage Layer)**:
   - `FileRepository`, `AtomicWriter` (chống hỏng file khi crash/mất điện), `OneDriveAdapter` (đồng bộ đám mây 2 chiều với OneDrive EVN Cache).
3. **Tầng Nghiệp Vụ Chuyên Biệt (Services)**:
   - `QuoteService`: Bóc tách PDF, quét so khớp đơn giá 1 mục và toàn bộ 112 mục, duyệt báo giá dự án, Windows Native Folder Picker.
   - `ErpService`: Tra cứu CSDL lịch sử mua sắm ERP Vĩnh Tân 4, quản trị file `ERP.xlsx`, xem trước cột và ánh xạ 13 cột pháp lý.
   - `ImisService`: Tra cứu Hợp đồng toàn ngành EVN, đăng nhập tài khoản EVN IMIS, tự động quản lý và gia hạn JWT Token.
   - `MscService`: Tra cứu dữ liệu trúng thầu cổng Mua Sắm Công Quốc Gia e-GP, tự động quy đổi giá trước thuế VAT.
   - `AiSynthesisService`: Tổng hợp đa chiều 5 cơ sở chứng cứ và tự động sinh bản thuyết minh thẩm định giá.
   - `ExcelService`: Nạp bảng tính dự toán mẫu/tự do, xuất bảng thẩm định hoàn chỉnh và tải file mẫu 13 cột chuẩn EVN.
4. **Tầng Giao Tiếp API (Routes Blueprints)**:
   - `system_routes`, `dossier_routes`, `evidence_routes`, `pillar_routes`, `pipeline_routes`, `api_export_executive_report`.

---

## 📊 IV. KẾT QUẢ NGHIỆM THU RỰC RỠ
- **Độ bao phủ Route**: Đầy đủ **61/61 API routes** (Bảo toàn 100% không sót bất kỳ endpoint nào trước refactor).
- **Kiểm thử tự động**: **36/36 Unit Tests PASSED 100%** (trong 15.592s).
- **Độ toàn vẹn CSDL**: Nạp thành công 100% **900 tệp chứng cứ thực tế**, `Diff count = 0` trên toàn bộ 112 mục.
- **Biên dịch Frontend**: Vite build hoàn tất thành công trong **878ms** (0 lỗi, 0 cảnh báo).
- **Báo cáo Lãnh đạo**: Xuất bản báo cáo Excel 3 sheet Executive Report đạt chuẩn 3.54 MB kèm ảnh biểu đồ trực quan.

---

> *"Một kiến trúc tốt không phải là một kiến trúc phức tạp, mà là nơi mỗi dòng dữ liệu đều biết rõ nguồn cội và đích đến của mình."*  
> **Chúc mừng ThamDinhDuToanApp bước lên tầm cao kiến trúc mới!**
