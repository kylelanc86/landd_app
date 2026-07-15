export const SAMPLE_TYPE_OPTIONS = [
  "Surface Fungi",
  "Air Fungi",
  "Air Allergen",
  "Air FAI",
];

export const SAMPLE_TYPE_SLUGS = {
  "Surface Fungi": "surface-fungi",
  "Air Fungi": "air-fungi",
  "Air Allergen": "air-allergen",
  "Air FAI": "air-fai",
};

export const SAMPLE_TYPE_FROM_SLUG = Object.fromEntries(
  Object.entries(SAMPLE_TYPE_SLUGS).map(([label, slug]) => [slug, label]),
);

export const SAMPLE_TYPE_COLORS = {
  "Surface Fungi": {
    color: "#1565c0",
    backgroundColor: "#e3f2fd",
    borderColor: "#1565c0",
    hoverBackgroundColor: "#bbdefb",
  },
  "Air Fungi": {
    color: "#e65100",
    backgroundColor: "#fff3e0",
    borderColor: "#e65100",
    hoverBackgroundColor: "#ffe0b2",
  },
  "Air Allergen": {
    color: "#2e7d32",
    backgroundColor: "#e8f5e9",
    borderColor: "#2e7d32",
    hoverBackgroundColor: "#c8e6c9",
  },
  "Air FAI": {
    color: "#6a1b9a",
    backgroundColor: "#f3e5f5",
    borderColor: "#6a1b9a",
    hoverBackgroundColor: "#e1bee7",
  },
};

export const CLEANING_STAGES = ["Before Cleaning", "After Cleaning"];

export const YES_NO_OPTIONS = ["Yes", "No"];

// Temporary hardcoded options until linked to in-app equipment records.
export const AIR_FUNGI_FLOWMETER_OPTIONS = ["MAIR001", "MAIR003"];

export const TURNAROUND_OPTIONS = ["3 day", "24 hours", "custom"];

export const SAMPLE_ENTRY_SUPPORTED_TYPES = [
  "Surface Fungi",
  "Air Fungi",
  "Air Allergen",
];

/** Air Fungi and Air Allergen share flowrate + flowmeter; QC is Air Fungi only. */
export const AIR_LIKE_SAMPLE_TYPES = ["Air Fungi", "Air Allergen"];

export const isAirLikeSampleType = (sampleType) =>
  AIR_LIKE_SAMPLE_TYPES.includes(sampleType);

export const isAirFungiSampleType = (sampleType) => sampleType === "Air Fungi";

export const isAirAllergenSampleType = (sampleType) =>
  sampleType === "Air Allergen";

export const PDF_SUPPORTED_SAMPLE_TYPES = [
  "Surface Fungi",
  "Air Fungi",
  "Air Allergen",
];

// Temporary placeholders until fetched from user/calibration data.
export const DEFAULT_MYCOMETER_CERTIFICATION = "MSF-3176-AU";
export const DEFAULT_STANDARD_VALUE = 535;

export const MYCOMETER_LICENCE_TYPE = "Mycometer Certification";

export const getMycometerLicence = (user) =>
  (user?.licences || []).find(
    (licence) => licence.licenceType === MYCOMETER_LICENCE_TYPE,
  );

/** Surface sample types use Surface cert; air sample types use Air cert. */
export const getMycometerCertFromUserIfPresent = (user, sampleType) => {
  const licence = getMycometerLicence(user);
  if (!licence) return "";
  const cert =
    sampleType === "Surface Fungi" ? licence.surface : licence.air;
  return (cert && String(cert).trim()) || "";
};

/** Surface sample types use Surface cert; air sample types use Air cert. */
export const getMycometerCertNumberForSampleType = (user, sampleType) => {
  return (
    getMycometerCertFromUserIfPresent(user, sampleType) ||
    DEFAULT_MYCOMETER_CERTIFICATION
  );
};

/**
 * Resolve Mycometer certification for PDF / display.
 * When work is complete (freezeSnapshot), use the immutable job snapshot so
 * historical reports keep the cert from when sampling/analysis was closed.
 * While still open, prefer the live user licence, then any snapshot.
 */
export const resolveMycometerCertNumber = ({
  user,
  sampleType,
  snapshottedCert,
  freezeSnapshot = false,
} = {}) => {
  const snapshot =
    typeof snapshottedCert === "string" && snapshottedCert.trim()
      ? snapshottedCert.trim()
      : "";

  if (freezeSnapshot && snapshot) {
    return snapshot;
  }

  return (
    getMycometerCertFromUserIfPresent(user, sampleType) ||
    snapshot ||
    DEFAULT_MYCOMETER_CERTIFICATION
  );
};

