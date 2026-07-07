import { formatDate } from "../../../utils/dateFormat";

export const UNCERTAINTY_LABEL = "Uncertainty of Measurement (mL)";

export const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const openCertificateData = (
  certificateData,
  fileType = "application/pdf"
) => {
  if (!certificateData) return;

  if (
    typeof certificateData === "string" &&
    !certificateData.startsWith("http")
  ) {
    const byteCharacters = atob(certificateData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: fileType });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return;
  }

  window.open(certificateData, "_blank");
};

const stripInsignificantDecimalZeros = (formatted) => {
  if (!formatted.includes(".")) return formatted;
  return formatted
    .replace(/(\.[0-9]*[1-9])0+$/, "$1")
    .replace(/\.0+$/, "");
};

export const formatMeasurementValue = (value, significantFigures = 2) => {
  if (value === null || value === undefined || value === "") return null;
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;

  const abs = Math.abs(num);
  if (abs === 0) return "0";

  const digits = Math.max(significantFigures, 1);
  const exponent = Math.floor(Math.log10(abs));
  const decimalPlaces = digits - 1 - exponent;

  let formatted;
  if (decimalPlaces >= 0) {
    formatted = abs.toFixed(decimalPlaces);
  } else {
    const factor = Math.pow(10, exponent - (digits - 1));
    const rounded = Math.round(abs / factor) * factor;
    formatted = String(rounded);
  }

  return stripInsignificantDecimalZeros(formatted);
};

export const formatUncertaintyOfMeasurement = (value) => {
  const display = formatMeasurementValue(value);
  if (display === null) return "-";
  return `± ${display}`;
};

/** Latest calibration record per flowmeter reference (by calibration date). */
export const getLatestCalibrationsByEquipment = (calibrations) => {
  const latestByReference = {};

  for (const cal of calibrations) {
    const ref = cal.flowmeterReference;
    if (!ref) continue;

    const existing = latestByReference[ref];
    if (!existing || new Date(cal.date) > new Date(existing.date)) {
      latestByReference[ref] = cal;
    }
  }

  return Object.values(latestByReference);
};

/** Widget stats: soonest next due among latest records; due-in-30-days count. */
export const computePrimaryFlowmeterWidgetStats = (
  calibrations,
  equipment = []
) => {
  const latestCalibrations = getLatestCalibrationsByEquipment(calibrations);

  const validNextCalibrations = latestCalibrations
    .filter((cal) => cal.nextCalibration)
    .map((cal) => new Date(cal.nextCalibration))
    .sort((a, b) => a - b);

  const nextCalibrationDue =
    validNextCalibrations.length > 0 ? validNextCalibrations[0] : null;

  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  const equipmentWithCalibrations = new Set(
    latestCalibrations.map((cal) => cal.flowmeterReference)
  );

  let itemsDueInNextMonth = latestCalibrations.filter((cal) => {
    if (!cal.nextCalibration) return false;
    const nextCalDate = new Date(cal.nextCalibration);
    return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
  }).length;

  itemsDueInNextMonth += equipment.filter((eq) => {
    const hasCalibration = equipmentWithCalibrations.has(eq.equipmentReference);
    const isOutOfService = eq.status === "out-of-service";
    return !hasCalibration && !isOutOfService;
  }).length;

  return { nextCalibrationDue, itemsDueInNextMonth };
};

export const enrichFlowmeterWithCalibrations = (flowmeter, calibrations) => {
  const lastCalibration =
    calibrations.length > 0
      ? new Date(
          Math.max(...calibrations.map((cal) => new Date(cal.date).getTime()))
        )
      : null;

  const latestCalibration =
    calibrations.length > 0
      ? calibrations.reduce((latest, cal) =>
          new Date(cal.date) > new Date(latest.date) ? cal : latest
        )
      : null;

  const calibrationDue = latestCalibration?.nextCalibration
    ? new Date(latestCalibration.nextCalibration)
    : null;

  return {
    ...flowmeter,
    lastCalibration,
    calibrationDue,
    latestCalibration,
    latestUncertaintyOfMeasurement:
      latestCalibration?.uncertaintyOfMeasurement ??
      latestCalibration?.error ??
      null,
  };
};

export { formatDate };
