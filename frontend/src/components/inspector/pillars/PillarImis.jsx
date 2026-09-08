import React, { useState, useEffect } from 'react';
import {
  Network, Database, Search, RotateCcw, Pin, AlertTriangle, CheckCircle,
  Check, BarChart3, Calculator, Loader2, XCircle, ArrowRight, Save, Filter, Globe, FileText, X,
  Clock, TrendingUp
} from 'lucide-react';
import { useToast } from '../../ui/Toast.jsx';
import { fmt } from '../utils/formatters.js';
import {
  generateKeywordCandidates, getDefaultImisKeyword,
  computeTimeDelta, computeAnnualEscalation, computeEscalationCeiling
} from '../utils/keywordHelpers.js';
import { PillarHeader, LoadingSpinner, SaveFooter, EmptyState } from '../common';

export default function PillarImis({ loading, saving, data, dgTrinh, item, onSave, onAutoSave, saved, onOpenImisConfig, imisStatus }) {
  const toast = useToast();
  const [imisResults, setImisResults] = useState(data?.imis || []);
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  
  const getSmartImisKw = (rawName, savedKw) => {
    const smart = getDefaultImisKeyword(rawName);
    if (!savedKw || savedKw === rawName) return smart || rawName;
    return savedKw;
  };

  const getInitialImisIdx = (d, list) => {
    if (!d) return 0;
    if (d.is_deselected || d.selected_record === 'NONE' || d.summary?.status === 'IMIS_DESELECTED' || d.summary?.is_deselected) return null;
    if (d.use_average || d.selected_record === 'AVERAGE') return 'AVERAGE';
    const recs = list || d.imis || [];
    if (d.selected_record && Array.isArray(recs)) {
      const idx = recs.findIndex(r => 
        (r.so_hop_dong && r.so_hop_dong === d.selected_record?.so_hop_dong) ||
        (r.ma_vt && r.ma_vt === d.selected_record?.ma_vt) ||
        (r.ten_vt && r.ten_vt === d.selected_record?.ten_vt)
      );
      return idx >= 0 ? idx : 0;
    }
    return 0;
  };

  const initialCleanKw = getSmartImisKw(item?.ten_vt || '', data?.used_keyword || data?.keyword);
  const [searchKey, setSearchKey] = useState(initialCleanKw);
  const [tuNgay, setTuNgay] = useState('2023-01-01');
  const [denNgay, setDenNgay] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIdx, setSelectedIdx] = useState(() => getInitialImisIdx(data, data?.imis));
  const [searching, setSearching] = useState(false);

  // In-table client filtering states
  const [filterKw, setFilterKw]     = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [priceFilter, setPriceFilter] = useState('ALL'); // ALL, LOWER, HIGHER

  useEffect(() => {
    const list = data?.imis || (Array.isArray(data) ? data : []);
    setImisResults(list);
    setSummaryData(data?.summary || {});
    const smartKw = getSmartImisKw(item?.ten_vt || '', data?.used_keyword || data?.keyword);
    setSearchKey(smartKw);
    setSelectedIdx(getInitialImisIdx(data, list));
    setFilterKw('');
    setFilterUnit('');
    setPriceFilter('ALL');
  }, [data, item]);

  const isDeselected = selectedIdx === null || data?.is_deselected || data?.selected_record === 'NONE';
  const DESELECTED_IMIS_TEXT = `Đã tra cứu CSDL EVN IMIS theo từ khóa [${searchKey || item?.ten_vt || ''}], các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán nên thẩm định viên không áp dụng làm căn cứ thẩm định.`;
  const summaryText = isDeselected
    ? ((summaryData?.status === 'IMIS_DESELECTED' && summaryData?.summary_text) ? summaryData.summary_text : (data?.summary_text && (data?.is_deselected || data?.selected_record === 'NONE') ? data.summary_text : DESELECTED_IMIS_TEXT))
    : (summaryData?.summary_text || data?.summary_text || '');

  // Tự động khôi phục thuyết minh IMIS nếu dữ liệu đệm bị khuyết summary_text
  useEffect(() => {
    const list = imisResults || [];
    const curSummaryText = summaryData?.summary_text || data?.summary_text;
    if (list.length > 0 && !curSummaryText && !searching && item?.ten_vt && !isDeselected) {
      const kwToUse = searchKey || getDefaultImisKeyword(item.ten_vt) || item.ten_vt;
      fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kwToUse,
          ma_vt: item?.ma_vt || '',
          item,
          dg_trinh: dgTrinh,
          tu_ngay: tuNgay,
          den_ngay: denNgay
        })
      })
      .then(r => r.json())
      .then(resp => {
        if (resp.summary) {
          setSummaryData(resp.summary);
          if (onAutoSave) {
            onAutoSave({
              imis: resp.imis || list,
              erp: resp.erp || [],
              summary: resp.summary,
              summary_text: resp.summary?.summary_text || '',
              keyword: kwToUse,
              used_keyword: kwToUse,
              selected_record: resp.imis?.[0] || null,
              is_deselected: false
            });
          }
        }
      })
      .catch(console.error);
    }
  }, [imisResults, summaryData, data, item, dgTrinh, searchKey, searching, tuNgay, denNgay, onAutoSave, isDeselected]);

  const isConnected = imisStatus?.is_connected;
  const candidates = (data?.candidates && data.candidates.length > 0)
    ? data.candidates
    : generateKeywordCandidates(item?.ten_vt || '');

  const triggerSearchWithKw = async (targetKw, customTu, customDen) => {
    const cleanKw = (targetKw || '').trim();
    if (!cleanKw) return;
    const startD = customTu || tuNgay;
    const endD = customDen || denNgay;
    setSearching(true);
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: cleanKw,
          ma_vt: item?.ma_vt || '',
          item,
          dg_trinh: dgTrinh,
          tu_ngay: startD,
          den_ngay: endD
        })
      });
      const resp = await res.json();
      const imisList = resp.imis || [];
      const sumData = resp.summary || {};
      setImisResults(imisList);
      setSummaryData(sumData);
      setSelectedIdx(0);
      setFilterKw('');
      setFilterUnit('');
      setPriceFilter('ALL');
      toast.success(`Đã tìm thấy ${imisList.length} kết quả IMIS cho từ khóa [${cleanKw}] (${startD} -> ${endD})`);
      if (onAutoSave) {
        onAutoSave({
          imis: imisList,
          erp: resp.erp || [],
          summary: sumData,
          summary_text: sumData?.summary_text || resp.summary_text || '',
          keyword: cleanKw,
          used_keyword: cleanKw,
          selected_record: imisList[0] || null,
          is_deselected: false,
          use_average: false
        });
      }
    } catch (e) {
      toast.error('Lỗi tìm kiếm IMIS thủ công');
    } finally {
      setSearching(false);
    }
  };

  const handleManualSearch = async () => {
    triggerSearchWithKw(searchKey);
  };

  const handleDeselectRecord = async () => {
    setSelectedIdx(null);
    const deselectText = `Đã tra cứu CSDL EVN IMIS theo từ khóa [${searchKey || item?.ten_vt || ''}], các kết quả tìm thấy không tương đồng về quy cách/chủng loại với vật tư dự toán nên thẩm định viên không áp dụng làm căn cứ thẩm định.`;
    const sumData = {
      status: 'IMIS_DESELECTED',
      is_deselected: true,
      summary_text: deselectText
    };
    setSummaryData(sumData);
    toast.info('Đã hủy chọn hợp đồng IMIS. Không áp dụng kết quả IMIS làm căn cứ.');
    if (onAutoSave) {
      onAutoSave({
        imis: imisResults,
        erp: [],
        summary: sumData,
        summary_text: deselectText,
        keyword: searchKey,
        used_keyword: searchKey,
        selected_record: 'NONE',
        use_average: false,
        is_deselected: true
      });
    }
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          selected_record: 'NONE',
          is_deselected: true,
          tu_ngay: tuNgay,
          den_ngay: denNgay
        })
      });
      const resp = await res.json();
      if (resp.summary) {
        setSummaryData(resp.summary);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRecord = async (indexOrRec) => {
    let rec = typeof indexOrRec === 'object' ? indexOrRec : imisResults[indexOrRec];
    let idx = typeof indexOrRec === 'number' ? indexOrRec : imisResults.indexOf(indexOrRec);
    if (idx < 0) idx = 0;

    // Toggle OFF: Bấm lại vào dòng đang chọn -> HỦY CHỌN
    if (selectedIdx === idx) {
      await handleDeselectRecord();
      return;
    }

    setSelectedIdx(idx);
    if (!rec) return;
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          selected_record: rec,
          is_deselected: false,
          tu_ngay: tuNgay,
          den_ngay: denNgay
        })
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(`Đã chọn hợp đồng ${rec.so_hop_dong || rec.so_hd || 'IMIS'} làm căn cứ thuyết minh!`);
      if (onAutoSave) {
        onAutoSave({
          imis: imisResults,
          summary: sumData,
          summary_text: sumData?.summary_text || summaryText,
          keyword: searchKey,
          used_keyword: searchKey,
          selected_record: rec,
          use_average: false,
          is_deselected: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAverage = async () => {
    if (selectedIdx === 'AVERAGE') {
      await handleDeselectRecord();
      return;
    }
    setSelectedIdx('AVERAGE');
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          use_average: true,
          is_deselected: false,
          tu_ngay: tuNgay,
          den_ngay: denNgay
        })
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(`Đã chọn phương án Đơn Giá Trung Bình EVN (${sumData?.count_n || imisResults.length} đợt) làm căn cứ thuyết minh!`);
      if (onAutoSave) {
        onAutoSave({
          imis: imisResults,
          summary: sumData,
          summary_text: sumData?.summary_text || summaryText,
          keyword: searchKey,
          used_keyword: searchKey,
          selected_record: 'AVERAGE',
          use_average: true,
          is_deselected: false
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Đã sao chép thuyết minh IMIS vào clipboard!');
    }
  };

  // Logic lọc dữ liệu client-side cho IMIS EVN
  const filteredImisResults = imisResults.filter(r => {
    const dg = parseFloat(r.don_gia || r.gia || r.donGia || 0);
    if (priceFilter === 'LOWER' && (dgTrinh <= 0 || dg > dgTrinh)) return false;
    if (priceFilter === 'HIGHER' && (dgTrinh <= 0 || dg <= dgTrinh)) return false;

    if (filterKw.trim()) {
      const fkw = filterKw.trim().toLowerCase();
      const matchText = (r.ten_vt || r.ten_hang_hoa || r.mo_ta || '').toLowerCase().includes(fkw) ||
                        (r.ma_vt || r.ma_hang_hoa || '').toLowerCase().includes(fkw) ||
                        (r.so_hop_dong || r.so_hd || r.so_po || '').toLowerCase().includes(fkw);
      if (!matchText) return false;
    }

    if (filterUnit.trim()) {
      const funit = filterUnit.trim().toLowerCase();
      const matchUnit = (r.ten_don_vi || r.nha_may || r.don_vi || '').toLowerCase().includes(funit) ||
                        (r.nha_thau || r.nha_cung_cap || '').toLowerCase().includes(funit);
      if (!matchUnit) return false;
    }

    return true;
  });

  // Tính đơn giá trung bình IMIS cho thanh hiển thị nhanh
  const validPrices = imisResults.map(r => parseFloat(r.don_gia || r.gia || r.donGia || 0)).filter(p => p > 0);
  const avgPrice = validPrices.length > 0 ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

  // Tính toán kích thước thời gian & tỷ lệ trượt giá năm (IMIS)
  const selectedRec = !isDeselected && (typeof selectedIdx === 'number' ? imisResults[selectedIdx] : null);
  const selectedDate = selectedRec?.ngay_ky || selectedRec?.thang_nam || selectedRec?.nam || selectedRec?.ngayKy;
  const selectedTimeDelta = computeTimeDelta(selectedDate);
  const selectedImisPrice = selectedRec ? parseFloat(selectedRec.don_gia || selectedRec.gia || selectedRec.donGia || 0) : 0;
  const escalation = computeAnnualEscalation(selectedImisPrice, dgTrinh, selectedTimeDelta.months);
  const priceCeiling = computeEscalationCeiling(selectedImisPrice, selectedTimeDelta.months, 0.05);

  return (
    <div className="space-y-4">
      {/* Top Title & Status Button */}
      <div className="flex items-center justify-between">
        <PillarHeader icon={Network} color="purple" title="KHỐI 3: HỆ THỐNG EVN IMIS (CÁC ĐƠN VỊ PHÁT ĐIỆN)" loading={loading || searching} />
        <button
          onClick={onOpenImisConfig}
          className={`text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition ${
            isConnected ? 'bg-purple-700 hover:bg-purple-800' : 'bg-amber-600 hover:bg-amber-700 animate-pulse'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          {isConnected ? '🟢 IMIS: Đã Kết Nối API Live' : '🔴 Trạng Thái Kết Nối IMIS EVN'}
        </button>
      </div>

      {/* Thanh Tra cứu IMIS EVN thủ công & Tùy chỉnh Khoảng Thời Gian */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-purple-700" /> Tra cứu IMIS EVN bằng tay:
          </span>
          <input
            type="text"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
            placeholder="Nhập tên vật tư hoặc mã thiết bị IMIS EVN để tra cứu..."
            className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-purple-500 font-medium"
          />
          <button
            onClick={handleManualSearch}
            disabled={searching}
            className="bg-purple-800 hover:bg-purple-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition shadow-xs disabled:opacity-50 shrink-0"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Tra cứu IMIS
          </button>
          <button
            onClick={() => {
              const resetKw = getDefaultImisKeyword(item?.ten_vt || item?.ma_vt || '');
              setSearchKey(resetKw);
              triggerSearchWithKw(resetKw);
            }}
            title="Khôi phục từ khóa ngắn gọn mặc định"
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
          </button>
        </div>

        {/* Thanh Ứng Viên Từ Khóa (Keyword Chips Bar) cho User Review & Chọn Nhanh */}
        {candidates.length > 0 && (
          <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-purple-950 shrink-0 flex items-center gap-1">
              💡 Từ khóa gợi ý (Bấm để chọn & tra cứu):
            </span>
            {candidates.map((cand, idx) => {
              const isActive = searchKey.trim().toLowerCase() === cand.keyword.trim().toLowerCase();
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchKey(cand.keyword);
                    triggerSearchWithKw(cand.keyword);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                    isActive
                      ? 'bg-purple-700 text-white border-purple-800 shadow-xs ring-2 ring-purple-300'
                      : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100 hover:border-purple-400'
                  }`}
                  title={`Tra cứu IMIS theo ${cand.label}: [${cand.keyword}]`}
                >
                  <span>{cand.icon || '🏷️'}</span>
                  <span>{cand.tag || `Tier ${cand.tier}`}:</span>
                  <span className="font-semibold">{cand.keyword}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Thanh Tùy Chỉnh Khoảng Thời Gian Tra Cứu Công Khai (Từ Ngày ... Đến Ngày ...) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-700">
            <span className="flex items-center gap-1 text-purple-900">
              📅 Phạm vi dò tìm IMIS:
            </span>
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Từ:</span>
              <input
                type="date"
                value={tuNgay}
                onChange={e => setTuNgay(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold focus:outline-none text-purple-950"
              />
            </div>
            <span className="text-slate-400 font-bold">→</span>
            <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-xs">
              <span className="text-[11px] text-slate-500 font-semibold">Đến:</span>
              <input
                type="date"
                value={denNgay}
                onChange={e => setDenNgay(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold focus:outline-none text-purple-950"
              />
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium">Chọn nhanh:</span>
            <button
              onClick={() => {
                const startD = '2023-01-01';
                const endD = new Date().toISOString().split('T')[0];
                setTuNgay(startD);
                setDenNgay(endD);
                triggerSearchWithKw(searchKey, startD, endD);
              }}
              className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-950 rounded-lg font-bold transition border border-purple-300"
            >
              ⚡ 3 Năm (2023 - Nay)
            </button>
            <button
              onClick={() => {
                const startD = '2021-01-01';
                const endD = new Date().toISOString().split('T')[0];
                setTuNgay(startD);
                setDenNgay(endD);
                triggerSearchWithKw(searchKey, startD, endD);
              }}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition border border-slate-300"
            >
              ⚡ 5 Năm (2021 - Nay)
            </button>
            <button
              onClick={() => {
                const startD = '2018-01-01';
                const endD = new Date().toISOString().split('T')[0];
                setTuNgay(startD);
                setDenNgay(endD);
                triggerSearchWithKw(searchKey, startD, endD);
              }}
              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition border border-slate-300"
            >
              ⚡ Tất Cả Lịch Sử
            </button>
          </div>
        </div>
      </div>

      {/* Thanh Chọn Phương Án Thẩm Định IMIS */}
      {imisResults.length >= 1 && (
        <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="font-bold text-purple-950 flex items-center gap-1.5 shrink-0">
            <Calculator className="w-4 h-4 text-purple-700" /> Tùy chọn Phương án Căn cứ IMIS ({imisResults.length} hợp đồng):
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof selectedIdx === 'number') {
                  handleDeselectRecord();
                } else {
                  handleSelectRecord(0);
                }
              }}
              title={typeof selectedIdx === 'number' ? "Nhấp để HỦY CHỌN phương án hợp đồng cụ thể" : "Chọn áp dụng theo hợp đồng cụ thể"}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                typeof selectedIdx === 'number'
                  ? 'bg-purple-700 hover:bg-rose-600 text-white border-purple-800 shadow-xs group'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {typeof selectedIdx === 'number' ? (
                <>
                  <Pin className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                  <span className="group-hover:hidden">Theo Đơn Vị EVN Cụ Thể (#{selectedIdx + 1})</span>
                  <span className="hidden group-hover:inline">Hủy Chọn Căn Cứ IMIS</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span>Theo Đơn Vị EVN Cụ Thể (#1)</span>
                </>
              )}
            </button>
            {imisResults.length >= 2 && (
              <button
                onClick={handleSelectAverage}
                title={selectedIdx === 'AVERAGE' ? "Nhấp để HỦY CHỌN phương án giá trung bình" : "Chọn áp dụng đơn giá trung bình"}
                className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                  selectedIdx === 'AVERAGE'
                    ? 'bg-emerald-700 hover:bg-rose-600 text-white border-emerald-800 shadow-xs group'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {selectedIdx === 'AVERAGE' ? (
                  <>
                    <BarChart3 className="w-3.5 h-3.5 text-amber-300 group-hover:hidden" />
                    <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                    <span className="group-hover:hidden">📊 Chọn Đơn Giá Trung Bình EVN (AVG): {fmt(avgPrice)} đ</span>
                    <span className="hidden group-hover:inline">Hủy Chọn Giá Trung Bình</span>
                  </>
                ) : (
                  <>
                    <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                    <span>📊 Chọn Đơn Giá Trung Bình EVN (AVG): {fmt(avgPrice)} đ</span>
                  </>
                )}
              </button>
            )}
            {selectedIdx !== null && (
              <button
                onClick={handleDeselectRecord}
                title="Hủy chọn toàn bộ căn cứ IMIS (không áp dụng kết quả này làm mốc so sánh)"
                className="px-2.5 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-600 hover:text-white shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hủy Chọn IMIS</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thẻ Phân Tích Kích Thước Thời Gian & Tốc Độ Trượt Giá So Chuẩn CPI (IMIS EVN) */}
      {selectedRec && selectedImisPrice > 0 && selectedTimeDelta.months > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-3 text-xs shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-950">
              <Clock className="w-4 h-4 text-purple-700" />
              <span>KÍCH THƯỚC THỜI GIAN & TỐC ĐỘ TRƯỢT GIÁ HỢP ĐỒNG IMIS EVN</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedTimeDelta.isOver12Months 
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {selectedTimeDelta.badgeText}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Ký: <b className="font-mono text-slate-700">{selectedDate || '—'}</b> (cách đây <b>{selectedTimeDelta.months}</b> tháng ~ <b>{selectedTimeDelta.years}</b> năm)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="bg-white/90 p-2 rounded-lg border border-purple-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Tốc Độ Tăng Giá Bình Quân</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className={`text-sm font-black font-mono ${escalation.annualPct > 5 ? 'text-red-600' : escalation.annualPct > 0 ? 'text-purple-700' : 'text-emerald-700'}`}>
                  {escalation.annualPct > 0 ? '+' : ''}{escalation.annualPct}% / năm
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">({escalation.totalPct > 0 ? '+' : ''}{escalation.totalPct}% tổng)</span>
              </div>
            </div>

            <div className="bg-white/90 p-2 rounded-lg border border-purple-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Mức Trần Sau Bù CPI 5%/Năm</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-sm font-black font-mono text-slate-900">
                  {fmt(priceCeiling)} đ
                </span>
                <span className="text-[10px] text-purple-600 font-medium">(Trần CPI)</span>
              </div>
            </div>

            <div className="bg-white/90 p-2 rounded-lg border border-purple-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">Đánh Giá Tính Hợp Lý</div>
              <div className="mt-0.5 text-[11px] font-bold">
                {dgTrinh <= 0 ? (
                  <span className="text-slate-500">—</span>
                ) : dgTrinh <= priceCeiling ? (
                  <span className="text-emerald-700 flex items-center gap-1">🟢 Đạt (Dưới trần CPI)</span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">🔴 Vượt trần CPI (+{fmt(dgTrinh - priceCeiling)} đ)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Căn Cứ IMIS EVN Tự Động */}
      {summaryText && (
        <div className={`p-4 rounded-xl border-2 shadow-sm transition ${
          isDeselected || summaryData?.status === 'IMIS_DESELECTED'
            ? 'bg-slate-100 border-slate-300 text-slate-700'
            : 'border-purple-300 bg-purple-50/80 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h5 className={`font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
              isDeselected || summaryData?.status === 'IMIS_DESELECTED' ? 'text-slate-700' : 'text-purple-900'
            }`}>
              <FileText className="w-4 h-4 text-purple-700" /> 📄 BẢN THUYẾT MINH CĂN CỨ IMIS EVN {isDeselected ? '(ĐÃ HỦY CHỌN)' : '(TỰ ĐỘNG TỔNG HỢP)'}
            </h5>
            <button
              onClick={copyToClipboard}
              className="bg-white hover:bg-slate-100 text-purple-800 border border-purple-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
            >
              📋 Sao Chép Thuyết Minh IMIS
            </button>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/70 p-3 rounded-lg border border-slate-200/80 text-slate-800">
            {summaryText}
          </p>
        </div>
      )}

      {/* In-Table Client Filter Bar */}
      {imisResults.length > 0 && (
        <div className="bg-slate-100/90 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="font-bold text-slate-700 shrink-0 flex items-center gap-1 text-[11px]">
              <Filter className="w-3.5 h-3.5 text-purple-700" /> Lọc tại chỗ ({filteredImisResults.length}/{imisResults.length}):
            </span>
            <input
              type="text"
              value={filterKw}
              onChange={e => setFilterKw(e.target.value)}
              placeholder="Lọc Tên vật tư / Mã VT / Số HĐ..."
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg flex-1 focus:outline-none focus:border-purple-500 font-medium"
            />
            <input
              type="text"
              value={filterUnit}
              onChange={e => setFilterUnit(e.target.value)}
              placeholder="Lọc Đơn vị EVN / Nhà thầu..."
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg flex-1 focus:outline-none focus:border-purple-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-slate-500">Mức Giá:</span>
            <button
              onClick={() => setPriceFilter('ALL')}
              className={`px-2 py-1 rounded-lg font-bold border transition ${
                priceFilter === 'ALL' ? 'bg-purple-900 text-white border-purple-950 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-200'
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

            {(filterKw || filterUnit || priceFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setFilterKw('');
                  setFilterUnit('');
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

      {/* Bảng dữ liệu IMIS EVN */}
      {loading || searching ? <LoadingSpinner /> : filteredImisResults.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead className="bg-purple-50 text-purple-950 font-bold border-b border-purple-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-24 text-center">Căn Cứ</th>
                <th className="py-2.5 px-2 border-r w-20 text-center">% Khớp</th>
                <th className="py-2.5 px-3 border-r">Tên Vật Tư / Hàng Hóa (IMIS)</th>
                <th className="py-2.5 px-3 border-r w-44">Đơn Vị EVN / Nhà Máy</th>
                <th className="py-2.5 px-3 border-r w-28 text-right font-mono bg-purple-100/50">Đơn Giá IMIS</th>
                <th className="py-2.5 px-3 border-r font-bold text-emerald-900 bg-emerald-50/50">Số Hợp Đồng / PO</th>
                <th className="py-2.5 px-3 border-r w-36">Ngày Ký & Thời Gian</th>
                <th className="py-2.5 px-3 border-r">Đơn Vị Cung Cấp / Nhà Thầu</th>
                <th className="py-2.5 px-3">Ghi Chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredImisResults.map((r, i) => {
                const isSelected = !isDeselected && (imisResults[selectedIdx] === r || imisResults.indexOf(r) === selectedIdx);
                const matchScore = r.match_score || 80;
                const dg = parseFloat(r.don_gia || r.gia || r.donGia || 0);
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
                const donViName = r.ten_don_vi || r.nha_may || r.don_vi || 'NMNĐ Thái Bình';
                return (
                  <tr key={i} className={`transition text-[11px] ${isSelected ? 'bg-purple-100/70 border-l-4 border-l-purple-700 font-semibold' : 'hover:bg-purple-50/30'}`}>
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => handleSelectRecord(r)}
                        title={isSelected ? "Bấm để HỦY CHỌN dòng này" : "Chọn dòng này làm căn cứ thẩm định"}
                        className={`text-[10px] px-2.5 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto group ${
                          isSelected
                            ? 'bg-purple-700 hover:bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-200 hover:bg-purple-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3 h-3 group-hover:hidden" />
                            <X className="w-3 h-3 hidden group-hover:inline" />
                            <span className="group-hover:hidden">Đã Chọn</span>
                            <span className="hidden group-hover:inline">Hủy Chọn</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3 h-3" />
                            <span>Chọn</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2 border-r text-center font-mono font-bold">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        matchScore >= 90 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        matchScore >= 70 ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                        'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {matchScore}%
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r">
                      <div className="font-bold text-slate-900">{r.ten_vt || r.ten_hang_hoa || r.mo_ta || '—'}</div>
                      <div className="font-mono text-purple-700 text-[10px] font-semibold">{r.ma_vt || r.ma_hang_hoa || '—'}</div>
                    </td>
                    <td className="py-2 px-3 border-r">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        🏢 {donViName}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-purple-900 bg-purple-50/20">
                      {fmt(dg)} đ
                      {diff !== 0 && (
                        <div className={`text-[9.5px] font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}% so với trình
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r font-bold text-emerald-950 bg-emerald-50/30">{r.so_hop_dong || r.so_hd || r.so_po || '—'}</td>
                    <td className="py-2 px-3 border-r text-slate-700 font-mono">
                      <div className="font-semibold">{r.ngay_ky || r.thang_nam || r.nam || '—'}</div>
                      {(() => {
                        const td = computeTimeDelta(r.ngay_ky || r.thang_nam || r.nam);
                        if (td.badgeText === '—') return null;
                        return (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold mt-0.5 ${
                            td.isOver12Months ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}>
                            {td.badgeText}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 px-3 border-r text-slate-800 font-semibold truncate max-w-[140px]" title={r.nha_thau || r.nha_cung_cap}>
                      {r.nha_thau || r.nha_cung_cap || '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-500 italic truncate max-w-[150px]" title={r.ghi_chu || r.dien_giai}>
                      {r.ghi_chu || r.dien_giai || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : data !== null ? (
        <EmptyState text="Không tìm thấy dữ liệu IMIS EVN tương đương. Hãy thử nhập từ khóa khác ở thanh tra cứu thủ công." />
      ) : (
        <EmptyState text="Nhấn vào tab IMIS để tra cứu toàn ngành EVN..." />
      )}
      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={() => onSave({
          imis: imisResults,
          summary: summaryData,
          summary_text: summaryText,
          keyword: searchKey,
          used_keyword: searchKey,
          selected_record: typeof selectedIdx === 'number' ? imisResults[selectedIdx] : (selectedIdx === 'AVERAGE' ? 'AVERAGE' : 'NONE'),
          is_deselected: isDeselected,
          use_average: selectedIdx === 'AVERAGE',
          time_delta: selectedTimeDelta,
          annual_escalation_pct: escalation.annualPct,
          price_ceiling_cpi: priceCeiling
        })}
        nextLabel="Cơ sở 4 (MSC)"
        prevLabel="Cơ sở 2 (ERP)"
      />
    </div>
  );
}
