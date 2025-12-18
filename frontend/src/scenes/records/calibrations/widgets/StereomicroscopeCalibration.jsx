import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const StereomicroscopeCalibration = ({
  nextCalibrationDue,
  viewCalibrationsPath,
}) => {
  return (
    <BaseCalibrationWidget
      title="Stereomicroscopes"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/stereomicroscope"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/microscope.png"}
    />
  );
};

export default StereomicroscopeCalibration;
