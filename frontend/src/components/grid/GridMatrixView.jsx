import React, { useState, useEffect } from 'react';
import { Table2, Search, Download, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';

export default function GridMatrixView({ onSelectInspectorItem }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total_items: 0, total_trinh: 0, total_thong_nhat: 0 });

  const fetchGridData = async () => {
    try {
      const res = await fetch('/api/dossier');
      const data = await res.json();
      const list = data.items || [];
      setItems(list);

      const total_trinh = list.reduce((acc, it) => acc + (parseFloat(it.thanh_tien_trinh) || (it.so_luong * it.don_gia_trinh) || 0), 0);
      const total_thong_nhat = list.reduce((acc, it) => acc + (parseFloat(it.thanh_tien_thong_nhat) || ((it.so_luong || 1) * (it.don_gia_thong_nhat || 0)) || 0), 0);
      setStats({ total_items: list.length, total_trinh, total_thong_nhat });
    } catch (e) {
      console.error('Lỗi fetch grid data:', e);
    }
  };

  useEffect(() => { fetchGridData(); }, []);

  const fmt = (val) => (!val && val !== 0 ? '—' : Math.round(val).toLocaleString('vi-VN'));
  const fmtTax = (val) => {
    if (!val && val !== 0) return '8%';
    if (typeof val === 'number') return val < 1 ? `${Math.round(val * 100)}%` : `${val}%`;
    return val.toString().includes('%') ? val : `${val}%`;
  };

  const filteredItems = items.filter((it, idx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (it.ten_vt_goc || it.ten_vt || '').toLowerCase().includes(q) ||
      (it.ma_vt || '').toLowerCase().includes(q) ||
      (it.pycvt || '').toLowerCase().includes(q) ||
      (it.thong_so_kt || it.part_no || '').toLowerCase().includes(q) ||
      String(it.stt || idx + 1).includes(q)
    );
  });

  // Summary stats
  const giam_tru = stats.total_trinh - stats.total_thong_nhat;
  const pct_giam = stats.total_trinh > 0 ? (giam_tru / stats.total_trinh * 100) : 0;

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden bg-slate-100 h-full gap-3">

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <StatCard label="Tổng số danh mục" value={`${stats.total_items} mục`} color="slate" />
        <StatCard label="Tổng giá trị trình duyệt" value={`${fmt(stats.total_trinh)} đ`} color="blue" />
        <StatCard
          label="Tổng giá trị thống nhất"
          value={stats.total_thong_nhat > 0 ? `${fmt(stats.total_thong_nhat)} đ` : '—'}
          color="emerald"
          sub={stats.total_thong_nhat > 0 ? null : 'Chưa có kết quả thẩm định'}
        />
        <StatCard
          label="Giảm trừ / Tiết kiệm"
          value={stats.total_thong_nhat > 0 ? `${fmt(giam_tru)} đ` : '—'}
          color="purple"
          sub={stats.total_thong_nhat > 0 ? `(-${pct_giam.toFixed(1)}% so với trình)` : null}
        />
      </div>

      {/* Table Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Table2 className="w-4 h-4 text-teal-700" />
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">Bảng Ma Trận Dự Toán Thẩm Định — Chuẩn 2026</span>
            <span className="bg-teal-100 text-teal-800 text-[10.5px] px-2 py-0.5 rounded-full font-bold">
              {filteredItems.length}/{items.length} mục
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm tên vật tư, mã ERP, PYCVT..."
                className="pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg w-64 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
            <button
              onClick={() => window.location.href = '/api/export-excel'}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel 13 Cột
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1800px]">
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 shadow-sm">
              <tr>
                {/* Sticky Left */}
                <th className="py-3 px-2 text-center w-10 sticky left-0 bg-slate-100 border-r border-slate-200 z-30">1. STT</th>
                <th className="py-3 px-2 text-center w-24 sticky left-10 bg-slate-100 border-r border-slate-200 z-30">2. PYCVT</th>
                <th className="py-3 px-3 w-56 sticky left-[136px] bg-slate-100 border-r border-slate-200 z-30 shadow-sm">3. Tên vật tư</th>
                {/* Normal */}
                <th className="py-3 px-3 w-56 border-r border-slate-200">4. Thông số KT</th>
                <th className="py-3 px-2 text-center w-12 border-r border-slate-200">5. ĐVT</th>
                <th className="py-3 px-2 text-right w-14 border-r border-slate-200">6. SL</th>
                <th className="py-3 px-3 w-28 border-r border-slate-200">7. HSX/XX</th>
                <th className="py-3 px-3 text-center w-28 border-r border-slate-200 font-mono">8. Mã ERP</th>
                {/* Trình */}
                <th className="py-3 px-3 text-right w-32 border-r border-slate-200 bg-blue-50 text-[#003366]">9. ĐG Trình</th>
                <th className="py-3 px-3 text-right w-36 border-r border-slate-200 bg-blue-50 text-[#003366]">10. TT Trình</th>
                {/* Thống Nhất */}
                <th className="py-3 px-3 text-right w-32 border-r border-slate-200 bg-emerald-50 text-emerald-900">11. ĐG Thống Nhất</th>
                <th className="py-3 px-3 text-right w-36 border-r border-slate-200 bg-emerald-50 text-emerald-900">12. TT Thống Nhất</th>
                {/* Kết quả */}
                <th className="py-3 px-3 text-right w-20 border-r border-slate-200 bg-amber-50 text-amber-900">13. % Giảm</th>
                {/* Sticky Right */}
                <th className="py-3 px-2 text-center w-24 sticky right-0 bg-slate-100 border-l border-slate-200 z-30 shadow-sm">Kết quả</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="14" className="text-center py-16 text-slate-400 text-xs italic">
                    {searchQuery ? `Không tìm thấy mục nào khớp "${searchQuery}"` : 'Chưa có dòng dự toán. Hãy nạp file Excel.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const origIdx = items.indexOf(it);
                  const sl = parseFloat(it.so_luong) || 1;

                  // Trình
                  const dgTrinh = parseFloat(it.don_gia_trinh) || 0;
                  const ttTrinh = parseFloat(it.thanh_tien_trinh) || (sl * dgTrinh);

                  // Thống nhất
                  const dgTN = parseFloat(it.don_gia_thong_nhat) || 0;
                  const ttTN = parseFloat(it.thanh_tien_thong_nhat) || (dgTN > 0 ? sl * dgTN : 0);

                  // % giảm
                  const hasTN = dgTN > 0;
                  const pctGiam = hasTN && dgTrinh > 0 ? ((dgTrinh - dgTN) / dgTrinh * 100) : null;

                  // Status
                  const status = !hasTN ? 'pending'
                    : pctGiam > 0 ? 'reduced'
                    : pctGiam === 0 ? 'same'
                    : 'increased';

                  const isEven = idx % 2 === 0;

                  return (
                    <tr key={idx} className={`group transition hover:bg-teal-50/60 ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}>
                      {/* Sticky Left */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 sticky left-0 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 font-medium">
                        {it.stt || origIdx + 1}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-700 sticky left-10 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 text-[11px] font-semibold">
                        {it.pycvt || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 sticky left-[136px] bg-inherit group-hover:bg-teal-50 border-r border-slate-200 shadow-sm">
                        <div className="line-clamp-2" title={it.ten_vt_goc || it.ten_vt}>{it.ten_vt_goc || it.ten_vt || ''}</div>
                      </td>
                      {/* Normal */}
                      <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 text-[11px]">
                        <div className="line-clamp-2" title={it.thong_so_kt || it.part_no}>{it.thong_so_kt || it.part_no || '—'}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-slate-200 text-slate-700">{it.dvt || 'Cái'}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">{sl}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600 truncate max-w-[112px]" title={it.hsx_xx}>{it.hsx_xx || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-800 border-r border-slate-200 text-[11px] font-semibold">{it.ma_vt || '—'}</td>

                      {/* Trình (blue) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#003366] border-r border-slate-200 bg-blue-50/20 group-hover:bg-teal-50">
                        {fmt(dgTrinh)} đ
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#003366] border-r border-slate-200 bg-blue-50/10 group-hover:bg-teal-50">
                        {fmt(ttTrinh)} đ
                      </td>

                      {/* Thống Nhất (emerald) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-slate-200 bg-emerald-50/20 group-hover:bg-teal-50">
                        {hasTN ? <span className="text-emerald-900">{fmt(dgTN)} đ</span> : <span className="text-slate-300 text-[11px] italic">Chưa TĐ</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold border-r border-slate-200 bg-emerald-50/10 group-hover:bg-teal-50">
                        {hasTN ? <span className="text-emerald-900">{fmt(ttTN)} đ</span> : <span className="text-slate-300 text-[11px] italic">—</span>}
                      </td>

                      {/* % Giảm (amber) */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-slate-200 bg-amber-50/20 group-hover:bg-teal-50">
                        {pctGiam === null ? (
                          <span className="text-slate-300 text-[11px]">—</span>
                        ) : pctGiam > 0 ? (
                          <span className="text-emerald-700">-{pctGiam.toFixed(1)}%</span>
                        ) : pctGiam < 0 ? (
                          <span className="text-red-600">+{Math.abs(pctGiam).toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-500">0%</span>
                        )}
                      </td>

                      {/* Action — Sticky Right */}
                      <td className="py-2.5 px-2 text-center sticky right-0 bg-white group-hover:bg-teal-50 border-l border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center gap-1">
                          {/* Status badge */}
                          {status === 'pending' && <span className="text-[9px] text-slate-400 font-medium">Chưa TĐ</span>}
                          {status === 'reduced'  && <span className="flex items-center gap-0.5 text-[9px] text-emerald-700 font-bold"><CheckCircle2 className="w-3 h-3" />Giảm trừ</span>}
                          {status === 'same'     && <span className="flex items-center gap-0.5 text-[9px] text-blue-600 font-bold"><MinusCircle className="w-3 h-3" />Thống nhất</span>}
                          {status === 'increased'&& <span className="flex items-center gap-0.5 text-[9px] text-red-600 font-bold"><AlertCircle className="w-3 h-3" />Tăng giá</span>}
                          <button
                            onClick={() => onSelectInspectorItem(origIdx)}
                            className="px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                          >
                            Soi Chi Tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  const colors = {
    slate:   'border-slate-200  text-slate-800',
    blue:    'border-blue-200   text-[#003366]',
    emerald: 'border-emerald-200 text-emerald-700',
    purple:  'border-purple-200  text-purple-700',
  };
  return (
    <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${colors[color]}`}>
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">{label}</span>
      <p className="text-lg font-extrabold font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
