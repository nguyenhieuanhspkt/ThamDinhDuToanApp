import React, { useState, useEffect } from 'react';
import { X, Globe, Key, CheckCircle2, AlertCircle, RefreshCw, Copy, HelpCircle, Server } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

export default function MSCConfigModal({ isOpen, onClose, onStatusUpdated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [curlCommand, setCurlCommand] = useState('');
  const [statusInfo, setStatusInfo] = useState({
    active: false,
    message: 'Chưa kiểm tra kết nối'
  });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/msc/status');
      const data = await res.json();
      setStatusInfo(data);
    } catch (e) {
      console.error('Failed to fetch MSC status:', e);
      toast.error('Không thể kiểm tra kết nối Mua Sắm Công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleUpdateCurl = async (e) => {
    if (e) e.preventDefault();
    if (!curlCommand.trim()) {
      toast.error('Vui lòng dán chuỗi cURL từ Chrome/Edge DevTools');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch('/api/msc/update-curl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curl_command: curlCommand })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Đã kích hoạt phiên Mua Sắm Công thành công!');
        setCurlCommand('');
        await fetchStatus();
        if (onStatusUpdated) onStatusUpdated();
      } else {
        toast.error(data.message || 'Cập nhật cURL thất bại');
      }
    } catch (e) {
      toast.error('Lỗi khi gửi cURL đến máy chủ');
    } finally {
      setUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Cấu Hình Session e-GP Mua Sắm Công
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Card Trạng Thái Kết Nối */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            statusInfo.active
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              {statusInfo.active ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <span>Trạng Thái:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                    statusInfo.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {statusInfo.active ? 'HOẠT ĐỘNG (200 OK)' : 'CHƯA KẾT NỐI / HẾT HẠN'}
                  </span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5 font-medium">
                  {statusInfo.message}
                </div>
                {statusInfo.created_at && statusInfo.created_at !== 'N/A' && (
                  <div className="text-[10px] opacity-75 font-mono mt-1">
                    ⏱️ Thời điểm nạp cURL: <strong className="text-orange-200">{statusInfo.created_at}</strong> {statusInfo.age_str}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition border border-slate-700 disabled:opacity-50"
              title="Kiểm tra lại kết nối"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Form Nhập cURL */}
          <form onSubmit={handleUpdateCurl} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-400" /> Dán Chuỗi cURL Từ Chrome / Edge DevTools:
              </label>
              <textarea
                rows={5}
                value={curlCommand}
                onChange={(e) => setCurlCommand(e.target.value)}
                placeholder="Ví dụ: curl 'https://muasamcong.mpi.gov.vn/o/egp-portal-personal-page/services/smart/search_prc' -H 'Cookie: ...'"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-orange-300 placeholder:text-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={updating || !curlCommand.trim()}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {updating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang kiểm tra & kích hoạt...
                </>
              ) : (
                <>
                  <Server className="w-4 h-4" /> Kích Hoạt Phiên Mua Sắm Công Mới
                </>
              )}
            </button>
          </form>

          {/* Hướng dẫn lấy cURL */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 text-xs space-y-2">
            <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
              <HelpCircle className="w-4 h-4 text-orange-400" /> Hướng Dẫn Lấy Chuỗi cURL từ Chrome/Edge:
            </h4>
            <ol className="list-decimal list-inside text-slate-400 space-y-1 text-[11px] leading-relaxed">
              <li>Mở trang web <strong>muasamcong.mpi.gov.vn</strong> và đăng nhập tài khoản.</li>
              <li>Nhấn <strong>F12</strong> mở DevTools → Chuyển sang thẻ <strong>Network</strong>.</li>
              <li>Thực hiện tra cứu giá 1 vật tư bất kỳ trên web Mua Sắm Công.</li>
              <li>Tìm request tên <strong><code className="text-orange-300 bg-slate-900 px-1 rounded">search_prc</code></strong> → Chuột phải chọn <strong>Copy → Copy as cURL (bash)</strong>.</li>
              <li>Dán vào khung trên và nhấn <strong>Kích Hoạt Phiên</strong>.</li>
            </ol>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
