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
import {
  sampleService,
  shiftService,
  jobService,
  userService,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDateForInput } from "../../utils/dateUtils";

const EditSample = () => {
  const theme = useTheme();
  const { shiftId, sampleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    sampler: "",
    sampleNumber: "",
    type: "",
    location: "",
    pumpNo: "",
    cowlNo: "",
    filterSize: "",
    startTime: "",
    endTime: "",
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
    date: formatDateForInput(new Date()),
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch users when component mounts
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userService.getAll();
        setUsers(response.data);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  // Fetch sample data
  useEffect(() => {
    const fetchSampleData = async () => {
      try {
        setIsLoading(true);
        // Fetch sample details
        const sampleResponse = await sampleService.getById(sampleId);
        const sample = sampleResponse.data;
        console.log("Fetched sample data:", sample); // Debug log

        // Fetch shift details to get project ID
        const shiftResponse = await shiftService.getById(shiftId);
        const shift = shiftResponse.data;

        if (shift.job && shift.job.project) {
          setProjectID(shift.job.project.projectID);
        }

        // Fetch job details
        const jobResponse = await jobService.getById(shift.job._id);
        setJob(jobResponse.data);

        // Pre-fill form with sample data
        setForm({
          sampler: sample.collectedBy?._id || sample.collectedBy || "", // Handle both populated and unpopulated cases
          sampleNumber: sample.sampleNumber?.split("-")[1] || "", // Extract number part after hyphen
          type: sample.type || "",
          location: sample.location || "",
          pumpNo: sample.pumpNo || "",
          cowlNo: sample.cowlNo || "",
          filterSize: sample.filterSize || "",
          startTime: sample.startTime || "",
          endTime: sample.endTime || "",
          initialFlowrate: sample.initialFlowrate || "",
          finalFlowrate: sample.finalFlowrate || "",
          averageFlowrate: sample.averageFlowrate || "",
          notes: sample.notes || "",
          date: sample.date
            ? formatDateForInput(new Date(sample.date))
            : formatDateForInput(new Date()),
        });

        setError(null);
      } catch (err) {
        console.error("Error fetching sample data:", err);
        setError("Failed to load sample data. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    if (sampleId && shiftId) {
      fetchSampleData();
    }
  }, [sampleId, shiftId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Calculate average flowrate when initial or final flowrate changes
  useEffect(() => {
    if (form.initialFlowrate) {
      if (form.finalFlowrate) {
        const avg =
          (parseFloat(form.initialFlowrate) + parseFloat(form.finalFlowrate)) /
          2;
        setForm((prev) => ({ ...prev, averageFlowrate: avg.toFixed(2) }));
      } else {
        // If no final flowrate, use initial flowrate as average
        setForm((prev) => ({ ...prev, averageFlowrate: form.initialFlowrate }));
      }
    }
  }, [form.initialFlowrate, form.finalFlowrate]);

  const setCurrentTime = (field) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setForm((prev) => ({ ...prev, [field]: timeString }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!projectID) {
        throw new Error("Project ID is required");
      }

      if (!job?._id) {
        throw new Error("Job ID is required");
      }

      if (!shiftId) {
        throw new Error("Shift ID is required");
      }

      if (!form.sampler) {
        throw new Error("Sampler is required");
      }

      if (!form.location) {
        throw new Error("Location is required");
      }

      // Generate sample number in the format: projectID-number
      const sampleNumber = `${projectID}-${form.sampleNumber}`;

      // Format times to include seconds
      const formatTime = (time) => {
        if (!time) return "";
        return time.includes(":") ? time : `${time}:00`;
      };

      const sampleData = {
        shift: shiftId,
        job: job._id,
        sampleNumber: sampleNumber,
        fullSampleID: sampleNumber,
        type: form.type,
        location: form.location,
        pumpNo: form.pumpNo || undefined,
        cowlNo: form.cowlNo || undefined,
        filterSize: form.filterSize || undefined,
        startTime: formatTime(form.startTime),
        endTime: form.endTime ? formatTime(form.endTime) : undefined,
        initialFlowrate: parseFloat(form.initialFlowrate) || 0,
        finalFlowrate: form.finalFlowrate
          ? parseFloat(form.finalFlowrate)
          : undefined,
        averageFlowrate: parseFloat(form.averageFlowrate) || 0,
        status: "pending",
        notes: form.notes || undefined,
        collectedBy: form.sampler,
      };

      // Validate required fields
      if (!sampleData.startTime) {
        throw new Error("Start time is required");
      }
      if (!sampleData.initialFlowrate) {
        throw new Error("Initial flowrate is required");
      }
      if (!sampleData.averageFlowrate) {
        throw new Error("Average flowrate is required");
      }

      await sampleService.update(sampleId, sampleData);
      navigate(`/air-monitoring/shift/${shiftId}/samples`);
    } catch (error) {
      console.error("Error updating sample:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update sample"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (isSubmitting) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Updating...</Typography>
      </Box>
    );
  }

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

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={3} sx={{ maxWidth: 600 }}>
          <FormControl fullWidth required>
            <InputLabel>Sampler</InputLabel>
            <Select
              name="sampler"
              value={form.sampler}
              onChange={handleChange}
              label="Sampler"
            >
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            name="sampleNumber"
            label="Sample Number"
            value={form.sampleNumber}
            onChange={handleChange}
            required
            fullWidth
            helperText={
              projectID
                ? `Full Sample ID will be: ${projectID}-${
                    form.sampleNumber || "XXX"
                  }`
                : "Loading job details..."
            }
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
              <MenuItem value="Clearance">Clearance</MenuItem>
              <MenuItem value="Exposure">Exposure</MenuItem>
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
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1 }}
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
              inputProps={{ step: 1 }}
            />
            <IconButton
              onClick={() => setCurrentTime("endTime")}
              sx={{ alignSelf: "flex-end", mb: 1 }}
            >
              <AccessTimeIcon />
            </IconButton>
          </Box>
          <TextField
            name="initialFlowrate"
            label="Initial Flowrate"
            type="number"
            value={form.initialFlowrate}
            onChange={handleChange}
            required
            fullWidth
            inputProps={{ step: "0.1" }}
          />
          <TextField
            name="finalFlowrate"
            label="Final Flowrate"
            type="number"
            value={form.finalFlowrate}
            onChange={handleChange}
            fullWidth
            inputProps={{ step: "0.1" }}
          />
          <TextField
            name="averageFlowrate"
            label="Average Flowrate"
            value={form.averageFlowrate}
            disabled
            required
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
                backgroundColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
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
