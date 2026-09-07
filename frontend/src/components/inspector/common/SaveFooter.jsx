import React from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Save, ArrowRight } from 'lucide-react';

export default function SaveFooter({ saving, saved, onSave, nextLabel, prevLabel, isFinal }) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-4">
      <div className="flex items-center gap-2">
        {saved
          ? <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold"><ShieldCheck className="w-4 h-4" /> Đã lưu chứng cứ</span>
          : <span className="flex items-center gap-1.5 text-xs text-slate-400"><ShieldAlert className="w-4 h-4" /> Chưa lưu chứng cứ</span>
        }
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60 ${
          isFinal ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-[#003366] hover:bg-blue-900 text-white'
        }`}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {isFinal ? '✨ Lưu & Phê Duyệt 5 Cơ Sở' : `💾 Lưu & Đi Tiếp ${nextLabel || ''}`}
        {!isFinal && <ArrowRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
