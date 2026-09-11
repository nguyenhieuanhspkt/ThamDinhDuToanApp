import React, { useState } from "react"; // <--- 1. Thêm useState nếu chưa có
import { fmt } from "../utils/formatters.js";

export default function InspectorSidebar({
  items,
  filteredItems,
  selectedIndex,
  sidebarSearch,
  setSidebarSearch,
  evidenceStatus,
  onNavigateIndex,
}) {
  const [filterType, setFilterType] = useState("all");
  const isItemSaved = (it) => {
    const origIdx = items.findIndex((x) => x === it);
    const itemId = it.id || origIdx + 1;
    const st = evidenceStatus[String(itemId)] || {};
    return Boolean(
      st?.has_syn || (it.danh_gia_ttd && it.danh_gia_ttd.trim().length > 0),
    );
  };
  const finalFilteredItems = filteredItems.filter((it) => {
    if (filterType === "saved") return isItemSaved(it);
    if (filterType === "unsaved") return !isItemSaved(it);
    return true; // 'all'
  });
  return (
    <aside className="w-64 border-r flex flex-col shrink-0 bg-slate-50">
      <div className="p-2 border-b bg-white">
        <input
          type="text"
          value={sidebarSearch}
          onChange={(e) => setSidebarSearch(e.target.value)}
          placeholder="Tìm mục..."
          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
        />
        {/* === [VỊ TRÍ SỬA 2]: Thêm thanh nút bấm lọc (Tất cả / Chưa lưu / Đã lưu) ngay dưới ô tìm kiếm === */}
        <div className="flex items-center gap-1 mt-2 text-[10px]">
          <button
            onClick={() => setFilterType("all")}
            className={`flex-1 py-1 rounded font-medium transition ${filterType === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilterType("unsaved")}
            className={`flex-1 py-1 rounded font-medium transition ${filterType === "unsaved" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"}`}
          >
            Chưa lưu
          </button>
          <button
            onClick={() => setFilterType("saved")}
            className={`flex-1 py-1 rounded font-medium transition ${filterType === "saved" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
          >
            Đã lưu
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto text-xs divide-y divide-slate-100">
        {/* === [VỊ TRÍ SỬA 3]: Đổi từ filteredItems sang finalFilteredItems để danh sách tự động lọc theo nút bấm ở trên === */}
        {finalFilteredItems.map((it) => {
          const origIdx = items.findIndex((x) => x === it);
          const isActive = origIdx === selectedIndex;
          const stBadge = evidenceStatus[String(it.id)] || {};
          const doneCount = [
            stBadge.has_quotes,
            stBadge.has_erp,
            stBadge.has_imis,
            stBadge.has_msc,
            stBadge.has_ecom,
          ].filter(Boolean).length;

          const saved = isItemSaved(it); // Kiểm tra trạng thái lưu của item này
          return (
            <div
              key={origIdx}
              onClick={() => onNavigateIndex(origIdx)}
              className={`p-2 cursor-pointer transition ${isActive ? "bg-teal-50 border-l-4 border-l-teal-700" : "hover:bg-slate-100/80"}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-slate-500 font-bold text-[10px]">
                  #{origIdx + 1}
                </span>
                <span className="font-mono text-[#003366] font-bold text-[10px]">
                  {fmt(it.don_gia_trinh)} đ
                </span>
                {/* === [VỊ TRÍ SỬA 4]: Hiển thị nhãn Đã lưu / Chưa lưu CSDL ngay trên dòng giá === */}
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${saved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                >
                  {saved ? "Đã lưu CSDL" : "Chưa lưu"}
                </span>
              </div>
              <p
                className={`text-[11px] truncate ${isActive ? "font-bold text-teal-900" : "font-medium text-slate-800"}`}
                title={it.ten_vt}
              >
                {it.ten_vt}
              </p>
              {/* 5-pillar mini badges */}
              <div className="flex items-center gap-0.5 mt-1">
                {[
                  {
                    k: "has_quotes",
                    lbl: "BG",
                    col: stBadge.has_quotes
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : "bg-gray-100 text-gray-400",
                  },
                  {
                    k: "has_erp",
                    lbl: "ERP",
                    col: stBadge.has_erp
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "bg-gray-100 text-gray-400",
                  },
                  {
                    k: "has_imis",
                    lbl: "IMIS",
                    col: stBadge.has_imis
                      ? "bg-purple-100 text-purple-800 border-purple-300"
                      : "bg-gray-100 text-gray-400",
                  },
                  {
                    k: "has_msc",
                    lbl: "MSC",
                    col: stBadge.has_msc
                      ? "bg-orange-100 text-orange-800 border-orange-300"
                      : "bg-gray-100 text-gray-400",
                  },
                  {
                    k: "has_ecom",
                    lbl: "TMĐT",
                    col: stBadge.has_ecom
                      ? "bg-cyan-100 text-cyan-800 border-cyan-300"
                      : "bg-gray-100 text-gray-400",
                  },
                ].map((b) => (
                  <span
                    key={b.k}
                    className={`text-[8px] px-1 rounded border font-bold ${b.col}`}
                  >
                    {stBadge[b.k] ? "✓" : ""}
                    {b.lbl}
                  </span>
                ))}
                <span
                  className={`text-[8px] font-mono ml-auto font-bold ${doneCount === 5 ? "text-emerald-700" : doneCount > 0 ? "text-blue-600" : "text-gray-400"}`}
                >
                  {doneCount}/5
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
