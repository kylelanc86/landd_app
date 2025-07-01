import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const Sieves = () => {
  return (
    <BaseCalibrationWidget
      title="Sieves Calibration"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/Sieves.png"}
      viewCalibrationsPath="/calibrations/sieves"
    />
  );
};

export default Sieves;
 