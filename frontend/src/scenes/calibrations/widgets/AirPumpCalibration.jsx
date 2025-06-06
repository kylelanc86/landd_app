import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const AirPumpCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Air Pump Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default AirPumpCalibration;
