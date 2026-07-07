const CalibrationFrequency = require('../models/CalibrationFrequency');

const FURNACE_EQUIPMENT_TYPE = 'Furnace';
const DEFAULT_FREQUENCY_MONTHS = 12;

const calculateFurnaceNextCalibration = async (calibrationDate) => {
  let frequencyInMonths = DEFAULT_FREQUENCY_MONTHS;

  const calibrationFreqConfig = await CalibrationFrequency.findOne({
    equipmentType: FURNACE_EQUIPMENT_TYPE,
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
  FURNACE_EQUIPMENT_TYPE,
  calculateFurnaceNextCalibration,
};
