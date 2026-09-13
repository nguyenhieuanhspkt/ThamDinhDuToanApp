import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "../ui/Toast.jsx";
import { PILLARS } from "./constants/pillars.js";
import {
  extractCleanImisKeyword,
  getDefaultImisKeyword,
} from "./utils/keywordHelpers.js";
import InspectorNavbar from "./coordinator/InspectorNavbar.jsx";
import InspectorSidebar from "./coordinator/InspectorSidebar.jsx";
import InspectorOverviewCard from "./coordinator/InspectorOverviewCard.jsx";
import InspectorPillarTabs from "./coordinator/InspectorPillarTabs.jsx";
import {
  PillarQuotes,
  PillarErp,
  PillarImis,
  PillarMsc,
  PillarEcom,
  PillarSynthesis,
} from "./pillars";
import ErrorBoundary from "../common/ErrorBoundary.jsx";
import { Zap, Loader2 } from "lucide-react";
import AuditProgressModal from "../modals/AuditProgressModal.jsx";
import { buildCompletedAuditSteps } from "../../utils/evidenceAdapter.js";
export default function ItemInspectorView({
  selectedIndex,
  onNavigateIndex,
  onOpenPdfPage,
  onOpenErpConfig,
  onOpenImisConfig,
  onOpenMscConfig,
  imisStatus,
  mscStatus,
  initialPillar = "quotes",
}) {
  const toast = useToast();
  const [activePillar, setActivePillar] = useState(initialPillar || "quotes");

  useEffect(() => {
    if (initialPillar) {
      setActivePillar(initialPillar);
    }
  }, [initialPillar]);

  const [items, setItems] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState({});

  // Per-pillar data
  const [quoteEvidence, setQuoteEvidence] = useState(null);
  const [erpResults, setErpResults] = useState(null);
  const [imisResults, setImisResults] = useState(null);
  const [mscResults, setMscResults] = useState(null);
  const [ecomResults, setEcomResults] = useState(null);
  const [synthesisResults, setSynthesisResults] = useState(null);
  // States cho 1-click 5 cơ sở & Modal minh bạch hóa
  const [isSearching5Pillars, setIsSearching5Pillars] = useState(false);
  const [auditModal, setAuditModal] = useState({
    isOpen: false,
    item: null,
    keyword: "",
    status: "running", // 'running' | 'completed' | 'error'
    activeStep: 1,
    auditData: null,
  });
  // Loading states
  const [loading, setLoading] = useState({
    quotes: false,
    erp: false,
    imis: false,
    msc: false,
    ecom: false,
  });
  const [saving, setSaving] = useState(false);

  // Load items list
  useEffect(() => {
    fetch("/api/dossier")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(console.error);
  }, []);

  // Load all evidence status for sidebar badges
  const loadAllEvidenceStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/evidence/all-status");
      setEvidenceStatus(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);
  //định nghĩa hàm handleRun5Pillars
  const handleRun5Pillars = async (
    itemId,
    openModal = true,
    forceRefresh = false,
  ) => {
    const targetId =
      typeof itemId === "number" || typeof itemId === "string"
        ? itemId
        : currentItem?.id || selectedIndex + 1;
    const it =
      items.find((x) => String(x.id) === String(targetId)) ||
      currentItem ||
      items[selectedIndex];
    if (!it) return;

    const kw = itemKeywords[targetId] || extractDefaultKeyword(it);
    const erpKw =
      it?.ma_vt &&
      it.ma_vt.trim() !== "" &&
      !it.ma_vt.toLowerCase().includes("chưa")
        ? it.ma_vt
        : kw;

    // --- DATA GUARD (CACHE / CSDL RE-USE) ---
    // Nếu không yêu cầu forceRefresh, kiểm tra xem vật tư này đã có CSDL lưu trữ chưa
    if (!forceRefresh) {
      try {
        const resEvCheck = await fetch(
          `/api/evidence/get?item_id=${targetId}&_t=${Date.now()}`
        );
        if (resEvCheck.ok) {
          const evData = await resEvCheck.json();
          const ev = evData.evidence || {};
          const hasExistingEvidence =
            evData.success &&
            ev &&
            (ev.quotes || ev.erp || ev.imis || ev.muasamcong || ev.ecom || ev.synthesis);

          if (hasExistingEvidence) {
            console.log(
              `[DataGuard - View 3] Item ${targetId} đã có CSDL chứng cứ, nạp trực tiếp trong 0ms.`,
            );
            const completedAuditData = {
              item_id: targetId,
              keyword_used: kw,
              result: {
                don_gia_trinh: it.don_gia_trinh,
                don_gia_thong_nhat: it.don_gia_thong_nhat || it.don_gia_trinh,
                thanh_tien_thong_nhat: it.thanh_tien_thong_nhat,
                gia_tri_giam: it.gia_tri_giam || 0,
              },
              synthesis: ev.synthesis || {},
              steps: buildCompletedAuditSteps(ev, it),
              is_from_cache: true,
            };

            if (openModal) {
              setAuditModal({
                isOpen: true,
                item: it,
                keyword: kw,
                erpKeyword: erpKw,
                status: "completed",
                activeStep: 6,
                auditData: completedAuditData,
                isFromCache: true,
              });
            }
            return; // Dừng ngay, không quét lại mạng
          }
        }
      } catch (checkErr) {
        console.warn(
          "[DataGuard - View 3] Lỗi kiểm tra CSDL chứng cứ, tiếp tục quét:",
          checkErr,
        );
      }
    }

    setIsSearching5Pillars(true);
    if (openModal && it) {
      setAuditModal({
        isOpen: true,
        item: it,
        keyword: kw,
        erpKeyword: erpKw,
        status: "running",
        activeStep: 1, // Bắt đầu ở bước 1: Báo giá
        auditData: null,
        isFromCache: false,
      });
    }

    // In-Memory Evidence Accumulator: Gom dữ liệu trực tiếp trong phiên quét
    const liveEv = {};

    try {
      // BƯỚC 1: Khối 1 - Báo giá gốc (PDF)
      setAuditModal((prev) => ({ ...prev, activeStep: 1 }));
      const resQuotes = await fetch(`/api/quotes/match-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: targetId, item: it, keyword: kw }),
      });
      const quotesData = await resQuotes.json();
      liveEv.quotes = quotesData;
      await fetch(`/api/items/${targetId}/evidence/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quotesData),
      });

      // BƯỚC 2: Khối 2 - ERP Vĩnh Tân 4 (Dùng erpKw và lưu chứng cứ)
      setAuditModal((prev) => ({ ...prev, activeStep: 2 }));
      const resErp = await fetch(`/api/erp/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: erpKw,
          item: it,
          dg_trinh: it.don_gia_trinh,
        }),
      });
      const erpData = await resErp.json();
      liveEv.erp = erpData;
      await fetch(`/api/items/${targetId}/evidence/erp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(erpData),
      });

      // BƯỚC 3: Khối 3 - EVN IMIS (Khâu gọi API mạng ngoài và lưu chứng cứ)
      setAuditModal((prev) => ({ ...prev, activeStep: 3 }));
      const resImis = await fetch(`/api/imis/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: kw,
          item: it,
          dg_trinh: it.don_gia_trinh,
        }),
      });
      const imisData = await resImis.json();
      liveEv.imis = imisData;
      await fetch(`/api/items/${targetId}/evidence/imis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(imisData),
      });

      // BƯỚC 4: Khối 4 - Mua sắm công e-GP
      setAuditModal((prev) => ({ ...prev, activeStep: 4 }));
      const resMsc = await fetch(`/api/msc/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, item: it, save_evidence: true }),
      });
      const mscData = await resMsc.json();
      liveEv.muasamcong = mscData;

      // BƯỚC 5 & 6: Khối 5 (TMĐT) & Tổng hợp AI / Chốt giá
      setAuditModal((prev) => ({ ...prev, activeStep: 5 }));
      const resSyn = await fetch(`/api/items/${targetId}/run-ai-synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const synData = await resSyn.json();
      liveEv.synthesis = synData?.synthesis || synData;

      // SAU KHI HOÀN TẤT CÁC BƯỚC: Gọi API lấy toàn bộ evidence đã lưu để dựng lại audit_trail đầy đủ
      const resEv = await fetch(`/api/evidence/get?item_id=${targetId}&_t=${Date.now()}`);
      const evData = await resEv.json();

      if (evData.success || Object.keys(liveEv).length > 0) {
        await fetchGridData();
        if (typeof loadAllEvidenceStatus === "function")
          await loadAllEvidenceStatus();

        // Xây dựng object auditData hoàn chỉnh từ kho dữ liệu thật hòa trộn với liveEv
        const backendEv = (evData && evData.evidence) || {};
        const ev = { ...liveEv, ...backendEv };
        Object.keys(liveEv).forEach((k) => {
          if (!ev[k] || (typeof ev[k] === "object" && Object.keys(ev[k]).length === 0)) {
            ev[k] = liveEv[k];
          }
        });

        const completedAuditData = {
          item_id: targetId,
          keyword_used: kw,
          result: {
            don_gia_trinh: it.don_gia_trinh,
            don_gia_thong_nhat: it.don_gia_thong_nhat || it.don_gia_trinh,
            thanh_tien_thong_nhat: it.thanh_tien_thong_nhat,
            gia_tri_giam: it.gia_tri_giam || 0,
          },
          synthesis: ev.synthesis || {},
          steps: buildCompletedAuditSteps(ev, it),
          is_from_cache: false,
        };

        if (openModal) {
          setAuditModal((prev) => ({
            ...prev,
            status: "completed",
            activeStep: 6,
            auditData: completedAuditData,
            item: it,
            isFromCache: false,
          }));
        }
      } else {
        if (openModal) {
          setAuditModal((prev) => ({ ...prev, status: "error" }));
        }
      }
    } catch (e) {
      console.error("Lỗi tiến trình từng bước:", e);
      if (openModal) {
        setAuditModal((prev) => ({ ...prev, status: "error" }));
      }
    } finally {
      setIsSearching5Pillars(false);
    }
  };

  useEffect(() => {
    loadAllEvidenceStatus();
  }, [loadAllEvidenceStatus]);

  const currentItem = items[selectedIndex] || items[0] || {};

  // Auto-restore saved evidence for all pillars when item changes
  useEffect(() => {
    if (!currentItem?.id) return;
    const itemId = currentItem.id;
    if (!itemId || itemId <= 0) return;

    setQuoteEvidence(null);
    setErpResults(null);
    setImisResults(null);
    setMscResults(null);
    setEcomResults(null);
    setSynthesisResults(null);

    const pillars = [
      "quotes",
      "erp",
      "imis",
      "muasamcong",
      "ecom",
      "synthesis",
    ];
    pillars.forEach((p) => {
      fetch(`/api/items/${itemId}/evidence/${p}`)
        .then((r) => {
          if (!r.ok) return null;
          return r.json();
        })
        .then((d) => {
          if (!d || (!d.data && !d.payload && !d.success)) return;
          const payload = d.data || d.payload || {};
          if (!payload || Object.keys(payload).length === 0) return;
          if (p === "quotes") setQuoteEvidence(payload);
          if (p === "erp") setErpResults(payload);
          if (p === "imis") setImisResults(payload);
          if (p === "muasamcong") setMscResults(payload);
          if (p === "ecom") setEcomResults(payload);
          if (p === "synthesis") setSynthesisResults(payload);
        })
        .catch(() => {});
    });
  }, [selectedIndex, currentItem?.id]);

  // Pillar 1: Load quotes
  const loadQuotes = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading((l) => ({ ...l, quotes: true }));
    try {
      const res = await fetch(
        `/api/quotes/by-item?item_id=${currentItem.id || selectedIndex + 1}`,
      );
      const data = await res.json();
      setQuoteEvidence(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading((l) => ({ ...l, quotes: false }));
    }
  }, [currentItem, selectedIndex]);

  // Pillar 2: Load ERP
  const loadErp = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading((l) => ({ ...l, erp: true }));
    try {
      const res = await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: currentItem.ma_vt || currentItem.ten_vt,
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0,
        }),
      });
      const data = await res.json();
      setErpResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading((l) => ({ ...l, erp: false }));
    }
  }, [currentItem]);

  // Pillar 3: Load IMIS
  const loadImis = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading((l) => ({ ...l, imis: true }));
    try {
      const cleanKw =
        getDefaultImisKeyword(currentItem.ten_vt) ||
        extractCleanImisKeyword(currentItem.ten_vt) ||
        currentItem.ten_vt;
      const res = await fetch("/api/imis/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: cleanKw,
          item: currentItem,
          tu_ngay: "2023-01-01",
          den_ngay: new Date().toISOString().split("T")[0],
          dg_trinh: currentItem.don_gia_trinh || 0,
        }),
      });
      const data = await res.json();
      setImisResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading((l) => ({ ...l, imis: false }));
    }
  }, [currentItem]);

  // Pillar 4: Load MSC
  const loadMsc = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading((l) => ({ ...l, msc: true }));
    try {
      const defaultKw =
        getDefaultImisKeyword(currentItem.ten_vt) ||
        extractCleanImisKeyword(currentItem.ten_vt) ||
        currentItem.ten_vt;
      const res = await fetch("/api/muasamcong/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: defaultKw,
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0,
        }),
      });
      const data = await res.json();
      setMscResults(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading((l) => ({ ...l, msc: false }));
    }
  }, [currentItem]);

  // Trigger search when pillar tab is opened if no data
  useEffect(() => {
    if (!currentItem?.ten_vt) return;
    if (activePillar === "quotes" && !quoteEvidence) loadQuotes();
    if (activePillar === "erp" && !erpResults) loadErp();
    if (activePillar === "imis" && !imisResults) loadImis();
    if (activePillar === "msc" && !mscResults) loadMsc();
  }, [activePillar, currentItem?.id, selectedIndex]);
  // Thêm đoạn này bên trong component ItemInspectorView
  const handleSaveCurrentPillar = () => {
    if (activePillar === "quotes") {
      saveStep(
        "quotes",
        { min_quote: minQuote, matches: supplierMatches },
        "erp",
      ); // Tự động sang ERP
    } else if (activePillar === "erp") {
      saveStep("erp", erpResults || {}, "imis"); // Tự động sang IMIS
    } else if (activePillar === "imis") {
      saveStep("imis", imisResults || {}, "msc"); // Tự động sang MSC (Mua sắm công)
    } else if (activePillar === "msc") {
      saveStep("muasamcong", mscResults || {}, "ecom"); // Tự động sang Ecom
    } else if (activePillar === "ecom") {
      saveStep("ecom", ecomResults || {}, "synthesis"); // Tự động sang Tổng hợp (Synthesis)
    } else if (activePillar === "synthesis") {
      saveStep("synthesis", synthesisResults || {}, null); // Khối cuối cùng
    }
  };
  const updateLocalEvidenceState = useCallback((stepKey, payload) => {
    if (stepKey === "quotes") setQuoteEvidence(payload);
    else if (stepKey === "erp") setErpResults(payload);
    else if (stepKey === "imis") setImisResults(payload);
    else if (stepKey === "muasamcong") setMscResults(payload);
    else if (stepKey === "ecom") setEcomResults(payload);
    else if (stepKey === "synthesis") setSynthesisResults(payload);
  }, []);

  // Save evidence for a step
  const saveStep = async (stepKey, payload, nextPillar = null) => {
    updateLocalEvidenceState(stepKey, payload);
    const itemId = currentItem.id || selectedIndex + 1;
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${itemId}/evidence/${stepKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const ret = await res.json();
      if (ret.success || ret.ok) {
        toast?.success?.(
          `Đã lưu chứng cứ ${stepKey.toUpperCase()} cho mục ${selectedIndex + 1}!`,
        );
        if (ret.synthesis) {
          setSynthesisResults(ret.synthesis);
          updateLocalEvidenceState("synthesis", ret.synthesis);
          setItems((prev) =>
            prev.map((it, idx) => {
              if (it.id === itemId || idx === selectedIndex) {
                return {
                  ...it,
                  don_gia_thong_nhat: ret.synthesis.approved_price,
                  thanh_tien_thong_nhat:
                    ret.synthesis.approved_price *
                    (parseFloat(it.so_luong) || 1),
                  co_so_thong_nhat:
                    ret.synthesis.co_so_thong_nhat || it.co_so_thong_nhat,
                  danh_gia_ttd: ret.synthesis.summary_text || it.danh_gia_ttd,
                };
              }
              return it;
            }),
          );
        }
        await loadAllEvidenceStatus();
        // === NÂNG TRẢI NGHIỆM: Nếu đang ở bước 6 (synthesis), tự động nhảy sang mục chưa lưu tiếp theo ===
        if (stepKey === "synthesis") {
          const nextUnsavedIdx = findNextUnsavedIndex(selectedIndex);
          if (nextUnsavedIdx !== selectedIndex) {
            onNavigateIndex(nextUnsavedIdx);
            toast?.info?.(
              `Đã chuyển sang mục chưa lưu tiếp theo (Mục #${nextUnsavedIdx + 1})`,
            );
          } else {
            toast?.info?.(
              "Tất cả các mục trong danh sách đã được lưu hoàn tất!",
            );
          }
        } else if (nextPillar) {
          setActivePillar(nextPillar);
        }
      } else {
        toast?.error?.(`Lỗi lưu: ${ret.error || "Không xác định"}`);
      }
    } catch (e) {
      toast?.error?.(`Lỗi kết nối: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const autoSaveStep = useCallback(
    async (stepKey, payload) => {
      updateLocalEvidenceState(stepKey, payload);
      const itemId = currentItem.id || selectedIndex + 1;
      try {
        const res = await fetch(`/api/items/${itemId}/evidence/${stepKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const ret = await res.json();
        if (ret?.synthesis) {
          setSynthesisResults(ret.synthesis);
          updateLocalEvidenceState("synthesis", ret.synthesis);
          setItems((prev) =>
            prev.map((it, idx) => {
              if (it.id === itemId || idx === selectedIndex) {
                return {
                  ...it,
                  don_gia_thong_nhat: ret.synthesis.approved_price,
                  thanh_tien_thong_nhat:
                    ret.synthesis.approved_price *
                    (parseFloat(it.so_luong) || 1),
                  co_so_thong_nhat:
                    ret.synthesis.co_so_thong_nhat || it.co_so_thong_nhat,
                  danh_gia_ttd: ret.synthesis.summary_text || it.danh_gia_ttd,
                };
              }
              return it;
            }),
          );
        }
        loadAllEvidenceStatus();
      } catch (e) {
        console.warn(`[AutoSave] Không thể lưu ngầm ${stepKey}:`, e);
      }
    },
    [
      currentItem.id,
      selectedIndex,
      loadAllEvidenceStatus,
      updateLocalEvidenceState,
    ],
  );

  const switchPillar = (pk) => {
    setActivePillar(pk);
    const ev =
      evidenceStatus[String(currentItem?.id || selectedIndex + 1)] || {};
    const isSaved =
      pk === "quotes"
        ? ev.has_quotes
        : pk === "erp"
          ? ev.has_erp
          : pk === "imis"
            ? ev.has_imis
            : pk === "msc"
              ? ev.has_msc
              : pk === "ecom"
                ? ev.has_ecom
                : ev.has_syn;
    if (!isSaved) {
      if (pk === "quotes" && !quoteEvidence) loadQuotes();
      if (pk === "erp" && !erpResults) loadErp();
      if (pk === "imis" && !imisResults) loadImis();
      if (pk === "msc" && !mscResults) loadMsc();
    }
  };

  // Keyboard navigation: Shift+A = Prev, Shift+D = Next
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        if (selectedIndex > 0) onNavigateIndex(selectedIndex - 1);
      } else if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (selectedIndex < items.length - 1)
          onNavigateIndex(selectedIndex + 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, items.length, onNavigateIndex]);

  // Derived info
  const dgTrinh = currentItem.don_gia_trinh || currentItem.dg_trinh || 0;
  const evSt =
    evidenceStatus[String(currentItem.id || selectedIndex + 1)] || {};

  const minQuote =
    quoteEvidence?.min_quote || quoteEvidence?.matches?.[0] || null;
  const supplierMatches = quoteEvidence?.matches || [];

  const filteredItems = items.filter((it, idx) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return (
      it.ten_vt?.toLowerCase().includes(q) ||
      it.ma_vt?.toLowerCase().includes(q) ||
      String(idx + 1).includes(q)
    );
  });

  const handleExportPdf = () => {
    const itemId = currentItem.id || selectedIndex + 1;
    window.open(`/api/items/${itemId}/export-pdf`, "_blank");
  };
  // Hàm tìm index của mục chưa lưu tiếp theo kể từ vị trí hiện tại
  const findNextUnsavedIndex = (currentIndex) => {
    // 1. Kiểm tra từ vị trí hiện tại đến cuối danh sách
    for (let i = currentIndex + 1; i < items.length; i++) {
      const it = items[i];
      const ev = evidenceStatus[String(it.id || i + 1)] || {};
      const isSaved = Boolean(
        ev?.has_syn || (it.danh_gia_ttd && it.danh_gia_ttd.trim().length > 0),
      );
      if (!isSaved) return i;
    }
    // 2. Nếu từ hiện tại đến cuối không có, vòng lại từ đầu danh sách
    for (let i = 0; i <= currentIndex; i++) {
      const it = items[i];
      const ev = evidenceStatus[String(it.id || i + 1)] || {};
      const isSaved = Boolean(
        ev?.has_syn || (it.danh_gia_ttd && it.danh_gia_ttd.trim().length > 0),
      );
      if (!isSaved) return i;
    }
    return currentIndex; // Nếu tất cả đã lưu hết thì giữ nguyên
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white h-full">
      {/* Navigator Bar */}
      {/* Navigator Bar tích hợp sẵn nút Lưu */}
      <InspectorNavbar
        selectedIndex={selectedIndex}
        totalItems={items.length}
        currentItem={currentItem}
        onNavigateIndex={onNavigateIndex}
        onExportPdf={handleExportPdf}
        onSave={handleSaveCurrentPillar}
        saving={saving}
        handleRun5Pillars={handleRun5Pillars}
        isSearching5Pillars={isSearching5Pillars}
      />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <InspectorSidebar
          items={items}
          filteredItems={filteredItems}
          selectedIndex={selectedIndex}
          sidebarSearch={sidebarSearch}
          setSidebarSearch={setSidebarSearch}
          evidenceStatus={evidenceStatus}
          onNavigateIndex={onNavigateIndex}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-100 gap-3">
          {/* Overview Card */}
          <InspectorOverviewCard
            currentItem={currentItem}
            dgTrinh={dgTrinh}
            selectedIndex={selectedIndex} // Truyền thêm chỉ mục để hiển thị STT chính xác
          />

          {/* Pillar Tabs */}
          <InspectorPillarTabs
            activePillar={activePillar}
            onSwitchPillar={switchPillar}
            evSt={evSt}
          />

          {/* Pillar Content */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
            <ErrorBoundary
              key={`${activePillar}_${currentItem?.id || selectedIndex}`}
              title={`Lỗi hiển thị Khối ${PILLARS[activePillar]?.title || activePillar}`}
            >
              {activePillar === "quotes" && (
                <PillarQuotes
                  loading={loading.quotes}
                  saving={saving}
                  minQuote={minQuote}
                  supplierMatches={supplierMatches}
                  dgTrinh={dgTrinh}
                  onOpenPdfPage={onOpenPdfPage}
                  onSave={() =>
                    saveStep(
                      "quotes",
                      { min_quote: minQuote, matches: supplierMatches },
                      "erp",
                    )
                  }
                  saved={evSt.has_quotes}
                />
              )}

              {activePillar === "erp" && (
                <PillarErp
                  loading={loading.erp}
                  saving={saving}
                  data={erpResults}
                  dgTrinh={dgTrinh}
                  item={currentItem}
                  onSave={(payload) => saveStep("erp", payload, "imis")}
                  onAutoSave={(payload) => autoSaveStep("erp", payload)}
                  saved={evSt.has_erp}
                  onOpenErpConfig={onOpenErpConfig}
                />
              )}

              {activePillar === "imis" && (
                <PillarImis
                  loading={loading.imis}
                  saving={saving}
                  data={imisResults}
                  dgTrinh={dgTrinh}
                  item={currentItem}
                  onSave={(payload) => saveStep("imis", payload, "msc")}
                  onAutoSave={(payload) => autoSaveStep("imis", payload)}
                  saved={evSt.has_imis}
                  onOpenImisConfig={onOpenImisConfig}
                  imisStatus={imisStatus}
                />
              )}

              {activePillar === "msc" && (
                <PillarMsc
                  loading={loading.msc}
                  saving={saving}
                  data={mscResults}
                  dgTrinh={dgTrinh}
                  item={currentItem}
                  onSave={(payload) => saveStep("muasamcong", payload, "ecom")}
                  onAutoSave={(payload) => autoSaveStep("muasamcong", payload)}
                  saved={evSt.has_msc}
                  onOpenMscConfig={onOpenMscConfig}
                  mscStatus={mscStatus}
                />
              )}

              {activePillar === "ecom" && (
                <PillarEcom
                  loading={loading.ecom}
                  saving={saving}
                  data={ecomResults}
                  dgTrinh={dgTrinh}
                  item={currentItem}
                  onSave={(payload, goNext = true) =>
                    saveStep("ecom", payload, goNext ? "synthesis" : null)
                  }
                  saved={evSt.has_ecom}
                  onAutoSave={(payload) => autoSaveStep("ecom", payload)}
                />
              )}

              {activePillar === "synthesis" && (
                <PillarSynthesis
                  loading={false}
                  saving={saving}
                  data={synthesisResults}
                  dgTrinh={dgTrinh}
                  item={currentItem}
                  quoteEvidence={quoteEvidence}
                  erpResults={erpResults}
                  imisResults={imisResults}
                  mscResults={mscResults}
                  ecomResults={ecomResults}
                  evidenceStatus={evSt}
                  onSave={(payload) => saveStep("synthesis", payload, null)}
                  saved={evSt.has_syn}
                />
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>
      {/* Modal Minh Bạch Hóa Tiến Trình & Báo Cáo 5 Cơ Sở */}
      <AuditProgressModal
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal((prev) => ({ ...prev, isOpen: false }))}
        item={auditModal.item}
        keyword={auditModal.keyword}
        erpKeyword={auditModal.erpKeyword || currentItem?.ma_vt}
        status={auditModal.status}
        activeStep={auditModal.activeStep}
        auditData={auditModal.auditData}
        onExportPdf={handleExportPdf}
        isFromCache={Boolean(auditModal.isFromCache || auditModal.auditData?.is_from_cache)}
        onForceRescan={(reItemId) => {
          const targetId = reItemId || auditModal.item?.id || currentItem?.id;
          if (targetId) handleRun5Pillars(targetId, true, true);
        }}
        onOpenInspector={(idx, pillar) => {
          onNavigateIndex(idx);
          if (pillar) setActivePillar(pillar);
        }}
        onItemUpdated={(updatedItem) => {
          if (!updatedItem) return;
          setItems((prev) =>
            prev.map((it) =>
              it.id === updatedItem.id ? { ...it, ...updatedItem } : it,
            ),
          );
        }}
      />
    </div>
  );
}
