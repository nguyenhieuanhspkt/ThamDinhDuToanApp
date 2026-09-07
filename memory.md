# 🧠 MEMORY.MD — ThamDinhDuToanApp
> **Cập nhật ngày:** 2026-09-07 17:35 | **Tác giả:** Nguyễn Anh Hiếu (hieuna)  
> **Repository GitHub:** `https://github.com/nguyenhieuanhspkt/ThamDinhDuToanApp.git`  
> **Thư mục dự án khuyến nghị:** `D:\TaskApp_kiet\thamdinhdutoanApp`  
> **Thư mục Backup Cache/Dữ liệu ngoài Git (OneDrive EVN):** `D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache`

---

## 1. TỔNG QUAN & KIẾN TRÚC ỨNG DỤNG

**ThamDinhDuToanApp** là ứng dụng thẩm định dự toán chuyên sâu phục vụ **Tổ Thẩm định Dự toán – NMNĐ Vĩnh Tân 4**, thực hiện đối chiếu đa tầng 5 cơ sở giá thị trường và sinh báo cáo kết luận thẩm định chính xác, minh bạch.

### Cấu trúc công nghệ kép (Dual Architecture):
- **Backend API**: Python Flask (Port `5555`), các lõi kỹ thuật: `imis_core.py`, `quote_matcher.py`, `msc_matcher.py`, `ai_synthesis.py`, `pdf_report_generator.py`, `app.py`.
- **Frontend UI**: React 19 + Vite + TailwindCSS v4 + Lucide Icons (Port `5173`), thư mục `frontend/`.
- **Khởi động nhanh**: Nhấp đúp `run.bat` (tự động bật Flask 5555, Vite 5173 và mở trình duyệt `http://localhost:5173`).
- **Kịch bản tự động hóa (CLI & 1-Click Pipeline)**: 
  - `pipeline_runner.py`: Chạy thẩm định tự động từ Khối 1 đến Khối 6 bằng terminal.
  - Route `/api/items/<id>/run-5-pillars`: Chạy tự động liên hoàn 5 khối chứng cứ + AI Thuyết minh từ giao diện Web UI 1-Click.

---

## 2. QUY TRÌNH THẨM ĐỊNH 6 CƠ SỞ (6 PILLARS)

| Cơ sở | Tên gọi | Nguồn dữ liệu & Cơ chế | File chứng cứ lưu |
| :--- | :--- | :--- | :--- |
| **Cơ sở 1** | **Báo Giá Gốc (PDF)** | Quét các file PDF báo giá trong thư mục `Các Báo giá gửi Thẩm định/`, tự động bóc tách bằng `pdfplumber`, lọc đơn giá thấp nhất (`min_price`), kiểm tra chống nhầm họ hàng hóa (Product Families). | `chung_cu_quotes.json` |
| **Cơ sở 2** | **CSDL ERP Vĩnh Tân 4** | Tra cứu vào CSDL Kế toán nội bộ nhà máy (file `ERP.xlsx` & cache 14.5MB `.erp_cache.json`). Đánh giá hợp đồng trong/ngoài 12 tháng, biên độ giá lịch sử, hoặc tính giá trung bình (AVG). | `chung_cu_erp.json` |
| **Cơ sở 3** | **Hệ thống EVN IMIS** | Tra cứu Live API Hợp đồng toàn ngành EVN (2023-2026). **Tự động đăng nhập ngầm 24/7 qua OneDrive Cache**. | `chung_cu_imis.json` |
| **Cơ sở 4** | **Mua Sắm Công e-GP** | Tra cứu Cổng Mạng Đấu thầu Quốc gia qua session cURL. **Tự động hóa tìm kiếm e-GP**. | `chung_cu_muasamcong.json` |
| **Cơ sở 5** | **TMĐT & Giá Web** | Tra cứu các sàn TMĐT quốc tế/trong nước (eBay, Google Shopping, Misumi). **Lưu giữ link & giá niêm yết**. | `chung_cu_ecom.json` |
| **Cơ sở 6** | **Tổng Hợp & Chốt Mức Giá** | Thu thập 5 cơ sở, tính **Điểm Phủ Chứng Cứ (Coverage 0-100)** & **Điểm Hợp Lý Giá (Price Score 0-100)**; sinh **Bản Thuyết Minh Hoàn Chỉnh (1-Click AI Chuyên Gia)** với vai trò Tổ Thẩm định; đề xuất mức giá phê duyệt thống nhất; hỗ trợ **Xuất file PDF chuẩn 2 trang A4 & Excel**. | `chung_cu_synthesis.json` |

