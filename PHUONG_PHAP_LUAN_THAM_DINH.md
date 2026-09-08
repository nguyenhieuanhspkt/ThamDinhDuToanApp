# PHƯƠNG PHÁP LUẬN & TÔN CHỈ THIẾT KẾ THẨM ĐỊNH DỰ TOÁN
## HỆ THỐNG PHẦN MỀM THẨM ĐỊNH DỰ TOÁN TỰ ĐỘNG HÓA (ThamDinhDuToanApp)
**Đơn vị áp dụng:** Tổ Thẩm định Dự toán - Công ty Nhiệt điện Vĩnh Tân (NMNĐ Vĩnh Tân 4)  
**Tài liệu gốc lưu trữ lâu dài:** *Kim chỉ nam định hướng kỹ thuật và nghiệp vụ*

---

## I. MỤC ĐÍCH TỒN TẠI & TÔN CHỈ CỐT LÕI (CORE MISSION)

> **"Tước bỏ quyền làm mờ thông tin — Bảo vệ tối đa nguồn vốn ngân sách của EVN và Nhà nước thông qua đối soát chứng cứ đa tầng minh bạch, độc lập và có tính truy vết pháp lý tuyệt đối."**

Ứng dụng ThamDinhDuToanApp không được sinh ra chỉ để làm một công cụ tính toán đơn thuần hay một bảng tính Excel thay thế. Mục tiêu sống còn của phần mềm là:
1. **Phá vỡ thế độc quyền thông tin** giữa Đơn vị lập dự toán (người trình) và Tổ Thẩm định (người duyệt).
2. **Cung cấp công cụ phản biện đanh thép** dựa trên số liệu thực tế đã được nghiệm thu (CSDL ERP Vĩnh Tân 4, EVN IMIS, Mua Sắm Công Quốc gia e-GP, TMĐT quốc tế) thay vì phụ thuộc một chiều vào các tập báo giá thương mại do nhà thầu cung cấp.
3. **Chuẩn hóa hồ sơ pháp lý:** Tự động hóa việc sinh các bản thuyết minh căn cứ đạt chuẩn quy định đấu thầu, sẵn sàng giải trình trước Thanh tra và Kiểm toán Nhà nước.

---

## II. GỌI TÊN CÁC VẤN ĐỀ NGHIỆP VỤ CỐT LÕI (THE CORE PROBLEMS)

Khi rà soát các hồ sơ dự toán sửa chữa thường xuyên (SCTX), phần mềm được thiết kế để nhận diện và giải quyết 3 căn bệnh kinh điển trong công tác lập giá:

### 1. "Thiên kiến lựa chọn chứng cứ có lợi" (Cherry-Picking Evidence)
- **Hiện tượng:** Người lập dự toán tiếp cận nhiều nguồn thông tin, nhưng có xu hướng chỉ trích dẫn nguồn có đơn giá cao nhất (thường là báo giá thương mại mới nhận) để đưa vào dự toán trình, nhằm tạo biên an toàn rộng rãi cho gói thầu, dễ chào thầu và dễ giải ngân.
- **Hậu quả:** Làm đội giá trị dự toán gói thầu lên gấp 1.5 đến 3 lần so với giá trị thực tế của vật tư, gây lãng phí chi phí sản xuất kinh doanh của nhà máy.

### 2. "Bỏ qua mốc cơ sở chi phí nội bộ" (Bypassing Internal Cost Baseline)
- **Hiện tượng:** Bỏ qua lịch sử mua sắm trong CSDL Kế toán ERP của chính NMNĐ Vĩnh Tân 4 (ERP.xlsx), mặc dù cùng chủng loại vật tư đó đã từng được nhập kho nhà máy trong vòng 1–3 năm trước với giá thấp hơn rất nhiều.
- **Bản chất pháp lý:** Dữ liệu ERP là **tiền thật, hợp đồng thật, tài sản thật đã qua thanh quyết toán của nhà máy**. Việc lờ đi ERP để lấy báo giá bên ngoài là hành vi quay lưng lại với nguồn tài sản dữ liệu hợp pháp và tin cậy nhất của đơn vị.

### 3. "Hợp thức hóa giá dự toán bằng Báo giá hình thức" (Quotation Rubber-Stamping)
- **Hiện tượng:** Thu thập 3 báo giá từ các công ty thương mại để đủ thủ tục hành chính, nhưng các báo giá này chưa qua thương thảo thực chất, chứa đựng nhiều chi phí trung gian và dự phòng rủi ro của nhà thầu.
- **Hậu quả:** Biến báo giá chào hàng một chiều của doanh nghiệp thành căn cứ định đoạt ngân sách nhà nước mà không qua đối soát cạnh tranh.

---

## III. PHƯƠNG PHÁP LUẬN 4 BƯỚC PHẢN BIỆN BẤT HỢP LÝ (THE 4-STEP METHODOLOGY)

