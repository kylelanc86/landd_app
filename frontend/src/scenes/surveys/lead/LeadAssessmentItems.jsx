import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ListAltIcon from "@mui/icons-material/ListAlt";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import { useSnackbar } from "../../../context/SnackbarContext";
import { useAuth } from "../../../context/AuthContext";
import { generateLeadChainOfCustodyPDF } from "../../../utils/generateLeadChainOfCustodyPDF";

function getRiskLevelLabel(product) {
  if (product == null || product < 7) return "VERY LOW RISK";
  if (product <= 18) return "LOW RISK";
  if (product <= 35) return "MEDIUM RISK";
  return "HIGH RISK";
}

function getItemRisk(item) {
  const o = item.occupantRating;
  const l = item.locationRating;
  const u = item.roomUseRating;
  const c = item.conditionRating;
  if (o == null || o === "" || l == null || l === "" || u == null || u === "" || c == null || c === "") return null;
  const product = Number(o) * Number(l) * Number(u) * Number(c);
  return { product, label: getRiskLevelLabel(product) };
}

function riskChipDisplayLabel(label) {
  return String(label || "").replace(/\s+RISK$/i, "").trim() || "—";
}

function getRiskBadgeSx(riskLabel) {
  return {
    px: 1.5,
    py: 0.75,
    borderRadius: 1,
    display: "inline-block",
    fontWeight: 600,
    bgcolor:
      riskLabel === "HIGH RISK"
        ? "error.light"
        : riskLabel === "MEDIUM RISK"
          ? "yellow"
          : riskLabel === "LOW RISK"
            ? "info.light"
            : "success.light",
    color:
      riskLabel === "HIGH RISK"
        ? "error.contrastText"
        : riskLabel === "MEDIUM RISK"
          ? "grey.900"
          : riskLabel === "LOW RISK"
            ? "info.contrastText"
            : "success.contrastText",
  };
}

const SAMPLE_TYPES = [
  { key: "paint", label: "Paint samples" },
  { key: "paint-xrf", label: "Paint (XRF) samples" },
  { key: "dust", label: "Dust samples" },
  { key: "soil", label: "Soil samples" },
];

function isPaintLikeLeadSampleKey(key) {
  const k = String(key || "").toLowerCase();
  return k === "paint" || k === "paint-xrf";
}

/** Which tables to show — same rules as LeadAssessmentItemNew sample type options. */
function sampleTypesForAssessment(assessment) {
  if (assessment?.jobType !== "lead-assessment") {
    return [...SAMPLE_TYPES];
  }
  const raw = assessment?.assessmentType;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...SAMPLE_TYPES];
  }
  const lower = raw.map((t) => String(t).toLowerCase());
  return SAMPLE_TYPES.filter((opt) => lower.includes(opt.key));
}

// Column widths as percentages by sample type table.
// Adjust these values to customize each table layout independently.
const PAINT_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  paintColour: "12%",
  leadContent: "12%",
  status: "10%",
  description: "30%",
  risk: "12%",
  actions: "10%",
};

const DUST_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  description: "26%",
  leadContent: "12%",
  leadConcentration: "14%",
  status: "12%",
  risk: "8%",
  actions: "10%",
};

const SOIL_SAMPLE_TABLE_COLUMN_WIDTHS = {
  sampleReference: "14%",
  paintColour: "12%",
  description: "27%",
  leadContent: "12%",
  status: "16%",
  actions: "13%",
};

const TABLE_FONT_SIZE = "0.8rem";

const TURNAROUND_OPTIONS = [
  { value: "standard", label: "Standard (7 day)", days: 7 },
  { value: "3 day", label: "3 day", days: 3 },
  { value: "24 hours", label: "24 hours", days: 1 },
  { value: "same day", label: "Same day", days: 0 },
];

function getCocAnalysisRequiredByLabel(turnaroundValue) {
  const key = String(turnaroundValue || "").toLowerCase().trim();
  const mapping = {
    standard: "7 days",
    "7 day": "7 days",
    "7 days": "7 days",
    "3 day": "3 days",
    "3 days": "3 days",
    "3-day": "3 days",
    "24 hours": "24hr",
    "24 hour": "24hr",
    "24hr": "24hr",
    "same day": "same day",
    "same-day": "same day",
  };
  return mapping[key] || turnaroundValue || "—";
}

function getAnalysisDueDateFromTurnaround(turnaroundValue) {
  const opt = TURNAROUND_OPTIONS.find((x) => x.value === turnaroundValue);
  if (!opt) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + opt.days);
  return d;
}

/** Stored assessment PDF may be a data URL or raw base64. */
function fibreAnalysisReportToPdfSrc(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("data:")) return s;
  return `data:application/pdf;base64,${s}`;
}

function itemsForType(items, typeKey) {
  const lower = typeKey.toLowerCase();
  return items.filter((item) => (item.materialType || "").toLowerCase() === lower);
}

function rowsForType(items, typeKey) {
  const baseItems = itemsForType(items, typeKey);
  const rows = [];

  baseItems.forEach((item) => {
    rows.push({ kind: "primary", item });
    (item.referredLocations || []).forEach((referred, idx) => {
      rows.push({ kind: "referred", item, referred, referredIndex: idx });
    });
  });

  return rows;
}

function emptyLeadScopeRow() {
  return { roomArea: "", locations: "" };
}

/** Section titles in the scope modal — strip trailing "samples" from tab labels. */
function leadScopeModalSectionHeading(label) {
  return String(label || "")
    .replace(/\s+samples$/i, "")
    .trim();
}