const formatPersonName = (person) => {
  if (!person) return "";
  if (typeof person === "string") return person;
  return (
    `${person.firstName || ""} ${person.lastName || ""}`.trim() ||
    person.email ||
    ""
  );
};

const formatNameWithCert = (name, cert) =>
  `${name || "N/A"} (${cert || DEFAULT_MYCOMETER_CERTIFICATION})`;

/** Prefer immutable job snapshot, then populated user object. */
export const getSamplerDisplayNameFromMeta = (samplingMeta) => {
  if (samplingMeta?.sampledByName) return samplingMeta.sampledByName;
  return formatPersonName(samplingMeta?.sampledBy) || null;
};

/** Prefer immutable job snapshot, then populated user object. */
export const getAnalystDisplayNameFromMeta = (analysisMeta) => {
  if (analysisMeta?.analystName) return analysisMeta.analystName;
  return formatPersonName(analysisMeta?.analyst) || null;
};

export const getSamplerDisplayWithCertFromMeta = (
  samplingMeta,
  sampleType,
) => {
  const name = getSamplerDisplayNameFromMeta(samplingMeta) || "N/A";
  const cert = resolveMycometerCertNumber({
    user: samplingMeta?.sampledBy,
    sampleType,
    snapshottedCert: samplingMeta?.mycometerCertificationNumber,
    freezeSnapshot: Boolean(samplingMeta?.samplingComplete),
  });
  return formatNameWithCert(name, cert);
};

export const getAnalystDisplayWithCertFromMeta = (
  analysisMeta,
  sampleType,
) => {
  const name = getAnalystDisplayNameFromMeta(analysisMeta) || "N/A";
  const cert = resolveMycometerCertNumber({
    user: analysisMeta?.analyst,
    sampleType,
    snapshottedCert: analysisMeta?.mycometerCertificationNumber,
    freezeSnapshot: Boolean(analysisMeta?.analysisComplete),
  });
  return formatNameWithCert(name, cert);
};

export const calculateMycometerValue = (analysisValue, blankValue) => {
  if (
    analysisValue === "" ||
    analysisValue === null ||
    analysisValue === undefined ||
    blankValue === "" ||
    blankValue === null ||
    blankValue === undefined
  ) {
    return null;
  }
  const analysis = Number(analysisValue);
  const blank = Number(blankValue);
  if (!Number.isFinite(analysis) || !Number.isFinite(blank)) return null;
  return Math.max(0, analysis - blank);
};

/** Excel O15: QC No → 1, QC Yes → 2 */
export const getAirFungiQcNumeric = (qualityControl) => {
  if (qualityControl === "Yes") return 2;
  if (qualityControl === "No") return 1;
  return null;
};

/**
 * Air Fungi MAFV/m³ (Excel):
 * =IF(analysis="","",IF(qc="","Quality control?",(analysis-blank)/(0.15*O15)))
 *
 * O15 = QC numeric: No → 1, Yes → 2
 * So:
 *   QC No  → (analysis − blank) / 0.15
 *   QC Yes → (analysis − blank) / 0.30
 *
 * Flowrate is not in this formula (it is used for reaction time via N/P columns).
 * Result category A+/A/B/C/D is always derived from the numeric MAFV.
 */
export const calculateAirFungiMafv = ({
  analysisValue,
  blankValue,
  qualityControl,
}) => {
  if (
    analysisValue === "" ||
    analysisValue === null ||
    analysisValue === undefined
  ) {
    return { kind: "empty", value: null, display: "—" };
  }

  if (!qualityControl) {
    return {
      kind: "missing_qc",
      value: null,
      display: "Quality control?",
    };
  }

  if (
    blankValue === "" ||
    blankValue === null ||
    blankValue === undefined
  ) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const analysis = Number(analysisValue);
  const blank = Number(blankValue);
  const qcNumeric = getAirFungiQcNumeric(qualityControl);
  if (
    !Number.isFinite(analysis) ||
    !Number.isFinite(blank) ||
    qcNumeric === null
  ) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const mafv = Math.max(0, (analysis - blank) / (0.15 * qcNumeric));
  if (!Number.isFinite(mafv)) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const rounded = Math.round(mafv);
  return { kind: "value", value: rounded, display: String(rounded) };
};

