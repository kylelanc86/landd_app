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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import HomeIcon from "@mui/icons-material/Home";
import { formatDate } from "../../../utils/dateFormat";
import { formatDateForInput } from "../../../utils/dateFormat";
import pcmMicroscopeService from "../../../services/pcmMicroscopeService";
import { efaService } from "../../../services/efaService";
import { useAuth } from "../../../context/AuthContext";

const MicroscopePage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [calibrations, setCalibrations] = useState([]);
  const [microscopes, setMicroscopes] = useState([]);
  const [graticules, setGraticules] = useState([]);
  const [efaCalibrations, setEfaCalibrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [formData, setFormData] = useState({
    date: formatDateForInput(new Date()),
    microscopeReference: "",
    servicingCompany: "",
    graticule: "",
    graticuleArea: "",
    constant25mm: "",
    constant13mm: "",
    serviceReport: null,
    serviceReportUrl: null,
    notes: "",
  });

  useEffect(() => {
    fetchCalibrations();
    fetchMicroscopes();
    fetchGraticules();
    fetchEfaCalibrations();
  }, []);

  const fetchCalibrations = async () => {
    try {
      setLoading(true);
      const data = await pcmMicroscopeService.getAll();
      setCalibrations(data);
    } catch (err) {
      setError(err.message || "Failed to fetch calibrations");
    } finally {
      setLoading(false);
    }
  };

  const fetchMicroscopes = async () => {
    try {
      const data = await pcmMicroscopeService.getEquipment();
      setMicroscopes(data);
    } catch (err) {
      console.error("Failed to fetch microscopes:", err);
    }
  };

  const fetchGraticules = async () => {
    try {
      const data = await pcmMicroscopeService.getGraticules();
      setGraticules(data);
    } catch (err) {
      console.error("Failed to fetch graticules:", err);
    }
  };

  const fetchEfaCalibrations = async () => {
    try {
      const response = await efaService.getAll();
      setEfaCalibrations(response.data || []);
    } catch (err) {
      console.error("Failed to fetch EFA calibrations:", err);
    }
  };

  // Calculate constants based on EFA areas and graticule area
  const calculateConstants = (graticuleArea) => {
    if (!graticuleArea || isNaN(graticuleArea)) {
      return { constant25mm: "", constant13mm: "" };
    }

    // Get latest EFA calibrations for 25mm and 13mm filter holders
    const getLatestEfaArea = (filterSize) => {
      const latestEfa = efaCalibrations
        .filter(
          (cal) =>
            cal.filterHolderModel &&
            cal.filterHolderModel.toLowerCase().includes(filterSize)
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (!latestEfa) return null;

      // Calculate area from the EFA calibration data (same logic as in EFAPage)
      const filter1Avg =
        latestEfa.filter1Diameter1 && latestEfa.filter1Diameter2
          ? (latestEfa.filter1Diameter1 + latestEfa.filter1Diameter2) / 2
          : null;
      const filter2Avg =
        latestEfa.filter2Diameter1 && latestEfa.filter2Diameter2
          ? (latestEfa.filter2Diameter1 + latestEfa.filter2Diameter2) / 2
          : null;
      const filter3Avg =
        latestEfa.filter3Diameter1 && latestEfa.filter3Diameter2
          ? (latestEfa.filter3Diameter1 + latestEfa.filter3Diameter2) / 2
          : null;

      if (filter1Avg !== null && filter2Avg !== null && filter3Avg !== null) {
        const overallAvg = (filter1Avg + filter2Avg + filter3Avg) / 3;
        // Calculate area using formula: π * D² / 4
        return (Math.PI * Math.pow(overallAvg, 2)) / 4;
      }
      return null;
    };

    const efaArea25mm = getLatestEfaArea("25");
    const efaArea13mm = getLatestEfaArea("13");

    // Convert graticule area from µm² to mm² (divide by 1,000,000)
    const graticuleAreaInMm = graticuleArea / 1000000;

    // Calculate constants (round to whole numbers)
    const constant25mm = efaArea25mm
      ? Math.round(efaArea25mm / graticuleAreaInMm)
      : "";
    const constant13mm = efaArea13mm
      ? Math.round(efaArea13mm / graticuleAreaInMm)
      : "";

    return { constant25mm, constant13mm };
  };

  const handleAdd = () => {
    setEditingCalibration(null);
    setFormData({
      date: formatDateForInput(new Date()),
      microscopeReference: "",
      servicingCompany: "",
      graticule: "",
      graticuleArea: "",
      constant25mm: "",
      constant13mm: "",
      serviceReport: null,
      serviceReportUrl: null,
      notes: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (calibration) => {
    setEditingCalibration(calibration);
    setFormData({
      date: formatDateForInput(new Date(calibration.date)),
      microscopeReference: calibration.microscopeReference,
      servicingCompany: calibration.servicingCompany,
      graticule: calibration.graticule,
      graticuleArea: calibration.graticuleArea
        ? calibration.graticuleArea.toString()
        : "",
      constant25mm: calibration.constant25mm
        ? calibration.constant25mm.toString()
        : "",
      constant13mm: calibration.constant13mm
        ? calibration.constant13mm.toString()
        : "",
      serviceReport: null,
      serviceReportUrl: calibration.serviceReportUrl || null,
      notes: calibration.notes || "",
    });
    setOpenDialog(true);
  };

  const handleDelete = (calibration) => {
    setCalibrationToDelete(calibration);
    setDeleteDialog(true);
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

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("Form data:", formData);
      console.log("Current user:", currentUser);

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      const backendData = {
        microscopeReference: formData.microscopeReference,
        date: formData.date,
        servicingCompany: formData.servicingCompany,
        graticule: formData.graticule,
        graticuleArea: formData.graticuleArea
          ? parseFloat(formData.graticuleArea)
          : null,
        constant25mm: parseFloat(formData.constant25mm),
        constant13mm: parseFloat(formData.constant13mm),
        serviceReportUrl: formData.serviceReportUrl || null,
        notes: formData.notes || "",
        calibratedBy: currentUser._id,
      };

      console.log("Backend data:", backendData);

      if (editingCalibration) {
        console.log("Updating calibration:", editingCalibration._id);
        await pcmMicroscopeService.update(editingCalibration._id, backendData);
      } else {
        console.log("Creating new calibration");
        await pcmMicroscopeService.create(backendData);
      }

      await fetchCalibrations();
      handleCloseDialog();
    } catch (err) {
      console.error("Error saving calibration:", err);
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      await pcmMicroscopeService.delete(calibrationToDelete._id);
      setDeleteDialog(false);
      setCalibrationToDelete(null);
      await fetchCalibrations();
    } catch (err) {
      setError(err.message || "Failed to delete calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleServiceReport = (serviceReportData) => {
    if (serviceReportData) {
      // If it's base64 data, convert to blob and create object URL
      if (
        typeof serviceReportData === "string" &&
        !serviceReportData.startsWith("http")
      ) {
        try {
          // Convert base64 to blob
          const byteCharacters = atob(serviceReportData);
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
        window.open(serviceReportData, "_blank");
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
          serviceReport: file,
          serviceReportUrl: base64Data,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setFormData({ ...formData, serviceReport: null, serviceReportUrl: null });
    }
  };

  return (
    <Box m="20px">
      {/* Breadcrumbs */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          Home
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/records"
          onClick={(e) => {
            e.preventDefault();
            navigate("/records");
          }}
        >
          Records
        </Link>
        <Link
          underline="hover"
          color="inherit"
          href="/records/calibrations"
          onClick={(e) => {
            e.preventDefault();
            navigate("/records/calibrations");
          }}
        >
          Calibrations
        </Link>
        <Typography color="text.primary">PCM Microscope</Typography>
      </Breadcrumbs>

      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/records/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          PCM Microscope Calibrations
        </Typography>
      </Box>

      {error && (
        <Box mb={2}>
          <Typography color="error">{error}</Typography>
        </Box>
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
              <TableCell>Date</TableCell>
              <TableCell>Equipment Reference</TableCell>
              <TableCell>Servicing Company</TableCell>
              <TableCell>Graticule</TableCell>
              <TableCell>Constant (25mm)</TableCell>
              <TableCell>Constant (13mm)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : calibrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No calibration records found. Click "Add Calibration" to add
                    a new entry.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              calibrations.map((calibration) => (
                <TableRow key={calibration._id}>
                  <TableCell>{formatDate(calibration.date)}</TableCell>
                  <TableCell>{calibration.microscopeReference}</TableCell>
                  <TableCell>{calibration.servicingCompany}</TableCell>
                  <TableCell>{calibration.graticule}</TableCell>
                  <TableCell>{calibration.constant25mm}</TableCell>
                  <TableCell>{calibration.constant13mm}</TableCell>
                  <TableCell>
                    {calibration.serviceReportUrl && (
                      <IconButton
                        size="small"
                        onClick={() =>
                          handleServiceReport(calibration.serviceReportUrl)
                        }
                        sx={{ mr: 1 }}
                        title="View Service Report"
                      >
                        <PictureAsPdfIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(calibration)}
                      sx={{ mr: 1 }}
                      title="Edit"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(calibration)}
                      color="error"
                      title="Delete"
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

      {/* Add/Edit Calibration Dialog */}
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
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Equipment Reference</InputLabel>
              <Select
                value={formData.microscopeReference}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    microscopeReference: e.target.value,
                  })
                }
                label="Equipment Reference"
              >
                {microscopes.map((microscope) => (
                  <MenuItem
                    key={microscope._id}
                    value={microscope.equipmentReference}
                  >
                    {microscope.equipmentReference} - {microscope.brandModel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Servicing Company"
              value={formData.servicingCompany}
              onChange={(e) =>
                setFormData({ ...formData, servicingCompany: e.target.value })
              }
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Graticule</InputLabel>
              <Select
                value={formData.graticule}
                onChange={(e) => {
                  const selectedGraticule = graticules.find(
                    (g) => g.equipmentReference === e.target.value
                  );
                  const graticuleArea =
                    selectedGraticule?.latestCalibration?.area || "";
                  const constants = calculateConstants(graticuleArea);

                  setFormData({
                    ...formData,
                    graticule: e.target.value,
                    graticuleArea: graticuleArea.toString(),
                    constant25mm: constants.constant25mm.toString(),
                    constant13mm: constants.constant13mm.toString(),
                  });
                }}
                label="Graticule"
              >
                {graticules.map((graticule) => (
                  <MenuItem
                    key={graticule._id}
                    value={graticule.equipmentReference}
                  >
                    {graticule.equipmentReference} - {graticule.brandModel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Constant 25mm"
              type="number"
              value={formData.constant25mm}
              onChange={(e) =>
                setFormData({ ...formData, constant25mm: e.target.value })
              }
              helperText="Latest EFA area (25mm) ÷ Graticule area"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Constant 13mm"
              type="number"
              value={formData.constant13mm}
              onChange={(e) =>
                setFormData({ ...formData, constant13mm: e.target.value })
              }
              helperText="Latest EFA area (13mm) ÷ Graticule area"
              sx={{ mb: 2 }}
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
              sx={{ mb: 2 }}
            />

            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2 }}
            >
              Attach Service Report
              <input
                type="file"
                hidden
                accept=".pdf"
                onChange={handleFileChange}
              />
            </Button>
            {formData.serviceReport && (
              <Typography variant="body2" color="primary">
                File selected: {formData.serviceReport.name}
              </Typography>
            )}
            {editingCalibration &&
              editingCalibration.serviceReportUrl &&
              !formData.serviceReport && (
                <Typography variant="body2" color="success.main">
                  ✓ Service report already uploaded
                </Typography>
              )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              loading ||
              !formData.date ||
              !formData.microscopeReference ||
              !formData.servicingCompany ||
              !formData.graticule ||
              !formData.constant25mm ||
              !formData.constant13mm ||
              formData.constant25mm === "" ||
              formData.constant13mm === ""
            }
          >
            {loading ? "Saving..." : editingCalibration ? "Update" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this calibration record? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MicroscopePage;
