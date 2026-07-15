import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AddIcon from "@mui/icons-material/Add";
import DownloadingIcon from "@mui/icons-material/Downloading";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import MailIcon from "@mui/icons-material/Mail";
import DescriptionIcon from "@mui/icons-material/Description";
import { tokens } from "../../theme/tokens";
import api from "../../services/api";
import {
  shiftService,
  sampleService,
  projectService,
  clientService,
  clientSuppliedJobsService,
} from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import {
  generateHTMLTemplatePDF,
  startClearancePDFJob,
  getClearancePDFStatus,
  downloadClearancePDFByClearanceId,
  downloadClearancePDFByJobId,
  downloadEnclosureCertificateByClearanceId,
  generateEnclosureCertificatePDF,
} from "../../utils/templatePDFGenerator";
import { generateShiftReport } from "../../utils/generateShiftReport";
import { useAuth } from "../../context/AuthContext";
import { useUserLists } from "../../context/UserListsContext";
import { formatDate } from "../../utils/dateFormat";
import { formatAuthoriserDisplayName } from "../../utils/formatters";
import { getTodayInSydney } from "../../utils/dateUtils";
import {
  buildShiftChainOfCustodyFilename,
  getAxiosDownloadFilename,
  triggerBlobDownload,
} from "../../utils/downloadFilename";
import { hasPermission } from "../../config/permissions";
import PermissionGate from "../../components/PermissionGate";

const TIMING_LOG_PREFIX = "[AsbestosRemovalJobDetails]";
const TIMING_ENABLED = true;

const getTimestamp = () =>
  typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();

const CLEARANCE_FORM_COMPARE_KEYS = [
  "clearanceDate",
  "inspectionTime",
  "clearanceType",
  "asbestosRemovalist",
  "LAA",
  "jurisdiction",
  "secondaryHeader",
  "vehicleEquipmentDescription",
  "jobSpecificExclusions",
];

const normalizeClearanceFormForCompare = (form) => {
  const normalized = {};
  for (const key of CLEARANCE_FORM_COMPARE_KEYS) {
    normalized[key] = String(form?.[key] ?? "").trim();
  }
  return normalized;
};

const clearanceFormsAreEqual = (a, b) => {
  const left = normalizeClearanceFormForCompare(a);
  const right = normalizeClearanceFormForCompare(b);
  return CLEARANCE_FORM_COMPARE_KEYS.every((key) => left[key] === right[key]);
};

const hasRetainedEnclosureCertificatePdf = (clearance) =>
  Boolean(
    clearance?.enclosureCertificatePdfReadyAt ||
      clearance?.enclosureCertificateMergedPdfPath,
  );

const isEnclosureCertificateRecord = (clearance) =>
  clearance?.isEnclosureCertificate === true;

