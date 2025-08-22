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
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import AssessmentIcon from "@mui/icons-material/Assessment";
import MicIcon from "@mui/icons-material/Mic";
import DownloadIcon from "@mui/icons-material/Download";
import { sampleService, shiftService } from "../../services/api";
import { formatDate, formatTime } from "../../utils/dateUtils";

const SampleList = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("fullSampleID");
  const [sortAsc, setSortAsc] = useState(true);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleteDisabled, setIsCompleteDisabled] = useState(true);
  const [nextSampleNumber, setNextSampleNumber] = useState(null);
  const [descriptionOfWorks, setDescriptionOfWorks] = useState("");
  const [descSaveStatus, setDescSaveStatus] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

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
        setShift(shiftResponse.data);

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

  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDelete = async (sampleId) => {
    if (window.confirm("Are you sure you want to delete this sample?")) {
      try {
        await sampleService.delete(sampleId);
        setSamples(samples.filter((sample) => sample._id !== sampleId));
      } catch (err) {
        console.error("Error deleting sample:", err);
        setError("Failed to delete sample. Please try again.");
      }
    }
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

  const filteredSamples = samples.filter((sample) =>
    Object.values(sample).some(
      (value) =>
        value && value.toString().toLowerCase().includes(search.toLowerCase())
    )
  );

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
  const handleSampleComplete = async () => {
    try {
      // Update shift status
      await shiftService.update(shiftId, { status: "sampling_complete" });
      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);
    } catch (error) {
      console.error("Error updating shift status:", error);
      setError("Failed to update shift status. Please try again.");
    }
  };

  // Add handler for Samples Submitted to Lab
  const handleSamplesSubmittedToLab = async () => {
    try {
      const currentDate = new Date().toISOString();
      await shiftService.update(shiftId, {
        status: "samples_submitted_to_lab",
        samplesReceivedDate: currentDate,
      });
      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);
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
      await shiftService.update(shiftId, { descriptionOfWorks });
      setDescSaveStatus("Saved");
    } catch (err) {
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
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() =>
          navigate(`/air-monitoring/jobs/${shift?.job?._id}/shifts`)
        }
        sx={{ mb: 4 }}
      >
        Back to Shifts
      </Button>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate("/asbestos-removal")}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate("/air-monitoring")}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          Air Monitoring
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() =>
            navigate(`/air-monitoring/jobs/${shift?.job?._id}/shifts`)
          }
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          Shifts
        </Link>
        <Typography color="text.primary">Samples</Typography>
      </Breadcrumbs>

      {/* Description of Works Field */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Description of Works
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Type your description or click the microphone icon to dictate. Speak
          clearly and naturally for best results.
        </Typography>
        <TextField
          fullWidth
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
          InputProps={{
            endAdornment: (
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
            ),
          }}
        />
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
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            variant="contained"
            onClick={saveDescriptionOfWorks}
            disabled={!descriptionOfWorks.trim()}
            sx={{
              backgroundColor: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Save Description
          </Button>
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
        Samples for{" "}
        {shift?.name ? `Shift ${formatDate(shift.date)}` : "Loading..."}
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 4 }}
        justifyContent="space-between"
        alignItems="center"
      >
        <TextField
          label="Search"
          variant="outlined"
          value={search}
          onChange={handleSearch}
          sx={{ width: { xs: "100%", sm: "300px" } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSample}
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Add Sample
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => handleSort("sampleNumber")}>
                Sample Number
              </TableCell>
              <TableCell onClick={() => handleSort("type")}>Type</TableCell>
              <TableCell onClick={() => handleSort("location")}>
                Location
              </TableCell>
              <TableCell onClick={() => handleSort("startTime")}>
                Start Time
              </TableCell>
              <TableCell onClick={() => handleSort("endTime")}>
                End Time
              </TableCell>
              <TableCell onClick={() => handleSort("averageFlowrate")}>
                Flow Rate (L/min)
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.map((sample) => (
              <TableRow key={sample._id}>
                <TableCell>{sample.fullSampleID}</TableCell>
                <TableCell>{sample.type}</TableCell>
                <TableCell>{sample.location}</TableCell>
                <TableCell>{formatTime(sample.startTime)}</TableCell>
                <TableCell>
                  {sample.endTime ? formatTime(sample.endTime) : "-"}
                </TableCell>
                <TableCell>{sample.averageFlowrate}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      navigate(
                        `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`
                      )
                    }
                    sx={{ mr: 1 }}
                  >
                    Edit Sample
                  </Button>
                  <IconButton onClick={() => handleDelete(sample._id)}>
                    <DeleteIcon />
                  </IconButton>
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
            {isCompleteDisabled && shift?.status === "ongoing" && (
              <Typography
                variant="body2"
                color="warning.main"
                sx={{
                  alignSelf: "center",
                  mr: 2,
                  fontStyle: "italic",
                }}
              >
                Complete all sample data before marking sampling complete
              </Typography>
            )}
            <Button
              variant="contained"
              color="primary"
              onClick={handleSampleComplete}
              disabled={isCompleteDisabled || shift?.status !== "ongoing"}
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

      {["samples_submitted_to_lab", "analysis_complete"].includes(
        shift?.status
      ) && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button
            variant="contained"
            onClick={() =>
              navigate(`/air-monitoring/shift/${shiftId}/analysis`)
            }
            sx={{
              backgroundColor: theme.palette.success.main,
              color: theme.palette.success.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.success.dark,
              },
            }}
          >
            COMPLETE ANALYSIS
          </Button>
        </Box>
      )}

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
    </Box>
  );
};

export default SampleList;