/**
 * Air Allergen MAAV/m³ (Excel):
 * =IF(F12="","",(F12-E12)/(0.15))
 *
 * F12 = analysis value, E12 = blank value
 * No QC factor (unlike Air Fungi MAFV).
 * Negative results are floored to 0.
 */
export const calculateAirAllergenMaav = ({ analysisValue, blankValue }) => {
  if (
    analysisValue === "" ||
    analysisValue === null ||
    analysisValue === undefined
  ) {
    return { kind: "empty", value: null, display: "—" };
  }

  if (
    blankValue === "" ||
    blankValue === null ||
    blankValue === undefined
  ) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const analysis = Number(analysisValue);
  const blank = Number(blankValue);
  if (!Number.isFinite(analysis) || !Number.isFinite(blank)) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const maav = Math.max(0, (analysis - blank) / 0.15);
  if (!Number.isFinite(maav)) {
    return { kind: "incomplete", value: null, display: "—" };
  }

  const value = Math.round(maav);
  return { kind: "value", value, display: String(value) };
};

export const getSurfaceFungiResultCategory = (msfv) => {
  if (msfv === null || !Number.isFinite(msfv)) return null;
  if (msfv <= 20) {
    return {
      code: "A",
      label: "Normal",
      sx: { bgcolor: "#2e7d32", color: "#fff" },
    };
  }
  if (msfv <= 135) {
    return {
      code: "B",
      label: "Elevated",
      sx: { bgcolor: "#ed6c02", color: "#fff" },
    };
  }
  return {
    code: "C",
    label: "High",
    sx: { bgcolor: "#d32f2f", color: "#fff" },
  };
};

export const getAirFungiResultCategory = (mafv) => {
  if (mafv === null || !Number.isFinite(mafv)) return null;
  if (mafv <= 35) {
    return {
      code: "A+",
      label: "Low",
      sx: { bgcolor: "#c8e6c9", color: "#1b5e20" },
    };
  }
  if (mafv <= 145) {
    return {
      code: "A",
      label: "Normal",
      sx: { bgcolor: "#2e7d32", color: "#fff" },
    };
  }
  if (mafv <= 240) {
    return {
      code: "B",
      label: "Elevated",
      sx: { bgcolor: "#fbc02d", color: "#333" },
    };
  }
  if (mafv <= 680) {
    return {
      code: "C",
      label: "High",
      sx: { bgcolor: "#ed6c02", color: "#fff" },
    };
  }
  return {
    code: "D",
    label: "Very high",
    sx: { bgcolor: "#d32f2f", color: "#fff" },
  };
};

export const getAirFungiResultDisplay = (mafvResult) => {
  if (!mafvResult) return null;
  if (mafvResult.kind === "missing_qc") {
    return {
      code: "QC?",
      label: "Answer required",
      sx: { bgcolor: "#eceff1", color: "#455a64" },
    };
  }
  if (mafvResult.kind === "value") {
    return getAirFungiResultCategory(mafvResult.value);
  }
  return null;
};

/**
 * Air Allergen result categories:
 * A+ Low        MAAV < 275
 * A Normal      MAAV 276 – 1375
 * B Elevated    MAAV 1376 – 2300
 * C High        MAAV 2301 – 7750
 * D Very high   MAAV > 7750
 */
export const getAirAllergenResultCategory = (maav) => {
  if (maav === null || !Number.isFinite(maav)) return null;
  if (maav < 275) {
    return {
      code: "A+",
      label: "Low",
      sx: { bgcolor: "#c8e6c9", color: "#1b5e20" },
    };
  }
  if (maav <= 1375) {
    return {
      code: "A",
      label: "Normal",
      sx: { bgcolor: "#2e7d32", color: "#fff" },
    };
  }
  if (maav <= 2300) {
    return {
      code: "B",
      label: "Elevated",
      sx: { bgcolor: "#fbc02d", color: "#333" },
    };
  }
  if (maav <= 7750) {
    return {
      code: "C",
      label: "High",
      sx: { bgcolor: "#ed6c02", color: "#fff" },
    };
  }
  return {
    code: "D",
    label: "Very high",
    sx: { bgcolor: "#d32f2f", color: "#fff" },
  };
};

export const getAirAllergenResultDisplay = (maavResult) => {
  if (!maavResult) return null;
  if (maavResult.kind === "value") {
    return getAirAllergenResultCategory(maavResult.value);
  }
  return null;
};