/** Build editable draft for Scope modal from persisted `leadAssessmentScope`. */
function buildLeadScopeDraftFromAssessment(assessment, visibleTypes) {
  const stored = assessment?.leadAssessmentScope;
  const obj = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  const draft = {};
  visibleTypes.forEach(({ key }) => {
    const arr = obj[key];
    const isSoil = key === "soil";
    if (Array.isArray(arr) && arr.length > 0) {
      draft[key] = arr.map((r) =>
        isSoil
          ? {
              roomArea: "",
              locations: r?.locations != null ? String(r.locations) : "",
            }
          : {
              roomArea: r?.roomArea != null ? String(r.roomArea) : "",
              locations: r?.locations != null ? String(r.locations) : "",
            },
      );
    } else {
      draft[key] = [emptyLeadScopeRow()];
    }
  });
  return draft;
}

function sanitizeLeadScopeForSave(draft) {
  if (!draft || typeof draft !== "object") return {};
  const out = {};
  Object.keys(draft).forEach((key) => {
    const isSoil = key === "soil";
    out[key] = (draft[key] || [])
      .map((r) => ({
        roomArea: isSoil ? "" : String(r?.roomArea ?? "").trim(),
        locations: String(r?.locations ?? "").trim(),
      }))
      .filter((r) => (isSoil ? r.locations : r.roomArea || r.locations));
  });
  return out;
}

