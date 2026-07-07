import {
  computeExternalWidgetStats,
  enrichEquipmentWithCalibrations,
} from "./externalEquipmentCalibrationUtils";

export {
  readFileAsBase64,
  openCertificateData,
  formatDate,
  formatPassFail,
} from "./externalEquipmentCalibrationUtils";

export const REFERENCE_FIELD = "fumeHoodReference";

export const computeFumeHoodWidgetStats = (calibrations, equipment = []) =>
  computeExternalWidgetStats(calibrations, equipment, REFERENCE_FIELD);

export const enrichFumeHoodWithCalibrations = (equipment, calibrations) =>
  enrichEquipmentWithCalibrations(equipment, calibrations, (latest) => ({
    latestFaceVelocity: latest?.faceVelocity ?? null,
    latestAirChanges: latest?.airChanges ?? null,
  }));
