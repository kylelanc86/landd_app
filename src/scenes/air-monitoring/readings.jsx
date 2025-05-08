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
  samples,
  readings as initialReadings,
  getJobProject,
  getProjectClient,
} from "../../data/mockData";

const READINGS_KEY = "ldc_readings";

const emptyForm = {
  time: "",
  parameter: "PM2.5",
  value: "",
  unit: "μg/m³",
  status: "Normal",
  notes: "",
};

const Readings = () => {
  const theme = useTheme();
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [readings, setReadings] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("time");
  const [sortAsc, setSortAsc] = useState(true);

  const sample = samples.find((s) => s.id === parseInt(sampleId));
  const shift = sample ? shifts.find((s) => s.id === sample.shiftId) : null;
  const job = shift ? jobs.find((j) => j.id === shift.jobId) : null;
  const project = job ? getJobProject(job.id) : null;
  const client = project ? getProjectClient(project.id) : null;

  // Load readings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(READINGS_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setReadings(JSON.parse(stored));
    } else {
      const sampleReadings = initialReadings.filter(
        (r) => r.sampleId === parseInt(sampleId)
      );
      setReadings(sampleReadings);
      localStorage.setItem(READINGS_KEY, JSON.stringify(sampleReadings));
    }
  }, [sampleId]);

  // Save readings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(READINGS_KEY, JSON.stringify(readings));
  }, [readings]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddReading = (e) => {
    e.preventDefault();
    if (!form.time || !form.value) return;
    const newReading = {
      id: Date.now(),
      sampleId: parseInt(sampleId),
      ...form,
    };
    setReadings([newReading, ...readings]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditReading = (reading) => {
    setEditId(reading.id);
    setEditForm({ ...reading });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setReadings(
      readings.map((r) => (r.id === editId ? { ...editForm, id: editId } : r))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  // Filtering and sorting
  const filteredReadings = readings.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.parameter.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q) ||
      r.notes.toLowerCase().includes(q)
    );
  });

  const sortedReadings = [...filteredReadings].sort((a, b) => {
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

  if (!sample || !shift || !job) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Sample, shift, or job not found</Typography>
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
            onClick={() =>
              navigate(`/air-monitoring/shifts/${shift.id}/samples`)
            }
            sx={{ mb: 2 }}
          >
            Back to Samples
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
            {sample.name}
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
            {shift.name} - {job.name} -{" "}
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
          Add Reading
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
                onClick={() => handleSort("time")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Time {sortField === "time" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("parameter")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Parameter{" "}
                {sortField === "parameter" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("value")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Value {sortField === "value" ? (sortAsc ? "▲" : "▼") : ""}
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
                Unit
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
            {sortedReadings.map((reading) => (
              <TableRow key={reading.id}>
                <TableCell>{reading.time}</TableCell>
                <TableCell>{reading.parameter}</TableCell>
                <TableCell>{reading.value}</TableCell>
                <TableCell>{reading.unit}</TableCell>
                <TableCell>{reading.status}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEditReading(reading)}
                    sx={{
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Reading Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add New Reading</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="time"
              label="Time"
              type="time"
              value={form.time}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Parameter</InputLabel>
              <Select
                name="parameter"
                value={form.parameter}
                onChange={handleChange}
                label="Parameter"
              >
                <MenuItem value="PM2.5">PM2.5</MenuItem>
                <MenuItem value="PM10">PM10</MenuItem>
                <MenuItem value="CO">CO</MenuItem>
                <MenuItem value="NO2">NO2</MenuItem>
                <MenuItem value="O3">O3</MenuItem>
                <MenuItem value="SO2">SO2</MenuItem>
                <MenuItem value="VOCs">VOCs</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="value"
              label="Value"
              type="number"
              value={form.value}
              onChange={handleChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                label="Unit"
              >
                <MenuItem value="μg/m³">μg/m³</MenuItem>
                <MenuItem value="ppm">ppm</MenuItem>
                <MenuItem value="ppb">ppb</MenuItem>
                <MenuItem value="mg/m³">mg/m³</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={form.status}
                onChange={handleChange}
                label="Status"
              >
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Warning">Warning</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
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
          <Button onClick={handleAddReading} variant="contained">
            Add Reading
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Reading Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Reading</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="time"
              label="Time"
              type="time"
              value={editForm.time}
              onChange={handleEditChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Parameter</InputLabel>
              <Select
                name="parameter"
                value={editForm.parameter}
                onChange={handleEditChange}
                label="Parameter"
              >
                <MenuItem value="PM2.5">PM2.5</MenuItem>
                <MenuItem value="PM10">PM10</MenuItem>
                <MenuItem value="CO">CO</MenuItem>
                <MenuItem value="NO2">NO2</MenuItem>
                <MenuItem value="O3">O3</MenuItem>
                <MenuItem value="SO2">SO2</MenuItem>
                <MenuItem value="VOCs">VOCs</MenuItem>
              </Select>
            </FormControl>
            <TextField
              name="value"
              label="Value"
              type="number"
              value={editForm.value}
              onChange={handleEditChange}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                name="unit"
                value={editForm.unit}
                onChange={handleEditChange}
                label="Unit"
              >
                <MenuItem value="μg/m³">μg/m³</MenuItem>
                <MenuItem value="ppm">ppm</MenuItem>
                <MenuItem value="ppb">ppb</MenuItem>
                <MenuItem value="mg/m³">mg/m³</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={editForm.status}
                onChange={handleEditChange}
                label="Status"
              >
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Warning">Warning</MenuItem>
                <MenuItem value="Critical">Critical</MenuItem>
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

export default Readings;
