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
} from "../../data/mockData";

const SHIFTS_KEY = "ldc_shifts";

const emptyForm = {
  name: "",
  date: "",
  startTime: "",
  endTime: "",
  supervisor: "",
  status: "In Progress",
  notes: "",
};

const Shifts = () => {
  const theme = useTheme();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(true);

  const job = jobs.find((j) => j.id === parseInt(jobId));
  const project = job ? getJobProject(job.id) : null;
  const client = project ? getProjectClient(project.id) : null;

  // Load shifts from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SHIFTS_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setShifts(JSON.parse(stored));
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
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));
  }, [shifts]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddShift = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.date) return;
    const newShift = {
      id: Date.now(),
      jobId: parseInt(jobId),
      ...form,
    };
    setShifts([newShift, ...shifts]);
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
    setShifts(
      shifts.map((s) => (s.id === editId ? { ...editForm, id: editId } : s))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewSamples = (shiftId) => {
    navigate(`/air-monitoring/shifts/${shiftId}/samples`);
  };

  // Filtering and sorting
  const filteredShifts = shifts.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
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
            {job.name}
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
          </Typography>
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
                Shift Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
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
                Time
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
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedShifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>{shift.name}</TableCell>
                <TableCell>{shift.date}</TableCell>
                <TableCell>{`${shift.startTime} - ${shift.endTime}`}</TableCell>
                <TableCell>{shift.status}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEditShift(shift)}
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
                    onClick={() => handleViewSamples(shift.id)}
                  >
                    View Samples
                  </Button>
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
              name="name"
              label="Shift Name"
              value={form.name}
              onChange={handleChange}
              fullWidth
            />
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
              name="startTime"
              label="Start Time"
              type="time"
              value={form.startTime}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="endTime"
              label="End Time"
              type="time"
              value={form.endTime}
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
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
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
          <Button onClick={handleAddShift} variant="contained">
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
              name="name"
              label="Shift Name"
              value={editForm.name}
              onChange={handleEditChange}
              fullWidth
            />
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
              name="startTime"
              label="Start Time"
              type="time"
              value={editForm.startTime}
              onChange={handleEditChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="endTime"
              label="End Time"
              type="time"
              value={editForm.endTime}
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
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
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
    </Box>
  );
};

export default Shifts;
