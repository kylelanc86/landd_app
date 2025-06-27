import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const RiLiquid = () => {
  return (
    <BaseCalibrationWidget
      title="RI Liquid Calibration"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/RiLiquid.png"}
      viewCalibrationsPath="/calibrations/ri-liquid"
    />
  );
};

export default RiLiquid;
