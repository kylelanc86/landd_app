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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
import { equipmentService } from "../../../services/equipmentService";
import userService from "../../../services/userService";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { useAuth } from "../../../context/AuthContext";

const AirPumpPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [pumps, setPumps] = useState([]);
  const [pumpsLoading, setPumpsLoading] = useState(false);
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOutOfService, setShowOutOfService] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    pumpId: "",
    pumpEquipmentId: "",
    date: formatDateForInput(new Date()),
    technicianId: "",
    technicianName: "",
    flowRate: "",
    actualFlow: "",
    errorPercent: "",
    status: "Pass",
    notes: "",
  });

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

            // Calculate flowrateCalibrations (group by flowrate, get most recent for each)
            // Convert setFlowrate from mL/min to L/min and get the most recent status
            const flowrateCalibrations = {};
            calibrations.forEach((cal) => {
              if (cal.testResults && cal.testResults.length > 0) {
                // Get the setFlowrate from the first test result (all testResults in a calibration have the same setFlowrate)
                const setFlowrateMlMin = cal.testResults[0].setFlowrate;
                const flowrateLMin = (setFlowrateMlMin / 1000).toString();

                // Use overallResult as the status for this flowrate
                if (
                  !flowrateCalibrations[flowrateLMin] ||
                  new Date(cal.calibrationDate) >
                    new Date(
                      flowrateCalibrations[flowrateLMin].lastCalibrationDate
                    )
                ) {
                  flowrateCalibrations[flowrateLMin] = {
                    status: cal.overallResult || "Fail",
                    lastCalibrationDate: cal.calibrationDate,
                  };
                }
              }
            });

            return {
              ...pump,
              lastCalibration,
              calibrationDue,
              flowrateCalibrations,
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
              flowrateCalibrations: {},
            };
          }
        })
      );

      setPumps(pumpsWithCalibrations);
      setError(null);
    } catch (err) {
      console.error("Error fetching air pumps:", err);
      setError(err.message || "Failed to fetch air pumps");
    } finally {
      setPumpsLoading(false);
    }
  }, []);

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
    fetchPumps();
    fetchLabSignatories();
  }, [fetchPumps, fetchLabSignatories]);

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

  const handleAdd = () => {
    const todayDate = formatDateForInput(new Date());
    setFormData({
      pumpId: "",
      pumpEquipmentId: "",
      date: todayDate,
      technicianId: "",
      technicianName: "",
      flowRate: "",
      actualFlow: "",
      errorPercent: "",
      status: "Pass",
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handlePumpChange = (pumpEquipmentId) => {
    const selectedPump = pumps.find((p) => p._id === pumpEquipmentId);

    setFormData((prev) => ({
      ...prev,
      pumpEquipmentId: pumpEquipmentId,
      pumpId: selectedPump ? selectedPump.equipmentReference : "",
    }));

    setError(null);
  };

  const handleTechnicianChange = (technicianId) => {
    const selectedTechnician = labSignatories.find(
      (t) => t._id === technicianId
    );
    setFormData((prev) => ({
      ...prev,
      technicianId: technicianId,
      technicianName: selectedTechnician
        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
        : "",
    }));
  };

  const handleFlowRateChange = (flowRate) => {
    setFormData((prev) => {
      const newData = { ...prev, flowRate };
      // Recalculate error if actualFlow exists
      if (newData.actualFlow && flowRate) {
        const actualFlowNum = parseFloat(newData.actualFlow);
        const flowRateNum = parseFloat(flowRate);
        if (!isNaN(actualFlowNum) && !isNaN(flowRateNum) && flowRateNum !== 0) {
          const errorValue = Math.abs(
            ((actualFlowNum - flowRateNum) / flowRateNum) * 100
          );
          newData.errorPercent = errorValue.toFixed(2);
          newData.status = errorValue < 5 ? "Pass" : "Fail";
        } else {
          newData.errorPercent = "";
        }
      }
      return newData;
    });
  };

  const handleActualFlowChange = (actualFlow) => {
    setFormData((prev) => {
      const newData = { ...prev, actualFlow };
      // Calculate error percentage
      if (newData.flowRate && actualFlow) {
        const actualFlowNum = parseFloat(actualFlow);
        const flowRateNum = parseFloat(newData.flowRate);
        if (!isNaN(actualFlowNum) && !isNaN(flowRateNum) && flowRateNum !== 0) {
          const errorValue = Math.abs(
            ((actualFlowNum - flowRateNum) / flowRateNum) * 100
          );
          newData.errorPercent = errorValue.toFixed(2);
          newData.status = errorValue < 5 ? "Pass" : "Fail";
        } else {
          newData.errorPercent = "";
        }
      } else {
        newData.errorPercent = "";
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      if (
        !formData.pumpEquipmentId ||
        !formData.date ||
        !formData.technicianId ||
        !formData.flowRate ||
        !formData.actualFlow
      ) {
        setError("Please fill in all required fields");
        return;
      }

      // Convert flowrate from L/min to mL/min (multiply by 1000)
      const setFlowrateMlMin = Math.round(parseFloat(formData.flowRate) * 1000);
      const actualFlowrateMlMin = parseFloat(formData.actualFlow) * 1000;

      // Validate setFlowrate is in the allowed enum values
      const allowedFlowrates = [1000, 1500, 2000, 3000, 4000];
      if (!allowedFlowrates.includes(setFlowrateMlMin)) {
        setError(`Invalid flowrate. Must be one of: 1, 1.5, 2, 3, or 4 L/min`);
        return;
      }

      // Calculate percent error
      const percentError = Math.abs(
        ((actualFlowrateMlMin - setFlowrateMlMin) / setFlowrateMlMin) * 100
      );

      // Determine if test passed
      const passed = percentError < 5;

      const backendData = {
        pumpId: formData.pumpEquipmentId, // Use equipment ID
        calibrationDate: new Date(formData.date),
        testResults: [
          {
            setFlowrate: setFlowrateMlMin,
            actualFlowrate: actualFlowrateMlMin,
            percentError: percentError,
            passed: passed,
          },
        ],
        overallResult: formData.status,
        notes: formData.notes || "",
      };

      console.log("Sending calibration data:", backendData);

      await airPumpCalibrationService.createCalibration(backendData);

      setAddDialogOpen(false);
      fetchPumps();

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.pumpEquipmentId },
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

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/list");
  };

  // Filter pumps based on showOutOfService toggle
  const filteredPumps = showOutOfService
    ? pumps
    : pumps.filter((pump) => pump.status !== "out-of-service");

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
                <TableCell>Section</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
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
                      <TableCell>{pump.section || "-"}</TableCell>
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
                        {pump.calibrationDue
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
                        {(() => {
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
                                No calibrations
                              </Typography>
                            );
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewHistory(pump)}
                          size="small"
                          title="View Calibration History"
                          sx={{ color: theme.palette.info.main }}
                        >
                          <HistoryIcon />
                        </IconButton>
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
        onClose={() => {
          setAddDialogOpen(false);
          setError(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Calibration</Typography>
            <IconButton
              onClick={() => {
                setAddDialogOpen(false);
                setError(null);
              }}
            >
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
              <Box display="flex" gap={2}>
                <FormControl fullWidth required>
                  <InputLabel>Pump</InputLabel>
                  <Select
                    value={formData.pumpEquipmentId}
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
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel>Technician</InputLabel>
                  <Select
                    value={formData.technicianId}
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
              </Box>
              <Box display="flex" gap={2}>
                <FormControl fullWidth required>
                  <InputLabel>Flowrate (L/min)</InputLabel>
                  <Select
                    value={formData.flowRate}
                    onChange={(e) => handleFlowRateChange(e.target.value)}
                    label="Flowrate (L/min)"
                  >
                    <MenuItem value="">
                      <em>Select flowrate</em>
                    </MenuItem>
                    <MenuItem value="1">1 L/min</MenuItem>
                    <MenuItem value="1.5">1.5 L/min</MenuItem>
                    <MenuItem value="2">2 L/min</MenuItem>
                    <MenuItem value="3">3 L/min</MenuItem>
                    <MenuItem value="4">4 L/min</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Actual Flow (L/min)"
                  type="number"
                  value={formData.actualFlow}
                  onChange={(e) => handleActualFlowChange(e.target.value)}
                  inputProps={{ step: "0.01", min: "0" }}
                  sx={{
                    "& input[type=number]": {
                      "-moz-appearance": "textfield",
                    },
                    "& input[type=number]::-webkit-outer-spin-button": {
                      "-webkit-appearance": "none",
                      margin: 0,
                    },
                    "& input[type=number]::-webkit-inner-spin-button": {
                      "-webkit-appearance": "none",
                      margin: 0,
                    },
                  }}
                  required
                />
              </Box>
              {(() => {
                // Calculate error percentage and status
                let errorPercent = "";
                let calculatedStatus = "";

                if (formData.flowRate && formData.actualFlow) {
                  const flowRateNum = parseFloat(formData.flowRate);
                  const actualFlowNum = parseFloat(formData.actualFlow);

                  if (
                    !isNaN(flowRateNum) &&
                    !isNaN(actualFlowNum) &&
                    flowRateNum !== 0
                  ) {
                    const errorValue = Math.abs(
                      ((actualFlowNum - flowRateNum) / flowRateNum) * 100
                    );
                    errorPercent = errorValue.toFixed(2);
                    calculatedStatus = errorValue < 5 ? "Pass" : "Fail";

                    // Update status in formData if it changed
                    if (calculatedStatus !== formData.status) {
                      setFormData((prev) => ({
                        ...prev,
                        status: calculatedStatus,
                        errorPercent: errorPercent,
                      }));
                    } else if (formData.errorPercent !== errorPercent) {
                      // Update errorPercent if status hasn't changed
                      setFormData((prev) => ({
                        ...prev,
                        errorPercent: errorPercent,
                      }));
                    }
                  }
                }

                return (
                  <>
                    <TextField
                      fullWidth
                      label="Error (%)"
                      value={
                        errorPercent
                          ? `${errorPercent}%`
                          : formData.errorPercent
                          ? `${formData.errorPercent}%`
                          : ""
                      }
                      InputLabelProps={{ shrink: true }}
                      disabled
                    />
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1, fontSize: "16px", fontWeight: "600" }}
                      >
                        Status:
                      </Typography>
                      {errorPercent || formData.errorPercent ? (
                        <Typography
                          variant="h5"
                          sx={{
                            color:
                              (calculatedStatus || formData.status) === "Pass"
                                ? theme.palette.success.main
                                : theme.palette.error.main,
                            fontWeight: "bold",
                          }}
                        >
                          {calculatedStatus || formData.status}
                        </Typography>
                      ) : (
                        <Typography variant="h5" color="text.secondary">
                          N/A
                        </Typography>
                      )}
                    </Box>
                  </>
                );
              })()}
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setAddDialogOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                loading ||
                !formData.pumpEquipmentId ||
                !formData.date ||
                !formData.technicianId ||
                !formData.flowRate ||
                !formData.actualFlow
              }
            >
              {loading ? <CircularProgress size={24} /> : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default AirPumpPage;
