import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Stack,
  InputAdornment,
  useTheme,
  Breadcrumbs,
  Link,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import AssessmentIcon from "@mui/icons-material/Assessment";
import MicIcon from "@mui/icons-material/Mic";
import DownloadIcon from "@mui/icons-material/Download";
import { sampleService, shiftService } from "../../services/api";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import { formatDate, formatTime } from "../../utils/dateUtils";
import PermissionGate from "../../components/PermissionGate";
import { useAuth } from "../../context/AuthContext";

const SampleList = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [samples, setSamples] = useState([]);
  const [sortField, setSortField] = useState("fullSampleID");
  const [sortAsc, setSortAsc] = useState(true);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(null);
  const [isCompleteDisabled, setIsCompleteDisabled] = useState(true);
  const [nextSampleNumber, setNextSampleNumber] = useState(null);
  const [descriptionOfWorks, setDescriptionOfWorks] = useState("");
  const [descSaveStatus, setDescSaveStatus] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState(null);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [showSamplingCompleteDialog, setShowSamplingCompleteDialog] =
    useState(false);
  const [tempDescription, setTempDescription] = useState("");
  const [showSamplesSubmittedDialog, setShowSamplesSubmittedDialog] =
    useState(false);
  const [submittedBySignature, setSubmittedBySignature] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Check if report is authorized
  const isReportAuthorized = shift?.reportApprovedBy;

  // Function to extract the numeric part from a sample number
  const extractSampleNumber = (sampleNumber) => {
    // Extract just the number part from AM prefix (e.g., "AM1" -> 1)
    const match = sampleNumber?.match(/AM(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  };

  // Function to generate the next sample number
  const generateNextSampleNumber = async (samples, projectID) => {
    if (!projectID) return 1;

    try {
      // Get all samples for the project
      const allSamplesResponse = await sampleService.getByProject(projectID);
      const allSamples = allSamplesResponse.data;
      console.log("All samples for project:", allSamples);

      // Get the highest sample number from all samples in the project
      const highestNumber = Math.max(
        ...allSamples.map((sample) => {
          const number = extractSampleNumber(sample.fullSampleID);
          console.log(`Sample ${sample.fullSampleID} has number ${number}`);
          return number;
        })
      );
      console.log("Highest sample number found:", highestNumber);

      const nextNumber = highestNumber + 1;
      console.log("Next sample number will be:", nextNumber);
      return nextNumber;
    } catch (err) {
      console.error("Error generating next sample number:", err);
      return 1;
    }
  };

  // Load shift and samples data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const shiftResponse = await shiftService.getById(shiftId);
        console.log("Shift response data:", shiftResponse.data);
        setShift(shiftResponse.data);

        // Fetch job data if available
        const jobId = shiftResponse.data?.job?._id || shiftResponse.data?.job;
        if (jobId) {
          console.log("Attempting to fetch job with ID:", jobId);
          try {
            const jobResponse = await asbestosRemovalJobService.getById(jobId);
            console.log("Job response data:", jobResponse.data);
            setJob(jobResponse.data);
          } catch (error) {
            console.log("Could not fetch job data:", error);
            // Try to fetch as air monitoring job as fallback
            try {
              const { jobService } = await import("../../services/api");
              const airMonitoringJobResponse = await jobService.getById(jobId);
              console.log(
                "Air monitoring job response data:",
                airMonitoringJobResponse.data
              );
              setJob(airMonitoringJobResponse.data);
            } catch (airMonitoringError) {
              console.log(
                "Could not fetch air monitoring job data either:",
                airMonitoringError
              );
            }
          }
        } else {
          console.log("No job ID found in shift data");
        }

        const samplesResponse = await sampleService.getByShift(shiftId);
        setSamples(samplesResponse.data || []);

        // Get project ID from shift data
        const projectId = shiftResponse.data?.job?.projectId?.projectID;
        if (projectId) {
          // Fetch all samples for the project to determine next sample number
          const projectSamplesResponse = await sampleService.getByProject(
            projectId
          );
          const allProjectSamples = projectSamplesResponse.data || [];

          // Find the highest sample number
          const highestNumber = allProjectSamples.reduce((max, sample) => {
            const match = sample.fullSampleID?.match(/AM(\d+)$/);
            const number = match ? parseInt(match[1]) : 0;
            return Math.max(max, number);
          }, 0);

          // Set next sample number
          setNextSampleNumber(highestNumber + 1);
        }

        if (shiftResponse.data?.descriptionOfWorks) {
          setDescriptionOfWorks(shiftResponse.data.descriptionOfWorks);
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shiftId]);

  // Re-validate samples whenever samples change
  useEffect(() => {
    if (samples.length > 0) {
      const isValid = validateSamplesComplete(samples);
      setIsCompleteDisabled(!isValid);
    } else {
      setIsCompleteDisabled(true);
    }
  }, [samples]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDelete = (sampleId) => {
    const sample = samples.find((s) => s._id === sampleId);
    setSampleToDelete(sample);
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!sampleToDelete) return;

    try {
      await sampleService.delete(sampleToDelete._id);
      setSamples(samples.filter((sample) => sample._id !== sampleToDelete._id));
      setSnackbar({
        open: true,
        message: "Sample deleted successfully",
        severity: "success",
      });
    } catch (err) {
      console.error("Error deleting sample:", err);
      setSnackbar({
        open: true,
        message: "Failed to delete sample. Please try again.",
        severity: "error",
      });
    } finally {
      setDeleteConfirmDialogOpen(false);
      setSampleToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialogOpen(false);
    setSampleToDelete(null);
  };

  const handleDownloadCSV = async () => {
    try {
      // Fetch all samples for this shift with complete data
      const samplesResponse = await sampleService.getByShift(shiftId);
      const samples = await Promise.all(
        (samplesResponse.data || []).map(async (sample) => {
          if (!sample.analysis) {
            // Fetch full sample if analysis is missing
            const fullSample = await sampleService.getById(sample._id);
            return fullSample.data;
          }
          return sample;
        })
      );

      // Prepare CSV headers
      const headers = [
        ...Object.keys(samples[0] || {}),
        ...(samples[0]?.analysis ? Object.keys(samples[0].analysis) : []),
        ...(samples[0]?.analysis?.fibreCounts
          ? samples[0].analysis.fibreCounts.map((_, i) => `fibreCount_${i + 1}`)
          : []),
      ];

      // Prepare CSV rows
      const rows = samples.map((sample) => {
        const base = { ...sample };
        const analysis = sample.analysis || {};
        // Flatten fibreCounts if present
        let fibreCounts = {};
        if (Array.isArray(analysis.fibreCounts)) {
          analysis.fibreCounts.forEach((val, i) => {
            fibreCounts[`fibreCount_${i + 1}`] = Array.isArray(val)
              ? val.join("|")
              : val;
          });
        }
        // Merge all fields
        return {
          ...base,
          ...analysis,
          ...fibreCounts,
        };
      });

      // Convert to CSV string
      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((field) =>
              row[field] !== undefined && row[field] !== null
                ? `"${String(row[field]).replace(/"/g, '""')}"`
                : ""
            )
            .join(",")
        ),
      ].join("\r\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${shift?.name || shiftId}_samples.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading CSV:", err);
      setSnackbar({
        open: true,
        message: "Failed to download CSV.",
        severity: "error",
      });
    }
  };

  const filteredSamples = samples;

  const sortedSamples = [...filteredSamples].sort((a, b) => {
    if (sortField === "sampleNumber" || sortField === "fullSampleID") {
      // Extract just the number part from AM prefix (e.g., "AM1" -> 1)
      const aMatch = a.fullSampleID?.match(/AM(\d+)$/);
      const bMatch = b.fullSampleID?.match(/AM(\d+)$/);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
      return sortAsc ? aNum - bNum : bNum - aNum;
    } else {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue < bValue) return sortAsc ? -1 : 1;
      if (aValue > bValue) return sortAsc ? 1 : -1;
      return 0;
    }
  });

  // Add validation function
  const validateSamplesComplete = (samples) => {
    if (!samples || samples.length === 0) {
      console.log("No samples to validate");
      return false; // No samples means not complete
    }

    console.log("Validating samples:", samples.length, "samples");

    const result = samples.every((sample) => {
      // Handle sampler field - use sampler if available, fall back to collectedBy
      const sampler = sample.sampler || sample.collectedBy;

      console.log(`Sample ${sample.fullSampleID}:`, {
        sampleNumber: sample.sampleNumber,
        type: sample.type,
        location: sample.location,
        sampler: sampler,
        pumpNo: sample.pumpNo,
        flowmeter: sample.flowmeter,
        cowlNo: sample.cowlNo,
        filterSize: sample.filterSize,
        startTime: sample.startTime,
        endTime: sample.endTime,
        initialFlowrate: sample.initialFlowrate,
        finalFlowrate: sample.finalFlowrate,
        averageFlowrate: sample.averageFlowrate,
        status: sample.status,
      });

      // If it's a field blank sample, only validate basic required fields
      if (sample.location === "Field blank") {
        const isValid =
          sample.sampleNumber && sample.location && sampler && sample.cowlNo;
        console.log(`Field blank sample validation:`, isValid);
        return isValid;
      }

      // For non-field blank samples, validate all required fields
      const isValid =
        sample.sampleNumber &&
        sample.type &&
        sample.location &&
        sampler &&
        sample.pumpNo &&
        sample.flowmeter &&
        sample.cowlNo &&
        sample.filterSize &&
        sample.startTime &&
        sample.endTime &&
        sample.initialFlowrate &&
        sample.finalFlowrate &&
        sample.averageFlowrate &&
        // Ensure flowrates are valid numbers and not failed
        parseFloat(sample.initialFlowrate) > 0 &&
        parseFloat(sample.finalFlowrate) > 0 &&
        sample.status !== "failed";

      console.log(`Regular sample validation:`, isValid);
      return isValid;
    });

    console.log("Overall validation result:", result);
    return result;
  };

  // Add handleSampleComplete function
  const handleSampleComplete = () => {
    // Set the current description as the temp description for editing
    setTempDescription(descriptionOfWorks);
    setShowSamplingCompleteDialog(true);
  };

  // Handle the actual completion after dialog confirmation
  const handleConfirmSamplingComplete = async () => {
    try {
      // Update the description if it was modified
      if (tempDescription !== descriptionOfWorks) {
        await shiftService.update(shiftId, {
          descriptionOfWorks: tempDescription,
        });
        setDescriptionOfWorks(tempDescription);
        setDescSaveStatus("Saved");
      }

      // Update shift status
      await shiftService.update(shiftId, { status: "sampling_complete" });

      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);

      // Close dialog
      setShowSamplingCompleteDialog(false);
    } catch (error) {
      console.error("Error updating shift status:", error);
      setError("Failed to update shift status. Please try again.");
    }
  };

  // Add handler for Samples Submitted to Lab
  const handleSamplesSubmittedToLab = () => {
    // Automatically set the current user's name
    const userName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : "";
    setSubmittedBySignature(userName);
    setShowSamplesSubmittedDialog(true);
  };

  // Handle the actual submission after dialog confirmation
  const handleConfirmSamplesSubmitted = async () => {
    try {
      const currentDate = new Date().toISOString();
      await shiftService.update(shiftId, {
        status: "samples_submitted_to_lab",
        samplesReceivedDate: currentDate,
        submittedBy: submittedBySignature,
      });
      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);
      // Close dialog
      setShowSamplesSubmittedDialog(false);

      // Navigate to AsbestosRemovalJobDetails page
      const jobId = shiftResponse.data?.job?._id || shiftResponse.data?.job;
      if (jobId) {
        navigate(`/asbestos-removal/jobs/${jobId}/details`);
      }
    } catch (error) {
      setError("Failed to update shift status to 'Samples Submitted to Lab'.");
    }
  };

  const handleAddSample = () => {
    // Reset shift status to ongoing when adding a new sample
    shiftService.update(shiftId, { status: "ongoing" });
    navigate(`/air-monitoring/shift/${shiftId}/samples/new`, {
      state: { nextSampleNumber },
    });
  };

  const handleDescriptionChange = (e) => {
    setDescriptionOfWorks(e.target.value);
    setDescSaveStatus("");
  };

  const saveDescriptionOfWorks = async () => {
    try {
      console.log("Saving description of works:", {
        shiftId,
        descriptionOfWorks,
      });
      const response = await shiftService.update(shiftId, {
        descriptionOfWorks,
      });
      console.log("Save response:", response);
      setDescSaveStatus("Saved");
    } catch (err) {
      console.error("Error saving description of works:", err);
      setDescSaveStatus("Error");
    }
  };

  // Dictation functions
  const startDictation = () => {
    // Check if browser supports speech recognition
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-AU";

      recognition.onstart = () => {
        setIsDictating(true);
        setDictationError("");
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update the description field with the final transcript
        if (finalTranscript) {
          setDescriptionOfWorks(
            (prev) => prev + (prev ? " " : "") + finalTranscript
          );
          setDescSaveStatus(""); // Reset save status when description changes
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setDictationError(`Dictation error: ${event.error}`);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.start();
    } catch (error) {
      console.error("Error starting dictation:", error);
      setDictationError("Failed to start dictation. Please try again.");
    }
  };

  const stopDictation = () => {
    // The recognition will automatically stop, but we can set the state
    setIsDictating(false);
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => {
            const jobId = shift?.job?._id || shift?.job;
            if (jobId) {
              navigate(`/asbestos-removal/jobs/${jobId}/details`);
            } else {
              navigate("/asbestos-removal");
            }
          }}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal Job Details
        </Link>
        <Typography color="text.primary">
          {job?.projectId?.projectID ? `${job.projectId.projectID}: ` : ""}
          {job?.projectName || job?.name || "Loading..."}
        </Typography>
      </Breadcrumbs>

      {/* Authorization Warning */}
      {isReportAuthorized && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          This report was finalised by {shift.reportApprovedBy} on{" "}
          {formatDate(shift.reportIssueDate)}. Contact admin if shift data needs
          revision.
        </Alert>
      )}

      <Typography
        variant="h4"
        sx={{
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 4,
        }}
      >
        {job?.projectId?.projectID ? `${job.projectId.projectID}: ` : ""}
        {job?.projectName || job?.name || "Loading..."} -
        {shift?.name ? `${formatDate(shift.date)}` : "Loading..."}
      </Typography>
      {/* Description of Works Field */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Description of Works
        </Typography>
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TextField
            sx={{ flex: 1 }}
            multiline
            minRows={2}
            maxRows={6}
            value={descriptionOfWorks}
            onChange={handleDescriptionChange}
            placeholder="Enter a description of works for this shift..."
            required
            error={!descriptionOfWorks}
            helperText={
              !descriptionOfWorks ? "Description of works is required" : ""
            }
            disabled={isReportAuthorized}
            InputProps={{
              endAdornment: !isReportAuthorized ? (
                <InputAdornment position="end">
                  <IconButton
                    onClick={isDictating ? stopDictation : startDictation}
                    color={isDictating ? "error" : "primary"}
                    title={isDictating ? "Stop Dictation" : "Start Dictation"}
                    sx={{
                      backgroundColor: isDictating
                        ? theme.palette.error.light
                        : "transparent",
                      "&:hover": {
                        backgroundColor: isDictating
                          ? theme.palette.error.main
                          : theme.palette.action.hover,
                      },
                    }}
                  >
                    <MicIcon />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            }}
          />
          <Button
            variant="contained"
            onClick={saveDescriptionOfWorks}
            disabled={!descriptionOfWorks.trim() || isReportAuthorized}
            sx={{
              backgroundColor: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
              minWidth: 140,
              height: 56, // Match the height of the text field
            }}
          >
            Save Description
          </Button>
        </Box>
        {/* Dictation Status and Errors */}
        {isDictating && (
          <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: "error.main",
                animation: "pulse 1.5s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                  "100%": { opacity: 1 },
                },
              }}
            />
            <Typography variant="caption" color="text.secondary">
              Dictating... Speak clearly into your microphone
            </Typography>
          </Box>
        )}
        {dictationError && (
          <Typography
            variant="caption"
            color="error.main"
            sx={{ mt: 1, display: "block" }}
          >
            {dictationError}
          </Typography>
        )}
        {/* Save Status Messages */}
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 2 }}>
          {descSaveStatus === "Saved" && (
            <Typography variant="caption" color="success.main">
              Description saved successfully
            </Typography>
          )}
          {descSaveStatus === "Error" && (
            <Typography variant="caption" color="error.main">
              Error saving description
            </Typography>
          )}
        </Box>
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 4 }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSample}
          disabled={isReportAuthorized}
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Add Sample
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              borderColor: theme.palette.primary.dark,
              backgroundColor: theme.palette.primary.light,
            },
          }}
        >
          Download Raw Data
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{ width: "140px", minWidth: "140px", maxWidth: "140px" }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("sampleNumber")
                    : undefined
                }
              >
                Sample Number
              </TableCell>
              <TableCell
                sx={{ width: "100px", minWidth: "100px", maxWidth: "100px" }}
                onClick={
                  !isReportAuthorized ? () => handleSort("type") : undefined
                }
              >
                Type
              </TableCell>
              <TableCell
                sx={{ minWidth: "200px", flex: 2 }}
                onClick={
                  !isReportAuthorized ? () => handleSort("location") : undefined
                }
              >
                Location
              </TableCell>
              <TableCell
                sx={{ minWidth: "70px", maxWidth: "110px" }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("startTime")
                    : undefined
                }
              >
                Start Time
              </TableCell>
              <TableCell
                sx={{ minWidth: "70px", maxWidth: "110px" }}
                onClick={
                  !isReportAuthorized ? () => handleSort("endTime") : undefined
                }
              >
                End Time
              </TableCell>
              <TableCell
                sx={{ minWidth: "100px", maxWidth: "150px" }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("averageFlowrate")
                    : undefined
                }
              >
                Flow Rate (L/min)
              </TableCell>
              <TableCell
                sx={{ width: "180px", minWidth: "200px", maxWidth: "200px" }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.map((sample) => (
              <TableRow key={sample._id}>
                <TableCell
                  sx={{ width: "140px", minWidth: "140px", maxWidth: "140px" }}
                >
                  {sample.fullSampleID}
                </TableCell>
                <TableCell
                  sx={{ width: "100px", minWidth: "100px", maxWidth: "100px" }}
                >
                  {sample.type}
                </TableCell>
                <TableCell sx={{ minWidth: "200px", flex: 2 }}>
                  {sample.location}
                </TableCell>
                <TableCell sx={{ minWidth: "70px", maxWidth: "110px" }}>
                  {formatTime(sample.startTime)}
                </TableCell>
                <TableCell sx={{ minWidth: "70px", maxWidth: "110px" }}>
                  {sample.endTime ? formatTime(sample.endTime) : "-"}
                </TableCell>
                <TableCell sx={{ minWidth: "100px", maxWidth: "150px" }}>
                  {sample.averageFlowrate || "-"}
                </TableCell>
                <TableCell
                  sx={{ width: "180px", minWidth: "180px", maxWidth: "180px" }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      navigate(
                        `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`
                      )
                    }
                    disabled={isReportAuthorized}
                    sx={{ mr: 1 }}
                  >
                    Edit Sample
                  </Button>
                  <PermissionGate
                    requiredPermissions={["admin.view"]}
                    fallback={null}
                  >
                    <IconButton
                      onClick={() => handleDelete(sample._id)}
                      disabled={isReportAuthorized}
                      title="Delete (Admin Only)"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
          gap: 2,
        }}
      >
        {![
          "sampling_complete",
          "samples_submitted_to_lab",
          "analysis_complete",
          "shift_complete",
        ].includes(shift?.status) && (
          <>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSampleComplete}
              disabled={
                isCompleteDisabled ||
                shift?.status !== "ongoing" ||
                isReportAuthorized
              }
              sx={{
                backgroundColor: theme.palette.info.main,
                color: theme.palette.info.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.info.dark,
                },
                "&.Mui-disabled": {
                  backgroundColor: theme.palette.grey[700],
                  color: theme.palette.grey[500],
                },
              }}
            >
              Sampling Complete
            </Button>
          </>
        )}
        {![
          "samples_submitted_to_lab",
          "analysis_complete",
          "shift_complete",
        ].includes(shift?.status) &&
          shift?.status === "sampling_complete" && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleSamplesSubmittedToLab}
              disabled={isReportAuthorized}
              sx={{
                backgroundColor: theme.palette.warning.main,
                color: theme.palette.warning.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.warning.dark,
                },
              }}
            >
              Samples Submitted to Lab
            </Button>
          )}
      </Box>

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
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Description Required Dialog */}
      <Dialog
        open={showDescriptionDialog}
        onClose={() => setShowDescriptionDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Description of Works Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
            You must save a description of works before adding samples to this
            shift. Please enter your description and click the "Save" button.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowDescriptionDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowDescriptionDialog(false);
              // Scroll to the description field
              const descriptionField = document.querySelector(
                'textarea[placeholder*="description of works"]'
              );
              if (descriptionField) {
                descriptionField.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                descriptionField.focus();
              }
            }}
            variant="contained"
            color="primary"
          >
            Go to Description Field
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sampling Complete Confirmation Dialog */}
      <Dialog
        open={showSamplingCompleteDialog}
        onClose={() => setShowSamplingCompleteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Complete Sampling</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please review and confirm the description of works and sample
            summary before completing sampling.
          </Typography>

          {/* Description of Works Section */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Description of Works
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={tempDescription}
              onChange={(e) => setTempDescription(e.target.value)}
              placeholder="Enter description of works..."
              variant="outlined"
            />
          </Box>

          {/* Sample Summary Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Sample Summary ({samples.length} samples)
            </Typography>
            {samples.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sample ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Avg Flow Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...samples]
                    .sort((a, b) => {
                      // Extract just the number part from AM prefix (e.g., "AM1" -> 1)
                      const aMatch = a.fullSampleID?.match(/AM(\d+)$/);
                      const bMatch = b.fullSampleID?.match(/AM(\d+)$/);
                      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
                      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
                      return aNum - bNum; // Ascending order
                    })
                    .map((sample) => (
                      <TableRow key={sample._id}>
                        <TableCell>{sample.fullSampleID}</TableCell>
                        <TableCell>{sample.type || "Unknown"}</TableCell>
                        <TableCell>
                          {sample.location || "Not specified"}
                        </TableCell>
                        <TableCell>
                          {sample.startTime
                            ? formatTime(sample.startTime)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {sample.endTime ? formatTime(sample.endTime) : "-"}
                        </TableCell>
                        <TableCell>
                          {sample.averageFlowrate
                            ? `${sample.averageFlowrate} L/min`
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No samples added yet
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowSamplingCompleteDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSamplingComplete}
            variant="contained"
            color="primary"
            disabled={!tempDescription.trim()}
          >
            Complete Sampling
          </Button>
        </DialogActions>
      </Dialog>

      {/* Samples Submitted to Lab Confirmation Dialog */}
      <Dialog
        open={showSamplesSubmittedDialog}
        onClose={() => setShowSamplesSubmittedDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Samples Submitted to Lab</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please confirm that the samples have been physically delivered to
            the laboratory and sign below to verify.
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Signature
            </Typography>
            <TextField
              fullWidth
              value={submittedBySignature}
              variant="outlined"
              disabled
              helperText="This will be automatically signed with your name"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowSamplesSubmittedDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSamplesSubmitted}
            variant="contained"
            color="primary"
          >
            Confirm Submission
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialogOpen}
        onClose={cancelDelete}
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
              bgcolor: "error.main",
              color: "white",
            }}
          >
            <DeleteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Delete Sample
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this air monitoring sample? This
            action cannot be undone.
          </Typography>
          {sampleToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Sample ID:</strong> {sampleToDelete.fullSampleID}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Type:</strong> {sampleToDelete.type}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Location:</strong> {sampleToDelete.location}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelDelete}
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
            onClick={confirmDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Delete Sample
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SampleList;
