import React, { useState, useEffect } from 'react';
import HeaderNav from './components/HeaderNav.jsx';
import QuotesWorkspace from './components/workspace/QuotesWorkspace.jsx';
import GridMatrixView from './components/grid/GridMatrixView.jsx';
import ItemInspectorView from './components/inspector/ItemInspectorView.jsx';
import ProjectManagerModal from './components/modals/ProjectManagerModal.jsx';

export default function App() {
  const [activeView, setActiveView] = useState('quotes');
  const [inspectorIndex, setInspectorIndex] = useState(0);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState('ThamDinhDot8_lân2.json');
  const [dossierName, setDossierName] = useState('Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026');
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

  useEffect(() => {
    fetchActiveProject();
  }, []);

  const handleSelectInspectorItem = (idx) => {
    setInspectorIndex(idx);
    setActiveView('inspector');
  };

  const handleOpenPdfPage = (filename, page) => {
    setActiveView('quotes');
  };

  const handleSelectProject = (dossier, filename) => {
    if (dossier) {
      setDossierName(dossier.dossier_name || filename);
      setActiveProjectId(filename);
      setActiveView('grid');
      setTimeout(() => setActiveView('quotes'), 100);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-100 font-sans">
      {/* Top Header Navigation Bar */}
      <HeaderNav
        activeView={activeView}
        setActiveView={setActiveView}
        dossierName={dossierName}
        onOpenProjects={() => setIsProjectModalOpen(true)}
        onSaveAs={() => alert("Lưu thành dự án mới")}
        onSaveProject={() => alert("Đã lưu nhanh dự án!")}
        onUploadExcel={() => alert("Nạp file Excel mới")}
        onExportExcel={() => window.location.href = '/api/export-excel'}
      />

      {/* Main Full-Screen View Container */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeView === 'quotes' && (
          <QuotesWorkspace folderPath={folderPath} />
        )}

        {activeView === 'grid' && (
          <GridMatrixView onSelectInspectorItem={handleSelectInspectorItem} />
        )}

        {activeView === 'inspector' && (
          <ItemInspectorView
            selectedIndex={inspectorIndex}
            onNavigateIndex={setInspectorIndex}
            onOpenPdfPage={handleOpenPdfPage}
          />
        )}
      </main>

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSelectProject={handleSelectProject}
        activeProjectId={activeProjectId}
      />
    </div>
  );
}