---

## 3. CÁC NÂNG CẤP QUAN TRỌNG ĐÃ HOÀN THÀNH

### A. Đợt Nâng Cấp Ngày 06/09/2026:
1. **Tích hợp Cột "🔑 Từ Khóa Tra Cứu (5 Cơ Sở)" & Nút "⚡ Tra 5 Cơ Sở" (1-Click Automation) trên Màn hình Ma trận (`GridMatrixView.jsx`)**:
   - Thêm ô hiển thị / nhập từ khóa tra cứu trực tiếp trên từng dòng vật tư trong Ma trận Dự toán.
   - Nút bấm **`⚡ Tra 5 Cơ Sở`** tại từng dòng tự động kích hoạt quét tuần tự 5 nguồn chứng cứ và gọi AI sinh thuyết minh tức thì.
   - Nút master **`⚡ Tra Cứu Tự Động Tất Cả (1-Click All)`** trên Toolbar hỗ trợ tự động hóa toàn bộ danh mục vật tư.
   - Backend API `@app.route("/api/items/<id>/run-5-pillars")` và `@app.route("/api/items/<id>/update-keyword")` xử lý nhanh chóng, lưu từ khóa trực tiếp vào file hồ sơ JSON.

2. **Chuẩn hóa Văn phong Nội bộ "Tổ Thẩm Định Dự Toán" (Appraisal Team Persona)**:
   - Cập nhật toàn bộ AI System Prompt & User Prompt (`ai_synthesis.py`), chữ ký phê duyệt (`pdf_report_generator.py`) và dữ liệu mẫu (`current_dossier.json`) theo đúng góc nhìn chuyên viên nội bộ thuộc Tổ Thẩm định Dự toán - NMNĐ Vĩnh Tân 4 (thay vì tư vấn độc lập bên ngoài).

3. **Xuất Báo Cáo Thẩm Định PDF Chuẩn 2 Trang A4 (`pdf_report_generator.py`)**:
   - Tự động bóc tách thông tin vật tư, bảng tổng hợp 5 cơ sở giá và bài thuyết minh đánh giá vào file PDF định dạng chuẩn 2 trang A4 nét đẹp, không trùng lặp dòng.

4. **Hệ thống Lưu Trữ & Đồng Bộ qua OneDrive EVN Cache (`ThamDinhDuToanAppCache`)**:
   - Toàn bộ thao tác người dùng (sửa đơn giá, sửa từ khóa, bài thuyết minh, chứng cứ 5 cơ sở của 98 mục vật tư) được lưu trữ tại `data/` và đồng bộ 24/7 sang `D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache`.
   - Giúp mọi PC (Office PC / Home PC) mở project đều khôi phục chính xác 100% dữ liệu credentials IMIS, CSDL ERP và tiến trình đã làm.

---

### B. Đợt Nâng Cấp Ngày 07/09/2026:
1. **Khắc phục lỗi ghép nối Báo Giá chéo họ hàng hóa (`quote_matcher.py`)**:
   - **Xử lý triệt để lỗi dính xâu con (Substring match)**: Khắc phục lỗi từ khóa ngắn như `"TEE"` (nhóm `FITTING`) bị bắt nhầm bên trong các từ tiếng Anh phổ biến như `"STEEL"` (`Cast steel`, `Stainless Steel`) hay `"GUARANTEE"`. Chuyển toàn bộ cơ chế kiểm tra nhóm từ khóa sang Regex ranh giới từ `\bWord\b`.
   - **Tách riêng nhóm chuyên biệt `CABLE_SENSOR`**: Dây tín hiệu quang, cáp quang, cảm biến phát hiện ngọn lửa được phân loại vào nhóm riêng, kích hoạt cơ chế chặn xung đột tuyệt đối (Hard Conflict Exclusion) với nhóm `VALVE` (Van).
   - **Đưa các từ ngữ kỹ thuật/vật liệu vào Stopwords**: `FLANGE`, `STEEL`, `CAST`, `TEMPERATURE`, `STAINLESS`, `PRESSURE`, `LIQUID`... bị chặn không cho cộng điểm tên vật tư giả tạo.
   - **Kiểm tra xung đột Part Number / Model (`strict_codes`)**: Nếu hai thiết bị đều có Part No / Model kỹ thuật riêng biệt mà không có mã nào giao nhau, tự động loại trừ ngay.
   - **Kết quả**: Đã thanh lọc chính xác 37 mục vật tư trong hồ sơ 98 mục; loại bỏ hoàn toàn báo giá rác (VD: Báo giá 135 triệu của An Hiếu không còn bị ghép nhầm vào Mục số 7 - Selector Valve KMX CO2 452 triệu).

