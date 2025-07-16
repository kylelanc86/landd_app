import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const AirPumpCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Air Pump Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/air-pump"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/airpump.png"}
    />
  );
};

export default AirPumpCalibration;