const AsbestosRemovalJobDetails = () => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const renderStart = getTimestamp();

  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { jobId } = useParams();
  const { currentUser } = useAuth();
  const { activeLAAs } = useUserLists();

  const logDebug = useCallback((stage, details) => {
    // Debug logging disabled
  }, []);

  const [job, setJob] = useState(null);
  const [airMonitoringShifts, setAirMonitoringShifts] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [clearancesLoading, setClearancesLoading] = useState(false);
  const [clearancesLoaded, setClearancesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [creating, setCreating] = useState(false);

  // Clearance modal state
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState(null);
  const [pendingClearanceEdit, setPendingClearanceEdit] = useState(null);
  const [clearanceFormBaseline, setClearanceFormBaseline] = useState(null);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // PDF generation state
  const { showSnackbar } = useSnackbar();
  const [reportViewedShiftIds, setReportViewedShiftIds] = useState(new Set());
  const [reportViewedClearanceIds, setReportViewedClearanceIds] = useState(
    new Set(),
  );
  // Clearance PDF: background job for snackbar + auto table refresh
  const [clearancePdfJobId, setClearancePdfJobId] = useState(null);
  const [clearancePdfStatus, setClearancePdfStatus] = useState("idle"); // 'idle' | 'generating' | 'completed' | 'error'
  const [clearancePdfStartingId, setClearancePdfStartingId] = useState(null); // clearance _id while start request is in flight (prevents duplicate clicks)
  const [clearancePdfGeneratingForClearanceId, setClearancePdfGeneratingForClearanceId] = useState(null); // clearance _id whose PDF is generating (until poll completes)
  const clearancePdfCompletedJobRef = useRef(null); // prevent duplicate completion/download handling
  const [clearanceDownloadDialogOpen, setClearanceDownloadDialogOpen] = useState(false);
  const [shiftReportDownloadingShiftId, setShiftReportDownloadingShiftId] = useState(null);
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
  const [copyPreviousShiftSamples, setCopyPreviousShiftSamples] =
    useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftCreating, setShiftCreating] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetShiftId, setResetShiftId] = useState(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'clearance' or 'shift'
  const [creatingEnclosureCertificate, setCreatingEnclosureCertificate] =
    useState(false);
  const [reportViewedEnclosureIds, setReportViewedEnclosureIds] = useState(
    new Set(),
  );
  const [
    sendingEnclosureAuthorisationRequests,
    setSendingEnclosureAuthorisationRequests,
  ] = useState({});
  const [authorisingEnclosureCertificates, setAuthorisingEnclosureCertificates] =
    useState({});
  const [enclosureCertificateDownloadingId, setEnclosureCertificateDownloadingId] =
    useState(null);

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
    useComplexTemplate: false,
    jobSpecificExclusions: "",
  });

  const clearanceFormHasChanges = useMemo(() => {
    if (!editingClearance || !clearanceFormBaseline) return true;
    return !clearanceFormsAreEqual(clearanceForm, clearanceFormBaseline);
  }, [clearanceForm, clearanceFormBaseline, editingClearance]);

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
        // Timing logging disabled
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
        // Timing logging disabled
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
          getTimestamp() - shiftsPayloadStart,
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
            jobPayload.sampleNumbers,
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
                  entry.sampleNumbers.length,
              )
              .map((entry) => [entry.shiftId, entry.sampleNumbers]),
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
                : shift,
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
            getTimestamp() - clearancesStart,
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
            (clearancesSize / totalDataSize) * 100,
          );
          const jobPercentage = Math.round((jobDataSize / totalDataSize) * 100);
          const shiftsPercentage = Math.round(
            (shiftsPayloadSize / totalDataSize) * 100,
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
    [jobId, logDebug],
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
            isEnclosureCertificate:
              c.isEnclosureCertificate ?? existing?.isEnclosureCertificate,
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
        "asbestos_removalist",
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
        (a.text || "").localeCompare(b.text || ""),
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
        getTimestamp() - fetchStart,
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
    if ((activeTab === 1 || activeTab === 2) && !clearancesLoaded) {
      setActiveTab(0);
    }
  }, [activeTab, clearancesLoaded]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "enclosure" && clearancesLoaded) {
      setActiveTab(2);
    }
  }, [searchParams, clearancesLoaded]);

  // Refetch clearances when user returns to this tab (e.g. after adding items in clearance items page)
  // so generate/download icon reflects updatedAt vs pdfReadyAt correctly
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && jobId && clearancesLoaded) {
        clearancesLoadingRef.current = false;
        fetchClearances();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [jobId, clearancesLoaded, fetchClearances]);

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

  // Poll clearance PDF job; on complete show snackbar and refresh table
  useEffect(() => {
    if (!clearancePdfJobId || clearancePdfStatus !== "generating") {
      return;
    }
    const POLL_MS = 2500;
    const poll = async () => {
      try {
        const data = await getClearancePDFStatus(clearancePdfJobId);
        if (data.status === "completed" || data.ready) {
          const clearanceId = clearancePdfGeneratingForClearanceId;
          const jobId = clearancePdfJobId;
          if (clearancePdfCompletedJobRef.current === jobId) {
            return;
          }
          clearancePdfCompletedJobRef.current = jobId;
          setClearancePdfStatus("idle");
          setClearancePdfJobId(null);
          setClearancePdfGeneratingForClearanceId(null);
          try {
            let filename;
            try {
              ({ filename } = await downloadClearancePDFByJobId(jobId));
            } catch (jobDownloadErr) {
              ({ filename } = await downloadClearancePDFByClearanceId(clearanceId));
            }
            showSnackbar(`Downloaded: ${filename}`, "success");
            setReportViewedClearanceIds((prev) =>
              new Set(prev).add(clearanceId),
            );
            try {
              await asbestosClearanceService.markReportViewed(clearanceId);
            } catch (e) {
              console.warn("Failed to persist report viewed:", e);
            }
          } catch (e) {
            showSnackbar(e.message || "Download failed", "error");
          }
          clearancesLoadingRef.current = false;
          await fetchClearances();
          return;
        }
        if (data.status === "failed") {
          const errMsg = data.error || data.message || "PDF generation failed";
          setClearancePdfStatus("idle");
          setClearancePdfJobId(null);
          setClearancePdfGeneratingForClearanceId(null);
          showSnackbar(errMsg, "error");
          return;
        }
      } catch (err) {
        setClearancePdfStatus("idle");
        setClearancePdfJobId(null);
        setClearancePdfGeneratingForClearanceId(null);
        showSnackbar(err.message || "Status check failed", "error");
        return;
      }
      timerRef.current = setTimeout(poll, POLL_MS);
    };
    const timerRef = { current: null };
    poll();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    clearancePdfJobId,
    clearancePdfStatus,
    clearancePdfGeneratingForClearanceId,
    fetchClearances,
    showSnackbar,
  ]);

  useEffect(() => {
    if (pendingClearanceEdit && activeLAAs.length > 0) {
      const clearance = pendingClearanceEdit;
      setPendingClearanceEdit(null); // Clear pending

      setEditingClearance(clearance);
      const clearanceType = clearance.clearanceType || "Non-friable";

      // Find the matching LAA value from the assessors list
      // This ensures the value format matches exactly what the Select expects
      const storedLAA = clearance.LAA || "";
      const matchingAssessor = activeLAAs.find(
        (assessor) =>
          `${assessor.firstName} ${assessor.lastName}` === storedLAA,
      );
      const laaValue = matchingAssessor
        ? `${matchingAssessor.firstName} ${matchingAssessor.lastName}`
        : storedLAA; // Fallback to stored value if no exact match found

      const editFormValues = {
        projectId: clearance.projectId._id || clearance.projectId,
        clearanceDate: clearance.clearanceDate
          ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
          : "",
        inspectionTime: formatTimeForDisplay(clearance.inspectionTime),
        clearanceType: clearanceType,
        asbestosRemovalist: clearance.asbestosRemovalist || "",
        LAA: laaValue,
        jurisdiction: clearance.jurisdiction || "ACT",
        secondaryHeader: clearance.secondaryHeader || "",
        vehicleEquipmentDescription:
          clearance.vehicleEquipmentDescription || "",
        useComplexTemplate: clearance.useComplexTemplate || false,
        jobSpecificExclusions: clearance.jobSpecificExclusions || "",
      };

      setClearanceForm(editFormValues);
      setClearanceFormBaseline({ ...editFormValues });

      // Now open the dialog - assessors are loaded and form is set
      setClearanceDialogOpen(true);
    }
  }, [pendingClearanceEdit, activeLAAs]);

  const isShiftCompleteStatus = (status) =>
    status === "shift_complete" || status === "complete";

  const getStatusColor = (status) => {
    switch (status) {
      case "shift_complete":
      case "complete":
      case "analysis_complete":
        return theme.palette.success.main;
      case "in progress":
        return theme.palette.warning.main;
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
      "in progress": "In Progress",
      in_progress: "In Progress",
      active: "Active",
    };

    // Return mapped status or format by replacing underscores and capitalizing
    return (
      statusMap[status] ||
      status
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
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

  const enclosureCertificates = useMemo(
    () => clearances.filter((c) => isEnclosureCertificateRecord(c)),
    [clearances],
  );

  const jobClearances = useMemo(
    () => clearances.filter((c) => !isEnclosureCertificateRecord(c)),
    [clearances],
  );

  const isEnclosureCertificateModal =
    creatingEnclosureCertificate ||
    Boolean(editingClearance?.isEnclosureCertificate);

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
      (shift) => isShiftCompleteStatus(shift.status) && shift.reportApprovedBy,
    );

  // Check if all clearances are complete AND authorised (excludes enclosure-only records)
  const allClearancesCompleteAndAuthorised =
    jobClearances.length > 0 &&
    jobClearances.every(
      (clearance) =>
        clearance.status === "complete" && clearance.reportApprovedBy,
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
    (jobClearances.length === 0 || allClearancesCompleteAndAuthorised);

  const handleViewReport = async (shift) => {
    setShiftReportDownloadingShiftId(shift._id);
    try {
      // Fetch the latest shift data
      const shiftResponse = await shiftService.getById(shift._id);
      const latestShift = shiftResponse.data;

      // Fetch job and samples for this shift - use correct service based on jobModel
      let jobResponse;
      if (latestShift.jobModel === "AsbestosRemovalJob") {
        jobResponse = await asbestosRemovalJobService.getById(
          latestShift.job?._id || latestShift.job,
        );
      } else {
        jobResponse = await clientSuppliedJobsService.getById(
          latestShift.job?._id || latestShift.job,
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
        }),
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

      await generateShiftReport({
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
      try {
        await shiftService.update(shift._id, {
          reportViewedAt: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Failed to persist report viewed:", e);
      }
    } catch (err) {
      console.error("Error generating report:", err);
      showSnackbar("Failed to generate report.", "error");
    } finally {
      setShiftReportDownloadingShiftId(null);
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

      // Update shift with report approval
      const response = await shiftService.update(shift._id, updatedShiftData);

      // Re-fetch shift so we have populated supervisor/defaultSampler for the PDF (same as manual view path)
      const shiftResponse = await shiftService.getById(shift._id);
      const latestShift = shiftResponse.data;

      // Generate and download the report
      setShiftReportDownloadingShiftId(shift._id);
      try {
        // Fetch job and samples for this shift - use correct service based on jobModel
        let jobResponse;
        if (latestShift.jobModel === "AsbestosRemovalJob") {
          jobResponse = await asbestosRemovalJobService.getById(
            latestShift.job?._id || latestShift.job,
          );
        } else {
          jobResponse = await clientSuppliedJobsService.getById(latestShift.job?._id || latestShift.job);
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
          }),
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

        await generateShiftReport({
          shift: latestShift,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project,
          openInNewTab: false, // Always download when authorised
          sitePlanData: latestShift.sitePlan
            ? {
                sitePlan: latestShift.sitePlan,
                sitePlanData: latestShift.sitePlanData,
              }
            : null,
        });

        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success",
        );

        // Refresh the shifts data
        fetchJobDetails();
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning",
        );
      } finally {
        setShiftReportDownloadingShiftId(null);
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
        "success",
      );
      // Update local state so button turns grey and shows "Re-send for Authorisation" without refresh
      setAirMonitoringShifts((prev) =>
        prev.map((s) =>
          s._id === shift._id
            ? { ...s, authorisationRequestedBy: currentUser?._id ?? true }
            : s,
        ),
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error",
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
    // Lazy load clearances when user switches to clearances or enclosure tab
    if (
      (newValue === 1 || newValue === 2) &&
      clearances.length === 0 &&
      !clearancesLoadingRef.current
    ) {
      logDebug("Clearances/enclosure tab selected - fetching clearances");
      fetchClearances();
    }
  };

  const handleCreateAirMonitoringShift = () => {
    setNewShiftDate("");
    setCopyPreviousShiftSamples(false);
    setShiftDialogOpen(true);
  };

  const handleCloseClearanceDialog = () => {
    setClearanceDialogOpen(false);
    setEditingClearance(null);
    setPendingClearanceEdit(null);
    setClearanceFormBaseline(null);
    setCreatingEnclosureCertificate(false);
  };

  const handleCreateClearance = () => {
    setCreatingEnclosureCertificate(false);
    // Lazy load removalists and clearances if not already loaded or loading
    fetchAsbestosRemovalists();
    if (clearances.length === 0 && !clearancesLoadingRef.current) {
      fetchClearances();
    }
    setEditingClearance(null);
    setClearanceFormBaseline(null);
    resetClearanceForm();
    setClearanceDialogOpen(true);
  };

  const handleCreateEnclosureCertificate = () => {
    setCreatingEnclosureCertificate(true);
    fetchAsbestosRemovalists();
    if (clearances.length === 0 && !clearancesLoadingRef.current) {
      fetchClearances();
    }
    setEditingClearance(null);
    setClearanceFormBaseline(null);
    resetClearanceForm("Friable");
    setClearanceDialogOpen(true);
  };

  const handleSetToday = () => {
    setNewShiftDate(getTodayInSydney());
  };

  const getMostRecentShiftByDate = () => {
    if (!Array.isArray(airMonitoringShifts) || airMonitoringShifts.length === 0) {
      return null;
    }

    const datedShifts = airMonitoringShifts
      .filter((shift) => Boolean(shift?.date))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!datedShifts.length) {
      return airMonitoringShifts[0] || null;
    }

    return datedShifts[0];
  };

  const extractSampleNumber = (sample) => {
    const fromSampleNumber =
      typeof sample?.sampleNumber === "string" ? sample.sampleNumber : "";
    const sampleNumberMatch = fromSampleNumber.match(/^AM(\d+)$/i);
    if (sampleNumberMatch) {
      return Number.parseInt(sampleNumberMatch[1], 10) || 0;
    }

    const fromFullSampleId =
      typeof sample?.fullSampleID === "string" ? sample.fullSampleID : "";
    const fullSampleIdMatch = fromFullSampleId.match(/AM(\d+)$/i);
    if (fullSampleIdMatch) {
      return Number.parseInt(fullSampleIdMatch[1], 10) || 0;
    }

    return 0;
  };

  const getNextProjectSampleNumber = async (referenceSamples = []) => {
    const projectLookupId = job?.projectId?.projectID;
    let highestSampleNumber = 0;

    try {
      if (projectLookupId) {
        const projectSamplesResponse =
          await sampleService.getByProject(projectLookupId);
        const projectSamples = Array.isArray(projectSamplesResponse?.data)
          ? projectSamplesResponse.data
          : [];

        projectSamples.forEach((sample) => {
          highestSampleNumber = Math.max(
            highestSampleNumber,
            extractSampleNumber(sample),
          );
        });
      }
    } catch (error) {
      // Some environments return 404 for this endpoint; fallback to reference shift samples.
    }

    if (highestSampleNumber === 0 && Array.isArray(referenceSamples)) {
      referenceSamples.forEach((sample) => {
        highestSampleNumber = Math.max(
          highestSampleNumber,
          extractSampleNumber(sample),
        );
      });
    }

    return highestSampleNumber + 1;
  };

  const handleShiftSubmit = async ({ duplicateFromPrevious = false } = {}) => {
    setShiftCreating(true);
    try {
      const referenceShift = duplicateFromPrevious
        ? getMostRecentShiftByDate()
        : null;
      let copiedDescriptionOfWorks = "";

      if (duplicateFromPrevious && referenceShift?._id) {
        copiedDescriptionOfWorks =
          typeof referenceShift.descriptionOfWorks === "string"
            ? referenceShift.descriptionOfWorks
            : "";

        if (!copiedDescriptionOfWorks) {
          try {
            const referenceShiftResponse = await shiftService.getById(
              referenceShift._id,
            );
            copiedDescriptionOfWorks =
              typeof referenceShiftResponse?.data?.descriptionOfWorks === "string"
                ? referenceShiftResponse.data.descriptionOfWorks
                : "";
          } catch (error) {
            // If the previous shift details cannot be fetched, continue without copied description.
          }
        }
      }

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
        descriptionOfWorks: copiedDescriptionOfWorks,
      };

      const response = await shiftService.create(shiftData);
      const createdShift = response?.data;
      let duplicatedSamplesCount = 0;

      if (duplicateFromPrevious && createdShift?._id) {
        if (referenceShift?._id) {
          const previousSamplesResponse = await sampleService.getByShift(
            referenceShift._id,
          );
          const previousSamples = Array.isArray(previousSamplesResponse?.data)
            ? previousSamplesResponse.data
            : [];
          const samplesToCopy = previousSamples.map((sample) => ({
            type: sample?.type || "",
            location: sample?.location || "",
          }));

          if (samplesToCopy.length > 0) {
            const projectCode = job?.projectId?.projectID || "";
            const nextSampleNumberStart =
              await getNextProjectSampleNumber(previousSamples);

            for (let i = 0; i < samplesToCopy.length; i += 1) {
              const sampleTemplate = samplesToCopy[i];
              const sampleNumber = `AM${nextSampleNumberStart + i}`;

              await sampleService.create({
                shift: createdShift._id,
                job: jobId,
                jobModel: "AsbestosRemovalJob",
                sampleNumber,
                fullSampleID: projectCode
                  ? `${projectCode}-${sampleNumber}`
                  : sampleNumber,
                type: sampleTemplate.type || undefined,
                location: sampleTemplate.location || undefined,
                status: "pending",
              });
            }

            duplicatedSamplesCount = samplesToCopy.length;
          }
        }
      }

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

      if (duplicateFromPrevious) {
        showSnackbar(
          duplicatedSamplesCount > 0
            ? `Air monitoring shift created with ${duplicatedSamplesCount} copied sample(s)`
            : "Air monitoring shift created (no previous samples were copied)",
          "success",
        );
      } else {
        showSnackbar("Air monitoring shift created successfully", "success");
      }
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
      if (deleteType === "clearance" || deleteType === "enclosure") {
        await asbestosClearanceService.delete(itemToDelete._id);
        showSnackbar(
          deleteType === "enclosure"
            ? "Enclosure certificate deleted successfully"
            : "Clearance deleted successfully",
          "success",
        );
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
        "warning",
      );
      return;
    }
    const path = `/air-monitoring/shift/${shift._id}/samples`;
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
        },
      );

      const filename = getAxiosDownloadFilename(
        response,
        buildShiftChainOfCustodyFilename(job?.projectId?.projectID),
      );
      triggerBlobDownload(
        new Blob([response.data], { type: "application/pdf" }),
        filename,
      );

      showSnackbar("Chain of Custody downloaded successfully", "success");
    } catch (error) {
      console.error("Error downloading COC:", error);
      showSnackbar("Failed to download Chain of Custody", "error");
    }
  };

  const handleOpenClearancePdfDialog = async (clearance, event) => {
    event?.stopPropagation();
    setClearancePdfStartingId(clearance._id);
    setClearancePdfGeneratingForClearanceId(clearance._id);
    clearancePdfCompletedJobRef.current = null;
    showSnackbar("PDF generation has started. You will be notified when it is ready.", "info");
    setClearancePdfStatus("generating");
    setClearancePdfJobId(null);
    try {
      const fullClearance = await asbestosClearanceService.getById(
        clearance._id,
      );
      const { jobId } = await startClearancePDFJob(fullClearance);
      setClearancePdfJobId(jobId);
    } catch (err) {
      console.error("Error starting clearance PDF:", err);
      setClearancePdfStatus("idle");
      setClearancePdfGeneratingForClearanceId(null);
      showSnackbar(err.message || "Failed to start PDF generation", "error");
    } finally {
      setClearancePdfStartingId(null);
    }
  };

  // Green icon = retained PDF available → click only downloads. Orange = no PDF yet → click generates then downloads.
  const hasRetainedValidPdf = (clearance) =>
    Boolean(clearance.mergedPdfPath || clearance.pdfDownloadUrl);

  const handleDownloadOrGenerateClearanceReport = async (clearance, event) => {
    event?.stopPropagation();
    if (hasRetainedValidPdf(clearance)) {
      setClearanceDownloadDialogOpen(true);
      try {
        const { filename } = await downloadClearancePDFByClearanceId(clearance._id);
        showSnackbar(`Downloaded: ${filename}`, "success");
        setReportViewedClearanceIds((prev) =>
          new Set(prev).add(clearance._id),
        );
        try {
          await asbestosClearanceService.markReportViewed(clearance._id);
        } catch (e) {
          console.warn("Failed to persist report viewed:", e);
        }
      } catch (err) {
        console.error("Error downloading clearance PDF:", err);
        const msg = err.message || "";
        const isNoPdf = /no pdf|not available|retention|generate the pdf first/i.test(msg);
        if (isNoPdf) {
          showSnackbar("No PDF available. Starting generation…", "info");
          handleOpenClearancePdfDialog(clearance, event);
        } else {
          showSnackbar(msg || "Failed to download PDF", "error");
        }
      } finally {
        setClearanceDownloadDialogOpen(false);
      }
    } else {
      handleOpenClearancePdfDialog(clearance, event);
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
            : c,
        );
        return updated;
      });

      // Generate and download the authorised report
      try {
        const fullClearance = await asbestosClearanceService.getById(
          clearance._id,
        );

        await generateHTMLTemplatePDF("asbestos-clearance", fullClearance);
        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success",
        );
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning",
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
          (c) => c._id === clearance._id,
        );
        if (
          refreshedClearance &&
          !refreshedClearance.reportApprovedBy &&
          updatedClearance.reportApprovedBy
        ) {
          return prevClearances.map((c) =>
            c._id === clearance._id
              ? {
                  ...c,
                  reportApprovedBy: updatedClearance.reportApprovedBy,
                  reportIssueDate: updatedClearance.reportIssueDate,
                }
              : c,
          );
        }
        return prevClearances;
      });
    } catch (error) {
      console.error("Error authorising clearance report:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to authorise report. Please try again.",
        "error",
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
        clearance._id,
      );

      showSnackbar(
        response?.message ||
          `Authorisation request emails sent successfully to ${
            response?.recipients?.length || 0
          } report proofer user(s)`,
        "success",
      );
      // Update local state so button turns grey and shows "Re-send for Authorisation" without refresh
      setClearances((prev) =>
        prev.map((c) =>
          c._id === clearance._id
            ? { ...c, authorisationRequestedBy: currentUser?._id ?? true }
            : c,
        ),
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error",
      );
    } finally {
      setSendingClearanceAuthorisationRequests((prev) => ({
        ...prev,
        [clearance._id]: false,
      }));
    }
  };

  const handleEnclosureRowClick = (clearance) => {
    navigate(
      `/asbestos-removal/jobs/${jobId}/enclosure-inspection/${clearance._id}`,
    );
  };

  const handleDownloadOrGenerateEnclosureCertificate = async (
    clearance,
    event,
  ) => {
    event?.stopPropagation();
    if (!clearance?._id) return;

    setEnclosureCertificateDownloadingId(clearance._id);
    try {
      if (hasRetainedEnclosureCertificatePdf(clearance)) {
        const { filename } = await downloadEnclosureCertificateByClearanceId(
          clearance._id,
        );
        showSnackbar(`Downloaded: ${filename}`, "success");
      } else {
        const fullClearance = await asbestosClearanceService.getById(
          clearance._id,
        );
        const { filename } = await generateEnclosureCertificatePDF(fullClearance);
        showSnackbar(`Generated and downloaded: ${filename}`, "success");
        await fetchClearances();
      }

      setReportViewedEnclosureIds((prev) => new Set(prev).add(clearance._id));
      try {
        await asbestosClearanceService.markEnclosureCertificateViewed(
          clearance._id,
        );
      } catch (e) {
        console.warn("Failed to persist enclosure certificate viewed:", e);
      }
      setClearances((prev) =>
        prev.map((c) =>
          c._id === clearance._id
            ? { ...c, enclosureCertificateViewedAt: new Date().toISOString() }
            : c,
        ),
      );
    } catch (err) {
      console.error("Error downloading enclosure certificate:", err);
      showSnackbar(
        err.response?.data?.message ||
          err.message ||
          "Failed to download enclosure certificate",
        "error",
      );
    } finally {
      setEnclosureCertificateDownloadingId(null);
    }
  };

  const handleAuthoriseEnclosureCertificate = async (clearance, event) => {
    event?.stopPropagation();
    if (!clearance?._id || authorisingEnclosureCertificates[clearance._id]) {
      return;
    }

    try {
      setAuthorisingEnclosureCertificates((prev) => ({
        ...prev,
        [clearance._id]: true,
      }));

      const updatedClearance =
        await asbestosClearanceService.authoriseEnclosureCertificate(
          clearance._id,
        );

      setClearances((prev) =>
        prev.map((c) =>
          c._id === clearance._id
            ? {
                ...c,
                enclosureCertificateApprovedBy:
                  updatedClearance.enclosureCertificateApprovedBy,
                enclosureCertificateIssueDate:
                  updatedClearance.enclosureCertificateIssueDate,
              }
            : c,
        ),
      );

      try {
        const { filename } = await downloadEnclosureCertificateByClearanceId(
          clearance._id,
        );
        showSnackbar(
          `Certificate authorised and downloaded: ${filename}`,
          "success",
        );
      } catch (reportError) {
        console.error("Error downloading authorised enclosure certificate:", reportError);
        showSnackbar(
          "Certificate authorised but failed to generate download.",
          "warning",
        );
      }

      await fetchClearances();
    } catch (error) {
      console.error("Error authorising enclosure certificate:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to authorise certificate. Please try again.",
        "error",
      );
    } finally {
      setAuthorisingEnclosureCertificates((prev) => {
        const next = { ...prev };
        delete next[clearance._id];
        return next;
      });
    }
  };

  const handleSendEnclosureForAuthorisation = async (clearance, event) => {
    event?.stopPropagation();
    if (!clearance?._id) return;

    try {
      setSendingEnclosureAuthorisationRequests((prev) => ({
        ...prev,
        [clearance._id]: true,
      }));

      const response =
        await asbestosClearanceService.sendEnclosureCertificateForAuthorisation(
          clearance._id,
        );

      showSnackbar(
        response?.message ||
          `Authorisation request emails sent successfully to ${
            response?.recipients?.length || 0
          } report proofer user(s)`,
        "success",
      );
      setClearances((prev) =>
        prev.map((c) =>
          c._id === clearance._id
            ? {
                ...c,
                enclosureCertificateAuthorisationRequestedBy:
                  currentUser?._id ?? true,
              }
            : c,
        ),
      );
    } catch (error) {
      console.error("Error sending enclosure authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error",
      );
    } finally {
      setSendingEnclosureAuthorisationRequests((prev) => ({
        ...prev,
        [clearance._id]: false,
      }));
    }
  };

  const handleEditClearance = async (clearance, event) => {
    event.stopPropagation();
    setCreatingEnclosureCertificate(false);
    // Store the clearance to edit - we'll set up the form once assessors are loaded
    setPendingClearanceEdit(clearance);

    // Lazy load removalists only when needed (assessors come from UserListsContext)
    await fetchAsbestosRemovalists();
  };

  const handleEditEnclosureCertificate = async (clearance, event) => {
    event.stopPropagation();
    setCreatingEnclosureCertificate(false);
    setPendingClearanceEdit(clearance);
    await fetchAsbestosRemovalists();
  };

  const handleDeleteClearance = (clearance, event) => {
    event.stopPropagation();
    setItemToDelete(clearance);
    setDeleteType("clearance");
    setDeleteConfirmDialogOpen(true);
  };

  const handleDeleteEnclosureCertificate = (clearance, event) => {
    event.stopPropagation();
    setItemToDelete(clearance);
    setDeleteType("enclosure");
    setDeleteConfirmDialogOpen(true);
  };

  const handleEditShift = (shift, event) => {
    event.stopPropagation();
    setEditingShift(shift);
    setCopyPreviousShiftSamples(false);
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
    setCopyPreviousShiftSamples(false);
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
        "error",
      );
    }
  };

  const resetClearanceForm = (defaultClearanceType = "Non-friable") => {
    setClearanceForm({
      projectId: job?.projectId._id || job?.projectId || "",
      clearanceDate: getTodayInSydney(),
      inspectionTime: "09:00 AM",
      clearanceType: defaultClearanceType,
      asbestosRemovalist: job?.asbestosRemovalist || "",
      LAA: "",
      jurisdiction: "ACT",
      secondaryHeader: "",
      vehicleEquipmentDescription: "",
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
        jobSpecificExclusions: clearanceForm.jobSpecificExclusions,
        ...(creatingEnclosureCertificate && { isEnclosureCertificate: true }),
      };

      let response;
      if (editingClearance) {
        response = await asbestosClearanceService.update(
          editingClearance._id,
          newClearanceData,
        );
      } else {
        response = await asbestosClearanceService.create(newClearanceData);
      }

      // Close modal and refresh clearances list
      const wasCreatingEnclosure = creatingEnclosureCertificate;
      const createdClearanceId = response?._id;
      await fetchClearances();
      handleCloseClearanceDialog();
      resetClearanceForm();

      if (wasCreatingEnclosure && createdClearanceId) {
        navigate(
          `/asbestos-removal/jobs/${jobId}/enclosure-inspection/${createdClearanceId}`,
        );
      }
    } catch (err) {
      console.error("Error creating clearance:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingClearance
            ? "Failed to update clearance"
            : "Failed to create clearance"),
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
      getTimestamp() - permissionCheckStart,
    );
  }

  return (
    <Box
      sx={{
        m: { xs: 1, sm: 1.5, md: 2.5 },
        mx: { xs: 0.34, sm: 0.51, md: 2.5 },
      }}
    >
      {/* Clearance report download dialog */}
      <Dialog
        open={clearanceDownloadDialogOpen}
        onClose={() => setClearanceDownloadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle>Downloading report</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
            <CircularProgress size={24} />
            <Typography>
              The report is downloading. Please wait.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Air monitoring shift report download dialog */}
      <Dialog
        open={Boolean(shiftReportDownloadingShiftId)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "visible",
          },
        }}
        disableEscapeKeyDown
      >
        <DialogTitle sx={{ fontWeight: 600, pb: 0 }}>
          Generating shift report
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              py: 3,
              px: 1,
            }}
          >
            <CircularProgress size={48} thickness={4} color="success" />
            <Typography variant="body1" color="text.secondary" textAlign="center">
              The air monitoring shift report is being generated.
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Please wait — this may take a moment.
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: { xs: 2, md: 3 } }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToJobs}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal Jobs
        </Link>
      </Breadcrumbs>

      {/* Job Header */}
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                display: { xs: "none", md: "block" },
                fontSize: { xs: "0.9rem", md: "1.5rem" },
                fontWeight: 600,
              }}
            >
              Asbestos Removal Job Details
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
            >
              Project: {job?.projectId?.projectID || "Loading..."} -{" "}
              {job?.projectName || "Loading..."}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                fontSize: { xs: "0.8125rem", md: "1rem" },
              }}
            >
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
                display: { xs: "none", sm: "inline-flex" },
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

      {/* Mobile: Complete Job + Add button row (above tabs) */}
      {job && (
        <Box
          sx={{
            display: { xs: "flex", sm: "none" },
            gap: 2,
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          {hasShiftsOrClearances && (
            <Button
              variant="contained"
              color="success"
              onClick={handleCompleteJob}
              disabled={!canCompleteJob}
              sx={{
                flex: 1,
                minWidth: 140,
                backgroundColor: canCompleteJob
                  ? theme.palette.success.main
                  : theme.palette.grey[400],
                color: canCompleteJob
                  ? theme.palette.common.white
                  : theme.palette.grey[600],
                fontSize: "14px",
                fontWeight: "bold",
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
          {activeTab === 0 ? (
            <Button
              variant="contained"
              onClick={handleCreateAirMonitoringShift}
              disabled={creating}
              sx={{
                flex: 1,
                minWidth: 140,
                backgroundColor: colors.primary[700],
                color: colors.grey[100],
                "&:hover": {
                  backgroundColor: colors.primary[800],
                },
              }}
            >
              {creating ? "Creating..." : "Add Shift"}
            </Button>
          ) : clearancesLoaded ? (
            activeTab === 2 ? (
              <Button
                variant="contained"
                onClick={handleCreateEnclosureCertificate}
                disabled={creating}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  backgroundColor: "#2e7d32",
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: "#1b5e20",
                  },
                }}
              >
                {creating ? "Creating..." : "Add Certificate"}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleCreateClearance}
                disabled={creating}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  backgroundColor: colors.secondary[600],
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: colors.secondary[700],
                  },
                }}
              >
                {creating ? "Creating..." : "Add Clearance"}
              </Button>
            )
          ) : null}
        </Box>
      )}

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
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": { fontSize: "1em" },
              "& .MuiTab-iconWrapper": { display: { xs: "none", sm: "flex" } },
            }}
          >
            <Tab
              label={`Air Mon Shifts (${airMonitoringShifts.length})`}
              icon={<MonitorIcon />}
              iconPosition="start"
            />
            {clearancesLoaded && (
              <Tab
                label={`Clearances (${jobClearances.length})`}
                icon={<AssessmentIcon />}
                iconPosition="start"
              />
            )}
            {clearancesLoaded && (
              <Tab
                label={`Enclosure Inspection (${enclosureCertificates.length})`}
                icon={<DescriptionIcon />}
                iconPosition="start"
              />
            )}
          </Tabs>
          <Box sx={{ pr: 2, display: { xs: "none", sm: "block" } }}>
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
                {creating ? "Creating..." : "Add Shift"}
              </Button>
            ) : clearancesLoaded ? (
              activeTab === 2 ? (
                <Button
                  variant="contained"
                  startIcon={<DescriptionIcon />}
                  onClick={handleCreateEnclosureCertificate}
                  disabled={creating}
                  sx={{
                    backgroundColor: "#2e7d32",
                    color: colors.grey[100],
                    "&:hover": {
                      backgroundColor: "#1b5e20",
                    },
                  }}
                >
                  {creating ? "Creating..." : "Add Certificate"}
                </Button>
              ) : (
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
              )
            ) : null}
          </Box>
        </Box>

        {/* Air Monitoring Tab */}
        {activeTab === 0 && (
          <Box p={3}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: { xs: "none", md: "block" } }}
            >
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
                      sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white", "&:hover": { backgroundColor: "transparent" } }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Shift Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
                        Sample Numbers
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
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
                              ✓ Authorised by{" "}
                              {formatAuthoriserDisplayName(
                                shift.reportApprovedBy
                              )}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          {shift.sampleNumbers && shift.sampleNumbers.length > 0
                            ? shift.sampleNumbers.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            {!isShiftCompleteStatus(shift.status) && (
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
                                isShiftCompleteStatus(shift.status)) && (
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
                                      `/air-monitoring/shift/${shift._id}/analysis`,
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
                              isShiftCompleteStatus(shift.status)) && (
                              <>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  disabled={shiftReportDownloadingShiftId === shift._id}
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
                                  startIcon={
                                    shiftReportDownloadingShiftId === shift._id ? (
                                      <CircularProgress size={16} color="success" />
                                    ) : null
                                  }
                                >
                                  {shiftReportDownloadingShiftId === shift._id
                                    ? "Generating…"
                                    : shift.reportApprovedBy
                                    ? "Download Report"
                                    : "View Report"}
                                </Button>
                                {(() => {
                                  const permissionCheckStart = getTimestamp();
                                  const conditions = {
                                    notApproved: !shift.reportApprovedBy,
                                    reportViewed:
                                      reportViewedShiftIds.has(shift._id) ||
                                      !!shift.reportViewedAt,
                                    alreadySentForAuthorisation: !!shift.authorisationRequestedBy,
                                    hasEditPermission: hasPermission(
                                      currentUser,
                                      "jobs.edit",
                                    ),
                                    isLabSignatory: Boolean(
                                      currentUser?.labSignatory,
                                    ),
                                  };
                                  const permissionCheckDuration = Math.round(
                                    getTimestamp() - permissionCheckStart,
                                  );

                                  const baseVisible =
                                    conditions.notApproved &&
                                    conditions.reportViewed;
                                  const visibility = {
                                    showAuthorise:
                                      baseVisible &&
                                      conditions.isLabSignatory &&
                                      conditions.hasEditPermission,
                                    showSend:
                                      baseVisible &&
                                      !conditions.isLabSignatory &&
                                      conditions.hasEditPermission,
                                  };

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
                                          color={conditions.alreadySentForAuthorisation ? "inherit" : "primary"}
                                          startIcon={<MailIcon />}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSendForAuthorisation(shift);
                                          }}
                                          disabled={Boolean(
                                            sendingAuthorisationRequests[
                                              shift._id
                                            ],
                                          )}
                                          sx={
                                            conditions.alreadySentForAuthorisation
                                              ? { color: "text.secondary", borderColor: "grey.400" }
                                              : undefined
                                          }
                                        >
                                          {sendingAuthorisationRequests[
                                            shift._id
                                          ]
                                            ? "Sending..."
                                            : conditions.alreadySentForAuthorisation
                                            ? "Re-send for Authorisation"
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
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: { xs: "none", md: "block" } }}
            >
              Clearances
            </Typography>
            {jobClearances.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No clearances found for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white", "&:hover": { backgroundColor: "transparent" } }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Type
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobClearances.map((clearance) => (
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
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Chip
                            label={formatStatusLabel(clearance.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(clearance.status),
                              color: "white",
                            }}
                          />
                          {clearance.reportApprovedBy ? (
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
                              ✓ Authorised by{" "}
                              {formatAuthoriserDisplayName(
                                clearance.reportApprovedBy
                              )}
                            </Typography>
                          ) : clearance.status === "complete" ? (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                fontWeight: "medium",
                                color: theme.palette.warning.main,
                                fontStyle: "italic",
                              }}
                            >
                              Report not authorised
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
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
                              <Tooltip
                                title={
                                  clearancePdfStartingId === clearance._id ||
                                  clearancePdfGeneratingForClearanceId === clearance._id
                                    ? "PDF is generating..."
                                    : hasRetainedValidPdf(clearance)
                                      ? "Download report"
                                      : "Generate and download report"
                                }
                              >
                                <span>
                                  <IconButton
                                    size="small"
                                    color={hasRetainedValidPdf(clearance) ? "success" : "warning"}
                                    onClick={(e) =>
                                      handleDownloadOrGenerateClearanceReport(clearance, e)
                                    }
                                    disabled={
                                      clearancePdfStartingId === clearance._id ||
                                      clearancePdfGeneratingForClearanceId === clearance._id
                                    }
                                    sx={{
                                      mr: 1,
                                      ...((clearancePdfStartingId === clearance._id ||
                                        clearancePdfGeneratingForClearanceId === clearance._id) && {
                                        "@keyframes pdfSyncSpin": {
                                          "0%": { transform: "rotate(0deg)" },
                                          "100%": { transform: "rotate(360deg)" },
                                        },
                                        animation: "pdfSyncSpin 1s linear infinite",
                                      }),
                                    }}
                                  >
                                    <DownloadingIcon />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              {(reportViewedClearanceIds.has(
                                clearance._id,
                              ) ||
                                !!clearance.reportViewedAt) && (
                                    <>
                                      {currentUser?.reportProofer &&
                                        !clearance.reportApprovedBy && (
                                          <Button
                                            variant="contained"
                                            size="small"
                                            color="success"
                                            onClick={(e) =>
                                              handleAuthoriseClearanceReport(
                                                clearance,
                                                e,
                                              )
                                            }
                                            disabled={
                                              authorisingClearanceReports[
                                                clearance._id
                                              ] ||
                                              clearancePdfStartingId === clearance._id ||
                                              clearancePdfGeneratingForClearanceId === clearance._id
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
                                      {!currentUser?.reportProofer &&
                                        hasPermission(
                                          currentUser,
                                          "asbestos.edit",
                                        ) &&
                                        !clearance.reportApprovedBy && (
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            color={clearance.authorisationRequestedBy ? "inherit" : "primary"}
                                            startIcon={<MailIcon />}
                                            onClick={(e) =>
                                              handleSendClearanceForAuthorisation(
                                                clearance,
                                                e,
                                              )
                                            }
                                            disabled={Boolean(
                                              sendingClearanceAuthorisationRequests[
                                                clearance._id
                                              ],
                                            )}
                                            sx={
                                              clearance.authorisationRequestedBy
                                                ? { mr: 1, color: "text.secondary", borderColor: "grey.400" }
                                                : { mr: 1 }
                                            }
                                          >
                                            {sendingClearanceAuthorisationRequests[
                                              clearance._id
                                            ]
                                              ? "Sending..."
                                              : clearance.authorisationRequestedBy
                                              ? "Re-send for Authorisation"
                                              : "Send for Authorisation"}
                                          </Button>
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

        {/* Enclosure Inspection Tab */}
        {activeTab === 2 && clearancesLoaded && (
          <Box p={3}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: { xs: "none", md: "block" } }}
            >
              Enclosure Inspection Certificates
            </Typography>
            {enclosureCertificates.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No enclosure inspection certificates yet. Use Add Certificate to
                create an  enclosure certificate for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{
                        background:
                          "linear-gradient(to right, #045E1F, #96CC78) !important",
                        color: "white",
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Inspection Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Inspected By
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
                        Status
                      </TableCell>
                      <TableCell
                        sx={{
                          color: "white",
                          fontWeight: "bold",
                          display: { xs: "none", md: "table-cell" },
                        }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {enclosureCertificates.map((clearance) => (
                      <TableRow
                        key={clearance._id}
                        hover
                        onClick={() => handleEnclosureRowClick(clearance)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          {clearance.enclosureInspectionDateTime
                            ? formatDate(clearance.enclosureInspectionDateTime)
                            : clearance.clearanceDate
                              ? formatDate(clearance.clearanceDate)
                              : "N/A"}
                        </TableCell>
                        <TableCell>
                          {clearance.enclosureInspectedBy ||
                            clearance.LAA ||
                            "—"}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                        >
                          <Chip
                            label={formatStatusLabel(clearance.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(clearance.status),
                              color: "white",
                            }}
                          />
                          {clearance.enclosureCertificateApprovedBy ? (
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
                              ✓ Authorised by{" "}
                              {formatAuthoriserDisplayName(
                                clearance.enclosureCertificateApprovedBy,
                              )}
                            </Typography>
                          ) : clearance.status === "complete" ? (
                            <Typography
                              variant="caption"
                              display="block"
                              sx={{
                                mt: 0.5,
                                fontWeight: "medium",
                                color: theme.palette.warning.main,
                                fontStyle: "italic",
                              }}
                            >
                              Certificate not authorised
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell
                          sx={{ display: { xs: "none", md: "table-cell" } }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleEditEnclosureCertificate(clearance, e)
                              }
                              title="Edit Enclosure Certificate"
                            >
                              <EditIcon color="primary" />
                            </IconButton>
                            {clearance.status === "complete" && (
                              <>
                                <Tooltip
                                  title={
                                    hasRetainedEnclosureCertificatePdf(clearance)
                                      ? clearance.enclosureCertificateApprovedBy
                                        ? "Download certificate"
                                        : "View certificate"
                                      : "Generate and download certificate"
                                  }
                                >
                                  <span>
                                    <IconButton
                                      size="small"
                                      color={
                                        hasRetainedEnclosureCertificatePdf(
                                          clearance,
                                        )
                                          ? "success"
                                          : "warning"
                                      }
                                      onClick={(e) =>
                                        handleDownloadOrGenerateEnclosureCertificate(
                                          clearance,
                                          e,
                                        )
                                      }
                                      disabled={
                                        enclosureCertificateDownloadingId ===
                                        clearance._id
                                      }
                                    >
                                      {enclosureCertificateDownloadingId ===
                                      clearance._id ? (
                                        <CircularProgress size={18} />
                                      ) : (
                                        <DownloadingIcon />
                                      )}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                {(reportViewedEnclosureIds.has(clearance._id) ||
                                  !!clearance.enclosureCertificateViewedAt) &&
                                  hasRetainedEnclosureCertificatePdf(
                                    clearance,
                                  ) && (
                                <>
                                  {currentUser?.reportProofer &&
                                    !clearance.enclosureCertificateApprovedBy && (
                                      <Button
                                        variant="contained"
                                        size="small"
                                        color="success"
                                        onClick={(e) =>
                                          handleAuthoriseEnclosureCertificate(
                                            clearance,
                                            e,
                                          )
                                        }
                                        disabled={
                                          authorisingEnclosureCertificates[
                                            clearance._id
                                          ]
                                        }
                                        startIcon={
                                          authorisingEnclosureCertificates[
                                            clearance._id
                                          ] ? (
                                            <CircularProgress
                                              size={16}
                                              color="inherit"
                                            />
                                          ) : null
                                        }
                                        sx={{ mr: 1 }}
                                      >
                                        {authorisingEnclosureCertificates[
                                          clearance._id
                                        ]
                                          ? "Authorising..."
                                          : "Authorise"}
                                      </Button>
                                    )}
                                  {!currentUser?.reportProofer &&
                                    hasPermission(
                                      currentUser,
                                      "asbestos.edit",
                                    ) &&
                                    !clearance.enclosureCertificateApprovedBy && (
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        color={
                                          clearance.enclosureCertificateAuthorisationRequestedBy
                                            ? "inherit"
                                            : "primary"
                                        }
                                        startIcon={<MailIcon />}
                                        onClick={(e) =>
                                          handleSendEnclosureForAuthorisation(
                                            clearance,
                                            e,
                                          )
                                        }
                                        disabled={Boolean(
                                          sendingEnclosureAuthorisationRequests[
                                            clearance._id
                                          ],
                                        )}
                                        sx={
                                          clearance.enclosureCertificateAuthorisationRequestedBy
                                            ? {
                                                mr: 1,
                                                color: "text.secondary",
                                                borderColor: "grey.400",
                                              }
                                            : { mr: 1 }
                                        }
                                      >
                                        {sendingEnclosureAuthorisationRequests[
                                          clearance._id
                                        ]
                                          ? "Sending..."
                                          : clearance.enclosureCertificateAuthorisationRequestedBy
                                            ? "Re-send for Authorisation"
                                            : "Send for Authorisation"}
                                      </Button>
                                    )}
                                </>
                              )}
                              </>
                            )}
                            <PermissionGate
                              requiredPermissions={[
                                "asbestos.delete",
                                "admin.view",
                              ]}
                              fallback={null}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) =>
                                  handleDeleteEnclosureCertificate(
                                    clearance,
                                    e,
                                  )
                                }
                                title="Delete Enclosure Certificate"
                              >
                                <DeleteIcon color="error" />
                              </IconButton>
                            </PermissionGate>
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
      </Paper>

      {/* Clearance Modal */}
      <Dialog
        open={clearanceDialogOpen}
        onClose={handleCloseClearanceDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingClearance
            ? isEnclosureCertificateModal
              ? "Edit Enclosure Certificate"
              : "Edit Clearance"
            : creatingEnclosureCertificate
              ? "Add Enclosure Certificate"
              : "Add New Clearance"}
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
                          ? clearanceForm.inspectionTime
                              .split(":")[1]
                              ?.split(" ")[0] || "00"
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
                        ),
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
                      {Array.from({ length: 12 }, (_, i) =>
                        (i * 5).toString().padStart(2, "0"),
                      ).map((minute) => (
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
              {!isEnclosureCertificateModal && (
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
              )}
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
                    value={clearanceForm.LAA || ""}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        LAA: e.target.value,
                      })
                    }
                    label="LAA (Licensed Asbestos Assessor)"
                    key={`laa-select-${activeLAAs.length}-${clearanceForm.LAA}`}
                  >
                    {activeLAAs.length === 0 ? (
                      <MenuItem value="" disabled>
                        Loading assessors...
                      </MenuItem>
                    ) : (
                      activeLAAs.map((assessor) => {
                        const assessorValue = `${assessor.firstName} ${assessor.lastName}`;
                        return (
                          <MenuItem key={assessor._id} value={assessorValue}>
                            {assessor.firstName} {assessor.lastName}
                          </MenuItem>
                        );
                      })
                    )}
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
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseClearanceDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                creating || (Boolean(editingClearance) && !clearanceFormHasChanges)
              }
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
                  ? isEnclosureCertificateModal
                    ? "Update Enclosure Certificate"
                    : "Update Clearance"
                  : creatingEnclosureCertificate
                    ? "Create Enclosure Certificate"
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
          {!editingShift && airMonitoringShifts.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={copyPreviousShiftSamples}
                    onChange={(e) =>
                      setCopyPreviousShiftSamples(e.target.checked)
                    }
                    disabled={shiftCreating}
                  />
                }
                label="Copy previous shift samples"
              />
            </Box>
          )}
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
            onClick={() => {
              if (editingShift) {
                handleUpdateShiftDate();
              } else {
                handleShiftSubmit({
                  duplicateFromPrevious: copyPreviousShiftSamples,
                });
              }
            }}
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
            {deleteType === "clearance"
              ? "Clearance"
              : deleteType === "enclosure"
                ? "Enclosure Certificate"
                : "Air Monitoring Shift"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this {deleteType}? This action
            cannot be undone.
          </Typography>
          {itemToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              {deleteType === "clearance" || deleteType === "enclosure" ? (
                <>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>
                      {deleteType === "enclosure"
                        ? "Inspection Date:"
                        : "Clearance Date:"}
                    </strong>{" "}
                    {(deleteType === "enclosure"
                      ? itemToDelete.enclosureInspectionDateTime ||
                        itemToDelete.clearanceDate
                      : itemToDelete.clearanceDate)
                      ? new Date(
                          deleteType === "enclosure"
                            ? itemToDelete.enclosureInspectionDateTime ||
                                itemToDelete.clearanceDate
                            : itemToDelete.clearanceDate,
                        ).toLocaleDateString("en-AU")
                      : "Not specified"}
                  </Typography>
                  {deleteType === "clearance" && (
                    <Typography variant="body2" color="text.secondary">
                      <strong>Type:</strong>{" "}
                      {itemToDelete.clearanceType || "Not specified"}
                    </Typography>
                  )}
                  {deleteType === "enclosure" && (
                    <Typography variant="body2" color="text.secondary">
                      <strong>Inspected by:</strong>{" "}
                      {itemToDelete.enclosureInspectedBy ||
                        itemToDelete.LAA ||
                        "Not specified"}
                    </Typography>
                  )}
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
