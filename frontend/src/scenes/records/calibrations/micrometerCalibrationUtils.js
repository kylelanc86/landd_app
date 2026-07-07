import {
  formatSignedValue,
  computeExternalWidgetStats,
  enrichEquipmentWithCalibrations,
} from "./externalEquipmentCalibrationUtils";

export {
  readFileAsBase64,
  openCertificateData,
  formatDate,
} from "./externalEquipmentCalibrationUtils";

export const REFERENCE_FIELD = "micrometerReference";

export const UNCERTAINTY_LABEL = "Uncertainty (mm)";

export const formatUncertaintyOfMeasurement = (value) => formatSignedValue(value, "mm");

export const computeMicrometerWidgetStats = (calibrations, equipment = []) =>
  computeExternalWidgetStats(calibrations, equipment, REFERENCE_FIELD);

export const enrichMicrometerWithCalibrations = (equipment, calibrations) =>
  enrichEquipmentWithCalibrations(equipment, calibrations, (latest) => ({
    latestUncertaintyOfMeasurement: latest?.uncertaintyOfMeasurement ?? null,
  }));
