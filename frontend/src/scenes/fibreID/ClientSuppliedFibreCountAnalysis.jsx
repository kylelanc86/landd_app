import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import { clientSuppliedJobsService } from "../../services/api";
import { userService } from "../../services/api";
import pcmMicroscopeService from "../../services/pcmMicroscopeService";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useAuth } from "../../context/AuthContext";
import { useSnackbar } from "../../context/SnackbarContext";

const ANALYSIS_PROGRESS_KEY = "ldc_client_supplied_analysis_progress";

// Sample Summary Component - adapted for client supplied samples
const SampleSummary = React.memo(
  ({
    sample,
    analysis,
    analysisDetails,
    getMicroscopeConstantInfo,
    onAnalysisChange,
    onFibreCountChange,
    onKeyDown,
    onClearTable,
    isFilterUncountable,
    isSampleAnalyzed,
    calculateConcentration,
    getReportedConcentration,
    inputRefs,
    isReadOnly,
    onOpenFibreCountModal,
  }) => {
    const theme = useTheme();

    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography variant="h5">
                {sample.labReference || "N/A"}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Cowl Number: {sample.cowlNumber || "N/A"}
              </Typography>
              {analysisDetails.microscope && (
                <Chip
                  label={`Constant: ${
                    getMicroscopeConstantInfo(
                      analysisDetails.microscope,
                      "25mm" // Default for client supplied
                    ).source
                  }`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 1,
              }}
            >
              <Chip
                label={
                  isFilterUncountable(sample._id)
                    ? "Uncountable"
                    : isSampleAnalyzed(sample._id)
                    ? "Sample Analysed"
                    : "To be counted"
                }
                color={
                  isFilterUncountable(sample._id)
                    ? "error"
                    : isSampleAnalyzed(sample._id)
                    ? "success"
                    : "default"
                }
                size="small"
                sx={{
                  backgroundColor: isFilterUncountable(sample._id)
                    ? "error.main"
                    : isSampleAnalyzed(sample._id)
                    ? "success.main"
                    : "grey.400",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => onOpenFibreCountModal(sample._id)}
                disabled={isReadOnly || isFilterUncountable(sample._id)}
              >
                Enter Fibre Counts
              </Button>
            </Box>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Edges/Distribution
              </Typography>
              <RadioGroup
                row
                value={analysis.edgesDistribution || ""}
                onChange={(e) =>
                  onAnalysisChange(
                    sample._id,
                    "edgesDistribution",
                    e.target.value
                  )
                }
                disabled={isReadOnly}
              >
                <FormControlLabel
                  value="pass"
                  control={<Radio size="small" />}
                  label="Pass"
                />
                <FormControlLabel
                  value="fail"
                  control={<Radio size="small" />}
                  label={<span style={{ color: "red" }}>Fail</span>}
                />
              </RadioGroup>
            </FormControl>
            <FormControl component="fieldset">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Background Dust
              </Typography>
              <RadioGroup
                row
                value={analysis.backgroundDust || ""}
                onChange={(e) =>
                  onAnalysisChange(sample._id, "backgroundDust", e.target.value)
                }
                disabled={isReadOnly}
              >
                <FormControlLabel
                  value="pass"
                  control={<Radio size="small" />}
                  label="Pass"
                />
                <FormControlLabel
                  value="fail"
                  control={<Radio size="small" />}
                  label={<span style={{ color: "red" }}>Fail</span>}
                />
              </RadioGroup>
            </FormControl>
          </Stack>

          <Box>
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ flexWrap: "wrap" }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: "medium", mr: 1 }}
              >
                Fibre Counts:
              </Typography>
              <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    component="span"
                  >
                    Fibres Counted:{" "}
                  </Typography>
                  <Typography
                    variant="body1"
                    component="span"
                    sx={{ fontWeight: "medium" }}
                  >
                    {analysis.fibresCounted || 0}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    component="span"
                  >
                    Fields Counted:{" "}
                  </Typography>
                  <Typography
                    variant="body1"
                    component="span"
                    sx={{ fontWeight: "medium" }}
                  >
                    {analysis.fieldsCounted || 0}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    );
  }
);

