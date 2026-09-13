export const extractCleanImisKeyword = (raw) => {
  if (!raw) return "";
  let clean = raw.split(/[\-:;]/)[0].trim();
  clean = clean
    .replace(
      /(?:Điện áp|Partno|Part\s*No|Hãng\s*sản\s*xuất|Model|Công suất|Kích thước|Mã).*$/i,
      "",
    )
    .trim();
  return clean || raw;
};

export const generateKeywordCandidates = (raw) => {
  if (!raw) return [];
  const candidates = [];
  const seen = new Set();

  const cleanBase = extractCleanImisKeyword(raw);
  if (
    cleanBase &&
    cleanBase.length >= 3 &&
    !seen.has(cleanBase.toLowerCase())
  ) {
    candidates.push({
      tier: 1,
      label: "Tên Cốt Lõi (Đề xuất)",
      keyword: cleanBase,
      icon: "📌",
      tag: "Tier 1",
    });
    seen.add(cleanBase.toLowerCase());
  }

  const modelMatches = raw.match(/\b[A-Z0-9]{2,10}(?:\s+[A-Z0-9]{2,10})*\b/g);
  if (modelMatches) {
    for (const m of modelMatches) {
      const mStr = m.trim();
      if (
        mStr.length >= 3 &&
        !/^\d+$/.test(mStr) &&
        !["MINIMAX", "INPUT", "OUTPUT", "MODBUS"].includes(
          mStr.toUpperCase(),
        ) &&
        !seen.has(mStr.toLowerCase())
      ) {
        candidates.push({
          tier: 2,
          label: "Mã Model / Thiết bị",
          keyword: mStr,
          icon: "⚡",
          tag: "Tier 2",
        });
        seen.add(mStr.toLowerCase());
        break;
      }
    }
  }

  const partMatch = raw.match(
    /(?:Partno|Part\s*No|Model|Mã)[\s:]*([A-Za-z0-9\-_]+)/i,
  );
  if (partMatch && partMatch[1]) {
    const partStr = partMatch[1].trim();
    if (partStr.length >= 3 && !seen.has(partStr.toLowerCase())) {
      candidates.push({
        tier: 3,
        label: "Mã Part Number",
        keyword: partStr,
        icon: "🔢",
        tag: "Tier 3",
      });
      seen.add(partStr.toLowerCase());
    }
  }

  if (!seen.has(raw.toLowerCase())) {
    candidates.push({
      tier: 4,
      label: "Tên Gốc Đầy Đủ",
      keyword: raw,
      icon: "📄",
      tag: "Tier 4",
    });
  }

  return candidates;
};

export const getDefaultImisKeyword = (raw) => {
  if (!raw) return "";
  const cands = generateKeywordCandidates(raw);
  const modelCand = cands.find((c) => c.tier === 2);
  const partCand = cands.find((c) => c.tier === 3);
  const coreCand = cands.find((c) => c.tier === 1);
  return (
    modelCand?.keyword ||
    partCand?.keyword ||
    coreCand?.keyword ||
    extractCleanImisKeyword(raw)
  );
};

export const isValidErpCode = (code) => {
  if (!code || typeof code !== "string") return false;
  const c = code.trim().toLowerCase();
  if (
    c.includes("chưa") ||
    c.includes("chua") ||
    c.includes("không") ||
    c.includes("khong") ||
    c === "n/a" ||
    c === "none" ||
    c === "null"
  ) {
    return false;
  }
  return (
    /^\d+(\.\d+)+/.test(c) || (/^[a-z0-9_\-.]{4,}$/i.test(c) && /\d/.test(c))
  );
};

export const getErpDefaultKw = (item, data) => {
  // Ưu tiên tuyệt đối số 1: Nếu item có Mã ERP hợp lệ, trả về luôn Mã ERP
  if (isValidErpCode(item?.ma_vt)) return item.ma_vt;

  // Sau đó mới xét đến các từ khóa khác nếu không có mã ERP
  const candidate = data?.used_keyword || data?.keyword;
  if (candidate && !candidate.toLowerCase().includes("chưa có mã"))
    return candidate;

  const rawName = item?.ten_vt_goc || item?.ten_vt || "";
  const coreName = rawName.split("\n")[0].split("-")[0].split(",")[0].trim();
  return coreName || rawName;
};

