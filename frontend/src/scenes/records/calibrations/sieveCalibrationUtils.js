export {
  readFileAsBase64,
  openCertificateData,
  formatDate,
} from "./primaryFlowmeterUtils";

export const getLatestCalibrationsByEquipment = (calibrations) => {
  const latestByReference = {};

  for (const cal of calibrations) {
    const ref = cal.sieveReference;
    if (!ref) continue;

    const existing = latestByReference[ref];
    if (!existing || new Date(cal.date) > new Date(existing.date)) {
      latestByReference[ref] = cal;
    }
  }

  return Object.values(latestByReference);
};

/** Widget stats: sieves do not require recurring calibration. */
export const computeSieveWidgetStats = (calibrations, equipment = []) => {
  const latestCalibrations = getLatestCalibrationsByEquipment(calibrations);
  const equipmentWithCalibrations = new Set(
    latestCalibrations.map((cal) => cal.sieveReference)
  );

  const itemsDueInNextMonth = equipment.filter((eq) => {
    const hasCalibration = equipmentWithCalibrations.has(eq.equipmentReference);
    const isOutOfService = eq.status === "out-of-service";
    return !hasCalibration && !isOutOfService;
  }).length;

  return { nextCalibrationDue: null, itemsDueInNextMonth };
};

export const enrichSieveWithCalibrations = (sieve, calibrations) => {
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

  return {
    ...sieve,
    lastCalibration,
    latestCalibration,
  };
};
