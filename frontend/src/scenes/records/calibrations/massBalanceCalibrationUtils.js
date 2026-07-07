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

export const REFERENCE_FIELD = "massBalanceReference";

export const UNCERTAINTY_LABEL = "Uncertainty at 1000g (g)";

export const formatUncertaintyAt1000g = (value) => formatSignedValue(value, "g");

export const computeMassBalanceWidgetStats = (calibrations, equipment = []) =>
  computeExternalWidgetStats(calibrations, equipment, REFERENCE_FIELD);

export const enrichMassBalanceWithCalibrations = (equipment, calibrations) =>
  enrichEquipmentWithCalibrations(equipment, calibrations, (latest) => ({
    latestUncertaintyAt1000g: latest?.uncertaintyAt1000g ?? null,
  }));
