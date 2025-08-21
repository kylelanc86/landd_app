import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Menu,
  Switch,
  Breadcrumbs,
  Link,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DescriptionIcon from "@mui/icons-material/Description";

import {
  jobService,
  projectService,
  clientService,
  shiftService,
} from "../../services/api";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";

const JOBS_KEY = "ldc_jobs";

const ASBESTOS_REMOVALISTS = [
  "AGH",
  "Aztech Services",
  "Capstone",
  "Crown Asbestos Removals",
  "Empire Contracting",
  "Glade Group",
  "IAR",
  "Jesco",
  "Ozbestos",
  "Spec Services",
];

const emptyForm = {
  projectId: "",
  projectName: "",
  client: "",
  asbestosRemovalist: "",
  status: "in_progress",
};

const AirMonitoring = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [statusMenu, setStatusMenu] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [isDataFetched, setIsDataFetched] = useState(false);
  const [dialogSuccess, setDialogSuccess] = useState(null);
  const [showExistingJobsDialog, setShowExistingJobsDialog] = useState(false);
  const [existingJobsInfo, setExistingJobsInfo] = useState([]);
  const [confirmingJobCreation, setConfirmingJobCreation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const fetchData = async () => {
      // Prevent duplicate fetches
      if (isFetching || isDataFetched) return;

      isFetching = true;
      setLoading(true);
      setError(null);

      try {
        const jobsResponse = await jobService.getAll();

        if (!isMounted) return;

        if (!jobsResponse.data) {
          throw new Error("No data received from server");
        }

        console.log("Raw jobs data:", jobsResponse.data);

        // Process jobs to include project details and shift information
        const processedJobs = await Promise.all(
          jobsResponse.data.map(async (job) => {
            // Fetch shifts for this job
            let shifts = [];
            let shiftStatus = "No Shifts";
            try {
              const shiftsResponse = await shiftService.getByJob(job._id);
              shifts = shiftsResponse.data || [];

              if (shifts.length > 0) {
                // Determine overall shift status
                const allShiftsCompleted = shifts.every(
                  (shift) =>
                    shift.status === "shift_complete" || shift.reportApprovedBy
                );
                const hasAnalysisComplete = shifts.some(
                  (shift) => shift.status === "analysis_complete"
                );
                const hasSamplingComplete = shifts.some(
                  (shift) =>
                    shift.status === "sampling_complete" ||
                    shift.status === "samples_submitted_to_lab"
                );

                // Debug logging for status determination
                console.log(`Job ${job._id} status determination:`, {
                  shiftCount: shifts.length,
                  allShiftsCompleted,
                  hasAnalysisComplete,
                  hasSamplingComplete,
                  shifts: shifts.map((s) => ({
                    id: s._id,
                    status: s.status,
                    reportApprovedBy: s.reportApprovedBy,
                  })),
                });

                if (allShiftsCompleted) {
                  shiftStatus = "Reports Complete";
                } else if (hasAnalysisComplete) {
                  shiftStatus = "Analysis Complete";
                } else if (hasSamplingComplete) {
                  shiftStatus = "Sampling Complete";
                } else {
                  shiftStatus = "Sampling in Progress";
                }
              }
            } catch (error) {
              console.error(`Error fetching shifts for job ${job._id}:`, error);
            }

            return {
              id: job._id,
              _id: job._id,
              projectID: job.projectId?.projectID || "Unknown",
              projectName: job.projectId?.name || "Unknown Project",
              status: job.status,
              asbestosRemovalist: job.asbestosRemovalist,
              department: job.projectId?.department || "Unknown",
              shiftStatus,
              shiftCount: shifts.length,
            };
          })
        );

        console.log("Final processed jobs:", processedJobs);
        setJobs(processedJobs);
        setIsDataFetched(true);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to fetch data");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
        isFetching = false;
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isDataFetched]);

  const fetchProjects = useCallback(async () => {
    try {
      // Fetch all active projects without pagination limits
      const response = await projectService.getAll({
        limit: 1000, // Set a high limit to get all projects
        status:
          "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent, Quote sent", // Include all active statuses
      });
      // Ensure we always set an array, even if the response structure is different
      if (response && response.data) {
        // Handle both array and paginated response structures
        const projectsData = Array.isArray(response.data)
          ? response.data
          : response.data.data || [];

        // Debug: Log the first few projects to see their structure
        console.log("Projects data structure:", projectsData.slice(0, 3));
        if (projectsData.length > 0) {
          console.log("First project client field:", projectsData[0].client);
          console.log("First project full structure:", projectsData[0]);
        }

        // Sort projects by projectID in descending order
        const sortedProjects = projectsData.sort((a, b) => {
          // Extract numeric part from projectID for proper sorting
          const aNum = parseInt(a.projectID?.replace(/\D/g, "")) || 0;
          const bNum = parseInt(b.projectID?.replace(/\D/g, "")) || 0;
          return bNum - aNum; // Descending order (highest first)
        });

        setProjects(sortedProjects);
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]); // Ensure we always have an array
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Memoize the value getters to prevent unnecessary recalculations
  const projectIDValueGetter = useCallback((params) => {
    return params.row.projectID;
  }, []);

  const projectNameValueGetter = useCallback((params) => {
    return params.row.projectName;
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    console.log("Form submitted");
    if (!selectedProject) {
      console.log("No project selected");
      setDialogError("Please select a project");
      return;
    }

    // Always attempt to create the job - let the backend handle warnings
    await createJob();
  };

  const createJob = async () => {
    setLoading(true);
    setDialogError(null);
    setDialogSuccess(null);

    try {
      console.log("Creating new job with form data:", form);
      console.log("Selected project:", selectedProject);

      const newJob = {
        name: selectedProject.name,
        projectId: selectedProject._id,
        status: "in_progress",
        startDate: new Date(),
        asbestosRemovalist: form.asbestosRemovalist,
        description: `Air monitoring job for ${selectedProject.name}`,
        location: selectedProject.address || "Not specified",
      };

      console.log("Sending job data to API:", newJob);

      const response = await jobService.create(newJob);
      console.log("API response:", response);

      if (!response.data) {
        throw new Error("No data received from server");
      }

      // Handle the new response format that includes existing jobs info
      const responseData = response.data;
      const newJobData = responseData.job || responseData; // Handle both old and new formats
      const existingJobs = responseData.existingActiveJobs || [];
      const warning = responseData.warning;

      // If there are existing jobs and this is a new response format, show confirmation
      if (existingJobs.length > 0 && responseData.job) {
        setExistingJobsInfo(existingJobs);
        setShowExistingJobsDialog(true);
        setLoading(false);
        return;
      }

      // Process the new job to include project details
      const processedJob = {
        id: newJobData._id,
        _id: newJobData._id,
        projectID: selectedProject.projectID,
        projectName: selectedProject.name,
        status: "in_progress",
        asbestosRemovalist: newJobData.asbestosRemovalist,
        shiftStatus: "No Shifts",
        shiftCount: 0,
      };

      // Add the new job to the list
      setJobs((prevJobs) => [processedJob, ...prevJobs]);

      // Refresh the projects list to get updated status
      await fetchProjects();

      // Show success message with warning if there are existing jobs
      if (warning) {
        setDialogError(null);
        setDialogSuccess(`${warning}. New job created successfully.`);
        // Clear success message after 5 seconds
        setTimeout(() => setDialogSuccess(null), 5000);
      }

      setOpenDialog(false);
      setSelectedProject(null);
      setForm(emptyForm);
      setLoading(false);
    } catch (error) {
      console.error("Error creating job:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create job";
      console.log("Setting error message:", errorMessage);
      setDialogError(errorMessage);
      setLoading(false);
    }
  };

  const handleEditJob = (job) => {
    setEditId(job.id);
    setEditForm({ ...job });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedJobs = jobs.map((j) =>
      j.id === editId ? { ...editForm, id: editId } : j
    );
    setJobs(updatedJobs);
    localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewShifts = (jobId) => {
    console.log("Navigating to shifts for job:", jobId);
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  const handleDeleteClick = (e, job) => {
    e.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (jobToDelete) {
      try {
        console.log("Deleting job:", jobToDelete);
        await jobService.delete(jobToDelete._id);
        setJobs(jobs.filter((job) => job._id !== jobToDelete._id));
        setDeleteDialogOpen(false);
        setJobToDelete(null);
      } catch (error) {
        console.error("Error deleting job:", error);
        setError("Failed to delete job. Please try again.");
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  // Filtering and sorting
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    const project = projects.find((p) => p._id === j.projectId);
    const matchesSearch =
      (j.projectId?.toString() || "").toLowerCase().includes(q) ||
      (project?.name || "").toLowerCase().includes(q) ||
      (j.status || "").toLowerCase().includes(q) ||
      (j.startDate || "").toLowerCase().includes(q);

    // If showCompleted is false, filter out completed jobs
    if (!showCompleted && j.status === "completed") {
      return false;
    }

    return matchesSearch;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (!a[sortField] && !b[sortField]) return 0;
    if (!a[sortField]) return sortAsc ? 1 : -1;
    if (!b[sortField]) return sortAsc ? -1 : 1;

    if (a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Analysis":
        return theme.palette.warning.light;
      case "Complete":
        return theme.palette.success.light;
      case "Ready for Analysis":
        return theme.palette.info.light;
      default:
        return theme.palette.grey[300];
    }
  };

  const handleOpenJob = (jobId) => {
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  const handleCloseReport = (jobId) => {
    // Implement close report functionality
    console.log("Close report for job:", jobId);
  };

  const handlePrintReport = (jobId) => {
    // Implement print report functionality
    console.log("Print report for job:", jobId);
  };

  const handleStatusClick = (event, job) => {
    setStatusMenu(event.currentTarget);
    setSelectedJob(job);
  };

  const handleStatusClose = () => {
    setStatusMenu(null);
    setSelectedJob(null);
  };

  const handleStatusChange = async (newStatus) => {
    try {
      if (selectedJob) {
        console.log("Updating job status:", {
          jobId: selectedJob._id,
          newStatus,
        });
        const response = await jobService.update(selectedJob._id, {
          status: newStatus,
        });
        console.log("Update response:", response);

        // Update local state
        setJobs(
          jobs.map((job) =>
            job._id === selectedJob._id ? { ...job, status: newStatus } : job
          )
        );
      }
    } catch (err) {
      console.error("Error updating job status:", err);
      setError(err.message || "Failed to update job status");
    } finally {
      handleStatusClose();
    }
  };

  const columns = [
    {
      field: "projectID",
      headerName: "Project ID",
      flex: 1,
      minWidth: 100,
      maxWidth: 120,
      valueGetter: projectIDValueGetter,
    },
    {
      field: "projectName",
      headerName: "Project",
      flex: 1,
      minWidth: 230,
      valueGetter: projectNameValueGetter,
    },
    {
      field: "asbestosRemovalist",
      headerName: "Asbestos Removalist",
      flex: 1,
      minWidth: 150,
      maxWidth: 300,
      valueGetter: (params) => {
        if (typeof params === "string") return params;
        return params?.row?.asbestosRemovalist || "Not assigned";
      },
    },

    {
      field: "shiftStatus",
      headerName: "Shift Progress",
      flex: 1,
      minWidth: 150,
      maxWidth: 230,
      renderCell: (params) => {
        const getShiftStatusColor = (status) => {
          switch (status) {
            case "Reports Complete":
              return theme.palette.success.main;
            case "Analysis Complete":
              return theme.palette.warning.main;
            case "Sampling Complete":
              return theme.palette.info.main;
            case "Sampling in Progress":
              return theme.palette.primary.main;
            case "No Shifts":
              return theme.palette.grey[500];
            default:
              return theme.palette.grey[500];
          }
        };

        return (
          <Box
            sx={{
              padding: "4px 8px",
              borderRadius: "4px",
              backgroundColor: getShiftStatusColor(params.row.shiftStatus),
              color: theme.palette.common.white,
              fontSize: "0.8rem",
            }}
          >
            {params.row.shiftStatus}
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      minWidth: 200,
      maxWidth: 200,
      renderCell: (params) => {
        if (!params?.row) return null;

        return (
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              onClick={() => handleEditJob(params.row)}
              sx={{ color: theme.palette.success.main }}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={(e) => handleDeleteClick(e, params.row)}
              sx={{ color: theme.palette.success.main }}
            >
              <DeleteIcon />
            </IconButton>
            <Button
              variant="contained"
              size="small"
              onClick={() => handleViewShifts(params.row._id)}
              sx={{
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                fontSize: "0.75rem",
                padding: "4px 8px",
                minWidth: "80px",
                "&:hover": {
                  backgroundColor: colors.primary[800],
                },
              }}
            >
              Shifts
            </Button>
          </Box>
        );
      },
    },
  ];

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProject(null);
    setForm(emptyForm);
    setDialogError(null);
    setDialogSuccess(null);
  };

  const handleCloseExistingJobsDialog = () => {
    setShowExistingJobsDialog(false);
    setExistingJobsInfo([]);
  };

  const handleConfirmCreateJob = async () => {
    setShowExistingJobsDialog(false);
    setExistingJobsInfo([]);
    setConfirmingJobCreation(true);

    // Now create the job with the existing data
    const newJob = {
      name: selectedProject.name,
      projectId: selectedProject._id,
      status: "in_progress",
      startDate: new Date(),
      asbestosRemovalist: form.asbestosRemovalist,
      description: `Air monitoring job for ${selectedProject.name}`,
      location: selectedProject.address || "Not specified",
      forceCreate: true, // Signal to backend that user confirmed creation despite existing jobs
    };

    try {
      const response = await jobService.create(newJob);

      if (!response.data) {
        throw new Error("No data received from server");
      }

      const responseData = response.data;
      const newJobData = responseData.job || responseData;

      // Process the new job to include project details
      const processedJob = {
        id: newJobData._id,
        _id: newJobData._id,
        projectID: selectedProject.projectID,
        projectName: selectedProject.name,
        status: "in_progress",
        asbestosRemovalist: newJobData.asbestosRemovalist,
        shiftStatus: "No Shifts",
        shiftCount: 0,
      };

      // Add the new job to the list
      setJobs((prevJobs) => [processedJob, ...prevJobs]);

      // Refresh the projects list to get updated status
      await fetchProjects();

      // Show success message
      setDialogSuccess("New job created successfully!");
      setTimeout(() => setDialogSuccess(null), 5000);

      setOpenDialog(false);
      setSelectedProject(null);
      setForm(emptyForm);
    } catch (error) {
      console.error("Error creating job after confirmation:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create job";
      setDialogError(errorMessage);
    } finally {
      setConfirmingJobCreation(false);
    }
  };

  const handleBackToHome = () => {
    navigate("/asbestos-removal");
  };

  if (loading) return <Typography>Loading jobs...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Active Air Monitoring Jobs
      </Typography>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToHome}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal
        </Link>
        <Typography color="text.primary">Air Monitoring</Typography>
      </Breadcrumbs>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <FormControlLabel
          control={
            <Switch
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              color="primary"
            />
          }
          label="Show Completed Jobs"
          sx={{
            color: theme.palette.text.primary,
            "& .MuiFormControlLabel-label": {
              fontSize: "0.9rem",
            },
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            backgroundColor: colors.primary[700],
            color: colors.grey[100],
            fontSize: "14px",
            fontWeight: "bold",
            padding: "10px 20px",
            "&:hover": {
              backgroundColor: colors.primary[800],
            },
          }}
        >
          Add New Job
        </Button>
      </Box>

      {/* Jobs Table */}
      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": { border: "none" },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
            display: "flex",
            alignItems: "center",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.dark,
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.dark,
          },
          "& .MuiCheckbox-root": {
            color: `${theme.palette.secondary.main} !important`,
          },
        }}
      >
        {loading ? (
          <Typography>Loading jobs...</Typography>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <DataGrid
            rows={filteredJobs}
            columns={columns}
            getRowId={(row) => row.id || row._id}
            pageSize={10}
            rowsPerPageOptions={[10]}
            autoHeight
            disableSelectionOnClick
            components={{ Toolbar: GridToolbar }}
            initialState={{
              columns: {
                columnVisibilityModel: {
                  id: false,
                  _id: false,
                },
              },
            }}
          />
        )}
      </Box>

      {/* Add New Job Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Air Monitoring Job</Typography>
            <IconButton onClick={handleCloseDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleAddJob}>
          <DialogContent>
            {dialogError && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{dialogError}</Typography>
              </Box>
            )}
            {dialogSuccess && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.success.light,
                  color: theme.palette.success.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{dialogSuccess}</Typography>
              </Box>
            )}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Autocomplete
                options={Array.isArray(projects) ? projects : []}
                getOptionLabel={(option) =>
                  `${option.projectID} - ${option.name}`
                }
                value={selectedProject}
                onChange={(event, newValue) => {
                  setSelectedProject(newValue);
                  setError(null); // Clear error when project selection changes
                  if (newValue) {
                    setForm({
                      ...form,
                      projectId: newValue._id,
                      projectName: newValue.name,
                      client:
                        typeof newValue.client === "string"
                          ? newValue.client
                          : newValue.client?.name || "Not specified",
                    });
                  }
                }}
                isOptionEqualToValue={(option, value) =>
                  option._id === value._id
                }
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

            {selectedProject && (
              <>
                <TextField
                  fullWidth
                  label="Project ID"
                  value={selectedProject.projectID}
                  disabled
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Project Name"
                  value={form.projectName}
                  disabled
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Client"
                  value={form.client}
                  disabled
                  sx={{ mb: 2 }}
                />
              </>
            )}

            <FormControl fullWidth required sx={{ mb: 2 }}>
              <InputLabel>Asbestos Removalist</InputLabel>
              <Select
                name="asbestosRemovalist"
                value={form.asbestosRemovalist}
                onChange={(e) => {
                  handleChange(e);
                  setError(null); // Clear error when input changes
                }}
                label="Asbestos Removalist"
              >
                {ASBESTOS_REMOVALISTS.map((removalist) => (
                  <MenuItem key={removalist} value={removalist}>
                    {removalist}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!selectedProject || !form.asbestosRemovalist || loading}
              sx={{
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                "&:hover": {
                  backgroundColor: colors.primary[800],
                },
              }}
            >
              {loading ? "Adding..." : "Add Job"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this job? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={statusMenu}
        open={Boolean(statusMenu)}
        onClose={handleStatusClose}
      >
        <MenuItem onClick={() => handleStatusChange("in_progress")}>
          In Progress
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange("completed")}>
          Completed
        </MenuItem>
      </Menu>

      {/* Existing Jobs Confirmation Dialog */}
      <Dialog
        open={showExistingJobsDialog}
        onClose={handleCloseExistingJobsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Project Already Has {existingJobsInfo.length} Active Job
          {existingJobsInfo.length === 1 ? "" : "s"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This project already has {existingJobsInfo.length} active air
            monitoring job{existingJobsInfo.length === 1 ? "" : "s"}. Are you
            sure you want to create another one?
          </Typography>

          <Typography variant="h6" sx={{ mb: 1, mt: 2 }}>
            Existing Active Jobs:
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>Asbestos Removalist</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {existingJobsInfo.map((job) => (
                  <TableRow key={job.id || job._id}>
                    <TableCell>
                      <Chip
                        label={job.status}
                        color={
                          job.status === "in_progress" ? "warning" : "default"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {job.createdAt
                        ? new Date(job.createdAt).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>{job.asbestosRemovalist || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseExistingJobsDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmCreateJob}
            variant="contained"
            color="warning"
            disabled={confirmingJobCreation}
          >
            {confirmingJobCreation ? "Creating..." : "Create Job Anyway"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirMonitoring;
