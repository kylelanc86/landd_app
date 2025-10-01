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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { graticuleService } from "../../../services/graticuleService";
import userService from "../../../services/userService";

const GraticulePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [calibrations, setCalibrations] = useState([]);

  // Graticule equipment state
  const [graticules, setGraticules] = useState([]);
  const [graticulesLoading, setGraticulesLoading] = useState(false);

  // Combined data for table display
  const [tableData, setTableData] = useState([]);

  // Lab signatories state
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);

  const combineTableData = useCallback(() => {
    // Create a map of calibrations by graticuleId for quick lookup
    const calibrationsMap = {};
    calibrations.forEach((cal) => {
      calibrationsMap[cal.graticuleId] = cal;
    });

    // Combine graticule equipment with their calibration data
    const combinedData = graticules.map((graticule) => {
      const calibration = calibrationsMap[graticule.equipmentReference];

      if (calibration) {
        // Graticule has been calibrated
        return {
          ...calibration,
          graticuleEquipment: graticule,
          isCalibrated: true,
        };
      } else {
        // Graticule has not been calibrated yet
        return {
          _id: `uncalibrated-${graticule._id}`,
          graticuleId: graticule.equipmentReference,
          graticuleEquipment: graticule,
          date: null,
          scale: null,
          status: "Not Calibrated",
          technician: null,
          technicianName: null,
          nextCalibration: null,
          microscopeId: null,
          microscopeReference: null,
          notes: null,
          calibratedBy: null,
          createdAt: null,
          updatedAt: null,
          isCalibrated: false,
        };
      }
    });

    // Sort by graticule ID
    combinedData.sort((a, b) => a.graticuleId.localeCompare(b.graticuleId));

    setTableData(combinedData);
  }, [calibrations, graticules]);

  // Fetch data on component mount
  useEffect(() => {
    fetchCalibrations();
    fetchGraticules();
    fetchLabSignatories();
  }, []);

  // Update table data when calibrations or graticules change
  useEffect(() => {
    combineTableData();
  }, [combineTableData]);

  const fetchCalibrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await graticuleService.getAll();
      setCalibrations(response.data || []);
    } catch (err) {
      console.error("Error fetching calibrations:", err);
      setError("Failed to load calibrations");
    } finally {
      setLoading(false);
    }
  };

  const fetchGraticules = async () => {
    try {
      setGraticulesLoading(true);

      // Fetch graticule equipment
      let response = await equipmentService.getAll({
        equipmentType: "Graticule",
        limit: 100,
      });

      // If no results, try without any filters to see all equipment
      if (!response.equipment || response.equipment.length === 0) {
        response = await equipmentService.getAll({
          limit: 100,
        });
      }

      // Filter for graticules from the equipment array
      const graticuleEquipment = (response.equipment || []).filter(
        (item) => item.equipmentType === "Graticule"
      );

      setGraticules(graticuleEquipment);
    } catch (err) {
      console.error("Error fetching graticules:", err);
      setError("Failed to load graticules");
    } finally {
      setGraticulesLoading(false);
    }
  };

  const fetchLabSignatories = async () => {
    try {
      setLabSignatoriesLoading(true);

      const response = await userService.getAll();
      const allUsers = response.data || [];

      // Filter users who have labSignatory permission and are active
      const labSignatoryUsers = allUsers.filter(
        (user) => user.isActive && user.labSignatory === true
      );

      // Sort alphabetically by name
      const sortedUsers = labSignatoryUsers.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setLabSignatories(sortedUsers);
    } catch (err) {
      console.error("Error fetching lab signatories:", err);
      setError("Failed to load lab signatories");
    } finally {
      setLabSignatoriesLoading(false);
    }
  };

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    graticuleId: "",
    graticuleEquipmentId: "",
    date: formatDateForInput(new Date()),
    diameter: "",
    area: "",
    status: "Pass",
    technicianId: "",
    technicianName: "",
    nextCalibration: "",
  });

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setFormData({
      graticuleId: "",
      graticuleEquipmentId: "",
      date: todayDate,
      diameter: "",
      area: "",
      status: "Pass",
      technicianId: "",
      technicianName: "",
      nextCalibration: "", // Will be calculated when graticule is selected
    });
    setOpenDialog(true);
  };

  const handleEdit = (id) => {
    const item = tableData.find((item) => item._id === id);
    if (item && item.isCalibrated) {
      const calibration = item;
      setEditingCalibration(calibration);

      // Parse scale field to extract diameter
      let diameter = "";
      let area = "";
      if (calibration.scale) {
        // Try to extract diameter from scale field (format: "100 µm (Area: 7853.98 µm²)")
        const diameterMatch = calibration.scale.match(/(\d+(?:\.\d+)?)\s*µm/);
        if (diameterMatch) {
          diameter = diameterMatch[1];
          area = calculateArea(diameter);
        } else {
          // Fallback: try to parse as just diameter value
          diameter = calibration.scale;
          area = calculateArea(diameter);
        }
      }

      // Find the graticule equipment ID by matching the graticule reference
      const graticuleEquipment = graticules.find(
        (g) => g.equipmentReference === calibration.graticuleId
      );

      // Recalculate next calibration using the correct calibration frequency
      let recalculatedNextCalibration = "";
      if (graticuleEquipment && graticuleEquipment.calibrationFrequency) {
        recalculatedNextCalibration = calculateNextCalibration(
          formatDateForInput(calibration.date),
          graticuleEquipment.calibrationFrequency
        );
        console.log(
          "Recalculated next calibration for edit:",
          recalculatedNextCalibration
        );
      }

      // Find the technician ID by matching the technician name
      const technicianName =
        calibration.technicianName || calibration.technician || "";
      const matchingTechnician = labSignatories.find(
        (tech) => `${tech.firstName} ${tech.lastName}` === technicianName
      );

      setFormData({
        graticuleId: calibration.graticuleId,
        graticuleEquipmentId:
          calibration.graticuleEquipmentId || graticuleEquipment?._id || "",
        date: formatDateForInput(calibration.date),
        diameter: diameter,
        area: area,
        status: calibration.status,
        technicianId: matchingTechnician?._id || calibration.technicianId || "",
        technicianName: technicianName,
        nextCalibration:
          recalculatedNextCalibration ||
          formatDateForInput(calibration.nextCalibration),
      });
      setOpenDialog(true);
    }
  };

  const handleDelete = (id) => {
    const item = tableData.find((item) => item._id === id);
    if (item && item.isCalibrated) {
      setCalibrationToDelete(item);
      setDeleteDialog(true);
    }
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called");
    console.log("Form data:", formData);

    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (
        !formData.graticuleEquipmentId ||
        !formData.date ||
        !formData.diameter ||
        !formData.technicianId
      ) {
        console.log("Validation failed:", {
          graticuleEquipmentId: formData.graticuleEquipmentId,
          date: formData.date,
          diameter: formData.diameter,
          technicianId: formData.technicianId,
        });
        setError("Please fill in all required fields");
        return;
      }

      // Additional validation for backend requirements
      if (!formData.graticuleId && !formData.graticuleEquipmentId) {
        setError("Please select a graticule");
        return;
      }

      if (!formData.technicianName) {
        setError("Please select a technician");
        return;
      }

      // Check if graticule has calibration frequency
      const selectedGraticule = graticules.find(
        (g) => g._id === formData.graticuleEquipmentId
      );

      if (!selectedGraticule || !selectedGraticule.calibrationFrequency) {
        setError(
          "Selected graticule does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
        );
        return;
      }

      // Check if nextCalibration is calculated
      if (!formData.nextCalibration) {
        console.log(
          "Next calibration validation failed - nextCalibration is empty"
        );
        setError(
          "Next calibration date could not be calculated. Please ensure the graticule has a valid calibration frequency."
        );
        return;
      }

      console.log("All validations passed, proceeding with submission");

      // Map form data to backend expected format
      const backendData = {
        graticuleId: formData.graticuleId, // Just the graticule ID
        graticuleEquipmentId: formData.graticuleEquipmentId, // Store original equipment ID for filtering
        date: new Date(formData.date), // Ensure date is a Date object
        scale: `${formData.diameter} µm`, // Just the diameter
        status: formData.status,
        technician: formData.technicianName, // Send technician name instead of ID
        nextCalibration: formData.nextCalibration
          ? new Date(formData.nextCalibration + "T00:00:00")
          : new Date(formData.date + "T00:00:00"), // Use calibration date as fallback
        // Note: microscopeId and microscopeReference are not needed anymore
      };

      console.log("Backend data being sent:", backendData);
      console.log(
        "Next calibration in backend data:",
        backendData.nextCalibration
      );

      if (editingCalibration) {
        // Update existing calibration
        await graticuleService.update(editingCalibration._id, backendData);
      } else {
        // Add new calibration
        await graticuleService.create(backendData);
      }

      // Update the equipment record with new calibration dates
      try {
        const equipmentUpdateData = {
          lastCalibration: new Date(formData.date),
          calibrationDue: new Date(formData.nextCalibration + "T00:00:00"),
        };

        console.log(
          "Updating equipment calibration dates:",
          equipmentUpdateData
        );
        await equipmentService.update(
          formData.graticuleEquipmentId,
          equipmentUpdateData
        );
      } catch (equipmentError) {
        console.error(
          "Failed to update equipment calibration dates:",
          equipmentError
        );
        // Don't fail the whole operation if equipment update fails
      }

      setOpenDialog(false);
      setEditingCalibration(null);
      // Refresh the data
      await fetchCalibrations();
      await fetchGraticules(); // Refresh graticule data to get updated calibration dates

      // Trigger a custom event to notify other components that equipment data has been updated
      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.graticuleEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      await graticuleService.delete(calibrationToDelete._id);
      setDeleteDialog(false);
      setCalibrationToDelete(null);
      // Refresh the data
      await fetchCalibrations();
    } catch (err) {
      setError(err.message || "Failed to delete calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCalibration(null);
    setError(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog(false);
    setCalibrationToDelete(null);
  };

  const handleGraticuleChange = (graticuleEquipmentId) => {
    const selectedGraticule = graticules.find(
      (g) => g._id === graticuleEquipmentId
    );

    console.log("Graticule selected:", {
      graticuleEquipmentId,
      selectedGraticule,
      calibrationFrequency: selectedGraticule?.calibrationFrequency,
    });

    // Calculate next calibration date using current form date
    let nextCalibration = "";
    if (
      selectedGraticule &&
      selectedGraticule.calibrationFrequency &&
      formData.date
    ) {
      nextCalibration = calculateNextCalibration(
        formData.date,
        selectedGraticule.calibrationFrequency
      );
      console.log(
        "Next calibration calculated on graticule change:",
        nextCalibration
      );
    }

    setFormData((prev) => ({
      ...prev,
      graticuleEquipmentId: graticuleEquipmentId,
      graticuleId: selectedGraticule
        ? selectedGraticule.equipmentReference
        : "",
      nextCalibration: nextCalibration,
    }));

    // Clear any existing errors when selecting a new graticule
    setError(null);

    // Check if the selected graticule has calibration frequency
    if (selectedGraticule && !selectedGraticule.calibrationFrequency) {
      setError(
        "Selected graticule does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
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

  const calculateNextCalibration = (calibrationDate, calibrationFrequency) => {
    if (!calibrationDate || !calibrationFrequency) return "";

    const date = new Date(calibrationDate);
    const frequency = parseInt(calibrationFrequency);

    if (isNaN(frequency)) return "";

    // Add the frequency in months to the calibration date
    date.setMonth(date.getMonth() + frequency);

    return formatDateForInput(date);
  };

  const calculateArea = (diameter) => {
    if (!diameter || isNaN(parseFloat(diameter))) return "";

    const d = parseFloat(diameter);
    const area = (Math.PI * d * d) / 4;

    return area.toFixed(2);
  };

  const calculateStatus = (diameter) => {
    if (!diameter || isNaN(parseFloat(diameter))) return "Pass";

    const d = parseFloat(diameter);

    // Pass if diameter is between 98 and 102 µm
    if (d >= 98 && d <= 102) {
      return "Pass";
    } else {
      return "Fail";
    }
  };

  const handleDiameterChange = (diameter) => {
    const area = calculateArea(diameter);
    const status = calculateStatus(diameter);

    setFormData((prev) => ({
      ...prev,
      diameter: diameter,
      area: area,
      status: status,
    }));
  };

  const handleDateChange = (date) => {
    const selectedGraticule = graticules.find(
      (g) => g._id === formData.graticuleEquipmentId
    );

    console.log("Date change debug:", {
      date,
      graticuleEquipmentId: formData.graticuleEquipmentId,
      selectedGraticule,
      calibrationFrequency: selectedGraticule?.calibrationFrequency,
    });

    let nextCalibration = "";

    if (selectedGraticule && selectedGraticule.calibrationFrequency) {
      nextCalibration = calculateNextCalibration(
        date,
        selectedGraticule.calibrationFrequency
      );
      console.log("Calculated next calibration:", nextCalibration);
    } else if (selectedGraticule) {
      // Show error if graticule is selected but has no calibration frequency
      setError(
        "Selected graticule does not have a calibration frequency set. Please set the calibration frequency in the Equipment List first."
      );
    }

    setFormData((prev) => ({
      ...prev,
      date: date,
      nextCalibration: nextCalibration,
    }));
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations");
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  // Calculate days until calibration is due
  const calculateDaysUntilCalibration = (nextCalibrationDate) => {
    if (!nextCalibrationDate) return null;

    const today = new Date();
    const calibrationDate = new Date(nextCalibrationDate);

    // Reset time to start of day for accurate day calculation
    today.setHours(0, 0, 0, 0);
    calibrationDate.setHours(0, 0, 0, 0);

    const timeDiff = calibrationDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Graticule Calibrations
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
          <Typography color="text.primary">Graticule Calibrations</Typography>
        </Breadcrumbs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        mb="20px"
        gap={2}
      >
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() =>
            navigate("/records/laboratory/calibrations/graticule/history")
          }
        >
          Historical Data
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Graticule ID</TableCell>
              <TableCell>Calibration Date</TableCell>
              <TableCell>Diameter (µm)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Next Calibration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : tableData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No graticules found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tableData.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.graticuleId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.date ? formatDate(item.date) : "-"}
                  </TableCell>
                  <TableCell>
                    {item.scale
                      ? item.scale.replace(/ µm \(Area: [\d.]+ µm²\)/, " µm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        backgroundColor:
                          item.status === "Pass"
                            ? theme.palette.success.main
                            : item.status === "Fail"
                            ? theme.palette.error.main
                            : theme.palette.grey[500],
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        display: "inline-block",
                      }}
                    >
                      {item.status}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.technicianName || item.technician || "-"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      if (!item.nextCalibration) return "-";

                      const daysUntil = calculateDaysUntilCalibration(
                        item.nextCalibration
                      );

                      let daysText;
                      let daysColor;

                      if (daysUntil === 0) {
                        daysText = "Due Today";
                        daysColor = theme.palette.warning.main;
                      } else if (daysUntil < 0) {
                        daysText = `${Math.abs(daysUntil)} days overdue`;
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
                            {formatDate(item.nextCalibration)}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {item.isCalibrated ? (
                      <>
                        <IconButton
                          onClick={() => handleEdit(item._id)}
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(item._id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not calibrated
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Graticule</InputLabel>
              <Select
                value={formData.graticuleEquipmentId}
                onChange={(e) => handleGraticuleChange(e.target.value)}
                label="Graticule"
                disabled={graticulesLoading}
              >
                <MenuItem value="">
                  <em>Select a graticule</em>
                </MenuItem>
                {graticules.length > 0 ? (
                  graticules.map((graticule) => (
                    <MenuItem key={graticule._id} value={graticule._id}>
                      {graticule.equipmentReference}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {graticulesLoading ? "Loading..." : "No graticules found"}
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
            <TextField
              fullWidth
              label="Diameter (µm)"
              value={formData.diameter}
              onChange={(e) => handleDiameterChange(e.target.value)}
              placeholder="e.g., 100"
              type="number"
              inputProps={{ step: "0.01", min: "0" }}
              required
            />
            <TextField
              fullWidth
              label="Graticule Area (µm²)"
              value={formData.area}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Automatically calculated using (πd²)/4"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={formData.status} label="Status" disabled>
                <MenuItem value="Pass">Pass</MenuItem>
                <MenuItem value="Fail">Fail</MenuItem>
              </Select>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Pass: 98-102 µm
              </Typography>
            </FormControl>
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
                      : "No lab signatories found"}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Next Calibration"
              type="date"
              value={formData.nextCalibration}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Automatically calculated from calibration date and frequency"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? (
              <CircularProgress size={20} />
            ) : editingCalibration ? (
              "Update"
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the calibration record for graticule{" "}
            {calibrationToDelete?.graticuleId}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GraticulePage;
