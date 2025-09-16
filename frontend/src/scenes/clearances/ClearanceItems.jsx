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
  Breadcrumbs,
  Link,
  Autocomplete,
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
import { Checkbox, FormControlLabel } from "@mui/material";

import { useNavigate, useParams } from "react-router-dom";
import { tokens } from "../../theme/tokens";
import PermissionGate from "../../components/PermissionGate";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
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
    levelFloor: "",
    roomArea: "",
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
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [showLevelFloor, setShowLevelFloor] = useState(false);
  const [asbestosRemovalJobId, setAsbestosRemovalJobId] = useState(null);
  const [customDataFields, setCustomDataFields] = useState({
    roomAreas: [],
    locationDescriptions: [],
    materialsDescriptions: [],
  });

  // Fetch items and clearance data on component mount
  useEffect(() => {
    if (clearanceId) {
      fetchData();
      fetchCustomDataFields();
    } else {
      console.error("No clearanceId provided in URL parameters");
      setError("No clearance ID provided");
      setLoading(false);
    }
  }, [clearanceId]);

  const fetchCustomDataFields = async () => {
    try {
      const [
        roomAreasData,
        locationDescriptionsData,
        materialsDescriptionsData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
      ]);

      // Handle both array and object responses and sort alphabetically
      const processData = (data) => {
        let processedData = [];

        if (Array.isArray(data)) {
          processedData = data;
        } else if (data && typeof data === "object") {
          // If it's an object, try to extract the array from common property names
          processedData =
            data.data ||
            data.items ||
            data.fields ||
            Object.values(data).filter(Array.isArray)[0] ||
            [];
        }

        // Sort alphabetically by text field
        return processedData.sort((a, b) => {
          const textA = (a.text || "").toLowerCase();
          const textB = (b.text || "").toLowerCase();
          return textA.localeCompare(textB);
        });
      };

      setCustomDataFields({
        roomAreas: processData(roomAreasData),
        locationDescriptions: processData(locationDescriptionsData),
        materialsDescriptions: processData(materialsDescriptionsData),
      });
    } catch (err) {
      console.error("Error fetching custom data fields:", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Check if clearanceId is valid
      if (!clearanceId) {
        throw new Error("Clearance ID is missing from URL");
      }

      console.log("Fetching data for clearance ID:", clearanceId);

      const [itemsData, clearanceData] = await Promise.all([
        asbestosClearanceService.getItems(clearanceId),
        asbestosClearanceService.getById(clearanceId),
      ]);

      setItems(itemsData || []);
      setClearance(clearanceData);

      // Set job completed state based on clearance status
      setJobCompleted(clearanceData?.status === "complete");

      // Fetch asbestos removal job ID for breadcrumb navigation (separate from main data loading)
      if (clearanceData?.projectId) {
        try {
          const asbestosRemovalJobService = (
            await import("../../services/asbestosRemovalJobService")
          ).default;
          const jobsResponse = await asbestosRemovalJobService.getAll();
          const projectId =
            clearanceData.projectId._id || clearanceData.projectId;

          // Find the asbestos removal job that matches this project
          const matchingJob = jobsResponse.data.find(
            (job) =>
              job.projectId === projectId ||
              job.projectId?._id === projectId ||
              job.projectId === clearanceData.projectId ||
              job.projectId?._id === clearanceData.projectId
          );

          if (matchingJob) {
            setAsbestosRemovalJobId(matchingJob._id);
          }
        } catch (jobError) {
          console.error("Error fetching asbestos removal job ID:", jobError);
          // Don't fail the entire data loading if job ID fetching fails
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        clearanceId: clearanceId,
      });
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        locationDescription: form.locationDescription, // Location Description
        levelFloor: showLevelFloor ? form.levelFloor : "",
        roomArea: form.roomArea,
        materialDescription: form.materialDescription, // Materials Description
        asbestosType: form.asbestosType, // Material Type
        photograph: form.photograph,
        notes: form.notes,
      };

      console.log("Submitting item data:", itemData);

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
      await fetchData();

      // Update clearance type based on all items
      const updatedItems = await asbestosClearanceService.getItems(clearanceId);
      await updateClearanceTypeFromItems(updatedItems);
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
      levelFloor: item.levelFloor || "",
      roomArea: item.roomArea || "",
      materialDescription: item.materialDescription,
      asbestosType: item.asbestosType,
      photograph: item.photograph || "",
      notes: item.notes || "",
    });
    setShowLevelFloor(!!item.levelFloor);
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
        await fetchData();

        // Update clearance type based on remaining items
        const updatedItems = await asbestosClearanceService.getItems(
          clearanceId
        );
        await updateClearanceTypeFromItems(updatedItems);
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
      levelFloor: "",
      roomArea: "",
      materialDescription: "",
      asbestosType: "non-friable",
      photograph: "",
      notes: "",
    });
    setShowLevelFloor(false);
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
  };

  // Function to automatically determine and update clearance type based on asbestos items
  const updateClearanceTypeFromItems = async (items) => {
    if (!items || items.length === 0) {
      return;
    }

    const hasFriable = items.some((item) => item.asbestosType === "friable");
    const hasNonFriable = items.some(
      (item) => item.asbestosType === "non-friable"
    );

    let newClearanceType;
    if (hasFriable && hasNonFriable) {
      newClearanceType = "Mixed";
    } else if (hasFriable) {
      newClearanceType = "Friable";
    } else {
      newClearanceType = "Non-friable";
    }

    // Update the clearance type if it has changed
    if (clearance && clearance.clearanceType !== newClearanceType) {
      try {
        await asbestosClearanceService.update(clearanceId, {
          clearanceType: newClearanceType,
        });

        // Update local state
        setClearance((prev) => ({
          ...prev,
          clearanceType: newClearanceType,
        }));

        console.log(
          `Clearance type automatically updated to: ${newClearanceType}`
        );
      } catch (error) {
        console.error("Error updating clearance type:", error);
      }
    }
  };

  const getAsbestosTypeColor = (type) => {
    switch (type) {
      case "Friable":
        return "error";
      case "Non-friable":
        return "warning";
      default:
        return "default";
    }
  };

  const formatAsbestosType = (type) => {
    if (!type) return "Non-friable";
    return type.charAt(0).toUpperCase() + type.slice(1).replace("-", "-");
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
      let project = job.projectId;
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
        projectId: project,
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

  const handleBackToHome = () => {
    navigate("/asbestos-removal");
  };

  const handleCompleteJob = async () => {
    if (window.confirm("Are you sure you want to complete this job?")) {
      try {
        await asbestosClearanceService.update(clearanceId, {
          status: "complete",
        });
        setJobCompleted(true);
        setSnackbar({
          open: true,
          message: "Job completed successfully!",
          severity: "success",
        });
        fetchData(); // Refresh the data to show updated status

        // Navigate to asbestos removal job details after completing clearance
        if (clearance?.projectId) {
          // Find the asbestos removal job for this project
          try {
            const asbestosRemovalJobService = (
              await import("../../services/asbestosRemovalJobService")
            ).default;
            const jobsResponse = await asbestosRemovalJobService.getAll();
            const projectId = clearance.projectId._id || clearance.projectId;

            // Find the asbestos removal job that matches this project
            const matchingJob = jobsResponse.data.find(
              (job) =>
                job.projectId === projectId ||
                job.projectId?._id === projectId ||
                job.projectId === clearance.projectId ||
                job.projectId?._id === clearance.projectId
            );

            if (matchingJob) {
              // Navigate to the asbestos removal job details
              navigate(`/asbestos-removal/jobs/${matchingJob._id}/details`);
            } else {
              // If no matching job found, navigate to asbestos removal jobs list
              navigate("/asbestos-removal");
            }
          } catch (navError) {
            console.error(
              "Error navigating to asbestos removal job:",
              navError
            );
            // Fallback to asbestos removal jobs list
            navigate("/asbestos-removal");
          }
        } else {
          // If no project ID, navigate to asbestos removal jobs list
          navigate("/asbestos-removal");
        }
      } catch (error) {
        console.error("Error completing job:", error);
        setSnackbar({
          open: true,
          message: "Failed to complete job",
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

        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Clearance Items
        </Typography>

        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ marginBottom: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() =>
              navigate(
                asbestosRemovalJobId
                  ? `/asbestos-removal/jobs/${asbestosRemovalJobId}/details`
                  : `/asbestos-removal`
              )
            }
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Asbestos Removal Job Details
          </Link>
          <Typography color="text.primary">
            {clearance.projectId?.name || "Unknown Project"}:{" "}
            {clearance.clearanceDate
              ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "Unknown Date"}
          </Typography>
        </Breadcrumbs>

        {/* Project Info */}

        <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setAttachmentsModalOpen(true)}
            startIcon={<DescriptionIcon />}
          >
            Attachments
          </Button>

          <Button
            variant="contained"
            color={jobCompleted ? "error" : "primary"}
            onClick={jobCompleted ? undefined : handleCompleteJob}
            disabled={!items || items.length === 0 || jobCompleted}
            sx={{
              backgroundColor: jobCompleted ? "#d32f2f" : "#1976d2",
              "&:hover": {
                backgroundColor: jobCompleted ? "#d32f2f" : "#1565c0",
              },
            }}
          >
            {jobCompleted ? "COMPLETED" : "COMPLETE CLEARANCE"}
          </Button>
        </Box>

        {/* Air Monitoring Indicators */}
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
            {!clearance.airMonitoringReport && (
              <Typography
                variant="body2"
                color="warning.main"
                sx={{ fontWeight: "medium" }}
              >
                ⚠ No Air Monitoring Report Attached
              </Typography>
            )}
          </Box>
        )}

        {/* Site Plan Indicators */}
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
            {!clearance.sitePlanFile && (
              <Typography
                variant="body2"
                color="warning.main"
                sx={{ fontWeight: "medium" }}
              >
                ⚠ No Site Plan Attached
              </Typography>
            )}
          </Box>
        )}

        {/* Job Specific Exclusions */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" color="black" sx={{ mb: 2 }}>
              Job Specific Exclusions
            </Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <TextField
                sx={{ flex: 1 }}
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
                rows={3}
                placeholder="Enter job-specific exclusions that will be added to the Inspection Exclusions section of the report..."
                // helperText={
                //   clearance?.jobSpecificExclusions && !savingExclusions
                //     ? "This text will be appended to the standard Inspection Exclusions section in the clearance report."
                //     : savingExclusions
                //     ? "Saving..."
                //     : "This text will be appended to the standard Inspection Exclusions section in the clearance report."
                // }
                InputProps={{
                  endAdornment: savingExclusions ? (
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                  ) : null,
                }}
              />
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
                sx={{ minWidth: "120px" }}
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
        <Button
          variant="contained"
          color="secondary"
          sx={{ mt: 3 }}
          onClick={() => {
            setEditingItem(null);
            resetForm();
            setDialogOpen(true);
          }}
          startIcon={<AddIcon />}
        >
          Add Item
        </Button>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {items &&
                      items.length > 0 &&
                      items.some(
                        (item) =>
                          item.levelFloor && item.levelFloor.trim() !== ""
                      ) && <TableCell>Level/Floor</TableCell>}
                    <TableCell>Room/Area</TableCell>
                    <TableCell>Location Description</TableCell>
                    <TableCell>Materials Description</TableCell>
                    <TableCell>Asbestos Type</TableCell>
                    <TableCell>Photograph</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(items || []).map((item) => {
                    const hasLevelFloor =
                      items &&
                      items.length > 0 &&
                      items.some(
                        (item) =>
                          item.levelFloor && item.levelFloor.trim() !== ""
                      );
                    return (
                      <TableRow key={item._id}>
                        {hasLevelFloor && (
                          <TableCell>
                            {item.levelFloor ? (
                              <Typography variant="body2">
                                {item.levelFloor}
                              </Typography>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                fontStyle="italic"
                              >
                                Not specified
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {item.roomArea ? (
                            <Typography variant="body2">
                              {item.roomArea}
                            </Typography>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontStyle="italic"
                            >
                              Not specified
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{item.locationDescription}</TableCell>
                        <TableCell>{item.materialDescription}</TableCell>
                        <TableCell>
                          <Chip
                            label={formatAsbestosType(item.asbestosType)}
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
                    );
                  })}
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
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: editingItem ? "warning.main" : "primary.main",
                color: "white",
              }}
            >
              {editingItem ? (
                <EditIcon sx={{ fontSize: 20 }} />
              ) : (
                <AddIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              {editingItem ? "Edit Item" : "Add New Item"}
            </Typography>
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
              <Grid container spacing={2}>
                <Grid item xs={12} container spacing={2} alignItems="center">
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showLevelFloor}
                          onChange={(e) => setShowLevelFloor(e.target.checked)}
                        />
                      }
                      label="Include Level/Floor"
                    />
                  </Grid>
                  {showLevelFloor && (
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        label="Level/Floor"
                        value={form.levelFloor}
                        onChange={(e) =>
                          setForm({ ...form, levelFloor: e.target.value })
                        }
                        placeholder="e.g., Ground Floor, Level 1, Basement"
                      />
                    </Grid>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    value={form.roomArea}
                    onChange={(event, newValue) =>
                      setForm({ ...form, roomArea: newValue || "" })
                    }
                    options={customDataFields.roomAreas.map(
                      (item) => item.text
                    )}
                    onOpen={() =>
                      console.log(
                        "Room areas options:",
                        customDataFields.roomAreas
                      )
                    }
                    freeSolo
                    renderInput={(params) => (
                      <TextField {...params} label="Room/Area" required />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    value={form.locationDescription}
                    onChange={(event, newValue) =>
                      setForm({ ...form, locationDescription: newValue || "" })
                    }
                    options={customDataFields.locationDescriptions.map(
                      (item) => item.text
                    )}
                    freeSolo
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Location Description"
                        required
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    value={form.materialDescription}
                    onChange={(event, newValue) =>
                      setForm({ ...form, materialDescription: newValue || "" })
                    }
                    options={customDataFields.materialsDescriptions.map(
                      (item) => item.text
                    )}
                    freeSolo
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Materials Description"
                        required
                      />
                    )}
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
            <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
              <Button
                onClick={() => setDialogOpen(false)}
                variant="outlined"
                sx={{
                  minWidth: 100,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={editingItem ? <EditIcon /> : <AddIcon />}
                sx={{
                  minWidth: 120,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
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
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "info.main",
                color: "white",
              }}
            >
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Select Air Monitoring Report
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
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
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setAirMonitoringReportsDialogOpen(false)}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
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
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "white",
              }}
            >
              <UploadIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Upload Site Plan
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
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
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setSitePlanDialogOpen(false)}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
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
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {uploadingSitePlan ? "Uploading..." : "Upload Site Plan"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Attachments Modal */}
        <Dialog
          open={attachmentsModalOpen}
          onClose={() => setAttachmentsModalOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "info.main",
                color: "white",
              }}
            >
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Manage Attachments
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            {/* Air Monitoring Section */}
            {clearance?.airMonitoring && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                  Air Monitoring Report
                </Typography>
                {clearance.airMonitoringReport && (
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ mb: 2, fontWeight: "medium" }}
                  >
                    ✓ Air Monitoring Report Currently Attached
                  </Typography>
                )}
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
              </Box>
            )}

            {/* Site Plan Section */}
            {clearance?.sitePlan && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                  Site Plan
                </Typography>
                {clearance.sitePlanFile && (
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ mb: 2, fontWeight: "medium" }}
                  >
                    ✓ Site Plan Currently Attached
                  </Typography>
                )}
                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
              </Box>
            )}

            {!clearance?.airMonitoring && !clearance?.sitePlan && (
              <Typography variant="body2" color="text.secondary">
                No attachments are configured for this clearance type.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setAttachmentsModalOpen(false)}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
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
