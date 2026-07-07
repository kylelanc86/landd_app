const CalibrationFrequency = require('../models/CalibrationFrequency');

const BUBBLE_FLOWMETER_EQUIPMENT_TYPE = 'Bubble flowmeter';
const DEFAULT_FREQUENCY_YEARS = 5;

const calculatePrimaryFlowmeterNextCalibration = async (calibrationDate) => {
  let frequencyInMonths = DEFAULT_FREQUENCY_YEARS * 12;

  const calibrationFreqConfig = await CalibrationFrequency.findOne({
    equipmentType: BUBBLE_FLOWMETER_EQUIPMENT_TYPE,
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
  BUBBLE_FLOWMETER_EQUIPMENT_TYPE,
  calculatePrimaryFlowmeterNextCalibration,
};
