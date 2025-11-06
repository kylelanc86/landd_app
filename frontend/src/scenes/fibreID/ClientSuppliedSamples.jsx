import React, { useState, useEffect } from "react";
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
  InputAdornment,
  Breadcrumbs,
  Link,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton as MuiIconButton,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Science as ScienceIcon,
} from "@mui/icons-material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { clientSuppliedJobsService } from "../../services/api";

const ClientSuppliedSamples = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [sampleRows, setSampleRows] = useState([
    { labReference: "", clientReference: "", cowlNumber: "" },
  ]);

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
      const basePath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";
      navigate(basePath);
    }
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

  const filteredSamples = samples
    .filter(
      (sample) =>
        sample.labReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sample.clientReference
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        sample.sampleDescription
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      // Sort by labReference in ascending order
      const labRefA = a.labReference || "";
      const labRefB = b.labReference || "";
      return labRefA.localeCompare(labRefB);
    });

  const handleBackToJobs = () => {
    // Use the appropriate route based on current location
    const basePath = location.pathname.startsWith("/client-supplied")
      ? "/client-supplied"
      : "/fibre-id/client-supplied";
    navigate(basePath);
  };

  const handleBackToHome = () => {
    // Navigate back based on current location
    if (location.pathname.startsWith("/client-supplied")) {
      navigate("/client-supplied");
    } else {
      navigate("/fibre-id");
    }
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
            // Only preserve analyzedBy/analyzedAt if analysis was actually completed
            // (i.e., if analysisData exists, meaning analysis was finalized)
            analyzedBy: existingSample.analysisData
              ? existingSample.analyzedBy
              : undefined,
            analyzedAt: existingSample.analysisData
              ? existingSample.analyzedAt
              : undefined,
          };
        } else {
          // New sample - create with basic info only (no analysis data yet)
          return {
            ...row,
            // Don't set analyzedBy/analyzedAt for new samples - they haven't been analyzed yet
            analyzedBy: undefined,
            analyzedAt: undefined,
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

  const handleDeleteSample = async (index) => {
    try {
      // Remove the sample at the given index from the job's samples array
      const updatedSamples = samples.filter((_, i) => i !== index);
      await clientSuppliedJobsService.update(jobId, {
        samples: updatedSamples,
      });
      // Refresh the samples list
      await fetchSampleItems();
    } catch (error) {
      console.error("Error deleting sample:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "in_progress":
        return "info";
      case "analyzed":
        return "success";
      default:
        return "default";
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
            Client Supplied Jobs
          </Link>
          <Typography
            variant="body1"
            sx={{ display: "flex", alignItems: "center" }}
          >
            Sample Items
          </Typography>
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
              {/* Analysis Status Chip */}
              {samples.length > 0 && (
                <Chip
                  label={
                    samples.every(
                      (sample) =>
                        sample.analysisData &&
                        sample.analysisData.fieldsCounted !== undefined &&
                        sample.analyzedAt
                    )
                      ? "Analysis Complete"
                      : "Analysis In Progress"
                  }
                  color={
                    samples.every(
                      (sample) =>
                        sample.analysisData &&
                        sample.analysisData.fieldsCounted !== undefined &&
                        sample.analyzedAt
                    )
                      ? "success"
                      : "warning"
                  }
                  size="medium"
                  sx={{ ml: 2 }}
                />
              )}
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
                    Client Reference
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
                      {searchTerm
                        ? "No samples match your search criteria"
                        : "No samples found for this job. Click 'Add Samples' to get started."}
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
                const basePath = location.pathname.startsWith(
                  "/client-supplied"
                )
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
                  sample.analyzedAt ||
                  (sample.analysisData && sample.analysisData.analyzedAt)
              )
                ? "Edit Analysis"
                : "Analysis"}
            </Button>
          </Box>
        )}

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
                      Client Reference
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
                          placeholder="Enter client reference"
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
