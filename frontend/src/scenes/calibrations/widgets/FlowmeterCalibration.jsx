import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const FlowmeterCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Flowmeter Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default FlowmeterCalibration;
