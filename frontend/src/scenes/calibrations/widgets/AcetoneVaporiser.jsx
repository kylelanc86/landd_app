import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const AcetoneVaporiser = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Acetone Vaporiser"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/acetone-vaporiser"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/vaporiser.png"}
    />
  );
};

export default AcetoneVaporiser;
