export const getLatestCalibrationsByEquipment = (calibrations) => {
  const latestByEquipmentId = {};

  for (const cal of calibrations) {
    const equipmentId = cal.vaporiserId;
    if (!equipmentId) continue;

    const id = String(equipmentId);
    const existing = latestByEquipmentId[id];
    if (!existing || new Date(cal.date) > new Date(existing.date)) {
      latestByEquipmentId[id] = cal;
    }
  }

  return Object.values(latestByEquipmentId);
};

export const computeAcetoneVaporiserWidgetStats = (
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
    latestCalibrations.map((cal) => String(cal.vaporiserId))
  );

  let itemsDueInNextMonth = latestCalibrations.filter((cal) => {
    if (!cal.nextCalibration) return false;
    const nextCalDate = new Date(cal.nextCalibration);
    return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
  }).length;

  itemsDueInNextMonth += equipment.filter((eq) => {
    const hasCalibration = equipmentWithCalibrations.has(String(eq._id));
    const isOutOfService = eq.status === "out-of-service";
    return !hasCalibration && !isOutOfService;
  }).length;

  return { nextCalibrationDue, itemsDueInNextMonth };
};

export const normalizeAcetoneVaporiserCalibrations = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};
