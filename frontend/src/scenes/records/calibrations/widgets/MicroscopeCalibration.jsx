import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const MicroscopeCalibration = ({
  nextCalibrationDue,
  viewCalibrationsPath,
}) => {
  return (
    <BaseCalibrationWidget
      title="Microscope Servicing"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/microscope"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/microscope.png"}
    />
  );
};

export default MicroscopeCalibration;
