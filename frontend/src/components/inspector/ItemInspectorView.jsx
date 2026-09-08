import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../ui/Toast.jsx';
import { PILLARS } from './constants/pillars.js';
import { extractCleanImisKeyword, getDefaultImisKeyword } from './utils/keywordHelpers.js';
import InspectorNavbar from './coordinator/InspectorNavbar.jsx';
import InspectorSidebar from './coordinator/InspectorSidebar.jsx';
import InspectorOverviewCard from './coordinator/InspectorOverviewCard.jsx';
import InspectorPillarTabs from './coordinator/InspectorPillarTabs.jsx';
import {
  PillarQuotes,
  PillarErp,
  PillarImis,
  PillarMsc,
  PillarEcom,
  PillarSynthesis
} from './pillars';
import ErrorBoundary from '../common/ErrorBoundary.jsx';

export default function ItemInspectorView({ selectedIndex, onNavigateIndex, onOpenPdfPage, onOpenErpConfig, onOpenImisConfig, onOpenMscConfig, imisStatus, mscStatus }) {
  const toast = useToast();
  const [activePillar, setActivePillar] = useState('quotes');
  const [items, setItems] = useState([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [evidenceStatus, setEvidenceStatus] = useState({});

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
  useEffect(() => {
    if (!currentItem?.id) return;
    const itemId = currentItem.id;
    if (!itemId || itemId <= 0) return;

    setQuoteEvidence(null);
    setErpResults(null);
    setImisResults(null);
    setMscResults(null);
    setEcomResults(null);
    setSynthesisResults(null);

    const pillars = ['quotes', 'erp', 'imis', 'muasamcong', 'ecom', 'synthesis'];
    pillars.forEach(p => {
      fetch(`/api/items/${itemId}/evidence/${p}`)
        .then(r => {
          if (!r.ok) return null;
          return r.json();
        })
        .then(d => {
          if (!d || (!d.data && !d.payload && !d.success)) return;
          const payload = d.data || d.payload || {};
          if (!payload || Object.keys(payload).length === 0) return;
          if (p === 'quotes')      setQuoteEvidence(payload);
          if (p === 'erp')         setErpResults(payload);
          if (p === 'imis')        setImisResults(payload);
          if (p === 'muasamcong')  setMscResults(payload);
          if (p === 'ecom')        setEcomResults(payload);
          if (p === 'synthesis')   setSynthesisResults(payload);
        })
        .catch(() => {});
    });
  }, [selectedIndex, currentItem?.id]);

  // Pillar 1: Load quotes
  const loadQuotes = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading(l => ({ ...l, quotes: true }));
    try {
      const res = await fetch(`/api/quotes/by-item?item_id=${currentItem.id || selectedIndex + 1}`);
      const data = await res.json();
      setQuoteEvidence(data);
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, quotes: false })); }
  }, [currentItem, selectedIndex]);

  // Pillar 2: Load ERP
  const loadErp = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading(l => ({ ...l, erp: true }));
    try {
      const res = await fetch('/api/erp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: currentItem.ma_vt || currentItem.ten_vt,
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0
        })
      });
      const data = await res.json();
      setErpResults(data);
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, erp: false })); }
  }, [currentItem]);

  // Pillar 3: Load IMIS
  const loadImis = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading(l => ({ ...l, imis: true }));
    try {
      const cleanKw = getDefaultImisKeyword(currentItem.ten_vt) || extractCleanImisKeyword(currentItem.ten_vt) || currentItem.ten_vt;
      const res = await fetch('/api/imis/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: cleanKw,
          item: currentItem,
          tu_ngay: '2023-01-01',
          den_ngay: new Date().toISOString().split('T')[0],
          dg_trinh: currentItem.don_gia_trinh || 0
        })
      });
      const data = await res.json();
      setImisResults(data);
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, imis: false })); }
  }, [currentItem]);

  // Pillar 4: Load MSC
  const loadMsc = useCallback(async () => {
    if (!currentItem?.ten_vt) return;
    setLoading(l => ({ ...l, msc: true }));
    try {
      const defaultKw = getDefaultImisKeyword(currentItem.ten_vt) || extractCleanImisKeyword(currentItem.ten_vt) || currentItem.ten_vt;
      const res = await fetch('/api/muasamcong/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: defaultKw,
          item: currentItem,
          dg_trinh: currentItem.don_gia_trinh || 0
        })
      });
      const data = await res.json();
      setMscResults(data);
    } catch (e) { console.error(e); }
    finally { setLoading(l => ({ ...l, msc: false })); }
  }, [currentItem]);

  // Trigger search when pillar tab is opened if no data
  useEffect(() => {
    if (!currentItem?.ten_vt) return;
    if (activePillar === 'quotes' && !quoteEvidence) loadQuotes();
    if (activePillar === 'erp' && !erpResults) loadErp();
    if (activePillar === 'imis' && !imisResults) loadImis();
    if (activePillar === 'msc' && !mscResults) loadMsc();
  }, [activePillar, currentItem?.id, selectedIndex]);

  // Save evidence for a step
  const saveStep = async (stepKey, payload, nextPillar = null) => {
    const itemId = currentItem.id || selectedIndex + 1;
    setSaving(true);
    try {
      const res = await fetch(`/api/items/${itemId}/evidence/${stepKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const ret = await res.json();
      if (ret.success || ret.ok) {
        toast?.success?.(`Đã lưu chứng cứ ${stepKey.toUpperCase()} cho mục ${selectedIndex + 1}!`);
        await loadAllEvidenceStatus();
        if (nextPillar) {
          setActivePillar(nextPillar);
        }
      } else {
        toast?.error?.(`Lỗi lưu: ${ret.error || 'Không xác định'}`);
      }
    } catch (e) {
      toast?.error?.(`Lỗi kết nối: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const autoSaveStep = useCallback(async (stepKey, payload) => {
    const itemId = currentItem.id || selectedIndex + 1;
    try {
      await fetch(`/api/items/${itemId}/evidence/${stepKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      loadAllEvidenceStatus();
    } catch (e) {
      console.warn(`[AutoSave] Không thể lưu ngầm ${stepKey}:`, e);
    }
  }, [currentItem.id, selectedIndex, loadAllEvidenceStatus]);

  const switchPillar = (pk) => {
    setActivePillar(pk);
    const ev = evidenceStatus[String(currentItem?.id || selectedIndex + 1)] || {};
    const isSaved = pk === 'quotes' ? ev.has_quotes : pk === 'erp' ? ev.has_erp : pk === 'imis' ? ev.has_imis : pk === 'msc' ? ev.has_msc : pk === 'ecom' ? ev.has_ecom : ev.has_syn;
    if (!isSaved) {
      if (pk === 'quotes' && !quoteEvidence) loadQuotes();
      if (pk === 'erp' && !erpResults) loadErp();
      if (pk === 'imis' && !imisResults) loadImis();
      if (pk === 'msc' && !mscResults) loadMsc();
    }
  };

  // Keyboard navigation: Shift+A = Prev, Shift+D = Next
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        if (selectedIndex > 0) onNavigateIndex(selectedIndex - 1);
      } else if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        if (selectedIndex < items.length - 1) onNavigateIndex(selectedIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, items.length, onNavigateIndex]);

  // Derived info
  const dgTrinh = currentItem.don_gia_trinh || currentItem.dg_trinh || 0;
  const evSt = evidenceStatus[String(currentItem.id || selectedIndex + 1)] || {};

  const minQuote = quoteEvidence?.min_quote || quoteEvidence?.matches?.[0] || null;
  const supplierMatches = quoteEvidence?.matches || [];

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
      <InspectorNavbar
        selectedIndex={selectedIndex}
        totalItems={items.length}
        currentItem={currentItem}
        onNavigateIndex={onNavigateIndex}
        onExportPdf={handleExportPdf}
      />

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <InspectorSidebar
          items={items}
          filteredItems={filteredItems}
          selectedIndex={selectedIndex}
          sidebarSearch={sidebarSearch}
          setSidebarSearch={setSidebarSearch}
          evidenceStatus={evidenceStatus}
          onNavigateIndex={onNavigateIndex}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col p-4 overflow-y-auto bg-slate-100 gap-3">
          {/* Overview Card */}
          <InspectorOverviewCard
            currentItem={currentItem}
            dgTrinh={dgTrinh}
          />

          {/* Pillar Tabs */}
          <InspectorPillarTabs
            activePillar={activePillar}
            onSwitchPillar={switchPillar}
            evSt={evSt}
          />

          {/* Pillar Content */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1">
            <ErrorBoundary key={`${activePillar}_${currentItem?.id || selectedIndex}`} title={`Lỗi hiển thị Khối ${PILLARS[activePillar]?.title || activePillar}`}>
              {activePillar === 'quotes' && (
                <PillarQuotes
                  loading={loading.quotes} saving={saving}
                  minQuote={minQuote} supplierMatches={supplierMatches}
                  dgTrinh={dgTrinh} onOpenPdfPage={onOpenPdfPage}
                  onSave={() => saveStep('quotes', { min_quote: minQuote, matches: supplierMatches }, 'erp')}
                  saved={evSt.has_quotes}
                />
              )}

              {activePillar === 'erp' && (
                <PillarErp
                  loading={loading.erp} saving={saving}
                  data={erpResults} dgTrinh={dgTrinh} item={currentItem}
                  onSave={(payload) => saveStep('erp', payload, 'imis')}
                  onAutoSave={(payload) => autoSaveStep('erp', payload)}
                  saved={evSt.has_erp}
                  onOpenErpConfig={onOpenErpConfig}
                />
              )}

              {activePillar === 'imis' && (
                <PillarImis
                  loading={loading.imis} saving={saving}
                  data={imisResults} dgTrinh={dgTrinh} item={currentItem}
                  onSave={(payload) => saveStep('imis', payload, 'muasamcong')}
                  onAutoSave={(payload) => autoSaveStep('imis', payload)}
                  saved={evSt.has_imis}
                  onOpenImisConfig={onOpenImisConfig}
                  imisStatus={imisStatus}
                />
              )}

              {activePillar === 'msc' && (
                <PillarMsc
                  loading={loading.msc} saving={saving}
                  data={mscResults} dgTrinh={dgTrinh} item={currentItem}
                  onSave={(payload) => saveStep('muasamcong', payload, 'ecom')}
                  onAutoSave={(payload) => autoSaveStep('muasamcong', payload)}
                  saved={evSt.has_msc}
                  onOpenMscConfig={onOpenMscConfig}
                  mscStatus={mscStatus}
                />
              )}

              {activePillar === 'ecom' && (
                <PillarEcom
                  loading={loading.ecom} saving={saving}
                  data={ecomResults} dgTrinh={dgTrinh} item={currentItem}
                  onSave={(payload, goNext = true) => saveStep('ecom', payload, goNext ? 'synthesis' : null)}
                  saved={evSt.has_ecom}
                  onAutoSave={(payload) => autoSaveStep('ecom', payload)}
                />
              )}

              {activePillar === 'synthesis' && (
                <PillarSynthesis
                  loading={false} saving={saving}
                  data={synthesisResults}
                  dgTrinh={dgTrinh} item={currentItem}
                  quoteEvidence={quoteEvidence} erpResults={erpResults}
                  imisResults={imisResults} mscResults={mscResults}
                  ecomResults={ecomResults} evidenceStatus={evSt}
                  onSave={(payload) => saveStep('synthesis', payload, null)}
                  saved={evSt.has_syn}
                />
              )}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
