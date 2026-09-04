import React from 'react';
import { Layers, Table2, Search, FolderOpen, Bookmark, Save, Download, Upload, FileSpreadsheet, Building2, Database, Globe } from 'lucide-react';

export default function HeaderNav({ activeView, setActiveView, dossierName, onOpenProjects, onSaveAs, onSaveProject, onUploadExcel, onExportExcel, erpStatus, onOpenErpConfig, imisStatus, onOpenImisConfig, mscStatus, onOpenMscConfig }) {
  const isErpOk = erpStatus?.is_configured;
  const isImisOk = imisStatus?.is_connected;
  const isMscOk = mscStatus?.active;

  return (
    <header className="bg-[#003366] text-white px-5 py-2.5 shrink-0 shadow-md z-30 flex items-center justify-between">
      {/* Brand & Project Title */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-300/30 flex items-center justify-center font-black text-teal-300 text-sm tracking-wider">
            EVN
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wide uppercase">Hệ Thống Thẩm Định Dự Toán</h1>
            <p className="text-[10px] text-teal-200 font-medium">Nhiệt Điện Vĩnh Tân 4 - Cơ Sở Giá KHVT & TTĐ</p>
          </div>
        </div>

        <div className="h-6 w-px bg-blue-800/80"></div>

        {/* Dossier Name */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-blue-200">Hồ sơ:</span>
          <strong className="text-xs font-bold text-white max-w-xs truncate" title={dossierName}>
            {dossierName || "Gói 308 - Mua sắm vật tư SCTX đợt 8 năm 2026"}
          </strong>
        </div>

        <div className="h-6 w-px bg-blue-800/80"></div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-700/60 text-xs font-bold">
          <button
            onClick={() => setActiveView('quotes')}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              activeView === 'quotes'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-teal-300" /> 1. Báo Giá Gốc (PDF)
          </button>
          <button
            onClick={() => setActiveView('grid')}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              activeView === 'grid'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Table2 className="w-3.5 h-3.5 text-blue-300" /> 2. Ma Trận Dự Toán
          </button>
          <button
            onClick={() => setActiveView('inspector')}
            className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 ${
              activeView === 'inspector'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-amber-300" /> 3. Duyệt Chi Tiết
          </button>
        </div>
      </div>

      {/* Global Actions */}
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        
        {/* MSC Status Badge */}
        <button
          onClick={onOpenMscConfig}
          className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition font-bold ${
            isMscOk
              ? 'bg-orange-900/60 hover:bg-orange-800 border-orange-500/50 text-orange-200'
              : 'bg-amber-900/60 hover:bg-amber-800 border-amber-500/60 text-amber-200 animate-pulse'
          }`}
          title="Bấm để cấu hình chuỗi cURL Session Mua Sắm Công (e-GP)"
        >
          <Globe className={`w-3.5 h-3.5 ${isMscOk ? 'text-orange-400' : 'text-amber-400'}`} />
          {isMscOk ? (
            <span>🌐 MSC: 200 OK</span>
          ) : (
            <span>🔴 MSC: Hết hạn</span>
          )}
        </button>

        {/* IMIS Status Badge */}
        <button
          onClick={onOpenImisConfig}
          className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition font-bold ${
            isImisOk
              ? 'bg-purple-900/60 hover:bg-purple-800 border-purple-500/50 text-purple-200'
              : 'bg-amber-900/60 hover:bg-amber-800 border-amber-500/60 text-amber-200 animate-pulse'
          }`}
          title="Bấm để kiểm tra / đăng nhập Token API EVN IMIS"
        >
          <Database className={`w-3.5 h-3.5 ${isImisOk ? 'text-purple-400' : 'text-amber-400'}`} />
          {isImisOk ? (
            <span>🟢 IMIS: Đã kết nối</span>
          ) : (
            <span>🔴 IMIS: Mất kết nối</span>
          )}
        </button>

        {/* ERP DB Status Badge */}
        <button
          onClick={onOpenErpConfig}
          className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1.5 transition font-bold ${
            isErpOk
              ? 'bg-emerald-900/60 hover:bg-emerald-800 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-900/60 hover:bg-amber-800 border-amber-500/60 text-amber-200 animate-pulse'
          }`}
          title="Bấm để cấu hình CSDL Kế toán ERP 13 cột"
        >
          <Database className={`w-3.5 h-3.5 ${isErpOk ? 'text-emerald-400' : 'text-amber-400'}`} />
          {isErpOk ? (
            <span>🟢 ERP: {erpStatus?.record_count || 0} HĐ</span>
          ) : (
            <span>🔴 ERP: Chưa cấu hình</span>
          )}
        </button>

        <div className="h-5 w-px bg-blue-800/80 mx-0.5"></div>

        <button
          onClick={onOpenProjects}
          className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-md border border-white/20 flex items-center gap-1 transition"
          title="Mở dự án đã lưu"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-300" /> Mở Dự Án
        </button>

        <button
          onClick={onSaveAs}
          className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-md border border-white/20 flex items-center gap-1 transition"
          title="Lưu thành dự án mới"
        >
          <Bookmark className="w-3.5 h-3.5 text-purple-300" /> Save As
        </button>

        <button
          onClick={onSaveProject}
          className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-md border border-white/20 flex items-center gap-1 transition"
          title="Lưu nhanh (Ctrl + S)"
        >
          <Save className="w-3.5 h-3.5 text-indigo-300" /> Lưu Nhanh
        </button>

        <div className="h-5 w-px bg-blue-800/80 mx-1"></div>

        <a
          href="/api/download-template"
          className="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-md border border-white/20 flex items-center gap-1 transition"
          title="Tải mẫu Excel 13 cột"
        >
          <Download className="w-3.5 h-3.5 text-blue-300" /> Tải Mẫu
        </a>

        <button
          onClick={onUploadExcel}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1 shadow-xs transition"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-200" /> Nạp Excel
        </button>

        <a
          href="/api/export-excel"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1 shadow-xs transition ml-1"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất Excel
        </a>
      </div>
    </header>
  );
}