export const calculateAirSampleValue = (sampleType, args) => {
  if (sampleType === "Air Allergen") return calculateAirAllergenMaav(args);
  return calculateAirFungiMafv(args);
};

export const getAirSampleResultDisplay = (sampleType, result) => {
  if (sampleType === "Air Allergen") {
    return getAirAllergenResultDisplay(result);
  }
  return getAirFungiResultDisplay(result);
};

export const getMycometerValueLabel = (sampleType) => {
  if (sampleType === "Air Fungi") return "Mycometer value (MAFV/m³)";
  if (sampleType === "Air Allergen") return "Mycometer value (MAAV/m³)";
  return "Mycometer value (MSFV)";
};

export const getResultCategoryForSampleType = (sampleType, value) => {
  if (sampleType === "Air Fungi") return getAirFungiResultCategory(value);
  if (sampleType === "Air Allergen") return getAirAllergenResultCategory(value);
  return getSurfaceFungiResultCategory(value);
};

export const AIR_FUNGI_MIN_FLOWRATE_LPM = 9.49;
export const AIR_FUNGI_MAIR001_FLOWRATE_DIVISOR = 1.33333;
export const AIR_FUNGI_NORMALISED_FLOWRATE_TARGET = 15;

/**
 * Excel N column — adjusted flowrate from rotameter / flowmeter:
 * MAIR001 → entered flowrate / 1.33333
 * MAIR003 (and others) → entered flowrate
 */
export const getAirFungiAdjustedFlowrate = (flowRate, flowmeter) => {
  const flow = Number(flowRate);
  if (!Number.isFinite(flow) || flow <= 0) return null;
  if (flowmeter === "MAIR001") {
    return flow / AIR_FUNGI_MAIR001_FLOWRATE_DIVISOR;
  }
  return flow;
};

/**
 * Excel P15 — normalised flowrate: 15 / N (adjusted flowrate)
 */
export const getAirFungiNormalisedFlowrateFactor = (flowRate, flowmeter) => {
  const adjusted = getAirFungiAdjustedFlowrate(flowRate, flowmeter);
  if (adjusted === null || adjusted === 0) return null;
  return AIR_FUNGI_NORMALISED_FLOWRATE_TARGET / adjusted;
};

/**
 * Air Fungi per-sample reaction time (Excel EngGer path):
 * durationMinutes = (217.42 / EXP(-5798.1*(1/(T+273))+24.97)) * P15 * O15 * 45
 * displayed as hh:mm:ss
 *
 * O15 = QC numeric (1=No, 2=Yes)
 * G15 = entered flowrate (validation: empty / < 9.49)
 * N15 = adjusted flowrate (MAIR001 ÷ 1.33333, else as entered)
 * P15 = 15 / N15
 * J9 = room temperature
 * J10 = rotameter / flowmeter selection
 */
export const calculateAirFungiReactionTime = ({
  roomTemperature,
  flowmeter,
  qualityControl,
  flowRate,
  sampleHasData = true,
}) => {
  if (!sampleHasData) {
    return { ok: false, kind: "empty", display: "" };
  }

  if (
    roomTemperature === "" ||
    roomTemperature === null ||
    roomTemperature === undefined
  ) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  if (!flowmeter) {
    return {
      ok: false,
      kind: "error",
      display: "Select rotameter calibration",
    };
  }

  if (!qualityControl) {
    return { ok: false, kind: "error", display: "Quality control?" };
  }

  if (flowRate === "" || flowRate === null || flowRate === undefined) {
    return { ok: false, kind: "error", display: "Insert flowrate" };
  }

  const flow = Number(flowRate);
  if (!Number.isFinite(flow) || flow < AIR_FUNGI_MIN_FLOWRATE_LPM) {
    return { ok: false, kind: "error", display: "Flowrate too low" };
  }

  const temperature = Number(roomTemperature);
  if (!Number.isFinite(temperature)) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  const qcNumeric = getAirFungiQcNumeric(qualityControl);
  if (qcNumeric === null) {
    return { ok: false, kind: "error", display: "Quality control?" };
  }

  const p15 = getAirFungiNormalisedFlowrateFactor(flowRate, flowmeter);
  if (p15 === null) {
    return { ok: false, kind: "error", display: "Insert flowrate" };
  }

  const durationMinutes =
    (217.42 /
      Math.exp(-5798.1 * (1 / (temperature + 273)) + 24.97)) *
    p15 *
    qcNumeric *
    45;

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  const totalSeconds = Math.round(durationMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    ok: true,
    kind: "time",
    display,
    durationMinutes,
    adjustedFlowrate: getAirFungiAdjustedFlowrate(flowRate, flowmeter),
    normalisedFactor: p15,
  };
};