export const getInitialSelectedIdx = (d, list) => {
  if (!d) return 0;
  if (
    d?.is_deselected ||
    d?.selected_record === "NONE" ||
    d?.summary?.status === "ERP_DESELECTED" ||
    d?.summary?.is_deselected
  )
    return null;
  if (d?.use_average || d?.selected_record === "AVERAGE") return "AVERAGE";
  if (
    d?.selected_record &&
    typeof d.selected_record === "object" &&
    Array.isArray(list)
  ) {
    const idx = list.findIndex(
      (r) =>
        (r.soHopDong && r.soHopDong === d.selected_record.soHopDong) ||
        (r.maVt && r.maVt === d.selected_record.maVt),
    );
    if (idx >= 0) return idx;
  }
  return 0;
};

export const computeTimeDelta = (dateStr) => {
  if (!dateStr || dateStr === "N/A" || dateStr === "—") {
    return {
      months: 0,
      years: 0,
      isOver12Months: false,
      badgeText: "—",
      rawDate: dateStr,
    };
  }
  let d = null;
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const parts = str.substring(0, 10).split("-");
    d = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
    );
  } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
    const parts = str.substring(0, 10).split(/[\/\-]/);
    d = new Date(
      parseInt(parts[2], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[0], 10),
    );
  } else if (/^\d{4}$/.test(str)) {
    d = new Date(parseInt(str, 10), 0, 1);
  } else {
    d = new Date(str);
  }

  if (!d || isNaN(d.getTime())) {
    return {
      months: 0,
      years: 0,
      isOver12Months: false,
      badgeText: "—",
      rawDate: dateStr,
    };
  }

  const now = new Date();
  const refDate = now.getFullYear() >= 2026 ? now : new Date(2026, 8, 8);

  let months =
    (refDate.getFullYear() - d.getFullYear()) * 12 +
    (refDate.getMonth() - d.getMonth());
  if (months < 0) months = 0;
  const years = (months / 12).toFixed(1);
  const isOver12Months = months > 12;

  let badgeText = "";
  if (months <= 12) {
    badgeText = `🟢 Trong hạn 12T (${months} th)`;
  } else {
    badgeText = `🟡 Quá 12T (${months} th - ${years} năm)`;
  }

  return {
    months,
    years: parseFloat(years),
    isOver12Months,
    badgeText,
    rawDate: dateStr,
  };
};

export const computeAnnualEscalation = (pOld, pNew, months) => {
  if (!pOld || pOld <= 0 || !pNew || !months || months <= 0)
    return { totalPct: 0, annualPct: 0 };
  const totalPct = ((pNew - pOld) / pOld) * 100;
  const annualPct = (totalPct / months) * 12;
  return {
    totalPct: parseFloat(totalPct.toFixed(1)),
    annualPct: parseFloat(annualPct.toFixed(1)),
  };
};

export const computeEscalationCeiling = (pOld, months, annualRate = 0.05) => {
  if (!pOld || pOld <= 0) return 0;
  const m = Math.max(0, months || 0);
  return Math.round(pOld * Math.pow(1 + annualRate, m / 12));
};

export const computeLandedCost = (rawVnd, surchargePct = 20) => {
  if (!rawVnd || rawVnd <= 0) return 0;
  return Math.round(rawVnd * (1 + (surchargePct || 0) / 100));
};

