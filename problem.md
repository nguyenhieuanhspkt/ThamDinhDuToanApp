# BÁO CÁO VẤN ĐỀ VÀ TIÊU CHÍ NGHIỆM THU (PROBLEM & ACCEPTANCE CRITERIA)
## DỰ ÁN: THẨM ĐỊNH DỰ TOÁN (ThamDinhDuToanApp)

* **Mã vấn đề:** `BUG-SAVINGS-DISCREPANCY-01`
* **Ngày phát hiện:** 14/09/2026
* **Người rà soát:** Thẩm định viên & Kỹ sư hệ thống
* **Phạm vi ảnh hưởng:** View 2 (Bảng Ma Trận - GridMatrixView), View 3 (Soi chi tiết - ItemInspectorView / Bước 6 PillarSynthesis), CSDL `current_dossier.json` & các tệp `chung_cu_synthesis.json`.

---

## 1. MÔ TẢ VẤN ĐỀ (PROBLEM STATEMENT)

Khi người dùng mở ứng dụng và rà soát giá trị tiết kiệm dự toán:
1. Số tiền tiết kiệm hiển thị tại **Cột 13 ("Tiền Tiết Kiệm")** và thẻ KPI tổng quát trên **View GRID** không khớp với con số hiển thị tại **Bước 6 ("Tổng hợp - Synthesis") của View 3**.
2. Một số vật tư **chưa chốt thẩm định** (`don_gia_thong_nhat = 0`) nhưng trên View GRID lại hiển thị số tiền tiết kiệm bằng **100% thành tiền trình**, làm tổng tiền tiết kiệm của cả gói thầu bị thổi phồng hàng tỷ đồng.
3. Khi bấm vào xem chi tiết một mục ở View 3, giá trị tiết kiệm tự động nhảy sang một con số khác so với con số đang hiển thị ngoài bảng GRID.

---

## 2. PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ (ROOT CAUSE ANALYSIS)

Qua đối soát toàn bộ mã nguồn và CSDL 112 mục, xác định 4 nguyên nhân kỹ thuật cụ thể:

### 2.1. Lỗi công thức tính khi vật tư chưa thẩm định (`don_gia_thong_nhat = 0`)
* **Vị trí code:** `GridMatrixView.jsx` (dòng 1537, 1645)
  ```javascript
  const dgTN = parseFloat(it.don_gia_thong_nhat) || 0;
  const savingVal = (dgTrinh - dgTN) * sl; // Khi dgTN = 0 => savingVal = dgTrinh * sl!
  ```
* **Hệ quả:** Nếu mục chưa thẩm định, công thức tự lấy `dgTrinh - 0 = dgTrinh`, coi như giảm 100% giá trị dự toán.

### 2.2. Lỗi công thức thẻ KPI Tổng hợp trên View GRID
* **Vị trí code:** `GridMatrixView.jsx` (dòng 100-108, 947-949)
  ```javascript
  const total_trinh = sum(thanh_tien_trinh của 112 mục);
  const total_thong_nhat = sum(thanh_tien_thong_nhat của các mục có giá); // Mục chưa duyệt cộng 0!
  const giam_tru = total_trinh - total_thong_nhat;
  ```
* **Hệ quả:** Toàn bộ thành tiền trình của các mục chưa thẩm định bị cộng dồn vào `giam_tru`, khiến thẻ KPI "Giảm trừ / Tiết kiệm" hiển thị sai lệch rất lớn.

