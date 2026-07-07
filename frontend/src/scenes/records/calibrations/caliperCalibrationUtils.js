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

export const REFERENCE_FIELD = "caliperReference";

export const UNCERTAINTY_LABEL = "Uncertainty at 30mm (μm)";

export const formatUncertaintyAt30mm = (value) => formatSignedValue(value, "μm");

export const computeCaliperWidgetStats = (calibrations, equipment = []) =>
  computeExternalWidgetStats(calibrations, equipment, REFERENCE_FIELD);

export const enrichCaliperWithCalibrations = (equipment, calibrations) =>
  enrichEquipmentWithCalibrations(equipment, calibrations, (latest) => ({
    latestUncertaintyAt30mm: latest?.uncertaintyAt30mm ?? null,
  }));
