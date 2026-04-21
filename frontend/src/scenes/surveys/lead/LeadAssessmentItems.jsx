import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { createPortal } from "react-dom";
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
  Card,
  CardContent,
  Grid,
  Checkbox,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import UploadIcon from "@mui/icons-material/Upload";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import DownloadIcon from "@mui/icons-material/Download";
import MapIcon from "@mui/icons-material/Map";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import LeadAssessmentPlanEditorDialog from "../../../components/LeadAssessmentPlanEditorDialog";
import { useSnackbar } from "../../../context/SnackbarContext";
import { useAuth } from "../../../context/AuthContext";
import { generateLeadChainOfCustodyPDF } from "../../../utils/generateLeadChainOfCustodyPDF";
import {
  compressImage,
  needsCompression,
  saveFileToDevice,
} from "../../../utils/imageCompression";
import {
  rotateArrowDegrees90Cw,
  rotateDataUrl90Cw,
  rotateNormalizedPoint90Cw,
} from "../../../utils/rotateImageDataUrl";
import LeadAssessmentLeadSamplesTable from "./LeadAssessmentLeadSamplesTable";
import {
  TABLE_FONT_SIZE,
  PAINT_SAMPLE_TABLE_COLUMN_WIDTHS,
  DUST_SAMPLE_TABLE_COLUMN_WIDTHS,
  SOIL_SAMPLE_TABLE_COLUMN_WIDTHS,
  getLeadPaintStatus,
  getSoilStatus,
  getDustExceedanceStatus,
} from "./leadAssessmentItemsTableUtils";

const DEFAULT_PHOTO_ARROW_ROTATION = -45;
const DEFAULT_PHOTO_ARROW_COLOR = "#f44336";

function getLeadAssessmentPhotoArrows(photo) {
  if (!photo) return [];
  if (photo.arrows && photo.arrows.length > 0) return photo.arrows;
  const leg = photo.arrow;
  if (leg && typeof leg === "object" && (leg.x != null || leg.y != null))
    return [leg];
  return [];
}

function getPhotoKey(photo, index) {
  return String(photo?._id || photo?.id || `referred-${index}`);
}

/** MongoDB ObjectId string — photo arrow API only works with persisted item photos. */
function isMongoPhotoId(id) {
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
}

function mergePhotoBlobFields(photos, blobList) {
  const blobById = new Map((blobList || []).map((b) => [String(b._id), b]));
  return (photos || []).map((p) => {
    const b = blobById.get(String(p._id));
    if (!b) return p;
    return { ...p, data: b.data, fullResolutionData: b.fullResolutionData };
  });
}

/** Arrow SVG viewBox 24×24; tip at (12,2). Returns tip position 0–1 for rotation (degrees). */
function getLeadPhotoArrowTipOffset(rotationDeg) {
  const r = ((rotationDeg ?? 0) * Math.PI) / 180;
  const tipX = (12 + 10 * Math.sin(r)) / 24;
  const tipY = (12 - 10 * Math.cos(r)) / 24;
  return { x: tipX, y: tipY };
}

const LEAD_PHOTO_ARROW_COLORS = [
  { name: "Yellow", hex: "#ffeb3b" },
  { name: "Red", hex: "#f44336" },
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#212121" },
  { name: "Orange", hex: "#ff9800" },
  { name: "Green", hex: "#4caf50" },
];

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

