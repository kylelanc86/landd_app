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
import pcmMicroscopeService from "../../services/pcmMicroscopeService";
import { equipmentService } from "../../services/equipmentService";
import hseTestSlideService from "../../services/hseTestSlideService";
import { graticuleService } from "../../services/graticuleService";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useAuth } from "../../context/AuthContext";
import { useUserLists } from "../../context/UserListsContext";
import { useSnackbar } from "../../context/SnackbarContext";
import { getTodayInSydney } from "../../utils/dateUtils";

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
    isSampleAnalysed,
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
                    : isSampleAnalysed(sample._id)
                    ? "Sample Analysed"
                    : "To be counted"
                }
                color={
                  isFilterUncountable(sample._id)
                    ? "error"
                    : isSampleAnalysed(sample._id)
                    ? "success"
                    : "default"
                }
                size="small"
                sx={{
                  backgroundColor: isFilterUncountable(sample._id)
                    ? "error.main"
                    : isSampleAnalysed(sample._id)
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
                    {analysis.uncountableDueToDust
                      ? "-"
                      : analysis.fibresCounted || 0}
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
                    {analysis.uncountableDueToDust
                      ? "-"
                      : analysis.fieldsCounted || 0}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { activeCounters } = useUserLists();
  const [analysedBy, setAnalysedBy] = useState("");
  const [analysisDate, setAnalysisDate] = useState(getTodayInSydney());
  const [fibreCountModalOpen, setFibreCountModalOpen] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [jobStatus, setJobStatus] = useState("");
  const [activeMicroscopes, setActiveMicroscopes] = useState([]);
  const [activeTestSlides, setActiveTestSlides] = useState([]);

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
      try {
        setLoading(true);

        // Fetch job first to get projectId and embedded samples
        const jobResponse = await clientSuppliedJobsService.getById(jobId);
        const job = jobResponse.data;
        const projectId = job.projectId._id || job.projectId;

        // Samples are now embedded in the job
        const samplesResponse = { data: job.samples || [] };
        const pcmCalibrationsResponse = await pcmMicroscopeService.getAll();
        const graticuleCalibrationsResponse = await graticuleService.getAll();

        if (!isMounted) return;

        setJobStatus(job.status || "In Progress");
        setPcmCalibrations(pcmCalibrationsResponse);
        const graticuleData =
          graticuleCalibrationsResponse.data ||
          graticuleCalibrationsResponse ||
          [];
        setGraticuleCalibrations(graticuleData);

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
            const uncountableDueToDust = ad.uncountableDueToDust || false;
            initialAnalyses[sampleKey] = {
              edgesDistribution: ad.edgesDistribution || "",
              backgroundDust: ad.backgroundDust || "",
              uncountableDueToDust: uncountableDueToDust,
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
              fibresCounted: uncountableDueToDust ? "-" : ad.fibresCounted || 0,
              fieldsCounted: uncountableDueToDust ? "-" : ad.fieldsCounted || 0,
            };
          } else {
            initialAnalyses[sampleKey] = {
              edgesDistribution: "",
              backgroundDust: "",
              uncountableDueToDust: false,
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
        } else if (sortedSamples.length > 0 && sortedSamples[0].analysedBy) {
          const firstSample = sortedSamples[0];
          setAnalysedBy(
            typeof firstSample.analysedBy === "string"
              ? firstSample.analysedBy
              : firstSample.analysedBy?.firstName &&
                firstSample.analysedBy?.lastName
              ? `${firstSample.analysedBy.firstName} ${firstSample.analysedBy.lastName}`
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

        // Set original state for change tracking after data is loaded
        if (isMounted) {
          setTimeout(() => {
            setOriginalState({
              analysisDetails: {
                microscope:
                  firstSampleWithAnalysis?.analysisData?.microscope || "",
                testSlide:
                  firstSampleWithAnalysis?.analysisData?.testSlide || "",
                testSlideLines:
                  firstSampleWithAnalysis?.analysisData?.testSlideLines || "",
              },
              sampleAnalyses: initialAnalyses,
              analysedBy: job.analyst || "",
              analysisDate: job.analysisDate
                ? new Date(job.analysisDate).toISOString().split("T")[0]
                : getTodayInSydney(),
            });
          }, 100);
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

  // Track form changes and compare with original values
  useEffect(() => {
    if (!originalState) return;

    const currentState = {
      analysisDetails,
      sampleAnalyses,
      analysedBy,
      analysisDate,
    };

    const hasChanges =
      JSON.stringify(currentState) !== JSON.stringify(originalState);

    setHasUnsavedChanges(hasChanges);

    // Set global variables for sidebar navigation
    window.hasUnsavedChanges = hasChanges;
    window.currentAnalysisPath = window.location.pathname;
    window.showUnsavedChangesDialog = () => {
      setPendingNavigation(null);
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
  }, [
    analysisDetails,
    sampleAnalyses,
    analysedBy,
    analysisDate,
    originalState,
  ]);

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
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation(null);
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

      const currentPath = window.location.pathname;
      const basePath = currentPath.startsWith("/laboratory-services/ld-supplied")
        ? "/laboratory-services/ld-supplied"
        : currentPath.startsWith("/fibre-id/ld-supplied")
          ? "/fibre-id/ld-supplied"
          : currentPath.startsWith("/client-supplied")
            ? "/client-supplied"
            : "/fibre-id/client-supplied";

      if (href.startsWith("/") && !href.startsWith(basePath)) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigation(href);
        setUnsavedChangesDialogOpen(true);
        return false;
      }
    };

    document.addEventListener("click", handleLinkClick, true);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

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

  const handleClearTableInModal = () => {
    if (activeSampleId !== null && activeSampleId !== undefined) {
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

  const getReportedConcentration = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    // Check for uncountable due to dust first
    if (analysis?.uncountableDueToDust === true) {
      return "UDD";
    }
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
        analysis.backgroundDust === "fail" ||
        analysis.uncountableDueToDust === true
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
          // If uncountable due to dust, set counts to '-' and reported concentration to 'UDD'
          const fibresCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fibresCounted;
          const fieldsCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fieldsCounted;
          return {
            ...sampleWithoutId,
            analysisData: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              uncountableDueToDust: analysis.uncountableDueToDust || false,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: fibresCounted,
              fieldsCounted: fieldsCounted,
            },
            analysedBy: analysedBy || sample.analysedBy,
            analysedAt: sample.analysedAt || new Date(),
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

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      setOriginalState({
        analysisDetails,
        sampleAnalyses,
        analysedBy,
        analysisDate,
      });

      showSnackbar("Analysis saved successfully", "success");
      if (
        location.pathname.startsWith("/laboratory-services/ld-supplied") ||
        location.pathname.startsWith("/fibre-id/ld-supplied")
      ) {
        navigate("/laboratory-services/ld-supplied");
      } else {
        const basePath = location.pathname.startsWith("/client-supplied")
          ? "/client-supplied"
          : "/fibre-id/client-supplied";
        navigate(basePath);
      }
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
          // If uncountable due to dust, set counts to '-' and reported concentration to 'UDD'
          const fibresCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fibresCounted;
          const fieldsCounted = analysis.uncountableDueToDust
            ? "-"
            : analysis.fieldsCounted;
          return {
            ...sampleWithoutId,
            analysisData: {
              microscope: analysisDetails.microscope,
              testSlide: analysisDetails.testSlide,
              testSlideLines: analysisDetails.testSlideLines,
              edgesDistribution: analysis.edgesDistribution,
              backgroundDust: analysis.backgroundDust,
              uncountableDueToDust: analysis.uncountableDueToDust || false,
              fibreCounts: analysis.fibreCounts,
              fibresCounted: fibresCounted,
              fieldsCounted: fieldsCounted,
            },
            analysedBy: analysedBy,
            analysedAt: new Date(),
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

      // Clear unsaved changes flag
      setHasUnsavedChanges(false);

      showSnackbar("Analysis finalized successfully", "success");

      if (
        location.pathname.startsWith("/laboratory-services/ld-supplied") ||
        location.pathname.startsWith("/fibre-id/ld-supplied")
      ) {
        navigate("/laboratory-services/ld-supplied");
      } else {
        const basePath = location.pathname.startsWith("/client-supplied")
          ? "/client-supplied"
          : "/fibre-id/client-supplied";
        navigate(basePath);
      }
    } catch (error) {
      console.error("Error finalizing analysis:", error);
      setError("Failed to finalize analysis. Please try again.");
      showSnackbar("Failed to finalize analysis", "error");
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation(-1);
      setUnsavedChangesDialogOpen(true);
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
    if (
      location.pathname.startsWith("/laboratory-services/ld-supplied") ||
      location.pathname.startsWith("/fibre-id/ld-supplied")
    ) {
      return jobId
        ? `/laboratory-services/ld-supplied/${jobId}/samples`
        : "/laboratory-services/ld-supplied";
    }
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
        onClick={() => {
          if (hasUnsavedChanges) {
            setPendingNavigation(getBackPath());
            setUnsavedChangesDialogOpen(true);
          } else {
            navigate(getBackPath());
          }
        }}
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
            {activeCounters.map((user) => (
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
                    {activeMicroscopes.length > 0 ? (
                      activeMicroscopes.map((microscope) => (
                        <FormControlLabel
                          key={microscope._id}
                          value={microscope.equipmentReference}
                          control={<Radio />}
                          label={microscope.equipmentReference}
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
                    isSampleAnalysed={isSampleAnalysed}
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
                              isSampleAnalysed={isSampleAnalysed}
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

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                {jobStatus !== "Completed" && (
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
                      <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                        <TableCell sx={{ width: "80px", position: "relative" }}>
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
                                jobStatus === "Completed"
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
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Unsaved Changes
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to leave this page
            without saving? All unsaved changes will be lost.
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
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
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
    </Box>
  );
};

export default ClientSuppliedFibreCountAnalysis;
