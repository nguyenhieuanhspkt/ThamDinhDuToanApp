import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, FileCheck2, Building2, Network, Globe,
  ExternalLink, CheckCircle, AlertTriangle, FileText, Award,
  Loader2, Save, ArrowRight, ArrowLeft, ShieldCheck, ShieldAlert, Database,
  Search, RotateCcw, Pin, Check, BarChart3, Calculator, Filter,
  ShoppingBag, Link, Plus, Trash2, Edit3, Star, Percent, CheckCircle2
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
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: currentItem.ten_vt,
          ma_vt: currentItem.ma_vt || '',
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0
        })
      });
      const data = await res.json();
      setErpResults(data);
      autoSaveStep('erp', { results: data?.results || [], keyword: currentItem.ten_vt });
    } catch (e) { toast.error('Lỗi kết nối ERP'); }
    finally { setLoading(p => ({ ...p, erp: false })); }
  }, [erpResults, currentItem, autoSaveStep]);

  const loadImis = useCallback(async () => {
    if (imisResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, imis: true }));
    try {
      const cleanKw = extractCleanImisKeyword(currentItem.ten_vt);
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: cleanKw || currentItem.ten_vt, item: currentItem, tu_ngay: '2023-01-01' })
      });
      const data = await res.json();
      setImisResults(data);
      autoSaveStep('imis', { imis: data?.imis || [], erp: data?.erp || [], keyword: currentItem.ten_vt });
    } catch (e) { toast.error('Lỗi kết nối IMIS'); }
    finally { setLoading(p => ({ ...p, imis: false })); }
  }, [imisResults, currentItem, autoSaveStep]);

  const loadMsc = useCallback(async () => {
    if (mscResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, msc: true }));
    try {
      const res = await fetch('/api/msc/search-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentItem.ten_vt })
      });
      const data = await res.json();
      setMscResults(data);
      autoSaveStep('muasamcong', { results: data?.analysis?.items || data?.items || [], keyword: data?.analysis?.keyword || currentItem.ten_vt });
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
      autoSaveStep('erp', { results: erpResults?.results || [], keyword: currentItem.ten_vt });
    } else if (activePillar === 'imis' && imisResults) {
      autoSaveStep('imis', { imis: imisResults?.imis || [], erp: imisResults?.erp || [], keyword: currentItem.ten_vt });
    } else if (activePillar === 'msc' && mscResults) {
      autoSaveStep('muasamcong', { results: mscResults?.analysis?.items || mscResults?.items || [], keyword: mscResults?.analysis?.keyword || currentItem.ten_vt });
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
        toast.success('Đã lưu chứng cứ ' + PILLAR_CFG[activePillar].label);
        await loadAllEvidenceStatus();
        await loadSavedEvidence(currentItem.id);
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
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Đang duyệt:</span>
          <strong className="text-slate-900 max-w-md truncate" title={currentItem.ten_vt}>
            {currentItem.ten_vt || 'Chưa chọn'}
          </strong>
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
                onSave={() => saveStep('erp', { results: erpResults?.results || [], keyword: currentItem.ten_vt }, 'imis')}
                saved={evSt.has_erp}
                onOpenErpConfig={onOpenErpConfig}
              />
            )}
            {/* ── PILLAR 3: IMIS ── */}
            {activePillar === 'imis' && (
              <PillarImis
                loading={loading.imis} saving={saving}
                data={imisResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={() => saveStep('imis', { imis: imisResults?.imis || [], erp: imisResults?.erp || [], keyword: currentItem.ten_vt }, 'msc')}
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
                onSave={() => saveStep('muasamcong', { results: mscResults?.analysis?.items || mscResults?.items || [], keyword: mscResults?.analysis?.keyword || currentItem.ten_vt }, 'ecom')}
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
                onSave={(payload) => saveStep('ecom', payload, 'synthesis')}
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

// ── Pillar 2: ERP ─────────────────────────────────────────────────────────────
function PillarErp({ loading, saving, data, dgTrinh, item, onSave, saved, onOpenErpConfig }) {
  const toast = useToast();
  const [erpResults, setErpResults] = useState(data?.results || []);
  const [mapping, setMapping] = useState(data?.mapping || {});
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  const [searchKey, setSearchKey] = useState(item?.ten_vt || item?.ma_vt || '');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setErpResults(data?.results || []);
    setMapping(data?.mapping || {});
    setSummaryData(data?.summary || {});
    setSearchKey(item?.ten_vt || item?.ma_vt || '');
    setSelectedIdx(0);
  }, [data, item]);

  const summaryText = summaryData?.summary_text || data?.summary_text;
  const status = summaryData?.status;
  const isWarning = status === 'ERP_WARN_RECENT_INCREASE';

  const handleManualSearch = async () => {
    if (!searchKey.trim()) return;
    setSearching(true);
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchKey.trim(),
          ma_vt: item?.ma_vt || '',
          item,
          dg_trinh: dgTrinh,
          is_manual: true
        })
      });
      const resp = await res.json();
      setErpResults(resp.results || []);
      setMapping(resp.mapping || {});
      setSummaryData(resp.summary || {});
      setSelectedIdx(0);
      toast.success(`Đã tìm thấy ${resp.results?.length || 0} kết quả ERP cho từ khóa [${searchKey.trim()}]`);
    } catch (e) {
      toast.error('Lỗi tìm kiếm ERP thủ công');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectRecord = async (index) => {
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
      setSummaryData(resp.summary || {});
      toast.success(`Đã chọn hợp đồng ${rec.soHopDong || 'ERP'} làm căn cứ thuyết minh!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAverage = async () => {
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
      setSummaryData(resp.summary || {});
      toast.success(`Đã chọn phương án Đơn Giá Trung Bình (${resp.summary?.count_n || erpResults.length} đợt) làm căn cứ thuyết minh!`);
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

      {/* Thanh Tra cứu ERP thủ công */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-2">
        <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
          <Search className="w-3.5 h-3.5 text-blue-700" /> Tra cứu ERP bằng tay:
        </span>
        <input
          type="text"
          value={searchKey}
          onChange={e => setSearchKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
          placeholder="Nhập tên vật tư hoặc mã ERP để tra cứu..."
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
          onClick={() => setSearchKey(item?.ten_vt || item?.ma_vt || '')}
          title="Khôi phục từ khóa mặc định"
          className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
        </button>
      </div>

      {/* Thanh Chọn Phương Án Thẩm Định: Hợp Đồng Cụ Thể vs Giá Trung Bình */}
      {erpResults.length >= 2 && (
        <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="font-bold text-blue-950 flex items-center gap-1.5 shrink-0">
            <Calculator className="w-4 h-4 text-blue-700" /> Tùy chọn Phương án Căn cứ ERP ({erpResults.length} đợt mua):
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSelectRecord(typeof selectedIdx === 'number' ? selectedIdx : 0)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                selectedIdx !== 'AVERAGE'
                  ? 'bg-blue-700 text-white border-blue-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Pin className="w-3.5 h-3.5" /> Theo Hợp Đồng Cụ Thể {typeof selectedIdx === 'number' ? `(#${selectedIdx + 1})` : ''}
            </button>
            <button
              onClick={handleSelectAverage}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                selectedIdx === 'AVERAGE'
                  ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-amber-300" /> 📊 Chọn Đơn Giá Trung Bình (AVG): {fmt(avgPrice)} đ
            </button>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Căn Cứ ERP tự động */}
      {summaryText && (
        <div className={`p-4 rounded-xl border-2 shadow-sm transition ${
          isWarning
            ? 'bg-amber-50 border-amber-400 text-amber-950'
            : 'bg-blue-50/80 border-blue-300 text-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-blue-900">
              <FileText className="w-4 h-4 text-blue-700" /> 📄 BẢN THUYẾT MINH CĂN CỨ ERP (TỰ ĐỘNG TỔNG HỢP)
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
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'bg-slate-200 hover:bg-blue-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? 'Đã Chọn' : 'Chọn'}
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
      <SaveFooter saving={saving} saved={saved} onSave={() => onSave({ results: erpResults, selected_record: erpResults[selectedIdx] })} nextLabel="Cơ sở 3 (IMIS)" prevLabel="Cơ sở 1 (BG)" />
    </div>
  );
}

// ── Pillar 3: IMIS ────────────────────────────────────────────────────────────
function PillarImis({ loading, saving, data, dgTrinh, item, onSave, saved, onOpenImisConfig, imisStatus }) {
  const toast = useToast();
  const [imisResults, setImisResults] = useState(data?.imis || []);
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  
  const initialCleanKw = data?.used_keyword || getDefaultImisKeyword(item?.ten_vt || item?.ma_vt || '');
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
    const defaultKw = getDefaultImisKeyword(item?.ten_vt || item?.ma_vt || '');
    setSearchKey(data?.used_keyword || defaultKw);
    setSelectedIdx(0);
    setFilterKw('');
    setFilterUnit('');
    setPriceFilter('ALL');
  }, [data, item]);

  const summaryText = summaryData?.summary_text || data?.summary_text;
  const isConnected = imisStatus?.is_connected;
  const candidates = (data?.candidates && data.candidates.length > 0)
    ? data.candidates
    : generateKeywordCandidates(item?.ten_vt || '');

  const triggerSearchWithKw = async (targetKw, customTu, customDen) => {
    if (!targetKw.trim()) return;
    const startD = customTu || tuNgay;
    const endD = customDen || denNgay;
    setSearching(true);
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: targetKw.trim(),
          ma_vt: item?.ma_vt || '',
          item,
          dg_trinh: dgTrinh,
          tu_ngay: startD,
          den_ngay: endD
        })
      });
      const resp = await res.json();
      setImisResults(resp.imis || []);
      setSummaryData(resp.summary || {});
      setSelectedIdx(0);
      setFilterKw('');
      setFilterUnit('');
      setPriceFilter('ALL');
      toast.success(`Đã tìm thấy ${resp.imis?.length || 0} kết quả IMIS cho từ khóa [${targetKw.trim()}] (${startD} -> ${endD})`);
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
      setSummaryData(resp.summary || {});
      toast.success(`Đã chọn hợp đồng ${rec.so_hop_dong || rec.so_hd || 'IMIS'} làm căn cứ thuyết minh!`);
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
      setSummaryData(resp.summary || {});
      toast.success(`Đã chọn phương án Đơn Giá Trung Bình EVN (${resp.summary?.count_n || imisResults.length} đợt) làm căn cứ thuyết minh!`);
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
      <SaveFooter saving={saving} saved={saved} onSave={() => onSave({ imis: imisResults, selected_record: imisResults[selectedIdx] })} nextLabel="Cơ sở 4 (MSC)" prevLabel="Cơ sở 2 (ERP)" />
    </div>
  );
}

// ── Pillar 4: MSC ─────────────────────────────────────────────────────────────
// ── Pillar 4: MSC ─────────────────────────────────────────────────────────────
function PillarMsc({ loading, saving, data, dgTrinh, item, onSave, saved, onOpenMscConfig, mscStatus }) {
  const toast = useToast();
  const candidates = generateKeywordCandidates(item?.ten_vt);
  const defaultKw = data?.used_keyword || data?.tu_khoa_tra_cuu || getDefaultImisKeyword(item?.ten_vt);

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

  useEffect(() => {
    if (data) {
      setMscResponse(data);
    }
  }, [data]);

  useEffect(() => {
    setSearchKey(defaultKw);
    setSelectedIdx(0);
    setPageNumber(0);
    setFilterKw('');
    setFilterOrigin('');
    setPriceFilter('ALL');
  }, [item?.id]);

  const triggerSearch = async (kw, pNum = 0, pSz = pageSize) => {
    const targetKw = (kw || searchKey || '').trim();
    if (!targetKw) {
      toast.error('Vui lòng nhập từ khóa tra cứu Mua Sắm Công');
      return;
    }

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
        toast.success(`Đã tra cứu e-GP với từ khóa [${targetKw}]`);
      } else {
        toast.error(resData.message || 'Không thể tra cứu e-GP');
      }
    } catch (e) {
      toast.error('Lỗi khi tra cứu Mua Sắm Công e-GP');
    } finally {
      setSearching(false);
    }
  };

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
      const matchName = (r.danh_muc || '').toLowerCase().includes(fkw) || (r.ma_tbmt || '').toLowerCase().includes(fkw);
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
    if (diffAmt <= 0) {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận mức giá trúng thầu tham chiếu là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương giá trúng thầu công khai trên toàn quốc.`;
    } else {
      summaryText = `Đã tra cứu từ khóa [${keywordUsed}] trên Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn) lúc ${thoiGianTraCuu}; ghi nhận đơn giá trúng thầu tham chiếu thấp nhất là ${fmt(selectedPrice)} đ (Mã TBMT: ${selectedRecord.ma_tbmt || '—'}, Danh mục: ${selectedRecord.danh_muc || '—'}). Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${diffPct.toFixed(1)}% (+${fmt(diffAmt)} đ). Tổ Thẩm định đề nghị xem xét tham chiếu giá Mua sắm công để tối ưu chi phí.`;
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
              placeholder="Lọc Tên hàng hóa / Mã TBMT..."
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
                <th className="py-2.5 px-3 border-r">Tên Danh Mục Hàng Hóa (e-GP)</th>
                <th className="py-2.5 px-3 border-r font-mono">Mã TBMT</th>
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
                    <td className="py-2 px-3 border-r">
                      <div className="font-bold text-slate-900">{r.danh_muc || r.ten_hang_hoa || r.ten_vt || '—'}</div>
                    </td>
                    <td className="py-2 px-3 border-r font-mono text-orange-950 font-bold">
                      {r.ma_tbmt || '—'}
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
                    <td className="py-2 px-3 border-r text-slate-700">{r.xuat_xu || '—'}</td>
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
        onSave={() => onSave({ analysis, items: itemsList, selected_record: selectedRecord })}
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

  useEffect(() => {
    setSearchKey(defaultKw);
    setUrlItems(data?.items || []);
    setSelectedIdx(0);
  }, [data, item?.id]);

  // Form input state for adding URL evidence
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle]   = useState(item?.ten_vt || '');
  const [newVendor, setNewVendor] = useState('');
  const [newUrl, setNewUrl]       = useState('');
  const [newPrice, setNewPrice]   = useState('');
  const [newNotes, setNewNotes]   = useState('');

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
    if (!newUrl.trim() && !newVendor.trim()) {
      toast.error('Vui lòng nhập tên nhà cung cấp hoặc đường link URL');
      return;
    }
    const pVal = parseFloat(newPrice) || 0;
    const newItemObj = {
      id: Date.now(),
      search_keyword: searchKey,
      title: newTitle || item?.ten_vt || 'Mục tham khảo',
      vendor: newVendor || 'Website Thương mại điện tử',
      url: newUrl.startsWith('http') ? newUrl : (newUrl ? `https://${newUrl}` : '#'),
      price: pVal,
      date: new Date().toLocaleDateString('vi-VN'),
      notes: newNotes || 'Thông tin niêm yết công khai'
    };
    const updated = [newItemObj, ...urlItems];
    setUrlItems(updated);
    setSelectedIdx(0);
    setShowAddForm(false);
    setNewVendor('');
    setNewUrl('');
    setNewPrice('');
    setNewNotes('');
    toast.success('Đã nạp đường link chứng cứ giá TMĐT!');
  };

  const handleDeleteUrl = (idx) => {
    const updated = urlItems.filter((_, i) => i !== idx);
    setUrlItems(updated);
    if (selectedIdx >= updated.length) setSelectedIdx(Math.max(0, updated.length - 1));
    toast.success('Đã xóa dòng chứng cứ TMĐT');
  };

  const selectedRecord = urlItems[selectedIdx] || urlItems[0];
  const selectedPrice  = selectedRecord ? parseFloat(selectedRecord.price || 0) : 0;
  const diffAmt = dgTrinh - selectedPrice;
  const diffPct = selectedPrice > 0 ? ((dgTrinh - selectedPrice) / selectedPrice * 100) : 0;
  const thoiGianTraCuu = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + new Date().toLocaleDateString('vi-VN');

  let summaryText = '';
  if (urlItems.length > 0 && selectedRecord) {
    if (diffAmt <= 0) {
      summaryText = `Đã tra cứu từ khóa [${searchKey}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${selectedRecord.vendor || 'Internet'}) tại đường link [${selectedRecord.url || 'Web'}] lúc ${thoiGianTraCuu}; ghi nhận mức giá niêm yết công khai là ${fmt(selectedPrice)} đ. Đơn giá trình (${fmt(dgTrinh)} đ) thấp hơn hoặc tương đương đơn giá niêm yết công khai trên Internet.`;
    } else {
      summaryText = `Đã tra cứu từ khóa [${searchKey}] trên thị trường Thương mại điện tử / Website nhà cung cấp (${selectedRecord.vendor || 'Internet'}) tại đường link [${selectedRecord.url || 'Web'}] lúc ${thoiGianTraCuu}; ghi nhận mức giá niêm yết công khai tham chiếu là ${fmt(selectedPrice)} đ. Đơn giá trình (${fmt(dgTrinh)} đ) hiện cao hơn ${diffPct.toFixed(1)}% (+${fmt(diffAmt)} đ) so với đơn giá công khai trên thị trường.`;
    }
  } else {
    summaryText = `Đã tra cứu từ khóa [${searchKey}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`;
  }

  // Trigger autoSave to sync ecom state up to parent view on mount & change
  useEffect(() => {
    if (onAutoSave) {
      onAutoSave({ items: urlItems, selected_record: selectedRecord || null, summary_text: summaryText, search_keyword: searchKey });
    }
  }, [urlItems, selectedIdx, searchKey, summaryText]);

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success('Đã sao chép thuyết minh TMĐT vào clipboard!');
    }
  };

  return (
    <div className="space-y-4">
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
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm URL Chứng Cứ Mới
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

      {/* Form Nạp URL Chứng Cứ Giá Mới */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-xl border-2 border-cyan-400 space-y-3 shadow-md">
          <h5 className="font-bold text-xs text-cyan-900 uppercase flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-cyan-700" /> NẠP CHỨNG CỨ GIÁ TỪ WEBSITE / SÀN TMĐT
          </h5>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-slate-500 font-semibold">Gợi ý sàn/trang web:</span>
            {presetVendors.map((pv, i) => (
              <button
                key={i}
                onClick={() => {
                  setNewVendor(pv.name);
                  if (!newUrl) setNewUrl(`https://${pv.domain}/`);
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
                placeholder="Ví dụ: Misumi Việt Nam, Sieuthithietbi..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đường Link URL Website Giá:</label>
              <input
                type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono text-cyan-950 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Đơn Giá Niêm Yết (VNĐ):</label>
              <input
                type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                placeholder="Nhập số tiền..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-mono font-bold text-cyan-950"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Ghi Chú / Điều Khoản Giá (Bảo hành, VAT, giao hàng):</label>
            <input
              type="text" value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="Ghi chú thêm nếu có..."
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-cyan-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition"
            >
              Hủy
            </button>
            <button
              onClick={handleAddUrl}
              className="px-4 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold transition shadow-xs flex items-center gap-1"
            >
              <Check className="w-4 h-4" /> Đã Kiểm Tra & Lưu Nạp
            </button>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Tham Chiếu Giá TMĐT */}
      {summaryText && (
        <div className="p-4 rounded-xl border-2 border-cyan-300 bg-cyan-50/80 text-slate-900 shadow-sm transition">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-cyan-950">
              <FileText className="w-4 h-4 text-cyan-700" /> 📄 BẢN THUYẾT MINH GIÁ THƯƠNG MẠI ĐIỆN TỬ (TỰ ĐỘNG)
            </h5>
            <button
              onClick={copyToClipboard}
              className="bg-white hover:bg-slate-100 text-cyan-900 border border-cyan-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
            >
              📋 Sao Chép Thuyết Minh TMĐT
            </button>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/80 p-3 rounded-lg border border-cyan-200/80 text-slate-800">
            {summaryText}
          </p>
        </div>
      )}

      {/* Bảng Danh Sách Nguồn Chứng Cứ Giá Web TMĐT */}
      {urlItems.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[950px]">
            <thead className="bg-cyan-50 text-cyan-950 font-bold border-b border-cyan-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-24 text-center">Căn Cứ</th>
                <th className="py-2.5 px-3 border-r w-36">Từ Khóa Tra Cứu</th>
                <th className="py-2.5 px-3 border-r">Tên Vật Tư / Sản Phẩm Web</th>
                <th className="py-2.5 px-3 border-r w-40">Sàn TMĐT / Trang Web</th>
                <th className="py-2.5 px-3 border-r w-32 font-mono bg-cyan-100/50 text-right">Đơn Giá Web</th>
                <th className="py-2.5 px-3 border-r font-mono">Link Kết Quả Tìm Kiếm URL</th>
                <th className="py-2.5 px-3 border-r w-24 text-center">Ngày Tra Cứu</th>
                <th className="py-2.5 px-2 text-center w-14">Xóa</th>
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
                        onClick={() => setSelectedIdx(i)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected ? 'bg-cyan-700 text-white shadow-xs' : 'bg-slate-200 hover:bg-cyan-100 text-slate-700'
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                        {isSelected ? 'Đã Chọn' : 'Chọn'}
                      </button>
                    </td>
                    <td className="py-2 px-3 border-r font-mono">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-950 border border-cyan-300">
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
                    <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-cyan-950 bg-cyan-50/30">
                      {fmt(dg)} đ
                      {diff !== 0 && (
                        <div className={`text-[9.5px] font-bold ${diff > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}% so với trình
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 border-r font-mono text-blue-700 underline truncate max-w-[220px]">
                      <a href={actualSearchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-900" title={actualSearchUrl}>
                        <ExternalLink className="w-3 h-3 shrink-0 text-blue-600" />
                        <span className="truncate">{actualSearchUrl}</span>
                      </a>
                    </td>
                    <td className="py-2 px-3 border-r text-center font-mono text-slate-600">{r.date || '—'}</td>
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
        onSave={() => onSave({ items: urlItems, selected_record: selectedRecord, summary_text: summaryText })}
        nextLabel="Cơ sở 6 (Tổng Hợp)"
        prevLabel="Cơ sở 4 (MSC)"
      />
    </div>
  );
}

// ── Pillar 6: Synthesis & Evaluation (5 Pillars Matrix & Scoring) ──────────────
function PillarSynthesis({ loading, saving, data, dgTrinh, item, quoteEvidence, erpResults, imisResults, mscResults, ecomResults, evidenceStatus, onSave, saved }) {
  const toast = useToast();

  // Extract prices from 5 pillars (live results or saved evidence)
  const p1_price = parseFloat(quoteEvidence?.min_price || quoteEvidence?.min_quote?.don_gia || quoteEvidence?.selected_record?.don_gia || 0);
  const p2_price = parseFloat(erpResults?.selected_record?.don_gia || erpResults?.don_gia_tham_chieu || erpResults?.avg_price || erpResults?.min_price || 0);
  const p3_price = parseFloat(imisResults?.selected_record?.don_gia || imisResults?.don_gia_tham_chieu || imisResults?.avg_price || 0);
  const p4_price = parseFloat(mscResults?.selected_record?.don_gia || mscResults?.don_gia_tham_chieu || mscResults?.min_price || 0);
  const p5_price = parseFloat(ecomResults?.selected_record?.price || ecomResults?.selected_record?.don_gia || ecomResults?.don_gia_tham_chieu || 0);

  // Status checks for 5 pillars
  const has_p1 = Boolean(quoteEvidence?.min_price || quoteEvidence?.matches?.length > 0 || quoteEvidence?.summary_text || evidenceStatus?.has_quotes);
  const has_p2 = Boolean(erpResults?.results?.length > 0 || erpResults?.thoi_gian_luu || erpResults?.summary_text || evidenceStatus?.has_erp);
  const has_p3 = Boolean(imisResults?.imis?.length > 0 || imisResults?.thoi_gian_luu || imisResults?.summary_text || evidenceStatus?.has_imis);
  const has_p4 = Boolean(mscResults?.analysis?.items?.length > 0 || mscResults?.items?.length > 0 || mscResults?.danh_sach_ket_qua?.length > 0 || mscResults?.thoi_gian_luu || mscResults?.summary_text || evidenceStatus?.has_msc);
  const has_p5 = Boolean(ecomResults?.summary_text || ecomResults?.items || ecomResults?.thoi_gian_luu || evidenceStatus?.has_ecom);

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

  // Selection state for final approved price
  const [approvedPrice, setApprovedPrice] = useState(data?.approved_price || (minBaseline > 0 ? minBaseline : dgTrinh));
  const [editingText, setEditingText]     = useState(data?.summary_text || '');

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

  // Auto-generate aggregated justification text with full detailed justification breakdown
  useEffect(() => {
    if (data?.summary_text) {
      setEditingText(data.summary_text);
      return;
    }

    let text = `TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC: ${item?.ten_vt || ''} (Mã ERP: ${item?.ma_vt || '—'}).\n`;
    text += `• Đơn giá trình thẩm định: ${fmt(dgTrinh)} VNĐ (Số lượng: ${qty} ${item?.dvt || 'Cái'}).\n`;
    text += `• Đánh giá Chứng cứ Thẩm định: Đạt ${coverageScore}/100 điểm (${coverageRank} - ${activeCount}/5 cơ sở chứng cứ đã nạp).\n`;
    text += `• Đánh giá Mức độ Hợp lý Đơn giá: ${priceScore}/100 điểm (${priceEval}).\n\n`;

    text += `CƠ SỞ THẨM ĐỊNH THỐNG NHẤT 5 CƠ SỞ CHỨNG CỨ:\n`;

    // 1. Cơ sở 1: Báo Giá Gốc
    let p1_desc = '';
    if (p1_price > 0) {
      const supplierName = quoteEvidence?.min_quote?.company || quoteEvidence?.matched_supplier?.company || 'Nhà thầu chào trong Hồ sơ trình';
      const pageNum = quoteEvidence?.min_quote?.page || quoteEvidence?.min_quote?.stt || 1;
      p1_desc = `Đã đối chiếu các báo giá thương mại cạnh tranh trong Hồ sơ trình; ghi nhận đơn giá chào thấp nhất là ${fmt(p1_price)} VNĐ/Cái từ ${supplierName} (Trang ${pageNum} Báo giá); đơn giá chào đối chiếu ${p1_price === dgTrinh ? 'khớp 100% với đơn giá dự toán trình' : p1_price < dgTrinh ? `thấp hơn ${fmt(dgTrinh - p1_price)} VNĐ/Cái so với đơn giá trình` : `cao hơn đơn giá trình`}.`;
    } else if (has_p1) {
      p1_desc = `Đã đối chiếu hồ sơ báo giá gốc trình thẩm định; ghi nhận các báo giá thương mại kèm theo đầy đủ hợp lệ.`;
    } else {
      p1_desc = `Chưa nạp dữ liệu báo giá thương mại cạnh tranh trong Hồ sơ trình.`;
    }
    text += `- Cơ sở 1 (Báo Giá Gốc): ${p1_desc}\n`;

    // 2. Cơ sở 2: ERP Vĩnh Tân 4
    let p2_desc = '';
    if (p2_price > 0) {
      const rec = erpResults?.selected_record || erpResults?.results?.[0];
      const poInfo = rec?.so_hd ? ` theo HĐ/PO ${rec.so_hd}` : '';
      const dateInfo = rec?.ngay_hd || rec?.nam_nhap ? ` năm ${rec.nam_nhap || rec.ngay_hd}` : '';
      p2_desc = `Tra cứu mã VT/từ khóa [${item?.ma_vt || item?.ten_vt || ''}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; ghi nhận đơn giá nhập kho gần nhất là ${fmt(p2_price)} VNĐ/Cái${poInfo}${dateInfo}.`;
    } else if (has_p2) {
      p2_desc = `Tra cứu mã VT [${item?.ma_vt || '—'}] / từ khóa [${item?.ten_vt || ''}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; ghi nhận đây là vật tư mới, chưa từng có lịch sử nhập kho nội bộ nhà máy Vĩnh Tân 4.`;
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
      p3_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); ghi nhận đơn giá trúng thầu/hợp đồng tham chiếu là ${fmt(p3_price)} VNĐ/Cái${dvInfo}${hdInfo}.`;
    } else if (has_p3) {
      p3_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); ghi nhận không có dữ liệu hợp đồng mua sắm vật tư tương tự từ các Đơn vị Phát điện toàn Tập đoàn EVN.`;
    } else {
      p3_desc = `Chưa đối chiếu CSDL Hợp đồng mua sắm toàn ngành EVN IMIS.`;
    }
    text += `- Cơ sở 3 (EVN IMIS): ${p3_desc}\n`;

    // 4. Cơ sở 4: Mua Sắm Công e-GP
    let p4_desc = '';
    if (p4_price > 0) {
      const rec = mscResults?.selected_record || mscResults?.analysis?.items?.[0] || mscResults?.items?.[0];
      const vendorInfo = rec?.hang_sx || rec?.nhà_thầu ? ` (Nhà thầu ${rec.hang_sx || rec.nhà_thầu})` : '';
      p4_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); ghi nhận đơn giá trúng thầu công khai tham chiếu là ${fmt(p4_price)} VNĐ/Cái${vendorInfo}.`;
    } else if (has_p4) {
      p4_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); ghi nhận vật tư thuộc nhóm hàng đặc thù không có kết quả trúng thầu công khai tương tự trên Hệ thống e-GP.`;
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
      p5_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên thị trường TMĐT / Website nhà cung cấp (${rec?.vendor || 'Internet'}) tại link [${rec?.url || 'Web'}]; ghi nhận đơn giá niêm yết công khai tham chiếu là ${fmt(p5_price)} VNĐ/Cái.`;
    } else {
      p5_desc = `Tra cứu từ khóa [${item?.ten_vt || ''}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`;
    }
    text += `- Cơ sở 5 (Thương Mại Điện Tử): ${p5_desc}\n`;

    if (totalSavings > 0) {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đề xuất duyệt đơn giá thẩm định thống nhất là ${fmt(approvedPrice)} VNĐ/Cái. Tiết kiệm dự toán ${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%).`;
    } else {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đơn giá trình phù hợp với mặt bằng giá thị trường. Đề xuất phê duyệt giữ nguyên đơn giá trình là ${fmt(approvedPrice)} VNĐ/Cái.`;
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

  const handleExportPdf = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Vui lòng cho phép popup trình duyệt để mở giao diện in PDF!');
      return;
    }
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Báo Cáo Thẩm Định - ${item?.ten_vt || ''}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.4; color: #000; margin: 0; padding: 20px; }
          h2 { font-size: 15pt; font-weight: bold; text-align: center; text-transform: uppercase; margin-top: 15px; margin-bottom: 15px; }
          h3 { font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 3px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
          th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .header-table { width: 100%; border: none; margin-bottom: 20px; }
          .header-table td { border: none; padding: 0; }
          .pre-text { font-family: 'Times New Roman', serif; white-space: pre-wrap; font-size: 11pt; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; margin-top: 5px; }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 10px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #003366; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">🖨️ In / Lưu PDF Ngay</button>
        </div>
        <table class="header-table">
          <tr>
            <td style="width: 45%; text-align: center;">
              <strong>NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4</strong><br/>
              <b>TỔ THẨM ĐỊNH DỰ TOÁN</b><br/>
              -------------
            </td>
            <td style="width: 55%; text-align: center;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <b>Độc lập - Tự do - Hạnh phúc</b><br/>
              -----------------------
            </td>
          </tr>
        </table>

        <h2>BÁO CÁO TỔNG HỢP KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ VẬT TƯ</h2>

        <p>
          <strong>Tên vật tư:</strong> ${item?.ten_vt || '—'}<br/>
          <strong>Mã VT (ERP):</strong> ${item?.ma_vt || '—'} &nbsp;|&nbsp; <strong>Số lượng:</strong> ${qty} ${item?.dvt || 'Cái'}<br/>
          <strong>Đơn giá trình thẩm định:</strong> ${fmt(dgTrinh)} VNĐ
        </p>

        <h3>I. ĐÁNH GIÁ CHỨNG CỨ THẨM ĐỊNH (5 CƠ SỞ CHỨNG CỨ)</h3>
        <p>
          - Điểm số phủ chứng cứ: <strong>${coverageScore}/100 điểm</strong> (${coverageRank} - ${activeCount}/5 Cơ sở chứng cứ đã nạp).<br/>
          - Điểm số hợp lý đơn giá trình: <strong>${priceScore}/100 điểm</strong> (${priceEval}).
        </p>

        <table>
          <thead>
            <tr>
              <th>Cơ Sở Chứng Cứ Thẩm Định</th>
              <th style="text-align: right;">Đơn Giá Tham Chiếu</th>
              <th style="text-align: center;">% Lệch vs Trình</th>
              <th>Trạng Thái Chứng Cứ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Đơn Giá Dự Toán Trình</strong></td>
              <td style="text-align: right;"><strong>${fmt(dgTrinh)} VNĐ</strong></td>
              <td style="text-align: center;">0.0%</td>
              <td>Mốc dự toán lập</td>
            </tr>
            ${pillarsList.map(p => `
              <tr>
                <td>${p.name}</td>
                <td style="text-align: right;">${p.price > 0 ? `${fmt(p.price)} VNĐ` : '—'}</td>
                <td style="text-align: center;">${p.price > 0 ? `${((p.price - dgTrinh)/dgTrinh*100).toFixed(1)}%` : '—'}</td>
                <td>${p.has ? 'Đã nạp chứng cứ' : 'Chưa nạp dữ liệu'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>II. BẢN THUYẾT MINH THẨM ĐỊNH THỐNG NHẤT</h3>
        <div class="pre-text">${editingText}</div>

        <h3>III. KẾT LUẬN & ĐỀ XUẤT PHÊ DUYỆT</h3>
        <p>
          - <strong>Đơn giá phê duyệt đề xuất:</strong> <strong style="color: #003366; font-size: 13pt;">${fmt(approvedPrice)} VNĐ / ${item?.dvt || 'Cái'}</strong><br/>
          - <strong>Tổng tiết kiệm dự toán:</strong> <strong>${totalSavings > 0 ? `${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%)` : '0 VNĐ (Giữ nguyên giá trình)'}</strong>
        </p>

        <table class="header-table" style="margin-top: 40px;">
          <tr>
            <td style="width: 50%; text-align: center;">
              <strong>CHUYÊN VIÊN THẨM ĐỊNH</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
            </td>
            <td style="width: 50%; text-align: center;">
              <strong>LÃNH ĐẠO PHÊ DUYỆT</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
    printWin.document.write(printHtml);
    printWin.document.close();
  };

  const handleFinalApprove = () => {
    onSave({
      approved_price: approvedPrice,
      total_savings: totalSavings,
      coverage_score: coverageScore,
      price_score: priceScore,
      summary_text: editingText
    });
    toast.success('✨ Đã lưu & Phê duyệt Kết quả Thẩm định Mục!');
  };

  const pillarsList = [
    { key: 'p1', name: 'Cơ sở 1: Báo Giá Gốc', price: p1_price, has: has_p1 },
    { key: 'p2', name: 'Cơ sở 2: ERP Vĩnh Tân 4', price: p2_price, has: has_p2 },
    { key: 'p3', name: 'Cơ sở 3: EVN IMIS', price: p3_price, has: has_p3 },
    { key: 'p4', name: 'Cơ sở 4: Mua Sắm Công e-GP', price: p4_price, has: has_p4 },
    { key: 'p5', name: 'Cơ sở 5: Thương Mại Điện Tử', price: p5_price, has: has_p5 },
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
              <th className="py-2.5 px-3 border-r">Cơ Sở Chứng Cứ Thẩm Định</th>
              <th className="py-2.5 px-3 border-r w-36 text-right font-mono">Đơn Giá Tham Chiếu</th>
              <th className="py-2.5 px-3 border-r w-32 text-center">Chênh Lệch % vs Trình</th>
              <th className="py-2.5 px-3 border-r text-center">Đánh Giá Độ Phù Hợp</th>
              <th className="py-2.5 px-3 w-28 text-center">Trạng Thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100/80 font-bold">
              <td className="py-2 px-3 border-r text-slate-900">📋 ĐƠN GIÁ DỰ TOÁN TRÌNH THẨM ĐỊNH</td>
              <td className="py-2 px-3 border-r text-right font-mono text-blue-950 font-black">{fmt(dgTrinh)} đ</td>
              <td className="py-2 px-3 border-r text-center font-mono text-slate-500">0.0% (Gốc)</td>
              <td className="py-2 px-3 border-r text-center text-slate-700">Mốc dự toán lập</td>
              <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">Gốc Trình</span></td>
            </tr>

            {pillarsList.map((p) => {
              const dg = p.price;
              const diff = (dgTrinh > 0 && dg > 0) ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
              const isLower = dg > 0 && dg < dgTrinh;
              return (
                <tr key={p.key} className="hover:bg-slate-50/80 text-[11px]">
                  <td className="py-2 px-3 border-r font-bold text-slate-800 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${p.has ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {p.name}
                  </td>
                  <td className="py-2 px-3 border-r text-right font-mono font-extrabold text-slate-900">
                    {dg > 0 ? `${fmt(dg)} đ` : '—'}
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

      {/* Bản Thuyết Minh Tổng Hợp 5 Cơ Sở */}
      <div className="p-4 rounded-xl border-2 border-teal-400 bg-white text-slate-900 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-teal-950">
            <FileText className="w-4 h-4 text-teal-700" /> 📄 BẢN THUYẾT MINH TỔNG HỢP THẨM ĐỊNH (BIÊN SOẠN TỰ ĐỘNG 5 CƠ SỞ)
          </h5>
          <div className="flex items-center gap-2">
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
            <button
              onClick={handleExportPdf}
              className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
            >
              🖨️ Xuất / In PDF
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
