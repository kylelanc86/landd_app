import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const EFA = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="EFA Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default EFA;
