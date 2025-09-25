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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { graticuleService } from "../../../services/graticuleService";

const GraticulePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [calibrations, setCalibrations] = useState([]);

  // Microscope data state
  const [microscopes, setMicroscopes] = useState([]);
  const [microscopesLoading, setMicroscopesLoading] = useState(false);

  // Fetch data on component mount
  useEffect(() => {
    fetchCalibrations();
    fetchMicroscopes();
  }, []);

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

  const fetchMicroscopes = async () => {
    try {
      setMicroscopesLoading(true);

      // First try with both filters
      let response = await equipmentService.getAll({
        equipmentType: "Microscope",
        section: "Air Monitoring",
        limit: 100,
      });

      // If no results, try without section filter
      if (!response.equipment || response.equipment.length === 0) {
        response = await equipmentService.getAll({
          equipmentType: "Microscope",
          limit: 100,
        });
      }

      // If still no results, try without any filters to see all equipment
      if (!response.equipment || response.equipment.length === 0) {
        response = await equipmentService.getAll({
          limit: 100,
        });
      }

      // Filter for microscopes from the equipment array
      const microscopeEquipment = (response.equipment || []).filter(
        (item) => item.equipmentType === "Microscope"
      );

      setMicroscopes(microscopeEquipment);
    } catch (err) {
      console.error("Error fetching microscopes:", err);
      setError("Failed to load microscopes");
    } finally {
      setMicroscopesLoading(false);
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
    date: new Date().toISOString().split("T")[0],
    scale: "",
    status: "Pass",
    technician: "",
    nextCalibration: "",
    microscopeId: "",
    microscopeReference: "",
  });

  const handleAdd = () => {
    setEditingCalibration(null);
    setFormData({
      graticuleId: "",
      date: new Date().toISOString().split("T")[0],
      scale: "",
      status: "Pass",
      technician: "",
      nextCalibration: "",
      microscopeId: "",
      microscopeReference: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (id) => {
    const calibration = calibrations.find((c) => c.id === id);
    if (calibration) {
      setEditingCalibration(calibration);
      setFormData({
        graticuleId: calibration.graticuleId,
        date: calibration.date,
        scale: calibration.scale,
        status: calibration.status,
        technician: calibration.technician,
        nextCalibration: calibration.nextCalibration,
        microscopeId: calibration.microscopeId || "",
        microscopeReference: calibration.microscopeReference || "",
      });
      setOpenDialog(true);
    }
  };

  const handleDelete = (id) => {
    const calibration = calibrations.find((c) => c.id === id);
    if (calibration) {
      setCalibrationToDelete(calibration);
      setDeleteDialog(true);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (
        !formData.graticuleId ||
        !formData.date ||
        !formData.scale ||
        !formData.technician
      ) {
        setError("Please fill in all required fields");
        return;
      }

      if (editingCalibration) {
        // Update existing calibration
        await graticuleService.update(editingCalibration._id, formData);
      } else {
        // Add new calibration
        await graticuleService.create(formData);
      }

      setOpenDialog(false);
      setEditingCalibration(null);
      // Refresh the data
      await fetchCalibrations();
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

  const handleMicroscopeChange = (microscopeId) => {
    const selectedMicroscope = microscopes.find((m) => m._id === microscopeId);
    setFormData((prev) => ({
      ...prev,
      microscopeId: microscopeId,
      microscopeReference: selectedMicroscope
        ? selectedMicroscope.equipmentReference
        : "",
    }));
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
          Graticule Calibrations
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="flex-end" mb="20px">
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
              <TableCell>Scale</TableCell>
              <TableCell>Microscope</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Next Calibration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : calibrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No calibrations found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              calibrations.map((calibration) => (
                <TableRow key={calibration._id}>
                  <TableCell>{calibration.graticuleId}</TableCell>
                  <TableCell>{formatDate(calibration.date)}</TableCell>
                  <TableCell>{calibration.scale}</TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {calibration.microscopeReference || "Not assigned"}
                    </Typography>
                  </TableCell>
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
                  <TableCell>{calibration.technician}</TableCell>
                  <TableCell>
                    {formatDate(calibration.nextCalibration)}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleEdit(calibration._id)}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(calibration._id)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
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
            <TextField
              fullWidth
              label="Graticule ID"
              value={formData.graticuleId}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  graticuleId: e.target.value,
                }))
              }
              required
            />
            <TextField
              fullWidth
              label="Calibration Date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              fullWidth
              label="Scale"
              value={formData.scale}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, scale: e.target.value }))
              }
              placeholder="e.g., 100 µm"
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                label="Status"
              >
                <MenuItem value="Pass">Pass</MenuItem>
                <MenuItem value="Fail">Fail</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Technician"
              value={formData.technician}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, technician: e.target.value }))
              }
              required
            />
            <FormControl fullWidth>
              <InputLabel>Microscope</InputLabel>
              <Select
                value={formData.microscopeId}
                onChange={(e) => handleMicroscopeChange(e.target.value)}
                label="Microscope"
                disabled={microscopesLoading}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {microscopes.length > 0 ? (
                  microscopes.map((microscope) => (
                    <MenuItem key={microscope._id} value={microscope._id}>
                      {microscope.equipmentReference} - {microscope.brandModel}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {microscopesLoading ? "Loading..." : "No microscopes found"}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Next Calibration"
              type="date"
              value={formData.nextCalibration}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  nextCalibration: e.target.value,
                }))
              }
              InputLabelProps={{ shrink: true }}
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
