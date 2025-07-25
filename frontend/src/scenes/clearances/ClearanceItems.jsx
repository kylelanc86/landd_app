import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
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
  Snackbar,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  Delete as DeletePhotoIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";

import { useNavigate, useParams } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { compressImage, needsCompression } from "../../utils/imageCompression";
import { formatDate } from "../../utils/dateUtils";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const ClearanceItems = () => {
  const colors = tokens;
  const navigate = useNavigate();
  const { clearanceId } = useParams();

  const [items, setItems] = useState([]);
  const [clearance, setClearance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [form, setForm] = useState({
    locationDescription: "",
    materialDescription: "",
    asbestosType: "non-friable",
    photograph: "",
    notes: "",
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [airMonitoringDialogOpen, setAirMonitoringDialogOpen] = useState(false);
  const [airMonitoringFile, setAirMonitoringFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [airMonitoringReportsDialogOpen, setAirMonitoringReportsDialogOpen] =
    useState(false);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [exclusionsLastSaved, setExclusionsLastSaved] = useState(null);
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [uploadingSitePlan, setUploadingSitePlan] = useState(false);
  const [generatingAirMonitoringPDF, setGeneratingAirMonitoringPDF] =
    useState(false);

  // Fetch items and clearance data on component mount
  useEffect(() => {
    fetchData();
  }, [clearanceId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, clearanceData] = await Promise.all([
        asbestosClearanceService.getItems(clearanceId),
        asbestosClearanceService.getById(clearanceId),
      ]);

      console.log("Clearance items API response:", itemsData);
      console.log("Clearance API response:", clearanceData);

      setItems(itemsData || []);
      setClearance(clearanceData);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        locationDescription: form.locationDescription,
        materialDescription: form.materialDescription,
        asbestosType: form.asbestosType,
        photograph: form.photograph,
        notes: form.notes,
      };

      if (editingItem) {
        await asbestosClearanceService.updateItem(
          clearanceId,
          editingItem._id,
          itemData
        );
        setSnackbar({
          open: true,
          message: "Item updated successfully",
          severity: "success",
        });
      } else {
        await asbestosClearanceService.addItem(clearanceId, itemData);
        setSnackbar({
          open: true,
          message: "Item created successfully",
          severity: "success",
        });
      }

      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving item:", err);
      setSnackbar({
        open: true,
        message: "Failed to save item",
        severity: "error",
      });
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      locationDescription: item.locationDescription,
      materialDescription: item.materialDescription,
      asbestosType: item.asbestosType,
      photograph: item.photograph || "",
      notes: item.notes || "",
    });
    setPhotoPreview(item.photograph || null);
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const handleDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await asbestosClearanceService.deleteItem(clearanceId, item._id);
        setSnackbar({
          open: true,
          message: "Item deleted successfully",
          severity: "success",
        });
        fetchData();
      } catch (err) {
        console.error("Error deleting item:", err);
        setSnackbar({
          open: true,
          message: "Failed to delete item",
          severity: "error",
        });
      }
    }
  };

  const resetForm = () => {
    setForm({
      locationDescription: "",
      materialDescription: "",
      asbestosType: "non-friable",
      photograph: "",
      notes: "",
    });
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
  };

  const getAsbestosTypeColor = (type) => {
    switch (type) {
      case "friable":
        return "error";
      case "non-friable":
        return "warning";
      default:
        return "default";
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhotoFile(file);
      setCompressionStatus({
        type: "processing",
        message: "Processing image...",
      });

      try {
        const originalSizeKB = Math.round(file.size / 1024);

        // Check if compression is needed
        const shouldCompress = needsCompression(file, 300); // 300KB threshold

        if (shouldCompress) {
          console.log("Compressing image...");
          setCompressionStatus({
            type: "compressing",
            message: "Compressing image...",
          });

          const compressedImage = await compressImage(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
            maxSizeKB: 300,
          });

          const compressedSizeKB = Math.round(
            (compressedImage.length * 0.75) / 1024
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100
          );

          setPhotoPreview(compressedImage);
          setForm({ ...form, photograph: compressedImage });
          setCompressionStatus({
            type: "success",
            message: `Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${reduction}% reduction)`,
          });

          console.log("Image compressed successfully");
        } else {
          // Use original if no compression needed
          const reader = new FileReader();
          reader.onload = (e) => {
            setPhotoPreview(e.target.result);
            setForm({ ...form, photograph: e.target.result });
            setCompressionStatus({
              type: "info",
              message: `No compression needed (${originalSizeKB}KB)`,
            });
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error processing image:", error);
        // Fallback to original image if compression fails
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreview(e.target.result);
          setForm({ ...form, photograph: e.target.result });
          setCompressionStatus({
            type: "warning",
            message: "Compression failed, using original image",
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTakePhoto = () => {
    // Create a file input for camera access
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // Use back camera
    input.onchange = handlePhotoUpload;
    input.click();
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm({ ...form, photograph: "" });
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const fetchAirMonitoringReports = async () => {
    if (!clearance?.projectId?._id) {
      setSnackbar({
        open: true,
        message: "No project found for this clearance",
        severity: "error",
      });
      return;
    }

    try {
      setLoadingReports(true);
      const reports = await asbestosClearanceService.getAirMonitoringReports(
        clearance.projectId._id
      );
      setAirMonitoringReports(reports);
    } catch (error) {
      console.error("Error fetching air monitoring reports:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch air monitoring reports",
        severity: "error",
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const handleOpenAirMonitoringReportsDialog = () => {
    setAirMonitoringReportsDialogOpen(true);
    fetchAirMonitoringReports();
  };

  const handleSelectAirMonitoringReport = async (report) => {
    try {
      setSelectedReport(report);
      setGeneratingAirMonitoringPDF(true);

      // Generate the air monitoring report PDF
      const { generateShiftReport } = await import(
        "../../utils/generateShiftReport"
      );
      const {
        shiftService,
        jobService,
        sampleService,
        projectService,
        clientService,
      } = await import("../../services/api");

      // Get the shift data
      const shiftResponse = await shiftService.getById(report._id);
      const shift = shiftResponse.data;

      // Get the job data
      const jobResponse = await jobService.getById(report.jobId);
      const job = jobResponse.data;

      // Get samples for this shift
      const samplesResponse = await sampleService.getByShift(report._id);
      const samples = samplesResponse.data || [];

      // Get project data
      let project = job.project;
      if (project && typeof project === "string") {
        const projectResponse = await projectService.getById(project);
        project = projectResponse.data;
      }
      if (project && project.client && typeof project.client === "string") {
        const clientResponse = await clientService.getById(project.client);
        project.client = clientResponse.data;
      }

      // Generate the report and get the PDF data URL
      const pdfDataUrl = await generateShiftReport({
        shift: shift,
        job: job,
        samples: samples,
        project: project,
        returnPdfData: true, // This will return the PDF data URL instead of downloading
      });

      // Extract base64 data from data URL
      const base64Data = pdfDataUrl.split(",")[1];

      // Upload the report to the clearance
      await asbestosClearanceService.uploadAirMonitoringReport(clearanceId, {
        reportData: base64Data,
      });

      setSnackbar({
        open: true,
        message: "Air monitoring report selected and uploaded successfully",
        severity: "success",
      });

      setAirMonitoringReportsDialogOpen(false);
      setSelectedReport(null);
      fetchData(); // Refresh clearance data
    } catch (error) {
      console.error("Error selecting air monitoring report:", error);
      setSnackbar({
        open: true,
        message: "Failed to select air monitoring report",
        severity: "error",
      });
    } finally {
      setGeneratingAirMonitoringPDF(false);
    }
  };

  const handleAirMonitoringFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAirMonitoringFile(file);
    }
  };

  const handleUploadAirMonitoringReport = async () => {
    if (!airMonitoringFile) {
      setSnackbar({
        open: true,
        message: "Please select a file to upload",
        severity: "error",
      });
      return;
    }

    try {
      setUploadingReport(true);

      // Convert file to base64
      const base64Data = await convertToBase64(airMonitoringFile);

      // Upload to backend
      await asbestosClearanceService.uploadAirMonitoringReport(clearanceId, {
        reportData: base64Data,
      });

      setSnackbar({
        open: true,
        message: "Air monitoring report uploaded successfully",
        severity: "success",
      });

      setAirMonitoringDialogOpen(false);
      setAirMonitoringFile(null);
      fetchData(); // Refresh clearance data
    } catch (error) {
      console.error("Error uploading air monitoring report:", error);
      setSnackbar({
        open: true,
        message: "Failed to upload air monitoring report",
        severity: "error",
      });
    } finally {
      setUploadingReport(false);
    }
  };

  const handleRemoveAirMonitoringReport = async () => {
    if (
      window.confirm(
        "Are you sure you want to remove the air monitoring report?"
      )
    ) {
      try {
        // Update the clearance to remove the air monitoring report
        await asbestosClearanceService.update(clearanceId, {
          airMonitoringReport: null,
        });

        setSnackbar({
          open: true,
          message: "Air monitoring report removed successfully",
          severity: "success",
        });

        fetchData(); // Refresh clearance data
      } catch (error) {
        console.error("Error removing air monitoring report:", error);
        setSnackbar({
          open: true,
          message: "Failed to remove air monitoring report",
          severity: "error",
        });
      }
    }
  };

  const handleSitePlanFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSitePlanFile(file);
    }
  };

  const handleUploadSitePlan = async () => {
    if (!sitePlanFile) {
      setSnackbar({
        open: true,
        message: "Please select a file first",
        severity: "error",
      });
      return;
    }

    try {
      setUploadingSitePlan(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Extract just the base64 data from the data URL
          const dataUrl = event.target.result;
          const base64Data = dataUrl.split(",")[1]; // Remove the "data:application/pdf;base64," prefix

          // Update the clearance with the site plan file
          await asbestosClearanceService.update(clearanceId, {
            sitePlanFile: base64Data,
          });

          setSnackbar({
            open: true,
            message: "Site plan uploaded successfully",
            severity: "success",
          });

          setSitePlanDialogOpen(false);
          setSitePlanFile(null);
          fetchData(); // Refresh clearance data
        } catch (error) {
          console.error("Error uploading site plan:", error);
          setSnackbar({
            open: true,
            message: "Failed to upload site plan",
            severity: "error",
          });
        } finally {
          setUploadingSitePlan(false);
        }
      };
      reader.readAsDataURL(sitePlanFile);
    } catch (error) {
      console.error("Error processing site plan file:", error);
      setSnackbar({
        open: true,
        message: "Failed to process site plan file",
        severity: "error",
      });
      setUploadingSitePlan(false);
    }
  };

  const handleRemoveSitePlan = async () => {
    if (window.confirm("Are you sure you want to remove the site plan?")) {
      try {
        // Update the clearance to remove the site plan file
        await asbestosClearanceService.update(clearanceId, {
          sitePlanFile: null,
        });

        setSnackbar({
          open: true,
          message: "Site plan removed successfully",
          severity: "success",
        });

        fetchData(); // Refresh clearance data
      } catch (error) {
        console.error("Error removing site plan:", error);
        setSnackbar({
          open: true,
          message: "Failed to remove site plan",
          severity: "error",
        });
      }
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        {/* PDF Loading Overlay */}
        <PDFLoadingOverlay
          open={generatingAirMonitoringPDF}
          message="Generating Air Monitoring Report PDF..."
        />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              onClick={() => navigate("/clearances/asbestos")}
              color="primary"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h2"
                color={colors.grey[100]}
                fontWeight="bold"
                sx={{ mb: "5px" }}
              >
                Clearance Items
              </Typography>
              {clearance && (
                <Typography variant="h6" color={colors.secondary[500]}>
                  {clearance.projectId?.name || "Unknown Project"} -{" "}
                  {clearance.clearanceDate
                    ? new Date(clearance.clearanceDate).toLocaleDateString()
                    : "Unknown Date"}
                </Typography>
              )}
            </Box>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setEditingItem(null);
              resetForm();
              setDialogOpen(true);
            }}
            startIcon={<AddIcon />}
          >
            Add Item
          </Button>
        </Box>

        {/* Air Monitoring Buttons */}
        {clearance?.airMonitoring && (
          <Box display="flex" gap={2} sx={{ mt: 2 }} alignItems="center">
            {clearance.airMonitoringReport && (
              <Typography
                variant="body2"
                color="error"
                sx={{ fontWeight: "medium" }}
              >
                ✓ Air Monitoring Report Attached
              </Typography>
            )}
            <Button
              variant="outlined"
              color="primary"
              onClick={handleOpenAirMonitoringReportsDialog}
              startIcon={<DescriptionIcon />}
            >
              {clearance.airMonitoringReport
                ? "Replace Air Monitoring Report"
                : "Select Air Monitoring Report"}
            </Button>
            {clearance.airMonitoringReport && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleRemoveAirMonitoringReport}
                startIcon={<DeleteIcon />}
              >
                Remove Report
              </Button>
            )}
          </Box>
        )}

        {/* Site Plan Buttons */}
        {clearance?.sitePlan && (
          <Box display="flex" gap={2} sx={{ mt: 2 }} alignItems="center">
            {clearance.sitePlanFile && (
              <Typography
                variant="body2"
                color="success.main"
                sx={{ fontWeight: "medium" }}
              >
                ✓ Site Plan Attached
              </Typography>
            )}
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setSitePlanDialogOpen(true)}
              startIcon={<UploadIcon />}
            >
              {clearance.sitePlanFile
                ? "Replace Site Plan"
                : "Upload Site Plan"}
            </Button>
            {clearance.sitePlanFile && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleRemoveSitePlan}
                startIcon={<DeleteIcon />}
              >
                Remove Site Plan
              </Button>
            )}
          </Box>
        )}

        {/* Job Specific Exclusions */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" color={colors.grey[100]} sx={{ mb: 2 }}>
              Job Specific Exclusions
            </Typography>
            <TextField
              fullWidth
              label="Job Specific Exclusions"
              value={clearance?.jobSpecificExclusions || ""}
              onChange={(e) => {
                // Update local state for the text field
                setClearance((prev) => ({
                  ...prev,
                  jobSpecificExclusions: e.target.value,
                }));
              }}
              multiline
              rows={4}
              placeholder="Enter job-specific exclusions that will be added to the Inspection Exclusions section of the report..."
              helperText={
                clearance?.jobSpecificExclusions && !savingExclusions
                  ? "This text will be appended to the standard Inspection Exclusions section in the clearance report."
                  : savingExclusions
                  ? "Saving..."
                  : "This text will be appended to the standard Inspection Exclusions section in the clearance report."
              }
              InputProps={{
                endAdornment: savingExclusions ? (
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                ) : null,
              }}
            />
            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  try {
                    setSavingExclusions(true);
                    await asbestosClearanceService.update(clearanceId, {
                      jobSpecificExclusions:
                        clearance?.jobSpecificExclusions || "",
                    });
                    setSnackbar({
                      open: true,
                      message: "Job specific exclusions saved successfully",
                      severity: "success",
                    });
                    setExclusionsLastSaved(new Date());
                  } catch (error) {
                    console.error(
                      "Error saving job specific exclusions:",
                      error
                    );
                    setSnackbar({
                      open: true,
                      message: "Failed to save job specific exclusions",
                      severity: "error",
                    });
                  } finally {
                    setSavingExclusions(false);
                  }
                }}
                disabled={savingExclusions}
              >
                {savingExclusions ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Save Exclusions"
                )}
              </Button>
            </Box>
            {exclusionsLastSaved && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Last saved: {formatDate(exclusionsLastSaved)}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell>Material Description</TableCell>
                    <TableCell>Asbestos Type</TableCell>
                    <TableCell>Photograph</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(items || []).map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>{item.locationDescription}</TableCell>
                      <TableCell>{item.materialDescription}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.asbestosType}
                          color={getAsbestosTypeColor(item.asbestosType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {item.photograph ? (
                          <Chip label="Yes" color="success" size="small" />
                        ) : (
                          <Chip label="No" color="default" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.notes ? (
                          <Typography variant="body2" noWrap>
                            {item.notes}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No notes
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleEdit(item)}
                          color="primary"
                          size="small"
                          title="Edit"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(item)}
                          color="error"
                          size="small"
                          title="Delete"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingItem ? "Edit Item" : "Add New Item"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Location Description"
                    value={form.locationDescription}
                    onChange={(e) =>
                      setForm({ ...form, locationDescription: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Material Description"
                    value={form.materialDescription}
                    onChange={(e) =>
                      setForm({ ...form, materialDescription: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Asbestos Type</InputLabel>
                    <Select
                      value={form.asbestosType}
                      onChange={(e) =>
                        setForm({ ...form, asbestosType: e.target.value })
                      }
                      label="Asbestos Type"
                    >
                      <MenuItem value="non-friable">Non-friable</MenuItem>
                      <MenuItem value="friable">Friable</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Photograph
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PhotoCameraIcon />}
                        onClick={handleTakePhoto}
                        size="small"
                      >
                        Take Photo
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        component="label"
                        size="small"
                      >
                        Upload Photo
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handlePhotoUpload}
                        />
                      </Button>
                      {photoPreview && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeletePhotoIcon />}
                          onClick={handleRemovePhoto}
                          size="small"
                        >
                          Remove
                        </Button>
                      )}
                    </Box>
                    {photoPreview && (
                      <Box
                        sx={{
                          width: 200,
                          height: 150,
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid #ddd",
                          mb: 2,
                        }}
                      >
                        <img
                          src={photoPreview}
                          alt="Preview"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )}
                    {compressionStatus && (
                      <Alert
                        severity={compressionStatus.type}
                        sx={{ mb: 2 }}
                        icon={
                          compressionStatus.type === "processing" ||
                          compressionStatus.type === "compressing" ? (
                            <CircularProgress size={16} />
                          ) : undefined
                        }
                      >
                        {compressionStatus.message}
                      </Alert>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    multiline
                    rows={3}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained">
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Air Monitoring Reports Selection Dialog */}
        <Dialog
          open={airMonitoringReportsDialogOpen}
          onClose={() => setAirMonitoringReportsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Select Air Monitoring Report</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select an air monitoring report from the list below. This will
                be included in the clearance report as Appendix B.
              </Typography>

              {loadingReports ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="200px"
                >
                  <CircularProgress />
                </Box>
              ) : airMonitoringReports.length === 0 ? (
                <Alert severity="info">
                  No air monitoring reports found for this project. Reports must
                  be completed and authorized to appear here.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {airMonitoringReports.map((report, index) => (
                    <Card
                      key={report._id}
                      sx={{
                        mb: 2,
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        border: selectedReport?._id === report._id ? 2 : 1,
                        borderColor:
                          selectedReport?._id === report._id
                            ? "primary.main"
                            : "divider",
                      }}
                      onClick={() => handleSelectAirMonitoringReport(report)}
                    >
                      <CardContent sx={{ py: 2 }}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Box flex={1}>
                            <Box
                              display="flex"
                              alignItems="center"
                              gap={1}
                              mb={1}
                            >
                              <Typography
                                variant="subtitle1"
                                fontWeight="medium"
                              >
                                {report.name}
                              </Typography>
                              <Chip
                                label={
                                  report.reportApprovedBy
                                    ? "Authorized"
                                    : report.status
                                }
                                color={
                                  report.reportApprovedBy
                                    ? "success"
                                    : "default"
                                }
                                size="small"
                              />
                            </Box>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              mb={0.5}
                            >
                              Job: {report.jobName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Date: {formatDate(report.date)}
                              {report.reportIssueDate &&
                                ` • Issue Date: ${formatDate(
                                  report.reportIssueDate
                                )}`}
                            </Typography>
                          </Box>
                          {selectedReport?._id === report._id && (
                            <CircularProgress size={20} />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAirMonitoringReportsDialogOpen(false)}>
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        {/* Site Plan Upload Dialog */}
        <Dialog
          open={sitePlanDialogOpen}
          onClose={() => setSitePlanDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Upload Site Plan</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a site plan file (PDF, JPG, or PNG). This will be
                included in the clearance report as Appendix B.
              </Typography>

              <Box sx={{ mb: 2 }}>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: "none" }}
                  id="site-plan-file-upload"
                  type="file"
                  onChange={handleSitePlanFileUpload}
                />
                <label htmlFor="site-plan-file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                    fullWidth
                  >
                    {sitePlanFile ? sitePlanFile.name : "Choose Site Plan File"}
                  </Button>
                </label>
              </Box>

              {sitePlanFile && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Selected file: {sitePlanFile.name} (
                  {(sitePlanFile.size / 1024 / 1024).toFixed(2)} MB)
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSitePlanDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUploadSitePlan}
              variant="contained"
              disabled={!sitePlanFile || uploadingSitePlan}
              startIcon={
                uploadingSitePlan ? (
                  <CircularProgress size={16} />
                ) : (
                  <UploadIcon />
                )
              }
            >
              {uploadingSitePlan ? "Uploading..." : "Upload Site Plan"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </PermissionGate>
  );
};

export default ClearanceItems;
