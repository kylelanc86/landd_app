import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
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
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Chip,
  Breadcrumbs,
  Link,
  Autocomplete,
  Alert,
  InputAdornment,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Assessment as AssessmentIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Map as MapIcon,
  ArrowBack as ArrowBackIcon,
  ArrowUpward as ArrowUpwardIcon,
} from "@mui/icons-material";
import MicIcon from "@mui/icons-material/Mic";
import { Checkbox, FormControlLabel } from "@mui/material";

import { useNavigate, useParams } from "react-router-dom";
import PermissionGate from "../../components/PermissionGate";
import SitePlanDrawing from "../../components/SitePlanDrawing";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import {
  compressImage,
  needsCompression,
  saveFileToDevice, // eslint-disable-line no-unused-vars -- used when save-to-device is re-enabled
} from "../../utils/imageCompression";
import { formatDate } from "../../utils/dateUtils";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const DEFAULT_ARROW_COLOR = "#f44336";
const DEFAULT_ARROW_ROTATION = -45;
function getArrowTipOffset(rotationDeg) {
  const r = ((rotationDeg ?? 0) * Math.PI) / 180;
  const tipX = (12 + 10 * Math.sin(r)) / 24;
  const tipY = (12 - 10 * Math.cos(r)) / 24;
  return { x: tipX, y: tipY };
}
const ARROW_COLORS = [
  { name: "Yellow", hex: "#ffeb3b" },
  { name: "Red", hex: "#f44336" },
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#212121" },
  { name: "Orange", hex: "#ff9800" },
  { name: "Green", hex: "#4caf50" },
];