function parseLeadPercent(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function getLeadPaintStatus(leadContent) {
  const pct = parseLeadPercent(leadContent);
  if (pct == null) return null;
  if (pct > 0.1) return { label: "Lead paint", isLeadPaint: true };
  return { label: "Lead-free", isLeadPaint: false };
}

function parseSoilAssessmentCriteriaThreshold(assessmentCriteria) {
  if (!assessmentCriteria) return null;
  const match = String(assessmentCriteria).match(/\(([\d.]+)\s*mg\/kg\)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getSoilStatus(leadContent, assessmentCriteria) {
  const contentValue = parseLeadPercent(leadContent);
  const threshold = parseSoilAssessmentCriteriaThreshold(assessmentCriteria);
  if (contentValue == null || threshold == null) return null;
  const exceeds = contentValue >= threshold;
  return {
    exceeds,
    label: exceeds ? "Exceedance" : "No exceedance",
  };
}

function getSampleAreaM2(sampleArea) {
  if (sampleArea == null || sampleArea === "") return null;
  const s = String(sampleArea).toLowerCase().trim();
  if (s === "small" || s.includes("0.01")) return 0.01;
  if (s === "medium" || s.includes("0.0258")) return 0.0258;
  if (s === "large" || s.includes("0.09")) return 0.09;
  const numeric = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatDustLeadConcentrationMgM2(leadContentUg, sampleArea) {
  const mgPerM2 = calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea);
  if (mgPerM2 == null) return "—";
  return `${mgPerM2.toFixed(4)} mg/m²`;
}

function calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea) {
  const ug = parseLeadPercent(leadContentUg);
  const areaM2 = getSampleAreaM2(sampleArea);
  if (ug == null || areaM2 == null || areaM2 <= 0) return null;
  return (ug / 1000) / areaM2;
}

function getDustExceedanceStatus(locationRating, leadContentUg, sampleArea) {
  const concentration = calculateDustLeadConcentrationMgM2(leadContentUg, sampleArea);
  if (concentration == null) return null;

  const rating = Number(locationRating);
  const thresholdByRating = {
    1: 1.08, // High-level/inaccessible surface
    2: 0.43, // Low contact surface
    3: 0.11, // High contact surface
  };
  const threshold = thresholdByRating[rating];
  if (threshold == null) return null;

  const exceeds = concentration >= threshold;
  return {
    exceeds,
    label: exceeds ? "Exceedance" : "No exceedence",
  };
}

function getLeadContentUnit(materialType) {
  const type = String(materialType || "").toLowerCase();
  if (type === "paint" || type === "paint-xrf") return "%";
  if (type === "dust") return "μg";
  if (type === "soil") return "mg/kg";
  return "";
}

/** When level/floor is set, show "{level} - {roomArea}"; otherwise room/area only. */
function formatRoomAreaWithLevel(levelFloor, roomArea) {
  const level = (levelFloor || "").trim();
  const room = (roomArea || "").trim();
  if (level && room) return `${level} - ${room}`;
  if (level) return level;
  if (room) return room;
  return "—";
}

const LeadAssessmentItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const [assessment, setAssessment] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [leadContentDrafts, setLeadContentDrafts] = useState({});
  const [samplingCompleteDialogOpen, setSamplingCompleteDialogOpen] = useState(false);
  const [submitLabDialogOpen, setSubmitLabDialogOpen] = useState(false);
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisTurnaroundType, setAnalysisTurnaroundType] = useState("");
  const [submittedBySignature, setSubmittedBySignature] = useState("");
  const [analysisFile, setAnalysisFile] = useState(null);
  const [deleteAnalysisConfirmOpen, setDeleteAnalysisConfirmOpen] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [activeSampleTab, setActiveSampleTab] = useState("paint");
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [leadScopeDraft, setLeadScopeDraft] = useState(null);
  const [savingLeadScope, setSavingLeadScope] = useState(false);

  const applyAssessmentPayload = useCallback((data) => {
    setAssessment(data);
    setItems(Array.isArray(data?.items) ? data.items : []);
  }, []);

  const fetchAssessment = useCallback(async () => {
    if (!id) return;
    try {
      const response = await asbestosAssessmentService.getById(id);
      const data = response?.data || response;
      applyAssessmentPayload(data);
    } catch (err) {
      setAssessment(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [id, applyAssessmentPayload]);

  /** Refresh assessment/items without toggling loading (tab focus, after delete). */
  const refetchAssessmentQuiet = useCallback(async () => {
    if (!id) return;
    try {
      const response = await asbestosAssessmentService.getById(id);
      const data = response?.data || response;
      applyAssessmentPayload(data);
    } catch {
      /* keep existing state */
    }
  }, [id, applyAssessmentPayload]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAssessment();
  }, [id, location.key, fetchAssessment]);

  useEffect(() => {
    if (!id) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refetchAssessmentQuiet();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [id, refetchAssessmentQuiet]);

  useEffect(() => {
    if (location.state?.openAttachAnalysis) {
      setAnalysisDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const nextDrafts = {};
    items.forEach((item) => {
      nextDrafts[item._id] = item.leadContent ?? "";
    });
    setLeadContentDrafts(nextDrafts);
  }, [items]);

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!id || !itemToDelete?._id) return;
    setDeleteLoading(true);
    try {
      await asbestosAssessmentService.deleteItem(id, itemToDelete._id);
      showSnackbar("Assessment item deleted.", "success");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      await refetchAssessmentQuiet();
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to delete item", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const handleLeadContentChange = (itemId, value) => {
    setLeadContentDrafts((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleLeadContentSave = async (item) => {
    if (!id || !item?._id) return;
    const currentValue = item.leadContent ?? "";
    const nextValue = (leadContentDrafts[item._id] ?? "").trim();
    if (nextValue === currentValue) return;

    const itemType = String(item.materialType || "").toLowerCase();
    const derivedStatus =
      itemType === "paint" || itemType === "paint-xrf"
        ? getLeadPaintStatus(nextValue)
        : itemType === "soil"
          ? getSoilStatus(nextValue, item.paintColour)
          : itemType === "dust"
            ? getDustExceedanceStatus(item.locationRating, nextValue, item.leadSampleArea)
            : null;
    try {
      await asbestosAssessmentService.updateItem(id, item._id, {
        leadContent: nextValue || "",
        status: derivedStatus?.label || "",
      });
      setItems((prev) =>
        prev.map((x) =>
          x._id === item._id
            ? { ...x, leadContent: nextValue || "", status: derivedStatus?.label || "" }
            : x,
        ),
      );
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to update lead content", "error");
      setLeadContentDrafts((prev) => ({ ...prev, [item._id]: currentValue }));
    }
  };

  const handleLeadContentCancel = (item) => {
    setLeadContentDrafts((prev) => ({ ...prev, [item._id]: item.leadContent ?? "" }));
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSamplingComplete = async () => {
    const dueDate = getAnalysisDueDateFromTurnaround(analysisTurnaroundType);
    if (!dueDate) {
      showSnackbar("Please select an analysis turnaround option", "warning");
      return;
    }
    try {
      setSavingWorkflow(true);
      await asbestosAssessmentService.update(id, {
        projectId: assessment?.projectId?._id || assessment?.projectId,
        assessmentDate: assessment?.assessmentDate,
        status: "site-works-complete",
        turnaroundTime: analysisTurnaroundType,
        analysisDueDate: dueDate.toISOString(),
      });
      await refetchAssessmentQuiet();
      setSamplingCompleteDialogOpen(false);
      showSnackbar("Sampling marked complete.", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to complete sampling", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleSubmitSamplesToLab = async () => {
    const fallbackUserName = currentUser
      ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
      : "";
    const signature = String(submittedBySignature || fallbackUserName || "").trim();
    if (!signature) {
      showSnackbar("Please enter submitted by name", "warning");
      return;
    }
    try {
      setSavingWorkflow(true);
      await asbestosAssessmentService.update(id, {
        projectId: assessment?.projectId?._id || assessment?.projectId,
        assessmentDate: assessment?.assessmentDate,
        status: "samples-with-lab",
        labSamplesStatus: "samples-in-lab",
        samplesReceivedDate: new Date().toISOString(),
        submittedBy: signature,
      });
      await refetchAssessmentQuiet();
      setSubmitLabDialogOpen(false);
      showSnackbar("Samples marked as submitted to lab.", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to submit samples", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleViewChainOfCustody = async () => {
    try {
      if (!assessment?.turnaroundTime) {
        showSnackbar("Analysis turnaround is not set yet.", "warning");
        return;
      }
      const turnaroundDate = assessment?.analysisDueDate
        ? new Date(assessment.analysisDueDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const samples = (items || [])
        .filter((item) =>
          ["paint", "paint-xrf", "dust", "soil"].includes(String(item.materialType || "").toLowerCase()),
        )
        .map((item) => {
          const st = String(item.materialType || "").toLowerCase();
          return {
            fullSampleID: item.sampleReference || "—",
            sampleType: st === "paint-xrf" ? "paint" : st,
          };
        });
      await generateLeadChainOfCustodyPDF({
        shift: { date: assessment?.assessmentDate },
        samples,
        confirmedBy: currentUser
          ? {
              firstName: currentUser.firstName,
              lastName: currentUser.lastName,
              email: currentUser.email,
              signature: currentUser.signature,
            }
          : null,
        analysisTurnaroundDate: turnaroundDate,
        analysisTurnaroundLabel: getCocAnalysisRequiredByLabel(assessment?.turnaroundTime),
        confirmedAt: new Date(),
        projectID: assessment?.projectId?.projectID,
        openInNewTab: true,
      });
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to generate Chain of Custody", "error");
    }
  };

  const closeAnalysisDialog = () => {
    setAnalysisDialogOpen(false);
    setAnalysisFile(null);
    setDeleteAnalysisConfirmOpen(false);
  };

  const handleSaveAnalysisAndLeadContent = async () => {
    const uploadedNewAnalysisFile = !!analysisFile;
    try {
      setSavingWorkflow(true);
      if (analysisFile) {
        const reportData = await fileToDataUrl(analysisFile);
        await asbestosAssessmentService.uploadFibreAnalysisReport(id, reportData);
      }
      for (const item of items) {
        const nextValue = String(leadContentDrafts[item._id] ?? "").trim();
        if (nextValue === String(item.leadContent ?? "").trim()) continue;
        const itemType = String(item.materialType || "").toLowerCase();
        const derivedStatus =
          itemType === "paint" || itemType === "paint-xrf"
            ? getLeadPaintStatus(nextValue)
            : itemType === "soil"
              ? getSoilStatus(nextValue, item.paintColour)
              : itemType === "dust"
                ? getDustExceedanceStatus(item.locationRating, nextValue, item.leadSampleArea)
                : null;
        await asbestosAssessmentService.updateItem(id, item._id, {
          leadContent: nextValue || "",
          status: derivedStatus?.label || "",
        });
      }

      const allLeadContentEntered = items.every(
        (x) => String(leadContentDrafts[x._id] ?? x.leadContent ?? "").trim() !== "",
      );
      if (uploadedNewAnalysisFile) {
        await asbestosAssessmentService.update(id, {
          projectId: assessment?.projectId?._id || assessment?.projectId,
          assessmentDate: assessment?.assessmentDate,
          status: allLeadContentEntered ? "report-ready-for-review" : "sample-analysis-complete",
        });
      }
      await refetchAssessmentQuiet();
      closeAnalysisDialog();
      showSnackbar(
        uploadedNewAnalysisFile
          ? allLeadContentEntered
            ? "Analysis report attached and lead content saved."
            : "Analysis report attached. Some lead content is still missing."
          : "Lead content saved.",
        "success",
      );
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to save analysis results", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleConfirmDeleteAnalysisReport = async () => {
    if (!id) return;
    try {
      setSavingWorkflow(true);
      await asbestosAssessmentService.deleteFibreAnalysisReport(id);
      await refetchAssessmentQuiet();
      setDeleteAnalysisConfirmOpen(false);
      setAnalysisFile(null);
      showSnackbar("Analysis report removed.", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to remove analysis report", "error");
    } finally {
      setSavingWorkflow(false);
    }
  };

  const projectID = assessment?.projectId?.projectID ?? null;
  const projectName = assessment?.projectId?.name ?? null;

  const visibleSampleTypes = useMemo(
    () => sampleTypesForAssessment(assessment),
    [assessment],
  );

  const openLeadScopeModal = useCallback(() => {
    if (!assessment) return;
    const types = sampleTypesForAssessment(assessment);
    setLeadScopeDraft(buildLeadScopeDraftFromAssessment(assessment, types));
    setScopeModalOpen(true);
  }, [assessment]);

  const closeLeadScopeModal = useCallback(() => {
    setScopeModalOpen(false);
    setLeadScopeDraft(null);
  }, []);

  const handleLeadScopeFieldChange = useCallback((typeKey, rowIndex, field, value) => {
    setLeadScopeDraft((prev) => {
      if (!prev) return prev;
      const rows = [...(prev[typeKey] || [])];
      if (!rows[rowIndex]) return prev;
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return { ...prev, [typeKey]: rows };
    });
  }, []);

  const handleAddLeadScopeRow = useCallback((typeKey) => {
    setLeadScopeDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, [typeKey]: [...(prev[typeKey] || []), emptyLeadScopeRow()] };
    });
  }, []);

  const handleRemoveLeadScopeRow = useCallback((typeKey, rowIndex) => {
    setLeadScopeDraft((prev) => {
      if (!prev) return prev;
      const rows = (prev[typeKey] || []).filter((_, i) => i !== rowIndex);
      return { ...prev, [typeKey]: rows };
    });
  }, []);

  const handleSaveLeadScope = useCallback(async () => {
    if (!id || !assessment || !leadScopeDraft) return;
    setSavingLeadScope(true);
    try {
      const leadAssessmentScope = sanitizeLeadScopeForSave(leadScopeDraft);
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        status: assessment.status,
        leadAssessmentScope,
      });
      showSnackbar("Assessment scope saved.", "success");
      closeLeadScopeModal();
      await refetchAssessmentQuiet();
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to save assessment scope", "error");
    } finally {
      setSavingLeadScope(false);
    }
  }, [id, assessment, leadScopeDraft, closeLeadScopeModal, refetchAssessmentQuiet, showSnackbar]);

  useEffect(() => {
    if (visibleSampleTypes.length === 0) return;
    const keys = visibleSampleTypes.map((t) => t.key);
    setActiveSampleTab((prev) => (keys.includes(prev) ? prev : keys[0]));
  }, [visibleSampleTypes]);

  const isLeadJob = assessment?.jobType === "lead-assessment";
  const hasConfiguredLeadScope =
    isLeadJob &&
    Array.isArray(assessment?.assessmentType) &&
    assessment.assessmentType.length > 0;
  /** Lead jobs: open analysis dialog from lab submission onward (includes after report is removed). */
  const canOpenLeadAnalysisDialog = useMemo(() => {
    const status = String(assessment?.status || "").toLowerCase();
    return ["samples-with-lab", "sample-analysis-complete", "report-ready-for-review", "complete"].includes(status);
  }, [assessment?.status]);

  const hasAttachedAnalysisReport = useMemo(() => {
    const raw = assessment?.fibreAnalysisReport;
    return typeof raw === "string" && raw.trim().length > 0;
  }, [assessment?.fibreAnalysisReport]);

  const replacePreviewUrl = useMemo(() => {
    if (!analysisFile) return null;
    return URL.createObjectURL(analysisFile);
  }, [analysisFile]);

  useEffect(() => {
    return () => {
      if (replacePreviewUrl) URL.revokeObjectURL(replacePreviewUrl);
    };
  }, [replacePreviewUrl]);

  const analysisPdfSrc = useMemo(() => {
    if (replacePreviewUrl) return replacePreviewUrl;
    return hasAttachedAnalysisReport ? fibreAnalysisReportToPdfSrc(assessment.fibreAnalysisReport) : null;
  }, [replacePreviewUrl, hasAttachedAnalysisReport, assessment?.fibreAnalysisReport]);

  const showAddAssessmentItem = !loading && assessment?.jobType === "lead-assessment";

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/surveys/lead")}
        sx={{ mb: 2 }}
      >
        Back to Lead Assessment
      </Button>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Lead Assessment Items
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body1" color="text.secondary">
                Loading…
              </Typography>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary">
              {projectID != null || projectName != null ? (
                <>
                  {projectID != null && (
                    <Typography component="span" variant="body1" fontWeight="medium">
                      {projectID}
                      {projectName != null ? " – " : ""}
                    </Typography>
                  )}
                  {projectName != null && projectName}
                </>
              ) : (
                "Project details unavailable"
              )}
            </Typography>
          )}
        </Box>
        {!loading && assessment?.jobType === "lead-assessment" && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {assessment?.status === "in-progress" && items.length > 0 && (
              <Button
                variant="contained"
                color="info"
                onClick={() => setSamplingCompleteDialogOpen(true)}
              >
                Sampling Complete
              </Button>
            )}
            {["site-works-complete", "samples-with-lab", "sample-analysis-complete", "report-ready-for-review", "complete"].includes(assessment?.status) && (
              <Button variant="outlined" onClick={handleViewChainOfCustody}>
                Chain of Custody
              </Button>
            )}
            {assessment?.status === "site-works-complete" && (
              <Button
                variant="contained"
                onClick={() => {
                  const userName = currentUser
                    ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
                    : "";
                  setSubmittedBySignature(userName);
                  setSubmitLabDialogOpen(true);
                }}
                sx={{
                  backgroundColor: "#ED8712",
                  color: "#fff",
                  "&:hover": { backgroundColor: "#d47610" },
                }}
              >
                Submit Samples to Lab
              </Button>
            )}
            {canOpenLeadAnalysisDialog && (
              <Button
                variant="contained"
                onClick={() => setAnalysisDialogOpen(true)}
                sx={{
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  "&:hover": { backgroundColor: "#1565c0" },
                }}
              >
                {hasAttachedAnalysisReport ? "View/Edit Analysis Content" : "Attach Analysis"}
              </Button>
            )}
          </Stack>
        )}
      </Box>

      {showAddAssessmentItem && (
        <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/surveys/lead/${id}/items/new`)}
            sx={{
              backgroundColor: "#9c27b0",
              color: "white",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Add Assessment Item
          </Button>
          <Button
            variant="outlined"
            startIcon={<ListAltIcon />}
            onClick={openLeadScopeModal}
            sx={{ textTransform: "none" }}
            title="Outline planned assessment areas (rooms and locations) by assessment type"
          >
            Scope
          </Button>
        </Stack>
      )}

      {loading ? null : isLeadJob && hasConfiguredLeadScope && visibleSampleTypes.length === 0 ? (
        <Alert severity="info" sx={{ mt: showAddAssessmentItem ? 0 : 2 }}>
          No sample types match this job&apos;s scope. Update the assessment types on the job (e.g. Paint, Dust, Soil), then save — tables refresh when you return here or refocus this tab.
        </Alert>
      ) : visibleSampleTypes.length === 0 ? null : (
        <Box sx={{ mt: showAddAssessmentItem ? 0 : 2 }}>
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "background.paper",
            }}
          >
            <Box
              sx={{
                px: 1,
                pt: 1,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "grey.900" : "grey.100",
                borderBottom: 1,
                borderColor: "divider",
              }}
            >
              <Tabs
                value={activeSampleTab}
                onChange={(_, value) => setActiveSampleTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{
                  minHeight: 44,
                  "& .MuiTabs-flexContainer": {
                    alignItems: "flex-end",
                    gap: 0.5,
                  },
                  "& .MuiTabs-indicator": {
                    display: "none",
                  },
                  "& .MuiTab-root": {
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    letterSpacing: "0.01em",
                    minHeight: 40,
                    py: 1.25,
                    px: 2.25,
                    borderRadius: "10px 10px 0 0",
                    border: "1px solid transparent",
                    borderBottom: "none",
                    bgcolor: "transparent",
                    color: "text.secondary",
                    opacity: 1,
                    transition: (theme) =>
                      theme.transitions.create(
                        ["background-color", "color", "border-color", "box-shadow"],
                        { duration: theme.transitions.duration.shorter },
                      ),
                    "&:hover": {
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "action.hover"
                          : "rgba(0, 0, 0, 0.06)",
                      color: "text.primary",
                    },
                    "&.Mui-selected": {
                      bgcolor: "background.paper",
                      color: "primary.main",
                      borderColor: "divider",
                      borderBottom: "1px solid",
                      borderBottomColor: "background.paper",
                      boxShadow: (theme) =>
                        theme.palette.mode === "dark"
                          ? "0 -1px 0 0 rgba(255,255,255,0.12) inset"
                          : "0 1px 0 0 rgba(0,0,0,0.04)",
                      mb: "-1px",
                      zIndex: 1,
                    },
                  },
                  "& .MuiTabScrollButton-root": {
                    color: "text.secondary",
                  },
                }}
                aria-label="Sample type tables"
              >
                {visibleSampleTypes.map(({ key, label }) => (
                  <Tab
                    key={key}
                    label={label}
                    value={key}
                    id={`lead-items-tab-${key}`}
                    aria-controls={`lead-items-panel-${key}`}
                  />
                ))}
              </Tabs>
            </Box>
            <Box sx={{ bgcolor: "background.paper" }}>
          {visibleSampleTypes.map(({ key: typeKey }) => {
            if (typeKey !== activeSampleTab) return null;
            const typeRows = rowsForType(items, typeKey);
            const isPaintTable = isPaintLikeLeadSampleKey(typeKey);
            const isDustTable = typeKey === "dust";
            const isSoilTable = typeKey === "soil";
            const columnWidths = isPaintTable
              ? PAINT_SAMPLE_TABLE_COLUMN_WIDTHS
              : typeKey === "dust"
                ? DUST_SAMPLE_TABLE_COLUMN_WIDTHS
                : SOIL_SAMPLE_TABLE_COLUMN_WIDTHS;
            return (
              <Box
                key={typeKey}
                role="tabpanel"
                id={`lead-items-panel-${typeKey}`}
                aria-labelledby={`lead-items-tab-${typeKey}`}
              >
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{
                    boxShadow: "none",
                    border: 0,
                    borderRadius: 0,
                  }}
                >
                  <Table
                    size="small"
                    stickyHeader
                    sx={{
                      "& .MuiTableCell-root": {
                        fontSize: TABLE_FONT_SIZE,
                      },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                        <TableCell sx={{ fontWeight: "bold", width: columnWidths.sampleReference, fontSize: TABLE_FONT_SIZE }}>Sample reference</TableCell>
                        {!isDustTable && (
                          <TableCell sx={{ fontWeight: "bold", width: columnWidths.paintColour, fontSize: TABLE_FONT_SIZE }}>
                            {isSoilTable ? "Assessment Criteria" : "Paint colour"}
                          </TableCell>
                        )}
                        <TableCell sx={{ fontWeight: "bold", width: columnWidths.description, fontSize: TABLE_FONT_SIZE }}>Description</TableCell>
                        {isPaintTable && (
                          <>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>Lead content</TableCell>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>Status</TableCell>
                          </>
                        )}
                        {isDustTable && (
                          <>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>Lead content</TableCell>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadConcentration, fontSize: TABLE_FONT_SIZE }}>Concentration <br></br> (mg/m²)</TableCell>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>Status</TableCell>
                          </>
                        )}
                        {isSoilTable && (
                          <>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>Lead content</TableCell>
                            <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>Status</TableCell>
                          </>
                        )}
                        {!isSoilTable && (
                          <TableCell sx={{ fontWeight: "bold", width: columnWidths.risk, fontSize: TABLE_FONT_SIZE }}>Risk</TableCell>
                        )}
                        <TableCell sx={{ fontWeight: "bold", width: columnWidths.actions, fontSize: TABLE_FONT_SIZE }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {typeRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isPaintTable || isDustTable ? 7 : 6} align="center" sx={{ color: "text.secondary", py: 2 }}>
                            No samples in assessment.
                          </TableCell>
                        </TableRow>
                      ) : (
                        typeRows.map((row) => {
                          const isReferred = row.kind === "referred";
                          const current = isReferred ? row.referred : row.item;
                          const effectiveLeadContent = isReferred
                            ? row.item?.leadContent
                            : leadContentDrafts[row.item._id] ?? row.item?.leadContent;
                          const risk = getItemRisk(current);
                          const leadStatus = getLeadPaintStatus(effectiveLeadContent);
                          const isLeadContentDirty = String(leadContentDrafts[row.item._id] ?? "") !== String(row.item.leadContent ?? "");
                          const dustStatus = isDustTable
                            ? getDustExceedanceStatus(
                                current?.locationRating,
                                leadContentDrafts[row.item._id] ?? row.item.leadContent,
                                row.item.leadSampleArea,
                              )
                            : null;
                          const soilStatus = isSoilTable
                            ? getSoilStatus(
                                leadContentDrafts[row.item._id] ?? row.item.leadContent,
                                row.item.paintColour,
                              )
                            : null;
                          const rowKey = isReferred
                            ? `${row.item._id}-ref-${row.referredIndex}`
                            : row.item._id;
                          return (
                            <TableRow key={rowKey} hover>
                              <TableCell>
                                {isReferred
                                  ? `Refer to ${row.item.sampleReference ?? "—"}`
                                  : row.item.sampleReference ?? "—"}
                              </TableCell>
                              {!isDustTable && <TableCell>{row.item.paintColour ?? "—"}</TableCell>}
                              <TableCell>
                                {isSoilTable ? (
                                  <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
                                    {isReferred ? current?.surfaceDescription ?? "—" : row.item.locationDescription ?? "—"}
                                  </Typography>
                                ) : (
                                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                    <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
                                      {formatRoomAreaWithLevel(current?.levelFloor, current?.roomArea)}
                                    </Typography>
                                    <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
                                      {isReferred ? current?.surfaceDescription ?? "—" : row.item.locationDescription ?? "—"}
                                    </Typography>
                                  </Box>
                                )}
                              </TableCell>
                              {isDustTable && (
                                <>
                                  <TableCell>
                                    {isReferred ? (
                                      row.item.leadContent ?? "—"
                                    ) : (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <TextField
                                          size="small"
                                          value={leadContentDrafts[row.item._id] ?? ""}
                                          autoComplete="off"
                                          onChange={(e) => handleLeadContentChange(row.item._id, e.target.value)}
                                          InputProps={{
                                            endAdornment: (
                                              <InputAdornment
                                                position="end"
                                                sx={{
                                                  ml: 0.25,
                                                  "& .MuiTypography-root": {
                                                    fontSize: "0.8rem",
                                                    lineHeight: 1,
                                                  },
                                                }}
                                              >
                                                μg
                                              </InputAdornment>
                                            ),
                                          }}
                                          inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                                          sx={{ width: 80 }}
                                        />
                                        {isLeadContentDirty && (
                                          <>
                                            <IconButton
                                              size="small"
                                              color="success"
                                              aria-label="Save lead content"
                                              onClick={() => handleLeadContentSave(row.item)}
                                            >
                                              <CheckIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="inherit"
                                              aria-label="Cancel lead content"
                                              onClick={() => handleLeadContentCancel(row.item)}
                                            >
                                              <CloseIcon fontSize="small" />
                                            </IconButton>
                                          </>
                                        )}
                                      </Box>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {formatDustLeadConcentrationMgM2(
                                      leadContentDrafts[row.item._id] ?? row.item.leadContent,
                                      row.item.leadSampleArea,
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {!dustStatus ? "—" : (
                                      <Box
                                        sx={{
                                          px: 1.25,
                                          py: 0.5,
                                          borderRadius: 1,
                                          display: "inline-block",
                                          bgcolor: dustStatus.exceeds ? "error.main" : "success.main",
                                          color: dustStatus.exceeds ? "error.contrastText" : "success.contrastText",
                                          fontWeight: 600,
                                          fontSize: TABLE_FONT_SIZE,
                                        }}
                                      >
                                        {dustStatus.label}
                                      </Box>
                                    )}
                                  </TableCell>
                                </>
                              )}
                              {isPaintTable && (
                                <>
                                  <TableCell>
                                    {isReferred ? (
                                      row.item.leadContent ?? "—"
                                    ) : (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <TextField
                                          size="small"
                                          value={leadContentDrafts[row.item._id] ?? ""}
                                          onChange={(e) => handleLeadContentChange(row.item._id, e.target.value)}
                                          InputProps={{
                                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                          }}
                                          inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                                          sx={{ width: 75 }}
                                        />
                                        {isLeadContentDirty && (
                                          <>
                                            <IconButton
                                              size="small"
                                              color="success"
                                              aria-label="Save lead content"
                                              onClick={() => handleLeadContentSave(row.item)}
                                            >
                                              <CheckIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="inherit"
                                              aria-label="Cancel lead content"
                                              onClick={() => handleLeadContentCancel(row.item)}
                                            >
                                              <CloseIcon fontSize="small" />
                                            </IconButton>
                                          </>
                                        )}
                                      </Box>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {leadStatus == null ? (
                                      "—"
                                    ) : leadStatus.isLeadPaint ? (
                                      <Box
                                        sx={{
                                          px: 1.25,
                                          py: 0.5,
                                          borderRadius: 1,
                                          display: "inline-block",
                                          bgcolor: "error.main",
                                          color: "error.contrastText",
                                          fontWeight: 600,
                                          fontSize: TABLE_FONT_SIZE,
                                        }}
                                      >
                                        {leadStatus.label}
                                      </Box>
                                    ) : (
                                      leadStatus.label
                                    )}
                                  </TableCell>
                                </>
                              )}
                              {isSoilTable && (
                                <>
                                  <TableCell>
                                    {isReferred ? (
                                      row.item.leadContent ?? "—"
                                    ) : (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                        <TextField
                                          size="small"
                                          value={leadContentDrafts[row.item._id] ?? ""}
                                          onChange={(e) => handleLeadContentChange(row.item._id, e.target.value)}
                                          InputProps={{
                                            endAdornment: (
                                              <InputAdornment
                                                position="end"
                                                sx={{
                                                  ml: 0.25,
                                                  "& .MuiTypography-root": {
                                                    fontSize: "0.8rem",
                                                    lineHeight: 1,
                                                  },
                                                }}
                                              >
                                                mg/kg
                                              </InputAdornment>
                                            ),
                                          }}
                                          inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                                          sx={{ width: 124 }}
                                        />
                                        {isLeadContentDirty && (
                                          <>
                                            <IconButton
                                              size="small"
                                              color="success"
                                              aria-label="Save lead content"
                                              onClick={() => handleLeadContentSave(row.item)}
                                            >
                                              <CheckIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="inherit"
                                              aria-label="Cancel lead content"
                                              onClick={() => handleLeadContentCancel(row.item)}
                                            >
                                              <CloseIcon fontSize="small" />
                                            </IconButton>
                                          </>
                                        )}
                                      </Box>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {!soilStatus ? "—" : (
                                      <Box
                                        sx={{
                                          px: 1.25,
                                          py: 0.5,
                                          borderRadius: 1,
                                          display: "inline-block",
                                          bgcolor: soilStatus.exceeds ? "error.main" : "success.main",
                                          color: soilStatus.exceeds ? "error.contrastText" : "success.contrastText",
                                          fontWeight: 600,
                                          fontSize: TABLE_FONT_SIZE,
                                        }}
                                      >
                                        {soilStatus.label}
                                      </Box>
                                    )}
                                  </TableCell>
                                </>
                              )}
                              {!isSoilTable && (
                                <TableCell>
                                  {((isPaintTable && leadStatus && !leadStatus.isLeadPaint) ||
                                    (isDustTable && dustStatus && !dustStatus.exceeds)) ? (
                                    "None"
                                  ) : risk ? (
                                    <Box sx={{ ...getRiskBadgeSx(risk.label), fontSize: TABLE_FONT_SIZE }}>
                                      {riskChipDisplayLabel(risk.label)}
                                    </Box>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                              )}
                              <TableCell>
                                {isReferred ? (
                                  "—"
                                ) : (
                                  <>
                                    <IconButton
                                      size="small"
                                      aria-label="Edit item"
                                      onClick={() => navigate(`/surveys/lead/${id}/items/${row.item._id}/edit`)}
                                    >
                                      <EditIcon />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      aria-label="Delete item"
                                      onClick={() => handleDeleteClick(row.item)}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          })}
            </Box>
          </Box>
        </Box>
      )}

      <Dialog open={scopeModalOpen} onClose={closeLeadScopeModal} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle>Assessment scope</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Outline the rooms, areas, and locations to be included in this assessment for each assessment type. This is separate from assessment items below; it can be used in reporting.
          </Typography>
          {visibleSampleTypes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No assessment types are configured for this job. Set paint, dust, and/or soil on the assessment, then return here.
            </Typography>
          ) : (
            leadScopeDraft &&
            visibleSampleTypes.map(({ key: typeKey, label }, idx) => {
              const rows = leadScopeDraft[typeKey] || [];
              const isSoilScope = typeKey === "soil";
              const emptyColSpan = isSoilScope ? 2 : 3;
              return (
                <Box key={typeKey} sx={{ mb: idx < visibleSampleTypes.length - 1 ? 3 : 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    {leadScopeModalSectionHeading(label)}
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" sx={{ "& .MuiTableCell-root": { fontSize: TABLE_FONT_SIZE } }}>
                      <TableHead>
                        <TableRow>
                          {!isSoilScope && (
                            <TableCell sx={{ fontWeight: "bold", width: "32%" }}>Room/Area</TableCell>
                          )}
                          <TableCell sx={{ fontWeight: "bold" }}>Location(s)</TableCell>
                          <TableCell sx={{ fontWeight: "bold", width: 48 }} align="right" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={emptyColSpan} align="center" sx={{ color: "text.secondary", py: 2 }}>
                              No rows yet. Use &quot;Add row&quot; to outline areas for this type.
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((row, rowIndex) => (
                            <TableRow key={`${typeKey}-${rowIndex}`} hover>
                              {!isSoilScope && (
                                <TableCell sx={{ verticalAlign: "top", py: 1 }}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    multiline
                                    minRows={1}
                                    value={row.roomArea}
                                    onChange={(e) => handleLeadScopeFieldChange(typeKey, rowIndex, "roomArea", e.target.value)}
                                    placeholder="e.g. Level 1 – Kitchen"
                                    inputProps={{ style: { fontSize: TABLE_FONT_SIZE } }}
                                  />
                                </TableCell>
                              )}
                              <TableCell sx={{ verticalAlign: "top", py: 1 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  multiline
                                  minRows={2}
                                  value={row.locations}
                                  onChange={(e) => handleLeadScopeFieldChange(typeKey, rowIndex, "locations", e.target.value)}
                                  placeholder={
                                    isSoilScope
                                      ? "e.g. Front garden, rear yard, nature strip"
                                      : "Walls, window sills, etc."
                                  }
                                  inputProps={{ style: { fontSize: TABLE_FONT_SIZE } }}
                                />
                              </TableCell>
                              <TableCell align="right" sx={{ verticalAlign: "top", py: 0.5 }}>
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label="Remove row"
                                  onClick={() => handleRemoveLeadScopeRow(typeKey, rowIndex)}
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
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddLeadScopeRow(typeKey)}
                    sx={{ mt: 1, textTransform: "none" }}
                  >
                    Add row
                  </Button>
                </Box>
              );
            })
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={closeLeadScopeModal} variant="outlined" disabled={savingLeadScope} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveLeadScope}
            disabled={savingLeadScope || !leadScopeDraft}
            sx={{ textTransform: "none" }}
          >
            {savingLeadScope ? "Saving…" : "Save scope"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={samplingCompleteDialogOpen} onClose={() => setSamplingCompleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Complete Sampling</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select analysis turnaround to mark sampling complete.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="lead-assessment-turnaround-label">Analysis turnaround</InputLabel>
            <Select
              labelId="lead-assessment-turnaround-label"
              label="Analysis turnaround"
              value={analysisTurnaroundType}
              onChange={(e) => setAnalysisTurnaroundType(e.target.value)}
            >
              {TURNAROUND_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSamplingCompleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSamplingComplete} disabled={savingWorkflow || !analysisTurnaroundType}>
            {savingWorkflow ? "Saving..." : "Complete Sampling"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={submitLabDialogOpen} onClose={() => setSubmitLabDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Samples to Lab</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Confirm who submitted these samples to the lab.
          </Typography>
          <TextField
            fullWidth
            label="Submitted by"
            size="small"
            value={submittedBySignature}
            disabled
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubmitLabDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitSamplesToLab} disabled={savingWorkflow}>
            {savingWorkflow ? "Saving..." : "Confirm Submission"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={analysisDialogOpen} onClose={closeAnalysisDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {hasAttachedAnalysisReport || analysisFile ? "View/Edit Analysis Content" : "Attach Analysis / Lead Content"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {hasAttachedAnalysisReport || analysisFile
              ? "Review the analysis PDF, replace or remove it, and update lead content values as needed."
              : "Upload the analysis PDF and update lead content values."}
          </Typography>
          {analysisPdfSrc ? (
            <Box
              sx={{
                mb: 2,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "grey.100",
              }}
            >
              <Box
                component="iframe"
                title="Analysis report preview"
                src={analysisPdfSrc}
                sx={{ width: "100%", height: 420, border: 0, display: "block" }}
              />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No analysis PDF is attached yet. Choose a PDF below.
            </Typography>
          )}
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }} alignItems="center">
            <Button variant="outlined" component="label" size="small" sx={{ textTransform: "none" }}>
              {analysisFile ? `Replace: ${analysisFile.name}` : hasAttachedAnalysisReport ? "Replace file" : "Choose PDF file"}
              <input
                type="file"
                hidden
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAnalysisFile(f);
                  e.target.value = "";
                }}
              />
            </Button>
            {analysisFile && (
              <Button size="small" onClick={() => setAnalysisFile(null)} sx={{ textTransform: "none" }}>
                Cancel replacement
              </Button>
            )}
            {analysisPdfSrc && (
              <Button
                size="small"
                component="a"
                href={analysisPdfSrc}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textTransform: "none" }}
              >
                Open in new tab
              </Button>
            )}
            {hasAttachedAnalysisReport && !analysisFile && (
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={() => setDeleteAnalysisConfirmOpen(true)}
                sx={{ textTransform: "none" }}
              >
                Delete attachment
              </Button>
            )}
          </Stack>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {items.map((item) => (
              <Box key={item._id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 64 }}>
                  {item.sampleReference || "—"}
                </Typography>
                <TextField
                  size="small"
                  value={leadContentDrafts[item._id] ?? ""}
                  onChange={(e) => handleLeadContentChange(item._id, e.target.value)}
                  sx={{ width: 130 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment
                        position="end"
                        sx={{
                          ml: 0.25,
                          "& .MuiTypography-root": {
                            fontSize: "0.8rem",
                            lineHeight: 1,
                          },
                        }}
                      >
                        {getLeadContentUnit(item.materialType)}
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAnalysisDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAnalysisAndLeadContent} disabled={savingWorkflow}>
            {savingWorkflow ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteAnalysisConfirmOpen} onClose={() => setDeleteAnalysisConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove analysis report?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the attached analysis PDF from this assessment. You can attach a different file afterward. Lead content values are not changed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAnalysisConfirmOpen(false)} disabled={savingWorkflow}>
            Keep file
          </Button>
          <Button color="error" variant="contained" onClick={handleConfirmDeleteAnalysisReport} disabled={savingWorkflow}>
            {savingWorkflow ? "Removing…" : "Delete attachment"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete assessment item</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this assessment item? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadAssessmentItems;