function leadDiscussionTypeKey(sampleTypeKey) {
  const key = String(sampleTypeKey || "").toLowerCase();
  if (key === "dust") return "dust";
  if (key === "soil") return "soil";
  return "paint";
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

function getLeadContentUnit(materialType) {
  const type = String(materialType || "").toLowerCase();
  if (type === "paint" || type === "paint-xrf") return "%";
  if (type === "dust") return "μg";
  if (type === "soil") return "mg/kg";
  return "";
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
  const [leadSitePlansDialogOpen, setLeadSitePlansDialogOpen] = useState(false);
  const [leadAssessmentPlansDialogOpen, setLeadAssessmentPlansDialogOpen] =
    useState(false);

  const theme = useTheme();
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobileLandscape = useMediaQuery(
    "(orientation: landscape) and (max-width: 950px)",
  );

  const [photoGalleryDialogOpen, setPhotoGalleryDialogOpen] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState(null);
  const [selectedReferredPhotoRow, setSelectedReferredPhotoRow] = useState(null);
  const [galleryPhotosLoading, setGalleryPhotosLoading] = useState(false);
  const [galleryPhotosError, setGalleryPhotosError] = useState(null);
  const [localPhotoChanges, setLocalPhotoChanges] = useState({});
  const [photosToDelete, setPhotosToDelete] = useState(new Set());
  const [localPhotoDescriptions, setLocalPhotoDescriptions] = useState({});
  const [editingDescriptionPhotoId, setEditingDescriptionPhotoId] =
    useState(null);
  const [fullSizePhotoDialogOpen, setFullSizePhotoDialogOpen] =
    useState(false);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState(null);
  const [fullSizePhotoId, setFullSizePhotoId] = useState(null);
  const [managePhotosDownloadTarget, setManagePhotosDownloadTarget] =
    useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [rotatingPhotoId, setRotatingPhotoId] = useState(null);
  const [fullSizeArrowMode, setFullSizeArrowMode] = useState(false);
  const [selectedArrowId, setSelectedArrowId] = useState(null);
  const [movingArrowId, setMovingArrowId] = useState(null);
  const [selectedArrowColor, setSelectedArrowColor] = useState(
    DEFAULT_PHOTO_ARROW_COLOR,
  );
  const [leadDiscussionDrafts, setLeadDiscussionDrafts] = useState({
    paint: "",
    dust: "",
    soil: "",
  });
  const [savingLeadDiscussionType, setSavingLeadDiscussionType] = useState(null);
  const [isDictatingDiscussion, setIsDictatingDiscussion] = useState(false);
  const [dictationDiscussionType, setDictationDiscussionType] = useState(null);
  const [dictationDiscussionError, setDictationDiscussionError] = useState("");
  const discussionRecognitionRef = useRef(null);

  const applyAssessmentPayload = useCallback((data) => {
    startTransition(() => {
      setAssessment(data);
      setItems(Array.isArray(data?.items) ? data.items : []);
    });
  }, []);

  const leadAssessmentLiteGetOpts = useMemo(
    () => ({
      omitPhotoData: true,
      omitPlanFiles: true,
      omitFibreReport: true,
    }),
    [],
  );

  /** One request: all items + assessment fields, but no photo/plan/PDF blobs (those load on demand). */
  const fetchAssessment = useCallback(async () => {
    if (!id) return;
    try {
      const data = await asbestosAssessmentService.getById(id, {
        ...leadAssessmentLiteGetOpts,
      });
      const job = data?.data ?? data;
      applyAssessmentPayload(job);
    } catch (err) {
      setAssessment(null);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [id, leadAssessmentLiteGetOpts, applyAssessmentPayload]);

  /** Refresh assessment/items without toggling loading (tab focus, after delete). */
  const refetchAssessmentQuiet = useCallback(async () => {
    if (!id) return null;
    try {
      const data = await asbestosAssessmentService.getById(id, {
        ...leadAssessmentLiteGetOpts,
      });
      const job = data?.data ?? data;
      applyAssessmentPayload(job);
      return job;
    } catch {
      return null;
    }
  }, [id, leadAssessmentLiteGetOpts, applyAssessmentPayload]);

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

  const hydrateLeadPlanAppendicesForEditor = useCallback(async () => {
    if (!id) return;
    try {
      const data = await asbestosAssessmentService.getById(id, {
        omitPhotoData: true,
        omitFibreReport: true,
        omitItems: true,
      });
      const job = data?.data ?? data;
      setAssessment((prev) =>
        prev ? { ...prev, ...job, items: prev.items } : job,
      );
    } catch (e) {
      showSnackbar(
        e.response?.data?.message || e.message || "Failed to load plan images",
        "error",
      );
    }
  }, [id, showSnackbar]);

  useEffect(() => {
    if (!photoGalleryDialogOpen || !id || !selectedItemForPhotos) return;
    const photos = selectedItemForPhotos.photographs || [];
    if (photos.length === 0) return;
    const needsBlob = photos.some(
      (p) => p && !p.data && isMongoPhotoId(p._id),
    );
    if (!needsBlob) {
      setGalleryPhotosLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setGalleryPhotosLoading(true);
      setGalleryPhotosError(null);
      try {
        let blobList;
        if (selectedReferredPhotoRow) {
          const { itemId, referredIndex } = selectedReferredPhotoRow;
          const res = await asbestosAssessmentService.getReferredPhotosData(
            id,
            itemId,
            referredIndex,
          );
          blobList = res?.photographs;
        } else {
          const res = await asbestosAssessmentService.getItemPhotosData(
            id,
            selectedItemForPhotos._id,
          );
          blobList = res?.photographs;
        }
        if (cancelled) return;
        setSelectedItemForPhotos((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            photographs: mergePhotoBlobFields(prev.photographs, blobList),
          };
        });
      } catch (e) {
        if (!cancelled) {
          setGalleryPhotosError(
            e.response?.data?.message ||
              e.message ||
              "Failed to load photos",
          );
        }
      } finally {
        if (!cancelled) setGalleryPhotosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    photoGalleryDialogOpen,
    id,
    selectedItemForPhotos,
    selectedReferredPhotoRow,
  ]);

  useEffect(() => {
    if (location.state?.openAttachAnalysis) {
      setAnalysisDialogOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!analysisDialogOpen || !id || !assessment) return;
    if (assessment.fibreAnalysisReport) return;
    if (assessment.hasFibreAnalysisReport !== true) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await asbestosAssessmentService.getById(id, {
          omitPhotoData: true,
          omitPlanFiles: true,
          omitItems: true,
        });
        const job = data?.data ?? data;
        if (cancelled) return;
        setAssessment((prev) =>
          prev
            ? {
                ...prev,
                fibreAnalysisReport: job.fibreAnalysisReport,
                hasFibreAnalysisReport: job.hasFibreAnalysisReport,
              }
            : prev,
        );
      } catch {
        /* no-op */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysisDialogOpen, id, assessment]);

  useEffect(() => {
    const nextDrafts = {};
    items.forEach((item) => {
      nextDrafts[item._id] = item.leadContent ?? "";
    });
    setLeadContentDrafts(nextDrafts);
  }, [items]);

  useEffect(() => {
    const stored = assessment?.leadDiscussionConclusionsByType;
    const source = stored && typeof stored === "object" ? stored : {};
    setLeadDiscussionDrafts({
      paint: String(source.paint || ""),
      dust: String(source.dust || ""),
      soil: String(source.soil || ""),
    });
  }, [assessment?.leadDiscussionConclusionsByType]);

  useEffect(() => () => {
    if (discussionRecognitionRef.current) {
      try {
        discussionRecognitionRef.current.stop();
      } catch {
        /* no-op */
      }
    }
  }, []);

  const stopDiscussionDictation = useCallback(() => {
    if (discussionRecognitionRef.current) {
      try {
        discussionRecognitionRef.current.stop();
      } catch {
        /* no-op */
      }
      discussionRecognitionRef.current = null;
    }
    setIsDictatingDiscussion(false);
    setDictationDiscussionType(null);
  }, []);

  const startDiscussionDictation = useCallback((typeKey) => {
    if (isDictatingDiscussion) stopDiscussionDictation();
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setDictationDiscussionError("Speech recognition is not supported in this browser.");
      return;
    }
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-AU";
      recognition.onstart = () => {
        setIsDictatingDiscussion(true);
        setDictationDiscussionType(typeKey);
        setDictationDiscussionError("");
      };
      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (!finalTranscript) return;
        setLeadDiscussionDrafts((prev) => {
          const current = prev[typeKey] || "";
          const isFirstWord = !current || current.trim().length === 0;
          const normalized = isFirstWord
            ? finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1)
            : finalTranscript;
          return {
            ...prev,
            [typeKey]: `${current}${current ? " " : ""}${normalized}`.trim(),
          };
        });
      };
      recognition.onerror = (event) => {
        setDictationDiscussionError(`Dictation error: ${event.error}`);
        setIsDictatingDiscussion(false);
        setDictationDiscussionType(null);
        discussionRecognitionRef.current = null;
      };
      recognition.onend = () => {
        setIsDictatingDiscussion(false);
        setDictationDiscussionType(null);
        discussionRecognitionRef.current = null;
      };
      discussionRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setDictationDiscussionError("Failed to start dictation. Please try again.");
    }
  }, [isDictatingDiscussion, stopDiscussionDictation]);

  const handleLeadDiscussionChange = useCallback((typeKey, value) => {
    setLeadDiscussionDrafts((prev) => ({ ...prev, [typeKey]: value }));
  }, []);

  const handleSaveLeadDiscussionByType = useCallback(async (typeKey) => {
    if (!id || !assessment) return;
    const discussionKey = leadDiscussionTypeKey(typeKey);
    const current = String(assessment?.leadDiscussionConclusionsByType?.[discussionKey] || "");
    const next = String(leadDiscussionDrafts[discussionKey] || "");
    if (next.trim() === current.trim()) return;
    const merged = {
      ...(assessment?.leadDiscussionConclusionsByType || {}),
      [discussionKey]: next,
    };
    try {
      setSavingLeadDiscussionType(discussionKey);
      await asbestosAssessmentService.update(id, {
        projectId: assessment?.projectId?._id || assessment?.projectId,
        assessmentDate: assessment?.assessmentDate,
        status: assessment?.status,
        leadDiscussionConclusionsByType: merged,
      });
      setAssessment((prev) => (prev ? { ...prev, leadDiscussionConclusionsByType: merged } : prev));
      showSnackbar("Discussion/Conclusion saved.", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to save discussion/conclusion", "error");
    } finally {
      setSavingLeadDiscussionType(null);
    }
  }, [id, assessment, leadDiscussionDrafts, showSnackbar]);

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
    if (assessment?.hasFibreAnalysisReport === true) return true;
    const raw = assessment?.fibreAnalysisReport;
    return typeof raw === "string" && raw.trim().length > 0;
  }, [assessment?.fibreAnalysisReport, assessment?.hasFibreAnalysisReport]);

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
    const raw = assessment?.fibreAnalysisReport;
    if (typeof raw === "string" && raw.trim()) {
      return fibreAnalysisReportToPdfSrc(raw);
    }
    return null;
  }, [replacePreviewUrl, assessment?.fibreAnalysisReport]);

  const leadAssessmentPhotosLocked =
    String(assessment?.status || "").toLowerCase() === "complete";

  const leadSitePlanAppendixCount = useMemo(() => {
    if (typeof assessment?.leadSitePlanAppendixFileCount === "number") {
      return assessment.leadSitePlanAppendixFileCount;
    }
    const arr = assessment?.leadSitePlanAppendices;
    if (!Array.isArray(arr)) return 0;
    return arr.filter((p) => p && p.sitePlanFile).length;
  }, [
    assessment?.leadSitePlanAppendixFileCount,
    assessment?.leadSitePlanAppendices,
  ]);

  const leadAssessmentPlanAppendixCount = useMemo(() => {
    if (typeof assessment?.leadAssessmentPlanAppendixFileCount === "number") {
      return assessment.leadAssessmentPlanAppendixFileCount;
    }
    const arr = assessment?.leadAssessmentPlanAppendices;
    if (!Array.isArray(arr)) return 0;
    return arr.filter((p) => p && p.sitePlanFile).length;
  }, [
    assessment?.leadAssessmentPlanAppendixFileCount,
    assessment?.leadAssessmentPlanAppendices,
  ]);

  const handleLeadPlansSaved = useCallback(
    ({ field, plans } = {}) => {
      if (!field || !Array.isArray(plans)) return;
      setAssessment((prev) => (prev ? { ...prev, [field]: plans } : prev));
    },
    [],
  );

  useEffect(() => {
    if (cameraDialogOpen && stream && videoRef) {
      videoRef.srcObject = stream;
    }
  }, [cameraDialogOpen, stream, videoRef]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const generateDefaultLeadPhotoDescription = (item) => {
    const loc = (item.locationDescription || "sample location").toLowerCase();
    const room = (item.roomArea || "unknown room/area").toLowerCase();
    return `Photograph of ${loc} in ${room}`;
  };

  const handleAddPhotoToItem = async (photoData, fullResolutionData = null) => {
    if (!selectedItemForPhotos || !id || leadAssessmentPhotosLocked) return;
    if (selectedReferredPhotoRow) {
      const currentPhotos = Array.isArray(selectedItemForPhotos.photographs)
        ? selectedItemForPhotos.photographs
        : [];
      const nextPhotos = [
        ...currentPhotos,
        {
          _id: `referred-${Date.now()}`,
          data: photoData,
          fullResolutionData: fullResolutionData || undefined,
          includeInReport: true,
        },
      ];
      await persistReferredPhotos(nextPhotos);
      return;
    }
    try {
      const newItem = await asbestosAssessmentService.addPhotoToItem(
        id,
        selectedItemForPhotos._id,
        photoData,
        true,
        fullResolutionData,
      );
      if (newItem?._id) setSelectedItemForPhotos(newItem);
      setCompressionStatus(null);
      await refetchAssessmentQuiet();
      showSnackbar("Photo added successfully", "success");
    } catch (err) {
      showSnackbar("Failed to add photo", "error");
    }
  };

  const handleDeletePhotoFromItem = (itemId, photoId) => {
    setPhotosToDelete((prev) => new Set([...prev, photoId]));
  };

  const getCurrentLeadPhotoState = (photoId) => {
    const localChange = localPhotoChanges[photoId];
    if (localChange !== undefined) return localChange;
    const photo = selectedItemForPhotos?.photographs?.find(
      (p, idx) => getPhotoKey(p, idx) === String(photoId),
    );
    return photo?.includeInReport ?? true;
  };

  const handleTogglePhotoInReport = (itemId, photoId) => {
    setLocalPhotoChanges((prev) => ({
      ...prev,
      [photoId]: !getCurrentLeadPhotoState(photoId),
    }));
  };

  const getCurrentLeadPhotoDescription = (photoId, item) => {
    if (localPhotoDescriptions[photoId] !== undefined) {
      return localPhotoDescriptions[photoId];
    }
    const photo = selectedItemForPhotos?.photographs?.find(
      (p, idx) => getPhotoKey(p, idx) === String(photoId),
    );
    if (photo?.description) return photo.description;
    return generateDefaultLeadPhotoDescription(item);
  };

  const handleLeadPhotoDescriptionChange = (photoId, newDescription) => {
    setLocalPhotoDescriptions((prev) => ({
      ...prev,
      [photoId]: newDescription,
    }));
  };

  const isLeadPhotoMarkedForDeletion = (photoId) => photosToDelete.has(photoId);

  const hasLeadPhotoUnsavedChanges = () =>
    Object.keys(localPhotoChanges).length > 0 ||
    photosToDelete.size > 0 ||
    Object.keys(localPhotoDescriptions).length > 0;

  const saveLeadPhotoChanges = async () => {
    if (!selectedItemForPhotos || !id || leadAssessmentPhotosLocked) return;
    if (selectedReferredPhotoRow) {
      try {
        const current = Array.isArray(selectedItemForPhotos.photographs)
          ? selectedItemForPhotos.photographs
          : [];
        const nextPhotos = current
          .filter((photo, idx) => {
            const photoId = getPhotoKey(photo, idx);
            return !photosToDelete.has(photoId);
          })
          .map((photo, idx) => {
            const photoId = getPhotoKey(photo, idx);
            return {
              ...photo,
              includeInReport:
                localPhotoChanges[photoId] !== undefined
                  ? localPhotoChanges[photoId]
                  : photo.includeInReport ?? true,
              description:
                localPhotoDescriptions[photoId] !== undefined
                  ? localPhotoDescriptions[photoId]
                  : photo.description,
            };
          });
        await persistReferredPhotos(nextPhotos);
        setLocalPhotoChanges({});
        setPhotosToDelete(new Set());
        setLocalPhotoDescriptions({});
        return;
      } catch (err) {
        showSnackbar("Failed to save photo changes", "error");
        return;
      }
    }
    try {
      const togglePromises = [];
      const descriptionPromises = [];
      Object.entries(localPhotoChanges).forEach(([photoId, includeInReport]) => {
        const photo = selectedItemForPhotos?.photographs?.find(
          (p) => p._id === photoId,
        );
        if (photo && photo.includeInReport !== includeInReport) {
          togglePromises.push(
            asbestosAssessmentService.togglePhotoInReport(
              id,
              selectedItemForPhotos._id,
              photoId,
            ),
          );
        }
      });
      Object.entries(localPhotoDescriptions).forEach(([photoId, description]) => {
        descriptionPromises.push(
          asbestosAssessmentService.updatePhotoDescription(
            id,
            selectedItemForPhotos._id,
            photoId,
            description,
          ),
        );
      });
      await Promise.allSettled(togglePromises);
      await Promise.allSettled(descriptionPromises);
      for (const photoId of photosToDelete) {
        try {
          await asbestosAssessmentService.deletePhotoFromItem(
            id,
            selectedItemForPhotos._id,
            photoId,
          );
        } catch (e) {
          console.error("Error deleting photo:", e);
        }
      }
      showSnackbar("Photo changes saved successfully", "success");
      setLocalPhotoChanges({});
      setPhotosToDelete(new Set());
      setLocalPhotoDescriptions({});
      const doc = await refetchAssessmentQuiet();
      const list = Array.isArray(doc?.items) ? doc.items : [];
      const updatedItem = list.find(
        (i) => String(i._id) === String(selectedItemForPhotos._id),
      );
      if (updatedItem) {
        try {
          const { photographs: blobs } =
            await asbestosAssessmentService.getItemPhotosData(id, updatedItem._id);
          setSelectedItemForPhotos({
            ...updatedItem,
            photographs: mergePhotoBlobFields(updatedItem.photographs, blobs),
          });
        } catch {
          setSelectedItemForPhotos(updatedItem);
        }
      }
    } catch (err) {
      showSnackbar("Failed to save photo changes", "error");
    }
  };

  const handleLeadPhotoUploadForGallery = async (event) => {
    const file = event.target.files?.[0];
    if (!file || leadAssessmentPhotosLocked) return;
    setCompressionStatus({
      type: "processing",
      message: "Processing image...",
    });
    try {
      const fullResolutionData = await new Promise((resolve, reject) => {
        const fullResReader = new FileReader();
        fullResReader.onload = (e) => resolve(e.target.result);
        fullResReader.onerror = reject;
        fullResReader.readAsDataURL(file);
      });
      if (needsCompression(file, 300)) {
        const compressed = await compressImage(file, {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: 0.75,
          maxSizeKB: 300,
        });
        await handleAddPhotoToItem(compressed, fullResolutionData);
        setCompressionStatus({ type: "success", message: "Image added." });
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          await handleAddPhotoToItem(e.target.result, fullResolutionData);
          setCompressionStatus({ type: "info", message: "Image added." });
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setCompressionStatus({
        type: "error",
        message: "Failed to process image",
      });
    }
  };

  const handleOpenLeadPhotoGallery = (item) => {
    setGalleryPhotosError(null);
    setSelectedItemForPhotos(item);
    setPhotoGalleryDialogOpen(true);
  };

  const handleOpenReferredPhotoDialog = (row) => {
    if (!row?.item?._id || row?.referredIndex == null) return;
    setGalleryPhotosError(null);
    setSelectedReferredPhotoRow({
      itemId: row.item._id,
      referredIndex: row.referredIndex,
    });
    setSelectedItemForPhotos({
      ...row.item,
      locationDescription: row.referred?.surfaceDescription || row.item.locationDescription,
      roomArea: row.referred?.roomArea || row.item.roomArea,
      sampleReference: row.item.sampleReference || "—",
      photographs: Array.isArray(row.referred?.photographs)
        ? row.referred.photographs.map((photo, index) => ({
            _id: photo?._id || `referred-${row.referredIndex}-${index}`,
            ...photo,
          }))
        : [],
    });
    setPhotoGalleryDialogOpen(true);
  };

  const selectedReferredPhotoData = useMemo(() => {
    if (!selectedReferredPhotoRow?.itemId || selectedReferredPhotoRow.referredIndex == null) return null;
    const item = items.find((x) => String(x._id) === String(selectedReferredPhotoRow.itemId));
    if (!item) return null;
    const referredLocations = Array.isArray(item.referredLocations) ? item.referredLocations : [];
    const referred = referredLocations[selectedReferredPhotoRow.referredIndex];
    if (!referred) return null;
    return { item, referred, referredLocations };
  }, [items, selectedReferredPhotoRow]);

  const persistReferredPhotos = async (nextPhotos) => {
    if (!id || !selectedReferredPhotoData?.item?._id) return;
    const { item, referredLocations } = selectedReferredPhotoData;
    const nextLocations = referredLocations.map((loc, idx) =>
      idx === selectedReferredPhotoRow.referredIndex
        ? {
            ...loc,
            photographs: (nextPhotos || []).map((photo) => ({
              data: photo?.data,
              fullResolutionData: photo?.fullResolutionData,
              includeInReport: photo?.includeInReport ?? true,
              description: photo?.description,
            })),
          }
        : loc,
    );
    try {
      await asbestosAssessmentService.updateItem(id, item._id, {
        referredLocations: nextLocations,
      });
      const refreshedReferred = nextLocations[selectedReferredPhotoRow.referredIndex];
      setSelectedItemForPhotos((prev) => ({
        ...(prev || item),
        locationDescription: refreshedReferred?.surfaceDescription || prev?.locationDescription,
        roomArea: refreshedReferred?.roomArea || prev?.roomArea,
        photographs: Array.isArray(refreshedReferred?.photographs)
          ? refreshedReferred.photographs.map((photo, index) => ({
              _id: photo?._id || `referred-${selectedReferredPhotoRow.referredIndex}-${index}`,
              ...photo,
            }))
          : [],
      }));
      await refetchAssessmentQuiet();
      showSnackbar("Referred location photos saved.", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || err.message || "Failed to save referred location photos", "error");
    }
  };

  const handleCloseLeadPhotoGallery = async () => {
    setPhotoGalleryDialogOpen(false);
    setManagePhotosDownloadTarget(null);
    setSelectedItemForPhotos(null);
    setSelectedReferredPhotoRow(null);
    setGalleryPhotosLoading(false);
    setGalleryPhotosError(null);
    setRotatingPhotoId(null);
    setCompressionStatus(null);
    setLocalPhotoChanges({});
    setPhotosToDelete(new Set());
    setLocalPhotoDescriptions({});
    setEditingDescriptionPhotoId(null);
    setFullSizeArrowMode(false);
    setSelectedArrowId(null);
    setMovingArrowId(null);
    await refetchAssessmentQuiet();
  };

  const handleTakeLeadPhoto = async () => {
    if (leadAssessmentPhotosLocked) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";
      input.onchange = (event) => {
        const f = event.target.files?.[0];
        if (f) handleLeadPhotoUploadForGallery({ target: { files: [f] } });
      };
      input.click();
      return;
    }
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      setStream(mediaStream);
      setPhotoGalleryDialogOpen(false);
      setManagePhotosDownloadTarget(null);
      setCameraDialogOpen(true);
    } catch (error) {
      showSnackbar(
        "Failed to access camera. Use upload instead or check permissions.",
        "error",
      );
    }
  };

  const handleCloseLeadCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraDialogOpen(false);
    setPhotoGalleryDialogOpen(true);
    document.exitFullscreen?.().catch(() => {});
  };

  const handleCaptureLeadPhoto = async () => {
    if (!videoRef?.videoWidth) {
      handleCloseLeadCamera();
      return;
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    ctx.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const file = new File([blob], "camera-photo.jpg", {
            type: "image/jpeg",
          });
          await handleLeadPhotoUploadForGallery({
            target: { files: [file] },
          });
        }
        handleCloseLeadCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleViewLeadFullSizePhoto = (photo) => {
    const url = typeof photo === "string" ? photo : photo?.data;
    if (!url) return;
    setFullSizePhotoUrl(url);
    setFullSizePhotoId(
      typeof photo === "object" && photo?._id ? photo._id : null,
    );
    setFullSizeArrowMode(false);
    setSelectedArrowId(null);
    setMovingArrowId(null);
    setFullSizePhotoDialogOpen(true);
  };

  const handleDownloadLeadPhoto = async (
    photo,
    fallbackLabel = "photo",
    quality = "full",
  ) => {
    const photoData =
      typeof photo === "string"
        ? photo
        : quality === "full"
          ? photo?.fullResolutionData
          : photo?.data;
    if (!photoData) {
      showSnackbar(
        quality === "full"
          ? "Full-resolution image is not available for this photo"
          : "Compressed image is not available for this photo",
        "error",
      );
      return;
    }
    try {
      const mimeMatch = photoData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      const mimeType = mimeMatch?.[1] || "image/jpeg";
      const extensionMap = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      };
      const extension = extensionMap[mimeType] || "jpg";
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `lead-assessment-${fallbackLabel}-${quality}-${timestamp}.${extension}`;
      const response = await fetch(photoData);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: mimeType });
      await saveFileToDevice(file, filename);
      showSnackbar("Photo downloaded", "success");
    } catch (error) {
      console.error("Error downloading lead photo:", error);
      showSnackbar("Failed to download photo", "error");
    }
  };

  const handleManagePhotosDownloadChoice = async (quality) => {
    if (!managePhotosDownloadTarget) return;
    const { photo, fileLabel } = managePhotosDownloadTarget;
    setManagePhotosDownloadTarget(null);
    await handleDownloadLeadPhoto(photo, fileLabel, quality);
  };

  const fullSizeLeadPhoto =
    fullSizePhotoId && selectedItemForPhotos?.photographs
      ? selectedItemForPhotos.photographs.find((p) => p._id === fullSizePhotoId)
      : null;

  const leadItemPhotoArrowsAvailable =
    !selectedReferredPhotoRow &&
    !leadAssessmentPhotosLocked &&
    selectedItemForPhotos?._id &&
    fullSizePhotoId &&
    isMongoPhotoId(fullSizePhotoId);

  const handleAddLeadPhotoArrow = async (photoId, arrow) => {
    if (!leadItemPhotoArrowsAvailable || !id || !selectedItemForPhotos?._id)
      return;
    try {
      const response = await asbestosAssessmentService.addPhotoArrow(
        id,
        selectedItemForPhotos._id,
        photoId,
        {
          x: arrow.x ?? 0.5,
          y: arrow.y ?? 0.5,
          rotation: arrow.rotation ?? DEFAULT_PHOTO_ARROW_ROTATION,
          color: arrow.color ?? DEFAULT_PHOTO_ARROW_COLOR,
        },
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      setFullSizeArrowMode(false);
      setMovingArrowId(null);
      showSnackbar("Arrow added", "success");
    } catch (err) {
      console.error("Error adding arrow:", err);
      showSnackbar("Failed to add arrow", "error");
    }
  };

  const handleUpdateLeadPhotoArrow = async (photoId, arrowId, updates) => {
    if (!leadItemPhotoArrowsAvailable || !id || !selectedItemForPhotos?._id)
      return;
    try {
      const response = await asbestosAssessmentService.updatePhotoArrow(
        id,
        selectedItemForPhotos._id,
        photoId,
        arrowId,
        updates,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      setMovingArrowId(null);
      setFullSizeArrowMode(false);
      if (updates.x != null || updates.y != null) {
        showSnackbar("Arrow updated", "success");
      }
    } catch (err) {
      console.error("Error updating arrow:", err);
      showSnackbar("Failed to update arrow", "error");
    }
  };

  const handleDeleteLeadPhotoArrow = async (photoId, arrowId) => {
    if (!leadItemPhotoArrowsAvailable || !id || !selectedItemForPhotos?._id)
      return;
    try {
      const response = await asbestosAssessmentService.deletePhotoArrow(
        id,
        selectedItemForPhotos._id,
        photoId,
        arrowId,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      if (selectedArrowId === arrowId) setSelectedArrowId(null);
      setFullSizeArrowMode(false);
      setMovingArrowId(null);
      showSnackbar("Arrow removed", "success");
    } catch (err) {
      console.error("Error deleting arrow:", err);
      showSnackbar("Failed to remove arrow", "error");
    }
  };

  const handleClearAllLeadArrows = async (photoId) => {
    if (!leadItemPhotoArrowsAvailable || !id || !selectedItemForPhotos?._id)
      return;
    try {
      const response = await asbestosAssessmentService.updatePhotoArrowLegacy(
        id,
        selectedItemForPhotos._id,
        photoId,
        null,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      setSelectedArrowId(null);
      setFullSizeArrowMode(false);
      setMovingArrowId(null);
      showSnackbar("Arrows cleared", "success");
    } catch (err) {
      console.error("Error clearing arrows:", err);
      showSnackbar("Failed to clear arrows", "error");
    }
  };

  const handleFullSizeLeadPhotoClickForArrow = (e) => {
    if (
      !fullSizePhotoId ||
      !fullSizeLeadPhoto ||
      !leadItemPhotoArrowsAvailable
    )
      return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    if (movingArrowId) {
      handleUpdateLeadPhotoArrow(fullSizePhotoId, movingArrowId, {
        x: clampedX,
        y: clampedY,
      });
      return;
    }
    if (fullSizeArrowMode) {
      handleAddLeadPhotoArrow(fullSizePhotoId, {
        x: clampedX,
        y: clampedY,
        rotation: DEFAULT_PHOTO_ARROW_ROTATION,
        color: selectedArrowColor,
      });
    }
  };

  const handleRotateLeadPhoto90Cw = async (photo) => {
    if (
      !photo?.data ||
      rotatingPhotoId ||
      !id ||
      !selectedItemForPhotos ||
      leadAssessmentPhotosLocked ||
      selectedReferredPhotoRow ||
      !isMongoPhotoId(photo._id)
    ) {
      return;
    }
    setRotatingPhotoId(photo._id);
    try {
      const newData = await rotateDataUrl90Cw(photo.data, 0.92);
      const arrowList = getLeadAssessmentPhotoArrows(photo);
      const newArrows = arrowList.map((arr) => {
        const { x, y } = rotateNormalizedPoint90Cw(
          arr.x ?? 0.5,
          arr.y ?? 0.5,
        );
        return {
          x: Math.max(0, Math.min(1, x)),
          y: Math.max(0, Math.min(1, y)),
          rotation: rotateArrowDegrees90Cw(
            arr.rotation ?? DEFAULT_PHOTO_ARROW_ROTATION,
          ),
          color: arr.color || DEFAULT_PHOTO_ARROW_COLOR,
          ...(arr._id ? { _id: arr._id } : {}),
        };
      });
      await asbestosAssessmentService.updatePhotoContent(
        id,
        selectedItemForPhotos._id,
        photo._id,
        { photoData: newData, arrows: newArrows },
      );
      const doc = await refetchAssessmentQuiet();
      const list = Array.isArray(doc?.items) ? doc.items : [];
      const updatedItem = list.find(
        (i) => String(i._id) === String(selectedItemForPhotos._id),
      );
      if (updatedItem) {
        try {
          const { photographs: blobs } =
            await asbestosAssessmentService.getItemPhotosData(id, updatedItem._id);
          const merged = {
            ...updatedItem,
            photographs: mergePhotoBlobFields(updatedItem.photographs, blobs),
          };
          setSelectedItemForPhotos(merged);
          if (fullSizePhotoId === photo._id) {
            const p = merged.photographs?.find(
              (x) => String(x._id) === String(photo._id),
            );
            if (p?.data) setFullSizePhotoUrl(p.data);
          }
        } catch {
          setSelectedItemForPhotos(updatedItem);
        }
      }
      showSnackbar("Photo rotated", "success");
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to rotate photo", "error");
    } finally {
      setRotatingPhotoId(null);
    }
  };

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
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<MapIcon />}
            onClick={async () => {
              await hydrateLeadPlanAppendicesForEditor();
              setLeadSitePlansDialogOpen(true);
            }}
            disabled={leadAssessmentPhotosLocked}
            sx={{ textTransform: "none" }}
            title="Site plan figures for the report appendix (multiple tabs). Pin tool marks sample locations."
          >
            Site plan
            {leadSitePlanAppendixCount > 0 ? ` (${leadSitePlanAppendixCount})` : ""}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<MapIcon />}
            onClick={async () => {
              await hydrateLeadPlanAppendicesForEditor();
              setLeadAssessmentPlansDialogOpen(true);
            }}
            disabled={leadAssessmentPhotosLocked}
            sx={{ textTransform: "none" }}
            title="Plans illustrating assessment areas — draw or add images only (no map layer)."
          >
            Assessment plan
            {leadAssessmentPlanAppendixCount > 0 ? ` (${leadAssessmentPlanAppendixCount})` : ""}
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
                <LeadAssessmentLeadSamplesTable
                  typeKey={typeKey}
                  typeRows={typeRows}
                  isPaintTable={isPaintTable}
                  isDustTable={isDustTable}
                  isSoilTable={isSoilTable}
                  columnWidths={columnWidths}
                  leadContentDrafts={leadContentDrafts}
                  leadAssessmentPhotosLocked={leadAssessmentPhotosLocked}
                  assessmentId={id}
                  onLeadContentChange={handleLeadContentChange}
                  onLeadContentSave={handleLeadContentSave}
                  onLeadContentCancel={handleLeadContentCancel}
                  onOpenLeadPhotoGallery={handleOpenLeadPhotoGallery}
                  onOpenReferredPhotoDialog={handleOpenReferredPhotoDialog}
                  onDeleteItem={handleDeleteClick}
                />
              </Box>
            );
          })}
            </Box>
          </Box>
          <Box sx={{ mt: 2, bgcolor: "background.default" }}>
            <Paper variant="outlined" sx={{ px: 1.5, pb: 1.5, pt: 1.25 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Discussion/Conclusion
              </Typography>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  value={leadDiscussionDrafts[leadDiscussionTypeKey(activeSampleTab)] || ""}
                  onChange={(e) =>
                    handleLeadDiscussionChange(
                      leadDiscussionTypeKey(activeSampleTab),
                      e.target.value,
                    )
                  }
                  placeholder="Enter discussion/conclusion for this assessment type"
                  sx={{ flex: 1, minWidth: { xs: "100%", sm: 320 } }}
                />
                <Button
                  size="small"
                  variant={
                    isDictatingDiscussion &&
                    dictationDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                      ? "contained"
                      : "outlined"
                  }
                  color={
                    isDictatingDiscussion &&
                    dictationDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                      ? "error"
                      : "primary"
                  }
                  startIcon={
                    isDictatingDiscussion &&
                    dictationDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                      ? <StopIcon />
                      : <MicIcon />
                  }
                  onClick={() => (
                    isDictatingDiscussion &&
                    dictationDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                      ? stopDiscussionDictation()
                      : startDiscussionDictation(leadDiscussionTypeKey(activeSampleTab))
                  )}
                >
                  {isDictatingDiscussion &&
                  dictationDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                    ? "Stop Dictation"
                    : "Dictate"}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleSaveLeadDiscussionByType(activeSampleTab)}
                  disabled={savingLeadDiscussionType === leadDiscussionTypeKey(activeSampleTab)}
                >
                  {savingLeadDiscussionType === leadDiscussionTypeKey(activeSampleTab)
                    ? "Saving..."
                    : "Save"}
                </Button>
              </Box>
              {dictationDiscussionError && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {dictationDiscussionError}
                </Alert>
              )}
            </Paper>
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

      <LeadAssessmentPlanEditorDialog
        open={leadSitePlansDialogOpen}
        onClose={() => setLeadSitePlansDialogOpen(false)}
        kind="site"
        assessmentId={id}
        assessment={assessment}
        items={items}
        leadContentDrafts={leadContentDrafts}
        readOnly={leadAssessmentPhotosLocked}
        showSnackbar={showSnackbar}
        onSaved={handleLeadPlansSaved}
      />
      <LeadAssessmentPlanEditorDialog
        open={leadAssessmentPlansDialogOpen}
        onClose={() => setLeadAssessmentPlansDialogOpen(false)}
        kind="assessment"
        assessmentId={id}
        assessment={assessment}
        items={items}
        leadContentDrafts={leadContentDrafts}
        readOnly={leadAssessmentPhotosLocked}
        showSnackbar={showSnackbar}
        onSaved={handleLeadPlansSaved}
      />

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
          {hasAttachedAnalysisReport && !analysisFile && !analysisPdfSrc ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
                py: 4,
                mb: 2,
              }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Loading PDF preview…
              </Typography>
            </Box>
          ) : analysisPdfSrc ? (
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

      <Dialog
        open={photoGalleryDialogOpen}
        onClose={handleCloseLeadPhotoGallery}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)" },
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
            justifyContent: "space-between",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "secondary.main",
                color: "white",
              }}
            >
              <PhotoCameraIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Manage Photos
            </Typography>
          </Box>
          {isMobileLandscape && selectedItemForPhotos && !selectedReferredPhotoRow && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Button
                variant="outlined"
                startIcon={<PhotoCameraIcon />}
                onClick={handleTakeLeadPhoto}
                size="small"
                disabled={leadAssessmentPhotosLocked}
              >
                Take Photo
              </Button>
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                component="label"
                size="small"
                disabled={leadAssessmentPhotosLocked}
              >
                Upload Photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleLeadPhotoUploadForGallery}
                  disabled={leadAssessmentPhotosLocked}
                />
              </Button>
            </Box>
          )}
          <IconButton onClick={handleCloseLeadPhotoGallery}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 3, border: "none" }}>
          {selectedItemForPhotos && (
            <>
              {galleryPhotosError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {galleryPhotosError}
                </Alert>
              )}
              {galleryPhotosLoading && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    mb: 2,
                  }}
                >
                  <CircularProgress size={22} />
                  <Typography variant="body2" color="text.secondary">
                    Loading images…
                  </Typography>
                </Box>
              )}
              {isPortrait && isMobile ? (
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
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                      Please rotate your device to landscape mode
                    </Typography>
                    <Typography variant="body2" component="div">
                      The manage photos form is best viewed in landscape
                      orientation.
                    </Typography>
                  </Alert>
                </Box>
              ) : (
                <>
                  <Box
                    sx={{
                      mb: 3,
                      ...(isMobileLandscape && {
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 1,
                      }),
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: isMobileLandscape ? 0 : 1 }}
                    >
                      <strong>Location:</strong>{" "}
                      {selectedItemForPhotos.locationDescription}
                    </Typography>
                    {isMobileLandscape && (
                      <Typography variant="body2" color="text.secondary">
                        |
                      </Typography>
                    )}
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: isMobileLandscape ? 0 : 1 }}
                    >
                      <strong>Room/Area:</strong>{" "}
                      {selectedItemForPhotos.roomArea}
                    </Typography>
                    {isMobileLandscape && (
                      <Typography variant="body2" color="text.secondary">
                        |
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      <strong>Sample ref:</strong>{" "}
                      {selectedItemForPhotos.sampleReference || "—"}
                    </Typography>
                  </Box>

                  {!isMobileLandscape && (
                    <Box
                      sx={{
                        mb: 3,
                        p: 2,
                        bgcolor: "grey.50",
                        borderRadius: 2,
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ mb: 2, fontWeight: 600 }}
                      >
                        Add New Photo
                      </Typography>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          variant="outlined"
                          startIcon={<PhotoCameraIcon />}
                          onClick={handleTakeLeadPhoto}
                          size="small"
                          disabled={leadAssessmentPhotosLocked}
                        >
                          Take Photo
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<UploadIcon />}
                          component="label"
                          size="small"
                          disabled={leadAssessmentPhotosLocked}
                        >
                          Upload Photo
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleLeadPhotoUploadForGallery}
                            disabled={leadAssessmentPhotosLocked}
                          />
                        </Button>
                      </Box>
                      {compressionStatus && (
                        <Alert
                          severity={
                            compressionStatus.type === "error"
                              ? "error"
                              : "info"
                          }
                          sx={{ mt: 2 }}
                        >
                          {compressionStatus.message}
                        </Alert>
                      )}
                    </Box>
                  )}

                  <Typography
                    variant="subtitle1"
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Photos (
                    {selectedItemForPhotos.photographs?.length || 0})
                  </Typography>
                  {selectedReferredPhotoRow ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 2 }}
                    >
                      Arrow overlays apply to main sample photos only. Referred
                      location photos are edited here without arrows.
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 2 }}
                    >
                      Open a photo to full view, then use{" "}
                      <strong>Add arrow</strong> to place overlays (same as
                      asbestos assessments).
                    </Typography>
                  )}

                  {!selectedItemForPhotos.photographs?.length ? (
                    <Box sx={{ textAlign: "center", py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No photos yet. Add your first photo above.
                      </Typography>
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      {selectedItemForPhotos.photographs.map((photo, index) => {
                        const photoKey = getPhotoKey(photo, index);
                        return (
                        <Grid item xs={12} sm={6} md={4} key={photoKey}>
                          <Card
                            sx={{
                              position: "relative",
                              height: "100%",
                              border: getCurrentLeadPhotoState(photoKey)
                                ? "3px solid #4caf50"
                                : "3px solid transparent",
                              borderRadius: 2,
                              opacity: isLeadPhotoMarkedForDeletion(photoKey)
                                ? 0.5
                                : 1,
                              filter: isLeadPhotoMarkedForDeletion(photoKey)
                                ? "grayscale(50%)"
                                : "none",
                            }}
                          >
                            <Box
                              sx={{
                                position: "relative",
                                paddingTop: "75%",
                                cursor: "pointer",
                                "&:hover": { opacity: 0.9 },
                              }}
                              onClick={() =>
                                photo.data &&
                                handleViewLeadFullSizePhoto(photo)
                              }
                            >
                              {photo.data ? (
                                <img
                                  src={photo.data}
                                  alt={`${index + 1}`}
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : galleryPhotosLoading ? (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: "grey.200",
                                  }}
                                >
                                  <CircularProgress size={40} />
                                </Box>
                              ) : (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: "grey.200",
                                    p: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    align="center"
                                  >
                                    Image unavailable
                                  </Typography>
                                </Box>
                              )}
                              {!selectedReferredPhotoRow &&
                                isMongoPhotoId(photo._id) &&
                                getLeadAssessmentPhotoArrows(photo).map(
                                  (arr, arrIdx) => {
                                    const arrowColor =
                                      arr.color || DEFAULT_PHOTO_ARROW_COLOR;
                                    const rot =
                                      arr.rotation ??
                                      DEFAULT_PHOTO_ARROW_ROTATION;
                                    const tipOff =
                                      getLeadPhotoArrowTipOffset(rot);
                                    return (
                                      <Box
                                        key={
                                          arr._id || `thumb-arrow-${arrIdx}`
                                        }
                                        sx={{
                                          position: "absolute",
                                          left: `${(arr.x ?? 0.5) * 100}%`,
                                          top: `${(arr.y ?? 0.5) * 100}%`,
                                          transform: `translate(${-tipOff.x * 100}%, ${-tipOff.y * 100}%)`,
                                          zIndex: 2,
                                          pointerEvents: "none",
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            transform: `rotate(${rot}deg)`,
                                          }}
                                        >
                                          <svg
                                            width="40"
                                            height="40"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                          >
                                            <line
                                              x1="12"
                                              y1="22"
                                              x2="12"
                                              y2="10"
                                              stroke="rgba(0,0,0,0.5)"
                                              strokeWidth="2.5"
                                              strokeLinecap="round"
                                            />
                                            <line
                                              x1="12"
                                              y1="22"
                                              x2="12"
                                              y2="10"
                                              stroke={arrowColor}
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                            />
                                            <path
                                              d="M12 2 L8 10 L16 10 Z"
                                              fill="rgba(0,0,0,0.4)"
                                              stroke="rgba(0,0,0,0.6)"
                                              strokeWidth="1"
                                              strokeLinejoin="round"
                                            />
                                            <path
                                              d="M12 2 L8 10 L16 10 Z"
                                              fill={arrowColor}
                                              stroke={arrowColor}
                                              strokeWidth="0.5"
                                              strokeLinejoin="round"
                                            />
                                          </svg>
                                        </Box>
                                      </Box>
                                    );
                                  },
                                )}
                              {isLeadPhotoMarkedForDeletion(photoKey) && (
                                <Box
                                  sx={{
                                    position: "absolute",
                                    inset: 0,
                                    backgroundColor: "rgba(244, 67, 54, 0.3)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 2,
                                  }}
                                >
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      color: "white",
                                      fontWeight: "bold",
                                      textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                                    }}
                                  >
                                    Marked for Deletion
                                  </Typography>
                                </Box>
                              )}
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 8,
                                  left: 8,
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  borderRadius: 1,
                                  padding: 0.5,
                                  zIndex: 3,
                                }}
                              >
                                <Checkbox
                                  checked={getCurrentLeadPhotoState(photoKey)}
                                  size="small"
                                  disabled={leadAssessmentPhotosLocked}
                                  sx={{
                                    color: "white",
                                    "&.Mui-checked": { color: "#4caf50" },
                                  }}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleTogglePhotoInReport(
                                      selectedItemForPhotos._id,
                                      photoKey,
                                    );
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  title={
                                    getCurrentLeadPhotoState(photoKey)
                                      ? "Remove from report"
                                      : "Include in report"
                                  }
                                />
                              </Box>
                              <IconButton
                                size="small"
                                sx={{
                                  position: "absolute",
                                  top: 48,
                                  right: 8,
                                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                                  color: "white",
                                  "&:hover": {
                                    backgroundColor: "rgba(0, 0, 0, 0.85)",
                                  },
                                  zIndex: 3,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManagePhotosDownloadTarget({
                                    photo,
                                    fileLabel: `photo-${index + 1}`,
                                  });
                                }}
                                title="Download photo"
                              >
                                <DownloadIcon sx={{ fontSize: "1.1rem" }} />
                              </IconButton>
                              <IconButton
                                size="small"
                                sx={{
                                  position: "absolute",
                                  top: 8,
                                  right: 8,
                                  backgroundColor: isLeadPhotoMarkedForDeletion(
                                    photoKey,
                                  )
                                    ? "rgba(76, 175, 80, 0.8)"
                                    : "rgba(0, 0, 0, 0.6)",
                                  color: "white",
                                  "&:hover": {
                                    backgroundColor:
                                      isLeadPhotoMarkedForDeletion(photoKey)
                                        ? "rgba(76, 175, 80, 1)"
                                        : "rgba(0, 0, 0, 0.8)",
                                  },
                                  zIndex: 3,
                                }}
                                disabled={leadAssessmentPhotosLocked}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isLeadPhotoMarkedForDeletion(photoKey)) {
                                    setPhotosToDelete((prev) => {
                                      const next = new Set(prev);
                                      next.delete(photoKey);
                                      return next;
                                    });
                                  } else {
                                    handleDeletePhotoFromItem(
                                      selectedItemForPhotos._id,
                                      photoKey,
                                    );
                                  }
                                }}
                                title={
                                  isLeadPhotoMarkedForDeletion(photoKey)
                                    ? "Undo Deletion"
                                    : "Remove Photo"
                                }
                              >
                                {isLeadPhotoMarkedForDeletion(photoKey) ? (
                                  <CheckIcon fontSize="small" />
                                ) : (
                                  <CloseIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Box>
                            <CardContent sx={{ py: 1 }}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: 500 }}
                              >
                                Photo {index + 1}
                              </Typography>
                              {editingDescriptionPhotoId === photoKey ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={getCurrentLeadPhotoDescription(
                                    photoKey,
                                    selectedItemForPhotos,
                                  )}
                                  onChange={(e) =>
                                    handleLeadPhotoDescriptionChange(
                                      photoKey,
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() =>
                                    setEditingDescriptionPhotoId(null)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      setEditingDescriptionPhotoId(null);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingDescriptionPhotoId(null);
                                      setLocalPhotoDescriptions((prev) => {
                                        const next = { ...prev };
                                        delete next[photoKey];
                                        return next;
                                      });
                                    }
                                  }}
                                  autoFocus
                                  multiline
                                  maxRows={3}
                                  variant="outlined"
                                  placeholder="Enter photo description..."
                                  sx={{
                                    "& .MuiOutlinedInput-root": {
                                      fontSize: "0.75rem",
                                    },
                                  }}
                                />
                              ) : (
                                <Box
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!leadAssessmentPhotosLocked) {
                                      setEditingDescriptionPhotoId(photoKey);
                                    }
                                  }}
                                  sx={{
                                    cursor: leadAssessmentPhotosLocked
                                      ? "default"
                                      : "pointer",
                                    p: 1,
                                    borderRadius: 1,
                                    backgroundColor: "grey.50",
                                    "&:hover": {
                                      backgroundColor: leadAssessmentPhotosLocked
                                        ? "grey.50"
                                        : "grey.100",
                                    },
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{
                                      display: "block",
                                      wordBreak: "break-word",
                                      fontStyle:
                                        photo.description ||
                                        localPhotoDescriptions[photoKey]
                                          ? "normal"
                                          : "italic",
                                    }}
                                  >
                                    {getCurrentLeadPhotoDescription(
                                      photoKey,
                                      selectedItemForPhotos,
                                    )}
                                  </Typography>
                                  {!leadAssessmentPhotosLocked && (
                                    <Typography
                                      variant="caption"
                                      color="text.disabled"
                                      sx={{
                                        fontSize: "0.65rem",
                                        mt: 0.5,
                                        display: "block",
                                      }}
                                    >
                                      Click to edit
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={async () => {
              if (hasLeadPhotoUnsavedChanges()) await saveLeadPhotoChanges();
              await handleCloseLeadPhotoGallery();
            }}
            variant="contained"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              backgroundColor: hasLeadPhotoUnsavedChanges()
                ? "#ff9800"
                : "primary.main",
              "&:hover": {
                backgroundColor: hasLeadPhotoUnsavedChanges()
                  ? "#f57c00"
                  : "primary.dark",
              },
            }}
          >
            {hasLeadPhotoUnsavedChanges() ? "Update" : "Done"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(managePhotosDownloadTarget)}
        onClose={() => setManagePhotosDownloadTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Download photo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Choose which image version to save to your device.
          </DialogContentText>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: "column",
            alignItems: "stretch",
            px: 3,
            pb: 2,
            gap: 1,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            disabled={
              !managePhotosDownloadTarget?.photo?.fullResolutionData
            }
            onClick={() => {
              void handleManagePhotosDownloadChoice("full");
            }}
          >
            Full resolution
          </Button>
          <Button
            variant="outlined"
            fullWidth
            disabled={!managePhotosDownloadTarget?.photo?.data}
            onClick={() => {
              void handleManagePhotosDownloadChoice("compressed");
            }}
          >
            Compressed
          </Button>
          <Button onClick={() => setManagePhotosDownloadTarget(null)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fullSizePhotoDialogOpen}
        onClose={() => {
          setFullSizePhotoDialogOpen(false);
          setFullSizePhotoId(null);
          setFullSizePhotoUrl(null);
          setFullSizeArrowMode(false);
          setSelectedArrowId(null);
          setMovingArrowId(null);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { bgcolor: "rgba(0, 0, 0, 0.9)" } }}
      >
        <DialogContent sx={{ p: 0, position: "relative" }}>
          <IconButton
            onClick={() => {
              setFullSizePhotoDialogOpen(false);
              setFullSizePhotoId(null);
              setFullSizePhotoUrl(null);
              setFullSizeArrowMode(false);
              setSelectedArrowId(null);
              setMovingArrowId(null);
            }}
            sx={{
              position: "absolute",
              top: 10,
              right: 10,
              color: "white",
              bgcolor: "rgba(0, 0, 0, 0.5)",
              zIndex: 10,
              "&:hover": { bgcolor: "rgba(0, 0, 0, 0.7)" },
            }}
          >
            <CloseIcon />
          </IconButton>
          {fullSizeLeadPhoto && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                pt: 6,
                pb: 2,
                px: 2,
              }}
            >
              {leadItemPhotoArrowsAvailable && (
                <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<ArrowUpwardIcon />}
                      onClick={() => {
                        setFullSizeArrowMode((prev) => !prev);
                        setMovingArrowId(null);
                      }}
                      sx={{
                        bgcolor: fullSizeArrowMode
                          ? "primary.main"
                          : "rgba(0, 0, 0, 0.65)",
                        color: "white",
                        border: "1px solid rgba(255,255,255,0.4)",
                        "&:hover": {
                          bgcolor: fullSizeArrowMode
                            ? "primary.dark"
                            : "rgba(0, 0, 0, 0.85)",
                          borderColor: "rgba(255,255,255,0.6)",
                        },
                      }}
                    >
                      Add arrow
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={
                        !selectedArrowId || selectedArrowId === "legacy"
                      }
                      startIcon={<ArrowUpwardIcon />}
                      onClick={() => {
                        setMovingArrowId(selectedArrowId);
                        setFullSizeArrowMode(false);
                      }}
                      sx={{
                        bgcolor: movingArrowId
                          ? "primary.main"
                          : "rgba(0, 0, 0, 0.5)",
                        color: "white",
                        "&:hover":
                          selectedArrowId && selectedArrowId !== "legacy"
                            ? { bgcolor: "primary.dark" }
                            : {},
                      }}
                    >
                      Move selected
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!selectedArrowId}
                      startIcon={<CloseIcon />}
                      onClick={() => {
                        if (selectedArrowId) {
                          if (selectedArrowId === "legacy") {
                            handleClearAllLeadArrows(fullSizePhotoId);
                          } else {
                            handleDeleteLeadPhotoArrow(
                              fullSizePhotoId,
                              selectedArrowId,
                            );
                          }
                          setSelectedArrowId(null);
                        }
                      }}
                      sx={{
                        bgcolor: "rgba(244, 67, 54, 0.9)",
                        color: "white",
                        "&:hover": { bgcolor: "rgba(244, 67, 54, 1)" },
                      }}
                    >
                      Delete selected
                    </Button>
                    <Typography
                      component="span"
                      sx={{
                        color: "rgba(255,255,255,0.9)",
                        fontSize: "0.85rem",
                        alignSelf: "center",
                        ml: 1,
                      }}
                    >
                      Arrow color:
                    </Typography>
                    {LEAD_PHOTO_ARROW_COLORS.map(({ name, hex }) => (
                      <Box
                        key={hex}
                        onClick={() => {
                          setSelectedArrowColor(hex);
                          if (
                            selectedArrowId &&
                            selectedArrowId !== "legacy"
                          ) {
                            handleUpdateLeadPhotoArrow(
                              fullSizePhotoId,
                              selectedArrowId,
                              { color: hex },
                            );
                          }
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          bgcolor: hex,
                          border:
                            selectedArrowColor === hex
                              ? "3px solid #2196f3"
                              : "2px solid black",
                          cursor: "pointer",
                          flexShrink: 0,
                          "&:hover": {
                            borderColor:
                              selectedArrowColor === hex
                                ? "#2196f3"
                                : "rgba(255,255,255,0.8)",
                            transform: "scale(1.1)",
                          },
                          transition: "border-color 0.15s, transform 0.15s",
                        }}
                        title={name}
                      />
                    ))}
                </Box>
              )}
              {(fullSizeArrowMode || movingArrowId) &&
                leadItemPhotoArrowsAvailable && (
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(255, 255, 255, 0.9)", mb: 1 }}
                  >
                    {movingArrowId
                      ? "Click on the photo to move the selected arrow"
                      : "Click on the photo to place a new arrow"}
                  </Typography>
                )}
              <Box
                sx={{
                  position: "relative",
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <img
                  src={fullSizePhotoUrl || fullSizeLeadPhoto.data}
                  alt="Full size"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "75vh",
                    objectFit: "contain",
                    cursor:
                      leadItemPhotoArrowsAvailable &&
                      (fullSizeArrowMode || movingArrowId)
                        ? "crosshair"
                        : "default",
                  }}
                  onClick={handleFullSizeLeadPhotoClickForArrow}
                />
                {leadItemPhotoArrowsAvailable &&
                  getLeadAssessmentPhotoArrows(fullSizeLeadPhoto).map(
                    (arr, arrIdx) => {
                      const arrowColor =
                        arr.color || DEFAULT_PHOTO_ARROW_COLOR;
                      const isSelected = selectedArrowId === arr._id;
                      const rot =
                        arr.rotation ?? DEFAULT_PHOTO_ARROW_ROTATION;
                      const tipOff = getLeadPhotoArrowTipOffset(rot);
                      return (
                        <Box
                          key={arr._id || `fs-arrow-${arrIdx}`}
                          sx={{
                            position: "absolute",
                            left: `${(arr.x ?? 0.5) * 100}%`,
                            top: `${(arr.y ?? 0.5) * 100}%`,
                            transform: `translate(${-tipOff.x * 100}%, ${-tipOff.y * 100}%)`,
                            pointerEvents: "auto",
                            cursor: "pointer",
                            outline: isSelected ? "3px solid white" : "none",
                            outlineOffset: 2,
                            borderRadius: 1,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedArrowId(arr._id || "legacy");
                            setSelectedArrowColor(
                              arr.color || DEFAULT_PHOTO_ARROW_COLOR,
                            );
                          }}
                        >
                          <Box sx={{ transform: `rotate(${rot}deg)` }}>
                            <svg
                              width="56"
                              height="56"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              style={{ pointerEvents: "none" }}
                            >
                              <line
                                x1="12"
                                y1="22"
                                x2="12"
                                y2="10"
                                stroke="rgba(0,0,0,0.5)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                              <line
                                x1="12"
                                y1="22"
                                x2="12"
                                y2="10"
                                stroke={arrowColor}
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <path
                                d="M12 2 L8 10 L16 10 Z"
                                fill="rgba(0,0,0,0.4)"
                                stroke="rgba(0,0,0,0.6)"
                                strokeWidth="1"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M12 2 L8 10 L16 10 Z"
                                fill={arrowColor}
                                stroke={arrowColor}
                                strokeWidth="0.5"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </Box>
                        </Box>
                      );
                    },
                  )}
                <IconButton
                  size="small"
                  sx={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "rgba(0, 0, 0, 0.85)",
                    },
                    zIndex: 6,
                  }}
                  disabled={
                    leadAssessmentPhotosLocked ||
                    !!rotatingPhotoId ||
                    !fullSizeLeadPhoto.data
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRotateLeadPhoto90Cw(fullSizeLeadPhoto);
                  }}
                  title="Rotate 90° clockwise"
                >
                  <RotateRightIcon sx={{ fontSize: "1.25rem" }} />
                </IconButton>
              </Box>
            </Box>
          )}
          {fullSizePhotoUrl && !fullSizeLeadPhoto && (
            <img
              src={fullSizePhotoUrl}
              alt="Full size"
              style={{ width: "100%", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>

      

      {cameraDialogOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              height: "100dvh",
              maxHeight: "-webkit-fill-available",
              backgroundColor: "#000",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              {stream ? (
                <video
                  ref={(ref) => {
                    setVideoRef(ref);
                    if (ref && stream) ref.srcObject = stream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    color: "white",
                  }}
                >
                  <CircularProgress color="inherit" />
                  <Typography variant="body1">Starting camera...</Typography>
                </Box>
              )}
            </Box>
            <Box
              sx={{
                position: "absolute",
                right: "env(safe-area-inset-right)",
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                padding: 1,
              }}
            >
              <Button
                onClick={handleCloseLeadCamera}
                variant="outlined"
                size="medium"
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                  bgcolor: "rgba(0,0,0,0.4)",
                  color: "white",
                  borderColor: "rgba(255,255,255,0.6)",
                  "&:hover": {
                    bgcolor: "rgba(0,0,0,0.6)",
                    borderColor: "rgba(255,255,255,0.9)",
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCaptureLeadPhoto}
                variant="contained"
                color="primary"
                size="medium"
                startIcon={<PhotoCameraIcon />}
                disabled={!stream}
                sx={{
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                Capture
              </Button>
            </Box>
          </Box>,
          document.body,
        )}

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
