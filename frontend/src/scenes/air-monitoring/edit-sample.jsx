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
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { sampleService, shiftService, userService } from "../../services/api";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import airPumpService from "../../services/airPumpService";
import { equipmentService } from "../../services/equipmentService";
import { useAuth } from "../../context/AuthContext";
import { formatDateForInput } from "../../utils/dateUtils";

const EditSample = () => {
  const theme = useTheme();
  const { shiftId, sampleId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [airPumps, setAirPumps] = useState([]);
  const [flowmeters, setFlowmeters] = useState([]);
  const [form, setForm] = useState({
    sampler: "",
    sampleNumber: "",
    type: "",
    location: "",
    pumpNo: "",
    flowmeter: "",
    cowlNo: "",
    filterSize: "",
    startTime: "",
    endTime: "",
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
    date: formatDateForInput(new Date()),
    isFieldBlank: false,
    status: "pending",
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch asbestos assessors when component mounts
  useEffect(() => {
    const fetchAsbestosAssessors = async () => {
      try {
        const response = await userService.getAll();
        const users = response.data;

        // Filter users who have Asbestos Assessor licenses
        const assessors = users.filter(
          (user) =>
            user.isActive &&
            user.licences &&
            user.licences.some(
              (licence) =>
                licence.licenceType &&
                licence.licenceType.toLowerCase().includes("asbestos assessor")
            )
        );

        // Sort alphabetically by name
        const sortedAssessors = assessors.sort((a, b) => {
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });

        setAsbestosAssessors(sortedAssessors);
      } catch (error) {
        console.error("Error fetching asbestos assessors:", error);
      }
    };
    fetchAsbestosAssessors();
  }, []);

  // Fetch active air pumps when component mounts
  useEffect(() => {
    const fetchActiveAirPumps = async () => {
      try {
        const response = await airPumpService.filterByStatus("Active");
        setAirPumps(response.data || response);
      } catch (error) {
        console.error("Error fetching active air pumps:", error);
      }
    };
    fetchActiveAirPumps();
  }, []);

  // Fetch active flowmeters when component mounts
  useEffect(() => {
    const fetchActiveFlowmeters = async () => {
      try {
        const response = await equipmentService.getAll();
        console.log("Equipment response:", response);
        const allEquipment = response.equipment || response.data || response;
        console.log("All equipment:", allEquipment);
        const flowmeters = allEquipment.filter(
          (equipment) =>
            (equipment.equipmentType === "Bubble flowmeter" ||
              equipment.equipmentType === "Site flowmeter") &&
            equipment.status === "active"
        );
        console.log("Filtered flowmeters:", flowmeters);
        setFlowmeters(flowmeters);
      } catch (error) {
        console.error("Error fetching active flowmeters:", error);
      }
    };
    fetchActiveFlowmeters();
  }, []);

  // Fetch sample data
  useEffect(() => {
    const fetchSample = async () => {
      try {
        setIsLoading(true);
        const response = await sampleService.getById(sampleId);
        const sampleData = response.data;
        console.log("Fetched sample data:", sampleData);

        // Extract the sample number from fullSampleID
        const sampleNumber = sampleData.fullSampleID.split("-")[1];

        // Get project ID from the job's project
        if (sampleData.job && sampleData.job.projectId) {
          setProjectID(sampleData.job.projectId.projectID);
        } else {
          // If project is not populated, fetch the job to get project details
          const jobResponse = await asbestosRemovalJobService.getById(
            sampleData.job
          );
          if (jobResponse.data && jobResponse.data.projectId) {
            setProjectID(jobResponse.data.projectId.projectID);
          }
        }

        setForm({
          sampleNumber: sampleNumber,
          type: sampleData.type,
          location: sampleData.location,
          pumpNo: sampleData.pumpNo || "",
          flowmeter: sampleData.flowmeter || "",
          cowlNo: sampleData.cowlNo || "",
          filterSize: sampleData.filterSize || "",
          startTime: sampleData.startTime || "",
          endTime: sampleData.endTime || "",
          initialFlowrate: sampleData.initialFlowrate || "",
          finalFlowrate: sampleData.finalFlowrate || "",
          averageFlowrate: sampleData.averageFlowrate || "",
          notes: sampleData.notes || "",
          sampler: sampleData.collectedBy?._id || sampleData.collectedBy || "",
          isFieldBlank:
            sampleData.isFieldBlank || sampleData.location === "Field blank"
              ? true
              : false,
          status: sampleData.status || "pending",
        });
        setJob(sampleData.job);
        setError(null);
      } catch (err) {
        console.error("Error fetching sample:", err);
        setError("Failed to load sample details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSample();
  }, [sampleId]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;

    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    if (name === "isFieldBlank") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
        location: checked ? "Field blank" : prev.location,
      }));
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Calculate average flowrate when initial or final flowrate changes
  useEffect(() => {
    // Don't run this effect if we're currently submitting or if there are any field errors
    if (isSubmitting || Object.keys(fieldErrors).length > 0) return;

    if (form.initialFlowrate && form.finalFlowrate) {
      const avg =
        (parseFloat(form.initialFlowrate) + parseFloat(form.finalFlowrate)) / 2;

      // Check if flowrates are equal to determine status
      const initial = parseFloat(form.initialFlowrate);
      const final = parseFloat(form.finalFlowrate);
      const newStatus = Math.abs(initial - final) < 0.1 ? "pending" : "failed";

      setForm((prev) => ({
        ...prev,
        averageFlowrate: Math.round(avg).toString(),
        status: newStatus,
      }));
    } else {
      // Clear average flowrate and status if either flowrate is missing
      setForm((prev) => ({
        ...prev,
        averageFlowrate: "",
        status: "pending",
      }));
    }
  }, [form.initialFlowrate, form.finalFlowrate, isSubmitting, fieldErrors]);

  // Separate effect to ensure sample number is calculated when projectID is available
  useEffect(() => {
    const calculateSampleNumber = async () => {
      if (!projectID) return;

      try {
        const allProjectSamplesResponse = await sampleService.getByProject(
          projectID
        );
        const allProjectSamples = allProjectSamplesResponse.data || [];

        // Find the highest sample number across all shifts
        const highestNumber = Math.max(
          ...allProjectSamples.map((sample) => {
            // Only consider air monitoring samples (with AM prefix in sample number)
            if (sample.fullSampleID?.startsWith(`${projectID}-AM`)) {
              const match = sample.fullSampleID?.match(/AM(\d+)$/);
              return match ? parseInt(match[1]) : 0;
            }
            return 0; // Ignore non-AM samples
          }),
          0 // Start from 0 if no samples exist
        );

        const nextSampleNumber = `AM${highestNumber + 1}`;
        console.log(
          "Auto-calculated next sample number for edit:",
          nextSampleNumber
        );

        // Only update if we don't already have a sample number
        if (!form.sampleNumber) {
          setForm((prev) => ({
            ...prev,
            sampleNumber: nextSampleNumber.toString(),
          }));
        }
      } catch (error) {
        console.error("Error auto-calculating sample number for edit:", error);
        // Set default if calculation fails and no sample number exists
        if (!form.sampleNumber) {
          setForm((prev) => ({
            ...prev,
            sampleNumber: "AM1",
          }));
        }
      }
    };

    calculateSampleNumber();
  }, [projectID, form.sampleNumber]);

  const setCurrentTime = (field) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setForm((prev) => ({ ...prev, [field]: timeString }));
  };

  const validateForm = () => {
    const errors = {};

    if (!form.sampler) {
      errors.sampler = "Sampler is required";
    }

    if (!form.sampleNumber) {
      errors.sampleNumber = "Sample number is required";
    }

    if (!form.flowmeter) {
      errors.flowmeter = "Flowmeter is required";
    }

    if (!form.isFieldBlank) {
      if (!form.location) {
        errors.location = "Location is required";
      }
      if (!form.type) {
        errors.type = "Type is required";
      }
      if (!form.startTime) {
        errors.startTime = "Start time is required";
      }
      if (!form.initialFlowrate) {
        errors.initialFlowrate = "Initial flowrate is required";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    // Prevent any default behavior if event is provided
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError("");
    setFieldErrors({});

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("Starting sample update...");
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

      // Generate full sample ID in the format: {projectID}-{sampleNumber}
      const fullSampleID = `${projectID}-${form.sampleNumber}`;
      console.log("Generated full sample ID:", fullSampleID);

      // Map sample type to match backend enum
      const sampleType = form.type;

      // Format times to include seconds
      const formatTime = (time) => {
        if (!time) return "";
        return time.includes(":") ? time : `${time}:00`;
      };

      const sampleData = {
        shift: shiftId,
        job: job._id,
        sampleNumber: form.sampleNumber,
        fullSampleID: fullSampleID,
        type: sampleType || null,
        location: form.location || null,
        pumpNo: form.pumpNo || null,
        flowmeter: form.flowmeter || null,
        cowlNo: form.cowlNo || null,
        sampler: form.sampler,
        filterSize: form.filterSize || null,
        startTime: form.startTime ? formatTime(form.startTime) : null,
        endTime: form.endTime ? formatTime(form.endTime) : null,
        initialFlowrate: form.initialFlowrate
          ? parseFloat(form.initialFlowrate)
          : null,
        finalFlowrate: form.finalFlowrate
          ? parseFloat(form.finalFlowrate)
          : null,
        averageFlowrate: form.averageFlowrate
          ? parseFloat(form.averageFlowrate)
          : null,
        status: form.status || "pending",
        notes: form.notes || null,
        collectedBy: form.sampler,
      };

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
        <Typography>Loading sample details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography color="error">{error}</Typography>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ mt: 2 }}
        >
          Back to Samples
        </Button>
      </Box>
    );
  }

  if (isSubmitting) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Updating sample...</Typography>
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

      <Box component="form" noValidate>
        <Stack spacing={3} sx={{ maxWidth: 600 }}>
          <FormControl fullWidth required error={!!fieldErrors.sampler}>
            <InputLabel>Sampler</InputLabel>
            <Select
              name="sampler"
              value={form.sampler}
              onChange={handleChange}
              label="Sampler"
              required
            >
              {asbestosAssessors.map((assessor) => (
                <MenuItem key={assessor._id} value={assessor._id}>
                  {assessor.firstName} {assessor.lastName}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.sampler && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {fieldErrors.sampler}
              </Typography>
            )}
          </FormControl>
          <TextField
            name="sampleNumber"
            label="Sample Number"
            value={form.sampleNumber}
            onChange={handleChange}
            required
            fullWidth
            disabled
            error={!!fieldErrors.sampleNumber}
            helperText={
              fieldErrors.sampleNumber
                ? fieldErrors.sampleNumber
                : projectID
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
              <FormControl fullWidth required error={!!fieldErrors.type}>
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
                {fieldErrors.type && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.type}
                  </Typography>
                )}
              </FormControl>
              <TextField
                name="location"
                label="Location"
                value={form.location}
                onChange={handleChange}
                required
                fullWidth
                error={!!fieldErrors.location}
                helperText={fieldErrors.location}
              />
              <FormControl fullWidth>
                <InputLabel>Pump No.</InputLabel>
                <Select
                  name="pumpNo"
                  value={form.pumpNo}
                  onChange={handleChange}
                  label="Pump No."
                >
                  <MenuItem value="">
                    <em>Select a pump</em>
                  </MenuItem>
                  {airPumps.map((pump) => (
                    <MenuItem key={pump._id} value={pump.pumpReference}>
                      {pump.pumpReference} - {pump.pumpDetails}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                name="cowlNo"
                label="Cowl No."
                value={form.cowlNo}
                onChange={handleChange}
                required
                fullWidth
                error={!!fieldErrors.cowlNo}
                helperText={fieldErrors.cowlNo}
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
              <FormControl
                fullWidth
                required={!form.isFieldBlank}
                error={!!fieldErrors.flowmeter}
              >
                <InputLabel>Flowmeter</InputLabel>
                <Select
                  name="flowmeter"
                  value={form.flowmeter}
                  onChange={handleChange}
                  label="Flowmeter"
                  required={!form.isFieldBlank}
                >
                  <MenuItem value="">
                    <em>Select a flowmeter</em>
                  </MenuItem>
                  {flowmeters.map((flowmeter) => (
                    <MenuItem
                      key={flowmeter._id}
                      value={flowmeter.equipmentReference}
                    >
                      {flowmeter.equipmentReference} - {flowmeter.brandModel} (
                      {flowmeter.equipmentType})
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.flowmeter && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.flowmeter}
                  </Typography>
                )}
              </FormControl>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.primary.main,
                  borderBottom: `2px solid ${theme.palette.primary.main}`,
                  pb: 1,
                  mb: 2,
                }}
              >
                Air-monitor Setup
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField
                  name="startTime"
                  label="Start Time"
                  type="time"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                  fullWidth
                  error={!!fieldErrors.startTime}
                  helperText={fieldErrors.startTime}
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
              <TextField
                name="initialFlowrate"
                label="Initial Flowrate (L/min)"
                type="number"
                value={form.initialFlowrate}
                onChange={handleChange}
                required
                fullWidth
                error={!!fieldErrors.initialFlowrate}
                helperText={fieldErrors.initialFlowrate}
                inputProps={{ step: "0.1" }}
              />
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.primary.main,
                  borderBottom: `2px solid ${theme.palette.primary.main}`,
                  pb: 1,
                  mb: 2,
                  mt: 3,
                }}
              >
                Air-monitor Collection
              </Typography>
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
                value={
                  form.status === "failed"
                    ? "FAILED - Flowrates don't match"
                    : form.averageFlowrate
                }
                disabled
                required
                fullWidth
                sx={{
                  "& .MuiInputBase-input": {
                    color:
                      form.status === "failed" ? "error.main" : "text.primary",
                    fontWeight: form.status === "failed" ? "bold" : "normal",
                  },
                }}
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
              type="button"
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitting}
              sx={{
                backgroundColor: theme.palette.primary.main,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                "&:disabled": {
                  backgroundColor: theme.palette.grey[400],
                },
              }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default EditSample;