### 2.3. Lỗi dữ liệu lịch sử trong `current_dossier.json`
* Có **7 mục** (#72, #74, #78, #81, #83, #85, #112) bị lưu trường `gia_tri_giam = thanh_tien_trinh` trong khi `don_gia_thong_nhat = 0.0`.
* Ví dụ:
  - Mục #74: `don_gia_trinh = 21.120.000 đ`, `so_luong = 26`, `dg_thong_nhat = 0`, nhưng `gia_tri_giam = 549.120.000 đ`.
  - Mục #81: `don_gia_trinh = 738.496.000 đ`, `so_luong = 2`, `dg_thong_nhat = 0`, nhưng `gia_tri_giam = 1.476.992.000 đ`.
  - Mục #85: `don_gia_trinh = 264.600.000 đ`, `so_luong = 6`, `dg_thong_nhat = 0`, nhưng `gia_tri_giam = 1.587.600.000 đ`.
  - Mục #112: `don_gia_trinh = 140.000.000 đ`, `so_luong = 11`, `dg_thong_nhat = 0`, nhưng `gia_tri_giam = 1.540.000.000 đ`.

### 2.4. Lệch pha giữa Két sắt Hồ sơ (`current_dossier.json`) và Tệp Chứng cứ (`chung_cu_synthesis.json`)
* Có **17 mục** có sự khác biệt giữa hai tệp lưu trữ do thẩm định ở các thời điểm khác nhau hoặc import từ Excel mà chưa bấm Lưu lại ở Bước 6:
  - **Mục #6 (GEFA DG1 Ball Valve):** Dossier lưu duyệt theo Báo giá gốc (`8.910.000 đ`, giảm `52.340.000 đ`), nhưng tệp `chung_cu_synthesis.json` lưu giữ nguyên giá trình (`61.250.000 đ`, giảm `0 đ`).
  - **Mục #17 (Thanh cái đồng V):** Dossier lưu giữ nguyên giá trình (`48.000.000 đ`, giảm `0 đ`), nhưng tệp `chung_cu_synthesis.json` lưu theo mốc ERP (`1.390.909 đ`, giảm `186.436.364 đ`).
  - **Mục #27 (Bộ đo mức Level Transmitter):** Dossier lưu theo Web TMĐT (`75.764.141 đ`, giảm `113.235.859 đ`), nhưng tệp `chung_cu_synthesis.json` lưu theo ERP (`58.423.000 đ`, giảm `130.577.000 đ`).

### 2.5. `PillarSynthesis.jsx` tự động tìm mốc giá trên RAM khi chưa bấm Lưu
* Khi mở View 3, component tự động tính `minBaseline = Math.min(...validPrices)`. Nếu mục đó đã có giá chốt trong Dossier nhưng khác với `validPrices`, màn hình tự nhảy về mốc giá mới trên RAM khiến người dùng thấy khác với bảng GRID.

---

## 3. DANH SÁCH CHI TIẾT CÁC MỤC BỊ ẢNH HƯỞNG (SNAPSHOT TRƯỚC SỬA)

| STT Mục | Tên vật tư | View GRID (Dossier) | View 3 (Tệp Synthesis) | Bản chất lỗi |
| :---: | :--- | :--- | :--- | :--- |
| **#6** | GEFA DG1 Ball Valve | ĐG: 8.910.000 đ \| Giảm: 52.340.000 đ | ĐG: 61.250.000 đ \| Giảm: 0 đ | Lệch hồ sơ vs chứng cứ |
| **#17** | Thanh cái đồng V mạ bạc | ĐG: 48.000.000 đ \| Giảm: 0 đ | ĐG: 1.390.909 đ \| Giảm: 186.436.364 đ | Lệch hồ sơ vs chứng cứ |
| **#27** | Bộ đo mức Level Transmitter | ĐG: 75.764.141 đ \| Giảm: 113.235.859 đ | ĐG: 58.423.000 đ \| Giảm: 130.577.000 đ | Lệch hồ sơ vs chứng cứ |
| **#66** | Kẹp cố định đầu ray CH22 | ĐG: 578.078 đ \| Giảm: 3.351.844 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#67** | Ống nối cáp điện SL16 | ĐG: 12.000 đ \| Giảm: 0 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#68** | Cáp điện dẹt cầu trục | ĐG: 76.000 đ \| Giảm: 31.750.000 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#72** | Sơn dầu Jotun Green 437 | ĐG: 0 đ \| **Giảm ảo: 12.500.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#74** | Đế gắn module IO HBS01 | ĐG: 0 đ \| **Giảm ảo: 549.120.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#78** | Bạc đạn 6208 | ĐG: 0 đ \| **Giảm ảo: 1.776.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#81** | Armor ring Vành hướng gió | ĐG: 0 đ \| **Giảm ảo: 1.476.992.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#82** | Lining Plate | ĐG: 2.618.304.000 đ \| Giảm: 0 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#83** | Keo phủ Kalpoxy | ĐG: 0 đ \| **Giảm ảo: 326.400.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#84** | Nút van pos 04-01 | ĐG: 661.500.000 đ \| Giảm: 0 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#85** | Lò xo đĩa van pos 04-08 | ĐG: 0 đ \| **Giảm ảo: 1.587.600.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |
| **#98** | Động cơ và bơm NAOH | ĐG: 750.000.000 đ \| Giảm: 40.000.000 đ | ĐG: 0 đ \| Giảm: 0 đ | Chưa đồng bộ sang synthesis |
| **#110** | Vòng đệm tròn làm kín | ĐG: 8.200.000 đ \| Giảm: 0 đ | ĐG: 700 đ \| Giảm: 8.199.300 đ | Lệch hồ sơ vs chứng cứ |
| **#112** | Gàu múc CSU thể tích 0.52m3 | ĐG: 0 đ \| **Giảm ảo: 1.540.000.000 đ** | ĐG: 0 đ \| Giảm: 0 đ | **Chưa thẩm định - Lỗi giảm 100%** |

---

## 4. GIẢI PHÁP KỸ THUẬT (REMEDIATION PLAN)

1. **Sửa logic hiển thị & thống kê tại `GridMatrixView.jsx`**:
   - `dgTN = it.don_gia_thong_nhat || 0`.
   - `hasTN = dgTN > 0`.
   - `savingVal = hasTN && dgTrinh > dgTN ? (dgTrinh - dgTN) * sl : 0`.
   - Thẻ KPI `giam_tru`: Chỉ cộng dồn `savingVal` của các mục đã thẩm định (`hasTN`).
   - Cột 13: Nếu `!hasTN` $\rightarrow$ hiển thị `—` (Chưa TĐ); nếu `hasTN && savingVal === 0` $\rightarrow$ hiển thị `0 đ`; nếu `hasTN && savingVal > 0` $\rightarrow$ hiển thị `-{savingVal} đ`.
2. **Sửa logic khởi tạo tại `PillarSynthesis.jsx`**:
   - Ưu tiên đọc `item.don_gia_thong_nhat` làm mốc giá duyệt ban đầu nếu hồ sơ đã có giá chốt.
3. **Chạy script chuẩn hóa CSDL**:
   - Đặt `gia_tri_giam = 0` cho toàn bộ các mục chưa duyệt.
   - Đồng bộ giá trị giữa `current_dossier.json` và các tệp `chung_cu_synthesis.json` tương ứng.

---

## 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

Dự án được nghiệm thu khi thỏa mãn toàn bộ 4 tiêu chí bắt buộc dưới đây:

- [ ] **Tiêu chí 1 (Triệt tiêu tiết kiệm ảo):**
  Các mục chưa thẩm định (#72, #74, #78, #81, #83, #85, #112) tại Cột 13 của View GRID phải hiển thị dấu gạch ngang `—` (Chưa thẩm định) hoặc `0 đ`, hoàn toàn không được hiển thị số tiền tiết kiệm hàng trăm triệu/hàng tỷ đồng.
- [ ] **Tiêu chí 2 (Thẻ KPI chính xác 100%):**
  Thẻ KPI "Giảm trừ / Tiết kiệm" ở đầu màn hình Grid chỉ phản ánh đúng tổng tiền giảm thực tế của các mục đã thẩm định, không bị cộng dồn thành tiền trình của các mục chưa duyệt.
- [ ] **Tiêu chí 3 (Khớp số tuyệt đối giữa GRID và View 3):**
  Khi mở bất kỳ mục nào (đặc biệt là các mục #6, #17, #27, #110), giá duyệt và tiền tiết kiệm hiển thị ở Bước 6 (Synthesis) của View 3 phải khớp từng đồng với con số hiển thị tại Cột 12 & Cột 13 của View GRID.
- [ ] **Tiêu chí 4 (Toàn vẹn CSDL):**
  Chạy script kiểm tra đối soát tự động trên 112 mục: `Diff count = 0`. Toàn bộ hồ sơ `current_dossier.json` và thư mục `chung_cu_synthesis.json` đồng nhất hoàn toàn.

---

## 6. KỊCH BẢN NGHIỆM THU CHI TIẾT (ACCEPTANCE TEST SCENARIO)

Kịch bản nghiệm thu gồm **5 Ca kiểm thử (Test Cases)** thực tế trên giao diện và tự động:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   QUY TRÌNH NGHIỆM THU 5 BƯỚC                          │
├────────────────────────────────────────────────────────────────────────┤
│ TC 1: Kiểm thử Mục chưa duyệt (Triệt tiêu tiết kiệm ảo hàng tỷ đồng)   │
│ TC 2: Kiểm thử Khớp số GRID vs View 3 trên các mục có giảm giá thực tế │
│ TC 3: Kiểm thử Thẻ KPI Tổng quát ở đầu trang GRID                      │
│ TC 4: Kiểm thử Vòng đời Lưu & Đồng bộ thời gian thực (Atomic Save)     │
│ TC 5: Kiểm thử Toàn vẹn 112 mục bằng Script Đối soát Tự động           │
└────────────────────────────────────────────────────────────────────────┘
```

### TC 1: Kiểm thử Mục chưa thẩm định (Triệt tiêu tiết kiệm ảo)
* **Mục tiêu:** Đảm bảo các mục chưa có giá thống nhất không tự ý trừ tiền thành tiết kiệm 100%.
* **Danh sách mục kiểm tra:** Mục #72 (Sơn Jotun), Mục #74 (Đế module IO), Mục #81 (Armor ring), Mục #85 (Lò xo đĩa van), Mục #112 (Gàu múc CSU).
* **Các bước thực hiện:**
  1. Mở View 2 (GRID).
  2. Cuộn đến các dòng vật tư #72, #74, #81, #85, #112.
  3. Quan sát **Cột 12 (ĐG Duyệt)** và **Cột 13 (Tiền Tiết Kiệm)**.
* **Kết quả đạt (Pass Criteria):**
  - Cột 12 hiển thị: `Chưa TĐ` (màu xám).
  - Cột 13 hiển thị: `—` (gạch ngang) hoặc `0 đ`, % giảm là `0%` hoặc không hiển thị.
  - Tuyệt đối **KHÔNG** hiển thị giảm 549 triệu (Mục 74), giảm 1.47 tỷ (Mục 81), giảm 1.58 tỷ (Mục 85), giảm 1.54 tỷ (Mục 112).

---

### TC 2: Kiểm thử Khớp số tuyệt đối giữa GRID và View 3 trên các mục có giảm giá
* **Mục tiêu:** Đảm bảo khi mở bất kỳ mục nào đã thẩm định, số tiền hiển thị tại View 3 luôn khớp 100% với View GRID.
* **Danh sách mục kiểm tra trọng điểm:**
  - Mục #6 (GEFA DG1 Ball Valve)
  - Mục #17 (Thanh cái đồng V mạ bạc)
  - Mục #27 (Bộ đo mức Level Transmitter)
* **Các bước thực hiện:**
  1. Tại View GRID, ghi nhận con số ở **Cột 12 (ĐG Duyệt)** và **Cột 13 (Tiền Tiết Kiệm)** của Mục #6.
  2. Bấm vào dòng Mục #6 để chuyển sang View 3 (Soi chi tiết) $\rightarrow$ Chọn tab **Bước 6: Tổng hợp (Synthesis)**.
  3. Quan sát mục **"III. KẾT LUẬN & ĐỀ XUẤT PHÊ DUYỆT"**:
     - *Đơn giá phê duyệt đề xuất*
     - *Tổng tiết kiệm dự toán*
  4. Lặp lại với Mục #17 và Mục #27.
* **Kết quả đạt (Pass Criteria):**
  - **Mục #6:** View 3 và View GRID đều hiển thị ĐG duyệt `8.910.000 đ`, Tiết kiệm `52.340.000 đ` (khớp 100%).
  - **Mục #17:** View 3 và View GRID đều hiển thị cùng một con số thống nhất, không còn tình trạng GRID báo 0đ mà View 3 báo 186 triệu.
  - **Mục #27:** View 3 và View GRID hiển thị cùng một mốc giá và cùng một số tiền tiết kiệm.

---

### TC 3: Kiểm thử Thẻ KPI Tổng hợp ở đầu trang GRID
* **Mục tiêu:** Thẻ KPI phản ánh đúng thực tế, không bị lệch do các mục chưa duyệt.
* **Các bước thực hiện:**
  1. Đứng tại màn hình View GRID, quan sát 3 thẻ StatCard:
     - Thẻ 3: *Tổng giá trị trình duyệt* ($T_{\text{trinh}}$)
     - Thẻ 4: *Tổng giá trị thống nhất* ($T_{\text{thong\_nhat}}$)
     - Thẻ 5: *Giảm trừ / Tiết kiệm* ($G_{\text{tiet\_kiem}}$)
* **Kết quả đạt (Pass Criteria):**
  - Công thức kiểm tra:
    $$G_{\text{tiet\_kiem}} = \sum_{\text{mục đã duyệt}} (\text{dg\_trinh} - \text{dg\_thong\_nhat}) \times \text{so\_luong}$$
    $$T_{\text{thong\_nhat}} = T_{\text{trinh}} - G_{\text{tiet\_kiem}}$$
  - Thẻ "Giảm trừ / Tiết kiệm" giảm về đúng con số thực tế (khoảng vài trăm triệu đến hơn 1 tỷ đồng tùy số mục đã duyệt), không bị vọt lên trên 7 - 8 tỷ đồng do cộng dồn các mục chưa duyệt.

---

### TC 4: Kiểm thử Vòng đời Lưu & Đồng bộ thời gian thực (Atomic Save)
* **Mục tiêu:** Khi người dùng bấm Lưu tại View 3, dữ liệu được ghi đè đồng thời vào cả tệp chứng cứ lẫn bảng GRID.
* **Các bước thực hiện:**
  1. Chọn một mục vật tư đang ở trạng thái chưa duyệt (ví dụ Mục #72 hoặc Mục #78).
  2. Bấm sang View 3, vào Bước 6 (Synthesis).
  3. Chọn mức giá phê duyệt mong muốn (hoặc giữ giá trình).
  4. Bấm nút **`[Lưu & Phê Duyệt Giá Này]`**.
  5. Quay lại View GRID (hoặc bấm tab Ma trận).
* **Kết quả đạt (Pass Criteria):**
  - Dòng vật tư chuyển sang trạng thái Đã Lưu (có badge xanh).
  - Cột 12 & Cột 13 tại View GRID cập nhật ngay lập tức con số vừa lưu mà không cần F5 trình duyệt.
  - Mở lại file `current_dossier.json` và file `chung_cu_synthesis.json` của mục đó: cả hai tệp đều có cùng `approved_price` và `total_savings`.

---

### TC 5: Kiểm thử Toàn vẹn 112 mục bằng Script Đối soát Tự động
* **Mục tiêu:** Chứng minh toàn bộ 112 mục không còn bất kỳ một sự lệch pha nào giữa hồ sơ và chứng cứ.
* **Lệnh thực hiện trên Terminal:**
  ```powershell
  python scripts/audit_savings_consistency.py
  ```
* **Kết quả đạt (Pass Criteria):**
  - Script quét toàn bộ 112/112 mục.
  - Báo cáo đầu ra:
    ```
    ============================================================
    BÁO CÁO ĐỐI SOÁT TÍNH TOÀN VẸN CSDL 112 MỤC:
    - Tổng số mục kiểm tra: 112
    - Số mục có sai lệch giữa Dossier và Synthesis: 0 mục (ĐẠT)
    - Số mục chưa duyệt có giá trị giảm > 0: 0 mục (ĐẠT)
    - TỔNG KẾT: HỆ THỐNG ĐẠT 100% TIÊU CHÍ NGHIỆM THU
    ============================================================
    ```

