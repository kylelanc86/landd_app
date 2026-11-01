import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  Breadcrumbs,
  Link,
  TextField,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
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
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Science as ScienceIcon,
  PictureAsPdf as PdfIcon,
  Mail as MailIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { useNavigate, useParams } from "react-router-dom";
import { mycometerJobsService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { hasPermission } from "../../config/permissions";
import { generateMycometerSurfaceFungiReport } from "../../utils/generateMycometerSurfaceFungiReport";
import { generateMycometerAirReport } from "../../utils/generateMycometerAirFaiReport";
import {
  SAMPLE_TYPE_FROM_SLUG,
  SAMPLE_TYPE_SLUGS,
  SAMPLE_TYPE_COLORS,
  CLEANING_STAGES,
  YES_NO_OPTIONS,
  AIR_FUNGI_FLOWMETER_OPTIONS,
  AIR_SAMPLING_TYPES,
  AIR_SAMPLING_LABEL,
  AIR_SAMPLING_SLUG,
  DEFAULT_AIR_FLOWMETER,
  isAirSamplingType,
  SAMPLE_ENTRY_SUPPORTED_TYPES,
  isAirLikeSampleType,
  isAirFungiSampleType,
  PDF_SUPPORTED_SAMPLE_TYPES,
  getSamplerDisplayWithCertFromMeta,
} from "./mycometerConstants";

const addBusinessDays = (date, businessDays) => {
  const result = new Date(date);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getUserId = (value) => {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
};

const getUserDisplayName = (user) =>
  `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
  user.email ||
  "Unnamed user";

const getNextSampleId = () => "LD-";

const formatSampleDateYyMmDd = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[1].slice(-2)}${match[2]}${match[3]}`;
};

const buildNextFaiSampleId = (projectID, sampleDate, existingSamples) => {
  const yymmdd = formatSampleDateYyMmDd(sampleDate);
  if (!projectID || !yymmdd) return "";
  const prefix = `${projectID} - ${yymmdd} - FAI`;
  const pattern = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`,
  );
  let max = 0;
  (existingSamples || []).forEach((sample) => {
    const match = String(sample.sampleId || "").trim().match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
};

const emptySampleForm = (sampleType, sampleId = "LD-", flowRate = "24") => {
  if (isAirLikeSampleType(sampleType)) {
    const form = {
      sampleId,
      sampleLocation: "",
      flowRate,
    };
    if (isAirFungiSampleType(sampleType)) {
      form.qualityControl = "No";
    }
    return form;
  }
  return {
    sampleId,
    sampleLocation: "",
    cleaningStage: CLEANING_STAGES[0],
  };
};

const MycometerSamples = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isAdmin } = usePermissions();
  const { jobId, sampleTypeSlug } = useParams();
  const isAirSampling = sampleTypeSlug === AIR_SAMPLING_SLUG;
  const sampleType = isAirSampling
    ? AIR_SAMPLING_LABEL
    : SAMPLE_TYPE_FROM_SLUG[sampleTypeSlug];
  const [includedAirTypes, setIncludedAirTypes] = useState([]);
  const typeColors =
    SAMPLE_TYPE_COLORS[isAirSampling ? "Air Fungi" : sampleType] ||
    SAMPLE_TYPE_COLORS["Surface Fungi"];
  const airLikeIncluded = includedAirTypes.filter((type) =>
    isAirLikeSampleType(type),
  );
  const isAirLike = isAirSampling
    ? airLikeIncluded.length > 0
    : isAirLikeSampleType(sampleType);
  const isAirFungi = isAirSampling
    ? includedAirTypes.includes("Air Fungi")
    : isAirFungiSampleType(sampleType);
  const isSurfaceFungi = sampleType === "Surface Fungi";
  const supportsSampleEntry = isAirSampling
    ? airLikeIncluded.length > 0
    : SAMPLE_ENTRY_SUPPORTED_TYPES.includes(sampleType);
  const entrySampleType = isAirSampling
    ? includedAirTypes.includes("Air Fungi")
      ? "Air Fungi"
      : airLikeIncluded[0] || "Air Fungi"
    : sampleType;
  const defaultAirFlowRate =
    includedAirTypes.includes("Air Fungi") &&
    includedAirTypes.includes("Air Allergen")
      ? "15"
      : "24";

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [sampledBy, setSampledBy] = useState("");
  const [sampledByUser, setSampledByUser] = useState(null);
  const [sampleDate, setSampleDate] = useState("");
  const [samples, setSamples] = useState([]);
  const [flowmeter, setFlowmeter] = useState(DEFAULT_AIR_FLOWMETER);

  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [editingTempId, setEditingTempId] = useState(null);
  const [sampleForm, setSampleForm] = useState(
    emptySampleForm("Surface Fungi"),
  );
  const [sampleFormError, setSampleFormError] = useState("");
  const [savingSample, setSavingSample] = useState(false);
  const [samplingComplete, setSamplingComplete] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [turnaroundTime, setTurnaroundTime] = useState("same day");
  const [showCustomTurnaround, setShowCustomTurnaround] = useState(false);
  const [analysisDueDate, setAnalysisDueDate] = useState("");
  const [completingSampling, setCompletingSampling] = useState(false);
  const [completeDialogError, setCompleteDialogError] = useState("");

  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [reportViewedAt, setReportViewedAt] = useState(null);
  const [reportApprovedBy, setReportApprovedBy] = useState("");
  const [authorisationRequestedBy, setAuthorisationRequestedBy] =
    useState(null);
  const [reportViewedLocally, setReportViewedLocally] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [authorisingReport, setAuthorisingReport] = useState(false);
  const [sendingAuthorisation, setSendingAuthorisation] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (
      !isAirSampling &&
      isAirSamplingType(sampleType) &&
      jobId
    ) {
      navigate(`/mycometer-sampling/${jobId}/${AIR_SAMPLING_SLUG}`, {
        replace: true,
      });
    }
  }, [isAirSampling, sampleType, jobId, navigate]);

  useEffect(() => {
    if (!sampleType) {
      setError("Unknown sample type.");
      setLoading(false);
      return;
    }
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, sampleTypeSlug]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await mycometerJobsService.getById(jobId);
      const jobData = response.data;

      const airTypes = isAirSampling
        ? AIR_SAMPLING_TYPES.filter((type) =>
            jobData?.scopeOfWorks?.includes(type),
          )
        : [];
      if (isAirSampling) {
        setIncludedAirTypes(airTypes);
      }

      if (isAirSampling ? airTypes.length === 0 : !jobData?.scopeOfWorks?.includes(sampleType)) {
        setError(
          `${isAirSampling ? AIR_SAMPLING_LABEL : sampleType} is not part of this job's scope of works.`,
        );
        setJob(jobData);
        setLoading(false);
        return;
      }

      setJob(jobData);

      const detailType = isAirSampling
        ? airTypes.includes("Air Fungi")
          ? "Air Fungi"
          : airTypes.find((type) => isAirLikeSampleType(type)) || airTypes[0]
        : sampleType;
      const airLikeTypes = airTypes.filter((type) => isAirLikeSampleType(type));
      const showQualityControl = isAirSampling
        ? airTypes.includes("Air Fungi")
        : isAirFungiSampleType(sampleType);

      const meta = (jobData.samplingMeta || []).find(
        (item) => item.sampleType === detailType,
      );
      setSampledBy(getUserId(meta?.sampledBy));
      setSampledByUser(
        meta ? getSamplerDisplayWithCertFromMeta(meta, detailType) : "",
      );
      setSampleDate(meta?.sampleDate ? formatDateInput(meta.sampleDate) : "");
      setSamplingComplete(
        isAirSampling
          ? airLikeTypes.length > 0 &&
              airLikeTypes.every((type) =>
                Boolean(
                  (jobData.samplingMeta || []).find(
                    (item) => item.sampleType === type,
                  )?.samplingComplete,
                ),
              )
          : Boolean(meta?.samplingComplete),
      );
      setFlowmeter(
        meta?.flowmeter ||
          (isAirSampling || isAirLikeSampleType(detailType)
            ? DEFAULT_AIR_FLOWMETER
            : ""),
      );
      if (meta?.turnaroundTime) {
        setTurnaroundTime(meta.turnaroundTime);
        setShowCustomTurnaround(meta.turnaroundTime === "custom");
      }
      if (meta?.analysisDueDate) {
        setAnalysisDueDate(formatDateInput(meta.analysisDueDate));
      }

      const analysisMeta = (jobData.analysisMeta || []).find(
        (item) => item.sampleType === sampleType,
      );
      setAnalysisComplete(Boolean(analysisMeta?.analysisComplete));
      setReportViewedAt(analysisMeta?.reportViewedAt || null);
      setReportApprovedBy(analysisMeta?.reportApprovedBy || "");
      setAuthorisationRequestedBy(
        analysisMeta?.authorisationRequestedBy || null,
      );
      setReportViewedLocally(Boolean(analysisMeta?.reportViewedAt));

      const existingSamples = (jobData.samples || []).filter(
        (sample) => sample.sampleType === detailType,
      );

      setSamples(
        existingSamples.map((sample, index) => ({
          tempId: sample._id || `existing-${index}`,
          sampleId: sample.sampleId || `LD-${index + 1}`,
          sampleLocation: sample.sampleLocation || "",
          cleaningStage: sample.cleaningStage || CLEANING_STAGES[0],
          flowRate:
            sample.flowRate !== undefined && sample.flowRate !== null
              ? String(sample.flowRate)
              : "",
          ...(showQualityControl
            ? { qualityControl: sample.qualityControl || "No" }
            : {}),
        })),
      );
    } catch (err) {
      console.error("Error loading mycometer job:", err);
      setError(
        err.response?.data?.message || "Failed to load job. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddSampleDialog = () => {
    setDialogMode("create");
    setEditingTempId(null);
    setSampleForm(
      emptySampleForm(
        entrySampleType,
        isAirLike
          ? buildNextFaiSampleId(
              job?.projectId?.projectID,
              sampleDate,
              samples,
            )
          : getNextSampleId(),
        defaultAirFlowRate,
      ),
    );
    setSampleFormError("");
    setSampleDialogOpen(true);
  };

  const handleOpenEditSampleDialog = (sample) => {
    setDialogMode("edit");
    setEditingTempId(sample.tempId);
    if (isAirLike) {
      setSampleForm({
        sampleId: sample.sampleId || "",
        sampleLocation: sample.sampleLocation || "",
        flowRate: sample.flowRate || "",
        ...(isAirFungi
          ? { qualityControl: sample.qualityControl || "No" }
          : {}),
      });
    } else {
      setSampleForm({
        sampleId: sample.sampleId || "",
        sampleLocation: sample.sampleLocation || "",
        cleaningStage: sample.cleaningStage || CLEANING_STAGES[0],
      });
    }
    setSampleFormError("");
    setSampleDialogOpen(true);
  };

  const handleCloseSampleDialog = ({ force = false } = {}) => {
    if (savingSample && !force) return;
    setSampleDialogOpen(false);
    setEditingTempId(null);
    setSampleForm(emptySampleForm(entrySampleType, "LD-", defaultAirFlowRate));
    setSampleFormError("");
  };

  const persistSamples = async (
    nextSamples,
    { closeDialog = false, nextFlowmeter = flowmeter } = {},
  ) => {
    if (!sampledBy || !sampleDate) {
      const message =
        "Sampler and sampling date must be set when the report is created.";
      if (closeDialog) {
        setSampleFormError(message);
      } else {
        setError(message);
      }
      return false;
    }

    const payload = {
      sampledBy,
      sampleDate,
      samples: nextSamples.map((sample) => {
        if (isAirLike) {
          const airSample = {
            sampleId: sample.sampleId,
            sampleLocation: sample.sampleLocation,
            flowRate:
              sample.flowRate === "" ? undefined : Number(sample.flowRate),
          };
          if (isAirFungi) {
            airSample.qualityControl = sample.qualityControl;
          }
          return airSample;
        }
        return {
          sampleId: sample.sampleId,
          sampleLocation: sample.sampleLocation,
          cleaningStage: sample.cleaningStage,
        };
      }),
    };

    const typesToSave = isAirSampling ? airLikeIncluded : [sampleType];
    for (const type of typesToSave) {
      const typePayload = {
        ...payload,
        samples: payload.samples.map((sample) => {
          if (type === "Air Fungi") return sample;
          const { qualityControl, ...sharedSample } = sample;
          return sharedSample;
        }),
      };
      if (isAirLikeSampleType(type)) {
        typePayload.flowmeter = nextFlowmeter || DEFAULT_AIR_FLOWMETER;
      }
      await mycometerJobsService.updateSampleType(jobId, type, typePayload);
    }

    return true;
  };

  const handleFlowmeterChange = async (event) => {
    const nextFlowmeter = event.target.value;
    setFlowmeter(nextFlowmeter);
    if (!sampledBy || !sampleDate || samplingComplete) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");
      const saved = await persistSamples(samples, {
        nextFlowmeter,
      });
      if (!saved) return;
      setSuccessMessage("Flowmeter saved.");
    } catch (err) {
      console.error("Error saving flowmeter:", err);
      setError(
        err.response?.data?.message ||
          "Failed to save flowmeter. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSampleDialog = async () => {
    const trimmedSampleId = sampleForm.sampleId.trim();
    const trimmedLocation = sampleForm.sampleLocation.trim();

    if (!trimmedSampleId) {
      setSampleFormError("Sample ID is required.");
      return;
    }
    if (!trimmedLocation) {
      setSampleFormError("Sample location is required.");
      return;
    }

    let nextSample;
    if (isAirLike) {
      if (
        sampleForm.flowRate === "" ||
        sampleForm.flowRate === null ||
        sampleForm.flowRate === undefined
      ) {
        setSampleFormError("Flowrate (LPM) is required.");
        return;
      }
      const flowRateNumber = Number(sampleForm.flowRate);
      if (!Number.isFinite(flowRateNumber) || flowRateNumber <= 0) {
        setSampleFormError("Enter a valid flowrate greater than 0.");
        return;
      }
      if (isAirFungi) {
        if (!YES_NO_OPTIONS.includes(sampleForm.qualityControl)) {
          setSampleFormError(
            "Please indicate whether the sample was taken for quality control.",
          );
          return;
        }
        nextSample = {
          sampleId: trimmedSampleId,
          sampleLocation: trimmedLocation,
          flowRate: String(flowRateNumber),
          qualityControl: sampleForm.qualityControl,
        };
      } else {
        nextSample = {
          sampleId: trimmedSampleId,
          sampleLocation: trimmedLocation,
          flowRate: String(flowRateNumber),
        };
      }
    } else {
      if (!sampleForm.cleaningStage) {
        setSampleFormError("Cleaning stage is required.");
        return;
      }
      nextSample = {
        sampleId: trimmedSampleId,
        sampleLocation: trimmedLocation,
        cleaningStage: sampleForm.cleaningStage,
      };
    }

    const nextSamples =
      dialogMode === "edit" && editingTempId
        ? samples.map((sample) =>
            sample.tempId === editingTempId
              ? { ...sample, ...nextSample }
              : sample,
          )
        : [
            ...samples,
            {
              tempId: `new-${Date.now()}`,
              ...nextSample,
            },
          ];

    try {
      setSavingSample(true);
      setSampleFormError("");
      setError("");
      setSuccessMessage("");

      const saved = await persistSamples(nextSamples, { closeDialog: true });
      if (!saved) return;

      setSamples(nextSamples);
      setSavingSample(false);
      handleCloseSampleDialog({ force: true });
      await fetchJob();
    } catch (err) {
      console.error("Error saving sample:", err);
      setSampleFormError(
        err.response?.data?.message ||
          "Failed to save sample. Please try again.",
      );
      setSavingSample(false);
    }
  };

  const handleRemoveSample = async (tempId) => {
    if (samplingComplete) return;
    const nextSamples = samples.filter((sample) => sample.tempId !== tempId);

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const saved = await persistSamples(nextSamples);
      if (!saved) return;

      setSamples(nextSamples);
      setSuccessMessage("Sample deleted successfully.");
      await fetchJob();
    } catch (err) {
      console.error("Error deleting sample:", err);
      setError(
        err.response?.data?.message ||
          "Failed to delete sample. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCompleteDialog = () => {
    if (!sampledBy || !sampleDate) {
      setError(
        "This report is missing sampler or sampling date. Add those when creating the report.",
      );
      return;
    }
    if (isAirLike && !flowmeter) {
      setError("Select a flowmeter before completing sampling.");
      return;
    }
    if (samples.length === 0) {
      setError("Add at least one sample before completing sampling.");
      return;
    }

    setTurnaroundTime("same day");
    setShowCustomTurnaround(false);
    setAnalysisDueDate(sampleDate);
    setCompleteDialogError("");
    setCompleteDialogOpen(true);
  };

  const handleCloseCompleteDialog = () => {
    if (completingSampling) return;
    setCompleteDialogOpen(false);
    setCompleteDialogError("");
  };

  const handleConfirmSamplingComplete = async () => {
    const finalTurnaround = showCustomTurnaround ? "custom" : turnaroundTime;
    if (!finalTurnaround) {
      setCompleteDialogError("Please select a turnaround time.");
      return;
    }
    if (finalTurnaround === "custom" && !analysisDueDate) {
      setCompleteDialogError("Please select an analysis due date.");
      return;
    }

    try {
      setCompletingSampling(true);
      setCompleteDialogError("");
      setError("");

      const typesToComplete = isAirSampling ? airLikeIncluded : [sampleType];
      for (const type of typesToComplete) {
        await mycometerJobsService.completeSampling(jobId, type, {
          turnaroundTime: finalTurnaround,
          analysisDueDate:
            finalTurnaround === "custom"
              ? analysisDueDate
              : analysisDueDate || undefined,
        });
      }

      setSamplingComplete(true);
      setCompleteDialogOpen(false);
      setSuccessMessage("Sampling marked as complete.");
      await fetchJob();
    } catch (err) {
      console.error("Error completing sampling:", err);
      setCompleteDialogError(
        err.response?.data?.message ||
          "Failed to complete sampling. Please try again.",
      );
    } finally {
      setCompletingSampling(false);
    }
  };

  const analysisPath = `/mycometer-sampling/${jobId}/${sampleTypeSlug}/analysis`;

  const handleReopenReport = async () => {
    try {
      setReopening(true);
      setError("");
      const typesToReopen = isAirSampling ? airLikeIncluded : [sampleType];
      for (const type of typesToReopen) {
        await mycometerJobsService.reopenSampleType(jobId, type);
      }
      setReopenDialogOpen(false);
      setSuccessMessage(
        "Report reopened. Sampling and analysis can be edited again.",
      );
      await fetchJob();
    } catch (err) {
      console.error("Error reopening Mycometer report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to reopen report. Only admins can reopen reports.",
      );
    } finally {
      setReopening(false);
    }
  };

  const handleGeneratePDF = async ({
    download = false,
    reportType = sampleType,
  } = {}) => {
    if (!PDF_SUPPORTED_SAMPLE_TYPES.includes(reportType)) {
      setError(
        "PDF reports are currently only available for Surface Fungi, Air Fungi, and Air Allergen.",
      );
      return;
    }

    try {
      setGeneratingPDF(true);
      setError("");
      const response = await mycometerJobsService.getById(jobId);
      const jobData = response.data;
      const samplingMeta = (jobData.samplingMeta || []).find(
        (item) => item.sampleType === reportType,
      );
      const analysisMeta = (jobData.analysisMeta || []).find(
        (item) => item.sampleType === reportType,
      );
      const typeSamples = (jobData.samples || []).filter(
        (sample) => sample.sampleType === reportType,
      );

      const reportArgs = {
        job: jobData,
        samples: typeSamples,
        samplingMeta,
        analysisMeta,
        project: jobData.projectId,
        openInNewTab: !download,
      };

      const isAirReport =
        reportType === "Air Fungi" || reportType === "Air Allergen";
      if (isAirReport) {
        await generateMycometerAirReport({
          job: jobData,
          project: jobData.projectId,
          openInNewTab: !download,
        });
      } else {
        await generateMycometerSurfaceFungiReport(reportArgs);
      }

      const viewedAt = new Date().toISOString();
      const typesToMark = isAirReport ? airLikeIncluded : [reportType];
      setReportViewedLocally(true);
      setReportViewedAt(viewedAt);
      setJob((prev) => {
        if (!prev) return prev;
        const nextMeta = [...(prev.analysisMeta || [])];
        typesToMark.forEach((type) => {
          const idx = nextMeta.findIndex((item) => item.sampleType === type);
          if (idx >= 0) {
            nextMeta[idx] = { ...nextMeta[idx], reportViewedAt: viewedAt };
          }
        });
        return { ...prev, analysisMeta: nextMeta };
      });
      for (const type of typesToMark) {
        try {
          await mycometerJobsService.markReportViewed(jobId, type, {
            reportViewedAt: viewedAt,
          });
        } catch (viewErr) {
          console.warn("Failed to persist report viewed:", viewErr);
        }
      }
    } catch (err) {
      console.error("Error generating Mycometer PDF:", err);
      setError(
        err.response?.data?.message ||
          "Failed to generate PDF report. Please try again.",
      );
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleAuthoriseReport = async (requestedType) => {
    const reportType =
      typeof requestedType === "string" ? requestedType : sampleType;
    const types =
      isAirSampling &&
      (reportType === "Air Fungi" || reportType === "Air Allergen")
        ? airLikeIncluded
        : [reportType];
    try {
      setAuthorisingReport(true);
      setError("");
      let notified = false;
      for (const type of types) {
        const meta = (job?.analysisMeta || []).find(
          (item) => item.sampleType === type,
        );
        if (meta?.reportApprovedBy) continue;
        await mycometerJobsService.authorise(jobId, type, {
          notify: !notified,
          reportLabel:
            types.length > 1 ? "Mycometer Air Sampling report" : undefined,
        });
        notified = true;
      }
      await fetchJob();
      await handleGeneratePDF({ download: true, reportType: types[0] });
      setSuccessMessage("Report authorised successfully.");
    } catch (err) {
      console.error("Error authorising Mycometer report:", err);
      setError(
        err.response?.data?.message ||
          "Failed to authorise report. Please try again.",
      );
    } finally {
      setAuthorisingReport(false);
    }
  };

  const handleSendForAuthorisation = async (requestedType) => {
    const reportType =
      typeof requestedType === "string" ? requestedType : sampleType;
    const types =
      isAirSampling &&
      (reportType === "Air Fungi" || reportType === "Air Allergen")
        ? airLikeIncluded
        : [reportType];
    try {
      setSendingAuthorisation(true);
      setError("");
      let notified = false;
      let message = "";
      for (const type of types) {
        const meta = (job?.analysisMeta || []).find(
          (item) => item.sampleType === type,
        );
        if (meta?.reportApprovedBy) continue;
        const response = await mycometerJobsService.sendForAuthorisation(
          jobId,
          type,
          {
            notify: !notified,
            reportLabel: types.length > 1 ? "Air Sampling" : undefined,
          },
        );
        if (!notified) message = response.data?.message || "";
        notified = true;
      }
      setAuthorisationRequestedBy(currentUser?._id || true);
      setJob((prev) => {
        if (!prev) return prev;
        const nextMeta = [...(prev.analysisMeta || [])];
        types.forEach((type) => {
          const idx = nextMeta.findIndex((item) => item.sampleType === type);
          if (idx >= 0 && !nextMeta[idx].reportApprovedBy) {
            nextMeta[idx] = {
              ...nextMeta[idx],
              authorisationRequestedBy: currentUser?._id || true,
            };
          }
        });
        return { ...prev, analysisMeta: nextMeta };
      });
      setSuccessMessage(
        message || "Authorisation request emails sent successfully.",
      );
    } catch (err) {
      console.error("Error sending Mycometer authorisation request:", err);
      setError(
        err.response?.data?.message ||
          "Failed to send authorisation request. Please try again.",
      );
    } finally {
      setSendingAuthorisation(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 6, display: "flex", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs>
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate(`/mycometer-sampling/${jobId}`)}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                mb: 2,
              }}
            >
              <ArrowBackIcon sx={{ mr: 1 }} />
              Mycometer Reports
            </Link>
          </Breadcrumbs>
          <Typography variant="h4" component="h1" gutterBottom>
            Mycometer - {sampleType || "Mycometer Samples"}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 1 }}>
            {job?.projectId?.projectID
              ? `${job.projectId.projectID} — ${job.projectId.name || "Unnamed Project"}`
              : job?.projectId?.name || "Mycometer Job"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Sampler:{" "}
            <strong>
              {sampledByUser || sampledBy || "—"}
            </strong>
            {" · "}
            Sampling date:{" "}
            <strong>
              {sampleDate
                ? new Date(sampleDate).toLocaleDateString("en-AU")
                : "—"}
            </strong>
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        {!sampleType ? null : !supportsSampleEntry ? (
          <Paper sx={{ p: 3 }}>
            <Typography>
              Sample entry fields for <strong>{sampleType}</strong> will be
              added next. Shared job header fields are available for Surface
              Fungi, Air Fungi, and Air Allergen.
            </Typography>
            <Button
              sx={{ mt: 2 }}
              onClick={() => navigate(`/mycometer-sampling/${jobId}`)}
            >
              Back to reports
            </Button>
          </Paper>
        ) : (
          <>
            {isAirLike && (
              <Box sx={{ mb: 3 }}>
                <FormControl
                  size="small"
                  disabled={samplingComplete || saving}
                  sx={{ minWidth: 140, maxWidth: 160 }}
                >
                  <InputLabel id="air-fungi-flowmeter-label">
                    Flowmeter
                  </InputLabel>
                  <Select
                    labelId="air-fungi-flowmeter-label"
                    label="Flowmeter"
                    value={flowmeter || DEFAULT_AIR_FLOWMETER}
                    onChange={handleFlowmeterChange}
                  >
                    {(AIR_FUNGI_FLOWMETER_OPTIONS.includes(flowmeter) ||
                    !flowmeter
                      ? AIR_FUNGI_FLOWMETER_OPTIONS
                      : [flowmeter, ...AIR_FUNGI_FLOWMETER_OPTIONS]
                    ).map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Samples
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddSampleDialog}
                disabled={samplingComplete}
                sx={{
                  textTransform: "none",
                  backgroundColor: typeColors.color,
                  "&:hover": {
                    backgroundColor: typeColors.borderColor,
                  },
                }}
              >
                Add Sample
              </Button>
            </Box>

            <Paper sx={{ width: "100%", overflow: "hidden", mb: 3 }}>
              <TableContainer>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow
                      sx={{
                        background:
                          "linear-gradient(to right, #045E1F, #96CC78) !important",
                        color: "white",
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <TableCell sx={{ fontWeight: "bold", color: "inherit" }}>
                        Sample ID
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "inherit" }}>
                        Sample Location
                      </TableCell>
                      {isAirLike ? (
                        <>
                          <TableCell
                            sx={{ fontWeight: "bold", color: "inherit" }}
                          >
                            Flowrate (LPM)
                          </TableCell>
                          {isAirFungi && (
                            <TableCell
                              sx={{ fontWeight: "bold", color: "inherit" }}
                            >
                              Quality Control
                            </TableCell>
                          )}
                        </>
                      ) : (
                        <TableCell
                          sx={{ fontWeight: "bold", color: "inherit" }}
                        >
                          Cleaning Stage
                        </TableCell>
                      )}
                      <TableCell
                        sx={{
                          fontWeight: "bold",
                          color: "inherit",
                          width: 120,
                        }}
                        align="right"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {samples.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAirFungi ? 5 : 4} align="center">
                          No samples added yet. Click Add Sample to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      samples.map((sample) => (
                        <TableRow key={sample.tempId} hover>
                          <TableCell>{sample.sampleId || "—"}</TableCell>
                          <TableCell>{sample.sampleLocation || "—"}</TableCell>
                          {isAirLike ? (
                            <>
                              <TableCell>
                                {sample.flowRate !== "" &&
                                sample.flowRate != null
                                  ? sample.flowRate
                                  : "—"}
                              </TableCell>
                              {isAirFungi && (
                                <TableCell>
                                  {sample.qualityControl || "—"}
                                </TableCell>
                              )}
                            </>
                          ) : (
                            <TableCell>{sample.cleaningStage || "—"}</TableCell>
                          )}
                          <TableCell align="right">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenEditSampleDialog(sample)}
                              disabled={samplingComplete}
                              aria-label="Edit sample"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveSample(sample.tempId)}
                              disabled={samplingComplete}
                              aria-label="Delete sample"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-start",
                gap: 1,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              {!samplingComplete ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleOpenCompleteDialog}
                  disabled={
                    samples.length === 0 ||
                    !sampledBy ||
                    !sampleDate ||
                    (isAirLike && !flowmeter)
                  }
                  sx={{ textTransform: "none" }}
                >
                  Sampling Complete
                </Button>
              ) : (
                <>
                  {isAdmin && (
                    <Button
                      variant="contained"
                      startIcon={<RefreshIcon />}
                      onClick={() => setReopenDialogOpen(true)}
                      disabled={reopening}
                      sx={{
                        textTransform: "none",
                        backgroundColor: "#f57c00",
                        "&:hover": {
                          backgroundColor: "#e65100",
                        },
                      }}
                    >
                      Reopen Report (Admin)
                    </Button>
                  )}
                  {isAirSampling ? (
                    <>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={
                        includedAirTypes.length > 0 &&
                        includedAirTypes.every((type) =>
                          Boolean(
                            (job?.analysisMeta || []).find(
                              (item) => item.sampleType === type,
                            )?.analysisComplete,
                          ),
                        ) ? (
                          <VisibilityIcon />
                        ) : (
                          <ScienceIcon />
                        )
                      }
                      onClick={() =>
                        navigate(
                          `/mycometer-sampling/${jobId}/${AIR_SAMPLING_SLUG}/analysis`,
                        )
                      }
                      sx={{ textTransform: "none" }}
                    >
                      {includedAirTypes.length > 0 &&
                      includedAirTypes.every((type) =>
                        Boolean(
                          (job?.analysisMeta || []).find(
                            (item) => item.sampleType === type,
                          )?.analysisComplete,
                        ),
                      )
                        ? "View Analysis"
                        : "Analysis"}
                    </Button>
                    {includedAirTypes.filter((type) =>
                      PDF_SUPPORTED_SAMPLE_TYPES.includes(type),
                    ).length > 0 &&
                      includedAirTypes
                        .filter((type) =>
                          PDF_SUPPORTED_SAMPLE_TYPES.includes(type),
                        )
                        .every((type) =>
                          Boolean(
                            (job?.analysisMeta || []).find(
                              (item) => item.sampleType === type,
                            )?.analysisComplete,
                          ),
                        ) && (
                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<PdfIcon />}
                          onClick={() =>
                            handleGeneratePDF({
                              reportType: includedAirTypes.find((type) =>
                                PDF_SUPPORTED_SAMPLE_TYPES.includes(type),
                              ),
                            })
                          }
                          disabled={generatingPDF}
                          sx={{ textTransform: "none" }}
                        >
                          {generatingPDF ? "..." : "PDF"}
                        </Button>
                      )}
                    {(() => {
                      const airActionTypes = includedAirTypes.filter((type) =>
                        PDF_SUPPORTED_SAMPLE_TYPES.includes(type),
                      );
                      const airMetas = airActionTypes.map((type) =>
                        (job?.analysisMeta || []).find(
                          (item) => item.sampleType === type,
                        ),
                      );
                      if (
                        airActionTypes.length === 0 ||
                        !airMetas.every((meta) => meta?.analysisComplete)
                      ) {
                        return null;
                      }
                      const pending = airActionTypes.some((type, index) => {
                        const meta = airMetas[index];
                        return meta?.analysisComplete && !meta?.reportApprovedBy;
                      });
                      const viewed = airMetas.every((meta) =>
                        Boolean(meta?.reportViewedAt),
                      );
                      const alreadySent = airActionTypes.every((type, index) => {
                        const meta = airMetas[index];
                        return (
                          meta?.reportApprovedBy ||
                          meta?.authorisationRequestedBy
                        );
                      });
                      const canEdit = hasPermission(
                        currentUser,
                        "projects.edit",
                      );
                      const showAuthorise =
                        pending &&
                        viewed &&
                        canEdit &&
                        Boolean(currentUser?.reportProofer);
                      const showSend =
                        pending &&
                        viewed &&
                        canEdit &&
                        !currentUser?.reportProofer;
                      const reportType = airActionTypes[0];
                      if (!showAuthorise && !showSend) return null;
                      return (
                        <>
                          {showAuthorise && (
                            <Button
                              variant="contained"
                              size="small"
                              color="success"
                              onClick={() => handleAuthoriseReport(reportType)}
                              disabled={authorisingReport || generatingPDF}
                              sx={{ textTransform: "none" }}
                            >
                              Authorise
                            </Button>
                          )}
                          {showSend && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<MailIcon />}
                              onClick={() =>
                                handleSendForAuthorisation(reportType)
                              }
                              disabled={sendingAuthorisation}
                              sx={{ textTransform: "none" }}
                            >
                              {alreadySent
                                ? "Re-send for Authorisation"
                                : "Send for Authorisation"}
                            </Button>
                          )}
                        </>
                      );
                    })()}
                    </>
                  ) : null}
                  {isAirSampling ? null : (
                    <Button
                      variant="contained"
                      startIcon={
                        analysisComplete ? (
                          <VisibilityIcon />
                        ) : (
                          <ScienceIcon />
                        )
                      }
                      onClick={() => navigate(analysisPath)}
                      sx={{
                        textTransform: "none",
                        backgroundColor: typeColors.color,
                        "&:hover": {
                          backgroundColor: typeColors.borderColor,
                        },
                      }}
                    >
                      {analysisComplete ? "View Analysis" : "Analysis"}
                    </Button>
                  )}

                  {!isAirSampling &&
                    analysisComplete &&
                    (isSurfaceFungi || isAirLike) && (
                    <>
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                        }}
                      >
                        <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<PdfIcon />}
                          onClick={() => handleGeneratePDF()}
                          disabled={generatingPDF}
                          sx={{ textTransform: "none" }}
                        >
                          {generatingPDF ? "..." : "PDF"}
                        </Button>
                        {!reportApprovedBy && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: "error.main",
                              fontSize: "0.7rem",
                              mt: 0.5,
                              ml: 0.5,
                            }}
                          >
                            Not approved
                          </Typography>
                        )}
                      </Box>

                      {(() => {
                        const conditions = {
                          notApproved: !reportApprovedBy,
                          reportViewed: reportViewedLocally || !!reportViewedAt,
                          alreadySentForAuthorisation:
                            !!authorisationRequestedBy,
                          hasEditPermission: hasPermission(
                            currentUser,
                            "projects.edit",
                          ),
                          isReportProofer: Boolean(currentUser?.reportProofer),
                        };
                        const baseVisible =
                          conditions.notApproved && conditions.reportViewed;
                        const showAuthorise =
                          baseVisible &&
                          conditions.isReportProofer &&
                          conditions.hasEditPermission;
                        const showSend =
                          baseVisible &&
                          !conditions.isReportProofer &&
                          conditions.hasEditPermission;

                        return (
                          <>
                            {showAuthorise && (
                              <Button
                                variant="contained"
                                size="small"
                                color="success"
                                onClick={handleAuthoriseReport}
                                disabled={authorisingReport || generatingPDF}
                                sx={{
                                  textTransform: "none",
                                  backgroundColor: "#4caf50",
                                  color: "white",
                                  "&:hover": {
                                    backgroundColor: "#45a049",
                                  },
                                }}
                              >
                                {authorisingReport
                                  ? "Authorising..."
                                  : "Authorise Report"}
                              </Button>
                            )}
                            {showSend && (
                              <Button
                                variant="outlined"
                                size="small"
                                color={
                                  conditions.alreadySentForAuthorisation
                                    ? "inherit"
                                    : "primary"
                                }
                                startIcon={<MailIcon />}
                                onClick={handleSendForAuthorisation}
                                disabled={sendingAuthorisation}
                                sx={{ textTransform: "none" }}
                              >
                                {sendingAuthorisation
                                  ? "Sending..."
                                  : conditions.alreadySentForAuthorisation
                                    ? "Re-send for Authorisation"
                                    : "Send for Authorisation"}
                              </Button>
                            )}
                          </>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
            </Box>
          </>
        )}
      </Box>

      <Dialog
        open={sampleDialogOpen}
        onClose={handleCloseSampleDialog}
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
              bgcolor: typeColors.color,
              color: "white",
            }}
          >
            {dialogMode === "edit" ? (
              <EditIcon sx={{ fontSize: 20 }} />
            ) : (
              <AddIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {dialogMode === "edit" ? "Edit Sample" : "Add Sample"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 3 }}>
            {sampleFormError &&
              !sampleFormError.toLowerCase().includes("sample id") &&
              !sampleFormError.toLowerCase().includes("sample location") && (
                <Typography variant="body2" color="error">
                  {sampleFormError}
                </Typography>
              )}
            <TextField
              label="Sample ID"
              value={sampleForm.sampleId}
              onChange={(e) => {
                setSampleForm((prev) => ({
                  ...prev,
                  sampleId: e.target.value,
                }));
                if (sampleFormError) setSampleFormError("");
              }}
              required
              error={sampleFormError.toLowerCase().includes("sample id")}
              helperText={
                sampleFormError.toLowerCase().includes("sample id")
                  ? sampleFormError
                  : undefined
              }
              fullWidth
            />
            <TextField
              label="Sample location"
              value={sampleForm.sampleLocation}
              onChange={(e) => {
                setSampleForm((prev) => ({
                  ...prev,
                  sampleLocation: e.target.value,
                }));
                if (sampleFormError) setSampleFormError("");
              }}
              required
              error={sampleFormError.toLowerCase().includes("sample location")}
              helperText={
                sampleFormError.toLowerCase().includes("sample location")
                  ? sampleFormError
                  : undefined
              }
              fullWidth
            />
            {isAirLike ? (
              <>
                <TextField
                  label="Flowrate (LPM)"
                  type="number"
                  value={sampleForm.flowRate}
                  onChange={(e) => {
                    setSampleForm((prev) => ({
                      ...prev,
                      flowRate: e.target.value,
                    }));
                    if (sampleFormError) setSampleFormError("");
                  }}
                  required
                  fullWidth
                  inputProps={{ min: 0, step: "any" }}
                />
                {isAirFungi && (
                  <FormControl>
                    <FormLabel required>
                      Was the sample taken for quality control?
                    </FormLabel>
                    <RadioGroup
                      row
                      value={sampleForm.qualityControl}
                      onChange={(e) => {
                        setSampleForm((prev) => ({
                          ...prev,
                          qualityControl: e.target.value,
                        }));
                        if (sampleFormError) setSampleFormError("");
                      }}
                    >
                      {YES_NO_OPTIONS.map((option) => (
                        <FormControlLabel
                          key={option}
                          value={option}
                          control={<Radio />}
                          label={option}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
              </>
            ) : (
              <FormControl>
                <FormLabel required>Cleaning Stage</FormLabel>
                <RadioGroup
                  row
                  value={sampleForm.cleaningStage}
                  onChange={(e) => {
                    setSampleForm((prev) => ({
                      ...prev,
                      cleaningStage: e.target.value,
                    }));
                    if (sampleFormError) setSampleFormError("");
                  }}
                >
                  {CLEANING_STAGES.map((stage) => (
                    <FormControlLabel
                      key={stage}
                      value={stage}
                      control={<Radio />}
                      label={stage}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={handleCloseSampleDialog} disabled={savingSample}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSampleDialog}
            disabled={savingSample}
            startIcon={
              savingSample ? (
                <CircularProgress size={16} color="inherit" />
              ) : null
            }
            sx={{
              backgroundColor: typeColors.color,
              "&:hover": {
                backgroundColor: typeColors.borderColor,
              },
            }}
          >
            {dialogMode === "edit" ? "Save Changes" : "Add Sample"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={completeDialogOpen}
        onClose={handleCloseCompleteDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}>
          Confirm Sampling Complete
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 2, pb: 1 }}>
          <Typography sx={{ mb: 2 }}>
            Confirm that all {sampleType} samples have been collected. Once
            confirmed, sampling will be locked and analysis can begin.
          </Typography>
          {completeDialogError && (
            <Typography variant="body2" color="error" sx={{ mb: 2 }}>
              {completeDialogError}
            </Typography>
          )}
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Sample Turnaround
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
            <Button
              variant={
                !showCustomTurnaround && turnaroundTime === "same day"
                  ? "contained"
                  : "outlined"
              }
              onClick={() => {
                setShowCustomTurnaround(false);
                setTurnaroundTime("same day");
                if (sampleDate) {
                  setAnalysisDueDate(sampleDate);
                }
              }}
              sx={{ textTransform: "none" }}
            >
              Same Day
            </Button>
            <Button
              variant={
                !showCustomTurnaround && turnaroundTime === "24 hours"
                  ? "contained"
                  : "outlined"
              }
              onClick={() => {
                setShowCustomTurnaround(false);
                setTurnaroundTime("24 hours");
                if (sampleDate) {
                  setAnalysisDueDate(
                    formatDateInput(addBusinessDays(new Date(sampleDate), 1)),
                  );
                }
              }}
              sx={{ textTransform: "none" }}
            >
              24 Hours
            </Button>
            <Button
              variant={showCustomTurnaround ? "contained" : "outlined"}
              onClick={() => {
                setShowCustomTurnaround(true);
                setTurnaroundTime("custom");
              }}
              sx={{ textTransform: "none" }}
            >
              Custom
            </Button>
          </Box>
          {(showCustomTurnaround || analysisDueDate) && (
            <TextField
              label="Analysis Due Date"
              type="date"
              value={analysisDueDate}
              onChange={(e) => setAnalysisDueDate(e.target.value)}
              disabled={!showCustomTurnaround}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button
            onClick={handleCloseCompleteDialog}
            disabled={completingSampling}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmSamplingComplete}
            disabled={completingSampling}
            startIcon={
              completingSampling ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircleIcon />
              )
            }
          >
            Confirm Sampling Complete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={reopenDialogOpen}
        onClose={() => !reopening && setReopenDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reopen Report for Editing?</DialogTitle>
        <DialogContent>
            {error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}
            <Typography sx={{ mb: 2 }}>
            This will reopen <strong>{sampleType}</strong> so sampling and
            analysis can be edited again.
          </Typography>
          <Typography variant="body2" color="text.secondary" component="div">
            If you continue:
            <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2.5 }}>
              <li>
                Sampling Complete and Analysis Finalised will be cleared
              </li>
              <li>
                Report authorisation will be cleared (including any pending
                authorisation request)
              </li>
              <li>
                If this report has been authorised, use Revise on the project
                reports page. This button cannot start a revision.
              </li>
              <li>Existing sample and analysis values will be kept</li>
            </Box>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setReopenDialogOpen(false)}
            disabled={reopening}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReopenReport}
            variant="contained"
            disabled={reopening}
            sx={{
              backgroundColor: "#f57c00",
              "&:hover": { backgroundColor: "#e65100" },
            }}
          >
            {reopening ? "Reopening..." : "Reopen Report"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MycometerSamples;
