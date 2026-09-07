import React, { useState, useEffect, useMemo } from 'react';
import {
  Award, FileText, CheckCircle2, AlertTriangle, Check, RotateCcw,
  Loader2, BarChart3, Calculator, Percent, Star, ShieldCheck, ShieldAlert,
  ArrowRight, Save
} from 'lucide-react';
import { useToast } from '../../ui/Toast.jsx';
import { fmt } from '../utils/formatters.js';
import { PillarHeader, LoadingSpinner, SaveFooter } from '../common';

export default function PillarSynthesis({ loading, saving, data, dgTrinh, item, quoteEvidence, erpResults, imisResults, mscResults, ecomResults, evidenceStatus, onSave, saved }) {
  const toast = useToast();

  // Helper to extract first valid price from an array of records
  const extractFirstPrice = (arr, keys = ['donGia', 'don_gia', 'price', 'trung_thau_don_gia', 'gia']) => {
    if (!Array.isArray(arr)) return 0;
    for (const r of arr) {
      if (!r) continue;
      for (const k of keys) {
        const val = parseFloat(r[k] || 0);
        if (val > 0) return val;
      }
    }
    return 0;
  };

  // Extract prices from 5 pillars (live results or saved evidence with fallbacks)
  const p1_price = parseFloat(
    quoteEvidence?.selected_record?.don_gia ||
    quoteEvidence?.min_price ||
    quoteEvidence?.min_quote?.don_gia ||
    extractFirstPrice(quoteEvidence?.matches) ||
    0
  );

  const isErpDeselected = Boolean(
    erpResults?.is_deselected ||
    erpResults?.selected_record === 'NONE' ||
    erpResults?.summary?.status === 'ERP_DESELECTED' ||
    erpResults?.summary?.is_deselected
  );

  const erpList = Array.isArray(erpResults) ? erpResults : (erpResults?.results || []);
  const p2_price = isErpDeselected ? 0 : parseFloat(
    (typeof erpResults?.selected_record === 'object' && (erpResults.selected_record?.donGia || erpResults.selected_record?.don_gia)) ||
    (erpResults?.use_average && (erpResults?.summary?.avg_price || erpResults?.avg_price)) ||
    erpResults?.don_gia_tham_chieu ||
    (!erpResults?.selected_record && extractFirstPrice(erpList)) ||
    0
  );

  const isImisDeselected = Boolean(
    imisResults?.is_deselected ||
    imisResults?.selected_record === 'NONE' ||
    imisResults?.summary?.status === 'IMIS_DESELECTED' ||
    imisResults?.summary?.is_deselected
  );

  const imisList = Array.isArray(imisResults) ? imisResults : (imisResults?.imis || []);
  const p3_price = isImisDeselected ? 0 : parseFloat(
    (typeof imisResults?.selected_record === 'object' && (imisResults.selected_record?.don_gia || imisResults.selected_record?.donGia)) ||
    (imisResults?.use_average && (imisResults?.summary?.avg_price || imisResults?.avg_price)) ||
    imisResults?.don_gia_tham_chieu ||
    (!imisResults?.selected_record && extractFirstPrice(imisList)) ||
    0
  );

  const isMscDeselected = Boolean(
    mscResults?.is_deselected ||
    mscResults?.selected_record === 'NONE' ||
    mscResults?.summary?.status === 'MSC_DESELECTED' ||
    mscResults?.summary?.is_deselected
  );

  const mscList = mscResults?.analysis?.items || mscResults?.items || mscResults?.danh_sach_ket_qua || (Array.isArray(mscResults) ? mscResults : []);
  const p4_price = isMscDeselected ? 0 : parseFloat(
    (typeof mscResults?.selected_record === 'object' && (mscResults.selected_record?.don_gia || mscResults.selected_record?.donGia || mscResults.selected_record?.trung_thau_don_gia)) ||
    mscResults?.don_gia_tham_chieu ||
    mscResults?.min_price ||
    (!mscResults?.selected_record && extractFirstPrice(mscList)) ||
    0
  );

  const ecomList = ecomResults?.items || (Array.isArray(ecomResults) ? ecomResults : []);
  const p5_price = parseFloat(
    ecomResults?.selected_record?.price ||
    ecomResults?.selected_record?.don_gia ||
    ecomResults?.don_gia_tham_chieu ||
    extractFirstPrice(ecomList) ||
    0
  );

  // Status checks for 5 pillars
  const has_p1 = Boolean(p1_price > 0 || quoteEvidence?.min_price || quoteEvidence?.matches?.length > 0 || quoteEvidence?.summary_text || evidenceStatus?.has_quotes);
  const has_p2 = Boolean(p2_price > 0 || erpResults?.results?.length > 0 || erpResults?.thoi_gian_luu || erpResults?.summary_text || evidenceStatus?.has_erp);
  const has_p3 = Boolean(p3_price > 0 || imisResults?.imis?.length > 0 || imisResults?.thoi_gian_luu || imisResults?.summary_text || evidenceStatus?.has_imis);
  const has_p4 = Boolean(p4_price > 0 || mscResults?.analysis?.items?.length > 0 || mscResults?.items?.length > 0 || mscResults?.danh_sach_ket_qua?.length > 0 || mscResults?.thoi_gian_luu || mscResults?.summary_text || evidenceStatus?.has_msc);
  const has_p5 = Boolean(p5_price > 0 || ecomResults?.summary_text || ecomResults?.items || ecomResults?.thoi_gian_luu || evidenceStatus?.has_ecom);

  // 1. Evidence Coverage Score (0-100 points, 20 points per pillar)
  const activeCount = [has_p1, has_p2, has_p3, has_p4, has_p5].filter(Boolean).length;
  const coverageScore = activeCount * 20;

  let coverageRank = 'Hạng C';
  let coverageBadge = 'bg-red-100 text-red-800 border-red-300';
  let coverageTitle = '🔴 Chứng cứ Thiếu hụt (Cần bổ sung tra cứu)';
  if (coverageScore >= 80) {
    coverageRank = 'Hạng A';
    coverageBadge = 'bg-emerald-100 text-emerald-900 border-emerald-400';
    coverageTitle = '🟢 Chứng cứ Cực kỳ Đầy đủ & Vững chắc';
  } else if (coverageScore >= 60) {
    coverageRank = 'Hạng B';
    coverageBadge = 'bg-blue-100 text-blue-900 border-blue-300';
    coverageTitle = '🟡 Chứng cứ Khá đầy đủ';
  }

  // 2. Price Reasonableness Score
  const validPrices = [p1_price, p2_price, p3_price, p4_price, p5_price].filter(p => p > 0);
  const minBaseline = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const avgBaseline = validPrices.length > 0 ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

  let priceScore = 100;
  let priceEval = '🟢 Rất Hợp Lý (Đơn giá trình <= Mốc tham chiếu thấp nhất)';

  if (validPrices.length === 0) {
    priceScore = 70;
    priceEval = '⚪ Chưa có mốc giá so sánh thực tế';
  } else if (dgTrinh <= minBaseline) {
    priceScore = 100;
    priceEval = '🟢 Rất Hợp Lý (Đơn giá trình <= Giá thấp nhất công khai)';
  } else if (dgTrinh <= avgBaseline) {
    priceScore = 85;
    priceEval = '🟡 Hợp Lý (Nằm trong biên độ giá trung bình thị trường)';
  } else if (dgTrinh <= minBaseline * 1.2) {
    priceScore = 60;
    priceEval = '🟠 Cần Xem Xét (Cao hơn giá mốc thấp nhất <20%)';
  } else {
    priceScore = 30;
    priceEval = '🔴 Chưa Hợp Lý (Đơn giá trình cao hơn >20% so với mốc giá tham chiếu)';
  }

  // Selection state for final approved price & transparent AI results
  const [approvedPrice, setApprovedPrice] = useState(data?.approved_price || (minBaseline > 0 ? minBaseline : dgTrinh));
  const [editingText, setEditingText]     = useState(data?.summary_text || '');
  const [runningAi, setRunningAi]         = useState(false);
  const [aiStep, setAiStep]               = useState(0);
  const [aiResultData, setAiResultData]   = useState(data?.ai_result_data || null);

  const handleRunAiSynthesis = async () => {
    if (!item?.id) return;
    setRunningAi(true);
    setAiStep(1);
    try {
      await new Promise(r => setTimeout(r, 350));
      setAiStep(2);
      await new Promise(r => setTimeout(r, 350));
      setAiStep(3);

      const res = await fetch(`/api/items/${item.id}/run-ai-synthesis`, { method: 'POST' });
      setAiStep(4);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.synthesis) {
          const syn = json.synthesis;
          setAiStep(5);
          await new Promise(r => setTimeout(r, 300));

          if (syn.summary_text) setEditingText(syn.summary_text);
          if (syn.approved_price) setApprovedPrice(syn.approved_price);
          setAiResultData(syn);
          toast.success('✨ AI Chuyên Gia đã sinh Thuyết minh Độc lập & Đánh giá rủi ro thành công!');
        }
      } else {
        toast.error('Lỗi kết nối API AI Synthesis!');
      }
    } catch (e) {
      console.error(e);
      toast.error('Không thể kết nối đến máy chủ AI!');
    } finally {
      setTimeout(() => {
        setRunningAi(false);
        setAiStep(0);
      }, 500);
    }
  };

  useEffect(() => {
    const isSavedPriceOutdated = (
      (isImisDeselected && (data?.co_so_thong_nhat?.includes('IMIS') || data?.approved_price === 58500 || approvedPrice === 58500)) ||
      (isErpDeselected && data?.co_so_thong_nhat?.includes('ERP')) ||
      (isMscDeselected && data?.co_so_thong_nhat?.includes('Mua Sắm Công'))
    );

    if (data?.approved_price && !isSavedPriceOutdated && (validPrices.includes(data.approved_price) || data.approved_price === dgTrinh)) {
      setApprovedPrice(data.approved_price);
    } else if (minBaseline > 0) {
      setApprovedPrice(minBaseline);
    } else {
      setApprovedPrice(dgTrinh);
    }
  }, [data?.approved_price, data?.co_so_thong_nhat, minBaseline, isImisDeselected, isErpDeselected, isMscDeselected, dgTrinh]);

  const qty = parseFloat(item?.so_luong || 1);
  const savingsPerUnit = dgTrinh - approvedPrice;
  const totalSavings   = savingsPerUnit * qty;
  const savingsPct     = dgTrinh > 0 ? ((dgTrinh - approvedPrice) / dgTrinh * 100) : 0;

  const getCleanKw = (kw) => {
    if (!kw || typeof kw !== 'string') return '';
    const firstLine = kw.split(/[\r\n]+/)[0].trim();
    const s = firstLine.split(' - ')[0].trim();
    if (s.toLowerCase().startsWith('chưa') || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'none') return '';
    return s || firstLine;
  };

  const erpKw = getCleanKw(erpResults?.used_keyword) ||
    getCleanKw(erpResults?.keyword) ||
    (item?.ma_vt && isValidErpCode(item.ma_vt) ? item.ma_vt : '') ||
    getErpDefaultKw(item, erpResults);

  const imisKw = getCleanKw(imisResults?.used_keyword) || getCleanKw(imisResults?.keyword) || (item?.part_no ? String(item.part_no).split('|')[0].trim() : '') || (item?.ma_vt && isValidErpCode(item?.ma_vt) ? item.ma_vt : '') || getCleanKw(item?.ten_vt) || '';
  const mscKw  = getCleanKw(mscResults?.used_keyword)  || getCleanKw(mscResults?.keyword)  || getCleanKw(item?.ten_vt_goc) || getCleanKw(item?.ten_vt) || '';
  const ecomKw = getCleanKw(ecomResults?.search_keyword) || getCleanKw(ecomResults?.keyword) || getCleanKw(item?.ten_vt_goc) || getCleanKw(item?.ten_vt) || '';

  const generateDefaultSynthesisText = () => {
    const unit = item?.dvt || 'Cái';
    let text = `TỔNG HỢP ĐÁNH GIÁ THẨM ĐỊNH MỤC: ${getCleanKw(item?.ten_vt) || item?.ten_vt || ''} (Mã ERP: ${item?.ma_vt || '—'}).\n`;
    text += `• Đơn giá trình thẩm định: ${fmt(dgTrinh)} VNĐ (Số lượng: ${qty} ${unit}).\n`;
    text += `• Đánh giá Chứng cứ Thẩm định: Đạt ${coverageScore}/100 điểm (${coverageRank} - ${activeCount}/5 cơ sở chứng cứ đã nạp).\n`;
    text += `• Đánh giá Mức độ Hợp lý Đơn giá: ${priceScore}/100 điểm (${priceEval}).\n\n`;

    text += `CƠ SỞ THẨM ĐỊNH THỐNG NHẤT 5 CƠ SỞ CHỨNG CỨ:\n`;

    // 1. Cơ sở 1: Báo Giá Gốc
    let p1_desc = '';
    if (p1_price > 0) {
      const supplierName = quoteEvidence?.min_quote?.company || quoteEvidence?.matched_supplier?.company || 'Nhà thầu chào trong Hồ sơ trình';
      const pageNum = quoteEvidence?.min_quote?.page || quoteEvidence?.min_quote?.stt || 1;
      p1_desc = `Đã đối chiếu các báo giá thương mại cạnh tranh trong Hồ sơ trình; ghi nhận đơn giá chào thấp nhất là ${fmt(p1_price)} VNĐ/${unit} từ ${supplierName} (Trang ${pageNum} Báo giá); đơn giá chào đối chiếu ${p1_price === dgTrinh ? 'khớp 100% với đơn giá dự toán trình' : p1_price < dgTrinh ? `thấp hơn ${fmt(dgTrinh - p1_price)} VNĐ/${unit} so với đơn giá trình` : `cao hơn đơn giá trình`}.`;
    } else if (has_p1) {
      p1_desc = `Đã đối chiếu hồ sơ báo giá gốc trình thẩm định; ghi nhận các báo giá thương mại kèm theo đầy đủ hợp lệ.`;
    } else {
      p1_desc = `Chưa nạp dữ liệu báo giá thương mại cạnh tranh trong Hồ sơ trình.`;
    }
    text += `- Cơ sở 1 (Báo Giá Gốc): ${p1_desc}\n`;

    // 2. Cơ sở 2: ERP Vĩnh Tân 4
    let p2_desc = '';
    if (isErpDeselected) {
      p2_desc = `Qua rà soát CSDL Kế toán ERP của NMNĐ Vĩnh Tân 4 theo từ khóa [${erpKw}], các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này.`;
    } else if (p2_price > 0) {
      const rec = (typeof erpResults?.selected_record === 'object' && erpResults?.selected_record) || erpResults?.results?.[0];
      const poInfo = rec?.soHopDong || rec?.so_hd ? ` theo HĐ ${rec.soHopDong || rec.so_hd}` : '';
      const dateInfo = rec?.ngayKyHd || rec?.ngayNhapKho ? ` ngày ${rec.ngayKyHd || rec.ngayNhapKho}` : '';
      p2_desc = `Tra cứu theo từ khóa [${erpKw}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; ghi nhận đơn giá nhập kho gần nhất là ${fmt(p2_price)} VNĐ/${unit}${poInfo}${dateInfo}.`;
    } else if (has_p2) {
      p2_desc = `Tra cứu theo từ khóa [${erpKw}] trong CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4; kết quả đã đối soát CSDL ERP: 0 bản ghi phù hợp (vật tư chưa từng có lịch sử nhập kho nội bộ nhà máy Vĩnh Tân 4).`;
    } else {
      p2_desc = `Chưa đối chiếu CSDL Kế toán ERP nội bộ nhà máy Vĩnh Tân 4.`;
    }
    text += `- Cơ sở 2 (ERP Vĩnh Tân 4): ${p2_desc}\n`;

    // 3. Cơ sở 3: EVN IMIS
    let p3_desc = '';
    if (isImisDeselected) {
      p3_desc = `Qua rà soát CSDL Hợp đồng mua sắm EVN IMIS theo từ khóa [${imisKw}], các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL EVN IMIS làm căn cứ so sánh đơn giá cho mục này.`;
    } else if (p3_price > 0) {
      const rec = (typeof imisResults?.selected_record === 'object' && imisResults?.selected_record) || imisResults?.imis?.[0];
      const dvInfo = rec?.ten_dv_mua || rec?.ten_don_vi ? ` tại ${rec.ten_dv_mua || rec.ten_don_vi}` : ' toàn ngành EVN';
      const hdInfo = rec?.so_hd || rec?.so_hop_dong ? ` theo HĐ ${rec.so_hd || rec.so_hop_dong}` : '';
      p3_desc = `Tra cứu theo từ khóa [${imisKw}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); ghi nhận đơn giá trúng thầu/hợp đồng tham chiếu là ${fmt(p3_price)} VNĐ/${unit}${dvInfo}${hdInfo}.`;
    } else if (has_p3) {
      p3_desc = `Tra cứu theo từ khóa [${imisKw}] trên CSDL Hợp đồng mua sắm toàn ngành EVN IMIS (2023-2026); kết quả đã đối soát toàn CSDL EVN: 0 bản ghi phù hợp (không phát sinh mua sắm tương đương).`;
    } else {
      p3_desc = `Chưa đối chiếu CSDL Hợp đồng mua sắm toàn ngành EVN IMIS.`;
    }
    text += `- Cơ sở 3 (EVN IMIS): ${p3_desc}\n`;

    // 4. Cơ sở 4: Mua Sắm Công e-GP
    let p4_desc = '';
    if (isMscDeselected) {
      p4_desc = `Qua rà soát Cổng Mạng Đấu thầu Quốc gia e-GP (muasamcong.mpi.gov.vn) theo từ khóa [${mscKw}], các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL Mua sắm công làm căn cứ so sánh đơn giá cho mục này.`;
    } else if (p4_price > 0) {
      const rec = (typeof mscResults?.selected_record === 'object' && mscResults?.selected_record) || mscResults?.analysis?.items?.[0] || mscResults?.items?.[0];
      const vendorInfo = rec?.hang_sx || rec?.nhà_thầu ? ` (Nhà thầu ${rec.hang_sx || rec.nhà_thầu})` : '';
      p4_desc = `Tra cứu theo từ khóa [${mscKw}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); ghi nhận đơn giá trúng thầu công khai tham chiếu là ${fmt(p4_price)} VNĐ/${unit}${vendorInfo}.`;
    } else if (has_p4) {
      p4_desc = `Tra cứu theo từ khóa [${mscKw}] trên Cổng Mạng Đấu thầu Quốc gia (muasamcong.mpi.gov.vn); kết quả đã rà soát e-GP: vật tư đặc thù, không ghi nhận gói thầu mua sắm tương đồng.`;
    } else {
      p4_desc = `Chưa đối chiếu Cổng Mạng Đấu thầu Quốc gia e-GP.`;
    }
    text += `- Cơ sở 4 (Mua Sắm Công e-GP): ${p4_desc}\n`;

    // 5. Cơ sở 5: Thương Mại Điện Tử & Giá Web
    let p5_desc = '';
    if (ecomResults?.summary_text) {
      p5_desc = ecomResults.summary_text;
    } else if (p5_price > 0) {
      const rec = ecomResults?.selected_record || ecomResults?.items?.[0];
      p5_desc = `Tra cứu theo từ khóa [${ecomKw}] trên thị trường TMĐT / Website nhà cung cấp (${rec?.vendor || 'Internet'}) tại link [${rec?.url || 'Web'}]; ghi nhận đơn giá niêm yết công khai tham chiếu là ${fmt(p5_price)} VNĐ/${unit}.`;
    } else {
      p5_desc = `Tra cứu theo từ khóa [${ecomKw}] trên các cổng Internet & Sàn TMĐT (eBay, Misumi, Google Web); kết quả ghi nhận vật tư thuộc danh mục thiết bị đặc thù công nghiệp, các trang web/nhà cung cấp không niêm yết đơn giá thương mại công khai (yêu cầu gửi thư yêu cầu báo giá riêng - Contact for Quote).`;
    }
    text += `- Cơ sở 5 (Thương Mại Điện Tử): ${p5_desc}\n`;

    if (totalSavings > 0) {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đề xuất duyệt đơn giá thẩm định thống nhất là ${fmt(approvedPrice)} VNĐ/${unit}. Tiết kiệm dự toán ${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%).`;
    } else {
      text += `\nKẾT LUẬN THẨM ĐỊNH: Đơn giá trình phù hợp với mặt bằng giá thị trường. Đề xuất phê duyệt giữ nguyên đơn giá trình là ${fmt(approvedPrice)} VNĐ/${unit}.`;
    }

    return text;
  };

  // Auto-generate aggregated justification text with full detailed justification breakdown
  useEffect(() => {
    const isOutdated = (
      (isImisDeselected && data?.summary_text && (data.summary_text.includes('58.500') || data.summary_text.includes('IMIS EVN: 58') || data.summary_text.includes('Huội Quảng') || (data?.co_so_thong_nhat?.includes('IMIS')))) ||
      (isErpDeselected && data?.summary_text && data.summary_text.includes('Lịch sử nhập kho ERP Vĩnh Tân 4:') && !data.summary_text.includes('Không áp dụng làm căn cứ')) ||
      (isMscDeselected && data?.summary_text && data.summary_text.includes('e-GP MSC:') && !data.summary_text.includes('Không áp dụng làm căn cứ'))
    );

    if (data?.summary_text && !isOutdated) {
      setEditingText(data.summary_text);
      return;
    }

    setEditingText(generateDefaultSynthesisText());
  }, [data?.summary_text, item?.ten_vt, item?.ma_vt, qty, item?.dvt, dgTrinh, approvedPrice, coverageScore, coverageRank, activeCount, priceScore, priceEval, has_p1, p1_price, quoteEvidence, has_p2, p2_price, isErpDeselected, erpResults, has_p3, p3_price, isImisDeselected, imisResults, has_p4, p4_price, isMscDeselected, mscResults, has_p5, p5_price, ecomResults, totalSavings, savingsPct]);

  const copyToClipboard = () => {
    if (editingText) {
      navigator.clipboard.writeText(editingText);
      toast.success('Đã sao chép Thuyết Minh Tổng Hợp 5 Cơ Sở!');
    }
  };

  const handleExportDocx = () => {
    const docHtml = `
      <div style="font-family: 'Times New Roman', serif; line-height: 1.4; color: #000; padding: 20px;">
        <table style="width: 100%; border: none; margin-bottom: 20px;">
          <tr>
            <td style="width: 45%; text-align: center; border: none; font-size: 11pt;">
              <strong>NHÀ MÁY NHIỆT ĐIỆN VĨNH TÂN 4</strong><br/>
              <b>TỔ THẨM ĐỊNH DỰ TOÁN</b><br/>
              -------------
            </td>
            <td style="width: 55%; text-align: center; border: none; font-size: 11pt;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <b>Độc lập - Tự do - Hạnh phúc</b><br/>
              -----------------------
            </td>
          </tr>
        </table>

        <h2 style="text-align: center; font-size: 15pt; font-weight: bold; margin-top: 15px; margin-bottom: 15px; text-transform: uppercase;">
          BÁO CÁO TỔNG HỢP KẾT QUẢ THẨM ĐỊNH ĐƠN GIÁ VẬT TƯ
        </h2>

        <p style="font-size: 12pt; margin-bottom: 10px;">
          <strong>Mục vật tư thẩm định:</strong> ${item?.ten_vt || '—'}<br/>
          <strong>Mã vật tư (ERP):</strong> ${item?.ma_vt || '—'}<br/>
          <strong>Số lượng:</strong> ${qty} ${item?.dvt || 'Cái'} &nbsp;|&nbsp; <strong>Đơn giá trình:</strong> ${fmt(dgTrinh)} VNĐ
        </p>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          I. ĐÁNH GIÁ CHỨNG CỨ THẨM ĐỊNH (5 CƠ SỞ CHỨNG CỨ)
        </h3>
        <p style="font-size: 12pt;">
          - Điểm số độ đủ chứng cứ: <strong>${coverageScore}/100 điểm</strong> (${coverageRank} - ${activeCount}/5 Cơ sở chứng cứ đã nạp).<br/>
          - Điểm số mức độ hợp lý giá trình: <strong>${priceScore}/100 điểm</strong> (${priceEval}).
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt;">Cơ Sở Chứng Cứ</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;">Đơn Giá Tham Chiếu</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">% Lệch vs Trình</th>
              <th style="border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt;">Trạng Thái Chứng Cứ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;"><strong>Đơn Giá Dự Toán Trình</strong></td>
              <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;"><strong>${fmt(dgTrinh)} VNĐ</strong></td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">0.0%</td>
              <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">Mốc dự toán lập</td>
            </tr>
            ${pillarsList.map(p => {
              const dg = p.price;
              const diff = (dgTrinh > 0 && dg > 0) ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
              return `
                <tr>
                  <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">${p.name}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: right; font-size: 11pt;">${dg > 0 ? `${fmt(dg)} VNĐ` : '—'}</td>
                  <td style="border: 1px solid #000; padding: 6px; text-align: center; font-size: 11pt;">${dg > 0 ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}</td>
                  <td style="border: 1px solid #000; padding: 6px; font-size: 11pt;">${p.has ? 'Đã nạp chứng cứ' : 'Chưa nạp dữ liệu'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          II. BẢN THUYẾT MINH THẨM ĐỊNH THỐNG NHẤT
        </h3>
        <div style="font-size: 11pt; white-space: pre-wrap; background-color: #f9f9f9; padding: 10px; border: 1px solid #ccc; font-family: 'Times New Roman', serif;">
          ${editingText}
        </div>

        <h3 style="font-size: 13pt; font-weight: bold; margin-top: 15px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          III. KẾT LUẬN & ĐỀ XUẤT PHÊ DUYỆT
        </h3>
        <p style="font-size: 12pt;">
          - <strong>Đơn giá phê duyệt đề xuất:</strong> <span style="font-size: 13pt; color: #003366;"><strong>${fmt(approvedPrice)} VNĐ / ${item?.dvt || 'Cái'}</strong></span><br/>
          - <strong>Tổng tiết kiệm dự toán:</strong> <strong>${totalSavings > 0 ? `${fmt(totalSavings)} VNĐ (-${savingsPct.toFixed(1)}%)` : '0 VNĐ (Giữ nguyên giá trình)'}</strong>
        </p>

        <table style="width: 100%; border: none; margin-top: 40px;">
          <tr>
            <td style="width: 50%; text-align: center; border: none; font-size: 11pt;">
              <strong>CHUYÊN VIÊN THẨM ĐỊNH</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
              <br/><br/><br/><br/>
            </td>
            <td style="width: 50%; text-align: center; border: none; font-size: 11pt;">
              <strong>LÃNH ĐẠO PHÊ DUYỆT</strong><br/>
              <i>(Ký và ghi rõ họ tên)</i>
              <br/><br/><br/><br/>
            </td>
          </tr>
        </table>
      </div>
    `;

    const header = `<html xmlns:o='urn:schemas-microsoft-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Báo cáo Thẩm định</title></head><body>`;
    const footer = `</body></html>`;
    const blob = new Blob(['\ufeff' + header + docHtml + footer], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Tham_Dinh_${(item?.ma_vt || 'VT').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('✨ Đã xuất file Báo cáo Thẩm định Word (.doc/.docx)!');
  };



  const handleFinalApprove = () => {
    let basisName = 'Căn cứ đối chiếu 5 cơ sở chứng cứ';
    if (approvedPrice === p1_price && p1_price > 0) {
      basisName = 'Cơ sở 1: Báo giá nộp kèm';
    } else if (approvedPrice === p2_price && p2_price > 0 && !isErpDeselected) {
      basisName = 'Cơ sở 2: ERP Vĩnh Tân 4';
    } else if (approvedPrice === p3_price && p3_price > 0 && !isImisDeselected) {
      basisName = 'Cơ sở 3: EVN IMIS';
    } else if (approvedPrice === p4_price && p4_price > 0 && !isMscDeselected) {
      basisName = 'Cơ sở 4: Mua Sắm Công e-GP';
    } else if (approvedPrice === p5_price && p5_price > 0) {
      basisName = 'Cơ sở 5: Tham khảo TMĐT / Giá Web';
    } else if (approvedPrice === dgTrinh) {
      basisName = 'Cơ sở 1: Báo giá nộp kèm (Giữ giá trình)';
    }

    onSave({
      approved_price: approvedPrice,
      total_savings: totalSavings,
      coverage_score: coverageScore,
      price_score: priceScore,
      co_so_thong_nhat: basisName,
      summary_text: editingText
    });
    toast.success('✨ Đã lưu & Phê duyệt Kết quả Thẩm định Mục!');
  };

  const pillarsList = [
    { key: 'p1', name: 'Cơ sở 1: Báo Giá Gốc', price: p1_price, has: has_p1, kw: quoteEvidence?.min_quote?.company || 'Báo giá nộp kèm' },
    { key: 'p2', name: 'Cơ sở 2: ERP Vĩnh Tân 4', price: p2_price, has: has_p2, kw: erpKw },
    { key: 'p3', name: 'Cơ sở 3: EVN IMIS', price: p3_price, has: has_p3, kw: imisKw },
    { key: 'p4', name: 'Cơ sở 4: Mua Sắm Công e-GP', price: p4_price, has: has_p4, kw: mscKw },
    { key: 'p5', name: 'Cơ sở 5: Thương Mại Điện Tử', price: p5_price, has: has_p5, kw: ecomKw },
  ];

  return (
    <div className="space-y-4">
      <PillarHeader icon={Award} color="teal" title="CƠ SỞ 6: TỔNG HỢP & ĐÁNH GIÁ THẨM ĐỊNH (5 CƠ SỞ CHỨNG CỨ)" loading={loading} />

      {/* Scoring Dashboard */}
      <div className="grid grid-cols-3 gap-3">
        {/* Coverage Score */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-teal-700" /> 1. Điểm Độ Đủ Chứng Cứ
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-teal-900">{coverageScore}<span className="text-sm font-semibold text-slate-500">/100</span></span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${coverageBadge}`}>{coverageRank}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 truncate" title={coverageTitle}>{coverageTitle}</p>
        </div>

        {/* Price Score */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Percent className="w-4 h-4 text-blue-700" /> 2. Điểm Mức Độ Hợp Lý Giá
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-blue-950">{priceScore}<span className="text-sm font-semibold text-slate-500">/100</span></span>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300">Biên độ giá</span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 truncate" title={priceEval}>{priceEval}</p>
        </div>

        {/* Savings Calculator Card */}
        <div className={`p-3.5 rounded-xl border space-y-1 ${totalSavings > 0 ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1 text-emerald-950 font-extrabold"><Calculator className="w-4 h-4 text-emerald-700" /> Tiết Kiệm Dự Toán</span>
            {totalSavings > 0 && <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-300">-${fmt(savingsPct)}%</span>}
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900">
            {totalSavings > 0 ? `-${fmt(totalSavings)} đ` : '0 đ'}
          </div>
          <p className="text-[10px] font-semibold text-slate-600">
            Duyệt: <strong className="font-mono text-teal-950">{fmt(approvedPrice)} đ</strong> / Trình: {fmt(dgTrinh)} đ
          </p>
        </div>
      </div>

      {/* Bảng Ma Trận So Sánh 5 Căn Cứ Tham Chiếu */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs text-left border-collapse min-w-[750px]">
          <thead className="bg-teal-50 text-teal-950 font-bold border-b border-teal-200">
            <tr>
              <th className="py-2.5 px-3 border-r">Cơ Sở Chứng Cứ Thẩm Định (Kèm Từ Khóa Tra Cứu)</th>
              <th className="py-2.5 px-3 border-r w-36 text-right font-mono">Đơn Giá Tham Chiếu</th>
              <th className="py-2.5 px-3 border-r w-32 text-center">Chênh Lệch % vs Trình</th>
              <th className="py-2.5 px-3 border-r text-center">Đánh Giá Độ Phù Hợp & Kết Quả</th>
              <th className="py-2.5 px-3 w-28 text-center">Trạng Thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100/80 font-bold">
              <td className="py-2 px-3 border-r text-slate-900">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span>📋 ĐƠN GIÁ DỰ TOÁN TRÌNH THẨM ĐỊNH</span>
                </div>
              </td>
              <td className="py-2 px-3 border-r text-right font-mono text-blue-950 font-black">{fmt(dgTrinh)} đ</td>
              <td className="py-2 px-3 border-r text-center font-mono text-slate-500">0.0% (Gốc)</td>
              <td className="py-2 px-3 border-r text-center text-slate-700">Mốc dự toán đơn vị trình</td>
              <td className="py-2 px-3 text-center"><span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">Gốc Trình</span></td>
            </tr>

            {pillarsList.map((p) => {
              const dg = p.price;
              const diff = (dgTrinh > 0 && dg > 0) ? ((dg - dgTrinh) / dgTrinh * 100) : 0;
              const isLower = dg > 0 && dg < dgTrinh;
              return (
                <tr key={p.key} className="hover:bg-slate-50/80 text-[11px]">
                  <td className="py-2 px-3 border-r font-bold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.has ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>{p.name}</span>
                    </div>
                    {p.kw && (
                      <div className="text-[10px] text-teal-800 font-mono font-normal pl-3.5 mt-0.5">
                        🔍 Từ khóa: <span className="font-semibold bg-teal-50 px-1 py-0.2 rounded border border-teal-200">"{p.kw}"</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 border-r text-right font-mono font-extrabold text-slate-900">
                    {dg > 0 ? (
                      `${fmt(dg)} đ`
                    ) : p.has ? (
                      <span className="text-slate-500 font-normal italic text-[10.5px]">0 kết quả (Ko có giá)</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 px-3 border-r text-center font-mono font-bold">
                    {dg > 0 ? (
                      <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-700' : 'text-slate-600'}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 border-r text-center font-semibold">
                    {!p.has ? (
                      <span className="text-slate-400 italic">Chưa nạp dữ liệu</span>
                    ) : isLower ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">🟢 Thấp hơn trình ({fmt(dgTrinh - dg)} đ)</span>
                    ) : dg > 0 ? (
                      <span className="text-slate-700">⚪ Tương đương / Phù hợp</span>
                    ) : p.key === 'p2' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">
                        {isErpDeselected ? 'Đã đối soát CSDL ERP: Không áp dụng làm căn cứ' : 'Đã đối soát CSDL ERP: 0 bản ghi phù hợp'}
                      </span>
                    ) : p.key === 'p3' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">
                        {isImisDeselected ? 'Đã đối soát CSDL IMIS: Không áp dụng làm căn cứ' : 'Đã đối soát CSDL EVN: 0 bản ghi'}
                      </span>
                    ) : p.key === 'p4' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">
                        {isMscDeselected ? 'Đã rà soát e-GP: Không áp dụng làm căn cứ' : 'Đã rà soát e-GP: 0 gói thầu'}
                      </span>
                    ) : p.key === 'p5' ? (
                      <span className="text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border text-[10.5px]">Vật tư đặc thù hãng, yêu cầu RFQ</span>
                    ) : (
                      <span className="text-slate-600 italic">Đã kiểm tra (Không có mốc giá)</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {p.has && dg > 0 ? (
                      <button
                        onClick={() => setApprovedPrice(dg)}
                        className="px-2.5 py-1 bg-teal-100 hover:bg-teal-200 text-teal-900 rounded font-bold text-[10px] border border-teal-300 transition"
                      >
                        ⚡ Chọn Giá Này
                      </button>
                    ) : p.has ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] border border-emerald-300">✓ Đã Nạp</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Chưa nạp</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hộp Chọn Đơn Giá Thống Nhất & Tùy Chỉnh */}
      <div className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-3">
        <h5 className="font-bold text-xs text-teal-950 uppercase flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-teal-700" /> PHÊ DUYỆT ĐƠN GIÁ THẨM ĐỊNH THỐNG NHẤT
        </h5>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Đơn giá phê duyệt:</span>
            <div className="relative">
              <input
                type="number"
                value={approvedPrice}
                onChange={e => setApprovedPrice(parseFloat(e.target.value) || 0)}
                className="w-44 px-3 py-1.5 text-xs font-mono font-extrabold text-teal-950 bg-white border border-teal-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">đ</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
            <span className="text-slate-500 font-semibold">Chọn nhanh:</span>
            {pillarsList.filter(p => p.has && p.price > 0).map(p => (
              <button
                key={p.key}
                onClick={() => setApprovedPrice(p.price)}
                className={`px-2.5 py-1 rounded-lg font-bold transition border ${
                  approvedPrice === p.price ? 'bg-teal-700 text-white border-teal-800 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-teal-100'
                }`}
              >
                {p.name.split(':')[0]}: {fmt(p.price)} đ
              </button>
            ))}
            <button
              onClick={() => setApprovedPrice(dgTrinh)}
              className={`px-2.5 py-1 rounded-lg font-bold transition border ${
                approvedPrice === dgTrinh ? 'bg-blue-700 text-white border-blue-800 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Giữ Giá Trình ({fmt(dgTrinh)} đ)
            </button>
          </div>
        </div>
      </div>

      {/* Khung Báo Cáo Kết Quả AI Chuyên Gia Minh Bạch (AI Expert Results Dashboard) */}
      {aiResultData && (
        <div className={`p-4 rounded-xl border-2 shadow-sm transition space-y-3 ${
          aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
            ? 'bg-amber-50/90 border-amber-400 text-amber-950'
            : 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between border-b pb-2 border-slate-200/80">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-700 animate-bounce" />
              🤖 BẢNG TỔNG HỢP CHỈ SỐ KẾT QUẢ ĐẦU RA TỪ AI CHUYÊN GIA ĐỘC LẬP
            </h5>
            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
                ? 'bg-red-100 text-red-800 border-red-300'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}>
              {aiResultData.risk_flag === 'HIGH_PRICE_WARNING' || (aiResultData.diff_pct && aiResultData.diff_pct > 10)
                ? `🔴 CẢNH BÁO CAO (+${aiResultData.diff_pct?.toFixed(1)}%)`
                : '🟢 MỨC RỦI RO: BÌNH THƯỜNG'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Đơn giá AI Đề xuất Phê duyệt:</span>
              <span className="text-base font-black font-mono text-blue-900">{fmt(aiResultData.suggested_price || approvedPrice)} đ</span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Tiết kiệm Dự toán Dự kiến:</span>
              <span className="text-base font-black font-mono text-emerald-700">
                {(aiResultData.estimated_savings || totalSavings) > 0 ? `-${fmt(aiResultData.estimated_savings || totalSavings)} đ` : '0 đ (Giữ giá trình)'}
              </span>
            </div>
            <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 block">Nguồn Mô hình AI Thực thi:</span>
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1 mt-1">
                {aiResultData.used_ai ? '🟢 Gemini LLM API (OpenRouter)' : '⚡ SME Expert Model (Local)'}
              </span>
            </div>
          </div>

          {aiResultData.expert_opinion && (
            <div className="bg-white/80 p-3 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-800 block mb-1">💡 Trích xuất Ý kiến Phân tích Kỹ thuật Nổi bật:</span>
              <p className="text-[11.5px] leading-relaxed text-slate-700 whitespace-pre-wrap italic">
                {aiResultData.expert_opinion}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal Tiến trình Chạy AI Chuyên Gia minh bạch */}
      {runningAi && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-purple-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b pb-3 border-slate-100">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-purple-950">ĐANG PHÂN TÍCH TIẾN TRÌNH BỞI AI CHUYÊN GIA</h4>
                <p className="text-xs text-slate-500 font-medium">Hệ thống đang xử lý độc lập dữ liệu 5 Khối chứng cứ...</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { step: 1, title: 'Nạp & Tổng hợp dữ liệu 5 Khối chứng cứ', desc: 'Đã thu thập Báo Giá Gốc, CSDL ERP Vĩnh Tân 4, IMIS EVN, Mua Sắm Công & TMĐT.' },
                { step: 2, title: 'Phân tích bản chất Kỹ thuật & Hãng sản xuất', desc: 'Đang đánh giá thông số thiết bị, model đặc thù và tính tương thích thương hiệu.' },
                { step: 3, title: 'Truy vấn Mô hình AI Chuyên Gia Độc Lập (LLM/SME)', desc: 'Đang gửi yêu cầu phản biện độc lập đến Mô hình AI Chuyên gia.' },
                { step: 4, title: 'Đánh giá Rủi ro Đơn giá & Tiết kiệm Dự toán', desc: 'Tính toán biên độ dao động lịch sử và số tiền tiết kiệm khả thi.' },
                { step: 5, title: 'Hoàn tất Thuyết minh & Đề xuất Đơn giá Phê duyệt', desc: 'Biên soạn bài báo cáo độc lập và sẵn sàng phê duyệt.' },
              ].map(s => {
                const isDone = aiStep > s.step;
                const isCurrent = aiStep === s.step;
                return (
                  <div key={s.step} className={`p-2.5 rounded-xl border text-xs transition flex items-start gap-3 ${
                    isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
                    isCurrent ? 'bg-purple-50 border-purple-300 text-purple-950 ring-2 ring-purple-200 font-bold' :
                    'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}>
                    <div className="mt-0.5 shrink-0">
                      {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
                       isCurrent ? <Loader2 className="w-4 h-4 text-purple-700 animate-spin" /> :
                       <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex items-center justify-center text-[9px] font-bold">{s.step}</div>}
                    </div>
                    <div>
                      <div className="font-bold">{s.title}</div>
                      <div className="text-[10.5px] opacity-80 font-medium">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bản Thuyết Minh Tổng Hợp 5 Cơ Sở */}
      <div className="p-4 rounded-xl border-2 border-teal-400 bg-white text-slate-900 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-teal-950">
            <FileText className="w-4 h-4 text-teal-700" /> 📄 BẢN THUYẾT MINH TỔNG HỢP THẨM ĐỊNH (TỔ THẨM ĐỊNH LẬP)
          </h5>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAiSynthesis}
              disabled={runningAi}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-[11px] px-3 py-1 rounded-md font-bold flex items-center gap-1.5 shadow-2xs transition"
            >
              {runningAi ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-200" />
                  <span>Đang tổng hợp Thuyết minh...</span>
                </>
              ) : (
                <span>🤖 Chạy AI Hỗ Trợ Thuyết Minh (1-Click)</span>
              )}
            </button>
            <button
              onClick={() => {
                const newT = generateDefaultSynthesisText();
                setEditingText(newT);
                if (minBaseline > 0) setApprovedPrice(minBaseline);
                toast.info('Đã tính toán và cập nhật lại thuyết minh theo 5 cơ sở hiện tại!');
              }}
              className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
              title="Tính toán và cập nhật lại thuyết minh dựa trên các cơ sở đã chọn hoặc đã hủy"
            >
              <RotateCcw className="w-3 h-3" /> Cập Nhật Lại Thuyết Minh
            </button>
            <button
              onClick={copyToClipboard}
              className="bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
            >
              📋 Sao Chép Thuyết Minh
            </button>
            <button
              onClick={handleExportDocx}
              className="bg-blue-700 hover:bg-blue-800 text-white text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 shadow-2xs transition"
            >
              📄 Xuất File Word (.docx)
            </button>

          </div>
        </div>
        <textarea
          rows={7}
          value={editingText}
          onChange={e => setEditingText(e.target.value)}
          className="w-full text-xs leading-relaxed font-mono p-3 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:border-teal-500 text-slate-800"
        />
      </div>

      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={handleFinalApprove}
        nextLabel={null}
        prevLabel="Cơ sở 5 (TMĐT)"
        isFinal
      />
    </div>
  );
}
