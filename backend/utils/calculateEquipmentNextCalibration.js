const CalibrationFrequency = require('../models/CalibrationFrequency');

const calculateEquipmentNextCalibration = async (
  calibrationDate,
  equipmentType,
  defaultFrequencyMonths = 12
) => {
  let frequencyInMonths = defaultFrequencyMonths;

  const calibrationFreqConfig = await CalibrationFrequency.findOne({
    equipmentType,
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

module.exports = { calculateEquipmentNextCalibration };
