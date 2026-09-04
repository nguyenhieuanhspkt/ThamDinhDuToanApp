import React, { useState, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, Wand2, CheckCircle2, AlertCircle, Save, FolderOpen, Loader2 } from 'lucide-react';
import { useToast } from '../ui/Toast.jsx';

const ERP_FIELDS = [
  { key: 'ma_vt',         label: '1. Mã vật tư / Mã ERP',                   keywords: ['MÃ VẬT TƯ', 'MÃ ERP', 'MA_VT', 'MAVT', 'ITEM CODE', 'CODE'] },
  { key: 'ten_vt',        label: '2. Tên vật tư',                           keywords: ['TÊN VẬT TƯ', 'TÊN SẢN PHẨM', 'MÔ TẢ', 'TEN_VT', 'TENVT', 'DESCRIPTION'] },
  { key: 'thong_so_kt',   label: '3. Quy cách / Thông số KT / Part No',    keywords: ['THÔNG SỐ', 'QUY CÁCH', 'MODEL', 'PART NO', 'THONG_SO'] },
  { key: 'dvt',           label: '4. Đơn vị tính (ĐVT)',                     keywords: ['ĐƠN VỊ TÍNH', 'ĐVT', 'UNIT', 'DON_VI_TINH'] },
  { key: 'so_luong',      label: '5. Số lượng',                             keywords: ['SỐ LƯỢNG', 'SL', 'QTY', 'QUANTITY'] },
  { key: 'don_gia',       label: '6. Đơn giá ERP (chưa VAT)',               keywords: ['ĐƠN GIÁ', 'GIÁ MUA', 'UNIT PRICE', 'DON_GIA', 'GIÁ'] },
  { key: 'thanh_tien',    label: '7. Thành tiền',                           keywords: ['THÀNH TIỀN', 'TỔNG TIỀN', 'TOTAL', 'AMOUNT'] },
  { key: 'so_hop_dong',   label: '8. Số Hợp Đồng (Căn cứ pháp lý)',         keywords: ['SỐ HỢP ĐỒNG', 'HỢP ĐỒNG', 'SỐ HĐ', 'PO NO', 'CONTRACT'] },
  { key: 'ngay_ky_hd',    label: '9. Ngày Ký Hợp Đồng',                     keywords: ['NGÀY KÝ', 'NGÀY HĐ', 'NGÀY KÝ HỢP ĐỒNG', 'CONTRACT DATE'] },
  { key: 'so_phieu_nhap', label: '10. Số Chứng Từ / Phiếu Nhập Kho',       keywords: ['SỐ CHỨNG TỪ', 'SỐ PHIẾU', 'PHIẾU NHẬP', 'DOC NO', 'RECEIPT'] },
  { key: 'ngay_nhap_kho', label: '11. Ngày Nhập Kho',                       keywords: ['NGÀY CHỨNG TỪ', 'NGÀY NHẬP', 'NGÀY KHO', 'RECEIPT DATE'] },
  { key: 'nha_thau',      label: '12. Tên Nhà Thầu / Đơn Vị Cung Cấp',      keywords: ['NHÀ THẦU', 'CUNG CẤP', 'NHÀ CUNG CẤP', 'SUPPLIER', 'VENDOR'] },
  { key: 'ghi_chu',       label: '13. Ghi Chú / Diễn Giải',                 keywords: ['DIỄN GIẢI', 'GHI CHÚ', 'NỘI DUNG', 'REMARK', 'NOTE'] }
];

