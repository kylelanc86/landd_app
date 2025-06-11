import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const Sieves = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Sieves"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
      icon={process.env.PUBLIC_URL + "/air-mon-icons/fm.png"}
    />
  );
};

export default Sieves;
