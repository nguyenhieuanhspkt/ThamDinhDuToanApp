import React from 'react';
import { PILLARS, PILLAR_CFG } from '../constants/pillars.js';

export default function InspectorPillarTabs({ activePillar, onSwitchPillar, evSt }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl border border-slate-300 text-xs font-semibold shrink-0">
      {PILLARS.map(pk => {
        const cfg = PILLAR_CFG[pk];
        const Icon = cfg.icon;
        const isActive = activePillar === pk;
        const saved = pk === 'quotes' ? evSt.has_quotes : pk === 'erp' ? evSt.has_erp : pk === 'imis' ? evSt.has_imis : pk === 'msc' ? evSt.has_msc : pk === 'ecom' ? evSt.has_ecom : evSt.has_syn;
        return (
          <button
            key={pk}
            onClick={() => onSwitchPillar(pk)}
            className={`flex-1 py-2 px-1.5 rounded-lg transition flex items-center justify-center gap-1 relative ${
              isActive ? `bg-${cfg.color}-700 text-white shadow-sm font-bold` : 'text-slate-700 hover:bg-slate-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {cfg.label}
            {saved && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" title="Đã lưu chứng cứ" />}
          </button>
        );
      })}
    </div>
  );
}
