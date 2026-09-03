import React, { useState, useEffect, useRef } from 'react';
import { Folder, FolderOpen, History, Check, X, HardDrive, ArrowUp, FolderPlus, Monitor } from 'lucide-react';

export default function FolderPickerModal({ isOpen, onClose, currentPath, onSelectFolder }) {
  const [inputPath, setInputPath] = useState(currentPath || '');
  const [parentPath, setParentPath] = useState(null);
  const [subdirs, setSubdirs] = useState([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isOpeningNative, setIsOpeningNative] = useState(false);
  const fileInputRef = useRef(null);

  const [recentFolders, setRecentFolders] = useState([
    'D:\\OneDrive_Hieuna\\OneDrive - EVN\\Tổ Thẩm định\\Năm 2026\\Thẩm định 308_hieuna\\Các Báo giá gửi Thẩm định',
    'D:\\TaskApp_kiet\\Các Báo giá gửi Thẩm định',
    'D:\\TaskApp_kiet\\thamdinhdutoanApp\\data\\quotes'
  ]);

  const fetchFolderTree = async (targetPath) => {
    setIsLoadingTree(true);
    try {
      const res = await fetch('/api/quotes/browse-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath || inputPath })
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setInputPath(data.current_path);
          setParentPath(data.parent_path);
          setSubdirs(data.subdirs || []);
        }
      }
    } catch (e) {
      console.error("Lỗi duyệt cây thư mục:", e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const handleOpenNativeExplorer = async () => {
    setIsOpeningNative(true);
    try {
      const res = await fetch('/api/quotes/native-browse-folder', { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';

      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && data.folder_path) {
          setInputPath(data.folder_path);
          onSelectFolder(data.folder_path);
          onClose();
          return;
        }
      }
      
      // Fallback: Trigger browser native folder selector
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch (e) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } finally {
      setIsOpeningNative(false);
    }
  };

  const handleHtml5DirectorySelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const firstFile = e.target.files[0];
      let selectedFolderPath = '';

      if (firstFile.path) {
        selectedFolderPath = firstFile.path.substring(
          0,
          Math.max(firstFile.path.lastIndexOf('\\'), firstFile.path.lastIndexOf('/'))
        );
      } else {
        const relPath = firstFile.webkitRelativePath || '';
        const folderName = relPath.split('/')[0] || '';
        if (folderName) {
          selectedFolderPath = `D:\\TaskApp_kiet\\${folderName}`;
        }
      }

      if (selectedFolderPath) {
        setInputPath(selectedFolderPath);
        onSelectFolder(selectedFolderPath);
        onClose();
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      const initPath = currentPath || 'D:\\TaskApp_kiet';
      setInputPath(initPath);
      fetchFolderTree(initPath);
    }
  }, [isOpen, currentPath]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (inputPath && inputPath.trim()) {
      onSelectFolder(inputPath.trim());
      onClose();
    }
  };

  const handleSelectRecent = (path) => {
    setInputPath(path);
    fetchFolderTree(path);
  };

  const handleSubdirClick = (path) => {
    setInputPath(path);
    fetchFolderTree(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      setInputPath(parentPath);
      fetchFolderTree(parentPath);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      {/* Hidden HTML5 Native Directory Input */}
      <input
        type="file"
        ref={fileInputRef}
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={handleHtml5DirectorySelect}
      />

      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003366] to-teal-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-300/30 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wide">CHỌN THƯ MỤC BÁO GIÁ GỐC (PDF)</h3>
              <p className="text-[10.5px] text-teal-200">Mở cửa sổ Windows Explorer chọn thư mục trực tiếp</p>
            </div>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3.5 text-xs overflow-y-auto flex-1">
          {/* NATIVE WINDOWS EXPLORER BUTTON (NỔI BẬT HÀNG ĐẦU) */}
          <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center justify-between shadow-2xs">
            <div>
              <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-emerald-700" /> Duyệt Thư Mục Qua Windows Explorer
              </h4>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Mở cửa sổ chọn thư mục chuẩn của Windows (giống ứng dụng Desktop)
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNativeExplorer}
              disabled={isOpeningNative}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold px-3.5 py-2 rounded-lg text-xs shadow flex items-center gap-1.5 shrink-0 transition"
            >
              <FolderOpen className="w-4 h-4 text-emerald-200" />
              {isOpeningNative ? 'Đang mở...' : 'Duyệt Windows...'}
            </button>
          </div>

          {/* Path Input Bar */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-teal-700" /> Đường dẫn thư mục hiện tại:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                placeholder="D:\ThuMuc_BaoGia..."
                className="flex-1 text-xs font-mono p-2 border border-gray-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fetchFolderTree(inputPath)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg font-semibold text-xs transition shrink-0"
              >
                Tải
              </button>
            </div>
          </div>

          {/* Interactive Subfolders Tree View */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex flex-col min-h-[130px] max-h-[180px]">
            <div className="bg-slate-200/80 px-3 py-1.5 text-[11px] font-bold text-slate-700 flex items-center justify-between border-b shrink-0">
              <span className="flex items-center gap-1">
                <FolderPlus className="w-3.5 h-3.5 text-teal-800" /> Thư mục con bên trong:
              </span>
              {parentPath && (
                <button
                  type="button"
                  onClick={handleGoUp}
                  className="text-teal-800 hover:underline flex items-center gap-0.5 font-bold"
                >
                  <ArrowUp className="w-3 h-3" /> Thư mục cha
                </button>
              )}
            </div>

            <div className="p-2 overflow-y-auto flex-1 space-y-1">
              {isLoadingTree ? (
                <div className="text-center py-4 text-gray-400 text-xs italic">Đang tải danh mục...</div>
              ) : subdirs.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-xs italic">Không có thư mục con nào.</div>
              ) : (
                subdirs.map((sd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSubdirClick(sd.path)}
                    className="w-full text-left p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-teal-50 hover:border-teal-300 transition text-xs flex items-center gap-2 truncate"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate font-medium">{sd.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Recent Folders */}
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <History className="w-3 h-3 text-amber-600" /> Thư mục đã dùng gần đây:
            </span>
            <div className="flex flex-col gap-1 mt-1">
              {recentFolders.map((path, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectRecent(path)}
                  className={`text-left p-1.5 rounded-lg border text-xs flex items-center justify-between transition ${
                    inputPath === path
                      ? 'bg-teal-50 border-teal-300 font-bold text-teal-900'
                      : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate font-mono text-[10.5px]">
                    <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{path}</span>
                  </span>
                  {inputPath === path && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 bg-white"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" /> Xác Nhận Chọn Thư Mục Này
          </button>
        </div>
      </div>
    </div>
  );
}
