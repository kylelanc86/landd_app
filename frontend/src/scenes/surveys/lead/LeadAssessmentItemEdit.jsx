import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  TextField,
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
  Alert,
  Grid,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import customDataFieldGroupService from "../../../services/customDataFieldGroupService";
import { useSnackbar } from "../../../context/SnackbarContext";

const SAMPLE_TYPE_OPTIONS = [
  { value: "paint", label: "Paint" },
  { value: "paint-xrf", label: "Paint (XRF)" },
  { value: "dust", label: "Dust" },
  { value: "soil", label: "Soil" },
];

function materialTypePayloadFromSampleType(sampleType) {
  if (sampleType === "paint") return "Paint";
  if (sampleType === "dust") return "Dust";
  if (sampleType === "soil") return "Soil";
  if (sampleType === "paint-xrf") return "Paint-xrf";
  return `${String(sampleType).charAt(0).toUpperCase()}${String(sampleType).slice(1)}`;
}

const PAINT_COLOUR_OPTIONS = [
  "White",
  "Beige",
  "Black",
  "Blue",
  "Brown",
  "Charcoal",
  "Cream",
  "Green",
  "Grey",
  "Light Grey",
  "Light Blue",
  "Light Green",
  "Orange",
  "Pink",
  "Purple",
  "Red",
  "Yellow",
];

const SOIL_ASSESSMENT_CRITERIA_OPTIONS = [
  "HIL A (300mg/kg)",
  "HIL B (1200mg/kg)",
  "HIL C (600mg/kg)",
  "HIL D (1500mg/kg)",
];

const OCCUPANT_RATING_OPTIONS = [
  { value: 1, label: "Adult" },
  { value: 2, label: "Adolescent (high school)" },
  { value: 3, label: "Child (preschool & primary)" },
];

const LOCATION_RATING_OPTIONS = [
  { value: 1, label: "High-level/inaccessible surface (e.g. ceiling/top of cupboard)" },
  { value: 2, label: "Low contact surface (e.g. floor/wall/soil)" },
  { value: 3, label: "High contact surface (desk/door/window/playground equipment)" },
];

const ROOM_USE_OPTIONS = [
  { value: 1, label: "Occasional use (e.g. cleaners' cupboard)" },
  { value: 2, label: "Daily, infrequent use (e.g. bathrooms)" },
  { value: 3, label: "Daily, heavy use (e.g. office, classroom)" },
];

const CONDITION_RATING_OPTIONS = [
  { value: 1, label: "Good/stable condition" },
  { value: 2, label: "Minor flaking" },
  { value: 3, label: "Severe flaking/ loose flakes" },
  { value: 4, label: "Lead dust" },
];

const LEAD_DUST_CONDITION_RATING = 4;

const DUST_SAMPLE_AREA_OPTIONS = [
  { value: "small", label: "Small – 0.01 m²" },
  { value: "medium", label: "Medium – 0.0258 m²" },
  { value: "large", label: "Large – 0.09 m²" },
];

function normalizeLeadSampleAreaFromStored(stored) {
  if (stored == null || stored === "") return "";
  const s = String(stored).toLowerCase().trim();
  if (["small", "medium", "large"].includes(s)) return s;
  if (s.includes("0.01")) return "small";
  if (s.includes("0.0258")) return "medium";
  if (s.includes("0.09")) return "large";
  return "";
}

function getRiskLevelLabel(product) {
  if (product == null || product < 7) return "VERY LOW RISK";
  if (product <= 18) return "LOW RISK";
  if (product <= 35) return "MEDIUM RISK";
  return "HIGH RISK";
}