const ClearanceItems = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { clearanceId } = useParams();
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const showRotateAlert = isPortrait && isMobile;
  const isMobileLandscape = useMediaQuery(
    "(orientation: landscape) and (max-width: 950px)",
  );

  const [items, setItems] = useState([]);
  const [clearance, setClearance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const { showSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    locationDescription: "",
    levelFloor: "",
    roomArea: "",
    materialDescription: "",
    asbestosType: "non-friable",
    notes: "",
  });
  const [photoGalleryDialogOpen, setPhotoGalleryDialogOpen] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState(null);
  const [localPhotoChanges, setLocalPhotoChanges] = useState({}); // Track local changes
  const [photosToDelete, setPhotosToDelete] = useState(new Set()); // Track photos to delete
  const [localPhotoDescriptions, setLocalPhotoDescriptions] = useState({}); // Track local description changes
  const [editingDescriptionPhotoId, setEditingDescriptionPhotoId] =
    useState(null); // Track which photo description is being edited
  const [fullSizePhotoDialogOpen, setFullSizePhotoDialogOpen] = useState(false);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState(null);
  const [fullSizePhotoId, setFullSizePhotoId] = useState(null);
  const [fullSizeArrowMode, setFullSizeArrowMode] = useState(false);
  const [selectedArrowId, setSelectedArrowId] = useState(null);
  const [movingArrowId, setMovingArrowId] = useState(null);
  const [selectedArrowColor, setSelectedArrowColor] = useState(DEFAULT_ARROW_COLOR);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [airMonitoringReportsDialogOpen, setAirMonitoringReportsDialogOpen] =
    useState(false);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReports, setSelectedReports] = useState([]);
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [exclusionsLastSaved, setExclusionsLastSaved] = useState(null);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef(null);
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [uploadingSitePlan, setUploadingSitePlan] = useState(false);
  const [sitePlanDrawingDialogOpen, setSitePlanDrawingDialogOpen] =
    useState(false);
  const [sitePlanKeyReminderOpen, setSitePlanKeyReminderOpen] = useState(false);
  const [pendingSitePlanData, setPendingSitePlanData] = useState(null);
  const sitePlanDrawingRef = useRef(null);
  const [generatingAirMonitoringPDF, setGeneratingAirMonitoringPDF] =
    useState(false);
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [jobExclusionsModalOpen, setJobExclusionsModalOpen] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [showLevelFloor, setShowLevelFloor] = useState(false);
  const [asbestosRemovalJobId, setAsbestosRemovalJobId] = useState(null);
  const [customDataFields, setCustomDataFields] = useState({
    roomAreas: [],
    locationDescriptions: [],
    materialsDescriptions: [],
  });
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Pinch zoom state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lastPinchDistance, setLastPinchDistance] = useState(null);
  const [lastPanPoint, setLastPanPoint] = useState(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const videoContainerRef = useRef(null);
  const zoomWrapperRef = useRef(null);
  const zoomPanRef = useRef({ zoom: 1, panX: 0, panY: 0 });

  // Keep zoomPanRef in sync with state (after touchEnd or double-tap)
  useEffect(() => {
    zoomPanRef.current = { zoom, panX, panY };
  }, [zoom, panX, panY]);

  // Track first tap for tablet two-tap behavior
  const [firstTapFields, setFirstTapFields] = useState({
    levelFloor: false,
    roomArea: false,
    locationDescription: false,
    materialDescription: false,
  });

  // Detect if device is a tablet/touch device
  const isTablet = () => {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  };

  // Format status for display (remove underscores, capitalize)
  const formatStatus = (status) => {
    if (!status) return "";
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  // Dictation functions
  const startDictation = () => {
    // If already dictating, stop it first
    if (isDictating && recognitionRef.current) {
      stopDictation();
      return;
    }

    // Check if browser supports speech recognition
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

        // Update the job specific exclusions field with the final transcript
        if (finalTranscript) {
          setClearance((prev) => {
            const currentText = prev?.jobSpecificExclusions || "";
            const isFirstWord = !currentText || currentText.trim().length === 0;
            const newText = isFirstWord
              ? finalTranscript.charAt(0).toUpperCase() +
                finalTranscript.slice(1)
              : finalTranscript;
            return {
              ...prev,
              jobSpecificExclusions:
                currentText + (currentText ? " " : "") + newText,
            };
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
    } catch (error) {
      console.error("Error starting dictation:", error);
      setDictationError("Failed to start dictation. Please try again.");
      recognitionRef.current = null;
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Error stopping dictation:", error);
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  // Cleanup: stop dictation when component unmounts
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Set up video stream when camera dialog opens
  useEffect(() => {
    if (cameraDialogOpen && stream && videoRef) {
      videoRef.srcObject = stream;
    }
  }, [cameraDialogOpen, stream, videoRef]);

  // Clean up stream when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Fetch items and clearance data on component mount
  useEffect(() => {
    console.log("[ClearanceItems] Component mount effect triggered", {
      clearanceId,
      timestamp: new Date().toISOString(),
    });

    if (clearanceId) {
      console.log("[ClearanceItems] Starting data fetch operations", {
        clearanceId,
        timestamp: new Date().toISOString(),
      });
      fetchData();
      fetchCustomDataFields();
    } else {
      console.error(
        "[ClearanceItems] No clearanceId provided in URL parameters",
      );
      setError("No clearance ID provided");
      setLoading(false);
    }
  }, [clearanceId]);

  const fetchCustomDataFields = async () => {
    console.log("[ClearanceItems] fetchCustomDataFields - Starting", {
      timestamp: new Date().toISOString(),
    });
    const startTime = performance.now();

    try {
      console.log("[ClearanceItems] fetchCustomDataFields - Making API calls", {
        timestamp: new Date().toISOString(),
      });
      const apiStartTime = performance.now();

      const [
        roomAreasData,
        locationDescriptionsData,
        materialsDescriptionsData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
      ]);

      const apiEndTime = performance.now();
      console.log(
        "[ClearanceItems] fetchCustomDataFields - API calls completed",
        {
          apiCallDuration: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          roomAreasCount: Array.isArray(roomAreasData)
            ? roomAreasData.length
            : "unknown",
          locationDescriptionsCount: Array.isArray(locationDescriptionsData)
            ? locationDescriptionsData.length
            : "unknown",
          materialsDescriptionsCount: Array.isArray(materialsDescriptionsData)
            ? materialsDescriptionsData.length
            : "unknown",
          timestamp: new Date().toISOString(),
        },
      );

      // Handle both array and object responses and sort alphabetically
      const processData = (data) => {
        let processedData = [];

        if (Array.isArray(data)) {
          processedData = data;
        } else if (data && typeof data === "object") {
          // If it's an object, try to extract the array from common property names
          processedData =
            data.data ||
            data.items ||
            data.fields ||
            Object.values(data).filter(Array.isArray)[0] ||
            [];
        }

        // Sort alphabetically by text field
        return processedData.sort((a, b) => {
          const textA = (a.text || "").toLowerCase();
          const textB = (b.text || "").toLowerCase();
          return textA.localeCompare(textB);
        });
      };

      const processStartTime = performance.now();
      const processedData = {
        roomAreas: processData(roomAreasData),
        locationDescriptions: processData(locationDescriptionsData),
        materialsDescriptions: processData(materialsDescriptionsData),
      };
      const processEndTime = performance.now();

      console.log(
        "[ClearanceItems] fetchCustomDataFields - Data processing completed",
        {
          processingDuration: `${(processEndTime - processStartTime).toFixed(
            2,
          )}ms`,
          processedRoomAreasCount: processedData.roomAreas.length,
          processedLocationDescriptionsCount:
            processedData.locationDescriptions.length,
          processedMaterialsDescriptionsCount:
            processedData.materialsDescriptions.length,
          timestamp: new Date().toISOString(),
        },
      );

      setCustomDataFields(processedData);

      const endTime = performance.now();
      console.log("[ClearanceItems] fetchCustomDataFields - Completed", {
        totalDuration: `${(endTime - startTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const endTime = performance.now();
      console.error("[ClearanceItems] fetchCustomDataFields - Error", {
        error: err,
        errorMessage: err.message,
        totalDuration: `${(endTime - startTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const fetchData = async () => {
    console.log("[ClearanceItems] fetchData - Starting", {
      clearanceId,
      timestamp: new Date().toISOString(),
    });
    const fetchStartTime = performance.now();

    try {
      setLoading(true);

      // Check if clearanceId is valid
      if (!clearanceId) {
        throw new Error("Clearance ID is missing from URL");
      }

      console.log("[ClearanceItems] fetchData - Making API calls", {
        clearanceId,
        timestamp: new Date().toISOString(),
      });
      const apiStartTime = performance.now();

      const [itemsData, clearanceData] = await Promise.all([
        asbestosClearanceService.getItems(clearanceId),
        asbestosClearanceService.getById(clearanceId),
      ]);

      const apiEndTime = performance.now();
      console.log("[ClearanceItems] fetchData - API calls completed", {
        apiCallDuration: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
        itemsCount: Array.isArray(itemsData) ? itemsData.length : "unknown",
        clearanceDataReceived: !!clearanceData,
        timestamp: new Date().toISOString(),
      });

      const stateUpdateStartTime = performance.now();

      setItems(itemsData || []);
      setClearance(clearanceData);

      // Debug: Log clearance data to check site plan fields
      console.log("[ClearanceItems] fetchData - Clearance data loaded", {
        sitePlan: clearanceData?.sitePlan,
        sitePlanFile: clearanceData?.sitePlanFile ? "Present" : "Missing",
        sitePlanSource: clearanceData?.sitePlanSource,
        clearanceId,
        status: clearanceData?.status,
        clearanceType: clearanceData?.clearanceType,
        projectId: clearanceData?.projectId?._id || clearanceData?.projectId,
        timestamp: new Date().toISOString(),
      });

      // Set job completed state based on clearance status
      setJobCompleted(clearanceData?.status === "complete");

      const stateUpdateEndTime = performance.now();
      console.log("[ClearanceItems] fetchData - State updated", {
        stateUpdateDuration: `${(
          stateUpdateEndTime - stateUpdateStartTime
        ).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });

      // Fetch asbestos removal job ID for breadcrumb navigation (separate from main data loading)
      // First check if clearance has direct job ID link - this is the most reliable method
      if (clearanceData?.asbestosRemovalJobId) {
        const jobId =
          clearanceData.asbestosRemovalJobId._id ||
          clearanceData.asbestosRemovalJobId;
        setAsbestosRemovalJobId(jobId);
        console.log("[ClearanceItems] fetchData - Using direct job ID link", {
          jobId: jobId,
          timestamp: new Date().toISOString(),
        });
      } else if (clearanceData?.projectId) {
        // Fallback: Find job by project ID if direct link is not available
        // This should only happen for older clearances created before asbestosRemovalJobId was added
        try {
          console.log(
            "[ClearanceItems] fetchData - Fetching asbestos removal job ID (fallback to project lookup)",
            {
              projectId: clearanceData.projectId._id || clearanceData.projectId,
              timestamp: new Date().toISOString(),
            },
          );
          const jobFetchStartTime = performance.now();

          const importStartTime = performance.now();
          const asbestosRemovalJobService = (
            await import("../../services/asbestosRemovalJobService")
          ).default;
          const importEndTime = performance.now();
          console.log("[ClearanceItems] fetchData - Service imported", {
            importDuration: `${(importEndTime - importStartTime).toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          });

          const jobsResponse = await asbestosRemovalJobService.getAll();
          const jobFetchEndTime = performance.now();
          console.log("[ClearanceItems] fetchData - Jobs fetched", {
            jobsFetchDuration: `${(jobFetchEndTime - jobFetchStartTime).toFixed(
              2,
            )}ms`,
            jobsCount: Array.isArray(jobsResponse?.data)
              ? jobsResponse.data.length
              : Array.isArray(jobsResponse?.jobs)
                ? jobsResponse.jobs.length
                : 0,
            timestamp: new Date().toISOString(),
          });
          const projectId =
            clearanceData.projectId._id || clearanceData.projectId;

          // Handle different response structures - some APIs return {data: [...]} others return {jobs: [...]}
          const jobsArray = jobsResponse.data || jobsResponse.jobs || [];

          console.log(
            "Looking for asbestos removal job with projectId:",
            projectId,
          );
          console.log("Clearance data projectId:", clearanceData.projectId);
          console.log("Jobs response structure:", jobsResponse);
          console.log(
            "Available jobs:",
            jobsArray?.map((job) => ({
              id: job._id,
              projectId: job.projectId,
              projectIdId: job.projectId?._id,
              name: job.name,
              asbestosRemovalist: job.asbestosRemovalist,
            })),
          );

          // Find the asbestos removal job that matches this project
          // When multiple jobs exist for same project, try to match by asbestosRemovalist first
          let matchingJob = null;

          // First, filter jobs by project ID
          const projectJobs = jobsArray.filter((job) => {
            const jobProjectId = job.projectId?._id || job.projectId;
            const clearanceProjectId =
              clearanceData.projectId._id || clearanceData.projectId;

            return (
              jobProjectId === clearanceProjectId ||
              jobProjectId === projectId ||
              job.projectId === projectId ||
              job.projectId === clearanceData.projectId ||
              job.projectId?._id === projectId ||
              job.projectId?._id === clearanceData.projectId
            );
          });

          // If multiple jobs found, try to match by asbestosRemovalist
          if (projectJobs.length > 1 && clearanceData?.asbestosRemovalist) {
            matchingJob = projectJobs.find(
              (job) =>
                job.asbestosRemovalist === clearanceData.asbestosRemovalist,
            );
            console.log(
              "[ClearanceItems] fetchData - Multiple jobs found, attempting to match by asbestosRemovalist",
              {
                clearanceAsbestosRemovalist: clearanceData.asbestosRemovalist,
                matchedByRemovalist: !!matchingJob,
                timestamp: new Date().toISOString(),
              },
            );
          }

          // If still no match or only one job found, use first one
          if (!matchingJob && projectJobs.length > 0) {
            matchingJob = projectJobs[0];
          }

          console.log("Matching job found:", matchingJob);

          if (matchingJob) {
            setAsbestosRemovalJobId(matchingJob._id);
            console.log("[ClearanceItems] fetchData - Matching job found", {
              jobId: matchingJob._id,
              timestamp: new Date().toISOString(),
            });
          } else {
            console.log("[ClearanceItems] fetchData - No matching job found", {
              projectId: projectId,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (jobError) {
          console.error("[ClearanceItems] fetchData - Error fetching job ID", {
            error: jobError,
            errorMessage: jobError.message,
            timestamp: new Date().toISOString(),
          });
          // Don't fail the entire data loading if job ID fetching fails
        }
      }

      const fetchEndTime = performance.now();
      console.log("[ClearanceItems] fetchData - Completed successfully", {
        totalDuration: `${(fetchEndTime - fetchStartTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const fetchEndTime = performance.now();
      console.error("[ClearanceItems] fetchData - Error occurred", {
        error: err,
        errorMessage: err.message,
        response: err.response?.data,
        status: err.response?.status,
        clearanceId: clearanceId,
        totalDuration: `${(fetchEndTime - fetchStartTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      const loadingEndTime = performance.now();
      setLoading(false);
      console.log("[ClearanceItems] fetchData - Loading state set to false", {
        totalDuration: `${(loadingEndTime - fetchStartTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields based on clearance type
    if (clearance?.clearanceType === "Vehicle/Equipment") {
      if (!form.materialDescription.trim()) {
        showSnackbar("Item Description is required", "error");
        return;
      }
    } else {
      if (!form.roomArea.trim()) {
        showSnackbar("Room/Area is required", "error");
        return;
      }

      if (!form.locationDescription.trim()) {
        showSnackbar("Location Description is required", "error");
        return;
      }

      if (!form.materialDescription.trim()) {
        showSnackbar("Materials Description is required", "error");
        return;
      }
    }

    try {
      const itemData =
        clearance?.clearanceType === "Vehicle/Equipment"
          ? {
              // For Vehicle/Equipment, use placeholder values for required fields
              roomArea: "N/A", // Placeholder for required field
              locationDescription: "N/A", // Placeholder for required field
              materialDescription: form.materialDescription, // Item Description
              asbestosType: form.asbestosType, // Material Type
              notes: form.notes,
            }
          : {
              locationDescription: form.locationDescription,
              levelFloor: showLevelFloor ? form.levelFloor : "",
              roomArea: form.roomArea,
              materialDescription: form.materialDescription,
              asbestosType: form.asbestosType,
              notes: form.notes,
            };

      console.log("Submitting item data:", itemData);

      if (editingItem) {
        await asbestosClearanceService.updateItem(
          clearanceId,
          editingItem._id,
          itemData,
        );
        showSnackbar("Item updated successfully", "success");
        setDialogOpen(false);
        setEditingItem(null);
        resetForm();
        await fetchData();
      } else {
        await asbestosClearanceService.addItem(clearanceId, itemData);
        showSnackbar("Item created successfully. Add photos below.", "success");

        // Close the item dialog and refresh data
        setDialogOpen(false);
        resetForm();
        await fetchData();

        // Find the newly created item and open photo gallery
        const updatedItems =
          await asbestosClearanceService.getItems(clearanceId);
        const createdItem = updatedItems.find(
          (item) =>
            item.locationDescription === itemData.locationDescription &&
            item.roomArea === itemData.roomArea &&
            item.materialDescription === itemData.materialDescription,
        );

        if (createdItem) {
          setSelectedItemForPhotos(createdItem);
          setPhotoGalleryDialogOpen(true);
        }
      }

      // Update clearance type based on all items (only for editing, since we already fetched items for new items)
      if (editingItem) {
        const updatedItems =
          await asbestosClearanceService.getItems(clearanceId);
        await updateClearanceTypeFromItems(updatedItems);
      }
    } catch (err) {
      console.error("Error saving item:", err);
      showSnackbar("Failed to save item", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      locationDescription: item.locationDescription || "",
      levelFloor: item.levelFloor || "",
      roomArea: item.roomArea || "",
      materialDescription: item.materialDescription,
      asbestosType: item.asbestosType,
      notes: item.notes || "",
    });
    // Don't show level floor checkbox for Vehicle/Equipment items
    setShowLevelFloor(
      clearance?.clearanceType !== "Vehicle/Equipment" && !!item.levelFloor,
    );
    // Reset first tap state when editing
    setFirstTapFields({
      levelFloor: false,
      roomArea: false,
      locationDescription: false,
      materialDescription: false,
    });
    setDialogOpen(true);
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await asbestosClearanceService.deleteItem(clearanceId, itemToDelete._id);
      showSnackbar("Item deleted successfully", "success");
      await fetchData();

      // Update clearance type based on remaining items
      const updatedItems = await asbestosClearanceService.getItems(clearanceId);
      await updateClearanceTypeFromItems(updatedItems);
    } catch (err) {
      console.error("Error deleting item:", err);
      showSnackbar("Failed to delete item", "error");
    } finally {
      setDeleteConfirmDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialogOpen(false);
    setItemToDelete(null);
  };

  const resetForm = () => {
    setForm({
      locationDescription: "",
      levelFloor: "",
      roomArea: "",
      materialDescription: "",
      asbestosType: "non-friable",
      notes: "",
    });
    setShowLevelFloor(false);
    // Reset first tap state when form is reset
    setFirstTapFields({
      levelFloor: false,
      roomArea: false,
      locationDescription: false,
      materialDescription: false,
    });
  };

  // Function to automatically determine and update clearance type based on asbestos items
  const updateClearanceTypeFromItems = async (items) => {
    if (!items || items.length === 0) {
      return;
    }

    // Don't auto-update clearance type for Vehicle/Equipment or specialized clearance types
    if (
      clearance?.clearanceType === "Vehicle/Equipment" ||
      clearance?.clearanceType === "Friable (Non-Friable Conditions)"
    ) {
      return;
    }

    const hasFriable = items.some((item) => item.asbestosType === "friable");
    const hasNonFriable = items.some(
      (item) => item.asbestosType === "non-friable",
    );

    let newClearanceType;
    // Determine clearance type based on asbestos items
    // If has both friable and non-friable, use "Friable (Non-Friable Conditions)"
    // Otherwise use the predominant type
    if (hasFriable && hasNonFriable) {
      newClearanceType = "Friable (Non-Friable Conditions)";
    } else if (hasFriable) {
      newClearanceType = "Friable";
    } else {
      newClearanceType = "Non-friable";
    }

    // Update the clearance type if it has changed
    if (clearance && clearance.clearanceType !== newClearanceType) {
      try {
        await asbestosClearanceService.update(clearanceId, {
          clearanceType: newClearanceType,
        });

        // Update local state
        setClearance((prev) => ({
          ...prev,
          clearanceType: newClearanceType,
        }));

        console.log(
          `Clearance type automatically updated to: ${newClearanceType}`,
        );
      } catch (error) {
        console.error("Error updating clearance type:", error);
      }
    }
  };

  const getAsbestosTypeColor = (type) => {
    switch (type) {
      case "Friable":
        return "error";
      case "Non-friable":
        return "warning";
      default:
        return "default";
    }
  };

  const formatAsbestosType = (type) => {
    if (!type) return "Non-friable";
    return type.charAt(0).toUpperCase() + type.slice(1).replace("-", "-");
  };

  const handleTakePhoto = async () => {
    // Check if the device supports camera access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback to file input with camera capture
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment"; // Use back camera on mobile devices
      input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
          handlePhotoUploadForGallery({ target: { files: [file] } });
        }
      };
      input.click();
      return;
    }

    try {
      // Request fullscreen immediately (within user gesture) to hide URL bar on mobile
      try {
        document.documentElement.requestFullscreen?.();
      } catch {
        // Fullscreen not supported or denied; continue with overlay only
      }
      // First try to get back camera
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Use back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (backCameraError) {
        console.log(
          "Back camera not available, trying any camera:",
          backCameraError,
        );
        // Fallback to any available camera
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      console.log("Camera stream obtained:", mediaStream);
      setStream(mediaStream);
      // Reset zoom and pan when opening camera
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setLastPinchDistance(null);
      setLastPanPoint(null);
      setPhotoGalleryDialogOpen(false); // Hide manage-photos modal so camera is on top
      setCameraDialogOpen(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      let errorMessage =
        "Failed to access camera. Please check permissions or use upload instead.";

      if (error.name === "NotAllowedError") {
        errorMessage =
          "Camera access denied. Please allow camera permissions and try again.";
      } else if (error.name === "NotFoundError") {
        errorMessage =
          "No camera found on this device. Please use upload instead.";
      } else if (error.name === "NotSupportedError") {
        errorMessage =
          "Camera access is not supported on this device. Please use upload instead.";
      }

      showSnackbar(errorMessage, "error");
    }
  };

  const handleCapturePhoto = async () => {
    if (videoRef) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      // Set canvas dimensions to match video
      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;

      // If zoomed, capture the zoomed portion
      if (zoom > 1 && videoContainerRef.current) {
        // Get container dimensions to calculate scale factor
        const container = videoContainerRef.current;
        const containerRect = container.getBoundingClientRect();

        // Calculate the scale factor between container and video
        // The video is displayed with objectFit: cover, so we need to account for that
        const videoAspect = videoRef.videoWidth / videoRef.videoHeight;
        const containerAspect = containerRect.width / containerRect.height;

        let videoDisplayWidth, videoDisplayHeight;
        if (videoAspect > containerAspect) {
          // Video is wider - height fits container
          videoDisplayHeight = containerRect.height;
          videoDisplayWidth = videoDisplayHeight * videoAspect;
        } else {
          // Video is taller - width fits container
          videoDisplayWidth = containerRect.width;
          videoDisplayHeight = videoDisplayWidth / videoAspect;
        }

        // Calculate the source rectangle based on zoom and pan
        const sourceWidth = videoRef.videoWidth / zoom;
        const sourceHeight = videoRef.videoHeight / zoom;

        // Convert pan from container pixels to video pixels
        const panXVideo = (panX * videoDisplayWidth) / containerRect.width;
        const panYVideo = (panY * videoDisplayHeight) / containerRect.height;

        // Calculate source X and Y, accounting for pan
        const sourceX = (videoRef.videoWidth - sourceWidth) / 2 - panXVideo;
        const sourceY = (videoRef.videoHeight - sourceHeight) / 2 - panYVideo;

        // Ensure we don't go out of bounds
        const clampedSourceX = Math.max(
          0,
          Math.min(sourceX, videoRef.videoWidth - sourceWidth),
        );
        const clampedSourceY = Math.max(
          0,
          Math.min(sourceY, videoRef.videoHeight - sourceHeight),
        );
        const clampedSourceWidth = Math.min(
          sourceWidth,
          videoRef.videoWidth - clampedSourceX,
        );
        const clampedSourceHeight = Math.min(
          sourceHeight,
          videoRef.videoHeight - clampedSourceY,
        );

        // Draw the zoomed portion to canvas, scaled to fill
        context.drawImage(
          videoRef,
          clampedSourceX,
          clampedSourceY,
          clampedSourceWidth,
          clampedSourceHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      } else {
        // No zoom, capture full frame
        context.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
      }

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `clearance-photo-${timestamp}.jpg`;

      // Capture full-quality version first
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            // eslint-disable-next-line no-unused-vars -- used when save-to-device block is re-enabled
            const fullQualityFile = new File([blob], filename, {
              type: "image/jpeg",
            });

            // Temporarily disabled - save photo to device (re-enable when ready)
            // try {
            //   const projectFolderName = getProjectFolderName();
            //   await saveFileToDevice(fullQualityFile, filename, {
            //     projectId: projectFolderName
            //       ? `${projectFolderName} - Photos`
            //       : "clearance-photos",
            //   });
            // } catch (error) {
            //   console.error("Error saving photo to device:", error);
            // }

            // Now process the full-quality file for upload (will be compressed if needed)
            // Pass it with a special name to prevent double-saving in handlePhotoUploadForGallery
            const uploadFile = new File([blob], "camera-photo.jpg", {
              type: "image/jpeg",
            });
            handlePhotoUploadForGallery({ target: { files: [uploadFile] } });
          }
        },
        "image/jpeg",
        1.0, // Full quality for device storage
      );
    }

    // Close camera dialog and stop stream
    handleCloseCamera();
  };

  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraDialogOpen(false);
    // Reset zoom and pan when closing camera
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setLastPinchDistance(null);
    setLastPanPoint(null);
    setPhotoGalleryDialogOpen(true); // Re-open manage-photos modal when camera closes
    try {
      document.exitFullscreen?.();
    } catch {
      // Ignore if not in fullscreen
    }
  };

  // Calculate distance between two touch points
  const getDistance = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Get center point between two touches
  const getCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  // Handle touch start for pinch zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      e.preventDefault();
      zoomPanRef.current = { zoom, panX, panY };
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastPinchDistance(distance);
      const center = getCenter(e.touches[0], e.touches[1]);
      setLastPanPoint(center);
    } else if (e.touches.length === 1) {
      const currentTime = new Date().getTime();
      const timeSinceLastTap = currentTime - lastTapTime;

      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        setZoom(1);
        setPanX(0);
        setPanY(0);
        setLastTapTime(0);
        zoomPanRef.current = { zoom: 1, panX: 0, panY: 0 };
        if (zoomWrapperRef.current) {
          zoomWrapperRef.current.style.transform =
            "scale(1) translate(0px, 0px)";
        }
        return;
      }

      setLastTapTime(currentTime);

      if (zoom > 1) {
        zoomPanRef.current = { zoom, panX, panY };
        setLastPanPoint({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      }
    }
  };

  // Handle touch move for pinch zoom and pan (ref-based for live zoom, no re-renders)
  const handleTouchMove = (e) => {
    e.preventDefault();

    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      const center = getCenter(e.touches[0], e.touches[1]);

      if (
        lastPinchDistance !== null &&
        videoContainerRef.current &&
        zoomWrapperRef.current
      ) {
        const scale = distance / lastPinchDistance;
        const {
          zoom: curZoom,
          panX: curPanX,
          panY: curPanY,
        } = zoomPanRef.current;
        const newZoom = Math.max(1, Math.min(5, curZoom * scale));
        const container = videoContainerRef.current;
        const rect = container.getBoundingClientRect();
        const containerCenterX = rect.width / 2;
        const containerCenterY = rect.height / 2;
        const pinchCenterX = center.x - rect.left - containerCenterX;
        const pinchCenterY = center.y - rect.top - containerCenterY;
        const zoomChange = newZoom / curZoom;
        const newPanX = curPanX - (pinchCenterX * (zoomChange - 1)) / newZoom;
        const newPanY = curPanY - (pinchCenterY * (zoomChange - 1)) / newZoom;
        const maxPan = (newZoom - 1) * 50;
        const clampedPanX = Math.max(-maxPan, Math.min(maxPan, newPanX));
        const clampedPanY = Math.max(-maxPan, Math.min(maxPan, newPanY));
        zoomPanRef.current = {
          zoom: newZoom,
          panX: clampedPanX,
          panY: clampedPanY,
        };
        zoomWrapperRef.current.style.transform = `scale(${newZoom}) translate(${clampedPanX}px, ${clampedPanY}px)`;
        setLastPinchDistance(distance);
        setLastPanPoint(center);
      } else {
        setLastPinchDistance(distance);
        setLastPanPoint(center);
      }
    } else if (
      e.touches.length === 1 &&
      lastPanPoint &&
      zoomPanRef.current.zoom > 1
    ) {
      const curZoom = zoomPanRef.current.zoom;
      const deltaX = (e.touches[0].clientX - lastPanPoint.x) / curZoom;
      const deltaY = (e.touches[0].clientY - lastPanPoint.y) / curZoom;
      const maxPan = (curZoom - 1) * 50;
      const newPanX = Math.max(
        -maxPan,
        Math.min(maxPan, zoomPanRef.current.panX + deltaX),
      );
      const newPanY = Math.max(
        -maxPan,
        Math.min(maxPan, zoomPanRef.current.panY + deltaY),
      );
      zoomPanRef.current = {
        ...zoomPanRef.current,
        panX: newPanX,
        panY: newPanY,
      };
      if (zoomWrapperRef.current) {
        zoomWrapperRef.current.style.transform = `scale(${zoomPanRef.current.zoom}) translate(${newPanX}px, ${newPanY}px)`;
      }
      setLastPanPoint({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
    }
  };

  // Handle touch end - sync ref back to state
  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setLastPinchDistance(null);
    }
    if (e.touches.length === 0) {
      const { zoom: z, panX: px, panY: py } = zoomPanRef.current;
      setZoom(z);
      setPanX(px);
      setPanY(py);
      setLastPanPoint(null);
    }
  };

  // Open photo gallery for an item
  const handleOpenPhotoGallery = (item) => {
    console.log("[ClearanceItems] handleOpenPhotoGallery - Opening gallery", {
      itemId: item._id,
      photoCount: item.photographs?.length || 0,
      timestamp: new Date().toISOString(),
    });
    setSelectedItemForPhotos(item);
    setPhotoGalleryDialogOpen(true);
  };

  // Close photo gallery
  const handleClosePhotoGallery = async () => {
    setPhotoGalleryDialogOpen(false);
    setSelectedItemForPhotos(null);
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
    setLocalPhotoChanges({});
    setPhotosToDelete(new Set());
    setLocalPhotoDescriptions({});
    setEditingDescriptionPhotoId(null);
    setFullSizePhotoId(null);
    setFullSizeArrowMode(false);
    setSelectedArrowId(null);
    setMovingArrowId(null);

    await fetchData();
  };

  // Handle site plan save
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

    showSnackbar("Drawn site plan saved successfully!", "success");
    setSitePlanDrawingDialogOpen(false);
    fetchData();
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
    } catch (error) {
      console.error("Error saving site plan:", error);
      showSnackbar("Error saving site plan", "error");
    }
  };

  // Handle site plan drawing dialog close (X button, backdrop click)
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
      } catch (error) {
        console.error("Error saving site plan:", error);
        showSnackbar("Error saving site plan", "error");
      }
    }
  };

  // Add photo to existing item
  const handleAddPhotoToItem = async (photoData) => {
    if (!selectedItemForPhotos) return;

    try {
      const response = await asbestosClearanceService.addPhotoToItem(
        clearanceId,
        selectedItemForPhotos._id,
        photoData,
        true, // includeInReport default to true
      );

      // Update the selected item with the new photo data immediately
      if (response && response.photographs) {
        setSelectedItemForPhotos((prev) => ({
          ...prev,
          photographs: response.photographs,
        }));
      } else if (response) {
        // If response is the entire item, update the selected item
        setSelectedItemForPhotos(response);
      }

      setPhotoPreview(null);
      setPhotoFile(null);
      setCompressionStatus(null);
      showSnackbar("Photo added successfully", "success");
    } catch (error) {
      console.error("Error adding photo:", error);
      showSnackbar("Failed to add photo", "error");
    }
  };

  // Delete photo from item
  // Delete photo from item (local state only)
  const handleDeletePhotoFromItem = (itemId, photoId) => {
    setPhotosToDelete((prev) => new Set([...prev, photoId]));
  };

  // Toggle photo inclusion in report
  // Toggle photo inclusion in report (local state only)
  const handleTogglePhotoInReport = (itemId, photoId) => {
    setLocalPhotoChanges((prev) => ({
      ...prev,
      [photoId]: !getCurrentPhotoState(photoId),
    }));
  };

  // View full-size photo (accept photo object for arrow support)
  const handleViewFullSizePhoto = (photo) => {
    const url = typeof photo === "string" ? photo : photo?.data;
    setFullSizePhotoUrl(url);
    setFullSizePhotoId(typeof photo === "object" && photo?._id ? photo._id : null);
    setFullSizeArrowMode(false);
    setSelectedArrowId(null);
    setMovingArrowId(null);
    const firstArrow = typeof photo === "object" && getPhotoArrows(photo)[0];
    setSelectedArrowColor(firstArrow?.color || DEFAULT_ARROW_COLOR);
    setFullSizePhotoDialogOpen(true);
  };

  const fullSizePhoto =
    fullSizePhotoId && selectedItemForPhotos?.photographs
      ? selectedItemForPhotos.photographs.find((p) => p._id === fullSizePhotoId)
      : null;

  const handleFullSizePhotoClickForArrow = (e) => {
    if (!fullSizePhotoId || !fullSizePhoto) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));
    if (movingArrowId) {
      handleUpdatePhotoArrow(fullSizePhotoId, movingArrowId, {
        x: clampedX,
        y: clampedY,
      });
      return;
    }
    if (fullSizeArrowMode) {
      handleAddPhotoArrow(fullSizePhotoId, {
        x: clampedX,
        y: clampedY,
        rotation: DEFAULT_ARROW_ROTATION,
        color: selectedArrowColor,
      });
    }
  };

  // Helper function to get current photo state (including local changes)
  const getCurrentPhotoState = (photoId) => {
    const localChange = localPhotoChanges[photoId];
    if (localChange !== undefined) {
      return localChange;
    }
    // Find the photo in the selected item
    const photo = selectedItemForPhotos?.photographs?.find(
      (p) => p._id === photoId,
    );
    return photo?.includeInReport ?? true;
  };

  // Generate default photo description based on clearance type and item data
  const generateDefaultPhotoDescription = (item, clearanceType) => {
    if (clearanceType === "Vehicle/Equipment") {
      return item.materialDescription || "Unknown Item";
    } else {
      const roomArea = (item.roomArea || "unknown room/area").toLowerCase();
      const materialDesc = (
        item.locationDescription ||
        item.materialDescription ||
        "unknown material"
      ).toLowerCase();
      return `Photograph after removal of ${materialDesc} to ${roomArea}`;
    }
  };

  // Get current photo description (including local changes or default)
  const getCurrentPhotoDescription = (photoId, item) => {
    // Check if there's a local change
    if (localPhotoDescriptions[photoId] !== undefined) {
      return localPhotoDescriptions[photoId];
    }

    // Check if photo has a stored description
    const photo = selectedItemForPhotos?.photographs?.find(
      (p) => p._id === photoId,
    );
    if (photo?.description) {
      return photo.description;
    }

    // Generate default description
    return generateDefaultPhotoDescription(item, clearance?.clearanceType);
  };

  // Handle description change
  const handleDescriptionChange = (photoId, newDescription) => {
    setLocalPhotoDescriptions((prev) => ({
      ...prev,
      [photoId]: newDescription,
    }));
  };

  const getPhotoArrows = (photo) => {
    if (!photo) return [];
    if (photo.arrows && photo.arrows.length > 0) return photo.arrows;
    const leg = photo.arrow;
    if (leg && typeof leg === "object" && (leg.x != null || leg.y != null))
      return [leg];
    return [];
  };

  const handleAddPhotoArrow = async (photoId, arrow) => {
    if (!selectedItemForPhotos || !clearanceId) return;
    try {
      const response = await asbestosClearanceService.addPhotoArrow(
        clearanceId,
        selectedItemForPhotos._id,
        photoId,
        {
          x: arrow.x ?? 0.5,
          y: arrow.y ?? 0.5,
          rotation: arrow.rotation ?? DEFAULT_ARROW_ROTATION,
          color: arrow.color ?? DEFAULT_ARROW_COLOR,
        },
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      setFullSizeArrowMode(false);
      showSnackbar("Arrow added", "success");
    } catch (err) {
      console.error("Error adding arrow:", err);
      showSnackbar("Failed to add arrow", "error");
    }
  };

  const handleUpdatePhotoArrow = async (photoId, arrowId, updates) => {
    if (!selectedItemForPhotos || !clearanceId) return;
    try {
      const response = await asbestosClearanceService.updatePhotoArrow(
        clearanceId,
        selectedItemForPhotos._id,
        photoId,
        arrowId,
        updates,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      setMovingArrowId(null);
      setFullSizeArrowMode(false);
      showSnackbar("Arrow updated", "success");
    } catch (err) {
      console.error("Error updating arrow:", err);
      showSnackbar("Failed to update arrow", "error");
    }
  };

  const handleDeletePhotoArrow = async (photoId, arrowId) => {
    if (!selectedItemForPhotos || !clearanceId) return;
    try {
      const response = await asbestosClearanceService.deletePhotoArrow(
        clearanceId,
        selectedItemForPhotos._id,
        photoId,
        arrowId,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      if (selectedArrowId === arrowId) setSelectedArrowId(null);
      setFullSizeArrowMode(false);
      showSnackbar("Arrow removed", "success");
    } catch (err) {
      console.error("Error deleting arrow:", err);
      showSnackbar("Failed to remove arrow", "error");
    }
  };

  const handleClearAllArrows = async (photoId) => {
    if (!selectedItemForPhotos || !clearanceId) return;
    try {
      const response = await asbestosClearanceService.updatePhotoArrowLegacy(
        clearanceId,
        selectedItemForPhotos._id,
        photoId,
        null,
      );
      if (response?.item) setSelectedItemForPhotos(response.item);
      showSnackbar("Arrows cleared", "success");
    } catch (err) {
      console.error("Error clearing arrows:", err);
      showSnackbar("Failed to clear arrows", "error");
    }
  };

  // Helper function to check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return (
      Object.keys(localPhotoChanges).length > 0 ||
      photosToDelete.size > 0 ||
      Object.keys(localPhotoDescriptions).length > 0
    );
  };

  // Helper function to apply local changes to photo state
  const applyLocalChangesToPhoto = (photo) => {
    const localChange = localPhotoChanges[photo._id];
    return {
      ...photo,
      includeInReport:
        localChange !== undefined ? localChange : photo.includeInReport,
    };
  };

  // Helper function to check if photo is marked for deletion
  const isPhotoMarkedForDeletion = (photoId) => {
    return photosToDelete.has(photoId);
  };

  // Save all photo changes to backend
  const savePhotoChanges = async () => {
    try {
      const togglePromises = [];
      const descriptionPromises = [];
      let toggleResults = [];
      let descriptionResults = [];
      let deletionResults = [];

      // Handle photo inclusion changes (can be done in parallel)
      Object.entries(localPhotoChanges).forEach(
        ([photoId, includeInReport]) => {
          const photo = selectedItemForPhotos?.photographs?.find(
            (p) => p._id === photoId,
          );
          if (photo && photo.includeInReport !== includeInReport) {
            togglePromises.push(
              asbestosClearanceService.togglePhotoInReport(
                clearanceId,
                selectedItemForPhotos._id,
                photoId,
              ),
            );
          }
        },
      );

      // Handle photo description changes (can be done in parallel)
      Object.entries(localPhotoDescriptions).forEach(
        ([photoId, description]) => {
          descriptionPromises.push(
            asbestosClearanceService.updatePhotoDescription(
              clearanceId,
              selectedItemForPhotos._id,
              photoId,
              description,
            ),
          );
        },
      );

      // Process toggle operations in parallel
      if (togglePromises.length > 0) {
        toggleResults = await Promise.allSettled(togglePromises);
      }

      // Process description updates in parallel
      if (descriptionPromises.length > 0) {
        descriptionResults = await Promise.allSettled(descriptionPromises);
      }

      // Handle photo deletions sequentially to avoid backend race conditions
      // Process deletions one at a time to prevent concurrent modification errors
      for (const photoId of photosToDelete) {
        try {
          await asbestosClearanceService.deletePhotoFromItem(
            clearanceId,
            selectedItemForPhotos._id,
            photoId,
          );
          deletionResults.push({ status: "fulfilled", photoId });
        } catch (error) {
          console.error(`Error deleting photo ${photoId}:`, error);
          deletionResults.push({ status: "rejected", photoId, reason: error });
        }
      }

      // Combine results
      const allResults = [
        ...toggleResults,
        ...descriptionResults,
        ...deletionResults,
      ];
      const failures = allResults.filter((r) => r.status === "rejected");
      const successes = allResults.filter((r) => r.status === "fulfilled");

      // Log any failures for debugging
      failures.forEach((result) => {
        if (result.reason) {
          console.error(
            `Operation failed for photo ${result.photoId || "unknown"}:`,
            result.reason,
          );
        }
      });

      if (failures.length > 0) {
        if (successes.length === 0) {
          // All operations failed
          showSnackbar("Failed to save photo changes", "error");
          return;
        } else {
          // Some operations succeeded, some failed
          showSnackbar(
            `Saved ${successes.length} of ${allResults.length} changes. Some operations failed.`,
            "warning",
          );
        }
      } else {
        // All operations succeeded
        showSnackbar("Photo changes saved successfully", "success");
      }

      // Clear local changes - refresh will update the state
      // Only clear if we had at least some successes
      if (successes.length > 0) {
        setLocalPhotoChanges({});
        setPhotosToDelete(new Set());
        setLocalPhotoDescriptions({});
      }

      // Refresh data to get updated state
      await fetchData();

      // Update selected item
      const updatedItems = await asbestosClearanceService.getItems(clearanceId);
      const updatedItem = updatedItems.find(
        (item) => item._id === selectedItemForPhotos._id,
      );
      if (updatedItem) {
        setSelectedItemForPhotos(updatedItem);
      }
    } catch (error) {
      console.error("Error saving photo changes:", error);
      showSnackbar("Failed to save photo changes", "error");
    }
  };

  // Handle photo upload for photo gallery
  const handlePhotoUploadForGallery = async (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("[ClearanceItems] handlePhotoUploadForGallery - Starting", {
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(2)}KB`,
        fileType: file.type,
        timestamp: new Date().toISOString(),
      });
      const uploadStartTime = performance.now();

      setPhotoFile(file);
      setCompressionStatus({
        type: "processing",
        message: "Processing image...",
      });

      try {
        const originalSizeKB = Math.round(file.size / 1024);
        const shouldCompress = needsCompression(file, 300);

        console.log(
          "[ClearanceItems] handlePhotoUploadForGallery - Compression check",
          {
            originalSizeKB,
            shouldCompress,
            timestamp: new Date().toISOString(),
          },
        );

        if (shouldCompress) {
          console.log(
            "[ClearanceItems] handlePhotoUploadForGallery - Starting compression",
            {
              timestamp: new Date().toISOString(),
            },
          );
          const compressionStartTime = performance.now();

          setCompressionStatus({
            type: "compressing",
            message: "Compressing image...",
          });

          const compressedImage = await compressImage(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
            maxSizeKB: 300,
          });

          const compressionEndTime = performance.now();
          console.log(
            "[ClearanceItems] handlePhotoUploadForGallery - Compression completed",
            {
              compressionDuration: `${(
                compressionEndTime - compressionStartTime
              ).toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            },
          );

          const compressedSizeKB = Math.round(
            (compressedImage.length * 0.75) / 1024,
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100,
          );

          console.log(
            "[ClearanceItems] handlePhotoUploadForGallery - Adding compressed photo",
            {
              timestamp: new Date().toISOString(),
            },
          );
          const addStartTime = performance.now();
          await handleAddPhotoToItem(compressedImage);
          const addEndTime = performance.now();
          console.log(
            "[ClearanceItems] handlePhotoUploadForGallery - Photo added",
            {
              addDuration: `${(addEndTime - addStartTime).toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
            },
          );

          setCompressionStatus({
            type: "success",
            message: `Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${reduction}% reduction)`,
          });
        } else {
          console.log(
            "[ClearanceItems] handlePhotoUploadForGallery - No compression needed, reading file",
            {
              timestamp: new Date().toISOString(),
            },
          );
          const readStartTime = performance.now();
          const reader = new FileReader();
          reader.onload = async (e) => {
            const readEndTime = performance.now();
            console.log(
              "[ClearanceItems] handlePhotoUploadForGallery - File read completed",
              {
                readDuration: `${(readEndTime - readStartTime).toFixed(2)}ms`,
                timestamp: new Date().toISOString(),
              },
            );
            const addStartTime = performance.now();
            await handleAddPhotoToItem(e.target.result);
            const addEndTime = performance.now();
            console.log(
              "[ClearanceItems] handlePhotoUploadForGallery - Photo added",
              {
                addDuration: `${(addEndTime - addStartTime).toFixed(2)}ms`,
                timestamp: new Date().toISOString(),
              },
            );
            setCompressionStatus({
              type: "info",
              message: `No compression needed (${originalSizeKB}KB)`,
            });
          };
          reader.readAsDataURL(file);
        }

        const uploadEndTime = performance.now();
        console.log(
          "[ClearanceItems] handlePhotoUploadForGallery - Completed",
          {
            totalDuration: `${(uploadEndTime - uploadStartTime).toFixed(2)}ms`,
            timestamp: new Date().toISOString(),
          },
        );
      } catch (error) {
        const uploadEndTime = performance.now();
        console.error("[ClearanceItems] handlePhotoUploadForGallery - Error", {
          error: error,
          errorMessage: error.message,
          totalDuration: `${(uploadEndTime - uploadStartTime).toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
        setCompressionStatus({
          type: "error",
          message: "Failed to process image",
        });
      }
    }
  };

  const fetchAirMonitoringReports = async () => {
    console.log("[ClearanceItems] fetchAirMonitoringReports - Starting", {
      projectId: clearance?.projectId?._id,
      asbestosRemovalJobId,
      timestamp: new Date().toISOString(),
    });
    const startTime = performance.now();

    if (!clearance?.projectId?._id) {
      console.warn(
        "[ClearanceItems] fetchAirMonitoringReports - No project ID",
        {
          timestamp: new Date().toISOString(),
        },
      );
      showSnackbar("No project found for this clearance", "error");
      return;
    }

    try {
      setLoadingReports(true);

      // Always use asbestos removal job ID - this ensures we only show reports for the correct job
      // This is critical when multiple asbestos removal jobs exist for the same project
      if (!asbestosRemovalJobId) {
        console.error(
          "[ClearanceItems] fetchAirMonitoringReports - No asbestos removal job ID available",
          {
            projectId: clearance?.projectId?._id,
            timestamp: new Date().toISOString(),
          },
        );
        showSnackbar(
          "Unable to identify asbestos removal job for this clearance. Please ensure the clearance is properly linked to an asbestos removal job.",
          "error",
        );
        setLoadingReports(false);
        return;
      }

      console.log(
        "[ClearanceItems] fetchAirMonitoringReports - Fetching by job ID",
        {
          asbestosRemovalJobId,
          timestamp: new Date().toISOString(),
        },
      );
      const apiStartTime = performance.now();
      const reports =
        await asbestosClearanceService.getAirMonitoringReportsByJob(
          asbestosRemovalJobId,
        );
      const apiEndTime = performance.now();
      console.log(
        "[ClearanceItems] fetchAirMonitoringReports - Reports fetched by job",
        {
          reportsCount: Array.isArray(reports) ? reports.length : 0,
          apiDuration: `${(apiEndTime - apiStartTime).toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        },
      );
      setAirMonitoringReports(reports);

      const endTime = performance.now();
      console.log("[ClearanceItems] fetchAirMonitoringReports - Completed", {
        totalDuration: `${(endTime - startTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const endTime = performance.now();
      console.error("[ClearanceItems] fetchAirMonitoringReports - Error", {
        error: error,
        errorMessage: error.message,
        totalDuration: `${(endTime - startTime).toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
      });
      showSnackbar("Failed to fetch air monitoring reports", "error");
    } finally {
      setLoadingReports(false);
      console.log(
        "[ClearanceItems] fetchAirMonitoringReports - Loading state set to false",
        {
          timestamp: new Date().toISOString(),
        },
      );
    }
  };

  const handleOpenAirMonitoringReportsDialog = () => {
    setAirMonitoringReportsDialogOpen(true);
    fetchAirMonitoringReports();
  };

  const handleSelectAirMonitoringReport = async (reportsToAttach) => {
    const list = Array.isArray(reportsToAttach) ? reportsToAttach : [reportsToAttach];
    if (list.length === 0) return;
    try {
      setGeneratingAirMonitoringPDF(true);

      const { generateShiftReport } =
        await import("../../utils/generateShiftReport");
      const { shiftService, sampleService, projectService, clientService } =
        await import("../../services/api");
      const asbestosRemovalJobService = (
        await import("../../services/asbestosRemovalJobService")
      ).default;

      const reportsPayload = [];
      for (const report of list) {
        const shiftResponse = await shiftService.getById(report._id);
        const shift = shiftResponse.data;
        const jobResponse = await asbestosRemovalJobService.getById(report.jobId);
        const job = jobResponse.data;
        const samplesResponse = await sampleService.getByShift(report._id);
        const samples = samplesResponse.data || [];

        let project = job.projectId;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        const pdfDataUrl = await generateShiftReport({
          shift,
          job,
          samples,
          projectId: project,
          returnPdfData: true,
          sitePlanData: shift.sitePlan
            ? { sitePlan: shift.sitePlan, sitePlanData: shift.sitePlanData }
            : null,
        });
        const base64Data = pdfDataUrl.split(",")[1];
        reportsPayload.push({
          reportData: base64Data,
          shiftDate: shift.date,
          shiftId: shift._id,
        });
      }

      await asbestosClearanceService.uploadAirMonitoringReport(clearanceId, {
        reports: reportsPayload,
        airMonitoring: true,
      });

      showSnackbar(
        list.length === 1
          ? "Air monitoring report attached successfully"
          : `${list.length} air monitoring reports attached successfully`,
        "success",
      );

      setAirMonitoringReportsDialogOpen(false);
      setAttachmentsModalOpen(false);
      setSelectedReports([]);
      fetchData();
    } catch (error) {
      console.error("Error selecting air monitoring report(s):", error);
      showSnackbar("Failed to attach air monitoring report(s)", "error");
    } finally {
      setGeneratingAirMonitoringPDF(false);
    }
  };

  const handleRemoveAirMonitoringReport = async () => {
    if (
      window.confirm(
        "Are you sure you want to remove the air monitoring report?",
      )
    ) {
      try {
        // Update the clearance to remove the air monitoring report(s) and disable air monitoring
        await asbestosClearanceService.update(clearanceId, {
          airMonitoringReport: null,
          airMonitoringReports: [],
          airMonitoring: false, // Disable air monitoring when report is removed
        });

        showSnackbar("Air monitoring report removed successfully", "success");

        fetchData(); // Refresh clearance data
      } catch (error) {
        console.error("Error removing air monitoring report:", error);
        showSnackbar("Failed to remove air monitoring report", "error");
      }
    }
  };

  const handleSitePlanFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSitePlanFile(file);
    }
  };

  const handleUploadSitePlan = async () => {
    if (!sitePlanFile) {
      showSnackbar("Please select a file first", "error");
      return;
    }

    try {
      setUploadingSitePlan(true);

      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Extract just the base64 data from the data URL
          const dataUrl = event.target.result;
          const base64Data = dataUrl.split(",")[1]; // Remove the "data:application/pdf;base64," prefix

          // Update the clearance with the site plan file
          await asbestosClearanceService.update(clearanceId, {
            sitePlanFile: base64Data,
            sitePlanLegend: [],
            sitePlanLegendTitle: null,
          });

          showSnackbar("Site plan uploaded successfully", "success");

          setSitePlanDialogOpen(false);
          setSitePlanFile(null);
          fetchData(); // Refresh clearance data
        } catch (error) {
          console.error("Error uploading site plan:", error);
          showSnackbar("Failed to upload site plan", "error");
        } finally {
          setUploadingSitePlan(false);
        }
      };
      reader.readAsDataURL(sitePlanFile);
    } catch (error) {
      console.error("Error processing site plan file:", error);
      showSnackbar("Failed to process site plan file", "error");
      setUploadingSitePlan(false);
    }
  };

  const handleRemoveSitePlan = async () => {
    if (window.confirm("Are you sure you want to remove the site plan?")) {
      try {
        // Update the clearance to remove the site plan file
        await asbestosClearanceService.update(clearanceId, {
          sitePlanFile: null,
          sitePlanSource: null, // Backend will convert null to undefined to remove the field
          sitePlanLegend: [],
          sitePlanLegendTitle: null,
        });

        showSnackbar("Site plan removed successfully", "success");

        fetchData(); // Refresh clearance data
      } catch (error) {
        console.error("Error removing site plan:", error);
        showSnackbar("Failed to remove site plan", "error");
      }
    }
  };

  const handleCompleteJob = () => {
    setCompleteDialogOpen(true);
  };

  const confirmCompleteJob = async () => {
    try {
      await asbestosClearanceService.update(clearanceId, {
        status: "complete",
      });
      setJobCompleted(true);
      showSnackbar("Job completed successfully!", "success");
      fetchData(); // Refresh the data to show updated status

      console.log(
        "Complete clearance button clicked - asbestosRemovalJobId:",
        asbestosRemovalJobId,
      );

      // Navigate to asbestos removal job details after completing clearance
      if (asbestosRemovalJobId) {
        console.log(
          "Navigating to asbestos removal job details:",
          `/asbestos-removal/jobs/${asbestosRemovalJobId}/details`,
        );
        // Navigate to the asbestos removal job details using the already fetched job ID
        navigate(`/asbestos-removal/jobs/${asbestosRemovalJobId}/details`);
      } else {
        console.log(
          "No asbestosRemovalJobId found, attempting to find job ID again...",
        );

        // Try to find the job ID one more time as a fallback
        try {
          const asbestosRemovalJobService = (
            await import("../../services/asbestosRemovalJobService")
          ).default;
          const jobsResponse = await asbestosRemovalJobService.getAll();
          const projectId = clearance?.projectId?._id || clearance?.projectId;

          // Handle different response structures - some APIs return {data: [...]} others return {jobs: [...]}
          const jobsArray = jobsResponse.data || jobsResponse.jobs || [];

          const matchingJob = jobsArray.find((job) => {
            const jobProjectId = job.projectId?._id || job.projectId;
            return jobProjectId === projectId;
          });

          if (matchingJob) {
            console.log("Found matching job in fallback:", matchingJob._id);
            navigate(`/asbestos-removal/jobs/${matchingJob._id}/details`);
          } else {
            console.log(
              "Still no matching job found, navigating to asbestos removal list",
            );
            navigate("/asbestos-removal");
          }
        } catch (fallbackError) {
          console.error("Error in fallback job search:", fallbackError);
          navigate("/asbestos-removal");
        }
      }
    } catch (error) {
      console.error("Error completing job:", error);
      showSnackbar("Failed to complete job", "error");
    } finally {
      setCompleteDialogOpen(false);
    }
  };

  const handleReopenJob = () => {
    setReopenDialogOpen(true);
  };

  const confirmReopenJob = async () => {
    try {
      await asbestosClearanceService.update(clearanceId, {
        status: "in progress",
      });
      setJobCompleted(false);
      showSnackbar("Clearance reopened successfully!", "success");
      fetchData(); // Refresh the data to show updated status
    } catch (error) {
      console.error("Error reopening job:", error);
      showSnackbar("Failed to reopen clearance", "error");
    } finally {
      setReopenDialogOpen(false);
    }
  };

  // Log render
  useEffect(() => {
    console.log("[ClearanceItems] Component render", {
      loading,
      error: !!error,
      itemsCount: items?.length || 0,
      clearanceLoaded: !!clearance,
      timestamp: new Date().toISOString(),
    });
  });

  if (loading) {
    console.log("[ClearanceItems] Rendering loading state", {
      timestamp: new Date().toISOString(),
    });
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    console.log("[ClearanceItems] Rendering error state", {
      error,
      timestamp: new Date().toISOString(),
    });
    return (
      <Box m="20px">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  console.log("[ClearanceItems] Rendering main content", {
    itemsCount: items?.length || 0,
    clearanceType: clearance?.clearanceType,
    jobCompleted,
    timestamp: new Date().toISOString(),
  });

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px" sx={{ position: "relative" }}>
        {/* Portrait on mobile: Rotate device alert overlay */}
        {showRotateAlert && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.97)",
              p: 3,
              textAlign: "center",
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Please rotate your device to landscape mode
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This page is best viewed in landscape orientation. Please rotate
              your device to continue.
            </Typography>
          </Box>
        )}

        {/* PDF Loading Overlay */}
        <PDFLoadingOverlay
          open={generatingAirMonitoringPDF}
          message="Generating Air Monitoring Report PDF..."
        />

        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Clearance Items
        </Typography>

        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ marginBottom: 3 }}>
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
            onClick={() =>
              navigate(
                asbestosRemovalJobId
                  ? `/asbestos-removal/jobs/${asbestosRemovalJobId}/details`
                  : `/asbestos-removal`,
              )
            }
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Job Details
          </Link>
        </Breadcrumbs>

        {/* Project Info */}
        <Typography         variant="h6"
        sx={{
          fontSize: { xs: "0.9rem", sm: "1rem", md: "1.25rem" },
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 1,
        }}>
            {clearance.projectId?.name || "Unknown Project"}:{" "}
            {clearance.clearanceDate
              ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "Unknown Date"}
          </Typography>
          

        <Box display="flex" justifyContent="space-between" sx={{ mt: 2, mb: 2 }}>
          <Box display="flex" gap={2} alignItems="center">
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setAttachmentsModalOpen(true)}
              startIcon={<AssessmentIcon />}
            >
              Air Monitoring Report
            </Button>
            {(clearance?.airMonitoringReport ||
              (clearance?.airMonitoringReports?.length > 0)) && (
              <Box display="flex" alignItems="center" gap={2}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoveAirMonitoringReport}
                  startIcon={<DeleteIcon />}
                  size="small"
                  sx={{
                    borderColor: "#d32f2f",
                    color: "#d32f2f",
                    "&:hover": {
                      borderColor: "#b71c1c",
                      backgroundColor: "rgba(211, 47, 47, 0.04)",
                    },
                  }}
                >
                  Remove Attachment
                </Button>
                <Typography
                  variant="body2"
                  color="success.main"
                  sx={{ fontWeight: "medium" }}
                >
                  ✓ Air Monitoring Report
                  {(clearance.airMonitoringReports?.length ?? 0) > 1
                    ? "s"
                    : ""}{" "}
                  Attached
                  {(clearance.airMonitoringReports?.length ?? 0) > 0 ? (
                    <Box component="span" sx={{ ml: 1 }}>
                      (
                      {clearance.airMonitoringReports
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(a.shiftDate || 0) -
                            new Date(b.shiftDate || 0)
                        )
                        .map((r) => formatDate(r.shiftDate))
                        .join(", ")}
                      )
                    </Box>
                  ) : clearance.airMonitoringShiftDate ? (
                    <Box component="span" sx={{ ml: 1 }}>
                      ({formatDate(clearance.airMonitoringShiftDate)})
                    </Box>
                  ) : null}
                </Typography>
              </Box>
            )}
            {!clearance?.airMonitoringReport &&
              !(clearance?.airMonitoringReports?.length > 0) && (
              <Typography
                variant="body2"
                color="warning.main"
                sx={{ fontWeight: "medium" }}
              >
                ⚠ No Air Monitoring Report Attached
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            color={jobCompleted ? "error" : "primary"}
            onClick={jobCompleted ? handleReopenJob : handleCompleteJob}
            disabled={!items || items.length === 0}
            sx={{
              backgroundColor: jobCompleted ? "#d32f2f" : "#1976d2",
              "&:hover": {
                backgroundColor: jobCompleted ? "#b71c1c" : "#1565c0",
              },
            }}
          >
            {jobCompleted ? "REOPEN CLEARANCE" : "COMPLETE CLEARANCE"}
          </Button>
        </Box>

        {/* Site Plan Actions */}
        <Box
          display="flex"
          gap={2}
          sx={{ mt: 2 }}
          alignItems="center"
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setSitePlanDrawingDialogOpen(true)}
            startIcon={<MapIcon />}
          >
            {clearance.sitePlanFile ? "Edit Site Plan" : "Site Plan"}
          </Button>
          {clearance.sitePlanFile && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleRemoveSitePlan}
              startIcon={<DeleteIcon />}
              sx={{
                borderColor: "#d32f2f",
                color: "#d32f2f",
                "&:hover": {
                  borderColor: "#b71c1c",
                  backgroundColor: "rgba(211, 47, 47, 0.04)",
                },
              }}
            >
              Delete Site Plan
            </Button>
          )}
          {clearance?.sitePlanFile && (
            <Typography
              variant="body2"
              color="success.main"
              sx={{ fontWeight: "medium" }}
            >
              ✓ Site Plan Attached
            </Typography>
          )}
          {!clearance?.sitePlanFile && (
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ fontWeight: "medium" }}
            >
              ⚠ No Site Plan
            </Typography>
          )}
        </Box>

        <Box display="flex" gap={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setEditingItem(null);
              resetForm();
              setDialogOpen(true);
            }}
            startIcon={<AddIcon />}
          >
            Add Item
          </Button>
          <Button
            variant="contained"
            onClick={() => setJobExclusionsModalOpen(true)}
            startIcon={<DescriptionIcon />}
            sx={{
              backgroundColor: "#1976d2",
              color: "white",
              "&:hover": {
                backgroundColor: "#1565c0",
              },
            }}
          >
            Job Specific Exclusions
          </Button>
        </Box>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white", "&:hover": { backgroundColor: "transparent" } }}>
                    {clearance?.clearanceType === "Vehicle/Equipment" ? (
                      <>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Item Description</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Photo No.</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Actions</TableCell>
                      </>
                    ) : (
                      <>
                        {items &&
                          items.length > 0 &&
                          items.some(
                            (item) =>
                              item.levelFloor && item.levelFloor.trim() !== "",
                          ) && <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Level/Floor</TableCell>}
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Room/Area</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Location Description</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Materials Description</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Asbestos Type</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Photograph</TableCell>
                        <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>Actions</TableCell>
                      </>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(items || []).map((item) => {
                    const hasLevelFloor =
                      items &&
                      items.length > 0 &&
                      items.some(
                        (item) =>
                          item.levelFloor && item.levelFloor.trim() !== "",
                      );

                    // For Vehicle/Equipment, show simplified view
                    if (clearance?.clearanceType === "Vehicle/Equipment") {
                      const photoCount =
                        (item.photographs?.length || 0) +
                        (item.photograph ? 1 : 0);
                      const selectedCount =
                        item.photographs?.filter((p) => p.includeInReport)
                          .length || 0;

                      return (
                        <TableRow key={item._id}>
                          <TableCell>{item.materialDescription}</TableCell>
                          <TableCell>
                            {photoCount > 0 ? (
                              <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="flex-start"
                                gap={0.5}
                              >
                                <Chip
                                  label={`${photoCount} photo${
                                    photoCount !== 1 ? "s" : ""
                                  }`}
                                  color="success"
                                  size="small"
                                />
                                {item.photographs?.length > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {selectedCount} in report
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Chip
                                label="No photos"
                                color="default"
                                size="small"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box display="flex" gap={1}>
                              <IconButton
                                onClick={() => handleOpenPhotoGallery(item)}
                                color="secondary"
                                size="small"
                                title="Manage Photos"
                              >
                                <PhotoCameraIcon />
                              </IconButton>
                              <IconButton
                                onClick={() => handleEdit(item)}
                                color="primary"
                                size="small"
                                title="Edit"
                              >
                                <EditIcon />
                              </IconButton>
                              <PermissionGate
                                requiredPermissions={["admin.view"]}
                                fallback={null}
                              >
                                <IconButton
                                  onClick={() => handleDelete(item)}
                                  color="error"
                                  size="small"
                                  title="Delete (Admin Only)"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </PermissionGate>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Standard view for non-Vehicle/Equipment clearances
                    return (
                      <TableRow key={item._id}>
                        {hasLevelFloor && (
                          <TableCell>
                            {item.levelFloor ? (
                              <Typography variant="body2">
                                {item.levelFloor}
                              </Typography>
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                fontStyle="italic"
                              >
                                Not specified
                              </Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          {item.roomArea ? (
                            <Typography variant="body2">
                              {item.roomArea}
                            </Typography>
                          ) : (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              fontStyle="italic"
                            >
                              Not specified
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{item.locationDescription}</TableCell>
                        <TableCell>{item.materialDescription}</TableCell>
                        <TableCell>
                          <Chip
                            label={formatAsbestosType(item.asbestosType)}
                            color={getAsbestosTypeColor(item.asbestosType)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const photoCount =
                              (item.photographs?.length || 0) +
                              (item.photograph ? 1 : 0);
                            const selectedCount =
                              item.photographs?.filter((p) => p.includeInReport)
                                .length || 0;
                            return photoCount > 0 ? (
                              <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="flex-start"
                                gap={0.5}
                              >
                                <Chip
                                  label={`${photoCount} photo${
                                    photoCount !== 1 ? "s" : ""
                                  }`}
                                  color="success"
                                  size="small"
                                />
                                {item.photographs?.length > 0 && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {selectedCount} in report
                                  </Typography>
                                )}
                              </Box>
                            ) : (
                              <Chip
                                label="No photos"
                                color="default"
                                size="small"
                              />
                            );
                          })()}
                        </TableCell>

                        <TableCell>
                          <Box display="flex" gap={1}>
                            <IconButton
                              onClick={() => handleOpenPhotoGallery(item)}
                              color="secondary"
                              size="small"
                              title="Manage Photos"
                            >
                              <PhotoCameraIcon />
                            </IconButton>
                            <IconButton
                              onClick={() => handleEdit(item)}
                              color="primary"
                              size="small"
                              title="Edit"
                            >
                              <EditIcon />
                            </IconButton>
                            <PermissionGate
                              requiredPermissions={["admin.view"]}
                              fallback={null}
                            >
                              <IconButton
                                onClick={() => handleDelete(item)}
                                color="error"
                                size="small"
                                title="Delete (Admin Only)"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </PermissionGate>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
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
                bgcolor: editingItem ? "warning.main" : "primary.main",
                color: "white",
              }}
            >
              {editingItem ? (
                <EditIcon sx={{ fontSize: 20 }} />
              ) : (
                <AddIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              {editingItem ? "Edit Item" : "Add New Item"}
            </Typography>
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
              <Grid container spacing={2}>
                {clearance?.clearanceType === "Vehicle/Equipment" ? (
                  // Simplified view for Vehicle/Equipment
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Item Description"
                      value={form.materialDescription}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          materialDescription: e.target.value,
                        })
                      }
                      required
                      placeholder="e.g., Trailer, hydrovac tank"
                    />
                  </Grid>
                ) : (
                  // Standard view for other clearance types
                  <>
                    <Grid
                      item
                      xs={12}
                      container
                      spacing={2}
                      alignItems="center"
                    >
                      <Grid item>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={showLevelFloor}
                              onChange={(e) =>
                                setShowLevelFloor(e.target.checked)
                              }
                            />
                          }
                          label="Include Level/Floor"
                        />
                      </Grid>
                      {showLevelFloor && (
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="Level/Floor"
                            value={form.levelFloor}
                            onChange={(e) =>
                              setForm({ ...form, levelFloor: e.target.value })
                            }
                            placeholder="e.g., Ground Floor, Level 1, Basement"
                            onTouchStart={(e) => {
                              if (isTablet() && !firstTapFields.levelFloor) {
                                const input =
                                  e.target.querySelector("input") || e.target;
                                if (input && input.tagName === "INPUT") {
                                  input.setAttribute("readonly", "readonly");
                                  setFirstTapFields((prev) => ({
                                    ...prev,
                                    levelFloor: true,
                                  }));
                                  setTimeout(() => {
                                    input.removeAttribute("readonly");
                                  }, 300);
                                }
                              }
                            }}
                            onFocus={(e) => {
                              if (isTablet() && !firstTapFields.levelFloor) {
                                e.target.setAttribute("readonly", "readonly");
                                setFirstTapFields((prev) => ({
                                  ...prev,
                                  levelFloor: true,
                                }));
                                setTimeout(() => {
                                  e.target.removeAttribute("readonly");
                                }, 300);
                              }
                            }}
                            InputProps={{
                              readOnly:
                                isTablet() && !firstTapFields.levelFloor,
                            }}
                          />
                        </Grid>
                      )}
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete
                        value={form.roomArea}
                        onChange={(event, newValue) =>
                          setForm({ ...form, roomArea: newValue || "" })
                        }
                        onInputChange={(event, newInputValue) =>
                          setForm({ ...form, roomArea: newInputValue })
                        }
                        options={customDataFields.roomAreas.map(
                          (item) => item.text,
                        )}
                        onOpen={() => {
                          if (isTablet() && !firstTapFields.roomArea) {
                            setFirstTapFields((prev) => ({
                              ...prev,
                              roomArea: true,
                            }));
                          }
                          console.log(
                            "Room areas options:",
                            customDataFields.roomAreas,
                          );
                        }}
                        freeSolo
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Room/Area"
                            required
                            onTouchStart={(e) => {
                              if (isTablet() && !firstTapFields.roomArea) {
                                // Prevent input focus on first tap, but allow dropdown to open
                                const input =
                                  e.target.querySelector("input") || e.target;
                                if (input && input.tagName === "INPUT") {
                                  input.setAttribute("readonly", "readonly");
                                  setFirstTapFields((prev) => ({
                                    ...prev,
                                    roomArea: true,
                                  }));
                                  setTimeout(() => {
                                    input.removeAttribute("readonly");
                                  }, 300);
                                }
                              }
                            }}
                            onFocus={(e) => {
                              if (isTablet() && !firstTapFields.roomArea) {
                                e.target.setAttribute("readonly", "readonly");
                                setFirstTapFields((prev) => ({
                                  ...prev,
                                  roomArea: true,
                                }));
                                setTimeout(() => {
                                  e.target.removeAttribute("readonly");
                                }, 300);
                              }
                            }}
                            InputProps={{
                              ...params.InputProps,
                              readOnly: isTablet() && !firstTapFields.roomArea,
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete
                        value={form.locationDescription}
                        onChange={(event, newValue) =>
                          setForm({
                            ...form,
                            locationDescription: newValue || "",
                          })
                        }
                        onInputChange={(event, newInputValue) =>
                          setForm({
                            ...form,
                            locationDescription: newInputValue,
                          })
                        }
                        options={customDataFields.locationDescriptions.map(
                          (item) => item.text,
                        )}
                        onOpen={() => {
                          if (
                            isTablet() &&
                            !firstTapFields.locationDescription
                          ) {
                            setFirstTapFields((prev) => ({
                              ...prev,
                              locationDescription: true,
                            }));
                          }
                        }}
                        freeSolo
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Location Description"
                            required
                            onTouchStart={(e) => {
                              if (
                                isTablet() &&
                                !firstTapFields.locationDescription
                              ) {
                                // Prevent input focus on first tap, but allow dropdown to open
                                const input =
                                  e.target.querySelector("input") || e.target;
                                if (input && input.tagName === "INPUT") {
                                  input.setAttribute("readonly", "readonly");
                                  setFirstTapFields((prev) => ({
                                    ...prev,
                                    locationDescription: true,
                                  }));
                                  setTimeout(() => {
                                    input.removeAttribute("readonly");
                                  }, 300);
                                }
                              }
                            }}
                            onFocus={(e) => {
                              if (
                                isTablet() &&
                                !firstTapFields.locationDescription
                              ) {
                                e.target.setAttribute("readonly", "readonly");
                                setFirstTapFields((prev) => ({
                                  ...prev,
                                  locationDescription: true,
                                }));
                                setTimeout(() => {
                                  e.target.removeAttribute("readonly");
                                }, 300);
                              }
                            }}
                            InputProps={{
                              ...params.InputProps,
                              readOnly:
                                isTablet() &&
                                !firstTapFields.locationDescription,
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Autocomplete
                        value={form.materialDescription}
                        onChange={(event, newValue) =>
                          setForm({
                            ...form,
                            materialDescription: newValue || "",
                          })
                        }
                        onInputChange={(event, newInputValue) =>
                          setForm({
                            ...form,
                            materialDescription: newInputValue,
                          })
                        }
                        options={customDataFields.materialsDescriptions.map(
                          (item) => item.text,
                        )}
                        onOpen={() => {
                          if (
                            isTablet() &&
                            !firstTapFields.materialDescription
                          ) {
                            setFirstTapFields((prev) => ({
                              ...prev,
                              materialDescription: true,
                            }));
                          }
                        }}
                        freeSolo
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Materials Description"
                            required
                            onTouchStart={(e) => {
                              if (
                                isTablet() &&
                                !firstTapFields.materialDescription
                              ) {
                                // Prevent input focus on first tap, but allow dropdown to open
                                const input =
                                  e.target.querySelector("input") || e.target;
                                if (input && input.tagName === "INPUT") {
                                  input.setAttribute("readonly", "readonly");
                                  setFirstTapFields((prev) => ({
                                    ...prev,
                                    materialDescription: true,
                                  }));
                                  setTimeout(() => {
                                    input.removeAttribute("readonly");
                                  }, 300);
                                }
                              }
                            }}
                            onFocus={(e) => {
                              if (
                                isTablet() &&
                                !firstTapFields.materialDescription
                              ) {
                                e.target.setAttribute("readonly", "readonly");
                                setFirstTapFields((prev) => ({
                                  ...prev,
                                  materialDescription: true,
                                }));
                                setTimeout(() => {
                                  e.target.removeAttribute("readonly");
                                }, 300);
                              }
                            }}
                            InputProps={{
                              ...params.InputProps,
                              readOnly:
                                isTablet() &&
                                !firstTapFields.materialDescription,
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControl fullWidth required>
                        <InputLabel>Asbestos Type</InputLabel>
                        <Select
                          value={form.asbestosType}
                          onChange={(e) =>
                            setForm({ ...form, asbestosType: e.target.value })
                          }
                          label="Asbestos Type"
                        >
                          <MenuItem value="non-friable">Non-friable</MenuItem>
                          <MenuItem value="friable">Friable</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Notes"
                        value={form.notes}
                        onChange={(e) =>
                          setForm({ ...form, notes: e.target.value })
                        }
                        multiline
                        rows={3}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
              <Button
                onClick={() => setDialogOpen(false)}
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
                type="submit"
                variant="contained"
                startIcon={editingItem ? <EditIcon /> : <AddIcon />}
                disabled={
                  clearance?.clearanceType === "Vehicle/Equipment"
                    ? !form.materialDescription.trim()
                    : !form.roomArea.trim() ||
                      !form.locationDescription.trim() ||
                      !form.materialDescription.trim()
                }
                sx={{
                  minWidth: 120,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 500,
                }}
              >
                {editingItem ? "Update Item" : "Create Item"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Air Monitoring Reports Selection Dialog */}
        <Dialog
          open={airMonitoringReportsDialogOpen}
          onClose={() => {
            setAirMonitoringReportsDialogOpen(false);
            setSelectedReports([]);
          }}
          maxWidth="md"
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
                bgcolor: "info.main",
                color: "white",
              }}
            >
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Select Air Monitoring Report(s)
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select one or more air monitoring reports from the list below. They will
                be included in the clearance PDF in chronological order (earliest to most recent).
              </Typography>

              {loadingReports ? (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  height="200px"
                >
                  <CircularProgress />
                </Box>
              ) : airMonitoringReports.length === 0 ? (
                <Alert severity="info">
                  No air monitoring reports found for this project. Reports must
                  be completed and authorised to appear here.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {airMonitoringReports.map((report, index) => {
                    const isSelected = selectedReports.some((r) => r._id === report._id);
                    const isAuthorised = !!report.reportApprovedBy;
                    return (
                      <Card
                        key={report._id}
                        sx={{
                          mb: 2,
                          cursor: isAuthorised ? "pointer" : "not-allowed",
                          transition: "all 0.2s ease-in-out",
                          opacity: isAuthorised ? 1 : 0.6,
                          "&:hover": isAuthorised
                            ? {
                                backgroundColor: isSelected
                                  ? "rgba(25, 118, 210, 0.15)"
                                  : "action.hover",
                                transform: "translateY(-2px)",
                                boxShadow: 2,
                              }
                            : {},
                          border: isSelected ? 3 : 1,
                          borderColor: isSelected ? "primary.main" : "divider",
                          backgroundColor: isSelected
                            ? "rgba(25, 118, 210, 0.12)"
                            : "background.paper",
                          boxShadow: isSelected
                            ? "0 4px 12px rgba(25, 118, 210, 0.3)"
                            : "none",
                          ...(isSelected && {
                            "& .MuiCardContent-root": {
                              backgroundColor: "rgba(25, 118, 210, 0.12)",
                            },
                          }),
                        }}
                        onClick={() => {
                          if (isAuthorised) {
                            setSelectedReports((prev) =>
                              isSelected
                                ? prev.filter((r) => r._id !== report._id)
                                : [...prev, report]
                            );
                          }
                        }}
                      >
                        <CardContent sx={{ py: 2 }}>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="flex-start"
                          >
                            <Box flex={1}>
                              <Box
                                display="flex"
                                alignItems="center"
                                gap={1}
                                mb={1}
                              >
                                {isSelected && (
                                  <CheckIcon
                                    sx={{
                                      color: "primary.main",
                                      fontSize: 20,
                                    }}
                                  />
                                )}
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="medium"
                                >
                                  {formatDate(report.date)}
                                </Typography>
                                <Chip
                                  label={
                                    report.reportApprovedBy
                                      ? "Authorised"
                                      : formatStatus(report.status)
                                  }
                                  color={
                                    report.reportApprovedBy
                                      ? "success"
                                      : "default"
                                  }
                                  size="small"
                                />
                              </Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                mb={0.5}
                              >
                                <Box component="span" fontWeight="bold">
                                  Asbestos Removalist:{" "}
                                </Box>
                                {report.asbestosRemovalist || "Not specified"}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                mb={!isAuthorised ? 1 : 0}
                              >
                                <Box component="span" fontWeight="bold">
                                  Description of Works:{" "}
                                </Box>
                                {report.descriptionOfWorks ||
                                  "No description provided"}
                              </Typography>
                              {!isAuthorised && (
                                <Alert
                                  severity="error"
                                  sx={{
                                    mt: 1,
                                    py: 0.5,
                                    "& .MuiAlert-message": {
                                      fontSize: "0.875rem",
                                      padding: 0,
                                    },
                                  }}
                                >
                                  Report requires authorisation before
                                  attachment
                                </Alert>
                              )}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => {
                setAirMonitoringReportsDialogOpen(false);
                setSelectedReports([]);
              }}
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
              onClick={() => {
                const authorised = selectedReports.filter((r) => r.reportApprovedBy);
                if (authorised.length > 0) {
                  handleSelectAirMonitoringReport(authorised);
                }
              }}
              variant="contained"
              disabled={
                selectedReports.length === 0 ||
                selectedReports.some((r) => !r.reportApprovedBy) ||
                generatingAirMonitoringPDF
              }
              startIcon={
                generatingAirMonitoringPDF ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <CheckIcon />
                )
              }
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {generatingAirMonitoringPDF
                ? "Attaching..."
                : selectedReports.length > 1
                  ? `Attach ${selectedReports.length} Reports`
                  : "Attach Report"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Site Plan Upload Dialog */}
        <Dialog
          open={sitePlanDialogOpen}
          onClose={() => setSitePlanDialogOpen(false)}
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
              <UploadIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Upload Site Plan
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a site plan file (PDF, JPG, or PNG). This will be
                included in the clearance report as Appendix B.
              </Typography>

              <Box sx={{ mb: 2 }}>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: "none" }}
                  id="site-plan-file-upload"
                  type="file"
                  onChange={handleSitePlanFileUpload}
                />
                <label htmlFor="site-plan-file-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                    fullWidth
                  >
                    {sitePlanFile ? sitePlanFile.name : "Choose Site Plan File"}
                  </Button>
                </label>
              </Box>

              {sitePlanFile && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Selected file: {sitePlanFile.name} (
                  {(sitePlanFile.size / 1024 / 1024).toFixed(2)} MB)
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setSitePlanDialogOpen(false)}
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
              onClick={handleUploadSitePlan}
              variant="contained"
              disabled={!sitePlanFile || uploadingSitePlan}
              startIcon={
                uploadingSitePlan ? (
                  <CircularProgress size={16} />
                ) : (
                  <UploadIcon />
                )
              }
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {uploadingSitePlan ? "Uploading..." : "Upload Site Plan"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Attachments Modal */}
        <Dialog
          open={attachmentsModalOpen}
          onClose={() => setAttachmentsModalOpen(false)}
          maxWidth="md"
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
                bgcolor: "info.main",
                color: "white",
              }}
            >
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Manage Air Monitoring Report(s)
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            {/* Air Monitoring Section */}
            <Box sx={{ mb: 4 }}>
              {(clearance.airMonitoringReport ||
                (clearance.airMonitoringReports?.length > 0)) && (
                <>
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{ mb: 2, fontWeight: "medium" }}
                  >
                    ✓ Air Monitoring Report
                    {(clearance.airMonitoringReports?.length ?? 0) > 1
                      ? "s"
                      : ""}{" "}
                    Currently Attached
                    {(clearance.airMonitoringReports?.length ?? 0) > 0 ? (
                      <Box component="span" sx={{ ml: 1 }}>
                        —{" "}
                        {clearance.airMonitoringReports
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(a.shiftDate || 0) -
                              new Date(b.shiftDate || 0)
                          )
                          .map((r) => formatDate(r.shiftDate))
                          .join(", ")}
                      </Box>
                    ) : clearance.airMonitoringShiftDate ? (
                      <Box component="span" sx={{ ml: 1 }}>
                        — {formatDate(clearance.airMonitoringShiftDate)}
                      </Box>
                    ) : null}
                  </Typography>
                </>
              )}
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleOpenAirMonitoringReportsDialog}
                  startIcon={<DescriptionIcon />}
                >
                  {clearance.airMonitoringReport ||
                  (clearance.airMonitoringReports?.length > 0)
                    ? "Replace Air Monitoring Report(s)"
                    : "Select Air Monitoring Report(s)"}
                </Button>
                {(clearance.airMonitoringReport ||
                  (clearance.airMonitoringReports?.length > 0)) && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleRemoveAirMonitoringReport}
                    startIcon={<DeleteIcon />}
                  >
                    Remove All Reports
                  </Button>
                )}
              </Box>
              {!clearance?.airMonitoringReport &&
                !(clearance?.airMonitoringReports?.length > 0) && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 2 }}
                  >
                    No air monitoring report has been uploaded for this
                    clearance yet. Use the button above to select report(s).
                  </Typography>
                )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setAttachmentsModalOpen(false)}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Job Specific Exclusions Modal */}
        <Dialog
          open={jobExclusionsModalOpen}
          onClose={() => setJobExclusionsModalOpen(false)}
          maxWidth="md"
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
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Job Specific Exclusions
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                value={clearance?.jobSpecificExclusions || ""}
                onChange={(e) => {
                  // Update local state for the text field
                  setClearance((prev) => ({
                    ...prev,
                    jobSpecificExclusions: e.target.value,
                  }));
                }}
                multiline
                rows={6}
                placeholder="Enter job-specific exclusions/caveats that should be included in the clearance report"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {savingExclusions ? (
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                      ) : (
                        <IconButton
                          onClick={isDictating ? stopDictation : startDictation}
                          color={isDictating ? "error" : "primary"}
                          title={
                            isDictating ? "Stop Dictation" : "Start Dictation"
                          }
                          sx={{
                            backgroundColor: isDictating
                              ? "error.light"
                              : "transparent",
                            "&:hover": {
                              backgroundColor: isDictating
                                ? "error.main"
                                : "action.hover",
                            },
                          }}
                        >
                          <MicIcon />
                        </IconButton>
                      )}
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              {/* Dictation Status and Errors */}
              {isDictating && (
                <Box
                  sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "error.main",
                      animation: "pulse 1.5s ease-in-out infinite",
                      "@keyframes pulse": {
                        "0%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                        "100%": { opacity: 1 },
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Dictating... Speak clearly into your microphone
                  </Typography>
                </Box>
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
              {exclusionsLastSaved && (
                <Typography variant="body2" color="text.secondary">
                  Last saved: {formatDate(exclusionsLastSaved)}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setJobExclusionsModalOpen(false)}
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
              onClick={async () => {
                try {
                  setSavingExclusions(true);
                  await asbestosClearanceService.update(clearanceId, {
                    jobSpecificExclusions:
                      clearance?.jobSpecificExclusions || "",
                  });
                  showSnackbar(
                    "Job specific exclusions saved successfully",
                    "success",
                  );
                  setExclusionsLastSaved(new Date());
                  setJobExclusionsModalOpen(false);
                } catch (error) {
                  console.error("Error saving job specific exclusions:", error);
                  showSnackbar(
                    "Failed to save job specific exclusions",
                    "error",
                  );
                } finally {
                  setSavingExclusions(false);
                }
              }}
              variant="contained"
              color="primary"
              disabled={savingExclusions}
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {savingExclusions ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Save Exclusions"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Complete Clearance Confirmation Dialog */}
        <Dialog
          open={completeDialogOpen}
          onClose={() => setCompleteDialogOpen(false)}
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
                bgcolor: "success.main",
                color: "white",
              }}
            >
              <CheckIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Complete Clearance
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to complete this clearance?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setCompleteDialogOpen(false)}
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
              onClick={confirmCompleteJob}
              variant="contained"
              color="success"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: "success.main",
                "&:hover": {
                  backgroundColor: "success.dark",
                },
              }}
            >
              Complete Clearance
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reopen Clearance Confirmation Dialog */}
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
              Are you sure you want to reopen this clearance?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setReopenDialogOpen(false)}
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
              onClick={confirmReopenJob}
              variant="contained"
              color="warning"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: "warning.main",
                "&:hover": {
                  backgroundColor: "warning.dark",
                },
              }}
            >
              Reopen Clearance
            </Button>
          </DialogActions>
        </Dialog>

        {/* Camera: portaled full-viewport overlay; buttons on right */}
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
              {/* Video fills entire area */}
              <Box
                ref={videoContainerRef}
                sx={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  touchAction: "none",
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {stream ? (
                  <Box
                    ref={zoomWrapperRef}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transformOrigin: "center center",
                      willChange: "transform",
                      transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                    }}
                  >
                    <video
                      ref={(ref) => {
                        setVideoRef(ref);
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
                  </Box>
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
              {/* Buttons overlay on the right */}
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
                  pointerEvents: "auto",
                }}
              >
                <Button
                  onClick={handleCloseCamera}
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
                  onClick={handleCapturePhoto}
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
              Delete Item
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to delete this clearance item? This action
              cannot be undone.
            </Typography>
            {itemToDelete && (
              <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Location:</strong> {itemToDelete.locationDescription}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Room/Area:</strong>{" "}
                  {itemToDelete.roomArea || "Not specified"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Material:</strong> {itemToDelete.materialDescription}
                </Typography>
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
              Delete Item
            </Button>
          </DialogActions>
        </Dialog>

        {/* Photo Gallery Dialog */}
        <Dialog
          open={photoGalleryDialogOpen}
          onClose={handleClosePhotoGallery}
          maxWidth="md"
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
            {isMobileLandscape && selectedItemForPhotos && (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <Button
                  variant="outlined"
                  startIcon={<PhotoCameraIcon />}
                  onClick={handleTakePhoto}
                  size="small"
                >
                  Take Photo
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadIcon />}
                  component="label"
                  size="small"
                >
                  Upload Photo
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handlePhotoUploadForGallery}
                  />
                </Button>
              </Box>
            )}
            <IconButton onClick={handleClosePhotoGallery}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3, border: "none" }}>
            {selectedItemForPhotos && (
              <>
                {isPortrait ? (
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
                        orientation. Please rotate your device to continue.
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
                      "& .MuiTypography-root": { mb: 0 },
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
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: isMobileLandscape ? 0 : 0 }}
                  >
                    <strong>Material:</strong>{" "}
                    {selectedItemForPhotos.materialDescription}
                  </Typography>
                </Box>

                {!isMobileLandscape && (
                <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
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
                      onClick={handleTakePhoto}
                      size="small"
                    >
                      Take Photo
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<UploadIcon />}
                      component="label"
                      size="small"
                    >
                      Upload Photo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handlePhotoUploadForGallery}
                      />
                    </Button>
                  </Box>
                  {compressionStatus && (
                    <Alert severity={compressionStatus.type} sx={{ mt: 2 }}>
                      {compressionStatus.message}
                    </Alert>
                  )}
                </Box>
                )}

                {/* Photos Grid */}
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Photos (
                  {(selectedItemForPhotos.photographs?.length || 0) +
                    (selectedItemForPhotos.photograph ? 1 : 0)}
                  )
                </Typography>

                {(selectedItemForPhotos.photographs?.length || 0) +
                  (selectedItemForPhotos.photograph ? 1 : 0) ===
                0 ? (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No photos yet. Add your first photo above.
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {/* New photos array */}
                    {selectedItemForPhotos.photographs?.map((photo, index) => (
                      <Grid item xs={12} sm={6} md={4} key={photo._id}>
                        <Card
                          sx={{
                            position: "relative",
                            height: "100%",
                            border: getCurrentPhotoState(photo._id)
                              ? "3px solid #4caf50"
                              : "3px solid transparent", // Green outline if included in report
                            borderRadius: 2,
                            transition: "border-color 0.2s ease-in-out",
                            opacity: isPhotoMarkedForDeletion(photo._id)
                              ? 0.5
                              : 1,
                            filter: isPhotoMarkedForDeletion(photo._id)
                              ? "grayscale(50%)"
                              : "none",
                          }}
                        >
                          <Box
                            sx={{
                              position: "relative",
                              paddingTop: "75%",
                              cursor: "pointer",
                              "&:hover": {
                                opacity: 0.9,
                              },
                            }}
                            onClick={() => handleViewFullSizePhoto(photo)}
                          >
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

                            {/* Arrow overlays (multiple, with delete per arrow) */}
                            {getPhotoArrows(photo).map((arr, arrIdx) => {
                              const arrowColor =
                                arr.color || DEFAULT_ARROW_COLOR;
                              const arrowId = arr._id;
                              const rot =
                                arr.rotation ?? DEFAULT_ARROW_ROTATION;
                              const tipOff = getArrowTipOffset(rot);
                              return (
                                <Box
                                  key={arrowId || `arrow-${arrIdx}`}
                                  sx={{
                                    position: "absolute",
                                    left: `${(arr.x ?? 0.5) * 100}%`,
                                    top: `${(arr.y ?? 0.5) * 100}%`,
                                    transform: `translate(${-tipOff.x * 100}%, ${-tipOff.y * 100}%)`,
                                    zIndex: 2,
                                    pointerEvents: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                  }}
                                  onClick={(e) => e.stopPropagation()}
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
                                  <IconButton
                                    size="small"
                                    sx={{
                                      minWidth: 0,
                                      width: 20,
                                      height: 20,
                                      color: "white",
                                      bgcolor: "rgba(0,0,0,0.7)",
                                      "&:hover": {
                                        bgcolor: "rgba(244,67,54,0.9)",
                                      },
                                      mt: -0.5,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (arrowId) {
                                        handleDeletePhotoArrow(
                                          photo._id,
                                          arrowId,
                                        );
                                      } else {
                                        handleClearAllArrows(photo._id);
                                      }
                                    }}
                                    title="Remove this arrow"
                                  >
                                    <CloseIcon
                                      sx={{ fontSize: "0.9rem" }}
                                    />
                                  </IconButton>
                                </Box>
                              );
                            })}

                            {/* Marked for deletion overlay */}
                            {isPhotoMarkedForDeletion(photo._id) && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
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
                                    textAlign: "center",
                                  }}
                                >
                                  Marked for Deletion
                                </Typography>
                              </Box>
                            )}

                            {/* Checkbox for report inclusion */}
                            <Box
                              sx={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                backgroundColor: "rgba(0, 0, 0, 0.6)",
                                borderRadius: 1,
                                padding: 0.5,
                                zIndex: 3, // Higher than overlay z-index (2)
                              }}
                            >
                              <Checkbox
                                checked={getCurrentPhotoState(photo._id)}
                                size="small"
                                sx={{
                                  color: "white",
                                  "&.Mui-checked": {
                                    color: "#4caf50",
                                  },
                                }}
                                onChange={(e) => {
                                  e.stopPropagation(); // Prevent opening full-size view
                                  handleTogglePhotoInReport(
                                    selectedItemForPhotos._id,
                                    photo._id,
                                  );
                                }}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent opening full-size view
                                }}
                                title={
                                  getCurrentPhotoState(photo._id)
                                    ? "Remove from report"
                                    : "Include in report"
                                }
                              />
                            </Box>

                            {/* Delete/Undo button */}
                            <IconButton
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                backgroundColor: isPhotoMarkedForDeletion(
                                  photo._id,
                                )
                                  ? "rgba(76, 175, 80, 0.8)"
                                  : "rgba(0, 0, 0, 0.6)",
                                color: "white",
                                "&:hover": {
                                  backgroundColor: isPhotoMarkedForDeletion(
                                    photo._id,
                                  )
                                    ? "rgba(76, 175, 80, 1)"
                                    : "rgba(0, 0, 0, 0.8)",
                                },
                                zIndex: 3, // Higher than overlay z-index (2)
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent opening full-size view
                                if (isPhotoMarkedForDeletion(photo._id)) {
                                  // Undo deletion
                                  setPhotosToDelete((prev) => {
                                    const newSet = new Set(prev);
                                    newSet.delete(photo._id);
                                    return newSet;
                                  });
                                } else {
                                  // Mark for deletion
                                  handleDeletePhotoFromItem(
                                    selectedItemForPhotos._id,
                                    photo._id,
                                  );
                                }
                              }}
                              title={
                                isPhotoMarkedForDeletion(photo._id)
                                  ? "Undo Deletion"
                                  : "Remove Photo"
                              }
                            >
                              {isPhotoMarkedForDeletion(photo._id) ? (
                                <CheckIcon fontSize="small" />
                              ) : (
                                <CloseIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Box>
                          <CardContent sx={{ py: 1 }}>
                            <Box display="flex" flexDirection="column" gap={1}>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontWeight: 500 }}
                              >
                                Photo {index + 1}
                              </Typography>
                              {editingDescriptionPhotoId === photo._id ? (
                                <TextField
                                  fullWidth
                                  size="small"
                                  value={getCurrentPhotoDescription(
                                    photo._id,
                                    selectedItemForPhotos,
                                  )}
                                  onChange={(e) =>
                                    handleDescriptionChange(
                                      photo._id,
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
                                      // Revert to original description
                                      setLocalPhotoDescriptions((prev) => {
                                        const newState = { ...prev };
                                        delete newState[photo._id];
                                        return newState;
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
                                    setEditingDescriptionPhotoId(photo._id);
                                  }}
                                  sx={{
                                    cursor: "pointer",
                                    p: 1,
                                    borderRadius: 1,
                                    backgroundColor: "grey.50",
                                    "&:hover": {
                                      backgroundColor: "grey.100",
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
                                        localPhotoDescriptions[photo._id]
                                          ? "normal"
                                          : "italic",
                                    }}
                                  >
                                    {getCurrentPhotoDescription(
                                      photo._id,
                                      selectedItemForPhotos,
                                    )}
                                  </Typography>
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
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
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
                if (hasUnsavedChanges()) {
                  await savePhotoChanges();
                }
                await handleClosePhotoGallery();
              }}
              variant="contained"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: hasUnsavedChanges()
                  ? "#ff9800"
                  : "primary.main",
                "&:hover": {
                  backgroundColor: hasUnsavedChanges()
                    ? "#f57c00"
                    : "primary.dark",
                },
              }}
            >
              {hasUnsavedChanges() ? "Update" : "Done"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Full Size Photo Dialog */}
        <Dialog
          open={fullSizePhotoDialogOpen}
          onClose={() => {
            setFullSizePhotoDialogOpen(false);
            setFullSizePhotoId(null);
            setFullSizeArrowMode(false);
            setSelectedArrowId(null);
            setMovingArrowId(null);
          }}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              bgcolor: "rgba(0, 0, 0, 0.9)",
            },
          }}
        >
          <DialogContent sx={{ p: 0, position: "relative" }}>
            <IconButton
              onClick={() => {
                setFullSizePhotoDialogOpen(false);
                setFullSizePhotoId(null);
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
                "&:hover": {
                  bgcolor: "rgba(0, 0, 0, 0.7)",
                },
              }}
            >
              <CloseIcon />
            </IconButton>
            {fullSizePhoto && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minHeight: "80vh",
                  p: 2,
                  pt: 6,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    mb: 2,
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
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
                          handleClearAllArrows(fullSizePhotoId);
                        } else {
                          handleDeletePhotoArrow(
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
                  {ARROW_COLORS.map(({ name, hex }) => (
                    <Box
                      key={hex}
                      onClick={() => {
                        setSelectedArrowColor(hex);
                        if (
                          selectedArrowId &&
                          selectedArrowId !== "legacy"
                        ) {
                          handleUpdatePhotoArrow(
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
                {(fullSizeArrowMode || movingArrowId) && (
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(0, 0, 0, 0.9)", mb: 1 }}
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
                    src={fullSizePhoto.data}
                    alt="Full size"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "75vh",
                      objectFit: "contain",
                      cursor:
                        fullSizeArrowMode || movingArrowId
                          ? "crosshair"
                          : "default",
                    }}
                    onClick={handleFullSizePhotoClickForArrow}
                  />
                  {getPhotoArrows(fullSizePhoto).map((arr, arrIdx) => {
                    const arrowColor =
                      arr.color || DEFAULT_ARROW_COLOR;
                    const isSelected = selectedArrowId === arr._id;
                    const rot =
                      arr.rotation ?? DEFAULT_ARROW_ROTATION;
                    const tipOff = getArrowTipOffset(rot);
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
                          outline: isSelected
                            ? "3px solid white"
                            : "none",
                          outlineOffset: 2,
                          borderRadius: 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedArrowId(arr._id || "legacy");
                          setSelectedArrowColor(
                            arr.color || DEFAULT_ARROW_COLOR,
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
                  })}
                </Box>
              </Box>
            )}
            {fullSizePhotoUrl && !fullSizePhoto && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "80vh",
                  p: 2,
                }}
              >
                <img
                  src={fullSizePhotoUrl}
                  alt="Full size"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "90vh",
                    objectFit: "contain",
                  }}
                />
              </Box>
            )}
          </DialogContent>
        </Dialog>

        {/* Site Plan Drawing Modal */}
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
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
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

        {/* Site plan key descriptions reminder */}
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
              Some key items don&apos;t have descriptions. Add descriptions so
              the site plan key is clear, or save without adding them.
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
      </Box>
    </PermissionGate>
  );
};

export default ClearanceItems;
