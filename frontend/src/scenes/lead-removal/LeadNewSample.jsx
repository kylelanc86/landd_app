import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  leadAirSampleService,
  shiftService,
  userService,
} from "../../services/api";
import leadRemovalJobService from "../../services/leadRemovalJobService";
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

const LeadNewSample = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [airPumps, setAirPumps] = useState([]);
  const [airPumpsLoaded, setAirPumpsLoaded] = useState(false);
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
  const [collectionTimeBeforeSetup, setCollectionTimeBeforeSetup] =
    useState(false);
  const [showCollectionSection, setShowCollectionSection] = useState(false);
  const [collectionFieldsEdited, setCollectionFieldsEdited] = useState(false);

  // Lead monitoring: only field blank is simplified (no neg air exhaust option)
  const isSimplifiedSample = form.isFieldBlank;

  // Check if the selected pump has a 1.5 L/min calibration available
  // If not, 13mm filter size should not be available (since 13mm requires 1.5 L/min)
  const hasOnePointFiveFlowrate = useMemo(() => {
    return availableFlowrates.some(
      (flowrate) => Math.abs(flowrate - 1.5) < 0.01,
    );
  }, [availableFlowrates]);

  // Filter available flowrates based on filter size
  // 1.5 L/min should only be offered when filter size is 13mm
  // For 13mm filters, 1.5 L/min is the only permitted option
  // For 25mm filters, 1.5 L/min should be excluded
  const filteredFlowrates = useMemo(() => {
    if (!form.filterSize) {
      // If no filter size selected, exclude 1.5 L/min
      return availableFlowrates.filter(
        (flowrate) => Math.abs(flowrate - 1.5) > 0.01,
      );
    }

    if (form.filterSize === "13mm") {
      // For 13mm, only show 1.5 L/min if available
      return availableFlowrates.filter(
        (flowrate) => Math.abs(flowrate - 1.5) < 0.01,
      );
    } else {
      // For 25mm (or other sizes), exclude 1.5 L/min
      return availableFlowrates.filter(
        (flowrate) => Math.abs(flowrate - 1.5) > 0.01,
      );
    }
  }, [availableFlowrates, form.filterSize]);

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

      // Handle flowmeters differently - they have simpler calibration structure
      const isFlowmeter =
        equipment.equipmentType === "Site flowmeter" ||
        (!equipment.allCalibrations && !equipment.mostRecentCalibration);

      if (isFlowmeter) {
        // For flowmeters, just check if calibration is overdue
        const daysUntil = calculateDaysUntilCalibration(
          equipment.calibrationDue,
        );
        if (daysUntil !== null && daysUntil < 0) {
          return "Calibration Overdue";
        }
        return "Active";
      }

      // For air pumps, check test results and calibration frequency
      // Check if the most recent calibration has all flowrates failing
      // If all test results failed, the pump should be Out-of-Service
      if (equipment.mostRecentCalibration) {
        const mostRecentCal = equipment.mostRecentCalibration;
        if (mostRecentCal.testResults && mostRecentCal.testResults.length > 0) {
          const allFailed = mostRecentCal.testResults.every(
            (result) => !result.passed,
          );
          if (allFailed) {
            return "Out-of-Service";
          }
        }
      }

      // Check if there's at least one passed flowrate calibration within the calibration frequency
      // Calibration frequency for air pumps is 1 year (12 months)
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Check all calibrations for passed flowrates within the last year
      const calibrations = equipment.allCalibrations || [];
      let hasPassedFlowrateInFrequency = false;

      for (const cal of calibrations) {
        if (!cal.calibrationDate) continue;
        const calDate = new Date(cal.calibrationDate);

        // Only consider calibrations within the last year
        if (calDate >= oneYearAgo && calDate <= today) {
          if (cal.testResults && cal.testResults.length > 0) {
            // Check if at least one test result passed
            const hasPassed = cal.testResults.some((result) => result.passed);
            if (hasPassed) {
              hasPassedFlowrateInFrequency = true;
              break;
            }
          }
        }
      }

      // If no passed flowrate within the calibration frequency, pump is Out-of-Service
      if (!hasPassedFlowrateInFrequency) {
        return "Out-of-Service";
      }

      const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
      if (daysUntil !== null && daysUntil < 0) {
        return "Calibration Overdue";
      }

      return "Active";
    },
    [calculateDaysUntilCalibration],
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
            a.equipmentReference.localeCompare(b.equipmentReference),
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
                  1000,
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.calibrationDate).getTime(),
                        ),
                      ),
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
                            new Date(cal.nextCalibrationDue).getTime(),
                          ),
                      ),
                    )
                  : null;

              // Get the most recent calibration for status checking
              const mostRecentCalibration =
                calibrations.length > 0
                  ? calibrations.sort(
                      (a, b) =>
                        new Date(b.calibrationDate) -
                        new Date(a.calibrationDate),
                    )[0]
                  : null;

              return {
                ...pump,
                lastCalibration,
                calibrationDue,
                mostRecentCalibration, // Store for status calculation
                allCalibrations: calibrations, // Store all calibrations for status calculation
              };
            } catch (err) {
              console.error(
                `Error fetching calibrations for ${pump.equipmentReference}:`,
                err,
              );
              // Return pump without calibration data if fetch fails
              return {
                ...pump,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          }),
        );

        // Filter for active pumps using calculated status
        const activePumps = pumpsWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference),
          );

        setAirPumps(activePumps);
        setAirPumpsLoaded(true);
      } catch (error) {
        console.error("Error fetching active air pumps:", error);
        setAirPumpsLoaded(true); // Set to true even on error so field can be enabled
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
          (equipment) => equipment.equipmentType === "Site flowmeter",
        );

        // Fetch calibration data for each flowmeter
        const flowmetersWithCalibrations = await Promise.all(
          siteFlowmeters.map(async (flowmeter) => {
            try {
              // Fetch all calibrations for this flowmeter
              const calibrationResponse =
                await flowmeterCalibrationService.getByFlowmeter(
                  flowmeter.equipmentReference,
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime(),
                        ),
                      ),
                    )
                  : null;

              // Calculate calibrationDue (most recent nextCalibration date)
              const calibrationDue =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.nextCalibration).getTime(),
                        ),
                      ),
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
                err,
              );
              // Return flowmeter without calibration data if fetch fails
              return {
                ...flowmeter,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          }),
        );

        // Filter for active flowmeters using calculated status
        const activeFlowmeters = flowmetersWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference),
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
        (p) => p.equipmentReference === pumpEquipmentReference,
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
          1000,
        );
      const calibrations =
        calibrationResponse.data || calibrationResponse || [];

      // Find the most recent calibration that is still valid (not expired)
      // Calibrations are sorted by calibrationDate descending (most recent first)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentCalibration = calibrations.find((cal) => {
        if (!cal.nextCalibrationDue) return false;
        const nextDueDate = new Date(cal.nextCalibrationDue);
        nextDueDate.setHours(0, 0, 0, 0);
        return nextDueDate >= today; // Calibration is valid if nextCalibrationDue is today or in the future
      });

      // Extract unique flowrates from test results that passed
      // Only use the current valid calibration, not historical ones
      // Convert setFlowrate from mL/min to L/min
      const passedFlowrates = [];
      if (
        currentCalibration &&
        currentCalibration.testResults &&
        currentCalibration.testResults.length > 0
      ) {
        // Only include flowrates from test results that passed
        currentCalibration.testResults
          .filter((testResult) => testResult.passed)
          .forEach((testResult) => {
            const setFlowrateMlMin = testResult.setFlowrate;
            const flowrateLMin = setFlowrateMlMin / 1000; // Convert to L/min
            if (!passedFlowrates.includes(flowrateLMin)) {
              passedFlowrates.push(flowrateLMin);
            }
          });
      }
      // Sort ascending
      passedFlowrates.sort((a, b) => a - b);

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
          leadAirSampleService.getByShift(shiftId),
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
          leadAirSampleService.getByProject(projectID).catch((err) => {
            console.error("Error fetching project samples:", err);
            return { data: [] };
          }),
          shiftData.job?._id
            ? leadRemovalJobService.getById(shiftData.job._id).catch((err) => {
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

        // Calculate next sample number (lead uses LP prefix)
        try {
          const highestNumber = Math.max(
            ...allProjectSamples.map((sample) => {
              const hasLPPrefix =
                sample.fullSampleID?.startsWith(`${projectID}-LP`) ||
                sample.sampleNumber?.startsWith("LP");

              if (hasLPPrefix) {
                let match = sample.fullSampleID?.match(/LP(\d+)$/);
                if (!match && sample.sampleNumber) {
                  match = sample.sampleNumber.match(/LP(\d+)$/);
                }
                return match ? parseInt(match[1]) : 0;
              }
              return 0;
            }),
            0,
          );

          const nextSampleNumber = `LP${highestNumber + 1}`;
          console.log("Calculated next sample number:", nextSampleNumber);

          setForm((prev) => ({
            ...prev,
            sampleNumber: nextSampleNumber.toString(),
          }));
        } catch (error) {
          console.error("Error calculating next sample number:", error);
          setForm((prev) => ({
            ...prev,
            sampleNumber: "LP1",
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
                err,
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

  // Lead monitoring: sampler dropdown includes active users only
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await userService.getAll(false);
        const users = (res.data || []).slice();
        users.sort((a, b) => {
          const nameA =
            `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          const nameB =
            `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setAllUsers(users);
      } catch (err) {
        console.error("Error fetching users for sampler list:", err);
      }
    };
    fetchUsers();
  }, []);

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
        shift.defaultFlowmeter,
      );

      // Check if the default flowmeter exists in the available flowmeters
      const defaultFlowmeterExists = flowmeters.some(
        (f) => f.equipmentReference === shift.defaultFlowmeter,
      );

      if (defaultFlowmeterExists) {
        console.log(
          "Setting default flowmeter from shift after flowmeters loaded",
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

    // Track if collection fields have been edited
    const collectionFields = ["endTime", "nextDay", "finalFlowrate"];
    if (collectionFields.includes(name)) {
      setCollectionFieldsEdited(true);
      setShowCollectionSection(true);
    }

    if (name === "isFieldBlank") {
      setForm((prev) => {
        const next = {
          ...prev,
          [name]: checked,
          location: checked
            ? FIELD_BLANK_LOCATION
            : prev.location === FIELD_BLANK_LOCATION
              ? ""
              : prev.location,
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

    // Handle cowlNo: custom text, no prefix (lead sampling)
    if (name === "cowlNo") {
      setForm((prev) => ({
        ...prev,
        [name]: value,
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

          if (!isNaN(initial) && !isNaN(final) && initial > 0) {
            const avg = (initial + final) / 2;
            // Check if final flowrate is within 10% of initial flowrate
            const allowedDifference = initial * 0.1;
            const newStatus =
              Math.abs(initial - final) <= allowedDifference
                ? "pending"
                : "failed";

            // Format average: whole numbers and values with 1 decimal place to 1 dp, others to 2 dp
            const hasAtMostOneDecimal = parseFloat(avg.toFixed(1)) === avg;
            const formattedAvg = hasAtMostOneDecimal
              ? avg.toFixed(1)
              : avg.toFixed(2);

            return {
              ...newForm,
              averageFlowrate: formattedAvg,
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

    setForm((prev) => {
      const newForm = {
        ...prev,
        [name]: value,
      };

      return newForm;
    });

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

      if (!isNaN(initial) && !isNaN(final) && initial > 0) {
        const avg = (initial + final) / 2;
        // Check if final flowrate is within 10% of initial flowrate
        const allowedDifference = initial * 0.1;
        const newStatus =
          Math.abs(initial - final) <= allowedDifference ? "pending" : "failed";

        // Format average: whole numbers and values with 1 decimal place to 1 dp, others to 2 dp
        const hasAtMostOneDecimal = parseFloat(avg.toFixed(1)) === avg;
        const formattedAvg = hasAtMostOneDecimal
          ? avg.toFixed(1)
          : avg.toFixed(2);

        setForm((prev) => {
          // Only update if the calculated values are different to avoid infinite loops
          const currentAvg = parseFloat(prev.averageFlowrate);
          if (Math.abs(currentAvg - avg) > 0.01 || prev.status !== newStatus) {
            return {
              ...prev,
              averageFlowrate: formattedAvg,
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

  // Validate that collection time is not before setup time (unless nextDay is checked)
  useEffect(() => {
    if (isSimplifiedSample) {
      setCollectionTimeBeforeSetup(false);
      return;
    }

    if (!form.startTime || !form.endTime) {
      setCollectionTimeBeforeSetup(false);
      return;
    }

    const [startHours, startMinutes] = form.startTime.split(":").map(Number);
    const [endHours, endMinutes] = form.endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    // Check if end time is before start time when nextDay is not checked
    const isBefore = endTotalMinutes < startTotalMinutes;
    setCollectionTimeBeforeSetup(isBefore && !form.nextDay);
  }, [form.startTime, form.endTime, form.nextDay, isSimplifiedSample]);

  // Lead monitoring: no minimum volume required
  useEffect(() => {
    setInsufficientSampleTime(false);
  }, []);

  const setCurrentTime = (field) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}`;
    setForm((prev) => ({ ...prev, [field]: timeString }));
  };

  // Helper functions for time dropdowns
  const parseTime = (timeString, field = null) => {
    if (!timeString || timeString.trim() === "") {
      // For both startTime and endTime fields, return "-" as placeholder
      if (field === "startTime" || field === "endTime") {
        return { hour: "-", minute: "-" };
      }
      return { hour: "00", minute: "00" };
    }
    const [hour, minute] = timeString.split(":");
    return {
      hour: hour || (field === "startTime" || field === "endTime" ? "-" : "00"),
      minute:
        minute || (field === "startTime" || field === "endTime" ? "-" : "00"),
    };
  };

  const formatTime = (hour, minute) => {
    // Handle "-" placeholder for startTime and endTime
    if (hour === "-" || minute === "-") {
      return "";
    }
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  };

  const handleTimeChange = (field, type, value) => {
    // If user selects "-", clear the time field
    if (value === "-") {
      setForm((prev) => ({ ...prev, [field]: "" }));
      if (field === "endTime") {
        setCollectionFieldsEdited(true);
        setShowCollectionSection(true);
      }
      return;
    }

    const currentTime = parseTime(form[field], field);
    // Use "00" as default if current time part is "-"
    const hour =
      type === "hour"
        ? value
        : currentTime.hour === "-"
          ? "00"
          : currentTime.hour;
    const minute =
      type === "minute"
        ? value
        : currentTime.minute === "-"
          ? "00"
          : currentTime.minute;
    const newTime = formatTime(hour, minute);
    setForm((prev) => ({ ...prev, [field]: newTime }));

    // Track if collection time has been edited
    if (field === "endTime") {
      setCollectionFieldsEdited(true);
      setShowCollectionSection(true);
    }
  };

  const validateForm = async () => {
    const errors = {};

    if (!form.sampler) {
      errors.sampler = "Sampler is required";
    }

    if (!form.sampleNumber) {
      errors.sampleNumber = "Sample number is required";
    } else {
      // Check if sample number is unique across the project using cached samples (lead uses LP prefix)
      if (projectID && projectSamples.length > 0) {
        const isDuplicate = projectSamples.some((sample) => {
          if (sample.fullSampleID?.startsWith(`${projectID}-LP`)) {
            const extractedNumber = sample.fullSampleID?.match(/LP(\d+)$/)?.[1];
            return extractedNumber === form.sampleNumber.replace("LP", "");
          }
          return false;
        });

        if (isDuplicate) {
          errors.sampleNumber =
            "Sample number already exists in this project. Please use a different number.";
        }
      } else if (projectID && projectSamples.length === 0) {
        console.warn(
          "[NewSample] Unable to validate sample number uniqueness - project samples not loaded",
        );
      }
    }

    if (!isSimplifiedSample) {
      if (!form.pumpNo) {
        errors.pumpNo = "Pump No. is required";
      }
      if (!form.flowmeter) {
        // Only require flowmeter if user has explicitly set isFieldBlank to false
        // During initial load, isFieldBlank defaults to false but shouldn't block sample number calculation
        if (form.isFieldBlank === false) {
          errors.flowmeter =
            "Flowmeter is required for non-field blank and non-neg air exhaust samples";
        }
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
      // Only require collection fields if they have been edited
      if (collectionFieldsEdited) {
        if (!form.endTime) {
          errors.endTime = "End time is required";
        }
        // Validate that collection time is not before setup time unless nextDay is checked
        if (form.startTime && form.endTime && collectionTimeBeforeSetup) {
          errors.endTime =
            "Collection time cannot be before setup time unless 'Next Day' is selected";
        }
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
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      console.log("[NewSample] Validation failed with errors:", errors);
    }
    return { isValid, errors };
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
    const { isValid, errors: validationErrors } = await validateForm();
    console.timeEnd(`${logLabel} validation`);
    if (!isValid) {
      console.log(
        "[NewSample] Form validation failed, errors:",
        validationErrors,
      );
      console.timeEnd(`${logLabel} total`);
      return;
    }

    console.log(
      "[NewSample] Form validation passed, proceeding with submission",
    );

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
            updateError,
          );
        } finally {
          console.timeEnd(`${logLabel} shiftUpdate`);
        }
      }

      // Create the sample
      console.time(`${logLabel} create`);
      // Cowl no: use as-is, no prefix (lead sampling)
      // Normalize type: if isFieldBlank is false but type is "-", set to "Background"
      let normalizedType = form.isFieldBlank ? "-" : form.type;
      if (!form.isFieldBlank && normalizedType === "-") {
        normalizedType = "Background";
      }
      // Normalize location: if isFieldBlank is false but location is "Field blank", clear it
      let normalizedLocation = form.location;
      if (!form.isFieldBlank && normalizedLocation === FIELD_BLANK_LOCATION) {
        normalizedLocation = "";
      }
      // Normalize sample number to LP1, LP2, ... (same as air monitoring AM1, AM2)
      let sampleNumber = form.sampleNumber?.toString().trim() || "";
      if (sampleNumber && !sampleNumber.startsWith("LP")) {
        const num =
          parseInt(sampleNumber.replace(/\D/g, ""), 10) || sampleNumber;
        sampleNumber = `LP${num}`;
      }
      const sampleData = {
        ...form,
        shift: shiftId,
        job: job._id,
        jobModel: shift.jobModel, // Add jobModel from shift
        fullSampleID: `${projectID}-${sampleNumber}`,
        sampleNumber: sampleNumber,
        sampler: form.sampler,
        collectedBy: form.sampler,
        isFieldBlank: form.isFieldBlank || false, // Explicitly set boolean
        type: normalizedType, // Set type to "-" for field blanks, normalize otherwise
        location: normalizedLocation, // Clear "Field blank" location if not a field blank
        flowmeter: form.flowmeter || null, // Explicitly include flowmeter
        cowlNo: form.cowlNo?.trim() || null,
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

      await leadAirSampleService.create(sampleData);
      console.timeEnd(`${logLabel} create`);

      // Update local cache to reflect the new sample
      setShiftSamples((prev) => [...prev, sampleData]);
      setProjectSamples((prev) => [...prev, sampleData]);

      // Navigate back to lead monitoring sample list
      navigate(`/lead-removal/shift/${shiftId}/samples`);
    } catch (error) {
      if (console.timeLog) {
        try {
          console.timeLog(`${logLabel} total`);
        } catch (logError) {
          // ignore consoles without timeLog
        }
      }
      console.error("Error creating sample:", error);

      // Check for duplicate key error
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create sample";
      if (
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("E11000")
      ) {
        const attemptedFullSampleID = projectID
          ? `${projectID}-${form.sampleNumber}`
          : form.sampleNumber;
        setError(
          `Sample number ${attemptedFullSampleID} already exists. This may occur if samples exist from a deleted job/shift. Please refresh the page to recalculate the next available sample number.`,
        );
      } else {
        setError(errorMessage);
      }
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

      <Box
        component="form"
        noValidate
        sx={{
          "& .MuiInputBase-input": { fontSize: "0.8em" },
          "& .MuiInputLabel-root": { fontSize: "0.8em" },
          "& .MuiFormControlLabel-label": { fontSize: "0.8em" },
        }}
      >
        <Stack spacing={2.25} sx={{ maxWidth: { xs: 600, sm: 960 } }}>
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { sm: "flex-start" },
              flexWrap: "wrap",
            }}
          >
            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                flex: { xs: "none", sm: "1 1 0" },
                minWidth: 0,
                flexWrap: { xs: "nowrap", sm: "wrap" },
                "& > *": {
                  flex: { xs: "1 1 0", sm: "1 1 140px" },
                  minWidth: 0,
                },
              }}
            >
              <FormControl
                fullWidth
                size="small"
                required
                error={!!fieldErrors.sampler}
                sx={{ minWidth: 0 }}
              >
                <InputLabel>Sampler</InputLabel>
                <Select
                  name="sampler"
                  value={form.sampler}
                  onChange={handleChange}
                  label="Sampler"
                  required
                >
                  {allUsers.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
                {fieldErrors.sampler && (
                  <Typography
                    variant="caption"
                    color="error"
                    sx={{ mt: 0.5 }}
                  >
                    {fieldErrors.sampler}
                  </Typography>
                )}
              </FormControl>
              <TextField
                size="small"
                name="sampleNumber"
                label="Sample Number"
                value={form.sampleNumber}
                onChange={handleChange}
                required
                fullWidth
                disabled
                error={!!fieldErrors.sampleNumber}
              />
            </Box>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                mt: { xs: -1, sm: 0 },
                flex: { sm: "0 0 auto" },
              }}
            >
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
            </Box>
          </Box>
          {!isSimplifiedSample && (
            <>
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  flexDirection: { xs: "column", sm: "row" },
                  flexWrap: "wrap",
                  "& > *": { flex: { sm: "1 1 0" }, minWidth: 0 },
                }}
              >
                <FormControl
                  fullWidth
                  size="small"
                  required
                  error={!!fieldErrors.type}
                  sx={{ minWidth: 0 }}
                >
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
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {fieldErrors.type}
                    </Typography>
                  )}
                </FormControl>
                <TextField
                  size="small"
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
              </Box>
            </>
          )}
          {isSimplifiedSample && (
            <>
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  flexDirection: { xs: "column", sm: "row" },
                  flexWrap: "wrap",
                  "& > *": { flex: { sm: "1 1 0" }, minWidth: 0 },
                }}
              >
                <TextField
                  size="small"
                  name="location"
                  label="Location"
                  autoComplete="off"
                  value={
                    form.isFieldBlank
                      ? FIELD_BLANK_LOCATION
                      : form.location || ""
                  }
                  onChange={handleChange}
                  disabled={form.isFieldBlank}
                  required
                  fullWidth
                  error={!!fieldErrors.location}
                  helperText={fieldErrors.location}
                />
                <TextField
                  size="small"
                  name="cowlNo"
                  label="Cowl No."
                  value={form.cowlNo || ""}
                  onChange={handleChange}
                  required
                  fullWidth
                  error={!!fieldErrors.cowlNo}
                  helperText={fieldErrors.cowlNo}
                  autoComplete="off"
                />
              </Box>
            </>
          )}
          {!isSimplifiedSample && (
            <>
              <Box
                sx={{
                  display: "flex",
                  gap: 1.5,
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                  "& > *": {
                    flex: { xs: "1 1 calc(50% - 6px)", sm: "1 1 0" },
                    minWidth: 0,
                  },
                }}
              >
                <FormControl
                  fullWidth
                  size="small"
                  required
                  error={!!fieldErrors.pumpNo}
                  sx={{ minWidth: 0 }}
                >
                  <InputLabel>Pump No.</InputLabel>
                  <Select
                    name="pumpNo"
                    value={form.pumpNo}
                    onChange={handleChange}
                    label="Pump No."
                    required
                    disabled={!airPumpsLoaded}
                  >
                    <MenuItem value="">
                      <em>
                        {!airPumpsLoaded
                          ? "Loading pumps..."
                          : airPumps.length > 0
                            ? "Select a pump"
                            : "No active air pumps available"}
                      </em>
                    </MenuItem>
                    {airPumps.length > 0 ? (
                      airPumps.map((pump) => (
                        <MenuItem
                          key={pump._id}
                          value={pump.equipmentReference}
                        >
                          {pump.equipmentReference}
                        </MenuItem>
                      ))
                    ) : airPumpsLoaded ? (
                      <MenuItem disabled value="">
                        No active air pumps available
                      </MenuItem>
                    ) : null}
                  </Select>
                  {fieldErrors.pumpNo && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {fieldErrors.pumpNo}
                    </Typography>
                  )}
                </FormControl>
                <TextField
                  size="small"
                  name="cowlNo"
                  label="Cowl No."
                  value={form.cowlNo || ""}
                  onChange={handleChange}
                  required
                  fullWidth
                  error={!!fieldErrors.cowlNo}
                  helperText={fieldErrors.cowlNo}
                  autoComplete="off"
                />
                <FormControl
                  fullWidth
                  size="small"
                  required={!isSimplifiedSample}
                  error={!!fieldErrors.flowmeter}
                  sx={{ minWidth: 0 }}
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
                          {flowmeter.brandModel
                            ? ` - ${flowmeter.brandModel}`
                            : ""}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled value="">
                        No active flowmeters available
                      </MenuItem>
                    )}
                  </Select>
                  {fieldErrors.flowmeter && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {fieldErrors.flowmeter}
                    </Typography>
                  )}
                </FormControl>
              </Box>
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
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexDirection: { xs: "column", sm: "row" },
                  flexWrap: "wrap",
                  alignItems: { sm: "flex-start" },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    flex: { sm: "0 0 auto" },
                  }}
                >
                  <FormControl
                    required
                    size="small"
                    sx={{ minWidth: 100 }}
                    error={!!fieldErrors.startTime}
                  >
                    <InputLabel>Hour</InputLabel>
                    <Select
                      value={parseTime(form.startTime, "startTime").hour}
                      onChange={(e) =>
                        handleTimeChange("startTime", "hour", e.target.value)
                      }
                      label="Hour"
                    >
                      <MenuItem value="-">-</MenuItem>
                      {Array.from({ length: 24 }, (_, i) =>
                        i.toString().padStart(2, "0"),
                      ).map((hour) => (
                        <MenuItem key={hour} value={hour}>
                          {hour}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl
                    required
                    size="small"
                    sx={{ minWidth: 100 }}
                    error={!!fieldErrors.startTime}
                  >
                    <InputLabel>Minutes</InputLabel>
                    <Select
                      value={parseTime(form.startTime, "startTime").minute}
                      onChange={(e) =>
                        handleTimeChange("startTime", "minute", e.target.value)
                      }
                      label="Minutes"
                    >
                      <MenuItem value="-">-</MenuItem>
                      {Array.from({ length: 60 }, (_, i) =>
                        i.toString().padStart(2, "0"),
                      ).map((minute) => (
                        <MenuItem key={minute} value={minute}>
                          {minute}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton
                    onClick={() => setCurrentTime("startTime")}
                    sx={{ alignSelf: "flex-end", mb: 1 }}
                  >
                    <AccessTimeIcon />
                  </IconButton>
                </Box>
                <FormControl
                  fullWidth
                  size="small"
                  required
                  error={!!fieldErrors.initialFlowrate}
                  sx={{ flex: { sm: "1 1 0" }, minWidth: 0 }}
                >
                  <InputLabel>Initial Flowrate (L/min)</InputLabel>
                  <Select
                    name="initialFlowrate"
                    value={form.initialFlowrate}
                    onChange={handleChange}
                    label="Initial Flowrate (L/min)"
                    disabled={!form.pumpNo || filteredFlowrates.length === 0}
                  >
                    <MenuItem value="">
                      <em>
                        {!form.pumpNo
                          ? "Select a pump first"
                          : filteredFlowrates.length === 0
                            ? "No passed calibrations available"
                            : "Select flowrate"}
                      </em>
                    </MenuItem>
                    {filteredFlowrates.map((flowrate) => (
                      <MenuItem key={flowrate} value={flowrate.toString()}>
                        {flowrate}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldErrors.initialFlowrate && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {fieldErrors.initialFlowrate}
                    </Typography>
                  )}
                </FormControl>
              </Box>
              {fieldErrors.startTime && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: -1, mb: 1, ml: 1 }}
                >
                  {fieldErrors.startTime}
                </Typography>
              )}
              {!showCollectionSection && !collectionFieldsEdited ? (
                <Button
                  variant="outlined"
                  onClick={() => setShowCollectionSection(true)}
                  sx={{ mt: 3, mb: 2 }}
                >
                  Air Monitor Pick-Up
                </Button>
              ) : (
                <>
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
                    Air-monitor Pick-Up
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flexDirection: { xs: "column", sm: "row" },
                      flexWrap: "wrap",
                      alignItems: { sm: "flex-start" },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        alignItems: "center",
                        flex: { sm: "0 0 auto" },
                      }}
                    >
                      <FormControl
                        required
                        size="small"
                        sx={{ minWidth: 100 }}
                        error={
                          insufficientSampleTime ||
                          collectionTimeBeforeSetup ||
                          !!fieldErrors.endTime
                        }
                      >
                        <InputLabel>Hour</InputLabel>
                        <Select
                          value={parseTime(form.endTime, "endTime").hour}
                          onChange={(e) =>
                            handleTimeChange("endTime", "hour", e.target.value)
                          }
                          label="Hour"
                        >
                          <MenuItem value="-">-</MenuItem>
                          {Array.from({ length: 24 }, (_, i) =>
                            i.toString().padStart(2, "0"),
                          ).map((hour) => (
                            <MenuItem key={hour} value={hour}>
                              {hour}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl
                        required
                        size="small"
                        sx={{ minWidth: 100 }}
                        error={
                          insufficientSampleTime ||
                          collectionTimeBeforeSetup ||
                          !!fieldErrors.endTime
                        }
                      >
                        <InputLabel>Minutes</InputLabel>
                        <Select
                          value={parseTime(form.endTime, "endTime").minute}
                          onChange={(e) =>
                            handleTimeChange(
                              "endTime",
                              "minute",
                              e.target.value,
                            )
                          }
                          label="Minutes"
                        >
                          <MenuItem value="-">-</MenuItem>
                          {Array.from({ length: 60 }, (_, i) =>
                            i.toString().padStart(2, "0"),
                          ).map((minute) => (
                            <MenuItem key={minute} value={minute}>
                              {minute}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton
                        onClick={() => {
                          setCurrentTime("endTime");
                          setCollectionFieldsEdited(true);
                          setShowCollectionSection(true);
                        }}
                        sx={{ alignSelf: "flex-end", mb: 1 }}
                      >
                        <AccessTimeIcon />
                      </IconButton>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flex: { sm: "0 0 auto" },
                      }}
                    >
                      <Checkbox
                        name="nextDay"
                        checked={form.nextDay}
                        onChange={handleChange}
                      />
                      <Typography variant="body1" sx={{ ml: -1, mr: 1 }}>
                        Next Day
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      name="finalFlowrate"
                      label="Final Flowrate (L/min)"
                      value={form.finalFlowrate}
                      onChange={handleChange}
                      onBlur={(e) => {
                        const value = e.target.value;
                        if (value && !isNaN(parseFloat(value))) {
                          const num = parseFloat(value);
                          const hasAtMostOneDecimal =
                            parseFloat(num.toFixed(1)) === num;
                          const formatted = hasAtMostOneDecimal
                            ? num.toFixed(1)
                            : num.toFixed(2);
                          setForm((prev) => ({
                            ...prev,
                            finalFlowrate: formatted,
                          }));
                        }
                      }}
                      type="number"
                      inputProps={{ step: "0.01", min: "0" }}
                      fullWidth
                      sx={{ flex: { sm: "1 1 0" }, minWidth: 0 }}
                      error={!!fieldErrors.finalFlowrate}
                      helperText={
                        fieldErrors.finalFlowrate ||
                        (form.initialFlowrate &&
                        !isNaN(parseFloat(form.initialFlowrate))
                          ? `Must be within 10% of initial flowrate (${(parseFloat(form.initialFlowrate) * 0.9).toFixed(2)} - ${(parseFloat(form.initialFlowrate) * 1.1).toFixed(2)} L/min)`
                          : "")
                      }
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: -0.5, mb: 1 }}
                  >
                    *If pump has failed, set final flowrate to 0L/min
                  </Typography>
                  {fieldErrors.endTime && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: -1, mb: 1, ml: 1 }}
                    >
                      {fieldErrors.endTime}
                    </Typography>
                  )}
                  {insufficientSampleTime && !fieldErrors.endTime && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: -1, mb: 1, ml: 1 }}
                    >
                      Insufficient sample time
                    </Typography>
                  )}
                  <TextField
                    size="small"
                    name="averageFlowrate"
                    label="Average Flowrate"
                    value={
                      form.status === "failed"
                        ? "FAILED - Final flowate is not within 10% of initial flowrate"
                        : form.averageFlowrate &&
                            !isNaN(parseFloat(form.averageFlowrate))
                          ? (() => {
                              const num = parseFloat(form.averageFlowrate);
                              // If whole number or has only 1 decimal place, display to 1 decimal place, otherwise 2 decimal places
                              const hasAtMostOneDecimal =
                                parseFloat(num.toFixed(1)) === num;
                              return hasAtMostOneDecimal
                                ? num.toFixed(1)
                                : num.toFixed(2);
                            })()
                          : form.averageFlowrate
                    }
                    disabled
                    required
                    fullWidth
                    sx={{
                      "& .MuiInputBase-input": {
                        color:
                          form.status === "failed"
                            ? "error.main"
                            : "text.primary",
                        fontWeight:
                          form.status === "failed" ? "bold" : "normal",
                      },
                    }}
                  />
                </>
              )}
            </>
          )}
          <TextField
            size="small"
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

export default LeadNewSample;
