import React from "react";
import ExternalCalibrationListPage from "./ExternalCalibrationListPage";
import massBalanceCalibrationService from "../../../services/massBalanceCalibrationService";
import {
  enrichMassBalanceWithCalibrations,
  formatUncertaintyAt1000g,
  REFERENCE_FIELD,
} from "./massBalanceCalibrationUtils";

const MassBalancesPage = () => (
  <ExternalCalibrationListPage
    title="Mass Balance Calibrations"
    equipmentSectionTitle="Mass Balance Equipment"
    equipmentType="Mass Balance"
    emptyMessage="No mass balance equipment found"
    routeBase="/records/laboratory/calibrations/mass-balances"
    referenceField={REFERENCE_FIELD}
    calibrationService={massBalanceCalibrationService}
    enrichWithCalibrations={enrichMassBalanceWithCalibrations}
    historyEmptyMessage="No calibration history found for this mass balance."
    metricColumns={[
      {
        header: "Uncertainty at 1000g (g)",
        getValue: (item) => formatUncertaintyAt1000g(item.latestUncertaintyAt1000g),
      },
    ]}
    historyColumns={[
      {
        header: "Calibration Company",
        getValue: (cal) => cal.calibrationCompany || "-",
      },
      {
        header: "Uncertainty at 1000g (g)",
        getValue: (cal) => formatUncertaintyAt1000g(cal.uncertaintyAt1000g),
      },
    ]}
  />
);

export default MassBalancesPage;
