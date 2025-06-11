import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const RiLiquids = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Refractive Index Liquids"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/air-pump"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/airpump.png"}
    />
  );
};

export default RiLiquids;
