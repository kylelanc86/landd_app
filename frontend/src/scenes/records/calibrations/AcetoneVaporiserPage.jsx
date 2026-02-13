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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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

const AcetoneVaporiserPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog and form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [vaporisers, setVaporisers] = useState([]);
  const [vaporisersLoading, setVaporisersLoading] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    equipmentId: "",
    date: formatDateForInput(new Date()),
    technicianId: "",
    temperature: "",
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
    setFormError(null);
    setFormData({
      equipmentId: "",
      date: formatDateForInput(new Date()),
      technicianId: currentUser?._id || "",
      temperature: "",
    });
    setAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (!submitting) {
      setAddDialogOpen(false);
      setFormError(null);
      setFormData({
        equipmentId: "",
        date: formatDateForInput(new Date()),
        technicianId: "",
        temperature: "",
      });
    }
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

      await acetoneVaporiserCalibrationService.create(calibrationData);

      handleDialogClose();
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

  const handleEdit = (id) => {
    console.log("Edit calibration:", id);
  };

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
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton
          onClick={() => navigate("/records/laboratory/calibrations/list")}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Acetone Vaporiser Calibrations
        </Typography>
      </Box>

      <Box display="flex" justifyContent="flex-end" mb="20px">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vaporiser ID</TableCell>
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
            <Typography variant="h6">Add New Calibration</Typography>
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
              <FormControl fullWidth required>
                <InputLabel>Equipment ID</InputLabel>
                <Select
                  value={formData.equipmentId}
                  onChange={(e) =>
                    setFormData({ ...formData, equipmentId: e.target.value })
                  }
                  label="Equipment ID"
                  disabled={vaporisersLoading || submitting}
                >
                  <MenuItem value="">
                    <em>Select an acetone vaporiser</em>
                  </MenuItem>
                  {vaporisers.length > 0 ? (
                    vaporisers.map((vaporiser) => (
                      <MenuItem key={vaporiser._id} value={vaporiser._id}>
                        {vaporiser.equipmentReference}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      {vaporisersLoading ? "Loading..." : "No vaporisers found"}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>

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
                    disabled={submitting}
                    sx={{ mr: 1 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={handleSetToday}
                    disabled={submitting}
                    sx={{ ml: 1, minWidth: "100px" }}
                  >
                    Today
                  </Button>
                </Box>
              </Box>

              <FormControl fullWidth required>
                <InputLabel>Technician</InputLabel>
                <Select
                  value={formData.technicianId}
                  onChange={(e) =>
                    setFormData({ ...formData, technicianId: e.target.value })
                  }
                  label="Technician"
                  disabled={techniciansLoading || submitting}
                >
                  <MenuItem value="">
                    <em>Select a technician</em>
                  </MenuItem>
                  {technicians.length > 0 ? (
                    technicians.map((technician) => (
                      <MenuItem key={technician._id} value={technician._id}>
                        {technician.firstName} {technician.lastName}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      {techniciansLoading
                        ? "Loading..."
                        : "No technicians found"}
                    </MenuItem>
                  )}
                </Select>
              </FormControl>

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
                disabled={submitting}
                inputProps={{ step: "0.1" }}
                helperText="Pass mark is between 65 and 100 degrees C"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleDialogClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={submitting ? null : <AddIcon />}
            >
              {submitting ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  Saving...
                </Box>
              ) : (
                "Add Calibration"
              )}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default AcetoneVaporiserPage;
