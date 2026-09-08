import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag, Search, Plus, ExternalLink, Trash2, Edit3, Save,
  RotateCcw, AlertTriangle, CheckCircle, Check, Loader2, Link,
  DollarSign, Camera, Eye, X, Image as ImageIcon, Pin, ArrowRight, FileText,
  Truck, Ship, Percent
} from 'lucide-react';
import { useToast } from '../../ui/Toast.jsx';
import { fmt } from '../utils/formatters.js';
import { generateKeywordCandidates, getDefaultImisKeyword, computeLandedCost } from '../utils/keywordHelpers.js';
import { PillarHeader, LoadingSpinner, SaveFooter, EmptyState } from '../common';

export default function PillarEcom({ loading, saving, data, dgTrinh, item, onSave, saved, onAutoSave }) {
  const toast = useToast();
  const candidates = generateKeywordCandidates(item?.ten_vt);
  const defaultKw = data?.keyword || data?.search_keyword || getDefaultImisKeyword(item?.ten_vt);

  const [searchKey, setSearchKey] = useState(defaultKw);
  const [urlItems, setUrlItems] = useState(data?.items || []);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selectedRecord = urlItems[selectedIdx] || urlItems[0];
  const rawSelPrice = selectedRecord ? parseFloat(selectedRecord.price || 0) : 0;
  const isLandedActive = selectedRecord?.has_landed_cost ?? (selectedRecord?.currency === 'USD' || Boolean(selectedRecord?.landed_price));
  const selLandedPrice = (isLandedActive && selectedRecord?.landed_price)
    ? parseFloat(selectedRecord.landed_price)
    : (isLandedActive && rawSelPrice > 0 ? computeLandedCost(rawSelPrice, selectedRecord?.landed_surcharge_pct ?? 20) : rawSelPrice);
  const selectedPrice = selLandedPrice > 0 ? selLandedPrice : rawSelPrice;

  const diffAmt = dgTrinh - selectedPrice;
  const diffPct = selectedPrice > 0 ? ((dgTrinh - selectedPrice) / selectedPrice * 100) : 0;

  const computeDefaultSummary = (itemsList, selRec, kw) => {
    const sRec = selRec || (itemsList && itemsList[0]);
    const rawPrice = sRec ? parseFloat(sRec.price || 0) : 0;
    const hasLanded = sRec?.has_landed_cost ?? (sRec?.currency === 'USD' || Boolean(sRec?.landed_price));
    const surchargePct = sRec?.landed_surcharge_pct ?? 20;
    const sPrice = (hasLanded && sRec?.landed_price) ? parseFloat(sRec.landed_price) : (hasLanded && rawPrice > 0 ? computeLandedCost(rawPrice, surchargePct) : rawPrice);

    const dAmt = dgTrinh - sPrice;
    const dPct = sPrice > 0 ? ((dgTrinh - sPrice) / sPrice * 100) : 0;
    const thoiGian = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN');

    const usdInfo = (sRec?.currency === 'USD' && sRec?.price_usd)
      ? ` (tương đương $${sRec.price_usd.toLocaleString('en-US')} USD, tỷ giá ${fmt(sRec.exchange_rate || 25450)} đ/USD)`
      : '';
    const imgInfo = sRec?.image_url ? ' kèm ảnh chụp màn hình minh chứng niêm yết' : '';

    let landedDesc = '';
    if (hasLanded && rawPrice > 0 && sPrice !== rawPrice) {
      landedDesc = ` [Giá niêm yết web: ${fmt(rawPrice)} đ; sau khi cộng chi phí vận chuyển quốc tế, thuế NK & hải quan (+${surchargePct}%), giá Landed Cost DDP Vĩnh Tân 4 là ${fmt(sPrice)} đ]`;
    }

    if (itemsList && itemsList.length > 0 && sRec) {
      if (dAmt <= 0) {
        return `Đã tra cứu từ khóa [${kw}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${sRec.vendor || 'Internet'}) tại đường link [${sRec.url || 'Web'}] lúc ${thoiGian}${imgInfo}; ghi nhận mức giá niêm yết công khai tham chiếu là ${fmt(sPrice)} đ${usdInfo}${landedDesc}. Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương đơn giá thị trường đã tính chi phí nhập cảnh Landed Cost.`;
      } else {
        return `Đã tra cứu từ khóa [${kw}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${sRec.vendor || 'Internet'}) tại đường link [${sRec.url || 'Web'}] lúc ${thoiGian}${imgInfo}; ghi nhận mức giá niêm yết công khai tham chiếu là ${fmt(sPrice)} đ${usdInfo}${landedDesc}. Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${dPct.toFixed(1)}% (+${fmt(dAmt)} đ) so với đơn giá Landed Cost DDP Vĩnh Tân 4 (${fmt(sPrice)} đ).`;
      }
    } else {
      return `Đã tra cứu từ khóa [${kw}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`;
    }
  };

  const [summaryText, setSummaryText] = useState(data?.summary_text || computeDefaultSummary(data?.items || [], (data?.items || [])[0], defaultKw));
  const [isCustom, setIsCustom] = useState(Boolean(data?.summary_text));

  useEffect(() => {
    setSearchKey(defaultKw);
    const items = data?.items || [];
    setUrlItems(items);
    setSelectedIdx(0);
    if (data?.summary_text) {
      setSummaryText(data.summary_text);
      setIsCustom(true);
    } else {
      setSummaryText(computeDefaultSummary(items, items[0], defaultKw));
      setIsCustom(false);
    }
  }, [item?.id]);

  // Form input state for adding URL evidence
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle]   = useState(item?.ten_vt || '');
  const [newVendor, setNewVendor] = useState('');
  const [newUrl, setNewUrl]       = useState('');
  const [newPrice, setNewPrice]   = useState('');
  const [newNotes, setNewNotes]   = useState('');

  // USD Conversion state
  const [currency, setCurrency]         = useState('VND'); // 'VND' | 'USD'
  const [newPriceUsd, setNewPriceUsd]   = useState('');
  const [exchangeRate, setExchangeRate] = useState('25450');

  // Landed Cost (Chi phí nhập khẩu & vận chuyển DDP Vĩnh Tân 4)
  const [hasLandedCost, setHasLandedCost]           = useState(true);
  const [landedSurchargePct, setLandedSurchargePct] = useState('20');

  // Clipboard Paste Image state
  const [pastedImage, setPastedImage]               = useState(null);
  const [isPasting, setIsPasting]                   = useState(false);
  const [previewModalImage, setPreviewModalImage]   = useState(null);

  const calculatedVndPrice = currency === 'USD'
    ? Math.round((parseFloat(newPriceUsd) || 0) * (parseFloat(exchangeRate) || 25450))
    : (parseFloat(newPrice) || 0);

  const calculatedLandedPrice = hasLandedCost
    ? computeLandedCost(calculatedVndPrice, parseFloat(landedSurchargePct) || 20)
    : calculatedVndPrice;

  // Xử lý dán hình ảnh từ Clipboard (Ctrl + V)
  const handlePasteImageFromClipboard = async (e) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;
    for (let i = 0; i < clipboardItems.length; i++) {
      const itemObj = clipboardItems[i];
      if (itemObj.type && itemObj.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = itemObj.getAsFile();
        if (!blob) continue;

        setIsPasting(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const b64 = evt.target.result;
            const res = await fetch(`/api/items/${item.id}/paste-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_base64: b64 })
            });
            const d = await res.json();
            if (d.success) {
              const url = `/api/project-files/${d.rel_path}`;
              setPastedImage({ name: d.name, rel_path: d.rel_path, url });
              setShowAddForm(true);
              toast.success('Đã dán ảnh minh chứng từ Clipboard (Ctrl+V) thành công!');
            } else {
              toast.error('Lỗi lưu ảnh dán: ' + (d.message || 'Không rõ'));
            }
          } catch (err) {
            toast.error('Lỗi khi tải ảnh dán lên máy chủ');
          } finally {
            setIsPasting(false);
          }
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  // Quick preset vendors
  const presetVendors = [
    { name: 'eBay (Quốc tế)', domain: 'ebay.com' },
    { name: 'Misumi Việt Nam', domain: 'vn.misumi-ec.com' },
    { name: 'Siêu Thị Thiết Bị', domain: 'sieuthithietbi.com' },
    { name: 'Thiết Bị Vật Tư', domain: 'thietbivattu.com' },
    { name: 'Tiki / Shopee Mall', domain: 'shopee.vn' },
    { name: 'Lazada Việt Nam', domain: 'lazada.vn' },
    { name: 'Website Nhà Sản Xuất / Đại Lý', domain: 'dai-ly-chinh-hang.vn' }
  ];

  const handleAddUrl = () => {
    if (!newUrl.trim() && !newVendor.trim() && !pastedImage) {
      toast.error('Vui lòng nhập tên nhà cung cấp, đường link URL hoặc dán ảnh minh chứng');
      return;
    }
    const finalPrice = calculatedVndPrice;
    const isUsd = currency === 'USD';
    const usdVal = isUsd ? (parseFloat(newPriceUsd) || 0) : null;
    const rateVal = isUsd ? (parseFloat(exchangeRate) || 25450) : null;
    const surchargeVal = parseFloat(landedSurchargePct) || 20;
    const landedPriceVal = hasLandedCost ? computeLandedCost(finalPrice, surchargeVal) : finalPrice;

    let noteText = newNotes;
    if (!noteText) {
      if (isUsd && usdVal > 0) {
        noteText = `Quy đổi từ $${usdVal.toLocaleString('en-US')} USD (Tỷ giá: ${fmt(rateVal)} đ/USD)${hasLandedCost ? ` + Landed Cost ${surchargeVal}%` : ''}`;
      } else {
        noteText = pastedImage ? 'Có ảnh chụp màn hình minh chứng' : (hasLandedCost ? `Có tính Landed Cost +${surchargeVal}%` : 'Thông tin niêm yết công khai');
      }
    }

    const newItemObj = {
      id: Date.now(),
      search_keyword: searchKey,
      title: newTitle || item?.ten_vt || 'Mục tham khảo',
      vendor: newVendor || (pastedImage ? 'Ảnh chụp màn hình web' : 'Website Thương mại điện tử'),
      url: newUrl.startsWith('http') ? newUrl : (newUrl ? `https://${newUrl}` : '#'),
      price: finalPrice,
      landed_price: landedPriceVal,
      has_landed_cost: hasLandedCost,
      landed_surcharge_pct: surchargeVal,
      price_usd: usdVal,
      currency: currency,
      exchange_rate: rateVal,
      image_url: pastedImage?.url || null,
      image_name: pastedImage?.name || null,
      date: new Date().toLocaleDateString('vi-VN'),
      notes: noteText
    };
    const updated = [newItemObj, ...urlItems];
    setUrlItems(updated);
    setSelectedIdx(0);
    setShowAddForm(false);
    setNewVendor('');
    setNewUrl('');
    setNewPrice('');
    setNewPriceUsd('');
    setPastedImage(null);
    setNewNotes('');
    toast.success('Đã nạp dòng chứng cứ giá TMĐT thành công!');
    if (!isCustom) {
      setSummaryText(computeDefaultSummary(updated, newItemObj, searchKey));
    }
    if (onAutoSave) {
      onAutoSave({ items: updated, selected_record: newItemObj, search_keyword: searchKey });
    }
  };

  const handleDeleteUrl = (idx) => {
    const updated = urlItems.filter((_, i) => i !== idx);
    setUrlItems(updated);
    const newIdx = selectedIdx >= updated.length ? Math.max(0, updated.length - 1) : selectedIdx;
    if (selectedIdx >= updated.length) setSelectedIdx(newIdx);
    toast.success('Đã xóa dòng chứng cứ TMĐT');
    const newRec = updated[newIdx] || null;
    if (!isCustom) {
      setSummaryText(computeDefaultSummary(updated, newRec, searchKey));
    }
    if (onAutoSave) {
      onAutoSave({ items: updated, selected_record: newRec, search_keyword: searchKey });
    }
  };

  const handleResetSummary = () => {
    const def = computeDefaultSummary(urlItems, selectedRecord, searchKey);
    setSummaryText(def);
    setIsCustom(false);
    toast.info('Đã khôi phục lại bản thuyết minh tự động theo từ khóa');
  };

  const handleSaveCurrent = (stayHere = true) => {
    const payload = {
      items: urlItems,
      selected_record: selectedRecord || null,
      summary_text: summaryText,
      search_keyword: searchKey,
      has_landed_cost: isLandedActive,
      landed_surcharge_pct: selectedRecord?.landed_surcharge_pct ?? 20,
      landed_price: selectedPrice
    };
    onSave(payload, !stayHere);
  };

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Đã sao chép thuyết minh TMĐT vào clipboard!');
    }
  };

  return (
    <div className="space-y-4 focus:outline-none" onPaste={handlePasteImageFromClipboard} tabIndex={0}>
      <PillarHeader icon={ShoppingBag} color="cyan" title="CƠ SỞ 5: THƯƠNG MẠI ĐIỆN TỬ & GIÁ THỊ TRƯỜNG INTERNET (LINK URL)" loading={loading} />

      {/* Thanh Nhập Từ Khóa Tra Cứu TMĐT & Tích Hợp eBay / Misumi / Google */}
      <div className="bg-cyan-50/70 p-3 rounded-xl border border-cyan-200 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-cyan-700" /> Từ khóa tra cứu TMĐT:
          </span>
          <input
            type="text"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value)}
            placeholder="Nhập từ khóa hoặc mã vật tư tra cứu giá Internet / eBay..."
            className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-cyan-500 font-medium"
          />
          <button
            onClick={() => {
              window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchKey)}`, '_blank');
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
            title="Mở trang kết quả tìm kiếm thực tế trên eBay.com theo từ khóa"
          >
            🛒 Tìm Giá trên eBay.com ↗
          </button>
          <button
            onClick={() => {
              window.open(`https://vn.misumi-ec.com/vona2/result/?Keyword=${encodeURIComponent(searchKey)}`, '_blank');
            }}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
            title="Mở trang kết quả tìm kiếm thực tế trên Misumi Việt Nam"
          >
            🔎 Tìm Giá Misumi ↗
          </button>
          <button
            onClick={() => {
              window.open(`https://www.google.com/search?q=${encodeURIComponent(searchKey + ' gia ban')}`, '_blank');
            }}
            className="px-3 py-1.5 bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs shrink-0"
          >
            <Search className="w-3.5 h-3.5 text-cyan-700" /> Tìm Google Web ↗
          </button>
          <button
            onClick={() => {
              setShowAddForm(true);
              toast.info('Hãy chụp màn hình (Win + Shift + S) rồi bấm Ctrl + V để dán ảnh trực tiếp!');
            }}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
            title="Bấm để mở form hoặc trực tiếp nhấn Ctrl + V bất cứ lúc nào để dán ảnh màn hình từ Clipboard"
          >
            <Camera className="w-3.5 h-3.5" /> 📸 Dán Ảnh (Ctrl+V)
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm URL Mới
          </button>
        </div>

        {/* Thanh Ứng Viên Từ Khóa (Keyword Candidate Chips Bar) */}
        {candidates.length > 0 && (
          <div className="pt-1.5 border-t border-cyan-200/80 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-cyan-950 shrink-0 flex items-center gap-1">
              💡 Gợi ý từ khóa tra cứu (Bấm để chọn):
            </span>
            {candidates.map((cand, idx) => {
              const isActive = searchKey.trim().toLowerCase() === cand.keyword.trim().toLowerCase();
              return (
                <button
                  key={idx}
                  onClick={() => setSearchKey(cand.keyword)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                    isActive
                      ? 'bg-cyan-700 text-white border-cyan-800 shadow-xs ring-2 ring-cyan-300'
                      : 'bg-white text-cyan-950 border-cyan-300 hover:bg-cyan-100 hover:border-cyan-400'
                  }`}
                  title={`Từ khóa ${cand.label}: [${cand.keyword}]`}
                >
                  <span>{cand.icon || '🏷️'}</span>
                  <span>{cand.tag || `Tier ${cand.tier}`}:</span>
                  <span className="font-semibold">{cand.keyword}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Nạp URL Chứng Cứ Giá Mới (Có Hỗ Trợ USD & Paste Ảnh Clipboard) */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-xl border-2 border-cyan-400 space-y-3.5 shadow-md">
          <div className="flex items-center justify-between border-b border-cyan-100 pb-2">
            <h5 className="font-bold text-xs text-cyan-900 uppercase flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-cyan-700" /> NẠP CHỨNG CỨ GIÁ TỪ WEBSITE / SÀN TMĐT & ẢNH CLIPBOARD
            </h5>
            <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-emerald-600" /> Nhấn <b>Ctrl + V</b> để dán ảnh chụp màn hình bất kỳ lúc nào
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-slate-500 font-semibold">Gợi ý sàn/trang web:</span>
            {presetVendors.map((pv, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setNewVendor(pv.name);
                  if (!newUrl) setNewUrl(`https://${pv.domain}/`);
                  if (pv.name.includes('eBay')) setCurrency('USD');
                }}
                className="px-2 py-0.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-950 rounded border border-cyan-200 font-medium transition"
              >
                + {pv.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tên Vật Tư / Sản Phẩm Niêm Yết:</label>
              <input
                type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Nhập tên sản phẩm hiển thị trên web..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn Vị Cung Cấp / Tên Trang Web:</label>
              <input
                type="text" value={newVendor} onChange={e => setNewVendor(e.target.value)}
                placeholder="Ví dụ: eBay.com, Misumi, Sieuthithietbi..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đường Link URL Website Giá (Nếu có):</label>
              <input
                type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono text-cyan-950 font-medium"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Đơn Giá Niêm Yết:</label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrency('VND')}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition ${
                      currency === 'VND' ? 'bg-cyan-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🇻🇳 VNĐ (đ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition ${
                      currency === 'USD' ? 'bg-emerald-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🇺🇸 USD ($)
                  </button>
                </div>
              </div>

              {currency === 'VND' ? (
                <div className="relative">
                  <input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    placeholder="Nhập số tiền VNĐ..."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono font-bold text-cyan-950"
                  />
                  <span className="absolute right-3 top-1.5 text-xs font-bold text-slate-400">VNĐ</span>
                </div>
              ) : (
                <div className="space-y-1.5 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-900 block mb-0.5">Đơn giá USD ($):</span>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={newPriceUsd}
                          onChange={e => setNewPriceUsd(e.target.value)}
                          placeholder="Ví dụ: 450.00"
                          className="w-full pl-6 pr-2 py-1 border border-emerald-300 rounded focus:outline-none focus:border-emerald-600 font-mono font-bold text-emerald-950 bg-white text-xs"
                        />
                        <span className="absolute left-2 top-1 text-xs font-bold text-emerald-700">$</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-900 block mb-0.5">Tỷ giá USD/VNĐ:</span>
                      <input
                        type="number"
                        value={exchangeRate}
                        onChange={e => setExchangeRate(e.target.value)}
                        placeholder="25450"
                        className="w-full px-2 py-1 border border-emerald-300 rounded focus:outline-none focus:border-emerald-600 font-mono font-bold text-emerald-950 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200 flex items-center justify-between">
                    <span>💵 Giá quy đổi sang VNĐ:</span>
                    <span className="font-mono text-xs text-emerald-950 font-black">{fmt(calculatedVndPrice)} đ</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tùy Chọn Chi Phí Nhập Cảnh & Vận Chuyển (Landed Cost DDP Vĩnh Tân 4) */}
          <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasLandedCost}
                  onChange={e => setHasLandedCost(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-700" />
                  <span>Áp Dụng Phụ Thu Nhập Khẩu & Vận Chuyển (Landed Cost DDP Vĩnh Tân 4)</span>
                </span>
              </label>
              {hasLandedCost && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-amber-900 font-bold">Phụ thu:</span>
                  <div className="flex items-center bg-white px-2 py-0.5 rounded border border-amber-300">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={landedSurchargePct}
                      onChange={e => setLandedSurchargePct(e.target.value)}
                      className="w-10 text-center font-bold text-xs focus:outline-none text-amber-950 font-mono"
                    />
                    <span className="text-[11px] font-bold text-amber-700">%</span>
                  </div>
                </div>
              )}
            </div>

            {hasLandedCost && (
              <div className="text-[11px] text-amber-900 bg-white/80 p-2 rounded-lg border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="font-semibold">Bao gồm: </span>
                  <span className="text-slate-600">Vận chuyển quốc tế (Air/Sea) + Thuế nhập khẩu + Thông quan & vận chuyển nội địa về Nhà máy</span>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <span className="font-bold text-amber-950 font-mono text-xs">
                    Landed Cost: {fmt(calculatedLandedPrice)} đ
                  </span>
                  {calculatedVndPrice > 0 && (
                    <span className="text-[10px] text-slate-500 block">
                      (Giá gốc: {fmt(calculatedVndPrice)} đ + {landedSurchargePct}%)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vùng Dán Ảnh Chụp Màn Hình Minh Chứng từ Clipboard */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              📸 Ảnh Chụp Màn Hình Minh Chứng Giá (Hỗ Trợ Dán Trực Tiếp Bằng Phím Ctrl + V):
            </label>
            {pastedImage ? (
              <div className="flex items-center gap-3 p-2.5 bg-cyan-50 rounded-lg border border-cyan-300">
                <img
                  src={pastedImage.url}
                  alt="Ảnh minh chứng"
                  className="w-20 h-14 object-cover rounded border border-cyan-400 shadow-2xs cursor-pointer hover:opacity-90"
                  onClick={() => setPreviewModalImage(pastedImage.url)}
                  title="Bấm để xem ảnh phóng to"
                />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-cyan-950 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Đã nhận ảnh chụp màn hình từ Clipboard
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{pastedImage.name}</div>
                  <button
                    type="button"
                    onClick={() => setPreviewModalImage(pastedImage.url)}
                    className="text-[10px] text-blue-700 hover:underline font-bold mt-0.5 inline-flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" /> Xem phóng to ảnh
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setPastedImage(null)}
                  className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded border border-red-200 transition"
                  title="Hủy ảnh này"
                >
                  <X className="w-3.5 h-3.5" /> Gỡ ảnh
                </button>
              </div>
            ) : (
              <div
                className={`p-3 border-2 border-dashed rounded-lg text-center transition cursor-pointer ${
                  isPasting
                    ? 'border-cyan-500 bg-cyan-50 text-cyan-900 animate-pulse'
                    : 'border-slate-300 hover:border-cyan-500 bg-slate-50 hover:bg-cyan-50/50 text-slate-600'
                }`}
                onClick={() => toast.info('Hãy chụp màn hình (Win + Shift + S) rồi bấm phím Ctrl + V để dán!')}
                title="Bấm phím Ctrl + V bất cứ lúc nào để dán ảnh chụp màn hình từ Clipboard"
              >
                {isPasting ? (
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-cyan-800">
                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải ảnh từ Clipboard lên máy chủ...
                  </div>
                ) : (
                  <div className="text-xs">
                    <span className="font-bold text-cyan-900">📋 Bấm vào đây hoặc nhấn tổ hợp phím Ctrl + V</span>
                    <span className="text-slate-500 text-[11px] block mt-0.5">
                      để dán ảnh chụp màn hình niêm yết giá trên eBay, Misumi, Amazon, Google Web...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi Chú / Điều Khoản Giá (Bảo hành, VAT, giao hàng):</label>
            <input
              type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="Ghi chú thêm nếu có (ví dụ: Giá chưa VAT, xuất xứ chính hãng...)..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setPastedImage(null);
              }}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleAddUrl}
              className="px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold transition shadow-xs flex items-center gap-1"
            >
              <Check className="w-4 h-4" /> Đã Kiểm Tra & Lưu Nạp
            </button>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Tham Chiếu Giá TMĐT (Cho Phép User Chỉnh Sửa & Lưu) */}
      {summaryText && (
        <div className="p-4 rounded-xl border-2 border-cyan-300 bg-cyan-50/80 text-slate-900 shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-cyan-950">
              <FileText className="w-4 h-4 text-cyan-700" /> 📄 BẢN THUYẾT MINH GIÁ THƯƠNG MẠI ĐIỆN TỬ {isCustom ? '(HIỆU CHỈNH THỦ CÔNG)' : '(TỰ ĐỘNG)'}
            </h5>
            <div className="flex items-center gap-1.5">
              {isCustom && (
                <button
                  onClick={handleResetSummary}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
                  title="Khôi phục lại nội dung mẫu tự động theo từ khóa"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" /> Khôi Phục Tự Động
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="bg-white hover:bg-slate-100 text-cyan-900 border border-cyan-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
              >
                📋 Sao Chép
              </button>
              <button
                onClick={() => handleSaveCurrent(true)}
                disabled={saving}
                className="bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] px-3 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition disabled:opacity-60"
                title="Lưu chứng cứ Cơ sở 5 vào hồ sơ thẩm định"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                💾 Lưu Thuyết Minh Bước 5
              </button>
            </div>
          </div>
          <div className="relative">
            <textarea
              value={summaryText}
              onChange={e => {
                setSummaryText(e.target.value);
                setIsCustom(true);
              }}
              rows={4}
              className="w-full text-xs leading-relaxed font-medium bg-white p-3 rounded-lg border border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-slate-800 shadow-inner resize-y transition"
              placeholder="Nhập hoặc chỉnh sửa nội dung bản thuyết minh tra cứu TMĐT..."
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span className="italic flex items-center gap-1">
                ✏️ <i>Chuyên viên có thể chỉnh sửa trực tiếp nội dung trên trước khi lưu vào hồ sơ thẩm định.</i>
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {summaryText.length} ký tự
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bảng Danh Sách Nguồn Chứng Cứ Giá Web TMĐT */}
      {urlItems.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[950px]">
            <thead className="bg-cyan-50 text-cyan-950 font-bold border-b border-cyan-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-20 text-center">Căn Cứ</th>
                <th className="py-2.5 px-2.5 border-r w-32">Từ Khóa Tra Cứu</th>
                <th className="py-2.5 px-3 border-r">Tên Vật Tư / Sản Phẩm Web</th>
                <th className="py-2.5 px-3 border-r w-36">Sàn TMĐT / Nguồn Web</th>
                <th className="py-2.5 px-2 border-r w-24 text-center">Ảnh Minh Chứng</th>
                <th className="py-2.5 px-3 border-r w-44 font-mono bg-cyan-100/50 text-right">Đơn Giá Web & Landed</th>
                <th className="py-2.5 px-3 border-r font-mono">Link URL Tra Cứu</th>
                <th className="py-2.5 px-2.5 border-r w-24 text-center">Ngày Tra Cứu</th>
                <th className="py-2.5 px-2 text-center w-12">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {urlItems.map((r, i) => {
                const isSelected = i === selectedIdx;
                const dg = parseFloat(r.price || 0);
                const hasLanded = r.has_landed_cost ?? (r.currency === 'USD' || Boolean(r.landed_price));
                const surchargePct = r.landed_surcharge_pct ?? 20;
                const landedP = r.landed_price ? parseFloat(r.landed_price) : (hasLanded && dg > 0 ? computeLandedCost(dg, surchargePct) : dg);
                const comparePrice = (hasLanded && landedP > 0) ? landedP : dg;
                const diff = dgTrinh > 0 && comparePrice > 0 ? ((comparePrice - dgTrinh) / dgTrinh * 100) : 0;
                const kwUsed = r.search_keyword || searchKey;
                const actualSearchUrl = (r.url && r.url.includes('search')) || (r.url && r.url.includes('_nkw')) || (r.url && r.url.includes('Keyword'))
                  ? r.url
                  : (r.vendor || '').toLowerCase().includes('ebay')
                    ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(kwUsed)}`
                    : (r.vendor || '').toLowerCase().includes('misumi')
                      ? `https://vn.misumi-ec.com/vona2/result/?Keyword=${encodeURIComponent(kwUsed)}`
                      : `https://www.google.com/search?q=${encodeURIComponent(kwUsed + ' ' + (r.vendor || '') + ' gia ban')}`;

                return (
                  <tr key={r.id || i} className={`transition text-[11px] ${isSelected ? 'bg-cyan-100/80 border-l-4 border-l-cyan-600 font-semibold' : 'hover:bg-cyan-50/40'}`}>
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => {
                          setSelectedIdx(i);
                          if (onAutoSave) {
                            onAutoSave({
                              items: urlItems,
                              selected_record: r,
                              search_keyword: searchKey,
                              has_landed_cost: hasLanded,
                              landed_surcharge_pct: surchargePct,
                              landed_price: comparePrice
                            });
                          }
                        }}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected ? 'bg-cyan-700 text-white shadow-xs' : 'bg-slate-200 hover:bg-cyan-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? 'Đã Chọn' : 'Chọn'}
                      </button>
                    </td>
                    <td className="py-2 px-2.5 border-r font-mono">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-950 border border-cyan-300">
                        🔍 {kwUsed}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r">
                      <div className="font-bold text-slate-900">{r.title || '—'}</div>
                      <div className="text-[10px] text-slate-500 italic">{r.notes || '—'}</div>
                    </td>
                    <td className="py-2 px-3 border-r font-semibold text-cyan-950">
                      🏢 {r.vendor || 'Web Internet'}
                    </td>
                    <td className="py-1.5 px-2 border-r text-center">
                      {r.image_url ? (
                        <button
                          type="button"
                          onClick={() => setPreviewModalImage(r.image_url)}
                          className="group relative inline-flex items-center justify-center rounded-lg border border-cyan-300 bg-white p-0.5 hover:border-cyan-500 hover:shadow-md transition"
                          title="Bấm để xem phóng to ảnh minh chứng chụp màn hình"
                        >
                          <img
                            src={r.image_url}
                            alt="Minh chứng TMĐT"
                            className="w-12 h-9 object-cover rounded"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white">
                            <Eye className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Không có</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-cyan-950 bg-cyan-50/30">
                      <div className="text-xs">{fmt(dg)} đ</div>
                      {r.currency === 'USD' && r.price_usd && (
                        <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 mt-0.5 border border-emerald-200">
                          <DollarSign className="w-2.5 h-2.5" />{parseFloat(r.price_usd).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                        </div>
                      )}
                      {hasLanded && landedP > 0 && (
                        <div className="text-[10px] font-black text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded mt-0.5 border border-amber-300 block text-right" title="Landed Cost (DDP Vĩnh Tân 4)">
                          🚢 Landed: {fmt(landedP)} đ
                        </div>
                      )}
                      {diff !== 0 && (
                        <div className={`text-[9.5px] font-bold mt-0.5 ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}% so với trình
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r font-mono text-blue-700 underline truncate max-w-[200px]">
                      <a href={actualSearchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-900" title={actualSearchUrl}>
                        <ExternalLink className="w-3 h-3 shrink-0 text-blue-600" />
                        <span className="truncate">{actualSearchUrl}</span>
                      </a>
                    </td>
                    <td className="py-2 px-2.5 border-r text-center font-mono text-slate-600">{r.date || '—'}</td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => handleDeleteUrl(i)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                        title="Xóa đường link này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Chưa có đường link chứng cứ giá TMĐT nào cho từ khóa này. Hãy bấm '🛒 Tìm Giá trên eBay.com', '🔎 Tìm Giá Misumi' hoặc '🌐 Tìm Google Web' để mở trang tra cứu thực tế và nạp chứng cứ giá thực bằng nút '+ Thêm URL Chứng Cứ Mới'." />
      )}

      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={() => handleSaveCurrent(false)}
        nextLabel="Cơ sở 6 (Tổng Hợp)"
        prevLabel="Cơ sở 4 (MSC)"
      />

      {/* Modal Lightbox Xem Phóng To Ảnh Chụp Màn Hình Minh Chứng */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white text-xs font-bold">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Ảnh Chụp Màn Hình Minh Chứng Giá Web TMĐT (Clipboard / URL)</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={previewModalImage}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-300 hover:text-cyan-100 underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
                </a>
                <button
                  onClick={() => setPreviewModalImage(null)}
                  className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-3 overflow-auto max-h-[calc(90vh-45px)] flex items-center justify-center bg-slate-950/5">
              <img
                src={previewModalImage}
                alt="Minh chứng phóng to"
                className="max-w-full max-h-[80vh] object-contain rounded border border-slate-200 shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
