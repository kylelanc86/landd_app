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
import EmptyIcon from "@mui/icons-material/InvertColorsOutlined";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { useAuth } from "../../../context/AuthContext";
import userService from "../../../services/userService";
import { riLiquidCalibrationService } from "../../../services/riLiquidCalibrationService";

const RiLiquidPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog and form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCalibrationId, setEditingCalibrationId] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    bottleId: "",
    date: formatDateForInput(new Date()),
    dateOpened: formatDateForInput(new Date()),
    technicianId: "",
    refractiveIndex: "",
    asbestosTypeVerified: "",
    batchNumber: "",
    status: "Pass",
    notes: "",
  });

  useEffect(() => {
    fetchData();
    fetchTechnicians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set current user as default technician when add dialog opens
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

      // Fetch all RI Liquid calibrations
      const response = await riLiquidCalibrationService.getAll({
        limit: 1000,
        sortBy: "date",
        sortOrder: "desc",
      });

      const calibrationData = response.data || [];

      // Transform data for display
      const transformedCalibrations = calibrationData.map((cal) => ({
        id: cal._id,
        _id: cal._id,
        bottleId: cal.bottleId || "",
        date: cal.date,
        refractiveIndex: cal.refractiveIndex,
        asbestosTypeVerified: cal.asbestosTypeVerified,
        dateOpened: cal.dateOpened,
        batchNumber: cal.batchNumber,
        status: cal.status,
        nextCalibration: cal.nextCalibration,
        notes: cal.notes,
        calibratedBy: cal.calibratedBy,
      }));

      // Group by bottle ID and get only the most recent calibration for each
      // Note: All calibration records are saved to the database. This grouping
      // only affects the display on this page. The history page shows all records.
      const calibrationsByBottle = {};
      transformedCalibrations.forEach((cal) => {
        const bottleId = cal.bottleId;
        if (!bottleId) return;

        // Keep the most recent calibration (by calibration date) for each bottle
        if (
          !calibrationsByBottle[bottleId] ||
          new Date(cal.date) > new Date(calibrationsByBottle[bottleId].date)
        ) {
          calibrationsByBottle[bottleId] = cal;
        }
      });

      // Convert back to array - this shows only the most recent calibration per bottle
      const mostRecentCalibrations = Object.values(calibrationsByBottle);

      setCalibrations(mostRecentCalibrations);
    } catch (error) {
      console.error("Error fetching data:", error);
      setCalibrations([]);
    } finally {
      setLoading(false);
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

  // Auto-calculate status based on refractive index and asbestos type
  const calculateStatus = (refractiveIndex, asbestosType) => {
    if (!refractiveIndex || !asbestosType) return "Pass";

    const passCombinations = [
      { refractiveIndex: 1.55, asbestosType: "Chrysotile" },
      { refractiveIndex: 1.67, asbestosType: "Amosite" },
      { refractiveIndex: 1.7, asbestosType: "Crocidolite" },
    ];

    const refractiveIndexValue = parseFloat(refractiveIndex);
    const isPass = passCombinations.some(
      (combo) =>
        Math.abs(refractiveIndexValue - combo.refractiveIndex) < 0.001 &&
        asbestosType === combo.asbestosType,
    );

    return isPass ? "Pass" : "Fail";
  };

  const handleAdd = () => {
    setFormError(null);
    setFormData({
      bottleId: "",
      date: formatDateForInput(new Date()),
      dateOpened: formatDateForInput(new Date()),
      technicianId: currentUser?._id || "",
      refractiveIndex: "",
      asbestosTypeVerified: "",
      batchNumber: "",
      status: "Pass",
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handleDialogClose = () => {
    if (!submitting) {
      setAddDialogOpen(false);
      setEditDialogOpen(false);
      setEditingCalibrationId(null);
      setFormError(null);
      setFormData({
        bottleId: "",
        date: formatDateForInput(new Date()),
        dateOpened: formatDateForInput(new Date()),
        technicianId: "",
        refractiveIndex: "",
        asbestosTypeVerified: "",
        batchNumber: "",
        status: "Pass",
        notes: "",
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
    if (!formData.bottleId || formData.bottleId.trim() === "") {
      setFormError("Please enter a bottle ID");
      return;
    }
    if (!formData.date) {
      setFormError("Please select a calibration date");
      return;
    }
    if (!formData.dateOpened) {
      setFormError("Please select a date opened");
      return;
    }
    if (!formData.technicianId) {
      setFormError("Please select a technician");
      return;
    }
    if (!formData.refractiveIndex) {
      setFormError("Please select a refractive index");
      return;
    }
    if (!formData.asbestosTypeVerified) {
      setFormError("Please select an asbestos type verified");
      return;
    }
    if (!formData.batchNumber || formData.batchNumber.trim() === "") {
      setFormError("Please enter a batch number");
      return;
    }

    try {
      setSubmitting(true);

      // Auto-calculate status
      const calculatedStatus = calculateStatus(
        formData.refractiveIndex,
        formData.asbestosTypeVerified,
      );

      const calibrationData = {
        equipmentId: formData.bottleId.trim(),
        date: formData.date,
        refractiveIndex: parseFloat(formData.refractiveIndex),
        asbestosTypeVerified: formData.asbestosTypeVerified,
        dateOpened: formData.dateOpened,
        batchNumber: formData.batchNumber.trim(),
        status: calculatedStatus,
        technicianId: formData.technicianId,
        notes: formData.notes || "",
      };

      if (editingCalibrationId) {
        // Update existing calibration
        await riLiquidCalibrationService.update(
          editingCalibrationId,
          calibrationData,
        );
      } else {
        // Create new calibration record
        // Note: This creates a NEW record in the database. If a bottle already has
        // calibration records, this new record will be added alongside the existing ones.
        // The main table will show the most recent calibration per bottle,
        // while the history page shows all records.
        await riLiquidCalibrationService.create(calibrationData);
      }

      handleDialogClose();
      // Refresh data to show updated table (new record will appear in history,
      // and main table will update to show most recent calibration per bottle)
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
      // Fetch the calibration record
      const calibration = await riLiquidCalibrationService.getById(id);

      // Handle calibratedBy - it might be an object with _id or just an _id string
      let technicianId = "";
      if (calibration.calibratedBy) {
        if (
          typeof calibration.calibratedBy === "object" &&
          calibration.calibratedBy._id
        ) {
          technicianId = calibration.calibratedBy._id;
        } else if (typeof calibration.calibratedBy === "string") {
          technicianId = calibration.calibratedBy;
        }
      }

      // Populate form with existing data
      setFormData({
        bottleId: calibration.bottleId || "",
        date: formatDateForInput(new Date(calibration.date)),
        dateOpened: calibration.dateOpened
          ? formatDateForInput(new Date(calibration.dateOpened))
          : formatDateForInput(new Date()),
        technicianId: technicianId,
        refractiveIndex: calibration.refractiveIndex?.toString() || "",
        asbestosTypeVerified: calibration.asbestosTypeVerified || "",
        batchNumber: calibration.batchNumber || "",
        status: calibration.status || "Pass",
        notes: calibration.notes || "",
      });

      setEditingCalibrationId(id);
      setFormError(null);
      setEditDialogOpen(true);
    } catch (error) {
      console.error("Error fetching calibration for edit:", error);
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to load calibration data",
      );
    }
  };

  const handleMarkAsEmpty = async (bottleId) => {
    if (
      !window.confirm(
        `Are you sure you want to mark bottle "${bottleId}" as empty? This will remove it from the active bottles table.`,
      )
    ) {
      return;
    }

    try {
      await riLiquidCalibrationService.markBottleAsEmpty(bottleId);
      fetchData();
    } catch (error) {
      console.error("Error marking bottle as empty:", error);
      alert(
        error.response?.data?.message ||
          error.message ||
          "Failed to mark bottle as empty",
      );
    }
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
      await riLiquidCalibrationService.delete(id);
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
    // Navigate to history page for this bottle
    const bottleId = calibration.bottleId;
    if (bottleId) {
      navigate(`/records/laboratory/calibrations/ri-liquid/${bottleId}`);
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
          RI Liquid Calibrations
        </Typography>
      </Box>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Typography variant="h5" component="h2">
          Active RI Liquid Bottles
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<HistoryIcon />}
            onClick={() =>
              navigate("/records/laboratory/calibrations/ri-liquid/history")
            }
          >
            Historical Records
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Calibration
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Bottle ID</TableCell>
                <TableCell>Date Opened</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next Calibration Due</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calibrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No calibrations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                calibrations.map((calibration) => {
                  return (
                    <TableRow key={calibration.id || calibration._id}>
                      <TableCell>{calibration.bottleId}</TableCell>
                      <TableCell>
                        {calibration.dateOpened
                          ? formatDate(calibration.dateOpened)
                          : "-"}
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
                          title="Edit Calibration"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() =>
                            handleMarkAsEmpty(calibration.bottleId)
                          }
                          size="small"
                          title="Mark Bottle as Empty"
                          sx={{ color: theme.palette.warning.main }}
                        >
                          <EmptyIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(calibration.id)}
                          size="small"
                          title="Delete Calibration"
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

      {/* Add/Edit Calibration Dialog */}
      <Dialog
        open={addDialogOpen || editDialogOpen}
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
            <Typography variant="h6">
              {editingCalibrationId
                ? "Edit Calibration"
                : "Add New Calibration"}
            </Typography>
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
              <TextField
                fullWidth
                label="Bottle ID"
                value={formData.bottleId}
                onChange={(e) =>
                  setFormData({ ...formData, bottleId: e.target.value })
                }
                placeholder="Enter bottle ID"
                required
                disabled={submitting}
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

              <FormControl fullWidth required>
                <InputLabel>Refractive Index</InputLabel>
                <Select
                  value={formData.refractiveIndex}
                  onChange={(e) => {
                    const newRefractiveIndex = e.target.value;
                    const newStatus = calculateStatus(
                      newRefractiveIndex,
                      formData.asbestosTypeVerified,
                    );
                    setFormData({
                      ...formData,
                      refractiveIndex: newRefractiveIndex,
                      status: newStatus,
                    });
                  }}
                  label="Refractive Index"
                  disabled={submitting}
                >
                  <MenuItem value="">
                    <em>Select refractive index</em>
                  </MenuItem>
                  <MenuItem value="1.55">1.55</MenuItem>
                  <MenuItem value="1.67">1.67</MenuItem>
                  <MenuItem value="1.70">1.70</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Asbestos Type Verified</InputLabel>
                <Select
                  value={formData.asbestosTypeVerified}
                  onChange={(e) => {
                    const newAsbestosType = e.target.value;
                    const newStatus = calculateStatus(
                      formData.refractiveIndex,
                      newAsbestosType,
                    );
                    setFormData({
                      ...formData,
                      asbestosTypeVerified: newAsbestosType,
                      status: newStatus,
                    });
                  }}
                  label="Asbestos Type Verified"
                  disabled={submitting}
                >
                  <MenuItem value="">
                    <em>Select asbestos type</em>
                  </MenuItem>
                  <MenuItem value="Chrysotile">Chrysotile</MenuItem>
                  <MenuItem value="Amosite">Amosite</MenuItem>
                  <MenuItem value="Crocidolite">Crocidolite</MenuItem>
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
                    label="Date Opened"
                    type="date"
                    value={formData.dateOpened}
                    onChange={(e) =>
                      setFormData({ ...formData, dateOpened: e.target.value })
                    }
                    InputLabelProps={{ shrink: true }}
                    required
                    disabled={submitting}
                    sx={{ mr: 1 }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        dateOpened: formatDateForInput(new Date()),
                      }));
                    }}
                    disabled={submitting}
                    sx={{ ml: 1, minWidth: "100px" }}
                  >
                    Today
                  </Button>
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Batch Number"
                value={formData.batchNumber}
                onChange={(e) =>
                  setFormData({ ...formData, batchNumber: e.target.value })
                }
                placeholder="Enter batch number"
                required
                disabled={submitting}
              />

              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  disabled={true}
                  sx={{
                    "& .MuiSelect-select": {
                      backgroundColor:
                        formData.status === "Pass"
                          ? theme.palette.success.light
                          : theme.palette.error.light,
                      color: "white",
                      fontWeight: "bold",
                    },
                  }}
                >
                  <MenuItem value="Pass">Pass</MenuItem>
                  <MenuItem value="Fail">Fail</MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5 }}
                >
                  Status is automatically calculated based on Refractive Index
                  and Asbestos Type
                </Typography>
              </FormControl>

              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                disabled={submitting}
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
              startIcon={
                submitting ? null : editingCalibrationId ? null : <AddIcon />
              }
            >
              {submitting ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  Saving...
                </Box>
              ) : editingCalibrationId ? (
                "Update Calibration"
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

export default RiLiquidPage;
