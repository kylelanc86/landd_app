import React from "react";
import ExternalCalibrationListPage from "./ExternalCalibrationListPage";
import fumeHoodCalibrationService from "../../../services/fumeHoodCalibrationService";
import {
  enrichFumeHoodWithCalibrations,
  formatPassFail,
  REFERENCE_FIELD,
} from "./fumeHoodCalibrationUtils";

const FumeHoodsPage = () => (
  <ExternalCalibrationListPage
    title="Fume Hood Calibrations"
    equipmentSectionTitle="Fume Hood Equipment"
    equipmentType="Fume Hood"
    emptyMessage="No fume hood equipment found"
    routeBase="/records/laboratory/calibrations/fume-hoods"
    referenceField={REFERENCE_FIELD}
    calibrationService={fumeHoodCalibrationService}
    enrichWithCalibrations={enrichFumeHoodWithCalibrations}
    historyEmptyMessage="No calibration history found for this fume hood."
    metricColumns={[
      {
        header: "Face Velocity",
        getValue: (item) => formatPassFail(item.latestFaceVelocity),
      },
      {
        header: "Air Changes",
        getValue: (item) => formatPassFail(item.latestAirChanges),
      },
    ]}
    historyColumns={[
      {
        header: "Calibration Company",
        getValue: (cal) => cal.calibrationCompany || "-",
      },
      {
        header: "Face Velocity",
        getValue: (cal) => formatPassFail(cal.faceVelocity),
      },
      {
        header: "Air Changes",
        getValue: (cal) => formatPassFail(cal.airChanges),
      },
    ]}
  />
);

export default FumeHoodsPage;