export default function ERPConfigModal({ isOpen, onClose, onConfigSaved }) {
  const toast = useToast();
  const [filePath, setFilePath] = useState('');
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordCount, setRecordCount] = useState(0);

  // Initial load: check status
  useEffect(() => {
    if (isOpen) {
      fetch('/api/erp/config-status')
        .then(r => r.json())
        .then(data => {
          if (data.file_path) {
            setFilePath(data.file_path);
            if (data.file_exists) {
              previewColumns(data.file_path, data.mapping);
            }
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const previewColumns = async (path, existingMapping = null) => {
    if (!path) return;
    setLoading(true);
    try {
      const res = await fetch('/api/erp/preview-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: path })
      });
      const data = await res.json();
      if (data.success) {
        setHeaders(data.headers || []);
        if (existingMapping && Object.keys(existingMapping).length > 0) {
          setMapping(existingMapping);
        } else {
          autoDetectMapping(data.headers || []);
        }
      } else {
        toast.error(data.message || 'Không thể đọc file Excel');
      }
    } catch (e) {
      toast.error('Lỗi đọc tiêu đề file Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/erp/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setFilePath(data.uploaded_path);
        setHeaders(data.headers || []);
        autoDetectMapping(data.headers || []);
        toast.success(`Đã tải lên file [${file.name}] thành công!`);
      } else {
        toast.error(data.message || 'Lỗi tải file');
      }
    } catch (err) {
      toast.error('Lỗi tải file Excel');
    } finally {
      setUploading(false);
    }
  };

  const autoDetectMapping = (colHeaders) => {
    const newMapping = {};
    ERP_FIELDS.forEach(field => {
      for (const col of colHeaders) {
        const colUpper = (col || '').toUpperCase().strip ? (col || '').toUpperCase().strip() : String(col || '').toUpperCase();
        if (field.keywords.some(kw => colUpper.includes(kw))) {
          newMapping[field.key] = col;
          break;
        }
      }
    });
    setMapping(newMapping);
    toast.success('Đã tự động gợi ý ánh xạ các cột phù hợp!');
  };

  const handleFieldChange = (fieldKey, value) => {
    setMapping(prev => ({ ...prev, [fieldKey]: value }));
  };

  const handleSave = async () => {
    if (!filePath) {
      toast.error('Vui lòng chọn hoặc dán đường dẫn file Excel ERP!');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/erp/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, mapping })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        if (onConfigSaved) onConfigSaved(data);
        onClose();
      } else {
        toast.error(data.message || 'Lưu thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#003366] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-teal-300" />
            <div>
              <h2 className="font-bold text-sm tracking-wide uppercase">Cấu hình CSDL Kế toán & Ánh xạ 13 Cột ERP</h2>
              <p className="text-[11px] text-teal-200">Tải file hoặc chọn đường dẫn Excel, sau đó ghép 13 cột để chứng minh pháp lý giá</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Scrollable */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto bg-slate-50">
          
          {/* Step 1: File Source Selection */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-blue-600" /> Bước 1: Nguồn dữ liệu File Excel ERP
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option A: Upload File */}
              <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-4 text-center bg-slate-50 hover:bg-teal-50/40 transition flex flex-col items-center justify-center gap-2 relative cursor-pointer">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-teal-600" />
                )}
                <div>
                  <strong className="text-xs text-slate-800 block">Kéo thả hoặc Bấm Tải lên file Excel mới</strong>
                  <span className="text-[10.5px] text-slate-500">Chấp nhận file định dạng .xlsx, .xls</span>
                </div>
              </div>

              {/* Option B: Enter Manual File Path */}
              <div className="flex flex-col justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 gap-2">
                <label className="text-xs font-bold text-slate-700 block">Hoặc Dán/Nhập đường dẫn file trên máy tính/OneDrive:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    placeholder="D:\OneDrive\ERP.xlsx..."
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    onClick={() => previewColumns(filePath)}
                    disabled={loading}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Đọc Cột'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: 13-Column Mapping Table */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-purple-600" /> Bước 2: Ánh xạ 13 Cột Chứng Minh Pháp Lý Nguồn Gốc Giá ERP
              </h3>
              {headers.length > 0 && (
                <button
                  onClick={() => autoDetectMapping(headers)}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition"
                >
                  <Wand2 className="w-3.5 h-3.5" /> 🪄 Auto Detect Cột
                </button>
              )}
            </div>

            {headers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Chưa có danh sách cột. Hãy tải lên file Excel hoặc nhập đường dẫn và bấm "Đọc Cột" ở Bước 1.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b z-10">
                    <tr>
                      <th className="py-2.5 px-3 border-r w-1/2">13 Trường Dữ Liệu Thẩm Định Giá ERP</th>
                      <th className="py-2.5 px-3">Cột Tương Ứng Trong File Excel Của Bạn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ERP_FIELDS.map(field => {
                      const currentVal = mapping[field.key] || '';
                      const isMapped = Boolean(currentVal);
                      return (
                        <tr key={field.key} className={`transition ${isMapped ? 'bg-emerald-50/20' : 'bg-white'}`}>
                          <td className="py-2 px-3 border-r font-semibold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              {field.label}
                              {isMapped ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 px-3">
                            <select
                              value={currentVal}
                              onChange={e => handleFieldChange(field.key, e.target.value)}
                              className={`w-full px-2.5 py-1 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium ${
                                isMapped ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950 font-bold' : 'border-slate-300 bg-white text-slate-600'
                              }`}
                            >
                              <option value="">-- Bỏ qua / Không chọn --</option>
                              {headers.map((h, hIdx) => (
                                <option key={hIdx} value={h}>
                                  Cột: {h || `(Cột ${hIdx + 1})`}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {Object.keys(mapping).filter(k => mapping[k]).length}/13 trường đã được ánh xạ
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
            >
              Hủy
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !filePath}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Lưu Cấu Hình & Nạp CSDL ERP
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
