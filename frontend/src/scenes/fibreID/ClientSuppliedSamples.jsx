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
import { compressImage } from "../../utils/imageCompression";

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

  const filteredSamples = samples.sort((a, b) => {
    // Sort by labReference in ascending order
    const labRefA = a.labReference || "";
    const labRefB = b.labReference || "";
    return labRefA.localeCompare(labRefB);
  });

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
      // Start with one empty row with auto-generated lab reference
      setSampleRows([
        {
          labReference: `${job?.projectId?.projectID || "PROJ"}-1`,
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
    const existingLabRefs = new Set([
      ...sampleRows.map((row) => row.labReference),
      ...samples.map((sample) => sample.labReference),
    ]);

    // Find the next available number
    let newRowNumber = 1;
    while (
      existingLabRefs.has(
        `${job?.projectId?.projectID || "PROJ"}-${newRowNumber}`
      )
    ) {
      newRowNumber++;
    }

    const newLabReference = `${
      job?.projectId?.projectID || "PROJ"
    }-${newRowNumber}`;
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
      // Update lab references for remaining rows
      const updatedRows = newRows.map((row, i) => ({
        ...row,
        labReference: `${job?.projectId?.projectID || "PROJ"}-${i + 1}`,
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

  const handleCOCUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
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

    // Validate file size (max 5MB before compression)
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setSnackbar({
        open: true,
        message: `File size exceeds ${maxSizeMB}MB. Please choose a smaller file.`,
        severity: "error",
      });
      return;
    }

    try {
      setUploadingCOC(true);
      const compressedFile = await compressFile(file);

      // Generate filename using naming convention
      const fileName = generateCOCFilename(file, job);

      // Update job with COC data
      await clientSuppliedJobsService.update(jobId, {
        chainOfCustody: {
          fileName: fileName,
          fileType: file.type,
          uploadedAt: new Date().toISOString(),
          data: compressedFile,
        },
      });

      // Refresh job details to show the uploaded COC
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
      // Reset the file input
      event.target.value = "";
    }
  };

  const handleDownloadCOC = () => {
    if (!job?.chainOfCustody?.data) return;

    try {
      // Convert base64 to blob
      const byteString = atob(job.chainOfCustody.data.split(",")[1]);
      const mimeString = job.chainOfCustody.data
        .split(",")[0]
        .split(":")[1]
        .split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = job.chainOfCustody.fileName || "chain-of-custody.pdf";
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

      // Refresh job details
      await fetchJobDetails();

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

              {/* Upload/View COC Button */}
              <Button
                variant="outlined"
                startIcon={
                  job?.chainOfCustody ? <DescriptionIcon /> : <UploadFileIcon />
                }
                onClick={() => setCocDialogOpen(true)}
                disabled={uploadingCOC}
              >
                {job?.chainOfCustody
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
                <TableRow>
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
                            {sample.labReference}
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

        {/* COC View/Edit Dialog */}
        <Dialog
          open={cocDialogOpen}
          onClose={() => setCocDialogOpen(false)}
          maxWidth="sm"
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
                  ? "Chain of Custody/Sample Sheets"
                  : "Chain of Custody"}
              </Typography>
              <MuiIconButton onClick={() => setCocDialogOpen(false)}>
                <CloseIcon />
              </MuiIconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {job?.chainOfCustody
                ? `File: ${job.chainOfCustody.fileName}`
                : location.pathname.startsWith("/laboratory-services/ld-supplied") ||
                  location.pathname.startsWith("/fibre-id/ld-supplied")
                ? "No Chain of Custody/Sample Sheets file uploaded yet."
                : "No Chain of Custody file uploaded yet."}
              <br />
              {job?.chainOfCustody?.uploadedAt &&
                `Uploaded: ${new Date(
                  job.chainOfCustody.uploadedAt
                ).toLocaleString("en-GB")}`}
            </Typography>

            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {/* Action Buttons - Left Side */}
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  minWidth: "160px",
                }}
              >
                {job?.chainOfCustody && (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleDownloadCOC}
                      size="small"
                    >
                      Download
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => {
                        handleDeleteCOC();
                        setCocDialogOpen(false);
                      }}
                      size="small"
                    >
                      Remove
                    </Button>
                  </>
                )}
                <Button
                  variant="contained"
                  startIcon={<UploadFileIcon />}
                  disabled={uploadingCOC}
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingCOC
                    ? "Uploading..."
                    : job?.chainOfCustody
                    ? "Replace"
                    : "Upload File"}
                </Button>
                <Button
                  variant="outlined"
                  disabled={uploadingCOC}
                  size="small"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  {uploadingCOC ? "Uploading..." : "Take Photo"}
                </Button>
              </Box>

              {/* Preview - Right Side */}
              {job?.chainOfCustody && (
                <Box sx={{ flex: 1, minWidth: "220px" }}>
                  {/* Preview COC if it's an image */}
                  {job.chainOfCustody.fileType?.startsWith("image/") && (
                    <Box
                      sx={{
                        border: "1px solid #ddd",
                        borderRadius: 1,
                        overflow: "hidden",
                        maxHeight: "400px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#f5f5f5",
                        cursor: "pointer",
                        "&:hover": {
                          opacity: 0.9,
                        },
                      }}
                      onClick={() => setCocFullScreenOpen(true)}
                      title="Click to view full size"
                    >
                      <img
                        src={job.chainOfCustody.data}
                        alt="Chain of Custody"
                        style={{
                          maxHeight: "400px",
                          maxWidth: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />
                    </Box>
                  )}

                  {/* Show PDF icon for PDFs */}
                  {job.chainOfCustody.fileType === "application/pdf" && (
                    <Box
                      sx={{
                        p: 4,
                        border: "1px solid #ddd",
                        borderRadius: 1,
                        textAlign: "center",
                        backgroundColor: "#f5f5f5",
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "#e8e8e8",
                        },
                      }}
                      onClick={handleDownloadCOC}
                      title="Click to download PDF"
                    >
                      <DescriptionIcon
                        sx={{ fontSize: 60, color: "#1976d2", mb: 1 }}
                      />
                      <Typography variant="body2">
                        PDF Document
                        <br />
                        Click to download
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

            <input
              type="file"
              hidden
              ref={fileInputRef}
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                handleCOCUpload(e);
                setCocDialogOpen(false);
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
                setCocDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Full Screen COC Viewer */}
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
                Chain of Custody - {job?.chainOfCustody?.fileName}
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
            {job?.chainOfCustody?.fileType?.startsWith("image/") && (
              <img
                src={job.chainOfCustody.data}
                alt="Chain of Custody Full Size"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            )}
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
                  <TableRow>
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
                          placeholder={`${job.projectId?.projectID}-${
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
