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
  const [users, setUsers] = useState([]);
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
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
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
    e.preventDefault();
    setError("");
    setFieldErrors({});

    // Validate form before submission
    if (!validateForm()) {
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

      // Get the number of samples in this shift
      const samplesResponse = await sampleService.getByShift(shiftId);
      const samplesInShift = samplesResponse.data || [];
      const shiftSampleNumber = samplesInShift.length + 1;

      // If this is the first sample in the shift and we have a sampler, set it as the default
      if (shiftSampleNumber === 1 && form.sampler) {
        try {
          await shiftService.update(shiftId, {
            defaultSampler: form.sampler,
          });
        } catch (error) {
          // Don't throw the error, just log it and continue
        }
      }

      // If this is the first sample in the shift and we have a flowmeter, set it as the default
      if (shiftSampleNumber === 1 && form.flowmeter) {
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
        fullSampleID: `${projectID}-${form.sampleNumber}`,
        collectedBy: form.sampler,
        flowmeter: form.flowmeter, // Explicitly include flowmeter
      };

      await sampleService.create(sampleData);

      // Add a small delay before navigation to ensure the sample is saved
      setTimeout(() => {
        navigate(`/air-monitoring/shift/${shiftId}/samples`);
      }, 500);
    } catch (error) {
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
          <FormControl fullWidth required error={!!fieldErrors.sampler}>
            <InputLabel>Sampler</InputLabel>
            <Select
              name="sampler"
              value={form.sampler}
              onChange={handleChange}
              label="Sampler"
              required
            >
              {users.map((user) => (
                <MenuItem key={user._id} value={user._id}>
                  {user.firstName} {user.lastName}
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
              <TextField
                name="cowlNo"
                label="Cowl No."
                value={form.cowlNo}
                onChange={handleChange}
                required
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
            </>
          )}
          <FormControl fullWidth required error={!!fieldErrors.flowmeter}>
            <InputLabel>Flowmeter</InputLabel>
            <Select
              name="flowmeter"
              value={form.flowmeter}
              onChange={handleChange}
              label="Flowmeter"
              required
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
            <Typography
              variant="caption"
              sx={{ mt: 0.5, color: "text.secondary" }}
            >
              Current value: {form.flowmeter || "None"} | Available options:{" "}
              {flowmeters.map((f) => f.equipmentReference).join(", ")}
            </Typography>
          </FormControl>
          {!form.isFieldBlank && (
            <>
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
