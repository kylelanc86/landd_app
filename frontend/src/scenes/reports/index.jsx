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

import { projectService } from "../../services/api";
import {
  getCachedTopProjects,
  cacheTopProjects,
  getCachedProjectIdsWithReportsOrJobs,
  cacheProjectIdsWithReportsOrJobs,
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

  // Fetch project IDs that have reports or active jobs (optimized with backend endpoint)
  const fetchProjectsWithReportsOrActiveJobs = useCallback(async () => {
    try {
      // Check cache first
      const cachedProjectIds = getCachedProjectIdsWithReportsOrJobs();
      if (cachedProjectIds && cachedProjectIds.length > 0) {
        console.log(
          `[REPORTS] Using cached project IDs (${cachedProjectIds.length} projects)`
        );
        // Note: Cached data doesn't include reasons, fetch fresh for diagnostics
        console.log(
          "[REPORTS] Cache hit - fetching fresh data for diagnostics..."
        );
      }

      // Fetch from backend (single optimized endpoint)
      console.log("[REPORTS] Fetching project IDs from backend...");
      const response = await projectService.getProjectIdsWithReportsOrJobs();
      const projectIds = response.data?.projectIds || [];
      const projectReasons = response.data?.projectReasons || {};

      // Cache the result
      if (projectIds.length > 0) {
        cacheProjectIdsWithReportsOrJobs(projectIds);
      }

      console.log(
        `[REPORTS] Found ${projectIds.length} projects with reports/jobs`
      );

      // Log diagnostic information about why projects qualified
      if (Object.keys(projectReasons).length > 0) {
        console.log("[REPORTS] Project qualification reasons:", projectReasons);

        // Count projects by reason type
        const reasonCounts = {};
        Object.values(projectReasons).forEach((reasons) => {
          reasons.forEach((reason) => {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          });
        });
        console.log("[REPORTS] Projects count by reason:", reasonCounts);
      }

      return { projectIdsSet: new Set(projectIds), projectReasons };
    } catch (error) {
      console.error("Error fetching project IDs with reports or jobs:", error);
      // Return empty set on error
      return { projectIdsSet: new Set(), projectReasons: {} };
    }
  }, []);

  // Load initial projects - optimized with new backend endpoints
  const loadInitialProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Step 1: Get project IDs with reports or active jobs (cached or from backend)
      const { projectIdsSet: validProjectIdsSet, projectReasons } =
        await fetchProjectsWithReportsOrActiveJobs();
      const validProjectIds = Array.from(validProjectIdsSet);

      if (validProjectIds.length === 0) {
        console.log("[REPORTS] No projects with reports or active jobs found");
        setAllProjects([]);
        setFilteredProjects([]);
        setTotalPages(1);
        setLoading(false);
        return;
      }

      // Step 2: Try to get cached projects first for instant display
      const cachedProjects = getCachedTopProjects();
      let loadedFromCache = false;

      if (cachedProjects && cachedProjects.length > 0) {
        // Filter cached projects to only those with reports/jobs
        const filteredCached = cachedProjects.filter((project) => {
          const projectId = project._id?.toString();
          return projectId && validProjectIdsSet.has(projectId);
        });

        if (filteredCached.length > 0) {
          // Sort by projectID descending
          const sortedCached = sortProjectsByID(filteredCached);

          // Log diagnostic info for cached projects


          // Fast path: Display cached projects immediately (no API call!)
          setAllProjects(sortedCached);
          setFilteredProjects(sortedCached);
          setTotalPages(Math.ceil(sortedCached.length / itemsPerPage));
          setLoading(false);
          loadedFromCache = true;

            }
      }

      // Step 3: Fetch fresh projects by IDs in the background
      // If we loaded from cache, this happens in background. Otherwise, wait for it.
      try {
        console.log(
          `[REPORTS] Fetching ${validProjectIds.length} projects by IDs...`
        );
        const response = await projectService.getProjectsByIds(validProjectIds);
        const fetchedProjects = Array.isArray(response.data?.data)
          ? response.data.data
          : response.data || [];

        if (fetchedProjects.length > 0) {
          // Sort by projectID descending
          const sortedProjects = sortProjectsByID(fetchedProjects);


          // Update state with fresh data
          setAllProjects(sortedProjects);
          setFilteredProjects(sortedProjects);
          setTotalPages(Math.ceil(sortedProjects.length / itemsPerPage));

          // Update cache with fresh data (for next time)
          cacheTopProjects(sortedProjects);

          console.log(`[REPORTS] Loaded ${sortedProjects.length} projects`);
        }

        // If we didn't load from cache, stop loading now
        if (!loadedFromCache) {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching projects by IDs:", err);
        // If we loaded from cache, keep showing cached data
        // Otherwise, show error
        if (!loadedFromCache) {
          setError("Failed to load projects");
          setAllProjects([]);
          setFilteredProjects([]);
          setLoading(false);
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
    <Box sx={{ p: 3, px: { xs: 1.5, sm: 3 } }}>
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
