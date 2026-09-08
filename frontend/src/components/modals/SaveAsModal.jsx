import React, { useState, useEffect } from 'react';
import { Bookmark, X, Check, FolderPlus, Loader2 } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

export default function SaveAsModal({ isOpen, onClose, currentName, onSaveSuccess }) {
  const toast = useToast();
  const [projectName, setProjectName] = useState('');
  const [creator, setCreator] = useState('Nguyễn Anh Hiếu');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProjectName(currentName ? `${currentName} - Bản Mới` : '');
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) {
      toast.warning('Vui lòng nhập tên dự án mới');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Nạp dữ liệu hồ sơ hiện tại
      const resDossier = await fetch('/api/dossier');
      const dossierData = await resDossier.json();

      // 2. Gửi API lưu thành dự án mới
      const resSave = await fetch('/api/projects/save-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          creator: creator.trim() || 'Nguyễn Anh Hiếu',
          data: dossierData
        })
      });

      const resData = await resSave.json();
      if (resData.success) {
        toast.success(`Đã tạo và lưu thành công dự án: ${trimmed}`);
        if (onSaveSuccess) {
          onSaveSuccess(resData.name, resData.project_id);
        }
        onClose();
      } else {
        toast.error(`Lỗi tạo dự án: ${resData.message}`);
      }
    } catch (err) {
      toast.error(`Lỗi kết nối khi lưu dự án: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003366] to-teal-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-400/20 border border-teal-300/30 flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">TẠO & LƯU THÀNH DỰ ÁN MỚI</h3>
              <p className="text-[10.5px] text-teal-200 mt-0.2">Khởi tạo hồ sơ thẩm định độc lập</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Tên Dự Án / Hồ Sơ Thẩm Định <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="VD: Thẩm định 308 - Mua sắm vật tư đợt 9 năm 2026"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent text-xs font-medium"
              autoFocus
            />
            <p className="text-[10.5px] text-slate-400 mt-1 italic">
              Tên dự án sẽ được dùng làm tiêu đề trên Báo cáo thẩm định và xuất Excel/PDF.
            </p>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Người Thực Hiện Thẩm Định
            </label>
            <input
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="Nguyễn Anh Hiếu"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent text-xs font-medium"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-teal-700" />
              Cơ chế lưu trữ độc lập:
            </div>
            <p>
              • Dữ liệu dự án được lưu vào <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-[10px]">data/projects/&lt;Tên_Dự_Án&gt;.json</code>
            </p>
            <p>
              • Bằng chứng & hình ảnh tra cứu được lưu vào <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-[10px]">data/projects/&lt;Tên_Dự_Án&gt;_files/</code>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang Lưu Dự Án...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Lưu Dự Án Mới
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