2. **Cơ chế Bảo toàn CSDL & Luôn Lưu Vết 100% 5 Cơ Sở (`app.py`, `ItemInspectorView.jsx`)**:
   - **Sửa lỗi bỏ sót file khi 0 kết quả**: Trước đây trong `api_run_5_pillars`, lệnh lưu file `chung_cu_imis.json` và `chung_cu_erp.json` bị đặt trong điều kiện `if imis_recs:` hoặc `if recs:`. Khi vật tư đặc thù chưa có lịch sử mua sắm (0 kết quả), file không được lưu $\rightarrow$ Giao diện View 3 tưởng chưa tra cứu nên phát lệnh tra cứu lại gây treo/xoay vòng *"Đang tra cứu..."*.
   - **Hiện tại**: Toàn bộ 5 cơ sở đều **luôn luôn được ghi vào CSDL**, lưu rõ lý do *"Vật tư chưa tìm thấy dữ liệu mua sắm tương đương trong CSDL"* nếu không có kết quả.
   - **Fallback 2 tầng Backend**: `api_get_item_evidence` tự động tìm kiếm đối chiếu giữa thư mục dự án `projects/{tên_dự_án}_files/` và `current_dossier_files/`.
   - **Frontend kiểm tra CSDL trước (Data Guard)**: `loadErp`, `loadImis`, `loadMsc` kiểm tra CSDL `/api/evidence/get` trước khi phát lệnh tra cứu mạng. Nhấp vào tab cơ sở dữ liệu bung ra ngay tức thì (<10ms).

3. **Tối ưu Tốc độ "Tra 5 Cơ Sở" & AI Thuyết minh là Tùy chọn (Optional)**:
   - "Tra 5 cơ sở" ưu tiên tốc độ tối đa (1-2s / mục) để phục vụ duyệt nhanh danh mục.
   - Bước AI Thuyết minh chuyển thành tùy chọn (chỉ chạy khi thẩm định viên chủ động yêu cầu).
   - Bổ sung nút Hủy chọn / Chọn lại cho Mua Sắm Công trong View 3.
   - **Nút Hủy Chọn Căn Cứ IMIS (Cơ sở 3) & Bấm lại để Hủy Chọn trên từng dòng kết quả IMIS**:
      + Cơ chế Toggle deselect linh hoạt: Thẩm định viên nhấp lại vào dòng hợp đồng IMIS đang chọn (hoặc nút Phương án Đơn vị EVN cụ thể / Đơn giá trung bình) sẽ chuyển ngay sang trạng thái HỦY CHỌN (`is_deselected: true`, `selected_record: 'NONE'`).
      + Bổ sung nút bấm chuyên dụng **`✕ Hủy Chọn IMIS`** màu đỏ trên thanh Tùy chọn Phương án giúp thao tác 1-click rõ ràng.
      + Hiệu ứng hover trực quan: nút *"✓ Đã Chọn"* khi di chuột vào tự động hiển thị *"✕ Hủy Chọn"* màu đỏ nổi bật.
      + Bản thuyết minh tự động cập nhật sang trạng thái *(ĐÃ HỦY CHỌN)*: *"Đã tra cứu CSDL EVN IMIS theo từ khóa [...], các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán nên thẩm định viên không áp dụng làm căn cứ thẩm định."*
      + Trạng thái hủy chọn được tự động lưu ngầm vào `chung_cu_imis.json`, truyền đúng lên backend (`app.py`, `imis_core.py`) và đồng bộ OneDrive EVN Cache, ngăn việc tự động chọn đè record khi mở lại.
   - Thêm thông số thể hiện tiến độ đã lưu CSDL thẩm định (X / 98 mục) trên giao diện.
   - Thêm nút mở nhanh thư mục OneDrive Cache trên giao diện HeaderNav.

---

