import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const FumeHoods = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Fume Hoods"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/efa"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/effective filter area.png"}
    />
  );
};

export default FumeHoods;
