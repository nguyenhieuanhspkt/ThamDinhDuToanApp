# 🧠 MEMORY.MD — ThamDinhDuToanApp
> **Cập nhật ngày:** 2026-09-05 20:10 | **Tác giả:** Nguyễn Anh Hiếu (hieuna)  
> **Repository GitHub:** `https://github.com/nguyenhieuanhspkt/ThamDinhDuToanApp.git`  
> **Thư mục dự án khuyến nghị:** `D:\TaskApp_kiet\thamdinhdutoanApp`  
> **Thư mục Backup Cache/Dữ liệu ngoài Git (OneDrive EVN):** `D:\OneDrive_Hieuna\OneDrive - EVN\Hiếu\ThamDinhDuToanAppCache`

---

## 1. TỔNG QUAN & KIẾN TRÚC ỨNG DỤNG

**ThamDinhDuToanApp** là ứng dụng thẩm định dự toán chuyên sâu phục vụ **Tổ Thẩm định Dự toán – NMNĐ Vĩnh Tân 4**, thực hiện đối chiếu đa tầng 5 cơ sở giá thị trường và sinh báo cáo kết luận thẩm định chính xác, minh bạch.

### Cấu trúc công nghệ kép (Dual Architecture):
- **Backend API**: Python Flask (Port `5555`), các lõi kỹ thuật: `imis_core.py`, `quote_matcher.py`, `msc_matcher.py`, `ai_synthesis.py`, `app.py`.
- **Frontend UI**: React 19 + Vite + TailwindCSS v4 + Lucide Icons (Port `5173`), thư mục `frontend/`.
- **Khởi động nhanh**: Nhấp đúp `run.bat` (tự động bật Flask 5555, Vite 5173 và mở trình duyệt `http://localhost:5173`).
- **Kịch bản tự động hóa (CLI Pipeline)**: `pipeline_runner.py` (chạy thẩm định tự động từ Khối 1 đến Khối 6 bằng terminal mà không cần bấm tay trên web).

---

## 2. QUY TRÌNH THẨM ĐỊNH 6 CƠ SỞ (6 PILLARS)

| Cơ sở | Tên gọi | Nguồn dữ liệu & Cơ chế | File chứng cứ lưu |
| :--- | :--- | :--- | :--- |
| **Cơ sở 1** | **Báo Giá Gốc (PDF)** | Quét các file PDF báo giá trong thư mục `Các Báo giá gửi Thẩm định/`, tự động bóc tách bằng `pdfplumber`, lọc đơn giá thấp nhất (`min_price`), kiểm tra chống nhầm họ hàng hóa (Product Families). | `chung_cu_quotes.json` |
| **Cơ sở 2** | **CSDL ERP Vĩnh Tân 4** | Tra cứu vào CSDL Kế toán nội bộ nhà máy (file `ERP.xlsx` & cache 14.5MB `.erp_cache.json`). Đánh giá hợp đồng trong/ngoài 12 tháng, biên độ giá lịch sử, hoặc tính giá trung bình (AVG). | `chung_cu_erp.json` |
| **Cơ sở 3** | **Hệ thống EVN IMIS** | Tra cứu Live API Hợp đồng toàn ngành EVN (2023-2026). **Tự động đăng nhập ngầm 24/7 qua OneDrive Cache**. | `chung_cu_imis.json` |
| **Cơ sở 4** | **Mua Sắm Công e-GP** | Tra cứu Cổng Mạng Đấu thầu Quốc gia qua session cURL. **Tự động hóa tìm kiếm e-GP**. | `chung_cu_muasamcong.json` |
| **Cơ sở 5** | **TMĐT & Giá Web** | Tra cứu các sàn TMĐT quốc tế/trong nước (eBay, Google Shopping, Misumi). **Lưu giữ link & giá niêm yết**. | `chung_cu_ecom.json` |
| **Cơ sở 6** | **Tổng Hợp & Chốt Mức Giá** | Thu thập 5 cơ sở, tính **Điểm Phủ Chứng Cứ (Coverage 0-100)** & **Điểm Hợp Lý Giá (Price Score 0-100)**; sinh **Bản Thuyết Minh Hoàn Chỉnh (1-Click AI Chuyên Gia)**; đề xuất mức giá phê duyệt thống nhất; hỗ trợ **Xuất file Word (.docx) & In PDF**. | `chung_cu_synthesis.json` |

---

## 3. CÁC NÂNG CẤP QUAN TRỌNG ĐÃ HOÀN THÀNH (05/09/2026)

1. **Tự động Đăng nhập & Gia hạn ngầm EVN IMIS (Auto Re-Auth 24/7)**:
   - Thông tin đăng nhập EVN IMIS (`vinhtan4tpp\hieuna`) được nạp và lưu trữ an toàn ngoài Git tại **OneDrive EVN Cache (`D:\OneDrive_Hieuna\...\ThamDinhDuToanAppCache\config\evn_imis_credentials.json`)**, local `config/evn_imis_credentials.json` và file `.env`.
   - Trước mỗi lần tra cứu giá IMIS (`query_imis_api`), hệ thống tự kích hoạt `auto_reauth_imis_if_needed()`. Khi Token hết hạn, app tự động đọc credentials từ OneDrive Cache và đăng nhập ngầm thành công mà không ngắt đoạn người dùng.
   - Đã qua thử nghiệm thực tế thành công 100% (cả trường hợp token hết hạn và đổi PC mới xóa sạch token file).

