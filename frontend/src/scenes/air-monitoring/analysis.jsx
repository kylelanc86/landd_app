import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  Chip,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import { sampleService, shiftService } from "../../services/api";
import { userService } from "../../services/api";
import pcmMicroscopeService from "../../services/pcmMicroscopeService";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useAuth } from "../../context/AuthContext";
import { useSnackbar } from "../../context/SnackbarContext";

const SAMPLES_KEY = "ldc_samples";
const ANALYSIS_PROGRESS_KEY = "ldc_analysis_progress";

// Simplified Sample Summary Component
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
    isLast,
  }) => {
    const theme = useTheme();

    return (
      <Paper
        sx={{
          p: 3,
          display: "block",
          position: "relative",
          overflow: "visible",
        }}
      >
        <Stack spacing={3}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <Box>
              <Typography variant="h5">{sample.fullSampleID}</Typography>
              <Typography variant="body1" color="text.secondary">
                Cowl {sample.cowlNo}
              </Typography>
              {analysisDetails.microscope && (
                <Chip
                  label={`Constant: ${
                    getMicroscopeConstantInfo(
                      analysisDetails.microscope,
                      sample.filterSize
                    ).source
                  }`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 0.5 }}
                />
              )}
            </Box>
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
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            sx={{ mb: 2 }}
          >
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
                  value="low"
                  control={<Radio size="small" />}
                  label="Low"
                />
                <FormControlLabel
                  value="medium"
                  control={<Radio size="small" />}
                  label="Medium"
                />
                <FormControlLabel
                  value="high"
                  control={<Radio size="small" />}
                  label="High"
                />
                <FormControlLabel
                  value="fail"
                  control={<Radio size="small" />}
                  label={<span style={{ color: "red" }}>Fail</span>}
                />
              </RadioGroup>
            </FormControl>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                flex: 1,
                minWidth: 0,
              }}
            >
              <Button
                variant="contained"
                size="small"
                onClick={() => onOpenFibreCountModal(sample._id)}
                disabled={isReadOnly || isFilterUncountable(sample._id)}
              >
                Enter Fibre Counts
              </Button>
            </Box>
          </Stack>

          <Box>
            <Box sx={{ textAlign: "center", mb: 2 }}>
              <Typography variant="h5">Fibre Counts</Typography>
            </Box>

            <Stack direction="row" spacing={4} justifyContent="center">
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Fibres Counted
                </Typography>
                <Typography variant="h6">
                  {analysis.fibresCounted || 0}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Fields Counted
                </Typography>
                <Typography variant="h6">
                  {analysis.fieldsCounted || 0}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Actual Concentration
                </Typography>
                <Typography variant="h6">
                  {calculateConcentration(sample._id) || "N/A"} fibres/mL
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Reported Concentration
                </Typography>
                <Typography variant="h6">
                  {getReportedConcentration(sample._id) || "N/A"} fibres/mL
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    );
  }
);

