import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const GraticuleCalibration = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Graticule Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/graticule"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/graticule.png"}
    />
  );
};

export default GraticuleCalibration;
