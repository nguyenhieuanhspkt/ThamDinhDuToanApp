import React from 'react';
import { Loader2 } from 'lucide-react';

export default function PillarHeader({ icon: Icon, color, title, loading }) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <h4 className={`font-bold text-sm text-${color}-900 uppercase tracking-wide flex items-center gap-2`}>
        <Icon className={`w-5 h-5 text-${color}-700`} /> {title}
      </h4>
      {loading && <span className="text-xs text-amber-600 italic animate-pulse flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tra cứu...</span>}
    </div>
  );
}
