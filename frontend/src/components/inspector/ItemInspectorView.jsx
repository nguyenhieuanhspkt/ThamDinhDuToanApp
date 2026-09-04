import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, FileCheck2, Building2, Network, Globe,
  ExternalLink, CheckCircle, AlertTriangle, FileText, Award,
  Loader2, Save, ArrowRight, ArrowLeft, ShieldCheck, ShieldAlert
} from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (val) => (!val && val !== 0 ? '0' : Math.round(val).toLocaleString('vi-VN'));

const PILLAR_CFG = {
  quotes: { key: 'quotes', label: '1. Báo Giá Gốc',  color: 'emerald', icon: FileCheck2,  saveKey: 'quotes'       },
  erp:    { key: 'erp',    label: '2. ERP Vĩnh Tân 4',color: 'blue',    icon: Building2,  saveKey: 'erp'          },
  imis:   { key: 'imis',   label: '3. EVN IMIS',      color: 'purple',  icon: Network,    saveKey: 'imis'         },
  msc:    { key: 'msc',    label: '4. Mua Sắm Công',  color: 'orange',  icon: Globe,      saveKey: 'muasamcong'   },
};
const PILLARS = ['quotes', 'erp', 'imis', 'msc'];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ItemInspectorView({ selectedIndex, onNavigateIndex, onOpenPdfPage }) {
  const toast = useToast();
  const [activePillar, setActivePillar] = useState('quotes');
  const [items, setItems] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState({}); // { itemId: { has_quotes, has_erp, ... } }

  // Per-pillar data
  const [quoteEvidence, setQuoteEvidence]   = useState(null);
  const [erpResults, setErpResults]         = useState(null);
  const [imisResults, setImisResults]       = useState(null);
  const [mscResults, setMscResults]         = useState(null);

  // Loading states
  const [loading, setLoading] = useState({ quotes: false, erp: false, imis: false, msc: false });
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

  // Reset pillar data when item changes
  useEffect(() => {
    setQuoteEvidence(null);
    setErpResults(null);
    setImisResults(null);
    setMscResults(null);
    setActivePillar('quotes');
  }, [selectedIndex]);

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
      .then(d => setQuoteEvidence(d))
      .catch(console.error)
      .finally(() => setLoading(p => ({ ...p, quotes: false })));
  }, [currentItem?.id]);

  // Load on-demand for pillars 2/3/4
  const loadErp = useCallback(async () => {
    if (erpResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, erp: true }));
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentItem.ten_vt, ma_vt: currentItem.ma_vt || '' })
      });
      setErpResults(await res.json());
    } catch (e) { toast.error('Lỗi kết nối ERP'); }
    finally { setLoading(p => ({ ...p, erp: false })); }
  }, [erpResults, currentItem]);

  const loadImis = useCallback(async () => {
    if (imisResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, imis: true }));
    try {
      const res = await fetch('/api/search-item-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentItem.ten_vt, tu_ngay: '2023-01-01' })
      });
      const data = await res.json();
      setImisResults(data);
    } catch (e) { toast.error('Lỗi kết nối IMIS'); }
    finally { setLoading(p => ({ ...p, imis: false })); }
  }, [imisResults, currentItem]);

  const loadMsc = useCallback(async () => {
    if (mscResults || !currentItem?.ten_vt) return;
    setLoading(p => ({ ...p, msc: true }));
    try {
      const res = await fetch('/api/msc/search-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentItem.ten_vt })
      });
      setMscResults(await res.json());
    } catch (e) { toast.error('Lỗi kết nối Mua Sắm Công'); }
    finally { setLoading(p => ({ ...p, msc: false })); }
  }, [mscResults, currentItem]);

  // Activate pillar with lazy load
  const switchPillar = (pk) => {
    setActivePillar(pk);
    if (pk === 'erp')  loadErp();
    if (pk === 'imis') loadImis();
    if (pk === 'msc')  loadMsc();
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
              const doneCount = [stBadge.has_quotes, stBadge.has_erp, stBadge.has_imis, stBadge.has_msc].filter(Boolean).length;
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
                  {/* 4-pillar mini badges */}
                  <div className="flex items-center gap-0.5 mt-1">
                    {[
                      { k: 'has_quotes', lbl: 'BG',  col: stBadge.has_quotes ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-gray-100 text-gray-400' },
                      { k: 'has_erp',    lbl: 'ERP', col: stBadge.has_erp    ? 'bg-blue-100 text-blue-800 border-blue-300'     : 'bg-gray-100 text-gray-400' },
                      { k: 'has_imis',   lbl: 'IMIS',col: stBadge.has_imis   ? 'bg-purple-100 text-purple-800 border-purple-300': 'bg-gray-100 text-gray-400' },
                      { k: 'has_msc',    lbl: 'MSC', col: stBadge.has_msc    ? 'bg-orange-100 text-orange-800 border-orange-300': 'bg-gray-100 text-gray-400' },
                    ].map(b => (
                      <span key={b.k} className={`text-[8px] px-1 rounded border font-bold ${b.col}`}>{stBadge[b.k] ? '✓' : ''}{b.lbl}</span>
                    ))}
                    <span className={`text-[8px] font-mono ml-auto font-bold ${doneCount === 4 ? 'text-emerald-700' : doneCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>{doneCount}/4</span>
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
              const saved = pk === 'quotes' ? evSt.has_quotes : pk === 'erp' ? evSt.has_erp : pk === 'imis' ? evSt.has_imis : evSt.has_msc;
              return (
                <button
                  key={pk}
                  onClick={() => switchPillar(pk)}
                  className={`flex-1 py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 relative ${
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
              />
            )}
            {/* ── PILLAR 3: IMIS ── */}
            {activePillar === 'imis' && (
              <PillarImis
                loading={loading.imis} saving={saving}
                data={imisResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={() => saveStep('imis', { imis: imisResults?.imis || [], erp: imisResults?.erp || [], keyword: currentItem.ten_vt }, 'msc')}
                saved={evSt.has_imis}
              />
            )}
            {/* ── PILLAR 4: MSC ── */}
            {activePillar === 'msc' && (
              <PillarMsc
                loading={loading.msc} saving={saving}
                data={mscResults} dgTrinh={dgTrinh} item={currentItem}
                onSave={() => saveStep('muasamcong', { results: mscResults?.results || [], keyword: currentItem.ten_vt }, null)}
                saved={evSt.has_msc}
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
      <SaveFooter saving={saving} saved={saved} onSave={onSave} nextLabel="Khối 2 (ERP)" />
    </div>
  );
}

// ── Pillar 2: ERP ─────────────────────────────────────────────────────────────
function PillarErp({ loading, saving, data, dgTrinh, item, onSave, saved }) {
  const results = data?.results || [];
  return (
    <div className="space-y-4">
      <PillarHeader icon={Building2} color="blue" title="KHỐI 2: LỊCH SỬ MUA SẮM ERP VĨNH TÂN 4" loading={loading} />
      {loading ? <LoadingSpinner /> : results.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-blue-50 text-blue-900 font-bold border-b">
              <tr>
                <th className="py-2 px-3 border-r">Mã ERP / Tên Vật Tư</th>
                <th className="py-2 px-3 border-r w-28 text-right font-mono">Đơn Giá</th>
                <th className="py-2 px-3 border-r w-24">Năm</th>
                <th className="py-2 px-3 w-32">Đơn Hàng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((r, i) => {
                const diff = dgTrinh > 0 ? ((r.don_gia - dgTrinh) / dgTrinh * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-blue-50/30 transition">
                    <td className="py-2 px-3 border-r">
                      <div className="font-bold text-slate-900">{r.ten_vt || r.ma_vt}</div>
                      <div className="font-mono text-slate-500 text-[10px]">{r.ma_vt}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold border-r text-blue-900">
                      {fmt(r.don_gia)} đ
                      {diff !== 0 && <div className={`text-[10px] ${diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</div>}
                    </td>
                    <td className="py-2 px-3 border-r text-slate-700">{r.nam || r.thang_nam || '—'}</td>
                    <td className="py-2 px-3 text-slate-600 font-mono text-[10px]">{r.so_phieu || r.ma_don_hang || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : data !== null ? (
        <EmptyState text="Không tìm thấy lịch sử mua sắm ERP cho mục này." />
      ) : (
        <EmptyState text="Nhấn vào tab ERP để tra cứu lịch sử mua sắm..." />
      )}
      <SaveFooter saving={saving} saved={saved} onSave={onSave} nextLabel="Khối 3 (IMIS)" prevLabel="Khối 1 (BG)" />
    </div>
  );
}

// ── Pillar 3: IMIS ────────────────────────────────────────────────────────────
function PillarImis({ loading, saving, data, dgTrinh, item, onSave, saved }) {
  const imisRows = data?.imis || [];
  const erpRows  = data?.erp || [];
  const allRows  = [...imisRows, ...erpRows];
  return (
    <div className="space-y-4">
      <PillarHeader icon={Network} color="purple" title="KHỐI 3: HỆ THỐNG EVN IMIS (CÁC ĐƠN VỊ PHÁT ĐIỆN)" loading={loading} />
      {loading ? <LoadingSpinner /> : allRows.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-purple-50 text-purple-900 font-bold border-b">
              <tr>
                <th className="py-2 px-3 border-r">Tên Vật Tư</th>
                <th className="py-2 px-3 border-r">Nguồn</th>
                <th className="py-2 px-3 border-r w-32 text-right font-mono">Đơn Giá</th>
                <th className="py-2 px-3 w-24">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allRows.map((r, i) => {
                const dg = r.don_gia || r.gia || 0;
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-purple-50/30 transition">
                    <td className="py-2 px-3 border-r text-slate-900">{r.ten_vt || r.mo_ta || '—'}</td>
                    <td className="py-2 px-3 border-r">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${r.nguon === 'erp' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                        {r.nguon || 'IMIS'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold border-r text-purple-900">
                      {fmt(dg)} đ
                      {diff !== 0 && <div className={`text-[10px] ${diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</div>}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{r.thang_nam || r.nam || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : data !== null ? (
        <EmptyState text="Không tìm thấy dữ liệu IMIS tương đương." />
      ) : (
        <EmptyState text="Nhấn vào tab IMIS để tra cứu toàn ngành EVN..." />
      )}
      <SaveFooter saving={saving} saved={saved} onSave={onSave} nextLabel="Khối 4 (MSC)" prevLabel="Khối 2 (ERP)" />
    </div>
  );
}

// ── Pillar 4: MSC ─────────────────────────────────────────────────────────────
function PillarMsc({ loading, saving, data, dgTrinh, item, onSave, saved }) {
  const results = data?.results || [];
  const mscStatus = data?.msc_status;
  return (
    <div className="space-y-4">
      <PillarHeader icon={Globe} color="orange" title="KHỐI 4: CỔNG MUA SẮM CÔNG QUỐC GIA (e-GP)" loading={loading} />
      {mscStatus && !mscStatus.active && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><strong>Phiên Mua Sắm Công chưa kết nối.</strong> Vào tab Khối 4 trong giao diện cũ để dán chuỗi cURL mới nhất từ Chrome DevTools.</div>
        </div>
      )}
      {loading ? <LoadingSpinner /> : results.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-orange-50 text-orange-900 font-bold border-b">
              <tr>
                <th className="py-2 px-3 border-r">Tên Hàng Hóa</th>
                <th className="py-2 px-3 border-r">Đơn Vị Mời Thầu</th>
                <th className="py-2 px-3 border-r w-32 text-right font-mono">Giá Trúng Thầu</th>
                <th className="py-2 px-3 w-24">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {results.map((r, i) => {
                const dg = r.don_gia || r.gia_trung_thau || 0;
                const diff = dgTrinh > 0 ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
                return (
                  <tr key={i} className="hover:bg-orange-50/30 transition">
                    <td className="py-2 px-3 border-r text-slate-900">{r.ten_hang_hoa || r.ten_vt || '—'}</td>
                    <td className="py-2 px-3 border-r text-slate-700">{r.ten_don_vi || r.chu_dau_tu || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold border-r text-orange-900">
                      {fmt(dg)} đ
                      {diff !== 0 && <div className={`text-[10px] ${diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</div>}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{r.ngay_trung_thau || r.nam || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : data !== null ? (
        <EmptyState text="Không tìm thấy kết quả Mua Sắm Công e-GP." />
      ) : (
        <EmptyState text="Nhấn vào tab Mua Sắm Công để tra cứu đấu thầu qua mạng..." />
      )}
      <SaveFooter saving={saving} saved={saved} onSave={onSave} nextLabel={null} prevLabel="Khối 3 (IMIS)" isFinal />
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
        {isFinal ? '✨ Lưu & Tổng Hợp 4 Khối' : `💾 Lưu & Đi Tiếp ${nextLabel || ''}`}
        {!isFinal && <ArrowRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