const Analysis = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
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
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRendered, setIsRendered] = useState(false);
  const [users, setUsers] = useState([]);
  const [analysedBy, setAnalysedBy] = useState("");
  const [shiftStatus, setShiftStatus] = useState("");
  const [fibreCountModalOpen, setFibreCountModalOpen] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [fibreCountSnapshot, setFibreCountSnapshot] = useState(null);

  // Load samples and in-progress analysis data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const startTime = performance.now();
      try {
        setLoading(true);

        console.log("Starting data fetch...");
        const fetchStart = performance.now();

        // Always fetch fresh data
        const samplesResponse = await sampleService.getByShift(shiftId);
        const shiftResponse = await shiftService.getById(shiftId);
        const pcmCalibrationsResponse = await pcmMicroscopeService.getAll();

        if (!isMounted) return;

        // Set shift status and PCM calibrations
        setShiftStatus(shiftResponse.data.status);
        setPcmCalibrations(pcmCalibrationsResponse);

        console.log(`API fetch took ${performance.now() - fetchStart}ms`);
        console.log("Sample count:", samplesResponse.data.length);

        const sortStart = performance.now();
        // Sort samples by AM number in descending order (AM1 first, then AM2, etc.)
        const sortedSamples = samplesResponse.data.sort((a, b) => {
          const aMatch = a.fullSampleID.match(/AM(\d+)$/);
          const bMatch = b.fullSampleID.match(/AM(\d+)$/);
          const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
          const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
          return aNum - bNum; // Keep ascending order for AM numbers (AM1, AM2, AM3...)
        });
        console.log(`Sorting took ${performance.now() - sortStart}ms`);

        const initStart = performance.now();
        // Initialize analyses for each sample
        const initialAnalyses = {};
        sortedSamples.forEach((sample) => {
          if (sample.analysis) {
            initialAnalyses[sample._id] = {
              microscope: sample.analysis.microscope || "",
              testSlide: sample.analysis.testSlide || "",
              testSlideLines: sample.analysis.testSlideLines || "",
              edgesDistribution: sample.analysis.edgesDistribution || "",
              backgroundDust: sample.analysis.backgroundDust || "",
              fibreCounts:
                Array.isArray(sample.analysis.fibreCounts) &&
                sample.analysis.fibreCounts.length === 5
                  ? sample.analysis.fibreCounts.map((row) =>
                      Array.isArray(row) && row.length === 20
                        ? row
                        : Array(20).fill("")
                    )
                  : Array(5)
                      .fill()
                      .map(() => Array(20).fill("")),
              fibresCounted: sample.analysis.fibresCounted || 0,
              fieldsCounted: sample.analysis.fieldsCounted || 0,
            };
          } else {
            initialAnalyses[sample._id] = {
              microscope: "",
              testSlide: "",
              testSlideLines: "",
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
          (s) => s.analysis?.microscope
        );
        if (firstSampleWithAnalysis?.analysis) {
          setAnalysisDetails({
            microscope: firstSampleWithAnalysis.analysis.microscope || "",
            testSlide: firstSampleWithAnalysis.analysis.testSlide || "",
            testSlideLines:
              firstSampleWithAnalysis.analysis.testSlideLines || "",
          });
        }

        // Set analyst from shift data
        if (shiftResponse.data?.analysedBy) {
          setAnalysedBy(shiftResponse.data.analysedBy);
        }

        console.log(`Initialization took ${performance.now() - initStart}ms`);

        const storageStart = performance.now();
        // Load in-progress analysis data if present
        const progressData = localStorage.getItem(ANALYSIS_PROGRESS_KEY);
        if (progressData) {
          const parsed = JSON.parse(progressData);
          if (parsed.shiftId === shiftId) {
            // Only merge if we don't have existing data
            if (!firstSampleWithAnalysis?.analysis) {
              setAnalysisDetails(parsed.analysisDetails);
            }
            // Merge saved analyses with all samples (preserve backend, add new)
            const mergedAnalyses = { ...initialAnalyses };
            Object.keys(parsed.sampleAnalyses).forEach((sampleId) => {
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
        console.log(
          `Storage operations took ${performance.now() - storageStart}ms`
        );

        setSamples(sortedSamples);
        setError(null);

        console.log(
          `Total data operations took ${performance.now() - startTime}ms`
        );
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

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [shiftId]);

  // Monitor render time when samples change
  useEffect(() => {
    if (samples.length > 0) {
      const renderStart = performance.now();
      requestAnimationFrame(() => {
        console.log(`Samples render took ${performance.now() - renderStart}ms`);
      });
    }
  }, [samples]);

  // Fetch users for analyst dropdown - only those with fibre counting approval
  useEffect(() => {
    userService.getAll().then((res) => {
      const allUsers = res.data || [];

      // Filter users who have fibre counting ticked in lab approvals
      const fibreCountingUsers = allUsers.filter(
        (user) =>
          user.isActive &&
          user.labApprovals &&
          user.labApprovals.fibreCounting === true
      );

      // Sort alphabetically by name
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
        // Move to next column in same row
        const nextInput =
          inputRefs.current[`${sampleId}-${nextRow}-${nextCol}`];
        if (nextInput) {
          nextInput.focus();
        }
      } else if (rowIndex < 4) {
        // Move to first column of next row
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

  const handleFillZeros = useCallback((sampleId) => {
    setSampleAnalyses((prev) => {
      const newAnalyses = { ...prev };
      const newFibreCounts = Array(5)
        .fill()
        .map(() => Array(20).fill("0"));

      // Calculate totals (all zeros means 0 fibres, 100 fields)
      newAnalyses[sampleId] = {
        ...newAnalyses[sampleId],
        fibreCounts: newFibreCounts,
        fibresCounted: 0,
        fieldsCounted: 100,
      };
      return newAnalyses;
    });
  }, []);

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

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);

    // Handle case where end time is on the next day
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    return Math.round((end - start) / (1000 * 60));
  };

  // Get the appropriate microscope constant based on microscope and filter size
  const getMicroscopeConstant = (microscopeReference, filterSize) => {
    if (!microscopeReference || !filterSize || pcmCalibrations.length === 0) {
      return 50000; // Fallback to default value
    }

    // Find the latest PCM calibration for the selected microscope
    const latestPcmCalibration = pcmCalibrations
      .filter((cal) => cal.microscopeReference === microscopeReference)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestPcmCalibration) {
      return 50000; // Fallback if no calibration found
    }

    // Return the appropriate constant based on filter size
    if (filterSize === "25mm") {
      return latestPcmCalibration.constant25mm || 50000;
    } else if (filterSize === "13mm") {
      return latestPcmCalibration.constant13mm || 50000;
    }

    return 50000; // Fallback
  };

  // Get microscope constant info for display
  const getMicroscopeConstantInfo = (microscopeReference, filterSize) => {
    if (!microscopeReference || !filterSize || pcmCalibrations.length === 0) {
      return { constant: 50000, source: "Default (50000)" };
    }

    // Find the latest PCM calibration for the selected microscope
    const latestPcmCalibration = pcmCalibrations
      .filter((cal) => cal.microscopeReference === microscopeReference)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestPcmCalibration) {
      return {
        constant: 50000,
        source: `Default (no calibration for ${microscopeReference})`,
      };
    }

    // Return the appropriate constant info based on filter size
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

  const calculateConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    const sample = samples.find((s) => s._id === sampleId);

    if (!analysis || !sample) return null;

    const microscopeConstant = getMicroscopeConstant(
      analysisDetails.microscope,
      sample.filterSize
    );
    const fibresCounted = parseFloat(analysis.fibresCounted) || 0;
    const fieldsCounted = parseInt(analysis.fieldsCounted) || 0;
    const averageFlowrate = parseFloat(sample.averageFlowrate) || 0;
    const minutes = calculateDuration(sample.startTime, sample.endTime);

    if (fieldsCounted === 0 || averageFlowrate === 0 || minutes === 0)
      return null;

    const fibresForCalculation = fibresCounted < 10 ? 10 : fibresCounted;
    const concentration =
      microscopeConstant *
      (fibresForCalculation / fieldsCounted) *
      (1 / (averageFlowrate * 1000 * minutes));

    return parseFloat(concentration.toFixed(4));
  };

  const getReportedConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    const calculatedConc = parseFloat(calculateConcentration(sampleId));

    if (!calculatedConc) return "N/A";

    if (calculatedConc < 0.0149 && analysis.fibresCounted < 10) {
      return "<0.01";
    }

    return calculatedConc.toFixed(2);
  };

  // Check if all required fields for concentration calculation are filled
  const canCalculateConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    const sample = samples.find((s) => s._id === sampleId);

    if (!analysis || !sample) return false;

    // Check if all required fields are filled
    const hasFibreCounts =
      analysis.fibresCounted > 0 && analysis.fieldsCounted > 0;
    const hasFlowrate = parseFloat(sample.averageFlowrate) > 0;
    const hasTiming = sample.startTime && sample.endTime;

    return hasFibreCounts && hasFlowrate && hasTiming;
  };

  const isFormComplete = () => {
    // Check if any analysis details are filled
    if (
      analysisDetails.microscope ||
      analysisDetails.testSlide ||
      analysisDetails.testSlideLines
    ) {
      return true;
    }

    // Check if any sample analyses have data
    return samples.some((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) return false;

      // Check if any fields are filled
      if (analysis.edgesDistribution || analysis.backgroundDust) {
        return true;
      }

      // Check if any fibre counts are entered
      if (analysis.fibresCounted > 0 || analysis.fieldsCounted > 0) {
        return true;
      }

      return false;
    });
  };

  const handleSaveAnalysis = () => {
    console.log("Save Analysis button clicked");
    console.log("Current analysis details:", analysisDetails);
    console.log("Current sample analyses:", sampleAnalyses);

    // Save in-progress data
    const progressData = {
      shiftId: shiftId,
      analysisDetails,
      sampleAnalyses,
      timestamp: new Date().toISOString(),
    };
    console.log("Saving progress data:", progressData);

    try {
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));
      console.log("Progress data saved successfully");
    } catch (error) {
      console.error("Error saving progress data:", error);
    }
  };

  const handleSaveAndClose = () => {
    console.log("Save and Close button clicked");
    // Save in-progress data
    const progressData = {
      shiftId: shiftId,
      analysisDetails,
      sampleAnalyses,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));
      console.log("Progress data saved successfully");
      // Navigate back to samples page
      navigate(-1);
    } catch (error) {
      console.error("Error saving progress data:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("Starting analysis submission...");
      console.log("Analysis Details:", analysisDetails);
      console.log("Sample Analyses:", sampleAnalyses);

      // Update each sample with its analysis data
      const updatePromises = samples.map(async (sample) => {
        const analysis = sampleAnalyses[sample._id];
        if (analysis) {
          const analysisData = {
            analysis: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: analysis.fibresCounted,
              fieldsCounted: analysis.fieldsCounted,
              reportedConcentration: getReportedConcentration(sample._id),
            },
          };
          console.log(
            `Updating sample ${sample.fullSampleID} with data:`,
            JSON.stringify(analysisData, null, 2)
          );
          try {
            const response = await sampleService.update(
              sample._id,
              analysisData
            );
            console.log(
              `Update response for ${sample.fullSampleID}:`,
              response
            );
            return response;
          } catch (error) {
            console.error(
              `Error updating sample ${sample.fullSampleID}:`,
              error.response?.data || error
            );
            throw error;
          }
        }
      });

      // Wait for all sample updates to complete
      const results = await Promise.all(updatePromises);
      console.log("All sample updates completed:", results);

      // Get shift data to get job ID
      const shiftResponse = await shiftService.getById(shiftId);
      const shift = shiftResponse.data;
      const jobId = shift?.job?._id;

      // Update shift status to analysis_complete
      await shiftService.update(shiftId, {
        status: "analysis_complete",
        analysedBy,
        analysisDate: new Date().toISOString(),
      });

      // Navigate to asbestos removal job details page
      if (jobId) {
        navigate(`/asbestos-removal/jobs/${jobId}/details`);
      } else {
        navigate("/asbestos-removal");
      }
    } catch (error) {
      console.error("Error finalizing analysis:", error);
      setError("Failed to finalize analysis. Please try again.");
    }
  };

  const handleReopenShift = async () => {
    try {
      await shiftService.reopen(shiftId);
      showSnackbar("Shift reopened successfully", "success");
      // Fetch fresh shift data to update the status
      const shiftResponse = await shiftService.getById(shiftId);
      setShiftStatus(shiftResponse.data.status);
    } catch (error) {
      console.error("Error reopening shift:", error);
      showSnackbar(
        "Failed to reopen shift. Only admins can reopen shifts.",
        "error"
      );
    }
  };

  const handleCancel = () => {
    if (isFormComplete()) {
      setCancelDialogOpen(true);
    } else {
      navigate(-1);
    }
  };

  const handleOpenFibreCountModal = (sampleId) => {
    const analysis = sampleAnalyses[sampleId] || {};

    // Check if both edges/distribution and background dust are selected
    if (!analysis.edgesDistribution || !analysis.backgroundDust) {
      setValidationDialogOpen(true);
      return;
    }

    // Save a snapshot of the current fibre counts for cancel functionality
    if (analysis.fibreCounts) {
      const snapshot = {
        fibreCounts: analysis.fibreCounts.map((row) => [...row]),
        fibresCounted: analysis.fibresCounted || 0,
        fieldsCounted: analysis.fieldsCounted || 0,
      };
      setFibreCountSnapshot(snapshot);
    } else {
      setFibreCountSnapshot(null);
    }

    setActiveSampleId(sampleId);
    setFibreCountModalOpen(true);
  };

  const handleSaveAndCloseFibreCountModal = () => {
    setFibreCountModalOpen(false);
    setActiveSampleId(null);
    setFibreCountSnapshot(null);
  };

  const handleCancelFibreCountModal = () => {
    if (activeSampleId && fibreCountSnapshot) {
      // Restore the snapshot
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[activeSampleId] = {
          ...newAnalyses[activeSampleId],
          fibreCounts: fibreCountSnapshot.fibreCounts.map((row) => [...row]),
          fibresCounted: fibreCountSnapshot.fibresCounted,
          fieldsCounted: fibreCountSnapshot.fieldsCounted,
        };
        return newAnalyses;
      });
    }
    setFibreCountModalOpen(false);
    setActiveSampleId(null);
    setFibreCountSnapshot(null);
  };

  // Check if all microscope calibration fields are selected
  const isCalibrationComplete = () => {
    return (
      analysisDetails.microscope &&
      analysisDetails.testSlide &&
      analysisDetails.testSlideLines
    );
  };

  // Helper to check if all required fields are filled
  const isAllAnalysisComplete = () => {
    console.log("Checking analysis completion...");

    // Check analysis details
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      console.log("Analysis details incomplete:", {
        microscope: analysisDetails.microscope,
        testSlide: analysisDetails.testSlide,
        testSlideLines: analysisDetails.testSlideLines,
      });
      return false;
    }

    // Check all samples
    const incompleteSamples = samples.filter((sample) => {
      const analysis = sampleAnalyses[sample._id];
      if (!analysis) {
        console.log(`No analysis found for sample ${sample.fullSampleID}`);
        return true;
      }

      if (!analysis.edgesDistribution || !analysis.backgroundDust) {
        console.log(
          `Sample ${sample.fullSampleID} missing edges/distribution or background dust:`,
          {
            edgesDistribution: analysis.edgesDistribution,
            backgroundDust: analysis.backgroundDust,
          }
        );
        return true;
      }

      // If filter is uncountable, skip fibre counts
      if (
        analysis.edgesDistribution === "fail" ||
        analysis.backgroundDust === "fail"
      ) {
        console.log(
          `Sample ${sample.fullSampleID} is uncountable, skipping fibre counts`
        );
        return false;
      }

      // Check fibre counts
      const hasEmptyCells = analysis.fibreCounts.some((row, rowIndex) => {
        const emptyCells = row.filter(
          (cell) => cell === "" || cell === null || typeof cell === "undefined"
        );
        if (emptyCells.length > 0) {
          console.log(
            `Sample ${sample.fullSampleID} has empty cells in row ${
              rowIndex + 1
            }:`,
            emptyCells
          );
        }
        return emptyCells.length > 0;
      });

      if (hasEmptyCells) {
        console.log(
          `Sample ${sample.fullSampleID} has empty fibre count cells`
        );
        return true;
      }

      return false;
    });

    if (incompleteSamples.length > 0) {
      console.log(
        "Incomplete samples:",
        incompleteSamples.map((s) => s.fullSampleID)
      );
      return false;
    }

    console.log("All samples are complete!");
    return true;
  };

  // Render a single sample form
  const renderSampleForm = useCallback(
    ({ index, style }) => {
      const sample = samples[index];
      return (
        <div style={style}>
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
            calculateConcentration={calculateConcentration}
            getReportedConcentration={getReportedConcentration}
            inputRefs={inputRefs}
            isReadOnly={shiftStatus === "analysis_complete"}
            onOpenFibreCountModal={handleOpenFibreCountModal}
          />
        </div>
      );
    },
    [
      samples,
      sampleAnalyses,
      handleSampleAnalysisChange,
      handleFibreCountChange,
      handleKeyDown,
      handleClearTable,
      isFilterUncountable,
      calculateConcentration,
      getReportedConcentration,
      shiftStatus,
      handleOpenFibreCountModal,
    ]
  );

  // Render sample forms based on count
  const renderSampleForms = () => {
    if (samples.length <= 6) {
      // For small sample counts, render directly without virtualization
      return (
        <Box>
          {samples.map((sample, index) => (
            <Box
              key={sample._id}
              sx={{
                mb: index < samples.length - 1 ? 4 : 0,
                display: "block",
              }}
            >
              <SampleSummary
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
                calculateConcentration={calculateConcentration}
                getReportedConcentration={getReportedConcentration}
                inputRefs={inputRefs}
                isReadOnly={shiftStatus === "analysis_complete"}
                onOpenFibreCountModal={handleOpenFibreCountModal}
                isLast={true}
              />
            </Box>
          ))}
        </Box>
      );
    }

    // For larger sample counts, use virtual scrolling
    return (
      <Box sx={{ height: "calc(100vh - 300px)", minHeight: "500px" }}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={samples.length}
              itemSize={500}
              overscanCount={2}
            >
              {renderSampleForm}
            </List>
          )}
        </AutoSizer>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(`/air-monitoring/shift/${shiftId}/samples`)}
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

      {/* Analyst Dropdown - moved to top */}
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
            disabled={shiftStatus === "analysis_complete"}
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
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="LD-PCM2"
                      control={<Radio />}
                      label="LDPCM2"
                      disabled={shiftStatus === "analysis_complete"}
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
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="LD-TS2"
                      control={<Radio />}
                      label="LD-TS2"
                      disabled={shiftStatus === "analysis_complete"}
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
                      disabled={shiftStatus === "analysis_complete"}
                    />
                    <FormControlLabel
                      value="6"
                      control={<Radio />}
                      label="6"
                      disabled={shiftStatus === "analysis_complete"}
                    />
                  </RadioGroup>
                </FormControl>
              </Stack>
            </Stack>
          </Paper>

          {/* Sample Forms */}
          {isCalibrationComplete() ? (
            renderSampleForms()
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
            <Button
              variant="outlined"
              onClick={handleCancel}
              sx={{
                color: theme.palette.primary.main,
                borderColor: theme.palette.primary.main,
                "&:hover": {
                  borderColor: theme.palette.primary.dark,
                },
              }}
            >
              Cancel
            </Button>
            {shiftStatus !== "analysis_complete" && (
              <>
                <Button
                  variant="contained"
                  onClick={handleSaveAndClose}
                  sx={{
                    backgroundColor: theme.palette.primary[400],
                    "&:hover": {
                      backgroundColor: theme.palette.primary[500],
                    },
                  }}
                >
                  Save & Close
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={!isAllAnalysisComplete()}
                  sx={{
                    backgroundColor: "#1976d2",
                    "&:hover": {
                      backgroundColor: "#1565c0",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: theme.palette.grey[700],
                      color: theme.palette.grey[500],
                    },
                  }}
                >
                  Finalise Analysis
                </Button>
              </>
            )}
            {shiftStatus === "analysis_complete" &&
              currentUser?.role === "admin" && (
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={handleReopenShift}
                  sx={{
                    backgroundColor: "#f57c00",
                    "&:hover": {
                      backgroundColor: "#e65100",
                    },
                  }}
                >
                  Reopen Shift (Admin)
                </Button>
              )}
          </Box>

          {/* Fibre Count Modal */}
          <Dialog
            open={fibreCountModalOpen}
            onClose={handleCancelFibreCountModal}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              Fibre Counts -{" "}
              {activeSampleId &&
                samples.find((s) => s._id === activeSampleId)?.fullSampleID}
            </DialogTitle>
            <DialogContent>
              {activeSampleId && sampleAnalyses[activeSampleId] && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    "Spacebar" = 10 zeros, "/" = half fibre
                  </Typography>

                  {shiftStatus !== "analysis_complete" && (
                    <Button
                      startIcon={<ClearIcon />}
                      onClick={() => {
                        handleClearTable(activeSampleId);
                        handleSaveAndCloseFibreCountModal();
                      }}
                      disabled={isFilterUncountable(activeSampleId)}
                      size="small"
                      color="error"
                      sx={{ mb: 2 }}
                    >
                      Clear Table
                    </Button>
                  )}

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

                  <TableContainer>
                    <Table size="small" sx={{ tableLayout: "fixed" }}>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{ width: "80px", position: "relative" }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                              }}
                            >
                              Range
                              <Button
                                size="small"
                                onClick={() => handleFillZeros(activeSampleId)}
                                disabled={
                                  isFilterUncountable(activeSampleId) ||
                                  shiftStatus === "analysis_complete"
                                }
                                sx={{
                                  minWidth: "auto",
                                  width: "16px",
                                  height: "16px",
                                  p: 0,
                                  backgroundColor: "success.main",
                                  opacity: 0,
                                  transition: "opacity 0.2s",
                                  "&:hover": {
                                    opacity: 1,
                                  },
                                  "&.Mui-disabled": {
                                    opacity: 0,
                                  },
                                }}
                                title="Fill all cells with 0"
                              />
                            </Box>
                          </TableCell>
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
                        {sampleAnalyses[activeSampleId].fibreCounts.map(
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
                                      shiftStatus === "analysis_complete"
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
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelFibreCountModal}>Cancel</Button>
              <Button
                onClick={handleSaveAndCloseFibreCountModal}
                variant="contained"
              >
                Save & Close
              </Button>
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

          {/* Cancel Confirmation Dialog */}
          <Dialog
            open={cancelDialogOpen}
            onClose={() => setCancelDialogOpen(false)}
          >
            <DialogTitle>Discard Changes?</DialogTitle>
            <DialogContent>
              <Typography>
                You have unsaved changes. Are you sure you want to discard them?
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCancelDialogOpen(false)}>
                Continue Editing
              </Button>
              <Button onClick={() => navigate(-1)} color="error">
                Discard Changes
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </Box>
  );
};

export default Analysis;
