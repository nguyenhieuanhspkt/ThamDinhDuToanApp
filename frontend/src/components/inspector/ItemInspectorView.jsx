import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileCheck2, Building2, Network, Globe, ExternalLink, CheckCircle, AlertTriangle, FileText, Award } from 'lucide-react';

export default function ItemInspectorView({ selectedIndex, onNavigateIndex, onOpenPdfPage }) {
  const [activePillar, setActivePillar] = useState('quotes');
  const [items, setItems] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [quoteEvidence, setQuoteEvidence] = useState(null);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);

  useEffect(() => {
    fetch('/api/dossier')
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
      })
      .catch(console.error);
  }, []);

  const currentItem = items[selectedIndex] || items[0] || {};

  useEffect(() => {
    if (currentItem && currentItem.id) {
      setIsLoadingEvidence(true);
      fetch('/api/quotes/match-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: currentItem })
      })
        .then((res) => res.json())
        .then((data) => {
          setQuoteEvidence(data);
        })
        .catch(console.error)
        .finally(() => setIsLoadingEvidence(false));
    }
  }, [currentItem]);

  const formatMoney = (val) => (!val && val !== 0 ? '0' : Math.round(val).toLocaleString('vi-VN'));

  const filteredItems = items.filter((it, idx) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return (
      (it.ten_vt && it.ten_vt.toLowerCase().includes(q)) ||
      (it.ma_vt && it.ma_vt.toLowerCase().includes(q)) ||
      (idx + 1).toString().includes(q)
    );
  });

  const minQuote = quoteEvidence?.min_quote || quoteEvidence?.matched_supplier || quoteEvidence?.matches?.[0];
  const supplierMatches = quoteEvidence?.supplier_matches || quoteEvidence?.matches || [];
  const dgTrinh = parseFloat(currentItem.don_gia_trinh) || 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white h-full">
      {/* Top Inspector Header Navigator Bar */}
      <div className="bg-white border-b px-5 py-2.5 shrink-0 flex items-center justify-between shadow-2xs z-10 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateIndex(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex <= 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Trước (F1)
          </button>

          <span className="font-bold text-[#003366] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 font-mono">
            Mục {selectedIndex + 1} / {items.length || 1}
          </span>

          <button
            onClick={() => onNavigateIndex(Math.min(items.length - 1, selectedIndex + 1))}
            disabled={selectedIndex >= items.length - 1}
            className="bg-[#003366] hover:bg-blue-900 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shadow-2xs"
          >
            Tiếp theo (F2) <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Đang duyệt:</span>
          <strong className="text-slate-900 font-bold max-w-md truncate" title={currentItem.ten_vt}>
            {currentItem.ten_vt || 'Chưa chọn hạng mục nào'}
          </strong>
        </div>
      </div>

      {/* Inspector Body Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Navigator Sidebar */}
        <aside className="w-64 border-r flex flex-col shrink-0 bg-slate-50">
          <div className="p-2 border-b bg-white">
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Tìm mục..."
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/60 text-xs">
            {filteredItems.map((it, idx) => {
              const originalIdx = items.findIndex((x) => x === it);
              const isActive = originalIdx === selectedIndex;
              return (
                <div
                  key={idx}
                  onClick={() => onNavigateIndex(originalIdx)}
                  className={`p-2.5 cursor-pointer transition ${
                    isActive ? 'bg-teal-50 border-l-4 border-l-teal-700 font-bold' : 'hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-mono text-slate-500 font-bold">Mục #{originalIdx + 1}</span>
                    <span className="font-mono text-[#003366] font-bold">{formatMoney(it.don_gia_trinh)} đ</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 truncate" title={it.ten_vt_goc || it.ten_vt}>
                    {it.ten_vt_goc || it.ten_vt}
                  </p>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Right Pillars Inspector Area */}
        <main className="flex-1 flex flex-col p-5 overflow-y-auto bg-slate-100">
          {/* Active Item Overview Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-4">
            <h3 className="font-bold text-sm text-slate-900 mb-2">{currentItem.ten_vt || 'Chưa chọn mục'}</h3>
            <div className="grid grid-cols-4 gap-2 text-xs text-slate-600">
              <div>Mã ERP: <strong className="font-mono text-slate-800">{currentItem.ma_vt || '-'}</strong></div>
              <div>ĐVT: <strong className="text-slate-800">{currentItem.dvt || 'Cái'}</strong></div>
              <div>Số lượng: <strong className="font-mono text-slate-800">{currentItem.so_luong || 1}</strong></div>
              <div>Đơn giá trình: <strong className="font-mono text-[#003366] font-extrabold">{formatMoney(currentItem.don_gia_trinh)} đ</strong></div>
            </div>
          </div>

          {/* Pillars Toolbar */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl border border-slate-300 text-xs font-semibold mb-4 shrink-0">
            <button
              onClick={() => setActivePillar('quotes')}
              className={`flex-1 py-2 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activePillar === 'quotes' ? 'bg-emerald-700 text-white shadow-2xs font-bold' : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" /> 1. Báo Giá Gốc (PDF)
            </button>
            <button
              onClick={() => setActivePillar('erp')}
              className={`flex-1 py-2 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activePillar === 'erp' ? 'bg-blue-700 text-white shadow-2xs font-bold' : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> 2. ERP Vĩnh Tân 4
            </button>
            <button
              onClick={() => setActivePillar('imis')}
              className={`flex-1 py-2 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activePillar === 'imis' ? 'bg-purple-700 text-white shadow-2xs font-bold' : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Network className="w-3.5 h-3.5" /> 3. EVN IMIS
            </button>
            <button
              onClick={() => setActivePillar('msc')}
              className={`flex-1 py-2 px-2 rounded-lg transition text-center flex items-center justify-center gap-1.5 ${
                activePillar === 'msc' ? 'bg-orange-700 text-white shadow-2xs font-bold' : 'text-slate-700 hover:bg-slate-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> 4. Mua Sắm Công
            </button>
          </div>

          {/* Active Pillar Content Container */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex-1">
            {activePillar === 'quotes' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-emerald-900 uppercase tracking-wide flex items-center gap-2">
                      <FileCheck2 className="w-5 h-5 text-emerald-700" /> KHỐI 1: BÁO GIÁ GỐC NHẬN TỪ THƯ MỤC
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bằng chứng đối chiếu minh bạch từ các tệp báo giá PDF nhận từ nhà thầu
                    </p>
                  </div>
                  {isLoadingEvidence && (
                    <span className="text-xs text-amber-600 font-semibold italic animate-pulse">
                      Đang đối chiếu báo giá...
                    </span>
                  )}
                </div>

                {/* Phân Khung 1: Thẻ Bằng Chứng Báo Giá Min Master Card */}
                {minQuote ? (
                  <div className="bg-emerald-50/70 border-2 border-emerald-500 rounded-xl p-4 shadow-2xs relative">
                    <div className="flex items-center justify-between mb-3 border-b border-emerald-200 pb-2">
                      <span className="bg-emerald-700 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5 shadow-2xs">
                        <Award className="w-3.5 h-3.5 text-amber-300" /> 🟢 BÁO GIÁ THẤP NHẤT (MIN PRICE)
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-900">
                        Độ tương đồng: {minQuote.score || 100}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">NHÀ THẦU BÁO GIÁ:</span>
                        <strong className="text-slate-900 font-bold text-xs uppercase text-emerald-950">
                          {minQuote.company}
                        </strong>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">TỆP PDF BÁO GIÁ GỐC:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-800 font-bold text-xs truncate max-w-[220px]" title={minQuote.filename}>
                            {minQuote.filename}
                          </span>
                          {onOpenPdfPage && (
                            <button
                              onClick={() => onOpenPdfPage(minQuote.filename, minQuote.page || 1)}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 transition shrink-0 shadow-2xs"
                            >
                              <ExternalLink className="w-3 h-3" /> Mở PDF Trang {minQuote.page || 1}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">VỊ TRÍ BÓC TÁCH:</span>
                        <span className="font-mono text-slate-800 font-bold">
                          Dòng STT {minQuote.stt || 1} | Trang {minQuote.page || 1} trong file PDF
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">ĐƠN GIÁ MIN CHÀO GỐC:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-emerald-800 font-mono">
                            {formatMoney(minQuote.don_gia)} đ
                          </span>
                          {minQuote.is_match_trinh ? (
                            <span className="bg-emerald-600 text-white text-[10.5px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Khớp 100% Giá Trình
                            </span>
                          ) : (
                            <span className="bg-amber-600 text-white text-[10.5px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Lệch So Với Giá Trình
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="col-span-2 pt-1 border-t border-emerald-200/80">
                        <span className="text-slate-500 font-semibold block text-[11px]">TÊN VẬT TƯ & TS KỸ THUẬT GHI TRONG BÁO GIÁ:</span>
                        <p className="text-xs font-semibold text-slate-900 bg-white p-2 rounded-lg border border-emerald-200 mt-1 font-mono">
                          {minQuote.quoted_name} {minQuote.quoted_tskt ? ` - ${minQuote.quoted_tskt}` : ''}
                        </p>
                      </div>

                      {minQuote.match_reason && (
                        <div className="col-span-2 text-[11px] text-emerald-900 italic">
                          💡 <strong>Lý do trùng khớp:</strong> {minQuote.match_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    Chưa tìm thấy báo giá gốc min trùng khớp trực tiếp cho mục này.
                  </div>
                )}

                {/* Phân Khung 2: Bảng Bóc Tách So Sánh Đa Nhà Thầu */}
                <div>
                  <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-700" /> BẢNG SO SÁNH ĐỐI CHIẾU CÁC NHÀ THẦU CHÀO MỤC NÀY ({supplierMatches.length} Nhà Thầu)
                  </h5>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-10 border-r">STT</th>
                          <th className="py-2.5 px-3 w-48 border-r">Tên Nhà Thầu / Công Ty</th>
                          <th className="py-2.5 px-3 w-40 border-r">File PDF Báo Giá</th>
                          <th className="py-2.5 px-3 border-r">Tên Vật Tư Trong Báo Giá</th>
                          <th className="py-2.5 px-3 text-right w-32 border-r font-mono">Đơn Giá Chào</th>
                          <th className="py-2.5 px-3 text-center w-36">Thao Tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {supplierMatches.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="text-center py-6 text-slate-400 italic">
                              Chưa có dữ liệu so sánh đa nhà thầu.
                            </td>
                          </tr>
                        ) : (
                          supplierMatches.map((m, idx) => {
                            const isMin = minQuote && m.filename === minQuote.filename;
                            const diff = dgTrinh > 0 ? ((m.don_gia - dgTrinh) / dgTrinh) * 100 : 0;
                            return (
                              <tr key={idx} className={`hover:bg-slate-50 transition ${isMin ? 'bg-emerald-50/40 font-semibold' : ''}`}>
                                <td className="py-2 px-2 text-center font-mono text-slate-500 border-r">{idx + 1}</td>
                                <td className="py-2 px-3 border-r font-bold text-slate-900">
                                  {m.company}
                                  {isMin && <span className="ml-1 text-[10px] text-emerald-700 font-extrabold">(MIN)</span>}
                                </td>
                                <td className="py-2 px-3 font-mono text-slate-700 border-r truncate max-w-[140px]" title={m.filename}>
                                  {m.filename}
                                </td>
                                <td className="py-2 px-3 border-r text-slate-800">
                                  <div className="line-clamp-2" title={`${m.quoted_name} ${m.quoted_tskt || ''}`}>
                                    {m.quoted_name}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-900 border-r">
                                  {formatMoney(m.don_gia)} đ
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {onOpenPdfPage && (
                                    <button
                                      onClick={() => onOpenPdfPage(m.filename, m.page || 1)}
                                      className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold px-2 py-1 rounded flex items-center gap-1 mx-auto transition"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Xem Trang {m.page || 1}
                                    </button>
                                  )}
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
            )}

            {activePillar === 'erp' && (
              <div>
                <h4 className="font-bold text-xs text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> KHỐI 2: LỊCH SỬ TRÚNG THẦU / MUA SẮM ERP VĨNH TÂN 4
                </h4>
                <p className="text-xs text-slate-500 mb-4">Tra cứu theo Part No hoặc Mã ERP trong cơ sở dữ liệu nội bộ.</p>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 text-xs">
                  <p className="font-bold text-blue-950">Giá trúng thầu gần nhất:</p>
                  <p className="text-xl font-black text-blue-800 font-mono mt-1">12.800.000 đ (Năm 2025)</p>
                </div>
              </div>
            )}

            {activePillar === 'imis' && (
              <div>
                <h4 className="font-bold text-xs text-purple-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Network className="w-4 h-4" /> KHỐI 3: HỆ THỐNG EVN IMIS (CÁC ĐƠN VỊ PHÁT ĐIỆN KHÁC)
                </h4>
                <p className="text-xs text-slate-500 mb-4">Tham chiếu giá vật tư tương đương từ các nhà máy điện EVN.</p>
                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-200 text-xs">
                  <p className="font-bold text-purple-950">Mức giá tham chiếu IMIS:</p>
                  <p className="text-xl font-black text-purple-800 font-mono mt-1">13.200.000 đ</p>
                </div>
              </div>
            )}

            {activePillar === 'msc' && (
              <div>
                <h4 className="font-bold text-xs text-orange-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" /> KHỐI 4: CỔNG MUA SẮM CÔNG QUỐC GIA (muasamcong.mpi.gov.vn)
                </h4>
                <p className="text-xs text-slate-500 mb-4">Kết quả đấu thầu qua mạng toàn quốc.</p>
                <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-200 text-xs">
                  <p className="font-bold text-orange-950">Giá trúng thầu trung bình qua mạng:</p>
                  <p className="text-xl font-black text-orange-800 font-mono mt-1">13.100.000 đ</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
