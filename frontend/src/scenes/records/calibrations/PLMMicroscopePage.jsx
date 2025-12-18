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
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import plmMicroscopeService from "../../../services/plmMicroscopeService";
import { useAuth } from "../../../context/AuthContext";

const PLMMicroscopePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [microscopes, setMicroscopes] = useState([]);
  const [microscopesLoading, setMicroscopesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedMicroscopeForHistory, setSelectedMicroscopeForHistory] =
    useState(null);
  const [microscopeHistory, setMicroscopeHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    microscopeReference: "",
    microscopeEquipmentId: "",
    date: formatDateForInput(new Date()),
    servicingCompany: "",
    serviceReport: null,
    serviceReportUrl: null,
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

  // Fetch Polarised Light Microscope equipment with calibration data
  const fetchMicroscopes = useCallback(async () => {
    try {
      setMicroscopesLoading(true);
      const response = await equipmentService.getAll();
      const allEquipment = response.equipment || [];

      const plmMicroscopes = allEquipment
        .filter(
          (equipment) =>
            equipment.equipmentType === "Polarised Light Microscope"
        )
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      // Fetch calibration data for each microscope
      const microscopesWithCalibrations = await Promise.all(
        plmMicroscopes.map(async (microscope) => {
          try {
            // Fetch all calibrations for this microscope
            const calibrationResponse =
              await plmMicroscopeService.getByEquipment(
                microscope.equipmentReference
              );
            const calibrations =
              calibrationResponse.data || calibrationResponse || [];

            // Calculate lastCalibration (most recent calibration date)
            const lastCalibration =
              calibrations.length > 0
                ? new Date(
                    Math.max(
                      ...calibrations
                        .map((cal) => new Date(cal.date).getTime())
                        .filter((time) => !isNaN(time))
                    )
                  )
                : null;

            // Calculate calibrationDue (most recent nextCalibration date)
            const calibrationDue =
              calibrations.length > 0
                ? new Date(
                    Math.max(
                      ...calibrations
                        .filter((cal) => cal.nextCalibration)
                        .map((cal) => new Date(cal.nextCalibration).getTime())
                        .filter((time) => !isNaN(time))
                    )
                  )
                : null;

            return {
              ...microscope,
              lastCalibration,
              calibrationDue,
            };
          } catch (err) {
            console.error(
              `Error fetching calibrations for ${microscope.equipmentReference}:`,
              err
            );
            // Return microscope without calibration data if fetch fails
            return {
              ...microscope,
              lastCalibration: null,
              calibrationDue: null,
            };
          }
        })
      );

      setMicroscopes(microscopesWithCalibrations);
      setError(null);
    } catch (err) {
      console.error("Error fetching microscopes:", err);
      setError(err.message || "Failed to fetch microscope equipment");
    } finally {
      setMicroscopesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMicroscopes();
  }, [fetchMicroscopes]);

  // Listen for equipment data updates
  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchMicroscopes();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchMicroscopes]);

  // Calculate next calibration date based on calibration frequency
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
      microscopeReference: "",
      microscopeEquipmentId: "",
      date: todayDate,
      servicingCompany: "",
      serviceReport: null,
      serviceReportUrl: null,
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handleEdit = (calibration) => {
    setEditingCalibration(calibration);
    const microscopeEquipment = microscopes.find(
      (m) => m.equipmentReference === calibration.microscopeReference
    );

    setFormData({
      microscopeReference: calibration.microscopeReference,
      microscopeEquipmentId: microscopeEquipment?._id || "",
      date: formatDateForInput(new Date(calibration.date)),
      servicingCompany: calibration.servicingCompany,
      serviceReport: null,
      serviceReportUrl: calibration.serviceReportUrl || null,
      notes: calibration.notes || "",
    });
    setAddDialogOpen(true);
    setError(null);
  };

  const handleEditFromHistory = (calibration) => {
    // Find the microscope equipment for this calibration
    const microscopeEquipment = microscopes.find(
      (m) => m.equipmentReference === calibration.microscopeReference
    );

    if (!microscopeEquipment) {
      setError("Microscope equipment not found");
      return;
    }

    // Set form data for editing
    setFormData({
      microscopeReference: calibration.microscopeReference,
      microscopeEquipmentId: microscopeEquipment._id,
      date: formatDateForInput(new Date(calibration.date)),
      servicingCompany: calibration.servicingCompany || "",
      serviceReport: null,
      serviceReportUrl: calibration.serviceReportUrl || null,
      notes: calibration.notes || "",
    });

    setEditingCalibration(calibration);
    setHistoryDialogOpen(false);
    setAddDialogOpen(true);
    setError(null);
  };

  const handleDelete = (calibration) => {
    setCalibrationToDelete(calibration);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (calibrationToDelete) {
      try {
        setLoading(true);
        await plmMicroscopeService.delete(calibrationToDelete._id);
        setDeleteDialogOpen(false);
        const deletedMicroscopeReference =
          calibrationToDelete.microscopeReference;
        setCalibrationToDelete(null);
        fetchMicroscopes();

        // If history dialog is open for the deleted calibration's microscope, refresh the history
        if (
          historyDialogOpen &&
          selectedMicroscopeForHistory &&
          selectedMicroscopeForHistory.equipmentReference ===
            deletedMicroscopeReference
        ) {
          const response = await plmMicroscopeService.getByEquipment(
            deletedMicroscopeReference
          );
          const history = response.data || response || [];
          const sortedHistory = history.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
          });
          setMicroscopeHistory(sortedHistory);
        }
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

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      if (
        !formData.microscopeEquipmentId ||
        !formData.date ||
        !formData.servicingCompany
      ) {
        setError("Please fill in all required fields");
        return;
      }

      const selectedMicroscope = microscopes.find(
        (m) => m._id === formData.microscopeEquipmentId
      );

      if (!selectedMicroscope || !selectedMicroscope.calibrationFrequency) {
        setError(
          "Selected microscope does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
        );
        return;
      }

      const backendData = {
        microscopeReference: formData.microscopeReference,
        date: formData.date,
        servicingCompany: formData.servicingCompany,
        serviceReportUrl: formData.serviceReportUrl || null,
        notes: formData.notes || "",
        calibratedBy: currentUser._id,
      };

      const updatedMicroscopeReference = formData.microscopeReference;

      if (editingCalibration) {
        await plmMicroscopeService.update(editingCalibration._id, backendData);
      } else {
        await plmMicroscopeService.create(backendData);
      }

      // Update equipment record with new calibration dates if needed
      // Note: PCM microscopes may not have calibration frequency, so this might not be applicable
      // But we'll keep the structure for consistency

      setAddDialogOpen(false);
      setEditingCalibration(null);
      fetchMicroscopes();

      // If history dialog is open for the updated/created calibration's microscope, refresh the history
      if (
        historyDialogOpen &&
        selectedMicroscopeForHistory &&
        selectedMicroscopeForHistory.equipmentReference ===
          updatedMicroscopeReference
      ) {
        try {
          const response = await plmMicroscopeService.getByEquipment(
            updatedMicroscopeReference
          );
          const history = response.data || response || [];
          const sortedHistory = history.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA;
          });
          setMicroscopeHistory(sortedHistory);
        } catch (err) {
          console.error("Error refreshing history after save:", err);
        }
      }

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.microscopeEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleMicroscopeChange = (microscopeEquipmentId) => {
    const selectedMicroscope = microscopes.find(
      (m) => m._id === microscopeEquipmentId
    );

    setFormData((prev) => ({
      ...prev,
      microscopeEquipmentId: microscopeEquipmentId,
      microscopeReference: selectedMicroscope
        ? selectedMicroscope.equipmentReference
        : "",
    }));

    setError(null);

    if (selectedMicroscope && !selectedMicroscope.calibrationFrequency) {
      setError(
        "Selected microscope does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
      );
    }
  };

  const handleDateChange = (date) => {
    const selectedMicroscope = microscopes.find(
      (m) => m._id === formData.microscopeEquipmentId
    );

    if (selectedMicroscope && !selectedMicroscope.calibrationFrequency) {
      setError(
        "Selected microscope does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
      );
    } else if (selectedMicroscope && selectedMicroscope.calibrationFrequency) {
      // Clear error if calibration frequency exists
      setError(null);
    }

    setFormData((prev) => ({
      ...prev,
      date: date,
    }));
  };

  const handleServiceReport = (serviceReportData) => {
    if (serviceReportData) {
      // If it's base64 data, convert to blob and create object URL
      if (
        typeof serviceReportData === "string" &&
        !serviceReportData.startsWith("http")
      ) {
        try {
          // Convert base64 to blob
          const byteCharacters = atob(serviceReportData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });

          // Create object URL and open
          const url = window.URL.createObjectURL(blob);
          window.open(url, "_blank");

          // Clean up the object URL after a delay
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
        } catch (error) {
          console.error("Error opening PDF:", error);
          setError("Failed to open PDF file");
        }
      } else {
        // If it's already a URL, open it directly
        window.open(serviceReportData, "_blank");
      }
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Extract just the base64 data from the data URL
        const dataUrl = event.target.result;
        const base64Data = dataUrl.split(",")[1]; // Remove the "data:application/pdf;base64," prefix
        setFormData({
          ...formData,
          serviceReport: file,
          serviceReportUrl: base64Data,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFormData({ ...formData, serviceReport: null, serviceReportUrl: null });
    }
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/list");
  };

  const handleViewHistory = async (microscope) => {
    setSelectedMicroscopeForHistory(microscope);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setMicroscopeHistory([]);

    try {
      const response = await plmMicroscopeService.getByEquipment(
        microscope.equipmentReference
      );
      const history = response.data || response || [];
      // Sort by date descending (most recent first)
      const sortedHistory = history.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      setMicroscopeHistory(sortedHistory);
    } catch (err) {
      console.error("Error fetching microscope history:", err);
      setMicroscopeHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        PLM Microscope Servicing
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
          <Typography color="text.primary">
            PLM Microscope Calibrations
          </Typography>
        </Breadcrumbs>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Service Record
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Phase Contrast Microscope Equipment Table */}
      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          Polarised Light Microscope Equipment
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
              {microscopesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : microscopes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No microscope equipment found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                microscopes.map((microscope) => {
                  const status = calculateStatus(microscope);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={microscope._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {microscope.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>{microscope.brandModel || "-"}</TableCell>
                      <TableCell>{microscope.section || "-"}</TableCell>
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
                        {microscope.lastCalibration
                          ? formatDate(microscope.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {microscope.calibrationDue
                          ? (() => {
                              const daysUntil = calculateDaysUntilCalibration(
                                microscope.calibrationDue
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
                                    {formatDate(microscope.calibrationDue)}
                                  </Typography>
                                </Box>
                              );
                            })()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewHistory(microscope)}
                          size="small"
                          title="View Servicing History"
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

      {/* Add/Edit Servicing Dialog */}
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
              {editingCalibration ? "Edit Servicing" : "Add New Servicing"}
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
                  <InputLabel>Microscope</InputLabel>
                  <Select
                    value={formData.microscopeEquipmentId}
                    onChange={(e) => handleMicroscopeChange(e.target.value)}
                    label="Microscope"
                    disabled={microscopesLoading}
                  >
                    <MenuItem value="">
                      <em>Select a microscope</em>
                    </MenuItem>
                    {microscopes.length > 0 ? (
                      microscopes.map((microscope) => (
                        <MenuItem key={microscope._id} value={microscope._id}>
                          {microscope.equipmentReference} -{" "}
                          {microscope.brandModel}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        {microscopesLoading
                          ? "Loading..."
                          : "No microscopes found"}
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="Servicing Date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Box>
              <TextField
                fullWidth
                label="Servicing Company"
                value={formData.servicingCompany}
                onChange={(e) =>
                  setFormData({ ...formData, servicingCompany: e.target.value })
                }
                required
              />
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
              <Button variant="outlined" component="label" fullWidth>
                Attach Service Report
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </Button>
              {formData.serviceReport && (
                <Typography variant="body2" color="primary">
                  File selected: {formData.serviceReport.name}
                </Typography>
              )}
              {editingCalibration &&
                editingCalibration.serviceReportUrl &&
                !formData.serviceReport && (
                  <Typography variant="body2" color="success.main">
                    ✓ Service report already uploaded
                  </Typography>
                )}
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
                !formData.microscopeEquipmentId ||
                !formData.date ||
                !formData.servicingCompany
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
          Delete PLM Microscope Servicing
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the servicing record for microscope{" "}
            {calibrationToDelete?.microscopeReference}? This action cannot be
            undone.
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

      {/* Servicing History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedMicroscopeForHistory(null);
          setMicroscopeHistory([]);
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
              Servicing History -{" "}
              {selectedMicroscopeForHistory?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedMicroscopeForHistory(null);
                setMicroscopeHistory([]);
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
          ) : microscopeHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No servicing history found for this microscope.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Servicing Date</TableCell>
                    <TableCell>Servicing Company</TableCell>
                    <TableCell>Calibrated By</TableCell>
                    <TableCell>Service Report</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {microscopeHistory.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.servicingCompany || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibratedBy?.name ||
                          (calibration.calibratedBy?.firstName &&
                          calibration.calibratedBy?.lastName
                            ? `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
                            : "-")}
                      </TableCell>
                      <TableCell>
                        {calibration.serviceReportUrl ? (
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleServiceReport(calibration.serviceReportUrl)
                            }
                            title="View Service Report"
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{calibration.notes || "-"}</TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleEditFromHistory(calibration)}
                          size="small"
                          title="Edit Calibration"
                          sx={{ color: theme.palette.primary.main }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(calibration)}
                          size="small"
                          title="Delete Calibration"
                          sx={{ color: theme.palette.error.main }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
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
              setSelectedMicroscopeForHistory(null);
              setMicroscopeHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PLMMicroscopePage;
