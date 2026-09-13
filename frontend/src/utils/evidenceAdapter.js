/**
 * evidenceAdapter.js
 * Adapter chuẩn hóa dữ liệu 5 Cơ sở Chứng cứ & Tổng hợp Thẩm định.
 * Đảm bảo mọi luồng dữ liệu thô từ Backend (camelCase / snake_case, results / danh_sach_ket_qua,
 * don_gia_tham_chieu / min_price) đều được chuyển đổi thành cấu trúc chuẩn đồng nhất.
 */

const fmt = (val) =>
  !val && val !== 0 ? "0 đ" : `${Math.round(val).toLocaleString("vi-VN")} đ`;

/**
 * 1. BÁO GIÁ GỐC (PDF)
 */
export function normalizeQuotesEvidence(raw, item = {}) {
  if (!raw) {
    return {
      price: 0,
      itemName: "",
      specs: "",
      supplier: "",
      score: 0,
      detail: "Chưa có dữ liệu Báo giá gốc",
      isDeselected: false,
    };
  }

  const match = raw.matches?.[0] || raw.min_quote || raw.matched_supplier || {};
  const price = parseFloat(
    raw.min_price ||
    raw.don_gia_tham_chieu ||
    match.don_gia ||
    match.price ||
    0
  );

  const supplier = match.company || raw.supplier || "";
  const itemName = match.quoted_name || raw.quoted_name || "";
  const specs = match.quoted_tskt || match.match_reason || "";
  const score = match.score
    ? Math.min(100, Math.round(match.score > 100 ? match.score / 15 : match.score))
    : price > 0 ? 100 : 0;

  const detail =
    raw.summary_text ||
    (price > 0
      ? `Báo giá chào thấp nhất: ${fmt(price)} (${supplier})`
      : "Chưa có báo giá gốc hợp lệ");

  return {
    price,
    itemName,
    specs,
    supplier,
    score,
    detail,
    isDeselected: Boolean(raw.is_deselected),
    raw,
  };
}

/**
 * 2. CSDL ERP VĨNH TÂN 4
 */
export function normalizeErpEvidence(raw, item = {}) {
  if (!raw) {
    return {
      price: 0,
      itemName: "",
      specs: "",
      supplier: "",
      contractInfo: "",
      score: 0,
      detail: "Chưa có dữ liệu ERP nội bộ",
      isDeselected: false,
      results: [],
    };
  }

  const results = Array.isArray(raw.results) ? raw.results : [];
  const isDeselected =
    Boolean(raw.is_deselected) ||
    raw.summary?.is_deselected ||
    raw.summary?.status === "ERP_DESELECTED" ||
    (raw.summary_text && raw.summary_text.toLowerCase().includes("không áp dụng"));

  // Ưu tiên bản ghi đã chọn (selected_record)
  const r0 = (raw.selected_record && typeof raw.selected_record === "object")
    ? raw.selected_record
    : (results[0] || {});

  const price = isDeselected
    ? 0
    : parseFloat(
        r0.donGia ||
        r0.don_gia ||
        raw.min_price ||
        raw.don_gia_tham_chieu ||
        0
      );

  const itemName = r0.tenVt || r0.ten_vt || r0.tenVatTu || "";
  const specs = r0.thongSoKt || r0.thong_so_kt || r0.dienGiai || "";
  const supplier = r0.nhaThau || r0.nha_thau || r0.tenDonVi || "";
  const soHd = r0.soHopDong || r0.so_hd || r0.soPhieuNhap || "";
  const ngayKy = r0.ngayKy || r0.ngay_ky || r0.ngayChungTu || r0.ngayNhapKho || "";
  const contractInfo = soHd ? `HĐ: ${soHd}${ngayKy ? ` (Ngày: ${ngayKy.slice(0, 10)})` : ""}` : "";
  const score = r0.match_score ? Math.round(r0.match_score) : 0;

  const detail = isDeselected
    ? (raw.summary_text || "Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá.")
    : (raw.summary_text || raw.summary?.summary_text || (price > 0 ? `Lịch sử ERP: ${fmt(price)}${soHd ? ` (${soHd})` : ""}` : "Đã rà soát CSDL ERP"));

  return {
    price,
    itemName,
    specs,
    supplier,
    contractInfo,
    score,
    detail,
    isDeselected: Boolean(isDeselected),
    results,
    activeRecord: r0,
    raw,
  };
}

/**
 * 3. EVN IMIS TOÀN NGÀNH
 */
