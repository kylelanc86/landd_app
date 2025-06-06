import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const GraticuleCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Graticule Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default GraticuleCalibration;
