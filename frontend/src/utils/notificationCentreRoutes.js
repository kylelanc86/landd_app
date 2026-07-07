const CALIBRATION_SOURCE_ROUTES = {
  "Air Pump Calibration": "/records/laboratory/calibrations/air-pump",
  "Site Rotameter Calibration": "/records/laboratory/calibrations/flowmeter",
  "Primary Flowmeter Calibration":
    "/records/laboratory/calibrations/primary-flowmeter",
  "Furnace Calibration": "/records/laboratory/calibrations/furnace",
  "Pneumatic Tester Calibration":
    "/records/laboratory/calibrations/pneumatic-tester",
  "Mass Balance Calibration": "/records/laboratory/calibrations/mass-balances",
  "Micrometer Calibration": "/records/laboratory/calibrations/micrometer",
  "Fume Hood Calibration": "/records/laboratory/calibrations/fume-hoods",
  "Caliper Calibration": "/records/laboratory/calibrations/calipers",
  "Sieve Calibration": "/records/laboratory/calibrations/sieves",
  "Acetone Vaporiser Calibration":
    "/records/laboratory/calibrations/acetone-vaporiser",
  "RI Liquid Calibration": "/records/laboratory/calibrations/ri-liquid",
  "EFA Calibration": "/records/laboratory/calibrations/efa",
  "Graticule Calibration": "/records/laboratory/calibrations/graticule",
  "HSE Test Slide Calibration":
    "/records/laboratory/calibrations/hse-test-slide",
  "PCM Microscope Calibration": "/records/laboratory/calibrations/microscope",
  "PLM Microscope Calibration":
    "/records/laboratory/calibrations/plm-microscope",
  "Stereomicroscope Calibration":
    "/records/laboratory/calibrations/stereomicroscope",
};

export const getNotificationTargetPath = (row) => {
  const recordType = row.kind || row.recordType;

  if (recordType === "IAQ") {
    // TODO(iaq-notifications): Deep link to a specific IAQ record when recordId is available.
    return row.recordId
      ? `/records/indoor-air-quality/${row.recordId}/samples`
      : "/records/indoor-air-quality";
  }

  if (recordType === "Audit") {
    // TODO(audit-notifications): Deep link to a specific audit when audit routes support it.
    return "/records/audits";
  }

  if (row.source) {
    return CALIBRATION_SOURCE_ROUTES[row.source] || null;
  }

  return null;
};
