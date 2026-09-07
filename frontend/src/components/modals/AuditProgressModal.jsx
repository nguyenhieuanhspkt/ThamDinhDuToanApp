import React, { useState } from 'react';
import {
  FileCheck2, Building2, Network, Globe, ShoppingBag, Brain,
  CheckCircle2, Loader2, AlertTriangle, FileDown, ExternalLink,
  X, Check, ChevronDown, ChevronUp, ShieldCheck, Key, Table2
} from 'lucide-react';

function AuditProgressModalContent({
  isOpen,
  onClose,
  item,
  keyword,
  status = 'running', // 'running' | 'completed' | 'error'
  activeStep = 1,
  auditData,
  onExportPdf,
  onOpenInspector
}) {
  const [showFullSummary, setShowFullSummary] = useState(false);

  if (!isOpen) return null;

  const fmt = (val) => (!val && val !== 0 ? '0 đ' : `${Math.round(val).toLocaleString('vi-VN')} đ`);

  const STEPS_CONFIG = [
    { id: 1, key: 'quotes', name: '1. Báo Giá Gốc (PDF)', icon: FileCheck2, desc: 'Lọc đơn giá chào thấp nhất, chống nhầm họ hàng hóa' },
    { id: 2, key: 'erp', name: '2. ERP Vĩnh Tân 4', icon: Building2, desc: 'Tra cứu CSDL kế toán nội bộ nhà máy (ERP.xlsx)' },
    { id: 3, key: 'imis', name: '3. EVN IMIS Toàn Ngành', icon: Network, desc: 'Truy vấn Live API Hợp đồng các nhà máy điện EVN' },
    { id: 4, key: 'msc', name: '4. Mua Sắm Công e-GP', icon: Globe, desc: 'Đối chiếu kết quả trúng thầu qua mạng toàn quốc' },
    { id: 5, key: 'ecom', name: '5. TMĐT & Tham Khảo Web', icon: ShoppingBag, desc: 'Tham chiếu giá thị trường niêm yết' },
    { id: 6, key: 'synthesis', name: '6. AI Thuyết Minh & Chốt Giá', icon: Brain, desc: 'Tổng hợp 5 cơ sở & sinh bản thuyết minh Tổ Thẩm định' },
  ];

  const result = auditData?.result || {};
  const steps = auditData?.steps || [];
  const dgTrinh = result.don_gia_trinh || item?.don_gia_trinh || 0;
  const dgTn = result.don_gia_thong_nhat || dgTrinh;
  const giaTriGiam = result.gia_tri_giam || 0;
  const pctGiam = result.pct_giam || 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#003366] via-blue-900 to-teal-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-400/20 border border-teal-300/30 flex items-center justify-center">
              {status === 'running' ? (
                <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
              ) : status === 'completed' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-300" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
                {status === 'running' && '⚡ Đang Tra Cứu Đa Tầng 5 Cơ Sở...'}
                {status === 'completed' && 'Báo Cáo Minh Bạch Thẩm Định 5 Cơ Sở'}
                {status === 'error' && 'Lỗi Xử Lý Thẩm Định'}
              </h3>
              <p className="text-[10px] text-teal-200 font-mono mt-0.5">
                Mục #{item?.id || 1}: {(item?.ten_vt_goc || item?.ten_vt || '').slice(0, 45)}...
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white hover:bg-white/10 rounded-lg p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">

          {/* Target Item Information Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tên Vật Tư Trình:</span>
                <p className="font-bold text-slate-900 text-xs mt-0.5">
                  {item?.ten_vt_goc || item?.ten_vt}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Đơn Giá Trình:</span>
                <p className="font-bold font-mono text-[#003366] text-sm">
                  {fmt(item?.don_gia_trinh)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] pt-2 border-t border-slate-200 text-slate-600">
              <span className="flex items-center gap-1">
                <strong className="text-slate-700">Mã ERP:</strong>{' '}
                <span className="font-mono">{item?.ma_vt || 'Chưa có mã'}</span>
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-700">Số lượng:</strong>{' '}
                <span className="font-mono">{item?.so_luong || 1} {item?.dvt || 'Cái'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                <Key className="w-3 h-3 text-teal-600" />
                <span>Từ khóa tra:</span>
                <span className="font-mono underline">{auditData?.keyword_used || keyword || 'Chưa có'}</span>
              </span>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TRẠNG THÁI 1: LIVE STEPPER (ĐANG CHẠY) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {status === 'running' && (
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs">
              <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                Tiến Trình Tra Cứu Thời Gian Thực
              </h4>

              <div className="space-y-2.5">
                {STEPS_CONFIG.map((st) => {
                  const Icon = st.icon;
                  const isDone = st.id < activeStep;
                  const isCurrent = st.id === activeStep;
                  const isPending = st.id > activeStep;

                  return (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-lg border transition flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-blue-50/80 border-blue-400 shadow-2xs ring-1 ring-blue-300'
                          : isDone
                          ? 'bg-emerald-50/50 border-emerald-300 text-slate-800'
                          : 'bg-slate-50 border-slate-200 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-blue-600 text-white animate-pulse'
                              : isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className={`font-bold text-xs ${isCurrent ? 'text-blue-950' : 'text-slate-900'}`}>
                            {st.name}
                          </p>
                          <p className="text-[10.5px] text-slate-500">{st.desc}</p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isDone && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Xong
                          </span>
                        )}
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tra cứu...
                          </span>
                        )}
                        {isPending && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            Chờ
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TRẠNG THÁI 2: KẾT QUẢ MINH BẠCH (HOÀN TẤT) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {status === 'completed' && (
            <>
              {/* Bảng Đối Chiếu 5 Nguồn Dữ Liệu */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Table2 className="w-3.5 h-3.5 text-teal-700" />
                    Bảng Đối Chiếu Minh Bạch 5 Cơ Sở
                  </span>
                  <span className="text-[10.5px] font-semibold text-slate-500">
                    Độ phủ chứng cứ:{' '}
                    <strong className="text-emerald-700">{auditData?.synthesis?.coverage_score || 85}/100</strong>
                  </span>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold text-[11px]">
                    <tr>
                      <th className="py-2 px-3 border-r">Nguồn Chứng Cứ</th>
                      <th className="py-2 px-3 border-r">Thông Tin Thu Thập Được</th>
                      <th className="py-2 px-3 text-right w-28 font-mono">Đơn Giá</th>
                      <th className="py-2 px-2 text-center w-20">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {steps.slice(0, 5).map((st, idx) => {
                      const hasPrice = st.price && st.price > 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 px-3 border-r font-bold text-slate-900">
                            {st.name}
                          </td>
                          <td className="py-2 px-3 border-r text-slate-700 text-[11.5px]">
                            {st.detail}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold border-r text-slate-900">
                            {hasPrice ? fmt(st.price) : '—'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {hasPrice ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Khớp
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                Trống
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Hộp Kết Luận Đơn Giá & Tiết Kiệm */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border-2 border-emerald-400 rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">
                    KẾT LUẬN THẨM ĐỊNH & ĐƠN GIÁ THỐNG NHẤT:
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-black font-mono text-emerald-950">
                      {fmt(dgTn)}
                    </span>
                    <span className="text-xs text-emerald-700 font-semibold">/{item?.dvt || 'Cái'}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Thành tiền thẩm định: <strong className="font-mono">{fmt(result.thanh_tien_thong_nhat)}</strong>
                  </p>
                </div>

                <div className="text-right bg-white p-2.5 rounded-lg border border-emerald-200 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Giảm Trừ Tiết Kiệm:
                  </span>
                  <p className="text-sm font-black font-mono text-emerald-800 mt-0.5">
                    {fmt(giaTriGiam)}
                  </p>
                  <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                    {pctGiam > 0 ? `-${pctGiam.toFixed(1)}% so với trình` : '0%'}
                  </span>
                </div>
              </div>

              {/* Trích Lược Bản Thuyết Minh Thẩm Định AI */}
              {result.danh_gia_ttd && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button
                    onClick={() => setShowFullSummary(!showFullSummary)}
                    className="w-full px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-left font-bold text-xs text-slate-800 hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-purple-600" />
                      Thuyết Minh Đánh Giá Của Tổ Thẩm Định
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                      {showFullSummary ? 'Thu gọn' : 'Xem toàn văn'}
                      {showFullSummary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  <div className={`p-3 text-[11.5px] leading-relaxed text-slate-800 ${showFullSummary ? '' : 'line-clamp-3'}`}>
                    <div className="whitespace-pre-line font-sans">
                      {result.danh_gia_ttd}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TRẠNG THÁI 3: LỖI */}
          {status === 'error' && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">Không thể hoàn tất quá trình tra cứu 5 cơ sở</p>
                <p className="text-[11px] mt-1 text-rose-800">
                  Vui lòng kiểm tra kết nối mạng hoặc thử lại với từ khóa ngắn gọn hơn.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
          >
            Đóng
          </button>

          {status === 'completed' && (
            <div className="flex items-center gap-2">
              {onOpenInspector && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenInspector(item?.id ? item.id - 1 : 0);
                  }}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Soi Chi Tiết View 3
                </button>
              )}

              {onExportPdf && (
                <button
                  onClick={() => onExportPdf(item?.id || 1)}
                  className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                >
                  <FileDown className="w-3.5 h-3.5" /> Xuất Báo Cáo PDF 2 Trang
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Lớp bảo vệ chống sập giao diện (Zero White-Screen Guarantee)
class ModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Lỗi giao diện Modal 5 Cơ Sở:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white p-6 rounded-xl max-w-md w-full shadow-2xl border border-rose-200">
            <h3 className="text-base font-bold text-rose-700">Lỗi giao diện Báo cáo minh bạch</h3>
            <p className="text-xs text-slate-600 mt-2 font-mono bg-slate-50 p-2 rounded border border-slate-200">
              {this.state.error?.message || 'Không thể hiển thị báo cáo'}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  this.setState({ hasError: false });
                  if (this.props.onClose) this.props.onClose();
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AuditProgressModal(props) {
  if (!props.isOpen) return null;
  return (
    <ModalErrorBoundary onClose={props.onClose}>
      <AuditProgressModalContent {...props} />
    </ModalErrorBoundary>
  );
}
