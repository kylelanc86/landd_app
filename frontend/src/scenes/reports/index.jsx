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

  // Load initial 100 projects (highest projectIDs) - fast load using cache
  const loadInitialProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Try to get cached top 100 projects - display immediately without API call
      const cachedProjects = getCachedTopProjects();
      let loadedFromCache = false;

      if (cachedProjects && cachedProjects.length > 0) {
        // Fast path: Display cached projects immediately (no API call!)
        setAllProjects(cachedProjects);
        setFilteredProjects(cachedProjects);
        setTotalPages(Math.ceil(cachedProjects.length / itemsPerPage));
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

            // Update cache with fresh data
            cacheTopProjects(sortedAllProjects);

            // Update state with all projects
            setAllProjects(sortedAllProjects);
            setFilteredProjects(sortedAllProjects);
            setTotalPages(Math.ceil(sortedAllProjects.length / itemsPerPage));
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

            // Filter to cached projectIDs and sort by cached order
            const cachedProjectsMap = new Map(
              cachedProjectIDs.map((id, index) => [id, index])
            );
            const top100Projects = allProjectsData
              .filter((p) => cachedProjectsMap.has(p.projectID))
              .sort((a, b) => {
                const aIndex = cachedProjectsMap.get(a.projectID);
                const bIndex = cachedProjectsMap.get(b.projectID);
                return aIndex - bIndex;
              });

            // Display the top 100 immediately
            setAllProjects(top100Projects);
            setFilteredProjects(top100Projects);
            setTotalPages(Math.ceil(top100Projects.length / itemsPerPage));
            setLoading(false);
            loadedFromCache = true;

            // Now sort all projects and update cache
            const sortedAllProjects = sortProjectsByID(allProjectsData);
            cacheTopProjects(sortedAllProjects);

            // Update with all projects
            setAllProjects(sortedAllProjects);
            setFilteredProjects(sortedAllProjects);
            setTotalPages(Math.ceil(sortedAllProjects.length / itemsPerPage));
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

          // Get the top 100 (highest projectIDs)
          const top100Projects = sortedProjects.slice(0, 100);

          // Cache the top 100 projects
          cacheTopProjects(sortedProjects);

          // Display the top 100 immediately
          setAllProjects(top100Projects);
          setFilteredProjects(top100Projects);
          setTotalPages(Math.ceil(top100Projects.length / itemsPerPage));
          setLoading(false);

          // Update with all projects
          if (sortedProjects.length > 100) {
            setAllProjects(sortedProjects);
            setFilteredProjects(sortedProjects);
            setTotalPages(Math.ceil(sortedProjects.length / itemsPerPage));
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
  }, [itemsPerPage, sortProjectsByID]);

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
