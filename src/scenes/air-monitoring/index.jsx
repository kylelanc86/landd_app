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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import {
  jobs as initialJobs,
  projects,
  getProjectClient,
} from "../../data/mockData";

const JOBS_KEY = "ldc_jobs";

const emptyForm = {
  projectId: "",
  name: "",
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

  // Load jobs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(JOBS_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setJobs(JSON.parse(stored));
    } else {
      setJobs(initialJobs);
      localStorage.setItem(JOBS_KEY, JSON.stringify(initialJobs));
    }
  }, []);

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddJob = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.projectId) return;
    const newJob = {
      id: Date.now(),
      ...form,
    };
    setJobs([newJob, ...jobs]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditJob = (job) => {
    setEditId(job.id);
    setEditForm({ ...job });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setJobs(
      jobs.map((j) => (j.id === editId ? { ...editForm, id: editId } : j))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewShifts = (jobId) => {
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  // Filtering and sorting
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    const project = projects.find((p) => p.id === j.projectId);
    const client = project ? getProjectClient(project.id) : null;
    return (
      j.name.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q) ||
      j.supervisor.toLowerCase().includes(q) ||
      (project && project.name.toLowerCase().includes(q)) ||
      (client && client.name.toLowerCase().includes(q))
    );
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
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
    navigate(`/air-monitoring/project/${jobId}`);
  };

  const handleCloseReport = (jobId) => {
    // Implement close report functionality
    console.log("Close report for job:", jobId);
  };

  const handlePrintReport = (jobId) => {
    // Implement print report functionality
    console.log("Print report for job:", jobId);
  };

  const handleCreateJob = () => {
    if (selectedProject) {
      // Implement create job functionality with selected project
      console.log("Creating new job for project:", selectedProject);
      setOpenDialog(false);
      setSelectedProject(null);
      setSearchQuery("");
    }
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
                Show Completed Jobs
              </Typography>
            }
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              backgroundColor: theme.palette.primary[500],
              "&:hover": {
                backgroundColor: theme.palette.primary[600],
              },
            }}
          >
            Add Job
          </Button>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon
                  sx={{
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  }}
                />
              </InputAdornment>
            ),
          }}
          sx={{
            width: 300,
            "& .MuiInputLabel-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
            },
            "& .MuiOutlinedInput-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
              "& fieldset": {
                borderColor:
                  theme.palette.mode === "dark"
                    ? "#fff"
                    : theme.palette.secondary[200],
              },
            },
          }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: "8px" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort("name")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Job Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Project
              </TableCell>
              <TableCell
                onClick={() => handleSort("status")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Status {sortField === "status" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("startDate")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Start Date{" "}
                {sortField === "startDate" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedJobs.map((job) => {
              const project = projects.find((p) => p.id === job.projectId);
              const client = project ? getProjectClient(project.id) : null;
              return (
                <TableRow key={job.id}>
                  <TableCell>{job.name}</TableCell>
                  <TableCell>
                    {project
                      ? `${project.name} (${
                          client ? client.name : "Unknown Client"
                        })`
                      : "Unknown Project"}
                  </TableCell>
                  <TableCell>{job.status}</TableCell>
                  <TableCell>{job.startDate}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleEditJob(job)}
                      sx={{
                        color:
                          theme.palette.mode === "dark"
                            ? "#fff"
                            : theme.palette.secondary[200],
                        mr: 1,
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleViewShifts(job.id)}
                    >
                      View Shifts
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Job Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add New Job</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                name="projectId"
                value={form.projectId}
                onChange={handleChange}
                label="Project"
              >
                {projects.map((project) => {
                  const client = getProjectClient(project.id);
                  return (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name} ({client ? client.name : "Unknown Client"})
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <TextField
              name="name"
              label="Job Name"
              value={form.name}
              onChange={handleChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={form.status}
                onChange={handleChange}
                label="Status"
              >
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="startDate"
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="endDate"
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="description"
              label="Description"
              value={form.description}
              onChange={handleChange}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              name="location"
              label="Location"
              value={form.location}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="supervisor"
              label="Supervisor"
              value={form.supervisor}
              onChange={handleChange}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddJob} variant="contained">
            Add Job
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Job</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Project</InputLabel>
              <Select
                name="projectId"
                value={editForm.projectId}
                onChange={handleEditChange}
                label="Project"
              >
                {projects.map((project) => {
                  const client = getProjectClient(project.id);
                  return (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name} ({client ? client.name : "Unknown Client"})
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <TextField
              name="name"
              label="Job Name"
              value={editForm.name}
              onChange={handleEditChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                label="Status"
              >
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="startDate"
              label="Start Date"
              type="date"
              value={editForm.startDate}
              onChange={handleEditChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="endDate"
              label="End Date"
              type="date"
              value={editForm.endDate}
              onChange={handleEditChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="description"
              label="Description"
              value={editForm.description}
              onChange={handleEditChange}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              name="location"
              label="Location"
              value={editForm.location}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="supervisor"
              label="Supervisor"
              value={editForm.supervisor}
              onChange={handleEditChange}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirMonitoring;
