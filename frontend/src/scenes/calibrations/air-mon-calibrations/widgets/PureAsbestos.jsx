import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PureAsbestos = () => {
  return (
    <BaseCalibrationWidget
      title="Pure Asbestos Calibration"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/PureAsbestos.png"}
      viewCalibrationsPath="/calibrations/pure-asbestos"
    />
  );
};

export default PureAsbestos;
