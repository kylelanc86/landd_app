import React, { useState, useEffect, useCallback } from "react";
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
import { flowmeterCalibrationService } from "../../services/flowmeterCalibrationService";
import { airPumpCalibrationService } from "../../services/airPumpCalibrationService";
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
  const [availableFlowrates, setAvailableFlowrates] = useState([]);
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

  // Calculate days until calibration is due
  const calculateDaysUntilCalibration = useCallback((calibrationDue) => {
    if (!calibrationDue) return null;

    const today = new Date();
    const dueDate = new Date(calibrationDue);

    // Reset time to start of day for accurate day calculation
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  }, []);

  // Calculate the actual status based on calibration data and stored status
  const calculateStatus = useCallback(
    (equipment) => {
      if (!equipment) {
        return "Out-of-Service";
      }

      if (equipment.status === "out-of-service") {
        return "Out-of-Service";
      }

      if (!equipment.lastCalibration || !equipment.calibrationDue) {
        return "Out-of-Service";
      }

      const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
      if (daysUntil !== null && daysUntil < 0) {
        return "Calibration Overdue";
      }

      return "Active";
    },
    [calculateDaysUntilCalibration]
  );

  // Fetch active air pumps from equipment list with calibration data
  useEffect(() => {
    const fetchActiveAirPumps = async () => {
      try {
        const response = await equipmentService.getAll();
        const allEquipment = response.equipment || [];

        // Filter for Air pump equipment
        const airPumps = allEquipment
          .filter((eq) => eq.equipmentType === "Air pump")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for each pump
        const pumpsWithCalibrations = await Promise.all(
          airPumps.map(async (pump) => {
            try {
              // Fetch all calibrations for this pump using Equipment ID
              const calibrationResponse =
                await airPumpCalibrationService.getPumpCalibrations(
                  pump._id,
                  1,
                  1000
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.calibrationDate).getTime()
                        )
                      )
                    )
                  : null;

              // Calculate calibrationDue (most recent nextCalibrationDue date)
              const calibrationDue =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations
                          .filter((cal) => cal.nextCalibrationDue)
                          .map((cal) =>
                            new Date(cal.nextCalibrationDue).getTime()
                          )
                      )
                    )
                  : null;

              return {
                ...pump,
                lastCalibration,
                calibrationDue,
              };
            } catch (err) {
              console.error(
                `Error fetching calibrations for ${pump.equipmentReference}:`,
                err
              );
              // Return pump without calibration data if fetch fails
              return {
                ...pump,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active pumps using calculated status
        const activePumps = pumpsWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        setAirPumps(activePumps);
      } catch (error) {
        console.error("Error fetching active air pumps:", error);
      }
    };
    fetchActiveAirPumps();
  }, [calculateStatus]);

  // Fetch active flowmeters from equipment list with calibration data
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

        // Filter for Site flowmeter equipment
        const siteFlowmeters = allEquipment.filter(
          (equipment) => equipment.equipmentType === "Site flowmeter"
        );

        // Fetch calibration data for each flowmeter
        const flowmetersWithCalibrations = await Promise.all(
          siteFlowmeters.map(async (flowmeter) => {
            try {
              // Fetch all calibrations for this flowmeter
              const calibrationResponse =
                await flowmeterCalibrationService.getByFlowmeter(
                  flowmeter.equipmentReference
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime()
                        )
                      )
                    )
                  : null;

              // Calculate calibrationDue (most recent nextCalibration date)
              const calibrationDue =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.nextCalibration).getTime()
                        )
                      )
                    )
                  : null;

              return {
                ...flowmeter,
                lastCalibration,
                calibrationDue,
              };
            } catch (err) {
              console.error(
                `Error fetching calibrations for ${flowmeter.equipmentReference}:`,
                err
              );
              // Return flowmeter without calibration data if fetch fails
              return {
                ...flowmeter,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active flowmeters using calculated status
        const activeFlowmeters = flowmetersWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );
        console.log("Filtered active flowmeters:", activeFlowmeters);
        console.log("Flowmeter count:", activeFlowmeters.length);
        setFlowmeters(activeFlowmeters);
      } catch (error) {
        console.error("Error fetching active flowmeters:", error);
        console.error("Error details:", error.response?.data || error.message);
      }
    };
    fetchActiveFlowmeters();
  }, [calculateStatus]);

  // Fetch available flowrates for selected pump (based on passed calibrations)
  const fetchAvailableFlowrates = async (pumpEquipmentReference) => {
    try {
      // Find the pump by equipmentReference
      const selectedPump = airPumps.find(
        (p) => p.equipmentReference === pumpEquipmentReference
      );

      if (!selectedPump) {
        setAvailableFlowrates([]);
        return;
      }

      // Fetch all calibrations for this pump using Equipment ID
      const calibrationResponse =
        await airPumpCalibrationService.getPumpCalibrations(
          selectedPump._id,
          1,
          1000
        );
      const calibrations =
        calibrationResponse.data || calibrationResponse || [];

      // Filter for passed calibrations and extract unique flowrates
      // Convert setFlowrate from mL/min to L/min
      const passedFlowrates = calibrations
        .filter((cal) => cal.overallResult === "Pass")
        .map((cal) => {
          if (cal.testResults && cal.testResults.length > 0) {
            // Get the setFlowrate from the first test result (all testResults in a calibration have the same setFlowrate)
            const setFlowrateMlMin = cal.testResults[0].setFlowrate;
            return setFlowrateMlMin / 1000; // Convert to L/min
          }
          return null;
        })
        .filter((flowrate) => flowrate != null)
        .filter((value, index, self) => self.indexOf(value) === index) // Get unique values
        .sort((a, b) => a - b); // Sort ascending

      setAvailableFlowrates(passedFlowrates);
    } catch (error) {
      console.error("Error fetching available flowrates:", error);
      setAvailableFlowrates([]);
    }
  };

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

    // Calculate average flowrate immediately when initial or final flowrate changes
    if (name === "initialFlowrate" || name === "finalFlowrate") {
      setForm((prev) => {
        const newForm = {
          ...prev,
          [name]: value,
        };

        // Calculate average if both flowrates are present
        if (newForm.initialFlowrate && newForm.finalFlowrate) {
          const initial = parseFloat(newForm.initialFlowrate);
          const final = parseFloat(newForm.finalFlowrate);

          if (!isNaN(initial) && !isNaN(final)) {
            const avg = (initial + final) / 2;
            const newStatus =
              Math.abs(initial - final) < 0.1 ? "pending" : "failed";

            return {
              ...newForm,
              averageFlowrate: avg.toFixed(1),
              status: newStatus,
            };
          }
        }

        // Clear average if either flowrate is missing or invalid
        return {
          ...newForm,
          averageFlowrate: "",
          status: "pending",
        };
      });
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // When pump changes, fetch available flowrates
    if (name === "pumpNo" && value) {
      fetchAvailableFlowrates(value);
      // Clear flowrate fields when pump changes
      setForm((prev) => ({
        ...prev,
        initialFlowrate: "",
        finalFlowrate: "",
        averageFlowrate: "",
      }));
    }
  };

  // Calculate average flowrate when initial or final flowrate changes (fallback)
  useEffect(() => {
    if (isSubmitting) return;

    if (form.initialFlowrate && form.finalFlowrate) {
      const initial = parseFloat(form.initialFlowrate);
      const final = parseFloat(form.finalFlowrate);

      if (!isNaN(initial) && !isNaN(final)) {
        const avg = (initial + final) / 2;
        const newStatus =
          Math.abs(initial - final) < 0.1 ? "pending" : "failed";

        setForm((prev) => {
          // Only update if the calculated values are different to avoid infinite loops
          const currentAvg = parseFloat(prev.averageFlowrate);
          if (Math.abs(currentAvg - avg) > 0.01 || prev.status !== newStatus) {
            return {
              ...prev,
              averageFlowrate: avg.toFixed(1),
              status: newStatus,
            };
          }
          return prev;
        });
      }
    } else {
      // Clear average flowrate and status if either flowrate is missing
      setForm((prev) => {
        if (prev.averageFlowrate || prev.status !== "pending") {
          return {
            ...prev,
            averageFlowrate: "",
            status: "pending",
          };
        }
        return prev;
      });
    }
  }, [form.initialFlowrate, form.finalFlowrate, isSubmitting]);

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
                  {airPumps.length > 0 ? (
                    airPumps.map((pump) => (
                      <MenuItem key={pump._id} value={pump.equipmentReference}>
                        {pump.equipmentReference}
                        {pump.brandModel ? ` - ${pump.brandModel}` : ""}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled value="">
                      No active air pumps available
                    </MenuItem>
                  )}
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
                {flowmeters.length > 0 ? (
                  flowmeters.map((flowmeter) => (
                    <MenuItem
                      key={flowmeter._id}
                      value={flowmeter.equipmentReference}
                    >
                      {flowmeter.equipmentReference}
                      {flowmeter.brandModel ? ` - ${flowmeter.brandModel}` : ""}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled value="">
                    No active flowmeters available
                  </MenuItem>
                )}
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
              <FormControl
                fullWidth
                required
                error={!!fieldErrors.initialFlowrate}
              >
                <InputLabel>Initial Flowrate (L/min)</InputLabel>
                <Select
                  name="initialFlowrate"
                  value={form.initialFlowrate}
                  onChange={handleChange}
                  label="Initial Flowrate (L/min)"
                  disabled={!form.pumpNo || availableFlowrates.length === 0}
                >
                  <MenuItem value="">
                    <em>
                      {!form.pumpNo
                        ? "Select a pump first"
                        : availableFlowrates.length === 0
                        ? "No passed calibrations available"
                        : "Select flowrate"}
                    </em>
                  </MenuItem>
                  {availableFlowrates.map((flowrate) => (
                    <MenuItem key={flowrate} value={flowrate.toString()}>
                      {flowrate}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.initialFlowrate && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.initialFlowrate}
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
              <FormControl fullWidth error={!!fieldErrors.finalFlowrate}>
                <InputLabel>Final Flowrate (L/min)</InputLabel>
                <Select
                  name="finalFlowrate"
                  value={form.finalFlowrate}
                  onChange={handleChange}
                  label="Final Flowrate (L/min)"
                  disabled={!form.pumpNo || availableFlowrates.length === 0}
                >
                  <MenuItem value="">
                    <em>
                      {!form.pumpNo
                        ? "Select a pump first"
                        : availableFlowrates.length === 0
                        ? "No passed calibrations available"
                        : "Select flowrate"}
                    </em>
                  </MenuItem>
                  {availableFlowrates.map((flowrate) => (
                    <MenuItem key={flowrate} value={flowrate.toString()}>
                      {flowrate}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.finalFlowrate && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.finalFlowrate}
                  </Typography>
                )}
              </FormControl>
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
