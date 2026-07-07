import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../../../theme/tokens";
import { calibrationFrequencyService } from "../../../services/calibrationFrequencyService";
import { equipmentService } from "../../../services/equipmentService";
import { CALIBRATION_TABS } from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const CalibrationFrequency = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [frequencyData, setFrequencyData] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newEquipmentType, setNewEquipmentType] = useState("");
  const [newFrequencyValue, setNewFrequencyValue] = useState(6);
  const [newFrequencyUnit, setNewFrequencyUnit] = useState("months");
  const [showAddForm, setShowAddForm] = useState(false);
  const [equipmentTypes, setEquipmentTypes] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const fixedResponse = await calibrationFrequencyService.getFixedFrequencies();
      setFrequencyData(fixedResponse.data || []);

      // Get all available equipment types from the service
      const allEquipmentTypes = equipmentService.getEquipmentTypes();
      setEquipmentTypes(allEquipmentTypes);
    } catch (err) {
      console.error("Error fetching calibration frequency data:", err);
      setError("Failed to load calibration frequency data");
      // Fallback to empty arrays if API fails
      setFrequencyData([]);
      // Still set equipment types even if API fails
      setEquipmentTypes(equipmentService.getEquipmentTypes());
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (id) => {
    setEditingId(id);
  };

  const handleSave = async (id) => {
    try {
      setEditingId(null);
      const item = frequencyData.find((item) => item._id === id);
      if (item) {
        await calibrationFrequencyService.updateFixedFrequency(id, {
          equipmentType: item.equipmentType,
          frequencyValue: item.frequencyValue,
          frequencyUnit: item.frequencyUnit,
        });
      }
    } catch (err) {
      console.error("Error saving frequency:", err);
      setError("Failed to save calibration frequency");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleFrequencyChange = (id, field, value) => {
    const item = frequencyData.find((item) => item._id === id);
    if (!item) return;

    let updatedItem = { ...item, [field]: value };

    // If the unit is being changed, convert the value accordingly
    if (field === "frequencyUnit" && item.frequencyUnit !== value) {
      if (value === "months" && item.frequencyUnit === "years") {
        // Converting from years to months: multiply by 12
        updatedItem.frequencyValue = item.frequencyValue * 12;
      } else if (value === "years" && item.frequencyUnit === "months") {
        // Converting from months to years: divide by 12
        updatedItem.frequencyValue = Math.round(item.frequencyValue / 12);
      }
    }

    const updatedData = frequencyData.map((dataItem) =>
      dataItem._id === id ? updatedItem : dataItem
    );
    setFrequencyData(updatedData);
  };

  const handleAddNew = async () => {
    if (newEquipmentType.trim()) {
      // Check if equipment type already exists
      const exists = frequencyData.some(
        (item) =>
          item.equipmentType.toLowerCase() === newEquipmentType.toLowerCase()
      );

      if (exists) {
        setError(
          "This equipment type already has a calibration frequency configured"
        );
        return;
      }

      try {
        const newItem = await calibrationFrequencyService.createFixedFrequency({
          equipmentType: newEquipmentType.trim(),
          frequencyValue: newFrequencyValue,
          frequencyUnit: newFrequencyUnit,
        });
        setFrequencyData((prev) => [...prev, newItem]);
        setNewEquipmentType("");
        setNewFrequencyValue(6);
        setNewFrequencyUnit("months");
        setShowAddForm(false);
        setError(null);
      } catch (err) {
        console.error("Error creating frequency:", err);
        setError("Failed to create calibration frequency");
      }
    }
  };

  const handleDelete = async (id) => {
    try {
      await calibrationFrequencyService.deleteFixedFrequency(id);
      setFrequencyData((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error("Error deleting frequency:", err);
      setError("Failed to delete calibration frequency");
    }
  };

  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="Calibration Frequency"
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowAddForm(true)}
            sx={{
              backgroundColor: tokens.primary[700],
              color: tokens.grey[100],
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              "&:hover": {
                backgroundColor: tokens.primary[800],
              },
            }}
          >
            Add Equipment Type
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add New Equipment Type Form */}
      {showAddForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Add New Equipment Type
          </Typography>
          <Box display="flex" flexDirection="column" gap={2} mb={2}>
            <FormControl fullWidth>
              <InputLabel>Equipment Type</InputLabel>
              <Select
                value={newEquipmentType}
                onChange={(e) => setNewEquipmentType(e.target.value)}
                label="Equipment Type"
              >
                {equipmentTypes
                  .filter(
                    (type) =>
                      !frequencyData.some(
                        (item) =>
                          item.equipmentType.toLowerCase() ===
                          type.toLowerCase()
                      )
                  )
                  .map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            <Box display="flex" gap={2} alignItems="center">
              <TextField
                label="Frequency Value"
                type="number"
                value={newFrequencyValue}
                onChange={(e) =>
                  setNewFrequencyValue(parseInt(e.target.value) || 1)
                }
                sx={{ width: 150 }}
                inputProps={{ min: 1, max: 999 }}
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Unit</InputLabel>
                <Select
                  value={newFrequencyUnit}
                  onChange={(e) => setNewFrequencyUnit(e.target.value)}
                  label="Unit"
                >
                  <MenuItem value="months">Months</MenuItem>
                  <MenuItem value="years">Years</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box display="flex" gap={2} justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={handleAddNew}
              disabled={!newEquipmentType.trim()}
              startIcon={<SaveIcon />}
            >
              Add Equipment Type
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setShowAddForm(false);
                setNewEquipmentType("");
                setNewFrequencyValue(6);
                setNewFrequencyUnit("months");
                setError(null);
              }}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      )}

      {/* Header Row for First Table */}
      <Box
        sx={{
          backgroundColor: tokens.primary[400],
          color: "white",
          p: 2,
          borderRadius: "8px 8px 0 0",
          fontWeight: "bold",
        }}
      >
        <Typography variant="h6" component="div" textAlign="center">
          CALIBRATION FREQUENCY
        </Typography>
      </Box>

      {/* Frequency Configuration Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
              <TableCell>Equipment Type</TableCell>
              <TableCell>Calibration Frequency</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : frequencyData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No equipment types configured
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              frequencyData.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {item.equipmentType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {editingId === item._id ? (
                      <Box display="flex" gap={1} alignItems="center">
                        <TextField
                          type="number"
                          value={item.frequencyValue}
                          onChange={(e) =>
                            handleFrequencyChange(
                              item._id,
                              "frequencyValue",
                              parseInt(e.target.value) || 0
                            )
                          }
                          sx={{ width: 80 }}
                          inputProps={{ min: 1, max: 999 }}
                        />
                        <FormControl sx={{ minWidth: 100 }}>
                          <Select
                            value={item.frequencyUnit}
                            onChange={(e) =>
                              handleFrequencyChange(
                                item._id,
                                "frequencyUnit",
                                e.target.value
                              )
                            }
                          >
                            <MenuItem value="months">Months</MenuItem>
                            <MenuItem value="years">Years</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                    ) : (
                      <Typography variant="body1">
                        Every {item.frequencyValue} {item.frequencyUnit}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === item._id ? (
                      <Box display="flex" gap={1}>
                        <IconButton
                          size="small"
                          onClick={() => handleSave(item._id)}
                          color="primary"
                        >
                          <SaveIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={handleCancel}
                          color="secondary"
                        >
                          <CancelIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box display="flex" gap={1}>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(item._id)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(item._id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default CalibrationFrequency;
