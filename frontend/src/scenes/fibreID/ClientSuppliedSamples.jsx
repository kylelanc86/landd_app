import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  TextField,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton as MuiIconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  UploadFile as UploadFileIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { clientSuppliedJobsService } from "../../services/api";
import { compressImage, getBase64SizeKB } from "../../utils/imageCompression";
import { formatLabReferenceForDisplay, compareLabReference } from "../../utils/formatters";

const ClientSuppliedSamples = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [sampleRows, setSampleRows] = useState([
    { labReference: "", clientReference: "", cowlNumber: "" },
  ]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [uploadingCOC, setUploadingCOC] = useState(false);
  const [cocDialogOpen, setCocDialogOpen] = useState(false);
  const [cocFullScreenOpen, setCocFullScreenOpen] = useState(false);
  const [cocFullScreenIndex, setCocFullScreenIndex] = useState(0);
  const [cocClickedIndex, setCocClickedIndex] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    // Reset data when jobId changes
    if (jobId && typeof jobId === "string" && jobId !== "[object Object]") {
      setJob(null);
      setSamples([]);
      setLoading(true);

      // Load data for the new jobId
      fetchJobDetails();
      fetchSampleItems();
    } else if (jobId === "[object Object]") {
      setLoading(false);
      // Redirect back to the jobs list if we have an invalid jobId
      const basePath = location.pathname.startsWith("/laboratory-services/ld-supplied")
        ? "/laboratory-services/ld-supplied"
        : location.pathname.startsWith("/fibre-id/ld-supplied")
          ? "/fibre-id/ld-supplied"
          : location.pathname.startsWith("/client-supplied")
            ? "/client-supplied"
            : "/fibre-id/client-supplied";
      navigate(basePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Refresh data when page gains focus (e.g., when returning from analysis page)
  useEffect(() => {
    const handleFocus = () => {
      if (jobId && typeof jobId === "string" && jobId !== "[object Object]") {
        fetchSampleItems();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const fetchJobDetails = async () => {
    // Prevent API call with invalid jobId
    if (!jobId || jobId === "[object Object]" || typeof jobId !== "string") {
      console.error("Invalid jobId for fetchJobDetails:", jobId);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await clientSuppliedJobsService.getById(jobId);
      setJob(response.data);
    } catch (error) {
      console.error("Error fetching job details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleItems = async () => {
    // Prevent API call with invalid jobId
    if (!jobId || jobId === "[object Object]" || typeof jobId !== "string") {
      console.error("Invalid jobId for fetchSampleItems:", jobId);
      return;
    }

    try {
      // Get the job which now has embedded samples
      const jobResponse = await clientSuppliedJobsService.getById(jobId);
      // Samples are now embedded in the job
      setSamples(jobResponse.data.samples || []);
    } catch (error) {
      console.error("Error fetching sample items:", error);
      setSamples([]);
    }
  };

  // Removed fetchUsers - analyst selection is now only on the analysis page

  const filteredSamples = [...samples].sort(compareLabReference);

  const handleBackToJobs = () => {
    if (
      location.pathname.startsWith("/laboratory-services/ld-supplied") ||
      location.pathname.startsWith("/fibre-id/ld-supplied")
    ) {
      navigate("/laboratory-services/ld-supplied");
      return;
    }
    const basePath = location.pathname.startsWith("/client-supplied")
      ? "/client-supplied"
      : "/fibre-id/client-supplied";
    navigate(basePath);
  };

  const handleOpenModal = () => {
    setOpenModal(true);

    // If there are existing samples, show them in the modal
    if (samples.length > 0) {
      const existingRows = samples.map((sample) => ({
        labReference: sample.labReference,
        clientReference: sample.clientReference,
        cowlNumber: sample.cowlNumber || "",
      }));
      setSampleRows(existingRows);
    } else {
      // Start with one empty row with auto-generated lab reference (Lab suffix to match fibre ID report format)
      setSampleRows([
        {
          labReference: `${job?.projectId?.projectID || "PROJ"}-Lab1`,
          clientReference: "",
          cowlNumber: "",
        },
      ]);
    }
  };

  const handleCloseModal = () => {
    setOpenModal(false);
  };

  const handleAddRow = () => {
    // Get all existing lab references (from both current rows and saved samples)
    const existingLabRefs = [
      ...sampleRows.map((row) => row.labReference),
      ...samples.map((sample) => sample.labReference),
    ].filter(Boolean);

    // Parse numeric part: support both "PROJ-Lab3" and legacy "PROJ-3"
    const getLabNumber = (ref) => {
      if (!ref || typeof ref !== "string") return 0;
      const labMatch = ref.match(/-Lab(\d+)$/);
      if (labMatch) return parseInt(labMatch[1], 10);
      const numMatch = ref.match(/-(\d+)$/);
      if (numMatch) return parseInt(numMatch[1], 10);
      return 0;
    };
    const maxN = existingLabRefs.length
      ? Math.max(...existingLabRefs.map(getLabNumber))
      : 0;
    const newRowNumber = maxN + 1;
    const prefix = job?.projectId?.projectID || "PROJ";
    const newLabReference = `${prefix}-Lab${newRowNumber}`;
    setSampleRows([
      ...sampleRows,
      {
        labReference: newLabReference,
        clientReference: "",
        cowlNumber: "",
      },
    ]);
  };

  const handleRemoveRow = (index) => {
    if (sampleRows.length > 1) {
      const newRows = sampleRows.filter((_, i) => i !== index);
      // Update lab references for remaining rows (Lab suffix to match fibre ID report format)
      const prefix = job?.projectId?.projectID || "PROJ";
      const updatedRows = newRows.map((row, i) => ({
        ...row,
        labReference: `${prefix}-Lab${i + 1}`,
      }));
      setSampleRows(updatedRows);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...sampleRows];
    newRows[index][field] = value;
    setSampleRows(newRows);
  };

  const handleConfirmSamples = async () => {
    try {
      // Create a map of existing samples by labReference for quick lookup
      const existingSamplesMap = new Map();
      samples.forEach((sample) => {
        existingSamplesMap.set(sample.labReference, sample);
      });

      // Prepare sample data (analyst and analysis date are set on the analysis page)
      const sampleData = sampleRows.map((row) => {
        const existingSample = existingSamplesMap.get(row.labReference);

        // If sample exists, preserve its analysis data and only update basic info
        if (existingSample) {
          return {
            ...existingSample,
            labReference: row.labReference,
            clientReference: row.clientReference,
            cowlNumber: row.cowlNumber || "",
            // Preserve existing analysis data
            analysisData: existingSample.analysisData,
            analysisResult: existingSample.analysisResult,
            // Only preserve analysedBy/analysedAt if analysis was actually completed
            // (i.e., if analysisData exists, meaning analysis was finalized)
            analysedBy: existingSample.analysisData
              ? existingSample.analysedBy
              : undefined,
            analysedAt: existingSample.analysisData
              ? existingSample.analysedAt
              : undefined,
          };
        } else {
          // New sample - create with basic info only (no analysis data yet)
          return {
            ...row,
            // Don't set analysedBy/analysedAt for new samples - they haven't been analysed yet
            analysedBy: undefined,
            analysedAt: undefined,
          };
        }
      });

      // Update the job with the new samples array
      await clientSuppliedJobsService.update(jobId, {
        samples: sampleData,
      });

      console.log("Samples saved to job");

      // Refresh the samples list
      await fetchSampleItems();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving samples:", error);
    }
  };

  const compressFile = async (file) => {
    const fileSizeKB = file.size / 1024;

    // If file is under 50KB, return as is
    if (fileSizeKB <= 50) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // If it's an image, use the image compression utility
    if (file.type.startsWith("image/")) {
      try {
        return await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.75,
          maxSizeKB: 50,
        });
      } catch (error) {
        console.error("Error compressing image:", error);
        throw error;
      }
    }

    // For PDFs and other files over 50KB, we'll still upload but warn the user
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const generateCOCFilename = (file, job) => {
    // Get project ID
    const projectID = job?.projectId?.projectID || "UNKNOWN";
    
    // Get sample receipt date and format it (dd-mm-yyyy for filename)
    let dateStr = "";
    if (job?.sampleReceiptDate) {
      const date = new Date(job.sampleReceiptDate);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      dateStr = `${day}-${month}-${year}`;
    } else {
      dateStr = "NO-DATE";
    }
    
    // Get file extension from original file name, or derive from MIME type
    let fileExtension = "";
    if (file.name && file.name.includes(".")) {
      fileExtension = file.name.split(".").pop().toLowerCase();
    } else {
      // Fallback to MIME type mapping
      const mimeToExt = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      fileExtension = mimeToExt[file.type] || "file";
    }
    
    // Generate filename: {ProjectID}-Chain of Custody-{SampleReceiptDate}.{ext}
    return `${projectID}-Chain of Custody-${dateStr}.${fileExtension}`;
  };

  /** Normalize chainOfCustody to array (supports legacy single object). */
  const getCOCItems = (jobObj) => {
    const coc = jobObj?.chainOfCustody;
    if (!coc) return [];
    return Array.isArray(coc) ? coc : [coc];
  };

  const handleCOCUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      setSnackbar({
        open: true,
        message: "Please upload a PDF or image file (JPEG, PNG, WEBP)",
        severity: "error",
      });
      return;
    }

    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      const maxSizeMB = 5;
      if (file.size > maxSizeMB * 1024 * 1024) {
        setSnackbar({
          open: true,
          message: `File size exceeds ${maxSizeMB}MB. Please choose a smaller file.`,
          severity: "error",
        });
        return;
      }
    }

    try {
      setUploadingCOC(true);
      const compressedFile = await compressFile(file);
      const existingItems = getCOCItems(job);

      let fileName = generateCOCFilename(file, job);
      if (existingItems.length > 0) {
        const ext = fileName.includes(".") ? fileName.split(".").pop() : "jpg";
        const base = fileName.replace(/\.[^.]+$/, "") || fileName;
        fileName = `${base}-${existingItems.length + 1}.${ext}`;
      }

      const fileSizeBytes = Math.round((compressedFile.length * 3) / 4);
      const newItem = {
        fileName,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        data: compressedFile,
        fileSizeBytes,
      };
      const updatedItems = [...existingItems, newItem];

      await clientSuppliedJobsService.update(jobId, {
        chainOfCustody: updatedItems,
      });
      await fetchJobDetails();

      setSnackbar({
        open: true,
        message: "Chain of Custody form uploaded successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("Error uploading COC:", error);
      setSnackbar({
        open: true,
        message: "Failed to upload Chain of Custody form",
        severity: "error",
      });
    } finally {
      setUploadingCOC(false);
      event.target.value = "";
    }
  };

  const handleDownloadCOC = (itemOrIndex) => {
    const items = getCOCItems(job);
    const item =
      itemOrIndex === undefined
        ? items[0]
        : typeof itemOrIndex === "number"
          ? items[itemOrIndex]
          : itemOrIndex;
    if (!item?.data) return;

    try {
      const byteString = atob(item.data.split(",")[1]);
      const mimeString = item.data
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.fileName || "chain-of-custody";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading COC:", error);
      setSnackbar({
        open: true,
        message: "Failed to download Chain of Custody form",
        severity: "error",
      });
    }
  };

  const handleDeleteCOC = async () => {
    try {
      await clientSuppliedJobsService.update(jobId, {
        chainOfCustody: null,
      });
      await fetchJobDetails();
      setCocDialogOpen(false);
      setCocClickedIndex(null);
      setSnackbar({
        open: true,
        message: "Chain of Custody form removed",
        severity: "success",
      });
    } catch (error) {
      console.error("Error deleting COC:", error);
      setSnackbar({
        open: true,
        message: "Failed to remove Chain of Custody form",
        severity: "error",
      });
    }
  };

  const handleDeleteCOCItem = async (index) => {
    const items = getCOCItems(job);
    const nextItems = items.filter((_, i) => i !== index);
    try {
      await clientSuppliedJobsService.update(jobId, {
        chainOfCustody: nextItems.length === 0 ? null : nextItems,
      });
      await fetchJobDetails();
      setCocClickedIndex(null);
      setSnackbar({
        open: true,
        message: "Item removed from Chain of Custody",
        severity: "success",
      });
    } catch (error) {
      console.error("Error removing COC item:", error);
      setSnackbar({
        open: true,
        message: "Failed to remove item",
        severity: "error",
      });
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center">
            Loading job details...
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!job) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h6" align="center" color="error">
            Job not found
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToJobs}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            {location.pathname.startsWith("/laboratory-services/ld-supplied") ||
            location.pathname.startsWith("/fibre-id/ld-supplied")
              ? "L&D Supplied Jobs"
              : "Client Supplied Jobs"}
          </Link>
        </Breadcrumbs>

        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                Sample Items - {job.projectId?.name || "Unnamed Project"}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Project ID: {job.projectId?.projectID || "N/A"} | Client:{" "}
                {job.projectId?.client?.name || "Unknown Client"} | Sample
                Receipt Date:{" "}
                {job.sampleReceiptDate
                  ? new Date(job.sampleReceiptDate).toLocaleDateString("en-GB")
                  : "N/A"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button
                variant="contained"
                startIcon={samples.length > 0 ? <EditIcon /> : <AddIcon />}
                onClick={handleOpenModal}
              >
                {samples.length > 0 ? "Edit Samples" : "Add Samples"}
              </Button>

              {/* Upload/View COC Button - opens same modal as ClientSuppliedJobs */}
              <Button
                variant="outlined"
                startIcon={
                  getCOCItems(job).length > 0 ? <DescriptionIcon /> : <UploadFileIcon />
                }
                onClick={() => {
                  setCocClickedIndex(null);
                  setCocDialogOpen(true);
                }}
                disabled={uploadingCOC}
              >
                {getCOCItems(job).length > 0
                  ? location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                    location.pathname.startsWith("/fibre-id/ld-supplied")
                    ? "View/Edit COC/Site sheets"
                    : "View/Edit COC"
                  : uploadingCOC
                  ? "Uploading..."
                  : location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                    location.pathname.startsWith("/fibre-id/ld-supplied")
                  ? "Upload COC/Site sheets"
                  : "Upload COC"}
              </Button>

              {/* Analysis Status Chip */}
              {samples.length > 0 &&
                (() => {
                  // Determine if all samples are analysed based on job type
                  const isAllAnalysisComplete =
                    job.jobType === "Fibre ID"
                      ? samples.every(
                          (sample) =>
                            sample.analysisData &&
                            sample.analysisData.isAnalysed === true
                        )
                      : samples.every(
                          (sample) =>
                            sample.analysisData &&
                            sample.analysisData.fieldsCounted !== undefined &&
                            sample.analysedAt
                        );

                  return (
                    <Chip
                      label={
                        isAllAnalysisComplete
                          ? "Analysis Complete"
                          : "Analysis In Progress"
                      }
                      color={isAllAnalysisComplete ? "success" : "warning"}
                      size="medium"
                      sx={{ ml: 2 }}
                    />
                  );
                })()}
            </Box>
          </Box>
        </Box>
        {/* Sample Items Table */}
        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Lab Reference
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    {location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                    location.pathname.startsWith("/fibre-id/ld-supplied")
                      ? "L&D Sample Reference"
                      : "Client Reference"}
                  </TableCell>
                  {job.jobType !== "Fibre ID" && (
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Cowl Number
                    </TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSamples.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={job.jobType !== "Fibre ID" ? 3 : 2}
                      align="center"
                    >
                      No samples found for this job. Click 'Add Samples' to get
                      started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSamples.map((sample, filteredIndex) => {
                    // Find the actual index in the original samples array
                    const actualIndex = samples.findIndex(
                      (s) => s.labReference === sample.labReference
                    );
                    return (
                      <TableRow key={actualIndex} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: "medium" }}
                          >
                            {formatLabReferenceForDisplay(sample.labReference)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {sample.clientReference || "N/A"}
                          </Typography>
                        </TableCell>
                        {job.jobType !== "Fibre ID" && (
                          <TableCell>
                            <Typography variant="body2">
                              {sample.cowlNumber || "N/A"}
                            </Typography>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Analysis Button */}
        {samples.length > 0 && (
          <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => {
                const basePath = location.pathname.startsWith("/laboratory-services/ld-supplied")
                  ? "/laboratory-services/ld-supplied"
                  : location.pathname.startsWith("/fibre-id/ld-supplied")
                    ? "/fibre-id/ld-supplied"
                    : location.pathname.startsWith("/client-supplied")
                      ? "/client-supplied"
                      : "/fibre-id/client-supplied";

                // For Fibre ID jobs, navigate to first sample's analysis page
                // For Fibre Count jobs, navigate to bulk analysis page
                if (job.jobType === "Fibre ID") {
                  // Ensure we have at least one sample before navigating
                  if (samples.length > 0) {
                    const targetPath = `${basePath}/${jobId}/sample/0/analysis`;
                    console.log(
                      "Navigating to Fibre ID analysis:",
                      targetPath,
                      { jobId, basePath, samplesCount: samples.length }
                    );
                    navigate(targetPath);
                  } else {
                    console.warn("Cannot navigate: No samples available");
                  }
                } else {
                  const targetPath = `${basePath}/${jobId}/analysis`;
                  console.log(
                    "Navigating to Fibre Count analysis:",
                    targetPath
                  );
                  navigate(targetPath);
                }
              }}
              disabled={job.jobType === "Fibre ID" && samples.length === 0}
              sx={{
                minWidth: 200,
                backgroundColor: "#1976d2", // Blue color
                "&:hover": {
                  backgroundColor: "#1565c0", // Darker blue on hover
                },
              }}
            >
              {samples.every(
                (sample) =>
                  sample.analysedAt ||
                  (sample.analysisData && sample.analysisData.analysedAt)
              )
                ? "Edit Analysis"
                : "Analysis"}
            </Button>
          </Box>
        )}

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>

        {/* COC View/Edit Dialog - matches ClientSuppliedJobs Upload COC modal */}
        <Dialog
          open={cocDialogOpen}
          onClose={() => {
            setCocDialogOpen(false);
            setCocClickedIndex(null);
          }}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">
                {location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                location.pathname.startsWith("/fibre-id/ld-supplied")
                  ? "Chain of Custody / Site Sheets"
                  : "Chain of Custody"}
              </Typography>
              <MuiIconButton
                onClick={() => {
                  setCocDialogOpen(false);
                  setCocClickedIndex(null);
                }}
              >
                <CloseIcon />
              </MuiIconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            {(() => {
              const cocItems = getCOCItems(job);
              return (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {cocItems.length === 0
                      ? (location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                         location.pathname.startsWith("/fibre-id/ld-supplied")
                          ? "No Chain of Custody / Site Sheets files uploaded yet. Add one or more images or a PDF."
                          : "No Chain of Custody files uploaded yet. Add one or more images or a PDF.")
                      : `${cocItems.length} file${cocItems.length !== 1 ? "s" : ""} uploaded. Click an image to see file size.`}
                  </Typography>

                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<UploadFileIcon />}
                      disabled={uploadingCOC}
                      size="small"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingCOC ? "Uploading..." : "Upload File"}
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={uploadingCOC}
                      size="small"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      {uploadingCOC ? "Uploading..." : "Take Photo"}
                    </Button>
                    {cocItems.length > 0 && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDeleteCOC()}
                        size="small"
                      >
                        Remove all
                      </Button>
                    )}
                  </Box>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {cocItems.map((item, index) => {
                      const isImage = item.fileType?.startsWith("image/");
                      const sizeKB =
                        item.fileSizeBytes != null
                          ? (item.fileSizeBytes / 1024).toFixed(1)
                          : getBase64SizeKB(item.data).toFixed(1);
                      const showSize = cocClickedIndex === index;
                      return (
                        <Box
                          key={index}
                          sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            p: 1,
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "flex-start",
                            gap: 1,
                          }}
                        >
                          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flex: "1 1 200px" }}>
                            {isImage ? (
                              <Box
                                sx={{
                                  flex: "0 0 auto",
                                  maxWidth: 160,
                                  maxHeight: 160,
                                  borderRadius: 1,
                                  overflow: "hidden",
                                  backgroundColor: "#f5f5f5",
                                  cursor: "pointer",
                                  "&:hover": { opacity: 0.9 },
                                }}
                                onClick={() => {
                                  setCocClickedIndex(showSize ? null : index);
                                }}
                                title="Click to show file size"
                              >
                                <img
                                  src={item.data}
                                  alt={item.fileName || "COC"}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                              </Box>
                            ) : (
                              <Box
                                sx={{
                                  width: 80,
                                  height: 80,
                                  borderRadius: 1,
                                  bgcolor: "#f5f5f5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  "&:hover": { bgcolor: "#e8e8e8" },
                                }}
                                onClick={() => handleDownloadCOC(item)}
                              >
                                <DescriptionIcon sx={{ fontSize: 40, color: "primary.main" }} />
                              </Box>
                            )}
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" noWrap title={item.fileName}>
                                {item.fileName || `File ${index + 1}`}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mt: 0.5, fontWeight: 500 }}>
                                File size: {sizeKB} KB
                              </Typography>
                              {item.uploadedAt && (
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(item.uploadedAt).toLocaleString("en-GB")}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<DownloadIcon />}
                              onClick={() => handleDownloadCOC(index)}
                            >
                              Download
                            </Button>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteCOCItem(index)}
                              title="Remove this file"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                            {isImage && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  setCocFullScreenIndex(index);
                                  setCocFullScreenOpen(true);
                                }}
                              >
                                Full size
                              </Button>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>

                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      handleCOCUpload(e);
                    }}
                  />
                  <input
                    type="file"
                    hidden
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      handleCOCUpload(e);
                    }}
                  />
                </>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Full Screen COC Viewer - matches ClientSuppliedJobs, supports multiple images */}
        <Dialog
          open={cocFullScreenOpen}
          onClose={() => setCocFullScreenOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              height: "90vh",
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">
                {(() => {
                  const items = getCOCItems(job);
                  const item = items[cocFullScreenIndex];
                  const total = items.length;
                  const label = item?.fileName || `Image ${cocFullScreenIndex + 1}`;
                  return total > 1
                    ? `Chain of Custody – ${label} (${cocFullScreenIndex + 1} of ${total})`
                    : `Chain of Custody – ${label}`;
                })()}
              </Typography>
              <MuiIconButton onClick={() => setCocFullScreenOpen(false)}>
                <CloseIcon />
              </MuiIconButton>
            </Box>
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: 2,
            }}
          >
            {(() => {
              const items = getCOCItems(job);
              const item = items[cocFullScreenIndex];
              if (!item?.data) return null;
              if (item.fileType?.startsWith("image/")) {
                return (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", height: "100%" }}>
                    {items.length > 1 && (
                      <IconButton
                        disabled={cocFullScreenIndex <= 0}
                        onClick={() => setCocFullScreenIndex((i) => Math.max(0, i - 1))}
                        sx={{ flexShrink: 0 }}
                      >
                        <ArrowBackIcon />
                      </IconButton>
                    )}
                    <img
                      src={item.data}
                      alt={item.fileName || "Chain of Custody"}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                        flex: 1,
                      }}
                    />
                    {items.length > 1 && (
                      <IconButton
                        disabled={cocFullScreenIndex >= items.length - 1}
                        onClick={() =>
                          setCocFullScreenIndex((i) => Math.min(items.length - 1, i + 1))
                        }
                        sx={{ flexShrink: 0 }}
                      >
                        <ArrowBackIcon sx={{ transform: "rotate(180deg)" }} />
                      </IconButton>
                    )}
                  </Box>
                );
              }
              return null;
            })()}
          </DialogContent>
        </Dialog>

        {/* Add Samples Modal */}
        <Dialog
          open={openModal}
          onClose={handleCloseModal}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">
                {samples.length > 0 ? "Edit Samples" : "Add Samples"}
              </Typography>
              <MuiIconButton onClick={handleCloseModal}>
                <CloseIcon />
              </MuiIconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {samples.length > 0
                ? `Edit sample references for project ${job.projectId?.projectID}`
                : `Add sample references for project ${job.projectId?.projectID}`}
            </Typography>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      L&D Lab Reference
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      {location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                      location.pathname.startsWith("/fibre-id/ld-supplied")
                        ? "L&D Sample Reference"
                        : "Client Reference"}
                    </TableCell>
                    {job.jobType !== "Fibre ID" && (
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Cowl Number
                      </TableCell>
                    )}
                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          value={row.labReference}
                          onChange={(e) =>
                            handleRowChange(
                              index,
                              "labReference",
                              e.target.value
                            )
                          }
                          placeholder={`${job.projectId?.projectID}-Lab${
                            index + 1
                          }`}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          value={row.clientReference}
                          onChange={(e) =>
                            handleRowChange(
                              index,
                              "clientReference",
                              e.target.value
                            )
                          }
                          placeholder={
                            location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                            location.pathname.startsWith("/fibre-id/ld-supplied")
                              ? "Enter L&D sample reference"
                              : "Enter client reference"
                          }
                        />
                      </TableCell>
                      {job.jobType !== "Fibre ID" && (
                        <TableCell>
                          <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={row.cowlNumber}
                            onChange={(e) =>
                              handleRowChange(
                                index,
                                "cowlNumber",
                                e.target.value
                              )
                            }
                            placeholder="Enter cowl number"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() => handleRemoveRow(index)}
                          disabled={sampleRows.length === 1}
                          title="Delete Sample"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddRow}
              >
                Add Another Sample
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleConfirmSamples}
              disabled={sampleRows.some(
                (row) => !row.labReference.trim() || !row.clientReference.trim()
              )}
            >
              Confirm All Samples
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
};

export default ClientSuppliedSamples;
