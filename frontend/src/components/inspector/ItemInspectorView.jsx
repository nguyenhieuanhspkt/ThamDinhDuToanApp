import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, FileCheck2, Building2, Network, Globe,
  ExternalLink, CheckCircle, AlertTriangle, FileText, Award,
  Loader2, Save, ArrowRight, ArrowLeft, ShieldCheck, ShieldAlert, Database,
  Search, RotateCcw, Pin, Check, BarChart3, Calculator, Filter,
  ShoppingBag, Link, Plus, Trash2, Edit3, Star, Percent, CheckCircle2,
  DollarSign, Camera, Eye, X, Image as ImageIcon
} from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (val) => (!val && val !== 0 ? '0' : Math.round(val).toLocaleString('vi-VN'));

const extractCleanImisKeyword = (raw) => {
  if (!raw) return '';
  let clean = raw.split(/[\-:;]/)[0].trim();
  clean = clean.replace(/(?:Điện áp|Partno|Part\s*No|Hãng\s*sản\s*xuất|Model|Công suất|Kích thước|Mã).*$/i, '').trim();
  return clean || raw;
};

const generateKeywordCandidates = (raw) => {
  if (!raw) return [];
  const candidates = [];
  const seen = new Set();

  const cleanBase = extractCleanImisKeyword(raw);
  if (cleanBase && cleanBase.length >= 3 && !seen.has(cleanBase.toLowerCase())) {
    candidates.push({ tier: 1, label: 'Tên Cốt Lõi (Đề xuất)', keyword: cleanBase, icon: '📌', tag: 'Tier 1' });
    seen.add(cleanBase.toLowerCase());
  }

  const modelMatches = raw.match(/\b[A-Z0-9]{2,10}(?:\s+[A-Z0-9]{2,10})*\b/g);
  if (modelMatches) {
    for (const m of modelMatches) {
      const mStr = m.trim();
      if (mStr.length >= 3 && !/^\d+$/.test(mStr) && !['MINIMAX', 'INPUT', 'OUTPUT', 'MODBUS'].includes(mStr.toUpperCase()) && !seen.has(mStr.toLowerCase())) {
        candidates.push({ tier: 2, label: 'Mã Model / Thiết bị', keyword: mStr, icon: '⚡', tag: 'Tier 2' });
        seen.add(mStr.toLowerCase());
        break;
      }
    }
  }

  const partMatch = raw.match(/(?:Partno|Part\s*No|Model|Mã)[\s:]*([A-Za-z0-9\-_]+)/i);
  if (partMatch && partMatch[1]) {
    const partStr = partMatch[1].trim();
    if (partStr.length >= 3 && !seen.has(partStr.toLowerCase())) {
      candidates.push({ tier: 3, label: 'Mã Part Number', keyword: partStr, icon: '🔢', tag: 'Tier 3' });
      seen.add(partStr.toLowerCase());
    }
  }

  if (!seen.has(raw.toLowerCase())) {
    candidates.push({ tier: 4, label: 'Tên Gốc Đầy Đủ', keyword: raw, icon: '📄', tag: 'Tier 4' });
  }

  return candidates;
};

const getDefaultImisKeyword = (raw) => {
  if (!raw) return '';
  const cands = generateKeywordCandidates(raw);
  const modelCand = cands.find(c => c.tier === 2);
  const partCand = cands.find(c => c.tier === 3);
  const coreCand = cands.find(c => c.tier === 1);
  return modelCand?.keyword || partCand?.keyword || coreCand?.keyword || extractCleanImisKeyword(raw);
};

