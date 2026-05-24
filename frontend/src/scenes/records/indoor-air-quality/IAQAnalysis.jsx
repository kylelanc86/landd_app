// IAQ Analysis Component - Based on air-monitoring/analysis.jsx
// Simplified version for Indoor Air Quality sample analysis

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
  Alert,
} from "@mui/material";
import CommentIcon from "@mui/icons-material/Comment";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ClearIcon from "@mui/icons-material/Clear";
import EditIcon from "@mui/icons-material/Edit";
import { iaqSampleService } from "../../../services/iaqSampleService";
import { iaqRecordService } from "../../../services/iaqRecordService";
import pcmMicroscopeService from "../../../services/pcmMicroscopeService";
import { equipmentService } from "../../../services/equipmentService";
import hseTestSlideService from "../../../services/hseTestSlideService";
import { graticuleService } from "../../../services/graticuleService";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { useAuth } from "../../../context/AuthContext";
import { useUserLists } from "../../../context/UserListsContext";
import { useSnackbar } from "../../../context/SnackbarContext";
import {
  generateIAQReference,
  formatIAQSampleDisplay,
  resolveAnalystName,
  getAnalystUserId,
} from "../../../utils/iaqReference";
import LookupField from "../../../components/LookupField";
import LookupRadioGroup from "../../../components/LookupRadioGroup";
import { userOptionsFromList } from "../../../utils/lookupOptions";

const SAMPLES_KEY = "ldc_iaq_samples";
const ANALYSIS_PROGRESS_KEY = "ldc_iaq_analysis_progress";

const getSampleKey = (sampleOrId) =>
  String(typeof sampleOrId === "object" ? sampleOrId._id : sampleOrId);

const normalizeFibreCountCell = (cell) => {
  if (cell === "" || cell === null || cell === undefined) return "";
  return String(cell);
};

const normalizeFibreCountsGrid = (fibreCounts) => {
  if (!fibreCounts || !Array.isArray(fibreCounts) || fibreCounts.length !== 5) {
    return Array(5)
      .fill()
      .map(() => Array(20).fill(""));
  }
  return fibreCounts.map((row) => {
    if (!Array.isArray(row) || row.length !== 20) {
      return Array(20).fill("");
    }
    return row.map(normalizeFibreCountCell);
  });
};

const isFibreCountCellFilled = (cell) =>
  cell !== "" && cell !== null && cell !== undefined;

const isFibreGridComplete = (fibreCounts) => {
  const grid = normalizeFibreCountsGrid(fibreCounts);
  return grid.every((row) => row.every(isFibreCountCellFilled));
};

const buildSampleAnalysisState = (sample) => {
  if (!sample?.analysis) {
    return {
      edgesDistribution: "",
      backgroundDust: "",
      uncountableDueToDust: false,
      fibreCounts: normalizeFibreCountsGrid(null),
      fibresCounted: 0,
      fieldsCounted: 0,
      reportedConcentration: "",
      comment: "",
    };
  }
  const a = sample.analysis;
  return {
    edgesDistribution: a.edgesDistribution || "",
    backgroundDust: a.backgroundDust || "",
    uncountableDueToDust: a.uncountableDueToDust || false,
    fibreCounts: normalizeFibreCountsGrid(a.fibreCounts),
    fibresCounted: a.fibresCounted ?? 0,
    fieldsCounted: a.fieldsCounted ?? 0,
    reportedConcentration: a.reportedConcentration || "",
    comment: a.comment || "",
  };
};

const formatAnalysisFieldLabel = (value) => {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1);
};

