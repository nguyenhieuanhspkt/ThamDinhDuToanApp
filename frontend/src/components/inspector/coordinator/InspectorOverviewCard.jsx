import React from "react";
import { fmt } from "../utils/formatters.js";

export default function InspectorOverviewCard({
  currentItem,
  dgTrinh,
  selectedIndex,
}) {
  const stt = selectedIndex !== undefined ? selectedIndex + 1 : 1;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-start gap-2.5 mb-2">
        {/* Huy hiệu STT nổi bật đặt ngay trước tên vật tư */}
        <span className="bg-[#003366] text-white font-mono font-bold text-xs px-2.5 py-0.5 rounded-md shrink-0 shadow-2xs">
          STT {stt}
        </span>
        <h3 className="font-bold text-sm text-slate-900 leading-snug">
          {currentItem.ten_vt || "Chưa chọn mục"}
        </h3>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2 mt-1">
        <div>
          Mã ERP:{" "}
          <strong className="font-mono text-slate-800">
            {currentItem.ma_vt || "-"}
          </strong>
        </div>
        <div>
          ĐVT: <strong>{currentItem.dvt || "Cái"}</strong>
        </div>
        <div>
          Số lượng:{" "}
          <strong className="font-mono">{currentItem.so_luong || 1}</strong>
        </div>
        <div>
          Đơn giá trình:{" "}
          <strong className="font-mono text-[#003366] font-extrabold">
            {fmt(dgTrinh)} đ
          </strong>
        </div>
      </div>
    </div>
  );
}
