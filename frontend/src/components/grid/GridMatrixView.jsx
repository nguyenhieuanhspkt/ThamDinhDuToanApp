import React, { useState, useEffect } from 'react';
import { Table2, Plus, FileSpreadsheet, Layers, Search, CheckCircle2, Filter, ArrowUpDown, Download } from 'lucide-react';

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
      const total_thong_nhat = list.reduce((acc, it) => acc + (parseFloat(it.thanh_tien_thong_nhat) || (it.so_luong * it.don_gia_thong_nhat) || 0), 0);
      setStats({
        total_items: list.length,
        total_trinh,
        total_thong_nhat
      });
    } catch (e) {
      console.error("Lỗi fetch grid data:", e);
    }
  };

  useEffect(() => {
    fetchGridData();
  }, []);

  const formatMoney = (val) => {
    if (!val && val !== 0) return '0';
    return Math.round(val).toLocaleString('vi-VN');
  };

  const formatTax = (val) => {
    if (!val && val !== 0) return '8%';
    if (typeof val === 'number') {
      return val < 1 ? `${Math.round(val * 100)}%` : `${val}%`;
    }
    return val.toString().includes('%') ? val : `${val}%`;
  };

  const filteredItems = items.filter((it, idx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (it.ten_vt_goc || it.ten_vt || '').toLowerCase();
    const maErp = (it.ma_vt || '').toLowerCase();
    const pyc = (it.pycvt || '').toLowerCase();
    const tskt = (it.thong_so_kt || it.part_no || '').toLowerCase();
    const sttStr = (it.stt || idx + 1).toString();
    return name.includes(q) || maErp.includes(q) || pyc.includes(q) || tskt.includes(q) || sttStr.includes(q);
  });

  return (
    <div className="flex-1 flex flex-col p-5 overflow-hidden bg-slate-100 h-full">
      {/* Top Stats Overview Header Cards */}
      <div className="grid grid-cols-4 gap-4 mb-4 shrink-0">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng số danh mục:</span>
          <p className="text-xl font-extrabold text-slate-800 mt-0.5 font-mono">{stats.total_items} mục</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng giá trị đề nghị (Trình):</span>
          <p className="text-xl font-extrabold text-[#003366] mt-0.5 font-mono">{formatMoney(stats.total_trinh)} đ</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng giá trị thống nhất:</span>
          <p className="text-xl font-extrabold text-emerald-700 mt-0.5 font-mono">{formatMoney(stats.total_thong_nhat)} đ</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Giá trị giảm trừ tiết kiệm:</span>
          <p className="text-xl font-extrabold text-purple-700 mt-0.5 font-mono">
            {formatMoney(stats.total_trinh - stats.total_thong_nhat)} đ
          </p>
        </div>
      </div>

      {/* Grid Table Container (2026 Enterprise Standards) */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col overflow-hidden">
        {/* Table Controls Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wide">
              <Table2 className="w-4 h-4 text-teal-700" />
              <span>Bảng Ma Trận Dự Toán Thẩm Định 13 Cột Chuẩn 2026</span>
            </div>
            <span className="bg-teal-100 text-teal-800 text-[10.5px] px-2 py-0.5 rounded-full font-bold">
              {filteredItems.length} / {items.length} mục
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Filter Input Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên vật tư, mã ERP, PYCVT..."
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-64 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => window.location.href = '/api/export-excel'}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel 13 Cột
            </button>
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1400px]">
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 shadow-2xs">
              <tr>
                {/* Fixed Left Sticky Headers */}
                <th className="py-3 px-2 text-center w-12 sticky left-0 bg-slate-100 border-r border-slate-200 z-30">1. STT</th>
                <th className="py-3 px-2.5 text-center w-28 sticky left-12 bg-slate-100 border-r border-slate-200 z-30">2. PYCVT</th>
                <th className="py-3 px-3 w-60 sticky left-40 bg-slate-100 border-r border-slate-200 z-30 shadow-2xs">3. Tên vật tư</th>

                {/* Normal Scrollable Headers */}
                <th className="py-3 px-3 w-64 border-r border-slate-200">4. Thông số kỹ thuật</th>
                <th className="py-3 px-2 text-center w-14 border-r border-slate-200">5. ĐVT</th>
                <th className="py-3 px-2 text-right w-16 border-r border-slate-200">6. SL Mua</th>
                <th className="py-3 px-3 w-32 border-r border-slate-200">7. HSX / XX</th>
                <th className="py-3 px-3 text-center w-36 border-r border-slate-200 font-mono">8. Mã ERP</th>

                {/* Highlighted Monetary Headers */}
                <th className="py-3 px-3 text-right w-32 border-r border-slate-200 bg-blue-50/80 text-[#003366] font-extrabold">9. Đơn giá min</th>
                <th className="py-3 px-3 text-right w-36 border-r border-slate-200 bg-blue-50/60 text-[#003366] font-extrabold">10. Thành tiền</th>
                <th className="py-3 px-2 text-center w-14 border-r border-slate-200">11. Thuế</th>
                <th className="py-3 px-3 text-right w-32 border-r border-slate-200">12. Tiền thuế</th>
                <th className="py-3 px-3 w-52 border-r border-slate-200">13. Ghi chú</th>

                {/* Fixed Right Sticky Action Header */}
                <th className="py-3 px-2 text-center w-24 sticky right-0 bg-slate-100 border-l border-slate-200 z-30 shadow-2xs">Thao tác</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="14" className="text-center py-16 text-slate-400 text-xs italic">
                    {searchQuery ? `Không tìm thấy mục vật tư nào khớp với từ khóa "${searchQuery}".` : 'Chưa có dòng dự toán nào trong hồ sơ. Hãy nạp file Excel mẫu 13 cột.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((it, idx) => {
                  const originalIndex = items.indexOf(it);
                  const sl = parseFloat(it.so_luong) || 1;
                  const dgMin = parseFloat(it.don_gia_trinh) || 0;
                  const thanhTien = parseFloat(it.thanh_tien_trinh) || (sl * dgMin);
                  const thueVal = parseFloat(it.thue) || 0.08;
                  const tienThue = parseFloat(it.tien_thue) || (thanhTien * thueVal);
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={idx}
                      className={`group transition hover:bg-teal-50/70 ${isEven ? 'bg-white' : 'bg-slate-50/40'}`}
                    >
                      {/* Fixed Left Sticky Cells */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 sticky left-0 bg-white group-hover:bg-teal-50 border-r border-slate-200 font-medium">
                        {it.stt || originalIndex + 1}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono text-slate-700 sticky left-12 bg-white group-hover:bg-teal-50 border-r border-slate-200 text-[11px] font-semibold">
                        {it.pycvt || '-'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 sticky left-40 bg-white group-hover:bg-teal-50 border-r border-slate-200 shadow-2xs">
                        <div className="line-clamp-2" title={it.ten_vt_goc || it.ten_vt}>
                          {it.ten_vt_goc || it.ten_vt || ''}
                        </div>
                      </td>

                      {/* Normal Scrollable Cells */}
                      <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 text-[11px]">
                        <div className="line-clamp-2" title={it.thong_so_kt || it.part_no}>
                          {it.thong_so_kt || it.part_no || '-'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-slate-200 text-slate-700 font-medium">{it.dvt || 'Cái'}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">{sl}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600 truncate max-w-[120px]" title={it.hsx_xx}>
                        {it.hsx_xx || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 border-r border-slate-200 text-[11px]">
                        {it.ma_vt || '-'}
                      </td>

                      {/* Highlighted Monospace Monetary Cells */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#003366] border-r border-slate-200 bg-blue-50/30 group-hover:bg-teal-50">
                        {formatMoney(dgMin)} đ
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-teal-900 border-r border-slate-200 bg-blue-50/20 group-hover:bg-teal-50">
                        {formatMoney(thanhTien)} đ
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-600 border-r border-slate-200">{formatTax(it.thue)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-200 font-semibold">{formatMoney(tienThue)} đ</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600">
                        <div className="line-clamp-2" title={it.ghi_chu}>
                          {it.ghi_chu || '-'}
                        </div>
                      </td>

                      {/* Fixed Right Sticky Action Cell */}
                      <td className="py-2.5 px-2 text-center sticky right-0 bg-white group-hover:bg-teal-50 border-l border-slate-200 shadow-2xs">
                        <button
                          onClick={() => onSelectInspectorItem(originalIndex)}
                          className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[11px] font-bold transition shadow-2xs flex items-center gap-1 mx-auto"
                        >
                          Soi Chi Tiết
                        </button>
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
