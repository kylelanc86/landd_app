import React from "react";
import BaseCalibrationWidget from "./BaseCalibrationWidget";

const HSETestSlideCalibration = ({
  nextCalibrationDue,
  viewCalibrationsPath,
}) => {
  return (
    <BaseCalibrationWidget
      title="HSE Test Slides"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath="/records/laboratory/calibrations/hse-test-slide"
      icon={process.env.PUBLIC_URL + "/air-mon-icons/test-slide.png"}
    />
  );
};

export default HSETestSlideCalibration;

