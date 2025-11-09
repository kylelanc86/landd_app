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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { jobService, shiftService, projectService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";

const AsbestosRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { currentUser } = useAuth();

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

  const fetchAsbestosRemovalJobs = useCallback(async () => {
    const startTime = performance.now();
    console.log("[Asbestos Removal] Starting fetchAsbestosRemovalJobs");

    setLoading(true);
    setError(null);

    try {
      // Fetch only incomplete asbestos removal jobs (exclude completed and cancelled)
      // Use minimal=true to only fetch fields needed for table display
      const jobsFetchStart = performance.now();
      console.log("[Asbestos Removal] Fetching asbestos removal jobs...");

      const jobsResponse = await asbestosRemovalJobService.getAll({
        excludeStatus: "completed,cancelled",
        limit: 1000,
        minimal: true,
      });

      const jobsFetchTime = performance.now() - jobsFetchStart;
      console.log(
        `[Asbestos Removal] Asbestos removal jobs fetched in ${jobsFetchTime.toFixed(
          2
        )}ms`
      );

      // Handle different response structures for jobs
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
      } else {
        jobs = [];
      }

      console.log(
        `[Asbestos Removal] Found ${jobs.length} active asbestos removal jobs`
      );

      // Ensure jobs is an array before processing
      if (!Array.isArray(jobs)) {
        console.error("Jobs is not an array:", jobs);
        setAsbestosRemovalJobs([]);
        return;
      }

      // Early exit when no jobs are present to avoid unnecessary downstream fetches
      if (jobs.length === 0) {
        const elapsed = performance.now() - startTime;
        console.log(
          `[Asbestos Removal] No active asbestos removal jobs found; skipping additional data fetches (elapsed ${elapsed.toFixed(
            2
          )}ms)`
        );
        setAsbestosRemovalJobs([]);
        return;
      }

      // Track timings for per-job queries so we can identify bottlenecks
      let clearanceTotalTime = 0;
      let clearanceMaxTime = 0;
      let shiftTotalTime = 0;
      let shiftMaxTime = 0;
      let jobProcessingTotalTime = 0;
      let jobProcessingMaxTime = 0;
      const slowJobDetails = [];

      // Fetch only active air monitoring jobs (exclude completed/cancelled)
      // Use minimal=true to only fetch projectId for matching (much smaller payload)
      const airMonitoringFetchStart = performance.now();
      console.log("[Asbestos Removal] Fetching air monitoring jobs...");

      let allAirMonitoringJobs = [];
      let airMonitoringFetchTime = 0;
      try {
        const airMonitoringResponse = await jobService.getAll({
          excludeStatus: "completed,cancelled",
          minimal: true,
        });
        // With minimal=true, backend returns array directly
        allAirMonitoringJobs = Array.isArray(airMonitoringResponse)
          ? airMonitoringResponse
          : Array.isArray(airMonitoringResponse?.data)
          ? airMonitoringResponse.data
          : [];

        airMonitoringFetchTime = performance.now() - airMonitoringFetchStart;
        console.log(
          `[Asbestos Removal] Air monitoring jobs fetched in ${airMonitoringFetchTime.toFixed(
            2
          )}ms (${allAirMonitoringJobs.length} jobs)`
        );
      } catch (error) {
        airMonitoringFetchTime = performance.now() - airMonitoringFetchStart;
        console.error(
          `[Asbestos Removal] Error fetching air monitoring jobs after ${airMonitoringFetchTime.toFixed(
            2
          )}ms:`,
          error
        );
      }

      // For each job, make targeted queries to check if related data exists
      // This is MUCH faster than fetching ALL data - we only query what we need
      const perJobProcessingStart = performance.now();
      console.log(
        `[Asbestos Removal] Processing ${jobs.length} jobs (clearances & shifts)...`
      );

      const processedJobs = await Promise.all(
        jobs.map(async (job, index) => {
          const jobStartTime = performance.now();
          let clearanceElapsed = 0;
          let shiftElapsed = 0;
          const projectId = job.projectId?._id || job.projectId;
          const jobId = job._id;

          // Make targeted queries in parallel for this specific job/project
          // Each query only fetches data for THIS specific project/job
          const queriesStartTime = performance.now();
          const [clearancesResponse, shiftsResponse] = await Promise.all([
            // Query clearances for this specific project only (limit 1 - we only need to know if any exist)
            projectId
              ? (async () => {
                  const clearanceStart = performance.now();
                  try {
                    const response = await asbestosClearanceService.getAll({
                      projectId: projectId,
                      limit: 1, // We only need to know if any exist
                    });
                    clearanceElapsed = performance.now() - clearanceStart;
                    return response;
                  } catch (err) {
                    clearanceElapsed = performance.now() - clearanceStart;
                    console.warn(
                      `[Asbestos Removal] Clearance query failed for project ${projectId} after ${clearanceElapsed.toFixed(
                        2
                      )}ms:`,
                      err
                    );
                    return { clearances: [] };
                  }
                })()
              : Promise.resolve({ clearances: [] }),
            // Query shifts for this specific job only
            jobId
              ? (async () => {
                  const shiftStart = performance.now();
                  try {
                    const response = await shiftService.getByJob(jobId);
                    shiftElapsed = performance.now() - shiftStart;
                    return response;
                  } catch (err) {
                    shiftElapsed = performance.now() - shiftStart;
                    console.warn(
                      `[Asbestos Removal] Shift query failed for job ${jobId} after ${shiftElapsed.toFixed(
                        2
                      )}ms:`,
                      err
                    );
                    return [];
                  }
                })()
              : Promise.resolve([]),
          ]);
          const queriesTime = performance.now() - queriesStartTime;

          // Check if clearances exist for this project
          let hasClearance = false;
          if (clearancesResponse) {
            const clearances =
              clearancesResponse.clearances ||
              clearancesResponse.data ||
              (Array.isArray(clearancesResponse) ? clearancesResponse : []);
            hasClearance = clearances.length > 0;
          }

          // Check if air monitoring jobs exist for this project (using cached data)
          const hasAirMonitoring = allAirMonitoringJobs.some(
            (airJob) =>
              (airJob.projectId?._id || airJob.projectId) === projectId
          );

          // Check if shifts exist for this job
          let hasShifts = false;
          if (shiftsResponse) {
            const shifts = Array.isArray(shiftsResponse)
              ? shiftsResponse
              : shiftsResponse.data || [];
            hasShifts =
              shifts.length > 0 &&
              shifts.some(
                (shift) =>
                  (shift.job?._id || shift.job) === jobId &&
                  shift.jobModel === "AsbestosRemovalJob"
              );
          }

          const hasAirMonitoringOverall = hasAirMonitoring || hasShifts;

          let jobType = "None";
          if (hasAirMonitoringOverall && hasClearance) {
            jobType = "Air Monitoring & Clearance";
          } else if (hasAirMonitoringOverall) {
            jobType = "Air Monitoring";
          } else if (hasClearance) {
            jobType = "Clearance";
          }

          const jobProcessingTime = performance.now() - jobStartTime;
          if (queriesTime > 100) {
            console.log(
              `[Asbestos Removal] Job ${index + 1}/${jobs.length} (${
                job.projectId?.projectID || "Unknown"
              }) processed in ${jobProcessingTime.toFixed(
                2
              )}ms (queries: ${queriesTime.toFixed(2)}ms)`
            );
          }

          clearanceTotalTime += clearanceElapsed;
          clearanceMaxTime = Math.max(clearanceMaxTime, clearanceElapsed);
          shiftTotalTime += shiftElapsed;
          shiftMaxTime = Math.max(shiftMaxTime, shiftElapsed);
          jobProcessingTotalTime += jobProcessingTime;
          jobProcessingMaxTime = Math.max(
            jobProcessingMaxTime,
            jobProcessingTime
          );

          if (jobProcessingTime > 150) {
            slowJobDetails.push({
              jobIndex: index + 1,
              project: job.projectId?.projectID || "Unknown",
              jobProcessing: jobProcessingTime.toFixed(2),
              clearance: clearanceElapsed.toFixed(2),
              shifts: shiftElapsed.toFixed(2),
            });
          }

          return {
            id: job._id,
            projectID: job.projectId?.projectID || job.projectID || "Unknown",
            projectName:
              job.projectId?.name || job.projectName || "Unknown Project",
            asbestosRemovalist: job.asbestosRemovalist || "Not assigned",
            status: job.status || "Active",
            jobType: jobType,
            hasAirMonitoring: hasAirMonitoringOverall,
            hasClearance: hasClearance,
            originalData: job,
          };
        })
      );

      const perJobProcessingTime = performance.now() - perJobProcessingStart;
      console.log(
        `[Asbestos Removal] All jobs processed in ${perJobProcessingTime.toFixed(
          2
        )}ms`
      );
      if (jobs.length > 0) {
        const clearanceAvg = clearanceTotalTime / jobs.length || 0;
        const shiftAvg = shiftTotalTime / jobs.length || 0;
        const jobProcessingAvg = jobProcessingTotalTime / jobs.length || 0;
        console.log("[Asbestos Removal] Per-job timing stats:", {
          clearanceAvg: `${clearanceAvg.toFixed(2)}ms`,
          clearanceMax: `${clearanceMaxTime.toFixed(2)}ms`,
          shiftsAvg: `${shiftAvg.toFixed(2)}ms`,
          shiftsMax: `${shiftMaxTime.toFixed(2)}ms`,
          jobProcessingAvg: `${jobProcessingAvg.toFixed(2)}ms`,
          jobProcessingMax: `${jobProcessingMaxTime.toFixed(2)}ms`,
          slowJobSamples: slowJobDetails.slice(0, 5),
          additionalSlowJobs:
            slowJobDetails.length > 5
              ? slowJobDetails.length - slowJobDetails.slice(0, 5).length
              : 0,
        });
      }

      // Sort by project ID (backend already filtered out completed jobs)
      const sortStart = performance.now();
      const sortedJobs = processedJobs.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
        return bNum - aNum; // Descending order (highest first)
      });
      const sortTime = performance.now() - sortStart;
      console.log(
        `[Asbestos Removal] Sorting completed in ${sortTime.toFixed(2)}ms`
      );

      const totalTime = performance.now() - startTime;
      console.log(
        `[Asbestos Removal] Total fetch time: ${totalTime.toFixed(2)}ms`
      );
      console.log("[Asbestos Removal] Breakdown:", {
        jobsFetch: `${jobsFetchTime.toFixed(2)}ms`,
        airMonitoringFetch: `${airMonitoringFetchTime.toFixed(2)}ms`,
        perJobProcessing: `${perJobProcessingTime.toFixed(2)}ms`,
        sorting: `${sortTime.toFixed(2)}ms`,
        total: `${totalTime.toFixed(2)}ms`,
      });

      setAsbestosRemovalJobs(sortedJobs);
    } catch (err) {
      const errorTime = performance.now() - startTime;
      console.error(
        `[Asbestos Removal] Error after ${errorTime.toFixed(2)}ms:`,
        err
      );
      setError(err.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
      const finalTime = performance.now() - startTime;
      console.log(
        `[Asbestos Removal] fetchAsbestosRemovalJobs completed in ${finalTime.toFixed(
          2
        )}ms`
      );
    }
  }, []);

  // Lazy load projects and removalists only when modal opens
  const fetchProjects = useCallback(async () => {
    try {
      const response = await projectService.getAll({
        limit: 1000,
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent, Quote sent",
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
    fetchAsbestosRemovalJobs();
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
    (jobType) => {
      switch (jobType) {
        case "Air Monitoring":
          return theme.palette.primary.main;
        case "Clearance":
          return theme.palette.secondary.main;
        case "Air Monitoring & Clearance":
          return theme.palette.info.main;
        case "None":
          return theme.palette.grey[500];
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
        await fetchAsbestosRemovalJobs();
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
      // Refresh the jobs list
      await fetchAsbestosRemovalJobs();
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
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                      Project ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "240px" }}>
                      Site Name (Project)
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "200px" }}>
                      Asbestos Removalist
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "140px" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold", minWidth: "200px" }}>
                      Job Type
                    </TableCell>
                    {hasPermission(currentUser, "asbestos.delete") && (
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
                      <TableCell>
                        <Chip
                          label={job.jobType}
                          size="small"
                          sx={{
                            backgroundColor: getJobTypeColor(job.jobType),
                            color: "white",
                          }}
                        />
                      </TableCell>
                      {hasPermission(currentUser, "asbestos.delete") && (
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
