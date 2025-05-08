import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  jobs as initialJobs,
  projects,
  getProjectClient,
} from "../../data/mockData";

const JOBS_KEY = "ldc_jobs";

const emptyForm = {
  projectId: "",
  status: "Pending",
  startDate: "",
  endDate: "",
  description: "",
  location: "",
  supervisor: "",
};

const AirMonitoring = () => {
  const theme = useTheme();
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

  // Load projects from localStorage
  const [availableProjects, setAvailableProjects] = useState([]);

  useEffect(() => {
    // Load projects from localStorage
    const storedProjects = localStorage.getItem("ldc_projects");
    if (storedProjects) {
      setAvailableProjects(JSON.parse(storedProjects));
    } else {
      // Fallback to mock data if no projects in localStorage
      setAvailableProjects(projects);
    }
  }, []);

  // Load jobs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(JOBS_KEY);
    if (stored) {
      const parsedJobs = JSON.parse(stored);
      setJobs(parsedJobs);
    } else {
      // Only set initial jobs if there are none in localStorage
      setJobs(initialJobs);
      localStorage.setItem(JOBS_KEY, JSON.stringify(initialJobs));
    }
  }, []);

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
    }
  }, [jobs]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddJob = (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    const newJob = {
      id: Date.now(),
      projectId: selectedProject.id,
      status: "Pending",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      description: `Air monitoring job for ${selectedProject.name}`,
      location: selectedProject.location || "",
      supervisor: "",
    };

    const updatedJobs = [newJob, ...jobs];
    setJobs(updatedJobs);
    localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
    setOpenDialog(false);
    setSelectedProject(null);
    setSearchQuery("");
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
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  const handleDeleteClick = (e, job) => {
    e.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (jobToDelete) {
      const updatedJobs = jobs.filter((job) => job.id !== jobToDelete.id);
      setJobs(updatedJobs);
      localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  // Filtering and sorting
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    const project = availableProjects.find((p) => p.id === j.projectId);
    const client = project ? getProjectClient(project.id) : null;

    return (
      (j.projectId?.toString() || "").toLowerCase().includes(q) ||
      (project?.name || "").toLowerCase().includes(q) ||
      (j.status || "").toLowerCase().includes(q) ||
      (j.startDate || "").toLowerCase().includes(q) ||
      (client?.name || "").toLowerCase().includes(q)
    );
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            color:
              theme.palette.mode === "dark"
                ? "#fff"
                : theme.palette.secondary[200],
            fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          Air Monitoring Jobs
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                sx={{
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  "&.Mui-checked": {
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  },
                }}
              />
            }
            label={
              <Typography
                sx={{
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Show Completed
              </Typography>
            }
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={{
              backgroundColor:
                theme.palette.mode === "dark"
                  ? theme.palette.primary[500]
                  : theme.palette.primary[700],
              color: "#fff",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? theme.palette.primary[600]
                    : theme.palette.primary[800],
              },
            }}
          >
            Add Job
          </Button>
        </Box>
      </Box>

      {/* Project Selection Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setSelectedProject(null);
          setSearchQuery("");
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Select Project</Typography>
            <IconButton
              onClick={() => {
                setOpenDialog(false);
                setSelectedProject(null);
                setSearchQuery("");
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Autocomplete
              options={availableProjects}
              getOptionLabel={(option) => option.name}
              value={selectedProject}
              onChange={(event, newValue) => {
                setSelectedProject(newValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search Projects"
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <ListItem {...props}>
                  <ListItemText
                    primary={option.name}
                    secondary={`Client: ${
                      getProjectClient(option.id)?.name || "N/A"
                    }`}
                  />
                </ListItem>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenDialog(false);
              setSelectedProject(null);
              setSearchQuery("");
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddJob}
            variant="contained"
            disabled={!selectedProject}
          >
            Create Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rest of your existing table code */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Project ID</TableCell>
              <TableCell>Project Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedJobs.map((job) => {
              const project = availableProjects.find(
                (p) => p.id === job.projectId
              );
              return (
                <TableRow
                  key={job.id}
                  onClick={() => handleOpenJob(job.id)}
                  sx={{
                    cursor: "pointer",
                    "&:hover": {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <TableCell>{job.projectId}</TableCell>
                  <TableCell>{project?.name || "N/A"}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        backgroundColor: getStatusColor(job.status),
                        color: theme.palette.mode === "dark" ? "#000" : "#fff",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        display: "inline-block",
                      }}
                    >
                      {job.status}
                    </Box>
                  </TableCell>
                  <TableCell>{job.startDate}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewShifts(job.id);
                        }}
                        size="small"
                      >
                        <AssessmentIcon />
                      </IconButton>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintReport(job.id);
                        }}
                        size="small"
                      >
                        <PrintIcon />
                      </IconButton>
                      <IconButton
                        onClick={(e) => handleDeleteClick(e, job)}
                        size="small"
                        sx={{ color: theme.palette.error.main }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this air monitoring job?
          </Typography>
          {jobToDelete && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">
                Project ID: {jobToDelete.projectId}
              </Typography>
              <Typography variant="subtitle1">
                Project:{" "}
                {availableProjects.find((p) => p.id === jobToDelete.projectId)
                  ?.name || "N/A"}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirMonitoring;
