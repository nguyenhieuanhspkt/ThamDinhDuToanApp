import React from 'react';
import { Filter, RefreshCw, Folder, CheckCircle, FileText, Clock, Edit3, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LeftSidebar({
  dossierData,
  currentFilter,
  setFilter,
  activeQuoteFilename,
  onSelectQuote,
  onRescanPdf,
  onChangeFolder,
  onApproveAll,
  isLoading
}) {
  const quotes = dossierData?.quotes || [];
  const scans = dossierData?.scans || [];
  const docs = dossierData?.docs || [];

  const approvedSet = new Set(
    dossierData?.approved_data?.danh_sach_bao_gia
      ? dossierData.approved_data.danh_sach_bao_gia.map((x) => x.filename)
      : []
  );

  let cntPending = 0;
  let cntApproved = 0;
  let cntEdited = 0;

  quotes.forEach((q) => {
    const isApproved = approvedSet.has(q.filename);
    const isEdited = q.status === 'USER_EDITED';
    if (isEdited) cntEdited++;
    else if (isApproved) cntApproved++;
    else cntPending++;
  });

  const formatMoney = (val) => {
    if (!val) return '0';
    return Math.round(val).toLocaleString('vi-VN');
  };

  return (
    <aside className="w-64 bg-white border-r flex flex-col shrink-0 overflow-hidden shadow-xs">
      {/* Folder Bar */}
      <div className="p-2.5 bg-slate-800 text-slate-200 border-b border-slate-700 text-xs shrink-0 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-bold text-amber-400">
            <Folder className="w-3.5 h-3.5" /> Thư mục Báo Giá Gốc:
          </span>
          <button onClick={onChangeFolder} className="text-[10px] text-teal-300 hover:underline">
            Đổi
          </button>
        </div>
        <div className="flex items-center justify-between">
          <code className="text-[10.5px] font-mono text-slate-300 truncate max-w-[170px]" title={dossierData?.folder_path}>
            {dossierData?.folder_path || 'D:\\...\\Các Báo giá'}
          </code>
          <button
            onClick={() => onRescanPdf(true)}
            className="text-[10px] bg-slate-700 hover:bg-slate-600 text-teal-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-semibold transition"
            title="Quét lại file PDF từ đĩa"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> Quét lại
          </button>
        </div>
      </div>

      {/* Quick Filter Tabs */}
      <div className="p-2.5 border-b bg-slate-50 shrink-0">
        <div className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Filter className="w-3 h-3 text-teal-700" /> Bộ lọc nhanh 1-Click:
        </div>
        <div className="flex flex-col gap-1 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between ${
              currentFilter === 'all'
                ? 'bg-teal-700 text-white font-bold shadow-xs'
                : 'text-gray-700 hover:bg-gray-100 font-semibold'
            }`}
          >
            <span>Tất cả hồ sơ</span>
            <span className="bg-white/20 text-current text-[10px] px-1.5 py-0.2 rounded font-mono">
              {quotes.length + scans.length + docs.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('pending')}
            className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between ${
              currentFilter === 'pending'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'text-amber-900 hover:bg-amber-50 font-semibold'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> 🟡 Cần duyệt
            </span>
            <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {cntPending}
            </span>
          </button>

          <button
            onClick={() => setFilter('approved')}
            className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between ${
              currentFilter === 'approved'
                ? 'bg-emerald-700 text-white font-bold shadow-xs'
                : 'text-emerald-900 hover:bg-emerald-50 font-semibold'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> 🟢 Đã duyệt CSDL
            </span>
            <span className="bg-emerald-100 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {cntApproved}
            </span>
          </button>

          <button
            onClick={() => setFilter('edited')}
            className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between ${
              currentFilter === 'edited'
                ? 'bg-blue-700 text-white font-bold shadow-xs'
                : 'text-blue-900 hover:bg-blue-50 font-semibold'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> 🔵 Đã sửa thủ công
            </span>
            <span className="bg-blue-100 text-blue-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {cntEdited}
            </span>
          </button>

          <button
            onClick={() => setFilter('docs')}
            className={`w-full text-left px-2.5 py-1.5 rounded transition flex items-center justify-between ${
              currentFilter === 'docs'
                ? 'bg-slate-700 text-white font-bold shadow-xs'
                : 'text-gray-700 hover:bg-gray-100 font-semibold'
            }`}
          >
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3 text-gray-500" /> 📄 Scan & Công văn
            </span>
            <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
              {scans.length + docs.length}
            </span>
          </button>
        </div>
      </div>

      {/* Supplier Cards List */}
      <div className="p-2 border-b bg-gray-50 text-[11px] font-bold text-gray-600 flex items-center justify-between shrink-0">
        <span>DANH SÁCH NHÀ THẦU:</span>
        <span className="font-mono text-teal-800 font-extrabold">{quotes.length} file</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-1 text-teal-600" /> Đang tải báo giá...
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs italic">Không tìm thấy file báo giá nào.</div>
        ) : (
          quotes.map((q) => {
            const isApproved = approvedSet.has(q.filename);
            const isEdited = q.status === 'USER_EDITED';

            if (currentFilter === 'pending' && (isApproved || isEdited)) return null;
            if (currentFilter === 'approved' && !isApproved) return null;
            if (currentFilter === 'edited' && !isEdited) return null;
            if (currentFilter === 'docs') return null;

            const isActive = q.filename === activeQuoteFilename;
            let badgeHtml = <span className="bg-amber-100 text-amber-950 text-[9.5px] px-1.5 py-0.2 rounded font-bold">🟡 Cần duyệt</span>;
            let borderClass = 'border-gray-200 hover:border-teal-400 bg-white';

            if (isEdited) {
              badgeHtml = <span className="bg-blue-100 text-blue-900 text-[9.5px] px-1.5 py-0.2 rounded font-bold">🔵 Đã sửa</span>;
              borderClass = 'border-blue-200 bg-blue-50/30 hover:border-blue-400';
            } else if (isApproved) {
              badgeHtml = <span className="bg-emerald-100 text-emerald-950 text-[9.5px] px-1.5 py-0.2 rounded font-bold">🟢 Đã duyệt</span>;
              borderClass = 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400';
            }

            if (isActive) {
              borderClass = 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-500/40 shadow-sm';
            }

            return (
              <div
                key={q.filename}
                onClick={() => onSelectQuote(q.filename, q.file_path)}
                className={`p-2.5 rounded-lg border ${borderClass} cursor-pointer transition flex flex-col gap-1`}
              >
                <div className="flex items-center justify-between">
                  {badgeHtml}
                  <span className="text-[10px] font-mono text-gray-500 font-semibold bg-gray-100 px-1 rounded">
                    {q.item_count} dòng
                  </span>
                </div>
                <h5 className="font-bold text-gray-900 text-xs truncate leading-snug" title={q.company}>
                  {q.company}
                </h5>
                <p className="text-[10px] text-gray-500 truncate" title={q.filename}>
                  📄 {q.filename}
                </p>
                <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-gray-100">
                  <span className="text-[10px] text-gray-500 font-medium">Tổng tiền:</span>
                  <span className="text-xs font-black text-red-700 font-mono">{formatMoney(q.total_amount)} đ</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Approve All Button */}
      <div className="p-2.5 border-t bg-white shrink-0">
        <button
          onClick={onApproveAll}
          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-lg text-xs shadow flex items-center justify-center gap-1.5 transition"
        >
          <CheckCircle className="w-4 h-4 text-emerald-200" /> Phê Duyệt CSDL Dự Án
        </button>
      </div>
    </aside>
  );
}
