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
  MenuItem,
} from "@mui/material";
import {
  Search as SearchIcon,
  Add as AddIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import {
  clientSuppliedJobsService,
  sampleItemsService,
  userService,
} from "../../services/api";
import { generateFibreIDReport } from "../../utils/generateFibreIDReport";

const ClientSuppliedSamples = () => {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [sampleRows, setSampleRows] = useState([
    { labReference: "", clientReference: "" },
  ]);
  const [analyst, setAnalyst] = useState("");
  const [analysisDate, setAnalysisDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [users, setUsers] = useState([]);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [completingJob, setCompletingJob] = useState(false);

  useEffect(() => {
    // Reset data when jobId changes
    if (jobId && typeof jobId === "string" && jobId !== "[object Object]") {
      setJob(null);
      setSamples([]);
      setLoading(true);

      // Load data for the new jobId
      fetchJobDetails();
      fetchSampleItems();
      fetchUsers();
    } else if (jobId === "[object Object]") {
      setLoading(false);
      // Redirect back to the jobs list if we have an invalid jobId
      navigate("/fibre-id/client-supplied");
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
      // Get the job first to get the projectId
      const jobResponse = await clientSuppliedJobsService.getById(jobId);
      const projectId =
        jobResponse.data.projectId._id || jobResponse.data.projectId;

      const response = await sampleItemsService.getAll({ projectId });
      setSamples(response.data || []);
    } catch (error) {
      console.error("Error fetching sample items:", error);
      setSamples([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await userService.getAll();
      setUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    }
  };

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
    navigate("/fibre-id/client-supplied");
  };

  const handleBackToHome = () => {
    navigate("/fibre-id");
  };

  const handleOpenModal = () => {
    setOpenModal(true);

    // If there are existing samples, show them in the modal
    if (samples.length > 0) {
      const existingRows = samples.map((sample) => ({
        labReference: sample.labReference,
        clientReference: sample.clientReference,
      }));
      setSampleRows(existingRows);
      // Set analyst and analysis date from first sample if available
      if (samples[0].analyzedBy) {
        // Handle both string and object formats for analyzedBy
        if (typeof samples[0].analyzedBy === "string") {
          setAnalyst(samples[0].analyzedBy);
        } else if (
          samples[0].analyzedBy.firstName &&
          samples[0].analyzedBy.lastName
        ) {
          setAnalyst(
            samples[0].analyzedBy.firstName +
              " " +
              samples[0].analyzedBy.lastName
          );
        } else {
          setAnalyst("");
        }
      }
      if (samples[0].analyzedAt) {
        setAnalysisDate(
          new Date(samples[0].analyzedAt).toISOString().split("T")[0]
        );
      }
    } else {
      // Start with one empty row with auto-generated lab reference
      setSampleRows([
        {
          labReference: `${job?.projectId?.projectID || "PROJ"}-1`,
          clientReference: "",
        },
      ]);
      setAnalyst("");
      setAnalysisDate(new Date().toISOString().split("T")[0]);
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
      // Get the projectId from the job
      const projectId = job.projectId._id || job.projectId;

      // Create a map of existing samples by labReference for quick lookup
      const existingSamplesMap = new Map();
      samples.forEach((sample) => {
        existingSamplesMap.set(sample.labReference, sample);
      });

      // Prepare sample data with analyst and analysis date
      const sampleData = sampleRows.map((row) => {
        const existingSample = existingSamplesMap.get(row.labReference);

        // If sample exists, preserve its analysis data and only update basic info
        if (existingSample) {
          return {
            ...existingSample,
            labReference: row.labReference,
            clientReference: row.clientReference,
            // Preserve existing analysis data
            analysisData: existingSample.analysisData,
            analysisResult: existingSample.analysisResult,
            // Update analyst info only if not already set
            analyzedBy: existingSample.analyzedBy || analyst || undefined,
            analyzedAt:
              existingSample.analyzedAt ||
              (analysisDate ? new Date(analysisDate) : undefined),
          };
        } else {
          // New sample - create with basic info
          return {
            ...row,
            analyzedBy: analyst || undefined,
            analyzedAt: analysisDate ? new Date(analysisDate) : undefined,
          };
        }
      });

      // Update existing samples and create new ones
      const updatePromises = sampleData.map(async (sampleData) => {
        const existingSample = existingSamplesMap.get(sampleData.labReference);

        if (existingSample) {
          // Update existing sample
          return await sampleItemsService.update(
            existingSample._id,
            sampleData
          );
        } else {
          // Create new sample
          return await sampleItemsService.create({
            projectId,
            ...sampleData,
          });
        }
      });

      const results = await Promise.all(updatePromises);
      console.log("Samples updated/created:", results);

      // Refresh the samples list
      await fetchSampleItems();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving samples:", error);
    }
  };

  const handleDeleteSample = async (sampleId) => {
    try {
      await sampleItemsService.delete(sampleId);
      // Remove the deleted sample from the local state
      setSamples(samples.filter((sample) => sample._id !== sampleId));
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

  const handleGeneratePDF = async () => {
    try {
      setGeneratingPDF(true);

      // Generate the PDF using pdfMake
      await generateFibreIDReport({
        job: job,
        sampleItems: samples,
        openInNewTab: false,
      });

      console.log("Client supplied fibre ID PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      // You might want to show a snackbar or alert here
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleCompleteJob = async () => {
    try {
      setCompletingJob(true);

      const response = await clientSuppliedJobsService.update(jobId, {
        status: "Completed",
      });

      // Update the local job state
      setJob((prevJob) => ({ ...prevJob, status: "Completed" }));

      console.log("Job completed successfully");
      // You might want to show a success message here
    } catch (error) {
      console.error("Error completing job:", error);
      // You might want to show an error message here
    } finally {
      setCompletingJob(false);
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
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Fibre ID Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToJobs}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Client Supplied Jobs
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={() =>
              navigate(`/fibre-id/client-supplied/${jobId}/samples`)
            }
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Sample Items
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
                {job.projectId?.client?.name || "Unknown Client"} | Sample Date:{" "}
                {job.projectId?.d_Date
                  ? new Date(job.projectId.d_Date).toLocaleDateString("en-GB")
                  : job.projectId?.createdAt
                  ? new Date(job.projectId.createdAt).toLocaleDateString(
                      "en-GB"
                    )
                  : "N/A"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchSampleItems}
                sx={{ ml: 2 }}
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={handleGeneratePDF}
                disabled={generatingPDF || samples.length === 0}
                sx={{ ml: 2 }}
              >
                {generatingPDF ? "Generating PDF..." : "Generate PDF"}
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenModal}
              >
                Add Samples
              </Button>
              {job?.status !== "Completed" && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleCompleteJob}
                  disabled={completingJob || samples.length === 0}
                  sx={{ ml: 2 }}
                >
                  {completingJob ? "Completing..." : "Complete Job"}
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by lab reference, client reference, or sample description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
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
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Sample Description
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    Analysis Result
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSamples.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {searchTerm
                        ? "No samples match your search criteria"
                        : "No samples found for this job. Click 'Add Samples' to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSamples.map((sample) => (
                    <TableRow key={sample.id} hover>
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
                      <TableCell>
                        <Typography variant="body2">
                          {sample.sampleDescription || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sample.analysisResult || "Pending"}
                          color={sample.analysisResult ? "success" : "warning"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          onClick={() =>
                            navigate(`/fibre-id/analysis/${sample._id}`)
                          }
                          sx={{ mr: 1 }}
                        >
                          Analysis
                        </Button>
                        <IconButton
                          color="error"
                          size="small"
                          title="Delete Sample"
                          onClick={() => handleDeleteSample(sample._id)}
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
        </Paper>

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
              <Typography variant="h6">Add Samples</Typography>
              <MuiIconButton onClick={handleCloseModal}>
                <CloseIcon />
              </MuiIconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add sample references for project {job.projectId?.projectID}
            </Typography>

            {/* Analyst and Analysis Date Fields */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Analysis Details
              </Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField
                  select
                  label="Analyst"
                  variant="outlined"
                  size="small"
                  value={analyst}
                  onChange={(e) => setAnalyst(e.target.value)}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="">
                    <em>Select an analyst</em>
                  </MenuItem>
                  {users.map((user) => (
                    <MenuItem
                      key={user._id}
                      value={`${user.firstName} ${user.lastName}`}
                    >
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Analysis Date"
                  type="date"
                  variant="outlined"
                  size="small"
                  value={analysisDate}
                  onChange={(e) => setAnalysisDate(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>

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
