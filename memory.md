# 🧠 MEMORY.MD — ThamDinhDuToanApp
> Cập nhật: 2026-09-03 16:52 | Tác giả: Nguyễn Anh Hiếu (hieuna)

---

## 1. MÔ TẢ DỰ ÁN

**ThamDinhDuToanApp** là ứng dụng web nội bộ hỗ trợ **Tổ Thẩm định Dự toán – NMNĐ Vĩnh Tân 4** đối chiếu, kiểm tra và ra kết luận thẩm định đơn giá vật tư thiết bị trong dự toán.

- **Framework**: Flask (Python)
- **Frontend**: Tailwind CSS + Lucide icons + vanilla JS
- **Port mặc định**: `5555` (`python app.py` hoặc chạy `run.bat`)
- **URL local**: `http://localhost:5555`

---

## 2. CẤU TRÚC THƯ MỤC

```
ThamDinhDuToanApp/
├── app.py                    # Flask app chính, toàn bộ API routes
├── quote_matcher.py          # Engine đối chiếu báo giá (quan trọng!)
├── imis_core.py              # Module tra cứu EVN IMIS
├── msc_matcher.py            # Module tra cứu Mua Sắm Công e-GP
├── run.bat                   # Script chạy nhanh
├── templates/
│   └── index.html            # Toàn bộ UI (~3095 dòng)
├── config/
│   ├── .erp_cache.json       # Cache ERP (không git - file lớn)
│   ├── evn_imis_token.json   # Token IMIS (NHẠY CẢM - không git!)
│   └── msc_session.json      # Session Mua Sắm Công (NHẠY CẢM - không git!)
├── data/
│   └── projects/             # Dữ liệu từng dự án (không git)
│       └── <tên_dự_án>_files/
│           ├── dossier.json                  # Danh mục vật tư
│           ├── quote_overrides.json          # Override bóc tách PDF
│           ├── item_<id>/
│           │   ├── chung_cu_quotes.json      # Chứng cứ Khối 1 (Báo giá)
│           │   ├── chung_cu_erp.json         # Chứng cứ Khối 2 (ERP)
│           │   ├── chung_cu_imis.json        # Chứng cứ Khối 3 (IMIS)
│           │   └── chung_cu_muasamcong.json  # Chứng cứ Khối 4 (MSC)
│           └── Các Báo giá gửi Thẩm định/   # Thư mục chứa PDF báo giá gốc
└── ERP.xlsx                  # File ERP (không git - 2.4MB)
```

---

## 3. CÁC TÍNH NĂNG ĐÃ HOÀN THÀNH

### 3.1 Màn hình Trình duyệt Chi tiết (Inspector)
- **Lazy Loading 4 Khối**: Chỉ khởi chạy backend khi user bấm vào khối đó. Các khối chưa làm ẩn đi.
- **Stepper Lưu & Đi Tiếp**: Mỗi khối có nút `[💾 Lưu & Đi Tiếp]`, tự động chuyển sang khối tiếp theo.
- **Sidebar Tiến độ 4 Khối**: Mỗi thẻ mục trong sidebar hiển thị 4 badge `[1.BG] [2.ERP] [3.IMIS] [4.MSC]` với màu sắc phản ánh trạng thái (Đã lưu / Chưa làm). Hiển thị `x/4 khối`.

### 3.2 Khối 1 — Báo Giá Gốc (PDF)
- Quét tất cả PDF trong thư mục `Các Báo giá gửi Thẩm định/`.
- Bóc tách bảng giá tự động bằng `pdfplumber`.
- Giao diện sửa thủ công từng dòng (SL, Đơn giá, Thành tiền).
- **Tổng tiền in trên PDF**: Ô nhập/khóa mốc chuẩn để đối chiếu (thay thế "Ban đầu bóc tách" cũ).
- **Nút Xem PDF gốc**: View PDF trong browser qua endpoint `/api/quotes/view-pdf?path=<encoded_path>`.

