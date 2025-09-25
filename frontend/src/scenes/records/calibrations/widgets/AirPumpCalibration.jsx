import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const AirPumpCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Air Monitors"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/air-pump"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/airpump.png"}
    />
  );
};

export default AirPumpCalibration;
