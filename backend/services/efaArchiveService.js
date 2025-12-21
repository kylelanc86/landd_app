const EFACalibration = require('../models/EFACalibration');

class EFAArchiveService {
  /**
   * Archive old EFA calibrations when a new calibration is created for the same filter holder model
   * @param {string} filterHolderModel - The filter holder model
   * @param {Date} newCalibrationDate - The date of the new calibration
   * @param {string} archivedBy - User ID who is creating the new calibration
   * @returns {Object} Archive result
   */
  static async archiveOldEFACalibrations(filterHolderModel, newCalibrationDate, archivedBy) {
    try {
      console.log(`Archiving old EFA calibrations for ${filterHolderModel} before ${newCalibrationDate}`);
      
      // Find all existing calibrations for this filter holder model that are older than the new calibration
      const existingCalibrations = await EFACalibration.find({
        filterHolderModel: filterHolderModel,
        date: { $lt: newCalibrationDate }
      });

      if (existingCalibrations.length === 0) {
        console.log(`No existing calibrations found for Filter Holder Model ${filterHolderModel} to archive`);
        return { archived: 0, message: 'No existing calibrations to archive' };
      }

      console.log(`Found ${existingCalibrations.length} existing calibrations to archive`);

      // Mark existing calibrations as archived by adding archivedAt timestamp
      const archiveResult = await EFACalibration.updateMany(
        {
          filterHolderModel: filterHolderModel,
          date: { $lt: newCalibrationDate }
        },
        {
          $set: {
            archivedAt: new Date(),
            archivedBy: archivedBy
          }
        }
      );

      console.log(`Successfully archived ${archiveResult.modifiedCount} EFA calibrations`);
      
      return {
        archived: archiveResult.modifiedCount,
        message: `Archived ${archiveResult.modifiedCount} old calibrations`
      };

    } catch (error) {
      console.error('Error archiving old EFA calibrations:', error);
      throw new Error(`Failed to archive old calibrations: ${error.message}`);
    }
  }

  /**
   * Get archived EFA calibrations with optional filtering
   * @param {Object} filters - Optional filters for archived calibrations
   * @returns {Array} Array of archived calibrations
   */
  static async getArchivedEFACalibrations(filters = {}) {
    try {
      const query = {
        archivedAt: { $exists: true },
        ...filters
      };

      const archivedCalibrations = await EFACalibration.find(query)
        .populate('calibratedBy', 'firstName lastName')
        .populate('archivedBy', 'firstName lastName')
        .sort({ archivedAt: -1, date: -1 });

      return archivedCalibrations;
    } catch (error) {
      console.error('Error fetching archived EFA calibrations:', error);
      throw new Error(`Failed to fetch archived calibrations: ${error.message}`);
    }
  }

  /**
   * Get archived EFA calibrations for a specific filter holder model
   * @param {string} filterHolderModel - The filter holder model
   * @param {Object} options - Optional query options
   * @returns {Array} Array of archived calibrations for the filter holder model
   */
  static async getArchivedByEquipment(filterHolderModel, options = {}) {
    try {
      const filters = {
        filterHolderModel: filterHolderModel,
        archivedAt: { $exists: true }
      };

      return await this.getArchivedEFACalibrations(filters);
    } catch (error) {
      console.error('Error fetching archived EFA calibrations by filter holder model:', error);
      throw new Error(`Failed to fetch archived calibrations for filter holder model: ${error.message}`);
    }
  }

  /**
   * Restore an archived calibration (remove archived status)
   * @param {string} calibrationId - The calibration ID to restore
   * @param {string} restoredBy - User ID who is restoring the calibration
   * @returns {Object} Restore result
   */
  static async restoreArchivedCalibration(calibrationId, restoredBy) {
    try {
      const result = await EFACalibration.findByIdAndUpdate(
        calibrationId,
        {
          $unset: {
            archivedAt: 1,
            archivedBy: 1
          },
          $set: {
            restoredAt: new Date(),
            restoredBy: restoredBy
          }
        },
        { new: true }
      );

      if (!result) {
        throw new Error('Calibration not found');
      }

      console.log(`Successfully restored EFA calibration ${calibrationId}`);
      return { success: true, message: 'Calibration restored successfully' };
    } catch (error) {
      console.error('Error restoring archived EFA calibration:', error);
      throw new Error(`Failed to restore calibration: ${error.message}`);
    }
  }

  /**
   * Permanently delete archived calibrations older than specified days
   * @param {number} daysOld - Delete archives older than this many days
   * @param {string} deletedBy - User ID who is performing the deletion
   * @returns {Object} Deletion result
   */
  static async permanentlyDeleteOldArchives(daysOld, deletedBy) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await EFACalibration.deleteMany({
        archivedAt: { $exists: true, $lt: cutoffDate }
      });

      console.log(`Permanently deleted ${result.deletedCount} old archived EFA calibrations`);
      
      return {
        deleted: result.deletedCount,
        message: `Permanently deleted ${result.deletedCount} old archived calibrations`
      };
    } catch (error) {
      console.error('Error permanently deleting old archived EFA calibrations:', error);
      throw new Error(`Failed to permanently delete old archives: ${error.message}`);
    }
  }

  /**
   * Get archive statistics
   * @returns {Object} Archive statistics
   */
  static async getArchiveStats() {
    try {
      const totalArchived = await EFACalibration.countDocuments({
        archivedAt: { $exists: true }
      });

      const totalActive = await EFACalibration.countDocuments({
        archivedAt: { $exists: false }
      });

      const oldestArchive = await EFACalibration.findOne(
        { archivedAt: { $exists: true } },
        { archivedAt: 1 }
      ).sort({ archivedAt: 1 });

      const newestArchive = await EFACalibration.findOne(
        { archivedAt: { $exists: true } },
        { archivedAt: 1 }
      ).sort({ archivedAt: -1 });

      return {
        totalArchived,
        totalActive,
        oldestArchive: oldestArchive?.archivedAt || null,
        newestArchive: newestArchive?.archivedAt || null
      };
    } catch (error) {
      console.error('Error fetching EFA archive statistics:', error);
      throw new Error(`Failed to fetch archive statistics: ${error.message}`);
    }
  }
}

module.exports = EFAArchiveService;
