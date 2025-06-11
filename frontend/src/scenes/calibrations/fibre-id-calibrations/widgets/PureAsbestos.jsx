import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PureAsbestos = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Pure Asbestos Samples"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/graticule"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/graticule.png"}
    />
  );
};

export default PureAsbestos;
