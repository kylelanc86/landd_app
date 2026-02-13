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
import { efaService } from "../../../services/efaService";
import userService from "../../../services/userService";

const EFAPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [calibrations, setCalibrations] = useState([]);

  // EFA equipment state
  const [efas, setEfas] = useState([]);
  const [efasLoading, setEfasLoading] = useState(false);

  // Combined data for table display
  const [tableData, setTableData] = useState([]);

  // Lab signatories state
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);

  const combineTableData = useCallback(() => {
    // Simply use the calibrations data directly since we're not combining with equipment anymore
    const combinedData = calibrations.map((calibration) => ({
      ...calibration,
      isCalibrated: true,
    }));

    // Sort by calibration date (most recent first)
    combinedData.sort((a, b) => new Date(b.date) - new Date(a.date));

    setTableData(combinedData);
  }, [calibrations]);

  // Fetch data on component mount
  useEffect(() => {
    fetchCalibrations();
    fetchEfas();
    fetchLabSignatories();
  }, []);

  // Update table data when calibrations or efas change
  useEffect(() => {
    combineTableData();
  }, [combineTableData]);

  const fetchCalibrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await efaService.getAll();
      setCalibrations(response.data || []);
    } catch (err) {
      console.error("Error fetching calibrations:", err);
      setError("Failed to load calibrations");
    } finally {
      setLoading(false);
    }
  };

  const fetchEfas = async () => {
    try {
      setEfasLoading(true);

      // Fetch Filter Holder equipment
      let response = await equipmentService.getAll({
        equipmentType: "Filter Holder",
        limit: 100,
      });

      // If no results, try without any filters to see all equipment
      if (!response.equipment || response.equipment.length === 0) {
        response = await equipmentService.getAll({
          limit: 100,
        });
      }

      // Filter for Filter Holders from the equipment array
      const filterHolderEquipment = (response.equipment || []).filter(
        (item) => item.equipmentType === "Filter Holder",
      );

      setEfas(filterHolderEquipment);
    } catch (err) {
      console.error("Error fetching Filter Holders:", err);
      setError("Failed to load Filter Holders");
    } finally {
      setEfasLoading(false);
    }
  };

  const fetchLabSignatories = async () => {
    try {
      setLabSignatoriesLoading(true);

      const response = await userService.getAll();
      const allUsers = response.data || response || [];

      // Filter users who have signatory=true OR calibration approval=true
      const labSignatoryUsers = allUsers.filter(
        (user) =>
          user.isActive &&
          (user.labSignatory === true ||
            user.labApprovals?.calibrations === true),
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
  const [filterErrors, setFilterErrors] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    date: formatDateForInput(new Date()),
    filterHolderModel: "",
    filter1Diameter1: "",
    filter1Diameter2: "",
    filter2Diameter1: "",
    filter2Diameter2: "",
    filter3Diameter1: "",
    filter3Diameter2: "",
    status: "Pass",
    technicianId: "",
    technicianName: "",
    nextCalibration: "On change of Cowl model",
  });

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setFormData({
      date: todayDate,
      filterHolderModel: "",
      filter1Diameter1: "",
      filter1Diameter2: "",
      filter2Diameter1: "",
      filter2Diameter2: "",
      filter3Diameter1: "",
      filter3Diameter2: "",
      status: "Pass",
      technicianId: "",
      technicianName: "",
      nextCalibration: "On change of Cowl model",
    });
    setOpenDialog(true);
  };

  const handleEdit = (id) => {
    const item = tableData.find((item) => item._id === id);

    if (item && item.isCalibrated) {
      const calibration = item;
      setEditingCalibration(calibration);

      // Find the technician ID by matching the technician name
      const technicianName =
        calibration.technicianName || calibration.technician || "";
      const matchingTechnician = labSignatories.find(
        (tech) => `${tech.firstName} ${tech.lastName}` === technicianName,
      );

      setFormData({
        date: formatDateForInput(calibration.date),
        filterHolderModel: calibration.filterHolderModel || "",
        filter1Diameter1: calibration.filter1Diameter1 || "",
        filter1Diameter2: calibration.filter1Diameter2 || "",
        filter2Diameter1: calibration.filter2Diameter1 || "",
        filter2Diameter2: calibration.filter2Diameter2 || "",
        filter3Diameter1: calibration.filter3Diameter1 || "",
        filter3Diameter2: calibration.filter3Diameter2 || "",
        status: calibration.status,
        technicianId: matchingTechnician?._id || calibration.technicianId || "",
        technicianName: technicianName,
        nextCalibration: "On change of Cowl model",
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
      console.log("Loading set to true, error cleared");

      // Validate form
      console.log("Starting form validation...");
      console.log("Date:", formData.date);
      console.log("Filter Holder Model:", formData.filterHolderModel);
      console.log("Technician ID:", formData.technicianId);

      if (
        !formData.date ||
        !formData.filterHolderModel ||
        !formData.technicianId
      ) {
        console.log("Validation failed:", {
          date: formData.date,
          filterHolderModel: formData.filterHolderModel,
          technicianId: formData.technicianId,
        });
        setError("Please fill in all required fields");
        setLoading(false); // Make sure to reset loading state
        return;
      }
      console.log("Basic form validation passed");

      // Validate diameter differences and set filter errors
      console.log("Validating diameter differences...");
      const diameterValidation = validateDiameterDifferences(formData);
      console.log("Diameter validation result:", diameterValidation);
      setFilterErrors(diameterValidation.errors || []);

      if (!diameterValidation.isValid) {
        console.log("Diameter validation failed");
        setError("Please fix the filter diameter errors below");
        setLoading(false); // Make sure to reset loading state
        return;
      }
      console.log("Diameter validation passed");

      console.log("Technician name:", formData.technicianName);
      if (!formData.technicianName) {
        console.log("Technician name validation failed");
        setError("Please select a technician");
        setLoading(false); // Make sure to reset loading state
        return;
      }
      console.log("Technician name validation passed");

      console.log("All validations passed, proceeding with submission");

      // Map form data to backend expected format
      const backendData = {
        filterHolderModel: formData.filterHolderModel,
        date: new Date(formData.date), // Ensure date is a Date object
        filter1Diameter1: parseFloat(formData.filter1Diameter1) || null,
        filter1Diameter2: parseFloat(formData.filter1Diameter2) || null,
        filter2Diameter1: parseFloat(formData.filter2Diameter1) || null,
        filter2Diameter2: parseFloat(formData.filter2Diameter2) || null,
        filter3Diameter1: parseFloat(formData.filter3Diameter1) || null,
        filter3Diameter2: parseFloat(formData.filter3Diameter2) || null,
        status: formData.status,
        technician: formData.technicianName, // Send technician name instead of ID
        nextCalibration: "On change of Cowl model",
        // notes: formData.notes || "", // Remove notes field if it doesn't exist in form
      };

      console.log("Backend data being sent:", backendData);

      if (editingCalibration) {
        // Update existing calibration
        console.log("Updating calibration with ID:", editingCalibration._id);
        console.log("Update data:", backendData);
        const updateResult = await efaService.update(
          editingCalibration._id,
          backendData,
        );
        console.log("Update result:", updateResult);
      } else {
        // Add new calibration
        console.log("Creating new calibration");
        const createResult = await efaService.create(backendData);
        console.log("Create result:", createResult);
      }

      console.log(
        "Update/Create successful, closing dialog and refreshing data",
      );
      setOpenDialog(false);
      setEditingCalibration(null);
      // Refresh the data
      await fetchCalibrations();
      console.log("Data refreshed successfully");
    } catch (err) {
      console.error("Error in handleSubmit:", err);
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      await efaService.delete(calibrationToDelete._id);
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
    setFilterErrors([]);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog(false);
    setCalibrationToDelete(null);
  };

  const validateDiameterDifferences = (formData) => {
    const filters = [
      {
        name: "Filter 1",
        d1: formData.filter1Diameter1,
        d2: formData.filter1Diameter2,
      },
      {
        name: "Filter 2",
        d1: formData.filter2Diameter1,
        d2: formData.filter2Diameter2,
      },
      {
        name: "Filter 3",
        d1: formData.filter3Diameter1,
        d2: formData.filter3Diameter2,
      },
    ];

    const errors = [];

    for (const filter of filters) {
      // Handle both string and number inputs
      const d1Value = filter.d1 ? filter.d1.toString() : "";
      const d2Value = filter.d2 ? filter.d2.toString() : "";

      if (
        d1Value &&
        d2Value &&
        d1Value.trim() !== "" &&
        d2Value.trim() !== ""
      ) {
        const d1 = parseFloat(d1Value);
        const d2 = parseFloat(d2Value);

        // Check for valid numbers
        if (!isNaN(d1) && !isNaN(d2)) {
          const difference = Math.abs(d1 - d2);
          console.log(
            `${filter.name}: d1=${d1}, d2=${d2}, difference=${difference}`,
          );

          if (difference > 0.5) {
            errors.push({
              filter: filter.name,
              message: `Filter Unsuitable - diameters differ by more than 0.5mm`,
            });
          }
        }
      }
    }

    console.log("Validation errors:", errors);
    return { isValid: errors.length === 0, errors };
  };

  const validateFilterAverages = (formData) => {
    // Handle both string and number inputs
    const d1_1 = formData.filter1Diameter1
      ? formData.filter1Diameter1.toString()
      : "";
    const d1_2 = formData.filter1Diameter2
      ? formData.filter1Diameter2.toString()
      : "";
    const d2_1 = formData.filter2Diameter1
      ? formData.filter2Diameter1.toString()
      : "";
    const d2_2 = formData.filter2Diameter2
      ? formData.filter2Diameter2.toString()
      : "";
    const d3_1 = formData.filter3Diameter1
      ? formData.filter3Diameter1.toString()
      : "";
    const d3_2 = formData.filter3Diameter2
      ? formData.filter3Diameter2.toString()
      : "";

    const filter1Avg =
      d1_1 && d1_2 && d1_1.trim() !== "" && d1_2.trim() !== ""
        ? (parseFloat(d1_1) + parseFloat(d1_2)) / 2
        : null;
    const filter2Avg =
      d2_1 && d2_2 && d2_1.trim() !== "" && d2_2.trim() !== ""
        ? (parseFloat(d2_1) + parseFloat(d2_2)) / 2
        : null;
    const filter3Avg =
      d3_1 && d3_2 && d3_1.trim() !== "" && d3_2.trim() !== ""
        ? (parseFloat(d3_1) + parseFloat(d3_2)) / 2
        : null;

    // Check for valid numbers
    const validFilter1Avg = filter1Avg !== null && !isNaN(filter1Avg);
    const validFilter2Avg = filter2Avg !== null && !isNaN(filter2Avg);
    const validFilter3Avg = filter3Avg !== null && !isNaN(filter3Avg);

    if (validFilter1Avg && validFilter2Avg && validFilter3Avg) {
      const averages = [filter1Avg, filter2Avg, filter3Avg];
      const min = Math.min(...averages);
      const max = Math.max(...averages);
      const difference = max - min;

      console.log(
        `Filter averages: [${averages.join(
          ", ",
        )}], min=${min}, max=${max}, difference=${difference}`,
      );

      return difference <= 0.5 ? "Pass" : "Fail";
    }
    console.log("Not all filter averages available:", {
      validFilter1Avg,
      validFilter2Avg,
      validFilter3Avg,
    });
    return "Pass"; // Default to Pass if not all averages are available
  };

  const handleTechnicianChange = (technicianId) => {
    const selectedTechnician = labSignatories.find(
      (t) => t._id === technicianId,
    );
    setFormData((prev) => ({
      ...prev,
      technicianId: technicianId,
      technicianName: selectedTechnician
        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
        : "",
    }));
  };

  const calculateStatus = (formData) => {
    // Check if filter averages are within 0.5mm of each other
    return validateFilterAverages(formData);
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations");
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        EFA Calibrations
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
          <Typography color="text.primary">EFA Calibrations</Typography>
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
            navigate("/records/laboratory/calibrations/efa/history")
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
              <TableCell>Calibration Date</TableCell>
              <TableCell>Filter Holder Model</TableCell>
              <TableCell>Avg Diameter(mm)</TableCell>
              <TableCell>Area (mm²)</TableCell>
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
            ) : tableData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No EFA calibrations found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tableData.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    {item.date ? formatDate(item.date) : "-"}
                  </TableCell>
                  <TableCell>{item.filterHolderModel || "-"}</TableCell>
                  <TableCell>
                    {(() => {
                      const filter1Avg =
                        item.filter1Diameter1 && item.filter1Diameter2
                          ? (item.filter1Diameter1 + item.filter1Diameter2) / 2
                          : null;
                      const filter2Avg =
                        item.filter2Diameter1 && item.filter2Diameter2
                          ? (item.filter2Diameter1 + item.filter2Diameter2) / 2
                          : null;
                      const filter3Avg =
                        item.filter3Diameter1 && item.filter3Diameter2
                          ? (item.filter3Diameter1 + item.filter3Diameter2) / 2
                          : null;

                      if (
                        filter1Avg !== null &&
                        filter2Avg !== null &&
                        filter3Avg !== null
                      ) {
                        const overallAvg =
                          (filter1Avg + filter2Avg + filter3Avg) / 3;
                        return `${overallAvg.toFixed(1)}`;
                      }
                      return "-";
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const filter1Avg =
                        item.filter1Diameter1 && item.filter1Diameter2
                          ? (item.filter1Diameter1 + item.filter1Diameter2) / 2
                          : null;
                      const filter2Avg =
                        item.filter2Diameter1 && item.filter2Diameter2
                          ? (item.filter2Diameter1 + item.filter2Diameter2) / 2
                          : null;
                      const filter3Avg =
                        item.filter3Diameter1 && item.filter3Diameter2
                          ? (item.filter3Diameter1 + item.filter3Diameter2) / 2
                          : null;

                      if (
                        filter1Avg !== null &&
                        filter2Avg !== null &&
                        filter3Avg !== null
                      ) {
                        const overallAvg =
                          (filter1Avg + filter2Avg + filter3Avg) / 3;
                        // Calculate area using formula: π * D² / 4
                        const area = (Math.PI * Math.pow(overallAvg, 2)) / 4;
                        return `${area.toFixed(2)}`;
                      }
                      return "-";
                    })()}
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
                    <Typography variant="body2" fontWeight="medium">
                      {item.nextCalibration || "On change of Cowl model"}
                    </Typography>
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
              <InputLabel>Filter Holder Model</InputLabel>
              <Select
                value={formData.filterHolderModel}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    filterHolderModel: e.target.value,
                  }))
                }
                label="Filter Holder Model"
              >
                <MenuItem value="">
                  <em>Select a Filter Holder Model</em>
                </MenuItem>
                {efas.length > 0 ? (
                  efas.map((efa) => (
                    <MenuItem key={efa._id} value={efa.equipmentReference}>
                      {efa.equipmentReference}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {efasLoading ? "Loading..." : "No Filter Holders found"}
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
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              required
            />
            {/* Filter Measurements */}
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Filter Measurements (mm)
            </Typography>

            {/* Filter 1 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: "60px", fontWeight: "medium" }}
              >
                Filter 1:
              </Typography>
              <TextField
                size="small"
                label="D1"
                value={formData.filter1Diameter1}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter1Diameter1: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter1Diameter1: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter1Diameter1: newValue,
                    }),
                  }));
                }}
                placeholder="25.0"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <TextField
                size="small"
                label="D2"
                value={formData.filter1Diameter2}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter1Diameter2: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter1Diameter2: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter1Diameter2: newValue,
                    }),
                  }));
                }}
                placeholder="25.2"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <Typography variant="caption" sx={{ minWidth: "80px" }}>
                Avg:{" "}
                {formData.filter1Diameter1 && formData.filter1Diameter2
                  ? (
                      (parseFloat(formData.filter1Diameter1) +
                        parseFloat(formData.filter1Diameter2)) /
                      2
                    ).toFixed(1)
                  : "-"}
              </Typography>
              {filterErrors.find((error) => error.filter === "Filter 1") && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ ml: 1, flexShrink: 0 }}
                >
                  {
                    filterErrors.find((error) => error.filter === "Filter 1")
                      .message
                  }
                </Typography>
              )}
            </Box>

            {/* Filter 2 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: "60px", fontWeight: "medium" }}
              >
                Filter 2:
              </Typography>
              <TextField
                size="small"
                label="D1"
                value={formData.filter2Diameter1}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter2Diameter1: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter2Diameter1: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter2Diameter1: newValue,
                    }),
                  }));
                }}
                placeholder="25.0"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <TextField
                size="small"
                label="D2"
                value={formData.filter2Diameter2}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter2Diameter2: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter2Diameter2: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter2Diameter2: newValue,
                    }),
                  }));
                }}
                placeholder="25.2"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <Typography variant="caption" sx={{ minWidth: "80px" }}>
                Avg:{" "}
                {formData.filter2Diameter1 && formData.filter2Diameter2
                  ? (
                      (parseFloat(formData.filter2Diameter1) +
                        parseFloat(formData.filter2Diameter2)) /
                      2
                    ).toFixed(1)
                  : "-"}
              </Typography>
              {filterErrors.find((error) => error.filter === "Filter 2") && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ ml: 1, flexShrink: 0 }}
                >
                  {
                    filterErrors.find((error) => error.filter === "Filter 2")
                      .message
                  }
                </Typography>
              )}
            </Box>

            {/* Filter 3 */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
              <Typography
                variant="body2"
                sx={{ minWidth: "60px", fontWeight: "medium" }}
              >
                Filter 3:
              </Typography>
              <TextField
                size="small"
                label="D1"
                value={formData.filter3Diameter1}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter3Diameter1: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter3Diameter1: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter3Diameter1: newValue,
                    }),
                  }));
                }}
                placeholder="25.0"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <TextField
                size="small"
                label="D2"
                value={formData.filter3Diameter2}
                onChange={(e) => {
                  const newValue = e.target.value;
                  const updatedFormData = {
                    ...formData,
                    filter3Diameter2: newValue,
                  };
                  const diameterValidation =
                    validateDiameterDifferences(updatedFormData);
                  setFilterErrors(diameterValidation.errors || []);
                  setFormData((prev) => ({
                    ...prev,
                    filter3Diameter2: newValue,
                    status: calculateStatus({
                      ...prev,
                      filter3Diameter2: newValue,
                    }),
                  }));
                }}
                placeholder="25.2"
                type="number"
                inputProps={{ step: "0.1", min: "0" }}
                sx={{ width: "80px" }}
              />
              <Typography variant="caption" sx={{ minWidth: "80px" }}>
                Avg:{" "}
                {formData.filter3Diameter1 && formData.filter3Diameter2
                  ? (
                      (parseFloat(formData.filter3Diameter1) +
                        parseFloat(formData.filter3Diameter2)) /
                      2
                    ).toFixed(1)
                  : "-"}
              </Typography>
              {filterErrors.find((error) => error.filter === "Filter 3") && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ ml: 1, flexShrink: 0 }}
                >
                  {
                    filterErrors.find((error) => error.filter === "Filter 3")
                      .message
                  }
                </Typography>
              )}
            </Box>

            {/* Overall Average */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mt: 2,
                p: 1,
                backgroundColor: theme.palette.grey[50],
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                Overall Average:
              </Typography>
              <Typography
                variant="h6"
                sx={{ color: theme.palette.primary.main }}
              >
                {(() => {
                  const filter1Avg =
                    formData.filter1Diameter1 && formData.filter1Diameter2
                      ? (parseFloat(formData.filter1Diameter1) +
                          parseFloat(formData.filter1Diameter2)) /
                        2
                      : null;
                  const filter2Avg =
                    formData.filter2Diameter1 && formData.filter2Diameter2
                      ? (parseFloat(formData.filter2Diameter1) +
                          parseFloat(formData.filter2Diameter2)) /
                        2
                      : null;
                  const filter3Avg =
                    formData.filter3Diameter1 && formData.filter3Diameter2
                      ? (parseFloat(formData.filter3Diameter1) +
                          parseFloat(formData.filter3Diameter2)) /
                        2
                      : null;

                  if (
                    filter1Avg !== null &&
                    filter2Avg !== null &&
                    filter3Avg !== null
                  ) {
                    const overallAvg =
                      (filter1Avg + filter2Avg + filter3Avg) / 3;
                    return `${overallAvg.toFixed(1)}mm`;
                  }
                  return "-";
                })()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: "medium", minWidth: "60px" }}
              >
                Status:
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color:
                    formData.status === "Fail" ? "error.main" : "success.main",
                  fontWeight: "bold",
                }}
              >
                {formData.status}
              </Typography>
            </Box>
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
              value={formData.nextCalibration}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="EFA calibration is required on change of Filter Holder model"
            />
            <TextField
              fullWidth
              label="Notes (Optional)"
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              multiline
              rows={3}
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
            Are you sure you want to delete the calibration record for Filter
            Holder Model {calibrationToDelete?.filterHolderModel}? This action
            cannot be undone.
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

export default EFAPage;
