import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  useTheme,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Tabs,
  Tab,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
import { equipmentService } from "../../../services/equipmentService";
import { flowmeterCalibrationService } from "../../../services/flowmeterCalibrationService";
import userService from "../../../services/userService";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { useAuth } from "../../../context/AuthContext";

const AirPumpPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [pumps, setPumps] = useState([]);
  const [pumpsLoading, setPumpsLoading] = useState(false);
  const [flowmeters, setFlowmeters] = useState([]);
  const [flowmetersLoading, setFlowmetersLoading] = useState(false);
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOutOfService, setShowOutOfService] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmCloseDialog, setConfirmCloseDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [outOfServiceDialog, setOutOfServiceDialog] = useState(false);
  const [selectedPumpForOutOfService, setSelectedPumpForOutOfService] = useState(null);
  const [outOfServiceReason, setOutOfServiceReason] = useState("");

  // Static form data (shared across all calibrations)
  const [staticFormData, setStaticFormData] = useState({
    pumpId: "",
    pumpEquipmentId: "",
    date: formatDateForInput(new Date()),
    technicianId: "",
    technicianName: "",
    flowmeterId: "",
    notes: "",
  });

  // Array of calibration test results (one per flowrate)
  const [calibrations, setCalibrations] = useState([]);

  // Available flowrates
  const availableFlowrates = ["1", "1.5", "2", "3", "4"];

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

      // If explicitly marked as out-of-service, return that
      if (equipment.status === "out-of-service") {
        return "Out-of-Service";
      }

      // For other statuses or when status is not explicitly set, run full validation
      if (!equipment.lastCalibration || !equipment.calibrationDue) {
        return "Out-of-Service";
      }

      // Check if the most recent calibration has all flowrates failing
      // If all test results failed, the pump should be Out-of-Service
      // This check must happen BEFORE trusting backend status
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
    [calculateDaysUntilCalibration]
  );

  const fetchPumps = useCallback(async () => {
    try {
      setPumpsLoading(true);
      const response = await equipmentService.getAll();
      const allEquipment = response.equipment || [];

      // Filter for Air pump equipment
      const airPumps = allEquipment
        .filter((equipment) => equipment.equipmentType === "Air pump")
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      // Bulk fetch calibrations for all pumps at once
      let pumpCalibrationsMap = {};
      if (airPumps.length > 0) {
        try {
          const pumpIds = airPumps.map((pump) => pump._id?.toString() || pump._id);
          const bulkCalibrations =
            await airPumpCalibrationService.getBulkPumpCalibrations(
              pumpIds,
              1000
            );
          // Convert to map keyed by pump _id string
          // The backend returns keys as strings, so we ensure all keys are strings
          if (bulkCalibrations && typeof bulkCalibrations === 'object') {
            Object.keys(bulkCalibrations).forEach((pumpId) => {
              pumpCalibrationsMap[pumpId] = bulkCalibrations[pumpId];
            });
          }
        } catch (err) {
          console.error("Error bulk fetching pump calibrations:", err);
          console.error("Error details:", err.response?.data || err.message);
          // Continue with empty map - individual processing will handle empty arrays
        }
      }

      // Process each pump with its calibrations
      const pumpsWithCalibrations = airPumps.map((pump) => {
        // Convert pump._id to string to match backend response keys
        const pumpIdString = pump._id?.toString() || pump._id;
        const calibrations = pumpCalibrationsMap[pumpIdString] || [];

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

        // Calculate flowrateCalibrations (group by flowrate, get most recent for each)
        // Convert setFlowrate from mL/min to L/min and get the most recent status
        const flowrateCalibrations = {};
        calibrations.forEach((cal) => {
          if (cal.testResults && cal.testResults.length > 0) {
            // Iterate through all test results (each can have a different flowrate)
            cal.testResults.forEach((testResult) => {
              const setFlowrateMlMin = testResult.setFlowrate;
              const flowrateLMin = (setFlowrateMlMin / 1000).toString();

              // Use the test result's passed status, or overallResult as fallback
              const testStatus = testResult.passed ? "Pass" : "Fail";

              // Use overallResult as the status for this flowrate
              if (
                !flowrateCalibrations[flowrateLMin] ||
                new Date(cal.calibrationDate) >
                  new Date(
                    flowrateCalibrations[flowrateLMin].lastCalibrationDate
                  )
              ) {
                flowrateCalibrations[flowrateLMin] = {
                  status: testStatus,
                  lastCalibrationDate: cal.calibrationDate,
                };
              }
            });
          }
        });

        // Get the most recent flowmeter used (from most recent calibration with a flowmeter)
        let mostRecentFlowmeter = null;
        const calibrationsWithFlowmeter = calibrations
          .filter((cal) => cal.flowmeterId)
          .sort(
            (a, b) =>
              new Date(b.calibrationDate) - new Date(a.calibrationDate)
          );

        if (calibrationsWithFlowmeter.length > 0) {
          const mostRecentCal = calibrationsWithFlowmeter[0];
          // Handle both populated object and ID
          if (
            typeof mostRecentCal.flowmeterId === "object" &&
            mostRecentCal.flowmeterId.equipmentReference
          ) {
            mostRecentFlowmeter =
              mostRecentCal.flowmeterId.equipmentReference;
          } else if (mostRecentCal.flowmeterId) {
            // If it's just an ID, we'll need to look it up later or store the ID
            mostRecentFlowmeter = mostRecentCal.flowmeterId;
          }
        }

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
          flowrateCalibrations,
          mostRecentFlowmeter,
          mostRecentCalibration, // Store for status calculation
          allCalibrations: calibrations, // Store all calibrations for status calculation
        };
      });

      setPumps(pumpsWithCalibrations);
      setError(null);
    } catch (err) {
      console.error("Error fetching air pumps:", err);
      setError(err.message || "Failed to fetch air pumps");
    } finally {
      setPumpsLoading(false);
    }
  }, []);

  // Fetch lab signatories (users with signatory=true OR calibration approval=true)
  const fetchLabSignatories = useCallback(async () => {
    try {
      setLabSignatoriesLoading(true);
      const response = await userService.getAll();
      const users = response.data || response || [];
      const signatories = users.filter(
        (user) =>
          user.isActive &&
          (user.labSignatory === true || user.labApprovals?.calibrations === true)
      );
      setLabSignatories(signatories);
    } catch (err) {
      console.error("Error fetching lab signatories:", err);
      setLabSignatories([]);
    } finally {
      setLabSignatoriesLoading(false);
    }
  }, []);

  // Fetch calibrated site flowmeters
  const fetchFlowmeters = useCallback(async () => {
    try {
      setFlowmetersLoading(true);
      const response = await equipmentService.getAll();
      const allEquipment = response.equipment || [];

      // Filter for Site flowmeter equipment
      const siteFlowmeters = allEquipment
        .filter((equipment) => equipment.equipmentType === "Site flowmeter")
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      // Fetch calibration data for each flowmeter
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
                      ...calibrations.map((cal) => new Date(cal.date).getTime())
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

      // Filter for active/calibrated flowmeters
      const activeFlowmeters = flowmetersWithCalibrations
        .filter((equipment) => {
          if (!equipment) return false;
          if (equipment.status === "out-of-service") return false;
          if (!equipment.lastCalibration || !equipment.calibrationDue)
            return false;
          const today = new Date();
          const dueDate = new Date(equipment.calibrationDue);
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil(
            (dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24)
          );
          return daysUntil >= 0;
        })
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      setFlowmeters(activeFlowmeters);
    } catch (err) {
      console.error("Error fetching flowmeters:", err);
      setFlowmeters([]);
    } finally {
      setFlowmetersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPumps();
    fetchLabSignatories();
    fetchFlowmeters();
  }, [fetchPumps, fetchLabSignatories, fetchFlowmeters]);

  // Listen for equipment data updates
  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchPumps();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchPumps]);

  // Check if there are unsaved changes
  const checkUnsavedChanges = useCallback(() => {
    const hasStaticData =
      staticFormData.pumpEquipmentId ||
      staticFormData.date !== formatDateForInput(new Date()) ||
      staticFormData.technicianId ||
      staticFormData.flowmeterId ||
      staticFormData.notes;

    const hasCalibrations =
      calibrations.length > 0 &&
      calibrations.some((cal) => cal.flowRate || cal.actualFlow);

    return hasStaticData || hasCalibrations;
  }, [staticFormData, calibrations]);

  // Handle dialog close with confirmation
  const handleDialogClose = (confirmed = false) => {
    if (!confirmed && checkUnsavedChanges()) {
      setConfirmCloseDialog(true);
      return;
    }
    setAddDialogOpen(false);
    setError(null);
    setHasUnsavedChanges(false);
    setConfirmCloseDialog(false);
    // Reset form
    const todayDate = formatDateForInput(new Date());
    setStaticFormData({
      pumpId: "",
      pumpEquipmentId: "",
      date: todayDate,
      technicianId: "",
      technicianName: "",
      flowmeterId: "",
      notes: "",
    });
    setCalibrations([]);
    setActiveTab(0);
  };

  const handleAdd = () => {
    const todayDate = formatDateForInput(new Date());
    setStaticFormData({
      pumpId: "",
      pumpEquipmentId: "",
      date: todayDate,
      technicianId: "",
      technicianName: "",
      flowmeterId: "",
      notes: "",
    });
    setCalibrations([]);
    setActiveTab(0);
    setHasUnsavedChanges(false);
    setAddDialogOpen(true);
  };

  const handlePumpChange = (pumpEquipmentId) => {
    const selectedPump = pumps.find((p) => p._id === pumpEquipmentId);
    setStaticFormData((prev) => ({
      ...prev,
      pumpEquipmentId: pumpEquipmentId,
      pumpId: selectedPump ? selectedPump.equipmentReference : "",
    }));
    setError(null);
    setHasUnsavedChanges(true);
  };

  const handleTechnicianChange = (technicianId) => {
    const selectedTechnician = labSignatories.find(
      (t) => t._id === technicianId
    );
    setStaticFormData((prev) => ({
      ...prev,
      technicianId: technicianId,
      technicianName: selectedTechnician
        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
        : "",
    }));
    setHasUnsavedChanges(true);
  };

  // Add a new calibration tab
  const handleAddCalibration = () => {
    const usedFlowrates = calibrations
      .map((cal) => cal.flowRate)
      .filter(Boolean);
    const nextFlowrate = availableFlowrates.find(
      (rate) => !usedFlowrates.includes(rate)
    );

    if (!nextFlowrate) {
      setError("All flowrates have been calibrated");
      return;
    }

    setCalibrations((prev) => [
      ...prev,
      {
        flowRate: nextFlowrate,
        actualFlow: "",
        errorPercent: "",
        status: "",
      },
    ]);
    setActiveTab(calibrations.length);
    setHasUnsavedChanges(true);
  };

  // Remove a calibration
  const handleRemoveCalibration = (index) => {
    setCalibrations((prev) => prev.filter((_, i) => i !== index));
    if (activeTab >= calibrations.length - 1) {
      setActiveTab(Math.max(0, calibrations.length - 2));
    }
    setHasUnsavedChanges(true);
  };

  // Update calibration data
  const handleCalibrationChange = (index, field, value) => {
    setCalibrations((prev) => {
      const updated = [...prev];
      const calibration = { ...updated[index] };

      if (field === "flowRate") {
        calibration.flowRate = value;
        // Recalculate if actualFlow exists
        if (calibration.actualFlow && value) {
          const actualFlowNum = parseFloat(calibration.actualFlow);
          const flowRateNum = parseFloat(value);
          if (
            !isNaN(actualFlowNum) &&
            !isNaN(flowRateNum) &&
            flowRateNum !== 0
          ) {
            const errorValue = Math.abs(
              ((actualFlowNum - flowRateNum) / flowRateNum) * 100
            );
            calibration.errorPercent = errorValue.toFixed(2);
            calibration.status = errorValue < 5 ? "Pass" : "Fail";
          }
        }
      } else if (field === "actualFlow") {
        calibration.actualFlow = value;
        // Recalculate if flowRate exists
        if (calibration.flowRate && value) {
          const actualFlowNum = parseFloat(value);
          const flowRateNum = parseFloat(calibration.flowRate);
          if (
            !isNaN(actualFlowNum) &&
            !isNaN(flowRateNum) &&
            flowRateNum !== 0
          ) {
            const errorValue = Math.abs(
              ((actualFlowNum - flowRateNum) / flowRateNum) * 100
            );
            calibration.errorPercent = errorValue.toFixed(2);
            calibration.status = errorValue < 5 ? "Pass" : "Fail";
          }
        }
      } else {
        calibration[field] = value;
      }

      updated[index] = calibration;
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = checkUnsavedChanges();
    setHasUnsavedChanges(hasChanges);
  }, [staticFormData, calibrations, checkUnsavedChanges]);

  // Handle browser navigation and refresh
  useEffect(() => {
    if (!addDialogOpen || !hasUnsavedChanges) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue =
        "You have unsaved calibration data. Are you sure you want to leave?";
      return "You have unsaved calibration data. Are you sure you want to leave?";
    };

    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        window.history.pushState(null, "", window.location.pathname);
        setConfirmCloseDialog(true);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [addDialogOpen, hasUnsavedChanges]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      if (
        !staticFormData.pumpEquipmentId ||
        !staticFormData.date ||
        !staticFormData.technicianId
      ) {
        setError(
          "Please fill in all required static fields (Pump, Date, Technician)"
        );
        return;
      }

      if (calibrations.length === 0) {
        setError("Please add at least one calibration");
        return;
      }

      // Validate all calibrations
      for (let i = 0; i < calibrations.length; i++) {
        const cal = calibrations[i];
        if (!cal.flowRate || !cal.actualFlow) {
          setError(
            `Calibration ${
              i + 1
            } is incomplete. Please fill in flowrate and actual flow.`
          );
          return;
        }
      }

      // Create test results for all calibrations
      const testResults = calibrations.map((cal) => {
        const setFlowrateMlMin = Math.round(parseFloat(cal.flowRate) * 1000);
        const actualFlowrateMlMin = parseFloat(cal.actualFlow) * 1000;

        // Validate setFlowrate is in the allowed enum values
        const allowedFlowrates = [1000, 1500, 2000, 3000, 4000];
        if (!allowedFlowrates.includes(setFlowrateMlMin)) {
          throw new Error(`Invalid flowrate: ${cal.flowRate} L/min`);
        }

        // Calculate percent error
        const percentError = Math.abs(
          ((actualFlowrateMlMin - setFlowrateMlMin) / setFlowrateMlMin) * 100
        );

        // Determine if test passed
        const passed = percentError < 5;

        return {
          setFlowrate: setFlowrateMlMin,
          actualFlowrate: actualFlowrateMlMin,
          percentError: percentError,
          passed: passed,
        };
      });

      // Determine overall result (pass if at least one test passed)
      const overallResult = testResults.some((result) => result.passed)
        ? "Pass"
        : "Fail";

      const backendData = {
        pumpId: staticFormData.pumpEquipmentId,
        calibrationDate: new Date(staticFormData.date),
        testResults: testResults,
        overallResult: overallResult,
        notes: staticFormData.notes || "",
        flowmeterId: staticFormData.flowmeterId || null,
      };

      console.log("Sending calibration data:", backendData);

      await airPumpCalibrationService.createCalibration(backendData);

      handleDialogClose(true);
      fetchPumps();

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: staticFormData.pumpEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleViewHistory = (pump) => {
    navigate(`/records/laboratory/calibrations/pump/${pump._id}`);
  };

  const handleOpenOutOfServiceDialog = (pump) => {
    setSelectedPumpForOutOfService(pump);
    setOutOfServiceReason("");
    setOutOfServiceDialog(true);
    setError(null);
  };

  const handleSetOutOfService = async () => {
    try {
      setError(null);

      if (!outOfServiceReason || outOfServiceReason.trim() === "") {
        setError("Please provide a reason for setting the equipment as out of service");
        return;
      }

      if (!selectedPumpForOutOfService || !selectedPumpForOutOfService._id) {
        setError("Pump information not available");
        return;
      }

      setLoading(true);

      // Update equipment status to out-of-service
      await equipmentService.update(selectedPumpForOutOfService._id, {
        status: "out-of-service",
      });

      // Create calibration record with out-of-service marker
      const today = new Date();
      const calibrationData = {
        pumpId: selectedPumpForOutOfService._id,
        calibrationDate: today,
        testResults: [], // Empty test results for out-of-service
        overallResult: "Fail",
        notes: `Equipment set as Out-of-Service on ${formatDate(today)}. Reason: ${outOfServiceReason.trim()}`,
        flowmeterId: null,
        nextCalibrationDue: null,
      };

      await airPumpCalibrationService.createCalibration(calibrationData);

      // Close dialog and refresh data
      setOutOfServiceDialog(false);
      setSelectedPumpForOutOfService(null);
      setOutOfServiceReason("");
      fetchPumps();

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: selectedPumpForOutOfService._id },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to set pump as out-of-service");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/list");
  };

  // Filter pumps based on showOutOfService toggle
  const filteredPumps = showOutOfService
    ? pumps
    : pumps.filter((pump) => calculateStatus(pump) !== "Out-of-Service");

  if (pumpsLoading) {
    return (
      <Box
        sx={{ p: { xs: 2, sm: 3, md: 4 } }}
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Air Pump Calibrations
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Breadcrumbs>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Records Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToCalibrations}
            sx={{ cursor: "pointer" }}
          >
            Calibrations
          </Link>
          <Typography color="text.primary">Air Pump Calibrations</Typography>
        </Breadcrumbs>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Pump Calibration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <FormControlLabel
          control={
            <Switch
              checked={showOutOfService}
              onChange={(e) => setShowOutOfService(e.target.checked)}
              color="primary"
            />
          }
          label="Show Out of Service Pumps"
        />
        <Typography variant="body2" color="text.secondary">
          ({pumps.filter((p) => calculateStatus(p) === "Active").length} active,{" "}
          {pumps.filter((p) => calculateStatus(p) === "Out-of-Service").length}{" "}
          out of service)
        </Typography>
      </Box>

      {/* Air Pump Equipment Table */}
      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          Air Pump Equipment
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Equipment Ref</TableCell>
                <TableCell>Brand/Model</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
                <TableCell>Flowmeter</TableCell>
                <TableCell>Flowrates (L/min)</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pumpsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredPumps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {showOutOfService
                        ? "No air pumps found"
                        : "No active air pumps found"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPumps.map((pump) => {
                  const status = calculateStatus(pump);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={pump._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {pump.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>{pump.brandModel || "-"}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            backgroundColor: statusColor,
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                          {status}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {pump.lastCalibration
                          ? formatDate(pump.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {status === "Out-of-Service"
                          ? "-"
                          : pump.calibrationDue
                          ? (() => {
                              const daysUntil = calculateDaysUntilCalibration(
                                pump.calibrationDue
                              );
                              let daysText;
                              let daysColor;

                              if (daysUntil === 0) {
                                daysText = "Due Today";
                                daysColor = theme.palette.warning.main;
                              } else if (daysUntil < 0) {
                                daysText = `${Math.abs(
                                  daysUntil
                                )} days overdue`;
                                daysColor = theme.palette.error.main;
                              } else {
                                daysText = `${daysUntil} days`;
                                daysColor =
                                  daysUntil <= 30
                                    ? theme.palette.warning.main
                                    : theme.palette.success.main;
                              }

                              return (
                                <Box>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                    sx={{ color: daysColor }}
                                  >
                                    {daysText}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: "0.7rem" }}
                                  >
                                    {formatDate(pump.calibrationDue)}
                                  </Typography>
                                </Box>
                              );
                            })()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {status === "Out-of-Service"
                          ? "-"
                          : pump.mostRecentFlowmeter || "-"}
                      </TableCell>
                      <TableCell>
                        {status === "Out-of-Service" ? (
                          "-"
                        ) : (
                          (() => {
                            // Handle both Map and object formats (MongoDB Maps are converted to objects in JSON)
                            const flowrateCalibrations =
                              pump.flowrateCalibrations;
                            const entries =
                              flowrateCalibrations instanceof Map
                                ? Array.from(flowrateCalibrations.entries())
                                : flowrateCalibrations
                                ? Object.entries(flowrateCalibrations)
                                : [];

                            if (entries.length > 0) {
                              return (
                                <Box display="flex" gap={0.5} flexWrap="wrap">
                                  {entries.map(([flowrate, calData]) => {
                                    const calStatus =
                                      typeof calData === "object" &&
                                      calData !== null
                                        ? calData.status
                                        : calData;
                                    const statusColor =
                                      calStatus === "Pass"
                                        ? theme.palette.success.main
                                        : theme.palette.error.main;
                                    return (
                                      <Box
                                        key={flowrate}
                                        sx={{
                                          backgroundColor: statusColor,
                                          color: "white",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          fontSize: "0.75rem",
                                          display: "inline-block",
                                        }}
                                        title={`${flowrate} L/min: ${calStatus}`}
                                      >
                                        {flowrate}
                                      </Box>
                                    );
                                  })}
                                </Box>
                              );
                            } else {
                              return (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  -
                                </Typography>
                              );
                            }
                          })()
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={1} alignItems="center">
                          <IconButton
                            onClick={() => handleViewHistory(pump)}
                            size="small"
                            title="View Calibration History"
                            sx={{ color: theme.palette.info.main }}
                          >
                            <HistoryIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleOpenOutOfServiceDialog(pump)}
                            size="small"
                            title="Set as Out of Service"
                            sx={{ color: theme.palette.error.main }}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Add Calibration Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => handleDialogClose()}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Calibration</Typography>
            <IconButton onClick={() => handleDialogClose()}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Static Fields */}
              <Box>
                <Typography
                  variant="subtitle1"
                  sx={{ mb: 2, fontWeight: "bold" }}
                >
                  Calibration Details
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <FormControl fullWidth required>
                    <InputLabel>Pump</InputLabel>
                    <Select
                      value={staticFormData.pumpEquipmentId}
                      onChange={(e) => handlePumpChange(e.target.value)}
                      label="Pump"
                      disabled={pumpsLoading}
                    >
                      <MenuItem value="">
                        <em>Select a pump</em>
                      </MenuItem>
                      {pumps.length > 0 ? (
                        pumps.map((pump) => (
                          <MenuItem key={pump._id} value={pump._id}>
                            {pump.equipmentReference} - {pump.brandModel}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>
                          {pumpsLoading ? "Loading..." : "No pumps found"}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Calibration Date"
                    type="date"
                    value={staticFormData.date}
                    onChange={(e) => {
                      setStaticFormData({
                        ...staticFormData,
                        date: e.target.value,
                      });
                      setHasUnsavedChanges(true);
                    }}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                  <FormControl fullWidth required>
                    <InputLabel>Technician</InputLabel>
                    <Select
                      value={staticFormData.technicianId}
                      onChange={(e) => handleTechnicianChange(e.target.value)}
                      label="Technician"
                      disabled={labSignatoriesLoading}
                    >
                      <MenuItem value="">
                        <em>Select a technician</em>
                      </MenuItem>
                      {labSignatories.length > 0 ? (
                        labSignatories.map((technician) => (
                          <MenuItem key={technician._id} value={technician._id}>
                            {technician.firstName} {technician.lastName}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>
                          {labSignatoriesLoading
                            ? "Loading..."
                            : "No technicians found"}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <InputLabel>Flowmeter</InputLabel>
                    <Select
                      value={staticFormData.flowmeterId}
                      onChange={(e) => {
                        setStaticFormData({
                          ...staticFormData,
                          flowmeterId: e.target.value,
                        });
                        setHasUnsavedChanges(true);
                      }}
                      label="Flowmeter"
                      disabled={flowmetersLoading}
                    >
                      <MenuItem value="">
                        <em>Select a flowmeter (optional)</em>
                      </MenuItem>
                      {flowmeters.length > 0 ? (
                        flowmeters.map((flowmeter) => (
                          <MenuItem
                            key={flowmeter._id}
                            value={String(flowmeter._id)}
                          >
                            {flowmeter.equipmentReference}
                            {flowmeter.brandModel
                              ? ` - ${flowmeter.brandModel}`
                              : ""}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>
                          {flowmetersLoading
                            ? "Loading..."
                            : "No calibrated flowmeters available"}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Flowrate Indicators */}
              {calibrations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Calibrated Flowrates:
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {calibrations.map((cal, index) => {
                      if (!cal.flowRate) return null;
                      // Only show status if calibration is complete (has actualFlow and errorPercent)
                      const isComplete = cal.actualFlow && cal.errorPercent;
                      const statusColor = isComplete
                        ? cal.status === "Pass"
                          ? theme.palette.success.main
                          : theme.palette.error.main
                        : theme.palette.grey[400];
                      return (
                        <Chip
                          key={index}
                          label={
                            isComplete
                              ? `${cal.flowRate} L/min: ${cal.status}`
                              : `${cal.flowRate} L/min`
                          }
                          sx={{
                            backgroundColor: statusColor,
                            color: "white",
                            fontWeight: "bold",
                          }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* Calibration Tabs */}
              <Box>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    Test Results
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddCalibration}
                    disabled={calibrations.length >= availableFlowrates.length}
                    size="small"
                  >
                    Add Flowrate
                  </Button>
                </Box>

                {calibrations.length === 0 ? (
                  <Alert severity="info">
                    Click "Add Flowrate" to start adding calibration test
                    results.
                  </Alert>
                ) : (
                  <Box>
                    <Tabs
                      value={activeTab}
                      onChange={(e, newValue) => setActiveTab(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                    >
                      {calibrations.map((cal, index) => {
                        // Only show status if calibration is complete (has actualFlow and errorPercent)
                        const isComplete = cal.actualFlow && cal.errorPercent;
                        return (
                          <Tab
                            key={index}
                            label={
                              <Box display="flex" alignItems="center" gap={1}>
                                <span>{cal.flowRate || "New"} L/min</span>
                                {isComplete && cal.status && (
                                  <Chip
                                    label={cal.status}
                                    size="small"
                                    sx={{
                                      backgroundColor:
                                        cal.status === "Pass"
                                          ? theme.palette.success.main
                                          : theme.palette.error.main,
                                      color: "white",
                                      height: "20px",
                                      fontSize: "0.7rem",
                                    }}
                                  />
                                )}
                              </Box>
                            }
                          />
                        );
                      })}
                    </Tabs>

                    {calibrations.map((cal, index) => (
                      <Box
                        key={index}
                        role="tabpanel"
                        hidden={activeTab !== index}
                        sx={{ mt: 2 }}
                      >
                        {activeTab === index && (
                          <Stack spacing={2}>
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="h6">
                                Flowrate: {cal.flowRate || "Not selected"} L/min
                              </Typography>
                              {calibrations.length > 1 && (
                                <IconButton
                                  color="error"
                                  onClick={() => handleRemoveCalibration(index)}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              )}
                            </Box>
                            <Box display="flex" gap={2}>
                              <FormControl fullWidth required>
                                <InputLabel>Flowrate (L/min)</InputLabel>
                                <Select
                                  value={cal.flowRate}
                                  onChange={(e) =>
                                    handleCalibrationChange(
                                      index,
                                      "flowRate",
                                      e.target.value
                                    )
                                  }
                                  label="Flowrate (L/min)"
                                >
                                  <MenuItem value="">
                                    <em>Select flowrate</em>
                                  </MenuItem>
                                  {availableFlowrates.map((rate) => {
                                    const isUsed = calibrations.some(
                                      (c, i) =>
                                        i !== index && c.flowRate === rate
                                    );
                                    return (
                                      <MenuItem
                                        key={rate}
                                        value={rate}
                                        disabled={isUsed}
                                      >
                                        {rate} L/min{" "}
                                        {isUsed && "(Already used)"}
                                      </MenuItem>
                                    );
                                  })}
                                </Select>
                              </FormControl>
                              <TextField
                                fullWidth
                                label="Actual Flow (L/min)"
                                type="number"
                                value={cal.actualFlow}
                                onChange={(e) =>
                                  handleCalibrationChange(
                                    index,
                                    "actualFlow",
                                    e.target.value
                                  )
                                }
                                inputProps={{ step: "0.01", min: "0" }}
                                required
                                sx={{
                                  "& input[type=number]": {
                                    "-moz-appearance": "textfield",
                                  },
                                  "& input[type=number]::-webkit-outer-spin-button":
                                    {
                                      "-webkit-appearance": "none",
                                      margin: 0,
                                    },
                                  "& input[type=number]::-webkit-inner-spin-button":
                                    {
                                      "-webkit-appearance": "none",
                                      margin: 0,
                                    },
                                }}
                              />
                            </Box>
                            <TextField
                              fullWidth
                              label="Error (%)"
                              value={
                                cal.errorPercent ? `${cal.errorPercent}%` : ""
                              }
                              InputLabelProps={{ shrink: true }}
                              disabled
                            />
                            <Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  mb: 1,
                                  fontSize: "16px",
                                  fontWeight: "600",
                                }}
                              >
                                Status:
                              </Typography>
                              {cal.errorPercent ? (
                                <Typography
                                  variant="h5"
                                  sx={{
                                    color:
                                      cal.status === "Pass"
                                        ? theme.palette.success.main
                                        : theme.palette.error.main,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {cal.status}
                                </Typography>
                              ) : (
                                <Typography variant="h5" color="text.secondary">
                                  N/A
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>

              <TextField
                fullWidth
                label="Notes"
                value={staticFormData.notes}
                onChange={(e) => {
                  setStaticFormData({
                    ...staticFormData,
                    notes: e.target.value,
                  });
                  setHasUnsavedChanges(true);
                }}
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => handleDialogClose()}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                loading ||
                !staticFormData.pumpEquipmentId ||
                !staticFormData.date ||
                !staticFormData.technicianId ||
                calibrations.length === 0 ||
                calibrations.some((cal) => !cal.flowRate || !cal.actualFlow)
              }
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                "Save All Calibrations"
              )}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Confirmation Dialog for Unsaved Changes */}
      <Dialog
        open={confirmCloseDialog}
        onClose={() => setConfirmCloseDialog(false)}
      >
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogContent>
          <Typography>
            You have unsaved calibration data. Are you sure you want to leave?
            All unsaved data will be lost.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCloseDialog(false)}>Cancel</Button>
          <Button
            onClick={() => {
              handleDialogClose(true);
            }}
            variant="contained"
            color="error"
          >
            Discard Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Out-of-Service Dialog */}
      <Dialog
        open={outOfServiceDialog}
        onClose={() => {
          setOutOfServiceDialog(false);
          setSelectedPumpForOutOfService(null);
          setOutOfServiceReason("");
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Set Equipment as Out-of-Service</Typography>
            <IconButton
              onClick={() => {
                setOutOfServiceDialog(false);
                setSelectedPumpForOutOfService(null);
                setOutOfServiceReason("");
                setError(null);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to set{" "}
            <strong>{selectedPumpForOutOfService?.equipmentReference || "this equipment"}</strong> as
            Out-of-Service?
          </Typography>
          <TextField
            fullWidth
            label="Reason for Out-of-Service"
            value={outOfServiceReason}
            onChange={(e) => setOutOfServiceReason(e.target.value)}
            multiline
            rows={4}
            required
            sx={{ mt: 2 }}
            placeholder="Enter the reason for setting this equipment as out of service..."
            error={error && (!outOfServiceReason || outOfServiceReason.trim() === "")}
            helperText={error && (!outOfServiceReason || outOfServiceReason.trim() === "") ? "Reason is required" : ""}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOutOfServiceDialog(false);
              setSelectedPumpForOutOfService(null);
              setOutOfServiceReason("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSetOutOfService}
            variant="contained"
            color="error"
            disabled={loading || !outOfServiceReason || outOfServiceReason.trim() === ""}
          >
            {loading ? <CircularProgress size={24} /> : "Confirm Out-of-Service"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirPumpPage;