function parseLeadNumeric(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numeric = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function parseSoilThreshold(criteria) {
  if (!criteria) return null;
  const match = String(criteria).match(/\(([\d.]+)\s*mg\/kg\)/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseSampleAreaM2(sampleArea) {
  if (sampleArea == null || sampleArea === "") return null;
  const s = String(sampleArea).toLowerCase().trim();
  if (s === "small" || s.includes("0.01")) return 0.01;
  if (s === "medium" || s.includes("0.0258")) return 0.0258;
  if (s === "large" || s.includes("0.09")) return 0.09;
  const numeric = Number(s.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

const emptyReferredLocation = () => ({
  levelFloor: "",
  roomArea: "",
  surfaceDescription: "",
  occupantRating: "",
  locationRating: "",
  roomUseRating: "",
  conditionRating: "",
  sameAsSampledItem: true,
  recommendationActions: "",
  photographs: [],
});

const LeadAssessmentItemEdit = () => {
  const { id, itemId } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [assessment, setAssessment] = useState(null);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [sampleType, setSampleType] = useState("");
  const [sampleRef, setSampleRef] = useState("");
  const [showLevelFloor, setShowLevelFloor] = useState(false);
  const [levelFloor, setLevelFloor] = useState("");
  const [roomArea, setRoomArea] = useState("");
  const [surfaceDescriptionValues, setSurfaceDescriptionValues] = useState([]);
  const [dustSurfaceDescription, setDustSurfaceDescription] = useState("");
  const [leadSurfaceDescriptionOptions, setLeadSurfaceDescriptionOptions] = useState([]);
  const [surfaceDescriptionInput, setSurfaceDescriptionInput] = useState("");
  const [paintColour, setPaintColour] = useState("");
  const [leadSampleArea, setLeadSampleArea] = useState("");
  const [soilSampleLocation, setSoilSampleLocation] = useState("");
  const [leadContent] = useState("");
  const [occupantRating, setOccupantRating] = useState("");
  const [locationRating, setLocationRating] = useState("");
  const [roomUseRating, setRoomUseRating] = useState("");
  const [conditionRating, setConditionRating] = useState("");
  const [recommendedControlMeasures, setRecommendedControlMeasures] = useState("");
  const [referredLocations, setReferredLocations] = useState([]);
  const [referredModalOpen, setReferredModalOpen] = useState(false);
  const [referredEditIndex, setReferredEditIndex] = useState(null);
  const [referredModalForm, setReferredModalForm] = useState(emptyReferredLocation());
  const [referredSurfaceInput, setReferredSurfaceInput] = useState("");
  const [showReferredLevelFloor, setShowReferredLevelFloor] = useState(false);
  const [referredPhotosManagerOpen, setReferredPhotosManagerOpen] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationTarget, setDictationTarget] = useState(null);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef(null);
  const referredPhotoInputRef = useRef(null);

  const filesToDataUrls = async (fileList) => {
    const files = Array.from(fileList || []);
    const readers = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
          reader.readAsDataURL(file);
        }),
    );
    const out = await Promise.all(readers);
    return out.filter((x) => typeof x === "string" && x.startsWith("data:image/"));
  };

  const riskProduct =
    occupantRating !== "" &&
    locationRating !== "" &&
    roomUseRating !== "" &&
    conditionRating !== ""
      ? Number(occupantRating) * Number(locationRating) * Number(roomUseRating) * Number(conditionRating)
      : null;
  const riskLevelLabel = riskProduct != null ? getRiskLevelLabel(riskProduct) : null;

  const referredRiskProduct =
    referredModalForm.occupantRating !== "" &&
    referredModalForm.locationRating !== "" &&
    referredModalForm.roomUseRating !== "" &&
    referredModalForm.conditionRating !== ""
      ? Number(referredModalForm.occupantRating) * Number(referredModalForm.locationRating) *
        Number(referredModalForm.roomUseRating) * Number(referredModalForm.conditionRating)
      : null;
  const referredRiskLevelLabel = referredRiskProduct != null ? getRiskLevelLabel(referredRiskProduct) : null;

  useEffect(() => {
    let cancelled = false;
    const fetchAssessment = async () => {
      if (!id || !itemId) {
        setLoading(false);
        return;
      }
      try {
        const response = await asbestosAssessmentService.getById(id);
        const data = response?.data || response;
        if (cancelled) return;
        setAssessment(data);
        const found = Array.isArray(data?.items) ? data.items.find((i) => i._id === itemId) : null;
        setItem(found || null);
      } catch (err) {
        if (!cancelled) {
          setAssessment(null);
          setItem(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAssessment();
    return () => { cancelled = true; };
  }, [id, itemId]);

  useEffect(() => {
    let cancelled = false;
    const fetchLeadSurfaceDescriptions = async () => {
      try {
        const data = await customDataFieldGroupService.getFieldsByType("lead_surface_description");
        if (cancelled) return;
        const raw = Array.isArray(data) ? data : data?.data ?? data?.fields ?? data?.items ?? [];
        const options = raw
          .map((f) => (typeof f === "string" ? f : f?.text ?? f?.name ?? ""))
          .filter(Boolean);
        setLeadSurfaceDescriptionOptions([...new Set(options)].sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        if (!cancelled) setLeadSurfaceDescriptionOptions([]);
      }
    };
    fetchLeadSurfaceDescriptions();
    return () => { cancelled = true; };
  }, []);

  const assessmentTypes = assessment?.assessmentType ?? [];
  const sampleTypeOptions = SAMPLE_TYPE_OPTIONS.filter((opt) =>
    assessmentTypes.map((t) => String(t).toLowerCase()).includes(opt.value),
  );

  const isDust = sampleType === "dust";
  const isSoil = sampleType === "soil";

  const surfaceDescriptionValuesRef = useRef(surfaceDescriptionValues);
  surfaceDescriptionValuesRef.current = surfaceDescriptionValues;
  const dustSurfaceDescriptionRef = useRef(dustSurfaceDescription);
  dustSurfaceDescriptionRef.current = dustSurfaceDescription;
  const prevSampleTypeRef = useRef("");

  // Dust: fixed condition; migrate surface fields when switching between dust and paint/soil.
  useEffect(() => {
    const prev = prevSampleTypeRef.current;

    if (sampleType === "dust") {
      setConditionRating(String(LEAD_DUST_CONDITION_RATING));
      if (prev && prev !== "dust") {
        setDustSurfaceDescription(surfaceDescriptionValuesRef.current.join(", "));
        setSurfaceDescriptionValues([]);
        setSurfaceDescriptionInput("");
      }
    } else if (sampleType && sampleType !== "dust") {
      setLeadSampleArea("");
      setConditionRating((p) => (p === String(LEAD_DUST_CONDITION_RATING) ? "" : p));
      if (prev === "dust") {
        const t = dustSurfaceDescriptionRef.current.trim();
        setSurfaceDescriptionValues(t ? t.split(",").map((s) => s.trim()).filter(Boolean) : []);
        setDustSurfaceDescription("");
        setSurfaceDescriptionInput("");
      }
    }

    if (sampleType !== "soil") {
      setSoilSampleLocation("");
    }

    prevSampleTypeRef.current = sampleType;
  }, [sampleType]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* no-op */ }
      }
    };
  }, []);

  const appendTranscript = (setter, transcript) => {
    setter((prev) => {
      const isFirstWord = !prev || prev.trim().length === 0;
      const normalized = isFirstWord
        ? transcript.charAt(0).toUpperCase() + transcript.slice(1)
        : transcript;
      return `${prev || ""}${prev ? " " : ""}${normalized}`.trim();
    });
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* no-op */ }
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setDictationTarget(null);
  };

  const startDictation = (target) => {
    if (isDictating) stopDictation();
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setDictationError("Speech recognition is not supported in this browser.");
      return;
    }
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-AU";
      recognition.onstart = () => {
        setIsDictating(true);
        setDictationTarget(target);
        setDictationError("");
      };
      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (!finalTranscript) return;
        if (target === "dustSurfaceDescription") appendTranscript(setDustSurfaceDescription, finalTranscript);
        if (target === "soilSampleLocation") appendTranscript(setSoilSampleLocation, finalTranscript);
        if (target === "recommendedControlMeasures") appendTranscript(setRecommendedControlMeasures, finalTranscript);
        if (target === "referredRecommendationActions") {
          setReferredModalForm((prev) => ({
            ...prev,
            recommendationActions: `${prev.recommendationActions || ""}${prev.recommendationActions ? " " : ""}${finalTranscript}`.trim(),
          }));
        }
      };
      recognition.onerror = (event) => {
        setDictationError(`Dictation error: ${event.error}`);
        setIsDictating(false);
        setDictationTarget(null);
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        setIsDictating(false);
        setDictationTarget(null);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setDictationError("Failed to start dictation. Please try again.");
    }
  };

  // Populate form when editing an existing item
  useEffect(() => {
    if (!item) {
      setFormReady(false);
      return;
    }
    const sr = (item.sampleReference || "").replace(/^LD-/i, "");
    setSampleRef(sr);
    const mt = (item.materialType || "").toLowerCase();
    setSampleType(mt);
    setPaintColour(item.paintColour || "");
    setLeadSampleArea(normalizeLeadSampleAreaFromStored(item.leadSampleArea));
    const hasLevel = Boolean((item.levelFloor || "").trim());
    setShowLevelFloor(hasLevel);
    setLevelFloor(item.levelFloor || "");
    setRoomArea(item.roomArea || "");
    if (mt === "dust") {
      setDustSurfaceDescription(item.locationDescription || "");
      setSurfaceDescriptionValues([]);
      setSurfaceDescriptionInput("");
      setSoilSampleLocation("");
    } else if (mt === "soil") {
      setSoilSampleLocation(item.locationDescription || "");
      setSurfaceDescriptionValues([]);
      setDustSurfaceDescription("");
      setSurfaceDescriptionInput("");
    } else {
      setSurfaceDescriptionValues(
        (item.locationDescription || "").split(",").map((s) => s.trim()).filter(Boolean),
      );
      setDustSurfaceDescription("");
      setSoilSampleLocation("");
      setSurfaceDescriptionInput("");
    }
    setOccupantRating(item.occupantRating != null && item.occupantRating !== "" ? String(item.occupantRating) : "");
    setLocationRating(item.locationRating != null && item.locationRating !== "" ? String(item.locationRating) : "");
    setRoomUseRating(item.roomUseRating != null && item.roomUseRating !== "" ? String(item.roomUseRating) : "");
    setConditionRating(item.conditionRating != null && item.conditionRating !== "" ? String(item.conditionRating) : "");
    setRecommendedControlMeasures(item.recommendationActions || "");
    setReferredLocations(
      (item.referredLocations || []).map((r) => ({
        levelFloor: r.levelFloor || "",
        roomArea: r.roomArea || "",
        surfaceDescription: r.surfaceDescription || "",
        occupantRating: r.occupantRating != null && r.occupantRating !== "" ? String(r.occupantRating) : "",
        locationRating: r.locationRating != null && r.locationRating !== "" ? String(r.locationRating) : "",
        roomUseRating: r.roomUseRating != null && r.roomUseRating !== "" ? String(r.roomUseRating) : "",
        conditionRating: r.conditionRating != null && r.conditionRating !== "" ? String(r.conditionRating) : "",
        recommendationActions: r.recommendationActions || "",
        sameAsSampledItem: !r.recommendationActions || r.recommendationActions === (item.recommendationActions || ""),
      })),
    );
    setFormReady(true);
  }, [item]);

  const openReferredModal = (editIndex = null) => {
    const defaultSurface = isDust
      ? (dustSurfaceDescription || "")
      : surfaceDescriptionValues
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ");
    const defaultLevelFloor = showLevelFloor ? (levelFloor || "") : "";
    setReferredSurfaceInput("");
    setShowReferredLevelFloor(Boolean(defaultLevelFloor));
    setReferredEditIndex(editIndex);
    if (editIndex != null && referredLocations[editIndex]) {
      const existing = referredLocations[editIndex];
      setReferredModalForm({
        ...emptyReferredLocation(),
        ...existing,
        photographs: Array.isArray(existing.photographs) ? existing.photographs : [],
      });
      setShowReferredLevelFloor(Boolean((existing.levelFloor || "").trim()));
    } else {
      setReferredModalForm({
        ...emptyReferredLocation(),
        levelFloor: defaultLevelFloor,
        roomArea: roomArea || "",
        surfaceDescription: defaultSurface,
        occupantRating: occupantRating || "",
        locationRating: locationRating || "",
        roomUseRating: roomUseRating || "",
        conditionRating: isDust ? String(LEAD_DUST_CONDITION_RATING) : "",
      });
    }
    setReferredModalOpen(true);
  };

  const closeReferredModal = () => {
    setReferredModalOpen(false);
    setReferredPhotosManagerOpen(false);
    setReferredModalForm(emptyReferredLocation());
    setReferredEditIndex(null);
    setShowReferredLevelFloor(false);
  };

  const addReferredFromModal = () => {
    const r = referredModalForm;
    const hasAny = r.levelFloor?.trim() || r.roomArea?.trim() || r.surfaceDescription?.trim() ||
      r.occupantRating !== "" || r.locationRating !== "" || r.roomUseRating !== "" || r.conditionRating !== "" ||
      (!r.sameAsSampledItem && (r.recommendationActions || "").trim()) ||
      (Array.isArray(r.photographs) && r.photographs.length > 0);
    if (!hasAny) return;
    setReferredLocations((prev) => {
      if (referredEditIndex != null && prev[referredEditIndex]) {
        return prev.map((row, idx) => (idx === referredEditIndex ? { ...r } : row));
      }
      return [...prev, { ...r }];
    });
    closeReferredModal();
  };

  const removeReferredRow = (index) => {
    setReferredLocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReferredPhotoFiles = async (event) => {
    const files = event?.target?.files;
    if (!files || files.length === 0) return;
    try {
      const dataUrls = await filesToDataUrls(files);
      if (dataUrls.length === 0) return;
      setReferredModalForm((prev) => {
        const existing = Array.isArray(prev.photographs) ? prev.photographs : [];
        const nextPhotos = [
          ...existing,
          ...dataUrls.map((data) => ({ data, includeInReport: true })),
        ];
        return { ...prev, photographs: nextPhotos };
      });
    } finally {
      event.target.value = "";
    }
  };

  const removeReferredPhoto = (photoIndex) => {
    setReferredModalForm((prev) => ({
      ...prev,
      photographs: (Array.isArray(prev.photographs) ? prev.photographs : []).filter(
        (_, idx) => idx !== photoIndex,
      ),
    }));
  };

  const getReferredRisk = (row) => {
    const o = row.occupantRating;
    const l = row.locationRating;
    const u = row.roomUseRating;
    const c = row.conditionRating;
    if (o === "" || o == null || l === "" || l == null || u === "" || u == null || c === "" || c == null) return null;
    const product = Number(o) * Number(l) * Number(u) * Number(c);
    return { product, label: getRiskLevelLabel(product) };
  };

  const handleSubmit = async () => {
    if (!sampleType) {
      setSubmitError("Please select a sample type.");
      return;
    }
    if (!sampleRef || !sampleRef.trim()) {
      setSubmitError("Sample reference is required.");
      return;
    }
    if (sampleType === "dust") {
      if (!dustSurfaceDescription?.trim()) {
        setSubmitError("Surface description is required.");
        return;
      }
    } else if (sampleType === "soil") {
      if (!soilSampleLocation?.trim()) {
        setSubmitError("Sample location is required for soil samples.");
        return;
      }
    } else if (!surfaceDescriptionValues || surfaceDescriptionValues.length === 0) {
      setSubmitError("At least one surface description is required.");
      return;
    }
    if (sampleType === "dust" && !leadSampleArea) {
      setSubmitError("Please select a sample area for dust samples.");
      return;
    }
    if (sampleType === "soil" && !paintColour) {
      setSubmitError("Please select an assessment criteria for soil samples.");
      return;
    }

    setSubmitLoading(true);
    setSubmitError(null);

    try {
      const itemLeadContent = item?.leadContent ?? leadContent;
      const isNegativeItem = (() => {
        const leadValue = parseLeadNumeric(itemLeadContent);
        if (leadValue == null) return false;
        if (sampleType === "paint" || sampleType === "paint-xrf") return leadValue <= 0.1;
        if (sampleType === "soil") {
          const threshold = parseSoilThreshold(paintColour);
          if (threshold == null) return false;
          return leadValue < threshold;
        }
        if (sampleType === "dust") {
          const area = parseSampleAreaM2(leadSampleArea);
          const rating = Number(locationRating);
          const thresholds = { 1: 1.08, 2: 0.43, 3: 0.11 };
          const threshold = thresholds[rating];
          if (!area || !threshold) return false;
          const concentration = (leadValue / 1000) / area;
          return concentration < threshold;
        }
        return false;
      })();
      const recommendationActionsValue = (recommendedControlMeasures || "").trim() || (isNegativeItem ? "No action required" : "");
      const referred = referredLocations.filter(
        (r) =>
          r.levelFloor?.trim() ||
          r.roomArea?.trim() ||
          r.surfaceDescription?.trim() ||
          r.occupantRating !== "" ||
          r.locationRating !== "" ||
          r.roomUseRating !== "" ||
          r.conditionRating !== "" ||
          (Array.isArray(r.photographs) && r.photographs.length > 0) ||
          (!r.sameAsSampledItem && (r.recommendationActions || "").trim()),
      ).map((r) => ({
        levelFloor: r.levelFloor?.trim() || undefined,
        roomArea: r.roomArea?.trim() || undefined,
        surfaceDescription: r.surfaceDescription?.trim() || undefined,
        occupantRating: r.occupantRating !== "" ? Number(r.occupantRating) : undefined,
        locationRating: r.locationRating !== "" ? Number(r.locationRating) : undefined,
        roomUseRating: r.roomUseRating !== "" ? Number(r.roomUseRating) : undefined,
        conditionRating: r.conditionRating !== "" ? Number(r.conditionRating) : undefined,
        recommendationActions: r.sameAsSampledItem
          ? (recommendationActionsValue || undefined)
          : ((r.recommendationActions || "").trim() || undefined),
        photographs: Array.isArray(r.photographs) && r.photographs.length > 0
          ? r.photographs
              .map((p) =>
                typeof p === "string"
                  ? { data: p, includeInReport: true }
                  : p && typeof p.data === "string"
                    ? {
                        data: p.data,
                        includeInReport: p.includeInReport !== false,
                        description: p.description || undefined,
                      }
                    : null,
              )
              .filter(Boolean)
          : undefined,
      }));
      const fullSampleRef = sampleRef.trim() ? `LD-${sampleRef.trim()}` : "";
      const isDustItem = sampleType === "dust";
      const itemPayload = {
        sampleReference: fullSampleRef,
        levelFloor: sampleType === "soil" ? undefined : (levelFloor.trim() || undefined),
        roomArea: sampleType === "soil" ? undefined : (roomArea.trim() || undefined),
        locationDescription: sampleType === "soil"
          ? soilSampleLocation.trim()
          : isDustItem
          ? dustSurfaceDescription.trim()
          : surfaceDescriptionValues.map((s) => s.trim()).filter(Boolean).join(", "),
        materialType: materialTypePayloadFromSampleType(sampleType),
        ...(isDustItem
          ? {
              leadSampleArea: leadSampleArea || undefined,
              paintColour: undefined,
              conditionRating: LEAD_DUST_CONDITION_RATING,
            }
          : {
              paintColour: paintColour.trim() || undefined,
              leadSampleArea: undefined,
              conditionRating: conditionRating !== "" ? Number(conditionRating) : undefined,
            }),
        leadContent: leadContent.trim() || undefined,
        recommendationActions: recommendationActionsValue || undefined,
        occupantRating: sampleType === "soil" ? undefined : (occupantRating !== "" ? Number(occupantRating) : undefined),
        locationRating: sampleType === "soil" ? undefined : (locationRating !== "" ? Number(locationRating) : undefined),
        roomUseRating: sampleType === "soil" ? undefined : (roomUseRating !== "" ? Number(roomUseRating) : undefined),
        referredLocations: referred.length ? referred : undefined,
      };
      await asbestosAssessmentService.updateItem(id, itemId, itemPayload);
      showSnackbar("Assessment item updated.", "success");
      navigate(`/surveys/lead/${id}/items`);
    } catch (err) {
      console.error("Error updating lead assessment item:", err);
      setSubmitError(
        err.response?.data?.message || err.message || "Failed to update item",
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancel = () => {
    navigate(`/surveys/lead/${id}/items`);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={24} />
          <Typography>Loading…</Typography>
        </Box>
      </Box>
    );
  }

  if (!assessment || assessment.jobType !== "lead-assessment") {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/surveys/lead")} sx={{ mb: 2 }}>
          Back to Lead Assessment
        </Button>
        <Typography color="text.secondary">Assessment not found or not a lead assessment.</Typography>
      </Box>
    );
  }

  if (!loading && assessment && !item) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/surveys/lead/${id}/items`)} sx={{ mb: 2 }}>
          Back to Lead Assessment Items
        </Button>
        <Typography color="text.secondary">Assessment item not found.</Typography>
      </Box>
    );
  }

  if (item && !formReady) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={24} />
          <Typography>Loading item…</Typography>
        </Box>
      </Box>
    );
  }

  const projectID = assessment?.projectId?.projectID ?? "";
  const projectName = assessment?.projectId?.name ?? "";

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, width: "100%" }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleCancel}
        sx={{ mb: 2 }}
      >
        Back to Lead Assessment Items
      </Button>

      <Typography variant="h4" component="h1" gutterBottom>
        Edit Lead Assessment Item
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {projectID}
        {projectName ? ` – ${projectName}` : ""}
      </Typography>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth required>
            <InputLabel>Sample Type</InputLabel>
            <Select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              label="Sample Type"
            >
              {sampleTypeOptions.length === 0 ? (
                <MenuItem disabled value="">
                  No types (set assessment types on the job first)
                </MenuItem>
              ) : (
                sampleTypeOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Sample Reference"
            value={sampleRef}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("LD-")) setSampleRef(v.slice(3));
              else setSampleRef(v);
            }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">LD-</InputAdornment>
              ),
            }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          {isDust ? (
            <FormControl fullWidth required>
              <InputLabel>Sample area</InputLabel>
              <Select
                value={leadSampleArea}
                onChange={(e) => setLeadSampleArea(e.target.value)}
                label="Sample area"
              >
                {DUST_SAMPLE_AREA_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : isSoil ? (
            <FormControl fullWidth required>
              <InputLabel>Assessment criteria</InputLabel>
              <Select
                value={paintColour}
                onChange={(e) => setPaintColour(e.target.value)}
                label="Assessment criteria"
              >
                {SOIL_ASSESSMENT_CRITERIA_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>
                    {opt}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Autocomplete
              freeSolo
              options={PAINT_COLOUR_OPTIONS}
              value={paintColour || null}
              onChange={(_, newValue) => setPaintColour(newValue || "")}
              onInputChange={(_, newInputValue) => setPaintColour(newInputValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Paint Colour"
                />
              )}
            />
          )}
        </Grid>

      </Grid>

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Sample Location
      </Typography>
      {isSoil ? (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Sample Location"
              required
              value={soilSampleLocation}
              onChange={(e) => setSoilSampleLocation(e.target.value)}
              helperText="Enter a custom sample location description"
              sx={{ flex: 1, minWidth: { xs: "100%", sm: 320 } }}
            />
            <Button
              size="small"
              variant={isDictating && dictationTarget === "soilSampleLocation" ? "contained" : "outlined"}
              color={isDictating && dictationTarget === "soilSampleLocation" ? "error" : "primary"}
              startIcon={isDictating && dictationTarget === "soilSampleLocation" ? <StopIcon /> : <MicIcon />}
              onClick={() => (
                isDictating && dictationTarget === "soilSampleLocation"
                  ? stopDictation()
                  : startDictation("soilSampleLocation")
              )}
            >
              {isDictating && dictationTarget === "soilSampleLocation" ? "Stop Dictation" : "Dictate"}
            </Button>
          </Box>
        </Grid>
      </Grid>
      ) : (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showLevelFloor}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowLevelFloor(checked);
                  if (!checked) setLevelFloor("");
                }}
              />
            }
            label="Include Level/Floor"
          />
        </Grid>
        {showLevelFloor && (
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Level/Floor"
              value={levelFloor}
              onChange={(e) => setLevelFloor(e.target.value)}
            />
          </Grid>
        )}
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Room/Area"
            value={roomArea}
            onChange={(e) => setRoomArea(e.target.value)}
          />
        </Grid>

        <Grid item xs={12}>
          {isDust ? (
            <>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Surface Description"
                  required
                  value={dustSurfaceDescription}
                  onChange={(e) => setDustSurfaceDescription(e.target.value)}
                  sx={{ flex: 1, minWidth: { xs: "100%", sm: 320 } }}
                />
                <Button
                  size="small"
                  variant={isDictating && dictationTarget === "dustSurfaceDescription" ? "contained" : "outlined"}
                  color={isDictating && dictationTarget === "dustSurfaceDescription" ? "error" : "primary"}
                  startIcon={isDictating && dictationTarget === "dustSurfaceDescription" ? <StopIcon /> : <MicIcon />}
                  onClick={() => (
                    isDictating && dictationTarget === "dustSurfaceDescription"
                      ? stopDictation()
                      : startDictation("dustSurfaceDescription")
                  )}
                >
                  {isDictating && dictationTarget === "dustSurfaceDescription" ? "Stop Dictation" : "Dictate"}
                </Button>
              </Box>
            </>
          ) : (
            <Autocomplete
              multiple
              freeSolo
              options={leadSurfaceDescriptionOptions}
              value={surfaceDescriptionValues}
              onChange={(_, newValue) => setSurfaceDescriptionValues(newValue)}
              inputValue={surfaceDescriptionInput}
              onInputChange={(_, newInputValue) => setSurfaceDescriptionInput(newInputValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Surface Description"
                  required={surfaceDescriptionValues.length === 0}
                  helperText="Select from the list or type and press Enter to add a custom option"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const trimmed = surfaceDescriptionInput.trim();
                    if (!trimmed) return;
                    e.preventDefault();
                    setSurfaceDescriptionValues((prev) =>
                      prev.includes(trimmed) ? prev : [...prev, trimmed],
                    );
                    setSurfaceDescriptionInput("");
                  }}
                />
              )}
            />
          )}
        </Grid>
      </Grid>
      )}
      {dictationError && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {dictationError}
        </Alert>
      )}

      {!isSoil && (
      <>
      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Risk Rating
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Occupant rating</InputLabel>
            <Select
              value={occupantRating}
              onChange={(e) => setOccupantRating(e.target.value)}
              label="Occupant rating"
            >
              {OCCUPANT_RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Location rating</InputLabel>
            <Select
              value={locationRating}
              onChange={(e) => setLocationRating(e.target.value)}
              label="Location rating"
            >
              {LOCATION_RATING_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth>
            <InputLabel>Room Use</InputLabel>
            <Select
              value={roomUseRating}
              onChange={(e) => setRoomUseRating(e.target.value)}
              label="Room Use"
            >
              {ROOM_USE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          {isDust ? (
            <TextField
              fullWidth
              label="Condition"
              value="Lead dust"
              disabled
              helperText="Fixed for dust samples"
            />
          ) : (
            <FormControl fullWidth>
              <InputLabel>Condition</InputLabel>
              <Select
                value={conditionRating}
                onChange={(e) => setConditionRating(e.target.value)}
                label="Condition"
              >
                {CONDITION_RATING_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Grid>
        {riskProduct != null && (
          <Grid item xs={12}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 1,
                bgcolor:
                  riskLevelLabel === "HIGH RISK"
                    ? "error.light"
                    : riskLevelLabel === "MEDIUM RISK"
                      ? "yellow"
                      : riskLevelLabel === "LOW RISK"
                        ? "info.light"
                        : "success.light",
                color:
                  riskLevelLabel === "HIGH RISK"
                    ? "error.contrastText"
                    : riskLevelLabel === "MEDIUM RISK"
                      ? "grey.900"
                      : riskLevelLabel === "LOW RISK"
                        ? "info.contrastText"
                        : "success.contrastText",
                fontWeight: 600,
              }}
            >
              Risk rating: {riskProduct} — {riskLevelLabel}
            </Box>
          </Grid>
        )}
      </Grid>
      </>
      )}

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Recommended Control Measures
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap", mb: 1 }}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="Recommended Control Measures"
          value={recommendedControlMeasures}
          onChange={(e) => setRecommendedControlMeasures(e.target.value)}
          placeholder="Enter recommendation actions/comments"
          helperText="If the result is negative, this defaults to 'No action required' in the report."
          sx={{ flex: 1, minWidth: { xs: "100%", sm: 320 } }}
        />
        <Button
          size="small"
          variant={isDictating && dictationTarget === "recommendedControlMeasures" ? "contained" : "outlined"}
          color={isDictating && dictationTarget === "recommendedControlMeasures" ? "error" : "primary"}
          startIcon={isDictating && dictationTarget === "recommendedControlMeasures" ? <StopIcon /> : <MicIcon />}
          onClick={() => (
            isDictating && dictationTarget === "recommendedControlMeasures"
              ? stopDictation()
              : startDictation("recommendedControlMeasures")
          )}
        >
          {isDictating && dictationTarget === "recommendedControlMeasures" ? "Stop Dictation" : "Dictate"}
        </Button>
      </Box>

      <Typography variant="subtitle1" fontWeight="600" sx={{ mt: 3, mb: 1 }}>
        Referred Locations
      </Typography>
      <Button
        startIcon={<AddIcon />}
        onClick={() => openReferredModal(null)}
        size="small"
        sx={{ mb: 1 }}
      >
        Add Referred Location
      </Button>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
          <TableHead>
            <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
              {referredLocations.some((r) => (r.levelFloor || "").trim() !== "") && (
                <TableCell sx={{ fontWeight: "bold", width: "20%" }}>Level/Floor</TableCell>
              )}
              <TableCell sx={{ fontWeight: "bold", width: referredLocations.some((r) => (r.levelFloor || "").trim() !== "") ? "20%" : "20%" }}>
                Room/Area
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", width: "45%" }}>Surface Description</TableCell>
              <TableCell sx={{ fontWeight: "bold", width: referredLocations.some((r) => (r.levelFloor || "").trim() !== "") ? "15%" : "20%" }}>
                Risk
              </TableCell>
              <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130, px: 1 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {referredLocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={referredLocations.some((r) => (r.levelFloor || "").trim() !== "") ? 5 : 4} align="center" sx={{ color: "text.secondary", py: 2 }}>
                  No referred locations. Click &quot;Add Referred Location&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              referredLocations.map((row, index) => {
                const risk = getReferredRisk(row);
                const showLevelCol = referredLocations.some((r) => (r.levelFloor || "").trim() !== "");
                return (
                  <TableRow key={index}>
                    {showLevelCol && <TableCell>{row.levelFloor || "—"}</TableCell>}
                    <TableCell>{row.roomArea || "—"}</TableCell>
                    <TableCell>{row.surfaceDescription || "—"}</TableCell>
                    <TableCell>
                      {risk ? `${risk.product} — ${risk.label}` : "—"}
                    </TableCell>
                    <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130, px: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => openReferredModal(index)}
                        aria-label="Manage referred location photos"
                        title="Manage referred location photos"
                      >
                        <PhotoCameraIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => openReferredModal(index)}
                        aria-label="Edit referred location"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => removeReferredRow(index)}
                        color="error"
                        aria-label="Remove referred location"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={referredModalOpen} onClose={closeReferredModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              {referredEditIndex != null ? "Edit Referred Location" : "Add Referred Location"}
            </Typography>
            <IconButton onClick={closeReferredModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Checkbox
                checked={showReferredLevelFloor}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowReferredLevelFloor(checked);
                  if (!checked) {
                    setReferredModalForm((prev) => ({ ...prev, levelFloor: "" }));
                  }
                }}
              />
            }
            label="Include Level/Floor"
            sx={{ mb: 1 }}
          />
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {showReferredLevelFloor && (
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Level/Floor"
                  value={referredModalForm.levelFloor}
                  onChange={(e) =>
                    setReferredModalForm((prev) => ({
                      ...prev,
                      levelFloor: e.target.value,
                    }))
                  }
                />
              </Grid>
            )}
            <Grid item xs={12} sm={showReferredLevelFloor ? 6 : 12}>
              <TextField
                fullWidth
                label="Room/Area"
                value={referredModalForm.roomArea}
                onChange={(e) => setReferredModalForm((prev) => ({ ...prev, roomArea: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              {isDust ? (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Surface Description"
                  value={referredModalForm.surfaceDescription}
                  onChange={(e) =>
                    setReferredModalForm((prev) => ({
                      ...prev,
                      surfaceDescription: e.target.value,
                    }))
                  }
                  helperText="Describe the surface (free text — not linked to preset options)"
                />
              ) : (
                <Autocomplete
                  multiple
                  freeSolo
                  options={leadSurfaceDescriptionOptions}
                  value={(referredModalForm.surfaceDescription
                    ? referredModalForm.surfaceDescription.split(",").map((s) => s.trim()).filter(Boolean)
                    : [])}
                  onChange={(_, newValue) =>
                    setReferredModalForm((prev) => ({
                      ...prev,
                      surfaceDescription: newValue.join(", "),
                    }))
                  }
                  inputValue={referredSurfaceInput}
                  onInputChange={(_, newInputValue) => setReferredSurfaceInput(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Surface Description"
                      helperText="Select from the list or type and press Enter to add a custom option"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const trimmed = referredSurfaceInput.trim();
                        if (!trimmed) return;
                        e.preventDefault();
                        const current = referredModalForm.surfaceDescription
                          ? referredModalForm.surfaceDescription.split(",").map((s) => s.trim()).filter(Boolean)
                          : [];
                        if (current.includes(trimmed)) {
                          setReferredSurfaceInput("");
                          return;
                        }
                        const next = [...current, trimmed];
                        setReferredModalForm((prev) => ({ ...prev, surfaceDescription: next.join(", ") }));
                        setReferredSurfaceInput("");
                      }}
                    />
                  )}
                />
              )}
            </Grid>
          </Grid>
          <Typography variant="subtitle2" fontWeight="600" sx={{ mt: 2, mb: 1 }}>
            Risk Rating
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Occupant rating</InputLabel>
                <Select
                  value={referredModalForm.occupantRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, occupantRating: e.target.value }))}
                  label="Occupant rating"
                >
                  {OCCUPANT_RATING_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Location rating</InputLabel>
                <Select
                  value={referredModalForm.locationRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, locationRating: e.target.value }))}
                  label="Location rating"
                >
                  {LOCATION_RATING_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Room Use</InputLabel>
                <Select
                  value={referredModalForm.roomUseRating}
                  onChange={(e) => setReferredModalForm((prev) => ({ ...prev, roomUseRating: e.target.value }))}
                  label="Room Use"
                >
                  {ROOM_USE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              {isDust ? (
                <TextField
                  fullWidth
                  label="Condition"
                  value="Lead dust"
                  disabled
                  helperText="Fixed for dust samples"
                />
              ) : (
                <FormControl fullWidth>
                  <InputLabel>Condition</InputLabel>
                  <Select
                    value={referredModalForm.conditionRating}
                    onChange={(e) => setReferredModalForm((prev) => ({ ...prev, conditionRating: e.target.value }))}
                    label="Condition"
                  >
                    {CONDITION_RATING_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>
            {referredRiskProduct != null && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderRadius: 1,
                    bgcolor:
                      referredRiskLevelLabel === "HIGH RISK"
                        ? "error.light"
                        : referredRiskLevelLabel === "MEDIUM RISK"
                          ? "yellow"
                          : referredRiskLevelLabel === "LOW RISK"
                            ? "info.light"
                            : "success.light",
                    color:
                      referredRiskLevelLabel === "HIGH RISK"
                        ? "error.contrastText"
                        : referredRiskLevelLabel === "MEDIUM RISK"
                          ? "grey.900"
                          : referredRiskLevelLabel === "LOW RISK"
                            ? "info.contrastText"
                            : "success.contrastText",
                    fontWeight: 600,
                  }}
                >
                  Risk rating: {referredRiskProduct} — {referredRiskLevelLabel}
                </Box>
              </Grid>
            )}
          </Grid>
          <Typography variant="subtitle2" fontWeight="600" sx={{ mt: 2, mb: 1 }}>
            Recommendation Control Measures
          </Typography>
          <FormControlLabel
            control={(
              <Checkbox
                checked={Boolean(referredModalForm.sameAsSampledItem)}
                onChange={(e) =>
                  setReferredModalForm((prev) => ({
                    ...prev,
                    sameAsSampledItem: e.target.checked,
                  }))
                }
              />
            )}
            label="Same as Sampled item"
            sx={{ mb: 1 }}
          />
          {!referredModalForm.sameAsSampledItem && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Recommendation Control Measures"
                value={referredModalForm.recommendationActions}
                onChange={(e) =>
                  setReferredModalForm((prev) => ({
                    ...prev,
                    recommendationActions: e.target.value,
                  }))
                }
                sx={{ flex: 1, minWidth: { xs: "100%", sm: 320 } }}
              />
              <Button
                size="small"
                variant={isDictating && dictationTarget === "referredRecommendationActions" ? "contained" : "outlined"}
                color={isDictating && dictationTarget === "referredRecommendationActions" ? "error" : "primary"}
                startIcon={isDictating && dictationTarget === "referredRecommendationActions" ? <StopIcon /> : <MicIcon />}
                onClick={() => (
                  isDictating && dictationTarget === "referredRecommendationActions"
                    ? stopDictation()
                    : startDictation("referredRecommendationActions")
                )}
              >
                {isDictating && dictationTarget === "referredRecommendationActions" ? "Stop Dictation" : "Dictate"}
              </Button>
            </Box>
          )}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" fontWeight="600" sx={{ mb: 1 }}>
              Referred location photos
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              onClick={() => setReferredPhotosManagerOpen(true)}
              sx={{ textTransform: "none", mb: 1 }}
            >
              Manage photos
            </Button>
            <Typography variant="caption" color="text.secondary" display="block">
              {Array.isArray(referredModalForm.photographs)
                ? `${referredModalForm.photographs.length} photo(s) attached`
                : "0 photos attached"}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeReferredModal}>Cancel</Button>
          <Button variant="contained" onClick={addReferredFromModal} sx={{ backgroundColor: "#9c27b0", "&:hover": { backgroundColor: "#7b1fa2" } }}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={referredPhotosManagerOpen}
        onClose={() => setReferredPhotosManagerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Manage Referred Location Photos</DialogTitle>
        <DialogContent>
          <Button
            variant="outlined"
            startIcon={<PhotoCameraIcon />}
            onClick={() => referredPhotoInputRef.current?.click()}
            sx={{ textTransform: "none", mb: 1 }}
          >
            Add photos
          </Button>
          <input
            ref={referredPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleReferredPhotoFiles}
          />
          {Array.isArray(referredModalForm.photographs) &&
            referredModalForm.photographs.length > 0 ? (
              <Grid container spacing={1}>
                {referredModalForm.photographs.map((photo, idx) => (
                  <Grid item key={`referred-photo-${idx}`}>
                    <Box
                      sx={{
                        position: "relative",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 0.5,
                        backgroundColor: "#fff",
                      }}
                    >
                      <img
                        src={typeof photo === "string" ? photo : photo?.data}
                        alt={`Referred location ${idx + 1}`}
                        style={{ width: 82, height: 82, objectFit: "cover", borderRadius: 4 }}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeReferredPhoto(idx)}
                        sx={{
                          position: "absolute",
                          top: -10,
                          right: -10,
                          backgroundColor: "#fff",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No photos yet.
              </Typography>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReferredPhotosManagerOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
 

      <Box sx={{ display: "flex", gap: 2, mt: 3 }}>
        <Button onClick={handleCancel} disabled={submitLoading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={
            submitLoading ||
            !sampleType ||
            !sampleRef?.trim() ||
            (sampleType === "dust"
              ? !dustSurfaceDescription?.trim()
              : sampleType === "soil"
                ? !soilSampleLocation?.trim()
                : surfaceDescriptionValues.length === 0) ||
            sampleTypeOptions.length === 0 ||
            (sampleType === "dust" && !leadSampleArea) ||
            (sampleType === "soil" && !paintColour)
          }
          sx={{
            backgroundColor: "#9c27b0",
            "&:hover": { backgroundColor: "#7b1fa2" },
          }}
        >
          {submitLoading ? "Saving…" : "Save changes"}
        </Button>
      </Box>
    </Box>
  );
};

export default LeadAssessmentItemEdit;
