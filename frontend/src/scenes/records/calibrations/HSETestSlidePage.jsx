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
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import hseTestSlideService from "../../../services/hseTestSlideService";
import { useAuth } from "../../../context/AuthContext";

const HSETestSlidePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [testSlides, setTestSlides] = useState([]);
  const [testSlidesLoading, setTestSlidesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTestSlideForHistory, setSelectedTestSlideForHistory] =
    useState(null);
  const [testSlideHistory, setTestSlideHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [formData, setFormData] = useState({
    testSlideReference: "",
    testSlideEquipmentId: "",
    date: formatDateForInput(new Date()),
    calibrationCompany: "",
    certificateNumber: "",
    certificateUrl: null,
    certificate: null,
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

  // Fetch HSE Test Slide equipment
  const fetchTestSlides = useCallback(async () => {
    try {
      setTestSlidesLoading(true);
      const response = await equipmentService.getAll();
      const allEquipment = response.equipment || [];

      const hseTestSlides = allEquipment
        .filter(
          (equipment) => equipment.equipmentType === "HSE Test Slide"
        )
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      setTestSlides(hseTestSlides);
    } catch (err) {
      console.error("Error fetching test slides:", err);
      setError(err.message || "Failed to fetch test slide equipment");
    } finally {
      setTestSlidesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTestSlides();
  }, [fetchTestSlides]);

  // Listen for equipment data updates
  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchTestSlides();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchTestSlides]);

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setFormData({
      testSlideReference: "",
      testSlideEquipmentId: "",
      date: todayDate,
      calibrationCompany: "",
      certificateNumber: "",
      certificateUrl: null,
      certificate: null,
      notes: "",
    });
    setAddDialogOpen(true);
  };

  const handleEdit = (calibration) => {
    setEditingCalibration(calibration);
    const testSlideEquipment = testSlides.find(
      (ts) => ts.equipmentReference === calibration.testSlideReference
    );

    setFormData({
      testSlideReference: calibration.testSlideReference,
      testSlideEquipmentId: testSlideEquipment?._id || "",
      date: formatDateForInput(new Date(calibration.date)),
      calibrationCompany: calibration.calibrationCompany,
      certificateNumber: calibration.certificateNumber || "",
      certificateUrl: calibration.certificateUrl || null,
      certificate: null,
      notes: calibration.notes || "",
    });
    setAddDialogOpen(true);
  };

  const handleDelete = (calibration) => {
    setCalibrationToDelete(calibration);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (calibrationToDelete) {
      try {
        setLoading(true);
        await hseTestSlideService.delete(calibrationToDelete._id);
        setDeleteDialogOpen(false);
        setCalibrationToDelete(null);
        fetchTestSlides();
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
        !formData.testSlideEquipmentId ||
        !formData.date ||
        !formData.calibrationCompany
      ) {
        setError("Please fill in all required fields");
        return;
      }

      const backendData = {
        testSlideReference: formData.testSlideReference,
        date: formData.date,
        calibrationCompany: formData.calibrationCompany,
        certificateNumber: formData.certificateNumber || null,
        certificateUrl: formData.certificateUrl || null,
        notes: formData.notes || "",
        calibratedBy: currentUser._id,
      };

      if (editingCalibration) {
        await hseTestSlideService.update(editingCalibration._id, backendData);
      } else {
        await hseTestSlideService.create(backendData);
      }

      setAddDialogOpen(false);
      setEditingCalibration(null);
      fetchTestSlides();

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.testSlideEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleTestSlideChange = (testSlideEquipmentId) => {
    const selectedTestSlide = testSlides.find(
      (ts) => ts._id === testSlideEquipmentId
    );

    setFormData((prev) => ({
      ...prev,
      testSlideEquipmentId: testSlideEquipmentId,
      testSlideReference: selectedTestSlide
        ? selectedTestSlide.equipmentReference
        : "",
    }));

    setError(null);
  };

  const handleCertificate = (certificateData) => {
    if (certificateData) {
      // If it's base64 data, convert to blob and create object URL
      if (
        typeof certificateData === "string" &&
        !certificateData.startsWith("http")
      ) {
        try {
          // Convert base64 to blob
          const byteCharacters = atob(certificateData);
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
        window.open(certificateData, "_blank");
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
          certificate: file,
          certificateUrl: base64Data,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFormData({ ...formData, certificate: null, certificateUrl: null });
    }
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/list");
  };

  const handleViewHistory = async (testSlide) => {
    setSelectedTestSlideForHistory(testSlide);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setTestSlideHistory([]);

    try {
      const response = await hseTestSlideService.getByEquipment(
        testSlide.equipmentReference
      );
      const history = response.data || response || [];
      // Sort by date descending (most recent first)
      const sortedHistory = history.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
      setTestSlideHistory(sortedHistory);
    } catch (err) {
      console.error("Error fetching test slide history:", err);
      setTestSlideHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        HSE Test Slide Calibrations
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
            HSE Test Slide Calibrations
          </Typography>
        </Breadcrumbs>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* HSE Test Slide Equipment Table */}
      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          HSE Test Slide Equipment
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
              {testSlidesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : testSlides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No HSE Test Slide equipment found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                testSlides.map((testSlide) => {
                  const status = calculateStatus(testSlide);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={testSlide._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {testSlide.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>{testSlide.brandModel || "-"}</TableCell>
                      <TableCell>{testSlide.section || "-"}</TableCell>
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
                        {testSlide.lastCalibration
                          ? formatDate(testSlide.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {testSlide.calibrationDue
                          ? (() => {
                              const daysUntil = calculateDaysUntilCalibration(
                                testSlide.calibrationDue
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
                                    {formatDate(testSlide.calibrationDue)}
                                  </Typography>
                                </Box>
                              );
                            })()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleViewHistory(testSlide)}
                          size="small"
                          title="View Calibration History"
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

      {/* Add/Edit Calibration Dialog */}
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
              {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
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
                  <InputLabel>Test Slide</InputLabel>
                  <Select
                    value={formData.testSlideEquipmentId}
                    onChange={(e) => handleTestSlideChange(e.target.value)}
                    label="Test Slide"
                    disabled={testSlidesLoading}
                  >
                    <MenuItem value="">
                      <em>Select a test slide</em>
                    </MenuItem>
                    {testSlides.length > 0 ? (
                      testSlides.map((testSlide) => (
                        <MenuItem key={testSlide._id} value={testSlide._id}>
                          {testSlide.equipmentReference} -{" "}
                          {testSlide.brandModel}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        {testSlidesLoading
                          ? "Loading..."
                          : "No test slides found"}
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
                    setFormData({ ...formData, date: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Box>
              <TextField
                fullWidth
                label="Calibration Company"
                value={formData.calibrationCompany}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    calibrationCompany: e.target.value,
                  })
                }
                required
              />
              <TextField
                fullWidth
                label="Certificate Number"
                value={formData.certificateNumber}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    certificateNumber: e.target.value,
                  })
                }
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
                Attach Certificate
                <input
                  type="file"
                  hidden
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </Button>
              {formData.certificate && (
                <Typography variant="body2" color="primary">
                  File selected: {formData.certificate.name}
                </Typography>
              )}
              {editingCalibration &&
                editingCalibration.certificateUrl &&
                !formData.certificate && (
                  <Typography variant="body2" color="success.main">
                    ✓ Certificate already uploaded
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
                !formData.testSlideEquipmentId ||
                !formData.date ||
                !formData.calibrationCompany
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
          Delete HSE Test Slide Calibration
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the calibration record for test slide{" "}
            {calibrationToDelete?.testSlideReference}? This action cannot be
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

      {/* Calibration History Dialog */}
      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedTestSlideForHistory(null);
          setTestSlideHistory([]);
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
              Calibration History -{" "}
              {selectedTestSlideForHistory?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedTestSlideForHistory(null);
                setTestSlideHistory([]);
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
          ) : testSlideHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No calibration history found for this test slide.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Calibration Date</TableCell>
                    <TableCell>Calibration Company</TableCell>
                    <TableCell>Certificate Number</TableCell>
                    <TableCell>Calibrated By</TableCell>
                    <TableCell>Certificate</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {testSlideHistory.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibrationCompany || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.certificateNumber || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibratedBy?.name ||
                          (calibration.calibratedBy?.firstName &&
                          calibration.calibratedBy?.lastName
                            ? `${calibration.calibratedBy.firstName} ${calibration.calibratedBy.lastName}`
                            : "-")}
                      </TableCell>
                      <TableCell>
                        {calibration.certificateUrl ? (
                          <IconButton
                            size="small"
                            onClick={() =>
                              handleCertificate(calibration.certificateUrl)
                            }
                            title="View Certificate"
                          >
                            <PictureAsPdfIcon />
                          </IconButton>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{calibration.notes || "-"}</TableCell>
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
              setSelectedTestSlideForHistory(null);
              setTestSlideHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HSETestSlidePage;

