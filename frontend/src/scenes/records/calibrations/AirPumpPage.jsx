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
import airPumpService from "../../../services/airPumpService";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
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
    (pump) => {
      if (!pump) {
        return "Out-of-Service";
      }

      if (pump.status === "Out of Service" || pump.status === "Inactive") {
        return "Out-of-Service";
      }

      if (!pump.calibrationDate || !pump.calibrationDue) {
        return "Out-of-Service";
      }

      const daysUntil = calculateDaysUntilCalibration(pump.calibrationDue);
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
      const response = await airPumpService.getAll({ limit: 100 });
      setPumps(response.data || []);
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
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handlePumpChange = (pumpEquipmentId) => {
    const selectedPump = pumps.find((p) => p._id === pumpEquipmentId);

    setFormData((prev) => ({
      ...prev,
      pumpEquipmentId: pumpEquipmentId,
      pumpId: selectedPump ? selectedPump._id : "",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      if (!formData.pumpEquipmentId || !formData.date || !formData.technicianId) {
        setError("Please fill in all required fields");
        return;
      }

      // TODO: Add air pump calibration specific fields here
      // This is a template - will be customized for air pump calibrations
      const backendData = {
        pumpId: formData.pumpId,
        calibrationDate: formData.date,
        calibratedBy: currentUser._id,
        notes: formData.notes || "",
        // testResults: [], // Will be added in customization
      };

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
    : pumps.filter(
        (pump) => pump.status !== "Out of Service" && pump.status !== "Inactive"
      );

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

      <Box
        display="flex"
        alignItems="center"
        gap={2}
        mb={2}
      >
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
          ({pumps.filter((p) => p.status === "Active").length} active,{" "}
          {
            pumps.filter(
              (p) => p.status === "Out of Service" || p.status === "Inactive"
            ).length
          }{" "}
          out of service)
        </Typography>
        {pumps.some((p) => p.status === "Inactive") && (
          <Button
            variant="outlined"
            size="small"
            onClick={async () => {
              if (
                window.confirm(
                  'Update all "Inactive" statuses to "Out of Service"? This action cannot be undone.'
                )
              ) {
                try {
                  const result = await airPumpService.updateInactiveStatus();
                  alert(
                    `Updated ${result.modifiedCount} pumps from "Inactive" to "Out of Service"`
                  );
                  fetchPumps(); // Refresh the data
                } catch (err) {
                  setError("Error updating statuses: " + err.message);
                }
              }
            }}
          >
            Update Inactive → Out of Service
          </Button>
        )}
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
                <TableCell>Equipment Reference</TableCell>
                <TableCell>Brand/Model</TableCell>
                <TableCell>Section</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
                <TableCell>Max Flowrate</TableCell>
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
                          {pump.pumpReference}
                        </Typography>
                      </TableCell>
                      <TableCell>{pump.pumpDetails || "-"}</TableCell>
                      <TableCell>-</TableCell>
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
                        {pump.calibrationDate
                          ? formatDate(pump.calibrationDate)
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
                      <TableCell>{pump.maxFlowrate || "-"}</TableCell>
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
                          {pump.pumpReference} - {pump.pumpDetails}
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
                !formData.technicianId
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
