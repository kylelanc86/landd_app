const ArchivedGraticuleCalibration = require('../models/ArchivedGraticuleCalibration');
const GraticuleCalibration = require('../models/GraticuleCalibration');

class CalibrationArchiveService {
  /**
   * Archive old graticule calibrations when a new one is created
   * @param {string} graticuleId - The graticule equipment reference
   * @param {string} newCalibrationDate - The date of the new calibration
   * @param {string} archivedBy - User ID who performed the new calibration
   */
  static async archiveOldGraticuleCalibrations(graticuleId, newCalibrationDate, archivedBy) {
    try {
      console.log('Archiving calibrations for graticule:', graticuleId, 'before date:', newCalibrationDate);
      
      // Find all existing calibrations for this graticule that are older than the new calibration
      const existingCalibrations = await GraticuleCalibration.find({
        graticuleId: graticuleId,
        date: { $lt: new Date(newCalibrationDate) }
      });
      
      console.log('Found existing calibrations to archive:', existingCalibrations.length);

      if (existingCalibrations.length === 0) {
        return { archived: 0, message: 'No old calibrations to archive' };
      }

      // Convert existing calibrations to archived format
      const archivedCalibrations = existingCalibrations.map(cal => ({
        calibrationId: cal.calibrationId, // Include calibrationId if it exists
        graticuleId: cal.graticuleId,
        date: cal.date,
        scale: cal.scale,
        status: cal.status,
        technician: cal.technician,
        microscopeId: cal.microscopeId,
        microscopeReference: cal.microscopeReference,
        notes: cal.notes,
        calibratedBy: cal.calibratedBy,
        reasonForArchiving: 'new_calibration'
      }));

      // Insert archived calibrations
      const archived = await ArchivedGraticuleCalibration.insertMany(archivedCalibrations);

      // Delete the old calibrations from the active collection
      await GraticuleCalibration.deleteMany({
        graticuleId: graticuleId,
        date: { $lt: new Date(newCalibrationDate) }
      });

      return { 
        archived: archived.length, 
        message: `Successfully archived ${archived.length} old calibration(s)` 
      };
    } catch (error) {
      console.error('Error archiving old calibrations:', error);
      throw new Error('Failed to archive old calibrations');
    }
  }

  /**
   * Get archived calibrations for a specific graticule equipment
   * @param {string} equipmentId - The equipment ID (now using graticuleId/equipment reference)
   * @param {Object} options - Query options (page, limit, etc.)
   */
  static async getArchivedGraticuleCalibrations(equipmentId, options = {}) {
    try {
      const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc' } = options;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const filter = { graticuleId: equipmentId };

      const total = await ArchivedGraticuleCalibration.countDocuments(filter);
      const pages = Math.ceil(total / parseInt(limit));

      const calibrations = await ArchivedGraticuleCalibration.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('calibratedBy', 'firstName lastName')
        .populate('microscopeId', 'equipmentReference brandModel');

      return {
        data: calibrations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      };
    } catch (error) {
      console.error('Error fetching archived calibrations:', error);
      throw new Error('Failed to fetch archived calibrations');
    }
  }

  /**
   * Get all archived calibrations across all equipment
   * @param {Object} options - Query options
   */
  static async getAllArchivedCalibrations(options = {}) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        sortBy = 'archivedAt', 
        sortOrder = 'desc',
        graticuleId = null,
        status = null,
        technician = null
      } = options;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const filter = {};
      if (graticuleId) filter.graticuleId = graticuleId;
      if (status) filter.status = status;
      if (technician) filter.technician = new RegExp(technician, 'i');

      const total = await ArchivedGraticuleCalibration.countDocuments(filter);
      const pages = Math.ceil(total / parseInt(limit));

      const calibrations = await ArchivedGraticuleCalibration.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('calibratedBy', 'firstName lastName')
        .populate('microscopeId', 'equipmentReference brandModel');

      // Note: equipmentType filtering removed since we no longer have graticuleEquipmentId

      return {
        data: calibrations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages
        }
      };
    } catch (error) {
      console.error('Error fetching all archived calibrations:', error);
      throw new Error('Failed to fetch archived calibrations');
    }
  }
}

module.exports = CalibrationArchiveService;
