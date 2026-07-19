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
import LookupField from "../../../components/LookupField";
import { userOptionsFromList } from "../../../utils/lookupOptions";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const RiLiquidPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [calibrations, setCalibrations] = useState([]);
  const [activeBottles, setActiveBottles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog and form state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bottleDialogOpen, setBottleDialogOpen] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [bottleFormError, setBottleFormError] = useState(null);
  const [bottleSubmitting, setBottleSubmitting] = useState(false);
  const [bottleFormData, setBottleFormData] = useState({
    refractiveIndex: "",
    batchNumber: "",
    dateOpened: formatDateForInput(new Date()),
  });

  const [formData, setFormData] = useState({
    bottleId: "",
    date: formatDateForInput(new Date()),
    dateOpened: formatDateForInput(new Date()),
    technicianId: "",
    technicianName: "",
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
          technicianName:
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim(),
        }));
      }
    }
  }, [addDialogOpen, currentUser, technicians]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const response = await riLiquidCalibrationService.getActiveBottles();
      const bottleData = response.data || [];

      setActiveBottles(bottleData);
      setCalibrations(
        bottleData.map((bottle) => {
          const latest = bottle.latestCalibration || {};
          return {
            id: latest._id || null,
            _id: latest._id || null,
            bottleId: bottle.bottleId,
            date: latest.date || null,
            refractiveIndex: bottle.refractiveIndex,
            asbestosTypeVerified: latest.asbestosTypeVerified,
            dateOpened: bottle.dateOpened,
            batchNumber: bottle.batchNumber,
            status: latest.status || null,
            nextCalibration: latest.nextCalibration || null,
            notes: latest.notes || "",
            calibratedBy: latest.calibratedBy || null,
          };
        }),
      );
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
    setEditingCalibration(null);
    setIsEditMode(true);
    setFormError(null);
    setFormData({
      bottleId: "",
      date: formatDateForInput(new Date()),
      dateOpened: formatDateForInput(new Date()),
      technicianId: currentUser?._id || "",
      technicianName: currentUser
        ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
        : "",
      refractiveIndex: "",
      asbestosTypeVerified: "",
      batchNumber: "",
      status: "Pass",
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handleOpenBottleDialog = () => {
    setBottleFormError(null);
    setBottleFormData({
      refractiveIndex: "",
      batchNumber: "",
      dateOpened: formatDateForInput(new Date()),
    });
    setBottleDialogOpen(true);
  };

  const handleBottleDialogClose = () => {
    if (!bottleSubmitting) {
      setBottleDialogOpen(false);
      setBottleFormError(null);
    }
  };

  const handleCreateBottle = async (event) => {
    event.preventDefault();
    setBottleFormError(null);

    if (
      !bottleFormData.refractiveIndex ||
      !bottleFormData.batchNumber.trim() ||
      !bottleFormData.dateOpened
    ) {
      setBottleFormError(
        "Refractive index, batch number, and date opened are required",
      );
      return;
    }

    try {
      setBottleSubmitting(true);
      await riLiquidCalibrationService.createBottle({
        refractiveIndex: Number(bottleFormData.refractiveIndex),
        batchNumber: bottleFormData.batchNumber.trim(),
        dateOpened: bottleFormData.dateOpened,
      });
      await fetchData();
      setBottleDialogOpen(false);
    } catch (error) {
      console.error("Error creating RI Liquid bottle:", error);
      setBottleFormError(
        error.response?.data?.message ||
          error.message ||
          "Failed to create RI Liquid bottle",
      );
    } finally {
      setBottleSubmitting(false);
    }
  };

  const handleDialogClose = () => {
    if (!submitting) {
      setAddDialogOpen(false);
      setEditingCalibration(null);
      setIsEditMode(false);
      setFormError(null);
      setFormData({
        bottleId: "",
        date: formatDateForInput(new Date()),
        dateOpened: formatDateForInput(new Date()),
        technicianId: "",
        technicianName: "",
        refractiveIndex: "",
        asbestosTypeVerified: "",
        batchNumber: "",
        status: "Pass",
        notes: "",
      });
    }
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

  const handleBottleChange = (bottleId) => {
    const bottle = activeBottles.find(
      (item) => item.bottleId === bottleId,
    );
    setFormData((prev) => ({
      ...prev,
      bottleId,
      refractiveIndex: bottle ? String(bottle.refractiveIndex) : "",
      batchNumber: bottle?.batchNumber || "",
      dateOpened: bottle?.dateOpened
        ? formatDateForInput(new Date(bottle.dateOpened))
        : "",
      status: calculateStatus(
        bottle?.refractiveIndex,
        prev.asbestosTypeVerified,
      ),
    }));
  };

  const populateFormFromCalibration = (calibration) => {
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
      bottleId: calibration.bottleId || "",
      date: formatDateForInput(new Date(calibration.date)),
      dateOpened: calibration.dateOpened
        ? formatDateForInput(new Date(calibration.dateOpened))
        : formatDateForInput(new Date()),
      technicianId,
      technicianName,
      refractiveIndex: calibration.refractiveIndex?.toString() || "",
      asbestosTypeVerified: calibration.asbestosTypeVerified || "",
      batchNumber: calibration.batchNumber || "",
      status: calibration.status || "Pass",
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
    if (!formData.bottleId || formData.bottleId.trim() === "") {
      setFormError("Please select an active bottle");
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
    if (!formData.asbestosTypeVerified) {
      setFormError("Please select an asbestos type verified");
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
        bottleId: formData.bottleId.trim(),
        date: formData.date,
        asbestosTypeVerified: formData.asbestosTypeVerified,
        status: calculatedStatus,
        technicianId: formData.technicianId,
        notes: formData.notes || "",
      };

      if (editingCalibration) {
        await riLiquidCalibrationService.update(
          editingCalibration._id,
          {
            ...calibrationData,
            refractiveIndex: parseFloat(formData.refractiveIndex),
            dateOpened: formData.dateOpened,
            batchNumber: formData.batchNumber.trim(),
          },
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
      const calibration = await riLiquidCalibrationService.getById(id);
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
      navigate(
        `/records/laboratory/calibrations/ri-liquid/${encodeURIComponent(bottleId)}`,
      );
    }
  };


  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="RI Liquid Calibrations"
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        action={
          <Box display="flex" gap={2} flexWrap="wrap">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<HistoryIcon />}
              onClick={() =>
                navigate("/records/laboratory/calibrations/ri-liquid/history")
              }
            >
              Historical Records - Empty Bottles
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleOpenBottleDialog}
            >
              New RI Liquid Bottle
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
            >
              Add Calibration
            </Button>
          </Box>
        }
      />
      <Box mb="20px">
        <Typography variant="h6" component="h2">
          Active RI Liquid Bottles
        </Typography>
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
                <TableCell>Calibration Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next Calibration Due</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calibrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No active RI Liquid bottles found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                calibrations.map((calibration) => {
                  return (
                    <TableRow key={calibration.bottleId}>
                      <TableCell>{calibration.bottleId}</TableCell>
                      <TableCell>
                        {calibration.dateOpened
                          ? formatDate(calibration.dateOpened)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.date
                          ? formatDate(calibration.date)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.status ? (
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
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {calibration.nextCalibration
                          ? formatDate(calibration.nextCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.id && (
                          <IconButton
                            onClick={() => handleViewHistory(calibration)}
                            size="small"
                            title="View Calibration History"
                            sx={{ color: theme.palette.info.main }}
                          >
                            <HistoryIcon />
                          </IconButton>
                        )}
                        {calibration.id && (
                          <IconButton
                            onClick={() => handleEdit(calibration.id)}
                            size="small"
                            title="Edit Calibration"
                          >
                            <EditIcon />
                          </IconButton>
                        )}
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
                        {calibration.id && (
                          <IconButton
                            onClick={() => handleDelete(calibration.id)}
                            size="small"
                            title="Delete Calibration"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* New RI Liquid Bottle Dialog */}
      <Dialog
        open={bottleDialogOpen}
        onClose={handleBottleDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">New RI Liquid Bottle</Typography>
            <IconButton
              onClick={handleBottleDialogClose}
              disabled={bottleSubmitting}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleCreateBottle}>
          <DialogContent>
            {bottleFormError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {bottleFormError}
              </Alert>
            )}
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Refractive Index</InputLabel>
                <Select
                  value={bottleFormData.refractiveIndex}
                  onChange={(event) =>
                    setBottleFormData((prev) => ({
                      ...prev,
                      refractiveIndex: event.target.value,
                    }))
                  }
                  label="Refractive Index"
                  disabled={bottleSubmitting}
                >
                  <MenuItem value="">
                    <em>Select refractive index</em>
                  </MenuItem>
                  <MenuItem value="1.55">1.55</MenuItem>
                  <MenuItem value="1.67">1.67</MenuItem>
                  <MenuItem value="1.70">1.70</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                required
                label="Batch Number"
                value={bottleFormData.batchNumber}
                onChange={(event) =>
                  setBottleFormData((prev) => ({
                    ...prev,
                    batchNumber: event.target.value,
                  }))
                }
                disabled={bottleSubmitting}
              />
              <Box display="flex" alignItems="center" gap={2}>
                <TextField
                  fullWidth
                  required
                  label="Date Opened"
                  type="date"
                  value={bottleFormData.dateOpened}
                  onChange={(event) =>
                    setBottleFormData((prev) => ({
                      ...prev,
                      dateOpened: event.target.value,
                    }))
                  }
                  InputLabelProps={{ shrink: true }}
                  disabled={bottleSubmitting}
                />
                <Button
                  variant="outlined"
                  onClick={() =>
                    setBottleFormData((prev) => ({
                      ...prev,
                      dateOpened: formatDateForInput(new Date()),
                    }))
                  }
                  disabled={bottleSubmitting}
                  sx={{ minWidth: "100px" }}
                >
                  Today
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary">
                The Bottle ID will be generated automatically using the
                refractive index and next available number.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={handleBottleDialogClose}
              disabled={bottleSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={bottleSubmitting}
              startIcon={bottleSubmitting ? null : <AddIcon />}
            >
              {bottleSubmitting ? "Creating..." : "Create Bottle"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Add/Edit Calibration Dialog */}
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
              {editingCalibration ? (
                <TextField
                  fullWidth
                  label="Bottle ID"
                  value={formData.bottleId}
                  disabled
                />
              ) : (
                <FormControl fullWidth required>
                  <InputLabel>Active Bottle ID</InputLabel>
                  <Select
                    value={formData.bottleId}
                    onChange={(event) =>
                      handleBottleChange(event.target.value)
                    }
                    label="Active Bottle ID"
                    disabled={submitting}
                  >
                    <MenuItem value="">
                      <em>Select an active bottle</em>
                    </MenuItem>
                    {activeBottles.map((bottle) => (
                      <MenuItem
                        key={bottle.bottleId}
                        value={bottle.bottleId}
                      >
                        {bottle.bottleId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {formData.bottleId && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Refractive Index
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {Number(formData.refractiveIndex).toFixed(2)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Batch Number
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    {formData.batchNumber || "-"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Date Opened
                  </Typography>
                  <Typography variant="body1">
                    {formData.dateOpened
                      ? formatDate(formData.dateOpened)
                      : "-"}
                  </Typography>
                </Paper>
              )}

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
                  disabled={submitting || lookupViewMode}
                >
                  <MenuItem value="">
                    <em>Select asbestos type</em>
                  </MenuItem>
                  <MenuItem value="Chrysotile">Chrysotile</MenuItem>
                  <MenuItem value="Amosite">Amosite</MenuItem>
                  <MenuItem value="Crocidolite">Crocidolite</MenuItem>
                </Select>
              </FormControl>

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
                disabled={submitting || lookupViewMode}
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

export default RiLiquidPage;
