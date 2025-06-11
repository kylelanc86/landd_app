import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const IDMicroscopeCalibration = ({
  nextCalibrationDue,
  viewCalibrationsPath,
}) => {
  return (
    <BaseCalibrationWidget
      title="Microscope Calibration"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/calibrations/microscope"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/microscope.png"}
    />
  );
};

export default IDMicroscopeCalibration;
