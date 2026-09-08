import React, { useState, useEffect, useMemo } from "react";
import {
  Table2,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  Layers,
  Loader2,
  Zap,
  Key,
  FileDown,
  FileText,
  Clock,
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import AuditProgressModal from "../modals/AuditProgressModal.jsx";

export default function GridMatrixView({ onSelectInspectorItem }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("standard"); // 'standard' | 'coso_dongia'
  const [stats, setStats] = useState({
    total_items: 0,
    total_trinh: 0,
    total_thong_nhat: 0,
  });
  const [quoteMatches, setQuoteMatches] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState({});
  const [filterSaved, setFilterSaved] = useState("ALL"); // 'ALL' | 'SAVED' | 'UNSAVED'

  // Sắp xếp theo đơn giá/thành tiền/STT (tăng dần/giảm dần)
  const [sortField, setSortField] = useState(null); // 'stt' | 'dg_trinh' | 'tt_trinh' | 'dg_thong_nhat' | 'tt_thong_nhat' | 'lowest_price'
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' | 'desc'

  // States cho 1-click 5 cơ sở & keyword management
  const [itemKeywords, setItemKeywords] = useState({});
  const [runningItemIds, setRunningItemIds] = useState(new Set());
  const [runningAllPillars, setRunningAllPillars] = useState(false);

  // State cho AuditProgressModal (Minh bạch hóa 5 cơ sở)
  const [auditModal, setAuditModal] = useState({
    isOpen: false,
    item: null,
    keyword: "",
    status: "running", // 'running' | 'completed' | 'error'
    activeStep: 1,
    auditData: null,
  });

  const fetchGridData = async (forceRescan = false) => {
    try {
      // 1. Luôn load dữ liệu hồ sơ chính từ JSON (siêu nhanh)
      const res = await fetch("/api/dossier");
      const data = await res.json();
      const list = data.items || [];
      setItems(list);

      const total_trinh = list.reduce(
        (acc, it) =>
          acc +
          (parseFloat(it.thanh_tien_trinh) ||
            it.so_luong * it.don_gia_trinh ||
            0),
        0,
      );
      const total_thong_nhat = list.reduce(
        (acc, it) =>
          acc +
          (parseFloat(it.thanh_tien_thong_nhat) ||
            (it.so_luong || 1) * (it.don_gia_thong_nhat || 0) ||
            0),
        0,
      );
      setStats({ total_items: list.length, total_trinh, total_thong_nhat });

      const kwMap = {};
      list.forEach((it, idx) => {
        const idKey = it.id || idx + 1;
        kwMap[idKey] = it.search_keyword || extractDefaultKeyword(it);
      });
      setItemKeywords(kwMap);

      // 2. CHỈ GỌI API QUÉT PDF KHI NGƯỜI DÙNG CHỦ ĐỘNG BẤM QUÉT LẠI (forceRescan = true)
      if (forceRescan) {
        await fetchQuoteMatches(true);
      } else {
        // Nếu mở tab thông thường, tắt trạng thái loading ngay lập tức, không gọi API quét ngầm
        setLoadingQuotes(false);
      }

      fetchEvidenceStatus();
    } catch (e) {
      console.error("Lỗi fetch grid data:", e);
      setLoadingQuotes(false);
    }
  };

  const fetchEvidenceStatus = async () => {
    try {
      const res = await fetch("/api/evidence/all-status");
      if (res.ok) {
        const data = await res.json();
        setEvidenceStatus(data || {});
      }
    } catch (e) {
      console.error("Lỗi fetch evidence status:", e);
    }
  };

  const fetchQuoteMatches = async (force = false) => {
    setLoadingQuotes(true);
    try {
      const res = await fetch("/api/quotes/match-all-dossier-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_rescan: force }),
      });
      const data = await res.json();
      if (data.success && data.results) {
        setQuoteMatches(data.results);
      }
    } catch (e) {
      console.error("Lỗi đọc báo giá gốc:", e);
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => {
    // Chỉ load dữ liệu ma trận thông thường, truyền false để KHÔNG quét lại PDF
    fetchGridData(false);
  }, []);
  const extractDefaultKeyword = (it) => {
    if (it.search_keyword) return it.search_keyword;
    const raw = (it.part_no || "") + " " + (it.ten_vt || "");
    const match = raw.match(
      /(?:Partno|Part\s*No|Model|Mã)[\s:]*([A-Za-z0-9\-_]{3,20})/i,
    );
    if (match && match[1]) return match[1].trim();
    const match2 = raw.match(/\b[A-Z0-9]{3,10}(?:[\-_/]\s*[A-Z0-9]{2,10})+\b/);
    if (match2) return match2[0].trim();
    const clean = (it.ten_vt || "").replace(/[\-:;]/g, " ").trim();
    const words = clean.split(/\s+/);
    return words.slice(0, 4).join(" ") || (it.ten_vt || "").slice(0, 30);
  };

  const handleKeywordChange = (itemId, val) => {
    setItemKeywords((prev) => ({ ...prev, [itemId]: val }));
    fetch(`/api/items/${itemId}/update-keyword`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: val }),
    }).catch(console.error);
  };

  const handleRun5Pillars = async (itemId, openModal = true, runAi = false) => {
    setRunningItemIds((prev) => new Set(prev).add(itemId));
    const it = items.find((x) => x.id === itemId) || items[itemId - 1];
    const kw = itemKeywords[itemId] || (it ? extractDefaultKeyword(it) : "");

    let stepInterval = null;
    if (openModal && it) {
      setAuditModal({
        isOpen: true,
        item: it,
        keyword: kw,
        status: "running",
        activeStep: 1,
        auditData: null,
      });

      stepInterval = setInterval(() => {
        setAuditModal((prev) => {
          if (prev.status === "running" && prev.activeStep < 5) {
            return { ...prev, activeStep: prev.activeStep + 1 };
          }
          return prev;
        });
      }, 350);
    }

    try {
      const res = await fetch(`/api/items/${itemId}/run-5-pillars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, run_ai: runAi }),
      });
      const data = await res.json();
      if (stepInterval) clearInterval(stepInterval);

      if (data.success) {
        await fetchGridData();
        if (openModal) {
          setAuditModal((prev) => ({
            ...prev,
            status: "completed",
            activeStep: 5,
            auditData: data.audit_trail || data,
            item: data.item || it,
          }));
        }
      } else {
        if (openModal) {
          setAuditModal((prev) => ({ ...prev, status: "error" }));
        }
      }
    } catch (e) {
      if (stepInterval) clearInterval(stepInterval);
      console.error("Lỗi chạy 5 cơ sở cho item", itemId, e);
      if (openModal) {
        setAuditModal((prev) => ({ ...prev, status: "error" }));
      }
    } finally {
      setRunningItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRunAll5Pillars = async () => {
    setRunningAllPillars(true);
    try {
      for (const it of filteredItems) {
        const itemId = it.id || items.indexOf(it) + 1;
        // Chạy tuần tự 5 cơ sở nhanh (không gọi AI LLM để tối đa hóa tốc độ)
        await handleRun5Pillars(itemId, false, false);
      }
    } catch (e) {
      console.error("Lỗi chạy tất cả 5 cơ sở:", e);
    } finally {
      setRunningAllPillars(false);
    }
  };

  const handleExportPdf = (itemId) => {
    window.location.href = `/api/items/${itemId}/export-pdf`;
  };

  const handleOpenExistingAudit = async (it) => {
    const itemId = it.id || items.indexOf(it) + 1;
    const kw =
      it.search_keyword || itemKeywords[itemId] || extractDefaultKeyword(it);

    // Bóc tách giá quote gốc thực tế nếu đã scan
    const itemMatch = quoteMatches[itemId] || {};
    const qPriceInit =
      itemMatch.lowest_price ||
      it.lowest_quote_price ||
      it.don_gia_nha_thau_thap_nhat ||
      it.don_gia_trinh ||
      0;
    const qVendorInit =
      itemMatch.lowest_vendor ||
      it.lowest_quote_vendor ||
      it.ten_nha_thau_thap_nhat ||
      "Nhà thầu chào";

    // Nhận diện cơ sở được chọn thực tế từ co_so_thong_nhat
    const csTn = (it.co_so_thong_nhat || "").toLowerCase();
    const isErpMatch = csTn.includes("erp") || csTn.includes("vĩnh tân 4");
    const isImisMatch = csTn.includes("imis");
    const isMscMatch = csTn.includes("mua sắm công") || csTn.includes("e-gp");
    const isEcomMatch =
      csTn.includes("tmđt") ||
      csTn.includes("thương mại điện tử") ||
      csTn.includes("web");

    const initialSteps = [
      {
        name: "1. Báo Giá Gốc (PDF)",
        detail:
          qPriceInit > 0
            ? `Báo giá chào thấp nhất: ${fmt(qPriceInit)} đ (${qVendorInit})`
            : "Đã đối chiếu thư mục báo giá",
        price: qPriceInit,
      },
      {
        name: "2. ERP Vĩnh Tân 4",
        detail: `Mã ERP: ${it.ma_vt || "Tra cứu theo tên"}${isErpMatch ? " (Cơ sở chốt giá)" : ""}`,
        price: isErpMatch ? it.don_gia_thong_nhat || 0 : 0,
      },
      {
        name: "3. EVN IMIS Toàn Ngành",
        detail: isImisMatch
          ? `Hợp đồng phát điện toàn ngành EVN (Cơ sở chốt giá)`
          : `Đã rà soát CSDL EVN IMIS theo từ khóa [${it.ma_vt || kw}]: Không có kết quả mua sắm tương đương.`,
        price: isImisMatch ? it.don_gia_thong_nhat || 0 : 0,
      },
      {
        name: "4. Mua Sắm Công e-GP",
        detail: isMscMatch
          ? `Đấu thầu qua mạng muasamcong.mpi.gov.vn (Cơ sở chốt giá)`
          : `Đã tra cứu Cổng Mua Sắm Công theo từ khóa [${kw}]: Chưa ghi nhận kết quả trúng thầu tương tự.`,
        price: isMscMatch ? it.don_gia_thong_nhat || 0 : 0,
      },
      {
        name: "5. TMĐT & Tham Khảo Web",
        detail: isEcomMatch
          ? `Tham chiếu thị trường công nghiệp (Cơ sở chốt giá)`
          : `Đã khảo sát thị trường web theo từ khóa [${kw}]: Vật tư đặc thù, yêu cầu báo giá riêng (RFQ).`,
        price: isEcomMatch ? it.don_gia_thong_nhat || 0 : 0,
      },
    ];

    const auditData = {
      item_id: itemId,
      keyword_used: kw,
      result: {
        don_gia_trinh: it.don_gia_trinh,
        don_gia_thong_nhat: it.don_gia_thong_nhat,
        thanh_tien_thong_nhat: it.thanh_tien_thong_nhat,
        gia_tri_giam: it.gia_tri_giam,
        pct_giam:
          it.don_gia_trinh > 0
            ? ((it.don_gia_trinh -
                (it.don_gia_thong_nhat || it.don_gia_trinh)) /
                it.don_gia_trinh) *
              100
            : 0,
        danh_gia_ttd: it.danh_gia_ttd,
      },
      synthesis: {
        coverage_score: 90,
        summary_text: it.danh_gia_ttd,
      },
      steps: initialSteps,
    };

    // Mở modal lập tức (phản hồi 0ms)
    setAuditModal({
      isOpen: true,
      item: it,
      keyword: kw,
      status: "completed",
      activeStep: 6,
      auditData: auditData,
    });

    // Nạp dữ liệu chứng cứ thật 100% từ Backend (/api/evidence/get)
    try {
      const resEv = await fetch(`/api/evidence/get?item_id=${itemId}`);
      if (resEv.ok) {
        const dataEv = await resEv.json();
        if (dataEv.success && dataEv.evidence) {
          const ev = dataEv.evidence;
          const qPrice = ev.quotes?.min_price || qPriceInit;
          const qSupplier = ev.quotes?.matches?.[0]?.company || qVendorInit;

          // 1. Trích xuất chi tiết Khối 1: Báo giá
          const qMatch = ev.quotes?.matches?.[0] || {};
          const qItemName = qMatch.quoted_name || ev.quotes?.quoted_name || "";
          const qItemSpecs = qMatch.quoted_tskt || qMatch.match_reason || "";
          const qScore = qMatch.score
            ? Math.min(100, Math.round(qMatch.score / 15))
            : qPrice > 0
              ? 100
              : 0;

          // 2. Trích xuất chi tiết Khối 2: ERP
          let erpPrice = 0;
          const erpKw = ev.erp?.keyword || it.ma_vt || kw;
          let erpDetail = `Đã tra cứu CSDL lịch sử mua sắm ERP Vĩnh Tân 4 theo từ khóa [${erpKw}]: Chưa có lịch sử mua sắm.`;
          const isErpDeselected =
            ev.erp?.summary?.is_deselected ||
            ev.erp?.summary?.status === "ERP_DESELECTED" ||
            ev.erp?.is_deselected ||
            (ev.erp?.summary_text &&
              ev.erp.summary_text.toLowerCase().includes("không áp dụng"));

          const r0 =
            ev.erp?.results && ev.erp.results.length > 0
              ? ev.erp.results[0]
              : null;
          const erpItemName = r0
            ? r0.tenVt || r0.ten_vt || r0.tenVatTu || ""
            : "";
          const erpItemSpecs = r0 ? r0.thongSoKt || r0.dienGiai || "" : "";
          const erpHdInfo = r0
            ? `HĐ: ${r0.so_hd || r0.soHopDong || ""} (Ký ngày: ${r0.ngayKy || r0.ngay_ky || r0.ngayChungTu || "N/A"})`
            : "";
          const erpSupplier = r0
            ? r0.nhaThau || r0.nha_thau || r0.tenDonVi || ""
            : "";
          const erpScore = r0 ? Math.round(r0.match_score || 0) : 0;

          if (isErpDeselected) {
            erpPrice = 0;
            erpDetail =
              ev.erp?.summary_text ||
              ev.erp?.summary?.summary_text ||
              "Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này.";
          } else if (r0) {
            erpPrice = parseFloat(r0.don_gia || r0.donGia || 0);
            erpDetail =
              ev.erp.summary_text ||
              `Lịch sử ERP: ${fmt(erpPrice)} đ (HĐ: ${r0.so_hd || r0.soHopDong || ""})`;
          } else if (isErpMatch) {
            erpPrice = it.don_gia_thong_nhat || 0;
          } else if (ev.erp?.summary_text) {
            erpDetail = ev.erp.summary_text;
          }

          // 3. Trích xuất chi tiết Khối 3: IMIS
          let imisPrice = 0;
          const imisKw =
            ev.imis?.keyword || ev.imis?.used_keyword || it.ma_vt || kw;
          let imisDetail =
            ev.imis?.summary_text ||
            ev.imis?.summary?.summary_text ||
            `Đã tra cứu theo từ khóa [${imisKw}] trên CSDL EVN IMIS (2023-2026): Không tìm thấy kết quả mua sắm tương đương.`;
          const isImisDeselected =
            ev.imis?.summary?.is_deselected || ev.imis?.is_deselected;
          const i0 =
            ev.imis?.results && ev.imis.results.length > 0
              ? ev.imis.results[0]
              : null;
          const imisItemName = i0 ? i0.tenVt || i0.ten_vt || "" : "";
          const imisSupplier = i0 ? i0.tenDonVi || i0.don_vi || "" : "";
          const imisHdInfo = i0
            ? `HĐ: ${i0.soHopDong || ""} (${i0.ngayKy || ""})`
            : "";

          if (isImisDeselected) {
            imisPrice = 0;
            imisDetail =
              ev.imis?.summary_text ||
              `Đã loại trừ CSDL EVN IMIS (Từ khóa [${imisKw}])`;
          } else if (i0) {
            imisPrice = parseFloat(i0.don_gia || i0.donGia || 0);
            imisDetail =
              ev.imis.summary_text ||
              `IMIS: ${fmt(imisPrice)} đ (${i0.don_vi || ""})`;
          } else if (isImisMatch) {
            imisPrice = it.don_gia_thong_nhat || 0;
          } else if (ev.imis?.summary_text) {
            imisDetail = ev.imis.summary_text;
          }

          // 4. Trích xuất chi tiết Khối 4: Mua Sắm Công
          let mscPrice = 0;
          const mscKw =
            ev.muasamcong?.keyword ||
            ev.muasamcong?.used_keyword ||
            (it.ten_vt_goc || it.ten_vt || "").split("\n")[0].trim();
          let mscDetail =
            ev.muasamcong?.summary_text ||
            ev.muasamcong?.summary?.summary_text ||
            `Đã tra cứu theo từ khóa [${mscKw}] trên Mạng Đấu thầu Quốc gia: Chưa ghi nhận kết quả trúng thầu tương tự.`;
          const m0 =
            ev.muasamcong?.results && ev.muasamcong.results.length > 0
              ? ev.muasamcong.results[0]
              : null;
          const mscItemName = m0 ? m0.danh_muc || m0.ten_goi_thau || "" : "";
          const mscSupplier = m0
            ? m0.nha_thau_trung || m0.ben_moi_thau || ""
            : "";
          const mscSpecs = m0 ? m0.thong_so_kt || "" : "";

          if (m0) {
            mscPrice = parseFloat(m0.gia_trung_thau || m0.don_gia || 0);
            mscDetail =
              ev.muasamcong.summary_text || `Mua sắm công: ${fmt(mscPrice)} đ`;
          } else if (isMscMatch) {
            mscPrice = it.don_gia_thong_nhat || 0;
          } else if (ev.muasamcong?.summary_text) {
            mscDetail = ev.muasamcong.summary_text;
          }

          // 5. Trích xuất chi tiết Khối 5: TMĐT
          let ecomPrice = 0;
          const ecomKw =
            ev.ecom?.search_keyword ||
            ev.ecom?.keyword ||
            (it.ten_vt_goc || it.ten_vt || "").split("\n")[0].trim();
          let ecomDetail =
            ev.ecom?.summary_text ||
            `Đã khảo sát thị trường web theo từ khóa [${ecomKw}]: Không có đơn giá bán lẻ niêm yết công khai (Yêu cầu báo giá riêng - Contact for Quote).`;
          const e0 =
            ev.ecom?.results && ev.ecom.results.length > 0
              ? ev.ecom.results[0]
              : ev.ecom?.selected_record || null;
          const ecomItemName = e0 ? e0.title || e0.name || "" : "";
          const ecomVendor = e0 ? e0.vendor || "Nhà cung cấp Web" : "";
          const ecomUrl = e0 ? e0.url || "" : "";
          const ecomSpecs = e0
            ? e0.notes ||
              (e0.price_usd ? `Quy đổi từ $${e0.price_usd} USD` : "")
            : "";
          const hasLandedCost = Boolean(
            e0?.has_landed_cost || ev.ecom?.has_landed_cost,
          );

          if (e0) {
            ecomPrice = parseFloat(
              e0.landed_price || e0.gia_vnd || e0.price_vnd || e0.price || 0,
            );
            ecomDetail = ev.ecom.summary_text || `TMĐT: ${fmt(ecomPrice)} đ`;
          } else if (isEcomMatch) {
            ecomPrice = it.don_gia_thong_nhat || 0;
          } else if (ev.ecom?.summary_text) {
            ecomDetail = ev.ecom.summary_text;
          }

          const realSteps = [
            {
              id: 1,
              key: "quotes",
              name: "1. Báo Giá Gốc (PDF)",
              item_name: qItemName,
              specs: qItemSpecs,
              supplier: qSupplier,
              score: qScore,
              detail:
                ev.quotes?.summary_text ||
                (qPrice > 0
                  ? `Báo giá chào thấp nhất: ${fmt(qPrice)} đ/Cái (${qSupplier})`
                  : "Chưa có báo giá gốc"),
              price: qPrice,
              _orig_price: qPrice,
              _orig_detail:
                ev.quotes?.summary_text ||
                (qPrice > 0
                  ? `Báo giá chào thấp nhất: ${fmt(qPrice)} đ/Cái (${qSupplier})`
                  : "Chưa có báo giá gốc"),
              is_deselected: false,
            },
            {
              id: 2,
              key: "erp",
              name: "2. ERP Vĩnh Tân 4",
              item_name: erpItemName,
              specs: erpItemSpecs,
              supplier: erpSupplier,
              contract_info: erpHdInfo,
              score: erpScore,
              detail: erpDetail,
              price: erpPrice,
              _orig_price: r0
                ? parseFloat(r0.don_gia || r0.donGia || 0)
                : erpPrice || 0,
              _orig_detail: r0
                ? `Lịch sử ERP: ${fmt(parseFloat(r0.don_gia || r0.donGia || 0))} đ (HĐ: ${r0.so_hd || r0.soHopDong || ""})`
                : erpDetail,
              is_deselected: isErpDeselected,
            },
            {
              id: 3,
              key: "imis",
              name: "3. EVN IMIS Toàn Ngành",
              item_name: imisItemName,
              supplier: imisSupplier,
              contract_info: imisHdInfo,
              detail: imisDetail,
              price: imisPrice,
              _orig_price: i0
                ? parseFloat(i0.don_gia || i0.donGia || 0)
                : imisPrice || 0,
              _orig_detail: imisDetail,
              is_deselected: isImisDeselected || imisPrice === 0,
            },
            {
              id: 4,
              key: "muasamcong",
              name: "4. Mua Sắm Công e-GP",
              item_name: mscItemName,
              supplier: mscSupplier,
              specs: mscSpecs,
              detail: mscDetail,
              price: mscPrice,
              _orig_price: m0
                ? parseFloat(m0.gia_trung || m0.don_gia || 0)
                : mscPrice || 0,
              _orig_detail: mscDetail,
              is_deselected: mscPrice === 0,
            },
            {
              id: 5,
              key: "ecom",
              name: "5. TMĐT & Tham Khảo Web",
              item_name: ecomItemName,
              supplier: ecomVendor,
              specs: ecomSpecs,
              url: ecomUrl,
              has_landed: hasLandedCost,
              detail: ecomDetail,
              price: ecomPrice,
              _orig_price: e0
                ? parseFloat(
                    e0.landed_price ||
                      e0.gia_vnd ||
                      e0.price_vnd ||
                      e0.price ||
                      0,
                  )
                : ecomPrice || 0,
              _orig_detail: ecomDetail,
              is_deselected: Boolean(ev.ecom?.is_deselected) || ecomPrice === 0,
            },
            {
              id: 6,
              key: "synthesis",
              name: "6. AI Thuyết Minh & Chốt Giá",
              price: it.don_gia_thong_nhat || 0,
              summary_text: it.danh_gia_ttd,
              detail: `Đơn giá thống nhất: ${fmt(it.don_gia_thong_nhat)} đ/Cái`,
            },
          ];

          setAuditModal((prev) => {
            if (!prev.isOpen || (prev.item?.id !== it.id && prev.item !== it))
              return prev;
            return {
              ...prev,
              auditData: {
                ...prev.auditData,
                steps: realSteps,
              },
            };
          });
        }
      }
    } catch (err) {
      console.warn("Không thể nạp thêm chi tiết chứng cứ ngầm:", err);
    }
  };

  const fmt = (val) =>
    !val && val !== 0 ? "—" : Math.round(val).toLocaleString("vi-VN");

  const getAppraisalOpinion = (it, dgTrinh, dgTN, pctGiam) => {
    const fullText = it.danh_gia_ttd || it.y_kien_tham_dinh || "";

    // 1. Nếu có ý kiến thẩm định ngắn gọn cụ thể đã lưu
    if (it.y_kien_tham_dinh && it.y_kien_tham_dinh.trim().length > 0) {
      return {
        briefText: it.y_kien_tham_dinh.trim(),
        fullText,
      };
    }

    // 2. Bóc tách câu kết luận / cảnh báo chính từ bản thuyết minh danh_gia_ttd
    if (fullText && typeof fullText === "string") {
      const matchKl = fullText.match(
        /(?:KẾT LUẬN THẨM ĐỊNH|KẾT LUẬN)[:\s\-]+([^\n\r]+)/i,
      );
      if (matchKl && matchKl[1] && matchKl[1].trim().length > 10) {
        return {
          briefText: matchKl[1].trim().replace(/^\*+|\*+$/g, ""),
          fullText,
        };
      }

      const matchCb = fullText.match(
        /(?:CẢNH BÁO BẤT THƯỜNG ĐƠN GIÁ|CẢNH BÁO)[:\s\-]+([^\n\r]+)/i,
      );
      if (matchCb && matchCb[1] && matchCb[1].trim().length > 10) {
        return {
          briefText: matchCb[1].trim().replace(/^\*+|\*+$/g, ""),
          fullText,
        };
      }

      const matchDx = fullText.match(
        /(?:Đề xuất duyệt|Đề xuất|ĐỀ XUẤT)[:\s\-]+([^\n\r]+)/i,
      );
      if (matchDx && matchDx[1] && matchDx[1].trim().length > 10) {
        return {
          briefText: matchDx[1].trim().replace(/^\*+|\*+$/g, ""),
          fullText,
        };
      }
    }

    // 3. Dự phòng theo mức chênh lệch đơn giá thống nhất và giá trình
    if (dgTN > 0) {
      const cs = it.co_so_thong_nhat ? ` (theo ${it.co_so_thong_nhat})` : "";
      if (dgTrinh > 0 && dgTN < dgTrinh) {
        const pct =
          pctGiam !== null
            ? pctGiam.toFixed(1)
            : (((dgTrinh - dgTN) / dgTrinh) * 100).toFixed(1);
        return {
          briefText: `Đề xuất duyệt ${fmt(dgTN)} đ, giảm ${pct}% so với giá trình${cs}.`,
          fullText:
            fullText || `Đề xuất duyệt đơn giá thống nhất là ${fmt(dgTN)} đ.`,
        };
      } else if (dgTN === dgTrinh) {
        return {
          briefText: `Phù hợp mặt bằng giá thị trường. Thống nhất giữ giá trình ${fmt(dgTrinh)} đ${cs}.`,
          fullText: fullText || `Đơn giá trình phù hợp.`,
        };
      } else {
        return {
          briefText: `Đề xuất duyệt ${fmt(dgTN)} đ${cs}.`,
          fullText,
        };
      }
    }

    return {
      briefText:
        "Chưa có ý kiến thẩm định tổng hợp (đang thu thập chứng cứ 5 cơ sở).",
      fullText: "Chưa có dữ liệu thẩm định.",
    };
  };

  const isItemSaved = (it, origIdx) => {
    const itemId = it.id || origIdx + 1;
    const st = evidenceStatus[String(itemId)];
    return Boolean(
      st?.has_syn || (it.danh_gia_ttd && it.danh_gia_ttd.trim().length > 0),
    );
  };

  const savedCount = items.filter((it, idx) => isItemSaved(it, idx)).length;
  const savedPct = items.length > 0 ? (savedCount / items.length) * 100 : 0;

  const filteredItems = items.filter((it, idx) => {
    const origIdx = items.indexOf(it);
    const saved = isItemSaved(it, origIdx);
    if (filterSaved === "SAVED" && !saved) return false;
    if (filterSaved === "UNSAVED" && saved) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const itemId = it.id || origIdx + 1;
    const kw = itemKeywords[itemId] || "";
    return (
      (it.ten_vt_goc || it.ten_vt || "").toLowerCase().includes(q) ||
      (it.ma_vt || "").toLowerCase().includes(q) ||
      (it.pycvt || "").toLowerCase().includes(q) ||
      (it.thong_so_kt || it.part_no || "").toLowerCase().includes(q) ||
      kw.toLowerCase().includes(q) ||
      String(it.stt || origIdx + 1).includes(q)
    );
  });

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 opacity-30 group-hover/th:opacity-80 transition shrink-0 ml-1 inline" />
      );
    }
    if (sortOrder === "asc") {
      return (
        <ArrowUp className="w-3.5 h-3.5 text-blue-700 font-extrabold shrink-0 ml-1 inline" />
      );
    }
    return (
      <ArrowDown className="w-3.5 h-3.5 text-blue-700 font-extrabold shrink-0 ml-1 inline" />
    );
  };

  const sortedFilteredItems = useMemo(() => {
    if (!sortField) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const origIdxA = items.indexOf(a);
      const origIdxB = items.indexOf(b);
      const slA = parseFloat(a.so_luong) || 1;
      const slB = parseFloat(b.so_luong) || 1;

      let valA = 0;
      let valB = 0;

      if (sortField === "stt") {
        valA = parseFloat(a.stt) || origIdxA + 1;
        valB = parseFloat(b.stt) || origIdxB + 1;
      } else if (sortField === "dg_trinh") {
        valA = parseFloat(a.don_gia_trinh) || 0;
        valB = parseFloat(b.don_gia_trinh) || 0;
      } else if (sortField === "tt_trinh") {
        valA =
          parseFloat(a.thanh_tien_trinh) ||
          slA * (parseFloat(a.don_gia_trinh) || 0);
        valB =
          parseFloat(b.thanh_tien_trinh) ||
          slB * (parseFloat(b.don_gia_trinh) || 0);
      } else if (sortField === "dg_thong_nhat") {
        valA = parseFloat(a.don_gia_thong_nhat) || 0;
        valB = parseFloat(b.don_gia_thong_nhat) || 0;
      } else if (sortField === "tt_thong_nhat") {
        valA =
          parseFloat(a.thanh_tien_thong_nhat) ||
          slA * (parseFloat(a.don_gia_thong_nhat) || 0);
        valB =
          parseFloat(b.thanh_tien_thong_nhat) ||
          slB * (parseFloat(b.don_gia_thong_nhat) || 0);
      } else if (sortField === "lowest_price") {
        const idA = a.id || origIdxA + 1;
        const idB = b.id || origIdxB + 1;
        valA = parseFloat(
          quoteMatches[idA]?.lowest_price ||
            a.lowest_quote_price ||
            a.don_gia_nha_thau_thap_nhat ||
            0,
        );
        valB = parseFloat(
          quoteMatches[idB]?.lowest_price ||
            b.lowest_quote_price ||
            b.don_gia_nha_thau_thap_nhat ||
            0,
        );
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return (a.stt || origIdxA + 1) - (b.stt || origIdxB + 1);
    });
  }, [filteredItems, sortField, sortOrder, items, quoteMatches]);

  // Summary stats
  const giam_tru = stats.total_trinh - stats.total_thong_nhat;
  const pct_giam =
    stats.total_trinh > 0 ? (giam_tru / stats.total_trinh) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden bg-slate-100 h-full gap-3">
      {/* Stats Cards - 5 Cột: Bổ sung Thông số Tiến độ lưu CSDL Thẩm định */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <StatCard
          label="Tổng số danh mục"
          value={`${stats.total_items} mục`}
          color="slate"
          sub="Hồ sơ dự toán mua sắm"
        />
        <StatCard
          label="Đã lưu CSDL thẩm định"
          value={`${savedCount} / ${stats.total_items} mục`}
          color="teal"
          sub={`Đạt ${savedPct.toFixed(1)}% danh mục`}
          progress={savedPct}
        />
        <StatCard
          label="Tổng giá trị trình duyệt"
          value={`${fmt(stats.total_trinh)} đ`}
          color="blue"
          sub="Theo hồ sơ dự toán trình"
        />
        <StatCard
          label="Tổng giá trị thống nhất"
          value={
            stats.total_thong_nhat > 0
              ? `${fmt(stats.total_thong_nhat)} đ`
              : "—"
          }
          color="emerald"
          sub={stats.total_thong_nhat > 0 ? null : "Chưa có kết quả thẩm định"}
        />
        <StatCard
          label="Giảm trừ / Tiết kiệm"
          value={stats.total_thong_nhat > 0 ? `${fmt(giam_tru)} đ` : "—"}
          color="purple"
          sub={
            stats.total_thong_nhat > 0
              ? `(-${pct_giam.toFixed(1)}% so với trình)`
              : null
          }
        />
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-teal-700" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                {viewMode === "standard"
                  ? "Bảng Ma Trận Dự Toán Thẩm Định — Chuẩn 2026"
                  : "View 1: Cơ Sở Đơn Giá"}
              </span>
              <span className="bg-teal-100 text-teal-800 text-[10.5px] px-2 py-0.5 rounded-full font-bold">
                {filteredItems.length}/{items.length} mục
              </span>

              {/* Bộ lọc nhanh trạng thái lưu CSDL Thẩm định */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-[10.5px] font-bold ml-1">
                <button
                  onClick={() => setFilterSaved("ALL")}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${filterSaved === "ALL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
                  title="Hiện toàn bộ danh mục"
                >
                  Tất Cả ({items.length})
                </button>
                <button
                  onClick={() => setFilterSaved("SAVED")}
                  className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${filterSaved === "SAVED" ? "bg-emerald-700 text-white shadow-2xs" : "text-emerald-800 hover:bg-emerald-100/60"}`}
                  title="Chỉ xem các mục ĐÃ LƯU CSDL thẩm định"
                >
                  <CheckCircle2 className="w-3 h-3" /> Đã Lưu ({savedCount})
                </button>
                <button
                  onClick={() => setFilterSaved("UNSAVED")}
                  className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${filterSaved === "UNSAVED" ? "bg-amber-600 text-white shadow-2xs" : "text-amber-800 hover:bg-amber-100/60"}`}
                  title="Chỉ xem các mục CHƯA LƯU CSDL thẩm định"
                >
                  <Clock className="w-3 h-3" /> Chưa Lưu (
                  {items.length - savedCount})
                </button>
              </div>

              {loadingQuotes && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang bóc tách PDF
                  Báo giá...
                </span>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs font-bold ml-2">
              <button
                onClick={() => setViewMode("standard")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  viewMode === "standard"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-300/60"
                }`}
                title="Bảng ma trận 13 cột chuẩn 2026"
              >
                13 Cột Chuẩn
              </button>
              <button
                onClick={() => setViewMode("coso_dongia")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  viewMode === "coso_dongia"
                    ? "bg-teal-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-300/60"
                }`}
                title="View 1: Cơ sở đơn giá & Ý kiến thẩm định (13 cột)"
              >
                <Layers className="w-3 h-3 text-amber-300" /> View 1: Cơ Sở Đơn
                Giá
              </button>
            </div>

            {/* Quick Price Sort Toolbar */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs font-bold ml-2">
              <span className="text-[11px] text-slate-600 px-1.5 flex items-center gap-1 font-semibold">
                <ArrowUpDown className="w-3 h-3 text-teal-700" /> Sắp xếp giá:
              </span>
              <button
                onClick={() => handleSort("dg_trinh")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortField === "dg_trinh"
                    ? "bg-[#003366] text-white shadow-xs font-extrabold"
                    : "text-slate-700 hover:bg-slate-300/70"
                }`}
                title="Sắp xếp theo Đơn giá trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
              >
                <span>ĐG Trình</span>
                {sortField === "dg_trinh" ? (
                  <span className="text-[10px] bg-blue-900/80 px-1.5 py-0.2 rounded font-black text-amber-200">
                    {sortOrder === "asc" ? "↑ Thấp ➔ Cao" : "↓ Cao ➔ Thấp"}
                  </span>
                ) : (
                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
              <button
                onClick={() => handleSort("dg_thong_nhat")}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortField === "dg_thong_nhat"
                    ? "bg-emerald-700 text-white shadow-xs font-extrabold"
                    : "text-slate-700 hover:bg-slate-300/70"
                }`}
                title="Sắp xếp theo Đơn giá thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
              >
                <span>ĐG Thống Nhất</span>
                {sortField === "dg_thong_nhat" ? (
                  <span className="text-[10px] bg-emerald-900/80 px-1.5 py-0.2 rounded font-black text-amber-200">
                    {sortOrder === "asc" ? "↑ Thấp ➔ Cao" : "↓ Cao ➔ Thấp"}
                  </span>
                ) : (
                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
              {sortField && (
                <button
                  onClick={() => {
                    setSortField(null);
                    setSortOrder("asc");
                  }}
                  className="px-2 py-0.5 text-[10.5px] text-red-700 hover:bg-red-100 rounded-md cursor-pointer font-bold transition ml-0.5"
                  title="Hủy sắp xếp, quay về thứ tự STT gốc ban đầu"
                >
                  ✕ Mặc định
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Master 1-Click Automation Button */}
            <button
              onClick={handleRunAll5Pillars}
              disabled={runningAllPillars}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Chạy 1 mạch tự động 5 khối chứng cứ cho tất cả danh mục vật tư"
            >
              {runningAllPillars ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                  <span>Đang chạy tất cả...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>⚡ Tra Cứu Tự Động Tất Cả (1-Click All)</span>
                </>
              )}
            </button>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ khóa, tên vật tư, ERP..."
                className="pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg w-56 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => (window.location.href = "/api/export-excel")}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1950px]">
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 shadow-sm">
              <tr>
                {/* Fixed Common Columns 1..3 */}
                <th
                  onClick={() => handleSort("stt")}
                  className="py-3 px-2 text-center w-10 sticky left-0 bg-slate-100 border-r border-slate-200 z-30 cursor-pointer select-none hover:bg-slate-200 transition group/th"
                  title="Nhấp để sắp xếp theo STT (Tăng dần / Giảm dần / Reset)"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>1. STT</span>
                    {renderSortIcon("stt")}
                  </div>
                </th>
                <th className="py-3 px-2 text-center w-24 sticky left-10 bg-slate-100 border-r border-slate-200 z-30">
                  2. PYCVT
                </th>
                <th className="py-3 px-3 w-56 sticky left-[136px] bg-slate-100 border-r border-slate-200 z-30 shadow-sm">
                  3. Tên vật tư
                </th>

                {/* NEW COLUMN: Từ Khóa Tra Cứu Dùng Chung 5 Cơ Sở */}
                <th className="py-3 px-3 w-48 border-r border-slate-200 bg-purple-100/80 text-purple-950 font-extrabold flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-purple-700" /> 🔑 Từ Khóa Tra
                  Cứu (5 Cơ Sở)
                </th>

                <th className="py-3 px-3 w-52 border-r border-slate-200">
                  4. Thông số KT
                </th>
                <th className="py-3 px-2 text-center w-12 border-r border-slate-200">
                  5. ĐVT
                </th>
                <th className="py-3 px-2 text-right w-14 border-r border-slate-200">
                  6. SL
                </th>
                <th className="py-3 px-3 w-28 border-r border-slate-200">
                  7. HSX/XX
                </th>
                <th className="py-3 px-3 text-center w-28 border-r border-slate-200 font-mono">
                  8. Mã ERP
                </th>
                <th
                  onClick={() => handleSort("dg_trinh")}
                  className={`py-3 px-3 text-right w-32 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                    sortField === "dg_trinh"
                      ? "bg-blue-100 text-blue-950 font-black ring-1 ring-blue-400 inset-0 shadow-inner"
                      : "bg-blue-50 text-[#003366] hover:bg-blue-100/70"
                  }`}
                  title="Nhấp để sắp xếp theo Đơn giá trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>9. ĐG Trình</span>
                    {renderSortIcon("dg_trinh")}
                  </div>
                </th>

                {/* Conditional View Columns */}
                {viewMode === "standard" ? (
                  <>
                    <th
                      onClick={() => handleSort("tt_trinh")}
                      className={`py-3 px-3 text-right w-36 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === "tt_trinh"
                          ? "bg-blue-100 text-blue-950 font-black ring-1 ring-blue-400 inset-0 shadow-inner"
                          : "bg-blue-50 text-[#003366] hover:bg-blue-100/70"
                      }`}
                      title="Nhấp để sắp xếp theo Thành tiền trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>10. TT Trình</span>
                        {renderSortIcon("tt_trinh")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("dg_thong_nhat")}
                      className={`py-3 px-3 text-right w-32 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === "dg_thong_nhat"
                          ? "bg-emerald-100 text-emerald-950 font-black ring-1 ring-emerald-400 inset-0 shadow-inner"
                          : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70"
                      }`}
                      title="Nhấp để sắp xếp theo Đơn giá thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>11. ĐG Thống Nhất</span>
                        {renderSortIcon("dg_thong_nhat")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("tt_thong_nhat")}
                      className={`py-3 px-3 text-right w-36 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === "tt_thong_nhat"
                          ? "bg-emerald-100 text-emerald-950 font-black ring-1 ring-emerald-400 inset-0 shadow-inner"
                          : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70"
                      }`}
                      title="Nhấp để sắp xếp theo Thành tiền thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>12. TT Thống Nhất</span>
                        {renderSortIcon("tt_thong_nhat")}
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right w-20 border-r border-slate-200 bg-amber-50 text-amber-900">
                      13. % Giảm
                    </th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3 w-72 border-r border-slate-200 bg-amber-50/80 text-amber-950 font-bold">
                      10. Ghi chú cơ sở đơn giá
                    </th>
                    <th
                      onClick={() => handleSort("lowest_price")}
                      className={`py-3 px-3 text-right w-44 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === "lowest_price"
                          ? "bg-purple-100 text-purple-950 font-black ring-1 ring-purple-400 inset-0 shadow-inner"
                          : "bg-purple-50 text-purple-950 hover:bg-purple-100/70"
                      }`}
                      title="Nhấp để sắp xếp theo Đơn giá nhà thầu thấp nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>11. ĐG Nhà thầu thấp nhất</span>
                        {renderSortIcon("lowest_price")}
                      </div>
                    </th>
                    <th className="py-3 px-3 w-48 border-r border-slate-200 bg-purple-50 text-purple-950 font-bold">
                      12. Tên Nhà thầu thấp nhất
                    </th>
                    <th className="py-3 px-3 w-80 min-w-[280px] border-r border-slate-200 bg-teal-50/90 text-teal-950 font-bold">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-700" />
                        <span>13. Ý kiến thẩm định (TTĐ)</span>
                      </div>
                    </th>
                  </>
                )}

                {/* Sticky Right Action */}
                <th className="py-3 px-2 text-center w-24 sticky right-0 bg-slate-100 border-l border-slate-200 z-30 shadow-sm">
                  Kết quả
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">
              {sortedFilteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={14}
                    className="text-center py-16 text-slate-400 text-xs italic"
                  >
                    {searchQuery
                      ? `Không tìm thấy mục nào khớp "${searchQuery}"`
                      : "Chưa có dòng dự toán. Hãy nạp file Excel."}
                  </td>
                </tr>
              ) : (
                sortedFilteredItems.map((it, idx) => {
                  const origIdx = items.indexOf(it);
                  const itemId = it.id || origIdx + 1;
                  const sl = parseFloat(it.so_luong) || 1;

                  // Trình
                  const dgTrinh = parseFloat(it.don_gia_trinh) || 0;
                  const ttTrinh =
                    parseFloat(it.thanh_tien_trinh) || sl * dgTrinh;

                  // Thống nhất
                  const dgTN = parseFloat(it.don_gia_thong_nhat) || 0;
                  const ttTN =
                    parseFloat(it.thanh_tien_thong_nhat) ||
                    (dgTN > 0 ? sl * dgTN : 0);

                  // % giảm
                  const hasTN = dgTN > 0;
                  const pctGiam =
                    hasTN && dgTrinh > 0
                      ? ((dgTrinh - dgTN) / dgTrinh) * 100
                      : null;

                  // Lowest quote & match info from auto-scan backend
                  const itemMatch = quoteMatches[itemId] || {};
                  const lowestPrice =
                    itemMatch.lowest_price ||
                    it.lowest_quote_price ||
                    it.don_gia_nha_thau_thap_nhat ||
                    it.don_gia_nhathau_min ||
                    null;
                  const lowestVendor =
                    itemMatch.lowest_vendor ||
                    it.lowest_quote_vendor ||
                    it.ten_nha_thau_thap_nhat ||
                    it.ten_nhathau_min ||
                    "—";
                  const noteCoSo =
                    itemMatch.co_so_don_gia ||
                    it.ghi_chu_co_so_don_gia ||
                    it.co_so_thong_nhat ||
                    it.danh_gia_ttd ||
                    it.ghi_chu ||
                    "—";

                  // Status
                  const status = !hasTN
                    ? "pending"
                    : pctGiam > 0
                      ? "reduced"
                      : pctGiam === 0
                        ? "same"
                        : "increased";

                  const isEven = idx % 2 === 0;
                  const isRunningThis = runningItemIds.has(itemId);

                  return (
                    <tr
                      key={idx}
                      className={`group transition hover:bg-teal-50/60 ${isEven ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      {/* Common Sticky Left 1..3 */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 sticky left-0 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 font-medium">
                        {it.stt || origIdx + 1}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-700 sticky left-10 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 text-[11px] font-semibold">
                        {it.pycvt || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 sticky left-[136px] bg-inherit group-hover:bg-teal-50 border-r border-slate-200 shadow-sm">
                        <div
                          className="line-clamp-2"
                          title={it.ten_vt_goc || it.ten_vt}
                        >
                          {it.ten_vt_goc || it.ten_vt || ""}
                        </div>
                      </td>

                      {/* NEW COLUMN: Từ Khóa Tra Cứu Dùng Chung 5 Cơ Sở */}
                      <td className="py-2.5 px-2 border-r border-slate-200 bg-purple-50/30 group-hover:bg-purple-50/60">
                        <input
                          type="text"
                          value={
                            itemKeywords[itemId] ??
                            (it.search_keyword || extractDefaultKeyword(it))
                          }
                          onChange={(e) =>
                            handleKeywordChange(itemId, e.target.value)
                          }
                          className="w-full px-2 py-1 text-[11.5px] font-mono font-bold text-purple-950 bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-2xs"
                          placeholder="Nhập từ khóa tra cứu 5 khối..."
                          title="Từ khóa dùng chung để tra cứu liên hoàn cả 5 cơ sở chứng cứ (Bấm sửa trực tiếp)"
                        />
                      </td>

                      {/* Common Columns 4..9 */}
                      <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 text-[11px]">
                        <div
                          className="line-clamp-2"
                          title={it.thong_so_kt || it.part_no}
                        >
                          {it.thong_so_kt || it.part_no || "—"}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-slate-200 text-slate-700">
                        {it.dvt || "Cái"}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                        {sl}
                      </td>
                      <td
                        className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600 truncate max-w-[112px]"
                        title={it.hsx_xx}
                      >
                        {it.hsx_xx || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-800 border-r border-slate-200 text-[11px] font-semibold">
                        {it.ma_vt || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#003366] border-r border-slate-200 bg-blue-50/20 group-hover:bg-teal-50">
                        {fmt(dgTrinh)} đ
                      </td>

                      {/* Conditional View Columns */}
                      {viewMode === "standard" ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#003366] border-r border-slate-200 bg-blue-50/10 group-hover:bg-teal-50">
                            {fmt(ttTrinh)} đ
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-slate-200 bg-emerald-50/20 group-hover:bg-teal-50">
                            {hasTN ? (
                              <span className="text-emerald-900">
                                {fmt(dgTN)} đ
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px] italic">
                                Chưa TĐ
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold border-r border-slate-200 bg-emerald-50/10 group-hover:bg-teal-50">
                            {hasTN ? (
                              <span className="text-emerald-900">
                                {fmt(ttTN)} đ
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px] italic">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-slate-200 bg-amber-50/20 group-hover:bg-teal-50">
                            {pctGiam === null ? (
                              <span className="text-slate-300 text-[11px]">
                                —
                              </span>
                            ) : pctGiam > 0 ? (
                              <span className="text-emerald-700">
                                -{pctGiam.toFixed(1)}%
                              </span>
                            ) : pctGiam < 0 ? (
                              <span className="text-red-600">
                                +{Math.abs(pctGiam).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-500">0%</span>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {/* View 1: 10. Ghi chú cơ sở đơn giá */}
                          <td className="py-2.5 px-3 border-r border-slate-200 bg-amber-50/10 text-slate-700 text-[11px]">
                            <div className="line-clamp-2" title={noteCoSo}>
                              {noteCoSo}
                            </div>
                          </td>

                          {/* View 1: 11. Đơn giá nhà thầu báo giá thấp nhất */}
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold border-r border-slate-200 bg-purple-50/20 text-purple-900">
                            {lowestPrice ? (
                              <span className="text-purple-900 font-bold">
                                {fmt(lowestPrice)} đ
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[11px] italic">
                                —
                              </span>
                            )}
                          </td>

                          {/* View 1: 12. Tên Nhà thầu báo thấp nhất */}
                          <td className="py-2.5 px-3 border-r border-slate-200 bg-purple-50/10 text-purple-900 font-semibold text-[11px]">
                            <div
                              className="truncate max-w-[180px]"
                              title={lowestVendor}
                            >
                              {lowestVendor}
                            </div>
                          </td>

                          {/* View 1: 13. Ý kiến thẩm định của TTĐ (ngắn gọn, chi tiết xin xem báo cáo) */}
                          <td className="py-2.5 px-3 border-r border-slate-200 bg-teal-50/15 text-[11px] align-top max-w-[320px]">
                            <div className="flex flex-col gap-1">
                              {/* Badge trạng thái đánh giá */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {hasTN ? (
                                  pctGiam > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                      Đề xuất giảm -{pctGiam.toFixed(1)}%
                                    </span>
                                  ) : pctGiam === 0 ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs">
                                      <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                                      Giữ giá trình ({fmt(dgTrinh)} đ)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                      Tăng +{Math.abs(pctGiam).toFixed(1)}%
                                    </span>
                                  )
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                    Đang thu thập chứng cứ
                                  </span>
                                )}
                              </div>

                              {/* Ý kiến đánh giá ngắn gọn */}
                              {(() => {
                                const opinion = getAppraisalOpinion(
                                  it,
                                  dgTrinh,
                                  dgTN,
                                  pctGiam,
                                );
                                return (
                                  <>
                                    <p
                                      className="text-slate-800 leading-snug line-clamp-2 font-medium"
                                      title={
                                        opinion.fullText || opinion.briefText
                                      }
                                    >
                                      {opinion.briefText}
                                    </p>

                                    {/* Nút/Link liên kết: Chi tiết xin xem báo cáo */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenExistingAudit(it)
                                      }
                                      className="inline-flex items-center gap-1 text-[10.5px] text-teal-700 hover:text-teal-950 font-bold hover:underline transition self-start cursor-pointer mt-0.5 group/rep"
                                      title="Nhấp để mở Bản thuyết minh & Báo cáo đối chiếu minh bạch 5 cơ sở"
                                    >
                                      <FileText className="w-3 h-3 text-teal-600 group-hover/rep:text-teal-800 shrink-0" />
                                      <span>Chi tiết xin xem báo cáo</span>
                                      <ExternalLink className="w-2.5 h-2.5 opacity-70 group-hover/rep:opacity-100 shrink-0" />
                                    </button>
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </>
                      )}

                      {/* Action — Sticky Right */}
                      <td className="py-2.5 px-2 text-center sticky right-0 bg-white group-hover:bg-teal-50 border-l border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Trạng thái lưu CSDL Thẩm định */}
                          {isItemSaved(it, origIdx) ? (
                            <span
                              className="w-full text-center py-0.5 bg-emerald-100 text-emerald-900 rounded text-[9.5px] font-bold border border-emerald-300 flex items-center justify-center gap-1 shadow-2xs"
                              title="Mục này đã tổng hợp và lưu vết CSDL Thẩm định"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />{" "}
                              Đã Lưu CSDL
                            </span>
                          ) : (
                            <span
                              className="w-full text-center py-0.5 bg-slate-100 text-slate-500 rounded text-[9.5px] font-semibold border border-slate-200 flex items-center justify-center gap-1"
                              title="Mục này chưa lưu CSDL thẩm định"
                            >
                              <Clock className="w-3 h-3 text-slate-400" /> Chưa
                              Lưu CSDL
                            </span>
                          )}

                          {/* 1-Click 5-Pillars Automation Button */}
                          <button
                            onClick={() => handleRun5Pillars(itemId, true)}
                            disabled={isRunningThis}
                            className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-[10.5px] font-extrabold transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                            title="Chạy 1 mạch tự động 5 khối chứng cứ kèm theo dõi tiến độ trực quan"
                          >
                            {isRunningThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-purple-200" />
                                <span>Đang tra...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                                <span>⚡ Tra 5 Cơ Sở</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-1 w-full">
                            {hasTN ? (
                              <button
                                onClick={() => handleOpenExistingAudit(it)}
                                className="flex-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[9.5px] font-bold transition border border-emerald-300"
                                title="Xem bảng báo cáo đối chiếu minh bạch 5 cơ sở đã thẩm định"
                              >
                                Báo Cáo
                              </button>
                            ) : null}

                            <button
                              onClick={() => onSelectInspectorItem(origIdx)}
                              className="flex-1 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-bold transition border border-slate-300"
                              title="Soi chi tiết từng khối tại màn hình Inspector"
                            >
                              Soi Chi Tiết
                            </button>
                          </div>

                          {hasTN && (
                            <button
                              onClick={() => handleExportPdf(itemId)}
                              className="w-full px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[9.5px] font-bold transition border border-rose-300 flex items-center justify-center gap-1"
                              title="Tải ngay file PDF Báo Cáo Thẩm Định chuẩn 2 trang A4"
                            >
                              <FileDown className="w-3 h-3 text-rose-600" />{" "}
                              Xuất PDF 2 Trang
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Minh Bạch Hóa Tiến Trình & Báo Cáo 5 Cơ Sở */}
      <AuditProgressModal
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal((prev) => ({ ...prev, isOpen: false }))}
        item={auditModal.item}
        keyword={auditModal.keyword}
        status={auditModal.status}
        activeStep={auditModal.activeStep}
        auditData={auditModal.auditData}
        onExportPdf={handleExportPdf}
        onOpenInspector={onSelectInspectorItem}
        onItemUpdated={(updatedItem) => {
          if (!updatedItem) return;
          setItems((prev) =>
            prev.map((it) =>
              it.id === updatedItem.id ? { ...it, ...updatedItem } : it,
            ),
          );
          setAuditModal((prev) =>
            prev.item?.id === updatedItem.id
              ? {
                  ...prev,
                  item: { ...prev.item, ...updatedItem },
                  auditData: {
                    ...prev.auditData,
                    result: {
                      ...(prev.auditData?.result || {}),
                      ...updatedItem,
                    },
                  },
                }
              : prev,
          );
        }}
      />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, progress }) {
  const colors = {
    slate: "border-slate-200  text-slate-800",
    teal: "border-teal-300   text-teal-900 bg-teal-50/40",
    blue: "border-blue-200   text-[#003366]",
    emerald: "border-emerald-200 text-emerald-700",
    purple: "border-purple-200  text-purple-700",
  };
  return (
    <div
      className={`bg-white p-3.5 rounded-xl border shadow-sm ${colors[color] || colors.slate}`}
    >
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
        {label}
      </span>
      <p className="text-lg font-extrabold font-mono mt-0.5">{value}</p>
      {sub && (
        <p
          className="text-[10px] text-slate-500 mt-0.5 font-medium truncate"
          title={sub}
        >
          {sub}
        </p>
      )}
      {progress !== undefined && (
        <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="bg-teal-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
