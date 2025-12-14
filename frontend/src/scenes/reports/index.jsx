import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardActionArea,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Folder as FolderIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";

import {
  projectService,
  jobService,
  clientSuppliedJobsService,
} from "../../services/api";
import {
  getCachedTopProjects,
  cacheTopProjects,
  getCachedTopProjectIDs,
} from "../../utils/reportsCache";

// Debounce hook for search optimization
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const Reports = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [allProjects, setAllProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [noReportsDialog, setNoReportsDialog] = useState({
    open: false,
    project: null,
  });

  const itemsPerPage = 100; // 10x10 grid

  // Debounce search term to reduce filtering operations
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Helper function to sort projects by projectID descending
  const sortProjectsByID = useCallback((projects) => {
    return [...projects].sort((a, b) => {
      const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
      return bNum - aNum; // Descending order
    });
  }, []);

  // Fetch project IDs that have reports or active jobs
  const fetchProjectsWithReportsOrActiveJobs = useCallback(async () => {
    const projectIdsSet = new Set();

    try {
      // Fetch all project IDs in parallel for efficiency
      const promises = [];

      // 1. Active air monitoring jobs (status "in_progress")
      promises.push(
        jobService
          .getAll({ status: "in_progress", minimal: true })
          .then((response) => {
            const jobs = Array.isArray(response)
              ? response
              : response.data || [];
            jobs.forEach((job) => {
              const projectId =
                job.projectId?._id?.toString() || job.projectId?.toString();
              if (projectId) {
                projectIdsSet.add(projectId);
              }
            });
          })
          .catch((err) => {
            console.error("Error fetching active air monitoring jobs:", err);
          })
      );

      // 2. Active asbestos removal jobs (status "in_progress")
      promises.push(
        import("../../services/asbestosRemovalJobService")
          .then((module) => module.default)
          .then((asbestosRemovalJobService) =>
            asbestosRemovalJobService.getAll({
              status: "in_progress",
              minimal: true,
            })
          )
          .then((response) => {
            const jobs =
              response.jobs ||
              response.data ||
              (Array.isArray(response) ? response : []);
            jobs.forEach((job) => {
              const projectId =
                job.projectId?._id?.toString() || job.projectId?.toString();
              if (projectId) {
                projectIdsSet.add(projectId);
              }
            });
          })
          .catch((err) => {
            console.error("Error fetching active asbestos removal jobs:", err);
          })
      );

      // 3. Active client supplied jobs (status "In Progress" or "Analysis Complete")
      promises.push(
        clientSuppliedJobsService
          .getAll()
          .then((response) => {
            const jobs =
              response.data || (Array.isArray(response) ? response : []);
            jobs
              .filter(
                (job) =>
                  job.status === "In Progress" ||
                  job.status === "Analysis Complete"
              )
              .forEach((job) => {
                const projectId =
                  job.projectId?._id?.toString() || job.projectId?.toString();
                if (projectId) {
                  projectIdsSet.add(projectId);
                }
              });
          })
          .catch((err) => {
            console.error("Error fetching active client supplied jobs:", err);
          })
      );

      // 4. Completed air monitoring jobs (likely have reports)
      promises.push(
        jobService
          .getAll({ status: "completed", minimal: true })
          .then((response) => {
            const jobs = Array.isArray(response)
              ? response
              : response.data || [];
            jobs.forEach((job) => {
              const projectId =
                job.projectId?._id?.toString() || job.projectId?.toString();
              if (projectId) {
                projectIdsSet.add(projectId);
              }
            });
          })
          .catch((err) => {
            console.error("Error fetching completed air monitoring jobs:", err);
          })
      );

      // 5. Completed asbestos removal jobs (may have clearance reports)
      promises.push(
        import("../../services/asbestosRemovalJobService")
          .then((module) => module.default)
          .then((asbestosRemovalJobService) =>
            asbestosRemovalJobService.getAll({
              status: "completed",
              minimal: true,
            })
          )
          .then((response) => {
            const jobs =
              response.jobs ||
              response.data ||
              (Array.isArray(response) ? response : []);
            jobs.forEach((job) => {
              const projectId =
                job.projectId?._id?.toString() || job.projectId?.toString();
              if (projectId) {
                projectIdsSet.add(projectId);
              }
            });
          })
          .catch((err) => {
            console.error(
              "Error fetching completed asbestos removal jobs:",
              err
            );
          })
      );

      // 6. Projects with fibre ID reports (completed client supplied jobs)
      promises.push(
        clientSuppliedJobsService
          .getAll()
          .then((response) => {
            const jobs =
              response.data || (Array.isArray(response) ? response : []);
            jobs
              .filter((job) => job.status === "Completed")
              .forEach((job) => {
                const projectId =
                  job.projectId?._id?.toString() || job.projectId?.toString();
                if (projectId) {
                  projectIdsSet.add(projectId);
                }
              });
          })
          .catch((err) => {
            console.error(
              "Error fetching completed client supplied jobs:",
              err
            );
          })
      );

      // 7. Projects with asbestos assessments
      promises.push(
        import("../../services/api")
          .then((module) => module.asbestosAssessmentService)
          .then((assessmentService) =>
            assessmentService.getAsbestosAssessments()
          )
          .then((response) => {
            const assessments =
              response.data || (Array.isArray(response) ? response : []);
            assessments.forEach((assessment) => {
              const projectId =
                assessment.projectId?._id?.toString() ||
                assessment.projectId?.toString();
              if (projectId) {
                projectIdsSet.add(projectId);
              }
            });
          })
          .catch((err) => {
            console.error("Error fetching asbestos assessments:", err);
          })
      );

      // 8. Projects with clearance reports (completed clearances)
      promises.push(
        import("../../services/asbestosClearanceService")
          .then((module) => module.default)
          .then((clearanceService) => clearanceService.getAll())
          .then((response) => {
            const clearances =
              response.data || (Array.isArray(response) ? response : []);
            clearances
              .filter(
                (clearance) =>
                  clearance.status === "complete" ||
                  clearance.status === "Site Work Complete"
              )
              .forEach((clearance) => {
                const projectId =
                  clearance.projectId?._id?.toString() ||
                  clearance.projectId?.toString();
                if (projectId) {
                  projectIdsSet.add(projectId);
                }
              });
          })
          .catch((err) => {
            console.error("Error fetching clearance reports:", err);
          })
      );

      // Wait for all promises to complete
      await Promise.all(promises);
    } catch (error) {
      console.error(
        "Error fetching projects with reports or active jobs:",
        error
      );
    }

    return projectIdsSet;
  }, []);

  // Load initial 100 projects (highest projectIDs) - fast load using cache
  const loadInitialProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch project IDs with reports or active jobs in parallel
      const validProjectIdsSet = await fetchProjectsWithReportsOrActiveJobs();

      // Helper function to filter projects
      const filterProjects = (projects) => {
        return projects.filter((project) => {
          const projectId = project._id?.toString();
          return projectId && validProjectIdsSet.has(projectId);
        });
      };

      // Try to get cached top 100 projects - display immediately without API call
      const cachedProjects = getCachedTopProjects();
      let loadedFromCache = false;

      if (cachedProjects && cachedProjects.length > 0) {
        // Filter cached projects
        const filteredCached = filterProjects(cachedProjects);

        // Fast path: Display filtered cached projects immediately (no API call!)
        setAllProjects(filteredCached);
        setFilteredProjects(filteredCached);
        setTotalPages(Math.ceil(filteredCached.length / itemsPerPage));
        setLoading(false);
        loadedFromCache = true;

        // Now load all projects in the background to refresh cache
        // Start immediately - the UI is already showing cached data
        (async () => {
          try {
            const params = {
              page: 1,
              limit: 10000,
              sortBy: "createdAt",
              sortOrder: "desc",
              status: "all",
            };

            const response = await projectService.getAll(params);
            const allProjectsData = Array.isArray(response.data)
              ? response.data
              : response.data?.data || [];

            // Sort by projectID descending
            const sortedAllProjects = sortProjectsByID(allProjectsData);

            // Filter projects
            const filteredProjects = filterProjects(sortedAllProjects);

            // Update cache with fresh data (unfiltered, so cache stays complete)
            cacheTopProjects(sortedAllProjects);

            // Update state with filtered projects
            setAllProjects(filteredProjects);
            setFilteredProjects(filteredProjects);
            setTotalPages(Math.ceil(filteredProjects.length / itemsPerPage));
          } catch (err) {
            console.error("Error loading all projects in background:", err);
          }
        })();
      }

      // If no cache, check if we have cached projectIDs to fetch just those
      if (!loadedFromCache) {
        const cachedProjectIDs = getCachedTopProjectIDs();

        if (cachedProjectIDs && cachedProjectIDs.length > 0) {
          // Fast path: Load all projects but filter to cached IDs for immediate display
          // This is still faster than sorting all projects client-side
          try {
            const params = {
              page: 1,
              limit: 10000,
              sortBy: "createdAt",
              sortOrder: "desc",
              status: "all",
            };

            const response = await projectService.getAll(params);
            const allProjectsData = Array.isArray(response.data)
              ? response.data
              : response.data?.data || [];

            // Sort all projects
            const sortedAllProjects = sortProjectsByID(allProjectsData);

            // Filter to projects with reports or active jobs
            const filteredAllProjects = filterProjects(sortedAllProjects);

            // Filter to cached projectIDs and sort by cached order (from filtered set)
            const cachedProjectsMap = new Map(
              cachedProjectIDs.map((id, index) => [id, index])
            );
            const top100Projects = filteredAllProjects
              .filter((p) => cachedProjectsMap.has(p.projectID))
              .sort((a, b) => {
                const aIndex = cachedProjectsMap.get(a.projectID);
                const bIndex = cachedProjectsMap.get(b.projectID);
                return aIndex - bIndex;
              })
              .slice(0, 100);

            // Display the top 100 immediately
            setAllProjects(top100Projects);
            setFilteredProjects(top100Projects);
            setTotalPages(Math.ceil(top100Projects.length / itemsPerPage));
            setLoading(false);
            loadedFromCache = true;

            // Update cache with fresh data (unfiltered, so cache stays complete)
            cacheTopProjects(sortedAllProjects);

            // Update with all filtered projects
            setAllProjects(filteredAllProjects);
            setFilteredProjects(filteredAllProjects);
            setTotalPages(Math.ceil(filteredAllProjects.length / itemsPerPage));
          } catch (err) {
            console.error("Error loading projects with cached IDs:", err);
            loadedFromCache = false;
          }
        }

        // If no cached projectIDs or fetch failed, do full load
        if (!loadedFromCache) {
          const params = {
            page: 1,
            limit: 10000,
            sortBy: "createdAt",
            sortOrder: "desc",
            status: "all",
          };

          const response = await projectService.getAll(params);
          const projectsData = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];

          // Sort by projectID descending
          const sortedProjects = sortProjectsByID(projectsData);

          // Filter to projects with reports or active jobs
          const filteredProjects = filterProjects(sortedProjects);

          // Get the top 100 (highest projectIDs) from filtered set
          const top100Projects = filteredProjects.slice(0, 100);

          // Cache the unfiltered projects (so cache stays complete)
          cacheTopProjects(sortedProjects);

          // Display the top 100 immediately
          setAllProjects(top100Projects);
          setFilteredProjects(top100Projects);
          setTotalPages(Math.ceil(top100Projects.length / itemsPerPage));
          setLoading(false);

          // Update with all filtered projects
          if (filteredProjects.length > 100) {
            setAllProjects(filteredProjects);
            setFilteredProjects(filteredProjects);
            setTotalPages(Math.ceil(filteredProjects.length / itemsPerPage));
          }
        }
      }
    } catch (err) {
      console.error("Error loading initial projects:", err);
      setError("Failed to load projects");
      setAllProjects([]);
      setFilteredProjects([]);
      setLoading(false);
    }
  }, [itemsPerPage, sortProjectsByID, fetchProjectsWithReportsOrActiveJobs]);

  // Filter projects based on search term
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setFilteredProjects(allProjects);
      setPage(1);
      setTotalPages(Math.ceil(allProjects.length / itemsPerPage));
      return;
    }

    setSearching(true);
    const searchLower = debouncedSearchTerm.toLowerCase().trim();

    const filtered = allProjects.filter((project) => {
      const projectID = (project.projectID || "").toLowerCase();
      const projectName = (project.name || "").toLowerCase();
      const clientName = (
        project.client?.name ||
        project.client ||
        ""
      ).toLowerCase();

      return (
        projectID.includes(searchLower) ||
        projectName.includes(searchLower) ||
        clientName.includes(searchLower)
      );
    });

    // Sort filtered results by projectID descending
    const sortedFiltered = [...filtered].sort((a, b) => {
      const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
      const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
      return bNum - aNum;
    });

    setFilteredProjects(sortedFiltered);
    setPage(1);
    setTotalPages(Math.ceil(sortedFiltered.length / itemsPerPage));
    setSearching(false);
  }, [debouncedSearchTerm, allProjects, itemsPerPage]);

  // Handle URL search parameter
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  // Load initial projects on mount
  useEffect(() => {
    loadInitialProjects();
  }, [loadInitialProjects]);

  // Get paginated projects
  const paginatedProjects = filteredProjects.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const handleClearSearch = () => {
    setSearchTerm("");
    setPage(1);
  };

  const handleProjectClick = (project) => {
    navigate(`/reports/project/${project._id}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h3"
        component="h1"
        marginTop="10px"
        marginBottom="20px"
      >
        Reports
      </Typography>

      {/* Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search for a Project
        </Typography>
        <TextField
          fullWidth
          placeholder="Type project ID, site name, or client"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searching ? (
                  <CircularProgress size={20} />
                ) : (
                  <SearchIcon sx={{ color: "text.secondary" }} />
                )}
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch} edge="end">
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Projects Grid - 10x10 (100 per page) */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(10, minmax(90px, 1fr))",
                gap: 1,
                maxWidth: "100%",
                // On smaller screens, reduce columns to fit
                "@media (max-width: 1000px)": {
                  gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                },
                "@media (max-width: 768px)": {
                  gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
                  gap: 0.5,
                },
                "@media (max-width: 600px)": {
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                },
              }}
            >
              {paginatedProjects.map((project) => (
                <Card
                  key={project._id}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                    transition: "all 0.2s ease-in-out",
                    boxShadow: "none",
                    border: "none",
                    outline: "none",
                    minWidth: 0, // Allow shrinking
                    "&:hover": {
                      transform: "translateY(-2px)",
                    },
                    "&:focus": {
                      outline: "none",
                    },
                    "&:focus-visible": {
                      outline: "none",
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleProjectClick(project)}
                    sx={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      p: 1.5,
                      minHeight: "100px",
                      "&:focus": {
                        outline: "none",
                      },
                      "&:focus-visible": {
                        outline: "none",
                      },
                    }}
                  >
                    <FolderIcon
                      sx={{
                        fontSize: 50,
                        color: "primary.main",
                        mb: 1,
                      }}
                    />
                    <Typography
                      variant="body2"
                      align="center"
                      sx={{
                        fontWeight: 450,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        width: "100%",
                        fontSize: "0.7875rem", // 10% smaller than body2 (0.875rem)
                      }}
                    >
                      {project.projectID || "N/A"}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Paper>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
                size="large"
              />
            </Box>
          )}

          {/* Project Count Info */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {searchTerm.trim() ? (
                <>
                  Showing {paginatedProjects.length} of{" "}
                  {filteredProjects.length} matching projects
                  {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
                </>
              ) : (
                <>
                  Showing {paginatedProjects.length} of{" "}
                  {filteredProjects.length} projects
                  {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
                </>
              )}
            </Typography>
          </Box>
        </>
      )}

      {/* No Reports Dialog */}
      <Dialog
        open={noReportsDialog.open}
        onClose={() => setNoReportsDialog({ open: false, project: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>No Reports Available</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The project "{noReportsDialog.project?.projectID}:{" "}
            {noReportsDialog.project?.name}" doesn't have any reports yet.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setNoReportsDialog({ open: false, project: null })}
            color="primary"
          >
            OK
          </Button>
          <Button
            onClick={() =>
              navigate(`/projects/${noReportsDialog.project?._id}`)
            }
            variant="contained"
            color="primary"
          >
            View Project Details
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reports;
