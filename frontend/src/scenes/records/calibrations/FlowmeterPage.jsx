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
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { flowmeterCalibrationService } from "../../../services/flowmeterCalibrationService";
import userService from "../../../services/userService";

const FlowmeterPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [flowmeters, setFlowmeters] = useState([]);
  const [flowmetersLoading, setFlowmetersLoading] = useState(false);
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedFlowmeterForHistory, setSelectedFlowmeterForHistory] =
    useState(null);
  const [flowmeterHistory, setFlowmeterHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    flowmeterId: "",
    flowmeterEquipmentId: "",
    date: formatDateForInput(new Date()),
    flowRate: "",
    bubbleflowVolume: "",
    status: "Pass",
    technicianId: "",
    technicianName: "",
    nextCalibration: "",
    notes: "",
    runtime1: "",
    runtime2: "",
    runtime3: "",
    averageRuntime: "",
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

  // Fetch Site flowmeter equipment
  const fetchFlowmeters = useCallback(async () => {
    try {
      setFlowmetersLoading(true);
      const response = await equipmentService.getAll();
      const allEquipment = response.equipment || [];

      const siteFlowmeters = allEquipment
        .filter((equipment) => equipment.equipmentType === "Site flowmeter")
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      setFlowmeters(siteFlowmeters);
    } catch (err) {
      console.error("Error fetching flowmeters:", err);
      setError(err.message || "Failed to fetch flowmeter equipment");
    } finally {
      setFlowmetersLoading(false);
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
    fetchFlowmeters();
    fetchLabSignatories();
  }, [fetchFlowmeters, fetchLabSignatories]);

  // Listen for equipment data updates
  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchFlowmeters();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchFlowmeters]);

  const calculateNextCalibration = (calibrationDate, calibrationFrequency) => {
    if (!calibrationDate || !calibrationFrequency) return "";

    const date = new Date(calibrationDate);
    const frequency = parseInt(calibrationFrequency);

    if (isNaN(frequency)) return "";

    date.setMonth(date.getMonth() + frequency);

    return formatDateForInput(date);
  };

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setFormData({
      flowmeterId: "",
      flowmeterEquipmentId: "",
      date: todayDate,
      flowRate: "",
      bubbleflowVolume: "",
      status: "Pass",
      technicianId: "",
      technicianName: "",
      nextCalibration: "",
      notes: "",
      runtime1: "",
      runtime2: "",
      runtime3: "",
      averageRuntime: "",
    });
    setAddDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (calibrationToDelete) {
      try {
        setLoading(true);
        await flowmeterCalibrationService.delete(calibrationToDelete._id);
        setDeleteDialogOpen(false);
        setCalibrationToDelete(null);
        fetchFlowmeters();
      } catch (err) {
        setError(err.message || "Failed to delete calibration");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCalibrationToDelete(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (
        !formData.flowmeterEquipmentId ||
        !formData.date ||
        !formData.flowRate ||
        !formData.bubbleflowVolume ||
        !formData.technicianId ||
        !formData.runtime1 ||
        !formData.runtime2 ||
        !formData.runtime3
      ) {
        setError("Please fill in all required fields");
        return;
      }

      const selectedFlowmeter = flowmeters.find(
        (f) => f._id === formData.flowmeterEquipmentId
      );

      if (!selectedFlowmeter || !selectedFlowmeter.calibrationFrequency) {
        setError(
          "Selected flowmeter does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
        );
        return;
      }

      if (!formData.nextCalibration) {
        setError(
          "Next calibration date could not be calculated. Please ensure the flowmeter has a valid calibration frequency."
        );
        return;
      }

      const backendData = {
        flowmeterId: formData.flowmeterId,
        date: new Date(formData.date),
        flowRate: formData.flowRate,
        bubbleflowVolume: formData.bubbleflowVolume || "",
        status: formData.status,
        technician: formData.technicianName,
        nextCalibration: new Date(formData.nextCalibration + "T00:00:00"),
        notes: formData.notes || "",
        runtime1: formData.runtime1 ? parseFloat(formData.runtime1) : null,
        runtime2: formData.runtime2 ? parseFloat(formData.runtime2) : null,
        runtime3: formData.runtime3 ? parseFloat(formData.runtime3) : null,
        averageRuntime: formData.averageRuntime
          ? parseFloat(formData.averageRuntime)
          : null,
      };

      if (editingCalibration) {
        await flowmeterCalibrationService.update(
          editingCalibration._id,
          backendData
        );
      } else {
        await flowmeterCalibrationService.create(backendData);
      }

      // Update equipment record with new calibration dates
      try {
        const equipmentUpdateData = {
          lastCalibration: new Date(formData.date),
          calibrationDue: new Date(formData.nextCalibration + "T00:00:00"),
        };

        await equipmentService.update(
          formData.flowmeterEquipmentId,
          equipmentUpdateData
        );
      } catch (equipmentError) {
        console.error(
          "Failed to update equipment calibration dates:",
          equipmentError
        );
      }

      setAddDialogOpen(false);
      setEditingCalibration(null);
      fetchFlowmeters();

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.flowmeterEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleFlowmeterChange = (flowmeterEquipmentId) => {
    const selectedFlowmeter = flowmeters.find(
      (f) => f._id === flowmeterEquipmentId
    );

    let nextCalibration = "";
    if (
      selectedFlowmeter &&
      selectedFlowmeter.calibrationFrequency &&
      formData.date
    ) {
      nextCalibration = calculateNextCalibration(
        formData.date,
        selectedFlowmeter.calibrationFrequency
      );
    }

    setFormData((prev) => ({
      ...prev,
      flowmeterEquipmentId: flowmeterEquipmentId,
      flowmeterId: selectedFlowmeter
        ? selectedFlowmeter.equipmentReference
        : "",
      nextCalibration: nextCalibration,
    }));

    setError(null);

    if (selectedFlowmeter && !selectedFlowmeter.calibrationFrequency) {
      setError(
        "Selected flowmeter does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
      );
    }
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

  const handleDateChange = (date) => {
    const selectedFlowmeter = flowmeters.find(
      (f) => f._id === formData.flowmeterEquipmentId
    );

    let nextCalibration = "";

    if (selectedFlowmeter && selectedFlowmeter.calibrationFrequency) {
      nextCalibration = calculateNextCalibration(
        date,
        selectedFlowmeter.calibrationFrequency
      );
    } else if (selectedFlowmeter) {
      setError(
        "Selected flowmeter does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
      );
    }

    setFormData((prev) => ({
      ...prev,
      date: date,
      nextCalibration: nextCalibration,
    }));
  };

  const handleFlowRateChange = (flowRate) => {
    setFormData((prev) => ({
      ...prev,
      flowRate: flowRate,
    }));
  };

  const handleRuntimeChange = (field, value) => {
    const runtimeValue = value === "" ? "" : parseFloat(value);
    const updatedData = {
      ...formData,
      [field]: value,
    };

    // Calculate average if all three runtimes are provided
    if (field === "runtime1" || field === "runtime2" || field === "runtime3") {
      const runtime1 =
        field === "runtime1"
          ? runtimeValue
          : parseFloat(formData.runtime1) || 0;
      const runtime2 =
        field === "runtime2"
          ? runtimeValue
          : parseFloat(formData.runtime2) || 0;
      const runtime3 =
        field === "runtime3"
          ? runtimeValue
          : parseFloat(formData.runtime3) || 0;

      if (runtime1 && runtime2 && runtime3) {
        const average = ((runtime1 + runtime2 + runtime3) / 3).toFixed(2);
        updatedData.averageRuntime = average;
      } else {
        updatedData.averageRuntime = "";
      }
    }

    setFormData(updatedData);
  };

  // Calculate expected times based on flow rate
  const calculateExpectedTimes = (flowRate) => {
    if (!flowRate || flowRate === "") {
      return null;
    }

    const flowRateNum = parseFloat(flowRate);
    if (isNaN(flowRateNum) || flowRateNum <= 0) {
      return null;
    }

    // Convert L/min to mL/sec: flowRate (L/min) * 1000 (mL/L) / 60 (sec/min) = flowRate * 1000 / 60 mL/sec
    // But the formula given is: (500/({flowrate} x 1000)) * 60
    // Let me recalculate: flowRate is in L/min, so flowRate * 1000 = mL/min
    // 500 mL / (flowRate * 1000 mL/min) = 500 / (flowRate * 1000) minutes
    // Convert to seconds: (500 / (flowRate * 1000)) * 60 seconds

    const time500mL = Math.round((500 / (flowRateNum * 1000)) * 60);
    const time1000mL = Math.round((1000 / (flowRateNum * 1000)) * 60);

    return {
      time500mL,
      time1000mL,
    };
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/list");
  };

  const handleViewHistory = async (flowmeter) => {
    setSelectedFlowmeterForHistory(flowmeter);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setFlowmeterHistory([]);

    try {
      const response = await flowmeterCalibrationService.getByFlowmeter(
        flowmeter.equipmentReference
      );
      const history = response.data || response || [];
      // Sort by date descending (most recent first)
      const sortedHistory = history.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      setFlowmeterHistory(sortedHistory);
    } catch (err) {
      console.error("Error fetching flowmeter history:", err);
      setFlowmeterHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Flowmeter Calibrations
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
          <Typography color="text.primary">Flowmeter Calibrations</Typography>
        </Breadcrumbs>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Site Flowmeter Equipment Table */}
      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          Site Flowmeter Equipment
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Equipment Reference</TableCell>
                <TableCell>Brand/Model</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flowmetersLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : flowmeters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No flowmeter equipment found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                flowmeters.map((flowmeter) => {
                  const status = calculateStatus(flowmeter);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={flowmeter._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {flowmeter.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>{flowmeter.brandModel || "-"}</TableCell>
                      <TableCell>{flowmeter.section || "-"}</TableCell>
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
                        {flowmeter.lastCalibration
                          ? formatDate(flowmeter.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {flowmeter.calibrationDue
                          ? (() => {
                              const daysUntil = calculateDaysUntilCalibration(
                                flowmeter.calibrationDue
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
                                    {formatDate(flowmeter.calibrationDue)}
                                  </Typography>
                                </Box>
                              );
                            })()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewHistory(flowmeter)}
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

      {/* Add/Edit Calibration Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          setEditingCalibration(null);
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
            <Typography variant="h6">
              {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
            </Typography>
            <IconButton
              onClick={() => {
                setAddDialogOpen(false);
                setEditingCalibration(null);
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
                  <InputLabel>Flowmeter</InputLabel>
                  <Select
                    value={formData.flowmeterEquipmentId}
                    onChange={(e) => handleFlowmeterChange(e.target.value)}
                    label="Flowmeter"
                    disabled={flowmetersLoading}
                  >
                    <MenuItem value="">
                      <em>Select a flowmeter</em>
                    </MenuItem>
                    {flowmeters.length > 0 ? (
                      flowmeters.map((flowmeter) => (
                        <MenuItem key={flowmeter._id} value={flowmeter._id}>
                          {flowmeter.equipmentReference}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        {flowmetersLoading
                          ? "Loading..."
                          : "No flowmeters found"}
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Calibration Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleDateChange(e.target.value)}
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
                <FormControl fullWidth required>
                  <InputLabel>Bubbleflow Volume</InputLabel>
                  <Select
                    value={formData.bubbleflowVolume}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bubbleflowVolume: e.target.value,
                      })
                    }
                    label="Bubbleflow Volume"
                  >
                    <MenuItem value="">
                      <em>Select volume</em>
                    </MenuItem>
                    <MenuItem value="500">500mL</MenuItem>
                    <MenuItem value="1000">1000mL</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {formData.flowRate && formData.bubbleflowVolume && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.grey[100],
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Expected time (secs):
                  </Typography>
                  {(() => {
                    const expectedTimes = calculateExpectedTimes(
                      formData.flowRate
                    );
                    if (expectedTimes) {
                      const selectedVolume = formData.bubbleflowVolume;
                      const expectedTime =
                        selectedVolume === "500"
                          ? expectedTimes.time500mL
                          : expectedTimes.time1000mL;
                      return (
                        <Typography variant="body2">
                          {selectedVolume}mL: {expectedTime} secs
                        </Typography>
                      );
                    }
                    return null;
                  })()}
                </Box>
              )}
              <Box display="flex" gap={2}>
                <TextField
                  fullWidth
                  label="Runtime 1 (secs)"
                  type="number"
                  value={formData.runtime1}
                  onChange={(e) =>
                    handleRuntimeChange("runtime1", e.target.value)
                  }
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
                <TextField
                  fullWidth
                  label="Runtime 2 (secs)"
                  type="number"
                  value={formData.runtime2}
                  onChange={(e) =>
                    handleRuntimeChange("runtime2", e.target.value)
                  }
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
                <TextField
                  fullWidth
                  label="Runtime 3 (secs)"
                  type="number"
                  value={formData.runtime3}
                  onChange={(e) =>
                    handleRuntimeChange("runtime3", e.target.value)
                  }
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
                <TextField
                  fullWidth
                  label="Average Runtime (secs)"
                  value={formData.averageRuntime}
                  InputLabelProps={{ shrink: true }}
                  disabled
                  helperText="Auto-calculated"
                />
              </Box>
              {(() => {
                // Calculate equivalent flowrate: (expected time / average runtime) * flowrate
                let equivalentFlowrate = "";
                if (
                  formData.flowRate &&
                  formData.bubbleflowVolume &&
                  formData.averageRuntime
                ) {
                  const expectedTimes = calculateExpectedTimes(
                    formData.flowRate
                  );
                  if (expectedTimes) {
                    const selectedVolume = formData.bubbleflowVolume;
                    const expectedTime =
                      selectedVolume === "500"
                        ? expectedTimes.time500mL
                        : expectedTimes.time1000mL;
                    const avgRuntime = parseFloat(formData.averageRuntime);
                    const flowRate = parseFloat(formData.flowRate);

                    if (
                      expectedTime &&
                      avgRuntime &&
                      avgRuntime > 0 &&
                      flowRate
                    ) {
                      equivalentFlowrate = (
                        (expectedTime / avgRuntime) *
                        flowRate *
                        1000
                      ).toFixed(2);
                    }
                  }
                }

                // Calculate difference: |((equivalent flowrate (mL/min) - flowrate (mL/min)) / flowrate (mL/min)) * 100|
                let difference = "";
                let calculatedStatus = "";
                if (equivalentFlowrate && formData.flowRate) {
                  const equivFlow = parseFloat(equivalentFlowrate); // in mL/min
                  const flowRate = parseFloat(formData.flowRate); // in L/min
                  const flowRateMlMin = flowRate * 1000; // convert to mL/min
                  if (flowRateMlMin !== 0) {
                    const diffValue = Math.abs(
                      ((equivFlow - flowRateMlMin) / flowRateMlMin) * 100
                    );
                    difference = diffValue.toFixed(2);

                    // Auto-set status: Pass if difference < 5%, otherwise Fail
                    calculatedStatus = diffValue < 5 ? "Pass" : "Fail";

                    // Update status in formData
                    if (calculatedStatus !== formData.status) {
                      setFormData((prev) => ({
                        ...prev,
                        status: calculatedStatus,
                      }));
                    }
                  }
                }

                return (
                  <>
                    <TextField
                      fullWidth
                      label="Equivalent Flowrate (mL/min)"
                      value={equivalentFlowrate}
                      InputLabelProps={{ shrink: true }}
                      disabled
                    />
                    <TextField
                      fullWidth
                      label="Difference (%)"
                      value={difference ? `${difference}%` : ""}
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
                      {difference ? (
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
              {/* <TextField
                fullWidth
                label="Next Calibration Date"
                type="date"
                value={formData.nextCalibration}
                InputLabelProps={{ shrink: true }}
                disabled
                helperText="Automatically calculated based on calibration frequency"
              /> */}
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
                setEditingCalibration(null);
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
                !formData.flowmeterEquipmentId ||
                !formData.date ||
                !formData.flowRate ||
                !formData.bubbleflowVolume ||
                !formData.technicianId ||
                !formData.runtime1 ||
                !formData.runtime2 ||
                !formData.runtime3
              }
            >
              {loading ? <CircularProgress size={24} /> : "Save"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Flowmeter Calibration
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the calibration record for flowmeter{" "}
            {calibrationToDelete?.flowmeterId}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Calibration History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedFlowmeterForHistory(null);
          setFlowmeterHistory([]);
        }}
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
              Calibration History -{" "}
              {selectedFlowmeterForHistory?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedFlowmeterForHistory(null);
                setFlowmeterHistory([]);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : flowmeterHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No calibration history found for this flowmeter.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Calibration Date</TableCell>
                    <TableCell>Flowrate (L/min)</TableCell>
                    <TableCell>Bubbleflow Volume</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Technician</TableCell>
                    <TableCell>Runtime 1 (secs)</TableCell>
                    <TableCell>Runtime 2 (secs)</TableCell>
                    <TableCell>Runtime 3 (secs)</TableCell>
                    <TableCell>Average Runtime (secs)</TableCell>
                    <TableCell>Equivalent Flowrate (mL/min)</TableCell>
                    <TableCell>Difference (%)</TableCell>
                    <TableCell>Next Calibration</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {flowmeterHistory.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      <TableCell>{calibration.flowRate || "-"}</TableCell>
                      <TableCell>
                        {calibration.bubbleflowVolume
                          ? `${calibration.bubbleflowVolume}mL`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            backgroundColor:
                              calibration.status === "Pass"
                                ? theme.palette.success.main
                                : calibration.status === "Fail"
                                ? theme.palette.error.main
                                : theme.palette.grey[500],
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                          {calibration.status}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {calibration.technicianName ||
                          calibration.technician ||
                          "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.runtime1
                          ? calibration.runtime1.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.runtime2
                          ? calibration.runtime2.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.runtime3
                          ? calibration.runtime3.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.averageRuntime
                          ? calibration.averageRuntime.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.equivalentFlowrate
                          ? calibration.equivalentFlowrate.toFixed(2)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.difference
                          ? `${calibration.difference.toFixed(2)}%`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.nextCalibration
                          ? formatDate(calibration.nextCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>{calibration.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setHistoryDialogOpen(false);
              setSelectedFlowmeterForHistory(null);
              setFlowmeterHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FlowmeterPage;
