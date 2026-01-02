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
  Breadcrumbs,
  Link,
  InputAdornment,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { tokens } from "../../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { projectService, asbestosAssessmentService } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../config/permissions";
import { getTodaySydney } from "../../../utils/dateUtils";

const CACHE_KEY = "asbestosAssessmentJobsCache";
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
    console.warn("[Asbestos Assessment] Failed to parse jobs cache", error);
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
    console.warn("[Asbestos Assessment] Failed to write jobs cache", error);
  }
};

const clearJobsCache = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[Asbestos Assessment] Failed to clear jobs cache", error);
  }
};

const AsbestosAssessment = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [assessmentDate, setAssessmentDate] = useState("");
  const [assessmentDateError, setAssessmentDateError] = useState(false);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchJobs = useCallback(
    async ({ force = false, silent = false } = {}) => {
      const startTime = performance.now();
      console.log("[Asbestos Assessment] Starting fetchJobs");

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        if (!force) {
          const cached = loadJobsCache();
          if (cached) {
            console.log(
              "[Asbestos Assessment] Serving jobs from cache"
            );
            setJobs(cached.jobs);
            if (!silent) {
              setLoading(false);
            }
            return;
          }
        }

        const jobsResponse = await asbestosAssessmentService.getAsbestosAssessments();
        const jobs = jobsResponse.data || jobsResponse || [];

        if (!Array.isArray(jobs)) {
          console.error("Jobs is not an array:", jobs);
          setJobs([]);
          return;
        }

        console.log(
          `[Asbestos Assessment] Found ${jobs.length} active jobs`
        );

        const processedJobs = jobs.map((job) => {
          const projectRef = job.projectId || {};
          const projectIdentifier =
            projectRef?.projectID || job.projectID || "Unknown";
          const projectName =
            projectRef?.name || job.projectName || "Unknown Project";
          const clientName =
            typeof projectRef?.client === "string"
              ? projectRef.client
              : projectRef?.client?.name || null;

          return {
            id: job._id,
            projectID: projectIdentifier,
            projectName: projectName,
            clientName: clientName,
            surveyDate: job.assessmentDate || job.surveyDate || null,
            status: job.status || "in-progress",
            originalData: job,
          };
        });

        const sortedJobs = processedJobs.sort((a, b) => {
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "") || 0);
          return bNum - aNum;
        });

        setJobs(sortedJobs);
        saveJobsCache(sortedJobs);
      } catch (err) {
        const errorTime = performance.now() - startTime;
        console.error(
          `[Asbestos Assessment] Error after ${errorTime.toFixed(2)}ms:`,
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
          `[Asbestos Assessment] fetchJobs completed in ${finalTime.toFixed(
            2
          )}ms`
        );
      }
    },
    []
  );

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

  useEffect(() => {
    const cached = loadJobsCache();

    if (cached) {
      console.log("[Asbestos Assessment] Using cached jobs");
      setJobs(cached.jobs);
      setLoading(false);
      fetchJobs({ force: true, silent: true });
    } else {
      fetchJobs();
    }
  }, [fetchJobs]);

  const getStatusColor = useCallback(
    (status) => {
      const normalizedStatus = status?.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

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
        case "samples_with_lab":
        case "sample_analysis_complete":
        case "report_ready_for_review":
          return theme.palette.info.main;
        default:
          return theme.palette.grey[500];
      }
    },
    [theme]
  );

  const formatStatusLabel = useCallback((status) => {
    if (!status) return "Unknown";

    const statusMap = {
      in_progress: "In Progress",
      "in-progress": "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
      complete: "Complete",
      active: "Active",
      "samples-with-lab": "Samples With Lab",
      "sample-analysis-complete": "Sample Analysis Complete",
      "report-ready-for-review": "Report Ready For Review",
    };

    return (
      statusMap[status] ||
      status
        .split(/[_-]/)
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    );
  }, []);

  const handleCreateJob = () => {
    setModalOpen(true);
    setSelectedProject(null);
    setAssessmentDate(getTodaySydney());
    setAssessmentDateError(false);
    setModalError(null);
    if (projects.length === 0) {
      fetchProjects();
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedProject(null);
    setAssessmentDate("");
    setAssessmentDateError(false);
    setModalError(null);
  };

  const handleSubmitModal = async () => {
    if (!selectedProject) {
      setModalError("Please select a project");
      return;
    }

    if (!assessmentDate || assessmentDate.trim() === "") {
      setAssessmentDateError(true);
      setModalError("Please enter an assessment date");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    setAssessmentDateError(false);

    try {
      const newJobData = {
        projectId: selectedProject._id,
        assessmentDate: assessmentDate,
      };

      const response = await asbestosAssessmentService.createAsbestosAssessment(newJobData);

      if (response.data) {
        clearJobsCache();
        await fetchJobs({ force: true });
        handleCloseModal();
      } else {
        // If response structure is different, still refresh
        clearJobsCache();
        await fetchJobs({ force: true });
        handleCloseModal();
      }
    } catch (err) {
      console.error("Error creating job:", err);
      setModalError(
        err.response?.data?.message || err.message || "Failed to create job"
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleRowClick = (job) => {
    navigate(`/surveys/asbestos-assessment/${job.id}/items`);
  };

  const handleDeleteClick = (event, job) => {
    event.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;

    setDeleteLoading(true);
    try {
      await asbestosAssessmentService.deleteAsbestosAssessment(jobToDelete.id);
      clearJobsCache();
      setJobs((prev) => prev.filter((job) => job.id !== jobToDelete.id));
      await fetchJobs({ force: true, silent: true });
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (err) {
      console.error("Error deleting job:", err);
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

  const handleBackToSurveys = () => {
    navigate("/surveys");
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToSurveys}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Surveys Home
          </Link>
          <Typography color="text.primary">Asbestos Assessment</Typography>
        </Breadcrumbs>

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
            Asbestos Assessment
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateJob}
            sx={{
              minWidth: "220px",
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            New Assessment
          </Button>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", width: "115px" }}>
                    Project ID
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "230px" }}>
                    Project Name
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "135px" }}>
                    Survey Date
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: "bold", minWidth: "120px" }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      Loading assessments...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Alert severity="error">{error}</Alert>
                    </TableCell>
                  </TableRow>
                ) : jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No active assessments found
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => handleRowClick(job)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ width: "115px" }}>
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
                          {job.clientName && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              Client: {job.clientName}
                            </Typography>
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: "135px" }}>
                        <Typography variant="body2">
                          {job.surveyDate
                            ? new Date(job.surveyDate).toLocaleDateString("en-GB")
                            : "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ width: "150px" }}>
                        <Chip
                          label={formatStatusLabel(job.status)}
                          size="small"
                          sx={{
                            backgroundColor: getStatusColor(job.status),
                            color: "white",
                          }}
                        />
                      </TableCell>
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        sx={{ minWidth: "120px" }}
                      >
                        {hasPermission(currentUser, "asbestos.delete") && (
                          <Tooltip title="Delete Assessment">
                            <IconButton
                              onClick={(event) => handleDeleteClick(event, job)}
                              color="error"
                              size="small"
                              title="Delete Assessment"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>

      {/* Create Assessment Modal */}
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
            <Typography variant="h6">New Asbestos Assessment</Typography>
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

          <TextField
            fullWidth
            label="Assessment Date"
            type="date"
            value={assessmentDate}
            onChange={(e) => {
              setAssessmentDate(e.target.value);
              if (assessmentDateError) {
                setAssessmentDateError(false);
              }
              setModalError(null);
            }}
            InputLabelProps={{
              shrink: true,
            }}
            error={assessmentDateError}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    size="small"
                    onClick={() => setAssessmentDate(getTodaySydney())}
                    sx={{ textTransform: "none", minWidth: "auto" }}
                  >
                    Today
                  </Button>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          {assessmentDateError && (
            <Typography variant="body2" sx={{ color: "error.main", mb: 2 }}>
              Please enter an assessment date.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSubmitModal}
            variant="contained"
            disabled={!selectedProject || !assessmentDate || modalLoading}
            sx={{
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            {modalLoading ? "Creating..." : "Create Assessment"}
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
            <Typography variant="h6">Delete Asbestos Assessment</Typography>
            <IconButton onClick={handleDeleteCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete this asbestos assessment?
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
            {deleteLoading ? "Deleting..." : "Delete Assessment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AsbestosAssessment;

