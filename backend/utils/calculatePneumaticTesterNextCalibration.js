const CalibrationFrequency = require('../models/CalibrationFrequency');

const PNEUMATIC_TESTER_EQUIPMENT_TYPE = 'Pneumatic tester';
const DEFAULT_FREQUENCY_MONTHS = 12;

const calculatePneumaticTesterNextCalibration = async (calibrationDate) => {
  let frequencyInMonths = DEFAULT_FREQUENCY_MONTHS;

  const calibrationFreqConfig = await CalibrationFrequency.findOne({
    equipmentType: PNEUMATIC_TESTER_EQUIPMENT_TYPE,
  });

  if (calibrationFreqConfig) {
    if (calibrationFreqConfig.frequencyUnit === 'years') {
      frequencyInMonths = calibrationFreqConfig.frequencyValue * 12;
    } else {
      frequencyInMonths = calibrationFreqConfig.frequencyValue;
    }
  }

  const nextDue = new Date(calibrationDate);
  nextDue.setMonth(nextDue.getMonth() + frequencyInMonths);
  return nextDue;
};

module.exports = {
  PNEUMATIC_TESTER_EQUIPMENT_TYPE,
  calculatePneumaticTesterNextCalibration,
};
