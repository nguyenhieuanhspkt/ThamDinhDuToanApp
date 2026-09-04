import React, { useState, useEffect } from 'react';
import { FolderOpen, Trash2, Calendar, FileText, Check, X, ShieldAlert, PlusCircle } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

export default function ProjectManagerModal({ isOpen, onClose, onSelectProject, activeProjectId }) {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // filename to confirm delete

  const fetchProjectsList = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/projects');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } else {
        setErrorMsg('Không thể nạp danh sách dự án từ máy chủ.');
      }
    } catch (e) {
      setErrorMsg(`Lỗi kết nối: ${e}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchProjectsList();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoadProject = async (filename) => {
    try {
      const res = await fetch(`/api/projects/load/${filename}`);
      const data = await res.json();
      if (data.success) {
        onSelectProject(data.dossier, filename);
        onClose();
        toast.success('Đã nạp dự án thành công!');
      } else {
        toast.error('Lỗi nạp dự án: ' + data.message);
      }
    } catch (e) {
      toast.error('Lỗi kết nối: ' + e);
    }
  };

  const handleDeleteProject = async (filename) => {
    try {
      const res = await fetch(`/api/projects/delete/${filename}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Đã xóa dự án!');
        fetchProjectsList();
      } else {
        toast.error('Lỗi xóa dự án: ' + data.message);
      }
    } catch (e) {
      toast.error('Lỗi kết nối: ' + e);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatMoney = (val) => (!val ? '0 đ' : Math.round(val).toLocaleString('vi-VN') + ' đ');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#003366] to-teal-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-300/30 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide">DANH SÁCH DỰ ÁN THẨM ĐỊNH ĐÃ LƯU</h3>
              <p className="text-[11px] text-teal-200 mt-0.5">Chọn hồ sơ dự án để nạp lại dữ liệu làm việc</p>
            </div>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">Đang nạp danh sách dự án...</div>
          ) : errorMsg ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs italic">Chưa có dự án nào được lưu.</div>
          ) : (
            projects.map((proj) => {
              const projId = proj.id || proj.filename;
              const isActive = activeProjectId === projId || activeProjectId === proj.name;
              return (
                <div
                  key={projId}
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    isActive
                      ? 'bg-teal-50/70 border-teal-400 shadow-2xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900 text-xs truncate max-w-[360px]" title={proj.name}>
                        {proj.name}
                      </span>
                      {isActive && (
                        <span className="bg-teal-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đang chọn
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-600 font-medium">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span><strong>{proj.count}</strong> danh mục vật tư</span>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-teal-800 font-semibold">
                        Trình: {formatMoney(proj.total_trinh)}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1 text-slate-400 font-mono text-[10.5px]">
                        <Calendar className="w-3 h-3 shrink-0" /> {proj.updated_at}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleLoadProject(projId)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                        isActive ? 'bg-teal-700 hover:bg-teal-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" /> Mở Dự Án
                    </button>
                    {deleteConfirm === projId ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-rose-700 font-bold">Xác nhận xóa?</span>
                        <button onClick={() => handleDeleteProject(projId)} className="text-[10px] bg-rose-600 text-white px-2 py-1 rounded font-bold">Xóa</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold">Hủy</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(projId)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Xóa dự án này">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Tổng số: <strong>{projects.length}</strong> dự án trong hệ thống
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
