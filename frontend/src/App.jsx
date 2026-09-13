import React, { useState, useEffect } from 'react';
import HeaderNav from './components/HeaderNav.jsx';
import QuotesWorkspace from './components/workspace/QuotesWorkspace.jsx';
import GridMatrixView from './components/grid/GridMatrixView.jsx';
import ItemInspectorView from './components/inspector/ItemInspectorView.jsx';
import ProjectManagerModal from './components/modals/ProjectManagerModal.jsx';
import ERPConfigModal from './components/modals/ERPConfigModal.jsx';
import IMISConfigModal from './components/modals/IMISConfigModal.jsx';
import MSCConfigModal from './components/modals/MSCConfigModal.jsx';
import SaveAsModal from './components/modals/SaveAsModal.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { useToast } from './components/ui/Toast.jsx';
import { AlertTriangle, Database, X } from 'lucide-react';

export default function App() {
  const toast = useToast();
  const [activeView, setActiveView] = useState('grid');
  const [inspectorIndex, setInspectorIndex] = useState(0);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [isErpConfigOpen, setIsErpConfigOpen] = useState(false);
  const [isImisConfigOpen, setIsImisConfigOpen] = useState(false);
  const [isMscConfigOpen, setIsMscConfigOpen] = useState(false);
  const [erpStatus, setErpStatus] = useState(null);
  const [imisStatus, setImisStatus] = useState(null);
  const [mscStatus, setMscStatus] = useState(null);
  const [dismissBanner, setDismissBanner] = useState(false);
  const excelInputRef = React.useRef(null);

  const [activeProjectId, setActiveProjectId] = useState('ThamDinhDot8_lân2.json');
  const [inspectorPillar, setInspectorPillar] = useState('quotes');
  const [dossierName, setDossierName] = useState('Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026');
  const [refreshKey, setRefreshKey] = useState(0);
  const [folderPath, setFolderPath] = useState(
    'D:\\OneDrive_Hieuna\\OneDrive - EVN\\Tổ Thẩm định\\Năm 2026\\Thẩm định 308_hieuna\\Các Báo giá gửi Thẩm định'
  );

  const fetchActiveProject = async () => {
    try {
      const res = await fetch('/api/dossier');
      const data = await res.json();
      if (data && data.dossier_name) {
        setDossierName(data.dossier_name);
      }
    } catch (e) {
      console.error("Lỗi nạp dự án hiện tại:", e);
    }
  };

  const fetchErpStatus = async () => {
    try {
      const res = await fetch('/api/erp/config-status');
      const data = await res.json();
      setErpStatus(data);
    } catch (e) {
      console.error("Lỗi kiểm tra CSDL ERP:", e);
    }
  };

  const fetchImisStatus = async () => {
    try {
      const res = await fetch('/api/imis/config-status');
      const data = await res.json();
      setImisStatus(data);
    } catch (e) {
      console.error("Lỗi kiểm tra API EVN IMIS:", e);
    }
  };

  const fetchMscStatus = async () => {
    try {
      const res = await fetch('/api/msc/status');
      const data = await res.json();
      setMscStatus(data);
    } catch (e) {
      console.error("Lỗi kiểm tra Mua Sắm Công:", e);
    }
  };

  useEffect(() => {
    fetchActiveProject();
    fetchErpStatus();
    fetchImisStatus();
    fetchMscStatus();
  }, []);

  const handleSelectInspectorItem = (idx, pillar = 'quotes') => {
    setInspectorIndex(idx);
    setInspectorPillar(pillar || 'quotes');
    setActiveView('inspector');
  };

  const handleOpenPdfPage = (filename, page) => {
    setActiveView('quotes');
  };

  const handleSelectProject = (dossier, filename) => {
    if (dossier) {
      setDossierName(dossier.dossier_name || filename);
      setActiveProjectId(filename);
      setRefreshKey((prev) => prev + 1);
      setActiveView('grid');
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info(`Đang nạp file Excel: ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import-excel', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        setDossierName(cleanName);
        setRefreshKey((prev) => prev + 1);
        setActiveView('grid');
        toast.success(`Nạp thành công ${data.count} mục vật tư! Hãy lưu thành dự án mới.`);
        setIsSaveAsOpen(true);
      } else {
        toast.error(`Lỗi nạp Excel: ${data.message}`);
      }
    } catch (err) {
      toast.error(`Lỗi kết nối khi nạp Excel: ${err}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveProject = async () => {
    try {
      const resPush = await fetch('/api/sync/onedrive-push', { method: 'POST' });
      const data = await resPush.json();
      if (data.success) {
        toast.success('Đã lưu hồ sơ thành công và đồng bộ kho OneDrive!');
      } else {
        toast.error(`Lỗi đồng bộ: ${data.message}`);
      }
    } catch (err) {
      toast.error(`Lỗi khi lưu dự án: ${err}`);
    }
  };

  const isErpMissing = erpStatus && (!erpStatus.is_configured || !erpStatus.file_exists);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 font-sans">
      {/* Hidden File Input for Excel Import */}
      <input
        type="file"
        ref={excelInputRef}
        accept=".xlsx, .xls"
        className="hidden"
        onChange={handleUploadExcel}
      />

      {/* Top Header Navigation Bar */}
      <HeaderNav
        activeView={activeView}
        setActiveView={setActiveView}
        dossierName={dossierName}
        onOpenProjects={() => setIsProjectModalOpen(true)}
        onSaveAs={() => setIsSaveAsOpen(true)}
        onSaveProject={handleSaveProject}
        onUploadExcel={() => excelInputRef.current?.click()}
        onExportExcel={() => window.location.href = '/api/export-excel'}
        erpStatus={erpStatus}
        onOpenErpConfig={() => setIsErpConfigOpen(true)}
        imisStatus={imisStatus}
        onOpenImisConfig={() => setIsImisConfigOpen(true)}
        mscStatus={mscStatus}
        onOpenMscConfig={() => setIsMscConfigOpen(true)}
      />

      {/* Top Startup Warning Banner for Unconfigured ERP DB */}
      {isErpMissing && !dismissBanner && (
        <div className="bg-amber-600 text-white px-5 py-2 shrink-0 shadow-md flex items-center justify-between text-xs font-semibold z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 animate-bounce" />
            <span>
              <strong>Cảnh báo CSDL lịch sử mua sắm ERP:</strong> Hệ thống chưa phát hiện hoặc chưa cấu hình CSDL ERP Vĩnh Tân 4. 
              Vui lòng thiết lập file Excel & ánh xạ 13 cột để sẵn sàng căn cứ thẩm định.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsErpConfigOpen(true)}
              className="bg-white text-amber-950 px-3 py-1 rounded-md font-bold shadow-xs hover:bg-amber-100 transition flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5 text-amber-700" /> Cấu Hình Ngay (Upload / Map 13 Cột)
            </button>
            <button
              onClick={() => setDismissBanner(true)}
              className="text-white/80 hover:text-white transition p-0.5"
              title="Đóng cảnh báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Full-Screen View Container */}
      <main className="flex-1 flex overflow-hidden relative">
        <ErrorBoundary key={activeView} title="Đã xảy ra sự cố khi hiển thị giao diện">
          {activeView === 'quotes' && (
            <QuotesWorkspace folderPath={folderPath} />
          )}

          {activeView === 'grid' && (
            <GridMatrixView key={refreshKey} onSelectInspectorItem={handleSelectInspectorItem} />
          )}

          {activeView === 'inspector' && (
            <ItemInspectorView
              selectedIndex={inspectorIndex}
              onNavigateIndex={setInspectorIndex}
              initialPillar={inspectorPillar}
              onOpenPdfPage={handleOpenPdfPage}
              onOpenErpConfig={() => setIsErpConfigOpen(true)}
              onOpenImisConfig={() => setIsImisConfigOpen(true)}
              onOpenMscConfig={() => setIsMscConfigOpen(true)}
              imisStatus={imisStatus}
              mscStatus={mscStatus}
            />
          )}
        </ErrorBoundary>
      </main>

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSelectProject={handleSelectProject}
        activeProjectId={activeProjectId}
      />

      {/* Save As (Create New Project) Modal */}
      <SaveAsModal
        isOpen={isSaveAsOpen}
        onClose={() => setIsSaveAsOpen(false)}
        currentName={dossierName}
        onSaveSuccess={(newName, projId) => {
          setDossierName(newName);
          setActiveProjectId(projId);
          setRefreshKey((prev) => prev + 1);
        }}
      />

      {/* ERP Config & 13-Column Mapping Modal */}
      <ERPConfigModal
        isOpen={isErpConfigOpen}
        onClose={() => setIsErpConfigOpen(false)}
        onConfigSaved={() => {
          fetchErpStatus();
          setDismissBanner(true);
        }}
      />

      {/* IMIS API Token & Config Modal */}
      <IMISConfigModal
        isOpen={isImisConfigOpen}
        onClose={() => setIsImisConfigOpen(false)}
        onStatusUpdated={fetchImisStatus}
      />

      {/* MSC e-GP cURL Session Modal */}
      <MSCConfigModal
        isOpen={isMscConfigOpen}
        onClose={() => setIsMscConfigOpen(false)}
        onStatusUpdated={fetchMscStatus}
      />
    </div>
  );
}