export function normalizeImisEvidence(raw, item = {}) {
  if (!raw) {
    return {
      price: 0,
      itemName: "",
      supplier: "",
      contractInfo: "",
      detail: "Chưa có dữ liệu EVN IMIS",
      isDeselected: false,
      results: [],
    };
  }

  const results = Array.isArray(raw.imis) ? raw.imis : Array.isArray(raw.results) ? raw.results : [];
  const isDeselected = Boolean(raw.is_deselected) || raw.summary?.is_deselected;

  const i0 = (raw.selected_record && typeof raw.selected_record === "object")
    ? raw.selected_record
    : (results[0] || {});

  const price = isDeselected
    ? 0
    : parseFloat(i0.don_gia || i0.donGia || raw.min_price || raw.don_gia_tham_chieu || 0);

  const itemName = i0.tenVt || i0.ten_vt || "";
  const supplier = i0.tenDonVi || i0.don_vi || "";
  const soHd = i0.soHopDong || i0.so_hd || "";
  const ngayKy = i0.ngayKy || i0.ngay_ky || "";
  const contractInfo = soHd ? `HĐ: ${soHd}${ngayKy ? ` (${ngayKy.slice(0, 10)})` : ""}` : "";

  const detail = isDeselected
    ? (raw.summary_text || "Đã loại trừ CSDL EVN IMIS")
    : (raw.summary_text || raw.summary?.summary_text || (price > 0 ? `IMIS EVN: ${fmt(price)} (${supplier})` : "Đã rà soát CSDL IMIS"));

  return {
    price,
    itemName,
    supplier,
    contractInfo,
    detail,
    isDeselected: Boolean(isDeselected),
    results,
    activeRecord: i0,
    raw,
  };
}

/**
 * 4. MUA SẮM CÔNG e-GP (ATOMIC RECORD BINDING)
 */
export function normalizeMscEvidence(raw, item = {}) {
  if (!raw) {
    return {
      price: 0,
      itemName: "",
      specs: "",
      supplier: "",
      detail: "Chưa có dữ liệu Mua Sắm Công e-GP",
      isDeselected: false,
      results: [],
    };
  }

  // Hỗ trợ cả 2 tên mảng: danh_sach_ket_qua hoặc results hoặc items
  const results = Array.isArray(raw.danh_sach_ket_qua)
    ? raw.danh_sach_ket_qua
    : Array.isArray(raw.results)
      ? raw.results
      : Array.isArray(raw.items)
        ? raw.items
        : [];

  const isDeselected =
    Boolean(raw.is_deselected) ||
    raw.selected_record === "NONE" ||
    raw.summary?.status === "MSC_DESELECTED" ||
    raw.summary?.is_deselected;

  // XÁC ĐỊNH DUY NHẤT 1 BẢN GHI ĐƯỢC CHỌN (ATOMIC RECORD BINDING):
  // Đảm bảo đơn giá, tên vật tư và nhà thầu LUÔN ĐI CÙNG NHAU từ cùng 1 bản ghi
  let activeRecord = null;
  if (raw.selected_record && typeof raw.selected_record === "object") {
    activeRecord = raw.selected_record;
  } else if (raw.don_gia_tham_chieu !== undefined && raw.don_gia_tham_chieu !== null && raw.don_gia_tham_chieu > 0) {
    const targetPrice = parseFloat(raw.don_gia_tham_chieu);
    activeRecord =
      results.find((r) => parseFloat(r.don_gia || r.gia_trung_thau || r.donGia || 0) === targetPrice) ||
      results[0] ||
      null;
  } else if (raw.min_price !== undefined && raw.min_price !== null && raw.min_price > 0) {
    const targetPrice = parseFloat(raw.min_price);
    activeRecord =
      results.find((r) => parseFloat(r.don_gia || r.gia_trung_thau || r.donGia || 0) === targetPrice) ||
      results[0] ||
      null;
  } else {
    activeRecord = results[0] || null;
  }

  const rec = activeRecord || {};

  const price = isDeselected
    ? 0
    : parseFloat(
        rec.don_gia ||
        rec.gia_trung_thau ||
        rec.donGia ||
        raw.don_gia_tham_chieu ||
        raw.min_price ||
        0
      );

  const itemName = rec.danh_muc || rec.ten_goi_thau || rec.ten_vt || "";
  const supplier = rec.nha_thau_trung || rec.ben_moi_thau || rec.nhaThau || "";
  const specs = rec.thong_so_kt || rec.thongSoKt || "";
  const contractInfo = rec.ma_tbmt ? `TBMT: ${rec.ma_tbmt}` : "";

  const detail = isDeselected
    ? (raw.summary_text || "Đã loại trừ CSDL Mua Sắm Công")
    : (raw.summary_text || raw.summary?.summary_text || (price > 0 ? `Mua sắm công: ${fmt(price)} (${supplier || "e-GP"})` : "Đã tra cứu Cổng Mua Sắm Công"));

  return {
    price,
    itemName,
    specs,
    supplier,
    contractInfo,
    detail,
    isDeselected: Boolean(isDeselected),
    results,
    activeRecord: rec,
    raw,
  };
}

/**
 * 5. TMĐT & THAM KHẢO WEB
 */
