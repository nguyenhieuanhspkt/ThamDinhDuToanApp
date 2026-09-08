import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, Search, RotateCcw, Pin, AlertTriangle, CheckCircle,
  Check, BarChart3, Calculator, Loader2, ExternalLink, Filter,
  ChevronLeft, ChevronRight, XCircle, ArrowRight, Save, Award, Building2,
  FileText, Database
} from 'lucide-react';
import { useToast } from '../../ui/Toast.jsx';
import { fmt } from '../utils/formatters.js';
import { generateKeywordCandidates, getDefaultImisKeyword } from '../utils/keywordHelpers.js';
import { PillarHeader, LoadingSpinner, SaveFooter, EmptyState } from '../common';

export default function PillarMsc({ loading, saving, data, dgTrinh, item, onSave, onAutoSave, saved, onOpenMscConfig, mscStatus }) {
  const toast = useToast();
  const candidates = generateKeywordCandidates(item?.ten_vt);
  const getSmartMscKw = (rawName, savedKw) => {
    const smart = getDefaultImisKeyword(rawName);
    if (!savedKw || savedKw === rawName) return smart || rawName;
    return savedKw;
  };

  const defaultKw = getSmartMscKw(item?.ten_vt || '', data?.used_keyword || data?.keyword || data?.tu_khoa_tra_cuu);

  const [searchKey, setSearchKey] = useState(defaultKw);
  const [searching, setSearching] = useState(false);
  const [mscResponse, setMscResponse] = useState(data || null);
  const [selectedIdx, setSelectedIdx] = useState(() => (data?.is_deselected || data?.selected_record === 'NONE' || data?.summary?.status === 'MSC_DESELECTED' || data?.summary?.is_deselected) ? null : 0);

  // Pagination states
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // In-table quick filters
  const [filterKw, setFilterKw] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [priceFilter, setPriceFilter] = useState('ALL'); // ALL, LOWER, HIGHER

  const triggerSearch = useCallback(async (kw, pNum = 0, pSz = pageSize) => {
    const targetKw = (kw || searchKey || '').trim();
    if (!targetKw) return;

    setSearching(true);
    try {
      const res = await fetch('/api/msc/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: targetKw, item, save_evidence: true, page_number: pNum, page_size: pSz })
      });
      const resData = await res.json();
      if (resData.success) {
        setMscResponse(resData);
        setSelectedIdx(0);
        setPageNumber(pNum);
        setPageSize(pSz);
        const resAnalysis = resData.analysis || resData;
        const resItems = resAnalysis.items || resData.items || [];
        if (onAutoSave) {
          onAutoSave({
            analysis: resAnalysis,
            items: resItems,
            keyword: targetKw,
            used_keyword: targetKw,
            tu_khoa_tra_cuu: targetKw,
            selected_record: resItems[0] || null
          });
        }
      }
    } catch (e) {
      console.error('Lỗi tra cứu Mua Sắm Công:', e);
    } finally {
      setSearching(false);
    }
  }, [searchKey, pageSize, item, onAutoSave]);

  const autoSearchedRef = useRef({});

  useEffect(() => {
    if (data) {
      setMscResponse(data);
    }
  }, [data]);

  useEffect(() => {
    const smartKw = getSmartMscKw(item?.ten_vt || '', data?.used_keyword || data?.keyword || data?.tu_khoa_tra_cuu);
    setSearchKey(smartKw);
    if (data?.is_deselected || data?.selected_record === 'NONE' || data?.summary?.status === 'MSC_DESELECTED' || data?.summary?.is_deselected) {
      setSelectedIdx(null);
    } else {
      setSelectedIdx(0);
    }
    setPageNumber(0);
    setFilterKw('');
    setFilterOrigin('');
    setPriceFilter('ALL');

    // Single-trigger lock: Auto-search ONLY ONCE per item ID if no evidence data exists
    if (!data && item?.id && item?.ten_vt && smartKw && !autoSearchedRef.current[item.id]) {
      autoSearchedRef.current[item.id] = smartKw;
      triggerSearch(smartKw);
    }
  }, [data, item?.id, item?.ten_vt]);

  const analysis = mscResponse?.analysis || (mscResponse?.items ? mscResponse : null);
  const itemsList = analysis?.items || mscResponse?.items || [];
  const keywordUsed = analysis?.keyword || searchKey;

  const totalElements = analysis?.total ?? mscResponse?.total ?? itemsList.length;
  const totalPages = analysis?.total_pages ?? mscResponse?.total_pages ?? (Math.ceil(totalElements / pageSize) || 1);

  const isConnected = mscStatus?.active ?? (data?.success || (itemsList && itemsList.length > 0));

  // Client-side filtering logic
  const filteredItems = itemsList.filter(r => {
    const dg = parseFloat(r.don_gia || 0);
    if (priceFilter === 'LOWER' && (dgTrinh <= 0 || dg > dgTrinh)) return false;
    if (priceFilter === 'HIGHER' && (dgTrinh <= 0 || dg <= dgTrinh)) return false;

    if (filterKw.trim()) {
      const fkw = filterKw.trim().toLowerCase();
      const matchName = (r.danh_muc || '').toLowerCase().includes(fkw)
        || (r.ma_tbmt || '').toLowerCase().includes(fkw)
        || (r.ben_moi_thau || '').toLowerCase().includes(fkw)
        || (r.thong_so_kt || '').toLowerCase().includes(fkw);
      if (!matchName) return false;
    }

    if (filterOrigin.trim()) {
      const fori = filterOrigin.trim().toLowerCase();
      const matchOri = (r.xuat_xu || '').toLowerCase().includes(fori) || (r.hang_sx || '').toLowerCase().includes(fori);
      if (!matchOri) return false;
    }

    return true;
  });

  // Determine selected record or minimum price record
  const isDeselected = selectedIdx === null || data?.is_deselected || data?.selected_record === 'NONE';
  const selectedRecord = isDeselected ? null : (filteredItems[selectedIdx] || itemsList[selectedIdx] || null);
  const selectedPrice = selectedRecord ? parseFloat(selectedRecord.don_gia || 0) : 0;
  const diffAmt = dgTrinh - selectedPrice;
  const diffPct = selectedPrice > 0 ? ((dgTrinh - selectedPrice) / selectedPrice * 100) : 0;

  const thoiGianTraCuu = analysis?.thoi_gian_tra_cuu || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN');

  const DESELECTED_MSC_TEXT = `Qua rà soát Cổng Mạng Đấu thầu Quốc gia e-GP (muasamcong.mpi.gov.vn) theo từ khóa [${keywordUsed}], các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL Mua sắm công làm căn cứ so sánh đơn giá cho mục này.`;

  // Build justification text
  let summaryText = '';
  if (isDeselected) {
    summaryText = (data?.summary_text && (data?.is_deselected || data?.selected_record === 'NONE')) ? data.summary_text : DESELECTED_MSC_TEXT;
  } else if (itemsList.length > 0 && selectedRecord) {
    const benMoiThauStr = selectedRecord.ben_moi_thau ? `, Bên mời thầu: ${selectedRecord.ben_moi_thau}` : '';
    if (diffAmt <= 0) {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận mức giá trúng thầu tham chiếu là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}${benMoiThauStr}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương giá trúng thầu công khai trên toàn quốc.`;
    } else {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận đơn giá trúng thầu tham chiếu thấp nhất là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}${benMoiThauStr}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${diffPct.toFixed(1)}% (+${fmt(diffAmt)} đ). Tổ Thẩm định đề nghị xem xét tham chiếu giá Mua sắm công để tối ưu chi phí.`;
    }
  } else if (mscResponse && !searching) {
    summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu} nhưng chưa ghi nhận kết quả trúng thầu tương tự.`;
  }

  const handleSelectRecord = (index) => {
    if (selectedIdx === index) {
      handleDeselectRecord();
      return;
    }
    setSelectedIdx(index);
    const rec = filteredItems[index] || itemsList[index];
    toast.success(`Đã chọn kết quả e-GP làm căn cứ tham chiếu!`);
    if (onAutoSave) {
      onAutoSave({
        analysis,
        items: itemsList,
        keyword: searchKey,
        used_keyword: searchKey,
        tu_khoa_tra_cuu: searchKey,
        selected_record: rec,
        is_deselected: false
      });
    }
  };

  const handleDeselectRecord = () => {
    setSelectedIdx(null);
    toast.info('Đã hủy chọn gói thầu e-GP. Không áp dụng kết quả Mua Sắm Công làm căn cứ.');
    if (onAutoSave) {
      onAutoSave({
        analysis,
        items: itemsList,
        summary_text: DESELECTED_MSC_TEXT,
        keyword: searchKey,
        used_keyword: searchKey,
        tu_khoa_tra_cuu: searchKey,
        selected_record: 'NONE',
        is_deselected: true
      });
    }
  };

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Đã sao chép thuyết minh Mua Sắm Công vào Clipboard!');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Connection Status */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-sm text-orange-900 uppercase tracking-wide flex items-center gap-2">
            <Globe className="w-5 h-5 text-orange-700" /> KHỐI 4: CỔNG MUA SẮM CÔNG QUỐC GIA (e-GP)
          </h4>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
              isConnected ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
            }`}
            title={mscStatus?.created_at ? `Session cURL nạp lúc ${mscStatus.created_at} ${mscStatus.age_str}` : 'Chưa thiết lập cURL'}
          >
            {isConnected
              ? `🌐 Session e-GP: 200 OK ${mscStatus?.age_str || ''}`
              : '🔴 Session: Hết hạn / Chưa cấu hình'}
          </span>
        </div>

        <button
          onClick={onOpenMscConfig}
          className="bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
        >
          <Database className="w-3.5 h-3.5 text-orange-700" /> Cấu Hình cURL Session
        </button>
      </div>

      {/* Warning banner if disconnected */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Phiên cURL e-GP Mua Sắm Công chưa kích hoạt hoặc đã hết hạn cookie.</span>
          </div>
          <button
            onClick={onOpenMscConfig}
            className="px-2.5 py-1 bg-amber-600 text-white rounded-md font-bold text-[11px] hover:bg-amber-700 transition"
          >
            Dán cURL Mới
          </button>
        </div>
      )}

      {/* Search Bar & Keyword Candidate Bar */}
      <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-200 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && triggerSearch(searchKey, 0, pageSize)}
              placeholder="Nhập từ khóa tra cứu đấu thầu Mua Sắm Công e-GP..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium"
            />
          </div>
          <button
            onClick={() => triggerSearch(searchKey, 0, pageSize)}
            disabled={searching}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-60"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Tra Cứu e-GP
          </button>
        </div>

        {/* 4 Tầng Từ Khóa Đề Xuất (Keyword Candidates Chips Bar) */}
        {candidates.length > 0 && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto text-[11px]">
            <span className="font-bold text-orange-950 shrink-0 flex items-center gap-1">
              ⚡ Gợi Ý Từ Khóa:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {candidates.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchKey(c.keyword);
                    triggerSearch(c.keyword, 0, pageSize);
                  }}
                  className={`px-2.5 py-1 rounded-lg border font-semibold transition flex items-center gap-1 shadow-2xs ${
                    searchKey.toLowerCase() === c.keyword.toLowerCase()
                      ? 'bg-orange-600 text-white border-orange-700 font-bold'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-orange-100 hover:border-orange-300'
                  }`}
                  title={`${c.label}: "${c.keyword}"`}
                >
                  <span>{c.icon}</span>
                  <span>{c.keyword}</span>
                  <span className="text-[9px] opacity-75 px-1 py-0.2 rounded bg-black/10">
                    {c.tag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Bar & Fetch All Button */}
      {itemsList.length > 0 && (
        <div className="bg-orange-50/70 p-3 rounded-xl border border-orange-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-orange-950">
            <span>📊 Tổng cộng: <strong className="text-orange-700 font-mono text-sm">{totalElements}</strong> kết quả trúng thầu</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 font-medium">Trang {pageNumber + 1} / {totalPages} (Đang nạp {itemsList.length} dòng)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Fetch All Button */}
            {totalElements > itemsList.length && (
              <button
                onClick={() => triggerSearch(searchKey, 0, 100)}
                disabled={searching}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
                title="Tải toàn bộ tất cả kết quả trong 1 lượt"
              >
                ⚡ Tải Toàn Bộ {totalElements} Kết Quả
              </button>
            )}

            {/* Page Size Selector */}
            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 text-[11px]">
              <span className="text-slate-500 font-medium">Số dòng:</span>
              {[20, 50, 100].map(sz => (
                <button
                  key={sz}
                  onClick={() => triggerSearch(searchKey, 0, sz)}
                  className={`px-2 py-0.5 rounded font-bold transition ${
                    pageSize === sz ? 'bg-orange-600 text-white shadow-2xs' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Page Navigator */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => triggerSearch(searchKey, Math.max(0, pageNumber - 1), pageSize)}
                disabled={pageNumber === 0 || searching}
                className="px-2.5 py-1 bg-white hover:bg-orange-100 text-slate-800 rounded-lg border border-slate-300 font-bold disabled:opacity-40 transition"
              >
                ◄ Trước
              </button>
              <button
                onClick={() => triggerSearch(searchKey, Math.min(totalPages - 1, pageNumber + 1), pageSize)}
                disabled={pageNumber >= totalPages - 1 || searching}
                className="px-2.5 py-1 bg-white hover:bg-orange-100 text-slate-800 rounded-lg border border-slate-300 font-bold disabled:opacity-40 transition"
              >
                Sau ►
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Căn Cứ Mua Sắm Công Quốc Gia */}
      {summaryText && (
        <div className={`p-4 rounded-xl border-2 transition ${
          isDeselected
            ? 'bg-slate-50/90 border-slate-300 text-slate-800'
            : 'border-orange-300 bg-orange-50/80 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h5 className={`font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
              isDeselected ? 'text-slate-700' : 'text-orange-950'
            }`}>
              <FileText className={`w-4 h-4 ${isDeselected ? 'text-slate-500' : 'text-orange-700'}`} /> 📄 BẢN THUYẾT MINH CĂN CỨ MUA SẮM CÔNG QUỐC GIA (TỰ ĐỘNG TỔNG HỢP)
            </h5>
            <div className="flex items-center gap-2">
              {!isDeselected ? (
                <button
                  onClick={handleDeselectRecord}
                  className="bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-slate-300 hover:border-rose-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                  title="Hủy chọn, không áp dụng kết quả Mua Sắm Công làm căn cứ"
                >
                  <XCircle className="w-3.5 h-3.5" /> ✕ Hủy Chọn Căn Cứ e-GP
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-md border border-slate-300 flex items-center gap-1">
                  🚫 Đang Hủy Chọn (Không áp dụng)
                </span>
              )}
              <button
                onClick={copyToClipboard}
                className="bg-white hover:bg-slate-100 text-orange-900 border border-orange-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
              >
                📋 Sao Chép Thuyết Minh MSC
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/80 p-3 rounded-lg border border-slate-200 text-slate-800">
            {summaryText}
          </p>
        </div>
      )}

      {/* In-Table Client Filter Bar */}
      {itemsList.length > 0 && (
        <div className="bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="font-bold text-slate-700 shrink-0 flex items-center gap-1 text-[11px]">
              <Filter className="w-3.5 h-3.5 text-slate-500" /> Lọc tại chỗ ({filteredItems.length}/{itemsList.length}):
            </span>
            <input
              type="text"
              value={filterKw}
              onChange={e => setFilterKw(e.target.value)}
              placeholder="Lọc Hàng hóa / Mã TBMT / Bên mời thầu / Thông số..."
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg flex-1 focus:outline-none focus:border-orange-500 font-medium"
            />
            <input
              type="text"
              value={filterOrigin}
              onChange={e => setFilterOrigin(e.target.value)}
              placeholder="Lọc Xuất xứ / Hãng SX..."
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg flex-1 focus:outline-none focus:border-orange-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-slate-500">Mức Giá:</span>
            <button
              onClick={() => setPriceFilter('ALL')}
              className={`px-2 py-1 rounded-lg font-bold border transition ${
                priceFilter === 'ALL' ? 'bg-slate-800 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất Cả
            </button>
            <button
              onClick={() => setPriceFilter('LOWER')}
              className={`px-2 py-1 rounded-lg font-bold border transition ${
                priceFilter === 'LOWER' ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs' : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              🟢 Giá &lt; Trình
            </button>
            <button
              onClick={() => setPriceFilter('HIGHER')}
              className={`px-2 py-1 rounded-lg font-bold border transition ${
                priceFilter === 'HIGHER' ? 'bg-red-700 text-white border-red-800 shadow-2xs' : 'bg-white text-red-800 border-red-300 hover:bg-red-50'
              }`}
            >
              🔴 Giá &gt; Trình
            </button>

            {(filterKw || filterOrigin || priceFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setFilterKw('');
                  setFilterOrigin('');
                  setPriceFilter('ALL');
                }}
                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold transition border border-amber-300"
              >
                🔄 Xóa Lọc
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bảng Dữ Liệu Kết Quả Giá Trúng Thầu e-GP */}
      {loading || searching ? (
        <LoadingSpinner />
      ) : filteredItems.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[850px]">
            <thead className="bg-orange-50 text-orange-950 font-bold border-b border-orange-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-24 text-center">Căn Cứ</th>
                <th className="py-2.5 px-3 border-r min-w-[180px]">Tên Danh Mục Hàng Hóa (e-GP)</th>
                <th className="py-2.5 px-3 border-r min-w-[220px]">Thông Số Kỹ Thuật Chi Tiết</th>
                <th className="py-2.5 px-3 border-r font-mono min-w-[200px]">Mã TBMT & Bên Mời Thầu / Chủ Đầu Tư</th>
                <th className="py-2.5 px-3 border-r w-20 text-center">ĐVT</th>
                <th className="py-2.5 px-3 border-r w-20 text-right">Khối Lượng</th>
                <th className="py-2.5 px-3 border-r w-32 text-right font-mono bg-orange-100/50">Giá Dự Thầu (Trúng)</th>
                <th className="py-2.5 px-3 border-r">Xuất Xứ</th>
                <th className="py-2.5 px-3">Hãng Sản Xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredItems.map((r, i) => {
                const isSelected = !isDeselected && i === selectedIdx;
                const dg = parseFloat(r.don_gia || 0);
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;

                // Smart Title-Spec Splitter logic
                let rawName = r.danh_muc || r.danhMucHangHoa || r.ten_hang_hoa || r.ten_vt || '—';
                let cleanName = rawName;
                let specFromTitle = '';

                const splitMatch = rawName.match(/^(.*?)\s+-\s+((?:Model|Yếu\s*tố|Dải\s*đo|Nguồn|Tiêu\s*chuẩn|Công\s*nghệ|Part|P\/N|KT|Kích\s*thước|Đặc\s*tính)[\s:].*)$/i);
                if (splitMatch) {
                  cleanName = splitMatch[1].trim();
                  specFromTitle = splitMatch[2].trim();
                }

                const modelCode = r.ky_ma_hieu || r.kyMaHieu || '';
                const modelBadge = modelCode ? `Model/Mã hiệu: ${modelCode}` : '';

                let specParts = [];
                if (r.thong_so_kt) specParts.push(r.thong_so_kt);
                if (r.cauHinh && r.cauHinh !== 'Theo yêu cầu kỹ thuật' && !specParts.includes(r.cauHinh)) specParts.push(r.cauHinh);
                if (r.cau_hinh && r.cau_hinh !== 'Theo yêu cầu kỹ thuật' && !specParts.includes(r.cau_hinh)) specParts.push(r.cau_hinh);
                if (specFromTitle && !specParts.includes(specFromTitle)) specParts.push(specFromTitle);
                if (modelBadge && !specParts.some(p => p.toLowerCase().includes(modelCode.toLowerCase()))) specParts.push(modelBadge);
                if (r.xuat_xu && r.xuat_xu.length > 25 && !specParts.includes(r.xuat_xu)) specParts.push(r.xuat_xu);

                const specText = Array.from(new Set(specParts)).join(' | ');
                const benMoiThau = r.ben_moi_thau || r.tenCdtBmt || r.tenBenMoiThau || r.tenChuDauTu || r.chuDauTu || '';
                const nhaThauTrung = r.nha_thau_trung || (Array.isArray(r.winningName) && r.winningName.length > 0 ? r.winningName[0] : (typeof r.winningName === 'string' ? r.winningName : ''));

                let cleanOrigin = r.xuat_xu || '—';
                if (r.xuat_xu && r.xuat_xu.length > 25) {
                  const match = r.xuat_xu.match(/(?:Xuất\s*xứ|NSX\/Xuất\s*xứ|Origin)[\s:]*([^\n;]+)/i);
                  if (match) {
                    cleanOrigin = match[1].trim();
                  } else if (r.xuat_xu.includes('/')) {
                    const parts = r.xuat_xu.split('/');
                    cleanOrigin = parts[parts.length - 1].trim();
                  } else {
                    cleanOrigin = 'Xem thông số';
                  }
                }

                return (
                  <tr
                    key={i}
                    className={`transition text-[11px] ${
                      isSelected ? 'bg-orange-100/80 border-l-4 border-l-orange-600 font-semibold' : 'hover:bg-orange-50/40'
                    }`}
                  >
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => handleSelectRecord(i)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                          isSelected
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-xs ring-2 ring-orange-300'
                            : 'bg-slate-200 hover:bg-orange-100 text-slate-700'
                        }`}
                        title={isSelected ? "Bấm vào đây để HỦY CHỌN dòng này" : "Bấm để CHỌN dòng này làm căn cứ"}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? '✓ Đã Chọn' : 'Chọn'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 border-r min-w-[180px]">
                      <div className="font-bold text-slate-900 text-xs">{cleanName}</div>
                    </td>
                    <td className="py-2.5 px-3 border-r min-w-[220px] text-[10.5px]">
                      {specText ? (
                        <div className="text-slate-800 bg-orange-50/70 p-2 rounded border border-orange-200/80 leading-snug">
                          <div className="font-bold text-orange-950 flex items-center gap-1 mb-1">
                            ⚡ Thông số kỹ thuật / Đặc tính:
                          </div>
                          <div className="line-clamp-4 font-normal text-slate-800 whitespace-pre-line" title={specText}>
                            {specText}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Theo TBMT</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-r min-w-[210px]">
                      <div className="flex items-center gap-1 font-mono text-orange-950 font-extrabold text-xs">
                        <span className="bg-orange-100 text-orange-950 px-1 py-0.2 rounded text-[9.5px] border border-orange-300">TBMT</span>
                        {r.ma_tbmt || '—'}
                      </div>
                      <div className="mt-1.5 text-[10.5px] text-blue-950 bg-blue-50/90 p-1.5 rounded border border-blue-200 leading-tight">
                        <div className="font-bold text-blue-900 flex items-center gap-1 mb-0.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          Chủ đầu tư / Bên mời thầu:
                        </div>
                        <div className="font-medium text-slate-800 line-clamp-2" title={benMoiThau || 'Chưa ghi nhận tên CĐT trên TBMT này'}>
                          {benMoiThau || 'Chưa cập nhật tên CĐT trên TBMT'}
                        </div>
                        {nhaThauTrung && (
                          <div className="mt-1 pt-1 border-t border-blue-200/60 flex items-center gap-1 text-[10px] text-emerald-900 font-semibold" title={`Nhà thầu trúng thầu: ${nhaThauTrung}`}>
                            <Award className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">Trúng thầu: {nhaThauTrung}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 border-r text-center text-slate-700">{r.dvt || r.don_vi_tinh || '—'}</td>
                    <td className="py-2 px-3 border-r text-right font-mono text-slate-800">{fmt(r.so_luong || 1)}</td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-orange-950 bg-orange-50/30">
                      {fmt(dg)} đ
                      {diff !== 0 && (
                        <div className={`text-[9.5px] font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}% so với trình
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r text-slate-700 font-medium">{cleanOrigin}</td>
                    <td className="py-2 px-3 text-slate-800 font-medium">{r.hang_sx || r.hang_san_xuat || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : mscResponse !== null ? (
        <EmptyState text={itemsList.length > 0 ? "Không có kết quả khớp với bộ lọc tại chỗ." : "Không tìm thấy kết quả đơn giá trúng thầu tương tự trên Cổng Mua Sắm Công e-GP."} />
      ) : (
        <EmptyState text="Nhấn vào Tra Cứu e-GP hoặc chọn từ khóa đề xuất để tìm kiếm..." />
      )}

      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={() => onSave({
          analysis,
          items: itemsList,
          summary_text: summaryText,
          keyword: searchKey,
          used_keyword: searchKey,
          tu_khoa_tra_cuu: searchKey,
          selected_record: isDeselected ? 'NONE' : selectedRecord,
          is_deselected: isDeselected
        })}
        nextLabel="Cơ sở 5 (TMĐT)"
        prevLabel="Cơ sở 3 (IMIS)"
      />
    </div>
  );
}
