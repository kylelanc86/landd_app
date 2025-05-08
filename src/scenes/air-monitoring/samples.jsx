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
  shifts,
  samples as initialSamples,
  getJobProject,
  getProjectClient,
} from "../../data/mockData";

const SAMPLES_KEY = "ldc_samples";

const emptyForm = {
  name: "",
  type: "Personal",
  location: "",
  startTime: "",
  endTime: "",
  status: "In Progress",
  notes: "",
  readings: [],
};

const Samples = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("startTime");
  const [sortAsc, setSortAsc] = useState(true);

  const shift = shifts.find((s) => s.id === parseInt(shiftId));
  const job = shift ? jobs.find((j) => j.id === shift.jobId) : null;
  const project = job ? getJobProject(job.id) : null;
  const client = project ? getProjectClient(project.id) : null;

  // Load samples from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SAMPLES_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setSamples(JSON.parse(stored));
    } else {
      const shiftSamples = initialSamples.filter(
        (s) => s.shiftId === parseInt(shiftId)
      );
      setSamples(shiftSamples);
      localStorage.setItem(SAMPLES_KEY, JSON.stringify(shiftSamples));
    }
  }, [shiftId]);

  // Save samples to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples));
  }, [samples]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddSample = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.startTime) return;
    const newSample = {
      id: Date.now(),
      shiftId: parseInt(shiftId),
      ...form,
    };
    setSamples([newSample, ...samples]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditSample = (sample) => {
    setEditId(sample.id);
    setEditForm({ ...sample });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setSamples(
      samples.map((s) => (s.id === editId ? { ...editForm, id: editId } : s))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewReadings = (sampleId) => {
    navigate(`/air-monitoring/samples/${sampleId}/readings`);
  };

  // Filtering and sorting
  const filteredSamples = samples.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.notes.toLowerCase().includes(q)
    );
  });

  const sortedSamples = [...filteredSamples].sort((a, b) => {
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

  if (!shift || !job) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Shift or job not found</Typography>
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
            onClick={() => navigate(`/air-monitoring/jobs/${job.id}/shifts`)}
            sx={{ mb: 2 }}
          >
            Back to Shifts
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
            {shift.name}
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
            {job.name} -{" "}
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
          Add Sample
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
                Sample Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("type")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Type {sortField === "type" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("location")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Location {sortField === "location" ? (sortAsc ? "▲" : "▼") : ""}
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
            {sortedSamples.map((sample) => (
              <TableRow key={sample.id}>
                <TableCell>{sample.name}</TableCell>
                <TableCell>{sample.type}</TableCell>
                <TableCell>{sample.location}</TableCell>
                <TableCell>{`${sample.startTime} - ${sample.endTime}`}</TableCell>
                <TableCell>{sample.status}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEditSample(sample)}
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
                    onClick={() => handleViewReadings(sample.id)}
                  >
                    View Readings
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Sample Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add New Sample</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="name"
              label="Sample Name"
              value={form.name}
              onChange={handleChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                name="type"
                value={form.type}
                onChange={handleChange}
                label="Type"
              >
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Area">Area</MenuItem>
                <MenuItem value="Background">Background</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="location"
              label="Location"
              value={form.location}
              onChange={handleChange}
              fullWidth
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
          <Button onClick={handleAddSample} variant="contained">
            Add Sample
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Sample Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Sample</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="name"
              label="Sample Name"
              value={editForm.name}
              onChange={handleEditChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                name="type"
                value={editForm.type}
                onChange={handleEditChange}
                label="Type"
              >
                <MenuItem value="Personal">Personal</MenuItem>
                <MenuItem value="Area">Area</MenuItem>
                <MenuItem value="Background">Background</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="location"
              label="Location"
              value={editForm.location}
              onChange={handleEditChange}
              fullWidth
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

export default Samples;