Khi thẩm định viên chỉ được cung cấp **Báo giá** và **CSDL ERP**, phương pháp luận chuẩn mực để chỉ ra sự bất hợp lý bao gồm 4 bước:

`
[Bước 1: Ánh xạ 1:1 theo Mã ERP] 
       │
       ▼
[Bước 2: Phân tích Biên độ Chênh lệch (Delta %)] 
       │
       ▼
[Bước 3: Đối soát Ma trận 3 Ngưỡng Cảnh báo Rủi ro] 
       │
       ▼
[Bước 4: Đảo ngược Nghĩa vụ Chứng minh trong Thuyết minh]
`

### Bước 1: Ánh xạ 1:1 theo Mã ERP (Exact ERP Code Matching)
- Bất kỳ vật tư nào đã được cấp Mã ERP (ma_vt), hệ thống tự động coi **CSDL Kế toán ERP Vĩnh Tân 4 là mốc giá trần tham chiếu số 1**.
- Tự động bóc tách: Số hợp đồng mua gần nhất, ngày ký, ngày nhập kho, số lượng, đơn vị tính và đơn giá nhập kho thực tế.

### Bước 2: Phân tích Biên độ Chênh lệch Giá ($\Delta\%$)
Tính toán chỉ số biến động giá giữa Đơn giá trình và Đơn giá lịch sử ERP:
\Delta\% = \frac{\text{Đơn giá trình (Báo giá)} - \text{Đơn giá ERP gần nhất}}{\text{Đơn giá ERP gần nhất}} \times 100\%

### Bước 3: Đối soát Ma trận 3 Ngưỡng Rủi ro (3-Tier Risk Matrix)
1. **Ngưỡng 1 ($\Delta\% \le 10\% - 15\%$): HỢP LÝ.** Biến động nằm trong phạm vi chỉ số giá tiêu dùng (CPI) và trượt giá thông thường qua 1–2 năm. Chấp thuận giá trình.
2. **Ngưỡng 2 (\% < \Delta\% \le 30\%$): CÓ YẾU TỐ NGUY CƠ.** Bắt buộc đàm phán, hiệu chỉnh đưa đơn giá về mốc ERP cộng thêm trượt giá thực tế.
3. **Ngưỡng 3 ($\Delta\% > 30\%$ đến \%+$): BẤT HỢP LÝ RÕ RỆT.** Dấu hiệu kê khống dự toán hoặc chọn sai đối tượng báo giá. Yêu cầu bác bỏ giá trình, lấy giá ERP làm căn cứ thống nhất.

### Bước 4: Đảo ngược Nghĩa vụ Chứng minh (Burden of Proof Reversal)
- **Quy tắc pháp lý của Tổ Thẩm định:**
  > *"Lịch sử ERP Vĩnh Tân 4 là chứng cứ gốc đã được thanh quyết toán hợp lệ. Nếu Đơn vị trình muốn áp dụng đơn giá theo Báo giá cao hơn ERP, **Đơn vị trình có nghĩa vụ phải giải trình bằng văn bản**: Vì sao hàng hóa cùng quy cách kỹ thuật lại tăng giá đột biến? Hãng sản xuất có thay đổi xuất xứ không? Chi phí nguyên vật liệu cấu thành có biến động toàn cầu không? Nếu không chứng minh được, Tổ Thẩm định mặc định áp dụng mốc giá ERP."*

---

## IV. KIẾN TRÚC 5 CƠ SỞ CHỨNG CỨ ĐA TẦNG (5-PILLAR ARCHITECTURE)

Hệ thống cung cấp sức mạnh đối soát toàn diện qua 5 tầng chứng cứ độc lập:

1. **Cơ sở 1 - Báo Giá Gốc (PDF):** Trích xuất tự động từ thư mục scan báo giá, tìm ra nhà thầu chào giá thấp nhất và bóc tách độ lệch giữa các nhà thầu.
2. **Cơ sở 2 - CSDL Kế toán ERP Vĩnh Tân 4 (ERP.xlsx):** Lịch sử nhập kho nội bộ với hơn 33.000 hợp đồng lưu trữ từ năm 2018 đến nay.
3. **Cơ sở 3 - CSDL EVN IMIS Toàn Ngành:** Hợp đồng mua sắm tập trung của toàn bộ các đơn vị phát điện, truyền tải thuộc Tập đoàn Điện lực Việt Nam (2023–2026).
4. **Cơ sở 4 - Mạng Đấu thầu Quốc gia (e-GP - muasamcong.mpi.gov.vn):** Kết quả trúng thầu công khai toàn quốc của các gói thầu có tính chất tương tự.
5. **Cơ sở 5 - Thương mại điện tử & Website Hãng (E-Commerce):** Tham chiếu mốc giá công khai quốc tế (Misumi, eBay, Web đại lý ủy quyền) kèm đường link và ảnh chụp chứng thực.
6. **Cơ sở 6 - Tổng Hợp, Phản Biện AI SME & Phê Duyệt Giá:** Nơi hội tụ các mốc giá, tự động gợi ý đơn giá thấp nhất hợp lệ, tính toán % tiết giảm ngân sách và sinh Báo cáo thẩm định.

