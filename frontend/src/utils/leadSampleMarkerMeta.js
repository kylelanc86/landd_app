/**
 * Lead assessment sample “positive” / exceedance logic for site plan markers (aligned with LeadAssessmentItems tables).
 */

function parseLeadPercent(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function getLeadPaintStatus(leadContent) {
  const pct = parseLeadPercent(leadContent);
  if (pct == null) return null;
  if (pct > 0.1) return { isPositive: true };
  return { isPositive: false };
}

function parseSoilAssessmentCriteriaThreshold(assessmentCriteria) {
  if (!assessmentCriteria) return null;
  const match = String(assessmentCriteria).match(/\(([\d.]+)\s*mg\/kg\)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getSoilExceedance(leadContent, paintColourField) {
  const contentValue = parseLeadPercent(leadContent);
  const threshold = parseSoilAssessmentCriteriaThreshold(paintColourField);
  if (contentValue == null || threshold == null) return null;
  return { isPositive: contentValue >= threshold };
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

function getDustExceedance(leadContentUg, sampleArea, locationRating) {
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

  return { isPositive: concentration >= threshold };
}

/**
 * @param {object} item - assessment item (materialType, leadContent, paintColour, leadSampleArea, locationRating, sampleReference)
 * @param {string} [effectiveLeadContent] - optional draft override
 * @returns {{ value: string, isPositive: boolean, statusKnown: boolean }}
 */
export function getLeadSampleMarkerMeta(item, effectiveLeadContent) {
  const ref = String(item?.sampleReference || "").trim();
  const value = {
    value: ref,
    isPositive: false,
    statusKnown: false,
  };
  if (!ref) return value;

  const content =
    effectiveLeadContent !== undefined && effectiveLeadContent !== null
      ? String(effectiveLeadContent).trim()
      : String(item?.leadContent ?? "").trim();

  const mt = String(item?.materialType || "").toLowerCase();

  if (mt === "paint" || mt === "paint-xrf") {
    const s = getLeadPaintStatus(content);
    if (s) {
      value.statusKnown = true;
      value.isPositive = s.isPositive;
    }
    return value;
  }

  if (mt === "soil") {
    const s = getSoilExceedance(content, item?.paintColour);
    if (s) {
      value.statusKnown = true;
      value.isPositive = s.isPositive;
    }
    return value;
  }

  if (mt === "dust") {
    const s = getDustExceedance(content, item?.leadSampleArea, item?.locationRating);
    if (s) {
      value.statusKnown = true;
      value.isPositive = s.isPositive;
    }
    return value;
  }

  return value;
}

export const LEAD_SAMPLE_MARKER_COLORS = {
  positive: "#c62828",
  negative: "#2e7d32",
  unknown: "#546e7a",
};
