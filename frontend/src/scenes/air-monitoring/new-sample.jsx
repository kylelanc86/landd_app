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
  Backdrop,
  CircularProgress,
  Paper,
  InputAdornment,
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

const FIELD_BLANK_LOCATION = "Field blank";
const NEG_AIR_EXHAUST_LOCATION = "Neg air exhaust";

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
    nextDay: false,
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
    isFieldBlank: false,
    isNegAirExhaust: false,
    sampler: "",
    status: "pending",
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCriticalData, setLoadingCriticalData] = useState(true);
  const [shift, setShift] = useState(null);
  const [projectSamples, setProjectSamples] = useState([]);
  const [shiftSamples, setShiftSamples] = useState([]);
  const [insufficientSampleTime, setInsufficientSampleTime] = useState(false);

  const isSimplifiedSample = form.isFieldBlank || form.isNegAirExhaust;

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

  // Fetch active flowmeters when component mounts (critical for form)
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
            equipment.equipmentType === "Site flowmeter" &&
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
    const fetchCriticalData = async () => {
      try {
        setLoadingCriticalData(true);
        setError("");

        // Parallelize critical API calls
        const [shiftResponse, samplesInShiftResponse] = await Promise.all([
          shiftService.getById(shiftId),
          sampleService.getByShift(shiftId),
        ]);

        const shiftData = shiftResponse.data;
        setShift(shiftData);
        const samplesInShift = samplesInShiftResponse.data || [];
        setShiftSamples(samplesInShift);
        console.log("Number of samples in shift:", samplesInShift.length);

        // Get the project ID from the shift's job
        const projectID = shiftData.job?.projectId?.projectID;
        if (!projectID) {
          setError("Project ID not found in shift data");
          setLoadingCriticalData(false);
          return;
        }

        setProjectID(projectID);

        // Parallelize project samples fetch and job fetch
        const [allProjectSamplesResponse, jobResponse] = await Promise.all([
          sampleService.getByProject(projectID).catch((err) => {
            console.error("Error fetching project samples:", err);
            return { data: [] };
          }),
          shiftData.job?._id
            ? asbestosRemovalJobService
                .getById(shiftData.job._id)
                .catch((err) => {
                  console.error("Error fetching job details:", err);
                  return null;
                })
            : Promise.resolve(null),
        ]);

        const allProjectSamples = allProjectSamplesResponse.data || [];
        setProjectSamples(allProjectSamples);
        if (jobResponse?.data) {
          setJob(jobResponse.data);
        }

        // Calculate next sample number
        try {
          const highestNumber = Math.max(
            ...allProjectSamples.map((sample) => {
              const hasAMPrefix =
                sample.fullSampleID?.startsWith(`${projectID}-AM`) ||
                sample.sampleNumber?.startsWith("AM");

              if (hasAMPrefix) {
                let match = sample.fullSampleID?.match(/AM(\d+)$/);
                if (!match && sample.sampleNumber) {
                  match = sample.sampleNumber.match(/AM(\d+)$/);
                }
                return match ? parseInt(match[1]) : 0;
              }
              return 0;
            }),
            0
          );

          const nextSampleNumber = `AM${highestNumber + 1}`;
          console.log("Calculated next sample number:", nextSampleNumber);

          setForm((prev) => ({
            ...prev,
            sampleNumber: nextSampleNumber.toString(),
          }));
        } catch (error) {
          console.error("Error calculating next sample number:", error);
          setForm((prev) => ({
            ...prev,
            sampleNumber: "AM1",
          }));
        }

        // Determine sampler - prioritize defaultSampler, then first sample
        let samplerToSet = null;
        if (shiftData.defaultSampler) {
          samplerToSet =
            shiftData.defaultSampler._id || shiftData.defaultSampler;
          console.log("Using default sampler from shift:", samplerToSet);
        } else if (samplesInShift.length > 0 && samplesInShift[0].collectedBy) {
          samplerToSet = samplesInShift[0].collectedBy;
          console.log("Using sampler from first sample:", samplerToSet);
          // Update shift with default sampler in background (don't await)
          shiftService
            .update(shiftId, {
              defaultSampler: samplerToSet,
            })
            .catch((err) => {
              console.error("Error updating shift with default sampler:", err);
            });
        }

        if (samplerToSet) {
          setForm((prev) => ({
            ...prev,
            sampler: samplerToSet,
          }));
        }

        // Determine flowmeter - prioritize defaultFlowmeter, then first sample
        let flowmeterToSet = null;
        if (shiftData.defaultFlowmeter) {
          flowmeterToSet = shiftData.defaultFlowmeter;
          console.log("Using default flowmeter from shift:", flowmeterToSet);
        } else if (samplesInShift.length > 0 && samplesInShift[0].flowmeter) {
          flowmeterToSet = samplesInShift[0].flowmeter;
          console.log("Using flowmeter from first sample:", flowmeterToSet);
          // Update shift with default flowmeter in background (don't await)
          shiftService
            .update(shiftId, {
              defaultFlowmeter: flowmeterToSet,
            })
            .catch((err) => {
              console.error(
                "Error updating shift with default flowmeter:",
                err
              );
            });
        }

        if (flowmeterToSet) {
          setForm((prev) => ({
            ...prev,
            flowmeter: flowmeterToSet,
          }));
        }

        // Critical data is now loaded
        setLoadingCriticalData(false);
      } catch (err) {
        console.error("Error fetching critical data:", err);
        setError("Failed to load shift details");
        setLoadingCriticalData(false);
      }
    };

    fetchCriticalData();
  }, [shiftId, location.state]);

  // Effect to handle flowmeter persistence when flowmeters are loaded
  // This ensures the flowmeter is set once flowmeters list is available
  useEffect(() => {
    if (
      flowmeters.length > 0 &&
      shift &&
      shift.defaultFlowmeter &&
      !form.flowmeter
    ) {
      console.log(
        "Flowmeters loaded, checking for default flowmeter:",
        shift.defaultFlowmeter
      );

      // Check if the default flowmeter exists in the available flowmeters
      const defaultFlowmeterExists = flowmeters.some(
        (f) => f.equipmentReference === shift.defaultFlowmeter
      );

      if (defaultFlowmeterExists) {
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
      setForm((prev) => {
        const next = {
          ...prev,
          [name]: checked,
          location: checked ? FIELD_BLANK_LOCATION : prev.location,
          type: checked
            ? "-"
            : prev.type === "-"
            ? "Background"
            : prev.type || "Background",
        };

        if (checked) {
          next.isNegAirExhaust = false;
        }

        return next;
      });
      return;
    }

    if (name === "isNegAirExhaust") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
        isFieldBlank: checked ? false : prev.isFieldBlank,
        location:
          checked && !prev.location ? NEG_AIR_EXHAUST_LOCATION : prev.location,
        // Clear flowrate fields when checked
        initialFlowrate: checked ? "" : prev.initialFlowrate,
        finalFlowrate: checked ? "" : prev.finalFlowrate,
        averageFlowrate: checked ? "" : prev.averageFlowrate,
      }));
      return;
    }

    // Handle nextDay checkbox
    if (name === "nextDay") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle cowlNo to ensure "C" prefix is always present but not editable
    // Store value without "C" in state (InputAdornment displays "C" visually)
    if (name === "cowlNo") {
      // Remove any "C" prefix if user types it (since InputAdornment shows it as non-editable prefix)
      const cleanedValue = value.replace(/^C+/i, "");
      setForm((prev) => ({
        ...prev,
        [name]: cleanedValue,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
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
        averageFlowrate: avg.toFixed(1),
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

  // Calculate minutes from start and end times
  const calculateMinutes = (startTime, endTime, nextDay = false) => {
    if (!startTime || !endTime) return null;

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    // Handle case where end time is next day (either explicitly checked or inferred)
    let diffMinutes = endTotalMinutes - startTotalMinutes;
    if (nextDay || diffMinutes < 0) {
      diffMinutes += 24 * 60; // Add 24 hours
    }

    return diffMinutes;
  };

  // Validate sample time based on filter size
  useEffect(() => {
    if (isSimplifiedSample) {
      setInsufficientSampleTime(false);
      return;
    }

    if (!form.startTime || !form.endTime || !form.finalFlowrate) {
      setInsufficientSampleTime(false);
      return;
    }

    const minutes = calculateMinutes(
      form.startTime,
      form.endTime,
      form.nextDay
    );
    if (minutes === null) {
      setInsufficientSampleTime(false);
      return;
    }

    const filterSize = form.filterSize || "25mm";
    let isInsufficient = false;

    if (filterSize === "25mm") {
      const totalVolume = minutes * parseFloat(form.finalFlowrate);
      isInsufficient = totalVolume < 360;
    } else if (filterSize === "13mm") {
      isInsufficient = minutes < 90;
    }

    setInsufficientSampleTime(isInsufficient);
  }, [
    form.startTime,
    form.endTime,
    form.nextDay,
    form.finalFlowrate,
    form.filterSize,
    isSimplifiedSample,
  ]);

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
      // Check if sample number is unique across the project using cached samples
      if (projectID && projectSamples.length > 0) {
        const isDuplicate = projectSamples.some((sample) => {
          if (sample.fullSampleID?.startsWith(`${projectID}-AM`)) {
            const extractedNumber = sample.fullSampleID?.match(/AM(\d+)$/)?.[1];
            return extractedNumber === form.sampleNumber.replace("AM", "");
          }
          return false;
        });

        if (isDuplicate) {
          errors.sampleNumber =
            "Sample number already exists in this project. Please use a different number.";
        }
      } else if (projectID && projectSamples.length === 0) {
        console.warn(
          "[NewSample] Unable to validate sample number uniqueness - project samples not loaded"
        );
      }
    }

    if (!isSimplifiedSample && !form.flowmeter) {
      // Only require flowmeter if user has explicitly set isFieldBlank to false
      // During initial load, isFieldBlank defaults to false but shouldn't block sample number calculation
      if (form.isFieldBlank === false) {
        errors.flowmeter =
          "Flowmeter is required for non-field blank and non-neg air exhaust samples";
      }
    }

    if (!form.cowlNo || form.cowlNo.trim() === "") {
      errors.cowlNo = "Cowl No. is required";
    }

    if (!isSimplifiedSample) {
      if (!form.location) {
        errors.location = "Location is required";
      }
      if (!form.type) {
        errors.type = "Type is required";
      }
      if (!form.startTime) {
        errors.startTime = "Start time is required";
      }
      if (!form.isNegAirExhaust && !form.initialFlowrate) {
        errors.initialFlowrate = "Initial flowrate is required";
      }
    } else if (form.isNegAirExhaust) {
      // Neg air exhaust samples require location (field blanks have fixed location)
      if (!form.location) {
        errors.location = "Location is required";
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

    const logLabel = "[NewSample] handleSubmit";
    console.time(`${logLabel} total`);
    console.time(`${logLabel} validation`);

    setError("");
    setFieldErrors({});

    // Validate form before submission
    const isValid = await validateForm();
    console.timeEnd(`${logLabel} validation`);
    if (!isValid) {
      console.timeEnd(`${logLabel} total`);
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

      const currentShiftSampleCount = shiftSamples.length;
      const shiftUpdatePayload = {};
      // If this is the first sample in the shift and we have a sampler, set it as the default
      if (currentShiftSampleCount === 0 && form.sampler) {
        shiftUpdatePayload.defaultSampler = form.sampler;
      }

      // If this is the first sample in the shift and we have a flowmeter, set it as the default
      if (currentShiftSampleCount === 0 && form.flowmeter) {
        shiftUpdatePayload.defaultFlowmeter = form.flowmeter;
      }

      if (Object.keys(shiftUpdatePayload).length > 0) {
        console.time(`${logLabel} shiftUpdate`);
        try {
          await shiftService.update(shiftId, shiftUpdatePayload);
        } catch (updateError) {
          console.error(
            "[NewSample] Error updating shift defaults:",
            updateError
          );
        } finally {
          console.timeEnd(`${logLabel} shiftUpdate`);
        }
      }

      // Create the sample
      console.time(`${logLabel} create`);
      // Ensure cowlNo has "C" prefix
      const cowlNoWithPrefix =
        form.cowlNo && !form.cowlNo.startsWith("C")
          ? `C${form.cowlNo}`
          : form.cowlNo || "";
      const sampleData = {
        ...form,
        shift: shiftId,
        job: job._id,
        jobModel: shift.jobModel, // Add jobModel from shift
        fullSampleID: `${projectID}-${form.sampleNumber}`,
        sampler: form.sampler,
        collectedBy: form.sampler,
        type: form.isFieldBlank ? "-" : form.type, // Set type to "-" for field blanks
        flowmeter: form.flowmeter || null, // Explicitly include flowmeter
        cowlNo: cowlNoWithPrefix, // Ensure "C" prefix is included
        nextDay: form.nextDay || false, // Ensure boolean value
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
      console.timeEnd(`${logLabel} create`);

      // Update local cache to reflect the new sample
      setShiftSamples((prev) => [...prev, sampleData]);
      setProjectSamples((prev) => [...prev, sampleData]);

      // Navigate immediately after successful creation
      navigate(`/air-monitoring/shift/${shiftId}/samples`);
    } catch (error) {
      if (console.timeLog) {
        try {
          console.timeLog(`${logLabel} total`);
        } catch (logError) {
          // ignore consoles without timeLog
        }
      }
      console.error("Error creating sample:", error);
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to create sample"
      );
      setIsSubmitting(false);
    } finally {
      try {
        console.timeEnd(`${logLabel} total`);
      } catch (endError) {
        // ignore console timer errors (e.g., double-ending)
      }
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, position: "relative" }}>
      {/* Loading overlay for critical data */}
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
        open={loadingCriticalData}
      >
        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            minWidth: 300,
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
          }}
        >
          <CircularProgress size={40} thickness={4} sx={{ color: "#1976d2" }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: "#333",
              textAlign: "center",
            }}
          >
            Loading sample data...
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "#666",
              textAlign: "center",
              maxWidth: 250,
            }}
          >
            Preparing sampler, sample number, and flowmeter information
          </Typography>
        </Paper>
      </Backdrop>
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
          <Box sx={{ display: "flex", gap: 2 }}>
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
            <FormControlLabel
              control={
                <Checkbox
                  name="isNegAirExhaust"
                  checked={form.isNegAirExhaust}
                  onChange={handleChange}
                />
              }
              label="Neg Air Exhaust"
            />
          </Box>
          {!isSimplifiedSample && (
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
                autoComplete="off"
                value={form.location}
                onChange={handleChange}
                required
                fullWidth
                error={!!fieldErrors.location}
                helperText={fieldErrors.location}
              />
            </>
          )}
          {isSimplifiedSample && (
            <TextField
              name="location"
              label="Location"
              autoComplete="off"
              value={
                form.isFieldBlank ? FIELD_BLANK_LOCATION : form.location || ""
              }
              onChange={handleChange}
              disabled={form.isFieldBlank}
              required
              fullWidth
              error={!!fieldErrors.location}
              helperText={fieldErrors.location}
            />
          )}
          {!isSimplifiedSample && (
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
            value={form.cowlNo || ""}
            onChange={handleChange}
            required
            fullWidth
            error={!!fieldErrors.cowlNo}
            helperText={fieldErrors.cowlNo}
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">C</InputAdornment>
              ),
            }}
          />
          {!isSimplifiedSample && (
            <FormControl
              fullWidth
              required={!isSimplifiedSample}
              error={!!fieldErrors.flowmeter}
            >
              <InputLabel>Flowmeter</InputLabel>
              <Select
                name="flowmeter"
                value={form.flowmeter}
                onChange={handleChange}
                label="Flowmeter"
                required={!isSimplifiedSample}
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
          {!isSimplifiedSample && (
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
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                  name="endTime"
                  label="End Time"
                  type="time"
                  value={form.endTime}
                  onChange={handleChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 60 }}
                  error={insufficientSampleTime}
                  helperText={
                    insufficientSampleTime ? "Insufficient sample time" : ""
                  }
                />
                <IconButton
                  onClick={() => setCurrentTime("endTime")}
                  sx={{ alignSelf: "flex-end", mb: 1 }}
                >
                  <AccessTimeIcon />
                </IconButton>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    name="nextDay"
                    checked={form.nextDay}
                    onChange={handleChange}
                  />
                }
                label="Next Day"
                sx={{ mt: -1, mb: 1 }}
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
