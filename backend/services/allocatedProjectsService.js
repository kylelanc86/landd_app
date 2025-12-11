const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');

class AllocatedProjectsService {
  /**
   * Check if a status is considered "active"
   * @param {string} status - The project status to check
   * @returns {Promise<boolean>} - True if status is active
   */
  async isActiveStatus(status) {
    try {
      const group = await CustomDataFieldGroup.findOne({
        type: 'project_status',
        isActive: true
      });

      if (!group) {
        return false;
      }

      const statusField = group.fields.find(
        field => field.text === status && field.isActive
      );

      return statusField ? statusField.isActiveStatus === true : false;
    } catch (error) {
      console.error('Error checking if status is active:', error);
      return false;
    }
  }

  /**
   * Get all active statuses
   * @returns {Promise<string[]>} - Array of active status strings
   */
  async getActiveStatuses() {
    try {
      const group = await CustomDataFieldGroup.findOne({
        type: 'project_status',
        isActive: true
      });

      if (!group) {
        return [];
      }

      return group.fields
        .filter(field => field.isActive && field.isActiveStatus)
        .map(field => field.text);
    } catch (error) {
      console.error('Error getting active statuses:', error);
      return [];
    }
  }

  /**
   * Add project ID to users' allocatedProjectIds array
   * @param {string[]} userIds - Array of user IDs
   * @param {string} projectId - Project ID to add
   */
  async addProjectToUsers(userIds, projectId) {
    if (!userIds || userIds.length === 0 || !projectId) {
      return;
    }

    try {
      // Convert to ObjectIds if needed
      const projectObjectId = typeof projectId === 'string' 
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

      const userObjectIds = userIds.map(id => 
        typeof id === 'string' 
          ? new mongoose.Types.ObjectId(id)
          : id
      );

      // Use $addToSet to avoid duplicates
      const result = await User.updateMany(
        { _id: { $in: userObjectIds } },
        { $addToSet: { allocatedProjectIds: projectObjectId } }
      );

      console.log(`[ALLOCATED-PROJECTS] Added project ${projectId} to ${result.modifiedCount} users`);
    } catch (error) {
      console.error('Error adding project to users:', error);
    }
  }

  /**
   * Remove project ID from users' allocatedProjectIds array
   * @param {string[]} userIds - Array of user IDs (optional - if not provided, removes from all users)
   * @param {string} projectId - Project ID to remove
   */
  async removeProjectFromUsers(userIds, projectId) {
    if (!projectId) {
      return;
    }

    try {
      const projectObjectId = typeof projectId === 'string' 
        ? new mongoose.Types.ObjectId(projectId)
        : projectId;

      const query = userIds && userIds.length > 0
        ? { _id: { $in: userIds.map(id => typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id) } }
        : {}; // Remove from all users if no specific users provided

      const result = await User.updateMany(
        query,
        { $pull: { allocatedProjectIds: projectObjectId } }
      );

      console.log(`[ALLOCATED-PROJECTS] Removed project ${projectId} from ${result.modifiedCount} users`);
    } catch (error) {
      console.error('Error removing project from users:', error);
    }
  }

  /**
   * Update users' allocatedProjectIds when project users change
   * @param {string} projectId - Project ID
   * @param {string[]} oldUserIds - Previous user IDs
   * @param {string[]} newUserIds - New user IDs
   * @param {string} projectStatus - Current project status
   */
  async updateUsersOnProjectUserChange(projectId, oldUserIds, newUserIds, projectStatus) {
    try {
      const isActive = await this.isActiveStatus(projectStatus);
      
      // Convert to sets for easier comparison
      const oldSet = new Set((oldUserIds || []).map(id => id.toString()));
      const newSet = new Set((newUserIds || []).map(id => id.toString()));

      // Find users to add and remove
      const usersToAdd = (newUserIds || []).filter(id => !oldSet.has(id.toString()));
      const usersToRemove = (oldUserIds || []).filter(id => !newSet.has(id.toString()));

      // Only update if project is active
      if (isActive) {
        // Add project to newly assigned users
        if (usersToAdd.length > 0) {
          await this.addProjectToUsers(usersToAdd, projectId);
        }

        // Remove project from unassigned users
        if (usersToRemove.length > 0) {
          await this.removeProjectFromUsers(usersToRemove, projectId);
        }
      } else {
        // If project is inactive, remove from all users
        if (oldUserIds && oldUserIds.length > 0) {
          await this.removeProjectFromUsers(oldUserIds, projectId);
        }
      }
    } catch (error) {
      console.error('Error updating users on project user change:', error);
    }
  }

  /**
   * Update users' allocatedProjectIds when project status changes
   * @param {string} projectId - Project ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string[]} userIds - User IDs assigned to project
   */
  async updateUsersOnStatusChange(projectId, oldStatus, newStatus, userIds) {
    try {
      const oldIsActive = await this.isActiveStatus(oldStatus);
      const newIsActive = await this.isActiveStatus(newStatus);

      // If status didn't change active/inactive state, no update needed
      if (oldIsActive === newIsActive) {
        return;
      }

      if (newIsActive && !oldIsActive) {
        // Status changed from inactive to active - add project to users
        if (userIds && userIds.length > 0) {
          await this.addProjectToUsers(userIds, projectId);
          console.log(`[ALLOCATED-PROJECTS] Project ${projectId} became active, added to ${userIds.length} users`);
        }
      } else if (!newIsActive && oldIsActive) {
        // Status changed from active to inactive - remove project from users
        if (userIds && userIds.length > 0) {
          await this.removeProjectFromUsers(userIds, projectId);
          console.log(`[ALLOCATED-PROJECTS] Project ${projectId} became inactive, removed from ${userIds.length} users`);
        }
      }
    } catch (error) {
      console.error('Error updating users on status change:', error);
    }
  }

