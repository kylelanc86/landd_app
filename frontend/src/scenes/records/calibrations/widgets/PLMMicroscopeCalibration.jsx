import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PLMMicroscopeCalibration = ({
  nextCalibrationDue,
  viewCalibrationsPath,
}) => {
  return (
    <BaseCalibrationWidget
      title="PLM Microscopes"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/plm-microscope"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/microscope.png"}
    />
  );
};

export default PLMMicroscopeCalibration;
