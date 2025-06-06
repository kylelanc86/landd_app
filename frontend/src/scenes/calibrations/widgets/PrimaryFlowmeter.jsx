import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PrimaryFlowmeter = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Primary Flowmeter Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default PrimaryFlowmeter;
