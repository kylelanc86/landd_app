import React from "react";
import ExternalCalibrationListPage from "./ExternalCalibrationListPage";
import mycometerCalibrationService from "../../../services/mycometerCalibrationService";
import {
  enrichMycometerWithCalibrations,
  MYCOMETER_EQUIPMENT_TYPES,
  REFERENCE_FIELD,
} from "./mycometerCalibrationUtils";

const MycometersPage = () => (
  <ExternalCalibrationListPage
    title="Mycometer Calibrations/Servicing"
    equipmentSectionTitle="Mycometer Equipment"
    equipmentTypes={MYCOMETER_EQUIPMENT_TYPES}
    emptyMessage="No Mycometer Analyser or Rotameter equipment found"
    routeBase="/records/laboratory/calibrations/mycometers"
    referenceField={REFERENCE_FIELD}
    calibrationService={mycometerCalibrationService}
    enrichWithCalibrations={enrichMycometerWithCalibrations}
    historyEmptyMessage="No calibration/servicing history found for this Mycometer."
    metricColumns={[
      {
        header: "Equipment Type",
        getValue: (item) => item.equipmentType || "-",
      },
    ]}
    historyColumns={[
      {
        header: "Calibration/Servicing Company",
        getValue: (cal) => cal.calibrationCompany || "-",
      },
      {
        header: "Equipment Type",
        getValue: (cal) => cal.equipmentType || "-",
      },
    ]}
  />
);

export default MycometersPage;