2. **Kiến trúc Lõi Dịch vụ `ai_synthesis.py` & 1-Click AI Chuyên Gia (Khối 6)**:
   - Đóng gói toàn bộ logic Thuyết minh AI Chuyên gia Độc lập, Trợ lý Cảnh báo Rủi ro & Thương thảo Giá (>10% warning threshold & tính toán số tiền tiết kiệm dự toán) vào module lõi `ai_synthesis.py`.
   - Tuân thủ **100% Free AI Policy** với cơ chế tự động chuyển đổi mô hình dự phòng (Multi-model fallback: `minimax/minimax-m3:free`, `google/gemma-4-31b-it:free`, `liquid/lfm-2.5-2.6b:free`, `z-ai/glm-5.2:free`).
   - Tích hợp nút bấm nổi bật **`🤖 Chạy AI Chuyên Gia (1-Click)`** trực tiếp trên Web UI (`ItemInspectorView.jsx`).

3. **Khắc phục lỗi Cache Từ khóa Tra cứu (Auto-Save Search Results Cache)**:
   - Khắc phục lỗi cô lập kết quả tìm kiếm ở component React con. Bây giờ mỗi khi người dùng thay đổi từ khóa, chọn gợi ý chip từ khóa hay chọn hợp đồng tham chiếu ở cả 4 Khối (**ERP, IMIS, Mua Sắm Công, TMĐT**), kết quả tìm kiếm mới cùng từ khóa custom sẽ **tự động lưu ngầm ngay lập tức vào tệp `chung_cu_*.json`**.
   - Tự động nạp lại chính xác từ khóa và bài thuyết minh khi làm mới trang hoặc chuyển mục vật tư.

4. **Chuẩn hóa Từ khóa Tier Model (Mã Model / Thiết bị)**:
   - Thay vì dùng tên dài kèm thông số lằng nhằng khiến việc tìm kiếm ở IMIS, MSC, TMĐT bị 0 kết quả hoặc sai lệch, hệ thống đã trích xuất bộ từ khóa 4 cấp độ và **mặc định ưu tiên chọn Tier Model** (ví dụ: `IUX 760 MI`) cho toàn bộ các khối phía sau IMIS (Khối 3, Khối 4, Khối 5).

5. **Kết quả Thẩm định mẫu STT 1**:
   - Vật tư: `Module đầu vào input IUX 760 MI` (Mã ERP: `3.82.63.134.ENG.00.000`).
   - Đơn giá trình: **13.559.000 đ** | Đơn giá thống nhất duyệt: **13.559.000 đ**.
   - Căn cứ: Báo giá thấp nhất DTL (Khối 1: 13.559.000 đ) và nằm trong khung dao động ERP lịch sử Nhà máy (Khối 2: HĐ 115/2023 giá 6.015.000 đ đến HĐ 132/2023 giá 17.670.000 đ, thấp hơn -23.3% so với HĐ 132/2023).
   - Điểm số: 100/100 điểm Hạng A (5/5 cơ sở đã nạp).

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
pip install flask-cors pdfplumber openpyxl requests

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
- `data/` &rarr; Chép đè vào thư mục `data/` của dự án (chứa toàn bộ `projects/`, hồ sơ đợt 8 lần 2, các chứng cứ `item_1`).

### Bước 4: Khởi động và làm tiếp
- **Chạy giao diện Web**: Nhấp đúp `run.bat`.
- **Chạy tự động hóa từng mục**:
  ```bash
  # Chạy thẩm định cho STT 1:
  python pipeline_runner.py 1
  # Chạy thẩm định cho STT 2:
  python pipeline_runner.py 2
  ```

---

## 5. CẤU TRÚC THƯ MỤC CHUẨN HIỆN TẠI

```
ThamDinhDuToanApp/
├── app.py                         # Flask Backend API (Port 5555)
├── imis_core.py                   # Module lõi tra cứu ERP & EVN IMIS (Kèm Auto Re-Auth)
├── ai_synthesis.py                # Core Business Service AI Synthesis & Risk Assistant
├── quote_matcher.py               # Module bóc tách & đối chiếu PDF báo giá
├── msc_matcher.py                 # Module tra cứu Mua Sắm Công e-GP
├── pipeline_runner.py             # Script tự động hóa thẩm định 6 Cơ sở
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
            ├── grid/GridMatrixView.jsx
            ├── inspector/ItemInspectorView.jsx  # Toàn bộ logic giao diện 6 Khối + Auto-Save Cache
            └── modals/                         # ERP, IMIS, MSC Modals
```

---

## 6. KẾ HOẠCH BƯỚC TIẾP THEO (NGÀY MAI)
- [ ] Chạy kiểm thử tự động `pipeline_runner.py` cho các mục tiếp theo (STT 2, STT 3, STT 4...).
- [ ] Xây dựng tính năng Batch Run (chạy 1 lần thẩm định tự động toàn bộ 98 mục vật tư trong hồ sơ Đợt 8 lần 2).
- [ ] Hoàn thiện tính năng xuất biểu mẫu Excel báo cáo tổng hợp sau khi toàn bộ 98 mục hoàn tất.
