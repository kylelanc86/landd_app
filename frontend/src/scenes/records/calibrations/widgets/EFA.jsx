import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const EFA = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  return (
    <BaseCalibrationWidget
      title="Effective Filter Area"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/efa"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/effective filter area.png"}
    />
  );
};

export default EFA;
