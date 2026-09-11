import React, { useState } from "react";
import {
  FileCheck2,
  Building2,
  Network,
  Globe,
  ShoppingBag,
  Brain,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  FileDown,
  ExternalLink,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Key,
  Table2,
  Zap,
} from "lucide-react";

function AuditProgressModalContent({
  isOpen,
  onClose,
  item,
  keyword,
  erpKeyword, // <-- Thêm prop này vào đây
  status = "running", // 'running' | 'completed' | 'error'
  activeStep = 1,
  auditData,
  onExportPdf,
  onOpenInspector,
  onItemUpdated,
}) {
  const [showFullSummary, setShowFullSummary] = useState(false);
  const [runningAi, setRunningAi] = useState(false);
  const [customAiData, setCustomAiData] = useState(null);

  const result = auditData?.result || {};
  const steps = auditData?.steps || [];
  const dgTrinh =
    auditData?.don_gia_trinh ||
    result.don_gia_trinh ||
    item?.don_gia_trinh ||
    0;
  const dgTn =
    auditData?.don_gia_thong_nhat ||
    result.don_gia_thong_nhat ||
    item?.don_gia_thong_nhat ||
    dgTrinh;

  const [editableSteps, setEditableSteps] = useState(steps);
  const [activeApprovedPrice, setActiveApprovedPrice] = useState(dgTn);
  const [activeWinningPillar, setActiveWinningPillar] = useState(
    item?.co_so_thong_nhat || "",
  );
  const [togglingIdx, setTogglingIdx] = useState(null);
  const itemIdRef = item?.id || auditData?.item_id;
  React.useEffect(() => {
    const initSteps = (steps || []).map((s) => ({
      ...s,
      _orig_price: s._orig_price !== undefined ? s._orig_price : s.price || 0,
      _orig_detail: s._orig_detail || s.detail || "",
    }));
    setEditableSteps(initSteps);
    setActiveApprovedPrice(dgTn);
    setActiveWinningPillar(item?.co_so_thong_nhat || "");
  }, [itemIdRef, dgTn]);

  const handleTogglePillar = async (idx, exclude) => {
    const itemId = item?.id || auditData?.item_id;
    if (!itemId) return;
    setTogglingIdx(idx);

    const stepKeys = ["quotes", "erp", "imis", "muasamcong", "ecom"];
    const currentList = editableSteps.length > 0 ? editableSteps : steps;
    const targetStep = currentList[idx];
    const stepKey =
      (targetStep?.key === "msc" ? "muasamcong" : targetStep?.key) ||
      stepKeys[idx] ||
      "erp";

    // 1. Cập nhật mảng steps cục bộ ngay lập tức
    const newSteps = currentList.map((st, i) => {
      if (i !== idx) return st;
      const origP =
        st._orig_price !== undefined && st._orig_price > 0
          ? st._orig_price
          : st.price || 0;
      return {
        ...st,
        is_deselected: exclude,
        _orig_price: origP,
        price: exclude ? 0 : origP,
        detail: exclude
          ? "Thẩm định viên loại trừ trực tiếp tại Bảng đối chiếu do không tương thích quy cách."
          : st._orig_detail || st.detail,
      };
    });
    setEditableSteps(newSteps);

    // 2. Tính toán lại đơn giá chốt từ các cơ sở còn hiệu lực
    const activePrices = [];
    newSteps.slice(0, 5).forEach((st) => {
      if (!st.is_deselected && st.price && st.price > 0) {
        activePrices.push({ name: st.name, price: st.price });
      }
    });

    let newApprovedPrice = dgTrinh;
    let newWinningPillar = "Cơ sở 1: Báo Giá Gốc";
    if (activePrices.length > 0) {
      activePrices.sort((a, b) => a.price - b.price);
      newApprovedPrice = activePrices[0].price;
      newWinningPillar = activePrices[0].name;
    }

    setActiveApprovedPrice(newApprovedPrice);
    setActiveWinningPillar(newWinningPillar);
    if (customAiData) {
      setCustomAiData((prev) => ({
        ...prev,
        approved_price: newApprovedPrice,
        winning_pillar: newWinningPillar,
        summary_text: `Tổ Thẩm định đã rà soát 5 cơ sở chứng cứ (trong đó đã ${exclude ? "loại trừ" : "khôi phục"} ${targetStep?.name} do thẩm định viên đánh giá tính tương thích). Đơn giá thẩm định thống nhất đề xuất là ${Math.round(newApprovedPrice).toLocaleString("vi-VN")} đ theo ${newWinningPillar}.`,
      }));
    }

    const qty = parseFloat(item?.so_luong || 1);
    const newThanhTien = newApprovedPrice * qty;
    const newGiaTriGiam = (dgTrinh - newApprovedPrice) * qty;

    // 3. Gọi API cập nhật file chứng cứ của cơ sở này ngầm
    try {
      const stepPayload = {
        is_deselected: exclude,
        status: exclude ? `${stepKey.toUpperCase()}_DESELECTED` : "MATCH",
        summary: {
          is_deselected: exclude,
          status: exclude ? `${stepKey.toUpperCase()}_DESELECTED` : "MATCH",
          summary_text: exclude
            ? "Thẩm định viên loại trừ trực tiếp tại Bảng đối chiếu do không tương thích kỹ thuật."
            : "",
        },
        summary_text: exclude
          ? "Thẩm định viên loại trừ trực tiếp tại Bảng đối chiếu do không tương thích kỹ thuật."
          : "",
      };

      await fetch(`/api/items/${itemId}/evidence/${stepKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepPayload),
      });

      // 4. Đồng bộ bước synthesis và hồ sơ
      const synthPayload = {
        approved_price: newApprovedPrice,
        co_so_thong_nhat: newWinningPillar,
        total_savings: newGiaTriGiam,
        summary_text: `Tổ Thẩm định đã rà soát 5 cơ sở chứng cứ (trong đó đã ${exclude ? "loại trừ" : "khôi phục"} ${targetStep?.name} do thẩm định viên đánh giá tính tương thích). Đơn giá thẩm định thống nhất đề xuất là ${Math.round(newApprovedPrice).toLocaleString("vi-VN")} đ theo ${newWinningPillar}.`,
      };

      await fetch(`/api/items/${itemId}/evidence/synthesis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(synthPayload),
      });

      // 5. Cập nhật ngược lại View 1 nếu có callback
      if (onItemUpdated) {
        onItemUpdated({
          id: itemId,
          don_gia_thong_nhat: newApprovedPrice,
          thanh_tien_thong_nhat: newThanhTien,
          gia_tri_giam: newGiaTriGiam,
          co_so_thong_nhat: newWinningPillar,
          danh_gia_ttd: synthPayload.summary_text,
        });
      }
    } catch (e) {
      console.error("Lỗi cập nhật loại trừ cơ sở:", e);
    } finally {
      setTogglingIdx(null);
    }
  };

  const handleTriggerAi = async () => {
    const itemId = item?.id || auditData?.item_id;
    if (!itemId) return;
    setRunningAi(true);
    try {
      const res = await fetch(`/api/items/${itemId}/run-ai-synthesis`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.synthesis) {
        setCustomAiData(data.synthesis);
      }
    } catch (e) {
      console.error("Lỗi gọi AI synthesis:", e);
    } finally {
      setRunningAi(false);
    }
  };

  if (!isOpen) return null;

  const fmt = (val) =>
    !val && val !== 0 ? "0 đ" : `${Math.round(val).toLocaleString("vi-VN")} đ`;

  const STEPS_CONFIG = [
    {
      id: 1,
      key: "quotes",
      name: "1. Báo Giá Gốc (PDF)",
      icon: FileCheck2,
      desc: "Lọc đơn giá chào thấp nhất, chống nhầm họ hàng hóa",
    },
    {
      id: 2,
      key: "erp",
      name: "2. ERP Vĩnh Tân 4",
      icon: Building2,
      desc: "Tra cứu CSDL kế toán nội bộ nhà máy (ERP.xlsx)",
    },
    {
      id: 3,
      key: "imis",
      name: "3. EVN IMIS Toành Ngành",
      icon: Network,
      desc: "Truy vấn Live API Hợp đồng các nhà máy điện EVN",
    },
    {
      id: 4,
      key: "msc",
      name: "4. Mua Sắm Công e-GP",
      icon: Globe,
      desc: "Đối chiếu kết quả trúng thầu qua mạng toàn quốc",
    },
    {
      id: 5,
      key: "ecom",
      name: "5. TMĐT & Tham Khảo Web",
      icon: ShoppingBag,
      desc: "Tham chiếu giá thị trường niêm yết",
    },
    {
      id: 6,
      key: "synthesis",
      name: "6. AI Thuyết Minh & Chốt Giá",
      icon: Brain,
      desc: "Tổng hợp 5 cơ sở & sinh bản thuyết minh (Tùy chọn)",
      isOptional: true,
    },
  ];

  const currentPrice =
    customAiData?.approved_price !== undefined
      ? customAiData.approved_price
      : activeApprovedPrice;
  const currentWinning = customAiData?.winning_pillar || activeWinningPillar;
  const giaTriGiam = (dgTrinh - currentPrice) * (item?.so_luong || 1);
  const pctGiam = dgTrinh > 0 ? ((dgTrinh - currentPrice) / dgTrinh) * 100 : 0;
  const danhGiaTtd =
    auditData?.synthesis?.summary_text ||
    auditData?.danh_gia_ttd ||
    result.danh_gia_ttd ||
    item?.danh_gia_ttd ||
    "";
  const ttThongNhat = currentPrice * (item?.so_luong || 1);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Thay max-w-2xl thành max-w-5xl để mở rộng không gian hiển thị chứng cứ */}
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#003366] via-blue-900 to-teal-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-400/20 border border-teal-300/30 flex items-center justify-center">
              {status === "running" ? (
                <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
              ) : status === "completed" ? (
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
                {status === "running" && "⚡ Đang Tra Cứu Đa Tầng 5 Cơ Sở..."}
                {status === "completed" &&
                  "Báo Cáo Minh Bạch Thẩm Định 5 Cơ Sở"}
                {status === "error" && "Lỗi Xử Lý Thẩm Định"}
              </h3>
              <p className="text-[10px] text-teal-200 font-mono mt-0.5">
                Mục #{item?.id || 1}:{" "}
                {(item?.ten_vt_goc || item?.ten_vt || "").slice(0, 45)}...
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Target Item Information Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tên Vật Tư Trình:
                </span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {item?.ten_vt_goc || item?.ten_vt}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Đơn Giá Trình:
                </span>
                <p className="font-bold font-mono text-[#003366] text-sm">
                  {fmt(item?.don_gia_trinh)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] pt-2 border-t border-slate-200 text-slate-600">
              <span className="flex items-center gap-1">
                <strong className="text-slate-700">Mã ERP:</strong>{" "}
                <span className="font-mono">{item?.ma_vt || "Chưa có mã"}</span>
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-700">Số lượng:</strong>{" "}
                <span className="font-mono">
                  {item?.so_luong || 1} {item?.dvt || "Cái"}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                <Key className="w-3 h-3 text-teal-600" />
                <span>Từ khóa tra:</span>
                <span className="font-mono underline">
                  {auditData?.keyword_used || keyword || "Chưa có"}
                </span>
              </span>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TRẠNG THÁI 1: LIVE STEPPER (ĐANG CHẠY) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {status === "running" && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                Tiến Trình Tra Cứu Thời Gian Thực
              </h4>

              <div className="space-y-2.5">
                {STEPS_CONFIG.map((st) => {
                  const Icon = st.icon;
                  const isOptional = Boolean(st.isOptional);
                  const isDone = st.id < activeStep;
                  const isCurrent = !isOptional && st.id === activeStep;
                  const isPending = isOptional || st.id > activeStep;

                  return (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-lg border transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-blue-50/80 border-blue-400 shadow-2xs ring-1 ring-blue-300"
                          : isDone
                            ? "bg-emerald-50/50 border-emerald-300 text-slate-800"
                            : isOptional
                              ? "bg-purple-50/40 border-purple-200 text-slate-700"
                              : "bg-slate-50 border-slate-200 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? "bg-blue-600 text-white animate-pulse"
                              : isDone
                                ? "bg-emerald-600 text-white"
                                : isOptional
                                  ? "bg-purple-600 text-white"
                                  : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p
                            className={`font-bold text-xs ${isCurrent ? "text-blue-950" : isOptional ? "text-purple-950" : "text-slate-900"}`}
                          >
                            {st.name}
                          </p>
                          <p className="text-[10.5px] text-slate-500">
                            {st.desc}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />{" "}
                            Xong
                          </span>
                        )}
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                            Đang tra cứu...
                          </span>
                        )}
                        {isOptional ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                            Tùy chọn
                          </span>
                        ) : isPending ? (
                          <span className="text-[10px] font-semibold text-slate-400">
                            Chờ
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TRẠNG THÁI 2: KẾT QUẢ MINH BẠCH (HOÀN TẤT) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {status === "completed" && (
            <>
              {/* Bảng Đối Chiếu 5 Nguồn Dữ Liệu */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-teal-700" />
                    Bảng Đối Chiếu Minh Bạch 5 Cơ Sở
                  </span>
                  <span className="text-[10.5px] font-semibold text-slate-500">
                    Độ phủ chứng cứ:{" "}
                    <strong className="text-emerald-700">
                      {auditData?.synthesis?.coverage_score || 85}/100
                    </strong>
                  </span>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 border-r w-44">
                        Nguồn Chứng Cứ
                      </th>
                      <th className="py-2.5 px-3 border-r">
                        Vật Tư & Bản Chất Kỹ Thuật Đối Chiếu
                      </th>
                      <th className="py-2.5 px-3 text-right w-36 font-mono">
                        Đơn Giá Tham Chiếu
                      </th>
                      <th className="py-2.5 px-2 text-center w-24">
                        Trạng Thái
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(editableSteps.length > 0 ? editableSteps : steps)
                      .slice(0, 5)
                      .map((st, idx) => {
                        const isDeselected = Boolean(st.is_deselected);
                        const hasPrice =
                          !isDeselected && st.price && st.price > 0;
                        return (
                          <tr
                            key={idx}
                            className={`transition ${isDeselected ? "bg-amber-50/20 hover:bg-amber-50/40" : "hover:bg-slate-50/70"}`}
                          >
                            <td className="py-2.5 px-3 border-r font-bold text-slate-900 align-top">
                              <div className="flex items-center gap-1.5">
                                <span>{st.name}</span>
                              </div>
                              {st.score && st.score > 0 ? (
                                <div className="mt-1">
                                  <span className="inline-block text-[9.5px] font-extrabold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                    Tương đồng: {st.score}%
                                  </span>
                                </div>
                              ) : null}
                            </td>
                            <td
                              className={`py-2.5 px-3 border-r text-[11.5px] align-top ${isDeselected ? "text-slate-500" : "text-slate-700"}`}
                            >
                              {/* [BƯỚC 2.2] THÊM KHỐI MINH BẠCH TỪ KHÓA TRA CỨU & KẾT QUẢ CHO TỪNG CƠ SỞ */}
                              <div className="mb-2 flex items-center justify-between gap-2 bg-purple-50/80 border border-purple-200/80 px-2.5 py-1 rounded-md text-[10.5px] font-mono">
                                <div className="flex items-center gap-1.5 text-purple-950 truncate">
                                  <Key className="w-3 h-3 text-purple-700 shrink-0" />
                                  <span>Từ khóa tra:</span>
                                  <strong
                                    className="underline font-bold text-purple-900 truncate"
                                    title={
                                      idx === 1 || st.name?.includes("ERP")
                                        ? erpKeyword || item?.ma_vt
                                        : st.keyword_used ||
                                          keyword ||
                                          auditData?.keyword_used ||
                                          "N/A"
                                    }
                                  >
                                    {idx === 1 || st.name?.includes("ERP")
                                      ? erpKeyword || item?.ma_vt
                                      : st.keyword_used ||
                                        keyword ||
                                        auditData?.keyword_used ||
                                        "N/A"}
                                  </strong>
                                </div>

                                <div className="shrink-0">
                                  {st.item_name ||
                                  (st.price && st.price > 0) ? (
                                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">
                                      Có kết quả
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded">
                                      0 kết quả (Trống)
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Khối Minh Bạch: Tên vật tư thực tế trong nguồn */}
                              {st.item_name ? (
                                <div className="mb-1.5 pb-1.5 border-b border-slate-200/60">
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-1.5 py-0.2 rounded shrink-0">
                                      VẬT TƯ TRONG NGUỒN
                                    </span>
                                    <strong className="text-slate-900 text-xs font-bold leading-snug">
                                      {st.item_name}
                                    </strong>
                                  </div>

                                  {/* Thông tin chi tiết: Đơn vị, hợp đồng, quy cách */}
                                  <div className="mt-1 text-[11px] text-slate-600 space-y-0.5 pl-0.5">
                                    {st.supplier && (
                                      <div>
                                        <span className="font-semibold text-slate-700">
                                          Đơn vị / Nhà thầu:
                                        </span>{" "}
                                        {st.supplier}
                                        {st.contract_info && (
                                          <span className="text-slate-500 ml-1.5">
                                            ({st.contract_info})
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {st.specs && (
                                      <div
                                        className="text-slate-500 italic line-clamp-2"
                                        title={st.specs}
                                      >
                                        <span className="font-semibold text-slate-600 not-italic">
                                          Quy cách kỹ thuật:
                                        </span>{" "}
                                        {st.specs}
                                      </div>
                                    )}
                                    {st.url && (
                                      <div className="flex items-center gap-2 pt-0.5">
                                        <a
                                          href={st.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue-600 hover:text-blue-800 font-semibold underline inline-flex items-center gap-1"
                                        >
                                          🔗 Link sản phẩm niêm yết web ↗
                                        </a>
                                        {st.has_landed && (
                                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                                            🚢 Đã tính Landed Cost (+20% DDP)
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : null}

                              {/* Ý kiến đánh giá đối chiếu của Tổ Thẩm Định */}
                              <div
                                className={`p-1.5 rounded text-[11px] leading-relaxed border ${
                                  isDeselected
                                    ? "bg-amber-50/70 border-amber-200 text-amber-900 italic"
                                    : hasPrice
                                      ? "bg-slate-50 border-slate-200/80 text-slate-700"
                                      : "bg-slate-50/50 border-slate-100 text-slate-500"
                                }`}
                              >
                                <span className="font-bold mr-1">
                                  {isDeselected
                                    ? "⚠️ Đánh giá loại trừ:"
                                    : "📋 Ý kiến thẩm định:"}
                                </span>
                                {st.detail}
                              </div>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold border-r align-top ${hasPrice ? "text-slate-900 text-[12px]" : "text-slate-400"}`}
                            >
                              {hasPrice ? (
                                `${fmt(st.price)} đ`
                              ) : isDeselected && st._orig_price > 0 ? (
                                <span className="text-amber-700/60 line-through text-[11px] font-normal">
                                  {fmt(st._orig_price)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center align-top">
                              <div className="flex flex-col items-center gap-1.5">
                                {isDeselected ? (
                                  <span className="inline-block text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shadow-2xs">
                                    Loại trừ
                                  </span>
                                ) : hasPrice ? (
                                  <span className="inline-block text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs">
                                    Khớp
                                  </span>
                                ) : (
                                  <span className="inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    Trống
                                  </span>
                                )}

                                {/* Nút Loại trừ / Phục hồi trực tiếp tại Bảng đối chiếu */}
                                {status === "completed" &&
                                  (isDeselected ? (
                                    st._orig_price > 0 || st.item_name ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleTogglePillar(idx, false)
                                        }
                                        disabled={togglingIdx === idx}
                                        title="Khôi phục cơ sở này vào căn cứ so sánh đơn giá"
                                        className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-bold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-300 px-1.5 py-0.5 rounded transition shadow-2xs cursor-pointer disabled:opacity-50"
                                      >
                                        {togglingIdx === idx ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        ) : (
                                          "↩️ Phục hồi"
                                        )}
                                      </button>
                                    ) : null
                                  ) : hasPrice || st.item_name ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTogglePillar(idx, true)
                                      }
                                      disabled={togglingIdx === idx}
                                      title="Loại trừ cơ sở này (không áp dụng so sánh đơn giá do không tương thích kỹ thuật)"
                                      className="w-full inline-flex items-center justify-center gap-1 text-[10px] font-bold text-rose-800 hover:text-rose-950 bg-rose-50 hover:bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded transition shadow-2xs cursor-pointer disabled:opacity-50"
                                    >
                                      {togglingIdx === idx ? (
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                      ) : (
                                        "🚫 Loại trừ"
                                      )}
                                    </button>
                                  ) : null)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Hộp Kết Luận Đơn Giá & Tiết Kiệm */}
              {/* Hộp Kết Luận Đơn Giá & Tiết Kiệm */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border-2 border-emerald-400 rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                    KẾT LUẬN THẨM ĐỊNH & ĐƠN GIÁ THỐNG NHẤT:
                  </span>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="text-lg font-black font-mono text-emerald-950">
                      {fmt(currentPrice)}
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold">
                      /{item?.dvt || "Cái"}
                    </span>
                    {(() => {
                      const listSteps =
                        editableSteps.length > 0 ? editableSteps : steps;
                      const activeList = listSteps
                        .slice(0, 5)
                        .filter((s) => !s.is_deselected && s.price > 0);
                      activeList.sort((a, b) => a.price - b.price);
                      const bestPillar =
                        activeList[0]?.name ||
                        currentWinning ||
                        "Chưa xác định";
                      return (
                        <span className="text-[11px] font-bold text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-0.5 rounded-md shadow-2xs">
                          (Cơ sở: {bestPillar})
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Thành tiền thẩm định:{" "}
                    <strong className="font-mono">
                      {fmt(currentPrice * (item?.so_luong || 1))}
                    </strong>
                  </p>
                </div>

                <div className="text-right bg-white p-2.5 rounded-lg border border-emerald-200 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Giảm Trừ Tiết Kiệm:
                  </span>
                  <p className="text-sm font-black font-mono text-emerald-800 mt-0.5">
                    {fmt(giaTriGiam)}
                  </p>
                  <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    {pctGiam > 0
                      ? `-${pctGiam.toFixed(1)}% so với trình`
                      : "0%"}
                  </span>
                </div>
              </div>

              {/* Khối Bước 6: AI Thuyết Minh & Chốt Giá (Tùy Chọn - Chỉ chạy khi user chấp nhận) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                {Boolean(
                  customAiData ||
                  auditData?.synthesis?.ai_ran === true ||
                  auditData?.ai_result_data,
                ) ? (
                  <>
                    <button
                      onClick={() => setShowFullSummary(!showFullSummary)}
                      className="w-full px-3.5 py-2.5 bg-gradient-to-r from-purple-50 to-slate-50 border-b border-purple-200 flex items-center justify-between text-left font-bold text-xs text-purple-950 hover:bg-purple-100/60 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-700" />
                        <span>6. Bản Thuyết Minh Thẩm Định AI Chuyên Gia</span>
                        <span className="text-[9.5px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          ✓ Đã Phân Tích AI
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-purple-700 font-medium">
                        {showFullSummary ? "Thu gọn" : "Xem toàn văn"}
                        {showFullSummary ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </button>

                    <div
                      className={`p-3.5 text-[11.5px] leading-relaxed text-slate-800 bg-white ${showFullSummary ? "" : "line-clamp-4"}`}
                    >
                      <div className="whitespace-pre-line font-sans">
                        {customAiData?.summary_text || danhGiaTtd}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-gradient-to-r from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/80 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Brain className="w-5 h-5 text-amber-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-purple-950">
                            6. AI Thuyết Minh & Chốt Giá
                          </h5>
                          <span className="text-[9.5px] font-extrabold text-purple-800 bg-purple-100 px-2 py-0.5 rounded border border-purple-300">
                            TÙY CHỌN (OPTIONAL)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Đã hoàn tất nhanh 5 cơ sở chứng cứ. Bấm nút bên phải
                          nếu bạn muốn kích hoạt AI chuyên gia phân tích rủi ro
                          & sinh bản thuyết minh độc lập.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleTriggerAi}
                      disabled={runningAi}
                      className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {runningAi ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                          <span>AI đang phân tích...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                          <span>✨ Chạy AI Thuyết Minh</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TRẠNG THÁI 3: LỖI */}
          {status === "error" && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">
                  Không thể hoàn tất quá trình tra cứu 5 cơ sở
                </p>
                <p className="text-[11px] mt-1 text-rose-800">
                  Vui lòng kiểm tra kết nối mạng hoặc thử lại với từ khóa ngắn
                  gọn hơn.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
          >
            Đóng
          </button>

          {status === "completed" && (
            <div className="flex items-center gap-2">
              {onOpenInspector && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenInspector(item?.id ? item.id - 1 : 0);
                  }}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Soi Chi Tiết View 3
                </button>
              )}

              {onExportPdf && (
                <button
                  onClick={() => onExportPdf(item?.id || 1)}
                  className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                >
                  <FileDown className="w-3.5 h-3.5" /> Xuất Báo Cáo PDF 2 Trang
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Lớp bảo vệ chống sập giao diện (Zero White-Screen Guarantee)
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Lỗi giao diện Modal 5 Cơ Sở:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl border border-rose-200">
            <h3 className="text-base font-bold text-rose-700">
              Lỗi giao diện Báo cáo minh bạch
            </h3>
            <p className="text-xs text-slate-600 mt-2 font-mono bg-slate-50 p-2 rounded border border-slate-200">
              {this.state.error?.message || "Không thể hiển thị báo cáo"}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  if (this.props.onClose) this.props.onClose();
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AuditProgressModal(props) {
  if (!props.isOpen) return null;
  return (
    <ModalErrorBoundary onClose={props.onClose}>
      <AuditProgressModalContent {...props} />
    </ModalErrorBoundary>
  );
}
