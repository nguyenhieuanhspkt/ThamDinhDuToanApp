import React, { useState, useEffect } from 'react';
import LeftSidebar from './LeftSidebar.jsx';
import PDFCenterViewer from './PDFCenterViewer.jsx';
import SpreadsheetGrid from './SpreadsheetGrid.jsx';
import FolderPickerModal from '../modals/FolderPickerModal.jsx';
import { useToast } from '../ui/Toast.jsx';

export default function QuotesWorkspace({ folderPath: initialFolderPath, onSelectInspectorItem }) {
  const toast = useToast();

  const [folderPath, setFolderPath] = useState(
    initialFolderPath ||
      'D:\\OneDrive_Hieuna\\OneDrive - EVN\\Tổ Thẩm định\\Năm 2026\\Thẩm định 308_hieuna\\Các Báo giá gửi Thẩm định'
  );
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [dossierData, setDossierData] = useState(null);
  const [dossierItems, setDossierItems] = useState([]);
  const [currentFilter, setFilter] = useState('all');
  const [activeFilename, setActiveFilename] = useState(null);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [activeQuoteData, setActiveQuoteData] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  useEffect(() => {
    fetch('/api/dossier')
      .then((res) => res.json())
      .then((data) => {
        setDossierItems(data.items || []);
      })
      .catch(console.error);
  }, []);

  const fetchDossier = async (targetPath = folderPath, forceRescan = true) => {
    setIsLoadingDossier(true);
    try {
      const res = await fetch('/api/quotes/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: targetPath, force_rescan: forceRescan })
      });
      const data = await res.json();

      if (data.success) {
        setDossierData(data);
        const quotes = data.quotes || [];
        if (quotes.length > 0) {
          selectQuote(quotes[0].filename, quotes[0].file_path, targetPath);
        } else {
          setActiveFilename(null);
          setActiveFilePath(null);
          setActiveQuoteData(null);
        }
      } else {
        setDossierData({ folder_path: targetPath, quotes: [], scans: [], docs: [], total_files: 0 });
      }
    } catch (e) {
      console.error('Lỗi nạp thư mục báo giá:', e);
      toast.error('Lỗi kết nối khi quét thư mục báo giá!');
    } finally {
      setIsLoadingDossier(false);
    }
  };

  useEffect(() => {
    fetchDossier(folderPath, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectQuote = async (filename, filePath, targetFolder = folderPath) => {
    setActiveFilename(filename);
    setActiveFilePath(filePath);
    setPageNumber(1);
    setIsLoadingQuote(true);

    try {
      const res = await fetch('/api/quotes/item-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, folder_path: targetFolder })
      });
      const data = await res.json();
      if (data.success) {
        setActiveQuoteData(data.data || data.quote);
      } else {
        setActiveQuoteData(null);
      }
    } catch (e) {
      console.error('Lỗi nạp chi tiết báo giá:', e);
      setActiveQuoteData(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleSaveQuote = async (updatedQuote) => {
    try {
      const res = await fetch('/api/quotes/save-override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath, quote: updatedQuote })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã lưu hiệu chỉnh dữ liệu báo giá thành công!');
        setActiveQuoteData(updatedQuote);
        fetchDossier(folderPath, false);
      } else {
        toast.error('Lỗi lưu dữ liệu: ' + (data.message || 'Không rõ nguyên nhân'));
      }
    } catch (e) {
      console.error('Lỗi kết nối khi lưu báo giá:', e);
      toast.error('Lỗi mạng khi gửi dữ liệu lưu!');
    }
  };

  const handleRowClick = (pageNum) => {
    if (pageNum && pageNum > 0) setPageNumber(pageNum);
  };

  const handleSelectFolder = (newPath) => {
    setFolderPath(newPath);
    fetchDossier(newPath, true);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Column 1: Left Navigation Sidebar */}
      <LeftSidebar
        dossierData={dossierData}
        currentFilter={currentFilter}
        setFilter={setFilter}
        activeQuoteFilename={activeFilename}
        onSelectQuote={(fn, fp) => selectQuote(fn, fp, folderPath)}
        onRescanPdf={() => fetchDossier(folderPath, true)}
        onChangeFolder={() => setIsFolderModalOpen(true)}
        folderPath={folderPath}
        isLoading={isLoadingDossier}
      />

      {/* Column 2: Center PDF Interactive Viewer */}
      <PDFCenterViewer
        activeFilename={activeFilename}
        activeFilePath={activeFilePath}
        pageNumber={pageNumber}
        setPageNumber={setPageNumber}
      />

      {/* Column 3: Right Spreadsheet Grid */}
      <SpreadsheetGrid
        quoteData={activeQuoteData}
        onSaveQuote={handleSaveQuote}
        onRowClick={handleRowClick}
        activeFilename={activeFilename}
        isLoading={isLoadingQuote}
        dossierItems={dossierItems}
        onSelectInspectorItem={onSelectInspectorItem}
      />

      {/* Folder Picker Modal */}
      <FolderPickerModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSelectFolder={handleSelectFolder}
        currentPath={folderPath}
      />
    </div>
  );
}
