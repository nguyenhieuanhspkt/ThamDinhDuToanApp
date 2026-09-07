import React from 'react';
import {
  FileCheck2, Award, ExternalLink, CheckCircle, AlertTriangle, FileText
} from 'lucide-react';
import { fmt } from '../utils/formatters.js';
import { PillarHeader, LoadingSpinner, SaveFooter } from '../common';

export default function PillarQuotes({ loading, saving, minQuote, supplierMatches = [], dgTrinh, onOpenPdfPage, onSave, saved }) {
  return (
    <div className="space-y-4">
      <PillarHeader icon={FileCheck2} color="emerald" title="KHỐI 1: BÁO GIÁ GỐC NHẬN TỪ THƯ MỤC" loading={loading} />
      {loading ? <LoadingSpinner /> : minQuote ? (
        <>
          {/* Min Price Card */}
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-emerald-200 pb-2">
              <span className="bg-emerald-700 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-300" /> 🟢 GIÁ THẤP NHẤT (MIN)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-900">Score: {minQuote.score || '—'}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
              <div><span className="text-slate-500 text-[11px] block">NHÀ THẦU:</span><strong className="text-emerald-950">{minQuote.company}</strong></div>
              <div>
                <span className="text-slate-500 text-[11px] block">FILE PDF:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-800 truncate max-w-[180px]" title={minQuote.filename}>{minQuote.filename}</span>
                  {onOpenPdfPage && (
                    <button onClick={() => onOpenPdfPage(minQuote.filename, minQuote.page || 1)}
                      className="bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <ExternalLink className="w-3 h-3" /> Trang {minQuote.page || 1}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-500 text-[11px] block">ĐƠN GIÁ MIN:</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-emerald-800 font-mono">{fmt(minQuote.don_gia)} đ</span>
                  {minQuote.is_match_trinh
                    ? <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Khớp giá trình</span>
                    : <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Lệch giá trình</span>}
                </div>
              </div>
              <div><span className="text-slate-500 text-[11px] block">Vị trí:</span><span className="font-mono text-slate-800">STT {minQuote.stt} | Trang {minQuote.page}</span></div>
              <div className="col-span-2 pt-1 border-t border-emerald-200">
                <span className="text-slate-500 text-[11px] block">TÊN TRONG BÁO GIÁ:</span>
                <p className="text-xs font-semibold font-mono bg-white p-2 rounded border border-emerald-200 mt-1">{minQuote.quoted_name}{minQuote.quoted_tskt ? ` — ${minQuote.quoted_tskt}` : ''}</p>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          {supplierMatches.length > 0 && (
            <div>
              <h5 className="font-bold text-xs text-slate-800 uppercase mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" /> SO SÁNH {supplierMatches.length} NHÀ THẦU
              </h5>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                      <th className="py-2 px-2 text-center border-r w-8">STT</th>
                      <th className="py-2 px-3 border-r w-44">Nhà Thầu</th>
                      <th className="py-2 px-3 border-r">Tên trong Báo Giá</th>
                      <th className="py-2 px-3 text-right border-r w-32 font-mono">Đơn Giá Chào</th>
                      <th className="py-2 px-3 text-right border-r w-20">% Lệch</th>
                      <th className="py-2 px-2 text-center w-24">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {supplierMatches.map((m, i) => {
                      const isMin = minQuote && m.filename === minQuote.filename;
                      const diff = dgTrinh > 0 ? ((m.don_gia - dgTrinh) / dgTrinh * 100) : 0;
                      return (
                        <tr key={i} className={`hover:bg-slate-50 transition ${isMin ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                          <td className="py-2 px-2 text-center font-mono text-slate-500 border-r">{i + 1}</td>
                          <td className="py-2 px-3 border-r font-bold text-slate-900">
                            {m.company}{isMin && <span className="ml-1 text-[10px] text-emerald-700">(MIN)</span>}
                          </td>
                          <td className="py-2 px-3 border-r text-slate-800 max-w-[200px]">
                            <div className="line-clamp-2" title={m.quoted_name}>{m.quoted_name}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900 border-r">{fmt(m.don_gia)} đ</td>
                          <td className={`py-2 px-3 text-right font-mono font-bold border-r text-xs ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {onOpenPdfPage && (
                              <button onClick={() => onOpenPdfPage(m.filename, m.page || 1)}
                                className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 mx-auto">
                                <ExternalLink className="w-2.5 h-2.5" /> Tr.{m.page}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-xs text-slate-400">
          Chưa tìm thấy báo giá khớp với mục này trong thư mục báo giá.
        </div>
      )}
      <SaveFooter saving={saving} saved={saved} onSave={onSave} nextLabel="Cơ sở 2 (ERP)" />
    </div>
  );
}