---

## V. CÁC NGUYÊN TẮC THIẾT KẾ BẤT BIẾN (NON-NEGOTIABLE PRINCIPLES)

Khi tiếp tục nâng cấp, tối ưu hóa hoặc tái cấu trúc mã nguồn, lập trình viên **BẮT BUỘC PHẢI TUÂN THỦ** 5 nguyên tắc kỹ thuật sau:

### Nguyên tắc 1: Con người là trung tâm quyết định (Human-in-the-Loop)
- AI và thuật toán chỉ đóng vai trò **Thư ký mẫn cán**: Thu thập số liệu, tính toán phần trăm, phát hiện bất thường và đề xuất câu chữ.
- **Quyền quyết định thuộc về Thẩm định viên**: Người dùng có toàn quyền Chọn, Bỏ chọn (Hủy chọn), Hiệu chỉnh từ khóa và Gõ lại đơn giá theo phán đoán kỹ thuật thực tế.

### Nguyên tắc 2: "Hủy chọn" có dấu vết pháp lý (Soft-Deselection Auditability)
- Trong thẩm định giá, **"Không áp dụng được kết quả tra cứu này" cũng là một chứng cứ pháp lý bắt buộc phải lưu trữ**.
- Tuyệt đối không xóa trắng file dữ liệu khi người dùng bấm Hủy chọn. Phải ghi nhận cờ is_deselected: true, selected_record: "NONE" và lưu lại nguyên văn lý do loại trừ vào CSDL JSON để đưa vào Báo cáo.

### Nguyên tắc 3: Nguồn Chân Lý Duy Nhất & Đồng bộ State tuyệt đối (Single Source of Truth)
- Bất kỳ thao tác nào của người dùng trên UI (chọn hợp đồng, hủy chọn, sửa giá) phải được đồng bộ **ngay lập tức** vào 2 nơi:
  1. File JSON trên ổ cứng server (POST /api/items/<id>/evidence/<step>).
  2. Biến State trong RAM của Component cha (updateLocalEvidenceState).
- Tuyệt đối không để xảy ra hiện tượng "lưu xuống đĩa nhưng RAM giữ dữ liệu cũ", dẫn đến việc chuyển tab rồi quay lại bị nhảy về trạng thái ban đầu.

### Nguyên tắc 4: Lưu trữ dạng tệp JSON mở (Plain JSON Document Persistence)
- Giữ vững triết lý lưu trữ hồ sơ theo từng thư mục item_<id>/chung_cu_<pillar>.json.
- Định dạng JSON mở, có timestamp 	hoi_gian_luu, con người đọc được trực tiếp bằng Notepad, không dùng database nhị phân đóng kín, đảm bảo tính trường tồn dữ liệu và đồng bộ tự nhiên với OneDrive EVN.

### Nguyên tắc 5: Lá chắn bảo vệ toàn diện (Zero Blank Screens)
- Toàn bộ các View chính và từng Pillar riêng biệt phải được bọc trong các lớp ErrorBoundary.
- Một lỗi dữ liệu hoặc sự cố mạng bất ngờ ở một khối con chỉ được phép hiển thị khung cảnh báo của riêng khối đó, **tuyệt đối không bao giờ được làm sập hay trắng toàn bộ màn hình ứng dụng**.

---

## VI. DẤU HIỆU NHẬN BIẾT KHI ỨNG DỤNG BỊ "LỆCH HƯỚNG" (DRIFT RED FLAGS)

Nếu trong quá trình phát triển tương lai xuất hiện một trong các dấu hiệu sau, cần mở lại tài liệu này để chấn chỉnh:

- 🚩 **Dấu hiệu 1:** Ứng dụng tự ý chốt giá hoặc tự ý ghi đè quyết định của thẩm định viên mà không có sự phê duyệt rõ ràng.
- 🚩 **Dấu hiệu 2:** Giao diện trở nên quá rườm rà, thêm nhiều thao tác thừa làm chậm tốc độ tra cứu vốn phải tính bằng giây.
- 🚩 **Dấu hiệu 3:** Lập trình viên thay đổi cơ chế lưu trữ sang các hệ quản trị database phức tạp đòi hỏi cài đặt máy chủ nền, làm mất đi tính cơ động và khả năng đồng bộ OneDrive của người dùng.
- 🚩 **Dấu hiệu 4:** Bỏ quên hoặc giảm nhẹ vai trò của CSDL Kế toán nội bộ ERP Vĩnh Tân 4.
- 🚩 **Dấu hiệu 5:** Dữ liệu người dùng thao tác bấm chọn/hủy chọn bị mất hoặc không ăn khớp giữa màn hình chi tiết và bảng tổng hợp Ma trận dự toán.

---
*Tài liệu này được lập và lưu trữ vĩnh viễn trong kho mã nguồn của dự án tại tệp PHUONG_PHAP_LUAN_THAM_DINH.md.*