### C. Đợt Nâng Cấp Ngày 05/09/2026:
1. **Tự động Đăng nhập & Gia hạn ngầm EVN IMIS (Auto Re-Auth 24/7)**:
   - Credentials lưu ngoài Git tại `D:\OneDrive_Hieuna\...\ThamDinhDuToanAppCache\config\evn_imis_credentials.json`.
   - Tự động gia hạn Token ngầm mà không làm ngắt đoạn thao tác người dùng.

2. **Lõi Dịch vụ `ai_synthesis.py` & Multi-Model Free AI Fallback**:
   - Hỗ trợ cơ chế chuyển đổi mô hình dự phòng (Multi-model fallback: `minimax/minimax-m3:free`, `google/gemma-4-31b-it:free`, `liquid/lfm-2.5-2.6b:free`, `z-ai/glm-5.2:free`).

3. **Khắc phục lỗi Cache Từ khóa Tra cứu & Chuẩn hóa Tier Model**:
   - Tự động lưu vết kết quả tra cứu của 4 khối vào `chung_cu_*.json`. Ưu tiên từ khóa Tier Model (`IUX 760 MI`, `58100-953`).

---

## 4. HƯỚNG DẪN BÀN GIAO & CHẠY TIẾP TRÊN MÁY KHÁC (HOME / OFFICE PC)

Do tính bảo mật dữ liệu nội bộ EVN và dung lượng file CSDL lớn, cấu hình `.gitignore` đã loại trừ thư mục `data/projects/`, `config/`, `.env` và file `.erp_cache.json`. Để chuyển sang máy khác làm việc tiếp:

### Bước 1: Lấy mã nguồn mới nhất từ GitHub
```bash
git clone https://github.com/nguyenhieuanhspkt/ThamDinhDuToanApp.git
# Hoặc nếu đã có sẵn repo:
git pull origin master
```

### Bước 2: Cài đặt thư viện (nếu máy mới chưa có)
```bash
# Thư viện Python:
pip install flask-cors pdfplumber openpyxl requests reportlab

# Thư viện Frontend React:
cd frontend
npm install
cd ..
```

### Bước 3: Đồng bộ Dữ liệu & Cache từ OneDrive EVN (`D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache`)
Do OneDrive tự động đồng bộ liên tục trên mọi PC của bạn, toàn bộ dữ liệu bảo mật không đi qua Git đã có sẵn tại thư mục `D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache`:
- `ERP.xlsx` &rarr; Chép vào thư mục gốc dự án.
- `.erp_cache.json` &rarr; Chép vào thư mục gốc dự án và thư mục `config/.erp_cache.json`.
- `config/` &rarr; Chép vào thư mục `config/` của dự án (chứa `evn_imis_credentials.json`, session Mua Sắm Công & `ai_config.json`).
- `data/` &rarr; Chép đè vào thư mục `data/` của dự án (chứa toàn bộ `projects/`, hồ sơ đợt 8 lần 2, các chứng cứ 98 mục vật tư).

### Bước 4: Khởi động và làm tiếp
- **Chạy giao diện Web**: Nhấp đúp `run.bat` (Mở web `http://localhost:5173`).
- **Chạy tự động hóa 1-Click trên Web**: Truy cập giao diện Ma Trận Dự Toán (`GridMatrixView.jsx`), kiểm tra cột từ khóa tra cứu và bấm nút **`⚡ Tra 5 Cơ Sở`** hoặc **`⚡ Tra Cứu Tự Động Tất Cả`**.
- **Chạy tự động hóa bằng CLI Terminal**:
  ```bash
  python pipeline_runner.py 1
  python pipeline_runner.py 2
  ```

---

## 5. CẤU TRÚC THƯ MỤC CHUẨN HIỆN TẠI

