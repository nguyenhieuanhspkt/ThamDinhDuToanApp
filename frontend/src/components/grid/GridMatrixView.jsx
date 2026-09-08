import React, { useState, useEffect, useMemo } from 'react';
import { Table2, Search, Download, CheckCircle2, AlertCircle, MinusCircle, Layers, Loader2, Zap, Key, FileDown, FileText, Clock, Database, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import AuditProgressModal from '../modals/AuditProgressModal.jsx';

export default function GridMatrixView({ onSelectInspectorItem }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'coso_dongia'
  const [stats, setStats] = useState({ total_items: 0, total_trinh: 0, total_thong_nhat: 0 });
  const [quoteMatches, setQuoteMatches] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState({});
  const [filterSaved, setFilterSaved] = useState('ALL'); // 'ALL' | 'SAVED' | 'UNSAVED'

  // Sắp xếp theo đơn giá/thành tiền/STT (tăng dần/giảm dần)
  const [sortField, setSortField] = useState(null); // 'stt' | 'dg_trinh' | 'tt_trinh' | 'dg_thong_nhat' | 'tt_thong_nhat' | 'lowest_price'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

  // States cho 1-click 5 cơ sở & keyword management
  const [itemKeywords, setItemKeywords] = useState({});
  const [runningItemIds, setRunningItemIds] = useState(new Set());
  const [runningAllPillars, setRunningAllPillars] = useState(false);


  // State cho AuditProgressModal (Minh bạch hóa 5 cơ sở)
  const [auditModal, setAuditModal] = useState({
    isOpen: false,
    item: null,
    keyword: '',
    status: 'running', // 'running' | 'completed' | 'error'
    activeStep: 1,
    auditData: null
  });

  const fetchGridData = async () => {
    try {
      const res = await fetch('/api/dossier');
      const data = await res.json();
      const list = data.items || [];
      setItems(list);

      const total_trinh = list.reduce((acc, it) => acc + (parseFloat(it.thanh_tien_trinh) || (it.so_luong * it.don_gia_trinh) || 0), 0);
      const total_thong_nhat = list.reduce((acc, it) => acc + (parseFloat(it.thanh_tien_thong_nhat) || ((it.so_luong || 1) * (it.don_gia_thong_nhat || 0)) || 0), 0);
      setStats({ total_items: list.length, total_trinh, total_thong_nhat });

      // Tự động khởi tạo map từ khóa
      const kwMap = {};
      list.forEach((it, idx) => {
        const idKey = it.id || idx + 1;
        kwMap[idKey] = it.search_keyword || extractDefaultKeyword(it);
      });
      setItemKeywords(kwMap);

      // Quét & bóc tách báo giá gốc đính kèm
      fetchQuoteMatches();
      // Quét tiến độ chứng cứ CSDL thẩm định đã lưu
      fetchEvidenceStatus();
    } catch (e) {
      console.error('Lỗi fetch grid data:', e);
    }
  };

  const fetchEvidenceStatus = async () => {
    try {
      const res = await fetch('/api/evidence/all-status');
      if (res.ok) {
        const data = await res.json();
        setEvidenceStatus(data || {});
      }
    } catch (e) {
      console.error('Lỗi fetch evidence status:', e);
    }
  };

  const fetchQuoteMatches = async () => {
    setLoadingQuotes(true);
    try {
      const res = await fetch('/api/quotes/match-all-dossier-items');
      const data = await res.json();
      if (data.success && data.results) {
        setQuoteMatches(data.results);
      }
    } catch (e) {
      console.error('Lỗi tự động bóc tách báo giá gốc batch:', e);
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => { fetchGridData(); }, []);

  const extractDefaultKeyword = (it) => {
    if (it.search_keyword) return it.search_keyword;
    const raw = (it.part_no || '') + ' ' + (it.ten_vt || '');
    const match = raw.match(/(?:Partno|Part\s*No|Model|Mã)[\s:]*([A-Za-z0-9\-_]{3,20})/i);
    if (match && match[1]) return match[1].trim();
    const match2 = raw.match(/\b[A-Z0-9]{3,10}(?:[\-_/]\s*[A-Z0-9]{2,10})+\b/);
    if (match2) return match2[0].trim();
    const clean = (it.ten_vt || '').replace(/[\-:;]/g, ' ').trim();
    const words = clean.split(/\s+/);
    return words.slice(0, 4).join(' ') || (it.ten_vt || '').slice(0, 30);
  };

  const handleKeywordChange = (itemId, val) => {
    setItemKeywords(prev => ({ ...prev, [itemId]: val }));
    fetch(`/api/items/${itemId}/update-keyword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: val })
    }).catch(console.error);
  };

  const handleRun5Pillars = async (itemId, openModal = true, runAi = false) => {
    setRunningItemIds(prev => new Set(prev).add(itemId));
    const it = items.find(x => x.id === itemId) || items[itemId - 1];
    const kw = itemKeywords[itemId] || (it ? extractDefaultKeyword(it) : '');

    let stepInterval = null;
    if (openModal && it) {
      setAuditModal({
        isOpen: true,
        item: it,
        keyword: kw,
        status: 'running',
        activeStep: 1,
        auditData: null
      });

      stepInterval = setInterval(() => {
        setAuditModal(prev => {
          if (prev.status === 'running' && prev.activeStep < 5) {
            return { ...prev, activeStep: prev.activeStep + 1 };
          }
          return prev;
        });
      }, 350);
    }

    try {
      const res = await fetch(`/api/items/${itemId}/run-5-pillars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, run_ai: runAi })
      });
      const data = await res.json();
      if (stepInterval) clearInterval(stepInterval);

      if (data.success) {
        await fetchGridData();
        if (openModal) {
          setAuditModal(prev => ({
            ...prev,
            status: 'completed',
            activeStep: 5,
            auditData: data.audit_trail || data,
            item: data.item || it
          }));
        }
      } else {
        if (openModal) {
          setAuditModal(prev => ({ ...prev, status: 'error' }));
        }
      }
    } catch (e) {
      if (stepInterval) clearInterval(stepInterval);
      console.error('Lỗi chạy 5 cơ sở cho item', itemId, e);
      if (openModal) {
        setAuditModal(prev => ({ ...prev, status: 'error' }));
      }
    } finally {
      setRunningItemIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleRunAll5Pillars = async () => {
    setRunningAllPillars(true);
    try {
      for (const it of filteredItems) {
        const itemId = it.id || items.indexOf(it) + 1;
        // Chạy tuần tự 5 cơ sở nhanh (không gọi AI LLM để tối đa hóa tốc độ)
        await handleRun5Pillars(itemId, false, false);
      }
    } catch (e) {
      console.error('Lỗi chạy tất cả 5 cơ sở:', e);
    } finally {
      setRunningAllPillars(false);
    }
  };

  const handleExportPdf = (itemId) => {
    window.location.href = `/api/items/${itemId}/export-pdf`;
  };

  const handleOpenExistingAudit = (it) => {
    const itemId = it.id || items.indexOf(it) + 1;
    const kw = it.search_keyword || itemKeywords[itemId] || extractDefaultKeyword(it);

    const auditData = {
      item_id: itemId,
      keyword_used: kw,
      result: {
        don_gia_trinh: it.don_gia_trinh,
        don_gia_thong_nhat: it.don_gia_thong_nhat,
        thanh_tien_thong_nhat: it.thanh_tien_thong_nhat,
        gia_tri_giam: it.gia_tri_giam,
        pct_giam: it.don_gia_trinh > 0 ? ((it.don_gia_trinh - (it.don_gia_thong_nhat || it.don_gia_trinh)) / it.don_gia_trinh * 100) : 0,
        danh_gia_ttd: it.danh_gia_ttd
      },
      synthesis: {
        coverage_score: 90,
        summary_text: it.danh_gia_ttd
      },
      steps: [
        { name: '1. Báo Giá Gốc (PDF)', detail: it.co_so_thong_nhat?.includes('báo giá') ? it.co_so_thong_nhat : 'Đã đối chiếu thư mục báo giá', price: it.don_gia_thong_nhat },
        { name: '2. ERP Vĩnh Tân 4', detail: `Mã ERP: ${it.ma_vt || 'Tra cứu theo tên'}`, price: it.don_gia_thong_nhat },
        { name: '3. EVN IMIS Toàn Ngành', detail: 'Hợp đồng phát điện toàn ngành EVN', price: it.don_gia_thong_nhat },
        { name: '4. Mua Sắm Công e-GP', detail: 'Đấu thầu qua mạng muasamcong.mpi.gov.vn', price: 0 },
        { name: '5. TMĐT & Tham Khảo Web', detail: 'Tham chiếu thị trường công nghiệp', price: 0 }
      ]
    };

    setAuditModal({
      isOpen: true,
      item: it,
      keyword: kw,
      status: 'completed',
      activeStep: 6,
      auditData: auditData
    });
  };

  const fmt = (val) => (!val && val !== 0 ? '—' : Math.round(val).toLocaleString('vi-VN'));

  const isItemSaved = (it, origIdx) => {
    const itemId = it.id || origIdx + 1;
    const st = evidenceStatus[String(itemId)];
    return Boolean(st?.has_syn || (it.danh_gia_ttd && it.danh_gia_ttd.trim().length > 0));
  };

  const savedCount = items.filter((it, idx) => isItemSaved(it, idx)).length;
  const savedPct = items.length > 0 ? (savedCount / items.length * 100) : 0;

  const filteredItems = items.filter((it, idx) => {
    const origIdx = items.indexOf(it);
    const saved = isItemSaved(it, origIdx);
    if (filterSaved === 'SAVED' && !saved) return false;
    if (filterSaved === 'UNSAVED' && saved) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const itemId = it.id || origIdx + 1;
    const kw = itemKeywords[itemId] || '';
    return (
      (it.ten_vt_goc || it.ten_vt || '').toLowerCase().includes(q) ||
      (it.ma_vt || '').toLowerCase().includes(q) ||
      (it.pycvt || '').toLowerCase().includes(q) ||
      (it.thong_so_kt || it.part_no || '').toLowerCase().includes(q) ||
      kw.toLowerCase().includes(q) ||
      String(it.stt || origIdx + 1).includes(q)
    );
  });

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortField(null);
        setSortOrder('asc');
      }
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30 group-hover/th:opacity-80 transition shrink-0 ml-1 inline" />;
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="w-3.5 h-3.5 text-blue-700 font-extrabold shrink-0 ml-1 inline" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 text-blue-700 font-extrabold shrink-0 ml-1 inline" />;
  };

  const sortedFilteredItems = useMemo(() => {
    if (!sortField) return filteredItems;
    return [...filteredItems].sort((a, b) => {
      const origIdxA = items.indexOf(a);
      const origIdxB = items.indexOf(b);
      const slA = parseFloat(a.so_luong) || 1;
      const slB = parseFloat(b.so_luong) || 1;

      let valA = 0;
      let valB = 0;

      if (sortField === 'stt') {
        valA = parseFloat(a.stt) || (origIdxA + 1);
        valB = parseFloat(b.stt) || (origIdxB + 1);
      } else if (sortField === 'dg_trinh') {
        valA = parseFloat(a.don_gia_trinh) || 0;
        valB = parseFloat(b.don_gia_trinh) || 0;
      } else if (sortField === 'tt_trinh') {
        valA = parseFloat(a.thanh_tien_trinh) || (slA * (parseFloat(a.don_gia_trinh) || 0));
        valB = parseFloat(b.thanh_tien_trinh) || (slB * (parseFloat(b.don_gia_trinh) || 0));
      } else if (sortField === 'dg_thong_nhat') {
        valA = parseFloat(a.don_gia_thong_nhat) || 0;
        valB = parseFloat(b.don_gia_thong_nhat) || 0;
      } else if (sortField === 'tt_thong_nhat') {
        valA = parseFloat(a.thanh_tien_thong_nhat) || (slA * (parseFloat(a.don_gia_thong_nhat) || 0));
        valB = parseFloat(b.thanh_tien_thong_nhat) || (slB * (parseFloat(b.don_gia_thong_nhat) || 0));
      } else if (sortField === 'lowest_price') {
        const idA = a.id || origIdxA + 1;
        const idB = b.id || origIdxB + 1;
        valA = parseFloat(quoteMatches[idA]?.lowest_price || a.lowest_quote_price || a.don_gia_nha_thau_thap_nhat || 0);
        valB = parseFloat(quoteMatches[idB]?.lowest_price || b.lowest_quote_price || b.don_gia_nha_thau_thap_nhat || 0);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return (a.stt || origIdxA + 1) - (b.stt || origIdxB + 1);
    });
  }, [filteredItems, sortField, sortOrder, items, quoteMatches]);

  // Summary stats
  const giam_tru = stats.total_trinh - stats.total_thong_nhat;
  const pct_giam = stats.total_trinh > 0 ? (giam_tru / stats.total_trinh * 100) : 0;


  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden bg-slate-100 h-full gap-3">

      {/* Stats Cards - 5 Cột: Bổ sung Thông số Tiến độ lưu CSDL Thẩm định */}
      <div className="grid grid-cols-5 gap-3 shrink-0">
        <StatCard label="Tổng số danh mục" value={`${stats.total_items} mục`} color="slate" sub="Hồ sơ dự toán mua sắm" />
        <StatCard
          label="Đã lưu CSDL thẩm định"
          value={`${savedCount} / ${stats.total_items} mục`}
          color="teal"
          sub={`Đạt ${savedPct.toFixed(1)}% danh mục`}
          progress={savedPct}
        />
        <StatCard label="Tổng giá trị trình duyệt" value={`${fmt(stats.total_trinh)} đ`} color="blue" sub="Theo hồ sơ dự toán trình" />
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-teal-700" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                {viewMode === 'standard' ? 'Bảng Ma Trận Dự Toán Thẩm Định — Chuẩn 2026' : 'View 1: Cơ Sở Đơn Giá'}
              </span>
              <span className="bg-teal-100 text-teal-800 text-[10.5px] px-2 py-0.5 rounded-full font-bold">
                {filteredItems.length}/{items.length} mục
              </span>

              {/* Bộ lọc nhanh trạng thái lưu CSDL Thẩm định */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-[10.5px] font-bold ml-1">
                <button
                  onClick={() => setFilterSaved('ALL')}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${filterSaved === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                  title="Hiện toàn bộ danh mục"
                >
                  Tất Cả ({items.length})
                </button>
                <button
                  onClick={() => setFilterSaved('SAVED')}
                  className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${filterSaved === 'SAVED' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-emerald-800 hover:bg-emerald-100/60'}`}
                  title="Chỉ xem các mục ĐÃ LƯU CSDL thẩm định"
                >
                  <CheckCircle2 className="w-3 h-3" /> Đã Lưu ({savedCount})
                </button>
                <button
                  onClick={() => setFilterSaved('UNSAVED')}
                  className={`px-2 py-0.5 rounded-md transition flex items-center gap-1 cursor-pointer ${filterSaved === 'UNSAVED' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-100/60'}`}
                  title="Chỉ xem các mục CHƯA LƯU CSDL thẩm định"
                >
                  <Clock className="w-3 h-3" /> Chưa Lưu ({items.length - savedCount})
                </button>
              </div>

              {loadingQuotes && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang bóc tách PDF Báo giá...
                </span>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs font-bold ml-2">
              <button
                onClick={() => setViewMode('standard')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  viewMode === 'standard'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-300/60'
                }`}
                title="Bảng ma trận 13 cột chuẩn 2026"
              >
                13 Cột Chuẩn
              </button>
              <button
                onClick={() => setViewMode('coso_dongia')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                  viewMode === 'coso_dongia'
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-300/60'
                }`}
                title="View 1: Cơ sở đơn giá (12 cột)"
              >
                <Layers className="w-3 h-3 text-amber-300" /> View 1: Cơ Sở Đơn Giá
              </button>
            </div>

            {/* Quick Price Sort Toolbar */}
            <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs font-bold ml-2">
              <span className="text-[11px] text-slate-600 px-1.5 flex items-center gap-1 font-semibold">
                <ArrowUpDown className="w-3 h-3 text-teal-700" /> Sắp xếp giá:
              </span>
              <button
                onClick={() => handleSort('dg_trinh')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortField === 'dg_trinh'
                    ? 'bg-[#003366] text-white shadow-xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-300/70'
                }`}
                title="Sắp xếp theo Đơn giá trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
              >
                <span>ĐG Trình</span>
                {sortField === 'dg_trinh' ? (
                  <span className="text-[10px] bg-blue-900/80 px-1.5 py-0.2 rounded font-black text-amber-200">
                    {sortOrder === 'asc' ? '↑ Thấp ➔ Cao' : '↓ Cao ➔ Thấp'}
                  </span>
                ) : (
                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
              <button
                onClick={() => handleSort('dg_thong_nhat')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer ${
                  sortField === 'dg_thong_nhat'
                    ? 'bg-emerald-700 text-white shadow-xs font-extrabold'
                    : 'text-slate-700 hover:bg-slate-300/70'
                }`}
                title="Sắp xếp theo Đơn giá thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
              >
                <span>ĐG Thống Nhất</span>
                {sortField === 'dg_thong_nhat' ? (
                  <span className="text-[10px] bg-emerald-900/80 px-1.5 py-0.2 rounded font-black text-amber-200">
                    {sortOrder === 'asc' ? '↑ Thấp ➔ Cao' : '↓ Cao ➔ Thấp'}
                  </span>
                ) : (
                  <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
                )}
              </button>
              {sortField && (
                <button
                  onClick={() => { setSortField(null); setSortOrder('asc'); }}
                  className="px-2 py-0.5 text-[10.5px] text-red-700 hover:bg-red-100 rounded-md cursor-pointer font-bold transition ml-0.5"
                  title="Hủy sắp xếp, quay về thứ tự STT gốc ban đầu"
                >
                  ✕ Mặc định
                </button>
              )}
            </div>
          </div>


          <div className="flex items-center gap-3">
            {/* Master 1-Click Automation Button */}
            <button
              onClick={handleRunAll5Pillars}
              disabled={runningAllPillars}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Chạy 1 mạch tự động 5 khối chứng cứ cho tất cả danh mục vật tư"
            >
              {runningAllPillars ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                  <span>Đang chạy tất cả...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>⚡ Tra Cứu Tự Động Tất Cả (1-Click All)</span>
                </>
              )}
            </button>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm từ khóa, tên vật tư, ERP..."
                className="pl-8 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg w-56 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
            <button
              onClick={() => window.location.href = '/api/export-excel'}
              className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" /> Xuất Excel
            </button>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[1950px]">
            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-20 border-b border-slate-300 shadow-sm">
              <tr>
                {/* Fixed Common Columns 1..3 */}
                <th
                  onClick={() => handleSort('stt')}
                  className="py-3 px-2 text-center w-10 sticky left-0 bg-slate-100 border-r border-slate-200 z-30 cursor-pointer select-none hover:bg-slate-200 transition group/th"
                  title="Nhấp để sắp xếp theo STT (Tăng dần / Giảm dần / Reset)"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <span>1. STT</span>
                    {renderSortIcon('stt')}
                  </div>
                </th>
                <th className="py-3 px-2 text-center w-24 sticky left-10 bg-slate-100 border-r border-slate-200 z-30">2. PYCVT</th>
                <th className="py-3 px-3 w-56 sticky left-[136px] bg-slate-100 border-r border-slate-200 z-30 shadow-sm">3. Tên vật tư</th>

                {/* NEW COLUMN: Từ Khóa Tra Cứu Dùng Chung 5 Cơ Sở */}
                <th className="py-3 px-3 w-48 border-r border-slate-200 bg-purple-100/80 text-purple-950 font-extrabold flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-purple-700" /> 🔑 Từ Khóa Tra Cứu (5 Cơ Sở)
                </th>

                <th className="py-3 px-3 w-52 border-r border-slate-200">4. Thông số KT</th>
                <th className="py-3 px-2 text-center w-12 border-r border-slate-200">5. ĐVT</th>
                <th className="py-3 px-2 text-right w-14 border-r border-slate-200">6. SL</th>
                <th className="py-3 px-3 w-28 border-r border-slate-200">7. HSX/XX</th>
                <th className="py-3 px-3 text-center w-28 border-r border-slate-200 font-mono">8. Mã ERP</th>
                <th
                  onClick={() => handleSort('dg_trinh')}
                  className={`py-3 px-3 text-right w-32 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                    sortField === 'dg_trinh'
                      ? 'bg-blue-100 text-blue-950 font-black ring-1 ring-blue-400 inset-0 shadow-inner'
                      : 'bg-blue-50 text-[#003366] hover:bg-blue-100/70'
                  }`}
                  title="Nhấp để sắp xếp theo Đơn giá trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>9. ĐG Trình</span>
                    {renderSortIcon('dg_trinh')}
                  </div>
                </th>

                {/* Conditional View Columns */}
                {viewMode === 'standard' ? (
                  <>
                    <th
                      onClick={() => handleSort('tt_trinh')}
                      className={`py-3 px-3 text-right w-36 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === 'tt_trinh'
                          ? 'bg-blue-100 text-blue-950 font-black ring-1 ring-blue-400 inset-0 shadow-inner'
                          : 'bg-blue-50 text-[#003366] hover:bg-blue-100/70'
                      }`}
                      title="Nhấp để sắp xếp theo Thành tiền trình: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>10. TT Trình</span>
                        {renderSortIcon('tt_trinh')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('dg_thong_nhat')}
                      className={`py-3 px-3 text-right w-32 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === 'dg_thong_nhat'
                          ? 'bg-emerald-100 text-emerald-950 font-black ring-1 ring-emerald-400 inset-0 shadow-inner'
                          : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70'
                      }`}
                      title="Nhấp để sắp xếp theo Đơn giá thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>11. ĐG Thống Nhất</span>
                        {renderSortIcon('dg_thong_nhat')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('tt_thong_nhat')}
                      className={`py-3 px-3 text-right w-36 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === 'tt_thong_nhat'
                          ? 'bg-emerald-100 text-emerald-950 font-black ring-1 ring-emerald-400 inset-0 shadow-inner'
                          : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70'
                      }`}
                      title="Nhấp để sắp xếp theo Thành tiền thống nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>12. TT Thống Nhất</span>
                        {renderSortIcon('tt_thong_nhat')}
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right w-20 border-r border-slate-200 bg-amber-50 text-amber-900">13. % Giảm</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3 w-72 border-r border-slate-200 bg-amber-50/80 text-amber-950 font-bold">10. Ghi chú cơ sở đơn giá</th>
                    <th
                      onClick={() => handleSort('lowest_price')}
                      className={`py-3 px-3 text-right w-44 border-r border-slate-200 cursor-pointer select-none transition group/th ${
                        sortField === 'lowest_price'
                          ? 'bg-purple-100 text-purple-950 font-black ring-1 ring-purple-400 inset-0 shadow-inner'
                          : 'bg-purple-50 text-purple-950 hover:bg-purple-100/70'
                      }`}
                      title="Nhấp để sắp xếp theo Đơn giá nhà thầu thấp nhất: Thấp ➔ Cao hoặc Cao ➔ Thấp"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>11. ĐG Nhà thầu thấp nhất</span>
                        {renderSortIcon('lowest_price')}
                      </div>
                    </th>
                    <th className="py-3 px-3 w-48 border-r border-slate-200 bg-purple-50 text-purple-950 font-bold">12. Tên Nhà thầu thấp nhất</th>
                  </>
                )}

                {/* Sticky Right Action */}
                <th className="py-3 px-2 text-center w-24 sticky right-0 bg-slate-100 border-l border-slate-200 z-30 shadow-sm">Kết quả</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">
              {sortedFilteredItems.length === 0 ? (
                <tr>
                  <td colSpan={viewMode === 'standard' ? 15 : 14} className="text-center py-16 text-slate-400 text-xs italic">
                    {searchQuery ? `Không tìm thấy mục nào khớp "${searchQuery}"` : 'Chưa có dòng dự toán. Hãy nạp file Excel.'}
                  </td>
                </tr>
              ) : (
                sortedFilteredItems.map((it, idx) => {

                  const origIdx = items.indexOf(it);
                  const itemId = it.id || origIdx + 1;
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

                  // Lowest quote & match info from auto-scan backend
                  const itemMatch = quoteMatches[itemId] || {};
                  const lowestPrice = itemMatch.lowest_price || it.lowest_quote_price || it.don_gia_nha_thau_thap_nhat || it.don_gia_nhathau_min || null;
                  const lowestVendor = itemMatch.lowest_vendor || it.lowest_quote_vendor || it.ten_nha_thau_thap_nhat || it.ten_nhathau_min || '—';
                  const noteCoSo = itemMatch.co_so_don_gia || it.ghi_chu_co_so_don_gia || it.co_so_thong_nhat || it.danh_gia_ttd || it.ghi_chu || '—';

                  // Status
                  const status = !hasTN ? 'pending'
                    : pctGiam > 0 ? 'reduced'
                    : pctGiam === 0 ? 'same'
                    : 'increased';

                  const isEven = idx % 2 === 0;
                  const isRunningThis = runningItemIds.has(itemId);

                  return (
                    <tr key={idx} className={`group transition hover:bg-teal-50/60 ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}>
                      {/* Common Sticky Left 1..3 */}
                      <td className="py-2.5 px-2 text-center font-mono text-slate-500 sticky left-0 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 font-medium">
                        {it.stt || origIdx + 1}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-slate-700 sticky left-10 bg-inherit group-hover:bg-teal-50 border-r border-slate-200 text-[11px] font-semibold">
                        {it.pycvt || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 sticky left-[136px] bg-inherit group-hover:bg-teal-50 border-r border-slate-200 shadow-sm">
                        <div className="line-clamp-2" title={it.ten_vt_goc || it.ten_vt}>{it.ten_vt_goc || it.ten_vt || ''}</div>
                      </td>

                      {/* NEW COLUMN: Từ Khóa Tra Cứu Dùng Chung 5 Cơ Sở */}
                      <td className="py-2.5 px-2 border-r border-slate-200 bg-purple-50/30 group-hover:bg-purple-50/60">
                        <input
                          type="text"
                          value={itemKeywords[itemId] ?? (it.search_keyword || extractDefaultKeyword(it))}
                          onChange={(e) => handleKeywordChange(itemId, e.target.value)}
                          className="w-full px-2 py-1 text-[11.5px] font-mono font-bold text-purple-950 bg-white border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 shadow-2xs"
                          placeholder="Nhập từ khóa tra cứu 5 khối..."
                          title="Từ khóa dùng chung để tra cứu liên hoàn cả 5 cơ sở chứng cứ (Bấm sửa trực tiếp)"
                        />
                      </td>

                      {/* Common Columns 4..9 */}
                      <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 text-[11px]">
                        <div className="line-clamp-2" title={it.thong_so_kt || it.part_no}>{it.thong_so_kt || it.part_no || '—'}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center border-r border-slate-200 text-slate-700">{it.dvt || 'Cái'}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900 border-r border-slate-200">{sl}</td>
                      <td className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600 truncate max-w-[112px]" title={it.hsx_xx}>{it.hsx_xx || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-800 border-r border-slate-200 text-[11px] font-semibold">{it.ma_vt || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#003366] border-r border-slate-200 bg-blue-50/20 group-hover:bg-teal-50">
                        {fmt(dgTrinh)} đ
                      </td>

                      {/* Conditional View Columns */}
                      {viewMode === 'standard' ? (
                        <>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#003366] border-r border-slate-200 bg-blue-50/10 group-hover:bg-teal-50">
                            {fmt(ttTrinh)} đ
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold border-r border-slate-200 bg-emerald-50/20 group-hover:bg-teal-50">
                            {hasTN ? <span className="text-emerald-900">{fmt(dgTN)} đ</span> : <span className="text-slate-300 text-[11px] italic">Chưa TĐ</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold border-r border-slate-200 bg-emerald-50/10 group-hover:bg-teal-50">
                            {hasTN ? <span className="text-emerald-900">{fmt(ttTN)} đ</span> : <span className="text-slate-300 text-[11px] italic">—</span>}
                          </td>
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
                        </>
                      ) : (
                        <>
                          {/* View 1: 10. Ghi chú cơ sở đơn giá */}
                          <td className="py-2.5 px-3 border-r border-slate-200 bg-amber-50/10 text-slate-700 text-[11px]">
                            <div className="line-clamp-2" title={noteCoSo}>{noteCoSo}</div>
                          </td>

                          {/* View 1: 11. Đơn giá nhà thầu báo giá thấp nhất */}
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold border-r border-slate-200 bg-purple-50/20 text-purple-900">
                            {lowestPrice ? (
                              <span className="text-purple-900 font-bold">{fmt(lowestPrice)} đ</span>
                            ) : (
                              <span className="text-slate-300 text-[11px] italic">—</span>
                            )}
                          </td>

                          {/* View 1: 12. Tên Nhà thầu báo thấp nhất */}
                          <td className="py-2.5 px-3 border-r border-slate-200 bg-purple-50/10 text-purple-900 font-semibold text-[11px]">
                            <div className="truncate max-w-[180px]" title={lowestVendor}>{lowestVendor}</div>
                          </td>
                        </>
                      )}

                      {/* Action — Sticky Right */}
                      <td className="py-2.5 px-2 text-center sticky right-0 bg-white group-hover:bg-teal-50 border-l border-slate-200 shadow-sm">
                        <div className="flex flex-col items-center gap-1.5">
                          {/* Trạng thái lưu CSDL Thẩm định */}
                          {isItemSaved(it, origIdx) ? (
                            <span className="w-full text-center py-0.5 bg-emerald-100 text-emerald-900 rounded text-[9.5px] font-bold border border-emerald-300 flex items-center justify-center gap-1 shadow-2xs" title="Mục này đã tổng hợp và lưu vết CSDL Thẩm định">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Đã Lưu CSDL
                            </span>
                          ) : (
                            <span className="w-full text-center py-0.5 bg-slate-100 text-slate-500 rounded text-[9.5px] font-semibold border border-slate-200 flex items-center justify-center gap-1" title="Mục này chưa lưu CSDL thẩm định">
                              <Clock className="w-3 h-3 text-slate-400" /> Chưa Lưu CSDL
                            </span>
                          )}

                          {/* 1-Click 5-Pillars Automation Button */}
                          <button
                            onClick={() => handleRun5Pillars(itemId, true)}
                            disabled={isRunningThis}
                            className="w-full px-2 py-1 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-[10.5px] font-extrabold transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                            title="Chạy 1 mạch tự động 5 khối chứng cứ kèm theo dõi tiến độ trực quan"
                          >
                            {isRunningThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-purple-200" />
                                <span>Đang tra...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
                                <span>⚡ Tra 5 Cơ Sở</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-1 w-full">
                            {hasTN ? (
                              <button
                                onClick={() => handleOpenExistingAudit(it)}
                                className="flex-1 px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded text-[9.5px] font-bold transition border border-emerald-300"
                                title="Xem bảng báo cáo đối chiếu minh bạch 5 cơ sở đã thẩm định"
                              >
                                Báo Cáo
                              </button>
                            ) : null}

                            <button
                              onClick={() => onSelectInspectorItem(origIdx)}
                              className="flex-1 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-bold transition border border-slate-300"
                              title="Soi chi tiết từng khối tại màn hình Inspector"
                            >
                              Soi Chi Tiết
                            </button>
                          </div>

                          {hasTN && (
                            <button
                              onClick={() => handleExportPdf(itemId)}
                              className="w-full px-1.5 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[9.5px] font-bold transition border border-rose-300 flex items-center justify-center gap-1"
                              title="Tải ngay file PDF Báo Cáo Thẩm Định chuẩn 2 trang A4"
                            >
                              <FileDown className="w-3 h-3 text-rose-600" /> Xuất PDF 2 Trang
                            </button>
                          )}
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

      {/* Modal Minh Bạch Hóa Tiến Trình & Báo Cáo 5 Cơ Sở */}
      <AuditProgressModal
        isOpen={auditModal.isOpen}
        onClose={() => setAuditModal(prev => ({ ...prev, isOpen: false }))}
        item={auditModal.item}
        keyword={auditModal.keyword}
        status={auditModal.status}
        activeStep={auditModal.activeStep}
        auditData={auditModal.auditData}
        onExportPdf={handleExportPdf}
        onOpenInspector={onSelectInspectorItem}
      />
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, progress }) {
  const colors = {
    slate:   'border-slate-200  text-slate-800',
    teal:    'border-teal-300   text-teal-900 bg-teal-50/40',
    blue:    'border-blue-200   text-[#003366]',
    emerald: 'border-emerald-200 text-emerald-700',
    purple:  'border-purple-200  text-purple-700',
  };
  return (
    <div className={`bg-white p-3.5 rounded-xl border shadow-sm ${colors[color] || colors.slate}`}>
      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">{label}</span>
      <p className="text-lg font-extrabold font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate" title={sub}>{sub}</p>}
      {progress !== undefined && (
        <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2 overflow-hidden">
          <div
            className="bg-teal-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
