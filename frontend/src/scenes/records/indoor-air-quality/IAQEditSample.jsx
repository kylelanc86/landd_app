// This file is based on IAQNewSample.jsx but adapted for editing existing samples
// It loads existing sample data and allows editing

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
  Autocomplete,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { userService } from "../../../services/api";
import { equipmentService } from "../../../services/equipmentService";
import { flowmeterCalibrationService } from "../../../services/flowmeterCalibrationService";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
import { iaqSampleService } from "../../../services/iaqSampleService";
import { useAuth } from "../../../context/AuthContext";
import { useSnackbar } from "../../../context/SnackbarContext";

const FIELD_BLANK_LOCATION = "Field blank";

// Predefined location options for IAQ samples
const IAQ_LOCATION_OPTIONS = [
  "Fibre ID Lab - on top of fume cabinet",
  "Fibre Counting Lab - on window sill",
];

const IAQEditSample = () => {
  const theme = useTheme();
  const { iaqRecordId, sampleId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [airPumps, setAirPumps] = useState([]);
  const [airPumpsLoaded, setAirPumpsLoaded] = useState(false);
  const [flowmeters, setFlowmeters] = useState([]);
  const [availableFlowrates, setAvailableFlowrates] = useState([]);
  const [pumpCalibrationsCache, setPumpCalibrationsCache] = useState(new Map());
  const [form, setForm] = useState({
    sampler: "",
    sampleNumber: "",
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
    isFieldBlank: false,
    status: "pending",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [insufficientSampleTime, setInsufficientSampleTime] = useState(false);
  const [collectionTimeBeforeSetup, setCollectionTimeBeforeSetup] = useState(false);
  const [showCollectionSection, setShowCollectionSection] = useState(false);
  const [collectionFieldsEdited, setCollectionFieldsEdited] = useState(false);

  const isSimplifiedSample = form.isFieldBlank;

  const hasOnePointFiveFlowrate = useMemo(() => {
    return availableFlowrates.some(flowrate => Math.abs(flowrate - 1.5) < 0.01);
  }, [availableFlowrates]);

  const filteredFlowrates = useMemo(() => {
    if (!form.filterSize) {
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) > 0.01);
    }
    
    if (form.filterSize === "13mm") {
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) < 0.01);
    } else {
      return availableFlowrates.filter(flowrate => Math.abs(flowrate - 1.5) > 0.01);
    }
  }, [availableFlowrates, form.filterSize]);

  // Fetch asbestos assessors
  useEffect(() => {
    const fetchAsbestosAssessors = async () => {
      try {
        const response = await userService.getAll();
        const users = response.data;

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

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  }, []);

  // Calculate equipment status
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

      const isFlowmeter =
        equipment.equipmentType === "Site flowmeter" ||
        (!equipment.allCalibrations && !equipment.mostRecentCalibration);

      if (isFlowmeter) {
        const daysUntil = calculateDaysUntilCalibration(
          equipment.calibrationDue
        );
        if (daysUntil !== null && daysUntil < 0) {
          return "Calibration Overdue";
        }
        return "Active";
      }

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

      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const calibrations = equipment.allCalibrations || [];
      let hasPassedFlowrateInFrequency = false;

      for (const cal of calibrations) {
        if (!cal.calibrationDate) continue;
        const calDate = new Date(cal.calibrationDate);

        if (calDate >= oneYearAgo && calDate <= today) {
          if (cal.testResults && cal.testResults.length > 0) {
            const hasPassed = cal.testResults.some((result) => result.passed);
            if (hasPassed) {
              hasPassedFlowrateInFrequency = true;
              break;
            }
          }
        }
      }

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

  // Fetch equipment and calibrations
  useEffect(() => {
    let isMounted = true;

    const fetchEquipmentAndCalibrations = async () => {
      try {
        const response = await equipmentService.getAll();
        const allEquipment = response.equipment || [];

        const airPumps = allEquipment
          .filter((eq) => eq.equipmentType === "Air pump")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        const siteFlowmeters = allEquipment.filter(
          (equipment) => equipment.equipmentType === "Site flowmeter"
        );

        const pumpsWithCalibrations = await Promise.all(
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

              const mostRecentCalibration =
                calibrations.length > 0
                  ? calibrations.sort(
                      (a, b) =>
                        new Date(b.calibrationDate) -
                        new Date(a.calibrationDate)
                    )[0]
                  : null;

              return {
                ...pump,
                lastCalibration,
                calibrationDue,
                mostRecentCalibration,
                allCalibrations: calibrations,
                calibrations,
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
              };
            }
          })
        );

        const flowmetersWithCalibrations = await Promise.all(
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
        );

        if (!isMounted) return;

        const activePumps = pumpsWithCalibrations
          .filter((equipment) => calculateStatus(equipment) === "Active")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

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
        setAirPumpsLoaded(true);
      }
    };

    fetchEquipmentAndCalibrations();

    return () => {
      isMounted = false;
    };
  }, [calculateStatus]);

  // Fetch available flowrates for selected pump
  const fetchAvailableFlowrates = useCallback(
    async (pumpEquipmentReference) => {
      try {
        const selectedPump = airPumps.find(
          (p) => p.equipmentReference === pumpEquipmentReference
        );

        if (!selectedPump) {
          setAvailableFlowrates([]);
          return;
        }

        let calibrations = selectedPump.calibrations;
        if (!calibrations || calibrations.length === 0) {
          const cached = pumpCalibrationsCache.get(selectedPump._id);
          if (cached) {
            calibrations = cached;
          } else {
            const calibrationResponse =
              await airPumpCalibrationService.getPumpCalibrations(
                selectedPump._id,
                1,
                1000
              );
            calibrations =
              calibrationResponse.data || calibrationResponse || [];
            const cache = new Map(pumpCalibrationsCache);
            cache.set(selectedPump._id, calibrations);
            setPumpCalibrationsCache(cache);
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentCalibration = calibrations.find((cal) => {
          if (!cal.nextCalibrationDue) return false;
          const nextDueDate = new Date(cal.nextCalibrationDue);
          nextDueDate.setHours(0, 0, 0, 0);
          return nextDueDate >= today;
        });

        const passedFlowrates = [];
        if (currentCalibration && currentCalibration.testResults && currentCalibration.testResults.length > 0) {
          currentCalibration.testResults
            .filter((testResult) => testResult.passed)
            .forEach((testResult) => {
              const setFlowrateMlMin = testResult.setFlowrate;
              const flowrateLMin = setFlowrateMlMin / 1000;
              if (!passedFlowrates.includes(flowrateLMin)) {
                passedFlowrates.push(flowrateLMin);
              }
            });
        }
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
        const response = await iaqSampleService.getById(sampleId);
        const sampleData = response.data;

        const sampleNumber = sampleData.fullSampleID?.match(/AM(\d+)$/)?.[0] || sampleData.fullSampleID || "AM1";

        const isFieldBlankSample = !!sampleData.isFieldBlank;

        let normalizedLocation = sampleData.location;
        if (!isFieldBlankSample && normalizedLocation === FIELD_BLANK_LOCATION) {
          normalizedLocation = "";
        }

        const flowmeterValue = sampleData.flowmeter || "";
        setForm({
          sampleNumber: sampleNumber,
          location: isFieldBlankSample
            ? FIELD_BLANK_LOCATION
            : normalizedLocation || "",
          pumpNo: sampleData.pumpNo || "",
          flowmeter: flowmeterValue,
          cowlNo: sampleData.cowlNo
            ? sampleData.cowlNo.replace(/^C+/i, "")
            : "",
          filterSize: sampleData.filterSize || "",
          startTime: sampleData.startTime || "",
          endTime: sampleData.endTime || "",
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
          sampler: sampleData.collectedBy?._id || sampleData.collectedBy || sampleData.sampler?._id || sampleData.sampler || "",
          isFieldBlank: isFieldBlankSample,
          status: sampleData.status || "pending",
        });

        if (sampleData.endTime || sampleData.finalFlowrate) {
          setShowCollectionSection(true);
          setCollectionFieldsEdited(true);
        }

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

  // Fetch available flowrates when pump is set
  useEffect(() => {
    if (form.pumpNo && airPumps.length > 0) {
      fetchAvailableFlowrates(form.pumpNo);
    }
  }, [form.pumpNo, airPumps.length, fetchAvailableFlowrates]);

  // Clear filter size if it's 13mm and pump doesn't support 1.5 L/min
  useEffect(() => {
    if (form.filterSize === "13mm" && form.pumpNo && !hasOnePointFiveFlowrate) {
      setForm((prev) => ({
        ...prev,
        filterSize: "25mm",
        initialFlowrate: "",
        finalFlowrate: "",
        averageFlowrate: "",
      }));
    }
  }, [form.filterSize, form.pumpNo, hasOnePointFiveFlowrate]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }

    const collectionFields = ["endTime", "finalFlowrate"];
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
        };

        return next;
      });
      return;
    }

    if (name === "cowlNo") {
      const cleanedValue = value.replace(/^C+/i, "");
      setForm((prev) => ({
        ...prev,
        [name]: cleanedValue,
      }));
      return;
    }

    if (name === "initialFlowrate" || name === "finalFlowrate") {
      setForm((prev) => {
        const newForm = {
          ...prev,
          [name]: value,
        };

        if (newForm.initialFlowrate && newForm.finalFlowrate) {
          const initial = parseFloat(newForm.initialFlowrate);
          const final = parseFloat(newForm.finalFlowrate);

          if (!isNaN(initial) && !isNaN(final) && initial > 0) {
            const avg = (initial + final) / 2;
            const allowedDifference = initial * 0.1;
            const newStatus =
              Math.abs(initial - final) <= allowedDifference ? "pending" : "failed";
            
            const hasAtMostOneDecimal = parseFloat(avg.toFixed(1)) === avg;
            const formattedAvg = hasAtMostOneDecimal ? avg.toFixed(1) : avg.toFixed(2);

            return {
              ...newForm,
              averageFlowrate: formattedAvg,
              status: newStatus,
            };
          }
        }

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

      if (name === "filterSize") {
        const currentFlowrate = parseFloat(prev.initialFlowrate);
        if (!isNaN(currentFlowrate)) {
          if (value === "13mm") {
            if (Math.abs(currentFlowrate - 1.5) > 0.01) {
              newForm.initialFlowrate = "";
              newForm.finalFlowrate = "";
              newForm.averageFlowrate = "";
            }
          } else {
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

    if (name === "pumpNo" && value) {
      fetchAvailableFlowrates(value);
      setForm((prev) => ({
        ...prev,
        initialFlowrate: "",
        finalFlowrate: "",
        averageFlowrate: "",
      }));
    }
  };

  // Calculate average flowrate when initial or final flowrate changes
  useEffect(() => {
    if (isSubmitting) return;

    if (form.initialFlowrate && form.finalFlowrate) {
      const initial = parseFloat(form.initialFlowrate);
      const final = parseFloat(form.finalFlowrate);

      if (!isNaN(initial) && !isNaN(final) && initial > 0) {
        const avg = (initial + final) / 2;
        const allowedDifference = initial * 0.1;
        const newStatus =
          Math.abs(initial - final) <= allowedDifference ? "pending" : "failed";
        
        const hasAtMostOneDecimal = parseFloat(avg.toFixed(1)) === avg;
        const formattedAvg = hasAtMostOneDecimal ? avg.toFixed(1) : avg.toFixed(2);

        setForm((prev) => {
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

  const calculateMinutes = (startTime, endTime) => {
    if (!startTime || !endTime) return null;

    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    let diffMinutes = endTotalMinutes - startTotalMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }

    return diffMinutes;
  };

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

    const isBefore = endTotalMinutes < startTotalMinutes;
    setCollectionTimeBeforeSetup(isBefore);
  }, [form.startTime, form.endTime, isSimplifiedSample]);

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
      form.endTime
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

  const parseTime = (timeString, field = null) => {
    if (!timeString || timeString.trim() === "") {
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
    if (hour === "-" || minute === "-") {
      return "";
    }
    return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  };

  const handleTimeChange = (field, type, value) => {
    if (value === "-") {
      setForm((prev) => ({ ...prev, [field]: "" }));
      if (field === "endTime") {
        setCollectionFieldsEdited(true);
        setShowCollectionSection(true);
      }
      return;
    }
    
    const currentTime = parseTime(form[field], field);
    const hour = type === "hour" ? value : (currentTime.hour === "-" ? "00" : currentTime.hour);
    const minute = type === "minute" ? value : (currentTime.minute === "-" ? "00" : currentTime.minute);
    const newTime = formatTime(hour, minute);
    setForm((prev) => ({ ...prev, [field]: newTime }));
    
    if (field === "endTime") {
      setCollectionFieldsEdited(true);
      setShowCollectionSection(true);
    }
  };

  // Validation
  const validateForm = async () => {
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

    if (!form.cowlNo || form.cowlNo.trim() === "") {
      errors.cowlNo = "Cowl No. is required";
    }

    if (!isSimplifiedSample) {
      if (!form.location) {
        errors.location = "Location is required";
      }
      if (!form.startTime) {
        errors.startTime = "Start time is required";
      }
      if (collectionFieldsEdited) {
        if (!form.endTime) {
          errors.endTime = "End time is required";
        }
        if (form.startTime && form.endTime && collectionTimeBeforeSetup) {
          errors.endTime = "Collection time cannot be before setup time";
        }
      }
      if (!form.initialFlowrate) {
        errors.initialFlowrate = "Initial flowrate is required";
      }
    } else if (form.isFieldBlank) {
      if (!form.location) {
        errors.location = "Location is required";
      }
    }

    setFieldErrors(errors);
    return { isValid: Object.keys(errors).length === 0, errors };
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError("");
    setFieldErrors({});

    const { isValid } = await validateForm();
    if (!isValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Ensure cowlNo has "C" prefix
      const cowlNoWithPrefix =
        form.cowlNo && !form.cowlNo.startsWith("C")
          ? `C${form.cowlNo}`
          : form.cowlNo || "";

      // Normalize location for field blanks
      let normalizedLocation = form.location;
      if (form.isFieldBlank && normalizedLocation !== "Field blank") {
        normalizedLocation = "Field blank";
      }

      const sampleData = {
        location: normalizedLocation,
        pumpNo: form.pumpNo || null,
        flowmeter: form.flowmeter || null,
        cowlNo: cowlNoWithPrefix,
        sampler: form.sampler,
        filterSize: form.filterSize || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
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
        isFieldBlank: form.isFieldBlank || false,
      };

      await iaqSampleService.update(sampleId, sampleData);
      showSnackbar("Sample updated successfully", "success");
      navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`);
    } catch (error) {
      console.error("Error updating sample:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update sample";
      setError(errorMessage);
      showSnackbar(errorMessage, "error");
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
          onClick={() => navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`)}
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
        onClick={() => navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`)}
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
                : `Full Sample ID will be: ${form.sampleNumber || "XXX"}`
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
          {!isSimplifiedSample && (
            <Autocomplete
              freeSolo
              options={IAQ_LOCATION_OPTIONS}
              value={form.location}
              onInputChange={(event, newValue) => {
                setForm((prev) => ({
                  ...prev,
                  location: newValue || "",
                }));
                if (fieldErrors.location) {
                  setFieldErrors((prev) => ({
                    ...prev,
                    location: "",
                  }));
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  name="location"
                  label="Location"
                  autoComplete="off"
                  required
                  error={!!fieldErrors.location}
                  helperText={fieldErrors.location}
                />
              )}
            />
          )}
          {isSimplifiedSample && (
            <Autocomplete
              freeSolo
              options={IAQ_LOCATION_OPTIONS}
              value={
                form.isFieldBlank ? FIELD_BLANK_LOCATION : form.location || ""
              }
              onInputChange={(event, newValue) => {
                if (!form.isFieldBlank) {
                  setForm((prev) => ({
                    ...prev,
                    location: newValue || "",
                  }));
                  if (fieldErrors.location) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      location: "",
                    }));
                  }
                }
              }}
              disabled={form.isFieldBlank}
              renderInput={(params) => (
                <TextField
                  {...params}
                  name="location"
                  label="Location"
                  autoComplete="off"
                  required
                  error={!!fieldErrors.location}
                  helperText={fieldErrors.location}
                />
              )}
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
                  <TextField
                    name="finalFlowrate"
                    label="Final Flowrate (L/min)"
                    value={form.finalFlowrate}
                    onChange={handleChange}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value && !isNaN(parseFloat(value))) {
                        const num = parseFloat(value);
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
                  <TextField
                    name="averageFlowrate"
                    label="Average Flowrate"
                    value={
                      form.status === "failed"
                        ? "FAILED - Final flowrate is not within 10% of initial flowrate"
                        : form.averageFlowrate && !isNaN(parseFloat(form.averageFlowrate))
                        ? (() => {
                            const num = parseFloat(form.averageFlowrate);
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
            <Button variant="outlined" onClick={() => navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`)}>
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

export default IAQEditSample;
