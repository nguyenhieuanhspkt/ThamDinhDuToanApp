import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Key, RefreshCw, User, Lock, CheckCircle2, AlertCircle, Server, Globe } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

export default function IMISConfigModal({ isOpen, onClose, onStatusUpdated }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const [statusInfo, setStatusInfo] = useState({
    is_connected: false,
    status: 'DISCONNECTED',
    message: 'Chưa kiểm tra',
    expired_time: 'N/A',
    username: ''
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imis/config-status');
      const data = await res.json();
      setStatusInfo(data);
      if (data.username && data.username !== 'EVN User') {
        setUsername(data.username);
      }
    } catch (e) {
      console.error('Failed to fetch IMIS status:', e);
      toast.error('Không thể kiểm tra kết nối EVN IMIS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/refresh-token', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Làm mới Token IMIS thành công');
        setStatusInfo(data.info || statusInfo);
        if (onStatusUpdated) onStatusUpdated();
      } else {
        toast.error(data.message || 'Không thể làm mới Token');
      }
    } catch (e) {
      toast.error('Lỗi khi gửi yêu cầu làm mới Token');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) {
      toast.error('Vui lòng nhập Username và Mật khẩu EVN IMIS');
      return;
    }
    setLoggingIn(true);
    try {
      const res = await fetch('/api/imis/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Đăng nhập và cập nhật Token IMIS thành công!');
        setStatusInfo(data.info || statusInfo);
        setPassword('');
        if (onStatusUpdated) onStatusUpdated();
      } else {
        toast.error(data.message || 'Đăng nhập IMIS thất bại');
      }
    } catch (e) {
      toast.error('Lỗi kết nối máy chủ IMIS');
    } finally {
      setLoggingIn(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = statusInfo.is_connected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg flex items-center gap-2">
                Cấu Hình Kết Nối EVN IMIS
              </h3>
              <p className="text-xs text-slate-400">Quản lý xác thực và Token kết nối hệ thống IMIS Tập đoàn EVN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            isConnected
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-start gap-3">
              {isConnected ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  <span>Trạng Thái: {statusInfo.message}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {statusInfo.status}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Hạn dùng Token: <span className="font-mono text-slate-200">{statusInfo.expired_time || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleRefreshToken}
              disabled={refreshing || loading}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 shrink-0"
              title="Làm mới Token API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Login Credentials Form */}
          <form onSubmit={handleLogin} className="space-y-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Key className="w-3.5 h-3.5" />
              Cập Nhật / Đăng Nhập Tài Khoản IMIS EVN
            </h4>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Tên Đăng Nhập (Username)</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập username IMIS..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Mật Khẩu (Password)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                />
                Ghi nhớ đăng nhập
              </label>

              <button
                type="submit"
                disabled={loggingIn}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center gap-2"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Đăng Nhập & Lấy Token
                  </>
                )}
              </button>
            </div>
          </form>

          {/* System Info Footnote */}
          <div className="text-[11px] text-slate-500 space-y-1 bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
            <div className="flex items-center gap-2 text-slate-400 font-medium">
              <Server className="w-3.5 h-3.5 text-purple-400" />
              Hệ thống kết nối API EVN IMIS
            </div>
            <p>Dữ liệu hợp đồng mua sắm được truy xuất trực tiếp từ cổng IMIS EVN để làm căn cứ thẩm định dự toán.</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
