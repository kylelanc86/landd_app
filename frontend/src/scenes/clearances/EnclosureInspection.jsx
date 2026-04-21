import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Map as MapIcon,
  PhotoCamera as PhotoCameraIcon,
} from "@mui/icons-material";
import MicIcon from "@mui/icons-material/Mic";
import { useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import { useUserLists } from "../../context/UserListsContext";
import PermissionGate from "../../components/PermissionGate";
import SitePlanDrawing from "../../components/SitePlanDrawing";
import axios from "../../services/axios";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { compressImage } from "../../utils/imageCompression";
import { downloadEnclosureCertificateByClearanceId } from "../../utils/templatePDFGenerator";

const pad2 = (n) => String(n).padStart(2, "0");

/** `YYYY-MM-DD` from an ISO date string (browser local timezone). */
function isoToLocalDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `HH:mm` from an ISO date string (browser local timezone). */
function isoToLocalTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Today as `YYYY-MM-DD` in local timezone. */
function todayLocalDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Current local time as `HH:mm`. */
function nowLocalTimeString() {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/**
 * Combine local date + time inputs to ISO UTC for the API.
 * Empty both → null. Date-only → midnight local; time-only → today + that time.
 */
function localDateTimeToIso(dateStr, timeStr) {
  const d = (dateStr || "").trim();
  const t = (timeStr || "").trim();
  if (!d && !t) return null;
  const datePart = d || todayLocalDateString();
  const timePart = t || "00:00";
  const parsed = new Date(`${datePart}T${timePart}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Default caption under each photo in the enclosure certificate appendix. */
const DEFAULT_ENCLOSURE_PHOTO_CAPTION =
  "Photograph of removal enclosure taken during inspection";

/** Resize / JPEG quality caps for enclosure appendix images (PDF payload). */
const ENCLOSURE_CERTIFICATE_IMAGE_OPTIONS = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.78,
  maxSizeKB: 400,
};

/**
 * Returns a compressed JPEG data URL for the PDF. Upload path stores compressed
 * `data:` URLs; this still compresses legacy blob/file photos.
 */
async function getEnclosurePhotoDataForPdf(photo) {
  if (photo.file) {
    return compressImage(photo.file, ENCLOSURE_CERTIFICATE_IMAGE_OPTIONS);
  }
  if (photo.previewUrl?.startsWith("data:")) {
    return photo.previewUrl;
  }
  const res = await fetch(photo.previewUrl);
  const blob = await res.blob();
  const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const file = new File([blob], photo.name || "photo.jpg", { type });
  return compressImage(file, ENCLOSURE_CERTIFICATE_IMAGE_OPTIONS);
}

function hydrateEnclosurePhotosFromClearance(serverPhotos) {
  if (!Array.isArray(serverPhotos) || serverPhotos.length === 0) return [];
  return serverPhotos.map((p, i) => ({
    id: `srv-${i}-${String(p.data || "").slice(-32)}`,
    file: null,
    name: `enclosure-photo-${i + 1}.jpg`,
    caption: p.description || DEFAULT_ENCLOSURE_PHOTO_CAPTION,
    previewUrl: p.data,
  }));
}

/** Persistable payload: only data URLs (same shape as PDF appendix). */
function serializeEnclosurePhotosForApi(photoList) {
  return photoList
    .map((p) => ({
      data: p.previewUrl,
      description:
        (p.caption || "").trim() || DEFAULT_ENCLOSURE_PHOTO_CAPTION,
    }))
    .filter((x) => x.data && String(x.data).startsWith("data:"));
}

function stableEnclosureFieldsKey(description, photoList) {
  return JSON.stringify({
    enclosureDescription: description ?? "",
    enclosurePhotos: serializeEnclosurePhotosForApi(photoList),
  });
}

const EnclosureInspection = () => {
  const navigate = useNavigate();
  const { clearanceId } = useParams();
  const { showSnackbar } = useSnackbar();
  const { activeLAAs } = useUserLists();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearance, setClearance] = useState(null);

  const [enclosureDescription, setEnclosureDescription] = useState("");
  const [enclosureInspectionDateLocal, setEnclosureInspectionDateLocal] =
    useState("");
  const [enclosureInspectionTimeLocal, setEnclosureInspectionTimeLocal] =
    useState("");
  const [enclosureInspectedByLocal, setEnclosureInspectedByLocal] =
    useState("");
  const [savingEnclosureDateTime, setSavingEnclosureDateTime] = useState(false);
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef([]);
  const uploadPhotoInputRef = useRef(null);
  const takePhotoInputRef = useRef(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [stream, setStream] = useState(null);
  const [videoEl, setVideoEl] = useState(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef(null);
  const [sitePlanDrawingDialogOpen, setSitePlanDrawingDialogOpen] =
    useState(false);
  const [sitePlanKeyReminderOpen, setSitePlanKeyReminderOpen] = useState(false);
  const [pendingSitePlanData, setPendingSitePlanData] = useState(null);
  const sitePlanDrawingRef = useRef(null);
  const [removingSitePlan, setRemovingSitePlan] = useState(false);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);

  const lastSavedEnclosureFieldsKeyRef = useRef("");
  const prevLoadingRef = useRef(true);
  /** When this does not match `clearance._id`, we re-hydrate from the server document. */
  const lastHydratedClearanceIdRef = useRef(null);
  const enclosureDescriptionRef = useRef("");
  const photosForAutosaveRef = useRef([]);
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await asbestosClearanceService.getById(clearanceId);
        setClearance(data);
      } catch (err) {
        console.error("Error loading enclosure inspection page:", err);
        setError("Failed to load clearance details.");
      } finally {
        setLoading(false);
      }
    };

    if (clearanceId) {
      load();
    } else {
      setError("Clearance ID is missing.");
      setLoading(false);
    }
  }, [clearanceId]);

  useEffect(() => {
    lastHydratedClearanceIdRef.current = null;
    prevLoadingRef.current = true;
  }, [clearanceId]);

  /** Keep refs in sync for debounced autosave (reads latest values when the timer fires). */
  useEffect(() => {
    enclosureDescriptionRef.current = enclosureDescription;
    photosForAutosaveRef.current = photos;
  }, [enclosureDescription, photos]);

  /**
   * Hydrate from the server when this clearance is first loaded or after changing `clearanceId`.
   * Skips when `setClearance` updates the same job (e.g. autosave, site plan) so typing is not reset.
   */
  useEffect(() => {
    if (loading || !clearance?._id) return;
    const idStr = String(clearance._id);
    const loadJustFinished = prevLoadingRef.current;
    prevLoadingRef.current = false;
    const docChanged = lastHydratedClearanceIdRef.current !== idStr;
    if (!docChanged && !loadJustFinished) return;

    lastHydratedClearanceIdRef.current = idStr;

    const iso = clearance.enclosureInspectionDateTime;
    setEnclosureInspectionDateLocal(isoToLocalDate(iso));
    setEnclosureInspectionTimeLocal(isoToLocalTime(iso));
    setEnclosureInspectedByLocal(clearance.enclosureInspectedBy || "");

    const desc = clearance.enclosureDescription || "";
    setEnclosureDescription(desc);
    const loadedPhotos = hydrateEnclosurePhotosFromClearance(
      clearance.enclosurePhotos,
    );
    setPhotos(loadedPhotos);
    photosRef.current = loadedPhotos;
    lastSavedEnclosureFieldsKeyRef.current = stableEnclosureFieldsKey(
      desc,
      loadedPhotos,
    );
  }, [loading, clearance]);

  useEffect(() => {
    if (!clearanceId || loading || !clearance?._id) return;
    if (String(clearance._id) !== String(clearanceId)) return;
    const t = setTimeout(async () => {
      const key = stableEnclosureFieldsKey(
        enclosureDescriptionRef.current,
        photosForAutosaveRef.current,
      );
      if (key === lastSavedEnclosureFieldsKeyRef.current) return;
      try {
        const parsed = JSON.parse(key);
        const updated = await asbestosClearanceService.update(clearanceId, {
          enclosureDescription: parsed.enclosureDescription,
          enclosurePhotos: parsed.enclosurePhotos,
        });
        lastSavedEnclosureFieldsKeyRef.current = key;
        setClearance(updated);
      } catch (err) {
        console.error("Error auto-saving enclosure fields:", err);
        showSnackbar(
          "Could not save enclosure description or photos; check your connection.",
          "error",
        );
      }
    }, 900);
    return () => clearTimeout(t);
  }, [
    clearanceId,
    loading,
    clearance?._id,
    enclosureDescription,
    photos,
    showSnackbar,
  ]);

  const isFriableClearance = useMemo(() => {
    const type = clearance?.clearanceType || "";
    return type === "Friable" || type === "Friable (Non-Friable Conditions)";
  }, [clearance?.clearanceType]);

  const hasRetainedEnclosureCertificatePdf = useMemo(
    () =>
      Boolean(
        clearance?.enclosureCertificatePdfReadyAt ||
          clearance?.enclosureCertificateMergedPdfPath,
      ),
    [
      clearance?.enclosureCertificatePdfReadyAt,
      clearance?.enclosureCertificateMergedPdfPath,
    ],
  );

  const canGenerateEnclosureCertificate = useMemo(() => {
    const dateOk = (enclosureInspectionDateLocal || "").trim() !== "";
    const timeOk = (enclosureInspectionTimeLocal || "").trim() !== "";
    const descOk = (enclosureDescription || "").trim() !== "";
    const inspectedOk = (enclosureInspectedByLocal || "").trim() !== "";
    return dateOk && timeOk && descOk && inspectedOk;
  }, [
    enclosureInspectionDateLocal,
    enclosureInspectionTimeLocal,
    enclosureDescription,
    enclosureInspectedByLocal,
  ]);

  const startDictation = () => {
    if (isDictating && recognitionRef.current) {
      stopDictation();
      return;
    }

    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.",
      );
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-AU";

      recognition.onstart = () => {
        setIsDictating(true);
        setDictationError("");
      };

      recognition.onresult = (event) => {
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setEnclosureDescription((prev) => {
            const currentText = prev || "";
            const isFirstWord = !currentText || currentText.trim().length === 0;
            const newText = isFirstWord
              ? finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1)
              : finalTranscript;
            return currentText + (currentText ? " " : "") + newText;
          });
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setDictationError(`Dictation error: ${event.error}`);
        setIsDictating(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setIsDictating(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Error starting dictation:", err);
      setDictationError("Failed to start dictation. Please try again.");
      recognitionRef.current = null;
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error("Error stopping dictation:", err);
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  const performSitePlanSave = async (sitePlanData) => {
    const imageData =
      typeof sitePlanData === "string"
        ? sitePlanData
        : sitePlanData?.imageData;
    const legendEntries = Array.isArray(sitePlanData?.legend)
      ? sitePlanData.legend.map((entry) => ({
          color: entry.color,
          description: entry.description,
        }))
      : [];
    const legendTitle =
      sitePlanData?.legendTitle && sitePlanData.legendTitle.trim()
        ? sitePlanData.legendTitle.trim()
        : "Key";
    const figureTitle =
      sitePlanData?.figureTitle && sitePlanData.figureTitle.trim()
        ? sitePlanData.figureTitle.trim()
        : "Asbestos Removal Site Plan";

    if (!imageData) {
      showSnackbar("No site plan image data was provided", "error");
      return;
    }

    await asbestosClearanceService.update(clearanceId, {
      sitePlan: true,
      sitePlanFile: imageData,
      sitePlanLegend: legendEntries,
      sitePlanLegendTitle: legendTitle,
      sitePlanFigureTitle: figureTitle,
      sitePlanSource: "drawn",
    });

    setClearance((prev) => ({
      ...prev,
      sitePlan: true,
      sitePlanFile: imageData,
      sitePlanLegend: legendEntries,
      sitePlanLegendTitle: legendTitle,
      sitePlanFigureTitle: figureTitle,
      sitePlanSource: "drawn",
    }));
    showSnackbar("Drawn site plan saved successfully!", "success");
    setSitePlanDrawingDialogOpen(false);
  };

  const handleSitePlanSave = async (sitePlanData) => {
    const hasMissingDescriptions =
      Array.isArray(sitePlanData?.legend) &&
      sitePlanData.legend.some((e) => !(e.description || "").trim());

    if (hasMissingDescriptions) {
      setPendingSitePlanData(sitePlanData);
      setSitePlanKeyReminderOpen(true);
      return;
    }

    try {
      await performSitePlanSave(sitePlanData);
    } catch (err) {
      console.error("Error saving site plan:", err);
      showSnackbar("Error saving site plan", "error");
    }
  };

  const handleSitePlanDrawingClose = () => {
    setSitePlanDrawingDialogOpen(false);
  };

  const handleSitePlanKeyReminderAddDescriptions = () => {
    setSitePlanKeyReminderOpen(false);
    setPendingSitePlanData(null);
    sitePlanDrawingRef.current?.openLegendDialog?.();
  };

  const handleSitePlanKeyReminderSaveAnyway = async () => {
    setSitePlanKeyReminderOpen(false);
    const data = pendingSitePlanData;
    setPendingSitePlanData(null);
    if (data) {
      try {
        await performSitePlanSave(data);
      } catch (err) {
        console.error("Error saving site plan:", err);
        showSnackbar("Error saving site plan", "error");
      }
    }
  };

  const handleRemoveSitePlan = async () => {
    if (!window.confirm("Are you sure you want to remove the site plan?")) return;
    try {
      setRemovingSitePlan(true);
      await asbestosClearanceService.update(clearanceId, {
        sitePlanFile: null,
        sitePlanSource: null,
        sitePlanLegend: [],
        sitePlanLegendTitle: null,
        sitePlanFigureTitle: null,
      });
      setClearance((prev) => ({
        ...prev,
        sitePlanFile: null,
        sitePlanSource: null,
        sitePlanLegend: [],
        sitePlanLegendTitle: null,
        sitePlanFigureTitle: null,
      }));
      showSnackbar("Site plan removed successfully", "success");
    } catch (err) {
      console.error("Error removing site plan:", err);
      showSnackbar("Failed to remove site plan", "error");
    } finally {
      setRemovingSitePlan(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    event.target.value = "";

    try {
      const batchId = Date.now();
      const nextPhotos = await Promise.all(
        selectedFiles.map(async (file, index) => ({
          id: `${batchId}-${index}-${Math.random().toString(36).slice(2)}`,
          file: null,
          name: file.name,
          caption: DEFAULT_ENCLOSURE_PHOTO_CAPTION,
          previewUrl: await compressImage(file, ENCLOSURE_CERTIFICATE_IMAGE_OPTIONS),
        })),
      );
      setPhotos((prev) => [...prev, ...nextPhotos]);
      photosRef.current = [...photosRef.current, ...nextPhotos];
    } catch (err) {
      console.error("Error compressing enclosure photo:", err);
      showSnackbar(
        "Failed to process image. Please try another photo.",
        "error",
      );
    }
  };

  const closeCameraDialog = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraDialogOpen(false);
  };

  const openCameraDialog = async () => {
    setCameraError("");
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError("Camera is not supported in this browser.");
      takePhotoInputRef.current?.click();
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      setStream(mediaStream);
      setCameraDialogOpen(true);
    } catch (err) {
      console.error("Error opening camera:", err);
      setCameraError(
        "Unable to access camera. Please allow camera permission or use Upload Photo.",
      );
      takePhotoInputRef.current?.click();
    }
  };

  const handleCapturePhoto = () => {
    const video = videoEl;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const syntheticEvent = {
          target: { files: [file], value: "" },
        };
        handlePhotoUpload(syntheticEvent);
        closeCameraDialog();
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleRemovePhoto = (photoId) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === photoId);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      photosRef.current = photosRef.current.filter((photo) => photo.id !== photoId);
      return prev.filter((photo) => photo.id !== photoId);
    });
  };

  const handlePhotoCaptionChange = (photoId, caption) => {
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoId ? { ...photo, caption } : photo,
      ),
    );
    photosRef.current = photosRef.current.map((photo) =>
      photo.id === photoId ? { ...photo, caption } : photo,
    );
  };

  const handleTodayEnclosureDate = () => {
    setEnclosureInspectionDateLocal(todayLocalDateString());
  };

  const handleNowEnclosureTime = () => {
    setEnclosureInspectionTimeLocal(nowLocalTimeString());
  };

  const handleSaveEnclosureInspectionDateTime = async () => {
    if (!clearanceId) return;
    try {
      setSavingEnclosureDateTime(true);
      const iso = localDateTimeToIso(
        enclosureInspectionDateLocal,
        enclosureInspectionTimeLocal,
      );
      const inspectedTrim = (enclosureInspectedByLocal || "").trim();
      const photosPayload = serializeEnclosurePhotosForApi(photos);
      const updated = await asbestosClearanceService.update(clearanceId, {
        enclosureInspectionDateTime: iso,
        enclosureInspectedBy: inspectedTrim || null,
        enclosureDescription,
        enclosurePhotos: photosPayload,
      });
      setClearance(updated);
      lastSavedEnclosureFieldsKeyRef.current = stableEnclosureFieldsKey(
        enclosureDescription,
        photos,
      );
      showSnackbar("Enclosure inspection details saved", "success");
    } catch (err) {
      console.error("Error saving enclosure inspection details:", err);
      showSnackbar("Failed to save enclosure inspection details", "error");
    } finally {
      setSavingEnclosureDateTime(false);
    }
  };

  const handleGenerateOrDownloadCertificate = async () => {
    if (!clearance?._id) return;

    if (hasRetainedEnclosureCertificatePdf) {
      try {
        setGeneratingCertificate(true);
        const { filename } = await downloadEnclosureCertificateByClearanceId(
          clearance._id,
        );
        showSnackbar(`Downloaded: ${filename}`, "success");
      } catch (err) {
        console.error("Failed to download enclosure certificate:", err);
        const msg = err?.message || "";
        const isNoPdf = /no pdf|not available|generate the pdf first/i.test(
          msg,
        );
        if (isNoPdf) {
          showSnackbar("No saved PDF. Generating a new certificate…", "info");
          await runEnclosureCertificateGeneration();
        } else {
          showSnackbar(
            msg || "Failed to download enclosure certificate",
            "error",
          );
        }
      } finally {
        setGeneratingCertificate(false);
      }
      return;
    }

    await runEnclosureCertificateGeneration();
  };

  const runEnclosureCertificateGeneration = async () => {
    if (!clearance?._id) return;
    try {
      setGeneratingCertificate(true);

      const enclosurePhotos = await Promise.all(
        photos.map(async (photo) => {
          const caption = (photo.caption || "").trim();
          const data = await getEnclosurePhotoDataForPdf(photo);
          return {
            data,
            description: caption || DEFAULT_ENCLOSURE_PHOTO_CAPTION,
          };
        }),
      );

      const combinedIso = localDateTimeToIso(
        enclosureInspectionDateLocal,
        enclosureInspectionTimeLocal,
      );
      const clearanceForPdf = {
        ...clearance,
        enclosureInspectionDateTime:
          combinedIso ?? clearance.enclosureInspectionDateTime ?? null,
        enclosureInspectedBy:
          (enclosureInspectedByLocal || "").trim() ||
          clearance.enclosureInspectedBy ||
          null,
      };

      const response = await axios.post(
        "/pdf-docraptor-v2/generate-enclosure-certificate",
        {
          clearanceData: clearanceForPdf,
          enclosureData: {
            description: enclosureDescription,
            photos: enclosurePhotos,
          },
        },
        {
          responseType: "blob",
          timeout: 120000,
        },
      );

      const pdfBlob = new Blob([response.data], { type: "application/pdf" });
      const contentDisposition = response.headers["content-disposition"];
      let filename = `enclosure-certificate-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match?.[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      try {
        const refreshed = await asbestosClearanceService.getById(clearance._id);
        setClearance(refreshed);
      } catch (refetchErr) {
        console.warn("Could not refresh clearance after PDF save:", refetchErr);
      }

      showSnackbar("Enclosure certificate generated", "success");
    } catch (err) {
      console.error("Failed to generate enclosure certificate:", err);
      showSnackbar("Failed to generate enclosure certificate", "error");
    } finally {
      setGeneratingCertificate(false);
    }
  };

  useEffect(() => {
    if (cameraDialogOpen && videoEl && stream) {
      videoEl.srcObject = stream;
    }
  }, [cameraDialogOpen, stream, videoEl]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // ignore cleanup errors
        }
        recognitionRef.current = null;
      }
      photosRef.current.forEach((photo) => {
        if (photo.previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
    };
  }, []);

  if (loading) {
    return (
      <Box m="20px">
        <Typography>Loading enclosure inspection...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate("/asbestos-removal")}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Asbestos Removal Jobs
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate(`/clearances/${clearanceId}/items`)}
            sx={{ cursor: "pointer" }}
          >
            Clearance Items
          </Link>
          <Typography color="text.primary">Enclosure Inspection</Typography>
        </Breadcrumbs>


        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            mb: 1,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
            Enclosure Inspection
          </Typography>
          <Button
            variant="contained"
            onClick={handleGenerateOrDownloadCertificate}
            disabled={
              generatingCertificate || !canGenerateEnclosureCertificate
            }
          >
            {generatingCertificate
              ? hasRetainedEnclosureCertificatePdf
                ? "Downloading..."
                : "Generating..."
              : hasRetainedEnclosureCertificatePdf
                ? "Download Certificate"
                : "Generate Certificate"}
          </Button>
        </Box>

        {!isFriableClearance && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Enclosure Certificate is intended for friable clearances.
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Enclosure inspection details
            </Typography>
            <Box
              display="flex"
              flexWrap="wrap"
              gap={2}
              alignItems="center"
            >
              <Box
                display="flex"
                flexWrap="wrap"
                gap={1}
                alignItems="center"
              >
                <TextField
                  label="Date"
                  type="date"
                  size="small"
                  value={enclosureInspectionDateLocal}
                  onChange={(e) => setEnclosureInspectionDateLocal(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 160 }}
                />
                <Button variant="outlined" size="small" onClick={handleTodayEnclosureDate}>
                  Today
                </Button>
              </Box>
              <Box
                display="flex"
                flexWrap="wrap"
                gap={1}
                alignItems="center"
              >
                <TextField
                  label="Time"
                  type="time"
                  size="small"
                  value={enclosureInspectionTimeLocal}
                  onChange={(e) => setEnclosureInspectionTimeLocal(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 130 }}
                />
                <Button variant="outlined" size="small" onClick={handleNowEnclosureTime}>
                  Now
                </Button>
              </Box>
              <FormControl
                size="small"
                sx={{ minWidth: 200, flex: "1 1 200px", maxWidth: 360 }}
              >
                <InputLabel id="enclosure-inspected-by-label">
                  Inspected by (LAA)
                </InputLabel>
                <Select
                  labelId="enclosure-inspected-by-label"
                  label="Inspected by (LAA)"
                  value={enclosureInspectedByLocal || ""}
                  onChange={(e) => setEnclosureInspectedByLocal(e.target.value)}
                  key={`enclosure-laa-${activeLAAs.length}-${enclosureInspectedByLocal}`}
                >
                  {activeLAAs.length === 0 ? (
                    <MenuItem value="" disabled>
                      Loading assessors…
                    </MenuItem>
                  ) : (
                    [
                      <MenuItem key="empty" value="">
                        <em>Select an LAA</em>
                      </MenuItem>,
                      ...(enclosureInspectedByLocal &&
                      !activeLAAs.some(
                        (a) =>
                          `${a.firstName} ${a.lastName}` ===
                          enclosureInspectedByLocal,
                      )
                        ? [
                            <MenuItem
                              key="stored-only"
                              value={enclosureInspectedByLocal}
                            >
                              {enclosureInspectedByLocal} (saved)
                            </MenuItem>,
                          ]
                        : []),
                      ...activeLAAs.map((assessor) => {
                        const name = `${assessor.firstName} ${assessor.lastName}`;
                        return (
                          <MenuItem key={assessor._id} value={name}>
                            {name}
                          </MenuItem>
                        );
                      }),
                    ]
                  )}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveEnclosureInspectionDateTime}
                disabled={savingEnclosureDateTime}
                sx={{ flexShrink: 0 }}
              >
                {savingEnclosureDateTime ? "Saving..." : "Save"}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Enclosure Description
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              E.g. The inspected asbestos removal enclosures were located in the kitchen, bathroom and laundry and were constructed using 200 micron plastic with negative pressure units and decontamination pods at the entry. 
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={5}
              value={enclosureDescription}
              onChange={(e) => setEnclosureDescription(e.target.value)}
              placeholder="Describe the enclosure setup, conditions, and any relevant observations."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={isDictating ? stopDictation : startDictation}
                      color={isDictating ? "error" : "primary"}
                      title={isDictating ? "Stop Dictation" : "Start Dictation"}
                    >
                      <MicIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {isDictating && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Dictating... Speak clearly into your microphone
              </Typography>
            )}
            {dictationError && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ mt: 1, display: "block" }}
              >
                {dictationError}
              </Typography>
            )}
          </CardContent>
        </Card>

        <Box
          display="flex"
          gap={2}
          sx={{ mt: 2, mb: 3 }}
          alignItems="center"
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setSitePlanDrawingDialogOpen(true)}
            startIcon={<MapIcon />}
          >
            {clearance?.sitePlanFile ? "Edit Site Plan" : "Site Plan"}
          </Button>
          {clearance?.sitePlanFile && (
            <Button
              variant="contained"
              color="error"
              onClick={handleRemoveSitePlan}
              disabled={removingSitePlan}
              startIcon={
                removingSitePlan ? (
                  <CircularProgress size={16} sx={{ color: "inherit" }} />
                ) : (
                  <DeleteIcon />
                )
              }
            >
              Delete Site Plan
            </Button>
          )}
          {clearance?.sitePlanFile ? (
            <Typography
              variant="body2"
              color="success.main"
              sx={{ fontWeight: "medium" }}
            >
              ✓ Site Plan Attached
            </Typography>
          ) : (
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ fontWeight: "medium" }}
            >
              ⚠ No Site Plan
            </Typography>
          )}
        </Box>

        <Card>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Typography variant="h6">Enclosure Photos</Typography>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={() => uploadPhotoInputRef.current?.click()}
                >
                  Upload Photo
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<PhotoCameraIcon />}
                  onClick={openCameraDialog}
                >
                  Take Photo
                </Button>
                <input
                  ref={uploadPhotoInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                />
                <input
                  ref={takePhotoInputRef}
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                />
              </Box>
            </Box>

            {photos.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No photos added yet.
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {photos.map((photo) => (
                  <Grid item xs={12} sm={6} md={4} key={photo.id}>
                    <Card variant="outlined">
                      <Box
                        component="img"
                        src={photo.previewUrl}
                        alt={photo.caption || "Enclosure photograph"}
                        sx={{
                          width: "100%",
                          height: 180,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <CardContent sx={{ pt: 1.5, pb: 1 }}>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mb: 1,
                          }}
                        >
                          <IconButton
                            color="error"
                            onClick={() => handleRemovePhoto(photo.id)}
                            size="small"
                            aria-label="Remove photo"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          size="small"
                          label="Caption (shown under photo in PDF)"
                          value={
                            photo.caption ?? DEFAULT_ENCLOSURE_PHOTO_CAPTION
                          }
                          onChange={(e) =>
                            handlePhotoCaptionChange(photo.id, e.target.value)
                          }
                          placeholder={DEFAULT_ENCLOSURE_PHOTO_CAPTION}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={sitePlanDrawingDialogOpen}
          onClose={handleSitePlanDrawingClose}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              height: "90vh",
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Site Plan Drawing</Typography>
              <IconButton onClick={handleSitePlanDrawingClose}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 2, height: "100%" }}>
            <SitePlanDrawing
              ref={sitePlanDrawingRef}
              onSave={handleSitePlanSave}
              onCancel={() => setSitePlanDrawingDialogOpen(false)}
              existingSitePlan={clearance?.sitePlanFile}
              existingLegend={clearance?.sitePlanLegend}
              existingLegendTitle={clearance?.sitePlanLegendTitle}
              existingFigureTitle={clearance?.sitePlanFigureTitle}
            />
          </DialogContent>
        </Dialog>

        <Dialog
          open={sitePlanKeyReminderOpen}
          onClose={() => {
            setSitePlanKeyReminderOpen(false);
            setPendingSitePlanData(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
            },
          }}
        >
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <DescriptionIcon color="primary" />
            <span>Add key descriptions</span>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
            <Typography variant="body1" color="text.secondary">
              Some key items don&apos;t have descriptions. Add descriptions so the
              site plan key is clear, or save without adding them.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
            <Button
              onClick={handleSitePlanKeyReminderSaveAnyway}
              variant="outlined"
              color="inherit"
            >
              Save anyway
            </Button>
            <Button
              onClick={handleSitePlanKeyReminderAddDescriptions}
              variant="contained"
              startIcon={<DescriptionIcon />}
            >
              Add descriptions
            </Button>
          </DialogActions>
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
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                }}
              >
                {stream ? (
                  <video
                    ref={(ref) => {
                      setVideoEl(ref);
                      if (ref && stream) {
                        ref.srcObject = stream;
                      }
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

              {cameraError && (
                <Alert
                  severity="error"
                  sx={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    right: 12,
                    zIndex: 2,
                  }}
                >
                  {cameraError}
                </Alert>
              )}

              <Box
                sx={{
                  position: "absolute",
                  right: "env(safe-area-inset-right)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  p: 1,
                }}
              >
                <Button
                  onClick={closeCameraDialog}
                  variant="outlined"
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
                  onClick={handleCapturePhoto}
                  variant="contained"
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
      </Box>
    </PermissionGate>
  );
};

export default EnclosureInspection;
