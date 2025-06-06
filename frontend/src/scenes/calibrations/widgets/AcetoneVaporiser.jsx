import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const AcetoneVaporiser = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Acetone Vaporiser Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
    />
  );
};

export default AcetoneVaporiser;
