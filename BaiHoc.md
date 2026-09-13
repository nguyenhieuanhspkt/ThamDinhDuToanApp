# CẨM NANG KIẾN TRÚC & BÀI HỌC KINH NGHIỆM HỆ THỐNG
## DỰ ÁN: THẨM ĐỊNH DỰ TOÁN (ThamDinhDuToanApp)
*Tài liệu đúc kết tư duy kiến trúc phần mềm, quản trị dữ liệu và kinh nghiệm thực chiến từ chuyên gia nghiệp vụ & kỹ thuật.*

---

## MỤC LỤC

1. [CHƯƠNG 1: TRIẾT LÝ THIẾT KẾ CỐT LÕI (CORE PRINCIPLES)](#chương-1-triết-lý-thiết-kế-cốt-lõi-core-principles)
   - 1.1. Nghiệp vụ là Vua - Công nghệ là Người hầu cận
   - 1.2. Trật tự vàng: Database-First & API-Driven Development
   - 1.3. Nguyên lý Tự động hóa: "Chỉ tự động hóa những gì đã thuần thục thủ công"
2. [CHƯƠNG 2: KIẾN TRÚC CƠ SỞ DỮ LIỆU & QUẢN TRỊ DỮ LIỆU](#chương-2-kiến-trúc-cơ-sở-dữ-liệu--quản-trị-dữ-liệu)
   - 2.1. CSDL phẳng (Flat JSON) vs CSDL quan hệ (SQLite/Postgres): Bản chất & Đánh đổi
   - 2.2. Giải phẫu một Thực thể (Entity) Vật tư đã thẩm định hoàn chỉnh
   - 2.3. Mô hình 5 Bảng Thực thể chuẩn mực trong hệ thống
   - 2.4. Schema Validator: Bộ gác cổng chuẩn hóa biến, triệt tiêu lỗi `undefined`
   - 2.5. Nguyên tắc Bất khả xâm phạm: Phân tách tuyệt đối giữa Đọc (Read) và Ghi (Write)
   - 2.6. Quản lý phiên bản Schema (Schema Versioning): Nâng cấp dữ liệu không gây đổ vỡ
3. [CHƯƠNG 3: TẦNG TRUNG GIAN BACKEND & BẢN CHẤT CỦA API](#chương-3-tầng-trung-gian-backend--bản-chất-của-api)
   - 3.1. "Trong mắt Frontend, mọi dữ liệu đều là Phẳng" (Flat View Model / DTO)
   - 3.2. Giấu sự phức tạp ở đáy (Backend), giữ sự thanh thoát ở đỉnh (Frontend)
4. [CHƯƠNG 4: KIẾN TRÚC PHÂN CẤP FRONTEND (CHA - CON & ANH EM NGANG HÀNG)](#chương-4-kiến-trúc-phân-cấp-frontend-cha---con--anh-em-ngang-hàng)
   - 4.1. Tiêu chí phân định Cha - Con: "Ai nắm giữ State chia sẻ, người đó là Cha"
   - 4.2. Mô hình 4 Cấp bậc trong ứng dụng (App -> Coordinators -> Pillars -> Atoms)
   - 4.3. Dòng chảy dữ liệu: "Props chảy xuống - Sự kiện bay lên" (Props Down, Events Up)
   - 4.4. Quan hệ giữa các Component ngang hàng (Siblings): Mô hình Nhạc trưởng (The Mediator)
   - 4.5. Mô hình Map-Reduce trong thẩm định: 5 Cảm biến đi săn và 1 Hội đồng tổng hợp
5. [CHƯƠNG 5: GIẢI PHẪU HỌC 1 FILE JSX & TƯ DUY TÁCH FILE JS](#chương-5-giải-phẫu-học-1-file-jsx--tư-duy-tách-file-js)
   - 5.1. Tư duy 4 Tầng cấu trúc bên trong một file JSX chuẩn mực
   - 5.2. Sự phân công lao động giữa JSX (Họa sĩ giao diện) và JS (Bộ não tính toán)
   - 5.3. Tiêu chí vàng: Khi nào viết JSX, khi nào bắt buộc tách sang JS?
6. [CHƯƠNG 6: BÀI HỌC THỰC CHIẾN & TÂM LÝ HỌC LẬP TRÌNH](#chương-6-bài-học-thực-chiến--tâm-lý-học-lập-trình)
   - 6.1. Bắt mạch "Hội chứng sốt sắng lưu dữ liệu phòng thủ" (Defensive Eager-Saving)
   - 6.2. Phân định rạch ròi: "Auto-search để Xem" vs "Auto-save để Ghi"
   - 6.3. Tách biệt tuyệt đối: Bản nháp trên RAM (In-Memory Draft) vs Két sắt trên Đĩa (Persisted Data)
   - 6.4. Ba lời khuyên vàng cho Kiến trúc sư Hệ thống

---

## CHƯƠNG 1: TRIẾT LÝ THIẾT KẾ CỐT LÕI (CORE PRINCIPLES)

### 1.1. Nghiệp vụ là Vua - Công nghệ là Người hầu cận
Trong các dự án kỹ thuật chuyên sâu (như Thẩm định dự toán mua sắm thiết bị nhiệt điện / EVN), một con số sai lệch 1% hay một căn cứ trúng thầu áp sai mã hiệu không chỉ là lỗi hiển thị, mà là **rủi ro pháp lý trực tiếp trong công tác thanh tra, kiểm toán**.
- Công nghệ dù hiện đại đến đâu (AI, Thác đổ, Cloud) cũng chỉ đóng vai trò hỗ trợ giải phóng sức lao động.
- Mọi quyết định chốt giá, lựa chọn dòng chứng cứ bắt buộc phải tôn trọng **ý chí chuyên môn của Thẩm định viên**.

### 1.2. Trật tự vàng: Database-First & API-Driven Development
Mọi hệ thống phần mềm vững chắc đều được xây dựng theo thứ tự xuôi chiều:
**1. Thiết kế CSDL (Database/Entities)** -> **2. Xây dựng API (Backend chuẩn hóa JSON)** -> **3. Dựng Giao diện (Frontend nhận JSON vẽ màn hình)**.
- **Sai lầm phổ biến**: Vẽ màn hình trước (Frontend-First) rồi thiếu biến nào mới tìm cách nhét thêm biến đó vào CSDL. Cách làm này gọi là "xây nhà từ nóc", khiến hệ thống càng phát triển càng chắp vá và dễ phát sinh lỗi lệch pha.
- **Quy trình chuẩn mực**: Ngồi xuống định nghĩa thực thể trên giấy, xây móng CSDL vững chắc, viết API trả về dữ liệu chuẩn, rồi mới mở giao diện ra làm.

### 1.3. Nguyên lý Tự động hóa: "Chỉ tự động hóa những gì đã thuần thục thủ công"
Tự động hóa (Automation) bản chất là một cỗ máy sao chép tư duy con người với tốc độ cao.
- Nếu con người chưa định nghĩa rõ quy trình thủ công: Khi gặp 3 báo giá thì quy tắc chọn ra sao? Tra e-GP lệch tên thì bóc tách từ khóa thế nào? Khi nào lấy thuế 8%, khi nào 10%?... mà đã vội vàng viết code tự động, thì cỗ máy đó sẽ **nhân bản lỗi sai với tốc độ ánh sáng**.
- **Thứ tự thực hiện**: Thao tác tay nhuần nhuyễn trên 3-5 vật tư mẫu -> Đúc kết thành thuật toán -> Đóng gói thành cỗ máy tự động hóa chạy hàng loạt 112 mục.

---

## CHƯƠNG 2: KIẾN TRÚC CƠ SỞ DỮ LIỆU & QUẢN TRỊ DỮ LIỆU

### 2.1. CSDL phẳng (Flat JSON) vs CSDL quan hệ (SQLite/Postgres)
- **CSDL phẳng (Flat JSON từng thư mục)**:
  - *Ưu điểm*: Cực kỳ cơ động, triển khai nhanh, dễ sao lưu bằng OneDrive, mở file Notepad kiểm tra trực tiếp được ngay mà không cần cài đặt SQL Server.
  - *Đánh đổi*: Không có Database Engine bảo vệ (thiếu ACID, thiếu Foreign Keys, thiếu Schema Validation). Toàn bộ trách nhiệm bảo vệ tính toàn vẹn dữ liệu bị đẩy lên vai của lập trình viên.
- **CSDL quan hệ (Relational DB - SQLite/PostgreSQL)**:
  - Mọi dữ liệu tập trung trong 1 file `.db` duy nhất. Kiểm soát chặt chẽ kiểu dữ liệu, quan hệ khóa ngoại, truy vấn cực nhanh chỉ trong vài mili-giây.

### 2.2. Giải phẫu một Thực thể (Entity) Vật tư đã thẩm định hoàn chỉnh
Một Vật tư Thẩm định (`AppraisedItem`) hoàn chỉnh gồm 3 khối thuộc tính:
1. **Khối Đầu vào (Input)**:
   - `id`, `project_id`, `stt`, `ma_vt`, `ten_vt`, `dvt`, `so_luong`, `don_gia_trinh`, `thanh_tien_trinh`.
2. **Khối Căn cứ 5 Cơ sở (Evidence Pointers)**:
   - `p1_quotes`: Giá thấp nhất, danh sách báo giá, tên nhà thầu, trang PDF.
   - `p2_erp`: Giá mua gần nhất, số hợp đồng, ngày hóa đơn lịch sử NMNĐ Vĩnh Tân 4.
   - `p3_imis`: Giá hợp đồng các đơn vị phát điện toàn EVN.
   - `p4_msc`: Mã TBMT, đơn giá trúng thầu quy đổi trước thuế, giá gốc e-GP, bên mời thầu, `selected_index`, `selected_record`.
   - `p5_ecom`: Đơn giá thị trường niêm yết trên web.
3. **Khối Kết quả Thẩm định (Appraisal Outcome)**:
   - `don_gia_thong_nhat`: Mức giá phê duyệt cuối cùng.
   - `thanh_tien_thong_nhat`, `gia_tri_giam` (Tiết kiệm cho nhà máy).
   - `co_so_thong_nhat`: Căn cứ theo cơ sở nào (Quotes, ERP, hay MSC).
   - `danh_gia_ttd`: Bản thuyết minh đầy đủ căn cứ pháp lý & kinh tế kỹ thuật.
   - `status`: Trạng thái (Chờ duyệt / Đã chốt / Cảnh báo giá cao).

### 2.3. Mô hình 5 Bảng Thực thể chuẩn mực trong hệ thống
Khi chuẩn hóa vào CSDL quan hệ, hệ thống được cấu thành từ 5 bảng:
```
                      ┌─────────────────────────┐
                      │     1. PROJECTS         │ (Hồ sơ Dự án)
                      └────────────┬────────────┘
                                   │ 1
                                   │ N
                      ┌────────────▼────────────┐
                      │     2. DOSSIER_ITEMS    │ (112 Dòng vật tư - BẢNG MẸ)
                      └────────────┬────────────┘
        ┌──────────────────────────┼──────────────────────────┐
        │ 1                        │ 1                        │ 1
        │ N                        │ N                        │ N
┌───────▼─────────┐        ┌───────▼─────────┐        ┌───────▼─────────┐
│ 3. ITEM_QUOTES  │        │ 4. ITEM_ERP_HIST│        │ 5. ITEM_MSC_LOGS│
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### 2.4. Schema Validator: Bộ gác cổng chuẩn hóa biến
- **Vấn đề**: Khi hệ thống phát triển, các file cũ thiếu biến mới (`selected_index`, `page_number`), khiến Frontend đọc gặp `undefined` và sinh lỗi.
- **Giải pháp**: Xây dựng Schema Validator ở Backend (Python). Dữ liệu trước khi ghi xuống đĩa hoặc trước khi trả về cho Frontend bắt buộc phải đi qua khuôn mẫu chuẩn:
```python
def normalize_msc_schema(data):
    return {
        "item_id": data.get("item_id", 0),
        "selected_index": data.get("selected_index", 0), # Tự động bù 0 nếu thiếu!
        "page_number": data.get("page_number", 0),
        "selected_record": data.get("selected_record", None),
        "don_gia_tham_chieu": data.get("don_gia_tham_chieu", 0),
        "danh_sach_ket_qua": data.get("danh_sach_ket_qua", [])
    }
```

### 2.5. Nguyên tắc Bất khả xâm phạm: Phân tách tuyệt đối giữa Đọc (Read) và Ghi (Write)
Tuân thủ nguyên lý **CQS (Command-Query Separation)**:
- **Hành động XEM (Read/Query)**: Chỉ gửi request `GET`. Dù người dùng mở xem 1.000 lần, chuyển tab liên tục, F5... CSDL trên đĩa phải giữ nguyên vẹn 100%.
- **Hành động GHI (Write/Command)**: Chỉ gửi request `POST`. Phải xuất phát từ một **hành động có chủ đích rõ ràng của người dùng** (bấm nút Lưu, click chọn dòng). Tuyệt đối cấm component tự tiện gửi lệnh Ghi khi vừa mở màn hình!

### 2.6. Quản lý phiên bản Schema (Schema Versioning)
Khi phát sinh biến mới, không bao giờ tạo file `.db` mới. Coder quản lý bằng cách:
- Thêm trường `"schema_version": 2` vào file dữ liệu.
- Cơ chế **Lazy Migration (Nâng cấp lười)**: Khi người dùng mở đến mục nào, Backend nhìn thấy `schema_version == 1` sẽ tự động điền biến mới và nâng lên `v2` trong 1 mili-giây mà không cần người dùng can thiệp.

---

## CHƯƠNG 3: TẦNG TRUNG GIAN BACKEND & BẢN CHẤT CỦA API

### 3.1. "Trong mắt Frontend, mọi dữ liệu đều là Phẳng" (Flat View Model / DTO)
- Backend có thể quản lý 5 bảng, 10 mối quan hệ phức tạp, khóa ngoại ràng buộc.
- Nhưng khi gửi dữ liệu lên cho Frontend, **Backend có nghĩa vụ phải làm phẳng hóa (Flattening)** thành một Object JSON duy nhất (DTO - Data Transfer Object).
- Frontend không cần biết trong CSDL có mấy bảng. Frontend chỉ cần nhận một cục JSON phẳng để bốc từng trường đập thẳng vào thẻ HTML.

### 3.2. Giấu sự phức tạp ở đáy, giữ sự thanh thoát ở đỉnh
- **Đáy (Backend & Database)**: Gánh toàn bộ sự phức tạp về lưu trữ, nối bảng, tính toán thuế VAT 8%, kiểm tra phiên bản dữ liệu.
- **Đỉnh (Frontend & UI)**: Thanh thoát, nhẹ nhàng, chỉ tập trung vào hiển thị bảng biểu, màu sắc cảnh báo rủi ro và trải nghiệm thao tác của thẩm định viên.

---

## CHƯƠNG 4: KIẾN TRÚC PHÂN CẤP FRONTEND (CHA - CON & ANH EM NGANG HÀNG)

### 4.1. Tiêu chí phân định Cha - Con
> *"Nơi nào nắm giữ và chia sẻ State cho nhiều chỗ dùng -> Nơi đó là CHA. Nơi nào chỉ nhận dữ liệu để hiển thị -> Nơi đó là CON."*

### 4.2. Mô hình 4 Cấp bậc trong ứng dụng
```
[CẤP 1: TRÙM CUỐI]        App.jsx (Quản lý toàn dự án, activeView, selectedIndex)
                               │
[CẤP 2: ĐIỀU PHỐI VIÊN]    GridMatrixView.jsx (112 mục)   ItemInspectorView.jsx (1 mục)
                                                               │
[CẤP 3: TRỤ CỘT CHUYÊN MÔN]                          PillarQuotes, PillarMsc, PillarSynthesis...
                                                               │
[CẤP 4: NGUYÊN TỬ TÁI DÙNG]                          SaveFooter, CascadeBtn, PriceBadge...
```

### 4.3. Dòng chảy dữ liệu: "Props Down, Events Up"
- **Dữ liệu chảy xuống**: Cha đưa dữ liệu cho Con ăn qua `Props` (Con chỉ Đọc, cấm tự ý sửa biến của Cha).
- **Sự kiện bay lên**: Khi con làm xong việc, con "thưa gửi" lên cho Cha qua hàm callback (`onSave`, `onSelectRow`). Cha nhận tin mới tiến hành gửi API cập nhật hệ thống.

### 4.4. Quan hệ giữa các Component ngang hàng (Siblings): Mô hình Nhạc trưởng
Trong React, **hai Component ngang hàng TUYỆT ĐỐI KHÔNG ĐƯỢC NÓI CHUYỆN TRỰC TIẾP**.
- Bước 1 (`PillarQuotes`) và Bước 4 (`PillarMsc`) không thể gửi dữ liệu trực tiếp sang Bước 6 (`PillarSynthesis`).
- Tất cả phải đi qua **Cha chung (`ItemInspectorView`) làm Nhạc trưởng điều phối (The Mediator)**: 
  - Bước 1, 2, 3, 4, 5 làm xong -> Gửi kết quả lên cho Cha giữ trong State.
  - Cha gom đủ 5 kết quả -> Đóng gói truyền xuống cho Bước 6 qua Props.

### 4.5. Mô hình Map-Reduce trong thẩm định
- **Pha MAP (Phân tán)**: 5 Pillar đầu tiên là 5 công nhân độc lập đi săn lùng chứng cứ ở 5 nguồn dữ liệu khác nhau cùng lúc.
- **Pha REDUCE (Quy tụ)**: Bước 6 (`PillarSynthesis`) nhận toàn bộ dữ liệu của 5 công nhân đem về, so sánh đối chiếu và rút gọn lại thành 1 quyết định thẩm định duy nhất!

---

## CHƯƠNG 5: GIẢI PHẪU HỌC 1 FILE JSX & TƯ DUY TÁCH FILE JS

### 5.1. Tư duy 4 Tầng cấu trúc trong 1 file JSX chuẩn mực
Bất kỳ file JSX nào cũng phải được sắp xếp ngăn nắp theo đúng 4 tầng:
1. **Tầng 1: Đầu vào (Props)**: Nhận tài nguyên từ Cha (`item`, `data`, `saved`, `onSave`).
2. **Tầng 2: Trí nhớ nội bộ (State / Refs)**: Nhớ các bản nháp tạm thời (`searchKey`, `selectedRecord`, `pageNumber`).
3. **Tầng 3: Bộ não xử lý (Lifecycle & Event Handlers)**:
   - `useEffect`: CHỈ dùng để đồng bộ hiển thị, tuyệt đối cấm gọi lệnh Ghi ở đây.
   - `handleUserAction`: Xử lý khi tay người dùng bấm nút (`onClick`, `onSelect`).
4. **Tầng 4: Thị giác (Render Return)**: Khối HTML/Tailwind vẽ giao diện ra màn hình.

### 5.2. Sự phân công lao động giữa JSX và JS
- **File `.jsx` (Họa sĩ)**: Chứa HTML, CSS, Tailwind. Chuyên lo làm đẹp và bắt sự kiện bấm chuột.
- **File `.js` (Nhà Toán học)**: Chứa thuật toán xử lý thuần túy, **hoàn toàn không có thẻ HTML**. Nhận Input -> Trả ra Output.

### 5.3. Tiêu chí vàng: Khi nào viết JSX, khi nào tách sang JS?
- **Tách sang file `.js` ngay lập tức khi**:
  - Là hàm định dạng hiển thị: `formatMoney(amount)` biến số thành `"2.624.722 đ"`.
  - Là thuật toán bóc tách chuỗi/Regex phức tạp: `extractMultiScenarioKeywords(item)`.
  - Là công thức tính toán nghiệp vụ: Công thức quy đổi VAT 8% (`rawPrice / 1.08`), công thức % chênh lệch giá, quy tắc cảnh báo rủi ro.
  - Được sử dụng lại ở từ 2 màn hình trở lên.

---

## CHƯƠNG 6: BÀI HỌC THỰC CHIẾN & TÂM LÝ HỌC LẬP TRÌNH

### 6.1. Bắt mạch "Hội chứng sốt sắng lưu dữ liệu phòng thủ" (Defensive Eager-Saving)
- **Nguồn gốc tâm lý**: Người viết code vì quá sợ mất dữ liệu của người dùng (sợ tắt trình duyệt, sợ rớt mạng) nên cứ chạy xong bước nào là vội vã ghi đè ngay bước đó xuống ổ đĩa.
- **Nghịch lý trớ trêu**: Chính vì quá sợ mất dữ liệu tạm thời, code lại tự tay xóa sổ luôn dữ liệu thẩm định chính thức mà thẩm định viên đã cẩn thận chọn lọc trước đó.

### 6.2. Phân định rạch ròi: "Auto-search để Xem" vs "Auto-save để Ghi"
- **Auto-search để Xem (Rất tốt)**: Máy tự lấy từ khóa tra cứu mạng để đổ danh sách gói thầu ra màn hình cho thẩm định viên nhìn sẵn. Nhưng toàn bộ dữ liệu này **nằm trên RAM, chưa ghi gì vào đĩa**.
- **Auto-save để Ghi (Nguy hiểm)**: Tự ý chọn dòng đầu tiên rồi gửi POST ghi đè vào file đĩa mà không hỏi người dùng. Hành vi này phải bị loại bỏ hoàn toàn trong các màn hình thẩm định chuyên sâu.

### 6.3. Tách biệt tuyệt đối: Bản nháp trên RAM vs Két sắt trên Đĩa
- **RAM (In-Memory Draft)**: Là nơi để thử nghiệm. Người dùng có thể thử đổi từ khóa, lọc theo hãng, click thử dòng 1, dòng 2... Nếu không thích, tắt đi thì file gốc vẫn nguyên vẹn.
- **Đĩa (Persisted Storage)**: Là két sắt lưu trữ hồ sơ pháp lý. Cửa két sắt chỉ mở ra khi thẩm định viên chủ động bấm nút **`[Lưu khối hiện tại]`**.

### 6.4. Ba lời khuyên vàng cho Kiến trúc sư Hệ thống
1. **Thiết kế trên giấy trước khi gõ code (Design on Paper First)**: Dành 30 phút vẽ Entities, vẽ dòng chảy dữ liệu và các trạng thái màn hình lên giấy A4 trước khi mở máy tính. Tốc độ làm sẽ nhanh gấp 5 lần và triệt tiêu lỗi logic.
2. **Tôn trọng độ trễ mạng bất đồng bộ (Respect Asynchronous Reality)**: Mạng và ổ đĩa luôn chậm hơn CPU hàng trăm lần. Luôn chuẩn bị sẵn kịch bản Loading (spinner chờ), kịch bản lỗi (try/catch), và khóa nút bấm khi đang tải để ngăn ngừa Race Condition.
3. **Tâm thế người làm Chủ Sản Phẩm (Product Owner Mindset)**: Bạn là chuyên gia nghiệp vụ - đó là vũ khí tối thượng. Đừng để công nghệ làm lu mờ nghiệp vụ. Mọi dòng code sinh ra chỉ nhằm phục vụ sự an toàn, chính xác và minh bạch của hồ sơ thẩm định giá!

---
*Tài liệu được khởi tạo và lưu trữ vĩnh viễn trong kho mã nguồn dự án ThamDinhDuToanApp.*
