import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";

import { projectService } from "../../services/api";
import ProjectDetailsModal from "./ProjectDetailsModal.jsx";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentSearchesWithStatus, setRecentSearchesWithStatus] = useState([]);
  const [searchCache, setSearchCache] = useState(new Map());
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 50,
    page: 0,
  });
  const [noReportsDialog, setNoReportsDialog] = useState({
    open: false,
    project: null,
  });

  // Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Function to check if a project has active jobs (not completed)
  const checkProjectHasActiveJobs = useCallback(async (project) => {
    try {
      // Check for active asbestos removal jobs
      try {
        const { default: asbestosRemovalJobService } = await import(
          "../../services/asbestosRemovalJobService"
        );
        const jobsResponse = await asbestosRemovalJobService.getAll({
          projectId: project._id,
        });
        const jobs = jobsResponse.jobs || jobsResponse.data || [];
        const hasActiveJobs = jobs.some(
          (job) =>
            (job.projectId === project._id ||
              job.projectId?._id === project._id) &&
            job.status === "in_progress"
        );
        if (hasActiveJobs) {
          return true;
        }
      } catch (error) {
        // No active asbestos removal jobs
      }

      // Check for active client supplied jobs (fibre ID)
      try {
        const { clientSuppliedJobsService } = await import(
          "../../services/api"
        );
        const clientJobsResponse = await clientSuppliedJobsService.getAll({
          projectId: project._id,
        });
        const clientJobs = clientJobsResponse.data || [];
        const hasActiveClientJobs = clientJobs.some(
          (job) =>
            (job.projectId === project._id ||
              job.projectId?._id === project._id) &&
            (job.status === "In Progress" || job.status === "Analysis Complete")
        );
        if (hasActiveClientJobs) {
          return true;
        }
      } catch (error) {
        // No active client supplied jobs
      }

      return false;
    } catch (error) {
      console.error("Error checking active jobs:", error);
      return false;
    }
  }, []);

  // Function to check if a project has any completed reports
  const checkProjectHasReports = useCallback(async (project) => {
    try {
      const { default: reportService } = await import(
        "../../services/reportService"
      );

      // Check asbestos assessment reports
      try {
        const assessmentReports =
          await reportService.getAsbestosAssessmentReports(project._id);
        if (
          assessmentReports &&
          Array.isArray(assessmentReports) &&
          assessmentReports.length > 0
        ) {
          return true;
        }
      } catch (error) {
        // No assessment reports
      }

      // Check air monitoring reports (only from completed jobs)
      try {
        const airMonitoringResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/asbestos-clearances/air-monitoring-reports/${project._id}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (airMonitoringResponse.ok) {
          const airMonitoringReports = await airMonitoringResponse.json();
          if (airMonitoringReports && airMonitoringReports.length > 0) {
            return true;
          }
        }
      } catch (error) {
        // No air monitoring reports
      }

      // Check clearances (only from completed jobs)
      try {
        const { default: asbestosClearanceService } = await import(
          "../../services/asbestosClearanceService"
        );
        const { default: asbestosRemovalJobService } = await import(
          "../../services/asbestosRemovalJobService"
        );

        const completedJobsResponse = await asbestosRemovalJobService.getAll();
        const completedJobs =
          completedJobsResponse.jobs || completedJobsResponse.data || [];
        const hasCompletedJobs = completedJobs.some(
          (job) =>
            (job.projectId === project._id ||
              job.projectId?._id === project._id) &&
            job.status === "completed"
        );

        if (hasCompletedJobs) {
          const clearancesResponse = await asbestosClearanceService.getAll();
          let projectClearances = [];

          if (clearancesResponse && Array.isArray(clearancesResponse)) {
            projectClearances = clearancesResponse.filter(
              (clearance) =>
                clearance.projectId === project._id ||
                clearance.projectId?._id === project._id
            );
          } else if (
            clearancesResponse.clearances &&
            Array.isArray(clearancesResponse.clearances)
          ) {
            projectClearances = clearancesResponse.clearances.filter(
              (clearance) =>
                clearance.projectId === project._id ||
                clearance.projectId?._id === project._id
            );
          }

          if (projectClearances.length > 0) {
            return true;
          }
        }
      } catch (error) {
        // No clearances
      }

      // Check fibre ID reports (only completed ones)
      try {
        const fibreIdReports = await reportService.getFibreIdReports(
          project._id
        );
        if (
          fibreIdReports &&
          Array.isArray(fibreIdReports) &&
          fibreIdReports.length > 0
        ) {
          return true;
        }
      } catch (error) {
        // No fibre ID reports
      }

      // Check uploaded reports
      try {
        const uploadedReportsResponse = await fetch(
          `${
            process.env.REACT_APP_API_URL || "http://localhost:5000/api"
          }/uploaded-reports/project/${project._id}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (uploadedReportsResponse.ok) {
          const uploadedReports = await uploadedReportsResponse.json();
          if (uploadedReports && uploadedReports.length > 0) {
            return true;
          }
        }
      } catch (error) {
        // No uploaded reports
      }

      return false;
    } catch (error) {
      console.error("Error checking project reports:", error);
      return false;
    }
  }, []);

  // Function to load search results
  const loadSearchResults = useCallback(
    async (searchValue) => {
      if (!searchValue.trim() || searchValue.length < 2) {
        setSearchResults([]);
        setError("");
        return;
      }

      // Check cache first
      const cacheKey = `search_${searchValue.trim().toLowerCase()}`;
      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey);
        setSearchResults(cachedResults);
        if (cachedResults.length === 0) {
          setError("No projects found matching your search term");
        } else {
          setError("");
        }
        return;
      }

      try {
        setSearching(true);
        setError("");
        setSearchResults([]);

        const params = {
          page: 1,
          limit: 1000, // Get all results for client-side pagination
          sortBy: "createdAt",
          sortOrder: "desc",
          search: searchValue.trim(),
          status: "all", // Search ALL projects regardless of status
        };

        const response = await projectService.getAll(params);
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];

        console.log("Search results:", projectsData.length, "projects found");
        if (projectsData.length > 0) {
          console.log("Sample project data:", {
            name: projectsData[0].name,
            client: projectsData[0].client,
            clientName: projectsData[0].client?.name,
          });
        }

        // Sort results by projectID descending (client-side sorting)
        const sortedProjects = [...projectsData].sort((a, b) => {
          // Extract numeric part from projectID for proper sorting
          const aNum = parseInt(a.projectID?.replace(/\D/g, "") || "0");
          const bNum = parseInt(b.projectID?.replace(/\D/g, "") || "0");
          return bNum - aNum; // Descending order
        });

        // Check for active jobs and reports for each project
        const projectsWithStatus = await Promise.all(
          sortedProjects.map(async (project) => {
            const hasReports = await checkProjectHasReports(project);
            const hasActiveJobs = await checkProjectHasActiveJobs(project);
            return {
              ...project,
              reports_present: hasReports,
              has_active_jobs: hasActiveJobs,
            };
          })
        );

        setSearchResults(projectsWithStatus);

        // Cache the results
        setSearchCache((prev) =>
          new Map(prev).set(cacheKey, projectsWithStatus)
        );

        if (projectsData.length === 0) {
          setError("No projects found matching your search term");
        } else {
          setError("");
        }
      } catch (err) {
        console.error("Error searching projects:", err);
        setError("Failed to search projects");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [searchCache, checkProjectHasReports, checkProjectHasActiveJobs]
  );

  // Function to load recent searches from localStorage
  const loadRecentSearches = useCallback(() => {
    try {
      const savedSearches = localStorage.getItem("recentProjectSearches");
      if (savedSearches) {
        const parsed = JSON.parse(savedSearches);
        // Ensure it's an array and limit to 20
        const recentProjects = Array.isArray(parsed) ? parsed.slice(0, 20) : [];
        setRecentSearches(recentProjects);
      } else {
        setRecentSearches([]);
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
      setRecentSearches([]);
    }
  }, []);

  // Check active jobs status for recent searches
  useEffect(() => {
    const updateRecentSearchesStatus = async () => {
      if (recentSearches.length === 0) {
        setRecentSearchesWithStatus([]);
        return;
      }

      const updated = await Promise.all(
        recentSearches.map(async (project) => {
          const hasActiveJobs = await checkProjectHasActiveJobs(project);
          return {
            ...project,
            has_active_jobs: hasActiveJobs,
          };
        })
      );

      setRecentSearchesWithStatus(updated);
    };

    updateRecentSearchesStatus();
  }, [recentSearches, checkProjectHasActiveJobs]);

  // Load recent searches on mount and listen for updates
  useEffect(() => {
    loadRecentSearches();

    // Listen for custom event when recent projects are updated
    const handleRecentProjectsUpdate = () => {
      loadRecentSearches();
    };

    // Listen for storage changes from other tabs
    const handleStorageChange = (e) => {
      if (e.key === "recentProjectSearches") {
        loadRecentSearches();
      }
    };

    window.addEventListener(
      "recentProjectsUpdated",
      handleRecentProjectsUpdate
    );
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(
        "recentProjectsUpdated",
        handleRecentProjectsUpdate
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadRecentSearches]);

  // Handle URL search parameter
  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) {
      setSearchTerm(searchFromUrl);
    }
  }, [searchParams]);

  // Load search results when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      loadSearchResults(debouncedSearchTerm);
    } else {
      setSearchResults([]);
      setError("");
    }
  }, [debouncedSearchTerm, loadSearchResults]);

  // Define columns for DataGrid
  const columns = [
    {
      field: "projectID",
      headerName: "Project ID",
      width: 120,
      sortable: true,
    },
    {
      field: "name",
      headerName: "Project",
      minWidth: 300,
      flex: 2,
      sortable: true,
      renderCell: ({ row }) => {
        const clientName = row.client?.name || row.client || "";
        const projectName = row.name || "";

        return (
          <Box
            sx={{
              whiteSpace: "normal",
              wordWrap: "break-word",
              lineHeight: 1.2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: "100%",
              py: 0.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: "100%",
                color: "black",
              }}
            >
              {projectName}
            </Typography>
            {clientName && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  width: "100%",
                }}
              >
                Client: {clientName}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 200,
      maxWidth: 350,
      flex: 2,
      sortable: true,
    },
    // {
    //   field: "department",
    //   headerName: "Department",
    //   width: 150,
    //   sortable: true,
    // },
    // {
    //   field: "assignedTo",
    //   headerName: "Assigned To",
    //   width: 200,
    //   sortable: true,
    //   valueGetter: (params) => params.row.assignedTo || "",
    // },
    {
      field: "actions",
      headerName: "Actions",
      minWidth: 200,
      maxWidth: 350,
      flex: 1.5,
      sortable: false,
      renderCell: (params) => {
        const project = params.row;
        const hasReports = project.reports_present === true;
        const hasActiveJobs = project.has_active_jobs === true;

        return (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/projects/${project._id}`);
              }}
            >
              Job Details
            </Button>
            {hasReports && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<DescriptionIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/reports/project/${project._id}`);
                }}
              >
                {hasActiveJobs ? "Active Jobs & Reports" : "Reports"}
              </Button>
            )}
          </Stack>
        );
      },
    },
  ];

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResults([]);
    setError("");
  };

  const handleRemoveFromRecent = (projectToRemove) => {
    const updatedSearches = recentSearches.filter(
      (project) => project._id !== projectToRemove._id
    );
    setRecentSearches(updatedSearches);
    localStorage.setItem(
      "recentProjectSearches",
      JSON.stringify(updatedSearches)
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        variant="h3"
        component="h1"
        marginTop="10px"
        marginBottom="20px"
      >
        All Projects
      </Typography>

      {/* Project Search Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Search Projects
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search for a project"
            placeholder="Type project ID, name, or client (searches automatically)"
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
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    edge="end"
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Recent Projects - Only show when not searching */}
        {!searchTerm.trim() && recentSearches.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Projects ({recentSearches.length})
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Project</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(recentSearchesWithStatus.length > 0
                    ? recentSearchesWithStatus
                    : recentSearches
                  ).map((project) => (
                    <TableRow
                      key={project._id}
                      hover
                      sx={{
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                        },
                      }}
                    >
                      <TableCell>{project.projectID}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body1">
                            {project.name}
                          </Typography>
                          {project.client?.name ||
                          (typeof project.client === "string"
                            ? project.client
                            : null) ? (
                            <Typography variant="body2" color="text.secondary">
                              Client:{" "}
                              {project.client?.name ||
                                (typeof project.client === "string"
                                  ? project.client
                                  : "No Client")}
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            variant="contained"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/projects/${project._id}`);
                            }}
                          >
                            Job Details
                          </Button>
                          {project.reports_present === true && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<DescriptionIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/reports/project/${project._id}`, {
                                  state: { from: "reports" },
                                });
                              }}
                            >
                              {project.has_active_jobs
                                ? "Active Jobs & Reports"
                                : "Reports"}
                            </Button>
                          )}
                          <IconButton
                            size="small"
                            color="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromRecent(project);
                            }}
                            title="Remove from recent"
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Search Results ({searchResults.length} projects found)
            </Typography>
            <Box sx={{ height: 650, width: "100%" }}>
              <DataGrid
                rows={searchResults}
                columns={columns}
                getRowId={(row) => row._id}
                loading={searching}
                paginationMode="client"
                sortingMode="client"
                disableRowSelectionOnClick={true}
                disableColumnMenu={false}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                pageSizeOptions={[25, 50, 100]}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 50, page: 0 },
                  },
                  sorting: {
                    sortModel: [{ field: "projectID", sort: "desc" }],
                  },
                }}
                sx={{
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: "rgba(0, 0, 0, 0.04)",
                  },
                }}
              />
            </Box>
          </Box>
        )}
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Project Details Modal */}
      <ProjectDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        project={selectedProject}
      />

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
