import React from 'react';
import { fmt } from '../utils/formatters.js';

export default function InspectorOverviewCard({ currentItem, dgTrinh }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="font-bold text-sm text-slate-900 mb-2">{currentItem.ten_vt || 'Chưa chọn mục'}</h3>
      <div className="grid grid-cols-4 gap-2 text-xs text-slate-600">
        <div>Mã ERP: <strong className="font-mono text-slate-800">{currentItem.ma_vt || '-'}</strong></div>
        <div>ĐVT: <strong>{currentItem.dvt || 'Cái'}</strong></div>
        <div>Số lượng: <strong className="font-mono">{currentItem.so_luong || 1}</strong></div>
        <div>Đơn giá trình: <strong className="font-mono text-[#003366] font-extrabold">{fmt(dgTrinh)} đ</strong></div>
      </div>
    </div>
  );
}
