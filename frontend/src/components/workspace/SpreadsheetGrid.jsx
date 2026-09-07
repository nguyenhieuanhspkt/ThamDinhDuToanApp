import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table2, Calculator, Save, Plus, Search, Trash2, ShieldCheck,
  AlertTriangle, Eye, Wand2, CheckCircle2, AlertCircle, Info
} from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

// ── Vietnamese diacritics removal for robust fuzzy matching ──────────────────
function removeVietnameseTones(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
}

// ── Extract model codes, alphanumeric sequences, hyphenated part numbers ─────
function extractTechnicalCodes(text) {
  if (!text) return [];
  const matches = text.match(/[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*/g) || [];
  const ignore = new Set(['the', 'cho', 'cac', 'nay', 'loai', 'type', 'part', 'model', 'vnd', 'usd', 'eur', 'page', 'stt']);
  return matches
    .map(m => m.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(m => m.length >= 3 && !ignore.has(m));
}

// ── Product Categories & Synonyms ───────────────────────────────────────────
const PRODUCT_CATEGORIES = {
  PUMP:     ['bom', 'pump', 'canh khuay'],
  VALVE:    ['van', 'valve', 'cau', 'mot chieu', 'buom', 'bi', 'giam ap', 'an toan', 'selector valve'],
  ACTUATOR: ['actuator', 'khi nen', 'dieu khien khi nen', 'chap hanh', 'flowtek'],
  SOLENOID: ['solenoid', 'cuon hut', 'namur'],
  GASKET:   ['gasket', 'gioang', 'dem', 'o-ring', 'vong dem', 'spiral'],
  FITTING:  ['fitting', 'union', 'elbow', 'rac co', 'te', 'dau noi', 'connector', 'g 10-pl', 'dpr 10', 'khop noi'],
  TUBE:     ['tube', 'pipe', 'ong'],
  SWITCH:   ['nut nhan', 'call point', 'switch', 'cong tac', 'khan cap'],
  MODULE:   ['module', 'card', 'bo mach', 'iux'],
  MOTOR:    ['dong co', 'motor', 'mo to'],
  BEARING:  ['vong bi', 'bearing', 'bac dan'],
  FILTER:   ['loc', 'filter', 'loi loc']
};

function detectCategory(textNorm) {
  for (const [cat, keywords] of Object.entries(PRODUCT_CATEGORIES)) {
    for (const kw of keywords) {
      if (textNorm.includes(kw)) return cat;
    }
  }
  return null;
}

const COMMON_BRANDS = [
  'grundfos', 'flowtek', 'bray', 'swagelok', 'apollo', 'minimax', 'gefa',
  'parker', 'siemens', 'abb', 'danfoss', 'kitz', 'yokogawa', 'emerson',
  'spirax sarco', 'festo', 'smc', 'omron', 'schneider', 'weidmuller',
  'endress', 'rosemount', 'fisher', 'masoneilan', 'ksb', 'ebara'
];

// ── Normalize Score to Percentage (0% - 99%) ────────────────────────────────
function calculateConfidence(score) {
  if (!score || score <= 0) return 0;
  // Exponential normalization mapping score to 20% - 99%
  const conf = Math.min(99, Math.max(25, Math.round(100 * (1 - Math.exp(-score / 60)))));
  return conf;
}

// ── Multi-Factor Smart Matching Engine ───────────────────────────────────────
function scoreDossierMatch(quotedItem, estItem) {
  let score = 0;
  const reasons = [];

  const qName = quotedItem.ten_vt || '';
  const qTskt = quotedItem.tskt || '';
  const qFull = `${qName} ${qTskt}`;
  const qNorm = removeVietnameseTones(qFull);

  const eGoc = estItem.ten_vt_goc || '';
  const eFull = `${eGoc} ${estItem.ten_vt || ''} ${estItem.thong_so_kt || ''} ${estItem.part_no || ''}`;
  const eNorm = removeVietnameseTones(eFull);
  const eHsxNorm = removeVietnameseTones(estItem.hsx_xx || '');

  // 1. Category Detection & Conflict Exclusion
  const qCat = detectCategory(qNorm);
  const eCat = detectCategory(eNorm);
  if (qCat && eCat) {
    if (qCat === eCat) {
      score += 35;
      reasons.push(`Chủng loại: ${qCat}`);
    } else {
      // Hard Conflict (e.g. Pump vs Valve)
      return { score: 0, reasons: [] };
    }
  }

  // 2. Brand Recognition
  for (const brand of COMMON_BRANDS) {
    const qHasBrand = qNorm.includes(brand);
    const eHasBrand = eNorm.includes(brand) || eHsxNorm.includes(brand);
    if (qHasBrand && eHasBrand) {
      score += 45;
      reasons.push(`Hãng: ${brand.toUpperCase()}`);
      break;
    }
  }

  // 3. Technical Model Codes & Alphanumerics
  const qCodes = extractTechnicalCodes(qFull);
  const eCodes = extractTechnicalCodes(eFull);

  for (const qc of qCodes) {
    if (qc.length < 3) continue;
    for (const ec of eCodes) {
      if (ec.length < 3) continue;
      if (qc === ec) {
        score += 40;
        reasons.push(`Mã: ${qc.toUpperCase()}`);
        break;
      } else if (qc.length >= 4 && ec.length >= 4 && (qc.includes(ec) || ec.includes(qc))) {
        score += 25;
        reasons.push(`Mã gần khớp: ${qc.toUpperCase()}`);
        break;
      }
    }
  }

  // 4. ERP Material Code Match
  if (estItem.ma_vt && estItem.ma_vt !== 'Chưa có mã vật tư') {
    const cleanMa = estItem.ma_vt.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanMa.length >= 5 && qNorm.replace(/[^a-z0-9]/g, '').includes(cleanMa)) {
      score += 60;
      reasons.push(`Mã ERP: ${estItem.ma_vt}`);
    }
  }

  // 5. Price Proximity (Quoted Unit Price vs Estimated Unit Price)
  const qPrice = parseFloat(quotedItem.don_gia) || 0;
  const ePrice = parseFloat(estItem.don_gia_trinh) || 0;
  if (qPrice > 0 && ePrice > 0) {
    const ratio = Math.min(qPrice, ePrice) / Math.max(qPrice, ePrice);
    if (ratio >= 0.9) {
      score += 35;
      reasons.push(`Đơn giá sát (${Math.round(ratio * 100)}%)`);
    } else if (ratio >= 0.75) {
      score += 20;
      reasons.push(`Đơn giá gần (${Math.round(ratio * 100)}%)`);
    } else if (ratio >= 0.5) {
      score += 10;
    }
  }

  // 6. Quantity Match
  const qQty = parseFloat(quotedItem.so_luong) || 0;
  const eQty = parseFloat(estItem.so_luong) || 0;
  if (qQty > 0 && eQty > 0 && qQty === eQty) {
    score += 10;
  }

  return { score, reasons };
}

// ── Main SpreadsheetGrid Component ───────────────────────────────────────────
export default function SpreadsheetGrid({
  quoteData,
  onSaveQuote,
  onRowClick,
  activeFilename,
  isLoading,
  dossierItems = [],
  onSelectInspectorItem
}) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [targetPdfTotal, setTargetPdfTotal] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // ── Calculate Suggestions for a Quoted Item ────────────────────────────────
  const getSuggestions = useCallback((item) => {
    if (!dossierItems || dossierItems.length === 0) return [];
    const scored = dossierItems.map(dItem => {
      const { score, reasons } = scoreDossierMatch(item, dItem);
      return { item: dItem, score, confidence: calculateConfidence(score), reasons };
    });
    return scored
      .filter(s => s.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [dossierItems]);

  // ── Auto-Fill on Load: Điền tự động nếu khớp, chưa khớp cũng điền kèm cảnh báo ──
  useEffect(() => {
    if (quoteData && quoteData.items) {
      const rawList = quoteData.items || [];
      const populated = rawList.map((it) => {
        // Nếu dòng này đã có du_toan_stt hợp lệ thì giữ nguyên
        if (it.du_toan_stt) {
          const matched = dossierItems.find(x => x.id === parseInt(it.du_toan_stt, 10));
          if (matched) {
            const { score, reasons } = scoreDossierMatch(it, matched);
            return {
              ...it,
              match_confidence: calculateConfidence(score),
              match_reasons: reasons,
              auto_matched: it.auto_matched || false
            };
          }
          return it;
        }

        // Nếu CHƯA ĐƯỢC GẮN: Tự động tìm ứng viên tốt nhất để điền vào luôn!
        const suggestions = getSuggestions(it);
        if (suggestions.length > 0) {
          const top = suggestions[0];
          return {
            ...it,
            du_toan_stt: top.item.id,
            match_confidence: top.confidence,
            match_reasons: top.reasons,
            auto_matched: true // đánh dấu tự động gán
          };
        }

        return it;
      });

      setItems(populated);
      setTargetPdfTotal(quoteData.total_amount ? Math.round(quoteData.total_amount).toString() : '');
    } else {
      setItems([]);
      setTargetPdfTotal('');
    }
  }, [quoteData, dossierItems, getSuggestions]);

  const formatMoney = (val) => {
    if (!val && val !== 0) return '0';
    return Math.round(val).toLocaleString('vi-VN');
  };

  const handleRowChange = (idx, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[idx] };

    if (field === 'du_toan_stt') {
      item.du_toan_stt = value;
      item.auto_matched = false; // Người dùng tự chọn bằng tay
      const matched = dossierItems.find(x => x.id === parseInt(value, 10));
      if (matched) {
        const { score, reasons } = scoreDossierMatch(item, matched);
        item.match_confidence = calculateConfidence(score);
        item.match_reasons = reasons;
      }
    } else if (field === 'so_luong') {
      item.so_luong = parseFloat(value) || 0;
      item.thanh_tien = Math.round(item.so_luong * (item.don_gia || 0));
    } else if (field === 'don_gia') {
      const raw = value.toString().replace(/[^\d]/g, '');
      item.don_gia = parseFloat(raw) || 0;
      item.thanh_tien = Math.round((item.so_luong || 0) * item.don_gia);
    } else if (field === 'thanh_tien') {
      const raw = value.toString().replace(/[^\d]/g, '');
      item.thanh_tien = parseFloat(raw) || 0;
    } else {
      item[field] = value;
    }

    newItems[idx] = item;
    setItems(newItems);
  };

  const handleAddRow = () => {
    const newItem = {
      stt: items.length + 1,
      du_toan_stt: '',
      ten_vt: 'Vật tư mới',
      tskt: '',
      dvt: 'Cái',
      so_luong: 1,
      don_gia: 0,
      thanh_tien: 0,
      page: 1
    };
    setItems([...items, newItem]);
  };

  const handleDeleteRow = (idx, e) => {
    e.stopPropagation();
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
  };

  const recalculatedTotal = items.reduce((sum, it) => sum + (it.thanh_tien || 0), 0);
  const targetVal = parseFloat(targetPdfTotal) || 0;
  const diff = recalculatedTotal - targetVal;
  const isMatch = Math.abs(diff) < 2;

  const handleSave = () => {
    if (!activeFilename) {
      toast.error('Vui lòng chọn 1 nhà thầu bên trái để lưu!');
      return;
    }
    const updatedQuote = {
      filename: activeFilename,
      total_amount: recalculatedTotal,
      original_total: targetVal,
      items: items
    };
    onSaveQuote(updatedQuote);
  };

  // ── Force Re-Auto-Match All Rows ──────────────────────────────────────────
  const handleReAutoMatchAll = () => {
    let highCount = 0;
    let warnCount = 0;

    const newItems = items.map(it => {
      const suggestions = getSuggestions(it);
      if (suggestions.length > 0) {
        const top = suggestions[0];
        if (top.confidence >= 75) highCount++;
        else warnCount++;
        return {
          ...it,
          du_toan_stt: top.item.id,
          match_confidence: top.confidence,
          match_reasons: top.reasons,
          auto_matched: true
        };
      }
      return it;
    });

    setItems(newItems);
    toast.success(`Đã tự động suy đoán ${items.length} dòng: ${highCount} khớp cao 🟢, ${warnCount} cần lưu ý ⚠️`);
  };

  const filteredItems = items.filter((it) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const name = (it.ten_vt || '').toLowerCase();
    const spec = (it.tskt || '').toLowerCase();
    const sttEst = (it.du_toan_stt || '').toString();
    return name.includes(q) || spec.includes(q) || sttEst.includes(q);
  });

  return (
    <div className="flex-1 bg-white border-l flex flex-col shrink-0 overflow-hidden shadow-xs h-full min-w-[700px]">
      {/* Header Bar */}
      <div className="p-3 bg-[#003366] text-white border-b flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-300/30 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <h3 className="font-bold text-xs truncate max-w-[260px]" title={activeFilename || 'Chưa chọn file'}>
              BÓC TÁCH BÁO GIÁ
            </h3>
            <p className="text-[10px] text-teal-200 truncate">
              {activeFilename ? activeFilename : 'Vui lòng chọn 1 nhà thầu bên trái'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!activeFilename || items.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition text-xs"
        >
          <Save className="w-3.5 h-3.5 text-amber-300" /> Lưu Hiệu Chỉnh
        </button>
      </div>

      {/* Calculator Summary Bar */}
      <div className="px-3 py-2 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-amber-950 text-[11px]">
            Số mục: <strong className="font-mono text-xs">{items.length}</strong>
          </span>

          <div className="h-3 w-px bg-amber-300"></div>

          <div className="flex items-center gap-1">
            <span className="text-blue-900 font-semibold text-[11px]">Mốc PDF:</span>
            <input
              type="text"
              value={formatMoney(targetVal)}
              onChange={(e) => setTargetPdfTotal(e.target.value)}
              className="w-24 font-mono font-bold text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-300 text-xs text-right"
            />
          </div>

          <div className="h-3 w-px bg-amber-300"></div>

          <div className="flex items-center gap-1">
            <span className="font-bold text-amber-950 text-[11px]">Tính lại:</span>
            <span className="font-mono font-black text-emerald-800 text-xs bg-white px-1.5 py-0.5 rounded border border-amber-300">
              {formatMoney(recalculatedTotal)} đ
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isMatch ? (
            <span className="bg-emerald-100 text-emerald-950 font-bold px-2 py-0.5 rounded-full text-[10.5px] flex items-center gap-1 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 🟢 KHỚP SỐ DƯ
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-950 font-bold px-2 py-0.5 rounded-full text-[10.5px] flex items-center gap-1 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> ⚠️ LỆCH: {diff > 0 ? `+${formatMoney(diff)}` : formatMoney(diff)} đ
            </span>
          )}
        </div>
      </div>

      {/* Filter & Batch Actions Toolbar */}
      <div className="px-3 py-1.5 border-b bg-gray-50 flex items-center justify-between shrink-0 text-xs gap-2">
        <div className="relative w-48">
          <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Tìm vật tư, Mục #..."
            className="w-full pl-6 pr-2 py-0.5 text-xs border rounded bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReAutoMatchAll}
            disabled={!quoteData || items.length === 0}
            className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition"
            title="Quét và tự động điền lại tất cả các dòng"
          >
            <Wand2 className="w-3.5 h-3.5" /> ⚡ Tự Động Gán Lại Tất Cả
          </button>

          <button
            onClick={handleAddRow}
            disabled={!quoteData}
            className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 text-gray-700 rounded text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" /> Thêm Dòng
          </button>
        </div>
      </div>

      {/* Table Body - Optimized Horizontal Space Layout */}
      <div className="flex-1 overflow-auto bg-gray-100/50 p-2">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <Calculator className="w-6 h-6 mx-auto animate-spin mb-1 text-teal-600" /> Đang tải bảng bóc tách...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs italic">Không có dòng dữ liệu bóc tách nào.</div>
        ) : (
          <table className="w-full text-xs text-left border-collapse bg-white rounded border shadow-2xs min-w-[900px]">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b">
              <tr>
                <th className="py-2 px-1 text-center w-8 border-r">TT</th>
                <th className="py-2 px-2 text-left w-64 min-w-[220px] border-r bg-emerald-100/80 text-emerald-950 font-bold" title="Gắn với STT Mục trong Dự toán Thẩm định">
                  Gắn Mục # Dự Toán
                </th>
                <th className="py-2 px-3 min-w-[280px] border-r">Tên Hàng Hóa / Vật Tư Trong Báo Giá</th>
                <th className="py-2 px-3 min-w-[200px] border-r">Thông Số Kỹ Thuật Báo Giá</th>
                <th className="py-2 px-1 text-center w-12 border-r">ĐVT</th>
                <th className="py-2 px-1 text-center w-12 border-r">SL</th>
                <th className="py-2 px-2 text-right w-28 border-r">Đơn Giá (đ)</th>
                <th className="py-2 px-2 text-right w-32 border-r bg-amber-50 text-amber-950 font-bold">Thành Tiền (đ)</th>
                <th className="py-2 px-1 text-center w-8 border-r">Tr.</th>
                <th className="py-2 px-1 text-center w-8">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((it, idx) => {
                const estStt = parseInt(it.du_toan_stt, 10);
                const matchedEstItem = dossierItems.find(x => (x.id === estStt) || (x.stt === estStt));
                const conf = it.match_confidence || (matchedEstItem ? 85 : 0);
                const isHighMatch = conf >= 75;

                // Price comparison
                let priceDiffText = null;
                if (matchedEstItem && matchedEstItem.don_gia_trinh && it.don_gia) {
                  const pTrinh = parseFloat(matchedEstItem.don_gia_trinh);
                  const pQuote = parseFloat(it.don_gia);
                  const diffPct = ((pQuote - pTrinh) / pTrinh) * 100;
                  priceDiffText = diffPct === 0
                    ? 'Khớp 100% giá trình'
                    : `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}% so với trình`;
                }

                // Row background highlight for attention
                const cellBgClass = matchedEstItem
                  ? (isHighMatch ? 'bg-emerald-50/50' : 'bg-amber-50/80')
                  : 'bg-white';

                return (
                  <tr
                    key={idx}
                    onClick={() => onRowClick(it.page || 1)}
                    className="hover:bg-blue-50/60 cursor-pointer transition h-12"
                  >
                    <td className="py-1 px-1 text-center font-mono border-r">
                      <input
                        type="text"
                        value={it.stt || idx + 1}
                        onChange={(e) => handleRowChange(idx, 'stt', e.target.value)}
                        className="w-7 text-center text-xs p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    {/* Cột Gắn Mục # Thông Minh (Auto-Filled + Two-Tier Warning Badges) */}
                    <td className={`py-1.5 px-2 border-r ${cellBgClass}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <select
                            value={it.du_toan_stt || ''}
                            onChange={(e) => handleRowChange(idx, 'du_toan_stt', e.target.value)}
                            className={`flex-1 text-[11px] font-mono font-bold py-1 px-1.5 border rounded shadow-2xs truncate ${
                              matchedEstItem
                                ? isHighMatch
                                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                                  : 'bg-amber-100 text-amber-950 border-amber-400 animate-pulse'
                                : 'bg-white text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="">-- Chưa gán mục --</option>
                            {dossierItems.map((dItem, dIdx) => (
                              <option key={dIdx} value={dItem.id || dIdx + 1}>
                                #{dItem.id || dIdx + 1}: {(dItem.ten_vt_goc || dItem.ten_vt || '').slice(0, 32)}... ({formatMoney(dItem.don_gia_trinh)} đ)
                              </option>
                            ))}
                          </select>

                          {/* Eye Button to jump straight to View 3 Inspector */}
                          {onSelectInspectorItem && matchedEstItem && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetIdx = dossierItems.indexOf(matchedEstItem);
                                if (targetIdx >= 0) onSelectInspectorItem(targetIdx);
                              }}
                              className="p-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-2xs transition shrink-0"
                              title={`Soi Chi Tiết Mục #${matchedEstItem.id} trên View Duyệt Chi Tiết`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Status / Warning Notification Indicator */}
                        {matchedEstItem ? (
                          isHighMatch ? (
                            <div className="flex items-center justify-between text-[10px] text-emerald-900 font-semibold leading-tight">
                              <span className="flex items-center gap-1 truncate max-w-[150px]" title={matchedEstItem.ten_vt_goc || matchedEstItem.ten_vt}>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                {it.auto_matched ? `Tự động khớp (${conf}%)` : 'Đã chọn'}
                              </span>
                              {priceDiffText && (
                                <span className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-200/80 px-1 py-0.2 rounded shrink-0">
                                  {priceDiffText}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[10px] text-amber-900 font-bold bg-amber-200/70 border border-amber-300 px-1.5 py-0.5 rounded leading-tight">
                              <span className="flex items-center gap-1 truncate" title={`Lý do: ${(it.match_reasons || []).join(', ') || 'Chưa đủ thông tin khẳng định'}`}>
                                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                Cảnh báo: Tạm gán ({conf}%) - Cần duyệt lại!
                              </span>
                            </div>
                          )
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">
                            Chưa tìm thấy mục phù hợp
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cột Tên Hàng Hóa / Vật Tư (Rộng rãi, dễ đọc) */}
                    <td className="py-1 px-2 border-r">
                      <input
                        type="text"
                        value={it.ten_vt || ''}
                        onChange={(e) => handleRowChange(idx, 'ten_vt', e.target.value)}
                        onFocus={() => onRowClick(it.page || 1)}
                        className="w-full text-xs font-semibold text-slate-900 p-1 border border-slate-200 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500"
                        title={it.ten_vt || ''}
                      />
                    </td>

                    {/* Cột Thông Số Kỹ Thuật (Rộng rãi) */}
                    <td className="py-1 px-2 border-r">
                      <input
                        type="text"
                        value={it.tskt || ''}
                        onChange={(e) => handleRowChange(idx, 'tskt', e.target.value)}
                        onFocus={() => onRowClick(it.page || 1)}
                        className="w-full text-[11px] text-slate-600 p-1 border border-slate-200 rounded bg-transparent focus:bg-white"
                        title={it.tskt || ''}
                      />
                    </td>

                    <td className="py-1 px-1 border-r text-center">
                      <input
                        type="text"
                        value={it.dvt || ''}
                        onChange={(e) => handleRowChange(idx, 'dvt', e.target.value)}
                        className="w-full text-center text-xs p-1 border border-slate-200 rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-1 border-r text-center font-mono">
                      <input
                        type="text"
                        value={it.so_luong || 1}
                        onChange={(e) => handleRowChange(idx, 'so_luong', e.target.value)}
                        className="w-full text-center font-mono text-xs font-bold p-1 border border-slate-200 rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-2 border-r text-right font-mono">
                      <input
                        type="text"
                        value={formatMoney(it.don_gia)}
                        onChange={(e) => handleRowChange(idx, 'don_gia', e.target.value)}
                        className="w-full text-right font-mono text-xs font-bold text-slate-900 p-1 border border-slate-200 rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-2 border-r text-right font-mono font-extrabold text-amber-950 bg-amber-50/50">
                      {formatMoney(it.thanh_tien)} đ
                    </td>

                    <td className="py-1 px-1 border-r text-center font-mono text-slate-500 text-[10px]">
                      {it.page || 1}
                    </td>

                    <td className="py-1 px-1 text-center">
                      <button
                        onClick={(e) => handleDeleteRow(idx, e)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