export const extractBrandFromItem = (item) => {
  if (!item) return "";

  // 1. Quét qua các trường thuộc tính phổ biến trong dự toán / ERP
  const rawHang =
    item.hsx_xx ||
    item.hang_sx ||
    item.hangSanXuat ||
    item.nha_san_xuat ||
    item.nsx ||
    item.maker ||
    item.manufacturer ||
    item.brand ||
    "";

  if (rawHang && typeof rawHang === "string") {
    // Thường có dạng "Tên Hãng/ Nước Xuất Xứ", lấy phần tên hãng đằng trước
    let brand = rawHang.split(/[\/\,\;\(]/)[0].trim();
    if (
      brand &&
      brand.length >= 2 &&
      !/^(chưa|chua|không|khong|n\/a|none|null|\-|\?)$/i.test(brand) &&
      !/chưa\s*có|không\s*rõ/i.test(brand)
    ) {
      return brand;
    }
  }

  const text = `${item.ten_vt || ""} ${item.thong_so_kt || ""}`;

  // 2. Bóc tách bằng Regex ngữ nghĩa: bắt mọi biến thể Nhà sản xuất, NSX, NXS (gõ nhầm), Maker, Manufacturer, Mfr, Brand...
  const brandRegex =
    /(?:Nhà\s*sản\s*xuất|Hãng(?:\s*SX|\s*sản\s*xuất)?|HSX|NSX|NXS|Maker|Manufacturer|Mfr|Brand)[\s:=-]+([A-Za-z0-9&.\- ]+?)(?:[\/;,(\n]|\s+xuất\s*xứ|\s+nước|\s+model|\s+p\/n|$)/i;
  const match = text.match(brandRegex);
  if (match && match[1]) {
    let extracted = match[1].replace(/[\.\,\;\:\/\-]+$/, "").trim();
    if (
      extracted.length >= 2 &&
      !/^(chưa|chua|không|khong|n\/a|none|null|\-|\?)$/i.test(extracted) &&
      !/chưa\s*có|không\s*rõ/i.test(extracted)
    ) {
      return extracted;
    }
  }

  // 3. Tìm thương hiệu công nghiệp quốc tế phổ biến từ tên hoặc thông số (ngay cả khi không có chữ NSX/Maker đứng trước)
  const knownBrands = [
    "Swagelok", "FlowTek", "Flow-Tek", "Bray", "Parker", "Fisher", "Emerson",
    "Siemens", "ABB", "Schneider", "Yokogawa", "Endress+Hauser", "Danfoss",
    "KSB", "Sulzer", "Omron", "Festo", "SMC", "Spirax Sarco", "TLV", "Rotork",
    "Limitorque", "Honeywell", "GE", "Mitsubishi", "WIKA", "Rosemount", "Masoneilan",
    "Kungho", "Gea-Bgr", "Merrick", "Eunchang", "LS", "Unicon", "Rema Tiptop",
    "Baosteel", "Autonics", "HBK", "Imatek", "Intorq", "Apollo"
  ];
  for (const b of knownBrands) {
    const reg = new RegExp(`\\b${b.replace("+", "\\+")}\\b`, "i");
    if (reg.test(text)) return b;
  }

  return "";
};

export const extractModelFromItem = (item) => {
  if (!item) return "";
  const text = `${item.ten_vt || ""} ${item.thong_so_kt || ""}`;

  // 1. Model: XXX hoặc Part no: XXX
  const explicitModel = text.match(/(?:Model|Part\s*(?:no|number)|Mã\s*hiệu|P\/N|Type)[\s:]*([A-Za-z0-9\-\/\._]+)/i);
  if (explicitModel && explicitModel[1] && explicitModel[1].length >= 3) {
    return explicitModel[1].trim();
  }

  // 2. Các mã kỹ thuật có dấu gạch ngang (VD: SS-600-6, 920830-113A0532, 600250-70900533, Series 92)
  const codeMatch = text.match(/\b([A-Z]{1,4}-[A-Z0-9\-]{2,15}|[0-9]{5,10}-[0-9A-Z\-]{3,12}|Series\s*[0-9A-Z]+)\b/i);
  if (codeMatch && codeMatch[1]) {
    return codeMatch[1].trim();
  }

  return "";
};

export const extractMultiScenarioKeywords = (item) => {
  const brand = extractBrandFromItem(item);
  const model = extractModelFromItem(item);
  const rawName = item?.ten_vt || "";
  const nameCore = extractCleanImisKeyword(rawName);

  const text = `${rawName} ${item?.thong_so_kt || ""}`;
  const specMatch = text.match(/\b(\d+(?:\.\d+)?\s*(?:mm|inch|\"|in|DN\d+|bar|kV|kW|MW|V|A|OD\s*\d+))\b/i);
  const spec = specMatch ? specMatch[1].trim() : "";

  return {
    brandKw: brand,
    modelKw: model,
    nameKw: nameCore || rawName.split("\n")[0].split("-")[0].trim(),
    specKw: spec,
  };
};

export const getDefaultMscKeyword = (item, savedKw) => {
  if (savedKw && savedKw !== item?.ten_vt) return savedKw;
  const brand = extractBrandFromItem(item);
  if (brand) return brand;
  const model = extractModelFromItem(item);
  if (model) return model;
  return getDefaultImisKeyword(item?.ten_vt || "");
};

