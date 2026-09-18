import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  XCircle,
  Filter,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckSquare,
  Square,
  HelpCircle,
} from "lucide-react";
import { useToast } from "../ui/Toast";

export default function ReducedAuditView({ onSelectInspectorItem, onBackToGrid, onDataChanged }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_count: 0,
    total_savings: 0,
    over_12m_count: 0,
    under_12m_count: 0,
    excluded_count: 0,
  });

  const [activeTab, setActiveTab] = useState("ALL"); // 'ALL' | 'OVER_12M' | 'UNDER_12M' | 'EXCLUDED'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal / Prompt loại trừ nhanh
  const [excludeModal, setExcludeModal] = useState({
    isOpen: false,
    item: null,
    isBatch: false,
    batchIds: [],
    reason: "Cơ sở giá quá 12 tháng, không còn phù hợp với mặt bằng thị trường hiện tại",
    customReason: "",
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const fetchReducedData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reduced-items");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setStats({
          total_count: data.total_count || 0,
          total_savings: data.total_savings || 0,
          over_12m_count: data.over_12m_count || 0,
          under_12m_count: data.under_12m_count || 0,
          excluded_count: data.excluded_count || 0,
        });
      }
    } catch (e) {
      console.error("Lỗi nạp danh sách đối soát giảm giá:", e);
      toast.error("Không thể nạp danh sách đối soát giảm giá: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReducedData();
  }, []);

  // Lọc danh sách theo tab và search
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      // 1. Tab filter
      if (activeTab === "OVER_12M" && (!it.is_over_12m || it.is_excluded)) return false;
      if (activeTab === "UNDER_12M" && (it.is_over_12m || it.is_excluded)) return false;
      if (activeTab === "EXCLUDED" && !it.is_excluded) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${it.stt || ""} ${it.ma_vt || ""} ${it.ten_vt || ""} ${it.co_so_thong_nhat || ""} ${it.target_spec_str || ""} ${it.ref_spec_str || ""} ${it.hd_str || ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [items, activeTab, searchQuery]);

  // Thao tác loại trừ 1 mục
  const handleOpenExcludeModal = (item) => {
    const defaultReason = item.is_over_12m
      ? `Cơ sở giá quá 12 tháng (${item.months_diff} tháng), không còn phù hợp biến động thị trường hiện tại`
      : "Quy cách cơ sở tham chiếu chưa phù hợp thực tế thiết kế đợt này";

    setExcludeModal({
      isOpen: true,
      item: item,
      isBatch: false,
      batchIds: [],
      reason: defaultReason,
      customReason: "",
    });
  };

  // Thao tác loại trừ hàng loạt
  const handleOpenBatchExcludeModal = (targetIds = null) => {
    const ids = targetIds || Array.from(selectedIds);
    if (!ids || ids.length === 0) {
      toast.warning("Vui lòng chọn ít nhất 1 mục để loại trừ");
      return;
    }

    setExcludeModal({
      isOpen: true,
      item: null,
      isBatch: true,
      batchIds: ids,
      reason: "Cơ sở giá quá 12 tháng / chưa phù hợp điều kiện kỹ thuật thực tế",
      customReason: "",
    });
  };

  // Nút nhanh: Loại trừ tất cả các mục Quá 12 Tháng
  const handleQuickExcludeAllOver12 = () => {
    const over12Ids = items.filter((it) => it.is_over_12m && !it.is_excluded).map((it) => it.id);
    if (over12Ids.length === 0) {
      toast.info("Không có mục nào đang giảm giá quá 12 tháng cần loại trừ.");
      return;
    }
    handleOpenBatchExcludeModal(over12Ids);
  };

  const handleConfirmExclude = async () => {
    setIsProcessing(true);
    const finalReason = excludeModal.customReason.trim() || excludeModal.reason;

    try {
      if (excludeModal.isBatch) {
        const res = await fetch("/api/items/batch-exclude-reductions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_ids: excludeModal.batchIds,
            reason: finalReason,
          }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Đã loại trừ ${data.updated_count} mục khỏi danh sách tiết kiệm!`);
          setSelectedIds(new Set());
          await fetchReducedData();
          onDataChanged?.();
        } else {
          toast.error(data.message || "Lỗi khi loại trừ hàng loạt");
        }
      } else if (excludeModal.item) {
        const itemId = excludeModal.item.id;
        const res = await fetch(`/api/items/${itemId}/exclude-reduction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: finalReason }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Đã loại trừ mục #${itemId} thành công (Giữ giá trình)`);
          await fetchReducedData();
          onDataChanged?.();
        } else {
          toast.error(data.message || "Lỗi khi loại trừ mục");
        }
      }
    } catch (e) {
      console.error("Lỗi loại trừ:", e);
      toast.error("Lỗi: " + e.message);
    } finally {
      setIsProcessing(false);
      setExcludeModal({ isOpen: false, item: null, isBatch: false, batchIds: [], reason: "", customReason: "" });
    }
  };

  // Thao tác khôi phục giảm giá
  const handleRestore = async (item) => {
    try {
      const res = await fetch(`/api/items/${item.id}/restore-reduction`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã khôi phục mức giảm giá cho mục #${item.id}`);
        await fetchReducedData();
        onDataChanged?.();
      } else {
        toast.error(data.message || "Lỗi khôi phục");
      }
    } catch (e) {
      toast.error("Lỗi kết nối: " + e.message);
    }
  };

  // Checkbox handling
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 shrink-0 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToGrid}
            className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition border border-slate-200 flex items-center gap-1 text-xs font-bold"
            title="Quay lại Ma Trận Dự Toán"
          >
            <ArrowLeft className="w-4 h-4 text-teal-700" /> Quay lại Ma Trận
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <div>
            <h2 className="text-base font-black text-[#003366] flex items-center gap-2">
              <span>🔍 Đối Soát Giảm Giá & Thời Hạn Cơ Sở (Review Sheet 4 Trực Quan)</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {stats.total_count} mục giảm giá
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              So sánh đối chiếu Quy cách, Thông số, Model và Đánh giá hiệu lực mốc 12 tháng. Cho phép 1-Click loại trừ nhanh nếu cơ sở chưa phù hợp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReducedData}
            disabled={loading}
            className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition text-xs font-semibold flex items-center gap-1"
            title="Làm mới dữ liệu"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={() => (window.location.href = "/api/export-executive-report")}
            className="bg-[#003366] hover:bg-blue-900 text-white text-xs px-3.5 py-1.5 rounded-lg font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Xuất Báo Cáo Lãnh Đạo (Có Sheet 4)
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="bg-slate-100/70 border-b border-slate-200 px-6 py-3 shrink-0 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Savings */}
        <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Tổng Tiết Kiệm Dự Toán</span>
            <div className="text-lg font-black text-purple-900 mt-0.5">
              {stats.total_savings.toLocaleString("vi-VN")} đ
            </div>
          </div>
          <div className="p-2.5 bg-purple-50 rounded-xl text-purple-700 font-bold text-xs">
            💰 {stats.total_count - stats.excluded_count} mục áp dụng
          </div>
        </div>

        {/* Card 2: Over 12 Months */}
        <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" /> Cơ Sở Quá 12 Tháng
            </span>
            <div className="text-lg font-black text-amber-900 mt-0.5">
              {stats.over_12m_count} mục
            </div>
          </div>
          {stats.over_12m_count > 0 && (
            <button
              onClick={handleQuickExcludeAllOver12}
              className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition shadow-xs"
              title="Bấm để loại trừ nhanh toàn bộ các mục quá 12 tháng"
            >
              ⚡ Loại trừ tất cả
            </button>
          )}
        </div>

        {/* Card 3: Within 12 Months */}
        <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Trong Hạn 12 Tháng
            </span>
            <div className="text-lg font-black text-emerald-900 mt-0.5">
              {stats.under_12m_count} mục
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
            Đạt chuẩn EVN
          </div>
        </div>

        {/* Card 4: Excluded Items */}
        <div className="bg-white p-3 rounded-xl border border-slate-300 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-slate-500" /> Đã Loại Trừ (Giữ Giá Trình)
            </span>
            <div className="text-lg font-black text-slate-800 mt-0.5">
              {stats.excluded_count} mục
            </div>
          </div>
          <div className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
            Chấp thuận trình
          </div>
        </div>
      </div>

      {/* Control Bar: Filter Tabs & Search */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 shrink-0 flex items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1 rounded-md transition ${activeTab === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Tất cả ({stats.total_count})
          </button>
          <button
            onClick={() => setActiveTab("OVER_12M")}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${activeTab === "OVER_12M" ? "bg-amber-100 text-amber-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            🟡 Quá 12 Tháng ({stats.over_12m_count})
          </button>
          <button
            onClick={() => setActiveTab("UNDER_12M")}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${activeTab === "UNDER_12M" ? "bg-emerald-100 text-emerald-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            🟢 Trong Hạn 12 Tháng ({stats.under_12m_count})
          </button>
          <button
            onClick={() => setActiveTab("EXCLUDED")}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${activeTab === "EXCLUDED" ? "bg-slate-200 text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            ❌ Đã Loại Trừ ({stats.excluded_count})
          </button>
        </div>

        {/* Batch Action Bar if items selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
            <span className="text-xs font-bold text-amber-900">
              Đã chọn <strong>{selectedIds.size}</strong> mục
            </span>
            <button
              onClick={() => handleOpenBatchExcludeModal()}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-2.5 py-1 rounded-md transition shadow-xs cursor-pointer"
            >
              ❌ Loại trừ các mục đã chọn
            </button>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên vật tư, mã ERP, số HĐ..."
            className="pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg w-72 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
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
      </div>

      {/* Main Table View */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-semibold">Đang tải danh mục đối soát giảm giá...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <span className="text-sm font-bold text-slate-700">Không có mục nào trong danh mục lọc hiện tại</span>
            <p className="text-xs text-slate-400">Tất cả các mục giảm giá đều đã được xử lý phù hợp.</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse min-w-[2000px]">
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 shadow-xs">
              <tr>
                {/* Checkbox Select All */}
                <th className="py-2.5 px-2 text-center w-8 border-r border-slate-200">
                  <button onClick={toggleSelectAll} className="p-0.5 hover:text-teal-700">
                    {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-teal-700" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-2.5 px-2 text-center w-10 border-r border-slate-200">STT</th>
                <th className="py-2.5 px-3 w-28 border-r border-slate-200">Mã ERP</th>
                <th className="py-2.5 px-3 w-56 border-r border-slate-200">Tên Vật Tư Trình Duyệt</th>
                <th className="py-2.5 px-2 text-center w-14 border-r border-slate-200">ĐVT</th>
                <th className="py-2.5 px-2 text-right w-14 border-r border-slate-200">SL</th>
                <th className="py-2.5 px-3 text-right w-24 border-r border-slate-200">ĐG Trình (đ)</th>
                <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200">Thành Tiền Trình</th>
                
                {/* Mục tiêu 1 Header: Blue gradient */}
                <th className="py-2.5 px-3 w-64 border-r border-slate-200 bg-blue-50 text-blue-900 border-t-2 border-t-blue-600">
                  📋 Quy Cách, Model TRÌNH DUYỆT
                </th>
                <th className="py-2.5 px-3 w-44 border-r border-slate-200">Cơ Sở Giá Thẩm Định</th>
                <th className="py-2.5 px-3 w-64 border-r border-slate-200 bg-blue-50 text-blue-900 border-t-2 border-t-blue-600">
                  🔍 Quy Cách, Model CƠ SỞ ĐƠN GIÁ
                </th>
                <th className="py-2.5 px-3 w-48 border-r border-slate-200 bg-blue-100/60 text-blue-950 font-bold border-t-2 border-t-blue-600">
                  🎯 [MỤC TIÊU 1] Đánh Giá Quy Cách/Model
                </th>

                {/* Giá Thống Nhất & Tiết Kiệm */}
                <th className="py-2.5 px-3 text-right w-24 border-r border-slate-200">ĐG Thống Nhất</th>
                <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200">Thành Tiền TN</th>
                <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200 bg-purple-50 text-purple-900">
                  Tiết Kiệm (đ)
                </th>
                <th className="py-2.5 px-2 text-center w-16 border-r border-slate-200 bg-purple-50 text-purple-900">
                  % Giảm
                </th>

                {/* Mục tiêu 2 Header: Amber gradient */}
                <th className="py-2.5 px-3 w-48 border-r border-slate-200 bg-amber-50 text-amber-950 border-t-2 border-t-amber-600">
                  Số HĐ / Quyết Định Cơ Sở
                </th>
                <th className="py-2.5 px-2 text-center w-24 border-r border-slate-200 bg-amber-50 text-amber-950 border-t-2 border-t-amber-600">
                  Ngày Cơ Sở
                </th>
                <th className="py-2.5 px-2 text-center w-20 border-r border-slate-200 bg-amber-50 text-amber-950 border-t-2 border-t-amber-600">
                  Cách Nay
                </th>
                <th className="py-2.5 px-3 text-center w-48 border-r border-slate-200 bg-amber-100/70 text-amber-950 font-bold border-t-2 border-t-amber-600">
                  ⏱️ [MỤC TIÊU 2] Tiêu Chuẩn 12 Tháng
                </th>

                {/* Thao tác Review Nhanh */}
                <th className="py-2.5 px-3 text-center w-40 sticky right-0 bg-slate-100 z-30 shadow-xs border-l border-slate-300">
                  Thao Tác Review Nhanh
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((it, idx) => {
                const isExcluded = it.is_excluded;
                const isOver12 = it.is_over_12m;
                const isSelected = selectedIds.has(it.id);

                return (
                  <tr
                    key={it.id}
                    className={`hover:bg-slate-50/80 transition ${isExcluded ? "bg-slate-100/50 opacity-70" : isSelected ? "bg-teal-50/50" : ""}`}
                  >
                    {/* Checkbox */}
                    <td className="py-2 px-2 text-center border-r border-slate-200">
                      <button onClick={() => toggleSelectOne(it.id)} className="p-0.5 hover:text-teal-700">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-teal-700" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* STT */}
                    <td className="py-2 px-2 text-center font-semibold text-slate-500 border-r border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Mã ERP */}
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-600 border-r border-slate-200">
                      {it.ma_vt || "—"}
                    </td>

                    {/* Tên VT */}
                    <td className="py-2 px-3 font-bold text-slate-800 border-r border-slate-200">
                      {it.ten_vt_goc || it.ten_vt}
                      {isExcluded && (
                        <span className="ml-1.5 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold border border-rose-200">
                          Đã loại trừ
                        </span>
                      )}
                    </td>

                    {/* ĐVT & SL */}
                    <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-200">{it.dvt || "Cái"}</td>
                    <td className="py-2 px-2 text-right font-medium text-slate-700 border-r border-slate-200">{it.so_luong}</td>

                    {/* Giá Trình */}
                    <td className="py-2 px-3 text-right font-medium text-slate-700 border-r border-slate-200">
                      {(it.don_gia_trinh || 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 border-r border-slate-200">
                      {(it.thanh_tien_trinh || 0).toLocaleString("vi-VN")}
                    </td>

                    {/* Quy cách Trình Duyệt */}
                    <td className="py-2 px-3 text-slate-700 text-[11px] border-r border-slate-200 bg-blue-50/30">
                      {it.target_spec_str || "—"}
                    </td>

                    {/* Cơ sở giá */}
                    <td className="py-2 px-3 text-[11px] font-semibold text-slate-700 border-r border-slate-200">
                      {it.co_so_thong_nhat || it.prev_winning_basis || "—"}
                    </td>

                    {/* Quy cách Cơ sở */}
                    <td className="py-2 px-3 text-slate-700 text-[11px] border-r border-slate-200 bg-blue-50/30">
                      {it.ref_spec_str || "—"}
                    </td>

                    {/* [Mục tiêu 1] Đánh giá Quy cách / Model */}
                    <td className="py-2 px-3 border-r border-slate-200 bg-blue-50/40">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200">
                        {it.eval_spec}
                      </span>
                    </td>

                    {/* Giá Thống Nhất */}
                    <td className="py-2 px-3 text-right font-semibold text-slate-900 border-r border-slate-200">
                      {(it.don_gia_thong_nhat || 0).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 border-r border-slate-200">
                      {(it.thanh_tien_thong_nhat || 0).toLocaleString("vi-VN")}
                    </td>

                    {/* Tiết Kiệm & % Giảm */}
                    <td className="py-2 px-3 text-right font-black text-purple-700 border-r border-slate-200 bg-purple-50/30">
                      {isExcluded ? "0 đ (Đã hủy)" : `${(it.gia_tri_giam || 0).toLocaleString("vi-VN")} đ`}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-purple-800 border-r border-slate-200 bg-purple-50/30">
                      {isExcluded ? "0%" : `${it.pct_giam || 0}%`}
                    </td>

                    {/* Số HĐ */}
                    <td className="py-2 px-3 text-[11px] text-slate-700 border-r border-slate-200 bg-amber-50/20">
                      {it.hd_str || "—"}
                    </td>

                    {/* Ngày Cơ Sở */}
                    <td className="py-2 px-2 text-center text-[11px] font-mono text-slate-600 border-r border-slate-200 bg-amber-50/20">
                      {it.ref_date_display || "—"}
                    </td>

                    {/* Khoảng cách tháng */}
                    <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-700 border-r border-slate-200 bg-amber-50/20">
                      {it.months_diff > 0 ? `${it.months_diff} th` : "Hiện hành"}
                    </td>

                    {/* [Mục tiêu 2] Đánh giá 12 Tháng */}
                    <td className="py-2 px-3 text-center border-r border-slate-200 bg-amber-50/40">
                      {isOver12 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                          🟡 Quá 12T ({it.months_diff} tháng)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          🟢 Trong hạn 12T ({it.months_diff} tháng)
                        </span>
                      )}
                    </td>

                    {/* Thao tác Review Nhanh (Action) */}
                    <td className="py-2 px-3 text-center sticky right-0 bg-white z-20 shadow-xs border-l border-slate-300">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isExcluded ? (
                          <button
                            onClick={() => handleOpenExcludeModal(it)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Loại trừ mục này khỏi danh sách tiết kiệm (Giữ nguyên giá trình)"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            Loại trừ
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(it)}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Khôi phục lại mức giá giảm cho mục này"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-teal-600" />
                            Khôi phục
                          </button>
                        )}

                        <button
                          onClick={() => onSelectInspectorItem(it.id - 1)}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                          title="Xem chi tiết 5 cơ sở của mục này"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Chọn Lý Do Loại Trừ Nhanh */}
      {excludeModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 text-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {excludeModal.isBatch
                    ? `Xác nhận Loại trừ ${excludeModal.batchIds.length} Mục Khỏi Giảm Giá`
                    : `Xác nhận Loại trừ Mục #${excludeModal.item?.id} (Giữ Giá Trình)`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đơn giá thống nhất sẽ được đặt lại bằng Đơn giá trình (Tiết kiệm = 0 đ).
                </p>
              </div>
            </div>

            {/* Thông tin mục nếu là single */}
            {!excludeModal.isBatch && excludeModal.item && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
                <div>
                  <strong>Vật tư:</strong> {excludeModal.item.ten_vt_goc || excludeModal.item.ten_vt}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Giá trình: <strong>{(excludeModal.item.don_gia_trinh || 0).toLocaleString("vi-VN")} đ</strong></span>
                  <span>Giá giảm cũ: <strong className="text-purple-700">{(excludeModal.item.don_gia_thong_nhat || 0).toLocaleString("vi-VN")} đ</strong></span>
                  <span>Tiết kiệm đang hủy: <strong className="text-rose-600">{(excludeModal.item.gia_tri_giam || 0).toLocaleString("vi-VN")} đ</strong></span>
                </div>
              </div>
            )}

            {/* Chọn lý do nhanh */}
            <div className="space-y-3 mb-5">
              <label className="block text-xs font-bold text-slate-700">
                Chọn Lý Do Loại Trừ (để ghi nhận vào Bản Thuyết Minh Thẩm Định):
              </label>

              <div className="space-y-2">
                {[
                  "Cơ sở giá quá 12 tháng, không còn phù hợp với mặt bằng thị trường hiện tại",
                  "Quy cách kỹ thuật cơ sở tham chiếu không tương đương / không lắp lẫn được theo thiết kế",
                  "Nhà thầu chào đợt này là cấu hình chuyên dụng riêng có bảo hành OEM",
                  "Hồ sơ chào giá của đợt này là báo giá cạnh tranh trực tiếp thấp nhất hợp lệ",
                ].map((rText, idx) => (
                  <label
                    key={idx}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                      excludeModal.reason === rText
                        ? "bg-rose-50 border-rose-400 text-rose-950 font-semibold"
                        : "border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="exclude_reason"
                      checked={excludeModal.reason === rText && !excludeModal.customReason}
                      onChange={() => setExcludeModal((prev) => ({ ...prev, reason: rText, customReason: "" }))}
                      className="mt-0.5 text-rose-600 focus:ring-rose-500"
                    />
                    <span>{rText}</span>
                  </label>
                ))}
              </div>

              {/* Nhập lý do khác nếu có */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Hoặc nhập lý do kỹ thuật riêng:</label>
                <input
                  type="text"
                  value={excludeModal.customReason}
                  onChange={(e) => setExcludeModal((prev) => ({ ...prev, customReason: e.target.value }))}
                  placeholder="Ví dụ: Cấp áp lực thực tế là Class 1500# khác PN16..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setExcludeModal({ isOpen: false, item: null, isBatch: false, batchIds: [], reason: "", customReason: "" })}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmExclude}
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Xác nhận loại trừ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