const ClientSuppliedFibreCountAnalysis = () => {
  const theme = useTheme();
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [samples, setSamples] = useState([]);
  const [pcmCalibrations, setPcmCalibrations] = useState([]);
  const [analysisDetails, setAnalysisDetails] = useState({
    microscope: "",
    testSlide: "",
    testSlideLines: "",
  });
  const [sampleAnalyses, setSampleAnalyses] = useState({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState(null);
  const inputRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [analysedBy, setAnalysedBy] = useState("");
  const [analysisDate, setAnalysisDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [fibreCountModalOpen, setFibreCountModalOpen] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [jobStatus, setJobStatus] = useState("");

  // Load samples and in-progress analysis data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch job first to get projectId and embedded samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const job = jobResponse.data;
        const projectId = job.projectId._id || job.projectId;

        // Samples are now embedded in the job
        const samplesResponse = { data: job.samples || [] };
        const pcmCalibrationsResponse = await pcmMicroscopeService.getAll();

        if (!isMounted) return;

        setJobStatus(job.status || "In Progress");
        setPcmCalibrations(pcmCalibrationsResponse);

        // Sort samples by labReference and add unique IDs
        const sortedSamples = (samplesResponse.data || [])
          .sort((a, b) => {
            const labRefA = a.labReference || "";
            const labRefB = b.labReference || "";
            return labRefA.localeCompare(labRefB);
          })
          .map((sample, index) => ({ ...sample, _id: index })); // Add unique ID based on index

        // Initialize analyses for each sample
        const initialAnalyses = {};
        sortedSamples.forEach((sample) => {
          const sampleKey = sample._id;
          if (
            sample.analysisData &&
            Object.keys(sample.analysisData).length > 0
          ) {
            const ad = sample.analysisData;
            initialAnalyses[sampleKey] = {
              edgesDistribution: ad.edgesDistribution || "",
              backgroundDust: ad.backgroundDust || "",
              fibreCounts:
                Array.isArray(ad.fibreCounts) && ad.fibreCounts.length === 5
                  ? ad.fibreCounts.map((row) =>
                      Array.isArray(row) && row.length === 20
                        ? row.map((cell) => cell?.toString() || "")
                        : Array(20).fill("")
                    )
                  : Array(5)
                      .fill()
                      .map(() => Array(20).fill("")),
              fibresCounted: ad.fibresCounted || 0,
              fieldsCounted: ad.fieldsCounted || 0,
            };
          } else {
            initialAnalyses[sampleKey] = {
              edgesDistribution: "",
              backgroundDust: "",
              fibreCounts: Array(5)
                .fill()
                .map(() => Array(20).fill("")),
              fibresCounted: 0,
              fieldsCounted: 0,
            };
          }
        });

        // Set analysis details from the first sample that has them
        const firstSampleWithAnalysis = sortedSamples.find(
          (s) => s.analysisData?.microscope
        );
        if (firstSampleWithAnalysis?.analysisData) {
          setAnalysisDetails({
            microscope: firstSampleWithAnalysis.analysisData.microscope || "",
            testSlide: firstSampleWithAnalysis.analysisData.testSlide || "",
            testSlideLines:
              firstSampleWithAnalysis.analysisData.testSlideLines || "",
          });
        }

        // Set analyst from job first (database), then from first sample if available
        if (job.analyst) {
          setAnalysedBy(job.analyst);
        } else if (sortedSamples.length > 0 && sortedSamples[0].analyzedBy) {
          const firstSample = sortedSamples[0];
          setAnalysedBy(
            typeof firstSample.analyzedBy === "string"
              ? firstSample.analyzedBy
              : firstSample.analyzedBy?.firstName &&
                firstSample.analyzedBy?.lastName
              ? `${firstSample.analyzedBy.firstName} ${firstSample.analyzedBy.lastName}`
              : ""
          );
        }

        // Set analysis date from job (database) - this is the source of truth
        if (job.analysisDate) {
          setAnalysisDate(
            new Date(job.analysisDate).toISOString().split("T")[0]
          );
        }

        // Load in-progress analysis data if present
        const progressData = localStorage.getItem(ANALYSIS_PROGRESS_KEY);
        if (progressData) {
          const parsed = JSON.parse(progressData);
          if (parsed.jobId === jobId) {
            // Only merge if we don't have existing data
            if (!firstSampleWithAnalysis?.analysisData) {
              setAnalysisDetails(parsed.analysisDetails);
            }
            // Restore analyst and analysis date from saved progress only if not already set from database
            // Database values take precedence over localStorage
            if (parsed.analysedBy && !job.analyst) {
              setAnalysedBy(parsed.analysedBy);
            }
            if (parsed.analysisDate && !job.analysisDate) {
              setAnalysisDate(parsed.analysisDate);
            }
            // Merge saved analyses with all samples (preserve backend, add new)
            const mergedAnalyses = { ...initialAnalyses };
            Object.keys(parsed.sampleAnalyses || {}).forEach((sampleId) => {
              if (mergedAnalyses[sampleId]) {
                mergedAnalyses[sampleId] = {
                  ...mergedAnalyses[sampleId],
                  ...parsed.sampleAnalyses[sampleId],
                };
              }
            });
            setSampleAnalyses(mergedAnalyses);
          } else {
            setSampleAnalyses(initialAnalyses);
          }
        } else {
          setSampleAnalyses(initialAnalyses);
        }

        setSamples(sortedSamples);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [jobId]);

  // Fetch users for analyst dropdown
  useEffect(() => {
    userService.getAll().then((res) => {
      const allUsers = res.data || [];
      const fibreCountingUsers = allUsers.filter(
        (user) =>
          user.isActive &&
          user.labApprovals &&
          user.labApprovals.fibreCounting === true
      );
      const sortedUsers = fibreCountingUsers.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setUsers(sortedUsers);
    });
  }, []);

  const handleAnalysisDetailsChange = (e) => {
    setAnalysisDetails({
      ...analysisDetails,
      [e.target.name]: e.target.value,
    });
  };

  // Memoize handlers to prevent unnecessary re-renders
  const handleSampleAnalysisChange = useCallback((sampleId, field, value) => {
    setSampleAnalyses((prev) => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        [field]: value,
      },
    }));
  }, []);

  const handleFibreCountChange = useCallback(
    (sampleId, rowIndex, colIndex, value) => {
      const newValue = value === "/" ? "0.5" : value;
      if (isNaN(newValue) && value !== "") return;

      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];
        newFibreCounts[rowIndex][colIndex] = newValue;

        // Calculate fibres counted and fields counted
        let fibresCounted = 0;
        let fieldsCounted = 0;
        newFibreCounts.forEach((row) => {
          row.forEach((cell) => {
            if (cell !== "") {
              const numValue = parseFloat(cell);
              if (!isNaN(numValue)) {
                fibresCounted += numValue;
                fieldsCounted += 1;
              }
            }
          });
        });

        newAnalyses[sampleId] = {
          ...newAnalyses[sampleId],
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };
        return newAnalyses;
      });

      // Move to next cell
      const nextCol = colIndex + 1;
      const nextRow = rowIndex;
      if (nextCol < 20) {
        const nextInput =
          inputRefs.current[`${sampleId}-${nextRow}-${nextCol}`];
        if (nextInput) {
          nextInput.focus();
        }
      } else if (rowIndex < 4) {
        const nextInput = inputRefs.current[`${sampleId}-${nextRow + 1}-0`];
        if (nextInput) {
          nextInput.focus();
        }
      }
    },
    []
  );

  const handleKeyDown = useCallback((e, sampleId, rowIndex, colIndex) => {
    if (e.key === " ") {
      e.preventDefault();
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];

        // Fill next 10 cells with 0
        let lastFilledRow = rowIndex;
        let lastFilledCol = colIndex;
        for (let i = 0; i < 10; i++) {
          const nextCol = colIndex + i;
          if (nextCol < 20) {
            newFibreCounts[rowIndex][nextCol] = "0";
            lastFilledRow = rowIndex;
            lastFilledCol = nextCol;
          } else {
            const nextRow = rowIndex + 1;
            if (nextRow < 5) {
              newFibreCounts[nextRow][nextCol - 20] = "0";
              lastFilledRow = nextRow;
              lastFilledCol = nextCol - 20;
            }
          }
        }

        // Calculate new totals
        let fibresCounted = 0;
        let fieldsCounted = 0;
        newFibreCounts.forEach((row) => {
          row.forEach((cell) => {
            if (cell !== "") {
              const numValue = parseFloat(cell);
              if (!isNaN(numValue)) {
                fibresCounted += numValue;
                fieldsCounted += 1;
              }
            }
          });
        });

        newAnalyses[sampleId] = {
          ...newAnalyses[sampleId],
          fibreCounts: newFibreCounts,
          fibresCounted: parseFloat(fibresCounted.toFixed(1)),
          fieldsCounted,
        };

        // Find next empty cell after the last filled cell
        let nextEmptyRow = lastFilledRow;
        let nextEmptyCol = lastFilledCol + 1;

        while (nextEmptyRow < 5) {
          while (nextEmptyCol < 20) {
            if (newFibreCounts[nextEmptyRow][nextEmptyCol] === "") {
              const nextInput =
                inputRefs.current[
                  `${sampleId}-${nextEmptyRow}-${nextEmptyCol}`
                ];
              if (nextInput) {
                setTimeout(() => {
                  nextInput.focus();
                }, 0);
                break;
              }
            }
            nextEmptyCol++;
          }
          if (nextEmptyCol < 20) break;
          nextEmptyRow++;
          nextEmptyCol = 0;
        }

        return newAnalyses;
      });
    }
  }, []);

  const handleClearTable = useCallback((sampleId) => {
    setSelectedSampleId(sampleId);
    setConfirmDialogOpen(true);
  }, []);

  const confirmClearTable = () => {
    if (selectedSampleId) {
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[selectedSampleId] = {
          ...newAnalyses[selectedSampleId],
          fibreCounts: Array(5)
            .fill()
            .map(() => Array(20).fill("")),
          fibresCounted: 0,
          fieldsCounted: 0,
        };
        return newAnalyses;
      });
    }
    setConfirmDialogOpen(false);
    setSelectedSampleId(null);
  };

  const isFilterUncountable = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    return (
      analysis?.edgesDistribution === "fail" ||
      analysis?.backgroundDust === "fail"
    );
  };

  const isSampleAnalyzed = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    if (!analysis || isFilterUncountable(sampleId)) {
      return false;
    }

    // Check if all 100 fibre count fields are filled (not empty strings)
    return analysis.fibreCounts.every((row) =>
      row.every((cell) => cell !== "" && cell !== null && cell !== undefined)
    );
  };

  // Get microscope constant info
  const getMicroscopeConstantInfo = (microscopeReference, filterSize) => {
    if (!microscopeReference || !filterSize || pcmCalibrations.length === 0) {
      return { constant: 50000, source: "Default (50000)" };
    }

    const latestPcmCalibration = pcmCalibrations
      .filter((cal) => cal.microscopeReference === microscopeReference)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestPcmCalibration) {
      return {
        constant: 50000,
        source: `Default (no calibration for ${microscopeReference})`,
      };
    }

    if (filterSize === "25mm") {
      const constant = latestPcmCalibration.constant25mm || 50000;
      return {
        constant,
        source: `25mm (${constant})`,
      };
    } else if (filterSize === "13mm") {
      const constant = latestPcmCalibration.constant13mm || 50000;
      return {
        constant,
        source: `13mm (${constant})`,
      };
    }

    return { constant: 50000, source: "Default (invalid filter size)" };
  };

  const getReportedConcentration = (sampleId) => {
    // For client supplied, we might not have flowrate/time, so return N/A for now
    // This can be enhanced later if needed
    return "N/A";
  };

  const isCalibrationComplete = () => {
    return (
      analysisDetails.microscope &&
      analysisDetails.testSlide &&
      analysisDetails.testSlideLines
    );
  };

  // Helper to check if all required fields are filled
  const isAllAnalysisComplete = () => {
    // Check analysis details
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }

    // Check all samples
    const incompleteSamples = samples.filter((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) {
        return true;
      }

      if (!analysis.edgesDistribution || !analysis.backgroundDust) {
        return true;
      }

      // If filter is uncountable, skip fibre counts
      if (
        analysis.edgesDistribution === "fail" ||
        analysis.backgroundDust === "fail"
      ) {
        return false;
      }

      // Check fibre counts
      const hasEmptyCells = analysis.fibreCounts.some((row) => {
        return row.some(
          (cell) => cell === "" || cell === null || typeof cell === "undefined"
        );
      });

      return hasEmptyCells;
    });

    return incompleteSamples.length === 0;
  };

  const handleSaveAndClose = async () => {
    try {
      // Update samples array with analysis data
      const updatedSamples = samples.map((sample) => {
        const analysis = sampleAnalyses[sample._id];
        if (analysis) {
          // Remove _id we added before saving
          const { _id, ...sampleWithoutId } = sample;
          return {
            ...sampleWithoutId,
            analysisData: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: analysis.fibresCounted,
              fieldsCounted: analysis.fieldsCounted,
            },
            analyzedBy: analysedBy || sample.analyzedBy,
            analyzedAt: sample.analyzedAt || new Date(),
          };
        }
        const { _id, ...sampleWithoutId } = sample;
        return sampleWithoutId;
      });

      // Save analyst, analysis date, and sample analysis data to database
      await clientSuppliedJobsService.update(jobId, {
        analyst: analysedBy || undefined,
        analysisDate: analysisDate ? new Date(analysisDate) : undefined,
        samples: updatedSamples,
      });

      // Also save to localStorage for progress recovery
      const progressData = {
        jobId,
        analysisDetails,
        sampleAnalyses,
        analysedBy,
        analysisDate,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));

      showSnackbar("Analysis saved successfully", "success");
      // Navigate back to samples page
      const basePath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";
      navigate(`${basePath}/${jobId}/samples`);
    } catch (error) {
      console.error("Error saving progress data:", error);
      showSnackbar("Failed to save analysis", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update samples array with analysis data and update job
      const updatedSamples = samples.map((sample) => {
        const analysis = sampleAnalyses[sample._id];
        if (analysis) {
          // Remove _id we added before saving
          const { _id, ...sampleWithoutId } = sample;
          return {
            ...sampleWithoutId,
            analysisData: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: analysis.fibresCounted,
              fieldsCounted: analysis.fieldsCounted,
            },
            analyzedBy: analysedBy,
            analyzedAt: new Date(),
          };
        }
        const { _id, ...sampleWithoutId } = sample;
        return sampleWithoutId;
      });

      // Update the job with the updated samples array
      await clientSuppliedJobsService.update(jobId, {
        samples: updatedSamples,
        analyst: analysedBy,
        analysisDate: analysisDate ? new Date(analysisDate) : new Date(),
        status: "Analysis Complete",
      });

      // Clear localStorage
      localStorage.removeItem(ANALYSIS_PROGRESS_KEY);

      showSnackbar("Analysis finalized successfully", "success");

      // Navigate back to samples page
      const basePath = location.pathname.startsWith("/client-supplied")
        ? "/client-supplied"
        : "/fibre-id/client-supplied";
      navigate(`${basePath}/${jobId}/samples`);
    } catch (error) {
      console.error("Error finalizing analysis:", error);
      setError("Failed to finalize analysis. Please try again.");
      showSnackbar("Failed to finalize analysis", "error");
    }
  };

  const handleCancel = () => {
    const progressData = localStorage.getItem(ANALYSIS_PROGRESS_KEY);
    if (progressData) {
      const parsed = JSON.parse(progressData);
      if (parsed.jobId === jobId) {
        // Has unsaved changes
        if (
          window.confirm(
            "You have unsaved changes. Are you sure you want to leave?"
          )
        ) {
          navigate(-1);
        }
        return;
      }
    }
    navigate(-1);
  };

  const handleOpenFibreCountModal = (sampleId) => {
    const analysis = sampleAnalyses[sampleId] || {};

    // Check if both edges/distribution and background dust are selected
    if (!analysis.edgesDistribution || !analysis.backgroundDust) {
      setValidationDialogOpen(true);
      return;
    }

    // Ensure fibreCounts array exists before opening modal
    if (!analysis.fibreCounts || !Array.isArray(analysis.fibreCounts)) {
      // Initialize if missing
      setSampleAnalyses((prev) => ({
        ...prev,
        [sampleId]: {
          ...prev[sampleId],
          fibreCounts: Array(5)
            .fill()
            .map(() => Array(20).fill("")),
          fibresCounted: 0,
          fieldsCounted: 0,
        },
      }));
    }

    setActiveSampleId(sampleId);
    setFibreCountModalOpen(true);
  };

  const handleCloseFibreCountModal = () => {
    setFibreCountModalOpen(false);
    setActiveSampleId(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>Loading analysis...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="error">{error}</Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  const getBackPath = () => {
    const basePath = location.pathname.startsWith("/client-supplied")
      ? "/client-supplied"
      : "/fibre-id/client-supplied";
    if (jobId) {
      return `${basePath}/${jobId}/samples`;
    }
    return basePath;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(getBackPath())}
        sx={{ mb: 4 }}
      >
        Back to Samples
      </Button>

      <Typography
        variant="h2"
        sx={{
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 4,
        }}
      >
        Fibre Count Analysis
      </Typography>

      {/* Analyst and Analysis Date */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
        mb={3}
      >
        <FormControl fullWidth sx={{ maxWidth: 300 }}>
          <InputLabel>Analyst</InputLabel>
          <Select
            value={analysedBy}
            label="Analyst"
            onChange={(e) => setAnalysedBy(e.target.value)}
          >
            {users.map((user) => (
              <MenuItem
                key={user._id}
                value={user.firstName + " " + user.lastName}
              >
                {user.firstName} {user.lastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Analysis Date"
          type="date"
          value={analysisDate}
          onChange={(e) => setAnalysisDate(e.target.value)}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ maxWidth: 300 }}
          fullWidth
        />
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          {/* Analysis Details Section */}
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h5">Microscope Calibration</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Microscope
                  </Typography>
                  <RadioGroup
                    row
                    name="microscope"
                    value={analysisDetails.microscope}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="LD-PCM1"
                      control={<Radio />}
                      label="LD-PCM1"
                    />
                    <FormControlLabel
                      value="LD-PCM2"
                      control={<Radio />}
                      label="LD-PCM2"
                    />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ width: 24 }} />
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Test Slide
                  </Typography>
                  <RadioGroup
                    row
                    name="testSlide"
                    value={analysisDetails.testSlide}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="LD-TS1"
                      control={<Radio />}
                      label="LD-TS1"
                    />
                    <FormControlLabel
                      value="LD-TS2"
                      control={<Radio />}
                      label="LD-TS2"
                    />
                  </RadioGroup>
                </FormControl>
                <Box sx={{ width: 24 }} />
                <FormControl component="fieldset">
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    Test Slide Lines
                  </Typography>
                  <RadioGroup
                    row
                    name="testSlideLines"
                    value={analysisDetails.testSlideLines}
                    onChange={handleAnalysisDetailsChange}
                  >
                    <FormControlLabel
                      value="partial 5"
                      control={<Radio />}
                      label="Partial 5"
                    />
                    <FormControlLabel value="6" control={<Radio />} label="6" />
                  </RadioGroup>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {/* Sample Forms */}
          {isCalibrationComplete() ? (
            <Stack spacing={3}>
              {samples.length <= 5 ? (
                samples.map((sample) => (
                  <SampleSummary
                    key={sample._id}
                    sample={sample}
                    analysis={sampleAnalyses[sample._id]}
                    analysisDetails={analysisDetails}
                    getMicroscopeConstantInfo={getMicroscopeConstantInfo}
                    onAnalysisChange={handleSampleAnalysisChange}
                    onFibreCountChange={handleFibreCountChange}
                    onKeyDown={handleKeyDown}
                    onClearTable={handleClearTable}
                    isFilterUncountable={isFilterUncountable}
                    isSampleAnalyzed={isSampleAnalyzed}
                    calculateConcentration={() => null}
                    getReportedConcentration={getReportedConcentration}
                    inputRefs={inputRefs}
                    isReadOnly={false}
                    onOpenFibreCountModal={handleOpenFibreCountModal}
                  />
                ))
              ) : (
                <Box sx={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
                  <AutoSizer>
                    {({ height, width }) => (
                      <List
                        height={height}
                        width={width}
                        itemCount={samples.length}
                        itemSize={350}
                        overscanCount={2}
                      >
                        {({ index, style }) => (
                          <div style={style}>
                            <SampleSummary
                              sample={samples[index]}
                              analysis={sampleAnalyses[samples[index]._id]}
                              analysisDetails={analysisDetails}
                              getMicroscopeConstantInfo={
                                getMicroscopeConstantInfo
                              }
                              onAnalysisChange={handleSampleAnalysisChange}
                              onFibreCountChange={handleFibreCountChange}
                              onKeyDown={handleKeyDown}
                              onClearTable={handleClearTable}
                              isFilterUncountable={isFilterUncountable}
                              isSampleAnalyzed={isSampleAnalyzed}
                              calculateConcentration={() => null}
                              getReportedConcentration={
                                getReportedConcentration
                              }
                              inputRefs={inputRefs}
                              isReadOnly={false}
                              onOpenFibreCountModal={handleOpenFibreCountModal}
                            />
                          </div>
                        )}
                      </List>
                    )}
                  </AutoSizer>
                </Box>
              )}
            </Stack>
          ) : (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                Complete Microscope Calibration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please select all three microscope calibration options above
                before proceeding with sample analysis.
              </Typography>
            </Paper>
          )}

          <Box
            sx={{ display: "flex", justifyContent: "flex-end", mt: 3, gap: 2 }}
          >
            <Button variant="outlined" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSaveAndClose}>
              Save & Close
            </Button>
            {jobStatus !== "Completed" && (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!isAllAnalysisComplete()}
              >
                Finalise Analysis
              </Button>
            )}
          </Box>
        </Stack>
      </Box>

      {/* Fibre Count Modal */}
      <Dialog
        open={fibreCountModalOpen}
        onClose={handleCloseFibreCountModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Fibre Counts -{" "}
          {activeSampleId !== null &&
            activeSampleId !== undefined &&
            samples.find((s) => s._id === activeSampleId)?.labReference}
        </DialogTitle>
        <DialogContent>
          {activeSampleId !== null &&
          activeSampleId !== undefined &&
          sampleAnalyses[activeSampleId] &&
          sampleAnalyses[activeSampleId].fibreCounts ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                "Spacebar" = 10 zeros, "/" = half fibre
              </Typography>

              {jobStatus !== "Completed" && (
                <Button
                  startIcon={<ClearIcon />}
                  onClick={() => {
                    handleClearTable(activeSampleId);
                    handleCloseFibreCountModal();
                  }}
                  disabled={isFilterUncountable(activeSampleId)}
                  size="small"
                  color="error"
                  sx={{ mb: 2 }}
                >
                  Clear Table
                </Button>
              )}

              <Box sx={{ position: "relative" }}>
                {isFilterUncountable(activeSampleId) && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 1,
                      pointerEvents: "none",
                    }}
                  >
                    <Typography
                      variant="h4"
                      sx={{
                        color: "error.main",
                        fontWeight: "bold",
                        textShadow: "2px 2px 4px rgba(0,0,0,0.2)",
                      }}
                    >
                      Filter Uncountable
                    </Typography>
                  </Box>
                )}
                <TableContainer
                  component={Paper}
                  sx={{ maxHeight: 600, overflow: "auto" }}
                >
                  <Table size="small" sx={{ tableLayout: "fixed" }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: "80px" }}>Range</TableCell>
                        {Array.from({ length: 20 }, (_, i) => (
                          <TableCell
                            key={i}
                            align="center"
                            sx={{ width: "40px", p: 0.5 }}
                          >
                            {i + 1}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Array.isArray(
                        sampleAnalyses[activeSampleId].fibreCounts
                      ) &&
                        sampleAnalyses[activeSampleId].fibreCounts.map(
                          (row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              <TableCell sx={{ p: 0.5 }}>
                                {`${rowIndex * 20 + 1}-${(rowIndex + 1) * 20}`}
                              </TableCell>
                              {row.map((cell, colIndex) => (
                                <TableCell
                                  key={colIndex}
                                  align="center"
                                  sx={{ p: 0.5 }}
                                >
                                  <TextField
                                    type="text"
                                    value={cell}
                                    onChange={(e) =>
                                      handleFibreCountChange(
                                        activeSampleId,
                                        rowIndex,
                                        colIndex,
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(
                                        e,
                                        activeSampleId,
                                        rowIndex,
                                        colIndex
                                      )
                                    }
                                    size="small"
                                    disabled={
                                      isFilterUncountable(activeSampleId) ||
                                      jobStatus === "Completed"
                                    }
                                    inputRef={(el) => {
                                      inputRefs.current[
                                        `${activeSampleId}-${rowIndex}-${colIndex}`
                                      ] = el;
                                    }}
                                    sx={{
                                      width: "40px",
                                      "& .MuiInputBase-input": {
                                        p: 0.5,
                                        textAlign: "center",
                                      },
                                      "& .MuiInputBase-input.Mui-disabled": {
                                        WebkitTextFillColor:
                                          "rgba(0, 0, 0, 0.6)",
                                      },
                                    }}
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          )
                        )}
                      <TableRow>
                        <TableCell colSpan={21}>
                          <Stack
                            direction="row"
                            spacing={4}
                            justifyContent="center"
                          >
                            <Typography>
                              Fibres Counted:{" "}
                              {sampleAnalyses[activeSampleId].fibresCounted ||
                                0}
                            </Typography>
                            <Typography>
                              Fields Counted:{" "}
                              {sampleAnalyses[activeSampleId].fieldsCounted ||
                                0}
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
          ) : (
            <Box sx={{ mt: 2, textAlign: "center", py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Loading fibre counts...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFibreCountModal}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Validation Dialog */}
      <Dialog
        open={validationDialogOpen}
        onClose={() => setValidationDialogOpen(false)}
      >
        <DialogTitle>Required Fields Missing</DialogTitle>
        <DialogContent>
          <Typography>
            Please complete both "Edges/Distribution" and "Background Dust"
            selections before entering fibre counts.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValidationDialogOpen(false)}>OK</Button>
        </DialogActions>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>Clear Fibre Counts?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to clear all fibre counts? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmClearTable} color="error">
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClientSuppliedFibreCountAnalysis;
