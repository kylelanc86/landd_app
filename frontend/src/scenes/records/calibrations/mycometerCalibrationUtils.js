import {
  computeExternalWidgetStats,
  enrichEquipmentWithCalibrations,
} from "./externalEquipmentCalibrationUtils";

export {
  readFileAsBase64,
  openCertificateData,
  formatDate,
} from "./externalEquipmentCalibrationUtils";

export const REFERENCE_FIELD = "mycometerReference";

export const MYCOMETER_EQUIPMENT_TYPES = [
  "Mycometer Analyser",
  "Mycometer Rotameter",
];

export const computeMycometerWidgetStats = (calibrations, equipment = []) =>
  computeExternalWidgetStats(calibrations, equipment, REFERENCE_FIELD);

export const enrichMycometerWithCalibrations = (equipment, calibrations) =>
  enrichEquipmentWithCalibrations(equipment, calibrations);
