import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const MicroscopeCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Microscope Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default MicroscopeCalibration;
