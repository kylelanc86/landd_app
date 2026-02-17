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
  FormHelperText,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import RefreshIcon from "@mui/icons-material/Refresh";
import { sampleService, shiftService } from "../../services/api";
import { userService } from "../../services/api";
import pcmMicroscopeService from "../../services/pcmMicroscopeService";
import { equipmentService } from "../../services/equipmentService";
import hseTestSlideService from "../../services/hseTestSlideService";
import { graticuleService } from "../../services/graticuleService";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useAuth } from "../../context/AuthContext";
import { useSnackbar } from "../../context/SnackbarContext";

const SAMPLES_KEY = "ldc_samples";
const ANALYSIS_PROGRESS_KEY = "ldc_analysis_progress";

// Optimized deep equality check - much faster than JSON.stringify
// This function performs shallow comparison first, then deep comparison only when needed
// Increased maxDepth to handle nested sampleAnalyses structure (sampleAnalyses -> sample -> fibreCounts arrays)
const deepEqual = (a, b, depth = 0, maxDepth = 15) => {
  // Prevent infinite recursion (should rarely hit this with proper data structure)
  // Instead of falling back to JSON.stringify, use a simplified check
  if (depth > maxDepth) {
    // Last resort: type and length checks for arrays/objects
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, i) => val === b[i]);
    }
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      return keysA.length === keysB.length && keysA.every(key => a[key] === b[key]);
    }
    return a === b;
  }

  // Same reference
  if (a === b) return true;

  // Handle null/undefined
  if (a == null || b == null) return a === b;

  // Different types
  if (typeof a !== typeof b) return false;

  // Primitives
  if (typeof a !== "object") return a === b;

  // Arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], depth + 1, maxDepth)) return false;
    }
    return true;
  }

  // Objects - check keys first (shallow check)
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  // Quick shallow comparison for common case
  if (depth === 0) {
    // For top-level, check if all keys match first
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      // For primitive values at top level, do quick comparison
      if (
        typeof a[key] !== "object" ||
        a[key] === null ||
        Array.isArray(a[key])
      ) {
        if (a[key] !== b[key]) {
          // For arrays, need deep check
          if (Array.isArray(a[key])) {
            if (!deepEqual(a[key], b[key], depth + 1, maxDepth)) return false;
          } else {
            return false;
          }
        }
      }
    }
  }

  // Deep comparison for nested objects
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key], depth + 1, maxDepth)) return false;
  }

  return true;
};

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
    isSampleAnalysed,
    calculateConcentration,
    getReportedConcentration,
    inputRefs,
    isReadOnly,
    onOpenFibreCountModal,
    onOpenCommentModal,
    isLast,
    optionalFibreCountReadOnly,
  }) => {
    const theme = useTheme();

    const isComplete = isSampleAnalysed(sample._id);

    return (
      <Box
        sx={{
          backgroundColor: sample.status === "failed"
            ? "#ffebee" // Light red for failed samples
            : isComplete
            ? "#e8f5e9" // Light green
            : "#f5f5f5", // Light grey
          borderRadius: 2,
          p: 3,
          display: "block",
          position: "relative",
          overflow: "visible",
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
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
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 1,
              }}
            >
              <Button
                variant="outlined"
                size="small"
                startIcon={<CommentIcon />}
                onClick={() => onOpenCommentModal(sample._id)}
                disabled={isReadOnly}
                sx={{
                  textTransform: "none",
                  minWidth: "auto",
                }}
              >
                {analysis?.comment ? "View/Edit Comment" : "Add Comment"}
              </Button>
              <Chip
                label={
                  sample.status === "failed"
                    ? "Failed Sample Collection"
                    : isFilterUncountable(sample._id)
                    ? "Uncountable"
                    : isSampleAnalysed(sample._id)
                    ? "Sample Analysed"
                    : "To be counted"
                }
                color={
                  sample.status === "failed"
                    ? "error"
                    : isFilterUncountable(sample._id)
                    ? "error"
                    : isSampleAnalysed(sample._id)
                    ? "success"
                    : "default"
                }
                size="small"
                sx={{
                  backgroundColor: sample.status === "failed"
                    ? "error.main"
                    : isFilterUncountable(sample._id)
                    ? "error.main"
                    : isSampleAnalysed(sample._id)
                    ? "success.main"
                    : "grey.400",
                  color: "white",
                  fontWeight: "bold",
                }}
              />
            </Box>
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
                disabled={
                  sample.status === "failed"
                    ? optionalFibreCountReadOnly
                    : isReadOnly
                }
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
                disabled={
                  sample.status === "failed"
                    ? optionalFibreCountReadOnly
                    : isReadOnly
                }
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
              {sample.status === "failed" ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onOpenFibreCountModal(sample._id)}
                  disabled={optionalFibreCountReadOnly}
                  sx={{ textTransform: "none" }}
                >
                  {isComplete
                    ? "Edit Optional Fibre Count"
                    : "Optional Fibre Count"}
                </Button>
              ) : (
                analysis?.edgesDistribution &&
                analysis?.backgroundDust && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => onOpenFibreCountModal(sample._id)}
                    disabled={isReadOnly || isFilterUncountable(sample._id)}
                    sx={{
                      backgroundColor: isSampleAnalysed(sample._id)
                        ? "success.main"
                        : "grey.500",
                      "&:hover": {
                        backgroundColor: isSampleAnalysed(sample._id)
                          ? "success.dark"
                          : "grey.600",
                      },
                    }}
                  >
                    {isSampleAnalysed(sample._id)
                      ? "Edit Fibre Counts"
                      : "Enter Fibre Counts"}
                  </Button>
                )
              )}
            </Box>
          </Stack>

          {/* Comment Display */}
          {analysis?.comment && (
            <Box
              sx={{
                mt: 1,
                mb: 2,
                p: 1.5,
                backgroundColor: "grey.100",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "grey.300",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: "bold", mb: 0.5 }}
              >
                Comment:
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {analysis.comment}
              </Typography>
            </Box>
          )}

          {isComplete && (
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
                    {analysis.uncountableDueToDust
                      ? "-"
                      : analysis.fibresCounted || 0}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Fields Counted
                  </Typography>
                  <Typography variant="h6">
                    {analysis.uncountableDueToDust
                      ? "-"
                      : analysis.fieldsCounted || 0}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Actual Concentration
                  </Typography>
                  <Typography variant="h6">
                    {sample.status === "failed"
                      ? "N/A"
                      : analysis.uncountableDueToDust
                      ? "N/A"
                      : `${calculateConcentration(sample._id) || "N/A"}${calculateConcentration(sample._id) ? " fibres/mL" : ""}`}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Reported Concentration
                  </Typography>
                  <Typography variant="h6">
                    {sample.status === "failed"
                      ? "N/A"
                      : `${getReportedConcentration(sample._id) || "N/A"}${getReportedConcentration(sample._id) && getReportedConcentration(sample._id) !== "UDD" ? " fibres/mL" : ""}`}
                  </Typography>
                </Box>
              </Stack>

              {/* Field Blank Validation Note */}
              {(sample.isFieldBlank || sample.location === "Field blank") &&
                analysis.fibresCounted >= 2.5 && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 1.5,
                      backgroundColor: "error.light",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "error.main",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="black"
                      sx={{ fontWeight: "bold", textAlign: "center" }}
                    >
                      Elevated fibre count for Field Blank - reject Samples
                    </Typography>
                  </Box>
                )}
            </Box>
          )}
        </Stack>
      </Box>
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
  const [graticuleCalibrations, setGraticuleCalibrations] = useState([]);
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
  const [activeMicroscopes, setActiveMicroscopes] = useState([]);
  const [activeTestSlides, setActiveTestSlides] = useState([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activeCommentSampleId, setActiveCommentSampleId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [analystError, setAnalystError] = useState("");

  // Unsaved changes detection
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [originalState, setOriginalState] = useState(null);

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
        const graticuleCalibrationsResponse = await graticuleService.getAll();

        if (!isMounted) return;

        // Set shift status and calibrations
        setShiftStatus(shiftResponse.data.status);
        setPcmCalibrations(pcmCalibrationsResponse);
        const graticuleData =
          graticuleCalibrationsResponse.data ||
          graticuleCalibrationsResponse ||
          [];
        setGraticuleCalibrations(graticuleData);

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
            const uncountableDueToDust =
              sample.analysis.uncountableDueToDust || false;
            initialAnalyses[sample._id] = {
              microscope: sample.analysis.microscope || "",
              testSlide: sample.analysis.testSlide || "",
              testSlideLines: sample.analysis.testSlideLines || "",
              edgesDistribution: sample.analysis.edgesDistribution || "",
              backgroundDust: sample.analysis.backgroundDust || "",
              uncountableDueToDust: uncountableDueToDust,
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
              fibresCounted: uncountableDueToDust
                ? "-"
                : sample.analysis.fibresCounted || 0,
              fieldsCounted: uncountableDueToDust
                ? "-"
                : sample.analysis.fieldsCounted || 0,
              comment: sample.analysis.comment || "",
            };
          } else {
            initialAnalyses[sample._id] = {
              microscope: "",
              testSlide: "",
              testSlideLines: "",
              edgesDistribution: "",
              backgroundDust: "",
              uncountableDueToDust: false,
              fibreCounts: Array(5)
                .fill()
                .map(() => Array(20).fill("")),
              fibresCounted: 0,
              fieldsCounted: 0,
              comment: "",
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
            // Restore analysedBy if saved
            if (parsed.analysedBy) {
              setAnalysedBy(parsed.analysedBy);
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

        // Set original state for change tracking after data is loaded
        if (isMounted) {
          // Use a setTimeout to ensure state is set after component updates
          setTimeout(() => {
            setOriginalState({
              analysisDetails: {
                microscope: firstSampleWithAnalysis?.analysis?.microscope || "",
                testSlide: firstSampleWithAnalysis?.analysis?.testSlide || "",
                testSlideLines:
                  firstSampleWithAnalysis?.analysis?.testSlideLines || "",
              },
              sampleAnalyses: initialAnalyses,
              analysedBy: shiftResponse.data?.analysedBy || "",
            });
          }, 100);
        }

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

  // Track form changes and compare with original values
  // Use refs to cache previous values and avoid unnecessary deep comparisons
  const prevDepsRef = useRef({
    analysisDetails: null,
    sampleAnalyses: null,
    analysedBy: null,
  });
  const comparisonCacheRef = useRef(null);

  // Use useMemo to perform the comparison only when dependencies change
  const hasChanges = useMemo(() => {
    if (!originalState) {
      // Reset cache when originalState is not set
      comparisonCacheRef.current = null;
      return false;
    }

    // Check if any dependencies have changed by reference (fast shallow check)
    const depsChanged =
      prevDepsRef.current.analysisDetails !== analysisDetails ||
      prevDepsRef.current.sampleAnalyses !== sampleAnalyses ||
      prevDepsRef.current.analysedBy !== analysedBy;

    // If no dependencies changed and we have a cached result, use it
    if (!depsChanged && comparisonCacheRef.current !== null) {
      return comparisonCacheRef.current;
    }

    // Fast path: check primitive value first (analysedBy)
    if (analysedBy !== originalState.analysedBy) {
      prevDepsRef.current = { analysisDetails, sampleAnalyses, analysedBy };
      comparisonCacheRef.current = true;
      return true;
    }

    // Fast path: check analysisDetails shallow equality
    // analysisDetails is a simple object with 3 string properties
    if (
      analysisDetails?.microscope !== originalState.analysisDetails?.microscope ||
      analysisDetails?.testSlide !== originalState.analysisDetails?.testSlide ||
      analysisDetails?.testSlideLines !== originalState.analysisDetails?.testSlideLines
    ) {
      prevDepsRef.current = { analysisDetails, sampleAnalyses, analysedBy };
      comparisonCacheRef.current = true;
      return true;
    }

    // Slow path: deep equality check for sampleAnalyses (only when needed)
    // This is the expensive operation, but we only do it when other checks pass
    const sampleAnalysesChanged = !deepEqual(
      sampleAnalyses,
      originalState.sampleAnalyses
    );

    const hasChangesResult = sampleAnalysesChanged;
    
    // Cache the result and update tracked dependencies
    prevDepsRef.current = { analysisDetails, sampleAnalyses, analysedBy };
    comparisonCacheRef.current = hasChangesResult;
    
    return hasChangesResult;
  }, [analysisDetails, sampleAnalyses, analysedBy, originalState]);

  // Reset cache when originalState changes (e.g., after loading new data)
  useEffect(() => {
    comparisonCacheRef.current = null;
    prevDepsRef.current = {
      analysisDetails: null,
      sampleAnalyses: null,
      analysedBy: null,
    };
  }, [originalState]);

  useEffect(() => {
    if (!originalState) return;

    setHasUnsavedChanges(hasChanges);

    // Set global variables for sidebar navigation
    window.hasUnsavedChanges = hasChanges;
    window.currentAnalysisPath = window.location.pathname;
    window.showUnsavedChangesDialog = () => {
      setPendingNavigation(-1);
      setUnsavedChangesDialogOpen(true);
    };

    return () => {
      // Clean up global variables when component unmounts or changes are cleared
      if (!hasChanges) {
        window.hasUnsavedChanges = false;
        window.currentAnalysisPath = null;
        window.showUnsavedChangesDialog = null;
      }
    };
  }, [hasChanges, originalState]);

  // Handle page refresh and browser navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    // Handle browser back/forward buttons
    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        // Prevent the navigation
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation(-1);
        setUnsavedChangesDialogOpen(true);
      }
    };

    // Handle refresh button clicks and F5 key
    const handleRefreshClick = (e) => {
      const isRefreshButton = e.target.closest(
        'button[aria-label*="refresh"], button[title*="refresh"], .refresh-button'
      );
      const isF5Key = e.key === "F5";

      if ((isRefreshButton || isF5Key) && hasUnsavedChanges) {
        e.preventDefault();
        e.stopPropagation();
        setRefreshDialogOpen(true);
        return false;
      }
    };

    // Add a history entry when entering with unsaved changes
    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.pathname);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleRefreshClick, true);
    document.addEventListener("keydown", handleRefreshClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleRefreshClick, true);
      document.removeEventListener("keydown", handleRefreshClick, true);
    };
  }, [hasUnsavedChanges]);

  // Intercept clicks on navigation links
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleLinkClick = (e) => {
      const target = e.target.closest("a[href]");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      // Check if this is an external navigation
      const currentPath = window.location.pathname;
      if (
        href.startsWith("/") &&
        !href.startsWith(currentPath.split("/").slice(0, 3).join("/"))
      ) {
        e.preventDefault();
        e.stopPropagation();

        setPendingNavigation(href);
        setUnsavedChangesDialogOpen(true);
        return false;
      }
    };

    // Use capture phase to intercept before React Router handles it
    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  // Calculate days until calibration is due
  const calculateDaysUntilCalibration = useCallback((calibrationDue) => {
    if (!calibrationDue) return null;

    const today = new Date();
    const dueDate = new Date(calibrationDue);

    // Reset time to start of day for accurate day calculation
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  }, []);

  // Calculate the actual status based on calibration data and stored status
  const calculateStatus = useCallback(
    (equipment) => {
      if (!equipment) {
        return "Out-of-Service";
      }

      if (equipment.status === "out-of-service") {
        return "Out-of-Service";
      }

      if (!equipment.lastCalibration || !equipment.calibrationDue) {
        return "Out-of-Service";
      }

      const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
      if (daysUntil !== null && daysUntil < 0) {
        return "Calibration Overdue";
      }

      return "Active";
    },
    [calculateDaysUntilCalibration]
  );

  // Fetch active microscopes and test slides with calibration data
  useEffect(() => {
    const fetchActiveEquipment = async () => {
      try {
        const response = await equipmentService.getAll();
        const allEquipment = response.equipment || [];

        // Filter for Phase Contrast Microscope equipment
        const microscopeEquipment = allEquipment
          .filter((eq) => eq.equipmentType === "Phase Contrast Microscope")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for each microscope to determine active status
        const microscopesWithCalibrations = await Promise.all(
          microscopeEquipment.map(async (microscope) => {
            try {
              // Fetch PCM calibrations for this microscope
              const calibrationResponse =
                await pcmMicroscopeService.getByEquipment(
                  microscope.equipmentReference
                );
              const calibrations =
                calibrationResponse.calibrations || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime()
                        )
                      )
                    )
                  : null;

              // Calculate calibrationDue (most recent nextCalibration date)
              const calibrationDue =
                calibrations.length > 0
                  ? calibrations
                      .filter((cal) => cal.nextCalibration)
                      .map((cal) => new Date(cal.nextCalibration).getTime())
                      .length > 0
                    ? new Date(
                        Math.max(
                          ...calibrations
                            .filter((cal) => cal.nextCalibration)
                            .map((cal) =>
                              new Date(cal.nextCalibration).getTime()
                            )
                        )
                      )
                    : null
                  : null;

              return {
                ...microscope,
                lastCalibration,
                calibrationDue,
              };
            } catch (err) {
              console.error(
                `Error fetching calibrations for ${microscope.equipmentReference}:`,
                err
              );
              return {
                ...microscope,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active microscopes (have calibration data and are not overdue)
        const activeMicroscopes = microscopesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        // Filter for HSE Test Slide equipment
        const testSlideEquipment = allEquipment
          .filter((eq) => eq.equipmentType === "HSE Test Slide")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for each test slide to determine active status
        const testSlidesWithCalibrations = await Promise.all(
          testSlideEquipment.map(async (testSlide) => {
            try {
              // Fetch HSE test slide calibrations for this test slide
              const calibrationResponse =
                await hseTestSlideService.getByEquipment(
                  testSlide.equipmentReference
                );
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

              // Calculate lastCalibration (most recent calibration date)
              const lastCalibration =
                calibrations.length > 0
                  ? new Date(
                      Math.max(
                        ...calibrations.map((cal) =>
                          new Date(cal.date).getTime()
                        )
                      )
                    )
                  : null;

              // Calculate calibrationDue (most recent nextCalibration date)
              const calibrationDue =
                calibrations.length > 0
                  ? calibrations
                      .filter((cal) => cal.nextCalibration)
                      .map((cal) => new Date(cal.nextCalibration).getTime())
                      .length > 0
                    ? new Date(
                        Math.max(
                          ...calibrations
                            .filter((cal) => cal.nextCalibration)
                            .map((cal) =>
                              new Date(cal.nextCalibration).getTime()
                            )
                        )
                      )
                    : null
                  : null;

              return {
                ...testSlide,
                lastCalibration,
                calibrationDue,
              };
            } catch (err) {
              console.error(
                `Error fetching calibrations for ${testSlide.equipmentReference}:`,
                err
              );
              return {
                ...testSlide,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active test slides (have calibration data and are not overdue)
        const activeTestSlides = testSlidesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        setActiveMicroscopes(activeMicroscopes);
        setActiveTestSlides(activeTestSlides);
      } catch (error) {
        console.error("Error fetching equipment:", error);
      }
    };

    fetchActiveEquipment();
  }, [calculateStatus]);

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
    setSampleAnalyses((prev) => {
      const newAnalyses = { ...prev };
      const currentAnalysis = newAnalyses[sampleId] || {};

      // If backgroundDust is being set to "fail", automatically set uncountableDueToDust to true
      // and set fibresCounted and fieldsCounted to '-'
      // If backgroundDust is being changed from "fail" to something else, set uncountableDueToDust to false
      if (field === "backgroundDust") {
        if (value === "fail") {
          newAnalyses[sampleId] = {
            ...currentAnalysis,
            [field]: value,
            uncountableDueToDust: true,
            fibresCounted: "-",
            fieldsCounted: "-",
          };
        } else {
          // If changing from fail to something else, clear uncountableDueToDust
          newAnalyses[sampleId] = {
            ...currentAnalysis,
            [field]: value,
            uncountableDueToDust: false,
          };
        }
      } else {
        newAnalyses[sampleId] = {
          ...currentAnalysis,
          [field]: value,
        };
      }

      return newAnalyses;
    });
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
    // Handle spacebar - check multiple properties for tablet keyboard compatibility
    if (
      e.key === " " ||
      e.key === "Spacebar" ||
      e.keyCode === 32 ||
      e.code === "Space"
    ) {
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

    // Handle "/" key for half fibre - check multiple properties for tablet keyboard compatibility
    if (
      e.key === "/" ||
      e.keyCode === 191 ||
      e.code === "Slash" ||
      (e.key === "?" && e.shiftKey === false) // Some keyboards send "?" for "/"
    ) {
      e.preventDefault();
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        const newFibreCounts = [...newAnalyses[sampleId].fibreCounts];
        newFibreCounts[rowIndex][colIndex] = "0.5";

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

        // Move to next cell
        const nextCol = colIndex + 1;
        const nextRow = rowIndex;
        if (nextCol < 20) {
          const nextInput =
            inputRefs.current[`${sampleId}-${nextRow}-${nextCol}`];
          if (nextInput) {
            setTimeout(() => {
              nextInput.focus();
            }, 0);
          }
        } else if (rowIndex < 4) {
          const nextInput = inputRefs.current[`${sampleId}-${nextRow + 1}-0`];
          if (nextInput) {
            setTimeout(() => {
              nextInput.focus();
            }, 0);
          }
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
      analysis?.backgroundDust === "fail" ||
      analysis?.uncountableDueToDust === true
    );
  };

  const isSampleAnalysed = (sampleId) => {
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
  // Uses graticule calibrations (which have constants for 13mm and 25mm filter holders)
  // Logic: Find graticules assigned to the microscope, get the most recent active calibration
  const getMicroscopeConstant = (microscopeReference, filterSize) => {
    if (
      !microscopeReference ||
      !filterSize ||
      graticuleCalibrations.length === 0
    ) {
      return 50000; // Fallback to default value
    }

    // Normalize the microscope reference for comparison (trim and lowercase)
    const normalizedMicroscopeRef = microscopeReference.toLowerCase().trim();

    // Find all graticule calibrations assigned to the selected microscope
    // Match by microscopeReference (string) or microscopeId (populated object with equipmentReference)
    // Use case-insensitive matching to handle variations
    const matchingCalibrations = graticuleCalibrations.filter((cal) => {
      // Match by microscopeReference string (case-insensitive)
      if (cal.microscopeReference) {
        const calRef = cal.microscopeReference.toLowerCase().trim();
        if (calRef === normalizedMicroscopeRef) {
          return true;
        }
      }
      // Match by populated microscopeId object
      if (
        cal.microscopeId &&
        typeof cal.microscopeId === "object" &&
        cal.microscopeId.equipmentReference
      ) {
        const calIdRef = cal.microscopeId.equipmentReference
          .toLowerCase()
          .trim();
        if (calIdRef === normalizedMicroscopeRef) {
          return true;
        }
      }
      return false;
    });

    if (matchingCalibrations.length === 0) {
      return 50000; // Fallback if no calibration found
    }

    // Filter to only "Pass" status calibrations (active graticules)
    const activeCalibrations = matchingCalibrations.filter(
      (cal) => cal.status === "Pass"
    );

    // If no active calibrations, use all calibrations (including failed ones)
    const calibrationsToUse =
      activeCalibrations.length > 0 ? activeCalibrations : matchingCalibrations;

    // Group by graticuleId and get the most recent calibration for each graticule
    const calibrationsByGraticule = {};
    calibrationsToUse.forEach((cal) => {
      const graticuleId = cal.graticuleId;
      if (
        !calibrationsByGraticule[graticuleId] ||
        new Date(cal.date) > new Date(calibrationsByGraticule[graticuleId].date)
      ) {
        calibrationsByGraticule[graticuleId] = cal;
      }
    });

    // Get the most recent calibration overall from all graticules
    const latestGraticuleCalibration = Object.values(
      calibrationsByGraticule
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestGraticuleCalibration) {
      return 50000; // Fallback
    }

    // Return the appropriate constant based on filter size
    if (filterSize === "25mm") {
      const constant = latestGraticuleCalibration.constant25mm;
      if (!constant) {
        return 50000;
      }
      return constant;
    } else if (filterSize === "13mm") {
      const constant = latestGraticuleCalibration.constant13mm;
      if (!constant) {
        return 50000;
      }
      return constant;
    }

    return 50000; // Fallback
  };

  // Get microscope constant info for display
  // Uses graticule calibrations (which have constants for 13mm and 25mm filter holders)
  // Logic: Find graticules assigned to the microscope, get the most recent active calibration
  const getMicroscopeConstantInfo = (microscopeReference, filterSize) => {
    if (
      !microscopeReference ||
      !filterSize ||
      graticuleCalibrations.length === 0
    ) {
      return { constant: 50000, source: "Default (50000)" };
    }

    // Normalize the microscope reference for comparison (trim and lowercase)
    const normalizedMicroscopeRef = microscopeReference.toLowerCase().trim();

    // Find all graticule calibrations assigned to the selected microscope
    // Match by microscopeReference (string) or microscopeId (populated object with equipmentReference)
    // Use case-insensitive matching to handle variations
    const matchingCalibrations = graticuleCalibrations.filter((cal) => {
      // Match by microscopeReference string (case-insensitive)
      if (cal.microscopeReference) {
        if (
          cal.microscopeReference.toLowerCase().trim() ===
          normalizedMicroscopeRef
        ) {
          return true;
        }
      }
      // Match by populated microscopeId object
      if (
        cal.microscopeId &&
        typeof cal.microscopeId === "object" &&
        cal.microscopeId.equipmentReference
      ) {
        if (
          cal.microscopeId.equipmentReference.toLowerCase().trim() ===
          normalizedMicroscopeRef
        ) {
          return true;
        }
      }
      return false;
    });

    if (matchingCalibrations.length === 0) {
      return {
        constant: 50000,
        source: `Default (no graticule calibration for ${microscopeReference})`,
      };
    }

    // Filter to only "Pass" status calibrations (active graticules)
    const activeCalibrations = matchingCalibrations.filter(
      (cal) => cal.status === "Pass"
    );

    // If no active calibrations, use all calibrations (including failed ones)
    const calibrationsToUse =
      activeCalibrations.length > 0 ? activeCalibrations : matchingCalibrations;

    // Group by graticuleId and get the most recent calibration for each graticule
    const calibrationsByGraticule = {};
    calibrationsToUse.forEach((cal) => {
      const graticuleId = cal.graticuleId;
      if (
        !calibrationsByGraticule[graticuleId] ||
        new Date(cal.date) > new Date(calibrationsByGraticule[graticuleId].date)
      ) {
        calibrationsByGraticule[graticuleId] = cal;
      }
    });

    // Get the most recent calibration overall from all graticules
    const latestGraticuleCalibration = Object.values(
      calibrationsByGraticule
    ).sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (!latestGraticuleCalibration) {
      return {
        constant: 50000,
        source: `Default (no valid graticule calibration for ${microscopeReference})`,
      };
    }

    const graticuleId = latestGraticuleCalibration.graticuleId;

    // Return the appropriate constant info based on filter size
    if (filterSize === "25mm") {
      const constant = latestGraticuleCalibration.constant25mm;
      if (constant === null || constant === undefined || constant === 0) {
        return {
          constant: 50000,
          source: `Default (no constant25mm for ${graticuleId})`,
        };
      }
      return {
        constant,
        source: `Graticule ${graticuleId} - 25mm (${constant})`,
      };
    } else if (filterSize === "13mm") {
      const constant = latestGraticuleCalibration.constant13mm;
      if (constant === null || constant === undefined || constant === 0) {
        return {
          constant: 50000,
          source: `Default (no constant13mm for ${graticuleId})`,
        };
      }
      return {
        constant,
        source: `Graticule ${graticuleId} - 13mm (${constant})`,
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
    const sample = samples.find((s) => s._id === sampleId);
    // Failed samples (like field blanks) do not have a fibre concentration
    if (sample?.status === "failed") {
      return "N/A";
    }

    const analysis = sampleAnalyses[sampleId];

    // Check for uncountable due to dust first
    if (analysis?.uncountableDueToDust === true) {
      return "UDD";
    }

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
      analysedBy,
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
      analysedBy,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(ANALYSIS_PROGRESS_KEY, JSON.stringify(progressData));
      console.log("Progress data saved successfully");
      // Clear unsaved changes flag and update original state
      setHasUnsavedChanges(false);
      setOriginalState({
        analysisDetails,
        sampleAnalyses,
        analysedBy,
      });
      // Navigate back to samples page
      navigate(`/air-monitoring/shift/${shiftId}/samples`);
    } catch (error) {
      console.error("Error saving progress data:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAnalystError("");
    if (!analysedBy?.trim()) {
      setAnalystError("Analyst is required");
      showSnackbar("Please select an analyst before finalising the analysis.", "error");
      return;
    }
    try {
      console.log("Starting analysis submission...");
      console.log("Analysis Details:", analysisDetails);
      console.log("Sample Analyses:", sampleAnalyses);

      // Update each sample with its analysis data
      const updatePromises = samples.map(async (sample) => {
        const analysis = sampleAnalyses[sample._id];
        if (analysis) {
          // If uncountable due to dust, set counts to '-' and reported concentration to 'UDD'
          const fibresCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fibresCounted;
          const fieldsCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fieldsCounted;

          const analysisData = {
            analysis: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              uncountableDueToDust: analysis.uncountableDueToDust || false,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: fibresCounted,
              fieldsCounted: fieldsCounted,
              reportedConcentration: getReportedConcentration(sample._id),
              comment: analysis.comment || "",
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

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      localStorage.removeItem(ANALYSIS_PROGRESS_KEY);

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

  // Confirm navigation and discard changes
  const confirmNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setHasUnsavedChanges(false);

    // Clear window variables
    window.hasUnsavedChanges = false;
    window.currentAnalysisPath = null;
    window.showUnsavedChangesDialog = null;

    // Get the target path before clearing pendingNavigation
    const targetPath = pendingNavigation;
    setPendingNavigation(null);

    // Use setTimeout to ensure state updates complete before navigation
    setTimeout(() => {
      // Navigate to the pending location
      if (targetPath === -1) {
        navigate(-1);
      } else if (targetPath) {
        navigate(targetPath);
      } else if (window.pendingNavigation) {
        // Handle sidebar navigation
        navigate(window.pendingNavigation);
        window.pendingNavigation = null;
      } else {
        navigate(-1);
      }
    }, 0);
  };

  // Cancel navigation and stay on page
  const cancelNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setPendingNavigation(null);
  };

  // Confirm page refresh and discard changes
  const confirmRefresh = () => {
    setRefreshDialogOpen(false);
    setHasUnsavedChanges(false);
    window.location.reload();
  };

  // Cancel page refresh and stay on page
  const cancelRefresh = () => {
    setRefreshDialogOpen(false);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges || isFormComplete()) {
      setPendingNavigation(-1);
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

  const handleOpenCommentModal = (sampleId) => {
    const analysis = sampleAnalyses[sampleId] || {};
    setActiveCommentSampleId(sampleId);
    setCommentText(analysis.comment || "");
    setCommentModalOpen(true);
  };

  const handleSaveComment = () => {
    if (activeCommentSampleId) {
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[activeCommentSampleId] = {
          ...newAnalyses[activeCommentSampleId],
          comment: commentText,
        };
        return newAnalyses;
      });
    }
    setCommentModalOpen(false);
    setActiveCommentSampleId(null);
    setCommentText("");
  };

  const handleCancelCommentModal = () => {
    setCommentModalOpen(false);
    setActiveCommentSampleId(null);
    setCommentText("");
  };

  const handleDeleteComment = () => {
    if (activeCommentSampleId) {
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[activeCommentSampleId] = {
          ...newAnalyses[activeCommentSampleId],
          comment: "",
        };
        return newAnalyses;
      });
      setCommentText("");
    }
    setCommentModalOpen(false);
    setActiveCommentSampleId(null);
  };

  const handleClearTableInModal = () => {
    if (activeSampleId) {
      setSampleAnalyses((prev) => {
        const newAnalyses = { ...prev };
        newAnalyses[activeSampleId] = {
          ...newAnalyses[activeSampleId],
          fibreCounts: Array(5)
            .fill()
            .map(() => Array(20).fill("")),
          fibresCounted: 0,
          fieldsCounted: 0,
        };
        return newAnalyses;
      });
    }
  };

  // Check if all microscope calibration fields are selected and microscope has valid calibration date
  const isCalibrationComplete = () => {
    // Check if all three calibration fields are filled
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }

    // Check if the selected microscope has a valid calibration date
    if (pcmCalibrations.length === 0) {
      return false;
    }

    // Find the latest PCM calibration for the selected microscope
    const latestPcmCalibration = pcmCalibrations
      .filter((cal) => cal.microscopeReference === analysisDetails.microscope)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Return true only if calibration exists and has a valid date
    return latestPcmCalibration && latestPcmCalibration.date;
  };

  // Helper to check if all required fields are filled
  // Memoized to prevent recalculation on every render
  const isAllAnalysisComplete = useMemo(() => {
    // Check analysis details
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }

    // Check all samples (exclude failed samples - they don't need analysis)
    const incompleteSamples = samples.filter((sample) => {
      // Skip failed samples - they don't need analysis
      if (sample.status === "failed") {
        return false;
      }

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
        analysis.backgroundDust === "fail" ||
        analysis.uncountableDueToDust === true
      ) {
        return false;
      }

      // Check fibre counts - ensure all cells are filled
      const hasEmptyCells = analysis.fibreCounts.some((row) => {
        return row.some(
          (cell) => cell === "" || cell === null || typeof cell === "undefined"
        );
      });

      return hasEmptyCells;
    });

    return incompleteSamples.length === 0;
  }, [samples, sampleAnalyses, analysisDetails]);

  // Render a single sample form
  const renderSampleForm = useCallback(
    ({ index, style }) => {
      const sample = samples[index];
      const isComplete =
        sampleAnalyses[sample._id] &&
        sampleAnalyses[sample._id].fibreCounts &&
        sampleAnalyses[sample._id].fibreCounts.every((row) =>
          row.every(
            (cell) => cell !== "" && cell !== null && cell !== undefined
          )
        );
      return (
        <div
          style={{
            ...style,
            backgroundColor: isComplete ? "#e8f5e9" : "#f5f5f5",
            padding: "8px",
          }}
        >
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
            isSampleAnalysed={isSampleAnalysed}
            calculateConcentration={calculateConcentration}
            getReportedConcentration={getReportedConcentration}
            inputRefs={inputRefs}
            isReadOnly={shiftStatus === "analysis_complete" || sample.status === "failed"}
            optionalFibreCountReadOnly={shiftStatus === "analysis_complete"}
            onOpenFibreCountModal={handleOpenFibreCountModal}
            onOpenCommentModal={handleOpenCommentModal}
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
      handleOpenCommentModal,
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
                isSampleAnalysed={isSampleAnalysed}
                calculateConcentration={calculateConcentration}
                getReportedConcentration={getReportedConcentration}
                inputRefs={inputRefs}
                isReadOnly={shiftStatus === "analysis_complete" || sample.status === "failed"}
                optionalFibreCountReadOnly={shiftStatus === "analysis_complete"}
                onOpenFibreCountModal={handleOpenFibreCountModal}
                onOpenCommentModal={handleOpenCommentModal}
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
        <FormControl fullWidth sx={{ maxWidth: 300 }} required error={!!analystError}>
          <InputLabel>Analyst</InputLabel>
          <Select
            value={analysedBy}
            label="Analyst"
            onChange={(e) => {
              setAnalysedBy(e.target.value);
              setAnalystError("");
            }}
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
          {analystError && (
            <FormHelperText>{analystError}</FormHelperText>
          )}
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
                    {activeMicroscopes.length > 0 ? (
                      activeMicroscopes.map((microscope) => (
                        <FormControlLabel
                          key={microscope._id}
                          value={microscope.equipmentReference}
                          control={<Radio />}
                          label={microscope.equipmentReference}
                          disabled={shiftStatus === "analysis_complete"}
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No active Phase Contrast Microscope available
                      </Typography>
                    )}
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
                    {activeTestSlides.length > 0 ? (
                      activeTestSlides.map((testSlide) => (
                        <FormControlLabel
                          key={testSlide._id}
                          value={testSlide.equipmentReference}
                          control={<Radio />}
                          label={testSlide.equipmentReference}
                          disabled={shiftStatus === "analysis_complete"}
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No active HSE Test Slide available
                      </Typography>
                    )}
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
                      value="Partial 5"
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
                Please select all three microscope calibration options above and
                ensure the selected microscope has a valid calibration date
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
                  disabled={!isAllAnalysisComplete}
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
              (currentUser?.role === "admin" || currentUser?.role === "super_admin") && (
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

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    {shiftStatus !== "analysis_complete" && (
                      <Button
                        startIcon={<ClearIcon />}
                        onClick={handleClearTableInModal}
                        disabled={isFilterUncountable(activeSampleId)}
                        size="small"
                        color="error"
                      >
                        Clear Table
                      </Button>
                    )}
                  </Box>

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
                        <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
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
                                {sampleAnalyses[activeSampleId]
                                  .uncountableDueToDust
                                  ? "-"
                                  : sampleAnalyses[activeSampleId]
                                      .fibresCounted || 0}
                              </Typography>
                              <Typography>
                                Fields Counted:{" "}
                                {sampleAnalyses[activeSampleId]
                                  .uncountableDueToDust
                                  ? "-"
                                  : sampleAnalyses[activeSampleId]
                                      .fieldsCounted || 0}
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

          {/* Comment Modal */}
          <Dialog
            open={commentModalOpen}
            onClose={handleCancelCommentModal}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {activeCommentSampleId &&
                `Comment - ${
                  samples.find((s) => s._id === activeCommentSampleId)
                    ?.fullSampleID
                }`}
            </DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Enter comment for this sample..."
                disabled={shiftStatus === "analysis_complete"}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelCommentModal}>Cancel</Button>
              {activeCommentSampleId &&
                sampleAnalyses[activeCommentSampleId]?.comment && (
                  <Button
                    onClick={handleDeleteComment}
                    color="error"
                    disabled={shiftStatus === "analysis_complete"}
                  >
                    Delete Comment
                  </Button>
                )}
              <Button
                onClick={handleSaveComment}
                variant="contained"
                disabled={shiftStatus === "analysis_complete"}
              >
                Save Comment
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
              <Button
                onClick={async () => {
                  setCancelDialogOpen(false);
                  setHasUnsavedChanges(false);
                  window.hasUnsavedChanges = false;
                  window.currentAnalysisPath = null;
                  window.showUnsavedChangesDialog = null;

                  // Get shift data to get job ID
                  try {
                    const shiftResponse = await shiftService.getById(shiftId);
                    const shift = shiftResponse.data;
                    const jobId = shift?.job?._id;

                    if (jobId) {
                      navigate(`/asbestos-removal/jobs/${jobId}/details`);
                    } else {
                      navigate("/asbestos-removal");
                    }
                  } catch (error) {
                    console.error("Error fetching shift data:", error);
                    navigate("/asbestos-removal");
                  }
                }}
                color="error"
              >
                Discard Changes
              </Button>
            </DialogActions>
          </Dialog>

          {/* Unsaved Changes Confirmation Dialog */}
          <Dialog
            open={unsavedChangesDialogOpen}
            onClose={cancelNavigation}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "warning.main",
                    color: "white",
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    !
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: 600 }}
                >
                  Unsaved Changes
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
              <Typography variant="body1" sx={{ color: "text.primary" }}>
                You have unsaved changes. Are you sure you want to leave this
                page without saving? All unsaved changes will be lost.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
              <Button
                onClick={cancelNavigation}
                variant="outlined"
                sx={{
                  minWidth: 100,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Stay on Page
              </Button>
              <Button
                onClick={confirmNavigation}
                variant="contained"
                color="warning"
                sx={{
                  minWidth: 120,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Leave Without Saving
              </Button>
            </DialogActions>
          </Dialog>

          {/* Page Refresh Confirmation Dialog */}
          <Dialog
            open={refreshDialogOpen}
            onClose={cancelRefresh}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    bgcolor: "warning.main",
                    color: "white",
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    !
                  </Typography>
                </Box>
                <Typography
                  variant="h5"
                  component="div"
                  sx={{ fontWeight: 600 }}
                >
                  Unsaved Changes
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
              <Typography variant="body1" sx={{ color: "text.primary" }}>
                You have unsaved changes. Are you sure you want to refresh this
                page? All unsaved changes will be lost.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
              <Button
                onClick={cancelRefresh}
                variant="outlined"
                sx={{
                  minWidth: 100,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Stay on Page
              </Button>
              <Button
                onClick={confirmRefresh}
                variant="contained"
                color="warning"
                sx={{
                  minWidth: 120,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Refresh Anyway
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>
    </Box>
  );
};

export default Analysis;
