import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const RiLiquid = () => {
  return (
    <BaseCalibrationWidget
      title="RI Liquids"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/RiLiquid.png"}
      viewCalibrationsPath="/records/laboratory/calibrations/ri-liquid"
    />
  );
};

export default RiLiquid;
