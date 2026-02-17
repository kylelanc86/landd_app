import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Container,
  useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { projectService } from "../../services/api";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

const CACHE_KEY = "asbestosRemovalJobsCache";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const loadJobsCache = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const cachedRaw = window.sessionStorage.getItem(CACHE_KEY);
    if (!cachedRaw) {
      return null;
    }

    const parsed = JSON.parse(cachedRaw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!Array.isArray(parsed.jobs) || typeof parsed.timestamp !== "number") {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn("[Asbestos Removal] Failed to parse jobs cache", error);
    return null;
  }
};

const saveJobsCache = (jobs) => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    const payload = JSON.stringify({ jobs, timestamp: Date.now() });
    window.sessionStorage.setItem(CACHE_KEY, payload);
  } catch (error) {
    console.warn("[Asbestos Removal] Failed to write jobs cache", error);
  }
};

const clearJobsCache = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[Asbestos Removal] Failed to clear jobs cache", error);
  }
};

const AsbestosRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const showPortraitColumnsOnly = isMobile && isPortrait;

  const [asbestosRemovalJobs, setAsbestosRemovalJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedRemovalist, setSelectedRemovalist] = useState("");

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const resolveJobTypeLabel = useCallback(
    (jobTypeRaw, airMonitoringFlag, clearanceFlag) => {
      switch (jobTypeRaw) {
        case "air_monitoring_and_clearance":
          return "Air Monitoring & Clearance";
        case "air_monitoring":
          return "Air Monitoring";
        case "clearance":
          return "Clearance";
        case "none":
        case undefined:
        case null:
        default: {
          const hasAirMonitoring = !!airMonitoringFlag;
          const hasClearance = !!clearanceFlag;
          if (hasAirMonitoring && hasClearance) {
            return "Air Monitoring & Clearance";
          }
          if (hasAirMonitoring) {
            return "Air Monitoring";
          }
          if (hasClearance) {
            return "Clearance";
          }
          return "None";
        }
      }
    },
    []
  );

  const fetchAsbestosRemovalJobs = useCallback(
    async ({ force = false, silent = false } = {}) => {
      const startTime = performance.now();
      console.log("[Asbestos Removal] Starting fetchAsbestosRemovalJobs");

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        if (!force) {
          const cached = loadJobsCache();
          if (cached) {
            console.log(
              "[Asbestos Removal] Serving asbestos removal jobs from cache"
            );
            setAsbestosRemovalJobs(cached.jobs);
            if (!silent) {
              setLoading(false);
            }
            return;
          }
        }

        const jobsFetchStart = performance.now();
        console.log("[Asbestos Removal] Fetching asbestos removal jobs...");

        const jobsResponse = await asbestosRemovalJobService.getAll({
          excludeStatus: "completed,cancelled,archived",
          limit: 1000,
          minimal: true,
        });

        const jobsFetchTime = performance.now() - jobsFetchStart;
        console.log(
          `[Asbestos Removal] Asbestos removal jobs fetched in ${jobsFetchTime.toFixed(
            2
          )}ms`
        );

        let jobs = [];
        if (
          jobsResponse &&
          jobsResponse.jobs &&
          Array.isArray(jobsResponse.jobs)
        ) {
          jobs = jobsResponse.jobs;
        } else if (
          jobsResponse &&
          jobsResponse.data &&
          Array.isArray(jobsResponse.data)
        ) {
          jobs = jobsResponse.data;
        } else if (Array.isArray(jobsResponse)) {
          jobs = jobsResponse;
        }

        if (!Array.isArray(jobs)) {
          console.error("Jobs is not an array:", jobs);
          setAsbestosRemovalJobs([]);
          return;
        }

        console.log(
          `[Asbestos Removal] Found ${jobs.length} active asbestos removal jobs`
        );

        if (jobs.length === 0) {
          const elapsed = performance.now() - startTime;
          console.log(
            `[Asbestos Removal] No active asbestos removal jobs found (elapsed ${elapsed.toFixed(
              2
            )}ms)`
          );
          setAsbestosRemovalJobs([]);
          return;
        }

        const processingStart = performance.now();
        const processedJobs = jobs.map((job) => {
          const projectRef = job.projectId || {};
          const projectIdentifier =
            projectRef?.projectID || job.projectID || "Unknown";
          const projectName =
            projectRef?.name || job.projectName || "Unknown Project";

          const airMonitoringFlag = !!job.airMonitoring;
          const clearanceFlag = !!job.clearance;
          const jobTypeRaw = job.jobType || "none";
          const jobTypeLabel = resolveJobTypeLabel(
            jobTypeRaw,
            airMonitoringFlag,
            clearanceFlag
          );

          return {
            id: job._id,
            projectID: projectIdentifier,
            projectName: projectName,
            asbestosRemovalist: job.asbestosRemovalist || "Not assigned",
            status: job.status || "Active",
            jobTypeLabel,
            jobTypeRaw,
            airMonitoring: airMonitoringFlag,
            clearance: clearanceFlag,
            originalData: job,
          };
        });
        const processingTime = performance.now() - processingStart;

        const sortStart = performance.now();
        const sortedJobs = processedJobs.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
          return bNum - aNum;
        });
        const sortTime = performance.now() - sortStart;

        const totalTime = performance.now() - startTime;
        console.log("[Asbestos Removal] Timing breakdown:", {
          jobsFetch: `${jobsFetchTime.toFixed(2)}ms`,
          processing: `${processingTime.toFixed(2)}ms`,
          sorting: `${sortTime.toFixed(2)}ms`,
          total: `${totalTime.toFixed(2)}ms`,
        });

        setAsbestosRemovalJobs(sortedJobs);
        saveJobsCache(sortedJobs);
      } catch (err) {
        const errorTime = performance.now() - startTime;
        console.error(
          `[Asbestos Removal] Error after ${errorTime.toFixed(2)}ms:`,
          err
        );
        setError(err.message || "Failed to fetch jobs");
        if (!force) {
          clearJobsCache();
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
        const finalTime = performance.now() - startTime;
        console.log(
          `[Asbestos Removal] fetchAsbestosRemovalJobs completed in ${finalTime.toFixed(
            2
          )}ms`
        );
      }
    },
    [resolveJobTypeLabel]
  );

  // Lazy load projects and removalists only when modal opens
  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectService.getAll({
        limit: 1000,
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Completed,Report sent for review,Ready for invoicing,Invoice sent, Quote sent",
      });

      if (response && response.data) {
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data.data || [];

        const sortedProjects = projectsData.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
          return bNum - aNum;
        });

        setProjects(sortedProjects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    }
  }, []);

  const fetchAsbestosRemovalists = useCallback(async () => {
    try {
      const data = await customDataFieldGroupService.getFieldsByType(
        "asbestos_removalist"
      );
      // Sort alphabetically by text field
      const sortedData = (data || []).sort((a, b) =>
        (a.text || "").localeCompare(b.text || "")
      );
      setAsbestosRemovalists(sortedData);
    } catch (error) {
      console.error("Error fetching asbestos removalists:", error);
      setAsbestosRemovalists([]);
    }
  }, []);

  // Only fetch jobs on mount, lazy load modal data when needed
  useEffect(() => {
    const cached = loadJobsCache();

    if (cached) {
      console.log("[Asbestos Removal] Using cached asbestos removal jobs");
      setAsbestosRemovalJobs(cached.jobs);
      setLoading(false);
      fetchAsbestosRemovalJobs({ force: true, silent: true });
    } else {
      fetchAsbestosRemovalJobs();
    }
  }, [fetchAsbestosRemovalJobs]);

  // Memoize color functions
  const getStatusColor = useCallback(
    (status) => {
      // Handle both original and formatted status values
      const normalizedStatus = status?.toLowerCase().replace(/\s+/g, "_");

      switch (normalizedStatus) {
        case "completed":
        case "complete":
          return theme.palette.success.main;
        case "in_progress":
          return theme.palette.warning.main;
        case "active":
          return theme.palette.primary.main;
        case "cancelled":
          return theme.palette.error.main;
        default:
          return theme.palette.grey[500];
      }
    },
    [theme]
  );

  const getJobTypeColor = useCallback(
    (jobTypeRaw) => {
      switch (jobTypeRaw) {
        case "air_monitoring_and_clearance":
          return theme.palette.info.main;
        case "air_monitoring":
          return theme.palette.primary.main;
        case "clearance":
          return theme.palette.secondary.main;
        case "none":
        default:
          return theme.palette.grey[500];
      }
    },
    [theme]
  );

  // Memoize status formatting function
  const formatStatusLabel = useCallback((status) => {
    if (!status) return "Unknown";

    // Handle specific status mappings
    const statusMap = {
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
      complete: "Complete",
      active: "Active",
    };

    // Return mapped status or format by replacing underscores and capitalizing
    return (
      statusMap[status] ||
      status
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    );
  }, []);

  const handleCreateAsbestosRemovalJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setSelectedRemovalist("");
    setModalError(null);
    // Lazy load modal data only when modal opens
    if (projects.length === 0) {
      fetchProjects();
    }
    if (asbestosRemovalists.length === 0) {
      fetchAsbestosRemovalists();
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setSelectedRemovalist("");
    setModalError(null);
  };

  const handleSubmitModal = async () => {
    if (!selectedProject || !selectedRemovalist) {
      setModalError("Please select both a project and asbestos removalist");
      return;
    }

    setModalLoading(true);
    setModalError(null);

    try {
      const newJobData = {
        projectId: selectedProject._id,
        projectName: selectedProject.name,
        client:
          typeof selectedProject.client === "string"
            ? selectedProject.client
            : selectedProject.client?.name || "Not specified",
        asbestosRemovalist: selectedRemovalist,
        status: "in_progress",
        airMonitoring: false,
        clearance: false,
      };

      const response = await asbestosRemovalJobService.create(newJobData);

      if (response.data) {
        // Refresh the jobs list
        await fetchAsbestosRemovalJobs({ force: true });
        handleCloseModal();
      }
    } catch (err) {
      console.error("Error creating asbestos removal job:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create job"
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    // Navigate to job details page
    navigate(`/asbestos-removal/jobs/${job.id}/details`);
  };

  const handleDeleteClick = (event, job) => {
    event.stopPropagation(); // Prevent row click
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    setDeleteLoading(true);
    try {
      await asbestosRemovalJobService.delete(jobToDelete.id);
      // Clear cache to prevent showing deleted job when navigating back
      clearJobsCache();
      // Remove the deleted job from state immediately
      setAsbestosRemovalJobs((prev) =>
        prev.filter((job) => job.id !== jobToDelete.id)
      );
      // Refresh the jobs list to update cache with fresh data
      await fetchAsbestosRemovalJobs({ force: true, silent: true });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (err) {
      console.error("Error deleting asbestos removal job:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to delete job"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Asbestos Removal Jobs
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateAsbestosRemovalJob}
            sx={{
              minWidth: "220px",
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            New Asbestos Removal Job
          </Button>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                p: 4,
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 4 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          ) : asbestosRemovalJobs.length === 0 ? (
            <Box sx={{ p: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No active asbestos removal jobs
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{
                // Override theme MuiTableCell head (backgroundColor: tokens.primary[500]) so gradient shows
                "& thead": {
                  background: "linear-gradient(to right, #045E1F, #96CC78) !important",
                },
                "& thead .MuiTableCell-root": {
                  backgroundColor: "transparent !important",
                  color: "#FFFFFF !important",
                  borderBottom: "2px solid rgba(255,255,255,0.4) !important",
                },
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ fontWeight: "bold", minWidth: showPortraitColumnsOnly ? "80px" : "120px" }}>
                      Project ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: showPortraitColumnsOnly ? "140px" : "240px" }}>
                      Site Name (Project)
                    </TableCell>
                    {!showPortraitColumnsOnly && (
                      <>
                        <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                          Asbestos Removalist
                        </TableCell>
                        <TableCell sx={{ fontWeight: "bold", minWidth: "140px" }}>
                          Status
                        </TableCell>
                      </>
                    )}
                    {!isMobile && (
                      <TableCell sx={{ fontWeight: "bold", minWidth: "100px" }}>
                        Job Type
                      </TableCell>
                    )}
                    {!isMobile && hasPermission(currentUser, "asbestos.delete") && (
                      <TableCell
                        sx={{ fontWeight: "bold", width: "120px" }}
                        align="center"
                      >
                        Actions
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asbestosRemovalJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => handleRowClick(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectID}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectName}
                        </Typography>
                      </TableCell>
                      {!showPortraitColumnsOnly && (
                        <>
                          <TableCell>
                            <Typography variant="body2">
                              {job.asbestosRemovalist}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={formatStatusLabel(job.status)}
                              size="small"
                              sx={{
                                backgroundColor: getStatusColor(job.status),
                                color: "white",
                              }}
                            />
                          </TableCell>
                        </>
                      )}
                      {!isMobile && (
                        <TableCell>
                          <Chip
                            label={job.jobTypeLabel}
                            size="small"
                            sx={{
                              backgroundColor: getJobTypeColor(job.jobTypeRaw),
                              color: "white",
                            }}
                          />
                        </TableCell>
                      )}
                      {!isMobile && hasPermission(currentUser, "asbestos.delete") && (
                        <TableCell align="center">
                          <Tooltip title="Delete Job">
                            <IconButton
                              onClick={(event) => handleDeleteClick(event, job)}
                              size="small"
                              sx={{
                                color: theme.palette.error.main,
                                "&:hover": {
                                  backgroundColor: theme.palette.error.light,
                                  color: "white",
                                },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Create Asbestos Removal Job Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">New Asbestos Removal Job</Typography>
            <IconButton onClick={handleCloseModal}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {modalError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {modalError}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 3, mt: 1 }}>
            <Autocomplete
              options={Array.isArray(projects) ? projects : []}
              getOptionLabel={(option) =>
                `${option.projectID} - ${option.name}`
              }
              value={selectedProject}
              onChange={(event, newValue) => {
                setSelectedProject(newValue);
                setModalError(null);
              }}
              isOptionEqualToValue={(option, value) => option._id === value._id}
              renderInput={(params) => (
                <TextField {...params} label="Select Project" required />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body1">
                      {option.projectID} - {option.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Client:{" "}
                      {typeof option.client === "string"
                        ? option.client
                        : option.client?.name || "Not specified"}
                    </Typography>
                  </Box>
                </li>
              )}
            />
          </FormControl>

          <FormControl fullWidth required sx={{ mb: 2 }}>
            <InputLabel>Asbestos Removalist</InputLabel>
            <Select
              value={selectedRemovalist}
              onChange={(e) => {
                setSelectedRemovalist(e.target.value);
                setModalError(null);
              }}
              label="Asbestos Removalist"
            >
              {asbestosRemovalists.map((removalist) => (
                <MenuItem key={removalist._id} value={removalist.text}>
                  {removalist.text}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSubmitModal}
            variant="contained"
            disabled={!selectedProject || !selectedRemovalist || modalLoading}
            sx={{
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            {modalLoading ? "Creating..." : "Create Job"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Delete Asbestos Removal Job</Typography>
            <IconButton onClick={handleDeleteCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this asbestos removal job?
          </Typography>
          {jobToDelete && (
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Project: {jobToDelete.projectID} - {jobToDelete.projectName}
              </Typography>
              <Typography variant="body2">
                Asbestos Removalist: {jobToDelete.asbestosRemovalist}
              </Typography>
              <Typography variant="body2">
                Status: {formatStatusLabel(jobToDelete.status)}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. All associated data will be
            permanently deleted.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            disabled={deleteLoading}
            sx={{
              "&:hover": {
                backgroundColor: theme.palette.error.dark,
              },
            }}
          >
            {deleteLoading ? "Deleting..." : "Delete Job"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AsbestosRemoval;
