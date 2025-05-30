import React, { useState, useEffect, useRef } from "react";
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
import {
  jobService,
  projectService,
  clientService,
  shiftService,
} from "../../services/api";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import TruncatedCell from "../../components/TruncatedCell";
import { StatusChip } from "../../components/JobStatus";

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
  const [jobShifts, setJobShifts] = useState({});
  const isFetchingRef = useRef(false);
  const fetchedJobIdsRef = useRef(new Set());

  useEffect(() => {
    const fetchData = async () => {
      if (isFetchingRef.current) {
        console.log("Fetch already in progress, skipping...");
        return;
      }

      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        // First fetch jobs and projects
        const [jobsResponse, projectsResponse] = await Promise.all([
          jobService.getAll(),
          projectService.getAll(),
        ]);

        if (!jobsResponse.data || !projectsResponse.data) {
          throw new Error("No data received from server");
        }

        // Process jobs to include project details
        const processedJobs = jobsResponse.data.map((job) => {
          const projectData = job.project;
          return {
            id: job._id,
            _id: job._id,
            projectID: projectData?.projectID || "Unknown",
            projectName: projectData?.name || "Unknown Project",
            status: job.status,
            asbestosRemovalist: job.asbestosRemovalist,
          };
        });

        setJobs(processedJobs);
        setProjects(projectsResponse.data);

        // Get jobs that haven't been fetched yet
        const jobsToFetch = processedJobs.filter(
          (job) => !fetchedJobIdsRef.current.has(job._id)
        );

        if (jobsToFetch.length > 0) {
          console.log(
            `Fetching shifts for ${jobsToFetch.length} jobs in a single batch...`
          );

          try {
            const shiftsResponse = await shiftService.getByJobs(
              jobsToFetch.map((job) => job._id)
            );
            const shiftsData = shiftsResponse.data || {};

            // Process the shifts data and update statuses for authorized reports
            const processedShifts = {};
            for (const [jobId, shifts] of Object.entries(shiftsData)) {
              processedShifts[jobId] = await Promise.all(
                shifts.map(async (shift) => {
                  // If shift has an authorized report but status isn't shift_complete, update it
                  if (
                    shift.reportApprovedBy &&
                    shift.status !== "shift_complete"
                  ) {
                    console.log(
                      `Updating shift ${shift._id} status to shift_complete`
                    );
                    try {
                      const updatedShift = await shiftService.update(
                        shift._id,
                        {
                          ...shift,
                          status: "shift_complete",
                        }
                      );
                      return {
                        ...updatedShift.data,
                        status: "shift_complete",
                      };
                    } catch (err) {
                      console.error(`Error updating shift ${shift._id}:`, err);
                      return shift;
                    }
                  }
                  return shift;
                })
              );
              fetchedJobIdsRef.current.add(jobId);
            }

            setJobShifts((prev) => ({ ...prev, ...processedShifts }));
            console.log("Successfully fetched and processed all shifts");
          } catch (err) {
            console.error("Error fetching shifts in batch:", err);
            // Fallback to individual requests if batch fails
            console.log("Falling back to individual requests...");

            const shiftsPromises = jobsToFetch.map((job) =>
              shiftService
                .getByJob(job._id)
                .then(async (response) => {
                  console.log(`Successfully fetched shifts for job ${job._id}`);
                  fetchedJobIdsRef.current.add(job._id);

                  // Process shifts and update statuses for authorized reports
                  const processedShifts = await Promise.all(
                    (response.data || []).map(async (shift) => {
                      if (
                        shift.reportApprovedBy &&
                        shift.status !== "shift_complete"
                      ) {
                        console.log(
                          `Updating shift ${shift._id} status to shift_complete`
                        );
                        try {
                          const updatedShift = await shiftService.update(
                            shift._id,
                            {
                              ...shift,
                              status: "shift_complete",
                            }
                          );
                          return {
                            ...updatedShift.data,
                            status: "shift_complete",
                          };
                        } catch (err) {
                          console.error(
                            `Error updating shift ${shift._id}:`,
                            err
                          );
                          return shift;
                        }
                      }
                      return shift;
                    })
                  );

                  return { jobId: job._id, shifts: processedShifts };
                })
                .catch((err) => {
                  console.error(
                    `Error fetching shifts for job ${job._id}:`,
                    err
                  );
                  return { jobId: job._id, shifts: [] };
                })
            );

            const shiftsResults = await Promise.all(shiftsPromises);
            const newShiftsData = shiftsResults.reduce(
              (acc, { jobId, shifts }) => {
                acc[jobId] = shifts;
                return acc;
              },
              {}
            );

            setJobShifts((prev) => ({ ...prev, ...newShiftsData }));
          }
        } else {
          console.log("No new jobs to fetch shifts for");
        }
      } catch (err) {
        console.error("Error in fetchData:", err);
        setError(err.message || "Failed to fetch data");
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchData();

    return () => {
      isFetchingRef.current = false;
    };
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddJob = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
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
        status: response.data.status,
        asbestosRemovalist: response.data.asbestosRemovalist,
      };

      // Add the new job to the list
      setJobs((prevJobs) => [processedJob, ...prevJobs]);
      setOpenDialog(false);
      setSelectedProject(null);
      setForm(emptyForm);
    } catch (error) {
      console.error("Error creating job:", error);
      setError(
        error.response?.data?.message || error.message || "Failed to create job"
      );
    } finally {
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

  const canCompleteJob = (jobId) => {
    const shifts = jobShifts[jobId] || [];
    console.log(`Checking completion status for job ${jobId}:`, {
      totalShifts: shifts.length,
      shifts: shifts.map((s) => ({
        id: s._id,
        status: s.status,
        reportApprovedBy: s.reportApprovedBy,
        rawStatus: s.status,
      })),
    });

    if (shifts.length === 0) {
      console.log("No shifts found for job");
      return false;
    }

    const allShiftsComplete = shifts.every((shift) => {
      const status = (shift.status || "").toLowerCase().replace(/\s+/g, "_");
      const isComplete = status === "shift_complete";
      console.log(`Shift ${shift._id} details:`, {
        rawStatus: shift.status,
        normalizedStatus: status,
        isComplete,
        reportApprovedBy: shift.reportApprovedBy,
      });
      return isComplete;
    });

    console.log(`Job ${jobId} can be completed: ${allShiftsComplete}`);
    return allShiftsComplete;
  };

  const handleCompleteJob = async (jobId) => {
    try {
      if (!canCompleteJob(jobId)) {
        setError(
          "Cannot complete job: All shifts must be marked as complete first"
        );
        return;
      }

      console.log(`Completing job ${jobId}...`);

      // First get the job details to find the project ID
      const jobResponse = await jobService.getById(jobId);
      console.log("Job response:", jobResponse.data);

      const projectId =
        jobResponse.data.project?._id || jobResponse.data.project;
      console.log("Project ID:", projectId);

      if (!projectId) {
        throw new Error("Could not find project ID for this job");
      }

      // Get the current project details to preserve users
      const projectResponse = await projectService.getById(projectId);
      console.log("Current project details:", projectResponse.data);

      const currentProject = projectResponse.data;
      const updateData = {
        status: "Ready for invoicing",
        users: currentProject.users || [], // Preserve current users
        name: currentProject.name, // Preserve other required fields
        department: currentProject.department,
        category: currentProject.category,
        client: currentProject.client,
      };

      console.log("Project update data:", updateData);

      // Update both job and project status
      const [jobUpdateResponse, projectUpdateResponse] = await Promise.all([
        jobService.update(jobId, { status: "completed" }),
        projectService.update(projectId, updateData),
      ]);

      console.log("Job update response:", jobUpdateResponse.data);
      console.log("Project update response:", projectUpdateResponse.data);

      // Update local state
      setJobs(
        jobs.map((job) =>
          job._id === jobId ? { ...job, status: "completed" } : job
        )
      );

      console.log(`Job ${jobId} and project ${projectId} updated successfully`);
    } catch (err) {
      console.error("Error completing job:", err);
      setError(err.message || "Failed to complete job");
    }
  };

  const columns = [
    {
      field: "name",
      headerName: "Job Name",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "client",
      headerName: "Client",
      flex: 1,
      renderCell: (params) => (
        <TruncatedCell value={params.value?.name || ""} />
      ),
    },
    {
      field: "address",
      headerName: "Address",
      flex: 1.5,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Box>
          <IconButton
            onClick={() => handleEditJob(params.row)}
            color="primary"
            size="small"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteClick(null, params.row)}
            color="error"
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

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
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.grey[100],
            fontSize: "14px",
            fontWeight: "bold",
            padding: "10px 20px",
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
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
        onClose={() => setOpenDialog(false)}
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
            <IconButton onClick={() => setOpenDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleAddJob} sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Autocomplete
                options={projects}
                getOptionLabel={(option) =>
                  `${option.projectID} - ${option.name}`
                }
                value={selectedProject}
                onChange={(event, newValue) => {
                  setSelectedProject(newValue);
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

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Asbestos Removalist</InputLabel>
              <Select
                name="asbestosRemovalist"
                value={form.asbestosRemovalist}
                onChange={handleChange}
                label="Asbestos Removalist"
                required
              >
                <MenuItem value="Aztech Services">Aztech Services</MenuItem>
                <MenuItem value="International Asbestos Removals">
                  International Asbestos Removals
                </MenuItem>
                <MenuItem value="Glade Group">Glade Group</MenuItem>
                <MenuItem value="Crown Asbestos Removals">
                  Crown Asbestos Removals
                </MenuItem>
                <MenuItem value="Empire Contracting">
                  Empire Contracting
                </MenuItem>
                <MenuItem value="Spec Services">Spec Services</MenuItem>
                <MenuItem value="Jesco">Jesco</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddJob}
            variant="contained"
            disabled={!selectedProject || !form.asbestosRemovalist}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.grey[100],
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Add Job
          </Button>
        </DialogActions>
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
    </Box>
  );
};

export default AirMonitoring;