const PILLAR_CFG = {
  quotes:    { key: 'quotes',    label: 'Cơ sở 1: Báo Giá Gốc',                  color: 'emerald', icon: FileCheck2,  saveKey: 'quotes'     },
  erp:       { key: 'erp',       label: 'Cơ sở 2: ERP Vĩnh Tân 4',               color: 'blue',    icon: Building2,   saveKey: 'erp'        },
  imis:      { key: 'imis',      label: 'Cơ sở 3: EVN IMIS',                     color: 'purple',  icon: Network,     saveKey: 'imis'       },
  msc:       { key: 'msc',       label: 'Cơ sở 4: Mua Sắm Công e-GP',            color: 'orange',  icon: Globe,       saveKey: 'muasamcong' },
  ecom:      { key: 'ecom',      label: 'Cơ sở 5: Thương Mại Điện Tử & Giá Web', color: 'cyan',    icon: ShoppingBag, saveKey: 'ecom'       },
  synthesis: { key: 'synthesis', label: 'Cơ sở 6: Tổng Hợp & Đánh Giá Thẩm Định', color: 'teal',    icon: Award,       saveKey: 'synthesis'  },
};
const PILLARS = ['quotes', 'erp', 'imis', 'msc', 'ecom', 'synthesis'];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ItemInspectorView({ selectedIndex, onNavigateIndex, onOpenPdfPage, onOpenErpConfig, onOpenImisConfig, onOpenMscConfig, imisStatus, mscStatus }) {
  const toast = useToast();
  const [activePillar, setActivePillar] = useState('quotes');
  const [items, setItems] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState({}); // { itemId: { has_quotes, has_erp, ... } }

  // Per-pillar data
  const [quoteEvidence, setQuoteEvidence]       = useState(null);
  const [erpResults, setErpResults]             = useState(null);
  const [imisResults, setImisResults]           = useState(null);
  const [mscResults, setMscResults]             = useState(null);
  const [ecomResults, setEcomResults]           = useState(null);
  const [synthesisResults, setSynthesisResults] = useState(null);

  // Loading states
  const [loading, setLoading] = useState({ quotes: false, erp: false, imis: false, msc: false, ecom: false });
  const [saving, setSaving]   = useState(false);

  // Load items list
  useEffect(() => {
    fetch('/api/dossier')
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .catch(console.error);
  }, []);

  // Load all evidence status for sidebar badges
  const loadAllEvidenceStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/evidence/all-status');
      setEvidenceStatus(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadAllEvidenceStatus(); }, [loadAllEvidenceStatus]);

  const currentItem = items[selectedIndex] || items[0] || {};

  // Auto-restore saved evidence for all pillars when item changes
  const loadSavedEvidence = useCallback(async (itemId) => {
    if (!itemId) return;
    try {
      const res = await fetch(`/api/evidence/get-item-evidence/${itemId}`);
      if (res.ok) {
        const json = await res.json();
        const ev = json.evidence || {};
        if (ev.quotes) setQuoteEvidence(prev => ({ ...prev, ...ev.quotes }));
        if (ev.erp) setErpResults(ev.erp);
        if (ev.imis) setImisResults(ev.imis);
        if (ev.muasamcong) setMscResults(ev.muasamcong);
        if (ev.ecom) setEcomResults(ev.ecom);
        if (ev.synthesis) setSynthesisResults(ev.synthesis);
      }
    } catch (e) {
      console.error('Lỗi đọc chứng cứ đã lưu:', e);
    }
  }, []);

  // Silent auto-save evidence for a step
  const autoSaveStep = useCallback(async (stepKey, payload) => {
    if (!currentItem?.id || !stepKey || !payload) return;
    try {
      await fetch('/api/evidence/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: currentItem.id, step_type: stepKey, payload })
      });
      loadAllEvidenceStatus();
    } catch (e) {
      console.error('Lỗi lưu ngầm chứng cứ:', e);
    }
  }, [currentItem?.id, loadAllEvidenceStatus]);

  // Reset pillar data when item changes & load saved evidence
  useEffect(() => {
    setQuoteEvidence(null);
    setErpResults(null);
    setImisResults(null);
    setMscResults(null);
    setEcomResults(null);
    setSynthesisResults(null);
    setActivePillar('quotes');
    if (currentItem?.id) {
      loadSavedEvidence(currentItem.id);
    }
  }, [selectedIndex, currentItem?.id, loadSavedEvidence]);

  // Load Pillar 1 when item changes or pillar is quotes
  useEffect(() => {
    if (!currentItem?.id) return;
    setLoading(p => ({ ...p, quotes: true }));
    fetch('/api/quotes/match-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: currentItem })
    })
      .then(r => r.json())
      .then(d => {
        setQuoteEvidence(prev => {
          const merged = { ...d, ...prev };
          autoSaveStep('quotes', { status: merged?.status, min_price: merged?.min_price, matches: merged?.matches || [], summary_text: merged?.summary_text });
          return merged;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(p => ({ ...p, quotes: false })));
  }, [currentItem?.id, autoSaveStep]);

  // Load on-demand for pillars 2/3/4/5
  const loadErp = useCallback(async () => {
    if (erpResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, erp: true }));
    try {
      const erpKw = currentItem.ma_vt || currentItem.ten_vt;
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: erpKw,
          ma_vt: currentItem.ma_vt || '',
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0
        })
      });
      const data = await res.json();
      setErpResults(data);
      autoSaveStep('erp', {
        results: data?.results || [],
        mapping: data?.mapping || {},
        summary: data?.summary || {},
        summary_text: data?.summary_text || data?.summary?.summary_text || '',
        keyword: erpKw
      });
    } catch (e) { toast.error('Lỗi kết nối ERP'); }
    finally { setLoading(p => ({ ...p, erp: false })); }
  }, [erpResults, currentItem, autoSaveStep]);

  const loadImis = useCallback(async () => {
    if (imisResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, imis: true }));
    try {
      const cleanKw = getDefaultImisKeyword(currentItem.ten_vt) || extractCleanImisKeyword(currentItem.ten_vt);
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: cleanKw || currentItem.ten_vt, item: currentItem, tu_ngay: '2023-01-01' })
      });
      const data = await res.json();
      setImisResults(data);
      autoSaveStep('imis', {
        imis: data?.imis || [],
        erp: data?.erp || [],
        summary: data?.summary || {},
        summary_text: data?.summary_text || data?.summary?.summary_text || '',
        keyword: cleanKw,
        used_keyword: cleanKw
      });
    } catch (e) { toast.error('Lỗi kết nối IMIS'); }
    finally { setLoading(p => ({ ...p, imis: false })); }
  }, [imisResults, currentItem, autoSaveStep]);

  const loadMsc = useCallback(async () => {
    if (mscResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, msc: true }));
    try {
      const cleanKw = getDefaultImisKeyword(currentItem.ten_vt) || currentItem.ten_vt;
      const res = await fetch('/api/msc/search-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: cleanKw })
      });
      const data = await res.json();
      setMscResults(data);
      autoSaveStep('muasamcong', {
        results: data?.analysis?.items || data?.items || [],
        summary: data?.summary || data?.analysis?.summary || {},
        summary_text: data?.summary_text || data?.analysis?.summary_text || '',
        keyword: cleanKw,
        used_keyword: cleanKw
      });
    } catch (e) { toast.error('Lỗi kết nối Mua Sắm Công'); }
    finally { setLoading(p => ({ ...p, msc: false })); }
  }, [mscResults, currentItem, autoSaveStep]);

  const loadEcom = useCallback(async () => {
    if (ecomResults || !currentItem?.id) return;
    setLoading(p => ({ ...p, ecom: true }));
    try {
      const res = await fetch(`/api/evidence/get?item_id=${currentItem.id}&step_type=ecom`);
      if (res.ok) {
        const d = await res.json();
        if (d.data || d.payload) setEcomResults(d.data || d.payload);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(p => ({ ...p, ecom: false })); }
  }, [ecomResults, currentItem]);

  // Activate pillar with lazy load & silent auto-save
  const switchPillar = (pk) => {
    // Auto-save current active pillar before switching
    if (activePillar === 'quotes' && quoteEvidence) {
      autoSaveStep('quotes', { status: quoteEvidence?.status, min_price: quoteEvidence?.min_price, matches: quoteEvidence?.matches || [], summary_text: quoteEvidence?.summary_text });
    } else if (activePillar === 'erp' && erpResults) {
      autoSaveStep('erp', {
        results: erpResults?.results || (Array.isArray(erpResults) ? erpResults : []),
        mapping: erpResults?.mapping || {},
        summary: erpResults?.summary || {},
        summary_text: erpResults?.summary_text || erpResults?.summary?.summary_text || '',
        keyword: currentItem.ma_vt || currentItem.ten_vt
      });
    } else if (activePillar === 'imis' && imisResults) {
      const smartKw = getDefaultImisKeyword(currentItem.ten_vt);
      const kw = (imisResults?.used_keyword && imisResults.used_keyword !== currentItem.ten_vt) ? imisResults.used_keyword : smartKw;
      autoSaveStep('imis', {
        imis: imisResults?.imis || [],
        erp: imisResults?.erp || [],
        summary: imisResults?.summary || {},
        summary_text: imisResults?.summary_text || imisResults?.summary?.summary_text || '',
        keyword: kw,
        used_keyword: kw
      });
    } else if (activePillar === 'msc' && mscResults) {
      const smartKw = getDefaultImisKeyword(currentItem.ten_vt);
      const kw = (mscResults?.analysis?.keyword && mscResults.analysis.keyword !== currentItem.ten_vt) ? mscResults.analysis.keyword : smartKw;
      autoSaveStep('muasamcong', {
        results: mscResults?.analysis?.items || mscResults?.items || [],
        summary: mscResults?.summary || mscResults?.analysis?.summary || {},
        summary_text: mscResults?.summary_text || mscResults?.analysis?.summary_text || '',
        keyword: kw,
        used_keyword: kw
      });
    } else if (activePillar === 'ecom') {
      const payload = ecomResults || {
        items: [],
        selected_record: null,
        summary_text: `Đã tra cứu từ khóa [${currentItem?.ten_vt || ''}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`
      };
      autoSaveStep('ecom', payload);
    }

    setActivePillar(pk);
    if (pk === 'erp')  loadErp();
    if (pk === 'imis') loadImis();
    if (pk === 'msc')  loadMsc();
    if (pk === 'ecom') loadEcom();
  };

  // Save evidence for a step
  const saveStep = async (stepKey, payload, nextPillar) => {
    if (!currentItem?.id) return;
    setSaving(true);
    try {
      const res = await fetch('/api/evidence/save-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: currentItem.id, step_type: stepKey, payload })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu chứng cứ ' + (PILLAR_CFG[activePillar]?.label || ''));
        await loadAllEvidenceStatus();
        await loadSavedEvidence(currentItem.id);
        try {
          const r = await fetch('/api/dossier');
          if (r.ok) {
            const d = await r.json();
            if (d.items) setItems(d.items);
          }
        } catch (e) {}
        if (nextPillar) switchPillar(nextPillar);
      } else {
        toast.error('Lỗi lưu: ' + (data.message || 'Không rõ'));
      }
    } catch (e) { toast.error('Lỗi mạng khi lưu!'); }
    finally { setSaving(false); }
  };

  // Derived
  const minQuote       = quoteEvidence?.min_quote || quoteEvidence?.matched_supplier || quoteEvidence?.matches?.[0];
  const supplierMatches = quoteEvidence?.matches || [];
  const dgTrinh        = parseFloat(currentItem.don_gia_trinh) || 0;
  const evSt           = evidenceStatus[String(currentItem.id)] || {};

  const filteredItems = items.filter((it, idx) => {
    if (!sidebarSearch.trim()) return true;
    const q = sidebarSearch.toLowerCase();
    return (it.ten_vt?.toLowerCase().includes(q) || it.ma_vt?.toLowerCase().includes(q) || String(idx + 1).includes(q));
  });

  const handleExportPdf = () => {
    const itemId = currentItem.id || selectedIndex + 1;
    window.open(`/api/items/${itemId}/export-pdf`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white h-full">
      {/* Navigator Bar */}
      <div className="bg-white border-b px-5 py-2.5 shrink-0 flex items-center justify-between shadow-sm z-10 text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateIndex(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex <= 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Trước
          </button>
          <span className="font-bold text-[#003366] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200 font-mono">
            Mục {selectedIndex + 1} / {items.length || 1}
          </span>
          <button
            onClick={() => onNavigateIndex(Math.min(items.length - 1, selectedIndex + 1))}
            disabled={selectedIndex >= items.length - 1}
            className="bg-[#003366] hover:bg-blue-900 disabled:opacity-40 text-white px-3.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shadow-sm"
          >
            Tiếp theo <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Đang duyệt:</span>
            <strong className="text-slate-900 max-w-xs truncate" title={currentItem.ten_vt}>
              {currentItem.ten_vt || 'Chưa chọn'}
            </strong>
          </div>
          <button
            onClick={handleExportPdf}
            className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            title="Xuất Báo Cáo Thẩm Định PDF A4 Chuyên Nghiệp"
          >
            <FileText className="w-4 h-4" /> Xuất Báo Cáo PDF
          </button>
        </div>
      </div>


      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r flex flex-col shrink-0 bg-slate-50">
          <div className="p-2 border-b bg-white">
            <input
              type="text" value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Tìm mục..."
              className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto text-xs divide-y divide-slate-100">
            {filteredItems.map((it) => {
              const origIdx = items.findIndex(x => x === it);
              const isActive = origIdx === selectedIndex;
              const stBadge = evidenceStatus[String(it.id)] || {};
              const doneCount = [stBadge.has_quotes, stBadge.has_erp, stBadge.has_imis, stBadge.has_msc, stBadge.has_ecom].filter(Boolean).length;
              return (
                <div
                  key={origIdx}
                  onClick={() => onNavigateIndex(origIdx)}
                  className={`p-2 cursor-pointer transition ${isActive ? 'bg-teal-50 border-l-4 border-l-teal-700' : 'hover:bg-slate-100/80'}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-mono text-slate-500 font-bold text-[10px]">#{origIdx + 1}</span>
                    <span className="font-mono text-[#003366] font-bold text-[10px]">{fmt(it.don_gia_trinh)} đ</span>
                  </div>
                  <p className={`text-[11px] truncate ${isActive ? 'font-bold text-teal-900' : 'font-medium text-slate-800'}`} title={it.ten_vt}>{it.ten_vt}</p>
                  {/* 5-pillar mini badges */}
                  <div className="flex items-center gap-0.5 mt-1">
                    {[
                      { k: 'has_quotes', lbl: 'BG',   col: stBadge.has_quotes ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-gray-100 text-gray-400' },
                      { k: 'has_erp',    lbl: 'ERP',  col: stBadge.has_erp    ? 'bg-blue-100 text-blue-800 border-blue-300'     : 'bg-gray-100 text-gray-400' },
                      { k: 'has_imis',   lbl: 'IMIS', col: stBadge.has_imis   ? 'bg-purple-100 text-purple-800 border-purple-300': 'bg-gray-100 text-gray-400' },
                      { k: 'has_msc',    lbl: 'MSC',  col: stBadge.has_msc    ? 'bg-orange-100 text-orange-800 border-orange-300': 'bg-gray-100 text-gray-400' },
                      { k: 'has_ecom',   lbl: 'TMĐT', col: stBadge.has_ecom   ? 'bg-cyan-100 text-cyan-800 border-cyan-300'     : 'bg-gray-100 text-gray-400' },
                    ].map(b => (
                      <span key={b.k} className={`text-[8px] px-1 rounded border font-bold ${b.col}`}>{stBadge[b.k] ? '✓' : ''}{b.lbl}</span>
                    ))}
                    <span className={`text-[8px] font-mono ml-auto font-bold ${doneCount === 5 ? 'text-emerald-700' : doneCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{doneCount}/5</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-100 gap-3">
          {/* Overview Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 mb-2">{currentItem.ten_vt || 'Chưa chọn mục'}</h3>
            <div className="grid grid-cols-4 gap-2 text-xs text-slate-600">
              <div>Mã ERP: <strong className="font-mono text-slate-800">{currentItem.ma_vt || '-'}</strong></div>
              <div>ĐVT: <strong>{currentItem.dvt || 'Cái'}</strong></div>
              <div>Số lượng: <strong className="font-mono">{currentItem.so_luong || 1}</strong></div>
              <div>Đơn giá trình: <strong className="font-mono text-[#003366] font-extrabold">{fmt(dgTrinh)} đ</strong></div>
            </div>
          </div>

          {/* Pillar Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-xl border border-slate-300 text-xs font-semibold shrink-0">
            {PILLARS.map(pk => {
              const cfg = PILLAR_CFG[pk];
              const Icon = cfg.icon;
              const isActive = activePillar === pk;
              const saved = pk === 'quotes' ? evSt.has_quotes : pk === 'erp' ? evSt.has_erp : pk === 'imis' ? evSt.has_imis : pk === 'msc' ? evSt.has_msc : pk === 'ecom' ? evSt.has_ecom : evSt.has_syn;
              return (
                <button
                  key={pk}
                  onClick={() => switchPillar(pk)}
                  className={`flex-1 py-2 px-1.5 rounded-lg transition flex items-center justify-center gap-1 relative ${
                    isActive ? `bg-${cfg.color}-700 text-white shadow-sm font-bold` : 'text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {cfg.label}
                  {saved && <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" title="Đã lưu chứng cứ" />}
                </button>
              );
            })}
          </div>

          {/* Pillar Content */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
            {/* ── PILLAR 1: QUOTES ── */}
            {activePillar === 'quotes' && (
              <PillarQuotes
                loading={loading.quotes} saving={saving}
                minQuote={minQuote} supplierMatches={supplierMatches}
                dgTrinh={dgTrinh} onOpenPdfPage={onOpenPdfPage}
                onSave={() => saveStep('quotes', { status: quoteEvidence?.status, min_price: quoteEvidence?.min_price, matches: supplierMatches, summary_text: quoteEvidence?.summary_text }, 'erp')}
                saved={evSt.has_quotes}
              />
            )}
            {/* ── PILLAR 2: ERP ── */}
            {activePillar === 'erp' && (
              <PillarErp
                loading={loading.erp} saving={saving}
                data={erpResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={(payload) => saveStep('erp', payload || {
                  results: erpResults?.results || (Array.isArray(erpResults) ? erpResults : []),
                  mapping: erpResults?.mapping || {},
                  summary: erpResults?.summary || {},
                  summary_text: erpResults?.summary_text || erpResults?.summary?.summary_text || '',
                  keyword: currentItem.ten_vt
                }, 'imis')}
                onAutoSave={(payload) => {
                  setErpResults(payload);
                  autoSaveStep('erp', payload);
                }}
                saved={evSt.has_erp}
                onOpenErpConfig={onOpenErpConfig}
              />
            )}
            {/* ── PILLAR 3: IMIS ── */}
            {activePillar === 'imis' && (
              <PillarImis
                loading={loading.imis} saving={saving}
                data={imisResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={(payload) => saveStep('imis', payload || {
                  imis: imisResults?.imis || [],
                  erp: imisResults?.erp || [],
                  summary: imisResults?.summary || {},
                  summary_text: imisResults?.summary_text || imisResults?.summary?.summary_text || '',
                  keyword: getDefaultImisKeyword(currentItem.ten_vt) || currentItem.ten_vt
                }, 'msc')}
                onAutoSave={(payload) => {
                  setImisResults(payload);
                  autoSaveStep('imis', payload);
                }}
                saved={evSt.has_imis}
                onOpenImisConfig={onOpenImisConfig}
                imisStatus={imisStatus}
              />
            )}
            {/* ── PILLAR 4: MSC ── */}
            {activePillar === 'msc' && (
              <PillarMsc
                loading={loading.msc} saving={saving}
                data={mscResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={(payload) => saveStep('muasamcong', payload || {
                  results: mscResults?.analysis?.items || mscResults?.items || [],
                  summary: mscResults?.summary || mscResults?.analysis?.summary || {},
                  summary_text: mscResults?.summary_text || mscResults?.analysis?.summary_text || '',
                  keyword: mscResults?.analysis?.keyword || getDefaultImisKeyword(currentItem.ten_vt) || currentItem.ten_vt
                }, 'ecom')}
                onAutoSave={(payload) => {
                  setMscResults(payload);
                  autoSaveStep('muasamcong', payload);
                }}
                saved={evSt.has_msc}
                onOpenMscConfig={onOpenMscConfig}
                mscStatus={mscStatus}
              />
            )}
            {/* ── PILLAR 5: ECOMMERCE ── */}
            {activePillar === 'ecom' && (
              <PillarEcom
                loading={loading.ecom} saving={saving}
                data={ecomResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={(payload, goNext = true) => saveStep('ecom', payload, goNext ? 'synthesis' : null)}
                onAutoSave={(payload) => {
                  setEcomResults(payload);
                  autoSaveStep('ecom', payload);
                }}
                saved={evSt.has_ecom}
              />
            )}
            {/* ── PILLAR 6: SYNTHESIS ── */}
            {activePillar === 'synthesis' && (
              <PillarSynthesis
                loading={saving} saving={saving}
                data={synthesisResults}
                dgTrinh={dgTrinh} item={currentItem}
                quoteEvidence={quoteEvidence} erpResults={erpResults}
                imisResults={imisResults} mscResults={mscResults}
                ecomResults={ecomResults} evidenceStatus={evSt}
                onSave={(payload) => saveStep('synthesis', payload, null)}
                saved={evSt.has_syn}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Pillar 1: Quotes ───────────────────────────────────────────────────────────
function PillarQuotes({ loading, saving, minQuote, supplierMatches, dgTrinh, onOpenPdfPage, onSave, saved }) {
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

const isValidErpCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  const c = code.trim().toLowerCase();
  if (c.includes('chưa') || c.includes('chua') || c.includes('không') || c.includes('khong') || c === 'n/a' || c === 'none' || c === 'null') {
    return false;
  }
  return /^\d+(\.\d+)+/.test(c) || (/^[a-z0-9_\-.]{4,}$/i.test(c) && /\d/.test(c));
};

const getErpDefaultKw = (item, data) => {
  if (isValidErpCode(item?.ma_vt)) return item.ma_vt;
  const candidate = data?.used_keyword || data?.keyword;
  if (candidate && !candidate.toLowerCase().includes('chưa có mã')) return candidate;
  const rawName = item?.ten_vt_goc || item?.ten_vt || '';
  const coreName = rawName.split('\n')[0].split('-')[0].split(',')[0].trim();
  return coreName || rawName;
};

const getInitialSelectedIdx = (d, list) => {
  if (d?.is_deselected || d?.selected_record === 'NONE' || d?.summary?.status === 'ERP_DESELECTED') return null;
  if (d?.use_average || d?.selected_record === 'AVERAGE') return 'AVERAGE';
  if (d?.selected_record && typeof d.selected_record === 'object' && Array.isArray(list)) {
    const idx = list.findIndex(r => (r.soHopDong && r.soHopDong === d.selected_record.soHopDong) || (r.maVt && r.maVt === d.selected_record.maVt));
    if (idx >= 0) return idx;
  }
  return 0;
};

// ── Pillar 2: ERP ─────────────────────────────────────────────────────────────
function PillarErp({ loading, saving, data, dgTrinh, item, onSave, onAutoSave, saved, onOpenErpConfig }) {
  const toast = useToast();
  const [erpResults, setErpResults] = useState(data?.results || []);
  const [mapping, setMapping] = useState(data?.mapping || {});
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  const initialKw = getErpDefaultKw(item, data);
  const [searchKey, setSearchKey] = useState(initialKw);
  const [selectedIdx, setSelectedIdx] = useState(() => getInitialSelectedIdx(data, data?.results));
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const list = data?.results || (Array.isArray(data) ? data : []);
    setErpResults(list);
    setMapping(data?.mapping || {});
    setSummaryData(data?.summary || {});
    const kw = getErpDefaultKw(item, data);
    setSearchKey(kw);
    setSelectedIdx(getInitialSelectedIdx(data, list));
  }, [data, item]);

  // Tự động khôi phục thuyết minh ERP nếu dữ liệu đệm bị khuyết summary_text
  useEffect(() => {
    const list = erpResults || [];
    const curSummaryText = summaryData?.summary_text || data?.summary_text;
    if (data?.is_deselected || data?.selected_record === 'NONE' || data?.summary?.status === 'ERP_DESELECTED') return;
    if (list.length > 0 && !curSummaryText && !searching && item?.ten_vt) {
      fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey || getErpDefaultKw(item, data),
          ma_vt: isValidErpCode(item?.ma_vt) ? item.ma_vt : '',
          item,
          dg_trinh: dgTrinh
        })
      })
      .then(r => r.json())
      .then(resp => {
        if (resp.summary) {
          setSummaryData(resp.summary);
          if (onAutoSave) {
            onAutoSave({
              results: resp.results || list,
              mapping: resp.mapping || mapping,
              summary: resp.summary,
              summary_text: resp.summary?.summary_text || '',
              keyword: searchKey || item?.ten_vt || '',
              used_keyword: searchKey || item?.ten_vt || '',
              selected_record: resp.results?.[0] || null
            });
          }
        }
      })
      .catch(console.error);
    }
  }, [erpResults, summaryData, data, item, dgTrinh, searchKey, searching, mapping, onAutoSave]);

  const DESELECTED_ERP_TEXT = 'Qua rà soát CSDL Kế toán ERP của NMNĐ Vĩnh Tân 4, các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này.';

  const isDeselected = selectedIdx === null || summaryData?.status === 'ERP_DESELECTED' || data?.is_deselected || data?.selected_record === 'NONE';

  const summaryText = isDeselected 
    ? (summaryData?.summary_text && summaryData?.status === 'ERP_DESELECTED' ? summaryData.summary_text : DESELECTED_ERP_TEXT)
    : (summaryData?.summary_text || data?.summary_text);
  const status = isDeselected ? 'ERP_DESELECTED' : summaryData?.status;
  const isWarning = !isDeselected && status === 'ERP_WARN_RECENT_INCREASE';

  const handleManualSearch = async () => {
    const cleanKw = searchKey.trim();
    if (!cleanKw) return;
    setSearching(true);
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: cleanKw,
          ma_vt: isValidErpCode(item?.ma_vt) ? item.ma_vt : '',
          item,
          dg_trinh: dgTrinh,
          is_manual: true
        })
      });
      const resp = await res.json();
      const resList = resp.results || [];
      const sumData = resp.summary || {};
      setErpResults(resList);
      setMapping(resp.mapping || {});
      setSummaryData(sumData);
      setSelectedIdx(0);
      toast.success(`Đã tìm thấy ${resList.length} kết quả ERP cho từ khóa [${cleanKw}]`);
      if (onAutoSave) {
        onAutoSave({
          results: resList,
          mapping: resp.mapping || {},
          summary: sumData,
          summary_text: sumData?.summary_text || resp.summary_text || '',
          keyword: cleanKw,
          used_keyword: cleanKw,
          selected_record: resList[0] || null,
          use_average: false,
          is_deselected: false
        });
      }
    } catch (e) {
      toast.error('Lỗi tìm kiếm ERP thủ công');
    } finally {
      setSearching(false);
    }
  };

  const handleDeselectRecord = async () => {
    setSelectedIdx(null);
    const sumData = {
      status: 'ERP_DESELECTED',
      is_deselected: true,
      summary_text: DESELECTED_ERP_TEXT
    };
    setSummaryData(sumData);
    if (onAutoSave) {
      onAutoSave({
        results: erpResults,
        mapping: mapping,
        summary: sumData,
        summary_text: DESELECTED_ERP_TEXT,
        keyword: searchKey,
        used_keyword: searchKey,
        selected_record: 'NONE',
        use_average: false,
        is_deselected: true
      });
    }
    toast.info('Đã hủy chọn hợp đồng ERP. Không áp dụng kết quả ERP làm căn cứ.');
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          selected_record: 'NONE'
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

  const handleSelectRecord = async (index) => {
    if (selectedIdx === index) {
      // Toggle OFF: Bấm lại vào dòng đang chọn -> HỦY CHỌN
      await handleDeselectRecord();
      return;
    }
    setSelectedIdx(index);
    const rec = erpResults[index];
    if (!rec) return;
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          selected_record: rec
        })
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(`Đã chọn hợp đồng ${rec.soHopDong || 'ERP'} làm căn cứ thuyết minh!`);
      if (onAutoSave) {
        onAutoSave({
          results: erpResults,
          mapping: mapping,
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
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey,
          item,
          dg_trinh: dgTrinh,
          use_average: true
        })
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(`Đã chọn phương án Đơn Giá Trung Bình (${sumData?.count_n || erpResults.length} đợt) làm căn cứ thuyết minh!`);
      if (onAutoSave) {
        onAutoSave({
          results: erpResults,
          mapping: mapping,
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
      toast.success('Đã sao chép thuyết minh ERP vào clipboard!');
    }
  };

  const hasMapping = mapping && Object.keys(mapping).length > 0;
  const isColActive = (key) => {
    if (!hasMapping) return true;
    return Boolean(mapping[key] && mapping[key].trim() !== '');
  };

  // Tính đơn giá trung bình cho thanh hiển thị nhanh
  const validPrices = erpResults.map(r => parseFloat(r.donGia || r.don_gia || 0)).filter(p => p > 0);
  const avgPrice = validPrices.length > 0 ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PillarHeader icon={Building2} color="blue" title="KHỐI 2: LỊCH SỬ MUA SẮM ERP VĨNH TÂN 4" loading={loading || searching} />
        <button
          onClick={onOpenErpConfig}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Database className="w-3.5 h-3.5" /> ⚙️ Cấu hình CSDL ERP (Upload & Map 13 Cột)
        </button>
      </div>

      {/* Thanh Tra cứu ERP thủ công & Chip gợi ý từ khóa */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-blue-700" /> Tra cứu ERP bằng tay:
          </span>
          <input
            type="text"
            value={searchKey}
            onChange={e => setSearchKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
            placeholder="Nhập mã ERP hoặc tên vật tư để tra cứu..."
            className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-medium"
          />
          <button
            onClick={handleManualSearch}
            disabled={searching}
            className="bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition shadow-xs disabled:opacity-50 shrink-0"
          >
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Tra cứu ERP
          </button>
          <button
            onClick={() => setSearchKey(getErpDefaultKw(item, data))}
            title="Khôi phục từ khóa mặc định"
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
          </button>
        </div>

        {/* Chip chọn nhanh từ khóa gợi ý */}
        <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-blue-950 shrink-0 flex items-center gap-1">
            💡 Từ khóa gợi ý ERP:
          </span>
          {isValidErpCode(item?.ma_vt) && (
            <button
              onClick={() => setSearchKey(item.ma_vt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.ma_vt.trim()
                  ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300'
                  : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100'
              }`}
              title={`Chọn tra cứu theo Mã ERP: ${item.ma_vt}`}
            >
              🏷️ Mã ERP: <span className="font-mono">{item.ma_vt}</span>
            </button>
          )}
          {(() => {
            const rawName = item?.ten_vt_goc || item?.ten_vt || '';
            const coreName = rawName.split('\n')[0].split('-')[0].split(',')[0].trim();
            if (!coreName) return null;
            return (
              <button
                onClick={() => setSearchKey(coreName)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                  searchKey.trim() === coreName
                    ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300'
                    : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100'
                }`}
                title="Chọn tra cứu theo Tên vật tư cốt lõi"
              >
                🎯 Tên cốt lõi: <span className="font-semibold truncate max-w-[200px]">{coreName}</span>
              </button>
            );
          })()}
          {(item?.part_no || item?.model) && (
            <button
              onClick={() => setSearchKey(item.part_no || item.model)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === (item.part_no || item.model).trim()
                  ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300'
                  : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100'
              }`}
              title="Chọn tra cứu theo Model / Part No"
            >
              ⚙️ Model/Part: <span className="font-semibold font-mono">{item.part_no || item.model}</span>
            </button>
          )}
          {item?.hang_sx && (
            <button
              onClick={() => setSearchKey(item.hang_sx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.hang_sx.trim()
                  ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300'
                  : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100'
              }`}
              title="Chọn tra cứu theo Hãng sản xuất"
            >
              🏭 Hãng SX: <span className="font-semibold">{item.hang_sx}</span>
            </button>
          )}
          {item?.ten_vt && (
            <button
              onClick={() => setSearchKey(item.ten_vt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.ten_vt.trim()
                  ? 'bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300'
                  : 'bg-white text-blue-900 border-blue-300 hover:bg-blue-100'
              }`}
              title="Chọn tra cứu theo Tên vật tư đầy đủ"
            >
              📝 Tên đầy đủ: <span className="font-semibold truncate max-w-[200px]">{item.ten_vt}</span>
            </button>
          )}
        </div>
      </div>

      {/* Thanh Chọn Phương Án Thẩm Định: Hợp Đồng Cụ Thể vs Giá Trung Bình */}
      {erpResults.length >= 2 && (
        <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="font-bold text-blue-950 flex items-center gap-1.5 shrink-0">
            <Calculator className="w-4 h-4 text-blue-700" /> Tùy chọn Phương án Căn cứ ERP ({erpResults.length} đợt mua):
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
                  ? 'bg-blue-700 hover:bg-rose-600 text-white border-blue-800 shadow-xs group'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {typeof selectedIdx === 'number' ? (
                <>
                  <Pin className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                  <span className="group-hover:hidden">Theo Hợp Đồng Cụ Thể (#{selectedIdx + 1})</span>
                  <span className="hidden group-hover:inline">Hủy Chọn Hợp Đồng (#{selectedIdx + 1})</span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span>Theo Hợp Đồng Cụ Thể (#1)</span>
                </>
              )}
            </button>
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
                  <span className="group-hover:hidden">📊 Chọn Đơn Giá Trung Bình (AVG): {fmt(avgPrice)} đ</span>
                  <span className="hidden group-hover:inline">Hủy Chọn Giá Trung Bình</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>📊 Chọn Đơn Giá Trung Bình (AVG): {fmt(avgPrice)} đ</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Căn Cứ ERP tự động */}
      {summaryText && (
        <div className={`p-4 rounded-xl border-2 shadow-sm transition ${
          selectedIdx === null || summaryData?.status === 'ERP_DESELECTED'
            ? 'bg-slate-100 border-slate-300 text-slate-700'
            : isWarning
              ? 'bg-amber-50 border-amber-400 text-amber-950'
              : 'bg-blue-50/80 border-blue-300 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h5 className={`font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
              selectedIdx === null || summaryData?.status === 'ERP_DESELECTED' ? 'text-slate-700' : 'text-blue-900'
            }`}>
              <FileText className="w-4 h-4 text-blue-700" /> 📄 BẢN THUYẾT MINH CĂN CỨ ERP {selectedIdx === null ? '(ĐÃ HỦY CHỌN)' : '(TỰ ĐỘNG TỔNG HỢP)'}
            </h5>
            <button
              onClick={copyToClipboard}
              className="bg-white hover:bg-slate-100 text-blue-800 border border-blue-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
            >
              📋 Sao Chép Thuyết Minh
            </button>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/70 p-3 rounded-lg border border-slate-200/80 text-slate-800">
            {summaryText}
          </p>
        </div>
      )}

      {loading || searching ? <LoadingSpinner /> : erpResults.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead className="bg-blue-50 text-blue-950 font-bold border-b border-blue-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-24 text-center">Căn Cứ</th>
                <th className="py-2.5 px-2 border-r w-20 text-center">% Khớp</th>
                {(isColActive('ma_vt') || isColActive('ten_vt')) && <th className="py-2.5 px-3 border-r">Mã ERP & Tên Vật Tư</th>}
                {isColActive('thong_so_kt') && <th className="py-2.5 px-3 border-r">Thông Số KT</th>}
                {isColActive('dvt') && <th className="py-2.5 px-3 border-r text-center w-12">ĐVT</th>}
                {isColActive('so_luong') && <th className="py-2.5 px-3 border-r text-right w-14 font-mono">SL</th>}
                {isColActive('don_gia') && <th className="py-2.5 px-3 border-r w-28 text-right font-mono bg-blue-100/50">Đơn Giá ERP</th>}
                {isColActive('thanh_tien') && <th className="py-2.5 px-3 border-r w-32 text-right font-mono">Thành Tiền</th>}
                {isColActive('so_hop_dong') && <th className="py-2.5 px-3 border-r font-bold text-emerald-900 bg-emerald-50/50">Số Hợp Đồng</th>}
                {isColActive('ngay_ky_hd') && <th className="py-2.5 px-3 border-r w-24">Ngày Ký HĐ</th>}
                {isColActive('so_phieu_nhap') && <th className="py-2.5 px-3 border-r w-24">Số Phiếu Nhập</th>}
                {isColActive('ngay_nhap_kho') && <th className="py-2.5 px-3 border-r w-24">Ngày Nhập</th>}
                {isColActive('nha_thau') && <th className="py-2.5 px-3 border-r">Nhà Thầu Cung Cấp</th>}
                {isColActive('ghi_chu') && <th className="py-2.5 px-3">Ghi Chú</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {erpResults.map((r, i) => {
                const isSelected = i === selectedIdx;
                const matchScore = r.match_score || 0;
                const dg = r.donGia || r.don_gia || 0;
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
                return (
                  <tr key={i} className={`transition text-[11px] ${isSelected ? 'bg-blue-100/70 border-l-4 border-l-blue-700 font-semibold' : 'hover:bg-blue-50/30'}`}>
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => handleSelectRecord(i)}
                        title={isSelected ? "Nhấp để HỦY CHỌN (Không áp dụng hợp đồng này làm căn cứ)" : "Nhấp để chọn hợp đồng này làm căn cứ"}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected
                            ? 'bg-blue-700 hover:bg-rose-600 text-white shadow-xs group ring-2 ring-blue-300'
                            : 'bg-slate-200 hover:bg-blue-100 text-slate-700'
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
                        matchScore >= 70 ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                        'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {matchScore > 0 ? `${matchScore}%` : '—'}
                      </span>
                    </td>
                    {(isColActive('ma_vt') || isColActive('ten_vt')) && (
                      <td className="py-2 px-3 border-r">
                        <div className="font-bold text-slate-900">{r.tenVt || r.ten_vt || r.maVt}</div>
                        <div className="font-mono text-blue-700 text-[10px] font-semibold">{r.maVt || r.ma_vt || '—'}</div>
                      </td>
                    )}
                    {isColActive('thong_so_kt') && <td className="py-2 px-3 border-r text-slate-600 truncate max-w-[160px]" title={r.thongSoKt}>{r.thongSoKt || '—'}</td>}
                    {isColActive('dvt') && <td className="py-2 px-3 border-r text-center text-slate-700">{r.donViTinh || r.dvt || 'Cái'}</td>}
                    {isColActive('so_luong') && <td className="py-2 px-3 border-r text-right font-mono font-bold text-slate-900">{r.soLuong || 1}</td>}
                    {isColActive('don_gia') && (
                      <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-blue-900 bg-blue-50/20">
                        {fmt(dg)} đ
                        {diff !== 0 && (
                          <div className={`text-[9.5px] font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}% so với trình
                          </div>
                        )}
                      </td>
                    )}
                    {isColActive('thanh_tien') && <td className="py-2 px-3 text-right font-mono text-slate-800 border-r">{fmt(r.thanhTien || 0)} đ</td>}
                    {isColActive('so_hop_dong') && <td className="py-2 px-3 border-r font-bold text-emerald-950 bg-emerald-50/30">{r.soHopDong || '—'}</td>}
                    {isColActive('ngay_ky_hd') && <td className="py-2 px-3 border-r text-slate-700 font-mono">{r.ngayKyHd || r.ngayChungTu || '—'}</td>}
                    {isColActive('so_phieu_nhap') && <td className="py-2 px-3 border-r font-mono text-slate-600">{r.soPhieuNhap || r.soChungTu || '—'}</td>}
                    {isColActive('ngay_nhap_kho') && <td className="py-2 px-3 border-r text-slate-600 font-mono">{r.ngayNhapKho || r.ngayChungTu || '—'}</td>}
                    {isColActive('nha_thau') && <td className="py-2 px-3 border-r text-slate-800 font-semibold truncate max-w-[140px]" title={r.nhaThau}>{r.nhaThau || 'NMNĐ Vĩnh Tân 4'}</td>}
                    {isColActive('ghi_chu') && <td className="py-2 px-3 text-slate-500 italic truncate max-w-[150px]" title={r.dienGiai}>{r.dienGiai || '—'}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Không tìm thấy kết quả lịch sử ERP phù hợp (hoặc có tỷ lệ match cao). Hãy thử nhập từ khóa khác ở thanh tra cứu thủ công." />
      )}
      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={() => onSave({
          results: erpResults,
          mapping: mapping,
          summary: summaryData,
          summary_text: summaryText,
          keyword: searchKey,
          used_keyword: searchKey,
          selected_record: typeof selectedIdx === 'number' ? erpResults[selectedIdx] : (selectedIdx === 'AVERAGE' ? 'AVERAGE' : 'NONE'),
          is_deselected: selectedIdx === null,
          use_average: selectedIdx === 'AVERAGE'
        })}
        nextLabel="Cơ sở 3 (IMIS)"
        prevLabel="Cơ sở 1 (BG)"
      />
    </div>
  );
}

// ── Pillar 3: IMIS ────────────────────────────────────────────────────────────
function PillarImis({ loading, saving, data, dgTrinh, item, onSave, onAutoSave, saved, onOpenImisConfig, imisStatus }) {
  const toast = useToast();
  const [imisResults, setImisResults] = useState(data?.imis || []);
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  
  const getSmartImisKw = (rawName, savedKw) => {
    const smart = getDefaultImisKeyword(rawName);
    if (!savedKw || savedKw === rawName) return smart || rawName;
    return savedKw;
  };

  const initialCleanKw = getSmartImisKw(item?.ten_vt || '', data?.used_keyword || data?.keyword);
  const [searchKey, setSearchKey] = useState(initialCleanKw);
  const [tuNgay, setTuNgay] = useState('2023-01-01');
  const [denNgay, setDenNgay] = useState(new Date().toISOString().split('T')[0]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  // In-table client filtering states
  const [filterKw, setFilterKw]     = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [priceFilter, setPriceFilter] = useState('ALL'); // ALL, LOWER, HIGHER

  useEffect(() => {
    setImisResults(data?.imis || []);
    setSummaryData(data?.summary || {});
    const smartKw = getSmartImisKw(item?.ten_vt || '', data?.used_keyword || data?.keyword);
    setSearchKey(smartKw);
    setSelectedIdx(0);
    setFilterKw('');
    setFilterUnit('');
    setPriceFilter('ALL');
  }, [data, item]);

  // Tự động khôi phục thuyết minh IMIS nếu dữ liệu đệm bị khuyết summary_text
  useEffect(() => {
    const list = imisResults || [];
    const curSummaryText = summaryData?.summary_text || data?.summary_text;
    if (list.length > 0 && !curSummaryText && !searching && item?.ten_vt) {
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
              used_keyword: kwToUse
            });
          }
        }
      })
      .catch(console.error);
    }
  }, [imisResults, summaryData, data, item, dgTrinh, searchKey, searching, tuNgay, denNgay, onAutoSave]);

  const summaryText = summaryData?.summary_text || data?.summary_text;
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
          selected_record: imisList[0] || null
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

  const handleSelectRecord = async (indexOrRec) => {
    let rec = typeof indexOrRec === 'object' ? indexOrRec : imisResults[indexOrRec];
    let idx = typeof indexOrRec === 'number' ? indexOrRec : imisResults.indexOf(indexOrRec);
    if (idx < 0) idx = 0;
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
          selected_record: rec
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAverage = async () => {
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
          selected_record: null,
          use_average: true
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
      {imisResults.length >= 2 && (
        <div className="bg-purple-50/70 p-2.5 rounded-xl border border-purple-200 flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="font-bold text-purple-950 flex items-center gap-1.5 shrink-0">
            <Calculator className="w-4 h-4 text-purple-700" /> Tùy chọn Phương án Căn cứ IMIS ({imisResults.length} hợp đồng):
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectRecord(typeof selectedIdx === 'number' ? selectedIdx : 0)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                selectedIdx !== 'AVERAGE'
                  ? 'bg-purple-700 text-white border-purple-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Pin className="w-3.5 h-3.5" /> Theo Đơn Vị EVN Cụ Thể {typeof selectedIdx === 'number' ? `(#${selectedIdx + 1})` : ''}
            </button>
            <button
              onClick={handleSelectAverage}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                selectedIdx === 'AVERAGE'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-300" /> 📊 Chọn Đơn Giá Trung Bình EVN (AVG): {fmt(avgPrice)} đ
            </button>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Căn Cứ IMIS EVN Tự Động */}
      {summaryText && (
        <div className="p-4 rounded-xl border-2 border-purple-300 bg-purple-50/80 text-slate-900 shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-purple-900">
              <FileText className="w-4 h-4 text-purple-700" /> 📄 BẢN THUYẾT MINH CĂN CỨ IMIS EVN (TỰ ĐỘNG TỔNG HỢP)
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
                <th className="py-2.5 px-3 border-r w-24">Ngày Ký / Năm</th>
                <th className="py-2.5 px-3 border-r">Đơn Vị Cung Cấp / Nhà Thầu</th>
                <th className="py-2.5 px-3">Ghi Chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredImisResults.map((r, i) => {
                const isSelected = imisResults[selectedIdx] === r || imisResults.indexOf(r) === selectedIdx;
                const matchScore = r.match_score || 80;
                const dg = parseFloat(r.don_gia || r.gia || r.donGia || 0);
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
                const donViName = r.ten_don_vi || r.nha_may || r.don_vi || 'NMNĐ Thái Bình';
                return (
                  <tr key={i} className={`transition text-[11px] ${isSelected ? 'bg-purple-100/70 border-l-4 border-l-purple-700 font-semibold' : 'hover:bg-purple-50/30'}`}>
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => handleSelectRecord(r)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected
                            ? 'bg-purple-700 text-white shadow-xs'
                            : 'bg-slate-200 hover:bg-purple-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? 'Đã Chọn' : 'Chọn'}
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
                    <td className="py-2 px-3 border-r text-slate-700 font-mono">{r.ngay_ky || r.thang_nam || r.nam || '—'}</td>
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
          selected_record: imisResults[selectedIdx]
        })}
        nextLabel="Cơ sở 4 (MSC)"
        prevLabel="Cơ sở 2 (ERP)"
      />
    </div>
  );
}

// ── Pillar 4: MSC ─────────────────────────────────────────────────────────────
// ── Pillar 4: MSC ─────────────────────────────────────────────────────────────
function PillarMsc({ loading, saving, data, dgTrinh, item, onSave, onAutoSave, saved, onOpenMscConfig, mscStatus }) {
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
  const [selectedIdx, setSelectedIdx] = useState(0);

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
    setSelectedIdx(0);
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
  const selectedRecord = filteredItems[selectedIdx] || itemsList[selectedIdx] || itemsList[0];
  const selectedPrice = selectedRecord ? parseFloat(selectedRecord.don_gia || 0) : 0;
  const diffAmt = dgTrinh - selectedPrice;
  const diffPct = selectedPrice > 0 ? ((dgTrinh - selectedPrice) / selectedPrice * 100) : 0;

  const thoiGianTraCuu = analysis?.thoi_gian_tra_cuu || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN');

  // Build justification text
  let summaryText = '';
  if (itemsList.length > 0 && selectedRecord) {
    const benMoiThauStr = selectedRecord.ben_moi_thau ? `, Bên mời thầu: ${selectedRecord.ben_moi_thau}` : '';
    if (diffAmt <= 0) {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận mức giá trúng thầu tham chiếu là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}${benMoiThauStr}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương giá trúng thầu công khai trên toàn quốc.`;
    } else {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận đơn giá trúng thầu tham chiếu thấp nhất là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}${benMoiThauStr}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${diffPct.toFixed(1)}% (+${fmt(diffAmt)} đ). Tổ Thẩm định đề nghị xem xét tham chiếu giá Mua sắm công để tối ưu chi phí.`;
    }
  } else if (mscResponse && !searching) {
    summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu} nhưng chưa ghi nhận kết quả trúng thầu tương tự.`;
  }

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
        <div className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/80 text-slate-900 shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-orange-950">
              <FileText className="w-4 h-4 text-orange-700" /> 📄 BẢN THUYẾT MINH CĂN CỨ MUA SẮM CÔNG QUỐC GIA (TỰ ĐỘNG TỔNG HỢP)
            </h5>
            <button
              onClick={copyToClipboard}
              className="bg-white hover:bg-slate-100 text-orange-900 border border-orange-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
            >
              📋 Sao Chép Thuyết Minh MSC
            </button>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/80 p-3 rounded-lg border border-orange-200/80 text-slate-800">
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
                const isSelected = i === selectedIdx;
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
                        onClick={() => setSelectedIdx(i)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-slate-200 hover:bg-orange-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? 'Đã Chọn' : 'Chọn'}
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
          selected_record: selectedRecord
        })}
        nextLabel="Cơ sở 5 (TMĐT)"
        prevLabel="Cơ sở 3 (IMIS)"
      />
    </div>
  );
}

// ── Pillar 5: E-Commerce / Market Prices ──────────────────────────────────────
function PillarEcom({ loading, saving, data, dgTrinh, item, onSave, saved, onAutoSave }) {
  const toast = useToast();
  const candidates = generateKeywordCandidates(item?.ten_vt);
  const defaultKw = data?.keyword || data?.search_keyword || getDefaultImisKeyword(item?.ten_vt);

  const [searchKey, setSearchKey] = useState(defaultKw);
  const [urlItems, setUrlItems] = useState(data?.items || []);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selectedRecord = urlItems[selectedIdx] || urlItems[0];
  const selectedPrice  = selectedRecord ? parseFloat(selectedRecord.price || 0) : 0;
  const diffAmt = dgTrinh - selectedPrice;
  const diffPct = selectedPrice > 0 ? ((dgTrinh - selectedPrice) / selectedPrice * 100) : 0;

  const computeDefaultSummary = (itemsList, selRec, kw) => {
    const sRec = selRec || (itemsList && itemsList[0]);
    const sPrice = sRec ? parseFloat(sRec.price || 0) : 0;
    const dAmt = dgTrinh - sPrice;
    const dPct = sPrice > 0 ? ((dgTrinh - sPrice) / sPrice * 100) : 0;
    const thoiGian = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN');

    const usdInfo = (sRec?.currency === 'USD' && sRec?.price_usd)
      ? ` (tương đương $${sRec.price_usd.toLocaleString('en-US')} USD, tỷ giá ${fmt(sRec.exchange_rate || 25450)} đ/USD)`
      : '';
    const imgInfo = sRec?.image_url ? ' kèm ảnh chụp màn hình minh chứng niêm yết' : '';

    if (itemsList && itemsList.length > 0 && sRec) {
      if (dAmt <= 0) {
        return `Đã tra cứu từ khóa [${kw}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${sRec.vendor || 'Internet'}) tại đường link [${sRec.url || 'Web'}] lúc ${thoiGian}${imgInfo}; ghi nhận mức giá niêm yết công khai là ${fmt(sPrice)} đ${usdInfo}. Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương đơn giá niêm yết công khai trên Internet.`;
      } else {
        return `Đã tra cứu từ khóa [${kw}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${sRec.vendor || 'Internet'}) tại đường link [${sRec.url || 'Web'}] lúc ${thoiGian}${imgInfo}; ghi nhận mức giá niêm yết công khai tham chiếu là ${fmt(sPrice)} đ${usdInfo}. Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${dPct.toFixed(1)}% (+${fmt(dAmt)} đ) so với đơn giá công khai trên thị trường.`;
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

  // Clipboard Paste Image state
  const [pastedImage, setPastedImage]               = useState(null);
  const [isPasting, setIsPasting]                   = useState(false);
  const [previewModalImage, setPreviewModalImage]   = useState(null);

  const calculatedVndPrice = currency === 'USD'
    ? Math.round((parseFloat(newPriceUsd) || 0) * (parseFloat(exchangeRate) || 25450))
    : (parseFloat(newPrice) || 0);

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

    let noteText = newNotes;
    if (!noteText) {
      if (isUsd && usdVal > 0) {
        noteText = `Quy đổi từ $${usdVal.toLocaleString('en-US')} USD (Tỷ giá: ${fmt(rateVal)} đ/USD)`;
      } else {
        noteText = pastedImage ? 'Có ảnh chụp màn hình minh chứng' : 'Thông tin niêm yết công khai';
      }
    }

    const newItemObj = {
      id: Date.now(),
      search_keyword: searchKey,
      title: newTitle || item?.ten_vt || 'Mục tham khảo',
      vendor: newVendor || (pastedImage ? 'Ảnh chụp màn hình web' : 'Website Thương mại điện tử'),
      url: newUrl.startsWith('http') ? newUrl : (newUrl ? `https://${newUrl}` : '#'),
      price: finalPrice,
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
      search_keyword: searchKey
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
                <th className="py-2.5 px-3 border-r w-36 font-mono bg-cyan-100/50 text-right">Đơn Giá Web</th>
                <th className="py-2.5 px-3 border-r font-mono">Link URL Tra Cứu</th>
                <th className="py-2.5 px-2.5 border-r w-24 text-center">Ngày Tra Cứu</th>
                <th className="py-2.5 px-2 text-center w-12">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {urlItems.map((r, i) => {
                const isSelected = i === selectedIdx;
                const dg = parseFloat(r.price || 0);
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
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
                            onAutoSave({ items: urlItems, selected_record: r, search_keyword: searchKey });
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

// ── Pillar 6: Synthesis & Evaluation (5 Pillars Matrix & Scoring) ──────────────
function PillarSynthesis({ loading, saving, data, dgTrinh, item, quoteEvidence, erpResults, imisResults, mscResults, ecomResults, evidenceStatus, onSave, saved }) {
  const toast = useToast();

  // Helper to extract first valid price from an array of records
  const extractFirstPrice = (arr, keys = ['donGia', 'don_gia', 'price', 'trung_thau_don_gia', 'gia']) => {
    if (!Array.isArray(arr)) return 0;
    for (const r of arr) {
      if (!r) continue;
      for (const k of keys) {
        const val = parseFloat(r[k] || 0);
        if (val > 0) return val;
      }
    }
    return 0;
  };

  // Extract prices from 5 pillars (live results or saved evidence with fallbacks)
  const p1_price = parseFloat(
    quoteEvidence?.selected_record?.don_gia ||
    quoteEvidence?.min_price ||
    quoteEvidence?.min_quote?.don_gia ||
    extractFirstPrice(quoteEvidence?.matches) ||
    0
  );

  const isErpDeselected = Boolean(
    erpResults?.is_deselected ||
    erpResults?.selected_record === 'NONE' ||
    erpResults?.summary?.status === 'ERP_DESELECTED' ||
    erpResults?.summary?.is_deselected
  );

  const erpList = Array.isArray(erpResults) ? erpResults : (erpResults?.results || []);
  const p2_price = isErpDeselected ? 0 : parseFloat(
    (typeof erpResults?.selected_record === 'object' && (erpResults.selected_record?.donGia || erpResults.selected_record?.don_gia)) ||
    (erpResults?.use_average && (erpResults?.summary?.avg_price || erpResults?.avg_price)) ||
    erpResults?.don_gia_tham_chieu ||
    (!erpResults?.selected_record && extractFirstPrice(erpList)) ||
    0
  );

  const imisList = Array.isArray(imisResults) ? imisResults : (imisResults?.imis || []);
  const p3_price = parseFloat(
    imisResults?.selected_record?.don_gia ||
    imisResults?.selected_record?.donGia ||
    imisResults?.don_gia_tham_chieu ||
    imisResults?.summary?.avg_price ||
    imisResults?.summary?.min_price ||
    imisResults?.avg_price ||
    extractFirstPrice(imisList) ||
    0
  );

  const mscList = mscResults?.analysis?.items || mscResults?.items || mscResults?.danh_sach_ket_qua || (Array.isArray(mscResults) ? mscResults : []);
  const p4_price = parseFloat(
    mscResults?.selected_record?.don_gia ||
    mscResults?.selected_record?.donGia ||
    mscResults?.don_gia_tham_chieu ||
    mscResults?.min_price ||
    extractFirstPrice(mscList) ||
    0
  );

  const ecomList = ecomResults?.items || (Array.isArray(ecomResults) ? ecomResults : []);
  const p5_price = parseFloat(
    ecomResults?.selected_record?.price ||
    ecomResults?.selected_record?.don_gia ||
    ecomResults?.don_gia_tham_chieu ||
    extractFirstPrice(ecomList) ||
    0
  );

  // Status checks for 5 pillars
  const has_p1 = Boolean(p1_price > 0 || quoteEvidence?.min_price || quoteEvidence?.matches?.length > 0 || quoteEvidence?.summary_text || evidenceStatus?.has_quotes);
  const has_p2 = Boolean(p2_price > 0 || erpResults?.results?.length > 0 || erpResults?.thoi_gian_luu || erpResults?.summary_text || evidenceStatus?.has_erp);
  const has_p3 = Boolean(p3_price > 0 || imisResults?.imis?.length > 0 || imisResults?.thoi_gian_luu || imisResults?.summary_text || evidenceStatus?.has_imis);
  const has_p4 = Boolean(p4_price > 0 || mscResults?.analysis?.items?.length > 0 || mscResults?.items?.length > 0 || mscResults?.danh_sach_ket_qua?.length > 0 || mscResults?.thoi_gian_luu || mscResults?.summary_text || evidenceStatus?.has_msc);
  const has_p5 = Boolean(p5_price > 0 || ecomResults?.summary_text || ecomResults?.items || ecomResults?.thoi_gian_luu || evidenceStatus?.has_ecom);

  // 1. Evidence Coverage Score (0-100 points, 20 points per pillar)
  const activeCount = [has_p1, has_p2, has_p3, has_p4, has_p5].filter(Boolean).length;
  const coverageScore = activeCount * 20;

  let coverageRank = 'Hạng C';
  let coverageBadge = 'bg-red-100 text-red-800 border-red-300';
  let coverageTitle = '🔴 Chứng cứ Thiếu hụt (Cần bổ sung tra cứu)';
  if (coverageScore >= 80) {
    coverageRank = 'Hạng A';
    coverageBadge = 'bg-emerald-100 text-emerald-900 border-emerald-400';
    coverageTitle = '🟢 Chứng cứ Cực kỳ Đầy đủ & Vững chắc';
  } else if (coverageScore >= 60) {
    coverageRank = 'Hạng B';
    coverageBadge = 'bg-blue-100 text-blue-900 border-blue-300';
    coverageTitle = '🟡 Chứng cứ Khá đầy đủ';
  }

  // 2. Price Reasonableness Score
  const validPrices = [p1_price, p2_price, p3_price, p4_price, p5_price].filter(p => p > 0);
  const minBaseline = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const avgBaseline = validPrices.length > 0 ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

  let priceScore = 100;
  let priceEval = '🟢 Rất Hợp Lý (Đơn giá trình <= Mốc tham chiếu thấp nhất)';

  if (validPrices.length === 0) {
    priceScore = 70;
    priceEval = '⚪ Chưa có mốc giá so sánh thực tế';
  } else if (dgTrinh <= minBaseline) {
    priceScore = 100;
    priceEval = '🟢 Rất Hợp Lý (Đơn giá trình <= Giá thấp nhất công khai)';
  } else if (dgTrinh <= avgBaseline) {
    priceScore = 85;
    priceEval = '🟡 Hợp Lý (Nằm trong biên độ giá trung bình thị trường)';
  } else if (dgTrinh <= minBaseline * 1.2) {
    priceScore = 60;
    priceEval = '🟠 Cần Xem Xét (Cao hơn giá mốc thấp nhất <20%)';
  } else {
    priceScore = 30;
    priceEval = '🔴 Chưa Hợp Lý (Đơn giá trình cao hơn >20% so với mốc giá tham chiếu)';
  }

  // Selection state for final approved price & transparent AI results
  const [approvedPrice, setApprovedPrice] = useState(data?.approved_price || (minBaseline > 0 ? minBaseline : dgTrinh));
  const [editingText, setEditingText]     = useState(data?.summary_text || '');
  const [runningAi, setRunningAi]         = useState(false);
  const [aiStep, setAiStep]               = useState(0);
  const [aiResultData, setAiResultData]   = useState(data?.ai_result_data || null);

  const handleRunAiSynthesis = async () => {
    if (!item?.id) return;
    setRunningAi(true);
    setAiStep(1);
    try {
      await new Promise(r => setTimeout(r, 350));
      setAiStep(2);
      await new Promise(r => setTimeout(r, 350));
      setAiStep(3);

      const res = await fetch(`/api/items/${item.id}/run-ai-synthesis`, { method: 'POST' });
      setAiStep(4);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.synthesis) {
          const syn = json.synthesis;
          setAiStep(5);
          await new Promise(r => setTimeout(r, 300));

          if (syn.summary_text) setEditingText(syn.summary_text);
          if (syn.approved_price) setApprovedPrice(syn.approved_price);
          setAiResultData(syn);
          toast.success('✨ AI Chuyên Gia đã sinh Thuyết minh Độc lập & Đánh giá rủi ro thành công!');
        }
      } else {
        toast.error('Lỗi kết nối API AI Synthesis!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Không thể kết nối đến máy chủ AI!');
    } finally {
      setTimeout(() => {
        setRunningAi(false);
        setAiStep(0);
      }, 500);
    }
  };

  useEffect(() => {
    if (data?.approved_price) {
      setApprovedPrice(data.approved_price);
    } else if (minBaseline > 0) {
      setApprovedPrice(minBaseline);
    }
  }, [data?.approved_price, minBaseline]);

  const qty = parseFloat(item?.so_luong || 1);
  const savingsPerUnit = dgTrinh - approvedPrice;
  const totalSavings   = savingsPerUnit * qty;
  const savingsPct     = dgTrinh > 0 ? ((dgTrinh - approvedPrice) / dgTrinh * 100) : 0;

  const getCleanKw = (kw) => {
    if (!kw || typeof kw !== 'string') return '';
    const firstLine = kw.split(/[\r\n]+/)[0].trim();
    const s = firstLine.split(' - ')[0].trim();
    if (s.toLowerCase().startsWith('chưa') || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'none') return '';
    return s || firstLine;
  };

  const erpKw = getCleanKw(erpResults?.used_keyword) ||
    getCleanKw(erpResults?.keyword) ||
    (item?.ma_vt && isValidErpCode(item.ma_vt) ? item.ma_vt : '') ||
    getErpDefaultKw(item, erpResults);

  const imisKw = getCleanKw(imisResults?.used_keyword) || getCleanKw(imisResults?.keyword) || (item?.part_no ? String(item.part_no).split('|')[0].trim() : '') || (item?.ma_vt && isValidErpCode(item?.ma_vt) ? item.ma_vt : '') || getCleanKw(item?.ten_vt) || '';
  const mscKw  = getCleanKw(mscResults?.used_keyword)  || getCleanKw(mscResults?.keyword)  || getCleanKw(item?.ten_vt_goc) || getCleanKw(item?.ten_vt) || '';
  const ecomKw = getCleanKw(ecomResults?.search_keyword) || getCleanKw(ecomResults?.keyword) || getCleanKw(item?.ten_vt_goc) || getCleanKw(item?.ten_vt) || '';

  // Auto-generate aggregated justification text with full detailed justification breakdown
  useEffect(() => {
    if (data?.summary_text) {
      setEditingText(data.summary_text);
      return;
    }

    const unit = item?.dvt || 'Cái';
    let text = `TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC: ${getCleanKw(item?.ten_vt) || item?.ten_vt || ''} (Mã ERP: ${item?.ma_vt || '—'}).\n`;
    text += `• Đơn giá trình thẩm định: ${fmt(dgTrinh)} VNĐ (Số lượng: ${qty} ${unit}).\n`;
    text += `• Đánh giá Chứng cứ Thẩm định: Đạt ${coverageScore}/100 điểm (${coverageRank} - ${activeCount}/5 cơ sở chứng cứ đã nạp).\n`;
    text += `• Đánh giá Mức độ Hợp lý Đơn giá: ${priceScore}/100 điểm (${priceEval}).\n\n`;

    text += `CƠ SỞ THẨM ĐỊNH THỐNG NHẤT 5 CƠ SỞ CHỨNG CỨ:\n`;

    // 1. Cơ sở 1: Báo Giá Gốc
    let p1_desc = '';
    if (p1_price > 0) {
      const supplierName = quoteEvidence?.min_quote?.company || quoteEvidence?.matched_supplier?.company || 'Nhà thầu chào trong Hồ sơ trình';
      const pageNum = quoteEvidence?.min_quote?.page || quoteEvidence?.min_quote?.stt || 1;
      p1_desc = `Đã đối chiếu các báo giá thương mại cạnh tranh trong Hồ sơ trình; ghi nhận đơn giá chào thấp nhất là ${fmt(p1_price)} VNĐ/${unit} từ ${supplierName} (Trang ${pageNum} Báo giá); đơn giá chào đối chiếu ${p1_price === dgTrinh ? 'khớp 100% với đơn giá dự toán trình' : p1_price < dgTrinh ? `thấp hơn ${fmt(dgTrinh - p1_price)} VNĐ/${unit} so với đơn giá trình` : `cao hơn đơn giá trình`}.`;
    } else if (has_p1) {
      p1_desc = `Đã đối chiếu hồ sơ báo giá gốc trình thẩm định; ghi nhận các báo giá thương mại kèm theo đầy đủ hợp lệ.`;
    } else {
      p1_desc = `Chưa nạp dữ liệu báo giá thương mại cạnh tranh trong Hồ sơ trình.`;
    }
    text += `- Cơ sở 1 (Báo Giá Gốc): ${p1_desc}\n`;

    // 2. Cơ sở 2: ERP Vĩnh Tân 4
    let p2_desc = '';
    if (isErpDeselected) {
      p2_desc = `Qua rà soát CSDL Kế toán ERP của NMNĐ Vĩnh Tân 4 theo từ khóa [${erpKw}], các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này.`;
    } else if (p2_price > 0) {
      const rec = (typeof erpResults?.selected_record === 'object' && erpResults?.selected_record) || erpResults?.results?.[0];
      const poInfo = rec?.soHopDong || rec?.so_hd ? ` theo HĐ ${rec.soHopDong || rec.so_hd}` : '';
      const dateInfo = rec?.ngayKyHd || rec?.ngayNhapKho ? ` ngày ${rec.ngayKyHd || rec.ngayNhapKho}` : '';
      p2_desc = `Tra cứu theo từ khóa [${erpKw}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; ghi nhận đơn giá nhập kho gần nhất là ${fmt(p2_price)} VNĐ/${unit}${poInfo}${dateInfo}.`;
    } else if (has_p2) {
      p2_desc = `Tra cứu theo từ khóa [${erpKw}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; kết quả đã đối soát CSDL ERP: 0 bản ghi phù hợp (vật tư chưa từng có lịch sử nhập kho nội bộ nhà máy Vĩnh Tân 4).`;
    } else {
      p2_desc = `Chưa đối chiếu CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4.`;
    }
    text += `- Cơ sở 2 (ERP Vĩnh Tân 4): ${p2_desc}\n`;

    // 3. Cơ sở 3: EVN IMIS
    let p3_desc = '';
    if (p3_price > 0) {
      const rec = imisResults?.selected_record || imisResults?.imis?.[0];
      const dvInfo = rec?.ten_dv_mua ? ` tại ${rec.ten_dv_mua}` : ' toàn ngành EVN';
      const hdInfo = rec?.so_hd ? ` theo HĐ ${rec.so_hd}` : '';
      p3_desc = `Tra cứu theo từ khóa [${imisKw}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); ghi nhận đơn giá trúng thầu/hợp đồng tham chiếu là ${fmt(p3_price)} VNĐ/${unit}${dvInfo}${hdInfo}.`;
    } else if (has_p3) {
      p3_desc = `Tra cứu theo từ khóa [${imisKw}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); kết quả đã đối soát toàn CSDL EVN: 0 bản ghi phù hợp (không phát sinh mua sắm tương đương).`;
    } else {
      p3_desc = `Chưa đối chiếu CSDL Hợp đồng mua sắm toàn ngành EVN IMIS.`;
    }
    text += `- Cơ sở 3 (EVN IMIS): ${p3_desc}\n`;

    // 4. Cơ sở 4: Mua Sắm Công e-GP
    let p4_desc = '';
    if (p4_price > 0) {
      const rec = mscResults?.selected_record || mscResults?.analysis?.items?.[0] || mscResults?.items?.[0];
      const vendorInfo = rec?.hang_sx || rec?.nhà_thầu ? ` (Nhà thầu ${rec.hang_sx || rec.nhà_thầu})` : '';
      p4_desc = `Tra cứu theo từ khóa [${mscKw}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); ghi nhận đơn giá trúng thầu công khai tham chiếu là ${fmt(p4_price)} VNĐ/${unit}${vendorInfo}.`;
    } else if (has_p4) {
      p4_desc = `Tra cứu theo từ khóa [${mscKw}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); kết quả đã rà soát e-GP: vật tư đặc thù, không ghi nhận gói thầu mua sắm tương đồng.`;
    } else {
      p4_desc = `Chưa đối chiếu Cổng Mạng Đấu thầu Quốc gia e-GP.`;
    }
    text += `- Cơ sở 4 (Mua Sắm Công e-GP): ${p4_desc}\n`;

    // 5. Cơ sở 5: Thương Mại Điện Tử & Giá Web
    let p5_desc = '';
    if (ecomResults?.summary_text) {
      p5_desc = ecomResults.summary_text;
    } else if (p5_price > 0) {
      const rec = ecomResults?.selected_record || ecomResults?.items?.[0];
      p5_desc = `Tra cứu theo từ khóa [${ecomKw}] trên thị trường TMĐT / Website nhà cung cấp (${rec?.vendor || 'Internet'}) tại link [${rec?.url || 'Web'}]; ghi nhận đơn giá niêm yết công khai tham chiếu là ${fmt(p5_price)} VNĐ/${unit}.`;
    } else {
      p5_desc = `Tra cứu theo từ khóa [${ecomKw}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`;
    }
    text += `- Cơ sở 5 (Thương Mại Điện Tử): ${p5_desc}\n`;

    if (totalSavings > 0) {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đề xuất duyệt đơn giá thẩm định thống nhất là ${fmt(approvedPrice)} VNĐ/${unit}. Tiết kiệm dự toán ${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%).`;
    } else {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đơn giá trình phù hợp với mặt bằng giá thị trường. Đề xuất phê duyệt giữ nguyên đơn giá trình là ${fmt(approvedPrice)} VNĐ/${unit}.`;
    }

    setEditingText(text);
  }, [item?.ten_vt, item?.ma_vt, qty, item?.dvt, dgTrinh, approvedPrice, coverageScore, coverageRank, activeCount, priceScore, priceEval, has_p1, p1_price, quoteEvidence, has_p2, p2_price, erpResults, has_p3, p3_price, imisResults, has_p4, p4_price, mscResults, has_p5, p5_price, ecomResults, totalSavings, savingsPct]);

  const copyToClipboard = () => {
    if (editingText) {
      navigator.clipboard.writeText(editingText);
      toast.success('Đã sao chép Thuyết Minh Tổng Hợp 5 Cơ Sở!');
    }
  };

  const handleExportDocx = () => {
    const docHtml = `
      <div style="font-family: 'Times New Roman', serif; line-height: 1.4; color: #000; padding: 20px;">
        <table style="width: 100%; border: none; margin-bottom: 20px;">
          <tr>
            <td style="width: 45%; text-align: center; border: none; font-size: 11pt;">
              <strong>NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4</strong><br/>
              <b>TỔ THẨM ĐỊNH DỰ TOÁN</b><br/>
              -------------
            </td>
            <td style="width: 55%; text-align: center; border: none; font-size: 11pt;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <b>Độc lập - Tự do - Hạnh phúc</b><br/>
              -----------------------
            </td>
          </tr>
        </table>

        <h2 style="text-align: center; font-size: 15pt; font-weight: bold; margin-top: 15px; margin-bottom: 15px; text-transform: uppercase;">
          BÁO CÁO TỔNG HỢP KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ VẬT TƯ
        </h2>

        <p style="font-size: 12pt; margin-bottom: 10px;">
          <strong>Mục vật tư thẩm định:</strong> ${item?.ten_vt || '—'}<br/>
          <strong>Mã vật tư (ERP):</strong> ${item?.ma_vt || '—'}<br/>
          <strong>Số lượng:</strong> ${qty} ${item?.dvt || 'Cái'} &nbsp;|&nbsp; <strong>Đơn giá trình:</strong> ${fmt(dgTrinh)} VNĐ
        </p>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          I. ĐÁNH GIÁ CHỨNG CỨ THẨM ĐỊNH (5 CƠ SỞ CHỨNG CỨ)
        </h3>
        <p style="font-size: 12pt;">
          - Điểm số độ đủ chứng cứ: <strong>${coverageScore}/100 điểm</strong> (${coverageRank} - ${activeCount}/5 Cơ sở chứng cứ đã nạp).<br/>
          - Điểm số mức độ hợp lý giá trình: <strong>${priceScore}/100 điểm</strong> (${priceEval}).
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt;">Cơ Sở Chứng Cứ</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;">Đơn Giá Tham Chiếu</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">% Lệch vs Trình</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt;">Trạng Thái Chứng Cứ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;"><strong>Đơn Giá Dự Toán Trình</strong></td>
              <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;"><strong>${fmt(dgTrinh)} VNĐ</strong></td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">0.0%</td>
              <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">Mốc dự toán lập</td>
            </tr>
            ${pillarsList.map(p => {
              const dg = p.price;
              const diff = (dgTrinh > 0 && dg > 0) ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
              return `
                <tr>
                  <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">${p.name}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;">${dg > 0 ? `${fmt(dg)} VNĐ` : '—'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">${dg > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">${p.has ? 'Đã nạp chứng cứ' : 'Chưa nạp dữ liệu'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          II. BẢN THUYẾT MINH THẨM ĐỊNH THỐNG NHẤT
        </h3>
        <div style="font-size: 11pt; white-space: pre-wrap; background-color: #f9f9f9; padding: 10px; border: 1px solid #ccc; font-family: 'Times New Roman', serif;">
          ${editingText}
        </div>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          III. KẾT LUẬN & ĐỀ XUẤT PHÊ DUYỆT
        </h3>
        <p style="font-size: 12pt;">
          - <strong>Đơn giá phê duyệt đề xuất:</strong> <span style="font-size: 13pt; color: #003366;"><strong>${fmt(approvedPrice)} VNĐ / ${item?.dvt || 'Cái'}</strong></span><br/>
          - <strong>Tổng tiết kiệm dự toán:</strong> <strong>${totalSavings > 0 ? `${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%)` : '0 VNĐ (Giữ nguyên giá trình)'}</strong>
        </p>

        <table style="width: 100%; border: none; margin-top: 40px;">
          <tr>
            <td style="width: 50%; text-align: center; border: none; font-size: 11pt;">
              <strong>CHUYÊN VIÊN THẨM ĐỊNH</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
              <br/><br/><br/><br/>
            </td>
            <td style="width: 50%; text-align: center; border: none; font-size: 11pt;">
              <strong>LÃNH ĐẠO PHÊ DUYỆT</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
              <br/><br/><br/><br/>
            </td>
          </tr>
        </table>
      </div>
    `;

    const header = `<html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Báo cáo Thẩm định</title></head><body>`;
    const footer = `</body></html>`;
    const blob = new Blob(['\ufeff' + header + docHtml + footer], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Tham_Dinh_${(item?.ma_vt || 'VT').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('✨ Đã xuất file Báo cáo Thẩm định Word (.doc/.docx)!');
  };



  const handleFinalApprove = () => {
    let basisName = 'Căn cứ đối chiếu 5 cơ sở chứng cứ';
    if (approvedPrice === p1_price && p1_price > 0) {
      basisName = 'Cơ sở 1: Báo giá nộp kèm';
    } else if (approvedPrice === p2_price && p2_price > 0) {
      basisName = 'Cơ sở 2: ERP Vĩnh Tân 4';
    } else if (approvedPrice === p3_price && p3_price > 0) {
      basisName = 'Cơ sở 3: EVN IMIS';
    } else if (approvedPrice === p4_price && p4_price > 0) {
      basisName = 'Cơ sở 4: Mua Sắm Công e-GP';
    } else if (approvedPrice === p5_price && p5_price > 0) {
      basisName = 'Cơ sở 5: Tham khảo TMĐT / Giá Web';
    } else if (approvedPrice === dgTrinh) {
      basisName = 'Cơ sở 1: Báo giá nộp kèm (Giữ giá trình)';
    }

    onSave({
      approved_price: approvedPrice,
      total_savings: totalSavings,
      coverage_score: coverageScore,
      price_score: priceScore,
      co_so_thong_nhat: basisName,
      summary_text: editingText
    });
    toast.success('✨ Đã lưu & Phê duyệt Kết quả Thẩm định Mục!');
  };

  const pillarsList = [
    { key: 'p1', name: 'Cơ sở 1: Báo Giá Gốc', price: p1_price, has: has_p1, kw: quoteEvidence?.min_quote?.company || 'Báo giá nộp kèm' },
    { key: 'p2', name: 'Cơ sở 2: ERP Vĩnh Tân 4', price: p2_price, has: has_p2, kw: erpKw },
    { key: 'p3', name: 'Cơ sở 3: EVN IMIS', price: p3_price, has: has_p3, kw: imisKw },
    { key: 'p4', name: 'Cơ sở 4: Mua Sắm Công e-GP', price: p4_price, has: has_p4, kw: mscKw },
    { key: 'p5', name: 'Cơ sở 5: Thương Mại Điện Tử', price: p5_price, has: has_p5, kw: ecomKw },
  ];

  return (
    <div className="space-y-4">
      <PillarHeader icon={Award} color="teal" title="CƠ SỞ 6: TỔNG HỢP & ĐÁNH GIÁ THẨM ĐỊNH (5 CƠ SỞ CHỨNG CỨ)" loading={loading} />

      {/* Scoring Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        {/* Coverage Score */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-teal-700" /> 1. Điểm Độ Đủ Chứng Cứ
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-teal-900">{coverageScore}<span className="text-sm font-semibold text-slate-500">/100</span></span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${coverageBadge}`}>{coverageRank}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 truncate" title={coverageTitle}>{coverageTitle}</p>
        </div>

        {/* Price Score */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Percent className="w-4 h-4 text-blue-700" /> 2. Điểm Mức Độ Hợp Lý Giá
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-blue-950">{priceScore}<span className="text-sm font-semibold text-slate-500">/100</span></span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">Biên độ giá</span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 truncate" title={priceEval}>{priceEval}</p>
        </div>

        {/* Savings Calculator Card */}
        <div className={`p-3.5 rounded-xl border space-y-1 ${totalSavings > 0 ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1 text-emerald-950 font-extrabold"><Calculator className="w-4 h-4 text-emerald-700" /> Tiết Kiệm Dự Toán</span>
            {totalSavings > 0 && <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">-${fmt(savingsPct)}%</span>}
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900">
            {totalSavings > 0 ? `-${fmt(totalSavings)} đ` : '0 đ'}
          </div>
          <p className="text-[10px] font-semibold text-slate-600">
            Duyệt: <strong className="font-mono text-teal-950">{fmt(approvedPrice)} đ</strong> / Trình: {fmt(dgTrinh)} đ
          </p>
        </div>
      </div>

      {/* Bảng Ma Trận So Sánh 5 Căn Cứ Tham Chiếu */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs text-left border-collapse min-w-[750px]">
          <thead className="bg-teal-50 text-teal-950 font-bold border-b border-teal-200">
            <tr>
              <th className="py-2.5 px-3 border-r">Cơ Sở Chứng Cứ Thẩm Định (Kèm Từ Khóa Tra Cứu)</th>
              <th className="py-2.5 px-3 border-r w-36 text-right font-mono">Đơn Giá Tham Chiếu</th>
              <th className="py-2.5 px-3 border-r w-32 text-center">Chênh Lệch % vs Trình</th>
              <th className="py-2.5 px-3 border-r text-center">Đánh Giá Độ Phù Hợp & Kết Quả</th>
              <th className="py-2.5 px-3 w-28 text-center">Trạng Thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100/80 font-bold">
              <td className="py-2 px-3 border-r text-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span>📋 ĐƠN GIÁ DỰ TOÁN TRÌNH THẨM ĐỊNH</span>
                </div>
              </td>
              <td className="py-2 px-3 border-r text-right font-mono text-blue-950 font-black">{fmt(dgTrinh)} đ</td>
              <td className="py-2 px-3 border-r text-center font-mono text-slate-500">0.0% (Gốc)</td>
              <td className="py-2 px-3 border-r text-center text-slate-700">Mốc dự toán đơn vị trình</td>
              <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">Gốc Trình</span></td>
            </tr>

            {pillarsList.map((p) => {
              const dg = p.price;
              const diff = (dgTrinh > 0 && dg > 0) ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
              const isLower = dg > 0 && dg < dgTrinh;
              return (
                <tr key={p.key} className="hover:bg-slate-50/80 text-[11px]">
                  <td className="py-2 px-3 border-r font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.has ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>{p.name}</span>
                    </div>
                    {p.kw && (
                      <div className="text-[10px] text-teal-800 font-mono font-normal pl-3.5 mt-0.5">
                        🔍 Từ khóa: <span className="font-semibold bg-teal-50 px-1 py-0.2 rounded border border-teal-200">"{p.kw}"</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 border-r text-right font-mono font-extrabold text-slate-900">
                    {dg > 0 ? (
                      `${fmt(dg)} đ`
                    ) : p.has ? (
                      <span className="text-slate-500 font-normal italic text-[10.5px]">0 kết quả (Ko có giá)</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-3 border-r text-center font-mono font-bold">
                    {dg > 0 ? (
                      <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-700' : 'text-slate-600'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 border-r text-center font-semibold">
                    {!p.has ? (
                      <span className="text-slate-400 italic">Chưa nạp dữ liệu</span>
                    ) : isLower ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🟢 Thấp hơn trình ({fmt(dgTrinh - dg)} đ)</span>
                    ) : dg > 0 ? (
                      <span className="text-slate-700">⚪ Tương đương / Phù hợp</span>
                    ) : p.key === 'p2' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">
                        {isErpDeselected ? 'Đã đối soát CSDL ERP: Không áp dụng làm căn cứ' : 'Đã đối soát CSDL ERP: 0 bản ghi phù hợp'}
                      </span>
                    ) : p.key === 'p3' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">Đã đối soát CSDL EVN: 0 bản ghi</span>
                    ) : p.key === 'p4' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">Đã rà soát e-GP: 0 gói thầu</span>
                    ) : p.key === 'p5' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">Vật tư đặc thù hãng, yêu cầu RFQ</span>
                    ) : (
                      <span className="text-slate-600 italic">Đã kiểm tra (Không có mốc giá)</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {p.has && dg > 0 ? (
                      <button
                        onClick={() => setApprovedPrice(dg)}
                        className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 text-teal-900 rounded font-bold text-[10px] border border-teal-300 transition"
                      >
                        ⚡ Chọn Giá Này
                      </button>
                    ) : p.has ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] border border-emerald-300">✓ Đã Nạp</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Chưa nạp</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hộp Chọn Đơn Giá Thống Nhất & Tùy Chỉnh */}
      <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-3">
        <h5 className="font-bold text-xs text-teal-950 uppercase flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-teal-700" /> PHÊ DUYỆT ĐƠN GIÁ THẨM ĐỊNH THỐNG NHẤT
        </h5>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Đơn giá phê duyệt:</span>
            <div className="relative">
              <input
                type="number"
                value={approvedPrice}
                onChange={e => setApprovedPrice(parseFloat(e.target.value) || 0)}
                className="w-44 px-3 py-1.5 text-xs font-mono font-extrabold text-teal-950 bg-white border border-teal-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">đ</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            <span className="text-slate-500 font-semibold">Chọn nhanh:</span>
            {pillarsList.filter(p => p.has && p.price > 0).map(p => (
              <button
                key={p.key}
                onClick={() => setApprovedPrice(p.price)}
                className={`px-2.5 py-1 rounded-lg font-bold transition border ${
                  approvedPrice === p.price ? 'bg-teal-700 text-white border-teal-800 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-teal-100'
                }`}
              >
                {p.name.split(':')[0]}: {fmt(p.price)} đ
              </button>
            ))}
            <button
              onClick={() => setApprovedPrice(dgTrinh)}
              className={`px-2.5 py-1 rounded-lg font-bold transition border ${
                approvedPrice === dgTrinh ? 'bg-blue-700 text-white border-blue-800 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Giữ Giá Trình ({fmt(dgTrinh)} đ)
            </button>
          </div>
        </div>
      </div>

      {/* Khung Báo Cáo Kết Quả AI Chuyên Gia Minh Bạch (AI Expert Results Dashboard) */}
      {aiResultData && (
        <div className={`p-4 rounded-xl border-2 shadow-sm transition space-y-3 ${
          aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
            ? 'bg-amber-50/90 border-amber-400 text-amber-950'
            : 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between border-b pb-2 border-slate-200/80">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-700 animate-bounce" />
              🤖 BẢNG TỔNG HỢP CHỈ SỐ KẾT QUẢ ĐẦU RA TỪ AI CHUYÊN GIA ĐỘC LẬP
            </h5>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}>
              {aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
                ? `🔴 CẢNH BÁO CAO (+${aiResultData.diff_pct?.toFixed(1)}%)`
                : '🟢 MỨC RỦI RO: BÌNH THƯỜNG'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Đơn giá AI Đề xuất Phê duyệt:</span>
              <span className="text-base font-black font-mono text-blue-900">{fmt(aiResultData.suggested_price || approvedPrice)} đ</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Tiết kiệm Dự toán Dự kiến:</span>
              <span className="text-base font-black font-mono text-emerald-700">
                {(aiResultData.estimated_savings || totalSavings) > 0 ? `-${fmt(aiResultData.estimated_savings || totalSavings)} đ` : '0 đ (Giữ giá trình)'}
              </span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Nguồn Mô hình AI Thực thi:</span>
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1 mt-1">
                {aiResultData.used_ai ? '🟢 Gemini LLM API (OpenRouter)' : '⚡ SME Expert Model (Local)'}
              </span>
            </div>
          </div>

          {aiResultData.expert_opinion && (
            <div className="bg-white/80 p-3 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block mb-1">💡 Trích xuất Ý kiến Phân tích Kỹ thuật Nổi bật:</span>
              <p className="text-[11.5px] leading-relaxed text-slate-700 whitespace-pre-wrap italic">
                {aiResultData.expert_opinion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Tiến trình Chạy AI Chuyên Gia minh bạch */}
      {runningAi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-purple-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-purple-950">ĐANG PHÂN TÍCH TIẾN TRÌNH BỞI AI CHUYÊN GIA</h4>
                <p className="text-xs text-slate-500 font-medium">Hệ thống đang xử lý độc lập dữ liệu 5 Khối chứng cứ...</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { step: 1, title: 'Nạp & Tổng hợp dữ liệu 5 Khối chứng cứ', desc: 'Đã thu thập Báo Giá Gốc, CSDL ERP Vĩnh Tân 4, IMIS EVN, Mua Sắm Công & TMĐT.' },
                { step: 2, title: 'Phân tích bản chất Kỹ thuật & Hãng sản xuất', desc: 'Đang đánh giá thông số thiết bị, model đặc thù và tính tương thích thương hiệu.' },
                { step: 3, title: 'Truy vấn Mô hình AI Chuyên Gia Độc Lập (LLM/SME)', desc: 'Đang gửi yêu cầu phản biện độc lập đến Mô hình AI Chuyên gia.' },
                { step: 4, title: 'Đánh giá Rủi ro Đơn giá & Tiết kiệm Dự toán', desc: 'Tính toán biên độ dao động lịch sử và số tiền tiết kiệm khả thi.' },
                { step: 5, title: 'Hoàn tất Thuyết minh & Đề xuất Đơn giá Phê duyệt', desc: 'Biên soạn bài báo cáo độc lập và sẵn sàng phê duyệt.' },
              ].map(s => {
                const isDone = aiStep > s.step;
                const isCurrent = aiStep === s.step;
                return (
                  <div key={s.step} className={`p-2.5 rounded-xl border text-xs transition flex items-start gap-3 ${
                    isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
                    isCurrent ? 'bg-purple-50 border-purple-300 text-purple-950 ring-2 ring-purple-200 font-bold' :
                    'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                       isCurrent ? <Loader2 className="w-4 h-4 text-purple-700 animate-spin" /> :
                       <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center text-[9px] font-bold">{s.step}</div>}
                    </div>
                    <div>
                      <div className="font-bold">{s.title}</div>
                      <div className="text-[10.5px] opacity-80 font-medium">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Tổng Hợp 5 Cơ Sở */}
      <div className="p-4 rounded-xl border-2 border-teal-400 bg-white text-slate-900 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-teal-950">
            <FileText className="w-4 h-4 text-teal-700" /> 📄 BẢN THUYẾT MINH TỔNG HỢP THẨM ĐỊNH (TỔ THẨM ĐỊNH LẬP)
          </h5>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAiSynthesis}
              disabled={runningAi}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-[11px] px-3 py-1 rounded-md font-bold flex items-center gap-1.5 shadow-2xs transition"
            >
              {runningAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                  <span>Đang tổng hợp Thuyết minh...</span>
                </>
              ) : (
                <span>🤖 Chạy AI Hỗ Trợ Thuyết Minh (1-Click)</span>
              )}
            </button>
            <button
              onClick={copyToClipboard}
              className="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
            >
              📋 Sao Chép Thuyết Minh
            </button>
            <button
              onClick={handleExportDocx}
              className="bg-blue-700 hover:bg-blue-800 text-white text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
            >
              📄 Xuất File Word (.docx)
            </button>

          </div>
        </div>
        <textarea
          rows={7}
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          className="w-full text-xs leading-relaxed font-mono p-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-teal-500 text-slate-800"
        />
      </div>

      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={handleFinalApprove}
        nextLabel={null}
        prevLabel="Cơ sở 5 (TMĐT)"
        isFinal
      />
    </div>
  );
}

// ── Shared Sub-components ──────────────────────────────────────────────────────
function PillarHeader({ icon: Icon, color, title, loading }) {
  return (
    <div className="flex items-center justify-between border-b pb-3">
      <h4 className={`font-bold text-sm text-${color}-900 uppercase tracking-wide flex items-center gap-2`}>
        <Icon className={`w-5 h-5 text-${color}-700`} /> {title}
      </h4>
      {loading && <span className="text-xs text-amber-600 italic animate-pulse flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tra cứu...</span>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400 gap-2 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Đang tải dữ liệu...
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="bg-slate-50 p-8 rounded-xl border border-dashed text-center text-xs text-slate-400">{text}</div>
  );
}

function SaveFooter({ saving, saved, onSave, nextLabel, prevLabel, isFinal }) {
  return (
    <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-4">
      <div className="flex items-center gap-2">
        {saved
          ? <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold"><ShieldCheck className="w-4 h-4" /> Đã lưu chứng cứ</span>
          : <span className="flex items-center gap-1.5 text-xs text-slate-400"><ShieldAlert className="w-4 h-4" /> Chưa lưu chứng cứ</span>
        }
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm disabled:opacity-60 ${
          isFinal ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-[#003366] hover:bg-blue-900 text-white'
        }`}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {isFinal ? '✨ Lưu & Phê Duyệt 5 Cơ Sở' : `💾 Lưu & Đi Tiếp ${nextLabel || ''}`}
        {!isFinal && <ArrowRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
