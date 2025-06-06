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
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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

const SAMPLES_KEY = "ldc_samples";
const SHIFTS_KEY = "ldc_shifts";
const JOBS_KEY = "ldc_jobs";

const NewSample = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    sampleNumber: "",
    type: "Background",
    location: "",
    pumpNo: "",
    cowlNo: "",
    filterSize: "25mm",
    startTime: "",
    endTime: "",
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
    isFieldBlank: false,
    sampler: "",
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState(null);

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

  useEffect(() => {
    const fetchShift = async () => {
      try {
        const response = await shiftService.getById(shiftId);
        console.log("Full shift response:", response.data);
        setShift(response.data);

        // Get the next sample number from location state
        const nextNumber = location.state?.nextSampleNumber;
        console.log("Next sample number from location:", nextNumber);

        if (nextNumber) {
          // Get the project ID from the shift's job
          const projectID = response.data.job?.project?.projectID;
          if (projectID) {
            // Set just the number part as the sample number
            setForm((prev) => ({
              ...prev,
              sampleNumber: nextNumber.toString(),
            }));
            // Store the project ID for later use in fullSampleID
            setProjectID(projectID);
          }
        }

        // Get the number of samples in this shift by querying the samples
        const samplesResponse = await sampleService.getByShift(shiftId);
        const samplesInShift = samplesResponse.data || [];
        const shiftSampleNumber = samplesInShift.length + 1;
        console.log("Number of samples in shift:", samplesInShift.length);
        console.log(
          "This will be sample number:",
          shiftSampleNumber,
          "in this shift"
        );

        // If there's no default sampler but we have samples, check the first sample
        if (!response.data.defaultSampler && samplesInShift.length > 0) {
          const firstSample = samplesInShift[0];
          console.log("First sample in shift:", firstSample);

          if (firstSample.collectedBy) {
            console.log(
              "Setting default sampler from first sample:",
              firstSample.collectedBy
            );
            try {
              const shiftUpdateResponse = await shiftService.update(shiftId, {
                defaultSampler: firstSample.collectedBy,
              });
              console.log(
                "Shift updated with default sampler from first sample:",
                shiftUpdateResponse
              );

              // Set the sampler in the form
              setForm((prev) => ({
                ...prev,
                sampler: firstSample.collectedBy,
              }));
            } catch (error) {
              console.error(
                "Error setting default sampler from first sample:",
                error
              );
            }
          }
        }
        // If there is a default sampler, use it for subsequent samples
        else if (response.data.defaultSampler) {
          console.log(
            "Setting default sampler from shift:",
            response.data.defaultSampler
          );
          const samplerId =
            response.data.defaultSampler._id || response.data.defaultSampler;
          console.log("Setting sampler ID to:", samplerId);
          setForm((prev) => ({
            ...prev,
            sampler: samplerId,
          }));
        }
      } catch (err) {
        console.error("Error fetching shift:", err);
        setError("Failed to load shift details");
      }
    };

    fetchShift();
  }, [shiftId, location.state]);

  useEffect(() => {
    const fetchShiftDetails = async () => {
      if (!shiftId) {
        setError("No shift ID provided");
        return;
      }

      try {
        console.log("Fetching shift details for shiftId:", shiftId);
        const response = await shiftService.getById(shiftId);
        console.log("Full shift response:", response);
        const shift = response.data;

        // Get project ID from the job's project
        if (shift.job && shift.job.project) {
          setProjectID(shift.job.project.projectID);
          console.log("Project ID set to:", shift.job.project.projectID);
        } else {
          console.error("No project data found in job");
          setError("No project data found for this job");
          return;
        }

        // Fetch job details
        const jobResponse = await jobService.getById(shift.job._id);
        setJob(jobResponse.data);
      } catch (error) {
        console.error("Error fetching shift details:", error);
        setError("Failed to fetch shift details");
      }
    };

    fetchShiftDetails();
  }, [shiftId]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    console.log("Form field changed:", { name, value, checked });
    if (name === "isFieldBlank") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
        // If field blank is checked, set location to 'Field blank'
        location: checked ? "Field blank" : prev.location,
      }));
    } else {
      setForm((prev) => {
        const newState = { ...prev, [name]: value };
        console.log("New form state after change:", newState);
        return newState;
      });
    }
  };

  // Calculate average flowrate when initial or final flowrate changes
  useEffect(() => {
    if (form.initialFlowrate) {
      if (form.finalFlowrate) {
        const avg =
          (parseFloat(form.initialFlowrate) + parseFloat(form.finalFlowrate)) /
          2;
        setForm((prev) => ({
          ...prev,
          averageFlowrate: Math.round(avg).toString(),
        }));
      } else {
        // If no final flowrate, use initial flowrate as average
        setForm((prev) => ({
          ...prev,
          averageFlowrate: Math.round(
            parseFloat(form.initialFlowrate)
          ).toString(),
        }));
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
      console.log("Starting sample submission...");
      console.log("Current user:", currentUser);
      console.log("Form data:", form);
      console.log("Project ID:", projectID);
      console.log("Job:", job);

      if (!projectID) {
        throw new Error("Project ID is required");
      }

      if (!job?._id) {
        throw new Error("Job ID is required");
      }

      if (!shiftId) {
        throw new Error("Shift ID is required");
      }

      if (!form.sampleNumber) {
        throw new Error("Sample number is required");
      }

      // Get the number of samples in this shift
      const samplesResponse = await sampleService.getByShift(shiftId);
      const samplesInShift = samplesResponse.data || [];
      const shiftSampleNumber = samplesInShift.length + 1;

      // If this is the first sample in the shift and we have a sampler, set it as the default
      if (shiftSampleNumber === 1 && form.sampler) {
        console.log("Setting default sampler for shift:", form.sampler);
        try {
          const shiftUpdateResponse = await shiftService.update(shiftId, {
            defaultSampler: form.sampler,
          });
          console.log(
            "Shift updated with default sampler:",
            shiftUpdateResponse
          );
        } catch (error) {
          console.error("Error setting default sampler:", error);
          // Don't throw the error, just log it and continue
        }
      }

      // Create the sample
      const sampleData = {
        ...form,
        shift: shiftId,
        job: job._id,
        fullSampleID: `${projectID}-${form.sampleNumber}`,
        collectedBy: form.sampler, // Explicitly set collectedBy to match sampler
      };

      const newSample = await sampleService.create(sampleData);
      console.log("Sample created successfully:", newSample);

      // Add a small delay before navigation to ensure the sample is saved
      setTimeout(() => {
        navigate(`/air-monitoring/shift/${shiftId}/samples`);
      }, 500);
    } catch (error) {
      console.error("Error creating sample:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to create sample"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Submitting...</Typography>
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
        Add New Sample
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
          <FormControlLabel
            control={
              <Checkbox
                name="isFieldBlank"
                checked={form.isFieldBlank}
                onChange={handleChange}
              />
            }
            label="Field Blank"
          />
          {!form.isFieldBlank && (
            <>
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
            </>
          )}
          {form.isFieldBlank && (
            <TextField
              name="location"
              label="Location"
              value="Field blank"
              disabled
              required
              fullWidth
            />
          )}
          {!form.isFieldBlank && (
            <>
              <TextField
                name="pumpNo"
                label="Pump No."
                value={form.pumpNo}
                onChange={handleChange}
                fullWidth
              />
            </>
          )}
          <TextField
            name="cowlNo"
            label="Cowl No."
            value={form.cowlNo}
            onChange={handleChange}
            required
            fullWidth
          />
          {!form.isFieldBlank && (
            <>
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
                  inputProps={{ step: 60 }}
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
                  inputProps={{ step: 60 }}
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
                label="Initial Flowrate (L/min)"
                type="number"
                value={form.initialFlowrate}
                onChange={handleChange}
                required
                fullWidth
                inputProps={{ step: "0.1" }}
              />
              <TextField
                name="finalFlowrate"
                label="Final Flowrate (L/min)"
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
            </>
          )}
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
              Save Sample
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default NewSample;
