import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PrimaryFlowmeter = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Primary Flowmeter"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/primary-flowmeter"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/primary flowmeter.png"}
    />
  );
};

export default PrimaryFlowmeter;
