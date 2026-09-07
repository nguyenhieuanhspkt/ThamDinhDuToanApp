import React from 'react';
import { fmt } from '../utils/formatters.js';

export default function InspectorSidebar({
  items,
  filteredItems,
  selectedIndex,
  sidebarSearch,
  setSidebarSearch,
  evidenceStatus,
  onNavigateIndex
}) {
  return (
    <aside className="w-64 border-r flex flex-col shrink-0 bg-slate-50">
      <div className="p-2 border-b bg-white">
        <input
          type="text"
          value={sidebarSearch}
          onChange={e => setSidebarSearch(e.target.value)}
          placeholder="Tìm mục..."
          className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto text-xs divide-y divide-slate-100">
        {filteredItems.map((it) => {
          const origIdx = items.findIndex(x => x === it);
          const isActive = origIdx === selectedIndex;
          const stBadge = evidenceStatus[String(it.id)] || {};
          const doneCount = [stBadge.has_quotes, stBadge.has_erp, stBadge.has_imis, stBadge.has_msc, stBadge.has_ecom].filter(Boolean).length;
          return (
            <div
              key={origIdx}
              onClick={() => onNavigateIndex(origIdx)}
              className={`p-2 cursor-pointer transition ${isActive ? 'bg-teal-50 border-l-4 border-l-teal-700' : 'hover:bg-slate-100/80'}`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="font-mono text-slate-500 font-bold text-[10px]">#{origIdx + 1}</span>
                <span className="font-mono text-[#003366] font-bold text-[10px]">{fmt(it.don_gia_trinh)} đ</span>
              </div>
              <p className={`text-[11px] truncate ${isActive ? 'font-bold text-teal-900' : 'font-medium text-slate-800'}`} title={it.ten_vt}>
                {it.ten_vt}
              </p>
              {/* 5-pillar mini badges */}
              <div className="flex items-center gap-0.5 mt-1">
                {[
                  { k: 'has_quotes', lbl: 'BG',   col: stBadge.has_quotes ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-gray-100 text-gray-400' },
                  { k: 'has_erp',    lbl: 'ERP',  col: stBadge.has_erp    ? 'bg-blue-100 text-blue-800 border-blue-300'     : 'bg-gray-100 text-gray-400' },
                  { k: 'has_imis',   lbl: 'IMIS', col: stBadge.has_imis   ? 'bg-purple-100 text-purple-800 border-purple-300': 'bg-gray-100 text-gray-400' },
                  { k: 'has_msc',    lbl: 'MSC',  col: stBadge.has_msc    ? 'bg-orange-100 text-orange-800 border-orange-300': 'bg-gray-100 text-gray-400' },
                  { k: 'has_ecom',   lbl: 'TMĐT', col: stBadge.has_ecom   ? 'bg-cyan-100 text-cyan-800 border-cyan-300'     : 'bg-gray-100 text-gray-400' },
                ].map(b => (
                  <span key={b.k} className={`text-[8px] px-1 rounded border font-bold ${b.col}`}>
                    {stBadge[b.k] ? '✓' : ''}{b.lbl}
                  </span>
                ))}
                <span className={`text-[8px] font-mono ml-auto font-bold ${doneCount === 5 ? 'text-emerald-700' : doneCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
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
