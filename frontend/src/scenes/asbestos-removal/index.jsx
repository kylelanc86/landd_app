import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
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
    setLoading(true);
    setError(null);

    try {
      // Fetch all required data in parallel
      const [
        jobsResponse,
        clearancesResponse,
        airMonitoringJobsResponse,
        shiftsResponse,
      ] = await Promise.all([
        asbestosRemovalJobService.getAll(),
        asbestosClearanceService.getAll(),
        jobService.getAll(),
        shiftService.getAll(),
      ]);

      console.log(
        "Raw response from asbestosRemovalJobService.getAll():",
        jobsResponse
      );
      console.log(
        "Raw response from asbestosClearanceService.getAll():",
        clearancesResponse
      );
      console.log(
        "Raw response from jobService.getAll():",
        airMonitoringJobsResponse
      );
      console.log("Raw response from shiftService.getAll():", shiftsResponse);

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
        console.log("Unexpected jobs response structure:", jobsResponse);
        jobs = [];
      }

      // Handle different response structures for clearances
      let clearances = [];
      if (
        clearancesResponse &&
        clearancesResponse.clearances &&
        Array.isArray(clearancesResponse.clearances)
      ) {
        clearances = clearancesResponse.clearances;
      } else if (
        clearancesResponse &&
        clearancesResponse.data &&
        Array.isArray(clearancesResponse.data)
      ) {
        clearances = clearancesResponse.data;
      } else if (Array.isArray(clearancesResponse)) {
        clearances = clearancesResponse;
      } else {
        console.log(
          "Unexpected clearances response structure:",
          clearancesResponse
        );
        clearances = [];
      }

      // Handle different response structures for air monitoring jobs
      let airMonitoringJobs = [];
      if (
        airMonitoringJobsResponse &&
        airMonitoringJobsResponse.data &&
        Array.isArray(airMonitoringJobsResponse.data)
      ) {
        airMonitoringJobs = airMonitoringJobsResponse.data;
      } else if (Array.isArray(airMonitoringJobsResponse)) {
        airMonitoringJobs = airMonitoringJobsResponse;
      } else {
        console.log(
          "Unexpected air monitoring jobs response structure:",
          airMonitoringJobsResponse
        );
        airMonitoringJobs = [];
      }

      // Handle different response structures for shifts
      let shifts = [];
      if (Array.isArray(shiftsResponse)) {
        // Backend returns shifts directly as an array
        shifts = shiftsResponse;
      } else if (
        shiftsResponse &&
        shiftsResponse.data &&
        Array.isArray(shiftsResponse.data)
      ) {
        shifts = shiftsResponse.data;
      } else {
        console.log("Unexpected shifts response structure:", shiftsResponse);
        shifts = [];
      }

      console.log("Extracted jobs array:", jobs);
      console.log("Extracted clearances array:", clearances);
      console.log("Extracted air monitoring jobs array:", airMonitoringJobs);
      console.log("Extracted shifts array:", shifts);

      // Ensure jobs is an array before processing
      if (!Array.isArray(jobs)) {
        console.error("Jobs is not an array:", jobs);
        setAsbestosRemovalJobs([]);
        return;
      }

      // Process jobs to include project details
      const processedJobs = jobs.map((job) => {
        console.log("Processing job:", job);
        console.log("Job airMonitoring field:", job.airMonitoring);
        console.log("Job clearance field:", job.clearance);
        console.log("Job hasAirMonitoring field:", job.hasAirMonitoring);
        console.log("Job hasClearance field:", job.hasClearance);

        const projectId = job.projectId?._id || job.projectId;
        console.log("Job projectId:", projectId);

        // Check if there are any clearances for this project
        const projectClearances = clearances.filter((clearance) => {
          const clearanceProjectId =
            clearance.projectId?._id || clearance.projectId;
          return clearanceProjectId === projectId;
        });
        console.log("Project clearances for job:", projectClearances);

        // Check if there are any air monitoring jobs for this project
        const projectAirMonitoringJobs = airMonitoringJobs.filter((airJob) => {
          const airJobProjectId = airJob.projectId?._id || airJob.projectId;
          return airJobProjectId === projectId;
        });
        console.log(
          "Project air monitoring jobs for job:",
          projectAirMonitoringJobs
        );

        // Check if there are any shifts for this asbestos removal job
        console.log("All shifts:", shifts);
        console.log("Looking for shifts with job._id:", job._id);

        const jobShifts = shifts.filter((shift) => {
          // Handle both populated and unpopulated job references
          const shiftJobId = shift.job?._id || shift.job;
          const matches =
            shiftJobId === job._id && shift.jobModel === "AsbestosRemovalJob";

          console.log("Checking shift:", {
            shiftId: shift._id,
            shiftJob: shift.job,
            shiftJobId: shiftJobId,
            shiftJobModel: shift.jobModel,
            jobId: job._id,
            matches: matches,
          });

          return matches;
        });
        console.log("Shifts for this asbestos removal job:", jobShifts);

        // Determine job type based on actual data
        const hasClearance = projectClearances.length > 0;
        const hasAirMonitoring =
          projectAirMonitoringJobs.length > 0 || jobShifts.length > 0;

        console.log("Job type calculation:", {
          projectClearances: projectClearances.length,
          projectAirMonitoringJobs: projectAirMonitoringJobs.length,
          jobShifts: jobShifts.length,
          hasClearance,
          hasAirMonitoring,
        });

        let jobType = "None";
        if (hasAirMonitoring && hasClearance) {
          jobType = "Air Monitoring & Clearance";
        } else if (hasAirMonitoring) {
          jobType = "Air Monitoring";
        } else if (hasClearance) {
          jobType = "Clearance";
        }

        console.log(
          "Computed jobType:",
          jobType,
          "(hasClearance:",
          hasClearance,
          ", hasAirMonitoring:",
          hasAirMonitoring,
          ")"
        );

        return {
          id: job._id,
          projectID: job.projectId?.projectID || job.projectID || "Unknown",
          projectName:
            job.projectId?.name || job.projectName || "Unknown Project",
          asbestosRemovalist: job.asbestosRemovalist || "Not assigned",
          status: job.status || "Active",
          jobType: jobType,
          hasAirMonitoring: hasAirMonitoring,
          hasClearance: hasClearance,
          originalData: job,
        };
      });

      console.log("Processed jobs:", processedJobs);

      // Filter out completed jobs to show only active jobs
      const activeJobs = processedJobs.filter((job) => {
        const normalizedStatus = job.status?.toLowerCase().replace(/\s+/g, "_");
        return (
          normalizedStatus !== "completed" && normalizedStatus !== "complete"
        );
      });

      console.log("Active jobs (filtered):", activeJobs);

      // Sort by project ID
      const sortedJobs = activeJobs.sort((a, b) => {
        const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
        return bNum - aNum; // Descending order (highest first)
      });

      console.log("Final sorted active jobs:", sortedJobs);
      setAsbestosRemovalJobs(sortedJobs);
    } catch (err) {
      console.error("Error fetching asbestos removal jobs:", err);
      setError(err.message || "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchAsbestosRemovalJobs();
    fetchProjects();
    fetchAsbestosRemovalists();
  }, [fetchAsbestosRemovalJobs, fetchProjects, fetchAsbestosRemovalists]);

  const getStatusColor = (status) => {
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
  };

  const getJobTypeColor = (jobType) => {
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
  };

  const formatStatusLabel = (status) => {
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
  };

  const handleCreateAsbestosRemovalJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setSelectedRemovalist("");
    setModalError(null);
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
    <Box m="20px">
      <Typography variant="h3" component="h1" gutterBottom sx={{ mb: 4 }}>
        Asbestos Removal Jobs
      </Typography>

      {/* Action Button */}
      <Box display="flex" gap={2} mb={3}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateAsbestosRemovalJob}
          sx={{
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

      {/* Asbestos Removal Jobs Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Active Asbestos Removal Jobs
          </Typography>

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : asbestosRemovalJobs.length === 0 ? (
            <Typography variant="body1" color="text.secondary" sx={{ p: 3 }}>
              No active asbestos removal jobs
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.primary.dark }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Project ID
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Site Name (Project)
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Asbestos Removalist
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Status
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        maxWidth: "330px",
                      }}
                    >
                      Job Type
                    </TableCell>
                    {hasPermission(currentUser, "asbestos.delete") && (
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          width: "100px",
                        }}
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
                      <TableCell>{job.projectID}</TableCell>
                      <TableCell>{job.projectName}</TableCell>
                      <TableCell>{job.asbestosRemovalist}</TableCell>
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
                      <TableCell sx={{ maxWidth: "330px" }}>
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
                        <TableCell>
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
        </CardContent>
      </Card>

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
    </Box>
  );
};

export default AsbestosRemoval;
