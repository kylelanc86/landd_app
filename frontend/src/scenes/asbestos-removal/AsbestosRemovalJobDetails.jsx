import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Radio,
  RadioGroup,
  FormLabel,
  Autocomplete,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import MailIcon from "@mui/icons-material/Mail";
import { tokens } from "../../theme/tokens";
import api from "../../services/api";
import {
  jobService,
  shiftService,
  sampleService,
  projectService,
  clientService,
  userService,
} from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";
import { generateShiftReport } from "../../utils/generateShiftReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/dateFormat";
import { hasPermission } from "../../config/permissions";
import PermissionGate from "../../components/PermissionGate";

const TIMING_LOG_PREFIX = "[AsbestosRemovalJobDetails]";
const TIMING_ENABLED = true;

const getTimestamp = () =>
  typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();

const AsbestosRemovalJobDetails = () => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const renderStart = getTimestamp();
  if (TIMING_ENABLED && renderCountRef.current > 1) {
    console.log(
      `${TIMING_LOG_PREFIX} Component render #${renderCountRef.current}`,
      {
        timestamp: new Date().toISOString(),
      }
    );
  }

  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { currentUser } = useAuth();

  const logDebug = useCallback((stage, details) => {
    if (!TIMING_ENABLED || typeof console === "undefined") {
      return;
    }

    if (details === undefined) {
      console.log(`${TIMING_LOG_PREFIX} ${stage}`);
    } else {
      console.log(`${TIMING_LOG_PREFIX} ${stage}`, details);
    }
  }, []);

  // Debug logging for current user
  useEffect(() => {
    console.log("Current User in AsbestosRemovalJobDetails:", {
      id: currentUser?._id,
      firstName: currentUser?.firstName,
      lastName: currentUser?.lastName,
      role: currentUser?.role,
      labSignatory: currentUser?.labSignatory,
      fullUser: currentUser,
    });
  }, [currentUser]);

  const [job, setJob] = useState(null);
  const [airMonitoringShifts, setAirMonitoringShifts] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [clearancesLoading, setClearancesLoading] = useState(false);
  const [clearancesLoaded, setClearancesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [creating, setCreating] = useState(false);

  // Clearance modal state
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState(null);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const { showSnackbar } = useSnackbar();
  const [reportViewedShiftIds, setReportViewedShiftIds] = useState(new Set());
  const [reportViewedClearanceIds, setReportViewedClearanceIds] = useState(
    new Set()
  );
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] =
    useState({});
  const [
    sendingClearanceAuthorisationRequests,
    setSendingClearanceAuthorisationRequests,
  ] = useState({});
  const [authorisingClearanceReports, setAuthorisingClearanceReports] =
    useState({});
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState("");
  const [editingShift, setEditingShift] = useState(null);
  const [shiftCreating, setShiftCreating] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetShiftId, setResetShiftId] = useState(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'clearance' or 'shift'

  const [clearanceForm, setClearanceForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "09:00 AM",
    clearanceType: "Non-friable",
    asbestosRemovalist: "",
    LAA: "",
    jurisdiction: "ACT",
    secondaryHeader: "",
    vehicleEquipmentDescription: "",
    airMonitoring: false,
    airMonitoringReport: null,
    airMonitoringReportType: "select",
    notes: "",
    useComplexTemplate: false,
    jobSpecificExclusions: "",
  });

  const latestFetchIdRef = useRef(0);
  const clearancesBackgroundFetchTriggeredRef = useRef(false);
  const clearancesLoadingRef = useRef(false);

  const fetchJobDetails = useCallback(
    async ({ silent = false, excludeClearances = false } = {}) => {
      if (!jobId) return;

      const fetchId = Date.now();
      latestFetchIdRef.current = fetchId;

      const timingLabel = `asbestosRemovalJobDetails:${jobId}`;
      const startTime = getTimestamp();

      const logTiming = (stage, details) => {
        if (!TIMING_ENABLED || typeof console === "undefined") {
          return;
        }

        const elapsed = getTimestamp() - startTime;
        const baseMessage = `[${timingLabel}] ${stage}${
          stage ? " " : ""
        }(${Math.round(elapsed)}ms elapsed)`;

        if (details === undefined) {
          console.log(baseMessage);
        } else {
          console.log(baseMessage, details);
        }
      };

      const scheduleCommitLog = (stage, details) => {
        if (!TIMING_ENABLED) {
          return;
        }

        const commitStart = getTimestamp();
        const runner = () =>
          logTiming(stage, {
            ...details,
            commitDelayMs: Math.round(getTimestamp() - commitStart),
          });

        if (typeof window !== "undefined" && window.requestAnimationFrame) {
          window.requestAnimationFrame(runner);
        } else {
          setTimeout(runner, 0);
        }
      };

      const finishTiming = (stage) => {
        if (!TIMING_ENABLED || typeof console === "undefined") {
          return;
        }

        if (stage) {
          logTiming(stage);
        }

        const totalElapsed = getTimestamp() - startTime;
        console.log(
          `[${timingLabel}] completed (${Math.round(totalElapsed)}ms total)`
        );
      };

      logTiming("start");
      logDebug("fetchJobDetails invoked", {
        silent,
        fetchId,
        jobId,
        excludeClearances,
      });

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const isActive = () => latestFetchIdRef.current === fetchId;

      try {
        const requestStart = getTimestamp();
        logTiming("job details request start");
        const jobResponse = await asbestosRemovalJobService.getDetails(jobId, {
          excludeClearances: excludeClearances ? "true" : undefined,
        });
        const requestDuration = Math.round(getTimestamp() - requestStart);

        const responseDataSize = JSON.stringify(jobResponse.data || {}).length;
        logTiming("job details response received", {
          requestDurationMs: requestDuration,
          responseDataSizeBytes: responseDataSize,
          responseDataSizeKB: Math.round((responseDataSize / 1024) * 100) / 100,
        });

        const jobPayload = jobResponse.data || {};
        logDebug("job details payload received", {
          keys: Object.keys(jobPayload || {}),
          fetchId,
        });

        if (!isActive()) {
          finishTiming("stale job response");
          return;
        }

        // Log job data size
        const jobDataSize = JSON.stringify(jobPayload.job || {}).length;
        const jobStart = getTimestamp();
        setJob(jobPayload.job || null);
        const jobSetDuration = Math.round(getTimestamp() - jobStart);
        logTiming("job resolved", {
          hasJob: Boolean(jobPayload.job),
          jobDataSizeBytes: jobDataSize,
          jobDataSizeKB: Math.round((jobDataSize / 1024) * 100) / 100,
          setStateDurationMs: jobSetDuration,
        });
        scheduleCommitLog("job state committed", {
          hasJob: Boolean(jobPayload.job),
        });

        const shiftsPayloadStart = getTimestamp();
        const shiftsPayload = Array.isArray(jobPayload.shifts)
          ? jobPayload.shifts
          : [];
        const shiftsPayloadSize = JSON.stringify(shiftsPayload).length;
        const shiftsPayloadDuration = Math.round(
          getTimestamp() - shiftsPayloadStart
        );
        logTiming("shifts payload extracted", {
          shiftCount: shiftsPayload.length,
          shiftsDataSizeBytes: shiftsPayloadSize,
          shiftsDataSizeKB: Math.round((shiftsPayloadSize / 1024) * 100) / 100,
          extractionDurationMs: shiftsPayloadDuration,
        });

        let enrichedShifts = shiftsPayload;

        if (Array.isArray(jobPayload.sampleNumbers)) {
          const sampleNumbersSize = JSON.stringify(
            jobPayload.sampleNumbers
          ).length;
          logTiming("sample numbers array found", {
            sampleNumberEntries: jobPayload.sampleNumbers.length,
            sampleNumbersDataSizeBytes: sampleNumbersSize,
            sampleNumbersDataSizeKB:
              Math.round((sampleNumbersSize / 1024) * 100) / 100,
          });

          const mapStart = getTimestamp();
          const sampleNumberMap = new Map(
            jobPayload.sampleNumbers
              .filter(
                (entry) =>
                  entry &&
                  entry.shiftId &&
                  Array.isArray(entry.sampleNumbers) &&
                  entry.sampleNumbers.length
              )
              .map((entry) => [entry.shiftId, entry.sampleNumbers])
          );
          const mapDuration = Math.round(getTimestamp() - mapStart);
          logTiming("sample number map created", {
            hydratedShiftCount: sampleNumberMap.size,
            mapCreationDurationMs: mapDuration,
          });

          if (sampleNumberMap.size) {
            const enrichStart = getTimestamp();
            enrichedShifts = shiftsPayload.map((shift) =>
              sampleNumberMap.has(shift._id)
                ? {
                    ...shift,
                    sampleNumbers: sampleNumberMap.get(shift._id),
                  }
                : shift
            );
            const enrichDuration = Math.round(getTimestamp() - enrichStart);
            logTiming("sample numbers hydrated", {
              enrichmentDurationMs: enrichDuration,
            });
          }
        }

        const shiftsSetStart = getTimestamp();
        // Sort shifts by date (newest to oldest)
        const sortedShifts = [...enrichedShifts].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateB - dateA; // Newest first
        });
        setAirMonitoringShifts(sortedShifts);
        const shiftsSetDuration = Math.round(getTimestamp() - shiftsSetStart);
        const enrichedShiftsSize = JSON.stringify(enrichedShifts).length;
        logTiming(`shifts set (${enrichedShifts.length})`, {
          setStateDurationMs: shiftsSetDuration,
          enrichedShiftsDataSizeBytes: enrichedShiftsSize,
          enrichedShiftsDataSizeKB:
            Math.round((enrichedShiftsSize / 1024) * 100) / 100,
        });
        scheduleCommitLog("airMonitoringShifts committed", {
          shiftCount: enrichedShifts.length,
        });

        // Only process clearances if they weren't excluded
        if (!excludeClearances) {
          const clearancesStart = getTimestamp();
          const clearancesPayload = Array.isArray(jobPayload.clearances)
            ? jobPayload.clearances
            : [];
          const clearancesSize = JSON.stringify(clearancesPayload).length;

          // Analyze clearance structure to identify large fields
          if (clearancesPayload.length > 0 && TIMING_ENABLED) {
            const sampleClearance = clearancesPayload[0];
            const fieldSizes = {};
            Object.keys(sampleClearance || {}).forEach((key) => {
              const fieldValue = sampleClearance[key];
              const fieldSize = JSON.stringify(fieldValue || {}).length;
              fieldSizes[key] = {
                sizeBytes: fieldSize,
                sizeKB: Math.round((fieldSize / 1024) * 100) / 100,
                type: Array.isArray(fieldValue)
                  ? `array[${fieldValue.length}]`
                  : typeof fieldValue,
              };
            });

            // Sort by size to show largest fields first
            const sortedFields = Object.entries(fieldSizes)
              .sort(([, a], [, b]) => b.sizeBytes - a.sizeBytes)
              .slice(0, 10); // Top 10 largest fields

            console.log(
              `${TIMING_LOG_PREFIX} Clearance structure analysis (sample)`,
              {
                totalFields: Object.keys(fieldSizes).length,
                largestFields: Object.fromEntries(sortedFields),
                recommendation:
                  sortedFields[0] && sortedFields[0][1].sizeKB > 10
                    ? `Field '${sortedFields[0][0]}' is ${sortedFields[0][1].sizeKB}KB - consider reducing or lazy loading`
                    : "All fields appear reasonable in size",
              }
            );
          }

          // Sort clearances by clearanceDate (newest to oldest)
          const sortedClearances = [...clearancesPayload].sort((a, b) => {
            const dateA = a.clearanceDate
              ? new Date(a.clearanceDate).getTime()
              : 0;
            const dateB = b.clearanceDate
              ? new Date(b.clearanceDate).getTime()
              : 0;
            return dateB - dateA; // Newest first
          });
          setClearances(sortedClearances);
          setClearancesLoaded(true); // Mark as loaded when fetched via fetchJobDetails
          const clearancesSetDuration = Math.round(
            getTimestamp() - clearancesStart
          );
          logTiming(`clearances set (${clearancesPayload.length})`, {
            setStateDurationMs: clearancesSetDuration,
            clearancesDataSizeBytes: clearancesSize,
            clearancesDataSizeKB:
              Math.round((clearancesSize / 1024) * 100) / 100,
          });
          scheduleCommitLog("clearances committed", {
            clearanceCount: clearancesPayload.length,
          });
        } else {
          logTiming("clearances excluded from fetch");
        }

        scheduleCommitLog("job detail state committed", {
          shiftCount: enrichedShifts.length,
          clearanceCount: excludeClearances
            ? 0
            : Array.isArray(jobPayload.clearances)
            ? jobPayload.clearances.length
            : 0,
        });

        // Performance summary - identify bottlenecks (only if clearances were included)
        if (!excludeClearances) {
          const clearancesPayload = Array.isArray(jobPayload.clearances)
            ? jobPayload.clearances
            : [];
          const clearancesSize = JSON.stringify(clearancesPayload).length;
          const totalDataSize = responseDataSize;
          const clearancesPercentage = Math.round(
            (clearancesSize / totalDataSize) * 100
          );
          const jobPercentage = Math.round((jobDataSize / totalDataSize) * 100);
          const shiftsPercentage = Math.round(
            (shiftsPayloadSize / totalDataSize) * 100
          );

          console.warn(
            `${TIMING_LOG_PREFIX} ⚠️ PERFORMANCE BOTTLENECK DETECTED ⚠️`,
            {
              totalResponseSizeKB:
                Math.round((totalDataSize / 1024) * 100) / 100,
              breakdown: {
                clearances: {
                  sizeKB: Math.round((clearancesSize / 1024) * 100) / 100,
                  percentage: `${clearancesPercentage}%`,
                  count: clearancesPayload.length,
                  avgSizePerClearanceKB:
                    clearancesPayload.length > 0
                      ? Math.round(
                          (clearancesSize / clearancesPayload.length / 1024) *
                            100
                        ) / 100
                      : 0,
                },
                job: {
                  sizeKB: Math.round((jobDataSize / 1024) * 100) / 100,
                  percentage: `${jobPercentage}%`,
                },
                shifts: {
                  sizeKB: Math.round((shiftsPayloadSize / 1024) * 100) / 100,
                  percentage: `${shiftsPercentage}%`,
                  count: shiftsPayload.length,
                },
              },
              requestDurationMs: requestDuration,
              recommendation:
                clearancesPercentage > 50
                  ? "Clearances data is the main bottleneck. Consider reducing populated fields or pagination."
                  : "Review backend query to reduce response size.",
            }
          );
        }
      } catch (err) {
        if (!isActive()) {
          finishTiming("stale error result");
          return;
        }

        console.error("Error fetching job details:", err);
        setError(err.message || "Failed to fetch job details");
        logTiming("error state set", { message: err?.message });
        finishTiming("error");
        return;
      } finally {
        if (!silent && isActive()) {
          setLoading(false);
          scheduleCommitLog("loading indicator dismissed");
        }
      }
      finishTiming();
    },
    [jobId, logDebug]
  );

  const fetchClearances = useCallback(async () => {
    if (!jobId) return;

    // Prevent duplicate fetches using ref to avoid dependency issues
    if (clearancesLoadingRef.current) {
      logDebug("fetchClearances skipped - already loading");
      return;
    }

    const startTs = getTimestamp();
    logDebug("fetchClearances start");
    clearancesLoadingRef.current = true;
    setClearancesLoading(true);

    try {
      const requestStart = getTimestamp();
      const response = await asbestosRemovalJobService.getClearances(jobId);
      const requestDuration = Math.round(getTimestamp() - requestStart);
      const clearancesData = response.data?.clearances || [];
      const dataSize = JSON.stringify(clearancesData).length;

      logDebug("fetchClearances - response received", {
        clearanceCount: clearancesData.length,
        dataSizeBytes: dataSize,
        dataSizeKB: Math.round((dataSize / 1024) * 100) / 100,
        requestDurationMs: requestDuration,
      });

      // Sort clearances by clearanceDate (newest to oldest)
      const sortedClearances = [...clearancesData].sort((a, b) => {
        const dateA = a.clearanceDate ? new Date(a.clearanceDate).getTime() : 0;
        const dateB = b.clearanceDate ? new Date(b.clearanceDate).getTime() : 0;
        return dateB - dateA; // Newest first
      });

      // Set clearances directly - API now returns reportApprovedBy and reportIssueDate
      // Keep merge logic as fallback for backwards compatibility
      setClearances((prevClearances) => {
        const clearanceMap = new Map(prevClearances.map((c) => [c._id, c]));
        return sortedClearances.map((c) => {
          const existing = clearanceMap.get(c._id);
          return {
            ...c,
            // API should return these fields, but preserve from existing state as fallback if missing
            reportApprovedBy: c.reportApprovedBy || existing?.reportApprovedBy,
            reportIssueDate: c.reportIssueDate || existing?.reportIssueDate,
          };
        });
      });
      setClearancesLoaded(true);
      logDebug("fetchClearances success", {
        clearanceCount: clearancesData.length,
        durationMs: Math.round(getTimestamp() - startTs),
      });
    } catch (error) {
      console.error("Error fetching clearances:", error);
      logDebug("fetchClearances error", {
        durationMs: Math.round(getTimestamp() - startTs),
        message: error?.message,
      });
      setClearances([]); // Already sorted (empty array)
      setClearancesLoaded(true); // Still mark as loaded even on error so tab appears
    } finally {
      clearancesLoadingRef.current = false;
      setClearancesLoading(false);
    }
  }, [jobId, logDebug]);

  const fetchAsbestosRemovalists = useCallback(async () => {
    // Only fetch if not already loaded (lazy loading)
    if (asbestosRemovalists.length > 0) {
      logDebug("fetchAsbestosRemovalists skipped - already loaded", {
        removalistCount: asbestosRemovalists.length,
      });
      return;
    }

    const startTs = getTimestamp();
    logDebug("fetchAsbestosRemovalists start");

    try {
      const requestStart = getTimestamp();
      const data = await customDataFieldGroupService.getFieldsByType(
        "asbestos_removalist"
      );
      const requestDuration = Math.round(getTimestamp() - requestStart);
      const dataSize = JSON.stringify(data || []).length;
      logDebug("fetchAsbestosRemovalists - response received", {
        removalistCount: Array.isArray(data) ? data.length : 0,
        dataSizeBytes: dataSize,
        dataSizeKB: Math.round((dataSize / 1024) * 100) / 100,
        requestDurationMs: requestDuration,
      });

      const sortStart = getTimestamp();
      const sortedData = (data || []).sort((a, b) =>
        (a.text || "").localeCompare(b.text || "")
      );
      const sortDuration = Math.round(getTimestamp() - sortStart);
      logDebug("fetchAsbestosRemovalists - sorting complete", {
        sortDurationMs: sortDuration,
      });

      const setStart = getTimestamp();
      setAsbestosRemovalists(sortedData);
      const setDuration = Math.round(getTimestamp() - setStart);
      logDebug("fetchAsbestosRemovalists success", {
        removalistCount: sortedData.length,
        durationMs: Math.round(getTimestamp() - startTs),
        breakdown: {
          requestMs: requestDuration,
          sortMs: sortDuration,
          setStateMs: setDuration,
        },
      });
    } catch (error) {
      console.error("Error fetching asbestos removalists:", error);
      logDebug("fetchAsbestosRemovalists error", {
        durationMs: Math.round(getTimestamp() - startTs),
        message: error?.message,
      });
      setAsbestosRemovalists([]);
    }
  }, [asbestosRemovalists.length, logDebug]);

  const fetchAsbestosAssessors = useCallback(async () => {
    // Only fetch if not already loaded (lazy loading)
    if (asbestosAssessors.length > 0) {
      logDebug("fetchAsbestosAssessors skipped - already loaded", {
        assessorCount: asbestosAssessors.length,
      });
      return;
    }

    const startTs = getTimestamp();
    logDebug("fetchAsbestosAssessors start");

    try {
      const requestStart = getTimestamp();
      const response = await userService.getAsbestosAssessors();
      const data = response.data || [];
      const requestDuration = Math.round(getTimestamp() - requestStart);
      const dataSize = JSON.stringify(data || []).length;
      logDebug("fetchAsbestosAssessors - response received", {
        assessorCount: Array.isArray(data) ? data.length : 0,
        dataSizeBytes: dataSize,
        dataSizeKB: Math.round((dataSize / 1024) * 100) / 100,
        requestDurationMs: requestDuration,
      });

      const sortStart = getTimestamp();
      const sortedData = (data || []).sort((a, b) => {
        const nameA = `${a.lastName || ""} ${a.firstName || ""}`.trim();
        const nameB = `${b.lastName || ""} ${b.firstName || ""}`.trim();
        return nameA.localeCompare(nameB);
      });
      const sortDuration = Math.round(getTimestamp() - sortStart);
      logDebug("fetchAsbestosAssessors - sorting complete", {
        sortDurationMs: sortDuration,
      });

      const setStart = getTimestamp();
      setAsbestosAssessors(sortedData);
      const setDuration = Math.round(getTimestamp() - setStart);
      logDebug("fetchAsbestosAssessors success", {
        assessorCount: sortedData.length,
        durationMs: Math.round(getTimestamp() - startTs),
        breakdown: {
          requestMs: requestDuration,
          sortMs: sortDuration,
          setStateMs: setDuration,
        },
      });
    } catch (error) {
      console.error("Error fetching asbestos assessors:", error);
      logDebug("fetchAsbestosAssessors error", {
        durationMs: Math.round(getTimestamp() - startTs),
        message: error?.message,
      });
      setAsbestosAssessors([]);
    }
  }, [asbestosAssessors.length, logDebug]);

  useEffect(() => {
    if (jobId) {
      const effectStart = getTimestamp();
      logDebug("jobId effect triggered", {
        jobId,
        renderNumber: renderCountRef.current,
        timestamp: new Date().toISOString(),
      });

      // Reset the background fetch flag when jobId changes
      clearancesBackgroundFetchTriggeredRef.current = false;

      const fetchStart = getTimestamp();
      // Exclude clearances on initial load for faster page load
      fetchJobDetails({ excludeClearances: true }).then(() => {
        // Fetch clearances in background after initial load to update tab count
        // This doesn't block the initial render but updates the count quickly
        if (!clearancesBackgroundFetchTriggeredRef.current) {
          clearancesBackgroundFetchTriggeredRef.current = true;
          logDebug("Fetching clearances in background for tab count");
          fetchClearances();
        }
      });
      const fetchJobDetailsCallDuration = Math.round(
        getTimestamp() - fetchStart
      );
      logDebug("jobId effect - fetchJobDetails called (clearances excluded)", {
        callDurationMs: fetchJobDetailsCallDuration,
      });

      const totalEffectDuration = Math.round(getTimestamp() - effectStart);
      logDebug("jobId effect complete", {
        totalEffectDurationMs: totalEffectDuration,
        breakdown: {
          fetchJobDetailsCallMs: fetchJobDetailsCallDuration,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, fetchJobDetails, logDebug]);

  // Reset activeTab to 0 if clearances tab is selected but clearances aren't loaded yet
  useEffect(() => {
    if (activeTab === 1 && !clearancesLoaded) {
      setActiveTab(0);
    }
  }, [activeTab, clearancesLoaded]);

  useEffect(() => {
    const shiftsSize = JSON.stringify(airMonitoringShifts).length;
    logDebug("airMonitoringShifts state updated", {
      shiftCount: airMonitoringShifts.length,
      dataSizeBytes: shiftsSize,
      dataSizeKB: Math.round((shiftsSize / 1024) * 100) / 100,
      timestamp: new Date().toISOString(),
    });
  }, [airMonitoringShifts, logDebug]);

  useEffect(() => {
    const clearancesSize = JSON.stringify(clearances).length;
    logDebug("clearances state updated", {
      clearanceCount: clearances.length,
      dataSizeBytes: clearancesSize,
      dataSizeKB: Math.round((clearancesSize / 1024) * 100) / 100,
      timestamp: new Date().toISOString(),
    });
  }, [clearances, logDebug]);

  useEffect(() => {
    logDebug("loading state updated", {
      loading,
      timestamp: new Date().toISOString(),
    });
  }, [loading, logDebug]);

  useEffect(() => {
    const jobSize = JSON.stringify(job).length;
    logDebug("job state updated", {
      hasJob: Boolean(job),
      dataSizeBytes: jobSize,
      dataSizeKB: Math.round((jobSize / 1024) * 100) / 100,
      timestamp: new Date().toISOString(),
    });
  }, [job, logDebug]);

  const getStatusColor = (status) => {
    switch (status) {
      case "shift_complete":
      case "analysis_complete":
        return theme.palette.success.main;
      case "sampling_complete":
      case "samples_submitted_to_lab":
        return theme.palette.warning.main;
      case "sampling_in_progress":
        return theme.palette.primary.main;
      case "Complete":
        return theme.palette.success.main;
      case "In Progress":
        return theme.palette.warning.main;
      case "Active":
        return theme.palette.primary.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const formatStatusLabel = (status) => {
    if (!status) return "Unknown";

    // Handle specific status mappings
    const statusMap = {
      shift_complete: "Shift Complete",
      analysis_complete: "Analysis Complete",
      sampling_complete: "Sampling Complete",
      samples_submitted_to_lab: "Samples Submitted to Lab",
      sampling_in_progress: "Sampling In Progress",
      complete: "Complete",
      in_progress: "In Progress",
      active: "Active",
    };

    // Return mapped status or format by replacing underscores and capitalizing
    return (
      statusMap[status] ||
      status
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    );
  };

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return "09:00 AM";

    // If it's already in the new format (HH:MM AM/PM), return as is
    if (timeString.includes("AM") || timeString.includes("PM")) {
      return timeString;
    }

    // If it's in 24-hour format (HH:MM), convert to 12-hour format
    if (timeString.match(/^\d{1,2}:\d{2}$/)) {
      const [hours, minutes] = timeString.split(":");
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? "PM" : "AM";
      return `${hour12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
    }

    // Default fallback
    return "09:00 AM";
  };

  const handleBackToJobs = () => {
    navigate("/asbestos-removal");
  };

  const handleCompleteJob = async () => {
    try {
      // Update the job status to completed
      await asbestosRemovalJobService.update(jobId, { status: "completed" });

      // Show success message
      showSnackbar("Job marked as completed successfully", "success");

      // Navigate back to jobs page
      navigate("/asbestos-removal");
    } catch (error) {
      console.error("Error completing job:", error);
      setError("Failed to complete job. Please try again.");
    }
  };

  // Check if all shifts are complete AND authorised
  const allShiftsCompleteAndAuthorised =
    airMonitoringShifts.length > 0 &&
    airMonitoringShifts.every(
      (shift) => shift.status === "shift_complete" && shift.reportApprovedBy
    );

  // Check if all clearances are complete AND authorised
  const allClearancesCompleteAndAuthorised =
    clearances.length > 0 &&
    clearances.every(
      (clearance) =>
        clearance.status === "complete" && clearance.reportApprovedBy
    );

  // Job can only be completed if:
  // 1. Job is not already completed
  // 2. At least one shift or clearance has been added
  // 3. All shifts are complete AND authorised (if there are any)
  // 4. All clearances are complete AND authorised (if there are any)
  const hasShiftsOrClearances =
    airMonitoringShifts.length > 0 || clearances.length > 0;

  const canCompleteJob =
    job &&
    job.status !== "completed" &&
    hasShiftsOrClearances &&
    (airMonitoringShifts.length === 0 || allShiftsCompleteAndAuthorised) &&
    (clearances.length === 0 || allClearancesCompleteAndAuthorised);

  const handleViewReport = async (shift) => {
    try {
      // Fetch the latest shift data
      const shiftResponse = await shiftService.getById(shift._id);
      const latestShift = shiftResponse.data;

      // Fetch job and samples for this shift - use correct service based on jobModel
      let jobResponse;
      if (latestShift.jobModel === "AsbestosRemovalJob") {
        jobResponse = await asbestosRemovalJobService.getById(
          latestShift.job?._id || latestShift.job
        );
      } else {
        jobResponse = await jobService.getById(
          latestShift.job?._id || latestShift.job
        );
      }
      const samplesResponse = await sampleService.getByShift(latestShift._id);

      // Ensure we have the complete sample data including analysis
      const samplesWithAnalysis = await Promise.all(
        samplesResponse.data.map(async (sample) => {
          if (!sample.analysis) {
            // If analysis data is missing, fetch the complete sample data
            const completeSample = await sampleService.getById(sample._id);
            return completeSample.data;
          }
          return sample;
        })
      );

      // Ensure project and client are fully populated
      let project = jobResponse.data.projectId;
      if (project && typeof project === "string") {
        const projectResponse = await projectService.getById(project);
        project = projectResponse.data;
      }
      if (project && project.client && typeof project.client === "string") {
        const clientResponse = await clientService.getById(project.client);
        project.client = clientResponse.data;
      }

      console.log(
        "AsbestosRemovalJobDetails - Latest shift data:",
        latestShift
      );
      console.log(
        "AsbestosRemovalJobDetails - Site plan flag:",
        latestShift.sitePlan
      );
      console.log(
        "AsbestosRemovalJobDetails - Site plan data:",
        latestShift.sitePlanData
      );

      generateShiftReport({
        shift: latestShift,
        job: jobResponse.data,
        samples: samplesWithAnalysis,
        project,
        openInNewTab: !shift.reportApprovedBy, // download if authorised, open if not
        sitePlanData: latestShift.sitePlan
          ? {
              sitePlan: latestShift.sitePlan,
              sitePlanData: latestShift.sitePlanData,
            }
          : null,
      });
      setReportViewedShiftIds((prev) => new Set(prev).add(shift._id));
    } catch (err) {
      console.error("Error generating report:", err);
      showSnackbar("Failed to generate report.", "error");
    }
  };

  const handleAuthoriseReport = async (shift) => {
    try {
      const now = new Date().toISOString();
      const approver =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      // First get the current shift data
      const currentShift = await shiftService.getById(shift._id);

      // Create the updated shift data by spreading the current data and updating the fields we want
      const updatedShiftData = {
        ...currentShift.data,
        job: currentShift.data.job._id, // Convert to string ID
        supervisor: currentShift.data.supervisor._id, // Convert to string ID
        defaultSampler: currentShift.data.defaultSampler, // Keep as is
        status: "shift_complete",
        reportApprovedBy: approver,
        reportIssueDate: now,
      };

      // Log the data being sent
      console.log("Updating shift with data:", updatedShiftData);

      // Update shift with report approval
      const response = await shiftService.update(shift._id, updatedShiftData);

      // Log the response
      console.log("Update response:", response.data);

      // Generate and download the report
      try {
        // Fetch job and samples for this shift - use correct service based on jobModel
        let jobResponse;
        if (currentShift.data.jobModel === "AsbestosRemovalJob") {
          jobResponse = await asbestosRemovalJobService.getById(
            shift.job?._id || shift.job
          );
        } else {
          jobResponse = await jobService.getById(shift.job?._id || shift.job);
        }
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              // If analysis data is missing, fetch the complete sample data
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          })
        );

        // Ensure project and client are fully populated
        let project = jobResponse.data.projectId;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        generateShiftReport({
          shift: updatedShiftData,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project,
          openInNewTab: false, // Always download when authorised
          sitePlanData: updatedShiftData.sitePlan
            ? {
                sitePlan: updatedShiftData.sitePlan,
                sitePlanData: updatedShiftData.sitePlanData,
              }
            : null,
        });

        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success"
        );

        // Refresh the shifts data
        fetchJobDetails();
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Error authorising report:", error);
      showSnackbar("Failed to authorise report. Please try again.", "error");
    }
  };

  const handleSendForAuthorisation = async (shift) => {
    if (!shift?._id) {
      return;
    }

    try {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [shift._id]: true,
      }));

      const response = await shiftService.sendForAuthorisation(shift._id);

      showSnackbar(
        response.data?.message ||
          `Authorisation request emails sent successfully to ${
            response.data?.recipients?.length || 0
          } signatory user(s)`,
        "success"
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error"
      );
    } finally {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [shift._id]: false,
      }));
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Lazy load clearances when user switches to clearances tab (if not already loaded or loading)
    if (
      newValue === 1 &&
      clearances.length === 0 &&
      !clearancesLoadingRef.current
    ) {
      logDebug("Clearances tab selected - fetching clearances");
      fetchClearances();
    }
  };

  const handleCreateAirMonitoringShift = () => {
    setNewShiftDate("");
    setShiftDialogOpen(true);
  };

  const handleCreateClearance = () => {
    // Lazy load removalists, assessors and clearances if not already loaded or loading
    fetchAsbestosRemovalists();
    fetchAsbestosAssessors();
    if (clearances.length === 0 && !clearancesLoadingRef.current) {
      fetchClearances();
    }
    setEditingClearance(null);
    resetClearanceForm();
    setClearanceDialogOpen(true);
  };

  const handleSetToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    setNewShiftDate(formattedDate);
  };

  const handleShiftSubmit = async () => {
    setShiftCreating(true);
    try {
      // Create the new shift
      const shiftData = {
        job: jobId,
        jobModel: "AsbestosRemovalJob",
        projectId: job?.projectId?._id,
        name: `Shift ${airMonitoringShifts.length + 1}`,
        date: newShiftDate,
        startTime: "08:00",
        endTime: "16:00",
        supervisor: currentUser._id,
        status: "ongoing",
        descriptionOfWorks: "",
      };

      console.log("Creating shift with data:", shiftData);
      const response = await shiftService.create(shiftData);
      console.log("New shift created:", response.data);

      // Add the new shift directly to state since backend isn't saving job/projectId fields
      if (response.data) {
        const newShift = {
          ...response.data,
          job: jobId, // Ensure job field is set
          projectId: job?.projectId?._id, // Ensure projectId field is set
          jobName: job?.name || "Asbestos Removal Job",
          jobId: jobId,
        };
        setAirMonitoringShifts((prev) => {
          const updated = [...prev, newShift];
          // Sort shifts by date (newest to oldest)
          return updated.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA; // Newest first
          });
        });
      }

      handleCloseShiftDialog();

      showSnackbar("Air monitoring shift created successfully", "success");
    } catch (error) {
      console.error("Error creating shift:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error message:", error.message);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create shift. Please try again.";

      showSnackbar(errorMessage, "error");
    } finally {
      setShiftCreating(false);
    }
  };

  const handleClearanceRowClick = (clearance) => {
    // Navigate to clearance items page
    navigate(`/clearances/${clearance._id}/items`);
  };

  const handleShiftRowClick = (shift) => {
    // Navigate to air monitoring sample list page for this shift
    navigate(`/air-monitoring/shift/${shift._id}/samples`);
  };

  const handleResetStatus = async (shiftId) => {
    setResetShiftId(shiftId);
    setResetDialogOpen(true);
  };

  const confirmResetStatus = async () => {
    if (!resetShiftId) return;
    try {
      // Get the current shift data first
      const currentShift = await shiftService.getById(resetShiftId);

      // Update shift status while preserving analysis data but clearing report authorization
      await shiftService.update(resetShiftId, {
        status: "ongoing",
        analysedBy: currentShift.data.analysedBy,
        analysisDate: currentShift.data.analysisDate,
        reportApprovedBy: null,
        reportIssueDate: null,
      });

      // Refetch job details to update UI
      await fetchJobDetails();
      setResetDialogOpen(false);
      setResetShiftId(null);

      showSnackbar("Shift status reset to ongoing successfully.", "success");
    } catch (err) {
      console.error("Error resetting shift status:", err);
      showSnackbar("Failed to reset shift status.", "error");
      setResetDialogOpen(false);
      setResetShiftId(null);
    }
  };

  const cancelResetStatus = () => {
    setResetDialogOpen(false);
    setResetShiftId(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !deleteType) return;

    try {
      if (deleteType === "clearance") {
        await asbestosClearanceService.delete(itemToDelete._id);
        showSnackbar("Clearance deleted successfully", "success");
        await fetchClearances(); // Refresh clearances list
      } else if (deleteType === "shift") {
        await shiftService.delete(itemToDelete._id);
        showSnackbar("Air monitoring shift deleted successfully", "success");
        await fetchJobDetails({ excludeClearances: true }); // Refresh shifts (exclude clearances)
      }
    } catch (error) {
      console.error(`Error deleting ${deleteType}:`, error);
      showSnackbar(`Failed to delete ${deleteType}`, "error");
    } finally {
      setDeleteConfirmDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialogOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
  };

  const handleSamplesClick = (shift) => {
    // Don't allow access to samples if report is authorized
    if (shift.reportApprovedBy) {
      showSnackbar(
        "Cannot access samples while report is authorized. Please reset the shift status to access samples.",
        "warning"
      );
      return;
    }
    console.log("Samples button clicked for shift:", shift._id);
    const path = `/air-monitoring/shift/${shift._id}/samples`;
    console.log("Attempting to navigate to:", path);
    try {
      navigate(path, { replace: false });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const handleDownloadCOC = async (shift, event) => {
    event.stopPropagation();

    try {
      // Use axios to fetch the PDF with authentication
      const response = await api.get(
        `/air-monitoring-shifts/${shift._id}/chain-of-custody`,
        {
          responseType: "blob",
        }
      );

      // Create a blob URL from the response
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `Chain_of_Custody_${shift._id}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar("Chain of Custody downloaded successfully", "success");
    } catch (error) {
      console.error("Error downloading COC:", error);
      showSnackbar("Failed to download Chain of Custody", "error");
    }
  };

  const handleViewClearanceReport = async (clearance, event) => {
    event.stopPropagation();
    try {
      console.log(
        "handleViewClearanceReport called with clearance:",
        clearance
      );
      setGeneratingPDF(true);

      // Get the full clearance data with populated project
      console.log("Fetching full clearance data...");
      const fullClearance = await asbestosClearanceService.getById(
        clearance._id
      );
      console.log("Full clearance data:", fullClearance);

      // Use the new HTML template-based PDF generation
      console.log("Calling generateHTMLTemplatePDF...");
      const fileName = await generateHTMLTemplatePDF(
        "asbestos-clearance", // template type
        fullClearance, // clearance data
        { openInNewTab: true } // open in new tab instead of downloading
      );
      console.log("PDF generation completed, fileName:", fileName);

      showSnackbar(
        "PDF opened in new tab",
        "success"
      );

      // Mark report as viewed
      setReportViewedClearanceIds((prev) => new Set(prev).add(clearance._id));
    } catch (err) {
      console.error("Error generating PDF:", err);
      showSnackbar("Failed to generate PDF", "error");
    } finally {
      console.log("Setting generatingPDF to false");
      setGeneratingPDF(false);
    }
  };

  const handleGeneratePDF = async (clearance, event) => {
    // Prevent row click when clicking PDF icon
    event.stopPropagation();

    try {
      console.log("handleGeneratePDF called with clearance:", clearance);
      setGeneratingPDF(true);

      // Get the full clearance data with populated project
      console.log("Fetching full clearance data...");
      const fullClearance = await asbestosClearanceService.getById(
        clearance._id
      );
      console.log("Full clearance data:", fullClearance);

      // Use the new HTML template-based PDF generation
      console.log("Calling generateHTMLTemplatePDF...");
      const fileName = await generateHTMLTemplatePDF(
        "asbestos-clearance", // template type
        fullClearance // clearance data
      );
      console.log("PDF generation completed, fileName:", fileName);

      showSnackbar(
        `PDF generated successfully! Check your downloads folder for: ${
          fileName.filename || fileName
        }`,
        "success"
      );
    } catch (err) {
      console.error("Error generating PDF:", err);
      showSnackbar("Failed to generate PDF", "error");
    } finally {
      console.log("Setting generatingPDF to false");
      setGeneratingPDF(false);
    }
  };

  const handleAuthoriseClearanceReport = async (clearance, event) => {
    event.stopPropagation();

    // Prevent double-clicking
    if (authorisingClearanceReports[clearance._id]) {
      return;
    }

    try {
      // Set loading state
      setAuthorisingClearanceReports((prev) => ({
        ...prev,
        [clearance._id]: true,
      }));

      // Authorise the clearance - the API returns the updated clearance
      const response = await asbestosClearanceService.authorise(clearance._id);
      // The service returns response.data, so response is already the clearance object
      const updatedClearance = response;

      console.log("Authorisation response:", updatedClearance);
      console.log("reportApprovedBy:", updatedClearance.reportApprovedBy);

      // Immediately update the clearance in state to reflect the authorisation
      // This ensures the UI updates right away
      setClearances((prevClearances) => {
        const updated = prevClearances.map((c) =>
          c._id === clearance._id
            ? {
                ...c,
                reportApprovedBy: updatedClearance.reportApprovedBy,
                reportIssueDate: updatedClearance.reportIssueDate,
              }
            : c
        );
        console.log(
          "Updated clearances state:",
          updated.find((c) => c._id === clearance._id)
        );
        return updated;
      });

      // Generate and download the authorised report
      try {
        const fullClearance = await asbestosClearanceService.getById(
          clearance._id
        );

        await generateHTMLTemplatePDF("asbestos-clearance", fullClearance);
        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success"
        );
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning"
        );
      }

      // Refresh the clearances list after download completes to ensure everything is in sync
      // Reset the loading ref to ensure fetchClearances actually runs
      clearancesLoadingRef.current = false;
      await fetchClearances();

      // fetchClearances now preserves reportApprovedBy, but let's ensure it's set
      // in case the merge didn't work properly
      setClearances((prevClearances) => {
        const refreshedClearance = prevClearances.find(
          (c) => c._id === clearance._id
        );
        if (
          refreshedClearance &&
          !refreshedClearance.reportApprovedBy &&
          updatedClearance.reportApprovedBy
        ) {
          console.log("Ensuring reportApprovedBy is set after fetchClearances");
          return prevClearances.map((c) =>
            c._id === clearance._id
              ? {
                  ...c,
                  reportApprovedBy: updatedClearance.reportApprovedBy,
                  reportIssueDate: updatedClearance.reportIssueDate,
                }
              : c
          );
        }
        return prevClearances;
      });
    } catch (error) {
      console.error("Error authorising clearance report:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to authorise report. Please try again.",
        "error"
      );
    } finally {
      // Clear loading state only after everything is complete
      setAuthorisingClearanceReports((prev) => {
        const updated = { ...prev };
        delete updated[clearance._id];
        return updated;
      });
    }
  };

  const handleSendClearanceForAuthorisation = async (clearance, event) => {
    event.stopPropagation();
    if (!clearance?._id) {
      return;
    }

    try {
      setSendingClearanceAuthorisationRequests((prev) => ({
        ...prev,
        [clearance._id]: true,
      }));

      const response = await asbestosClearanceService.sendForAuthorisation(
        clearance._id
      );

      showSnackbar(
        response?.message ||
          `Authorisation request emails sent successfully to ${
            response?.recipients?.length || 0
          } report proofer user(s)`,
        "success"
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error"
      );
    } finally {
      setSendingClearanceAuthorisationRequests((prev) => ({
        ...prev,
        [clearance._id]: false,
      }));
    }
  };

  const handleEditClearance = (clearance, event) => {
    event.stopPropagation();
    // Lazy load removalists and assessors only when needed
    fetchAsbestosRemovalists();
    fetchAsbestosAssessors();
    setEditingClearance(clearance);
    const clearanceType = clearance.clearanceType || "Non-friable";
    setClearanceForm({
      projectId: clearance.projectId._id || clearance.projectId,
      clearanceDate: clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
        : "",
      inspectionTime: formatTimeForDisplay(clearance.inspectionTime),
      clearanceType: clearanceType,
      asbestosRemovalist: clearance.asbestosRemovalist || "",
      LAA: clearance.LAA || "",
      jurisdiction: clearance.jurisdiction || "ACT",
      secondaryHeader: clearance.secondaryHeader || "",
      vehicleEquipmentDescription: clearance.vehicleEquipmentDescription || "",
      notes: clearance.notes || "",
      useComplexTemplate: clearance.useComplexTemplate || false,
      jobSpecificExclusions: clearance.jobSpecificExclusions || "",
    });
    setClearanceDialogOpen(true);
  };

  const handleDeleteClearance = (clearance, event) => {
    event.stopPropagation();
    setItemToDelete(clearance);
    setDeleteType("clearance");
    setDeleteConfirmDialogOpen(true);
  };

  const handleEditShift = (shift, event) => {
    event.stopPropagation();
    setEditingShift(shift);
    const shiftDate = shift.date
      ? new Date(shift.date).toISOString().split("T")[0]
      : "";
    setNewShiftDate(shiftDate);
    setShiftDialogOpen(true);
  };

  const handleUpdateShiftDate = async () => {
    if (!editingShift || !newShiftDate) return;

    setShiftCreating(true);
    try {
      await shiftService.update(editingShift._id, { date: newShiftDate });
      await fetchJobDetails();
      showSnackbar("Shift date updated successfully", "success");
      handleCloseShiftDialog();
    } catch (error) {
      console.error("Error updating shift date:", error);
      showSnackbar("Failed to update shift date", "error");
    } finally {
      setShiftCreating(false);
    }
  };

  const handleCloseShiftDialog = () => {
    setShiftDialogOpen(false);
    setNewShiftDate("");
    setEditingShift(null);
    setShiftCreating(false);
  };

  const handleDeleteShift = (shift, event) => {
    event.stopPropagation();
    setItemToDelete(shift);
    setDeleteType("shift");
    setDeleteConfirmDialogOpen(true);
  };

  const handleReopenShift = async (shift) => {
    try {
      await shiftService.reopen(shift._id);
      showSnackbar("Shift reopened successfully", "success");
      await fetchJobDetails();
    } catch (error) {
      console.error("Error reopening shift:", error);
      showSnackbar(
        "Failed to reopen shift. Only admins can reopen shifts.",
        "error"
      );
    }
  };

  const resetClearanceForm = () => {
    setClearanceForm({
      projectId: job?.projectId._id || job?.projectId || "",
      clearanceDate: new Date().toISOString().split("T")[0],
      inspectionTime: "09:00 AM",
      clearanceType: "Non-friable",
      asbestosRemovalist: job?.asbestosRemovalist || "",
      LAA: "",
      jurisdiction: "ACT",
      secondaryHeader: "",
      vehicleEquipmentDescription: "",
      notes: "",
      useComplexTemplate: false,
      jobSpecificExclusions: "",
    });
  };

  const handleClearanceSubmit = async (e) => {
    e.preventDefault();

    if (!clearanceForm.inspectionTime.trim()) {
      setError("Inspection time is required");
      return;
    }

    if (!clearanceForm.LAA.trim()) {
      setError("LAA (Licensed Asbestos Assessor) is required");
      return;
    }

    // Validate Vehicle/Equipment Description when Vehicle/Equipment is selected
    if (
      clearanceForm.clearanceType === "Vehicle/Equipment" &&
      !clearanceForm.vehicleEquipmentDescription.trim()
    ) {
      setError("Vehicle/Equipment Description is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const newClearanceData = {
        projectId: clearanceForm.projectId,
        asbestosRemovalJobId: jobId, // Link clearance directly to the asbestos removal job
        clearanceDate: clearanceForm.clearanceDate,
        inspectionTime: clearanceForm.inspectionTime,
        clearanceType: clearanceForm.clearanceType,
        asbestosRemovalist: clearanceForm.asbestosRemovalist,
        LAA: clearanceForm.LAA,
        jurisdiction: clearanceForm.jurisdiction,
        secondaryHeader: clearanceForm.secondaryHeader,
        vehicleEquipmentDescription: clearanceForm.vehicleEquipmentDescription,
        notes: clearanceForm.notes,
        jobSpecificExclusions: clearanceForm.jobSpecificExclusions,
      };

      let response;
      if (editingClearance) {
        response = await asbestosClearanceService.update(
          editingClearance._id,
          newClearanceData
        );
        console.log("Clearance update response:", response);
      } else {
        response = await asbestosClearanceService.create(newClearanceData);
        console.log("Clearance creation response:", response);
      }

      // Close modal and refresh clearances list
      await fetchClearances();
      setClearanceDialogOpen(false);
      setEditingClearance(null);
      resetClearanceForm();
    } catch (err) {
      console.error("Error creating clearance:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingClearance
            ? "Failed to update clearance"
            : "Failed to create clearance")
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box
        m="20px"
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={handleBackToJobs} startIcon={<ArrowBackIcon />}>
          Back to Asbestos Removal Jobs
        </Button>
      </Box>
    );
  }

  if (!job) {
    if (TIMING_ENABLED && renderCountRef.current > 1) {
      const renderDuration = Math.round(getTimestamp() - renderStart);
      console.log(`${TIMING_LOG_PREFIX} Render complete (no job)`, {
        renderNumber: renderCountRef.current,
        renderDurationMs: renderDuration,
      });
    }
    return (
      <Box m="20px">
        <Alert severity="warning" sx={{ mb: 2 }}>
          Job not found
        </Alert>
        <Button onClick={handleBackToJobs} startIcon={<ArrowBackIcon />}>
          Back to Asbestos Removal Jobs
        </Button>
      </Box>
    );
  }

  // Log render performance before returning JSX
  if (TIMING_ENABLED && renderCountRef.current > 1) {
    const renderDuration = Math.round(getTimestamp() - renderStart);
    const permissionCheckStart = getTimestamp();
    // Pre-check permissions to see if they're expensive
    const hasAdminPermission = hasPermission(currentUser, "admin.view");
    const hasEditPermission = hasPermission(currentUser, "jobs.edit");
    const permissionCheckDuration = Math.round(
      getTimestamp() - permissionCheckStart
    );

    console.log(`${TIMING_LOG_PREFIX} Render complete`, {
      renderNumber: renderCountRef.current,
      renderDurationMs: renderDuration,
      permissionCheckDurationMs: permissionCheckDuration,
      stateSizes: {
        job: JSON.stringify(job).length,
        shifts: JSON.stringify(airMonitoringShifts).length,
        clearances: JSON.stringify(clearances).length,
        removalists: JSON.stringify(asbestosRemovalists).length,
      },
    });
  }

  return (
    <Box m="20px">
      {/* PDF Loading Overlay */}
      <PDFLoadingOverlay
        open={generatingPDF}
        message="Generating Asbestos Clearance PDF..."
      />

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToJobs}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal Jobs
        </Link>
        <Typography color="text.primary">
          {job?.projectId?.projectID || "Loading..."}:{" "}
          {job?.projectName || "Loading..."}
        </Typography>
      </Breadcrumbs>

      {/* Job Header */}
      <Box mb={3}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Asbestos Removal Job Details
            </Typography>
            <Typography variant="h5" color="text.secondary">
              Project: {job?.projectId?.projectID || "Loading..."} -{" "}
              {job?.projectName || "Loading..."}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Asbestos Removalist: {job?.asbestosRemovalist || "Loading..."}
            </Typography>
          </Box>
          {job && hasShiftsOrClearances && (
            <Button
              variant="contained"
              color="success"
              onClick={handleCompleteJob}
              disabled={!canCompleteJob}
              sx={{
                backgroundColor: canCompleteJob
                  ? theme.palette.success.main
                  : theme.palette.grey[400],
                color: canCompleteJob
                  ? theme.palette.common.white
                  : theme.palette.grey[600],
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                cursor: canCompleteJob ? "pointer" : "not-allowed",
                "&:hover": {
                  backgroundColor: canCompleteJob
                    ? theme.palette.success.dark
                    : theme.palette.grey[400],
                },
                "&:disabled": {
                  backgroundColor: theme.palette.grey[400],
                  color: theme.palette.grey[600],
                },
              }}
            >
              Complete Job
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs for Air Monitoring and Clearances */}
      <Paper sx={{ width: "100%" }}>
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab
              label={`Air Monitoring Shifts (${airMonitoringShifts.length})`}
              icon={<MonitorIcon />}
              iconPosition="start"
            />
            {clearancesLoaded && (
              <Tab
                label={`Clearances (${clearances.length})`}
                icon={<AssessmentIcon />}
                iconPosition="start"
              />
            )}
          </Tabs>
          <Box sx={{ pr: 2 }}>
            {activeTab === 0 ? (
              <Button
                variant="contained"
                startIcon={<MonitorIcon />}
                onClick={handleCreateAirMonitoringShift}
                disabled={creating}
                sx={{
                  backgroundColor: colors.primary[700],
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: colors.primary[800],
                  },
                }}
              >
                {creating ? "Creating..." : "Add Air Monitoring Shift"}
              </Button>
            ) : clearancesLoaded ? (
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={handleCreateClearance}
                disabled={creating}
                sx={{
                  backgroundColor: colors.secondary[600],
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: colors.secondary[700],
                  },
                }}
              >
                {creating ? "Creating..." : "Add Clearance"}
              </Button>
            ) : null}
          </Box>
        </Box>

        {/* Air Monitoring Tab */}
        {activeTab === 0 && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>
              Air Monitoring Shifts
            </Typography>
            {airMonitoringShifts.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No air monitoring shifts found for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ backgroundColor: theme.palette.primary.dark }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Shift Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Sample Numbers
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {airMonitoringShifts.map((shift) => (
                      <TableRow
                        key={shift._id}
                        hover
                        onClick={() => handleShiftRowClick(shift)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          {shift.date ? formatDate(shift.date) : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatusLabel(shift.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(shift.status),
                              color: "white",
                            }}
                          />
                          {shift.reportApprovedBy && (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                fontWeight: "medium",
                                color: "#2e7d32",
                                fontStyle: "italic",
                              }}
                            >
                              ✓ Authorised by {shift.reportApprovedBy}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {shift.sampleNumbers && shift.sampleNumbers.length > 0
                            ? shift.sampleNumbers.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            {shift.status !== "shift_complete" && (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditShift(shift, e);
                                }}
                                title="Edit Shift Date"
                              >
                                <EditIcon color="primary" />
                              </IconButton>
                            )}
                            <PermissionGate
                              requiredPermissions={["admin.view"]}
                              fallback={null}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteShift(shift, e);
                                }}
                                title="Delete Shift (Admin Only)"
                              >
                                <DeleteIcon color="error" />
                              </IconButton>
                            </PermissionGate>
                            <PermissionGate
                              requiredPermissions={["admin.update"]}
                              fallback={null}
                            >
                              {(shift.status === "analysis_complete" ||
                                shift.status === "shift_complete") && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReopenShift(shift);
                                  }}
                                  title="Reopen Shift for Editing (Admin Only)"
                                >
                                  <RefreshIcon color="warning" />
                                </IconButton>
                              )}
                            </PermissionGate>
                            {shift.status === "samples_submitted_to_lab" && (
                              <>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={(e) => handleDownloadCOC(shift, e)}
                                  sx={{
                                    backgroundColor: theme.palette.info.main,
                                    color: theme.palette.info.contrastText,
                                    mr: 1,
                                    "&:hover": {
                                      backgroundColor: theme.palette.info.dark,
                                    },
                                  }}
                                >
                                  COC
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/air-monitoring/shift/${shift._id}/analysis`
                                    );
                                  }}
                                  sx={{
                                    backgroundColor: theme.palette.success.main,
                                    color: theme.palette.success.contrastText,
                                    "&:hover": {
                                      backgroundColor:
                                        theme.palette.success.dark,
                                    },
                                  }}
                                >
                                  SAMPLE ANALYSIS
                                </Button>
                              </>
                            )}
                            {(shift.status === "analysis_complete" ||
                              shift.status === "shift_complete") && (
                              <>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewReport(shift);
                                  }}
                                  sx={{
                                    borderColor: theme.palette.success.main,
                                    color: theme.palette.success.main,
                                    "&:hover": {
                                      borderColor: theme.palette.success.dark,
                                      backgroundColor:
                                        theme.palette.success.light,
                                    },
                                  }}
                                >
                                  {shift.reportApprovedBy
                                    ? "Download Report"
                                    : "View Report"}
                                </Button>
                                {(() => {
                                  const permissionCheckStart = getTimestamp();
                                  const conditions = {
                                    notApproved: !shift.reportApprovedBy,
                                    reportViewed: reportViewedShiftIds.has(
                                      shift._id
                                    ),
                                    hasAdminPermission: hasPermission(
                                      currentUser,
                                      "admin.view"
                                    ),
                                    hasEditPermission: hasPermission(
                                      currentUser,
                                      "jobs.edit"
                                    ),
                                    isReportProofer: Boolean(
                                      currentUser?.reportProofer
                                    ),
                                  };
                                  const permissionCheckDuration = Math.round(
                                    getTimestamp() - permissionCheckStart
                                  );

                                  const baseVisible =
                                    conditions.notApproved &&
                                    conditions.reportViewed;
                                  const visibility = {
                                    showAuthorise:
                                      baseVisible &&
                                      conditions.hasAdminPermission &&
                                      conditions.isReportProofer,
                                    showSend:
                                      baseVisible &&
                                      !conditions.isReportProofer &&
                                      conditions.hasEditPermission,
                                  };

                                  if (
                                    TIMING_ENABLED &&
                                    permissionCheckDuration > 1
                                  ) {
                                    console.log(
                                      `${TIMING_LOG_PREFIX} Permission check took ${permissionCheckDuration}ms`,
                                      {
                                        shiftId: shift._id,
                                        conditions,
                                        visibility,
                                      }
                                    );
                                  }

                                  console.log(
                                    "Authorisation action visibility:",
                                    {
                                      shiftId: shift._id,
                                      conditions,
                                      visibility,
                                      permissionCheckDurationMs:
                                        permissionCheckDuration,
                                      currentUser: {
                                        id: currentUser?._id,
                                        role: currentUser?.role,
                                        reportProofer:
                                          currentUser?.reportProofer,
                                      },
                                    }
                                  );

                                  return (
                                    <>
                                      {visibility.showAuthorise && (
                                        <Button
                                          variant="contained"
                                          size="small"
                                          color="success"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleAuthoriseReport(shift);
                                          }}
                                          sx={{
                                            backgroundColor:
                                              theme.palette.success.main,
                                            color: theme.palette.common.white,
                                            "&:hover": {
                                              backgroundColor:
                                                theme.palette.success.dark,
                                            },
                                          }}
                                        >
                                          Authorise
                                        </Button>
                                      )}
                                      {visibility.showSend && (
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          color="primary"
                                          startIcon={<MailIcon />}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSendForAuthorisation(shift);
                                          }}
                                          disabled={Boolean(
                                            sendingAuthorisationRequests[
                                              shift._id
                                            ]
                                          )}
                                        >
                                          {sendingAuthorisationRequests[
                                            shift._id
                                          ]
                                            ? "Sending..."
                                            : "Send for Authorisation"}
                                        </Button>
                                      )}
                                    </>
                                  );
                                })()}
                                {hasPermission(currentUser, "admin.view") && (
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResetStatus(shift._id);
                                    }}
                                    title="Reset status to Ongoing"
                                    sx={{ color: theme.palette.error.main }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Clearances Tab */}
        {activeTab === 1 && clearancesLoaded && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>
              Clearances
            </Typography>
            {clearances.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No clearances found for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ backgroundColor: theme.palette.primary.dark }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Clearance Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Clearance Type
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clearances.map((clearance) => (
                      <TableRow
                        key={clearance._id}
                        hover
                        onClick={() => handleClearanceRowClick(clearance)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          {clearance.clearanceDate
                            ? formatDate(clearance.clearanceDate)
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {clearance.clearanceType || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatusLabel(clearance.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(clearance.status),
                              color: "white",
                            }}
                          />
                          {clearance.reportApprovedBy && (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                fontWeight: "medium",
                                color: "#2e7d32",
                                fontStyle: "italic",
                              }}
                            >
                              ✓ Authorised by {clearance.reportApprovedBy}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={(e) => handleEditClearance(clearance, e)}
                            title="Edit Clearance"
                            sx={{ mr: 1 }}
                          >
                            <EditIcon color="primary" />
                          </IconButton>
                          <PermissionGate
                            requiredPermissions={["admin.view"]}
                            fallback={null}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleDeleteClearance(clearance, e)
                              }
                              title="Delete Clearance (Admin Only)"
                              sx={{ mr: 1 }}
                            >
                              <DeleteIcon color="error" />
                            </IconButton>
                          </PermissionGate>
                          {clearance.status === "complete" && (
                            <>
                              {clearance.reportApprovedBy ||
                              authorisingClearanceReports[clearance._id] ? (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) =>
                                    handleGeneratePDF(clearance, e)
                                  }
                                  disabled={
                                    generatingPDF ||
                                    authorisingClearanceReports[clearance._id]
                                  }
                                  startIcon={
                                    authorisingClearanceReports[
                                      clearance._id
                                    ] ? (
                                      <CircularProgress size={16} />
                                    ) : null
                                  }
                                  sx={{
                                    borderColor: theme.palette.success.main,
                                    color: theme.palette.success.main,
                                    "&:hover": {
                                      borderColor: theme.palette.success.dark,
                                      backgroundColor:
                                        theme.palette.success.light,
                                    },
                                    mr: 1,
                                  }}
                                >
                                  {authorisingClearanceReports[clearance._id]
                                    ? "Authorising..."
                                    : "Download Report"}
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={(e) =>
                                      handleViewClearanceReport(clearance, e)
                                    }
                                    disabled={generatingPDF}
                                    sx={{
                                      borderColor: theme.palette.success.main,
                                      color: theme.palette.success.main,
                                      "&:hover": {
                                        borderColor: theme.palette.success.dark,
                                        backgroundColor:
                                          theme.palette.success.light,
                                      },
                                      mr: 1,
                                    }}
                                  >
                                    View Report
                                  </Button>
                                  {reportViewedClearanceIds.has(
                                    clearance._id
                                  ) && (
                                    <>
                                      {currentUser?.reportProofer &&
                                        hasPermission(
                                          currentUser,
                                          "admin.view"
                                        ) &&
                                        !clearance.reportApprovedBy && (
                                          <Button
                                            variant="contained"
                                            size="small"
                                            color="success"
                                            onClick={(e) =>
                                              handleAuthoriseClearanceReport(
                                                clearance,
                                                e
                                              )
                                            }
                                            disabled={
                                              authorisingClearanceReports[
                                                clearance._id
                                              ] || generatingPDF
                                            }
                                            startIcon={
                                              authorisingClearanceReports[
                                                clearance._id
                                              ] ? (
                                                <CircularProgress
                                                  size={16}
                                                  color="inherit"
                                                />
                                              ) : null
                                            }
                                            sx={{
                                              backgroundColor:
                                                theme.palette.success.main,
                                              color: theme.palette.common.white,
                                              "&:hover": {
                                                backgroundColor:
                                                  theme.palette.success.dark,
                                              },
                                              "&:disabled": {
                                                backgroundColor:
                                                  theme.palette.success.main,
                                                opacity: 0.7,
                                              },
                                              mr: 1,
                                            }}
                                          >
                                            {authorisingClearanceReports[
                                              clearance._id
                                            ]
                                              ? "Authorising..."
                                              : "Authorise Report"}
                                          </Button>
                                        )}
                                      {(!currentUser?.reportProofer ||
                                        !hasPermission(
                                          currentUser,
                                          "admin.view"
                                        )) &&
                                        hasPermission(
                                          currentUser,
                                          "asbestos.edit"
                                        ) && (
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            color="primary"
                                            startIcon={<MailIcon />}
                                            onClick={(e) =>
                                              handleSendClearanceForAuthorisation(
                                                clearance,
                                                e
                                              )
                                            }
                                            disabled={Boolean(
                                              sendingClearanceAuthorisationRequests[
                                                clearance._id
                                              ]
                                            )}
                                            sx={{ mr: 1 }}
                                          >
                                            {sendingClearanceAuthorisationRequests[
                                              clearance._id
                                            ]
                                              ? "Sending..."
                                              : "Send for Authorisation"}
                                          </Button>
                                        )}
                                    </>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

      {/* Clearance Modal */}
      <Dialog
        open={clearanceDialogOpen}
        onClose={() => setClearanceDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingClearance ? "Edit Clearance" : "Add New Clearance"}
        </DialogTitle>
        <form onSubmit={handleClearanceSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Clearance Date"
                  type="date"
                  value={clearanceForm.clearanceDate}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      clearanceDate: e.target.value,
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <FormControl required sx={{ minWidth: 80 }}>
                    <InputLabel>Hour</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || ""
                          : ""
                      }
                      onChange={(e) => {
                        const hour = e.target.value;
                        const minutes = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[1] || "00"
                          : "00";
                        const ampm = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="Hour"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (hour) => (
                          <MenuItem
                            key={hour}
                            value={hour.toString().padStart(2, "0")}
                          >
                            {hour}
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>

                  <FormControl required sx={{ minWidth: 100 }}>
                    <InputLabel>Minutes</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime
                              .split(":")[1]
                              ?.split(" ")[0] || "00"
                          : "00"
                      }
                      onChange={(e) => {
                        const minutes = e.target.value;
                        const hour = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || "09"
                          : "09";
                        const ampm = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="Minutes"
                    >
                      {["00", "15", "30", "45"].map((minute) => (
                        <MenuItem key={minute} value={minute}>
                          {minute}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl required sx={{ minWidth: 80 }}>
                    <InputLabel>AM/PM</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM"
                      }
                      onChange={(e) => {
                        const ampm = e.target.value;
                        const hour = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || "09"
                          : "09";
                        const minutes = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime
                              .split(":")[1]
                              ?.split(" ")[0] || "00"
                          : "00";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="AM/PM"
                    >
                      <MenuItem value="AM">AM</MenuItem>
                      <MenuItem value="PM">PM</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Clearance Type</InputLabel>
                  <Select
                    value={clearanceForm.clearanceType}
                    onChange={(e) => {
                      const clearanceType = e.target.value;
                      const newForm = {
                        ...clearanceForm,
                        clearanceType,
                      };

                      // Add default text to job specific exclusions for Friable (Non-Friable Conditions)
                      if (
                        clearanceType === "Friable (Non-Friable Conditions)"
                      ) {
                        newForm.jobSpecificExclusions =
                          "The friable asbestos was removed using methods which kept the asbestos enclosed and therefore without disturbance of the material. As a result, the removal was undertaken under non-friable asbestos removal conditions.";
                      }

                      // Set asbestos removalist to "-" when Vehicle/Equipment is selected
                      if (clearanceType === "Vehicle/Equipment") {
                        newForm.asbestosRemovalist = "-";
                      } else if (clearanceForm.asbestosRemovalist === "-") {
                        // Reset to job's asbestos removalist if switching away from Vehicle/Equipment
                        newForm.asbestosRemovalist =
                          job?.asbestosRemovalist || "";
                      }

                      setClearanceForm(newForm);
                    }}
                    label="Clearance Type"
                  >
                    <MenuItem value="Non-friable">Non-friable</MenuItem>
                    <MenuItem value="Friable">Friable</MenuItem>
                    <MenuItem value="Friable (Non-Friable Conditions)">
                      Friable (Non-Friable Conditions)
                    </MenuItem>
                    <MenuItem value="Vehicle/Equipment">
                      Vehicle/Equipment
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Asbestos Removalist"
                  value={clearanceForm.asbestosRemovalist}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      asbestosRemovalist: e.target.value,
                    })
                  }
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                  <Select
                    value={clearanceForm.LAA}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        LAA: e.target.value,
                      })
                    }
                    label="LAA (Licensed Asbestos Assessor)"
                  >
                    {asbestosAssessors.map((assessor) => (
                      <MenuItem
                        key={assessor._id}
                        value={`${assessor.firstName} ${assessor.lastName}`}
                      >
                        {assessor.firstName} {assessor.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ minWidth: 150 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.secondary",
                      display: "block",
                      mb: 1,
                    }}
                  >
                    Jurisdiction
                  </Typography>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <FormControlLabel
                      value="ACT"
                      control={
                        <Radio
                          size="small"
                          checked={clearanceForm.jurisdiction === "ACT"}
                          onChange={(e) =>
                            setClearanceForm({
                              ...clearanceForm,
                              jurisdiction: e.target.value,
                            })
                          }
                        />
                      }
                      label="ACT"
                      sx={{ margin: 0 }}
                    />
                    <FormControlLabel
                      value="NSW"
                      control={
                        <Radio
                          size="small"
                          checked={clearanceForm.jurisdiction === "NSW"}
                          onChange={(e) =>
                            setClearanceForm({
                              ...clearanceForm,
                              jurisdiction: e.target.value,
                            })
                          }
                        />
                      }
                      label="NSW"
                      sx={{ margin: 0 }}
                    />
                  </Box>
                </Box>
              </Grid>
              {clearanceForm.clearanceType === "Vehicle/Equipment" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Vehicle/Equipment Description"
                    value={clearanceForm.vehicleEquipmentDescription}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        vehicleEquipmentDescription: e.target.value,
                      })
                    }
                    placeholder="Enter vehicle/equipment description"
                    helperText="This will replace the project name on the cover page"
                    required
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Secondary Header (Optional)"
                  value={clearanceForm.secondaryHeader}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      secondaryHeader: e.target.value,
                    })
                  }
                  placeholder="Enter secondary header text"
                  helperText="This will appear as a smaller header beneath the site name on the cover page"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={clearanceForm.notes}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      notes: e.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClearanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              sx={{
                backgroundColor: colors.secondary[600],
                color: colors.grey[100],
                "&:hover": {
                  backgroundColor: colors.secondary[700],
                },
              }}
            >
              {creating
                ? editingClearance
                  ? "Updating..."
                  : "Creating..."
                : editingClearance
                ? "Update Clearance"
                : "Create Clearance"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Air Monitoring Shift Modal */}
      <Dialog
        open={shiftDialogOpen}
        onClose={shiftCreating ? undefined : handleCloseShiftDialog}
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
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <MonitorIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {editingShift
              ? "Edit Air Monitoring Shift"
              : "Add New Air Monitoring Shift"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          {shiftCreating && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 2,
                p: 2,
                backgroundColor: "action.hover",
                borderRadius: 1,
              }}
            >
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                {editingShift
                  ? "Updating shift..."
                  : "Creating air monitoring shift..."}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Date"
              type="date"
              fullWidth
              value={newShiftDate}
              onChange={(e) => setNewShiftDate(e.target.value)}
              disabled={shiftCreating}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <Button
              variant="outlined"
              onClick={handleSetToday}
              disabled={shiftCreating}
              sx={{ height: "56px" }}
            >
              Today
            </Button>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            pt: 2,
            gap: 2,
            border: "none",
            justifyContent: "flex-start",
          }}
        >
          <Button
            onClick={editingShift ? handleUpdateShiftDate : handleShiftSubmit}
            variant="contained"
            startIcon={
              shiftCreating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <MonitorIcon />
              )
            }
            disabled={!newShiftDate || shiftCreating}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            {shiftCreating
              ? editingShift
                ? "Updating..."
                : "Creating..."
              : editingShift
              ? "Update Shift"
              : "Add Shift"}
          </Button>
          <Button
            onClick={handleCloseShiftDialog}
            variant="outlined"
            disabled={shiftCreating}
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Status Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={cancelResetStatus}
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
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: theme.palette.error.light,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Reset Shift Status?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to reset this shift's status to <b>Ongoing</b>
            ? This will allow editing of analysis data. No data will be deleted
            or cleared.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelResetStatus}
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
            onClick={confirmResetStatus}
            variant="contained"
            color="error"
            startIcon={<CloseIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Reset Status
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
            Delete{" "}
            {deleteType === "clearance" ? "Clearance" : "Air Monitoring Shift"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this {deleteType}? This action
            cannot be undone.
          </Typography>
          {itemToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              {deleteType === "clearance" ? (
                <>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Clearance Date:</strong>{" "}
                    {itemToDelete.clearanceDate
                      ? new Date(itemToDelete.clearanceDate).toLocaleDateString(
                          "en-AU"
                        )
                      : "Not specified"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Type:</strong>{" "}
                    {itemToDelete.clearanceType || "Not specified"}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Shift Date:</strong>{" "}
                    {itemToDelete.date
                      ? new Date(itemToDelete.date).toLocaleDateString("en-AU")
                      : "Not specified"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Description:</strong>{" "}
                    {itemToDelete.descriptionOfWorks || "Not specified"}
                  </Typography>
                </>
              )}
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
            Delete {deleteType === "clearance" ? "Clearance" : "Shift"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AsbestosRemovalJobDetails;
