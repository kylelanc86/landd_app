import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  TablePagination,
  Divider,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useNavigate, useParams } from "react-router-dom";
import { airPumpCalibrationService } from "../../../services/airPumpCalibrationService";
import airPumpService from "../../../services/airPumpService";

const AirPumpCalibrationPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pumpId } = useParams();

  const [calibrations, setCalibrations] = useState([]);
  const [pump, setPump] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    calibrationDate: new Date().toISOString().split("T")[0],
    notes: "",
    testResults: [],
  });

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Test result form
  const [testResult, setTestResult] = useState({
    setFlowrate: "",
    actualFlowrate: "",
  });

  const setFlowrateOptions = [1000, 1500, 2000, 3000, 4000];

  useEffect(() => {
    if (pumpId) {
      loadData();
    }
  }, [pumpId, page, rowsPerPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load pump details
      const pumpData = await airPumpService.getById(pumpId);
      setPump(pumpData);

      // Load calibrations
      const calibrationsData =
        await airPumpCalibrationService.getPumpCalibrations(
          pumpId,
          page + 1,
          rowsPerPage
        );
      setCalibrations(calibrationsData.data);
      setTotal(calibrationsData.pagination.total);

      // Load statistics
      const statsData = await airPumpCalibrationService.getPumpCalibrationStats(
        pumpId
      );
      setStats(statsData);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTestResult = () => {
    if (testResult.setFlowrate && testResult.actualFlowrate) {
      const percentError = Math.abs(
        ((testResult.actualFlowrate - testResult.setFlowrate) /
          testResult.setFlowrate) *
          100
      );
      const passed = percentError < 5;

      const newTestResult = {
        setFlowrate: parseInt(testResult.setFlowrate),
        actualFlowrate: parseFloat(testResult.actualFlowrate),
        percentError,
        passed,
      };

      setFormData((prev) => ({
        ...prev,
        testResults: [...prev.testResults, newTestResult],
      }));

      setTestResult({ setFlowrate: "", actualFlowrate: "" });
    }
  };

  const handleRemoveTestResult = (index) => {
    setFormData((prev) => ({
      ...prev,
      testResults: prev.testResults.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    try {
      if (formData.testResults.length === 0) {
        setError("At least one test result is required");
        return;
      }

      const calibrationData = {
        pumpId,
        calibrationDate: formData.calibrationDate,
        notes: formData.notes,
        testResults: formData.testResults,
      };

      if (editingCalibration) {
        await airPumpCalibrationService.updateCalibration(
          editingCalibration._id,
          calibrationData
        );
      } else {
        await airPumpCalibrationService.createCalibration(calibrationData);
      }

      setOpenDialog(false);
      setEditingCalibration(null);
      setFormData({
        calibrationDate: new Date().toISOString().split("T")[0],
        notes: "",
        testResults: [],
      });
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    }
  };

  const handleEdit = (calibration) => {
    setEditingCalibration(calibration);
    setFormData({
      calibrationDate: new Date(calibration.calibrationDate)
        .toISOString()
        .split("T")[0],
      notes: calibration.notes || "",
      testResults: calibration.testResults,
    });
    setOpenDialog(true);
  };

  const handleDelete = async () => {
    try {
      await airPumpCalibrationService.deleteCalibration(
        calibrationToDelete._id
      );
      setDeleteDialog(false);
      setCalibrationToDelete(null);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete calibration");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-GB");
  };

  const getResultColor = (result) => {
    return result === "Pass" ? "success" : "error";
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton
          onClick={() => navigate("/records/laboratory/calibrations/air-pump")}
          sx={{ mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Air Pump Calibrations
        </Typography>
      </Box>

      {/* Pump Info */}
      {pump && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {pump.pumpReference} - {pump.pumpDetails}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Status: {pump.status} | Last Calibrated:{" "}
              {pump.calibrationDate
                ? formatDate(pump.calibrationDate)
                : "Never"}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h6">Calibration Records</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenDialog(true)}
        >
          Add Calibration
        </Button>
      </Box>

      {/* Calibrations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Date
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Calibrated By
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Tests
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Result
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Avg Error
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Next Due
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calibrations.map((calibration) => (
              <TableRow key={calibration._id} hover>
                <TableCell>{formatDate(calibration.calibrationDate)}</TableCell>
                <TableCell>
                  {calibration.calibratedBy?.firstName}{" "}
                  {calibration.calibratedBy?.lastName}
                </TableCell>
                <TableCell>
                  {calibration.testsPassed}/{calibration.totalTests} passed
                </TableCell>
                <TableCell>
                  <Chip
                    label={calibration.overallResult}
                    color={getResultColor(calibration.overallResult)}
                    size="small"
                    icon={
                      calibration.overallResult === "Pass" ? (
                        <CheckCircleIcon />
                      ) : (
                        <CancelIcon />
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  {calibration.averagePercentError?.toFixed(2)}%
                </TableCell>
                <TableCell>
                  {formatDate(calibration.nextCalibrationDue)}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleEdit(calibration)}
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCalibrationToDelete(calibration);
                      setDeleteDialog(true);
                    }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Calibration Date"
                type="date"
                value={formData.calibrationDate}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    calibrationDate: e.target.value,
                  }))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Test Results
              </Typography>

              {/* Add Test Result Form */}
              <Box display="flex" gap={2} mb={2}>
                <FormControl sx={{ minWidth: 150 }}>
                  <InputLabel>Set Flowrate</InputLabel>
                  <Select
                    value={testResult.setFlowrate}
                    onChange={(e) =>
                      setTestResult((prev) => ({
                        ...prev,
                        setFlowrate: e.target.value,
                      }))
                    }
                    label="Set Flowrate"
                  >
                    {setFlowrateOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Actual Flowrate"
                  type="number"
                  value={testResult.actualFlowrate}
                  onChange={(e) =>
                    setTestResult((prev) => ({
                      ...prev,
                      actualFlowrate: e.target.value,
                    }))
                  }
                  sx={{ minWidth: 150 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddTestResult}
                  disabled={
                    !testResult.setFlowrate || !testResult.actualFlowrate
                  }
                >
                  Add Test
                </Button>
              </Box>

              {/* Test Results Table */}
              {formData.testResults.length > 0 && (
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Set Flowrate</TableCell>
                        <TableCell>Actual Flowrate</TableCell>
                        <TableCell>% Error</TableCell>
                        <TableCell>Result</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.testResults.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.setFlowrate}</TableCell>
                          <TableCell>{result.actualFlowrate}</TableCell>
                          <TableCell>
                            {result.percentError.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={result.passed ? "Pass" : "Fail"}
                              color={result.passed ? "success" : "error"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveTestResult(index)}
                              color="error"
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
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCalibration ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this calibration record? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AirPumpCalibrationPage;
