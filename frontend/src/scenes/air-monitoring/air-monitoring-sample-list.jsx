import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSnackbar } from "../../context/SnackbarContext";
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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse,
  useMediaQuery,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import MicIcon from "@mui/icons-material/Mic";
import DownloadIcon from "@mui/icons-material/Download";
import MapIcon from "@mui/icons-material/Map";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DescriptionIcon from "@mui/icons-material/Description";
import { sampleService, shiftService } from "../../services/api";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import { formatDate, formatTime } from "../../utils/dateUtils";
import PermissionGate from "../../components/PermissionGate";
import { useAuth } from "../../context/AuthContext";
import SitePlanMap from "../../components/SitePlanMap";

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
  const recognitionRef = useRef(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState(null);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [showDescriptionRequiredForCompleteDialog, setShowDescriptionRequiredForCompleteDialog] =
    useState(false);
  const [showSamplingCompleteDialog, setShowSamplingCompleteDialog] =
    useState(false);
  const [tempDescription, setTempDescription] = useState("");
  const [showSamplesSubmittedDialog, setShowSamplesSubmittedDialog] =
    useState(false);
  const [submittedBySignature, setSubmittedBySignature] = useState("");
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [sitePlanData, setSitePlanData] = useState(null);
  const [descriptionSectionExpanded, setDescriptionSectionExpanded] =
    useState(true);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const showDescriptionButton = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileOrTablet = useMediaQuery("(max-width: 960px)");
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const { showSnackbar } = useSnackbar();

  // Check if report is authorized
  const isReportAuthorized = shift?.reportApprovedBy;

  // Function to extract the numeric part from a sample number
  const extractSampleNumber = (sampleNumber) => {
    // Extract just the number part from AM prefix (e.g., "AM1" -> 1)
    const match = sampleNumber?.match(/AM(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  };

  // Load shift and samples data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Parallelize critical API calls
        const [shiftResponse, samplesResponse] = await Promise.all([
          shiftService.getById(shiftId),
          sampleService.getByShift(shiftId),
        ]);

        const shiftData = shiftResponse.data;
        setShift(shiftData);
        const fetchedSamples = samplesResponse.data || [];
        setSamples(fetchedSamples);

        // Set description immediately if available
        if (shiftData?.descriptionOfWorks) {
          setDescriptionOfWorks(shiftData.descriptionOfWorks);
        }

        // Calculate next sample number from fetched samples (if samples exist)
        const projectId = shiftData?.job?.projectId?.projectID;
        if (projectId && fetchedSamples.length > 0) {
          const highestNumber = fetchedSamples.reduce((max, sample) => {
            const number = extractSampleNumber(sample.fullSampleID);
            return Math.max(max, number);
          }, 0);
          setNextSampleNumber(highestNumber + 1);
        } else {
          // Default to 1 for now - will be calculated in background if needed
          setNextSampleNumber(1);
        }

        // Set loading to false early so page can render
        setError(null);
        setLoading(false);

        // Fetch non-critical data in parallel (don't block page render)
        const backgroundPromises = [];

        // Site plan (non-critical, can fail silently)
        backgroundPromises.push(
          shiftService
            .getSitePlan(shiftId)
            .then((response) => setSitePlanData(response.data))
            .catch(() => setSitePlanData(null)),
        );

        // Job data (non-critical for initial render)
        const jobId = shiftData?.job?._id || shiftData?.job;
        if (jobId) {
          backgroundPromises.push(
            asbestosRemovalJobService
              .getById(jobId)
              .then((response) => setJob(response.data))
              .catch(() => {
                // Silently fail - job data is not critical for page load
              }),
          );
        }

        // Fetch project samples in background only if needed (when no samples exist)
        if (projectId && fetchedSamples.length === 0) {
          backgroundPromises.push(
            sampleService
              .getByProject(projectId)
              .then((projectSamplesResponse) => {
                const allProjectSamples = projectSamplesResponse.data || [];
                const highestNumber = allProjectSamples.reduce(
                  (max, sample) => {
                    const number = extractSampleNumber(sample.fullSampleID);
                    return Math.max(max, number);
                  },
                  0,
                );
                setNextSampleNumber(highestNumber + 1);
              })
              .catch((err) => {
                console.error("Error fetching project samples:", err);
                // Keep default of 1 if fetch fails
              }),
          );
        }

        // Execute background fetches (don't await - let them complete asynchronously)
        Promise.allSettled(backgroundPromises).catch(() => {
          // Silently handle any unhandled promise rejections
        });
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, [shiftId]);

  // Memoize validation function to avoid recreating it on every render
  const validateSamplesCompleteMemo = useCallback((samplesToValidate) => {
    if (!samplesToValidate || samplesToValidate.length === 0) {
      return false;
    }

    return samplesToValidate.every((sample) => {
      // Handle sampler field - use sampler if available, fall back to collectedBy
      const sampler = sample.sampler || sample.collectedBy;

      // If it's a field blank sample, only validate basic required fields
      if (sample.location === "Field blank") {
        const isValid =
          sample.sampleNumber && sample.location && sampler && sample.cowlNo;
        console.log(
          `[SampleList] Field blank sample ${sample.fullSampleID} validation:`,
          isValid,
        );
        return isValid;
      }

      // If sample has failed status, it's considered complete (has all required data, just failed flowrate validation)
      if (sample.status === "failed") {
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
          sample.averageFlowrate;
        console.log(
          `[SampleList] Failed sample ${sample.fullSampleID} validation (status=failed, checking required fields only):`,
          isValid,
        );
        return isValid;
      }

      // For non-field blank, non-failed samples, validate all required fields AND flowrates
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
        // Ensure flowrates are valid numbers
        parseFloat(sample.initialFlowrate) > 0 &&
        parseFloat(sample.finalFlowrate) > 0;
      console.log(
        `[SampleList] Regular sample ${sample.fullSampleID} validation:`,
        isValid,
      );
      return isValid;
    });
  }, []);

  // Re-validate samples whenever samples change
  useEffect(() => {
    if (samples.length > 0) {
      console.log("[SampleList] Validating samples for completion:", {
        totalSamples: samples.length,
        samples: samples.map((s) => ({
          id: s.fullSampleID,
          status: s.status,
          hasRequiredFields: {
            sampleNumber: !!s.sampleNumber,
            type: !!s.type,
            location: !!s.location,
            sampler: !!(s.sampler || s.collectedBy),
            pumpNo: !!s.pumpNo,
            flowmeter: !!s.flowmeter,
            cowlNo: !!s.cowlNo,
            filterSize: !!s.filterSize,
            startTime: !!s.startTime,
            endTime: !!s.endTime,
            initialFlowrate: !!s.initialFlowrate,
            finalFlowrate: !!s.finalFlowrate,
            averageFlowrate: !!s.averageFlowrate,
          },
          flowrateValues: {
            initial: s.initialFlowrate,
            final: s.finalFlowrate,
            average: s.averageFlowrate,
          },
          isFieldBlank: s.location === "Field blank",
        })),
      });

      const isValid = validateSamplesCompleteMemo(samples);

      console.log("[SampleList] Validation result:", {
        isValid,
        isCompleteDisabled: !isValid,
        shiftStatus: shift?.status,
        isReportAuthorized,
        buttonWillBeDisabled:
          !isValid || shift?.status !== "ongoing" || isReportAuthorized,
      });

      setIsCompleteDisabled(!isValid);
    } else {
      console.log("[SampleList] No samples, disabling completion button");
      setIsCompleteDisabled(true);
    }
  }, [samples, validateSamplesCompleteMemo, shift?.status, isReportAuthorized]);

  // Cleanup: stop dictation when component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, []);

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
      showSnackbar("Sample deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting sample:", err);
      showSnackbar("Failed to delete sample. Please try again.", "error");
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
        }),
      );

      const escapeCsvCell = (value) => {
        if (value === undefined || value === null) return "";
        return `"${String(value).replace(/"/g, '""')}"`;
      };

      const formatPersonName = (value) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          const { firstName, lastName, name, fullName, displayName, email } =
            value;
          if (firstName || lastName) {
            return [firstName, lastName].filter(Boolean).join(" ").trim();
          }
          if (name) return name;
          if (fullName) return fullName;
          if (displayName) return displayName;
          if (email) return email;
          return "";
        }
        return "";
      };

      const csvRows = [
        ["Project ID", job?.projectId?.projectID || ""],
        ["Project Name", job?.projectName || job?.name || ""],
        ["Sample Date", shift?.date ? formatDate(shift.date) : ""],
        ["Description of Works", descriptionOfWorks || ""],
        [],
        [],
      ];

      const excludedColumns = new Set([
        "analysis",
        "_id",
        "shift",
        "job",
        "jobModel",
        "sampleNumber",
        "status",
        "collectedBy",
        "createdAt",
        "updatedAt",
        "__v",
        "fibreCount_1",
        "fibreCount_2",
        "fibreCount_3",
        "fibreCount_4",
        "fibreCount_5",
        "counted",
        "reportedConcentration",
      ]);

      const sampleRows = samples.map((sample) => {
        const base = { ...sample };
        const analysis = base.analysis || {};

        delete base.analysis;

        const row = Object.entries(base).reduce((acc, [key, value]) => {
          if (!excludedColumns.has(key)) {
            acc[key] = value;
          }
          return acc;
        }, {});

        Object.entries(analysis).forEach(([key, value]) => {
          if (!excludedColumns.has(key) && key !== "fibreCounts") {
            row[key] = value;
          }
        });

        if (Array.isArray(analysis.fibreCounts)) {
          analysis.fibreCounts.forEach((val, i) => {
            row[`fibreCount_${i + 1}`] = Array.isArray(val)
              ? val.join("|")
              : val;
          });
        }

        if (row.counted === undefined) {
          const countedValue =
            analysis.fieldsCounted ??
            analysis.fibresCounted ??
            analysis.counted ??
            "";
          row.counted = countedValue;
        }

        if (row.reportedConcentration === undefined) {
          row.reportedConcentration = analysis.reportedConcentration ?? "";
        }

        if (sample.sampler || sample.collectedBy) {
          row.sampler = formatPersonName(sample.sampler || sample.collectedBy);
        } else if (row.sampler) {
          row.sampler = formatPersonName(row.sampler);
        }

        if (row.analyst) {
          row.analyst = formatPersonName(row.analyst);
        }

        return row;
      });

      if (sampleRows.length > 0) {
        const headers = [];
        sampleRows.forEach((row) => {
          Object.keys(row).forEach((key) => {
            if (!excludedColumns.has(key) && !headers.includes(key)) {
              headers.push(key);
            }
          });
        });

        if (!headers.includes("reportedConcentration")) {
          headers.push("reportedConcentration");
        }

        csvRows.push(headers);

        sampleRows.forEach((row) => {
          csvRows.push(headers.map((header) => row[header] ?? ""));
        });
      }

      const csv = csvRows
        .map((row) =>
          row.length ? row.map((cell) => escapeCsvCell(cell)).join(",") : "",
        )
        .join("\r\n");

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
      showSnackbar("Failed to download CSV.", "error");
    }
  };

  // Memoize sorted samples to avoid recalculating on every render
  const sortedSamples = useMemo(() => {
    return [...samples].sort((a, b) => {
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
  }, [samples, sortField, sortAsc]);

  // Add handleSampleComplete function
  const handleSampleComplete = () => {
    // Check if description of works has been filled in
    if (!descriptionOfWorks?.trim()) {
      setShowDescriptionRequiredForCompleteDialog(true);
      return;
    }
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

  const handleOpenSitePlan = () => {
    setSitePlanDialogOpen(true);
  };

  const handleCloseSitePlan = () => {
    setSitePlanDialogOpen(false);
  };

  const handleSaveSitePlan = async (sitePlanData) => {
    try {
      await shiftService.saveSitePlan(shiftId, sitePlanData);
      setSitePlanData(sitePlanData);
      showSnackbar("Site plan saved successfully", "success");
      setSitePlanDialogOpen(false);
    } catch (error) {
      console.error("Error saving site plan:", error);
      showSnackbar("Failed to save site plan. Please try again.", "error");
    }
  };

  const handleDescriptionChange = (e) => {
    setDescriptionOfWorks(e.target.value);
    setDescSaveStatus("");
  };

  const saveDescriptionOfWorks = async () => {
    try {
      await shiftService.update(shiftId, {
        descriptionOfWorks,
      });
      setDescSaveStatus("Saved");
      return true;
    } catch (err) {
      console.error("Error saving description of works:", err);
      setDescSaveStatus("Error");
      return false;
    }
  };

  // Dictation functions
  const startDictation = () => {
    // If already dictating, stop it first
    if (isDictating && recognitionRef.current) {
      stopDictation();
      return;
    }

    // Check if browser supports speech recognition
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.",
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

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        // Update the description field with the final transcript
        if (finalTranscript) {
          setDescriptionOfWorks((prev) => {
            const isFirstWord = !prev || prev.trim().length === 0;
            const newText = isFirstWord
              ? finalTranscript.charAt(0).toUpperCase() +
                finalTranscript.slice(1)
              : finalTranscript;
            return prev + (prev ? " " : "") + newText;
          });
          setDescSaveStatus(""); // Reset save status when description changes
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setDictationError(`Dictation error: ${event.error}`);
        setIsDictating(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsDictating(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Error starting dictation:", error);
      setDictationError("Failed to start dictation. Please try again.");
      recognitionRef.current = null;
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping dictation:", error);
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        px: { xs: 0.68, sm: 1.02, md: 4 },
      }}
    >
      {/* Breadcrumbs */}
      <Breadcrumbs
        sx={{
          marginBottom: 3,
          "& .MuiBreadcrumbs-separator": {
            display: { xs: "none", sm: "inline-flex" },
          },
        }}
      >
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate("/asbestos-removal")}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: { xs: 0, sm: 1 } }} />
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            Asbestos Removal Jobs
          </Box>
        </Link>
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
          sx={{
            fontSize: isMobile ? "0.9rem" : "1rem",
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          Job Details
        </Link>
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
        variant="h6"
        sx={{
          fontSize: { xs: "0.9rem", sm: "1rem", md: "1.25rem" },
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 1,
        }}
      >
        {job?.projectId?.projectID ? `${job.projectId.projectID}: ` : ""}
        {job?.projectName || job?.name || "Loading..."}
        {" - "}
        {shift?.name ? `${formatDate(shift.date)}` : "Loading..."}
      </Typography>
      {/* Description of Works Field - collapsible; hidden on mobile/tablet (use modal button instead) */}
      <Box sx={{ mb: 3, display: { xs: "none", md: "block" } }}>
        <Box
          onClick={() => setDescriptionSectionExpanded((prev) => !prev)}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            mb: 1,
            py: 0.5,
            "&:hover": { bgcolor: "action.hover" },
            borderRadius: 1,
          }}
        >
          <Typography variant="h6">Description of Works</Typography>
          <IconButton
            size="small"
            aria-label={descriptionSectionExpanded ? "Collapse" : "Expand"}
          >
            {descriptionSectionExpanded ? (
              <ExpandLessIcon />
            ) : (
              <ExpandMoreIcon />
            )}
          </IconButton>
        </Box>
        <Collapse in={descriptionSectionExpanded}>
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
        </Collapse>
      </Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{
          mb: 2,
          "& .MuiButton-root": {
            fontSize: { xs: "0.7rem", sm: "0.875rem" },
          },
        }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSample}
            disabled={isReportAuthorized}
            sx={{
              "& .MuiButton-startIcon": { display: { xs: "none", sm: "flex" } },
              backgroundColor: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Add Sample
          </Button>
          {showDescriptionButton && (
            <Button
              variant="outlined"
              startIcon={<DescriptionIcon />}
              onClick={() => setDescriptionModalOpen(true)}
              disabled={isReportAuthorized}
              sx={{
                "& .MuiButton-startIcon": {
                  display: { xs: "none", sm: "flex" },
                },
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                "&:hover": {
                  borderColor: theme.palette.primary.dark,
                  backgroundColor: theme.palette.primary.light,
                },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                Description of Works
              </Box>
              <Box
                component="span"
                sx={{ display: { xs: "inline", sm: "none" } }}
              >
                Description
              </Box>
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<MapIcon />}
            onClick={handleOpenSitePlan}
            disabled={isReportAuthorized}
            sx={{
              "& .MuiButton-startIcon": { display: { xs: "none", sm: "flex" } },
              borderColor: theme.palette.secondary.main,
              color: theme.palette.secondary.main,
              "&:hover": {
                borderColor: theme.palette.secondary.dark,
                backgroundColor: theme.palette.secondary.light,
              },
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: "none", sm: "inline" } }}
            >
              {sitePlanData?.sitePlan ? "Edit Site Plan" : "Add Site Plan"}
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: "inline", sm: "none" } }}
            >
              Site Plan
            </Box>
          </Button>
          {sitePlanData?.sitePlan && (
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this site plan? This action cannot be undone.",
                  )
                ) {
                  handleSaveSitePlan({
                    sitePlan: false,
                    sitePlanData: null,
                  });
                }
              }}
              disabled={isReportAuthorized}
              sx={{
                "& .MuiButton-startIcon": {
                  display: { xs: "none", sm: "flex" },
                },
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
                "&:hover": {
                  borderColor: theme.palette.error.dark,
                  backgroundColor: theme.palette.error.light,
                },
              }}
            >
              Delete Site Plan
            </Button>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          sx={{
            display: { xs: "none", md: "inline-flex" },
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              borderColor: theme.palette.primary.dark,
              backgroundColor: theme.palette.primary.light,
            },
          }}
        >
          Download Sample Data
        </Button>
      </Stack>

      <TableContainer
        component={Paper}
        sx={{
          "& .MuiTableCell-root": {
            "@media (max-width: 960px) and (orientation: portrait)": {
              fontSize: "0.8em",
            },
            "@media (max-width: 960px) and (orientation: landscape)": {
              fontSize: "0.8em",
            },
          },
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  width: "140px",
                  minWidth: "140px",
                  maxWidth: "140px",
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    minWidth: "80px",
                    maxWidth: "none",
                  },
                }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("sampleNumber")
                    : undefined
                }
              >
                Sample No.
              </TableCell>
              <TableCell
                sx={{
                  width: "100px",
                  minWidth: "100px",
                  maxWidth: "100px",
                  "@media (max-width: 960px)": { display: "none" },
                }}
                onClick={
                  !isReportAuthorized ? () => handleSort("cowlNo") : undefined
                }
              >
                Cowl Number
              </TableCell>
              <TableCell
                sx={{
                  width: "100px",
                  minWidth: "100px",
                  maxWidth: "100px",
                  "@media (max-width: 960px)": { display: "none" },
                }}
                onClick={
                  !isReportAuthorized ? () => handleSort("type") : undefined
                }
              >
                Type
              </TableCell>
              <TableCell
                sx={{
                  minWidth: "200px",
                  flex: 2,
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    minWidth: "120px",
                  },
                }}
                onClick={
                  !isReportAuthorized ? () => handleSort("location") : undefined
                }
              >
                Location
              </TableCell>
              <TableCell
                sx={{
                  minWidth: "70px",
                  maxWidth: "110px",
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    display: "none",
                  },
                }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("startTime")
                    : undefined
                }
              >
                Start Time
              </TableCell>
              <TableCell
                sx={{
                  minWidth: "70px",
                  maxWidth: "110px",
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    display: "none",
                  },
                }}
                onClick={
                  !isReportAuthorized ? () => handleSort("endTime") : undefined
                }
              >
                End Time
              </TableCell>
              <TableCell
                sx={{
                  minWidth: "100px",
                  maxWidth: "150px",
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    display: "none",
                  },
                }}
                onClick={
                  !isReportAuthorized
                    ? () => handleSort("averageFlowrate")
                    : undefined
                }
              >
                Flow Rate (L/min)
              </TableCell>
              <TableCell
                sx={{
                  width: "180px",
                  minWidth: "200px",
                  maxWidth: "200px",
                  "@media (max-width: 960px) and (orientation: portrait)": {
                    display: "none",
                  },
                  "@media (max-width: 960px) and (orientation: landscape)": {
                    width: "90px",
                    minWidth: "90px",
                    maxWidth: "100px",
                  },
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No samples found for this job. Click 'Add Samples' to get
                    started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedSamples.map((sample) => (
                <TableRow
                  key={sample._id}
                  onClick={() => {
                    if (isMobileOrTablet && !isReportAuthorized) {
                      navigate(
                        `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`,
                      );
                    }
                  }}
                  sx={{
                    cursor: isMobileOrTablet ? "pointer" : "default",
                  }}
                >
                  <TableCell
                    sx={{
                      width: "140px",
                      minWidth: "140px",
                      maxWidth: "140px",
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        minWidth: "80px",
                        maxWidth: "none",
                      },
                    }}
                  >
                    {sample.fullSampleID}
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "100px",
                      minWidth: "100px",
                      maxWidth: "100px",
                      "@media (max-width: 960px)": { display: "none" },
                    }}
                  >
                    {sample.cowlNo || "-"}
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "100px",
                      minWidth: "100px",
                      maxWidth: "100px",
                      "@media (max-width: 960px)": { display: "none" },
                    }}
                  >
                    {sample.location === "Field blank" ? "-" : sample.type}
                  </TableCell>
                  <TableCell
                    sx={{
                      minWidth: "200px",
                      flex: 2,
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        minWidth: "120px",
                      },
                    }}
                  >
                    {sample.location}
                  </TableCell>
                  <TableCell
                    sx={{
                      minWidth: "70px",
                      maxWidth: "110px",
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        display: "none",
                      },
                    }}
                  >
                    {formatTime(sample.startTime)}
                  </TableCell>
                  <TableCell
                    sx={{
                      minWidth: "70px",
                      maxWidth: "110px",
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        display: "none",
                      },
                    }}
                  >
                    {sample.endTime ? formatTime(sample.endTime) : "-"}
                  </TableCell>
                  <TableCell
                    sx={{
                      minWidth: "100px",
                      maxWidth: "150px",
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        display: "none",
                      },
                    }}
                  >
                    {sample.status === "failed" ? (
                      <Typography
                        component="span"
                        sx={{
                          color: "error.main",
                          fontWeight: "bold",
                          fontSize: "inherit",
                        }}
                      >
                        Failed
                      </Typography>
                    ) : (
                      sample.averageFlowrate || "-"
                    )}
                  </TableCell>
                  <TableCell
                    sx={{
                      width: "180px",
                      minWidth: "180px",
                      maxWidth: "180px",
                      "@media (max-width: 960px) and (orientation: portrait)": {
                        display: "none",
                      },
                      "@media (max-width: 960px) and (orientation: landscape)":
                        {
                          width: "90px",
                          minWidth: "90px",
                          maxWidth: "100px",
                        },
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(
                          `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`,
                        );
                      }}
                      disabled={isReportAuthorized}
                      sx={{
                        mr: 1,
                        "@media (max-width: 960px)": { display: "none" },
                      }}
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
              ))
            )}
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
              onClick={() => {
                console.log("[SampleList] Sampling Complete button clicked", {
                  isCompleteDisabled,
                  shiftStatus: shift?.status,
                  isReportAuthorized,
                  buttonDisabled:
                    isCompleteDisabled ||
                    shift?.status !== "ongoing" ||
                    isReportAuthorized,
                });
                handleSampleComplete();
              }}
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

      {/* Description Required for Complete Sampling Dialog */}
      <Dialog
        open={showDescriptionRequiredForCompleteDialog}
        onClose={() => setShowDescriptionRequiredForCompleteDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Description of Works Required</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
            Please fill in the description of works before completing sampling.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowDescriptionRequiredForCompleteDialog(false)}
            variant="outlined"
          >
            OK
          </Button>
          <Button
            onClick={() => {
              setShowDescriptionRequiredForCompleteDialog(false);
              setDescriptionModalOpen(true);
            }}
            variant="contained"
            color="primary"
          >
            Fill in Description
          </Button>
        </DialogActions>
      </Dialog>

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
                'textarea[placeholder*="description of works"]',
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

      {/* Mobile: Description of Works Modal */}
      <Dialog
        open={descriptionModalOpen}
        onClose={() => setDescriptionModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Description of Works</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={8}
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
            {isDictating && (
              <Box
                sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}
              >
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDescriptionModalOpen(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await saveDescriptionOfWorks();
              if (ok) setDescriptionModalOpen(false);
            }}
            disabled={!descriptionOfWorks.trim() || isReportAuthorized}
            sx={{
              backgroundColor: theme.palette.primary.main,
              "&:hover": { backgroundColor: theme.palette.primary.dark },
            }}
          >
            Save Description
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
          {isPortrait ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                py: 4,
                px: 2,
                textAlign: "center",
              }}
            >
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Please rotate your device to landscape mode
              </Typography>
              <Typography variant="body2" color="text.secondary">
                The complete sampling form is best viewed in landscape
                orientation. Please rotate your device to continue.
              </Typography>
            </Box>
          ) : (
            <>
          <Typography
            variant="body1"
            sx={{ mb: 2, fontSize: { xs: "0.8em", sm: "0.95em" } }}
          >
            Please review and confirm the description of works and sample
            summary before completing sampling.
          </Typography>

          {/* Description of Works Section */}
          <Typography variant="body1" sx={{ fontSize: { xs: "0.8em", sm: "0.95em" }, mb: 2, wordBreak: "break-word" }}>
            <Box component="span" sx={{fontWeight: "bold" }}>
              Description of Works:
            </Box>{" "}
            {tempDescription || descriptionOfWorks || ""}
          </Typography>

          {/* Sample Summary Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontSize: { xs: "0.8em", sm: "0.95em" }, mb: 2 }}>
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
                    <TableCell>Flow Rate</TableCell>
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
                          {sample.status === "failed" ? (
                            <Typography
                              component="span"
                              sx={{
                                color: "error.main",
                                fontWeight: "bold",
                                fontSize: "inherit",
                              }}
                            >
                              Failed
                            </Typography>
                          ) : sample.averageFlowrate ? (
                            `${sample.averageFlowrate} L/min`
                          ) : (
                            "-"
                          )}
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
            </>
          )}
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
            disabled={isPortrait || !tempDescription.trim()}
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

      {/* Site Plan Dialog */}
      <SitePlanMap
        open={sitePlanDialogOpen}
        onClose={handleCloseSitePlan}
        shiftId={shiftId}
        initialData={sitePlanData}
        onSave={handleSaveSitePlan}
        projectId={job?.projectId?.projectID}
      />
    </Box>
  );
};

export default SampleList;