  /**
   * Rebuild allocatedProjectIds for a user based on current active projects
   * @param {string} userId - User ID to rebuild cache for
   */
  async rebuildUserCache(userId) {
    try {
      const activeStatuses = await this.getActiveStatuses();
      
      if (activeStatuses.length === 0) {
        console.log(`[ALLOCATED-PROJECTS] No active statuses found, clearing cache for user ${userId}`);
        await User.findByIdAndUpdate(userId, { allocatedProjectIds: [] });
        return;
      }

      // Find all active projects assigned to this user
      const projects = await Project.find({
        users: userId,
        status: { $in: activeStatuses }
      }).select('_id');

      const projectIds = projects.map(p => p._id);

      // Update user's allocatedProjectIds
      await User.findByIdAndUpdate(userId, { allocatedProjectIds: projectIds });

      console.log(`[ALLOCATED-PROJECTS] Rebuilt cache for user ${userId}: ${projectIds.length} projects`);
    } catch (error) {
      console.error('Error rebuilding user cache:', error);
    }
  }

  /**
   * Rebuild allocatedProjectIds for all users
   * Uses aggregation for efficiency - processes all users in a single query
   */
  async rebuildAllUsersCache() {
    try {
      const activeStatuses = await this.getActiveStatuses();

      if (activeStatuses.length === 0) {
        console.log('[ALLOCATED-PROJECTS] No active statuses found, clearing all user caches');
        await User.updateMany({}, { allocatedProjectIds: [] });
        return;
      }

      console.log('[ALLOCATED-PROJECTS] Starting cache rebuild for all users...');
      const startTime = Date.now();

      // OPTIMIZATION: Use aggregation to build cache for all users in one query
      // This groups projects by user and finds all active projects assigned to each user
      const userProjectMap = await Project.aggregate([
        // Match only active projects
        { $match: { status: { $in: activeStatuses } } },
        // Unwind users array to get one document per user-project pair
        { $unwind: '$users' },
        // Add a field to check if users is a valid ObjectId
        {
          $addFields: {
            isValidUserId: {
              $cond: [
                { $eq: [{ $type: '$users' }, 'objectId'] },
                true,
                false
              ]
            }
          }
        },
        // Filter out invalid user IDs (non-ObjectId values like names)
        {
          $match: {
            isValidUserId: true
          }
        },
        // Group by user and collect all project IDs
        {
          $group: {
            _id: '$users',
            projectIds: { $push: '$_id' }
          }
        }
      ]);

      console.log(`[ALLOCATED-PROJECTS] Found ${userProjectMap.length} user-project mappings from aggregation`);

      // Validate user IDs and filter out any invalid ones (extra safety check)
      const validUserProjectMap = [];
      const invalidEntries = [];

      userProjectMap.forEach(item => {
        // Check if _id is a valid ObjectId
        const isValid = mongoose.Types.ObjectId.isValid(item._id);
        if (isValid) {
          // Also verify it's not a string that just happens to match ObjectId format
          const isActuallyObjectId = item._id instanceof mongoose.Types.ObjectId || 
                                     (typeof item._id === 'string' && item._id.length === 24 && /^[0-9a-fA-F]{24}$/.test(item._id));
          if (isActuallyObjectId) {
            validUserProjectMap.push(item);
          } else {
            invalidEntries.push(item._id);
          }
        } else {
          invalidEntries.push(item._id);
        }
      });

      if (invalidEntries.length > 0) {
        console.warn(`[ALLOCATED-PROJECTS] ⚠️  Found ${invalidEntries.length} invalid user IDs in projects:`);
        console.warn(`  These appear to be user names instead of ObjectIds: ${invalidEntries.slice(0, 5).join(', ')}${invalidEntries.length > 5 ? '...' : ''}`);
        console.warn(`  Projects with invalid user data should be fixed to use proper ObjectIds`);
      }

      console.log(`[ALLOCATED-PROJECTS] Valid user IDs: ${validUserProjectMap.length}`);

      // Clear all user caches first
      await User.updateMany({}, { allocatedProjectIds: [] });

      // Update each user's cache in batches
      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < validUserProjectMap.length; i += batchSize) {
        const batch = validUserProjectMap.slice(i, i + batchSize);
        const updatePromises = batch.map(async item => {
          try {
            // Ensure _id is an ObjectId
            const userId = item._id instanceof mongoose.Types.ObjectId 
              ? item._id 
              : new mongoose.Types.ObjectId(item._id);
            
            await User.findByIdAndUpdate(userId, { allocatedProjectIds: item.projectIds });
            return { success: true };
          } catch (error) {
            console.error(`[ALLOCATED-PROJECTS] Error updating cache for user ${item._id}:`, error.message);
            return { success: false, error };
          }
        });
        
        const results = await Promise.all(updatePromises);
        successCount += results.filter(r => r.success).length;
        errorCount += results.filter(r => !r.success).length;
      }

      const duration = Date.now() - startTime;
      console.log(`[ALLOCATED-PROJECTS] Completed rebuilding cache:`);
      console.log(`  - Successful: ${successCount} users`);
      console.log(`  - Errors: ${errorCount} users`);
      console.log(`  - Duration: ${duration}ms`);
    } catch (error) {
      console.error('Error rebuilding all users cache:', error);
      throw error;
    }
  }
}

module.exports = new AllocatedProjectsService();
