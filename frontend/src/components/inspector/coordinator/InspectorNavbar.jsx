import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Save,
  Loader2,
  Zap, // <-- 1. Bổ sung import Zap ở đây
} from "lucide-react";

export default function InspectorNavbar({
  selectedIndex,
  totalItems,
  currentItem,
  onNavigateIndex,
  onExportPdf,
  onSave,
  saving,
  handleRun5Pillars, // <-- 2. Nhận hàm này từ props
  isSearching5Pillars, // <-- 3. Nhận trạng thái này từ props
}) {
  return (
    <div className="bg-white border-b px-5 py-2.5 shrink-0 flex items-center justify-between shadow-sm z-10 text-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigateIndex(Math.max(0, selectedIndex - 1))}
          disabled={selectedIndex <= 0}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Trước
        </button>
        <span className="font-bold text-[#003366] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 font-mono">
          Mục {selectedIndex + 1} / {totalItems || 1}
        </span>
        <button
          onClick={() =>
            onNavigateIndex(Math.min(totalItems - 1, selectedIndex + 1))
          }
          disabled={selectedIndex >= totalItems - 1}
          className="bg-[#003366] hover:bg-blue-900 disabled:opacity-40 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shadow-sm"
        >
          Tiếp theo <ChevronRight className="w-4 h-4" />
        </button>
        {/* Nút Tra 5 Cơ Sở */}
        <button
          onClick={handleRun5Pillars}
          disabled={isSearching5Pillars}
          className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
          title="Tra cứu tự động liên hoàn 5 khối chứng cứ cho mục vật tư này"
        >
          {isSearching5Pillars ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
              <span>Đang tra cứu...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>⚡ Tra 5 Cơ Sở</span>
            </>
          )}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Đang duyệt:</span>
          <strong
            className="text-slate-900 max-w-xs truncate"
            title={currentItem.ten_vt}
          >
            {currentItem.ten_vt || "Chưa chọn"}
          </strong>
        </div>

        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            title="Lưu dữ liệu khối hiện tại"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Đang lưu..." : "Lưu khối hiện tại"}
          </button>
        )}

        <button
          onClick={onExportPdf}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          title="Xuất Báo Cáo Thẩm Định PDF A4 Chuyên Nghiệp"
        >
          <FileText className="w-4 h-4" /> Xuất Báo Cáo PDF
        </button>
      </div>
    </div>
  );
}
