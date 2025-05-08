import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

const SAMPLES_KEY = "ldc_samples";
const SHIFTS_KEY = "ldc_shifts";

const EditSample = () => {
  const theme = useTheme();
  const { shiftId, sampleId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    sampleNo: "",
    type: "Background",
    location: "",
    pumpNo: "",
    cowlNo: "",
    filterSize: "25mm",
    startTime: "",
    endTime: "",
    minutes: "",
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
  });
  const [jobId, setJobId] = useState(null);

  // Load sample and job data
  useEffect(() => {
    const storedSamples = localStorage.getItem(SAMPLES_KEY);
    const storedShifts = localStorage.getItem(SHIFTS_KEY);

    if (storedSamples && storedShifts) {
      const samples = JSON.parse(storedSamples);
      const shifts = JSON.parse(storedShifts);

      // Find the sample
      const sample = samples.find((s) => s.id === parseInt(sampleId));
      if (sample) {
        setForm(sample);
      }

      // Get job ID from shift
      const shift = shifts.find((s) => s.id === parseInt(shiftId));
      if (shift) {
        setJobId(shift.jobId);
      }
    }
  }, [shiftId, sampleId]);

  // Calculate minutes when start or end time changes
  useEffect(() => {
    if (form.startTime && form.endTime) {
      const start = new Date(`2000-01-01T${form.startTime}`);
      const end = new Date(`2000-01-01T${form.endTime}`);
      const diffMs = end - start;
      const diffMins = Math.round(diffMs / 60000);
      setForm((prev) => ({ ...prev, minutes: diffMins }));
    }
  }, [form.startTime, form.endTime]);

  // Calculate average flowrate when initial or final flowrate changes
  useEffect(() => {
    if (form.initialFlowrate && form.finalFlowrate) {
      const avg =
        (parseFloat(form.initialFlowrate) + parseFloat(form.finalFlowrate)) / 2;
      setForm((prev) => ({ ...prev, averageFlowrate: avg.toFixed(2) }));
    }
  }, [form.initialFlowrate, form.finalFlowrate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const setCurrentTime = (field) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setForm((prev) => ({ ...prev, [field]: timeString }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Get existing samples
    const storedSamples = localStorage.getItem(SAMPLES_KEY);
    if (storedSamples) {
      const samples = JSON.parse(storedSamples);

      // Update the sample
      const updatedSamples = samples.map((s) =>
        s.id === parseInt(sampleId) ? { ...form, id: parseInt(sampleId) } : s
      );

      // Save to localStorage
      localStorage.setItem(SAMPLES_KEY, JSON.stringify(updatedSamples));
    }

    // Navigate back to samples list
    navigate(`/air-monitoring/shift/${shiftId}/samples`);
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 4 }}
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
          mb: 4,
        }}
      >
        Edit Sample
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={3} sx={{ maxWidth: 600 }}>
          <TextField
            name="sampleNo"
            label="Sample Number"
            value={form.sampleNo}
            disabled
            fullWidth
          />
          <FormControl fullWidth required>
            <InputLabel>Type</InputLabel>
            <Select
              name="type"
              value={form.type}
              onChange={handleChange}
              label="Type"
            >
              <MenuItem value="Background">Background</MenuItem>
              <MenuItem value="Personal">Personal</MenuItem>
              <MenuItem value="Area">Area</MenuItem>
            </Select>
          </FormControl>
          <TextField
            name="location"
            label="Location"
            value={form.location}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            name="pumpNo"
            label="Pump No."
            value={form.pumpNo}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            name="cowlNo"
            label="Cowl No."
            value={form.cowlNo}
            onChange={handleChange}
            required
            fullWidth
          />
          <FormControl fullWidth required>
            <InputLabel>Filter Size</InputLabel>
            <Select
              name="filterSize"
              value={form.filterSize}
              onChange={handleChange}
              label="Filter Size"
            >
              <MenuItem value="25mm">25mm</MenuItem>
              <MenuItem value="13mm">13mm</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              name="startTime"
              label="Start Time"
              type="time"
              value={form.startTime}
              onChange={handleChange}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <IconButton
              onClick={() => setCurrentTime("startTime")}
              sx={{ alignSelf: "flex-end", mb: 1 }}
            >
              <AccessTimeIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              name="endTime"
              label="End Time"
              type="time"
              value={form.endTime}
              onChange={handleChange}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <IconButton
              onClick={() => setCurrentTime("endTime")}
              sx={{ alignSelf: "flex-end", mb: 1 }}
            >
              <AccessTimeIcon />
            </IconButton>
          </Box>
          <TextField
            name="minutes"
            label="Minutes"
            value={form.minutes}
            disabled
            fullWidth
          />
          <TextField
            name="initialFlowrate"
            label="Initial Flowrate"
            type="number"
            value={form.initialFlowrate}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            name="finalFlowrate"
            label="Final Flowrate"
            type="number"
            value={form.finalFlowrate}
            onChange={handleChange}
            required
            fullWidth
          />
          <TextField
            name="averageFlowrate"
            label="Average Flowrate"
            value={form.averageFlowrate}
            disabled
            fullWidth
          />
          <TextField
            name="notes"
            label="Notes"
            value={form.notes}
            onChange={handleChange}
            multiline
            rows={3}
            fullWidth
          />
          <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{
                backgroundColor: theme.palette.primary[500],
                "&:hover": {
                  backgroundColor: theme.palette.primary[600],
                },
              }}
            >
              Save Changes
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default EditSample;
