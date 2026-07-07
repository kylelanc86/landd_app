import React from "react";
import ExternalCalibrationListPage from "./ExternalCalibrationListPage";
import micrometerCalibrationService from "../../../services/micrometerCalibrationService";
import {
  enrichMicrometerWithCalibrations,
  formatUncertaintyOfMeasurement,
  REFERENCE_FIELD,
} from "./micrometerCalibrationUtils";

const MicrometerPage = () => (
  <ExternalCalibrationListPage
    title="Micrometer Calibrations"
    equipmentSectionTitle="Micrometer Equipment"
    equipmentType="Micrometer"
    emptyMessage="No micrometer equipment found"
    routeBase="/records/laboratory/calibrations/micrometer"
    referenceField={REFERENCE_FIELD}
    calibrationService={micrometerCalibrationService}
    enrichWithCalibrations={enrichMicrometerWithCalibrations}
    historyEmptyMessage="No calibration history found for this micrometer."
    metricColumns={[
      {
        header: "Uncertainty (mm)",
        getValue: (item) =>
          formatUncertaintyOfMeasurement(item.latestUncertaintyOfMeasurement),
      },
    ]}
    historyColumns={[
      {
        header: "Calibration Company",
        getValue: (cal) => cal.calibrationCompany || "-",
      },
      {
        header: "Uncertainty (mm)",
        getValue: (cal) => formatUncertaintyOfMeasurement(cal.uncertaintyOfMeasurement),
      },
    ]}
  />
);

export default MicrometerPage;
