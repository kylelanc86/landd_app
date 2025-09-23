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
import RefreshIcon from "@mui/icons-material/Refresh";
import { sampleService, shiftService, userService } from "../../services/api";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import airPumpService from "../../services/airPumpService";
import { equipmentService } from "../../services/equipmentService";
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
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [airPumps, setAirPumps] = useState([]);
  const [flowmeters, setFlowmeters] = useState([]);
  const [form, setForm] = useState({
    sampleNumber: "",
    type: "Background",
    location: "",
    pumpNo: "",
    flowmeter: "",
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
    status: "pending",
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState(null);

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
        const pumps = response.data || response;
        setAirPumps(pumps);
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
        console.log("Fetching flowmeters...");
        const response = await equipmentService.getAll();
        console.log("Equipment response:", response);

        if (!response) {
          console.error("No response from equipment service");
          return;
        }

        const allEquipment = response.equipment || response.data || response;
        console.log("All equipment:", allEquipment);

        if (!Array.isArray(allEquipment)) {
          console.error("Equipment data is not an array:", allEquipment);
          return;
        }

        const flowmeters = allEquipment.filter(
          (equipment) =>
            (equipment.equipmentType === "Bubble flowmeter" ||
              equipment.equipmentType === "Site flowmeter") &&
            equipment.status === "active"
        );
        console.log("Filtered flowmeters:", flowmeters);
        console.log("Flowmeter count:", flowmeters.length);
        setFlowmeters(flowmeters);
      } catch (error) {
        console.error("Error fetching active flowmeters:", error);
        console.error("Error details:", error.response?.data || error.message);
      }
    };
    fetchActiveFlowmeters();
  }, []);

  useEffect(() => {
    const fetchShift = async () => {
      try {
        const response = await shiftService.getById(shiftId);
        console.log("Full shift response:", response.data);
        setShift(response.data);

        // Get the project ID from the shift's job
        const projectID = response.data.job?.projectId?.projectID;
        if (projectID) {
          setProjectID(projectID);

          // Get the next sample number from location state (project-based)
          const nextNumber = location.state?.nextSampleNumber;
          console.log("Next sample number from location:", nextNumber);

          // Always calculate the next sample number to ensure proper AM format
          try {
            const allProjectSamplesResponse = await sampleService.getByProject(
              projectID
            );
            const allProjectSamples = allProjectSamplesResponse.data || [];
            console.log("All project samples:", allProjectSamples);
            console.log("Project ID:", projectID);

            // Find the highest sample number across all shifts
            const highestNumber = Math.max(
              ...allProjectSamples.map((sample) => {
                console.log("Processing sample:", {
                  fullSampleID: sample.fullSampleID,
                  sampleNumber: sample.sampleNumber,
                  projectID: projectID,
                });

                // Check both fullSampleID and sampleNumber for AM prefix
                const hasAMPrefix =
                  sample.fullSampleID?.startsWith(`${projectID}-AM`) ||
                  sample.sampleNumber?.startsWith("AM");

                if (hasAMPrefix) {
                  // Try to extract from fullSampleID first, then sampleNumber
                  let match = sample.fullSampleID?.match(/AM(\d+)$/);
                  if (!match && sample.sampleNumber) {
                    match = sample.sampleNumber.match(/AM(\d+)$/);
                  }
                  const number = match ? parseInt(match[1]) : 0;
                  console.log("Extracted number:", number);
                  return number;
                }
                console.log("Sample ignored - no AM prefix");
                return 0; // Ignore non-AM samples
              }),
              0 // Start from 0 if no samples exist
            );

            const nextSampleNumber = `AM${highestNumber + 1}`;
            console.log("Calculated next sample number:", nextSampleNumber);

            setForm((prev) => ({
              ...prev,
              sampleNumber: nextSampleNumber.toString(),
            }));
          } catch (error) {
            console.error("Error calculating next sample number:", error);
            // Start from 1 if we can't calculate
            setForm((prev) => ({
              ...prev,
              sampleNumber: "AM1",
            }));
          }
        }

        // Get the number of samples in this shift for display purposes only
        const samplesResponse = await sampleService.getByShift(shiftId);
        const samplesInShift = samplesResponse.data || [];
        console.log("Number of samples in shift:", samplesInShift.length);

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

        // Handle default flowmeter logic
        if (!response.data.defaultFlowmeter && samplesInShift.length > 0) {
          const firstSample = samplesInShift[0];
          console.log("First sample in shift for flowmeter:", firstSample);

          if (firstSample.flowmeter) {
            console.log(
              "Setting default flowmeter from first sample:",
              firstSample.flowmeter
            );
            try {
              const shiftUpdateResponse = await shiftService.update(shiftId, {
                defaultFlowmeter: firstSample.flowmeter,
              });
              console.log(
                "Shift updated with default flowmeter from first sample:",
                shiftUpdateResponse
              );

              // Set the flowmeter in the form
              setForm((prev) => ({
                ...prev,
                flowmeter: firstSample.flowmeter,
              }));
            } catch (error) {
              console.error(
                "Error setting default flowmeter from first sample:",
                error
              );
            }
          }
        }
        // If there is a default flowmeter, use it for subsequent samples
        else if (response.data.defaultFlowmeter) {
          console.log(
            "Setting default flowmeter from shift:",
            response.data.defaultFlowmeter
          );
          setForm((prev) => {
            const updatedForm = {
              ...prev,
              flowmeter: response.data.defaultFlowmeter,
            };
            console.log("Updated form with flowmeter:", updatedForm);
            return updatedForm;
          });
        }

        // Fetch job details
        if (response.data.job?._id) {
          try {
            const jobResponse = await asbestosRemovalJobService.getById(
              response.data.job._id
            );
            setJob(jobResponse.data);
          } catch (error) {
            console.error("Error fetching job details:", error);
          }
        }
      } catch (err) {
        console.error("Error fetching shift:", err);
        setError("Failed to load shift details");
      }
    };

    fetchShift();
  }, [shiftId, location.state]);

  // Effect to handle flowmeter persistence when flowmeters are loaded
  useEffect(() => {
    if (flowmeters.length > 0 && shift && shift.defaultFlowmeter) {
      console.log(
        "Flowmeters loaded, checking for default flowmeter:",
        shift.defaultFlowmeter
      );
      console.log(
        "Available flowmeter references:",
        flowmeters.map((f) => f.equipmentReference)
      );

      // Check if the default flowmeter exists in the available flowmeters
      const defaultFlowmeterExists = flowmeters.some(
        (f) => f.equipmentReference === shift.defaultFlowmeter
      );

      if (defaultFlowmeterExists && !form.flowmeter) {
        console.log(
          "Setting default flowmeter from shift after flowmeters loaded"
        );
        setForm((prev) => ({
          ...prev,
          flowmeter: shift.defaultFlowmeter,
        }));
      }
    }
  }, [flowmeters, shift, form.flowmeter]);

  // Remove the separate sample number calculation effect that's causing conflicts
  // useEffect(() => {
  //   const calculateSampleNumber = async () => {
  //     if (!projectID) return;

  //     try {
  //       const allProjectSamplesResponse = await sampleService.getByProject(
  //         projectID
  //       );
  //       const allProjectSamples = allProjectSamplesResponse.data || [];

  //       // Find the highest sample number across all shifts
  //       const highestNumber = Math.max(
  //         ...allProjectSamples.map((sample) => {
  //           // Only consider air monitoring samples (with AM prefix in sample number)
  //           if (sample.fullSampleID?.startsWith(`${projectID}-AM`)) {
  //             const match = sample.fullSampleID?.match(/AM(\d+)$/);
  //             return match ? parseInt(match[1]) : 0;
  //             }
  //           return 0; // Ignore non-AM samples
  //         }),
  //         0 // Start from 0 if no samples exist
  //       );

  //       const nextSampleNumber = `AM${highestNumber + 1}`;
  //       console.log("Auto-calculated next sample number:", nextSampleNumber);

  //       setForm((prev) => ({
  //         ...prev,
  //         sampleNumber: nextSampleNumber.toString(),
  //       }));
  //     } catch (error) {
  //       console.error("Error auto-calculating sample number:", error);
  //       // Set default if calculation fails
  //       setForm((prev) => ({
  //         ...prev,
  //         sampleNumber: "AM1",
  //       }));
  //     }
  //   };

  //   calculateSampleNumber();
  // }, [projectID]);

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
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
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

  const setCurrentTime = (field) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setForm((prev) => ({ ...prev, [field]: timeString }));
  };

  const validateForm = async () => {
    const errors = {};

    if (!form.sampler) {
      errors.sampler = "Sampler is required";
    }

    if (!form.sampleNumber) {
      errors.sampleNumber = "Sample number is required";
    } else {
      // Check if sample number is unique across the project
      try {
        if (projectID) {
          const allProjectSamplesResponse = await sampleService.getByProject(
            projectID
          );
          const allProjectSamples = allProjectSamplesResponse.data || [];

          const isDuplicate = allProjectSamples.some((sample) => {
            // Only check against air monitoring samples (with AM prefix in sample number)
            if (sample.fullSampleID?.startsWith(`${projectID}-AM`)) {
              const extractedNumber =
                sample.fullSampleID?.match(/AM(\d+)$/)?.[1];
              return extractedNumber === form.sampleNumber.replace("AM", "");
            }
            return false; // Not an AM sample, so no conflict
          });

          if (isDuplicate) {
            errors.sampleNumber =
              "Sample number already exists in this project. Please use a different number.";
          }
        }
      } catch (error) {
        console.error("Error checking sample number uniqueness:", error);
        // Don't block submission if we can't check uniqueness
      }
    }

    if (!form.isFieldBlank && !form.flowmeter) {
      // Only require flowmeter if user has explicitly set isFieldBlank to false
      // During initial load, isFieldBlank defaults to false but shouldn't block sample number calculation
      if (form.isFieldBlank === false) {
        errors.flowmeter = "Flowmeter is required for non-field blank samples";
      }
    }

    if (!form.cowlNo) {
      errors.cowlNo = "Cowl No. is required";
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
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);

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

      // Get the number of samples in this shift for first sample detection
      const samplesResponse = await sampleService.getByShift(shiftId);
      const samplesInShift = samplesResponse.data || [];

      // If this is the first sample in the shift and we have a sampler, set it as the default
      if (samplesInShift.length === 0 && form.sampler) {
        try {
          await shiftService.update(shiftId, {
            defaultSampler: form.sampler,
          });
        } catch (error) {
          // Don't throw the error, just log it and continue
        }
      }

      // If this is the first sample in the shift and we have a flowmeter, set it as the default
      if (samplesInShift.length === 0 && form.flowmeter) {
        try {
          await shiftService.update(shiftId, {
            defaultFlowmeter: form.flowmeter,
          });
        } catch (error) {
          // Don't throw the error, just log it and continue
        }
      }

      // Create the sample
      const sampleData = {
        ...form,
        shift: shiftId,
        job: job._id,
        jobModel: shift.jobModel, // Add jobModel from shift
        fullSampleID: `${projectID}-${form.sampleNumber}`,
        sampler: form.sampler,
        collectedBy: form.sampler,
        flowmeter: form.flowmeter || null, // Explicitly include flowmeter
        initialFlowrate: form.initialFlowrate
          ? parseFloat(form.initialFlowrate)
          : null,
        finalFlowrate: form.finalFlowrate
          ? parseFloat(form.finalFlowrate)
          : null,
        averageFlowrate: form.averageFlowrate
          ? parseFloat(form.averageFlowrate)
          : null,
      };

      await sampleService.create(sampleData);

      // Navigate immediately after successful creation
      navigate(`/air-monitoring/shift/${shiftId}/samples`);
    } catch (error) {
      console.error("Error creating sample:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to create sample"
      );
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
          <Box>
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
          </Box>
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
            </>
          )}
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
          {!form.isFieldBlank && (
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
          )}
          {!form.isFieldBlank && (
            <>
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
              {isSubmitting ? "Saving..." : "Save Sample"}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default NewSample;
