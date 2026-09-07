import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Đang tải dữ liệu...
    </div>
  );
}
