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
  InputAdornment,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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

const EditSample = () => {
  const theme = useTheme();
  const { shiftId, sampleId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [airPumps, setAirPumps] = useState([]);
  const [airPumpsLoaded, setAirPumpsLoaded] = useState(false);
  const [flowmeters, setFlowmeters] = useState([]);
  const [availableFlowrates, setAvailableFlowrates] = useState([]);
  // Cache for calibration data to avoid re-fetching
  const [pumpCalibrationsCache, setPumpCalibrationsCache] = useState(new Map());
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
    nextDay: false,
    initialFlowrate: "",
    finalFlowrate: "",
    averageFlowrate: "",
    notes: "",
    date: formatDateForInput(new Date()),
    isFieldBlank: false,
    isNegAirExhaust: false,
    status: "pending",
  });
  const [projectID, setProjectID] = useState(null);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [insufficientSampleTime, setInsufficientSampleTime] = useState(false);
  const [collectionTimeBeforeSetup, setCollectionTimeBeforeSetup] = useState(false);
  const [showCollectionSection, setShowCollectionSection] = useState(false);
  const [collectionFieldsEdited, setCollectionFieldsEdited] = useState(false);

  const isSimplifiedSample = form.isFieldBlank || form.isNegAirExhaust;

  // Check if the selected pump has a 1.5 L/min calibration available
  // If not, 13mm filter size should not be available (since 13mm requires 1.5 L/min)
  const hasOnePointFiveFlowrate = useMemo(() => {
    return availableFlowrates.some(flowrate => Math.abs(flowrate - 1.5) < 0.01);
  }, [availableFlowrates]);

  // Filter available flowrates based on filter size
  // 1.5 L/min should only be offered when filter size is 13mm
  // For 13mm filters, 1.5 L/min is the only permitted option
  // For 25mm filters, 1.5 L/min should be excluded
  const filteredFlowrates = useMemo(() => {
    if (!form.filterSize) {
      // If no filter size selected, exclude 1.5 L/min
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) > 0.01);
    }
    
    if (form.filterSize === "13mm") {
      // For 13mm, only show 1.5 L/min if available
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) < 0.01);
    } else {
      // For 25mm (or other sizes), exclude 1.5 L/min
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) > 0.01);
    }
  }, [availableFlowrates, form.filterSize]);

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

      // Handle flowmeters differently - they have simpler calibration structure
      const isFlowmeter = equipment.equipmentType === "Site flowmeter" || 
                          (!equipment.allCalibrations && !equipment.mostRecentCalibration);

      if (isFlowmeter) {
        // For flowmeters, just check if calibration is overdue
        const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
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
        if (
          mostRecentCal.testResults &&
          mostRecentCal.testResults.length > 0
        ) {
          const allFailed = mostRecentCal.testResults.every(
            (result) => !result.passed
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
      const calibrations = equipment.allCalibrations || equipment.calibrations || [];
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
    [calculateDaysUntilCalibration]
  );

  // Fetch equipment and calibrations in a single optimized call
  useEffect(() => {
    let isMounted = true;

    const fetchEquipmentAndCalibrations = async () => {
      try {
        // Fetch equipment once
        const response = await equipmentService.getAll();
        const allEquipment = response.equipment || [];

        if (!isMounted) return;

        // Filter for Air pump equipment
        const airPumps = allEquipment
          .filter((eq) => eq.equipmentType === "Air pump")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Filter for Site flowmeter equipment
        const siteFlowmeters = allEquipment.filter(
          (equipment) => equipment.equipmentType === "Site flowmeter"
        );

        // Fetch calibration data for all pumps and flowmeters in parallel
        const [pumpsWithCalibrations, flowmetersWithCalibrations] =
          await Promise.all([
            // Fetch pump calibrations
            Promise.all(
              airPumps.map(async (pump) => {
                try {
                  const calibrationResponse =
                    await airPumpCalibrationService.getPumpCalibrations(
                      pump._id,
                      1,
                      1000
                    );
                  const calibrations =
                    calibrationResponse.data || calibrationResponse || [];

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

                  // Get the most recent calibration for status checking
                  const mostRecentCalibration = calibrations.length > 0
                    ? calibrations.sort(
                        (a, b) =>
                          new Date(b.calibrationDate) - new Date(a.calibrationDate)
                      )[0]
                    : null;

                  return {
                    ...pump,
                    lastCalibration,
                    calibrationDue,
                    calibrations, // Store calibrations for later use
                    mostRecentCalibration, // Store for status calculation
                    allCalibrations: calibrations, // Store all calibrations for status calculation
                  };
                } catch (err) {
                  console.error(
                    `Error fetching calibrations for ${pump.equipmentReference}:`,
                    err
                  );
                  return {
                    ...pump,
                    lastCalibration: null,
                    calibrationDue: null,
                    calibrations: [],
                  };
                }
              })
            ),
            // Fetch flowmeter calibrations
            Promise.all(
              siteFlowmeters.map(async (flowmeter) => {
                try {
                  const calibrationResponse =
                    await flowmeterCalibrationService.getByFlowmeter(
                      flowmeter.equipmentReference
                    );
                  const calibrations =
                    calibrationResponse.data || calibrationResponse || [];

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
                  return {
                    ...flowmeter,
                    lastCalibration: null,
                    calibrationDue: null,
                  };
                }
              })
            ),
          ]);

        if (!isMounted) return;

        // Update cache with all pump calibrations (batch update after all data is fetched)
        const newCache = new Map();
        pumpsWithCalibrations.forEach((pump) => {
          if (pump.calibrations && pump.calibrations.length > 0) {
            newCache.set(pump._id, pump.calibrations);
          }
        });
        if (newCache.size > 0) {
          setPumpCalibrationsCache(newCache);
        }

        // Filter for active pumps using calculated status
        const activePumps = pumpsWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Filter for active flowmeters using calculated status
        const activeFlowmeters = flowmetersWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        setAirPumps(activePumps);
        setFlowmeters(activeFlowmeters);
        setAirPumpsLoaded(true);
      } catch (error) {
        console.error("Error fetching equipment and calibrations:", error);
        setAirPumpsLoaded(true); // Set to true even on error so field can be enabled
      }
    };
    fetchEquipmentAndCalibrations();

    return () => {
      isMounted = false;
    };
  }, [calculateStatus]);

  // Fetch available flowrates for selected pump (based on passed calibrations)
  // Uses cached calibration data if available, otherwise fetches it
  const fetchAvailableFlowrates = useCallback(
    async (pumpEquipmentReference) => {
      try {
        // Find the pump by equipmentReference
        const selectedPump = airPumps.find(
          (p) => p.equipmentReference === pumpEquipmentReference
        );

        if (!selectedPump) {
          setAvailableFlowrates([]);
          return;
        }

        // Use cached calibrations if available, otherwise fetch
        let calibrations = selectedPump.calibrations;
        if (!calibrations || calibrations.length === 0) {
          // Check cache first
          const cached = pumpCalibrationsCache.get(selectedPump._id);
          if (cached) {
            calibrations = cached;
          } else {
            // Fetch if not in cache
            const calibrationResponse =
              await airPumpCalibrationService.getPumpCalibrations(
                selectedPump._id,
                1,
                1000
              );
            calibrations =
              calibrationResponse.data || calibrationResponse || [];
            // Cache for future use
            const cache = new Map(pumpCalibrationsCache);
            cache.set(selectedPump._id, calibrations);
            setPumpCalibrationsCache(cache);
          }
        }

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
        if (currentCalibration && currentCalibration.testResults && currentCalibration.testResults.length > 0) {
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
    },
    [airPumps, pumpCalibrationsCache]
  );

  // Fetch sample data
  useEffect(() => {
    const fetchSample = async () => {
      try {
        setIsLoading(true);
        const response = await sampleService.getById(sampleId);
        const sampleData = response.data;

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

        // Derive field blank from stored flag or location so the checkbox is retained when editing
        const isFieldBlankSample =
          !!sampleData.isFieldBlank ||
          sampleData.location === FIELD_BLANK_LOCATION;
        const isNegAirSample =
          !isFieldBlankSample &&
          (!!sampleData.isNegAirExhaust ||
            sampleData.location === NEG_AIR_EXHAUST_LOCATION);

        // Normalize type: if type is "-" but it's not a field blank, set to "Background"
        // This handles edge cases where a sample was saved with type "-" but isFieldBlank is false
        let normalizedType = isFieldBlankSample ? "-" : sampleData.type;
        if (!isFieldBlankSample && normalizedType === "-") {
          normalizedType = "Background";
        }

        // Normalize location: if location is "Field blank" but it's not a field blank, clear it
        let normalizedLocation = sampleData.location;
        if (!isFieldBlankSample && normalizedLocation === FIELD_BLANK_LOCATION) {
          normalizedLocation = "";
        }

        const flowmeterValue = sampleData.flowmeter || "";
        setForm({
          sampleNumber: sampleNumber,
          type: normalizedType,
          location: isFieldBlankSample
            ? FIELD_BLANK_LOCATION
            : isNegAirSample
            ? normalizedLocation || NEG_AIR_EXHAUST_LOCATION
            : normalizedLocation || "",
          pumpNo: sampleData.pumpNo || "",
          flowmeter: flowmeterValue,
          // Strip "C" prefix if it exists (InputAdornment will display it)
          cowlNo: sampleData.cowlNo
            ? sampleData.cowlNo.replace(/^C+/i, "")
            : "",
          filterSize: sampleData.filterSize || "",
          startTime: sampleData.startTime || "",
          endTime: sampleData.endTime || "",
          nextDay: sampleData.nextDay || false,
          initialFlowrate: sampleData.initialFlowrate
            ? parseFloat(sampleData.initialFlowrate).toFixed(1)
            : "",
          finalFlowrate: sampleData.finalFlowrate
            ? parseFloat(sampleData.finalFlowrate).toFixed(1)
            : "",
          averageFlowrate: sampleData.averageFlowrate
            ? parseFloat(sampleData.averageFlowrate).toFixed(1)
            : "",
          notes: sampleData.notes || "",
          sampler: sampleData.collectedBy?._id || sampleData.collectedBy || "",
          isFieldBlank: isFieldBlankSample,
          isNegAirExhaust: isNegAirSample,
          status: sampleData.status || "pending",
        });

        // Show collection section if sample already has collection data
        if (sampleData.endTime || sampleData.finalFlowrate || sampleData.nextDay) {
          setShowCollectionSection(true);
          setCollectionFieldsEdited(true);
        }

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

  // Effect to fetch available flowrates when pump is set and airPumps are loaded
  useEffect(() => {
    if (form.pumpNo && airPumps.length > 0) {
      fetchAvailableFlowrates(form.pumpNo);
    }
  }, [form.pumpNo, airPumps.length, fetchAvailableFlowrates]);

  // Effect to clear filter size if it's 13mm and pump doesn't support 1.5 L/min
  useEffect(() => {
    if (form.filterSize === "13mm" && form.pumpNo && !hasOnePointFiveFlowrate) {
      setForm((prev) => ({
        ...prev,
        filterSize: "25mm", // Default to 25mm if 13mm is not supported
        initialFlowrate: "",
        finalFlowrate: "",
        averageFlowrate: "",
      }));
    }
  }, [form.filterSize, form.pumpNo, hasOnePointFiveFlowrate]);

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

          if (!isNaN(initial) && !isNaN(final) && initial > 0) {
            const avg = (initial + final) / 2;
            // Check if final flowrate is within 10% of initial flowrate
            const allowedDifference = initial * 0.1;
            const newStatus =
              Math.abs(initial - final) <= allowedDifference ? "pending" : "failed";
            
            // Format average: whole numbers and values with 1 decimal place to 1 dp, others to 2 dp
            const hasAtMostOneDecimal = parseFloat(avg.toFixed(1)) === avg;
            const formattedAvg = hasAtMostOneDecimal ? avg.toFixed(1) : avg.toFixed(2);

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

      // When filterSize changes, clear initialFlowrate if it's not valid for the new filter size
      if (name === "filterSize") {
        const currentFlowrate = parseFloat(prev.initialFlowrate);
        if (!isNaN(currentFlowrate)) {
          if (value === "13mm") {
            // For 13mm, only 1.5 L/min is allowed
            if (Math.abs(currentFlowrate - 1.5) > 0.01) {
              newForm.initialFlowrate = "";
              newForm.finalFlowrate = "";
              newForm.averageFlowrate = "";
            }
          } else {
            // For 25mm, 1.5 L/min is not allowed
            if (Math.abs(currentFlowrate - 1.5) < 0.01) {
              newForm.initialFlowrate = "";
              newForm.finalFlowrate = "";
              newForm.averageFlowrate = "";
            }
          }
        }
      }

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
        const formattedAvg = hasAtMostOneDecimal ? avg.toFixed(1) : avg.toFixed(2);

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
      const totalVolume = minutes * parseFloat(form.finalFlowrate);
      isInsufficient = totalVolume < 72;
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

  // Separate effect to ensure sample number is calculated when projectID is available
  useEffect(() => {
    const calculateSampleNumber = async () => {
      if (!projectID) return;
      if (form.sampleNumber) {
        console.debug(
          "[EditSample] Skipping sample number recalculation; existing sample number present"
        );
        return;
      }

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

        // Only update if we don't already have a sample number
        setForm((prev) => ({
          ...prev,
          sampleNumber: nextSampleNumber.toString(),
        }));
      } catch (error) {
        console.error("Error auto-calculating sample number for edit:", error);
        // Set default if calculation fails and no sample number exists
        setForm((prev) => ({
          ...prev,
          sampleNumber: prev.sampleNumber || "AM1",
        }));
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
      hour: hour || ((field === "startTime" || field === "endTime") ? "-" : "00"),
      minute: minute || ((field === "startTime" || field === "endTime") ? "-" : "00"),
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
    const hour = type === "hour" ? value : (currentTime.hour === "-" ? "00" : currentTime.hour);
    const minute = type === "minute" ? value : (currentTime.minute === "-" ? "00" : currentTime.minute);
    const newTime = formatTime(hour, minute);
    setForm((prev) => ({ ...prev, [field]: newTime }));
    
    // Track if collection time has been edited
    if (field === "endTime") {
      setCollectionFieldsEdited(true);
      setShowCollectionSection(true);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!form.sampler) {
      errors.sampler = "Sampler is required";
    }

    if (!form.sampleNumber) {
      errors.sampleNumber = "Sample number is required";
    }

    if (!isSimplifiedSample) {
      if (!form.pumpNo) {
        errors.pumpNo = "Pump No. is required";
      }
      if (!form.flowmeter) {
        errors.flowmeter = "Flowmeter is required";
      }
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
          errors.endTime = "Collection time cannot be before setup time Next Day' is selected";
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
      console.log("[EditSample] Validation failed with errors:", errors);
    }
    return { isValid, errors };
  };

  const handleSubmit = async (e) => {
    // Prevent any default behavior if event is provided
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const logLabel = "[EditSample] handleSubmit";
    console.time(`${logLabel} total`);
    console.time(`${logLabel} validation`);

    setError("");
    setFieldErrors({});

    const { isValid, errors: validationErrors } = validateForm();
    console.timeEnd(`${logLabel} validation`);
    if (!isValid) {
      console.log("[EditSample] Form validation failed, errors:", validationErrors);
      console.timeEnd(`${logLabel} total`);
      return;
    }
    
    console.log("[EditSample] Form validation passed, proceeding with submission");

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

      // Generate full sample ID in the format: {projectID}-{sampleNumber}
      const fullSampleID = `${projectID}-${form.sampleNumber}`;

      // Map sample type to match backend enum
      // Field blanks should have type set to "-"
      // Normalize type: if isFieldBlank is false but type is "-", set to "Background"
      let sampleType = form.isFieldBlank ? "-" : form.type;
      if (!form.isFieldBlank && sampleType === "-") {
        sampleType = "Background";
      }

      // Normalize location: if isFieldBlank is false but location is "Field blank", clear it
      let normalizedLocation = form.location;
      if (!form.isFieldBlank && normalizedLocation === FIELD_BLANK_LOCATION) {
        normalizedLocation = "";
      }

      // Format times to include seconds
      const formatTime = (time) => {
        if (!time) return "";
        return time.includes(":") ? time : `${time}:00`;
      };

      // Ensure cowlNo has "C" prefix
      const cowlNoWithPrefix =
        form.cowlNo && !form.cowlNo.startsWith("C")
          ? `C${form.cowlNo}`
          : form.cowlNo || null;
      // Ensure nextDay is a boolean
      const nextDayValue =
        form.nextDay === true ||
        form.nextDay === "on" ||
        form.nextDay === "true";
      const sampleData = {
        shift: shiftId,
        job: job._id,
        sampleNumber: form.sampleNumber,
        fullSampleID: fullSampleID,
        isFieldBlank: form.isFieldBlank || false, // Explicitly set boolean
        type: sampleType || null,
        location: normalizedLocation || null,
        pumpNo: form.pumpNo || null,
        flowmeter: form.flowmeter || null,
        cowlNo: cowlNoWithPrefix,
        nextDay: nextDayValue,
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

      console.time(`${logLabel} update`);
      await sampleService.update(sampleId, sampleData);
      console.timeEnd(`${logLabel} update`);
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
      try {
        console.timeEnd(`${logLabel} total`);
      } catch (timerError) {
        // ignore timer errors (e.g., already ended)
      }
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
              <FormControl fullWidth required error={!!fieldErrors.pumpNo}>
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
                      <MenuItem key={pump._id} value={pump.equipmentReference}>
                        {pump.equipmentReference}
                        {pump.brandModel ? ` - ${pump.brandModel}` : ""}
                      </MenuItem>
                    ))
                  ) : airPumpsLoaded ? (
                    <MenuItem disabled value="">
                      No active air pumps available
                    </MenuItem>
                  ) : null}
                </Select>
                {fieldErrors.pumpNo && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.pumpNo}
                  </Typography>
                )}
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Filter Size</InputLabel>
                <Select
                  name="filterSize"
                  value={form.filterSize}
                  onChange={handleChange}
                  label="Filter Size"
                  disabled={!form.pumpNo}
                >
                  <MenuItem value="25mm">25mm</MenuItem>
                  {hasOnePointFiveFlowrate && (
                    <MenuItem value="13mm">13mm</MenuItem>
                  )}
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
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <FormControl required sx={{ minWidth: 100 }} error={!!fieldErrors.startTime}>
                  <InputLabel>Hour</InputLabel>
                  <Select
                    value={parseTime(form.startTime, "startTime").hour}
                    onChange={(e) => handleTimeChange("startTime", "hour", e.target.value)}
                    label="Hour"
                  >
                    <MenuItem value="-">-</MenuItem>
                    {Array.from({ length: 24 }, (_, i) => 
                      i.toString().padStart(2, "0")
                    ).map((hour) => (
                      <MenuItem key={hour} value={hour}>
                        {hour}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl required sx={{ minWidth: 100 }} error={!!fieldErrors.startTime}>
                  <InputLabel>Minutes</InputLabel>
                  <Select
                    value={parseTime(form.startTime, "startTime").minute}
                    onChange={(e) => handleTimeChange("startTime", "minute", e.target.value)}
                    label="Minutes"
                  >
                    <MenuItem value="-">-</MenuItem>
                    {Array.from({ length: 60 }, (_, i) => 
                      i.toString().padStart(2, "0")
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
              {fieldErrors.startTime && (
                <Typography variant="caption" color="error" sx={{ mt: -1, mb: 1, ml: 1 }}>
                  {fieldErrors.startTime}
                </Typography>
              )}
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
                  disabled={!form.pumpNo || !form.filterSize || filteredFlowrates.length === 0}
                >
                  <MenuItem value="">
                    <em>
                      {!form.pumpNo
                        ? "Select a pump first"
                        : !form.filterSize
                        ? "Select filter size first"
                        : filteredFlowrates.length === 0
                        ? form.filterSize === "13mm"
                          ? "No 1.5 L/min calibration available for 13mm filter"
                          : "No passed calibrations available"
                        : "Select flowrate"}
                    </em>
                  </MenuItem>
                  {filteredFlowrates.map((flowrate) => {
                    const flowrateStr = flowrate.toFixed(1);
                    return (
                      <MenuItem key={flowrateStr} value={flowrateStr}>
                        {flowrateStr}
                      </MenuItem>
                    );
                  })}
                </Select>
                {fieldErrors.initialFlowrate && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {fieldErrors.initialFlowrate}
                  </Typography>
                )}
              </FormControl>
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
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <FormControl required sx={{ minWidth: 100 }} error={insufficientSampleTime || collectionTimeBeforeSetup || !!fieldErrors.endTime}>
                      <InputLabel>Hour</InputLabel>
                      <Select
                        value={parseTime(form.endTime, "endTime").hour}
                        onChange={(e) => handleTimeChange("endTime", "hour", e.target.value)}
                        label="Hour"
                      >
                        <MenuItem value="-">-</MenuItem>
                        {Array.from({ length: 24 }, (_, i) => 
                          i.toString().padStart(2, "0")
                        ).map((hour) => (
                          <MenuItem key={hour} value={hour}>
                            {hour}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl required sx={{ minWidth: 100 }} error={insufficientSampleTime || collectionTimeBeforeSetup || !!fieldErrors.endTime}>
                      <InputLabel>Minutes</InputLabel>
                      <Select
                        value={parseTime(form.endTime, "endTime").minute}
                        onChange={(e) => handleTimeChange("endTime", "minute", e.target.value)}
                        label="Minutes"
                      >
                        <MenuItem value="-">-</MenuItem>
                        {Array.from({ length: 60 }, (_, i) => 
                          i.toString().padStart(2, "0")
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
                  {fieldErrors.endTime && (
                    <Typography variant="caption" color="error" sx={{ mt: -1, mb: 1, ml: 1 }}>
                      {fieldErrors.endTime}
                    </Typography>
                  )}
                  {insufficientSampleTime && !fieldErrors.endTime && (
                    <Typography variant="caption" color="error" sx={{ mt: -1, mb: 1, ml: 1 }}>
                      Insufficient sample time
                    </Typography>
                  )}
                  <Box sx={{ display: "flex", alignItems: "center", mt: -1, mb: 1 }}>
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
                    name="finalFlowrate"
                    label="Final Flowrate (L/min)"
                    value={form.finalFlowrate}
                    onChange={handleChange}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        const num = parseFloat(value);
                        // If whole number or has only 1 decimal place, format to 1 decimal place, otherwise 2 decimal places
                        const hasAtMostOneDecimal = parseFloat(num.toFixed(1)) === num;
                        const formatted = hasAtMostOneDecimal ? num.toFixed(1) : num.toFixed(2);
                        setForm((prev) => ({
                          ...prev,
                          finalFlowrate: formatted,
                        }));
                      }
                    }}
                    type="number"
                    inputProps={{ step: "0.01", min: "0" }}
                    fullWidth
                    error={!!fieldErrors.finalFlowrate}
                    helperText={
                      fieldErrors.finalFlowrate ||
                      (form.initialFlowrate && !isNaN(parseFloat(form.initialFlowrate))
                        ? `Must be within 10% of initial flowrate (${(parseFloat(form.initialFlowrate) * 0.9).toFixed(2)} - ${(parseFloat(form.initialFlowrate) * 1.1).toFixed(2)} L/min)`
                        : "")
                    }
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -0.5, mb: 1 }}>
                    *If pump has failed, set final flowrate to 0L/min
                  </Typography>
                  <TextField
                    name="averageFlowrate"
                    label="Average Flowrate"
                    value={
                      form.status === "failed"
                        ? "FAILED - Final flowate is not within 10% of initial flowrate"
                        : form.averageFlowrate && !isNaN(parseFloat(form.averageFlowrate))
                        ? (() => {
                            const num = parseFloat(form.averageFlowrate);
                            // If whole number or has only 1 decimal place, display to 1 decimal place, otherwise 2 decimal places
                            const hasAtMostOneDecimal = parseFloat(num.toFixed(1)) === num;
                            return hasAtMostOneDecimal ? num.toFixed(1) : num.toFixed(2);
                          })()
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default EditSample;
