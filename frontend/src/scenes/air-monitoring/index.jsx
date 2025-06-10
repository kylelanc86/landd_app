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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import DescriptionIcon from "@mui/icons-material/Description";
import { jobService, projectService, clientService } from "../../services/api";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import performanceMonitor from "../../utils/performanceMonitor";

const JOBS_KEY = "ldc_jobs";

const emptyForm = {
  projectId: "",
  projectName: "",
  client: "",
  asbestosRemovalist: "",
  status: "pending",
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

  useEffect(() => {
    let isMounted = true;
    let isFetching = false;

    const fetchData = async () => {
      // Prevent duplicate fetches
      if (isFetching || isDataFetched) return;

      isFetching = true;
      performanceMonitor.startPageLoad("Air Monitoring");
      setLoading(true);
      setError(null);

      try {
        performanceMonitor.startTimer("Fetch Jobs");
        const jobsResponse = await jobService.getAll();

        if (!isMounted) return;

        if (!jobsResponse.data) {
          throw new Error("No data received from server");
        }

        console.log("Raw jobs data:", jobsResponse.data);

        // Process jobs to include project details
        const processedJobs = jobsResponse.data.map((job) => ({
          id: job._id,
          _id: job._id,
          projectID: job.project?.projectID || "Unknown",
          projectName: job.project?.name || "Unknown Project",
          status: job.status,
          asbestosRemovalist: job.asbestosRemovalist,
          department: job.project?.department || "Unknown",
        }));

        console.log("Final processed jobs:", processedJobs);
        setJobs(processedJobs);
        setIsDataFetched(true);
        performanceMonitor.endTimer("Fetch Jobs");
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to fetch data");
      } finally {
        if (isMounted) {
          setLoading(false);
          performanceMonitor.endPageLoad("Air Monitoring");
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

    setLoading(true);
    setDialogError(null);
    try {
      console.log("Creating new job with form data:", form);
      console.log("Selected project:", selectedProject);

      const newJob = {
        name: selectedProject.name,
        project: selectedProject._id,
        status: "pending",
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

      // Process the new job to include project details
      const processedJob = {
        id: response.data._id,
        _id: response.data._id,
        projectID: selectedProject.projectID,
        projectName: selectedProject.name,
        status: "pending",
        asbestosRemovalist: response.data.asbestosRemovalist,
      };

      // Add the new job to the list
      setJobs((prevJobs) => [processedJob, ...prevJobs]);
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
      valueGetter: projectIDValueGetter,
    },
    {
      field: "projectName",
      headerName: "Project",
      flex: 1,
      valueGetter: projectNameValueGetter,
    },
    {
      field: "asbestosRemovalist",
      headerName: "Asbestos Removalist",
      flex: 1,
      valueGetter: (params) => {
        if (typeof params === "string") return params;
        return params?.row?.asbestosRemovalist || "Not assigned";
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <Box
          onClick={(e) => handleStatusClick(e, params.row)}
          sx={{
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "4px",
            backgroundColor:
              params.row.status === "completed"
                ? theme.palette.success.main
                : params.row.status === "in_progress"
                ? theme.palette.info.main
                : params.row.status === "pending"
                ? theme.palette.warning.main
                : theme.palette.grey[500],
            color: theme.palette.common.white,
            "&:hover": {
              opacity: 0.8,
            },
          }}
        >
          {params.row.status.charAt(0).toUpperCase() +
            params.row.status.slice(1).replace("_", " ")}
        </Box>
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => {
        if (!params?.row) return null;

        return (
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton
              onClick={() => handleEditJob(params.row)}
              sx={{ color: colors.grey[100] }}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              onClick={(e) => handleDeleteClick(e, params.row)}
              sx={{ color: colors.grey[100] }}
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
    setDialogError(null);
    setSelectedProject(null);
    setForm(emptyForm);
  };

  if (loading) return <Typography>Loading jobs...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header
        title="Air Monitoring"
        subtitle="Manage air monitoring jobs and samples"
      />

      {/* Add New Job Button and Show Completed Toggle */}
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
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Autocomplete
                options={projects}
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
                      client: newValue.client?.name || "Not specified",
                    });
                  }
                }}
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
                        Client: {option.client?.name || "Not specified"}
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

            <TextField
              fullWidth
              label="Asbestos Removalist"
              name="asbestosRemovalist"
              value={form.asbestosRemovalist}
              onChange={(e) => {
                handleChange(e);
                setError(null); // Clear error when input changes
              }}
              required
              sx={{ mb: 2 }}
            />
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
        <MenuItem onClick={() => handleStatusChange("pending")}>
          Pending
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange("in_progress")}>
          In Progress
        </MenuItem>
        <MenuItem onClick={() => handleStatusChange("completed")}>
          Completed
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AirMonitoring;
