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
  Grid,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Map as MapIcon,
  PhotoCamera as PhotoCameraIcon,
} from "@mui/icons-material";
import MicIcon from "@mui/icons-material/Mic";
import { useNavigate, useParams } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import { hasPermission } from "../../config/permissions";
import SitePlanDrawing from "../../components/SitePlanDrawing";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { compressImage } from "../../utils/imageCompression";

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
  const { clearanceId, jobId } = useParams();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearance, setClearance] = useState(null);

  const [enclosureDescription, setEnclosureDescription] = useState("");
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
  const [completingCertificate, setCompletingCertificate] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopeningCertificate, setReopeningCertificate] = useState(false);

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
        if (!data?.isEnclosureCertificate) {
          setError(
            "This record is not an enclosure certificate. Create one from the job Enclosure Inspection tab.",
          );
          setClearance(null);
          return;
        }
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

  const isCertificateComplete = clearance?.status === "complete";

  useEffect(() => {
    if (!clearanceId || loading || !clearance?._id || isCertificateComplete) return;
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
    isCertificateComplete,
    enclosureDescription,
    photos,
    showSnackbar,
  ]);

  const isFriableClearance = useMemo(() => {
    const type = clearance?.clearanceType || "";
    return type === "Friable" || type === "Friable (Non-Friable Conditions)";
  }, [clearance?.clearanceType]);

  const canReopenCertificate = useMemo(
    () =>
      hasPermission(currentUser, "admin.view") ||
      hasPermission(currentUser, "asbestos.delete"),
    [currentUser],
  );

  const canCompleteCertificate = useMemo(() => {
    if (isCertificateComplete) return false;
    const descOk = (enclosureDescription || "").trim() !== "";
    const dateOk = Boolean(clearance?.clearanceDate);
    const timeOk = (clearance?.inspectionTime || "").trim() !== "";
    const laaOk = (clearance?.LAA || "").trim() !== "";
    return descOk && dateOk && timeOk && laaOk;
  }, [
    isCertificateComplete,
    enclosureDescription,
    clearance?.clearanceDate,
    clearance?.inspectionTime,
    clearance?.LAA,
  ]);

  const startDictation = () => {
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
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
    if (isCertificateComplete) return;
    setPhotos((prev) =>
      prev.map((photo) =>
        photo.id === photoId ? { ...photo, caption } : photo,
      ),
    );
    photosRef.current = photosRef.current.map((photo) =>
      photo.id === photoId ? { ...photo, caption } : photo,
    );
  };

  const handleCompleteCertificate = async () => {
    if (!clearance?._id || isCertificateComplete) return;
    try {
      setCompletingCertificate(true);
      const updated = await asbestosClearanceService.updateStatus(
        clearance._id,
        "complete",
      );
      setClearance(updated);
      showSnackbar("Enclosure certificate marked as complete", "success");
      if (jobId) {
        navigate(`/asbestos-removal/jobs/${jobId}/details?tab=enclosure`);
      }
    } catch (err) {
      console.error("Error completing enclosure certificate:", err);
      showSnackbar(
        err.response?.data?.message ||
          "Failed to complete enclosure certificate",
        "error",
      );
    } finally {
      setCompletingCertificate(false);
    }
  };

  const handleReopenCertificate = () => {
    setReopenDialogOpen(true);
  };

  const confirmReopenCertificate = async () => {
    if (!clearance?._id) return;
    try {
      setReopeningCertificate(true);
      const updated = await asbestosClearanceService.update(clearance._id, {
        status: "in progress",
      });
      setClearance(updated);
      showSnackbar("Enclosure certificate reopened successfully!", "success");
    } catch (err) {
      console.error("Error reopening enclosure certificate:", err);
      showSnackbar(
        err.response?.data?.message ||
          "Failed to reopen enclosure certificate",
        "error",
      );
    } finally {
      setReopeningCertificate(false);
      setReopenDialogOpen(false);
    }
  };

  useEffect(() => {
    if (isCertificateComplete && isDictating) {
      stopDictation();
    }
  }, [isCertificateComplete, isDictating]);

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
          {jobId ? (
            <Link
              component="button"
              variant="body1"
              onClick={() =>
                navigate(`/asbestos-removal/jobs/${jobId}/details?tab=enclosure`)
              }
              sx={{ cursor: "pointer" }}
            >
              Job Details
            </Link>
          ) : (
            <Link
              component="button"
              variant="body1"
              onClick={() => navigate(`/clearances/${clearanceId}/items`)}
              sx={{ cursor: "pointer" }}
            >
              Clearance Items
            </Link>
          )}
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
            color={
              isCertificateComplete
                ? canReopenCertificate
                  ? "error"
                  : "success"
                : "primary"
            }
            onClick={
              isCertificateComplete
                ? canReopenCertificate
                  ? handleReopenCertificate
                  : undefined
                : handleCompleteCertificate
            }
            disabled={
              isCertificateComplete
                ? !canReopenCertificate || reopeningCertificate
                : completingCertificate || !canCompleteCertificate
            }
            sx={{
              backgroundColor: isCertificateComplete
                ? canReopenCertificate
                  ? "#d32f2f"
                  : "#2e7d32"
                : "#1976d2",
              "&:hover": {
                backgroundColor: isCertificateComplete
                  ? canReopenCertificate
                    ? "#b71c1c"
                    : "#1b5e20"
                  : "#1565c0",
              },
            }}
          >
            {isCertificateComplete
              ? canReopenCertificate
                ? reopeningCertificate
                  ? "Reopening..."
                  : "REOPEN CLEARANCE"
                : "Certificate Complete"
              : completingCertificate
                ? "Completing..."
                : "Complete Certificate"}
          </Button>
        </Box>

        {!isFriableClearance && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            Enclosure Certificate is intended for friable clearances.
          </Alert>
        )}

        {isCertificateComplete && (
          <Alert severity="info" sx={{ mb: 3 }}>
            This enclosure certificate is complete. Fields are read-only until the
            certificate is reopened.
          </Alert>
        )}

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
              disabled={isCertificateComplete}
              InputProps={{
                readOnly: isCertificateComplete,
                endAdornment: !isCertificateComplete ? (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={isDictating ? stopDictation : startDictation}
                      color={isDictating ? "error" : "primary"}
                      title={isDictating ? "Stop Dictation" : "Start Dictation"}
                    >
                      <MicIcon />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
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
            disabled={isCertificateComplete}
          >
            {clearance?.sitePlanFile ? "Edit Site Plan" : "Site Plan"}
          </Button>
          {clearance?.sitePlanFile && (
            <Button
              variant="contained"
              color="error"
              onClick={handleRemoveSitePlan}
              disabled={isCertificateComplete || removingSitePlan}
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
              {!isCertificateComplete && (
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
              )}
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
                        {!isCertificateComplete && (
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
                        )}
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
                          disabled={isCertificateComplete}
                          InputProps={{ readOnly: isCertificateComplete }}
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

        <Dialog
          open={reopenDialogOpen}
          onClose={() => setReopenDialogOpen(false)}
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
                bgcolor: "warning.main",
                color: "white",
              }}
            >
              <EditIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Reopen Clearance
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to reopen this enclosure certificate?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setReopenDialogOpen(false)}
              variant="outlined"
              disabled={reopeningCertificate}
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
              onClick={confirmReopenCertificate}
              variant="contained"
              color="warning"
              disabled={reopeningCertificate}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: "warning.main",
                "&:hover": { backgroundColor: "warning.dark" },
              }}
            >
              {reopeningCertificate ? "Reopening..." : "Reopen Clearance"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default EnclosureInspection;
