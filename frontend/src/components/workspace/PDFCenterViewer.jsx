import React from 'react';
import { FileText } from 'lucide-react';

export default function PDFCenterViewer({ activeFilename, activeFilePath, pageNumber }) {
  const cleanPath = (activeFilePath || '').replace(/\\/g, '/');
  const iframeSrc = activeFilename
    ? `/api/quotes/view-pdf?path=${encodeURIComponent(cleanPath)}&filename=${encodeURIComponent(activeFilename)}#page=${pageNumber || 1}`
    : 'about:blank';

  return (
    <div className="w-[40%] border-r bg-slate-900 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-950 text-slate-300 px-3 py-2 text-xs flex items-center justify-between shrink-0 border-b border-slate-800 font-medium">
        <span className="flex items-center gap-1.5 truncate">
          <FileText className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-gray-400">PDF Gốc:</span>
          <strong className="text-white truncate font-mono" title={activeFilename}>
            {activeFilename || 'Chưa chọn báo giá nào'}
          </strong>
        </span>
        <span className="bg-slate-800 text-teal-300 font-mono text-[10.5px] px-2.5 py-0.5 rounded border border-slate-700 shrink-0 font-bold">
          {pageNumber ? `Tự nhảy -> Trang ${pageNumber}` : 'Tự chuyển trang khi click dòng'}
        </span>
      </div>

      {/* Frame Container */}
      <div className="flex-1 relative bg-slate-800">
        {activeFilename ? (
          <iframe
            key={`${activeFilename}-${pageNumber}`}
            id="workspace-pdf-frame"
            className="w-full h-full border-0 bg-white"
            src={iframeSrc}
            title={`PDF Viewer - ${activeFilename}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs italic">
            Vui lòng chọn 1 nhà thầu ở danh sách bên trái để xem PDF gốc.
          </div>
        )}
      </div>
    </div>
  );
}
