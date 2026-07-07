import {
  readFileAsBase64,
  openCertificateData,
  formatDate,
  formatMeasurementValue,
} from "./primaryFlowmeterUtils";

export {
  readFileAsBase64,
  openCertificateData,
  formatDate,
  formatMeasurementValue,
};

export const UNCERTAINTY_LABEL = "Uncertainty of Measurement (°C)";

export const formatUncertaintyOfMeasurement = (value) => {
  const display = formatMeasurementValue(value);
  if (display === null) return "-";
  return `± ${display} °C`;
};

export const getLatestCalibrationsByEquipment = (calibrations) => {
  const latestByReference = {};

  for (const cal of calibrations) {
    const ref = cal.furnaceReference;
    if (!ref) continue;

    const existing = latestByReference[ref];
    if (!existing || new Date(cal.date) > new Date(existing.date)) {
      latestByReference[ref] = cal;
    }
  }

  return Object.values(latestByReference);
};

export const computeFurnaceWidgetStats = (calibrations, equipment = []) => {
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
    latestCalibrations.map((cal) => cal.furnaceReference)
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

export const enrichFurnaceWithCalibrations = (furnace, calibrations) => {
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
    ...furnace,
    lastCalibration,
    calibrationDue,
    latestCalibration,
    latestUncertaintyOfMeasurement:
      latestCalibration?.uncertaintyOfMeasurement ?? null,
  };
};
