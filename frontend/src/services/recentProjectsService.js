const RECENT_PROJECTS_KEY = 'recentProjects';
const MAX_RECENT_PROJECTS = 12;

class RecentProjectsService {
  /**
   * Get recent projects for the current user
   * @returns {Array} Array of recent project objects
   */
  getRecentProjects() {
    try {
      const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error retrieving recent projects:', error);
      return [];
    }
  }

  /**
   * Add a project to recent projects
   * @param {Object} project - Project object to add
   */
  addRecentProject(project) {
    try {
      const recentProjects = this.getRecentProjects();
      
      // Remove if already exists (to move to top)
      const filteredProjects = recentProjects.filter(p => p._id !== project._id);
      
      // Add to beginning of array
      const updatedProjects = [
        {
          _id: project._id,
          projectID: project.projectID,
          name: project.name,
          client: project.client,
          lastAccessed: new Date().toISOString()
        },
        ...filteredProjects
      ];
      
      // Keep only the most recent MAX_RECENT_PROJECTS
      const limitedProjects = updatedProjects.slice(0, MAX_RECENT_PROJECTS);
      
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(limitedProjects));
    } catch (error) {
      console.error('Error adding recent project:', error);
    }
  }

  /**
   * Remove a project from recent projects
   * @param {string} projectId - ID of project to remove
   */
  removeRecentProject(projectId) {
    try {
      const recentProjects = this.getRecentProjects();
      const filteredProjects = recentProjects.filter(p => p._id !== projectId);
      localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(filteredProjects));
    } catch (error) {
      console.error('Error removing recent project:', error);
    }
  }

  /**
   * Clear all recent projects
   */
  clearRecentProjects() {
    try {
      localStorage.removeItem(RECENT_PROJECTS_KEY);
    } catch (error) {
      console.error('Error clearing recent projects:', error);
    }
  }

  /**
   * Get recent projects with additional data from API
   * @param {Function} projectService - Service to fetch project details
   * @returns {Promise<Array>} Array of recent projects with full data
   */
  async getRecentProjectsWithData(projectService) {
    try {
      const recentProjects = this.getRecentProjects();
      const projectsWithData = [];

      for (const recentProject of recentProjects) {
        try {
          const projectData = await projectService.getById(recentProject._id);
          if (projectData.data) {
            projectsWithData.push({
              ...recentProject,
              ...projectData.data,
              lastAccessed: new Date(recentProject.lastAccessed)
            });
          }
        } catch (error) {
          console.log(`Project ${recentProject._id} no longer exists, removing from recent`);
          this.removeRecentProject(recentProject._id);
        }
      }

      return projectsWithData;
    } catch (error) {
      console.error('Error fetching recent projects with data:', error);
      return [];
    }
  }
}

export default new RecentProjectsService(); 