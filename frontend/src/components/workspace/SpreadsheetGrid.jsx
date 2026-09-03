import React, { useState, useEffect } from 'react';
import { Table2, Calculator, Save, Plus, Search, Trash2, ShieldCheck, AlertTriangle, Eye, Sparkles } from 'lucide-react';

export default function SpreadsheetGrid({
  quoteData,
  onSaveQuote,
  onRowClick,
  activeFilename,
  isLoading,
  dossierItems = [],
  onSelectInspectorItem
}) {
  const [items, setItems] = useState([]);
  const [targetPdfTotal, setTargetPdfTotal] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (quoteData) {
      setItems(quoteData.items || []);
      setTargetPdfTotal(quoteData.total_amount ? Math.round(quoteData.total_amount).toString() : '');
    } else {
      setItems([]);
      setTargetPdfTotal('');
    }
  }, [quoteData]);

  const formatMoney = (val) => {
    if (!val && val !== 0) return '0';
    return Math.round(val).toLocaleString('vi-VN');
  };

  const handleRowChange = (idx, field, value) => {
    const newItems = [...items];
    const item = { ...newItems[idx] };

    if (field === 'so_luong') {
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
      du_toan_stt: items.length + 1,
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
    if (window.confirm("Bạn có chắc chắn muốn xóa dòng bóc tách này?")) {
      const newItems = items.filter((_, i) => i !== idx);
      setItems(newItems);
    }
  };

  const recalculatedTotal = items.reduce((sum, it) => sum + (it.thanh_tien || 0), 0);
  const targetVal = parseFloat(targetPdfTotal) || 0;
  const diff = recalculatedTotal - targetVal;
  const isMatch = Math.abs(diff) < 2;

  const handleSave = () => {
    if (!activeFilename) {
      alert("⚠️ Vui lòng chọn 1 nhà thầu ở danh sách bên trái để lưu!");
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

  const filteredItems = items.filter((it) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const name = (it.ten_vt || '').toLowerCase();
    const spec = (it.tskt || '').toLowerCase();
    const sttEst = (it.du_toan_stt || '').toString();
    return name.includes(q) || spec.includes(q) || sttEst.includes(q);
  });

  // Smart suggestion logic
  const getSuggestedEstItem = (item) => {
    if (!dossierItems || dossierItems.length === 0) return null;
    const name = (item.ten_vt || '').toLowerCase();
    const spec = (item.tskt || '').toLowerCase();

    if (spec) {
      const foundPart = dossierItems.find(it => (it.part_no && spec.includes(it.part_no.toLowerCase())) || (it.ma_vt && spec.includes(it.ma_vt.toLowerCase())));
      if (foundPart) return foundPart;
    }

    const foundName = dossierItems.find(it => it.ten_vt && name.includes(it.ten_vt.toLowerCase().slice(0, 8)));
    return foundName || null;
  };

  return (
    <div className="flex-1 bg-white border-l flex flex-col shrink-0 overflow-hidden shadow-xs h-full min-w-[580px]">
      {/* Header Bar */}
      <div className="p-3 bg-[#003366] text-white border-b flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-300/30 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-teal-300" />
          </div>
          <div>
            <h3 className="font-bold text-xs truncate max-w-[260px]" title={activeFilename || "Chưa chọn file"}>
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

      {/* Filter & Add Row Toolbar */}
      <div className="px-3 py-1.5 border-b bg-gray-50 flex items-center justify-between shrink-0 text-xs">
        <div className="relative w-52">
          <Search className="w-3 h-3 text-gray-400 absolute left-2 top-2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Tìm vật tư, Mục #..."
            className="w-full pl-6 pr-2 py-0.5 text-xs border rounded bg-white"
          />
        </div>

        <button
          onClick={handleAddRow}
          disabled={!quoteData}
          className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50 text-gray-700 rounded text-xs font-semibold flex items-center gap-1 shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-600" /> Thêm Dòng Mới
        </button>
      </div>

      {/* Table Body - Optimized 100% Fit Layout */}
      <div className="flex-1 overflow-auto bg-gray-100/50 p-2">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <Calculator className="w-6 h-6 mx-auto animate-spin mb-1 text-teal-600" /> Đang tải bảng bóc tách...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs italic">Không có dòng dữ liệu bóc tách nào.</div>
        ) : (
          <table className="w-full text-xs text-left border-collapse bg-white rounded border shadow-2xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b">
              <tr>
                <th className="py-2 px-1 text-center w-7 border-r">TT</th>
                <th className="py-2 px-1.5 text-center w-28 border-r bg-emerald-100/80 text-emerald-950 font-bold" title="Gắn với STT Mục trong Dự toán Thẩm định">
                  Gắn Mục #
                </th>
                <th className="py-2 px-2 border-r">Tên Hàng Hóa / Vật Tư</th>
                <th className="py-2 px-2 w-32 border-r">Thông Số Kỹ Thuật</th>
                <th className="py-2 px-1 text-center w-10 border-r">ĐVT</th>
                <th className="py-2 px-1 text-center w-10 border-r">SL</th>
                <th className="py-2 px-2 text-right w-24 border-r">Đơn Giá (đ)</th>
                <th className="py-2 px-2 text-right w-28 border-r bg-amber-50 text-amber-950 font-bold">Thành Tiền (đ)</th>
                <th className="py-2 px-1 text-center w-7 border-r">Tr.</th>
                <th className="py-2 px-1 text-center w-7">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((it, idx) => {
                const estStt = parseInt(it.du_toan_stt, 10);
                const matchedEstItem = dossierItems.find(x => (x.id === estStt) || (x.stt === estStt));
                const suggestedEstItem = !matchedEstItem ? getSuggestedEstItem(it) : null;
                const tooltipText = matchedEstItem 
                  ? `Mục #${matchedEstItem.id}: ${matchedEstItem.ten_vt_goc || matchedEstItem.ten_vt}`
                  : (suggestedEstItem ? `💡 Gợi ý: Mục #${suggestedEstItem.id} (${suggestedEstItem.ten_vt})` : 'Chọn STT Mục Dự Toán');

                return (
                  <tr
                    key={idx}
                    onClick={() => onRowClick(it.page || 1)}
                    className="hover:bg-blue-50/60 cursor-pointer transition h-10"
                  >
                    <td className="py-1 px-1 text-center font-mono border-r">
                      <input
                        type="text"
                        value={it.stt || idx + 1}
                        onChange={(e) => handleRowChange(idx, 'stt', e.target.value)}
                        className="w-6 text-center text-xs p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    {/* Cột Gắn Mục # Compact 95px layout with Inline Select + Eye Button + Tooltip */}
                    <td className="py-1 px-1 border-r bg-emerald-50/40" title={tooltipText}>
                      <div className="flex items-center gap-1">
                        <select
                          value={it.du_toan_stt || ''}
                          onChange={(e) => handleRowChange(idx, 'du_toan_stt', e.target.value)}
                          className="flex-1 text-[11px] font-mono font-bold text-emerald-950 py-0.5 px-1 border border-emerald-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 shadow-2xs truncate"
                        >
                          <option value="">-- Mục # --</option>
                          {dossierItems.map((dItem, dIdx) => (
                            <option key={dIdx} value={dItem.id || dIdx + 1}>
                              #{dItem.id || dIdx + 1}: {(dItem.ten_vt_goc || dItem.ten_vt || '').slice(0, 20)}...
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
                            title={`Soi Chi Tiết Mục #${matchedEstItem.id} trên View 3`}
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}

                        {/* Suggestion Sparkle button if no match selected yet */}
                        {!matchedEstItem && suggestedEstItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowChange(idx, 'du_toan_stt', suggestedEstItem.id);
                            }}
                            className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded shadow-2xs transition shrink-0 animate-pulse"
                            title={`Gợi ý: Click để gắn Mục #${suggestedEstItem.id} (${suggestedEstItem.ten_vt})`}
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-1 px-2 border-r">
                      <input
                        type="text"
                        value={it.ten_vt || ''}
                        onChange={(e) => handleRowChange(idx, 'ten_vt', e.target.value)}
                        onFocus={() => onRowClick(it.page || 1)}
                        className="w-full text-xs font-medium p-0.5 border rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="py-1 px-2 border-r">
                      <input
                        type="text"
                        value={it.tskt || ''}
                        onChange={(e) => handleRowChange(idx, 'tskt', e.target.value)}
                        onFocus={() => onRowClick(it.page || 1)}
                        className="w-full text-[11px] text-gray-600 p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-1 text-center border-r">
                      <input
                        type="text"
                        value={it.dvt || 'Cái'}
                        onChange={(e) => handleRowChange(idx, 'dvt', e.target.value)}
                        className="w-8 text-center text-xs p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-1 text-center border-r">
                      <input
                        type="number"
                        value={it.so_luong || 1}
                        onChange={(e) => handleRowChange(idx, 'so_luong', e.target.value)}
                        className="w-8 text-center font-mono font-bold text-xs p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-2 text-right border-r">
                      <input
                        type="text"
                        value={formatMoney(it.don_gia)}
                        onChange={(e) => handleRowChange(idx, 'don_gia', e.target.value)}
                        className="w-20 text-right font-mono font-semibold text-xs p-0.5 border rounded bg-transparent focus:bg-white"
                      />
                    </td>

                    <td className="py-1 px-2 text-right font-mono font-bold border-r bg-amber-50/40 text-amber-950">
                      {formatMoney(it.thanh_tien)} đ
                    </td>

                    <td className="py-1 px-1 text-center font-mono border-r text-gray-500 text-[11px]">
                      {it.page || 1}
                    </td>

                    <td className="py-1 px-1 text-center">
                      <button
                        onClick={(e) => handleDeleteRow(idx, e)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded transition"
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
