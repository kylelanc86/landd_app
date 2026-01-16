import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  TablePagination,
  Tabs,
  Tab,
  Stack,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
import { equipmentService } from "../../../services/equipmentService";
import { flowmeterCalibrationService } from "../../../services/flowmeterCalibrationService";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import userService from "../../../services/userService";

const AirPumpCalibrationPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pumpId } = useParams();

  const [calibrations, setCalibrations] = useState([]);
  const [pump, setPump] = useState(null);
  const [flowmeters, setFlowmeters] = useState([]);
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [confirmCloseDialog, setConfirmCloseDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  // Track active tab for each date group in the table
  const [activeDateTabs, setActiveDateTabs] = useState({});
  // Out-of-service dialog state
  const [outOfServiceDialog, setOutOfServiceDialog] = useState(false);
  const [outOfServiceDate, setOutOfServiceDate] = useState(
    formatDateForInput(new Date())
  );

  // Static form data (shared across all calibrations)
  const [staticFormData, setStaticFormData] = useState({
    calibrationDate: formatDateForInput(new Date()),
    notes: "",
    flowmeterId: "",
    technicianId: "",
    technicianName: "",
  });

  // Array of calibration test results (one per flowrate)
  const [calibrationTests, setCalibrationTests] = useState([]);

  // Available flowrates
  const availableFlowrates = ["1", "1.5", "2", "3", "4"];

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Fetch lab signatories
  const fetchLabSignatories = useCallback(async () => {
    try {
      setLabSignatoriesLoading(true);
      const response = await userService.getAll();
      const users = response.data || response || [];
      const signatories = users.filter(
        (user) => user.role === "lab-signatory" || user.role === "admin"
      );
      setLabSignatories(signatories);
    } catch (err) {
      console.error("Error fetching lab signatories:", err);
      setLabSignatories([]);
    } finally {
      setLabSignatoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pumpId) {
      loadData();
      loadFlowmeters();
      fetchLabSignatories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pumpId, page, rowsPerPage, fetchLabSignatories]);

  const loadFlowmeters = async () => {
    try {
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
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load pump details from Equipment model
      const pumpData = await equipmentService.getById(pumpId);
      // Backend returns { equipment: {...} }, so extract the equipment object
      setPump(pumpData.equipment || pumpData.data || pumpData);

      // Load calibrations using Equipment ID
      const calibrationsData =
        await airPumpCalibrationService.getPumpCalibrations(
          pumpId,
          page + 1,
          rowsPerPage
        );
      const calibrationsList = calibrationsData.data || calibrationsData || [];
      setCalibrations(calibrationsList);
      setTotal(calibrationsData.pagination?.total || 0);

      // Load statistics (optional, not displayed but may be used in future)
      try {
        await airPumpCalibrationService.getPumpCalibrationStats(pumpId);
      } catch (statsErr) {
        console.warn("Could not load statistics:", statsErr);
        // Statistics are optional, so don't fail the whole page
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Check if there are unsaved changes
  const checkUnsavedChanges = useCallback(() => {
    const hasStaticData =
      staticFormData.calibrationDate !== formatDateForInput(new Date()) ||
      staticFormData.technicianId ||
      staticFormData.flowmeterId ||
      staticFormData.notes;

    const hasCalibrations =
      calibrationTests.length > 0 &&
      calibrationTests.some((cal) => cal.flowRate || cal.actualFlow);

    return hasStaticData || hasCalibrations;
  }, [staticFormData, calibrationTests]);

  // Handle dialog close with confirmation
  const handleDialogClose = (confirmed = false) => {
    if (!confirmed && checkUnsavedChanges()) {
      setConfirmCloseDialog(true);
      return;
    }
    setOpenDialog(false);
    setError(null);
    setHasUnsavedChanges(false);
    setConfirmCloseDialog(false);
    setEditingCalibration(null);
    // Reset form
    setStaticFormData({
      calibrationDate: formatDateForInput(new Date()),
      notes: "",
      flowmeterId: "",
      technicianId: "",
      technicianName: "",
    });
    setCalibrationTests([]);
    setActiveTab(0);
  };

  // Add a new calibration tab
  const handleAddCalibration = () => {
    const usedFlowrates = calibrationTests
      .map((cal) => cal.flowRate)
      .filter(Boolean);
    const nextFlowrate = availableFlowrates.find(
      (rate) => !usedFlowrates.includes(rate)
    );

    if (!nextFlowrate) {
      setError("All flowrates have been calibrated");
      return;
    }

    setCalibrationTests((prev) => [
      ...prev,
      {
        flowRate: nextFlowrate,
        actualFlow: "",
        errorPercent: "",
        status: "",
      },
    ]);
    setActiveTab(calibrationTests.length);
    setHasUnsavedChanges(true);
  };

  // Remove a calibration
  const handleRemoveCalibration = (index) => {
    setCalibrationTests((prev) => prev.filter((_, i) => i !== index));
    if (activeTab >= calibrationTests.length - 1) {
      setActiveTab(Math.max(0, calibrationTests.length - 2));
    }
    setHasUnsavedChanges(true);
  };

  // Update calibration data
  const handleCalibrationChange = (index, field, value) => {
    setCalibrationTests((prev) => {
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
  }, [staticFormData, calibrationTests, checkUnsavedChanges]);

  // Handle browser navigation and refresh
  useEffect(() => {
    if (!openDialog || !hasUnsavedChanges) return;

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
  }, [openDialog, hasUnsavedChanges]);

  const handleSubmit = async () => {
    try {
      setError(null);

      if (!staticFormData.calibrationDate) {
        setError("Calibration date is required");
        return;
      }

      if (calibrationTests.length === 0) {
        setError("Please add at least one calibration");
        return;
      }

      // Validate all calibrations
      for (let i = 0; i < calibrationTests.length; i++) {
        const cal = calibrationTests[i];
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
      const testResults = calibrationTests.map((cal) => {
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

      const calibrationData = {
        pumpId,
        calibrationDate: new Date(staticFormData.calibrationDate),
        testResults: testResults,
        overallResult: overallResult,
        notes: staticFormData.notes || "",
        flowmeterId: staticFormData.flowmeterId || null,
      };

      if (editingCalibration) {
        await airPumpCalibrationService.updateCalibration(
          editingCalibration._id,
          calibrationData
        );
      } else {
        await airPumpCalibrationService.createCalibration(calibrationData);
      }

      handleDialogClose(true);
      // Force a refresh to get the updated overallResult from backend
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    }
  };

  const handleEdit = async (calibration) => {
    setEditingCalibration(calibration);

    // Ensure flowmeters and lab signatories are loaded before opening dialog
    if (flowmeters.length === 0) {
      await loadFlowmeters();
    }
    if (labSignatories.length === 0) {
      await fetchLabSignatories();
    }

    // Extract flowmeterId - handle both string ID and populated object
    let flowmeterId = "";
    if (calibration.flowmeterId) {
      if (typeof calibration.flowmeterId === "object") {
        flowmeterId = String(
          calibration.flowmeterId._id || calibration.flowmeterId.id || ""
        );
      } else {
        flowmeterId = String(calibration.flowmeterId);
      }
    }

    // Extract technicianId from calibratedBy
    let technicianId = "";
    let technicianName = "";
    if (calibration.calibratedBy) {
      if (typeof calibration.calibratedBy === "object") {
        technicianId = String(calibration.calibratedBy._id || "");
        technicianName =
          calibration.calibratedBy.firstName &&
          calibration.calibratedBy.lastName
            ? `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
            : "";
      } else {
        technicianId = String(calibration.calibratedBy);
      }
    }

    // Convert testResults to calibrationTests format (mL/min to L/min)
    const calibrationTestsData = (calibration.testResults || []).map(
      (testResult) => {
        const flowRateLMin = (testResult.setFlowrate / 1000).toString();
        const actualFlowLMin = (testResult.actualFlowrate / 1000).toFixed(2);
        return {
          flowRate: flowRateLMin,
          actualFlow: actualFlowLMin,
          errorPercent: testResult.percentError
            ? testResult.percentError.toFixed(2)
            : "",
          status: testResult.passed ? "Pass" : "Fail",
        };
      }
    );

    setStaticFormData({
      calibrationDate: new Date(calibration.calibrationDate)
        .toISOString()
        .split("T")[0],
      notes: calibration.notes || "",
      flowmeterId: flowmeterId,
      technicianId: technicianId,
      technicianName: technicianName,
    });
    setCalibrationTests(calibrationTestsData);
    setActiveTab(0);
    setHasUnsavedChanges(false);
    setOpenDialog(true);
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

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setStaticFormData({
      calibrationDate: todayDate,
      notes: "",
      flowmeterId: "",
      technicianId: "",
      technicianName: "",
    });
    setCalibrationTests([]);
    setActiveTab(0);
    setHasUnsavedChanges(false);
    setOpenDialog(true);
  };

  const handleDelete = async () => {
    try {
      await airPumpCalibrationService.deleteCalibration(
        calibrationToDelete._id
      );
      setDeleteDialog(false);
      setCalibrationToDelete(null);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete calibration");
    }
  };

  const handleSetOutOfService = async () => {
    try {
      setError(null);

      if (!outOfServiceDate) {
        setError("Date is required");
        return;
      }

      if (!pump || !pump._id) {
        setError("Pump information not available");
        return;
      }

      // Update equipment status to out-of-service
      await equipmentService.update(pump._id, {
        status: "out-of-service",
      });

      // Create calibration record with out-of-service marker
      const calibrationData = {
        pumpId: pump._id,
        calibrationDate: new Date(outOfServiceDate),
        testResults: [], // Empty test results for out-of-service
        overallResult: "Fail",
        notes: `Equipment set as Out-of-Service on ${formatDate(
          new Date(outOfServiceDate)
        )}`,
        flowmeterId: null,
        nextCalibrationDue: null,
      };

      await airPumpCalibrationService.createCalibration(calibrationData);

      // Close dialog and refresh data
      setOutOfServiceDialog(false);
      setOutOfServiceDate(formatDateForInput(new Date()));
      loadData();
    } catch (err) {
      setError(err.message || "Failed to set pump as out-of-service");
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton
          onClick={() => navigate("/records/laboratory/calibrations/air-pump")}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Air Pump Calibrations
        </Typography>
      </Box>

      {/* Equipment Reference */}
      {pump && (
        <Box mb={2}>
          <Typography variant="h5" sx={{ fontWeight: "bold" }}>
            {pump.equipmentReference || "N/A"}
          </Typography>
        </Box>
      )}

      {/* Actions */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6">Calibration Records</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            color="error"
            backkgroundCO
            onClick={() => setOutOfServiceDialog(true)}
            disabled={pump?.status === "out-of-service"}
          >
            Set Out-of-Service
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Calibration
          </Button>
        </Box>
      </Box>

      {/* Calibrations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Date
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Calibrated By
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Flowmeter
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Flowrates
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Next Due
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Status
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(() => {
              // Group calibrations by date
              const groupedByDate = {};
              calibrations.forEach((calibration) => {
                const dateKey = calibration.calibrationDate
                  ? new Date(calibration.calibrationDate)
                      .toISOString()
                      .split("T")[0]
                  : "unknown";
                if (!groupedByDate[dateKey]) {
                  groupedByDate[dateKey] = [];
                }
                groupedByDate[dateKey].push(calibration);
              });

              // Convert to array and sort by date (most recent first)
              // Also sort calibrations within each date group by creation time (most recent first)
              const dateGroups = Object.entries(groupedByDate)
                .map(([dateKey, calList]) => {
                  // Sort calibrations within this date group by creation time (most recent first)
                  const sortedCals = [...calList].sort((a, b) => {
                    const dateA = a.createdAt
                      ? new Date(a.createdAt)
                      : new Date(0);
                    const dateB = b.createdAt
                      ? new Date(b.createdAt)
                      : new Date(0);
                    return dateB - dateA;
                  });
                  return {
                    dateKey,
                    date: sortedCals[0].calibrationDate,
                    calibrations: sortedCals, // Use sorted list so firstCal is the most recent
                  };
                })
                .sort((a, b) => new Date(b.date) - new Date(a.date));

              if (dateGroups.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No calibration records found
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              }

              return dateGroups.map((dateGroup) => {
                // Get common info from first calibration (they should all be the same for same date)
                const firstCal = dateGroup.calibrations[0];

                // Check if this is an out-of-service calibration
                const isOutOfService =
                  !firstCal.testResults ||
                  firstCal.testResults.length === 0 ||
                  pump?.status === "out-of-service";
                const flowmeter = firstCal.flowmeterId
                  ? flowmeters.find(
                      (fm) =>
                        fm._id === firstCal.flowmeterId ||
                        (typeof firstCal.flowmeterId === "object" &&
                          firstCal.flowmeterId._id === fm._id)
                    )
                  : null;

                // Extract all test results from all calibrations for this date
                const allTestResults = [];
                dateGroup.calibrations.forEach((cal) => {
                  if (cal.testResults && cal.testResults.length > 0) {
                    cal.testResults.forEach((testResult) => {
                      allTestResults.push({
                        ...testResult,
                        calibrationId: cal._id,
                        overallResult: cal.overallResult,
                      });
                    });
                  }
                });

                // Calculate overallResult from test results to ensure accuracy
                // This ensures consistency with what's shown in edit modal
                // Pass if at least one test passed (not all tests need to pass)
                let calculatedOverallResult = "Fail";
                if (firstCal.testResults && firstCal.testResults.length > 0) {
                  const atLeastOnePassed = firstCal.testResults.some(
                    (result) => result.passed === true
                  );
                  calculatedOverallResult = atLeastOnePassed ? "Pass" : "Fail";
                } else if (firstCal.overallResult) {
                  // If no test results but overallResult exists, use it (e.g., out-of-service)
                  calculatedOverallResult = firstCal.overallResult;
                }

                // Group test results by flowrate
                const flowrateGroups = {};
                allTestResults.forEach((testResult) => {
                  const flowrateLMin = (
                    testResult.setFlowrate / 1000
                  ).toString();
                  if (!flowrateGroups[flowrateLMin]) {
                    flowrateGroups[flowrateLMin] = [];
                  }
                  flowrateGroups[flowrateLMin].push(testResult);
                });

                const flowrateKeys = Object.keys(flowrateGroups).sort(
                  (a, b) => parseFloat(a) - parseFloat(b)
                );

                // Get active tab for this date group
                const dateKey = dateGroup.dateKey;
                const activeTabIndex = activeDateTabs[dateKey] || 0;

                return (
                  <TableRow key={dateKey} hover>
                    <TableCell>
                      {firstCal.calibrationDate
                        ? formatDate(firstCal.calibrationDate)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {firstCal.calibratedBy
                        ? `${firstCal.calibratedBy.firstName || ""} ${
                            firstCal.calibratedBy.lastName || ""
                          }`.trim() || "N/A"
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {flowmeter
                        ? flowmeter.equipmentReference
                        : firstCal.flowmeterId
                        ? typeof firstCal.flowmeterId === "object" &&
                          firstCal.flowmeterId.equipmentReference
                          ? firstCal.flowmeterId.equipmentReference
                          : "N/A"
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {flowrateKeys.length > 0 ? (
                        <Box>
                          <Tabs
                            value={activeTabIndex}
                            onChange={(e, newValue) => {
                              setActiveDateTabs((prev) => ({
                                ...prev,
                                [dateKey]: newValue,
                              }));
                            }}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{ minHeight: "auto" }}
                          >
                            {flowrateKeys.map((flowrate, index) => {
                              const tests = flowrateGroups[flowrate];
                              const allPassed = tests.every((t) => t.passed);
                              const status = allPassed ? "Pass" : "Fail";
                              return (
                                <Tab
                                  key={flowrate}
                                  label={
                                    <Box
                                      display="flex"
                                      alignItems="center"
                                      gap={0.5}
                                    >
                                      <span>{flowrate} L/min</span>
                                      <Chip
                                        label={status}
                                        size="small"
                                        sx={{
                                          backgroundColor:
                                            status === "Pass"
                                              ? theme.palette.success.main
                                              : theme.palette.error.main,
                                          color: "white",
                                          height: "18px",
                                          fontSize: "0.65rem",
                                          minWidth: "40px",
                                        }}
                                      />
                                    </Box>
                                  }
                                  sx={{
                                    minHeight: "auto",
                                    padding: "6px 12px",
                                  }}
                                />
                              );
                            })}
                          </Tabs>
                          {flowrateKeys.map((flowrate, index) => {
                            if (index !== activeTabIndex) return null;
                            const tests = flowrateGroups[flowrate];
                            return (
                              <Box key={flowrate} sx={{ mt: 1, p: 1 }}>
                                <Box sx={{ mt: 0.5 }}>
                                  {tests.map((test, testIndex) => (
                                    <Box
                                      key={testIndex}
                                      sx={{
                                        display: "flex",
                                        gap: 1,
                                        alignItems: "center",
                                        mb: 0.5,
                                      }}
                                    >
                                      <Typography variant="caption">
                                        Actual:{" "}
                                        {(test.actualFlowrate / 1000).toFixed(
                                          2
                                        )}{" "}
                                        L/min
                                      </Typography>
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Error:{" "}
                                        {test.percentError?.toFixed(2) ||
                                          "0.00"}
                                        %
                                      </Typography>
                                      <Chip
                                        label={test.passed ? "Pass" : "Fail"}
                                        size="small"
                                        sx={{
                                          backgroundColor: test.passed
                                            ? theme.palette.success.main
                                            : theme.palette.error.main,
                                          color: "white",
                                          height: "16px",
                                          fontSize: "0.6rem",
                                        }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No test results
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOutOfService
                        ? "N/A"
                        : firstCal.nextCalibrationDue
                        ? formatDate(firstCal.nextCalibrationDue)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {isOutOfService ? (
                        <Chip
                          label="Out-of-Service"
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.error.main,
                            color: "white",
                          }}
                        />
                      ) : (
                        <Chip
                          label={calculatedOverallResult || "N/A"}
                          size="small"
                          sx={{
                            backgroundColor:
                              calculatedOverallResult === "Pass"
                                ? theme.palette.success.main
                                : calculatedOverallResult === "Fail"
                                ? theme.palette.error.main
                                : theme.palette.grey[500],
                            color: "white",
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(firstCal)}
                        color="primary"
                        title="Edit Calibration"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setCalibrationToDelete(firstCal);
                          setDeleteDialog(true);
                        }}
                        color="error"
                        title="Delete Calibration"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
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
            <Typography variant="h6">
              {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
            </Typography>
            <IconButton onClick={() => handleDialogClose()}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
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
                  <TextField
                    fullWidth
                    label="Calibration Date"
                    type="date"
                    value={staticFormData.calibrationDate}
                    onChange={(e) => {
                      setStaticFormData({
                        ...staticFormData,
                        calibrationDate: e.target.value,
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
                      disabled={flowmeters.length === 0}
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
                          {loading
                            ? "Loading flowmeters..."
                            : "No calibrated flowmeters available"}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Flowrate Indicators */}
              {calibrationTests.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Calibrated Flowrates:
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {calibrationTests.map((cal, index) => {
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
                    disabled={
                      calibrationTests.length >= availableFlowrates.length
                    }
                    size="small"
                  >
                    Add Flowrate
                  </Button>
                </Box>

                {calibrationTests.length === 0 ? (
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
                      {calibrationTests.map((cal, index) => {
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

                    {calibrationTests.map((cal, index) => (
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
                              {calibrationTests.length > 1 && (
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
                                    const isUsed = calibrationTests.some(
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
                !staticFormData.calibrationDate ||
                !staticFormData.technicianId ||
                calibrationTests.length === 0 ||
                calibrationTests.some((cal) => !cal.flowRate || !cal.actualFlow)
              }
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : editingCalibration ? (
                "Update Calibration"
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this calibration record? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Out-of-Service Dialog */}
      <Dialog
        open={outOfServiceDialog}
        onClose={() => {
          setOutOfServiceDialog(false);
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
            <Typography variant="h6">Set Pump as Out-of-Service</Typography>
            <IconButton
              onClick={() => {
                setOutOfServiceDialog(false);
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
            <strong>{pump?.equipmentReference || "this pump"}</strong> as
            Out-of-Service?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This will:
            <ul>
              <li>Update the equipment status to "Out-of-Service"</li>
              <li>
                Create a calibration record showing the date and who set it as
                out-of-service
              </li>
            </ul>
          </Typography>
          <TextField
            fullWidth
            label="Out-of-Service Date"
            type="date"
            value={outOfServiceDate}
            onChange={(e) => setOutOfServiceDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOutOfServiceDialog(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSetOutOfService}
            variant="contained"
            color="error"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirPumpCalibrationPage;
