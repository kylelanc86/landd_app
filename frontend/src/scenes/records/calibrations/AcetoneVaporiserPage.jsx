import React, { useState, useEffect } from "react";
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { useAuth } from "../../../context/AuthContext";
import userService from "../../../services/userService";
import { acetoneVaporiserCalibrationService } from "../../../services/acetoneVaporiserCalibrationService";
import LookupField from "../../../components/LookupField";
import {
  userOptionsFromList,
  equipmentOptionsFromList,
  buildEquipmentDisplayLabel,
} from "../../../utils/lookupOptions";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";
import { clearCachedCalibrationData } from "../../../utils/calibrationCache";

const AcetoneVaporiserPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog and form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [vaporisers, setVaporisers] = useState([]);
  const [vaporisersLoading, setVaporisersLoading] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    equipmentId: "",
    vaporiserReference: "",
    date: formatDateForInput(new Date()),
    technicianId: "",
    technicianName: "",
    temperature: "",
    notes: "",
  });

  useEffect(() => {
    fetchData();
    fetchVaporisers();
    fetchTechnicians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set current user as default technician when dialog opens
  useEffect(() => {
    if (addDialogOpen && currentUser && technicians.length > 0) {
      const currentUserInList = technicians.find(
        (tech) => tech._id === currentUser._id,
      );
      if (currentUserInList) {
        setFormData((prev) => ({
          ...prev,
          technicianId: currentUser._id,
          technicianName:
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim(),
        }));
      }
    }
  }, [addDialogOpen, currentUser, technicians]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all acetone vaporiser calibrations
      const response = await acetoneVaporiserCalibrationService.getAll({
        limit: 1000,
        sortBy: "date",
        sortOrder: "desc",
      });

      const calibrationData = response.data || [];

      // Transform data for display
      const transformedCalibrations = calibrationData.map((cal) => ({
        id: cal._id,
        _id: cal._id,
        vaporiserId: cal.vaporiserReference || "",
        vaporiserEquipmentId: cal.vaporiserId,
        date: cal.date,
        temperature: cal.temperature,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        equipmentId: cal.vaporiserId,
      }));

      // Group by equipment and get only the most recent calibration for each
      const calibrationsByEquipment = {};
      transformedCalibrations.forEach((cal) => {
        const equipmentId = cal.equipmentId || cal.vaporiserEquipmentId;
        if (!equipmentId) return;

        // Convert ObjectId to string for consistent key
        const equipmentIdStr = equipmentId.toString();

        if (
          !calibrationsByEquipment[equipmentIdStr] ||
          new Date(cal.date) >
            new Date(calibrationsByEquipment[equipmentIdStr].date)
        ) {
          calibrationsByEquipment[equipmentIdStr] = cal;
        }
      });

      // Convert back to array
      const mostRecentCalibrations = Object.values(calibrationsByEquipment);

      setCalibrations(mostRecentCalibrations);
    } catch (error) {
      console.error("Error fetching data:", error);
      setCalibrations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVaporisers = async () => {
    try {
      setVaporisersLoading(true);
      const response = await equipmentService.getAll({
        equipmentType: "Acetone Vaporiser",
        limit: 1000,
      });

      const equipment = response.equipment || [];
      setVaporisers(
        equipment.sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference),
        ),
      );
    } catch (error) {
      console.error("Error fetching vaporisers:", error);
      setVaporisers([]);
    } finally {
      setVaporisersLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      setTechniciansLoading(true);
      const response = await userService.getAll();
      const allUsers = response.data || response || [];

      // Filter users who have signatory=true OR calibration approval=true
      const technicianUsers = allUsers.filter(
        (user) =>
          user.isActive &&
          (user.labSignatory === true ||
            user.labApprovals?.calibrations === true),
      );

      // Sort alphabetically by name
      const sortedUsers = technicianUsers.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setTechnicians(sortedUsers);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      setTechnicians([]);
    } finally {
      setTechniciansLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingCalibration(null);
    setIsEditMode(true);
    setFormError(null);
    setFormData({
      equipmentId: "",
      vaporiserReference: "",
      date: formatDateForInput(new Date()),
      technicianId: currentUser?._id || "",
      technicianName: currentUser
        ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
        : "",
      temperature: "",
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (!submitting) {
      setAddDialogOpen(false);
      setEditingCalibration(null);
      setIsEditMode(false);
      setFormError(null);
      setFormData({
        equipmentId: "",
        vaporiserReference: "",
        date: formatDateForInput(new Date()),
        technicianId: "",
        technicianName: "",
        temperature: "",
        notes: "",
      });
    }
  };

  const handleVaporiserChange = (equipmentId) => {
    const selectedVaporiser = vaporisers.find(
      (v) => String(v._id) === String(equipmentId),
    );
    setFormData((prev) => ({
      ...prev,
      equipmentId,
      vaporiserReference: selectedVaporiser
        ? selectedVaporiser.equipmentReference
        : "",
    }));
  };

  const handleTechnicianChange = (technicianId) => {
    const selectedTechnician = technicians.find(
      (t) => String(t._id) === String(technicianId),
    );
    setFormData((prev) => ({
      ...prev,
      technicianId,
      technicianName: selectedTechnician
        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
        : "",
    }));
  };

  const populateFormFromCalibration = (calibration) => {
    let equipmentId = "";
    let vaporiserReference = calibration.vaporiserReference || "";
    if (calibration.vaporiserId) {
      if (
        typeof calibration.vaporiserId === "object" &&
        calibration.vaporiserId._id
      ) {
        equipmentId = calibration.vaporiserId._id;
        vaporiserReference =
          calibration.vaporiserId.equipmentReference || vaporiserReference;
      } else {
        equipmentId = calibration.vaporiserId;
        const vaporiser = vaporisers.find(
          (v) => String(v._id) === String(calibration.vaporiserId),
        );
        if (vaporiser) {
          vaporiserReference = vaporiser.equipmentReference;
        }
      }
    }

    let technicianId = "";
    let technicianName = "";
    if (calibration.calibratedBy) {
      if (
        typeof calibration.calibratedBy === "object" &&
        calibration.calibratedBy._id
      ) {
        technicianId = calibration.calibratedBy._id;
        technicianName =
          `${calibration.calibratedBy.firstName || ""} ${calibration.calibratedBy.lastName || ""}`.trim();
      } else {
        technicianId = calibration.calibratedBy;
        const technician = technicians.find(
          (t) => String(t._id) === String(calibration.calibratedBy),
        );
        if (technician) {
          technicianName =
            `${technician.firstName} ${technician.lastName}`.trim();
        }
      }
    }

    setFormData({
      equipmentId,
      vaporiserReference,
      date: formatDateForInput(new Date(calibration.date)),
      technicianId,
      technicianName,
      temperature: calibration.temperature?.toString() || "",
      notes: calibration.notes || "",
    });
  };

  const handleSetToday = () => {
    setFormData((prev) => ({
      ...prev,
      date: formatDateForInput(new Date()),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.equipmentId) {
      setFormError("Please select an equipment ID");
      return;
    }
    if (!formData.date) {
      setFormError("Please select a calibration date");
      return;
    }
    if (!formData.technicianId) {
      setFormError("Please select a technician");
      return;
    }
    if (!formData.temperature || isNaN(parseFloat(formData.temperature))) {
      setFormError("Please enter a valid temperature in degrees C");
      return;
    }

    try {
      setSubmitting(true);

      const calibrationData = {
        equipmentId: formData.equipmentId,
        date: formData.date,
        temperature: parseFloat(formData.temperature),
        technicianId: formData.technicianId,
        notes: formData.notes || "",
      };

      if (editingCalibration) {
        await acetoneVaporiserCalibrationService.update(
          editingCalibration._id,
          calibrationData,
        );
      } else {
        await acetoneVaporiserCalibrationService.create(calibrationData);
      }

      handleDialogClose();
      clearCachedCalibrationData("acetone-vaporiser");
      fetchData();
    } catch (error) {
      console.error("Error submitting calibration:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to save calibration";
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id) => {
    try {
      const calibration = await acetoneVaporiserCalibrationService.getById(id);
      setEditingCalibration(calibration);
      setIsEditMode(false);
      populateFormFromCalibration(calibration);
      setFormError(null);
      setAddDialogOpen(true);
    } catch (error) {
      console.error("Error fetching calibration for edit:", error);
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to load calibration data",
      );
    }
  };

  const lookupViewMode = Boolean(editingCalibration && !isEditMode);

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this calibration record?",
      )
    ) {
      return;
    }

    try {
      await acetoneVaporiserCalibrationService.delete(id);
      clearCachedCalibrationData("acetone-vaporiser");
      fetchData();
    } catch (error) {
      console.error("Error deleting calibration:", error);
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete calibration",
      );
    }
  };

  const handleViewHistory = (calibration) => {
    // Navigate to history page for this equipment
    const equipmentId =
      calibration.equipmentId || calibration.vaporiserEquipmentId;
    if (equipmentId) {
      navigate(
        `/records/laboratory/calibrations/acetone-vaporiser/${equipmentId}`,
      );
    }
  };

  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="Acetone Vaporiser Calibrations"
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Calibration
          </Button>
        }
      />

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Equipment Ref</TableCell>
                <TableCell>Calibration Date</TableCell>
                <TableCell>Temperature</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next Calibration</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calibrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No calibrations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                calibrations.map((calibration) => {
                  return (
                    <TableRow key={calibration.id || calibration._id}>
                      <TableCell>{calibration.vaporiserId}</TableCell>
                      <TableCell>{formatDate(calibration.date)}</TableCell>
                      <TableCell>{calibration.temperature}°C</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            backgroundColor:
                              calibration.status === "Pass"
                                ? theme.palette.success.main
                                : theme.palette.error.main,
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
                        {calibration.nextCalibration
                          ? formatDate(calibration.nextCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewHistory(calibration)}
                          size="small"
                          title="View Calibration History"
                          sx={{ color: theme.palette.info.main }}
                        >
                          <HistoryIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleEdit(calibration.id)}
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(calibration.id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add Calibration Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="h6">
                {editingCalibration
                  ? lookupViewMode
                    ? "View Calibration"
                    : "Edit Calibration"
                  : "Add New Calibration"}
              </Typography>
              {lookupViewMode && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Record
                </Button>
              )}
              {editingCalibration && isEditMode && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setIsEditMode(false);
                    populateFormFromCalibration(editingCalibration);
                  }}
                >
                  Cancel Edit
                </Button>
              )}
            </Box>
            <IconButton onClick={handleDialogClose} disabled={submitting}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            {formError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setFormError(null)}
              >
                {formError}
              </Alert>
            )}
            <Stack spacing={3} sx={{ mt: 1 }}>
              <LookupField
                mode={lookupViewMode ? "view" : "edit"}
                label="Acetone Vaporiser"
                required
                value={formData.equipmentId}
                displayLabel={
                  formData.vaporiserReference ||
                  buildEquipmentDisplayLabel(
                    vaporisers.find(
                      (v) => String(v._id) === String(formData.equipmentId),
                    ),
                  )
                }
                options={equipmentOptionsFromList(vaporisers)}
                onChange={(e) => handleVaporiserChange(e.target.value)}
                disabled={vaporisersLoading || submitting}
                loading={vaporisersLoading}
                emptyOptionsText="No vaporisers found"
              />

              <Box>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={1}
                >
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
                    disabled={submitting || lookupViewMode}
                    sx={{ mr: 1 }}
                  />
                  {!lookupViewMode && (
                    <Button
                      variant="outlined"
                      onClick={handleSetToday}
                      disabled={submitting}
                      sx={{ ml: 1, minWidth: "100px" }}
                    >
                      Today
                    </Button>
                  )}
                </Box>
              </Box>

              <LookupField
                mode={lookupViewMode ? "view" : "edit"}
                label="Technician"
                required
                value={formData.technicianId}
                displayLabel={formData.technicianName}
                options={userOptionsFromList(technicians)}
                onChange={(e) => handleTechnicianChange(e.target.value)}
                disabled={techniciansLoading || submitting}
                loading={techniciansLoading}
                emptyOptionsText="No technicians found"
              />

              <TextField
                fullWidth
                label="Temperature"
                type="number"
                value={formData.temperature}
                onChange={(e) =>
                  setFormData({ ...formData, temperature: e.target.value })
                }
                placeholder="Enter temperature in degrees C"
                required
                disabled={submitting || lookupViewMode}
                inputProps={{ step: "0.1" }}
                helperText="Pass mark is between 65 and 100 degrees C"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleDialogClose} disabled={submitting}>
              {lookupViewMode ? "Close" : "Cancel"}
            </Button>
            {!lookupViewMode && (
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                startIcon={
                  submitting ? null : editingCalibration ? null : <AddIcon />
                }
              >
                {submitting ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={16} />
                    Saving...
                  </Box>
                ) : editingCalibration ? (
                  "Update Calibration"
                ) : (
                  "Add Calibration"
                )}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default AcetoneVaporiserPage;
