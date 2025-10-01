import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const Furnace = () => {
  return (
    <BaseCalibrationWidget
      title="Furnace"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/furnace.png"}
      viewCalibrationsPath="/records/laboratory/calibrations/furnace"
    />
  );
};

export default Furnace;
