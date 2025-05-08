import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  jobs,
  shifts as initialShifts,
  getJobProject,
  getProjectClient,
  projects,
} from "../../data/mockData";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DeleteIcon from "@mui/icons-material/Delete";

const JOBS_KEY = "ldc_jobs";
const SHIFTS_KEY = "ldc_shifts";

const emptyForm = {
  date: "",
  supervisor: "",
  status: "In Progress",
  notes: "",
};

const Shifts = () => {
  const theme = useTheme();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [job, setJob] = useState(null);
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);

  // Load job and project data
  useEffect(() => {
    // First try to get job from localStorage
    const storedJobs = localStorage.getItem(JOBS_KEY);
    if (storedJobs) {
      const jobs = JSON.parse(storedJobs);
      const foundJob = jobs.find((j) => j.id === parseInt(jobId));
      if (foundJob) {
        setJob(foundJob);
        const foundProject = projects.find((p) => p.id === foundJob.projectId);
        if (foundProject) {
          setProject(foundProject);
          setClient(getProjectClient(foundProject.id));
        }
      }
    } else {
      // Fallback to mockData if not found in localStorage
      const mockJob = jobs.find((j) => j.id === parseInt(jobId));
      if (mockJob) {
        setJob(mockJob);
        const foundProject = getJobProject(mockJob.id);
        if (foundProject) {
          setProject(foundProject);
          setClient(getProjectClient(foundProject.id));
        }
      }
    }
  }, [jobId]);

  // Load shifts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SHIFTS_KEY);
    if (stored) {
      const allShifts = JSON.parse(stored);
      const jobShifts = allShifts.filter((s) => s.jobId === parseInt(jobId));
      setShifts(jobShifts);
    } else {
      const jobShifts = initialShifts.filter(
        (s) => s.jobId === parseInt(jobId)
      );
      setShifts(jobShifts);
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(jobShifts));
    }
  }, [jobId]);

  // Save shifts to localStorage whenever they change
  useEffect(() => {
    if (shifts.length > 0) {
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
    }
  }, [shifts]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddShift = (e) => {
    e.preventDefault();
    if (!form.date) return;
    const newShift = {
      id: Date.now(),
      jobId: parseInt(jobId),
      ...form,
    };
    const updatedShifts = [newShift, ...shifts];
    setShifts(updatedShifts);
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(updatedShifts));
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditShift = (shift) => {
    setEditId(shift.id);
    setEditForm({ ...shift });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedShifts = shifts.map((s) =>
      s.id === editId ? { ...editForm, id: editId } : s
    );
    setShifts(updatedShifts);
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(updatedShifts));
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewSamples = (shiftId) => {
    navigate(`/air-monitoring/shift/${shiftId}/samples`);
  };

  const handleDeleteShift = (shiftId) => {
    setShiftToDelete(shiftId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (shiftToDelete) {
      const updatedShifts = shifts.filter(
        (shift) => shift.id !== shiftToDelete
      );
      setShifts(updatedShifts);
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(updatedShifts));
      setDeleteDialogOpen(false);
      setShiftToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setShiftToDelete(null);
  };

  // Filtering and sorting
  const filteredShifts = shifts.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.supervisor.toLowerCase().includes(q) ||
      s.notes.toLowerCase().includes(q)
    );
  });

  const sortedShifts = [...filteredShifts].sort((a, b) => {
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

  if (!job) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Job not found</Typography>
        <Button onClick={() => navigate("/air-monitoring")}>
          Back to Jobs
        </Button>
      </Box>
    );
  }

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
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/air-monitoring")}
            sx={{ mb: 2 }}
          >
            Back to Jobs
          </Button>
          {/* <Typography
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
            Project ID: {job.projectId}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color:
                theme.palette.mode === "dark"
                  ? theme.palette.grey[300]
                  : theme.palette.secondary[300],
            }}
          >
            {project
              ? `${project.name} (${client ? client.name : "Unknown Client"})`
              : "Unknown Project"}
          </Typography> */}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Job Details
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body1">
                    <strong>Project:</strong> {project?.name || "N/A"}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Client:</strong> {client?.name || "N/A"}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Status:</strong> {job.status}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Start Date:</strong> {job.startDate}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Location:</strong> {job.location}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Description:</strong> {job.description}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: theme.palette.primary[500],
            "&:hover": {
              backgroundColor: theme.palette.primary[600],
            },
          }}
          onClick={() => setDialogOpen(true)}
        >
          Add Shift
        </Button>
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort("date")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Date {sortField === "date" ? (sortAsc ? "▲" : "▼") : ""}
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
                Sampler
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
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Notes
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
            {sortedShifts.map((shift) => (
              <TableRow
                key={shift.id}
                onClick={() => handleViewSamples(shift.id)}
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <TableCell>{shift.date}</TableCell>
                <TableCell>{shift.supervisor}</TableCell>
                <TableCell>{shift.status}</TableCell>
                <TableCell>{shift.notes}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSamples(shift.id);
                      }}
                      size="small"
                    >
                      <AssessmentIcon />
                    </IconButton>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditShift(shift);
                      }}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteShift(shift.id);
                      }}
                      size="small"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Shift Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add New Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="date"
              label="Date"
              type="date"
              value={form.date}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="supervisor"
              label="Supervisor"
              value={form.supervisor}
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
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="notes"
              label="Notes"
              value={form.notes}
              onChange={handleChange}
              fullWidth
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddShift}
            variant="contained"
            disabled={!form.date}
          >
            Add Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Shift Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Shift</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="date"
              label="Date"
              type="date"
              value={editForm.date}
              onChange={handleEditChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="supervisor"
              label="Supervisor"
              value={editForm.supervisor}
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
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="notes"
              label="Notes"
              value={editForm.notes}
              onChange={handleEditChange}
              fullWidth
              multiline
              rows={3}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this shift?</Typography>
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

export default Shifts;