export function normalizeEcomEvidence(raw, item = {}) {
  if (!raw) {
    return {
      price: 0,
      itemName: "",
      specs: "",
      supplier: "",
      url: "",
      hasLanded: false,
      detail: "Chưa có dữ liệu TMĐT",
      isDeselected: false,
      results: [],
    };
  }

  const results = Array.isArray(raw.results)
    ? raw.results
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.records)
        ? raw.records
        : [];
  const e0 = results[0] || raw.selected_record || {};

  const isDeselected = Boolean(raw.is_deselected);
  const price = isDeselected
    ? 0
    : parseFloat(
        e0.landed_price ||
        e0.gia_vnd ||
        e0.price_vnd ||
        e0.price ||
        raw.min_price ||
        raw.don_gia_tham_chieu ||
        0
      );

  const itemName = e0.title || e0.name || "";
  const supplier = e0.vendor || "Nhà cung cấp Web";
  const url = e0.url || "";
  const specs = e0.notes || (e0.price_usd ? `Quy đổi từ $${e0.price_usd} USD` : "");
  const hasLanded = Boolean(e0.has_landed_cost || raw.has_landed_cost);

  const detail = isDeselected
    ? (raw.summary_text || "Đã loại trừ TMĐT")
    : (raw.summary_text || (price > 0 ? `TMĐT: ${fmt(price)}` : "Đã khảo sát thị trường web"));

  return {
    price,
    itemName,
    specs,
    supplier,
    url,
    hasLanded,
    detail,
    isDeselected: Boolean(isDeselected),
    results,
    raw,
  };
}

/**
 * 6. DỰNG BỘ 6 BƯỚC ĐẦY ĐỦ THÔNG TIN DÙNG CHO CẢ MODAL VÀ VIEWS
 */
export function buildCompletedAuditSteps(evidence = {}, item = {}) {
  const ev = evidence || {};

  const q = normalizeQuotesEvidence(ev.quotes, item);
  const erp = normalizeErpEvidence(ev.erp, item);
  const imis = normalizeImisEvidence(ev.imis, item);
  const msc = normalizeMscEvidence(ev.muasamcong, item);
  const ecom = normalizeEcomEvidence(ev.ecom, item);

  const synth = ev.synthesis || {};
  const synthDetail =
    synth.summary_text ||
    item.danh_gia_ttd ||
    "Đã tổng hợp chốt giá";
  const synthPrice = item.don_gia_thong_nhat || item.don_gia_trinh || 0;

  return [
    {
      id: 1,
      key: "quotes",
      name: "1. Báo Giá Gốc (PDF)",
      item_name: q.itemName,
      specs: q.specs,
      supplier: q.supplier,
      score: q.score,
      detail: q.detail,
      price: q.price,
      _orig_price: q.price,
      _orig_detail: q.detail,
      is_deselected: q.isDeselected,
    },
    {
      id: 2,
      key: "erp",
      name: "2. ERP Vĩnh Tân 4",
      item_name: erp.itemName,
      specs: erp.specs,
      supplier: erp.supplier,
      contract_info: erp.contractInfo,
      score: erp.score,
      detail: erp.detail,
      price: erp.price,
      _orig_price: erp.price,
      _orig_detail: erp.detail,
      is_deselected: erp.isDeselected,
    },
    {
      id: 3,
      key: "imis",
      name: "3. EVN IMIS Toàn Ngành",
      item_name: imis.itemName,
      supplier: imis.supplier,
      contract_info: imis.contractInfo,
      detail: imis.detail,
      price: imis.price,
      _orig_price: imis.price,
      _orig_detail: imis.detail,
      is_deselected: imis.isDeselected || imis.price === 0,
    },
    {
      id: 4,
      key: "muasamcong",
      name: "4. Mua Sắm Công e-GP",
      item_name: msc.itemName,
      supplier: msc.supplier,
      specs: msc.specs,
      detail: msc.detail,
      price: msc.price,
      _orig_price: msc.price,
      _orig_detail: msc.detail,
      is_deselected: msc.isDeselected || msc.price === 0,
    },
    {
      id: 5,
      key: "ecom",
      name: "5. TMĐT & Tham Khảo Web",
      item_name: ecom.itemName,
      supplier: ecom.supplier,
      specs: ecom.specs,
      url: ecom.url,
      has_landed: ecom.hasLanded,
      detail: ecom.detail,
      price: ecom.price,
      _orig_price: ecom.price,
      _orig_detail: ecom.detail,
      is_deselected: ecom.isDeselected || ecom.price === 0,
    },
    {
      id: 6,
      key: "synthesis",
      name: "6. AI Thuyết Minh & Chốt Giá",
      detail: synthDetail,
      price: synthPrice,
      _orig_price: synthPrice,
      _orig_detail: synthDetail,
      is_deselected: false,
    },
  ];
}