// Simplified Sample Summary Component for IAQ
const IAQSampleSummary = React.memo(
  ({
    sample,
    analysis,
    analysisDetails,
    getMicroscopeConstantInfo,
    iaqReference,
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
  }) => {
    const isComplete =
      analysis?.fibreCounts && isFibreGridComplete(analysis.fibreCounts);

    const showAsAnalysed =
      (isReadOnly && sample.status === "analysed") ||
      (isReadOnly && isFibreGridComplete(analysis?.fibreCounts)) ||
      (!isReadOnly && isSampleAnalysed(sample._id));

    return (
      <Paper
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: isComplete ? "#e8f5e9" : "#f5f5f5",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h5">
              {formatIAQSampleDisplay(
                sample.fullSampleID,
                iaqReference,
                sample.sampleNumber
              )}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Cowl {sample.cowlNo || "N/A"}
            </Typography>
            {analysisDetails.microscope && (
              <Chip
                label={`Constant: ${
                  getMicroscopeConstantInfo(
                    analysisDetails.microscope,
                    sample.filterSize
                  )?.source || "N/A"
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
              disabled={isReadOnly && !analysis?.comment}
              sx={{
                textTransform: "none",
                minWidth: "auto",
              }}
            >
              {isReadOnly
                ? analysis?.comment
                  ? "View Comment"
                  : "No Comment"
                : analysis?.comment
                  ? "View/Edit Comment"
                  : "Add Comment"}
            </Button>
            <Chip
              label={
                sample.status === "failed"
                  ? "Failed Sample Collection"
                  : isFilterUncountable(sample._id)
                  ? "Uncountable"
                  : showAsAnalysed
                  ? "Sample Analysed"
                  : "To be counted"
              }
              color={
                sample.status === "failed"
                  ? "error"
                  : isFilterUncountable(sample._id)
                  ? "error"
                  : showAsAnalysed
                  ? "success"
                  : "default"
              }
              size="small"
              sx={{
                backgroundColor: sample.status === "failed"
                  ? "error.main"
                  : isFilterUncountable(sample._id)
                  ? "error.main"
                  : showAsAnalysed
                  ? "success.main"
                  : "grey.400",
                color: "white",
                fontWeight: "bold",
              }}
            />
          </Box>
        </Box>

        {sample.status !== "failed" && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            sx={{ mb: 2 }}
          >
            {isReadOnly ? (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Edges/Distribution
                  </Typography>
                  <Typography variant="body1">
                    {formatAnalysisFieldLabel(analysis?.edgesDistribution)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Background Dust
                  </Typography>
                  <Typography variant="body1">
                    {formatAnalysisFieldLabel(analysis?.backgroundDust)}
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Edges/Distribution
                  </Typography>
                  <RadioGroup
                    row
                    value={analysis?.edgesDistribution || ""}
                    onChange={(e) =>
                      onAnalysisChange(
                        sample._id,
                        "edgesDistribution",
                        e.target.value
                      )
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
                    value={analysis?.backgroundDust || ""}
                    onChange={(e) =>
                      onAnalysisChange(
                        sample._id,
                        "backgroundDust",
                        e.target.value
                      )
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
              </>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                flex: 1,
                minWidth: 0,
              }}
            >
              {analysis?.edgesDistribution && analysis?.backgroundDust && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => onOpenFibreCountModal(sample._id)}
                  disabled={!isReadOnly && isFilterUncountable(sample._id)}
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
                  {isReadOnly
                    ? "View Fibre Counts"
                    : isSampleAnalysed(sample._id)
                      ? "Edit Fibre Counts"
                      : "Enter Fibre Counts"}
                </Button>
              )}
            </Box>
          </Stack>
        )}

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
                  {analysis.uncountableDueToDust
                    ? "N/A"
                    : calculateConcentration(sample._id) || "N/A"}{" "}
                  {!analysis.uncountableDueToDust &&
                    calculateConcentration(sample._id) &&
                    "fibres/mL"}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Reported Concentration
                </Typography>
                <Typography variant="h6">
                  {getReportedConcentration(sample._id) || "N/A"}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      </Paper>
    );
  }
);

IAQSampleSummary.displayName = "IAQSampleSummary";

const IAQAnalysis = () => {
  const theme = useTheme();
  const { iaqRecordId } = useParams();
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
  const { activeCounters } = useUserLists();
  const [analysedBy, setAnalysedBy] = useState("");
  const [iaqRecord, setIaqRecord] = useState(null);
  const [fibreCountModalOpen, setFibreCountModalOpen] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [fibreCountSnapshot, setFibreCountSnapshot] = useState(null);
  const [activeMicroscopes, setActiveMicroscopes] = useState([]);
  const [activeTestSlides, setActiveTestSlides] = useState([]);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [activeCommentSampleId, setActiveCommentSampleId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [allRecords, setAllRecords] = useState([]);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockingAnalysis, setUnlockingAnalysis] = useState(false);

  // Load samples and in-progress analysis data
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch IAQ record, all records (for reference calculation), and samples
        const [recordResponse, allRecordsResponse, samplesResponse] = await Promise.all([
          iaqRecordService.getById(iaqRecordId),
          iaqRecordService.getAll(),
          iaqSampleService.getByIAQRecord(iaqRecordId),
        ]);

        if (!isMounted) return;

        const recordData = recordResponse.data;
        setIaqRecord(recordData);
        const allRecordsData = allRecordsResponse.data || [];
        setAllRecords(allRecordsData);

        const fetchedSamples = samplesResponse.data || [];
        
        // Sort samples by sample number
        const sortedSamples = [...fetchedSamples].sort((a, b) => {
          const aMatch = a.fullSampleID?.match(/AM(\d+)$/);
          const bMatch = b.fullSampleID?.match(/AM(\d+)$/);
          const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
          const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
          return aNum - bNum;
        });

        // Initialize sample analyses from existing data
        const initialAnalyses = {};
        sortedSamples.forEach((sample) => {
          initialAnalyses[getSampleKey(sample)] = buildSampleAnalysisState(sample);
        });

        // Load analysis details from first sample with analysis
        const firstSampleWithAnalysis = sortedSamples.find(
          (s) => s.analysis
        );
        if (firstSampleWithAnalysis?.analysis) {
          setAnalysisDetails({
            microscope: firstSampleWithAnalysis.analysis.microscope || "",
            testSlide: firstSampleWithAnalysis.analysis.testSlide || "",
            testSlideLines:
              firstSampleWithAnalysis.analysis.testSlideLines || "",
          });
        }

        // Load analyst name from record or first analysed sample
        const analystSource =
          recordData.analysedBy ||
          sortedSamples.find((s) => s.analysedBy)?.analysedBy;
        if (analystSource) {
          const analystName = resolveAnalystName(analystSource, activeCounters);
          if (analystName) {
            setAnalysedBy(analystName);
          }
        }

        const isRecordFinalised =
          recordData.status === "Complete - Satisfactory" ||
          recordData.status === "Complete - Failed";

        // Load saved progress from localStorage (skip when analysis is finalised)
        const progressData = !isRecordFinalised
          ? localStorage.getItem(ANALYSIS_PROGRESS_KEY)
          : null;
        if (progressData) {
          const parsed = JSON.parse(progressData);
          if (parsed.iaqRecordId === iaqRecordId) {
            if (!firstSampleWithAnalysis?.analysis) {
              setAnalysisDetails(parsed.analysisDetails);
            }
            if (parsed.analysedBy) {
              const analystName = resolveAnalystName(
                parsed.analysedBy,
                activeCounters
              );
              if (analystName) {
                setAnalysedBy(analystName);
              }
            }
            const mergedAnalyses = { ...initialAnalyses };
            Object.keys(parsed.sampleAnalyses).forEach((sampleId) => {
              const key = getSampleKey(sampleId);
              if (mergedAnalyses[key]) {
                mergedAnalyses[key] = {
                  ...mergedAnalyses[key],
                  ...parsed.sampleAnalyses[sampleId],
                  fibreCounts: normalizeFibreCountsGrid(
                    parsed.sampleAnalyses[sampleId]?.fibreCounts ||
                      mergedAnalyses[key].fibreCounts
                  ),
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

        // Fetch PCM and graticule calibrations
        const [pcmResponse, graticuleResponse] = await Promise.all([
          pcmMicroscopeService.getAll(),
          graticuleService.getAll(),
        ]);

        setPcmCalibrations(pcmResponse);
        const graticuleData =
          graticuleResponse.data || graticuleResponse || [];
        setGraticuleCalibrations(graticuleData);

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
  }, [iaqRecordId]);

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

  // Fetch active microscopes and test slides
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

        // Fetch calibration data for each microscope
        const microscopesWithCalibrations = await Promise.all(
          microscopeEquipment.map(async (microscope) => {
            try {
              const calibrationResponse =
                await pcmMicroscopeService.getByEquipment(
                  microscope.equipmentReference
                );
              const calibrations =
                calibrationResponse.calibrations || calibrationResponse || [];

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
            } catch (error) {
              console.error(
                `Error fetching calibrations for ${microscope.equipmentReference}:`,
                error
              );
              return {
                ...microscope,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active microscopes using calculateStatus
        const active = microscopesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        setActiveMicroscopes(active);

        // Filter for HSE Test Slide equipment
        const testSlideEquipment = allEquipment
          .filter((eq) => eq.equipmentType === "HSE Test Slide")
          .sort((a, b) =>
            a.equipmentReference.localeCompare(b.equipmentReference)
          );

        // Fetch calibration data for test slides
        const testSlidesWithCalibrations = await Promise.all(
          testSlideEquipment.map(async (testSlide) => {
            try {
              // Fetch HSE test slide calibrations for this test slide
              const calibrationResponse =
                await hseTestSlideService.getByEquipment(
                  testSlide.equipmentReference
                );
              // Backend returns { data: data }, so handle both formats
              const calibrations =
                calibrationResponse.data || calibrationResponse || [];

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
            } catch (error) {
              console.error(
                `Error fetching calibrations for ${testSlide.equipmentReference}:`,
                error
              );
              return {
                ...testSlide,
                lastCalibration: null,
                calibrationDue: null,
              };
            }
          })
        );

        // Filter for active test slides using calculateStatus
        const activeTestSlides = testSlidesWithCalibrations.filter(
          (eq) => calculateStatus(eq) === "Active"
        );

        setActiveTestSlides(activeTestSlides);
      } catch (error) {
        console.error("Error fetching active equipment:", error);
      }
    };

    fetchActiveEquipment();
  }, [calculateStatus]);

  const iaqReference = useMemo(
    () => generateIAQReference(iaqRecord, allRecords),
    [iaqRecord, allRecords]
  );

  const isReadOnly = useMemo(
    () =>
      iaqRecord?.status === "Complete - Satisfactory" ||
      iaqRecord?.status === "Complete - Failed",
    [iaqRecord?.status]
  );

  // Re-resolve analyst when user lists load (record may store ObjectId)
  useEffect(() => {
    const source =
      iaqRecord?.analysedBy || samples.find((s) => s.analysedBy)?.analysedBy;
    if (!source || activeCounters.length === 0) return;

    const resolved = resolveAnalystName(source, activeCounters);
    if (
      resolved &&
      resolved !== analysedBy &&
      (!analysedBy || /^[0-9a-fA-F]{24}$/.test(analysedBy))
    ) {
      setAnalysedBy(resolved);
    }
  }, [iaqRecord, samples, activeCounters, analysedBy]);

  const analystDisplayName = useMemo(() => {
    if (analysedBy && !/^[0-9a-fA-F]{24}$/.test(analysedBy)) {
      return analysedBy;
    }
    return (
      resolveAnalystName(iaqRecord?.analysedBy, activeCounters) ||
      resolveAnalystName(
        samples.find((s) => s.analysedBy)?.analysedBy,
        activeCounters
      ) ||
      resolveAnalystName(analysedBy, activeCounters) ||
      ""
    );
  }, [analysedBy, iaqRecord, samples, activeCounters]);

  // Save progress to localStorage
  useEffect(() => {
    if (isReadOnly || samples.length === 0) {
      return;
    }
    if (samples.length > 0) {
      const progressData = {
        iaqRecordId,
        analysisDetails,
        sampleAnalyses,
        analysedBy,
      };
      localStorage.setItem(
        ANALYSIS_PROGRESS_KEY,
        JSON.stringify(progressData)
      );
    }
  }, [analysisDetails, sampleAnalyses, analysedBy, iaqRecordId, samples.length, isReadOnly]);

  // Calculate duration in minutes
  const calculateDuration = useCallback((startTime, endTime) => {
    if (!startTime || !endTime) return 0;

    const parseTime = (timeStr) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return end > start ? end - start : end + 24 * 60 - start;
  }, []);

  // Get microscope constant (using graticule calibrations like original)
  const getMicroscopeConstant = useCallback(
    (microscopeRef, filterSize) => {
      if (!microscopeRef || !filterSize || graticuleCalibrations.length === 0) {
        return 50000; // Fallback to default value
      }

      // Normalize the microscope reference for comparison (trim and lowercase)
      const normalizedMicroscopeRef = microscopeRef.toLowerCase().trim();

      // Find all graticule calibrations assigned to the selected microscope
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
    },
    [graticuleCalibrations]
  );

  // Get microscope constant info for display (using graticule calibrations like original)
  const getMicroscopeConstantInfo = useCallback(
    (microscopeReference, filterSize) => {
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
        return { constant: 50000, source: "Default (no calibration found)" };
      }

      const graticuleId = latestGraticuleCalibration.graticuleId;

      // Return the appropriate constant based on filter size
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

      return { constant: 50000, source: "Default (unknown filter size)" };
    },
    [graticuleCalibrations]
  );

  // Calculate concentration
  const calculateConcentration = useCallback(
    (sampleId) => {
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
    },
    [
      sampleAnalyses,
      samples,
      analysisDetails,
      getMicroscopeConstant,
      calculateDuration,
    ]
  );

  const getReportedConcentration = useCallback(
    (sampleId) => {
      const analysis = sampleAnalyses[sampleId];

      if (analysis?.uncountableDueToDust === true) {
        return "UDD";
      }

      const calculatedConc = parseFloat(calculateConcentration(sampleId));

      if (!calculatedConc) return "N/A";

      if (calculatedConc < 0.0149 && analysis.fibresCounted < 10) {
        return "<0.01";
      }

      return calculatedConc.toFixed(2);
    },
    [sampleAnalyses, calculateConcentration]
  );

  // Check if filter is uncountable
  const isFilterUncountable = useCallback(
    (sampleId) => {
      const analysis = sampleAnalyses[sampleId];
      return (
        analysis?.edgesDistribution === "fail" ||
        analysis?.backgroundDust === "fail" ||
        analysis?.uncountableDueToDust === true
      );
    },
    [sampleAnalyses]
  );

  // Check if sample is analysed
  const isSampleAnalysed = useCallback(
    (sampleId) => {
      const id = getSampleKey(sampleId);
      const sample = samples.find((s) => getSampleKey(s) === id);
      if (isFilterUncountable(id)) {
        return false;
      }
      if (
        isReadOnly &&
        (sample?.status === "analysed" || sample?.analysis?.reportedConcentration)
      ) {
        return true;
      }

      const analysis = sampleAnalyses[id];
      if (!analysis) {
        return false;
      }

      return isFibreGridComplete(analysis.fibreCounts);
    },
    [sampleAnalyses, isFilterUncountable, isReadOnly, samples]
  );

  // Handle analysis details change
  const handleAnalysisDetailsChange = (e) => {
    setAnalysisDetails({
      ...analysisDetails,
      [e.target.name]: e.target.value,
    });
  };

  // Handle sample analysis change
  const handleSampleAnalysisChange = useCallback((sampleId, field, value) => {
    setSampleAnalyses((prev) => {
      const newAnalyses = { ...prev };
      const currentAnalysis = newAnalyses[sampleId] || {};

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

  // Handle fibre count change
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

  // Handle key down
  const handleKeyDown = useCallback((e, sampleId, rowIndex, colIndex) => {
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

        let nextEmptyRow = lastFilledRow;
        let nextEmptyCol = lastFilledCol + 1;

        while (nextEmptyRow < 5) {
          if (nextEmptyCol < 20) {
            const nextInput =
              inputRefs.current[`${sampleId}-${nextEmptyRow}-${nextEmptyCol}`];
            if (nextInput) {
              nextInput.focus();
            }
            break;
          } else {
            nextEmptyRow += 1;
            nextEmptyCol = 0;
          }
        }

        return newAnalyses;
      });
    }
  }, []);

  // Handle clear table
  const handleClearTable = useCallback((sampleId) => {
    setSampleAnalyses((prev) => {
      const newAnalyses = { ...prev };
      newAnalyses[sampleId] = {
        ...newAnalyses[sampleId],
        fibreCounts: Array(5).fill().map(() => Array(20).fill("")),
        fibresCounted: 0,
        fieldsCounted: 0,
      };
      return newAnalyses;
    });
  }, []);

  // Handle open fibre count modal
  const handleOpenFibreCountModal = (sampleId) => {
    const id = getSampleKey(sampleId);
    const sample = samples.find((s) => getSampleKey(s) === id);
    const analysis = {
      ...buildSampleAnalysisState(sample),
      ...(sampleAnalyses[id] || {}),
      fibreCounts: normalizeFibreCountsGrid(
        (sampleAnalyses[id] || buildSampleAnalysisState(sample)).fibreCounts
      ),
    };

    if (
      !isReadOnly &&
      (!analysis.edgesDistribution || !analysis.backgroundDust)
    ) {
      setValidationDialogOpen(true);
      return;
    }

    setSampleAnalyses((prev) => ({
      ...prev,
      [id]: analysis,
    }));

    setFibreCountSnapshot({
      fibreCounts: analysis.fibreCounts.map((row) => [...row]),
      fibresCounted: analysis.fibresCounted ?? 0,
      fieldsCounted: analysis.fieldsCounted ?? 0,
    });

    setActiveSampleId(id);
    setFibreCountModalOpen(true);
  };

  // Handle save and close fibre count modal
  const handleSaveAndCloseFibreCountModal = () => {
    setFibreCountModalOpen(false);
    setActiveSampleId(null);
    setFibreCountSnapshot(null);
  };

  // Handle cancel fibre count modal
  const handleCancelFibreCountModal = () => {
    if (fibreCountSnapshot && activeSampleId) {
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

  // Handle open comment modal
  const handleOpenCommentModal = (sampleId) => {
    const analysis = sampleAnalyses[sampleId];
    setActiveCommentSampleId(sampleId);
    setCommentText(analysis?.comment || "");
    setCommentModalOpen(true);
  };

  // Handle save comment
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

  // Handle cancel comment modal
  const handleCancelCommentModal = () => {
    setCommentModalOpen(false);
    setActiveCommentSampleId(null);
    setCommentText("");
  };

  // Handle delete comment
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

  // Handle fill zeros
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

  // Handle clear table in modal
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

  // Check if calibration is complete
  const isCalibrationComplete = () => {
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }

    if (pcmCalibrations.length === 0) {
      return false;
    }

    const latestPcmCalibration = pcmCalibrations
      .filter((cal) => cal.microscopeReference === analysisDetails.microscope)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    return latestPcmCalibration && latestPcmCalibration.date;
  };

  // Check if all analysis is complete
  const isAllAnalysisComplete = useMemo(() => {
    if (
      !analysisDetails.microscope ||
      !analysisDetails.testSlide ||
      !analysisDetails.testSlideLines
    ) {
      return false;
    }

    const incompleteSamples = samples.filter((sample) => {
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

      if (
        analysis.edgesDistribution === "fail" ||
        analysis.backgroundDust === "fail" ||
        analysis.uncountableDueToDust === true
      ) {
        return false;
      }

      const hasEmptyCells = analysis.fibreCounts.some((row) => {
        return row.some(
          (cell) => cell === "" || cell === null || typeof cell === "undefined"
        );
      });

      return hasEmptyCells;
    });

    return incompleteSamples.length === 0;
  }, [samples, sampleAnalyses, analysisDetails]);

  // Handle save and close
  const handleSaveAndClose = async () => {
    try {
      // Update all samples with current analysis data
      const updatePromises = samples.map(async (sample) => {
        const analysis = sampleAnalyses[sample._id] || {};
        
        // Always include microscope calibration data, even if other analysis data is missing
        const baseAnalysisData = {
          microscope: analysisDetails.microscope || "",
          testSlide: analysisDetails.testSlide || "",
          testSlideLines: analysisDetails.testSlideLines || "",
        };

        // If there's existing analysis data, include it
        if (analysis && Object.keys(analysis).length > 0) {
          const fibresCounted =
            analysis.uncountableDueToDust === true
              ? "-"
              : analysis.fibresCounted;
          const fieldsCounted =
            analysis.uncountableDueToDust === true
              ? "-"
              : analysis.fieldsCounted;

          // Convert fibreCounts from strings to numbers
          const fibreCountsAsNumbers = analysis.fibreCounts
            ? analysis.fibreCounts.map((row) =>
                row.map((cell) => {
                  if (cell === "" || cell === null || cell === undefined) {
                    return 0;
                  }
                  // Handle "0.5" for half fibres
                  const num = parseFloat(cell);
                  return isNaN(num) ? 0 : num;
                })
              )
            : Array(5)
                .fill()
                .map(() => Array(20).fill(0));

          const analysisData = {
            analysis: {
              ...baseAnalysisData,
              edgesDistribution: analysis.edgesDistribution || "",
              backgroundDust: analysis.backgroundDust || "",
              uncountableDueToDust: analysis.uncountableDueToDust || false,
              fibreCounts: fibreCountsAsNumbers,
              fibresCounted: fibresCounted,
              fieldsCounted: fieldsCounted,
              reportedConcentration: getReportedConcentration(sample._id) || "",
              comment: analysis.comment || "",
            },
          };

          await iaqSampleService.update(sample._id, analysisData);
        } else {
          // If no analysis data exists yet, still save the microscope calibration selections
          const analysisData = {
            analysis: baseAnalysisData,
          };
          await iaqSampleService.update(sample._id, analysisData);
        }
      });

      await Promise.all(updatePromises);
      showSnackbar("Analysis saved successfully", "success");
      navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`);
    } catch (error) {
      console.error("Error saving analysis:", error);
      showSnackbar("Failed to save analysis", "error");
    }
  };

  // Handle submit (finalise analysis)
  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
    }

    if (!isAllAnalysisComplete) {
      showSnackbar("Please complete all analysis before finalising", "warning");
      return;
    }

    try {
      // Update all samples with analysis data
      const updatePromises = samples.map(async (sample) => {
        const analysis = sampleAnalyses[sample._id] || {};
        
        // Always include microscope calibration data, even if other analysis data is missing
        const baseAnalysisData = {
          microscope: analysisDetails.microscope || "",
          testSlide: analysisDetails.testSlide || "",
          testSlideLines: analysisDetails.testSlideLines || "",
        };

        // If there's existing analysis data, include it
        if (analysis && Object.keys(analysis).length > 0) {
          const fibresCounted =
            analysis.uncountableDueToDust === true
              ? "-"
              : analysis.fibresCounted;
          const fieldsCounted =
            analysis.uncountableDueToDust === true
              ? "-"
              : analysis.fieldsCounted;

          // Convert fibreCounts from strings to numbers
          const fibreCountsAsNumbers = analysis.fibreCounts
            ? analysis.fibreCounts.map((row) =>
                row.map((cell) => {
                  if (cell === "" || cell === null || cell === undefined) {
                    return 0;
                  }
                  // Handle "0.5" for half fibres
                  const num = parseFloat(cell);
                  return isNaN(num) ? 0 : num;
                })
              )
            : Array(5)
                .fill()
                .map(() => Array(20).fill(0));

          const analysisData = {
            analysis: {
              ...baseAnalysisData,
              edgesDistribution: analysis.edgesDistribution || "",
              backgroundDust: analysis.backgroundDust || "",
              uncountableDueToDust: analysis.uncountableDueToDust || false,
              fibreCounts: fibreCountsAsNumbers,
              fibresCounted: fibresCounted,
              fieldsCounted: fieldsCounted,
              reportedConcentration: getReportedConcentration(sample._id) || "",
              comment: analysis.comment || "",
            },
            analysedBy: getAnalystUserId(analysedBy, activeCounters),
            status: "analysed",
          };

          await iaqSampleService.update(sample._id, analysisData);
        } else {
          // If no analysis data exists yet, still save the microscope calibration selections
          const analysisData = {
            analysis: baseAnalysisData,
            analysedBy: getAnalystUserId(analysedBy, activeCounters),
            status: "analysed",
          };
          await iaqSampleService.update(sample._id, analysisData);
        }
      });

      await Promise.all(updatePromises);

      // Determine status based on reported concentrations
      // Status should be "Complete - Failed" if any non-field-blank sample has a reported concentration that is not '<0.01'
      let recordStatus = "Complete - Satisfactory";
      
      for (const sample of samples) {
        // Skip field blank samples
        if (sample.isFieldBlank === true) {
          continue;
        }
        
        // Get reported concentration for this sample
        const reportedConc = getReportedConcentration(sample._id);
        
        // If reported concentration is not '<0.01', set status to Failed
        // This includes: numbers >= 0.01, "UDD", "N/A", or any other value
        if (reportedConc && reportedConc !== "<0.01") {
          recordStatus = "Complete - Failed";
          break; // No need to check further once we find a failure
        }
      }

      // Update IAQ record status
      await iaqRecordService.update(iaqRecordId, {
        status: recordStatus,
        analysedBy: analystDisplayName || analysedBy,
        analysisDate: new Date().toISOString(),
      });

      // Clear localStorage
      localStorage.removeItem(ANALYSIS_PROGRESS_KEY);

      showSnackbar("Analysis finalised successfully", "success");
      navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`);
    } catch (error) {
      console.error("Error finalising analysis:", error);
      showSnackbar("Failed to finalise analysis", "error");
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setCancelDialogOpen(true);
  };

  const handleUnlockAnalysis = async () => {
    try {
      setUnlockingAnalysis(true);
      const response = await iaqRecordService.unlockAnalysis(iaqRecordId);
      setIaqRecord(response.data);
      setUnlockDialogOpen(false);
      showSnackbar("Analysis unlocked for editing", "success");
    } catch (error) {
      console.error("Error unlocking analysis:", error);
      showSnackbar(
        error.response?.data?.message || "Failed to unlock analysis",
        "error"
      );
    } finally {
      setUnlockingAnalysis(false);
    }
  };

  // Render sample forms
  const renderSampleForms = () => {
    if (samples.length <= 6) {
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
              <IAQSampleSummary
                sample={sample}
                analysis={{
                  ...buildSampleAnalysisState(sample),
                  ...sampleAnalyses[getSampleKey(sample)],
                }}
                analysisDetails={analysisDetails}
                getMicroscopeConstantInfo={getMicroscopeConstantInfo}
                iaqReference={iaqReference}
                onAnalysisChange={handleSampleAnalysisChange}
                onFibreCountChange={handleFibreCountChange}
                onKeyDown={handleKeyDown}
                onClearTable={handleClearTable}
                isFilterUncountable={isFilterUncountable}
                isSampleAnalysed={isSampleAnalysed}
                calculateConcentration={calculateConcentration}
                getReportedConcentration={getReportedConcentration}
                inputRefs={inputRefs}
                isReadOnly={isReadOnly}
                onOpenFibreCountModal={handleOpenFibreCountModal}
                onOpenCommentModal={handleOpenCommentModal}
              />
            </Box>
          ))}
        </Box>
      );
    }

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
              {({ index, style }) => {
                const sample = samples[index];
                const mergedAnalysis = {
                  ...buildSampleAnalysisState(sample),
                  ...sampleAnalyses[getSampleKey(sample)],
                };
                const isComplete = isFibreGridComplete(mergedAnalysis.fibreCounts);
                return (
                  <div
                    style={{
                      ...style,
                      backgroundColor: isComplete ? "#e8f5e9" : "#f5f5f5",
                      padding: "8px",
                    }}
                  >
                    <IAQSampleSummary
                      sample={sample}
                      analysis={mergedAnalysis}
                      analysisDetails={analysisDetails}
                      getMicroscopeConstantInfo={getMicroscopeConstantInfo}
                      iaqReference={iaqReference}
                      onAnalysisChange={handleSampleAnalysisChange}
                      onFibreCountChange={handleFibreCountChange}
                      onKeyDown={handleKeyDown}
                      onClearTable={handleClearTable}
                      isFilterUncountable={isFilterUncountable}
                      isSampleAnalysed={isSampleAnalysed}
                      calculateConcentration={calculateConcentration}
                      getReportedConcentration={getReportedConcentration}
                      inputRefs={inputRefs}
                      isReadOnly={isReadOnly}
                      onOpenFibreCountModal={handleOpenFibreCountModal}
                      onOpenCommentModal={handleOpenCommentModal}
                    />
                  </div>
                );
              }}
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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 2,
          mb: 4,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() =>
            navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`)
          }
        >
          Back to Samples
        </Button>
        {isReadOnly && (
          <Button
            variant="contained"
            color="error"
            startIcon={<EditIcon />}
            onClick={() => setUnlockDialogOpen(true)}
          >
            Edit Analysis
          </Button>
        )}
      </Box>

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
        {isReadOnly ? "Analysis Records" : "Fibre Count Analysis"}
      </Typography>

      {isReadOnly && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Analysis has been finalised. This view is read-only.
        </Alert>
      )}

      {/* Analyst Dropdown */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
        mb={3}
      >
        <LookupField
          sx={{ maxWidth: 300 }}
          mode={isReadOnly ? "view" : "edit"}
          label="Analyst"
          value={analysedBy}
          displayLabel={analystDisplayName}
          options={userOptionsFromList(activeCounters, (u) =>
            `${u.firstName} ${u.lastName}`.trim(),
          )}
          onChange={(e) => setAnalysedBy(e.target.value)}
          allowEmpty
          emptyOptionLabel="Select analyst"
        />
      </Stack>

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          {/* Analysis Details Section */}
          <Paper sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Typography variant="h5">Microscope Calibration</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
                <LookupRadioGroup
                  mode={isReadOnly ? "view" : "edit"}
                  label="Microscope"
                  name="microscope"
                  value={analysisDetails.microscope}
                  displayValue={analysisDetails.microscope}
                  options={activeMicroscopes.map((m) => ({
                    value: m.equipmentReference,
                    label: m.equipmentReference,
                  }))}
                  onChange={handleAnalysisDetailsChange}
                  disabled={isReadOnly}
                  emptyMessage="No active Phase Contrast Microscope available"
                />
                <Box sx={{ width: 24 }} />
                <LookupRadioGroup
                  mode={isReadOnly ? "view" : "edit"}
                  label="Test Slide"
                  name="testSlide"
                  value={analysisDetails.testSlide}
                  displayValue={analysisDetails.testSlide}
                  options={activeTestSlides.map((t) => ({
                    value: t.equipmentReference,
                    label: t.equipmentReference,
                  }))}
                  onChange={handleAnalysisDetailsChange}
                  disabled={isReadOnly}
                  emptyMessage="No active HSE Test Slide available"
                />
                <Box sx={{ width: 24 }} />
                <LookupRadioGroup
                  mode={isReadOnly ? "view" : "edit"}
                  label="Test Slide Lines"
                  name="testSlideLines"
                  value={analysisDetails.testSlideLines}
                  displayValue={
                    analysisDetails.testSlideLines === "Partial5"
                      ? "Partial5"
                      : analysisDetails.testSlideLines
                  }
                  options={[
                    { value: "Partial5", label: "Partial5" },
                    { value: "6", label: "6" },
                  ]}
                  onChange={handleAnalysisDetailsChange}
                  disabled={isReadOnly}
                />
              </Stack>
            </Stack>
          </Paper>

          {/* Sample Forms */}
          {isReadOnly || isCalibrationComplete() ? (
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

          {!isReadOnly && (
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
            </Box>
          )}

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
                formatIAQSampleDisplay(
                  samples.find((s) => s._id === activeSampleId)?.fullSampleID,
                  iaqReference,
                  samples.find((s) => s._id === activeSampleId)?.sampleNumber
                )}
            </DialogTitle>
            <DialogContent sx={{ position: "relative" }}>
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
                    {!isReadOnly && (
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
                                  isReadOnly ||
                                  isFilterUncountable(activeSampleId)
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
                        {(() => {
                          const analysis = sampleAnalyses[activeSampleId] || {};
                          const fibreCounts = normalizeFibreCountsGrid(
                            analysis.fibreCounts
                          );

                          return fibreCounts.map((row, rowIndex) => (
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
                                    value={normalizeFibreCountCell(cell)}
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
                                      isReadOnly ||
                                      isFilterUncountable(activeSampleId)
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
                          ));
                        })()}
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
                                  ?.uncountableDueToDust
                                  ? "-"
                                  : sampleAnalyses[activeSampleId]
                                      ?.fibresCounted || 0}
                              </Typography>
                              <Typography>
                                Fields Counted:{" "}
                                {sampleAnalyses[activeSampleId]
                                  ?.uncountableDueToDust
                                  ? "-"
                                  : sampleAnalyses[activeSampleId]
                                      ?.fieldsCounted || 0}
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
              <Button onClick={handleCancelFibreCountModal}>
                {isReadOnly ? "Close" : "Cancel"}
              </Button>
              {!isReadOnly && (
                <Button
                  onClick={handleSaveAndCloseFibreCountModal}
                  variant="contained"
                >
                  Save & Close
                </Button>
              )}
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
                `Comment - ${formatIAQSampleDisplay(
                  samples.find((s) => s._id === activeCommentSampleId)
                    ?.fullSampleID,
                  iaqReference,
                  samples.find((s) => s._id === activeCommentSampleId)
                    ?.sampleNumber
                )}`}
            </DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                multiline
                rows={6}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Enter comment for this sample..."
                sx={{ mt: 2 }}
                InputProps={{ readOnly: isReadOnly }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCancelCommentModal}>
                {isReadOnly ? "Close" : "Cancel"}
              </Button>
              {!isReadOnly && activeCommentSampleId &&
                sampleAnalyses[activeCommentSampleId]?.comment && (
                  <Button onClick={handleDeleteComment} color="error">
                    Delete Comment
                  </Button>
                )}
              {!isReadOnly && (
                <Button onClick={handleSaveComment} variant="contained">
                  Save Comment
                </Button>
              )}
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
                onClick={() => {
                  setCancelDialogOpen(false);
                  localStorage.removeItem(ANALYSIS_PROGRESS_KEY);
                  navigate(`/records/indoor-air-quality/${iaqRecordId}/samples`);
                }}
                color="error"
              >
                Discard Changes
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Box>

      <Dialog
        open={unlockDialogOpen}
        onClose={() => !unlockingAnalysis && setUnlockDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Unlock Analysis for Editing?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to unlock the analysis details for editing?
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            If you continue:
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
              <li>
                The IAQ record status will be reset to{" "}
                <strong>Samples Submitted to Lab</strong>
              </li>
              <li>
                Report authorisation will be cleared (including any approved
                report details)
              </li>
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setUnlockDialogOpen(false)}
            disabled={unlockingAnalysis}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUnlockAnalysis}
            variant="contained"
            color="warning"
            disabled={unlockingAnalysis}
          >
            {unlockingAnalysis ? "Unlocking..." : "Unlock Analysis"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IAQAnalysis;
