import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const PureAsbestos = () => {
  return (
    <BaseCalibrationWidget
      title="Pure Asbestos"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/PureAsbestos.png"}
      viewCalibrationsPath="/records/laboratory/calibrations/pure-asbestos"
    />
  );
};

export default PureAsbestos;
