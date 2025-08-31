const DashboardStats = require('../models/DashboardStats');
const Job = require('../models/Job');
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

  // Update stats when a job status changes
  async updateStatsOnJobStatusChange(oldStatus, newStatus) {
    try {
      const updates = [];
      
      // Update active projects count
      if (this.isActiveStatus(oldStatus) !== this.isActiveStatus(newStatus)) {
        const activeCount = await Job.countDocuments({ 
          status: { $in: ['In Progress', 'Samples Submitted', 'Report Ready for Review'] } 
        });
        updates.push(DashboardStats.updateStat('activeProjects', activeCount));
      }

      // Update review projects count
      if (oldStatus === 'Report Sent for Review' || newStatus === 'Report Sent for Review') {
        const reviewCount = await Job.countDocuments({ status: 'Report Sent for Review' });
        updates.push(DashboardStats.updateStat('reviewProjects', reviewCount));
      }

      // Update invoice projects count
      if (oldStatus === 'Ready for Invoicing' || newStatus === 'Ready for Invoicing') {
        const invoiceCount = await Job.countDocuments({ status: 'Ready for Invoicing' });
        updates.push(DashboardStats.updateStat('invoiceProjects', invoiceCount));
      }

      // Update lab complete projects count
      if (oldStatus === 'Lab Complete' || newStatus === 'Lab Complete') {
        const labCompleteCount = await Job.countDocuments({ status: 'Lab Complete' });
        updates.push(DashboardStats.updateStat('labCompleteProjects', labCompleteCount));
      }

      // Update samples submitted projects count
      if (oldStatus === 'Samples Submitted' || newStatus === 'Samples Submitted') {
        const samplesCount = await Job.countDocuments({ status: 'Samples Submitted' });
        updates.push(DashboardStats.updateStat('samplesSubmittedProjects', samplesCount));
      }

      // Update in progress projects count
      if (oldStatus === 'In Progress' || newStatus === 'In Progress') {
        const inProgressCount = await Job.countDocuments({ status: 'In Progress' });
        updates.push(DashboardStats.updateStat('inProgressProjects', inProgressCount));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`Updated ${updates.length} dashboard stats due to job status change`);
      }
    } catch (error) {
      console.error('Error updating dashboard stats on job status change:', error);
      // Don't throw error to avoid breaking the main job update flow
    }
  }

  // Update stats when a job is created
  async updateStatsOnJobCreate(jobStatus) {
    try {
      const updates = [];
      
      // Update active projects count
      if (this.isActiveStatus(jobStatus)) {
        const activeCount = await Job.countDocuments({ 
          status: { $in: ['In progress', 'Samples submitted', 'Report ready for review'] } 
        });
        updates.push(DashboardStats.updateStat('activeProjects', activeCount));
      }

      // Update specific status counts
      if (jobStatus === 'Report sent for review') {
        const reviewCount = await Job.countDocuments({ status: 'Report sent for review' });
        updates.push(DashboardStats.updateStat('reviewProjects', reviewCount));
      }

      if (jobStatus === 'Ready for invoicing') {
        const invoiceCount = await Job.countDocuments({ status: 'Ready for invoicing' });
        updates.push(DashboardStats.updateStat('invoiceProjects', invoiceCount));
      }

      if (jobStatus === 'Lab complete') {
        const labCompleteCount = await Job.countDocuments({ status: 'Lab complete' });
        updates.push(DashboardStats.updateStat('labCompleteProjects', labCompleteCount));
      }

      if (jobStatus === 'Samples submitted') {
        const samplesCount = await Job.countDocuments({ status: 'Samples submitted' });
        updates.push(DashboardStats.updateStat('samplesSubmittedProjects', samplesCount));
      }

      if (jobStatus === 'In progress') {
        const inProgressCount = await Job.countDocuments({ status: 'In progress' });
        updates.push(DashboardStats.updateStat('inProgressProjects', inProgressCount));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`Updated ${updates.length} dashboard stats due to job creation`);
      }
    } catch (error) {
      console.error('Error updating dashboard stats on job creation:', error);
      // Don't throw error to avoid breaking the main job creation flow
    }
  }

  // Update stats when a job is deleted
  async updateStatsOnJobDelete(jobStatus) {
    try {
      const updates = [];
      
      // Update active projects count
      if (this.isActiveStatus(jobStatus)) {
        const activeCount = await Job.countDocuments({ 
          status: { $in: ['In progress', 'Samples submitted', 'Report ready for review'] } 
        });
        updates.push(DashboardStats.updateStat('activeProjects', activeCount));
      }

      // Update specific status counts
      if (jobStatus === 'Report sent for review') {
        const reviewCount = await Job.countDocuments({ status: 'Report sent for review' });
        updates.push(DashboardStats.updateStat('reviewProjects', reviewCount));
      }

      if (jobStatus === 'Ready for invoicing') {
        const invoiceCount = await Job.countDocuments({ status: 'Ready for invoicing' });
        updates.push(DashboardStats.updateStat('invoiceProjects', invoiceCount));
      }

      if (jobStatus === 'Lab complete') {
        const labCompleteCount = await Job.countDocuments({ status: 'Lab complete' });
        updates.push(DashboardStats.updateStat('labCompleteProjects', labCompleteCount));
      }

      if (jobStatus === 'Samples submitted') {
        const samplesCount = await Job.countDocuments({ status: 'Samples submitted' });
        updates.push(DashboardStats.updateStat('samplesSubmittedProjects', samplesCount));
      }

      if (jobStatus === 'In progress') {
        const inProgressCount = await Job.countDocuments({ status: 'In progress' });
        updates.push(DashboardStats.updateStat('inProgressProjects', inProgressCount));
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`Updated ${updates.length} dashboard stats due to job deletion`);
      }
    } catch (error) {
      console.error('Error updating dashboard stats on job deletion:', error);
      // Don't throw error to avoid breaking the main job deletion flow
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

  // Helper method to determine if a status is considered "active"
  isActiveStatus(status) {
    return ['In Progress', 'Samples Submitted', 'Report Ready for Review'].includes(status);
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
