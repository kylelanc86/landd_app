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
const JOBS_KEY = "ldc_jobs";

const NewSample = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
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

  // Get job ID from shift
  useEffect(() => {
    const storedShifts = localStorage.getItem(SHIFTS_KEY);
    if (storedShifts) {
      const shifts = JSON.parse(storedShifts);
      const foundShift = shifts.find((s) => s.id === parseInt(shiftId));
      if (foundShift) {
        setJobId(foundShift.jobId);
        // Calculate sample number based on job ID and existing samples
        const storedSamples = localStorage.getItem(SAMPLES_KEY);
        if (storedSamples) {
          const samples = JSON.parse(storedSamples);
          const jobSamples = samples.filter(
            (s) => s.jobId === foundShift.jobId
          );
          const nextNumber = jobSamples.length + 1;
          setForm((prev) => ({
            ...prev,
            sampleNo: `${foundShift.jobId}-${nextNumber}`,
          }));
        } else {
          setForm((prev) => ({ ...prev, sampleNo: `${foundShift.jobId}-1` }));
        }
      }
    }
  }, [shiftId]);

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
    const newSample = {
      id: Date.now(),
      shiftId: parseInt(shiftId),
      jobId: jobId,
      ...form,
    };

    // Get existing samples
    const storedSamples = localStorage.getItem(SAMPLES_KEY);
    const samples = storedSamples ? JSON.parse(storedSamples) : [];

    // Add new sample
    samples.push(newSample);

    // Save to localStorage
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples));

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
        Add New Sample
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
          <FormControl fullWidth>
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
            fullWidth
          />
          <TextField
            name="pumpNo"
            label="Pump No."
            value={form.pumpNo}
            onChange={handleChange}
            fullWidth
          />
          <TextField
            name="cowlNo"
            label="Cowl No."
            value={form.cowlNo}
            onChange={handleChange}
            fullWidth
          />
          <FormControl fullWidth>
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
            fullWidth
          />
          <TextField
            name="finalFlowrate"
            label="Final Flowrate"
            type="number"
            value={form.finalFlowrate}
            onChange={handleChange}
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
              Add Sample
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default NewSample;
