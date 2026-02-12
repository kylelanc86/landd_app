const DashboardStats = require('../models/DashboardStats');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project'); // Added missing import

class DashboardStatsService {
  // Get all dashboard stats (fast - from cache table)
  async getDashboardStats() {
    try {
      const stats = await DashboardStats.getAllStats();
      
      // Ensure all expected stats exist, if not refresh them
      const expectedStats = [
        'activeProjects', 'reviewProjects', 'invoiceProjects', 
        'outstandingInvoices', 'labCompleteProjects', 
        'samplesSubmittedProjects', 'inProgressProjects'
      ];
      
      const missingStats = expectedStats.filter(stat => stats[stat] === undefined);
      
      if (missingStats.length > 0) {
        console.log('Missing dashboard stats, refreshing...');
        return await this.refreshAllStats();
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  // Refresh all stats (slow - but comprehensive)
  async refreshAllStats() {
    try {
      return await DashboardStats.refreshAllStats();
    } catch (error) {
      console.error('Error refreshing dashboard stats:', error);
      throw error;
    }
  }

  // Update outstanding invoices count
  async updateOutstandingInvoicesCount() {
    try {
      const outstandingCount = await Invoice.countDocuments({ status: 'unpaid' });
      await DashboardStats.updateStat('outstandingInvoices', outstandingCount);
      console.log('Updated outstanding invoices count');
    } catch (error) {
      console.error('Error updating outstanding invoices count:', error);
    }
  }

  // Helper method to update status counts
  async updateStatusCounts() {
    try {
      // Get all unique statuses that actually exist in the database
      const allProjects = await Project.find({}).select('status');
      const uniqueStatuses = [...new Set(allProjects.map(p => p.status))];
      
      // Get counts for each status that actually exists
      const statusCounts = {};
      for (const status of uniqueStatuses) {
        statusCounts[status] = await Project.countDocuments({ status });
      }
      
      // Store the status counts as a JSON string
      return DashboardStats.updateStat('statusCounts', JSON.stringify(statusCounts));
    } catch (error) {
      console.error('Error updating status counts:', error);
      throw error;
    }
  }

  // Initialize dashboard stats (run once on startup)
  async initializeStats() {
    try {
      console.log('Initializing dashboard stats...');
      await this.refreshAllStats();
      console.log('Dashboard stats initialized successfully');
    } catch (error) {
      console.error('Error initializing dashboard stats:', error);
      throw error;
    }
  }
}

module.exports = new DashboardStatsService();
