import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const FlowmeterCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Flowmeter Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
      icon={process.env.PUBLIC_URL + "/air-mon-icons/fm.png"}
    />
  );
};

export default FlowmeterCalibration;
