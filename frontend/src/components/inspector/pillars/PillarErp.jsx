import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Building2,
  Database,
  Search,
  RotateCcw,
  Pin,
  Check,
  BarChart3,
  Calculator,
  Loader2,
  FileText,
  Clock,
  AlertTriangle,
  ShieldCheck,
  X,
} from "lucide-react";
import { useToast } from "../../ui/Toast.jsx";
import { fmt } from "../utils/formatters.js";
import {
  isValidErpCode,
  getErpDefaultKw,
  getInitialSelectedIdx,
  computeTimeDelta,
  computeAnnualEscalation,
  computeEscalationCeiling,
} from "../utils/keywordHelpers.js";
import {
  PillarHeader,
  LoadingSpinner,
  SaveFooter,
  EmptyState,
} from "../common";

const DESELECTED_ERP_TEXT =
  "Qua rà soát CSDL lịch sử mua sắm ERP của NMNĐ Vĩnh Tân 4, các kết quả tra cứu không có tính chất kỹ thuật và quy cách tương đồng phù hợp với vật tư đang xét. Thẩm định viên không áp dụng CSDL ERP làm căn cứ so sánh đơn giá cho mục này.";

export default function PillarErp({
  loading,
  saving,
  data,
  dgTrinh,
  item,
  onSave,
  onAutoSave,
  saved,
  onOpenErpConfig,
}) {
  const toast = useToast();
  const [erpResults, setErpResults] = useState(data?.results || []);
  const [mapping, setMapping] = useState(data?.mapping || {});
  const [summaryData, setSummaryData] = useState(data?.summary || {});
  const [searchKey, setSearchKey] = useState(() => getErpDefaultKw(item, data));
  const [selectedIdx, setSelectedIdx] = useState(() =>
    getInitialSelectedIdx(data, data?.results),
  );
  const [searching, setSearching] = useState(false);
  const [refreshingSummary, setRefreshingSummary] = useState(false);

  // Dùng ref để theo dõi vật tư hiện tại, chống tình trạng Parent re-render đè mất State thao tác
  const prevItemIdRef = useRef(item?.id ?? item?.ten_vt);

  // Đồng bộ hóa dữ liệu từ props khi chuyển sang vật tư khác
  useEffect(() => {
    const currentItemId = item?.id ?? item?.ten_vt;
    const isNewItem = prevItemIdRef.current !== currentItemId;
    prevItemIdRef.current = currentItemId;

    const list = data?.results || (Array.isArray(data) ? data : []);

    if (isNewItem) {
      // Khi chuyển hẳn sang một vật tư mới -> Khởi tạo lại toàn bộ state theo props của vật tư đó
      setErpResults(list);
      setMapping(data?.mapping || {});
      setSummaryData(data?.summary || {});
      setSearchKey(getErpDefaultKw(item, data));
      setSelectedIdx(getInitialSelectedIdx(data, list));
    } else {
      // Nếu VẪN LÀ VẬT TƯ ĐÓ (Parent chỉ re-render do onAutoSave hoặc cập nhật ngầm):
      // Tuyệt đối không đè state selectedIdx hay summaryData mà người dùng vừa nhấp chọn!
      if (list.length > 0 && erpResults.length === 0) {
        setErpResults(list);
      }
      if (
        data?.mapping &&
        Object.keys(data.mapping).length > 0 &&
        Object.keys(mapping).length === 0
      ) {
        setMapping(data.mapping);
      }
      // Nếu local state chưa có thuyết minh mà props cha vừa có dữ liệu -> Khôi phục
      if (
        !summaryData?.summary_text &&
        (data?.summary?.summary_text || data?.summary_text)
      ) {
        setSummaryData(data?.summary || { summary_text: data?.summary_text });
      }
    }
  }, [data, item]);

  // Tự động khôi phục thuyết minh với AbortController để chống Race Condition & Memory Leak
  useEffect(() => {
    const controller = new AbortController();
    const list = erpResults || [];
    const curSummaryText = summaryData?.summary_text || data?.summary_text;

    const isExplicitlyDeselected =
      data?.is_deselected ||
      data?.selected_record === "NONE" ||
      data?.summary?.status === "ERP_DESELECTED" ||
      summaryData?.status === "ERP_DESELECTED" ||
      selectedIdx === null;

    if (
      isExplicitlyDeselected ||
      list.length === 0 ||
      curSummaryText ||
      searching ||
      !item?.ten_vt
    ) {
      return;
    }

    const restoreSummary = async () => {
      try {
        const res = await fetch("/api/erp/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            keyword: searchKey || getErpDefaultKw(item, data),
            ma_vt: isValidErpCode(item?.ma_vt) ? item.ma_vt : "",
            item,
            dg_trinh: dgTrinh,
          }),
        });
        const resp = await res.json();
        if (resp.summary) {
          setSummaryData(resp.summary);
          if (onAutoSave) {
            onAutoSave({
              results: resp.results || list,
              mapping: resp.mapping || mapping,
              summary: resp.summary,
              summary_text: resp.summary?.summary_text || "",
              keyword: searchKey || item?.ten_vt || "",
              used_keyword: searchKey || item?.ten_vt || "",
              selected_record: resp.results?.[0] || null,
            });
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error("ERP Restore Error:", err);
      }
    };

    restoreSummary();

    return () => controller.abort();
  }, [item?.ten_vt, data?.summary_text, searchKey, dgTrinh, selectedIdx]); // Thêm các dependencies còn thiếu

  const isDeselected = selectedIdx === null;
  const summaryText = isDeselected
    ? DESELECTED_ERP_TEXT
    : summaryData?.summary_text || data?.summary_text || DESELECTED_ERP_TEXT;
  const status = isDeselected ? "ERP_DESELECTED" : summaryData?.status;
  const isWarning = !isDeselected && status === "ERP_WARN_RECENT_INCREASE";

  // Trích xuất gợi ý tên cốt lõi từ tên vật tư
  const coreName = useMemo(() => {
    const raw = item?.ten_vt_goc || item?.ten_vt || "";
    return raw.split("\n")[0].split("-")[0].split(",")[0].trim();
  }, [item?.ten_vt_goc, item?.ten_vt]);

  const handleManualSearch = async () => {
    const cleanKw = searchKey.trim();
    if (!cleanKw) return;
    setSearching(true);
    try {
      const res = await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: cleanKw,
          ma_vt: isValidErpCode(item?.ma_vt) ? item.ma_vt : "",
          item,
          dg_trinh: dgTrinh,
          is_manual: true,
        }),
      });
      const resp = await res.json();
      const resList = resp.results || [];
      const sumData = resp.summary || {};
      setErpResults(resList);
      setMapping(resp.mapping || {});
      setSummaryData(sumData);
      setSelectedIdx(0);
      toast.success(
        `Đã tìm thấy ${resList.length} kết quả ERP cho từ khóa [${cleanKw}]`,
      );

      onAutoSave?.({
        results: resList,
        mapping: resp.mapping || {},
        summary: sumData,
        summary_text: sumData?.summary_text || resp.summary_text || "",
        keyword: cleanKw,
        used_keyword: cleanKw,
        selected_record: resList[0] || null,
        use_average: false,
        is_deselected: false,
      });
    } catch (e) {
      toast.error("Lỗi tìm kiếm ERP thủ công");
    } finally {
      setSearching(false);
    }
  };

  const handleDeselectRecord = async () => {
    setSelectedIdx(null);
    const sumData = {
      status: "ERP_DESELECTED",
      is_deselected: true,
      summary_text: DESELECTED_ERP_TEXT,
    };
    setSummaryData(sumData);

    onAutoSave?.({
      results: erpResults,
      mapping,
      summary: sumData,
      summary_text: DESELECTED_ERP_TEXT,
      keyword: searchKey,
      used_keyword: searchKey,
      selected_record: "NONE",
      use_average: false,
      is_deselected: true,
    });

    toast.info(
      "Đã hủy chọn hợp đồng ERP. Không áp dụng kết quả ERP làm căn cứ.",
    );
    try {
      await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: searchKey,
          ma_vt: isValidErpCode(item?.ma_vt)
            ? item.ma_vt
            : isValidErpCode(searchKey)
              ? searchKey
              : "",
          item,
          dg_trinh: dgTrinh,
          selected_record: "NONE",
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRecord = async (index) => {
    if (selectedIdx === index) {
      await handleDeselectRecord();
      return;
    }
    setSelectedIdx(index);
    const rec = erpResults[index];
    if (!rec) return;

    try {
      const res = await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: searchKey,
          ma_vt: isValidErpCode(item?.ma_vt)
            ? item.ma_vt
            : isValidErpCode(searchKey)
              ? searchKey
              : "",
          item,
          dg_trinh: dgTrinh,
          selected_record: rec,
        }),
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(
        `Đã chọn hợp đồng ${rec.soHopDong || rec.so_hop_dong || "ERP"} làm căn cứ!`,
      );

      onAutoSave?.({
        results: erpResults,
        mapping,
        summary: sumData,
        summary_text: sumData?.summary_text || "",
        keyword: searchKey,
        used_keyword: searchKey,
        selected_record: rec,
        use_average: false,
        is_deselected: false,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAverage = async () => {
    if (selectedIdx === "AVERAGE") {
      await handleDeselectRecord();
      return;
    }
    setSelectedIdx("AVERAGE");
    try {
      const res = await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: searchKey,
          ma_vt: isValidErpCode(item?.ma_vt)
            ? item.ma_vt
            : isValidErpCode(searchKey)
              ? searchKey
              : "",
          item,
          dg_trinh: dgTrinh,
          use_average: true,
        }),
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);
      toast.success(
        `Đã chọn phương án Đơn Giá Trung Bình (${sumData?.count_n || erpResults.length} đợt) làm căn cứ thuyết minh!`,
      );

      onAutoSave?.({
        results: erpResults,
        mapping,
        summary: sumData,
        summary_text: sumData?.summary_text || "",
        keyword: searchKey,
        used_keyword: searchKey,
        selected_record: "AVERAGE",
        use_average: true,
        is_deselected: false,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshSummary = async () => {
    if (refreshingSummary) return;
    setRefreshingSummary(true);
    try {
      let targetIdx = selectedIdx;
      let targetList = erpResults;

      // Nếu danh sách kết quả đang rỗng -> Thử tìm kiếm lại bằng từ khóa / mã VT trước
      if (!targetList || targetList.length === 0) {
        const cleanKw = searchKey.trim() || item?.ten_vt || "";
        const mvt = isValidErpCode(item?.ma_vt)
          ? item.ma_vt
          : isValidErpCode(cleanKw)
            ? cleanKw
            : "";
        const searchRes = await fetch("/api/erp/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: cleanKw,
            ma_vt: mvt,
            item,
            dg_trinh: dgTrinh,
          }),
        });
        const searchData = await searchRes.json();
        targetList = searchData.results || [];
        setErpResults(targetList);
        if (searchData.mapping) setMapping(searchData.mapping);
      }

      // Xác định căn cứ cần tính toán lại
      let isAvg = targetIdx === "AVERAGE";
      let selRec = null;

      if (targetIdx === null || targetIdx === undefined) {
        // Nếu đang ở trạng thái hủy chọn (DESELECTED), tự động khôi phục về căn cứ tối ưu:
        // Ưu tiên Đơn Giá TB nếu có từ 2 hợp đồng, hoặc hợp đồng đầu tiên nếu có 1
        if (targetList.length >= 2) {
          targetIdx = "AVERAGE";
          isAvg = true;
          setSelectedIdx("AVERAGE");
        } else if (targetList.length === 1) {
          targetIdx = 0;
          isAvg = false;
          selRec = targetList[0];
          setSelectedIdx(0);
        } else {
          // Không có kết quả nào
          toast.warning("Không có kết quả ERP nào để tổng hợp thuyết minh");
          setRefreshingSummary(false);
          return;
        }
      } else if (isAvg) {
        selRec = "AVERAGE";
      } else if (typeof targetIdx === "number" && targetList[targetIdx]) {
        selRec = targetList[targetIdx];
      }

      const mvt = isValidErpCode(item?.ma_vt)
        ? item.ma_vt
        : isValidErpCode(searchKey)
          ? searchKey
          : "";
      const res = await fetch("/api/erp/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: searchKey,
          ma_vt: mvt,
          item,
          dg_trinh: dgTrinh,
          use_average: isAvg,
          selected_record: isAvg ? "AVERAGE" : selRec,
        }),
      });
      const resp = await res.json();
      const sumData = resp.summary || {};
      setSummaryData(sumData);

      onAutoSave?.({
        results: targetList,
        mapping,
        summary: sumData,
        summary_text: sumData?.summary_text || resp.summary_text || "",
        keyword: searchKey,
        used_keyword: searchKey,
        selected_record: isAvg ? "AVERAGE" : selRec,
        use_average: isAvg,
        is_deselected: false,
      });

      toast.success("✅ Đã cập nhật và đồng bộ lại Bản Thuyết Minh ERP!");
    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi cập nhật lại thuyết minh ERP");
    } finally {
      setRefreshingSummary(false);
    }
  };

  const copyToClipboard = () => {
    if (summaryText) {
      navigator.clipboard.writeText(summaryText);
      toast.success("Đã sao chép thuyết minh ERP vào clipboard!");
    }
  };

  const hasMapping = useMemo(
    () => mapping && Object.keys(mapping).length > 0,
    [mapping],
  );
  const isColActive = useCallback(
    (key) => {
      if (!hasMapping) return true;
      return Boolean(mapping[key] && mapping[key].trim() !== "");
    },
    [hasMapping, mapping],
  );

  // Tính toán chỉ số kinh tế, trượt giá & trần CPI
  const {
    avgPrice,
    selectedRec,
    selectedTimeDelta,
    selectedDate,
    escalation,
    priceCeiling,
  } = useMemo(() => {
    const validPrices = erpResults
      .map((r) => parseFloat(r.donGia || r.don_gia || 0))
      .filter((p) => p > 0);
    const avg =
      validPrices.length > 0
        ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length
        : 0;

    const rec =
      typeof selectedIdx === "number" ? erpResults[selectedIdx] : null;
    const date =
      rec?.ngayKyHd || rec?.ngay_ky_hd || rec?.ngayNhapKho || rec?.ngayChungTu;
    const timeDelta = computeTimeDelta(date);
    const price = rec ? parseFloat(rec.donGia || rec.don_gia || 0) : 0;
    const ceiling = computeEscalationCeiling(price, timeDelta.months, 0.05);

    return {
      avgPrice: avg,
      selectedRec: rec,
      selectedTimeDelta: timeDelta,
      selectedDate: date,
      escalation: computeAnnualEscalation(price, dgTrinh, timeDelta.months),
      priceCeiling: ceiling,
    };
  }, [erpResults, selectedIdx, dgTrinh]);

  return (
    <div className="space-y-4">
      {/* HEADER & CONTROLS */}
      <div className="flex items-center justify-between">
        <PillarHeader
          icon={Building2}
          color="blue"
          title="KHỐI 2: LỊCH SỬ MUA SẮM ERP VĨNH TÂN 4"
          loading={loading || searching}
        />
        <button
          onClick={onOpenErpConfig}
          className="bg-blue-700 hover:bg-blue-800 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Database className="w-3.5 h-3.5" /> ⚙️ Cấu hình CSDL ERP (Upload &
          Map 13 Cột)
        </button>
      </div>

      {/* SEARCH BAR & CHIP SUGGESTIONS */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-blue-700" /> Tra cứu ERP bằng
            tay:
          </span>
          <input
            type="text"
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
            placeholder="Nhập mã ERP hoặc tên vật tư..."
            className="flex-1 text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 font-medium"
          />
          <button
            onClick={handleManualSearch}
            disabled={searching}
            className="bg-blue-800 hover:bg-blue-900 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition shadow-xs disabled:opacity-50 shrink-0"
          >
            {searching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}{" "}
            Tra cứu
          </button>
          <button
            onClick={() => setSearchKey(getErpDefaultKw(item, data))}
            title="Khôi phục từ khóa mặc định"
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
          </button>
        </div>

        {/* CÁC CHIP GỢI Ý TỪ KHÓA MỞ RỘNG */}
        <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-bold text-blue-950 shrink-0">
            💡 Gợi ý:
          </span>
          {isValidErpCode(item?.ma_vt) && (
            <button
              onClick={() => setSearchKey(item.ma_vt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.ma_vt.trim()
                  ? "bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300"
                  : "bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
              }`}
            >
              🏷️ Mã ERP: <span className="font-mono">{item.ma_vt}</span>
            </button>
          )}
          {coreName && (
            <button
              onClick={() => setSearchKey(coreName)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === coreName.trim()
                  ? "bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300"
                  : "bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
              }`}
            >
              🎯 Tên cốt lõi:{" "}
              <span className="font-semibold truncate max-w-[200px]">
                {coreName}
              </span>
            </button>
          )}
          {(item?.part_no || item?.model) && (
            <button
              onClick={() => setSearchKey(item.part_no || item.model)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === (item.part_no || item.model).trim()
                  ? "bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300"
                  : "bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
              }`}
            >
              ⚙️ Model/Part:{" "}
              <span className="font-mono font-semibold">
                {item.part_no || item.model}
              </span>
            </button>
          )}
          {item?.hang_sx && (
            <button
              onClick={() => setSearchKey(item.hang_sx)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.hang_sx.trim()
                  ? "bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300"
                  : "bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
              }`}
            >
              🏭 Hãng SX: <span className="font-semibold">{item.hang_sx}</span>
            </button>
          )}
          {item?.ten_vt && (
            <button
              onClick={() => setSearchKey(item.ten_vt)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                searchKey.trim() === item.ten_vt.trim()
                  ? "bg-blue-700 text-white border-blue-800 shadow-xs ring-2 ring-blue-300"
                  : "bg-white text-blue-900 border-blue-300 hover:bg-blue-100"
              }`}
            >
              📝 Tên đầy đủ:{" "}
              <span className="font-semibold truncate max-w-[180px]">
                {item.ten_vt}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* KHỐI NÚT CHỌN ĐƠN GIÁ TRUNG BÌNH (AVG) vs THEO HỢP ĐỒNG */}
      {erpResults.length >= 2 && (
        <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center justify-between gap-3 text-xs shadow-xs">
          <span className="font-bold text-blue-950 flex items-center gap-1.5 shrink-0">
            <Calculator className="w-4 h-4 text-blue-700" /> Tùy chọn Phương án
            Căn cứ ERP ({erpResults.length} đợt mua):
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof selectedIdx === "number") {
                  handleDeselectRecord();
                } else {
                  handleSelectRecord(0);
                }
              }}
              title={
                typeof selectedIdx === "number"
                  ? "Nhấp để HỦY CHỌN phương án hợp đồng cụ thể"
                  : "Chọn áp dụng theo hợp đồng cụ thể"
              }
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                typeof selectedIdx === "number"
                  ? "bg-blue-700 hover:bg-rose-600 text-white border-blue-800 shadow-xs group"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {typeof selectedIdx === "number" ? (
                <>
                  <Pin className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                  <span className="group-hover:hidden">
                    Theo Hợp Đồng Cụ Thể (#{selectedIdx + 1})
                  </span>
                  <span className="hidden group-hover:inline">
                    Hủy Chọn Hợp Đồng (#{selectedIdx + 1})
                  </span>
                </>
              ) : (
                <>
                  <Pin className="w-3.5 h-3.5" />
                  <span>Theo Hợp Đồng Cụ Thể (#1)</span>
                </>
              )}
            </button>
            <button
              onClick={handleSelectAverage}
              title={
                selectedIdx === "AVERAGE"
                  ? "Nhấp để HỦY CHỌN phương án giá trung bình"
                  : "Chọn áp dụng đơn giá trung bình"
              }
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition flex items-center gap-1.5 border ${
                selectedIdx === "AVERAGE"
                  ? "bg-emerald-700 hover:bg-rose-600 text-white border-emerald-800 shadow-xs group"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {selectedIdx === "AVERAGE" ? (
                <>
                  <BarChart3 className="w-3.5 h-3.5 text-amber-300 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:inline" />
                  <span className="group-hover:hidden">
                    📊 Chọn Đơn Giá Trung Bình (AVG): {fmt(avgPrice)} đ
                  </span>
                  <span className="hidden group-hover:inline">
                    Hủy Chọn Giá Trung Bình
                  </span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    📊 Chọn Đơn Giá Trung Bình (AVG): {fmt(avgPrice)} đ
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* THẺ PHÂN TÍCH KÍCH THƯỚC THỜI GIAN & TỐC ĐỘ TRƯỢT GIÁ SO CPI */}
      {selectedRec && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 text-xs shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-blue-950">
              <Clock className="w-4 h-4 text-blue-700" />
              <span>
                KÍCH THƯỚC THỜI GIAN & TỐC ĐỘ TRƯỢT GIÁ HỢP ĐỒNG #
                {typeof selectedIdx === "number" ? selectedIdx + 1 : 1}
              </span>
              {selectedTimeDelta.badgeText &&
                selectedTimeDelta.badgeText !== "—" && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      selectedTimeDelta.isOver12Months
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    }`}
                  >
                    {selectedTimeDelta.badgeText}
                  </span>
                )}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Ký:{" "}
              <b className="font-mono text-slate-700">{selectedDate || "—"}</b>{" "}
              {selectedTimeDelta.months > 0 && (
                <>
                  (cách đây <b>{selectedTimeDelta.months}</b> tháng ~{" "}
                  <b>{selectedTimeDelta.years}</b> năm)
                </>
              )}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Tốc Độ Tăng Giá Bình Quân
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span
                  className={`text-sm font-black font-mono ${
                    escalation.annualPct > 5
                      ? "text-red-600"
                      : escalation.annualPct > 0
                        ? "text-blue-700"
                        : "text-emerald-700"
                  }`}
                >
                  {escalation.annualPct > 0 ? "+" : ""}
                  {escalation.annualPct}% / năm
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  ({escalation.totalPct > 0 ? "+" : ""}
                  {escalation.totalPct}% tổng)
                </span>
              </div>
            </div>

            <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Mức Trần Sau Bù CPI 5%/Năm
              </div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-sm font-black font-mono text-slate-900">
                  {fmt(priceCeiling)} đ
                </span>
                <span className="text-[10px] text-blue-600 font-medium">
                  (Trần CPI)
                </span>
              </div>
            </div>

            <div className="bg-white/90 p-2 rounded-lg border border-blue-100">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Đánh Giá Tính Hợp Lý
              </div>
              <div className="mt-0.5 text-[11px] font-bold">
                {dgTrinh <= 0 || priceCeiling <= 0 ? (
                  <span className="text-slate-500">—</span>
                ) : dgTrinh <= priceCeiling ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> 🟢 Đạt (Dưới trần
                    CPI)
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> 🔴 Vượt trần CPI
                    (+{fmt(dgTrinh - priceCeiling)} đ)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY PANEL */}
      {summaryText && (
        <div
          className={`p-4 rounded-xl border-2 shadow-sm transition ${
            isDeselected
              ? "bg-slate-100 border-slate-300 text-slate-700"
              : isWarning
                ? "bg-amber-50 border-amber-400 text-amber-950"
                : "bg-blue-50/80 border-blue-300 text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-extrabold text-xs uppercase tracking-wide flex items-center gap-1.5 text-blue-900">
              <FileText className="w-4 h-4 text-blue-700" /> 📄 BẢN THUYẾT MINH
              CĂN CỨ ERP {isDeselected ? "(ĐÃ HỦY CHỌN)" : "(TỰ ĐỘNG TỔNG HỢP)"}
            </h5>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshSummary}
                disabled={refreshingSummary}
                className="bg-blue-800 hover:bg-blue-900 text-white text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                title="Tính toán và cập nhật lại bản thuyết minh ERP dựa trên căn cứ hiện tại"
              >
                {refreshingSummary ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                🔄 Cập Nhật Thuyết Minh
              </button>
              <button
                onClick={copyToClipboard}
                className="bg-white hover:bg-slate-100 text-blue-800 border border-blue-300 text-[11px] px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition"
              >
                📋 Sao Chép
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed font-medium bg-white/70 p-3 rounded-lg border border-slate-200 text-slate-800">
            {summaryText}
          </p>
        </div>
      )}

      {/* TABLE DATA 14 CỘT ĐẦY ĐỦ */}
      {loading || searching ? (
        <LoadingSpinner />
      ) : erpResults.length > 0 ? (
        <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
            <thead className="bg-blue-50 text-blue-950 font-bold border-b border-blue-200">
              <tr>
                <th className="py-2.5 px-2 border-r w-24 text-center">
                  Căn Cứ
                </th>
                <th className="py-2.5 px-2 border-r w-20 text-center">
                  % Khớp
                </th>
                {(isColActive("ma_vt") || isColActive("ten_vt")) && (
                  <th className="py-2.5 px-3 border-r min-w-[180px]">
                    Mã ERP & Tên Vật Tư
                  </th>
                )}
                {isColActive("thong_so_kt") && (
                  <th className="py-2.5 px-3 border-r min-w-[200px]">
                    Thông Số KT
                  </th>
                )}
                {isColActive("dvt") && (
                  <th className="py-2.5 px-2 border-r w-16 text-center">ĐVT</th>
                )}
                {isColActive("so_luong") && (
                  <th className="py-2.5 px-2 border-r w-16 text-right font-mono">
                    SL
                  </th>
                )}
                {isColActive("don_gia") && (
                  <th className="py-2.5 px-3 border-r w-32 text-right font-mono bg-blue-100/50">
                    Đơn Giá ERP
                  </th>
                )}
                {isColActive("thanh_tien") && (
                  <th className="py-2.5 px-3 border-r w-32 text-right font-mono">
                    Thành Tiền
                  </th>
                )}
                {isColActive("so_hop_dong") && (
                  <th className="py-2.5 px-3 border-r font-bold text-emerald-900 bg-emerald-50/50">
                    Số Hợp Đồng
                  </th>
                )}
                {isColActive("ngay_ky_hd") && (
                  <th className="py-2.5 px-3 border-r w-36">
                    Ngày Ký & Thời Gian
                  </th>
                )}
                {isColActive("so_phieu_nhap") && (
                  <th className="py-2.5 px-3 border-r w-28">Số Phiếu Nhập</th>
                )}
                {isColActive("ngay_nhap_kho") && (
                  <th className="py-2.5 px-3 border-r w-28">Ngày Nhập Kho</th>
                )}
                {isColActive("nha_thau") && (
                  <th className="py-2.5 px-3 border-r min-w-[150px]">
                    Nhà Thầu Cung Cấp
                  </th>
                )}
                {isColActive("ghi_chu") && (
                  <th className="py-2.5 px-3 min-w-[120px]">Ghi Chú</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {erpResults.map((r, i) => {
                const isSelected = i === selectedIdx;
                const dg = parseFloat(r.donGia || r.don_gia || 0);
                const diff =
                  dgTrinh > 0 && dg > 0 ? ((dg - dgTrinh) / dgTrinh) * 100 : 0;

                return (
                  <tr
                    key={i}
                    className={`transition text-[11px] ${
                      isSelected
                        ? "bg-blue-100/70 border-l-4 border-l-blue-700 font-semibold"
                        : "hover:bg-blue-50/30"
                    }`}
                  >
                    <td className="py-2 px-2 border-r text-center">
                      <button
                        onClick={() => handleSelectRecord(i)}
                        title={
                          isSelected
                            ? "Nhấp để HỦY CHỌN (Không áp dụng hợp đồng này làm căn cứ)"
                            : "Nhấp để chọn hợp đồng này làm căn cứ"
                        }
                        className={`text-[10px] px-2 py-1 rounded font-bold transition flex items-center justify-center gap-1 mx-auto ${
                          isSelected
                            ? "bg-blue-700 hover:bg-rose-600 text-white shadow-xs group ring-2 ring-blue-300"
                            : "bg-slate-200 hover:bg-blue-100 text-slate-700"
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3 h-3 group-hover:hidden" />
                            <X className="w-3 h-3 hidden group-hover:inline" />
                            <span className="group-hover:hidden">Đã Chọn</span>
                            <span className="hidden group-hover:inline">
                              Hủy Chọn
                            </span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-3 h-3" />
                            <span>Chọn</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2 border-r text-center font-mono font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          (r.match_score || 0) >= 90
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : (r.match_score || 0) >= 70
                              ? "bg-blue-100 text-blue-800 border border-blue-300"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                        }`}
                      >
                        {r.match_score ? `${r.match_score}%` : "—"}
                      </span>
                    </td>
                    {(isColActive("ma_vt") || isColActive("ten_vt")) && (
                      <td className="py-2 px-3 border-r">
                        <div className="font-bold text-slate-900">
                          {r.tenVt || r.ten_vt || r.maVt}
                        </div>
                        <div className="font-mono text-blue-700 text-[10px] font-semibold">
                          {r.maVt || r.ma_vt || "—"}
                        </div>
                      </td>
                    )}
                    {isColActive("thong_so_kt") && (
                      <td
                        className="py-2 px-3 border-r text-slate-600 truncate max-w-[180px]"
                        title={r.thongSoKt || r.thong_so_kt}
                      >
                        {r.thongSoKt || r.thong_so_kt || "—"}
                      </td>
                    )}
                    {isColActive("dvt") && (
                      <td className="py-2 px-2 border-r text-center text-slate-700">
                        {r.donViTinh || r.dvt || "Cái"}
                      </td>
                    )}
                    {isColActive("so_luong") && (
                      <td className="py-2 px-2 border-r text-right font-mono font-bold text-slate-900">
                        {r.soLuong || r.so_luong || 1}
                      </td>
                    )}
                    {isColActive("don_gia") && (
                      <td className="py-2 px-3 text-right font-mono font-extrabold border-r text-blue-900 bg-blue-50/20">
                        {fmt(dg)} đ
                        {diff !== 0 && (
                          <div
                            className={`text-[9.5px] font-bold ${
                              diff > 0 ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(1)}% so với trình
                          </div>
                        )}
                      </td>
                    )}
                    {isColActive("thanh_tien") && (
                      <td className="py-2 px-3 border-r text-right font-mono text-slate-800">
                        {fmt(r.thanhTien || r.thanh_tien || 0)} đ
                      </td>
                    )}
                    {isColActive("so_hop_dong") && (
                      <td className="py-2 px-3 border-r font-bold text-emerald-950 bg-emerald-50/30">
                        {r.soHopDong || r.so_hop_dong || "—"}
                      </td>
                    )}
                    {isColActive("ngay_ky_hd") && (
                      <td className="py-2 px-3 border-r text-slate-700 font-mono">
                        <div className="font-semibold">
                          {r.ngayKyHd || r.ngay_ky_hd || r.ngayChungTu || "—"}
                        </div>
                        {(() => {
                          const td = computeTimeDelta(
                            r.ngayKyHd ||
                              r.ngay_ky_hd ||
                              r.ngayNhapKho ||
                              r.ngayChungTu,
                          );
                          if (td.badgeText === "—") return null;
                          return (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold mt-0.5 ${
                                td.isOver12Months
                                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                                  : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              }`}
                            >
                              {td.badgeText}
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {isColActive("so_phieu_nhap") && (
                      <td className="py-2 px-3 border-r font-mono text-slate-600">
                        {r.soPhieuNhap || r.so_phieu_nhap || r.soChungTu || "—"}
                      </td>
                    )}
                    {isColActive("ngay_nhap_kho") && (
                      <td className="py-2 px-3 border-r text-slate-600 font-mono">
                        {r.ngayNhapKho ||
                          r.ngay_nhap_kho ||
                          r.ngayChungTu ||
                          "—"}
                      </td>
                    )}
                    {isColActive("nha_thau") && (
                      <td
                        className="py-2 px-3 border-r text-slate-800 font-semibold truncate max-w-[140px]"
                        title={r.nhaThau || r.nha_thau}
                      >
                        {r.nhaThau || r.nha_thau || "NMNĐ Vĩnh Tân 4"}
                      </td>
                    )}
                    {isColActive("ghi_chu") && (
                      <td
                        className="py-2 px-3 text-slate-500 italic truncate max-w-[150px]"
                        title={r.dienGiai || r.ghiChu || r.ghi_chu}
                      >
                        {r.dienGiai || r.ghiChu || r.ghi_chu || "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Không tìm thấy kết quả lịch sử ERP phù hợp (hoặc có tỷ lệ match cao). Hãy thử nhập từ khóa khác ở thanh tra cứu thủ công." />
      )}

      {/* FOOTER */}
      <SaveFooter
        saving={saving}
        saved={saved}
        onSave={() =>
          onSave({
            results: erpResults,
            mapping,
            summary: summaryData,
            summary_text: summaryText,
            keyword: searchKey,
            used_keyword: searchKey,
            selected_record:
              typeof selectedIdx === "number"
                ? erpResults[selectedIdx]
                : selectedIdx === "AVERAGE"
                  ? "AVERAGE"
                  : "NONE",
            is_deselected: isDeselected,
            use_average: selectedIdx === "AVERAGE",
            time_delta: selectedTimeDelta,
            annual_escalation_pct: escalation.annualPct,
            price_ceiling_cpi: priceCeiling,
          })
        }
        nextLabel="Cơ sở 3 (IMIS)"
        prevLabel="Cơ sở 1 (BG)"
      />
    </div>
  );
}
