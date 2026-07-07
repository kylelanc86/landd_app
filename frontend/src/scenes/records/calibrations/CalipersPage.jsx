import React from "react";
import ExternalCalibrationListPage from "./ExternalCalibrationListPage";
import caliperCalibrationService from "../../../services/caliperCalibrationService";
import {
  enrichCaliperWithCalibrations,
  formatUncertaintyAt30mm,
  REFERENCE_FIELD,
} from "./caliperCalibrationUtils";

const CalipersPage = () => (
  <ExternalCalibrationListPage
    title="Caliper Calibrations"
    equipmentSectionTitle="Caliper Equipment"
    equipmentType="Caliper"
    emptyMessage="No caliper equipment found"
    routeBase="/records/laboratory/calibrations/calipers"
    referenceField={REFERENCE_FIELD}
    calibrationService={caliperCalibrationService}
    enrichWithCalibrations={enrichCaliperWithCalibrations}
    historyEmptyMessage="No calibration history found for this caliper."
    metricColumns={[
      {
        header: "Uncertainty at 30mm (μm)",
        getValue: (item) => formatUncertaintyAt30mm(item.latestUncertaintyAt30mm),
      },
    ]}
    historyColumns={[
      {
        header: "Calibration Company",
        getValue: (cal) => cal.calibrationCompany || "-",
      },
      {
        header: "Uncertainty at 30mm (μm)",
        getValue: (cal) => formatUncertaintyAt30mm(cal.uncertaintyAt30mm),
      },
    ]}
  />
);

export default CalipersPage;
