const mongoose = require('mongoose');

const dashboardStatsSchema = new mongoose.Schema({
  statName: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'totalProjects',
      'activeProjects',
      'inactiveProjects',
      'outstandingInvoices',
      'statusCounts'
    ]
  },
  statValue: {
    type: mongoose.Schema.Types.Mixed, // Allow both numbers and strings/objects
    required: true,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for fast lookups
dashboardStatsSchema.index({ statName: 1 });

// Method to update a stat
dashboardStatsSchema.statics.updateStat = async function(statName, newValue) {
  try {
    const result = await this.findOneAndUpdate(
      { statName },
      { 
        statValue: newValue,
        lastUpdated: new Date()
      },
      { 
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
    return result;
  } catch (error) {
    console.error(`Error updating dashboard stat ${statName}:`, error);
    throw error;
  }
};

// Method to get all stats
dashboardStatsSchema.statics.getAllStats = async function() {
  try {
    const stats = await this.find({});
    const statsObject = {};
    stats.forEach(stat => {
      statsObject[stat.statName] = stat.statValue;
    });
    return statsObject;
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
};

  // Method to refresh all stats (for initial setup or manual refresh)
  dashboardStatsSchema.statics.refreshAllStats = async function() {
    try {
      // Import models here to avoid circular dependency issues
      const Project = require('./Project');
      const Invoice = require('./Invoice');
      const CustomDataField = require('./CustomDataField');
      
      // Get all unique statuses that actually exist in the database
      const allProjects = await Project.find({}).select('status');
      const uniqueStatuses = [...new Set(allProjects.map(p => p.status))];
      
      // Get counts for each status that actually exists
      const statusCounts = {};
      for (const status of uniqueStatuses) {
        statusCounts[status] = await Project.countDocuments({ status });
      }
      
      // Get project status definitions from custom data fields
      const projectStatusFields = await CustomDataField.find({ 
        type: 'project_status', 
        isActive: true 
      });
      
      // Define which statuses are active/inactive based on custom data fields
      const activeStatuses = projectStatusFields
        .filter(field => field.isActiveStatus === true)
        .map(field => field.text);
      
      const inactiveStatuses = projectStatusFields
        .filter(field => field.isActiveStatus === false)
        .map(field => field.text);
      
      // Calculate active and inactive project counts
      const activeProjects = await Project.countDocuments({ 
        status: { $in: activeStatuses } 
      });
      
      const inactiveProjects = await Project.countDocuments({ 
        status: { $in: inactiveStatuses } 
      });
      
      // Get outstanding invoices count
      const outstandingInvoices = await Invoice.countDocuments({ status: 'unpaid' });
      
      // Calculate totals
      const totalProjects = allProjects.length;
      
      // Store the dynamic status counts
      const updatePromises = [
        this.updateStat('totalProjects', totalProjects),
        this.updateStat('activeProjects', activeProjects),
        this.updateStat('inactiveProjects', inactiveProjects),
        this.updateStat('outstandingInvoices', outstandingInvoices),
        // Store the status counts as a JSON string
        this.updateStat('statusCounts', JSON.stringify(statusCounts))
      ];

      await Promise.all(updatePromises);
      
      return {
        totalProjects,
        activeProjects,
        inactiveProjects,
        outstandingInvoices,
        statusCounts
      };
    } catch (error) {
      console.error('Error refreshing dashboard stats:', error);
      throw error;
    }
  };

module.exports = mongoose.model('DashboardStats', dashboardStatsSchema);
