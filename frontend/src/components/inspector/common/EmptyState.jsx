import React from 'react';

export default function EmptyState({ text }) {
  return (
    <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-xs text-slate-400">{text}</div>
  );
}