/**
 * Air Allergen per-sample reaction time (Excel EngGer path):
 * durationMinutes = (217.42 / EXP(-5798.1*(1/(T+273))+24.97)) * P * 45
 * displayed as hh:mm:ss
 *
 * Same base / flow path as Air Fungi, but no QC multiplier.
 */
export const calculateAirAllergenReactionTime = ({
  roomTemperature,
  flowmeter,
  flowRate,
  sampleHasData = true,
}) => {
  if (!sampleHasData) {
    return { ok: false, kind: "empty", display: "" };
  }

  if (
    roomTemperature === "" ||
    roomTemperature === null ||
    roomTemperature === undefined
  ) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  if (!flowmeter) {
    return {
      ok: false,
      kind: "error",
      display: "Select rotameter calibration",
    };
  }

  if (flowRate === "" || flowRate === null || flowRate === undefined) {
    return { ok: false, kind: "error", display: "Insert flowrate" };
  }

  const flow = Number(flowRate);
  if (!Number.isFinite(flow) || flow < AIR_FUNGI_MIN_FLOWRATE_LPM) {
    return { ok: false, kind: "error", display: "Flowrate too low" };
  }

  const temperature = Number(roomTemperature);
  if (!Number.isFinite(temperature)) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  const pFactor = getAirFungiNormalisedFlowrateFactor(flowRate, flowmeter);
  if (pFactor === null) {
    return { ok: false, kind: "error", display: "Insert flowrate" };
  }

  const durationMinutes =
    (217.42 /
      Math.exp(-5798.1 * (1 / (temperature + 273)) + 24.97)) *
    pFactor *
    45;

  if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
    return { ok: false, kind: "error", display: "Insert temperature" };
  }

  const totalSeconds = Math.round(durationMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    ok: true,
    kind: "time",
    display,
    durationMinutes,
    adjustedFlowrate: getAirFungiAdjustedFlowrate(flowRate, flowmeter),
    normalisedFactor: pFactor,
  };
};

export const calculateAirSampleReactionTime = (sampleType, args) => {
  if (sampleType === "Air Allergen") {
    return calculateAirAllergenReactionTime(args);
  }
  return calculateAirFungiReactionTime(args);
};

export const getOrderedScopeOfWorks = (scopeOfWorks = []) =>
  SAMPLE_TYPE_OPTIONS.filter((type) => scopeOfWorks.includes(type));

/**
 * Derive UI status for a sample type on a Mycometer job.
 * Status chip mirrors air monitoring shift reporting; authorisation is separate.
 * Blank until at least one sample has been added for the report type.
 */
export const getSampleTypeReportStatus = (job, sampleType) => {
  const sampleCount = (job?.samples || []).filter(
    (sample) => sample.sampleType === sampleType,
  ).length;

  if (sampleCount === 0) {
    return {
      key: "empty",
      label: "",
      chipColor: null,
    };
  }

  const samplingMeta = (job?.samplingMeta || []).find(
    (item) => item.sampleType === sampleType,
  );
  const analysisMeta = (job?.analysisMeta || []).find(
    (item) => item.sampleType === sampleType,
  );

  if (analysisMeta?.analysisComplete) {
    return {
      key: "analysis_complete",
      label: "Analysis Complete",
      chipColor: "#2e7d32",
    };
  }
  if (samplingMeta?.samplingComplete) {
    return {
      key: "sampling_complete",
      label: "Sampling Complete",
      chipColor: "#ed6c02",
    };
  }
  return {
    key: "sampling_in_progress",
    label: "Sampling In Progress",
    chipColor: "#1976d2",
  };
};

export const getJobReportProgress = (job) => {
  const scope = getOrderedScopeOfWorks(job?.scopeOfWorks);
  if (scope.length === 0) return { complete: 0, total: 0 };
  const complete = scope.filter((type) => {
    const analysisMeta = (job?.analysisMeta || []).find(
      (item) => item.sampleType === type,
    );
    return Boolean(analysisMeta?.reportApprovedBy);
  }).length;
  return { complete, total: scope.length };
};
