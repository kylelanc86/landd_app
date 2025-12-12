/**
 * Utility functions for managing cached top 100 projects for reports page
 */

const CACHE_KEY = "reportsTop100Projects";
const PROJECT_IDS_CACHE_KEY = "reportsTop100ProjectIDs";
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Get cached top 100 projects
 * @returns {Array|null} Array of project objects or null if cache is invalid/missing
 */
export const getCachedTopProjects = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { projects, timestamp } = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_DURATION && Array.isArray(projects)) {
        return projects;
      }
    }
  } catch (error) {
    console.error("Error reading cached projects:", error);
  }
  return null;
};

/**
 * Store top 100 projects in cache
 * @param {Array} projects - Array of project objects with projectID property
 */
export const cacheTopProjects = (projects) => {
  try {
    // Sort projects by projectID descending (highest first)
    const sorted = [...projects].sort((a, b) => {
      const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
      return bNum - aNum;
    });

    const top100 = sorted.slice(0, 100);
    // Store only essential fields to keep cache size manageable
    const cachedProjects = top100.map((p) => ({
      _id: p._id,
      projectID: p.projectID,
      name: p.name,
      client: p.client,
      status: p.status,
    }));

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        projects: cachedProjects,
        timestamp: Date.now(),
      })
    );

    // Also cache the projectIDs separately
    cacheTopProjectIDs(projects);
  } catch (error) {
    console.error("Error caching projects:", error);
  }
};

/**
 * Update cache when a new project is created
 * @param {Object} newProject - The newly created project object
 */
export const addProjectToCache = (newProject) => {
  try {
    const cached = getCachedTopProjects();
    if (cached && Array.isArray(cached)) {
      // Add new project to the beginning (it's the newest/highest)
      const projectData = {
        _id: newProject._id,
        projectID: newProject.projectID,
        name: newProject.name,
        client: newProject.client,
        status: newProject.status,
      };
      const updated = [projectData, ...cached].slice(0, 100);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          projects: updated,
          timestamp: Date.now(),
        })
      );
    } else {
      // Cache doesn't exist or is invalid, clear it so it gets rebuilt
      localStorage.removeItem(CACHE_KEY);
    }
  } catch (error) {
    console.error("Error updating cache with new project:", error);
  }
};

/**
 * Update cache when a project is deleted
 * @param {string} deletedProjectID - The projectID of the deleted project
 */
export const removeProjectFromCache = (deletedProjectID) => {
  try {
    const cached = getCachedTopProjects();
    if (cached && Array.isArray(cached)) {
      // Remove the deleted project from cache
      const updated = cached.filter((p) => p.projectID !== deletedProjectID);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          projects: updated,
          timestamp: Date.now(),
        })
      );
    }
  } catch (error) {
    console.error("Error removing project from cache:", error);
  }
};

/**
 * Get cached top 100 projectIDs (separate from full project cache)
 * @returns {string[]|null} Array of projectIDs or null if cache is invalid/missing
 */
export const getCachedTopProjectIDs = () => {
  try {
    const cached = localStorage.getItem(PROJECT_IDS_CACHE_KEY);
    if (cached) {
      const { projectIDs, timestamp } = JSON.parse(cached);
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_DURATION && Array.isArray(projectIDs)) {
        return projectIDs;
      }
    }
  } catch (error) {
    console.error("Error reading cached project IDs:", error);
  }
  return null;
};

/**
 * Store top 100 projectIDs separately (for quick access when project cache is empty)
 * @param {Array} projects - Array of project objects with projectID property
 */
export const cacheTopProjectIDs = (projects) => {
  try {
    // Sort projects by projectID descending (highest first)
    const sorted = [...projects].sort((a, b) => {
      const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
      return bNum - aNum;
    });

    const top100 = sorted.slice(0, 100);
    const projectIDs = top100.map((p) => p.projectID).filter(Boolean);

    localStorage.setItem(
      PROJECT_IDS_CACHE_KEY,
      JSON.stringify({
        projectIDs,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error("Error caching project IDs:", error);
  }
};

/**
 * Clear the cache (useful for testing or forced refresh)
 */
export const clearCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(PROJECT_IDS_CACHE_KEY);
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
};

