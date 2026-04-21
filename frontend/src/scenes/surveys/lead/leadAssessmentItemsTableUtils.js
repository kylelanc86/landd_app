/** Pure helpers for lead assessment sample tables (shared by LeadAssessmentItems + virtualized table). */

export const TABLE_FONT_SIZE = "0.8rem";

export const PAINT_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  paintColour: "12%",
  leadContent: "12%",
  status: "10%",
  description: "30%",
  risk: "12%",
  actions: "130px",
};

export const DUST_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  description: "26%",
  leadContent: "12%",
  leadConcentration: "14%",
  status: "12%",
  risk: "8%",
  actions: "130px",
};

export const SOIL_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  paintColour: "12%",
  description: "27%",
  leadContent: "12%",
  status: "16%",
  actions: "130px",
};

function getRiskLevelLabel(product) {
  if (product == null || product < 7) return "VERY LOW RISK";
  if (product <= 18) return "LOW RISK";
  if (product <= 35) return "MEDIUM RISK";
  return "HIGH RISK";
}

export function getItemRisk(item) {
  const o = item.occupantRating;
  const l = item.locationRating;
  const u = item.roomUseRating;
  const c = item.conditionRating;
  if (o == null || o === "" || l == null || l === "" || u == null || u === "" || c == null || c === "") return null;
  const product = Number(o) * Number(l) * Number(u) * Number(c);
  return { product, label: getRiskLevelLabel(product) };
}

export function riskChipDisplayLabel(label) {
  return String(label || "").replace(/\s+RISK$/i, "").trim() || "—";
}

export function getRiskBadgeSx(riskLabel) {
  return {
    px: 1.5,
    py: 0.75,
    borderRadius: 1,
    display: "inline-block",
    fontWeight: 600,
    bgcolor:
      riskLabel === "HIGH RISK"
        ? "error.light"
        : riskLabel === "MEDIUM RISK"
          ? "yellow"
          : riskLabel === "LOW RISK"
            ? "info.light"
            : "success.light",
    color:
      riskLabel === "HIGH RISK"
        ? "error.contrastText"
        : riskLabel === "MEDIUM RISK"
          ? "grey.900"
          : riskLabel === "LOW RISK"
            ? "info.contrastText"
            : "success.contrastText",
  };
}

function parseLeadPercent(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function getLeadPaintStatus(leadContent) {
  const pct = parseLeadPercent(leadContent);
  if (pct == null) return null;
  if (pct > 0.1) return { label: "Lead paint", isLeadPaint: true };
  return { label: "Lead-free", isLeadPaint: false };
}

function parseSoilAssessmentCriteriaThreshold(assessmentCriteria) {
  if (!assessmentCriteria) return null;
  const match = String(assessmentCriteria).match(/\(([\d.]+)\s*mg\/kg\)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function getSoilStatus(leadContent, assessmentCriteria) {
  const contentValue = parseLeadPercent(leadContent);
  const threshold = parseSoilAssessmentCriteriaThreshold(assessmentCriteria);
  if (contentValue == null || threshold == null) return null;
  const exceeds = contentValue >= threshold;
  return {
    exceeds,
    label: exceeds ? "Exceedance" : "No exceedance",
  };
}

function getSampleAreaM2(sampleArea) {
  if (sampleArea == null || sampleArea === "") return null;
  const s = String(sampleArea).toLowerCase().trim();
  if (s === "small" || s.includes("0.01")) return 0.01;
  if (s === "medium" || s.includes("0.0258")) return 0.0258;
  if (s === "large" || s.includes("0.09")) return 0.09;
  const numeric = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea) {
  const ug = parseLeadPercent(leadContentUg);
  const areaM2 = getSampleAreaM2(sampleArea);
  if (ug == null || areaM2 == null || areaM2 <= 0) return null;
  return (ug / 1000) / areaM2;
}

export function formatDustLeadConcentrationMgM2(leadContentUg, sampleArea) {
  const mgPerM2 = calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea);
  if (mgPerM2 == null) return "—";
  return `${mgPerM2.toFixed(4)} mg/m²`;
}

export function getDustExceedanceStatus(locationRating, leadContentUg, sampleArea) {
  const concentration = calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea);
  if (concentration == null) return null;

  const rating = Number(locationRating);
  const thresholdByRating = {
    1: 1.08,
    2: 0.43,
    3: 0.11,
  };
  const threshold = thresholdByRating[rating];
  if (threshold == null) return null;

  const exceeds = concentration >= threshold;
  return {
    exceeds,
    label: exceeds ? "Exceedance" : "No exceedence",
  };
}

export function formatRoomAreaWithLevel(levelFloor, roomArea) {
  const level = (levelFloor || "").trim();
  const room = (roomArea || "").trim();
  if (level && room) return `${level} - ${room}`;
  if (level) return level;
  if (room) return room;
  return "—";
}