### 3.3 Thuật toán So khớp Báo giá (`quote_matcher.py`) — **Đã nâng cấp**
- **Loại bỏ so khớp theo STT dòng** (bug cũ: dòng số 3 của bất kỳ báo giá = mục #3 của dự án).
- **Phát hiện xung đột chủng loại hàng hóa** (PRODUCT_FAMILIES):
  - `ACTUATOR`, `SOLENOID`, `GASKET`, `VALVE`, `TUBE`, `FITTING`, `MODULE`, `PUMP`...
  - Nếu mục là `ACTUATOR` → tự động loại trừ các dòng `TUBE`, `GASKET`, `MODULE`... khỏi kết quả đối chiếu.
- **Trích xuất mã định danh kỹ thuật** (`extract_meaningful_identifiers`):
  - Part No. có dấu gạch ngang: `920830-113A0532`, `SS-T6-S-065-20`...
  - Token chữ+số: `DN200`, `PN40`, `IUX760`, `TZIDC110`...
  - Thương hiệu: `FLOWTEK`, `BRAY`, `SWAGELOK`, `PARKER`, `ABB`...
- **Ngưỡng chấp nhận nâng lên Score ≥ 80** (cũ là 50).
- **Loại bỏ từ phổ thông** (COMMON_STOPWORDS): `MODEL`, `TYPE`, `BAR`, `PRESSURE`, `TEST`, `BỘ`, `CÁI`...

### 3.4 Khối 2 — ERP Vĩnh Tân 4
- Tra cứu từ `ERP.xlsx` (cache vào `config/.erp_cache.json`).
- Tìm theo mã vật tư và tên.

### 3.5 Khối 3 — EVN IMIS
- Tra cứu qua API IMIS, token lưu trong `config/evn_imis_token.json`.
- Token được tự động refresh.

### 3.6 Khối 4 — Mua Sắm Công e-GP
- Tra cứu qua API e-GP, session lưu trong `config/msc_session.json`.
- User dán cURL từ Chrome DevTools để cập nhật session.

### 3.7 Tổng hợp 4 Khối → Kết luận TTĐ
- Tổng hợp dữ liệu 4 khối → tự sinh văn bản kết luận thẩm định.
- Lưu vào `dossier.json` field `danh_gia_ttd`, `don_gia_thong_nhat`, `co_so_thong_nhat`.

---

## 4. CÁC API QUAN TRỌNG

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | `/api/evidence/all-status` | Lấy tiến độ 4 khối của toàn bộ mục |
| GET | `/api/evidence/status/<item_id>` | Tiến độ 4 khối của 1 mục |
| POST | `/api/evidence/save-step` | Lưu chứng cứ 1 khối (`step_type`: `quotes/erp/imis/muasamcong`) |
| POST | `/api/quotes/match-item` | Đối chiếu báo giá cho 1 mục |
| POST | `/api/quotes/get-full-quote` | Lấy toàn bộ bảng giá của 1 file PDF |
| GET | `/api/quotes/view-pdf?path=<encoded>` | Xem PDF gốc trong browser |
| POST | `/api/quotes/save-quote-edits` | Lưu chỉnh sửa bảng giá (override) |
| POST | `/api/imis/search` | Tra cứu IMIS |
| POST | `/api/msc/search-item` | Tra cứu Mua Sắm Công |
| POST | `/api/msc/update-curl` | Cập nhật session MSC từ chuỗi cURL |

---

## 5. VẤN ĐỀ ĐÃ BIẾT / CẦN LÀM TIẾP

### ✅ Đã xong (hôm nay 2026-09-03)
- [x] Lazy loading 4 khối, chỉ kích hoạt khi cần
- [x] Nút Lưu & Đi Tiếp ở từng khối
- [x] Sidebar mini badges 4 khối (cập nhật real-time)
- [x] API `/api/evidence/all-status`
- [x] Fix bug `TypeError: Cannot set properties of null (setting 'textContent')` trong openQuoteDetails
- [x] Nâng cấp thuật toán so khớp báo giá (chống nhầm chủng loại, loại STT, dùng Part No & Brand)
- [x] Fix lỗi URL view PDF gốc bị mất dấu `\` → `/api/quotes/view-pdf?path=<đúng>`
- [x] Restore dữ liệu An Hiếu bị test script làm hỏng (Row 1 SL=5, ĐG=56tr, Total=6.852.250.000)
- [x] Thiết kế header "Tổng tiền in trên PDF" thay thế "Ban đầu bóc tách"

### 🔲 Chưa làm / Làm tiếp ở nhà
- [ ] **OCR báo giá scan** (vd: Gia Lợi): App hiện chỉ đọc được PDF text-layer, chưa OCR ảnh quét. Tạm hoãn.
- [ ] **Cải thiện bóc tách PDF đa dạng cấu trúc bảng** (một số PDF có header khác thường).
- [ ] Thêm nhiều thương hiệu vào `PRODUCT_FAMILIES` khi gặp vật tư mới chưa phân loại được.
- [ ] Xuất báo cáo thẩm định dạng Word/PDF chính thức.
- [ ] Xử lý trường hợp 1 báo giá chào cùng 1 mục ở nhiều dòng (trùng lặp).

---

## 6. GHI CHÚ KỸ THUẬT

### Dữ liệu nhạy cảm — KHÔNG ĐƯA LÊN GIT
- `config/evn_imis_token.json`: Token xác thực IMIS (username/password hash)
- `config/msc_session.json`: Cookie session Mua Sắm Công e-GP
- `data/projects/`: Dữ liệu dự án thực tế (thông tin tài chính nội bộ EVN)

### Cài đặt môi trường tại nhà
```bash
pip install flask flask-cors pdfplumber openpyxl requests
python app.py
# Mở http://localhost:5555
```

### Cấu hình ERP (cần file ERP.xlsx)
- Copy `ERP.xlsx` từ máy văn phòng vào thư mục gốc
- Lần đầu chạy sẽ tự build cache `.erp_cache.json`

### Cấu hình IMIS tại nhà
- Đăng nhập lại IMIS trong app, nhập username/password để lấy token mới
- Token lưu tự động vào `config/evn_imis_token.json`

### Cấu hình Mua Sắm Công tại nhà
- Vào `http://muasamcong.mpi.gov.vn`, mở Chrome DevTools → Network
- Tìm bất kỳ request nào → Copy as cURL
- Dán vào App tại Khối 4 → nút "Cập nhật cURL"

---

## 7. PROJECT HIỆN TẠI ĐANG MỞ

- **Dự án**: `ThamDinhDot8_lần2` (hoặc tên tương tự trong `data/projects/`)
- **Thư mục báo giá**: `Các Báo giá gửi Thẩm định/` trong thư mục dự án
- Các file báo giá đang có:
  - `BÁO GIÁ An Hiếu.pdf` — An Hiếu
  - `BG-EME -VT4.1.pdf` — EME
  - `Báo giá DTL 19.8.2026.xlsx fn.pdf` — DTL
  - `08-27-26. BV-VT 4...` — Thăng Long