```
ThamDinhDuToanApp/
├── app.py                         # Flask Backend API (Port 5555, Kèm 1-Click 5-Pillars Route)
├── imis_core.py                   # Module lõi tra cứu ERP & EVN IMIS (Kèm Auto Re-Auth 24/7)
├── ai_synthesis.py                # Core Business Service AI Synthesis & Persona Tổ Thẩm định
├── pdf_report_generator.py        # Module xuất file PDF Thẩm định chuẩn 2 trang A4
├── quote_matcher.py               # Module bóc tách & đối chiếu PDF báo giá
├── msc_matcher.py                 # Module tra cứu Mua Sắm Công e-GP
├── pipeline_runner.py             # Script tự động hóa thẩm định 6 Cơ sở CLI
├── run.bat                        # Script khởi động song song Flask + Vite React
├── .env                           # Credentials & API Keys local (Ngoài Git)
├── memory.md                      # Nhật ký kỹ thuật & hướng dẫn bàn giao
├── ERP.xlsx                       # CSDL Kế toán ERP Vĩnh Tân 4 (2.4MB - Ngoài Git)
├── .erp_cache.json                # Cache ERP đã parse (14.5MB - Ngoài Git)
├── config/                        # Cấu hình Token & Credentials ngoài Git
│   ├── evn_imis_credentials.json # Credentials IMIS EVN local
│   ├── evn_imis_token.json        # Token Bearer & Refresh Token IMIS
│   └── muasamcong_session.json   # Session cURL Mua Sắm Công
├── data/                          # Thư mục dữ liệu hồ sơ
│   ├── active_project.json        # Đang chỉ định dự án ThamDinhDot8_lân2
│   ├── current_dossier.json       # Hồ sơ hiện tại đang làm việc (98 mục)
│   ├── Bang_Tham_Dinh_Du_Toan.xlsx
│   ├── Mau_Du_Toan_Tham_Dinh.xlsx
│   └── projects/                  # Dữ liệu dự án (Ngoài Git)
│       ├── ThamDinhDot8_lân2.json # Hồ sơ dự án
│       └── ThamDinhDot8_lân2_files/
│           ├── item_1/            # Các file chứng cứ đã hoàn thành của STT 1
│           │   ├── chung_cu_quotes.json
│           │   ├── chung_cu_erp.json
│           │   ├── chung_cu_imis.json
│           │   ├── chung_cu_muasamcong.json
│           │   ├── chung_cu_ecom.json
│           │   └── chung_cu_synthesis.json
│           └── Các Báo giá gửi Thẩm định/ # Các file PDF báo giá gốc
└── frontend/                      # Source code React Vite UI (Port 5173)
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        └── components/
            ├── HeaderNav.jsx
            ├── grid/GridMatrixView.jsx          # Cột Từ khóa tra cứu + Nút 1-Click 5 Cơ Sở
            ├── inspector/                       # Module hóa 6 Khối Thẩm Định & Coordinator
            │   ├── ItemInspectorView.jsx        # Coordinator chính (372 dòng)
            │   ├── constants/pillars.js         # Cấu hình danh mục & metadata 6 cơ sở
            │   ├── utils/                       # Helpers (formatters.js, keywordHelpers.js)
            │   ├── common/                      # Common UI (PillarHeader, SaveFooter, LoadingSpinner, EmptyState)
            │   ├── coordinator/                 # Sub-components điều phối (Navbar, Sidebar, OverviewCard, Tabs)
            │   └── pillars/                     # 6 Module độc lập (Quotes, Erp, Imis, Msc, Ecom, Synthesis)
            └── modals/                         # ERP, IMIS, MSC Modals
```

---

## 6. LỊCH SỬ CẬP NHẬT KIẾN TRÚC MỚI NHẤT
- **Module Hóa God Component `ItemInspectorView.jsx` (Commit `11341f4`)**:
  - Tách thành công file 4.416 dòng thành 20 module chuyên trách theo từng cơ sở nghiệp vụ độc lập.
  - File coordinator rút gọn còn 372 dòng (giảm 91.5%).
  - Zero-Regression: Giữ nguyên 100% chức năng, giao diện, API contracts, tính năng deselect IMIS và tự động đồng bộ giá tổng hợp sang Cơ sở 6.
  - Bản build Vite đạt tốc độ ~335ms, 0 lỗi.

---

## 7. KẾ HOẠCH BƯỚC TIẾP THEO
- [x] Tự động hóa Tra cứu 5 Cơ Sở 1-Click trực tiếp từ Bảng Ma trận (`GridMatrixView.jsx`).
- [x] Chuẩn hóa văn phong Tổ Thẩm định Dự toán cho toàn bộ ứng dụng và xuất file PDF chuẩn 2 trang A4.
- [x] Module hóa kiến trúc `ItemInspectorView.jsx` thành 6 pillar riêng biệt.
- [ ] Chạy kiểm thử batch tự động cho toàn bộ 98 mục vật tư trong dự án `ThamDinhDot8_lân2`.
- [ ] Hoàn thiện xuất file Excel báo cáo tổng hợp 13 cột chuẩn EVN Vĩnh Tân 4 sau khi hoàn tất 98 mục.

