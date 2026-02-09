import React, { useState, useEffect, useRef } from "react";
import { useSnackbar } from "../../../context/SnackbarContext";
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
  Checkbox,
  FormControlLabel,
  Divider,
  RadioGroup,
  Radio,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Description as DescriptionIcon,
  Map as MapIcon,
} from "@mui/icons-material";
import MicIcon from "@mui/icons-material/Mic";
import WarningIcon from "@mui/icons-material/Warning";

import { useNavigate, useParams, useLocation } from "react-router-dom";
import PermissionGate from "../../../components/PermissionGate";
import SitePlanDrawing from "../../../components/SitePlanDrawing";
import { useAuth } from "../../../context/AuthContext";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { format } from "date-fns";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import customDataFieldGroupService from "../../../services/customDataFieldGroupService";
import {
  compressImage,
  needsCompression,
  saveFileToDevice,
} from "../../../utils/imageCompression";

/**
 * Add business days to a date, skipping weekends (Saturday and Sunday).
 * @param {Date} date - The starting date
 * @param {number} businessDays - Number of business days to add
 * @returns {Date} - The resulting date with the same time of day
 */
const addBusinessDays = (date, businessDays) => {
  const result = new Date(date);
  let added = 0;
  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
};

const AssessmentItems = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { currentUser } = useAuth();

  // Support both asbestos-assessment and residential-asbestos routes
  const isResidential = (location.pathname || "").includes(
    "residential-asbestos",
  );
  const listPath = isResidential
    ? "/surveys/residential-asbestos"
    : "/surveys/asbestos-assessment";
  const itemsPathForId = (assessmentId) =>
    isResidential
      ? `/surveys/residential-asbestos/${assessmentId}/items`
      : `/surveys/asbestos-assessment/${assessmentId}/items`;

  const [items, setItems] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemTypeSelectionModalOpen, setItemTypeSelectionModalOpen] =
    useState(false);
  const { showSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    sampleReference: "",
    levelFloor: "",
    roomArea: "",
    locationDescription: "",
    materialType: "",
    asbestosContent: "",
    asbestosType: "",
    condition: "",
    risk: "",
    recommendations: "",
    notes: "",
  });

  const [customDataFields, setCustomDataFields] = useState({
    roomAreas: [],
    locationDescriptions: [],
    materialsDescriptions: [],
    materialsDescriptionsNonACM: [],
    recommendations: [],
  });

  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showLevelFloor, setShowLevelFloor] = useState(false);
  const [selectedMaterialFromDropdown, setSelectedMaterialFromDropdown] =
    useState(false);
  const [isNonACM, setIsNonACM] = useState(false);
  const [isReferredItem, setIsReferredItem] = useState(false);
  const [isVisuallyAssessedItem, setIsVisuallyAssessedItem] = useState(false);
  const [visuallyAssessedType, setVisuallyAssessedType] = useState("asbestos"); // "asbestos" or "non-asbestos"

  // Scope of Assessment state
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [scopeItems, setScopeItems] = useState([""]);

  // Job Specific Exclusions state
  const [jobExclusionsModalOpen, setJobExclusionsModalOpen] = useState(false);
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [exclusionsLastSaved, setExclusionsLastSaved] = useState(null);
  const [isDictatingExclusions, setIsDictatingExclusions] = useState(false);
  const [dictationErrorExclusions, setDictationErrorExclusions] = useState("");
  const recognitionRefExclusions = useRef(null);

  // Discussion/Conclusions state
  const [discussionModalOpen, setDiscussionModalOpen] = useState(false);
  const [savingDiscussion, setSavingDiscussion] = useState(false);
  const [discussionLastSaved, setDiscussionLastSaved] = useState(null);
  const [isDictatingDiscussion, setIsDictatingDiscussion] = useState(false);
  const [dictationErrorDiscussion, setDictationErrorDiscussion] = useState("");
  const recognitionRefDiscussion = useRef(null);

  // Assessment Complete state
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [noItemsDialogOpen, setNoItemsDialogOpen] = useState(false);
  const [noScopeDialogOpen, setNoScopeDialogOpen] = useState(false);
  const [noItemsAndScopeDialogOpen, setNoItemsAndScopeDialogOpen] =
    useState(false);

  // Samples Submitted to Lab state
  const [showSamplesSubmittedDialog, setShowSamplesSubmittedDialog] =
    useState(false);
  const [submittedBySignature, setSubmittedBySignature] = useState("");
  const [turnaroundTime, setTurnaroundTime] = useState("");
  const [analysisDueDate, setAnalysisDueDate] = useState(new Date());
  const [showCustomTurnaround, setShowCustomTurnaround] = useState(false);

  // Finalise Assessment (no samples) state
  const [showFinaliseAssessmentDialog, setShowFinaliseAssessmentDialog] =
    useState(false);
  const [finalisingAssessment, setFinalisingAssessment] = useState(false);

  // Site Plan state
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [uploadingSitePlan, setUploadingSitePlan] = useState(false);
  const [sitePlanDrawingDialogOpen, setSitePlanDrawingDialogOpen] =
    useState(false);

  // Dictation state (for recommendations)
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef(null);

  // Photo state
  const [photoGalleryDialogOpen, setPhotoGalleryDialogOpen] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState(null);
  const [localPhotoChanges, setLocalPhotoChanges] = useState({});
  const [photosToDelete, setPhotosToDelete] = useState(new Set());
  const [localPhotoDescriptions, setLocalPhotoDescriptions] = useState({});
  const [editingDescriptionPhotoId, setEditingDescriptionPhotoId] =
    useState(null);
  const [fullSizePhotoDialogOpen, setFullSizePhotoDialogOpen] = useState(false);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [photoPreview, setPhotoPreview] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [photoFile, setPhotoFile] = useState(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const videoContainerRef = useRef(null);

  // Camera zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [lastPinchDistance, setLastPinchDistance] = useState(null);
  const [lastPanPoint, setLastPanPoint] = useState(null);
  const [lastTapTime, setLastTapTime] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        throw new Error("Assessment ID is missing from URL");
      }

      const [itemsData, assessmentData] = await Promise.all([
        asbestosAssessmentService.getItems(id),
        asbestosAssessmentService.getById(id),
      ]);

      setItems(itemsData || []);
      setAssessment(assessmentData);
      // Set assessment completed state based on status (site-works-complete or later)
      setAssessmentCompleted(
        assessmentData?.status === "site-works-complete" ||
          assessmentData?.status === "samples-with-lab" ||
          assessmentData?.status === "sample-analysis-complete" ||
          assessmentData?.status === "report-ready-for-review" ||
          assessmentData?.status === "complete",
      );
      // Load assessment scope if it exists (not used for residential asbestos)
      if (!(location.pathname || "").includes("residential-asbestos")) {
        if (
          assessmentData?.assessmentScope &&
          Array.isArray(assessmentData.assessmentScope)
        ) {
          setScopeItems(
            assessmentData.assessmentScope.length > 0
              ? assessmentData.assessmentScope
              : [""],
          );
        } else {
          setScopeItems([""]);
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch items and assessment data on component mount
  useEffect(() => {
    if (id) {
      fetchData();
      fetchCustomDataFields();
    } else {
      setError("No assessment ID provided");
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCustomDataFields = async () => {
    try {
      const [
        roomAreasData,
        locationDescriptionsData,
        materialsDescriptionsData,
        materialsDescriptionsNonACMData,
        recommendationsData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
        customDataFieldGroupService.getFieldsByType(
          "materials_description_non_acm",
        ),
        customDataFieldGroupService.getFieldsByType("recommendation"),
      ]);

      const processData = (data) => {
        let processedData = [];
        if (Array.isArray(data)) {
          processedData = data;
        } else if (data && typeof data === "object") {
          processedData =
            data.data ||
            data.items ||
            data.fields ||
            Object.values(data).filter(Array.isArray)[0] ||
            [];
        }
        return processedData.sort((a, b) => {
          const textA = (a.text || "").toLowerCase();
          const textB = (b.text || "").toLowerCase();
          return textA.localeCompare(textB);
        });
      };

      setCustomDataFields({
        roomAreas: processData(roomAreasData),
        locationDescriptions: processData(locationDescriptionsData),
        materialsDescriptions: processData(materialsDescriptionsData),
        materialsDescriptionsNonACM: processData(
          materialsDescriptionsNonACMData,
        ),
        recommendations: processData(recommendationsData),
      });
    } catch (err) {
      console.error("Error fetching custom data fields:", err);
    }
  };

  // Helper function to ensure sample reference has LD- prefix
  const ensureSampleReferencePrefix = (value) => {
    if (!value || value.trim() === "") {
      return "";
    }
    const trimmed = value.trim().toUpperCase();
    if (trimmed.startsWith("LD-")) {
      return trimmed;
    }
    return `LD-${trimmed}`;
  };

  // Helper function to check if sample reference is unique
  const isSampleReferenceUnique = (sampleRef, excludeItemId = null) => {
    if (!sampleRef || sampleRef.trim() === "") {
      return true; // Empty is allowed (not required)
    }
    const normalizedRef = ensureSampleReferencePrefix(sampleRef);
    return !items.some(
      (item) =>
        item.sampleReference === normalizedRef &&
        (!excludeItemId || item._id !== excludeItemId),
    );
  };

  // Helper function to get all unique sample references from existing items
  const getAvailableSampleReferences = () => {
    const sampleRefs = items
      .filter(
        (item) => item.sampleReference && item.sampleReference.trim() !== "",
      )
      .map((item) => item.sampleReference)
      .filter((ref, index, self) => self.indexOf(ref) === index) // Get unique values
      .sort();
    return sampleRefs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (
      !isNonACM &&
      !(isVisuallyAssessedItem && visuallyAssessedType === "non-asbestos")
    ) {
      // Sample reference is only required for sampled items (not visually assessed or referred items)
      if (!isVisuallyAssessedItem && !isReferredItem) {
        if (!form.sampleReference || form.sampleReference.trim() === "") {
          showSnackbar("Sample Reference is required", "error");
          return;
        }
      }

      // Asbestos type, condition, and risk are required for all non-ACM items (including visually assessed asbestos, but not non-asbestos)
      if (!form.asbestosType || form.asbestosType.trim() === "") {
        showSnackbar("Asbestos Type is required", "error");
        return;
      }
      if (!form.condition || form.condition.trim() === "") {
        showSnackbar("Condition is required", "error");
        return;
      }
      if (!form.risk || form.risk.trim() === "") {
        showSnackbar("Risk is required", "error");
        return;
      }

      // Validate sample reference uniqueness (only for sampled items, not referred items or visually assessed items)
      if (
        !isReferredItem &&
        !isVisuallyAssessedItem &&
        form.sampleReference &&
        form.sampleReference.trim() !== ""
      ) {
        const normalizedRef = ensureSampleReferencePrefix(form.sampleReference);
        if (
          !isSampleReferenceUnique(
            form.sampleReference,
            editingItem?._id || null,
          )
        ) {
          showSnackbar(
            `Sample Reference "${normalizedRef}" already exists. Please use a unique value.`,
            "error",
          );
          return;
        }
      }
    }

    if (!form.roomArea || form.roomArea.trim() === "") {
      showSnackbar("Room/Area is required", "error");
      return;
    }
    if (!form.locationDescription || form.locationDescription.trim() === "") {
      showSnackbar("Location Description is required", "error");
      return;
    }
    if (!form.materialType || form.materialType.trim() === "") {
      showSnackbar("Material Description is required", "error");
      return;
    }

    try {
      // Build recommendations value from selected recommendations and custom text
      let recommendationsValue = "";

      if (isNonACM) {
        // For non-ACM items, set recommendation to "No Action Required"
        recommendationsValue = "No Action Required";
      } else if (
        isVisuallyAssessedItem &&
        visuallyAssessedType === "non-asbestos"
      ) {
        // For visually assessed non-asbestos items, set recommendation to "No Action Required"
        recommendationsValue = "No Action Required";
      } else {
        recommendationsValue = (form.recommendations || "").trim();
      }

      // Note: itemNumber is not set initially. It will be added later in the process
      // for items that are confirmed to contain asbestos.

      const itemData = {
        // Only include itemNumber when editing an existing item that already has one
        ...(editingItem &&
          editingItem.itemNumber && { itemNumber: editingItem.itemNumber }),
        sampleReference:
          isNonACM || isVisuallyAssessedItem
            ? null
            : form.sampleReference
              ? isReferredItem
                ? form.sampleReference // For referred items, sample reference already has LD- prefix
                : ensureSampleReferencePrefix(
                    form.sampleReference.toUpperCase(),
                  )
              : "",
        levelFloor: showLevelFloor ? form.levelFloor : "",
        roomArea: form.roomArea,
        locationDescription: form.locationDescription,
        materialType: form.materialType,
        asbestosContent: isVisuallyAssessedItem
          ? visuallyAssessedType === "asbestos"
            ? "Visually Assessed as Asbestos"
            : "Visually Assessed as Non-Asbestos"
          : form.asbestosContent || "",
        asbestosType:
          isNonACM ||
          (isVisuallyAssessedItem && visuallyAssessedType === "non-asbestos")
            ? null
            : form.asbestosType || "",
        condition:
          isNonACM ||
          (isVisuallyAssessedItem && visuallyAssessedType === "non-asbestos")
            ? null
            : form.condition || "",
        risk:
          isNonACM ||
          (isVisuallyAssessedItem && visuallyAssessedType === "non-asbestos")
            ? null
            : form.risk || "",
        recommendationActions: recommendationsValue,
        notes: form.notes || "",
      };

      if (editingItem) {
        await asbestosAssessmentService.updateItem(
          id,
          editingItem._id,
          itemData,
        );
        await asbestosAssessmentService.update(id, {
          projectId: assessment.projectId?._id || assessment.projectId,
          assessmentDate: assessment.assessmentDate,
          reportApprovedBy: null,
          reportIssueDate: null,
        });
        showSnackbar("Item updated successfully", "success");
        setDialogOpen(false);
        setEditingItem(null);
        resetForm();
        await fetchData();
      } else {
        const newItem = await asbestosAssessmentService.addItem(id, itemData);
        await asbestosAssessmentService.update(id, {
          projectId: assessment.projectId?._id || assessment.projectId,
          assessmentDate: assessment.assessmentDate,
          reportApprovedBy: null,
          reportIssueDate: null,
        });
        showSnackbar("Item created successfully", "success");
        setDialogOpen(false);
        resetForm();
        await fetchData();
        // Open photo modal automatically after adding item
        if (newItem) {
          setSelectedItemForPhotos(newItem);
          setPhotoGalleryDialogOpen(true);
        }
      }
    } catch (err) {
      console.error("Error saving item:", err);
      showSnackbar("Failed to save item", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);

    // Check if this is a visually assessed item
    const isVisuallyAssessedItemCheck =
      item.asbestosContent === "Visually Assessed as Asbestos" ||
      item.asbestosContent === "Visually Assessed as Non-Asbestos";

    // Check if this is a referred item (has a sampleReference that matches another item's sampleReference)
    const isReferredItemCheck =
      item.sampleReference &&
      item.sampleReference.trim() !== "" &&
      items.some(
        (otherItem) =>
          otherItem._id !== item._id &&
          otherItem.sampleReference === item.sampleReference,
      );

    // Check if this is a non-ACM item (legacy support)
    const isNonACMItem =
      (!item.sampleReference || item.sampleReference.trim() === "") &&
      (!item.asbestosType || item.asbestosType.trim() === "") &&
      (!item.condition || item.condition.trim() === "") &&
      (!item.risk || item.risk.trim() === "") &&
      (item.recommendationActions === "No Action Required" ||
        item.recommendations === "No Action Required");

    // Set the appropriate modal type based on item type
    if (isVisuallyAssessedItemCheck) {
      setIsVisuallyAssessedItem(true);
      setIsReferredItem(false);
      setVisuallyAssessedType(
        item.asbestosContent === "Visually Assessed as Asbestos"
          ? "asbestos"
          : "non-asbestos",
      );
      // Set isNonACM based on visually assessed type
      setIsNonACM(item.asbestosContent === "Visually Assessed as Non-Asbestos");
    } else if (isReferredItemCheck) {
      setIsVisuallyAssessedItem(false);
      setIsReferredItem(true);
      setIsNonACM(false);
      setVisuallyAssessedType("asbestos"); // Reset to default
    } else {
      // Regular sampled item
      setIsVisuallyAssessedItem(false);
      setIsReferredItem(false);
      setIsNonACM(isNonACMItem);
      setVisuallyAssessedType("asbestos"); // Reset to default
    }

    // Handle sample reference based on item type
    let sampleRef = item.sampleReference || "";
    // For referred items, keep the full format (LD-XXX) for the dropdown
    // For sampled items, strip the prefix for the text field
    if (!isReferredItemCheck && sampleRef.startsWith("LD-")) {
      sampleRef = sampleRef.substring(3);
    }
    // Check if material type matches a dropdown option
    // Use the appropriate data source based on whether it's a non-ACM item or visually assessed item
    const materialsSource =
      isNonACMItem || isVisuallyAssessedItemCheck
        ? customDataFields.materialsDescriptionsNonACM
        : customDataFields.materialsDescriptions;
    const matchingMaterial = materialsSource.find(
      (mat) => mat.text === item.materialType,
    );
    const materialFromDropdown = !!matchingMaterial;

    setForm({
      sampleReference: sampleRef,
      levelFloor: item.levelFloor || "",
      roomArea: item.roomArea || "",
      locationDescription: item.locationDescription || "",
      materialType: item.materialType || "",
      asbestosContent: item.asbestosContent || "",
      asbestosType: item.asbestosType || "",
      condition: item.condition || "",
      risk: item.risk || "",
      recommendations: item.recommendationActions || item.recommendations || "",
      notes: item.notes || "",
    });
    // Show level floor checkbox if item has levelFloor
    setShowLevelFloor(!!item.levelFloor);
    // Set selectedMaterialFromDropdown based on whether material matches dropdown
    setSelectedMaterialFromDropdown(materialFromDropdown);

    // For non-ACM / visually assessed non-asbestos, ensure recommendations shows "No Action Required"
    if (
      isNonACMItem ||
      (isVisuallyAssessedItemCheck &&
        item.asbestosContent === "Visually Assessed as Non-asbestos")
    ) {
      setForm((prev) => ({
        ...prev,
        recommendations: "No Action Required",
      }));
    }

    setDialogOpen(true);
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await asbestosAssessmentService.deleteItem(id, itemToDelete._id);
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        reportApprovedBy: null,
        reportIssueDate: null,
      });
      showSnackbar("Item deleted successfully", "success");
      await fetchData();
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
      sampleReference: "",
      levelFloor: "",
      roomArea: "",
      locationDescription: "",
      materialType: "",
      asbestosContent: "",
      asbestosType: "",
      condition: "",
      risk: "",
      recommendations: "",
      notes: "",
    });
    setShowLevelFloor(false);
    setSelectedMaterialFromDropdown(false);
    setIsNonACM(false);
    setIsReferredItem(false);
    setIsVisuallyAssessedItem(false);
    setVisuallyAssessedType("asbestos");
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

        // Update the recommendations field with the final transcript
        if (finalTranscript) {
          setForm((prev) => {
            const currentText = prev.recommendations || "";
            const isFirstWord = !currentText || currentText.trim().length === 0;
            const newText = isFirstWord
              ? finalTranscript.charAt(0).toUpperCase() +
                finalTranscript.slice(1)
              : finalTranscript;
            return {
              ...prev,
              recommendations: currentText + (currentText ? " " : "") + newText,
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

  // Dictation functions for exclusions
  const startDictationExclusions = () => {
    // If already dictating, stop it first
    if (isDictatingExclusions && recognitionRefExclusions.current) {
      stopDictationExclusions();
      return;
    }

    // Check if browser supports speech recognition
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationErrorExclusions(
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
        setIsDictatingExclusions(true);
        setDictationErrorExclusions("");
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
          setAssessment((prev) => {
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
        setDictationErrorExclusions(`Dictation error: ${event.error}`);
        setIsDictatingExclusions(false);
        recognitionRefExclusions.current = null;
      };

      recognition.onend = () => {
        setIsDictatingExclusions(false);
        recognitionRefExclusions.current = null;
      };

      recognitionRefExclusions.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Error starting dictation:", error);
      setDictationErrorExclusions(
        "Failed to start dictation. Please try again.",
      );
      recognitionRefExclusions.current = null;
    }
  };

  const stopDictationExclusions = () => {
    if (recognitionRefExclusions.current) {
      try {
        recognitionRefExclusions.current.stop();
      } catch (error) {
        console.error("Error stopping dictation:", error);
      }
      recognitionRefExclusions.current = null;
    }
    setIsDictatingExclusions(false);
  };

  const startDictationDiscussion = () => {
    if (isDictatingDiscussion && recognitionRefDiscussion.current) {
      stopDictationDiscussion();
      return;
    }
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationErrorDiscussion(
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
        setIsDictatingDiscussion(true);
        setDictationErrorDiscussion("");
      };
      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript;
        }
        if (finalTranscript) {
          setAssessment((prev) => {
            const currentText = prev?.discussionConclusions || "";
            const isFirstWord = !currentText || currentText.trim().length === 0;
            const newText = isFirstWord
              ? finalTranscript.charAt(0).toUpperCase() +
                finalTranscript.slice(1)
              : finalTranscript;
            return {
              ...prev,
              discussionConclusions:
                currentText + (currentText ? " " : "") + newText,
            };
          });
        }
      };
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setDictationErrorDiscussion(`Dictation error: ${event.error}`);
        setIsDictatingDiscussion(false);
        recognitionRefDiscussion.current = null;
      };
      recognition.onend = () => {
        setIsDictatingDiscussion(false);
        recognitionRefDiscussion.current = null;
      };
      recognitionRefDiscussion.current = recognition;
      recognition.start();
    } catch (error) {
      console.error("Error starting dictation:", error);
      setDictationErrorDiscussion(
        "Failed to start dictation. Please try again.",
      );
      recognitionRefDiscussion.current = null;
    }
  };

  const stopDictationDiscussion = () => {
    if (recognitionRefDiscussion.current) {
      try {
        recognitionRefDiscussion.current.stop();
      } catch (error) {
        console.error("Error stopping dictation:", error);
      }
      recognitionRefDiscussion.current = null;
    }
    setIsDictatingDiscussion(false);
  };

  // Scope valid = at least one non-empty scope item (required for Site Works Complete). Not required for residential.
  const hasValidScope =
    isResidential ||
    (assessment?.assessmentScope &&
      Array.isArray(assessment.assessmentScope) &&
      assessment.assessmentScope.some(
        (item) => item && String(item).trim() !== "",
      ));

  // Complete assessment handler
  const handleCompleteAssessment = () => {
    const noItems = !items || items.length === 0;
    if (noItems && !hasValidScope) {
      setNoItemsAndScopeDialogOpen(true);
      return;
    }
    if (noItems) {
      setNoItemsDialogOpen(true);
      return;
    }
    if (!hasValidScope) {
      setNoScopeDialogOpen(true);
      return;
    }
    setCompleteDialogOpen(true);
  };

  const confirmCompleteAssessment = async () => {
    if (!hasValidScope) {
      showSnackbar(
        "At least one Scope of Assessment item is required before marking site works complete.",
        "error",
      );
      return;
    }
    try {
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        status: "site-works-complete",
        reportApprovedBy: null,
        reportIssueDate: null,
      });
      setAssessmentCompleted(true);
      showSnackbar("Assessment site works completed successfully!", "success");
      await fetchData();
    } catch (err) {
      console.error("Error completing assessment:", err);
      showSnackbar("Failed to complete assessment", "error");
    } finally {
      setCompleteDialogOpen(false);
    }
  };

  // Handle Samples Submitted to Lab
  const handleSamplesSubmittedToLab = () => {
    // Automatically set the current user's name
    const userName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : "";
    setSubmittedBySignature(userName);
    // Reset turnaround time state and set default to current date/time
    setTurnaroundTime("");
    setAnalysisDueDate(new Date());
    setShowCustomTurnaround(false);
    setShowSamplesSubmittedDialog(true);
  };

  // Handle the actual submission after dialog confirmation
  const handleConfirmSamplesSubmitted = async () => {
    // Validate turnaround time is selected
    if (!turnaroundTime && !showCustomTurnaround) {
      showSnackbar("Please select a turnaround time", "error");
      return;
    }
    if (showCustomTurnaround && !analysisDueDate) {
      showSnackbar("Please select an analysis due date", "error");
      return;
    }
    if (!showCustomTurnaround && !analysisDueDate) {
      showSnackbar("Please select a turnaround time", "error");
      return;
    }

    try {
      const currentDate = new Date().toISOString();
      const finalTurnaroundTime = showCustomTurnaround
        ? "custom"
        : turnaroundTime;

      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        status: "samples-with-lab",
        samplesReceivedDate: currentDate,
        labSamplesStatus: "samples-in-lab",
        submittedBy: submittedBySignature,
        turnaroundTime: finalTurnaroundTime,
        analysisDueDate: analysisDueDate ? analysisDueDate.toISOString() : null,
        reportApprovedBy: null,
        reportIssueDate: null,
      });
      // Refetch assessment to update UI
      await fetchData();
      // Close dialog
      setShowSamplesSubmittedDialog(false);
      showSnackbar("Samples submitted to lab successfully", "success");
      // Navigate to the assessment items page
      navigate(itemsPathForId(id));
    } catch (error) {
      console.error("Error submitting samples to lab:", error);
      showSnackbar("Failed to submit samples to lab", "error");
    }
  };

  // Finalise Assessment (no samples) - goes straight to report-ready-for-review
  const handleFinaliseAssessment = () => {
    setShowFinaliseAssessmentDialog(true);
  };

  const handleConfirmFinaliseAssessment = async () => {
    try {
      setFinalisingAssessment(true);
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        status: "report-ready-for-review",
        noSamplesCollected: true,
        reportApprovedBy: null,
        reportIssueDate: null,
      });
      await fetchData();
      setShowFinaliseAssessmentDialog(false);
      showSnackbar(
        "Assessment finalised successfully. Report is ready for review.",
        "success",
      );
      navigate(itemsPathForId(id));
    } catch (error) {
      console.error("Error finalising assessment:", error);
      showSnackbar("Failed to finalise assessment", "error");
    } finally {
      setFinalisingAssessment(false);
    }
  };

  // Site Plan handlers
  const handleSitePlanSave = async (sitePlanData) => {
    try {
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
          : "Asbestos Assessment Site Plan";

      if (!imageData) {
        showSnackbar("No site plan image data was provided", "error");
        return;
      }

      // Save the drawn site plan to the assessment (preserve status; clear approval if changed)
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        sitePlan: true,
        sitePlanFile: imageData,
        sitePlanLegend: legendEntries,
        sitePlanLegendTitle: legendTitle,
        sitePlanFigureTitle: figureTitle,
        sitePlanSource: "drawn",
        reportApprovedBy: null,
        reportIssueDate: null,
      });

      showSnackbar("Drawn site plan saved successfully!", "success");
      setSitePlanDrawingDialogOpen(false);
      await fetchData(); // Refresh assessment data to show the new site plan
    } catch (error) {
      console.error("Error saving site plan:", error);
      showSnackbar("Error saving site plan", "error");
    }
  };

  const handleSitePlanDrawingClose = () => {
    setSitePlanDrawingDialogOpen(false);
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

          // Update the assessment with the site plan file (preserve status; clear approval if changed)
          await asbestosAssessmentService.update(id, {
            projectId: assessment.projectId?._id || assessment.projectId,
            assessmentDate: assessment.assessmentDate,
            sitePlan: true,
            sitePlanFile: base64Data,
            sitePlanLegend: [],
            sitePlanLegendTitle: null,
            sitePlanSource: "uploaded",
            reportApprovedBy: null,
            reportIssueDate: null,
          });

          showSnackbar("Site plan uploaded successfully", "success");

          setSitePlanDialogOpen(false);
          setSitePlanFile(null);
          await fetchData(); // Refresh assessment data
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
        // Update the assessment to remove the site plan file (preserve status; clear approval if changed)
        await asbestosAssessmentService.update(id, {
          projectId: assessment.projectId?._id || assessment.projectId,
          assessmentDate: assessment.assessmentDate,
          sitePlan: false,
          sitePlanFile: null,
          sitePlanSource: null,
          sitePlanLegend: [],
          sitePlanLegendTitle: null,
          reportApprovedBy: null,
          reportIssueDate: null,
        });

        showSnackbar("Site plan removed successfully", "success");

        await fetchData(); // Refresh assessment data
      } catch (error) {
        console.error("Error removing site plan:", error);
        showSnackbar("Failed to remove site plan", "error");
      }
    }
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
      if (recognitionRefExclusions.current) {
        try {
          recognitionRefExclusions.current.stop();
        } catch (error) {
          // Ignore errors during cleanup
        }
        recognitionRefExclusions.current = null;
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

  // Photo management functions
  const getProjectFolderName = () => {
    const project = assessment?.projectId;
    if (project) {
      if (typeof project === "string") {
        return project;
      }
      return (
        project.projectID ||
        project.projectId ||
        project.externalId ||
        project._id ||
        project.name ||
        id ||
        "assessment-photos"
      );
    }
    return id || "assessment-photos";
  };

  const handleOpenPhotoGallery = (item) => {
    setSelectedItemForPhotos(item);
    setPhotoGalleryDialogOpen(true);
  };

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
    await fetchData();
  };

  const handleTakePhoto = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";
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
      } catch (backCameraError) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      setStream(mediaStream);
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setLastPinchDistance(null);
      setLastPanPoint(null);
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

  const getDistance = (touch1, touch2) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
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
        return;
      }
      setLastTapTime(currentTime);
      if (zoom > 1) {
        setLastPanPoint({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        });
      }
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      const center = getCenter(e.touches[0], e.touches[1]);
      if (lastPinchDistance !== null && videoContainerRef.current) {
        const scale = distance / lastPinchDistance;
        const newZoom = Math.max(1, Math.min(5, zoom * scale));
        const container = videoContainerRef.current;
        const rect = container.getBoundingClientRect();
        const containerCenterX = rect.width / 2;
        const containerCenterY = rect.height / 2;
        const pinchCenterX = center.x - rect.left - containerCenterX;
        const pinchCenterY = center.y - rect.top - containerCenterY;
        const zoomChange = newZoom / zoom;
        setZoom(newZoom);
        setPanX((prevPanX) => {
          const newPanX =
            prevPanX - (pinchCenterX * (zoomChange - 1)) / newZoom;
          const maxPan = (newZoom - 1) * 50;
          return Math.max(-maxPan, Math.min(maxPan, newPanX));
        });
        setPanY((prevPanY) => {
          const newPanY =
            prevPanY - (pinchCenterY * (zoomChange - 1)) / newZoom;
          const maxPan = (newZoom - 1) * 50;
          return Math.max(-maxPan, Math.min(maxPan, newPanY));
        });
        setLastPinchDistance(distance);
        setLastPanPoint(center);
      } else {
        setLastPinchDistance(distance);
        setLastPanPoint(center);
      }
    } else if (e.touches.length === 1 && zoom > 1 && lastPanPoint) {
      const deltaX = (e.touches[0].clientX - lastPanPoint.x) / zoom;
      const deltaY = (e.touches[0].clientY - lastPanPoint.y) / zoom;
      const maxPan = (zoom - 1) * 50;
      setPanX((prevPanX) => {
        const newPanX = prevPanX + deltaX;
        return Math.max(-maxPan, Math.min(maxPan, newPanX));
      });
      setPanY((prevPanY) => {
        const newPanY = prevPanY + deltaY;
        return Math.max(-maxPan, Math.min(maxPan, newPanY));
      });
      setLastPanPoint({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      });
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      setLastPinchDistance(null);
    }
    if (e.touches.length === 0) {
      setLastPanPoint(null);
    }
  };

  const handleCapturePhoto = async () => {
    if (videoRef) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = videoRef.videoWidth;
      canvas.height = videoRef.videoHeight;

      if (zoom > 1 && videoContainerRef.current) {
        const container = videoContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const videoAspect = videoRef.videoWidth / videoRef.videoHeight;
        const containerAspect = containerRect.width / containerRect.height;
        let videoDisplayWidth, videoDisplayHeight;
        if (videoAspect > containerAspect) {
          videoDisplayHeight = containerRect.height;
          videoDisplayWidth = videoDisplayHeight * videoAspect;
        } else {
          videoDisplayWidth = containerRect.width;
          videoDisplayHeight = videoDisplayWidth / videoAspect;
        }
        const sourceWidth = videoRef.videoWidth / zoom;
        const sourceHeight = videoRef.videoHeight / zoom;
        const panXVideo = (panX * videoDisplayWidth) / containerRect.width;
        const panYVideo = (panY * videoDisplayHeight) / containerRect.height;
        const sourceX = (videoRef.videoWidth - sourceWidth) / 2 - panXVideo;
        const sourceY = (videoRef.videoHeight - sourceHeight) / 2 - panYVideo;
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
        context.drawImage(videoRef, 0, 0, canvas.width, canvas.height);
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `assessment-photo-${timestamp}.jpg`;

      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const fullQualityFile = new File([blob], filename, {
              type: "image/jpeg",
            });
            try {
              const projectFolderName = getProjectFolderName();
              await saveFileToDevice(fullQualityFile, filename, {
                projectId: projectFolderName
                  ? `${projectFolderName} - Photos`
                  : "assessment-photos",
              });
            } catch (error) {
              console.error("Error saving photo to device:", error);
            }
            const uploadFile = new File([blob], "camera-photo.jpg", {
              type: "image/jpeg",
            });
            handlePhotoUploadForGallery({ target: { files: [uploadFile] } });
          }
        },
        "image/jpeg",
        1.0,
      );
    }
    handleCloseCamera();
  };

  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraDialogOpen(false);
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setLastPinchDistance(null);
    setLastPanPoint(null);
  };

  const handleAddPhotoToItem = async (photoData) => {
    if (!selectedItemForPhotos) return;
    try {
      const response = await asbestosAssessmentService.addPhotoToItem(
        id,
        selectedItemForPhotos._id,
        photoData,
        true,
      );
      await asbestosAssessmentService.update(id, {
        projectId: assessment.projectId?._id || assessment.projectId,
        assessmentDate: assessment.assessmentDate,
        reportApprovedBy: null,
        reportIssueDate: null,
      });
      if (response && response.photographs) {
        setSelectedItemForPhotos((prev) => ({
          ...prev,
          photographs: response.photographs,
        }));
      } else if (response) {
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

  const handleDeletePhotoFromItem = (itemId, photoId) => {
    setPhotosToDelete((prev) => new Set([...prev, photoId]));
  };

  const handleTogglePhotoInReport = (itemId, photoId) => {
    setLocalPhotoChanges((prev) => ({
      ...prev,
      [photoId]: !getCurrentPhotoState(photoId),
    }));
  };

  const handleViewFullSizePhoto = (photoUrl) => {
    setFullSizePhotoUrl(photoUrl);
    setFullSizePhotoDialogOpen(true);
  };

  const getCurrentPhotoState = (photoId) => {
    const localChange = localPhotoChanges[photoId];
    if (localChange !== undefined) {
      return localChange;
    }
    const photo = selectedItemForPhotos?.photographs?.find(
      (p) => p._id === photoId,
    );
    return photo?.includeInReport ?? true;
  };

  const generateDefaultPhotoDescription = (item) => {
    const roomArea = (item.roomArea || "unknown room/area").toLowerCase();
    const materialDesc = (
      item.locationDescription ||
      item.materialType ||
      "unknown material"
    ).toLowerCase();
    return `Photograph of ${materialDesc} in ${roomArea}`;
  };

  const getCurrentPhotoDescription = (photoId, item) => {
    if (localPhotoDescriptions[photoId] !== undefined) {
      return localPhotoDescriptions[photoId];
    }
    const photo = selectedItemForPhotos?.photographs?.find(
      (p) => p._id === photoId,
    );
    if (photo?.description) {
      return photo.description;
    }
    return generateDefaultPhotoDescription(item);
  };

  const handleDescriptionChange = (photoId, newDescription) => {
    setLocalPhotoDescriptions((prev) => ({
      ...prev,
      [photoId]: newDescription,
    }));
  };

  const hasUnsavedChanges = () => {
    return (
      Object.keys(localPhotoChanges).length > 0 ||
      photosToDelete.size > 0 ||
      Object.keys(localPhotoDescriptions).length > 0
    );
  };

  const isPhotoMarkedForDeletion = (photoId) => {
    return photosToDelete.has(photoId);
  };

  const savePhotoChanges = async () => {
    try {
      const togglePromises = [];
      const descriptionPromises = [];
      let toggleResults = [];
      let descriptionResults = [];
      let deletionResults = [];

      Object.entries(localPhotoChanges).forEach(
        ([photoId, includeInReport]) => {
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
        },
      );

      Object.entries(localPhotoDescriptions).forEach(
        ([photoId, description]) => {
          descriptionPromises.push(
            asbestosAssessmentService.updatePhotoDescription(
              id,
              selectedItemForPhotos._id,
              photoId,
              description,
            ),
          );
        },
      );

      if (togglePromises.length > 0) {
        toggleResults = await Promise.allSettled(togglePromises);
      }

      if (descriptionPromises.length > 0) {
        descriptionResults = await Promise.allSettled(descriptionPromises);
      }

      for (const photoId of photosToDelete) {
        try {
          await asbestosAssessmentService.deletePhotoFromItem(
            id,
            selectedItemForPhotos._id,
            photoId,
          );
          deletionResults.push({ status: "fulfilled", photoId });
        } catch (error) {
          console.error(`Error deleting photo ${photoId}:`, error);
          deletionResults.push({ status: "rejected", photoId, reason: error });
        }
      }

      const allResults = [
        ...toggleResults,
        ...descriptionResults,
        ...deletionResults,
      ];
      const failures = allResults.filter((r) => r.status === "rejected");
      const successes = allResults.filter((r) => r.status === "fulfilled");

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
          showSnackbar("Failed to save photo changes", "error");
          return;
        } else {
          showSnackbar(
            `Saved ${successes.length} of ${allResults.length} changes. Some operations failed.`,
            "warning",
          );
        }
      } else {
        showSnackbar("Photo changes saved successfully", "success");
      }

      if (successes.length > 0) {
        setLocalPhotoChanges({});
        setPhotosToDelete(new Set());
        setLocalPhotoDescriptions({});
        await asbestosAssessmentService.update(id, {
          projectId: assessment.projectId?._id || assessment.projectId,
          assessmentDate: assessment.assessmentDate,
          reportApprovedBy: null,
          reportIssueDate: null,
        });
      }

      await fetchData();

      const updatedItems = await asbestosAssessmentService.getItems(id);
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

  const handlePhotoUploadForGallery = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhotoFile(file);
      setCompressionStatus({
        type: "processing",
        message: "Processing image...",
      });

      try {
        const originalSizeKB = Math.round(file.size / 1024);
        const shouldCompress = needsCompression(file, 300);

        if (shouldCompress) {
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

          const compressedSizeKB = Math.round(
            (compressedImage.length * 0.75) / 1024,
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100,
          );

          await handleAddPhotoToItem(compressedImage);

          setCompressionStatus({
            type: "success",
            message: `Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${reduction}% reduction)`,
          });
        } else {
          const reader = new FileReader();
          reader.onload = async (e) => {
            await handleAddPhotoToItem(e.target.result);
            setCompressionStatus({
              type: "info",
              message: `No compression needed (${originalSizeKB}KB)`,
            });
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        setCompressionStatus({
          type: "error",
          message: "Failed to process image",
        });
      }
    }
  };

  if (loading) {
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
    return (
      <Box m="20px">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Assessment Items
        </Typography>

        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ marginBottom: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate(listPath)}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            {isResidential
              ? "Residential Asbestos Surveys"
              : "Asbestos Assessment"}
          </Link>
        </Breadcrumbs>

        {/* Project Info */}
        {assessment && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" color="text.secondary">
              Project ID: {assessment.projectId?.projectID || "N/A"}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Site Name: {assessment.projectId?.name || "N/A"}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Date of Assessment: {assessment?.assessmentDate
              ? new Date(assessment.assessmentDate).toLocaleDateString(
                  "en-GB",
                  {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  },
                )
              : "Unknown Date"}

          </Typography>
          </Box>
        )}

        {!isResidential && (
          <Box
            display="flex"
            gap={2}
            sx={{ mt: 3 }}
            alignItems="center"
            flexWrap="wrap"
          >
            <Button
              variant="outlined"
              color="primary"
              onClick={() => {
                // Load current scope items when opening dialog
                if (
                  assessment?.assessmentScope &&
                  Array.isArray(assessment.assessmentScope) &&
                  assessment.assessmentScope.length > 0
                ) {
                  setScopeItems(assessment.assessmentScope);
                } else {
                  setScopeItems([""]);
                }
                setScopeDialogOpen(true);
              }}
            >
              Scope of Assessment
            </Button>
            {assessment?.assessmentScope &&
              Array.isArray(assessment.assessmentScope) &&
              assessment.assessmentScope.length > 0 &&
              assessment.assessmentScope.some((item) => item.trim() !== "") && (
                <>
                  <ArrowForwardIcon sx={{ color: "text.secondary" }} />
                  <Typography variant="body1">
                    {assessment.assessmentScope
                      .filter((item) => item.trim() !== "")
                      .join(" | ")}
                  </Typography>
                </>
              )}
            {(!assessment?.assessmentScope ||
              !Array.isArray(assessment.assessmentScope) ||
              assessment.assessmentScope.length === 0 ||
              !assessment.assessmentScope.some((item) => item.trim() !== "")) && (
              <Typography
                variant="body2"
                color="#de0a26"
                sx={{ fontWeight: "medium" }}
              >
                ⚠ At least one scope item is required.
              </Typography>
            )}
          </Box>
        )}

        {/* Site Plan Actions */}
        <Box
          display="flex"
          gap={2}
          sx={{ mt: 2, mb: 2 }}
          alignItems="center"
          flexWrap="wrap"
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setSitePlanDrawingDialogOpen(true)}
            startIcon={<MapIcon />}
          >
            {assessment?.sitePlanFile ? "Edit Site Plan" : "Site Plan"}
          </Button>
          {assessment?.sitePlanFile && (
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
          {assessment?.sitePlanFile && (
            <Typography
              variant="body2"
              color="success.main"
              sx={{ fontWeight: "medium" }}
            >
              ✓ Site Plan Attached
            </Typography>
          )}
          {!assessment?.sitePlanFile && (
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ fontWeight: "medium" }}
            >
              ⚠ No Site Plan
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 2, mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setItemTypeSelectionModalOpen(true);
            }}
            startIcon={<AddIcon />}
          >
            Add Assessment Item
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
          <Button
            variant="contained"
            onClick={() => setDiscussionModalOpen(true)}
            startIcon={<DescriptionIcon />}
            sx={{
              backgroundColor: "#7b1fa2",
              color: "white",
              "&:hover": {
                backgroundColor: "#6a1b9a",
              },
            }}
          >
            Discussion/Conclusions
          </Button>
        </Box>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    {items &&
                      items.length > 0 &&
                      items.some(
                        (item) =>
                          item.levelFloor && item.levelFloor.trim() !== "",
                      ) && (
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Level/Floor
                        </TableCell>
                      )}
                    <TableCell sx={{ fontWeight: "bold" }}>Room/Area</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Location Description
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Sample Reference
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Asbestos Content
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Photograph
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          5 +
                          (items &&
                          items.length > 0 &&
                          items.some(
                            (item) =>
                              item.levelFloor && item.levelFloor.trim() !== "",
                          )
                            ? 1
                            : 0)
                        }
                        align="center"
                      >
                        No items found. Click "Add Item" to create your first
                        item.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      const hasLevelFloor =
                        items &&
                        items.length > 0 &&
                        items.some(
                          (item) =>
                            item.levelFloor && item.levelFloor.trim() !== "",
                        );
                      return (
                        <TableRow key={item._id || item.itemNumber}>
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
                          <TableCell>{item.roomArea || "N/A"}</TableCell>
                          <TableCell>
                            {item.locationDescription || "N/A"}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const ref = (item.sampleReference || "").trim();
                              const firstIdx = items.findIndex(
                                (i) => (i.sampleReference || "").trim() === ref,
                              );
                              const isReferred =
                                ref &&
                                firstIdx >= 0 &&
                                items.indexOf(item) !== firstIdx;
                              return isReferred
                                ? `Refer to sample ${item.sampleReference}`
                                : item.sampleReference || "N/A";
                            })()}
                          </TableCell>
                          <TableCell>{item.asbestosContent || "N/A"}</TableCell>
                          <TableCell>
                            {(() => {
                              const photoCount =
                                (item.photographs?.length || 0) +
                                (item.photograph ? 1 : 0);
                              const selectedCount =
                                item.photographs?.filter(
                                  (p) => p.includeInReport,
                                ).length || 0;
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
                              <IconButton
                                onClick={() => handleDelete(item)}
                                color="error"
                                size="small"
                                title="Delete"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Assessment Complete Button */}
        <Box
          sx={{
            mt: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {!assessmentCompleted && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleCompleteAssessment}
              sx={{
                backgroundColor: "#1976d2",
                "&:hover": {
                  backgroundColor: "#1565c0",
                },
              }}
            >
              SITE WORKS COMPLETED
            </Button>
          )}
          {assessment?.status === "site-works-complete" &&
            (() => {
              const hasSampledItems = (items || []).some(
                (item) => (item.sampleReference || "").trim() !== "",
              );
              if (!hasSampledItems) {
                return (
                  <Button
                    variant="contained"
                    onClick={handleFinaliseAssessment}
                    disabled={finalisingAssessment}
                    sx={{
                      backgroundColor: "#ff9800",
                      color: "white",
                      "&:hover": {
                        backgroundColor: "#f57c00",
                      },
                    }}
                  >
                    Finalise Assessment
                  </Button>
                );
              }
              return (
                <Button
                  variant="contained"
                  onClick={handleSamplesSubmittedToLab}
                  sx={{
                    backgroundColor: "#ff9800",
                    color: "white",
                    "&:hover": {
                      backgroundColor: "#f57c00",
                    },
                  }}
                >
                  Submit Samples to Lab
                </Button>
              );
            })()}
        </Box>

        {/* Item Type Selection Modal */}
        <Dialog
          open={itemTypeSelectionModalOpen}
          onClose={() => setItemTypeSelectionModalOpen(false)}
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
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            Select Item Type
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2 }}
            >
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                  setIsNonACM(false);
                  setIsReferredItem(false);
                  setItemTypeSelectionModalOpen(false);
                  setDialogOpen(true);
                }}
                sx={{
                  py: 1.5,
                  textTransform: "none",
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                Add Sampled Item
              </Button>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                disabled={getAvailableSampleReferences().length === 0}
                title={
                  getAvailableSampleReferences().length === 0
                    ? "Add a sampled item first to reference"
                    : ""
                }
                onClick={() => {
                  if (getAvailableSampleReferences().length === 0) return;
                  setEditingItem(null);
                  resetForm();
                  setIsNonACM(false);
                  setIsReferredItem(true);
                  setItemTypeSelectionModalOpen(false);
                  setDialogOpen(true);
                }}
                sx={{
                  py: 1.5,
                  textTransform: "none",
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                Add Referred Item
              </Button>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={() => {
                  setEditingItem(null);
                  resetForm();
                  setIsReferredItem(false);
                  setIsVisuallyAssessedItem(true);
                  setVisuallyAssessedType("asbestos");
                  // Set isNonACM to false for asbestos (default selection) - behaves like sampled item
                  setIsNonACM(false);
                  setItemTypeSelectionModalOpen(false);
                  setDialogOpen(true);
                }}
                sx={{
                  py: 1.5,
                  textTransform: "none",
                  fontSize: "1rem",
                  fontWeight: 500,
                }}
              >
                Add Visually Assessed Item
              </Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setItemTypeSelectionModalOpen(false)}
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
          </DialogActions>
        </Dialog>

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
                <Grid item xs={12}>
                  <Divider sx={{ my: -3 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Sample Details
                    </Typography>
                  </Divider>
                </Grid>
                {isVisuallyAssessedItem ? (
                  <Grid item xs={12}>
                    <FormControl component="fieldset">
                      <RadioGroup
                        row
                        value={visuallyAssessedType}
                        onChange={(e) => {
                          setVisuallyAssessedType(e.target.value);
                          if (e.target.value === "non-asbestos") {
                            setIsNonACM(true);
                            setForm({
                              ...form,
                              recommendations: "No Action Required",
                              asbestosContent: "",
                            });
                          } else {
                            setIsNonACM(false);
                            setForm({ ...form, recommendations: "" });
                          }
                        }}
                      >
                        <FormControlLabel
                          value="asbestos"
                          control={<Radio />}
                          label="Visually assessed as Asbestos"
                        />
                        <FormControlLabel
                          value="non-asbestos"
                          control={<Radio />}
                          label="Visually assessed as Non-asbestos"
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>
                ) : null}
                {!isNonACM && !isVisuallyAssessedItem && (
                  <Grid item xs={12} md={6}>
                    {isReferredItem ? (
                      <FormControl fullWidth>
                        <InputLabel>Sample Reference</InputLabel>
                        <Select
                          value={form.sampleReference}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              sampleReference: e.target.value,
                            });
                          }}
                          label="Sample Reference"
                          disabled={getAvailableSampleReferences().length === 0}
                        >
                          {getAvailableSampleReferences().length === 0 ? (
                            <MenuItem disabled value="">
                              No samples available
                            </MenuItem>
                          ) : (
                            getAvailableSampleReferences().map((ref) => (
                              <MenuItem key={ref} value={ref}>
                                {ref}
                              </MenuItem>
                            ))
                          )}
                        </Select>
                        {getAvailableSampleReferences().length === 0 && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            No sampled items available to reference. Please add
                            a sampled item first.
                          </Typography>
                        )}
                      </FormControl>
                    ) : (
                      <TextField
                        fullWidth
                        label="Sample Reference"
                        value={form.sampleReference}
                        onChange={(e) => {
                          let value = e.target.value;
                          // Remove "LD-" if user types it (we'll add it automatically)
                          if (value.startsWith("LD-")) {
                            value = value.substring(3);
                          }
                          // Convert to uppercase
                          value = value.toUpperCase();
                          setForm({ ...form, sampleReference: value });
                        }}
                        onBlur={(e) => {
                          // Add LD- prefix when field loses focus if value exists
                          if (e.target.value && e.target.value.trim() !== "") {
                            const prefixed = ensureSampleReferencePrefix(
                              e.target.value,
                            );
                            // Store without prefix in form state, but show with prefix
                            const withoutPrefix = prefixed.startsWith("LD-")
                              ? prefixed.substring(3)
                              : prefixed;
                            setForm({
                              ...form,
                              sampleReference: withoutPrefix,
                            });
                          }
                        }}
                        helperText={
                          form.sampleReference
                            ? "'LD-' prefix will be added automatically"
                            : "'LD-' prefix will be added automatically"
                        }
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              LD-
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  </Grid>
                )}
                <Grid item xs={12} container spacing={2} alignItems="center">
                  <Grid item>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={showLevelFloor}
                          onChange={(e) => setShowLevelFloor(e.target.checked)}
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
                      />
                    </Grid>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
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
                    freeSolo
                    renderInput={(params) => (
                      <TextField {...params} label="Room/Area" required />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
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
                    freeSolo
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Location Description"
                        required
                      />
                    )}
                  />
                </Grid>
                <Grid
                  item
                  xs={12}
                  container
                  spacing={2}
                  alignItems="flex-start"
                >
                  <Grid
                    item
                    xs={12}
                    md={
                      selectedMaterialFromDropdown && form.asbestosType
                        ? 8
                        : !selectedMaterialFromDropdown
                          ? 6
                          : 12
                    }
                  >
                    <Autocomplete
                      value={
                        form.materialType
                          ? (isNonACM
                              ? customDataFields.materialsDescriptionsNonACM
                              : customDataFields.materialsDescriptions
                            ).find((item) => item.text === form.materialType) ||
                            form.materialType
                          : null
                      }
                      onChange={(event, newValue) => {
                        if (
                          newValue &&
                          typeof newValue === "object" &&
                          newValue.text
                        ) {
                          // Selected from dropdown
                          const asbestosTypeValue = isNonACM
                            ? ""
                            : newValue.asbestosType
                              ? newValue.asbestosType === "Friable"
                                ? "friable"
                                : newValue.asbestosType === "Non-friable"
                                  ? "non-friable"
                                  : newValue.asbestosType.toLowerCase()
                              : "";
                          setForm({
                            ...form,
                            materialType: newValue.text || "",
                            asbestosType: asbestosTypeValue,
                          });
                          setSelectedMaterialFromDropdown(
                            !isNonACM && !!asbestosTypeValue,
                          );
                        } else if (newValue === null || newValue === "") {
                          // Cleared
                          setForm({
                            ...form,
                            materialType: "",
                            asbestosType: "",
                          });
                          setSelectedMaterialFromDropdown(false);
                        } else {
                          // Free text input (string)
                          // Check if it matches a dropdown option
                          const materialsSource = isNonACM
                            ? customDataFields.materialsDescriptionsNonACM
                            : customDataFields.materialsDescriptions;
                          const matchingMaterial = materialsSource.find(
                            (item) => item.text === newValue,
                          );
                          if (
                            !isNonACM &&
                            matchingMaterial &&
                            matchingMaterial.asbestosType
                          ) {
                            const asbestosTypeValue =
                              matchingMaterial.asbestosType === "Friable"
                                ? "friable"
                                : matchingMaterial.asbestosType ===
                                    "Non-friable"
                                  ? "non-friable"
                                  : matchingMaterial.asbestosType.toLowerCase();
                            setForm({
                              ...form,
                              materialType: newValue,
                              asbestosType: asbestosTypeValue,
                            });
                            setSelectedMaterialFromDropdown(true);
                          } else {
                            setForm({
                              ...form,
                              materialType: newValue,
                              asbestosType: "",
                            });
                            setSelectedMaterialFromDropdown(false);
                          }
                        }
                      }}
                      onInputChange={(event, newInputValue) => {
                        // Just update the material type as user types
                        // The onChange handler will handle matching and setting asbestos type
                        setForm({ ...form, materialType: newInputValue });
                      }}
                      options={
                        isNonACM
                          ? customDataFields.materialsDescriptionsNonACM
                          : customDataFields.materialsDescriptions
                      }
                      getOptionLabel={(option) =>
                        typeof option === "string" ? option : option.text || ""
                      }
                      isOptionEqualToValue={(option, value) => {
                        if (
                          typeof option === "string" ||
                          typeof value === "string"
                        ) {
                          return option === value;
                        }
                        return option.text === value.text;
                      }}
                      freeSolo
                      renderOption={(props, option) => (
                        <Box component="li" {...props}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              width: "100%",
                              alignItems: "center",
                            }}
                          >
                            <Typography>{option.text}</Typography>
                            {!isNonACM && option.asbestosType && (
                              <Chip
                                label={option.asbestosType}
                                size="small"
                                color={
                                  option.asbestosType === "Friable"
                                    ? "error"
                                    : "warning"
                                }
                                sx={{ ml: 2 }}
                              />
                            )}
                          </Box>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Material Description"
                          required
                        />
                      )}
                    />
                  </Grid>
                  {!isNonACM &&
                    selectedMaterialFromDropdown &&
                    form.asbestosType && (
                      <Grid item xs={12} md={4}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            height: "100%",
                            pt: 1,
                          }}
                        >
                          <Chip
                            label={`Asbestos Type: ${
                              form.asbestosType === "friable"
                                ? "Friable"
                                : form.asbestosType === "non-friable"
                                  ? "Non-friable"
                                  : form.asbestosType
                            }`}
                            color={
                              form.asbestosType === "friable"
                                ? "error"
                                : form.asbestosType === "non-friable"
                                  ? "warning"
                                  : "default"
                            }
                            size="medium"
                          />
                        </Box>
                      </Grid>
                    )}
                  {!isNonACM && !selectedMaterialFromDropdown && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
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
                  )}
                </Grid>
                {!isVisuallyAssessedItem && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Asbestos Content"
                      value={form.asbestosContent || ""}
                      disabled
                      placeholder="Will be populated when sample is analysed"
                      helperText="This field will be automatically populated when the sample is analysed"
                    />
                  </Grid>
                )}
                {isVisuallyAssessedItem && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Asbestos Content"
                      value={
                        visuallyAssessedType === "asbestos"
                          ? "Visually Assessed as Asbestos"
                          : "Visually Assessed as Non-Asbestos"
                      }
                      disabled
                      helperText={
                        visuallyAssessedType === "non-asbestos"
                          ? "No asbestos content for non-asbestos items"
                          : "Visually assessed as containing asbestos"
                      }
                    />
                  </Grid>
                )}
                {!isNonACM && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Risk Assessment
                        </Typography>
                      </Divider>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Condition</InputLabel>
                        <Select
                          value={form.condition}
                          onChange={(e) =>
                            setForm({ ...form, condition: e.target.value })
                          }
                          label="Condition"
                        >
                          <MenuItem value="Good">Good</MenuItem>
                          <MenuItem value="Fair">Fair</MenuItem>
                          <MenuItem value="Minor damage">Minor damage</MenuItem>
                          <MenuItem value="Poor">Poor</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Risk</InputLabel>
                        <Select
                          value={form.risk}
                          onChange={(e) =>
                            setForm({ ...form, risk: e.target.value })
                          }
                          label="Risk"
                        >
                          <MenuItem value="Very low">Very low</MenuItem>
                          <MenuItem value="Low">Low</MenuItem>
                          <MenuItem value="Moderate">Moderate</MenuItem>
                          <MenuItem value="High">High</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Recommendations
                    </Typography>
                  </Divider>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recommendations"
                    value={form.recommendations}
                    onChange={(e) => {
                      if (
                        !isNonACM &&
                        !(
                          isVisuallyAssessedItem &&
                          visuallyAssessedType === "non-asbestos"
                        )
                      ) {
                        setForm({ ...form, recommendations: e.target.value });
                        if (dictationError) {
                          setDictationError("");
                        }
                      }
                    }}
                    multiline
                    rows={4}
                    disabled={
                      isNonACM ||
                      (isVisuallyAssessedItem &&
                        visuallyAssessedType === "non-asbestos")
                    }
                    helperText={
                      isNonACM ||
                      (isVisuallyAssessedItem &&
                        visuallyAssessedType === "non-asbestos")
                        ? "No Action Required for non-ACM items"
                        : "Enter recommendation text"
                    }
                    InputProps={{
                      endAdornment: !isNonACM &&
                        !(
                          isVisuallyAssessedItem &&
                          visuallyAssessedType === "non-asbestos"
                        ) && (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={
                                isDictating ? stopDictation : startDictation
                              }
                              color={isDictating ? "error" : "primary"}
                              title={
                                isDictating
                                  ? "Stop Dictation"
                                  : "Start Dictation"
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
                          </InputAdornment>
                        ),
                    }}
                  />
                  {/* Dictation Status and Errors */}
                  {isDictating && (
                    <Box
                      sx={{
                        mt: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
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
                  !form.roomArea.trim() ||
                  !form.locationDescription.trim() ||
                  !form.materialType.trim()
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
              Are you sure you want to delete this assessment item? This action
              cannot be undone.
            </Typography>
            {itemToDelete && (
              <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>Location:</strong>{" "}
                  {itemToDelete.locationDescription || "N/A"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Material:</strong>{" "}
                  {itemToDelete.materialType || "N/A"}
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
            <IconButton onClick={handleClosePhotoGallery}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 3, border: "none" }}>
            {selectedItemForPhotos && (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Location:</strong>{" "}
                    {selectedItemForPhotos.locationDescription}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Room/Area:</strong> {selectedItemForPhotos.roomArea}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Material:</strong>{" "}
                    {selectedItemForPhotos.materialType}
                  </Typography>
                </Box>

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
                    {selectedItemForPhotos.photographs?.map((photo, index) => (
                      <Grid item xs={12} sm={6} md={4} key={photo._id}>
                        <Card
                          sx={{
                            position: "relative",
                            height: "100%",
                            border: getCurrentPhotoState(photo._id)
                              ? "3px solid #4caf50"
                              : "3px solid transparent",
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
                            onClick={() => handleViewFullSizePhoto(photo.data)}
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
                                checked={getCurrentPhotoState(photo._id)}
                                size="small"
                                sx={{
                                  color: "white",
                                  "&.Mui-checked": {
                                    color: "#4caf50",
                                  },
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleTogglePhotoInReport(
                                    selectedItemForPhotos._id,
                                    photo._id,
                                  );
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                title={
                                  getCurrentPhotoState(photo._id)
                                    ? "Remove from report"
                                    : "Include in report"
                                }
                              />
                            </Box>

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
                                zIndex: 3,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPhotoMarkedForDeletion(photo._id)) {
                                  setPhotosToDelete((prev) => {
                                    const newSet = new Set(prev);
                                    newSet.delete(photo._id);
                                    return newSet;
                                  });
                                } else {
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

        {/* Camera Dialog */}
        <Dialog
          open={cameraDialogOpen}
          onClose={handleCloseCamera}
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
              <PhotoCameraIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Take Photo
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box
              ref={videoContainerRef}
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "300px",
                backgroundColor: "#000",
                borderRadius: 2,
                overflow: "hidden",
                position: "relative",
                touchAction: "none",
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {stream ? (
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
                    transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                    transformOrigin: "center center",
                    transition: zoom === 1 ? "transform 0.1s" : "none",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    color: "white",
                  }}
                >
                  <CircularProgress color="inherit" />
                  <Typography variant="body1">Starting camera...</Typography>
                </Box>
              )}
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2, textAlign: "center" }}
            >
              Position the item within the frame and click "Capture" to take the
              photo. Pinch to zoom (up to 5x) or double-tap to reset zoom.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={handleCloseCamera}
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
              onClick={handleCapturePhoto}
              variant="contained"
              color="primary"
              startIcon={<PhotoCameraIcon />}
              disabled={!stream}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Capture Photo
            </Button>
          </DialogActions>
        </Dialog>

        {!isResidential && (
          <>
            {/* Scope of Assessment Dialog */}
            <Dialog
              open={scopeDialogOpen}
              onClose={() => setScopeDialogOpen(false)}
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
                  <Typography sx={{ fontSize: 20, fontWeight: "bold" }}>
                    S
                  </Typography>
                </Box>
                <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                  Scope of Assessment
                </Typography>
              </DialogTitle>
              <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Enter the scope items for this assessment. These will be displayed
                  as bullet points in the report.
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {scopeItems.map((item, index) => (
                    <Box
                      key={index}
                      sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
                    >
                      <TextField
                        fullWidth
                        label={
                          index === 0
                            ? "Scope Item (Required)"
                            : `Scope Item ${index + 1}`
                        }
                        value={item}
                        onChange={(e) => {
                          const newItems = [...scopeItems];
                          newItems[index] = e.target.value;
                          setScopeItems(newItems);
                        }}
                        required={index === 0}
                        variant="outlined"
                        size="small"
                      />
                      {scopeItems.length > 1 && (
                        <IconButton
                          onClick={() => {
                            const newItems = scopeItems.filter(
                              (_, i) => i !== index,
                            );
                            setScopeItems(newItems);
                          }}
                          color="error"
                          sx={{ mt: 1 }}
                          title="Remove this item"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </Box>
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setScopeItems([...scopeItems, ""])}
                  sx={{ mt: 2 }}
                >
                  Add Scope Item
                </Button>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
                <Button
                  onClick={() => setScopeDialogOpen(false)}
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
                    // Validate that assessment exists
                    if (!assessment) {
                      showSnackbar(
                        "Assessment data not loaded. Please refresh the page.",
                        "error",
                      );
                      return;
                    }

                    // Validate that at least the first item is filled
                    if (!scopeItems[0] || scopeItems[0].trim() === "") {
                      showSnackbar("At least one scope item is required", "error");
                      return;
                    }

                    // Filter out empty items (except keep at least one)
                    const filteredItems = scopeItems
                      .map((item) => item.trim())
                      .filter((item) => item !== "");

                    if (filteredItems.length === 0) {
                      showSnackbar("At least one scope item is required", "error");
                      return;
                    }

                    try {
                      await asbestosAssessmentService.update(id, {
                        projectId:
                          assessment.projectId?._id || assessment.projectId,
                        assessmentDate: assessment.assessmentDate,
                        status: assessment.status,
                        assessmentScope: filteredItems,
                        reportApprovedBy: null,
                        reportIssueDate: null,
                      });
                      showSnackbar(
                        "Scope of assessment saved successfully",
                        "success",
                      );
                      setScopeDialogOpen(false);
                      await fetchData();
                    } catch (err) {
                      console.error("Error saving scope:", err);
                      showSnackbar("Failed to save scope of assessment", "error");
                    }
                  }}
                  variant="contained"
                  sx={{
                    minWidth: 120,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 500,
                  }}
                >
                  Save Scope
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}

        {/* Full Size Photo Dialog */}
        <Dialog
          open={fullSizePhotoDialogOpen}
          onClose={() => setFullSizePhotoDialogOpen(false)}
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
              onClick={() => setFullSizePhotoDialogOpen(false)}
              sx={{
                position: "absolute",
                top: 10,
                right: 10,
                color: "white",
                bgcolor: "rgba(0, 0, 0, 0.5)",
                "&:hover": {
                  bgcolor: "rgba(0, 0, 0, 0.7)",
                },
              }}
            >
              <CloseIcon />
            </IconButton>
            {fullSizePhotoUrl && (
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
                value={assessment?.jobSpecificExclusions || ""}
                onChange={(e) => {
                  // Update local state for the text field
                  setAssessment((prev) => ({
                    ...prev,
                    jobSpecificExclusions: e.target.value,
                  }));
                }}
                multiline
                rows={6}
                placeholder="Enter job-specific exclusions/caveats that should be included in the assessment report"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {savingExclusions ? (
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                      ) : (
                        <IconButton
                          onClick={
                            isDictatingExclusions
                              ? stopDictationExclusions
                              : startDictationExclusions
                          }
                          color={isDictatingExclusions ? "error" : "primary"}
                          title={
                            isDictatingExclusions
                              ? "Stop Dictation"
                              : "Start Dictation"
                          }
                          sx={{
                            backgroundColor: isDictatingExclusions
                              ? "error.light"
                              : "transparent",
                            "&:hover": {
                              backgroundColor: isDictatingExclusions
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
              {isDictatingExclusions && (
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
              {dictationErrorExclusions && (
                <Typography
                  variant="caption"
                  color="error.main"
                  sx={{ mt: 1, display: "block" }}
                >
                  {dictationErrorExclusions}
                </Typography>
              )}
              {exclusionsLastSaved && (
                <Typography variant="body2" color="text.secondary">
                  Last saved:{" "}
                  {new Date(exclusionsLastSaved).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
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
                  await asbestosAssessmentService.update(id, {
                    projectId:
                      assessment?.projectId?._id || assessment?.projectId,
                    assessmentDate: assessment?.assessmentDate,
                    jobSpecificExclusions:
                      assessment?.jobSpecificExclusions || "",
                    reportApprovedBy: null,
                    reportIssueDate: null,
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

        {/* Discussion/Conclusions Modal */}
        <Dialog
          open={discussionModalOpen}
          onClose={() => setDiscussionModalOpen(false)}
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
                bgcolor: "#7b1fa2",
                color: "white",
              }}
            >
              <DescriptionIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Discussion/Conclusions
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                value={assessment?.discussionConclusions || ""}
                onChange={(e) => {
                  setAssessment((prev) => ({
                    ...prev,
                    discussionConclusions: e.target.value,
                  }));
                }}
                multiline
                rows={6}
                placeholder="Enter discussion and conclusions for the assessment report"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {savingDiscussion ? (
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                      ) : (
                        <IconButton
                          onClick={
                            isDictatingDiscussion
                              ? stopDictationDiscussion
                              : startDictationDiscussion
                          }
                          color={isDictatingDiscussion ? "error" : "primary"}
                          title={
                            isDictatingDiscussion
                              ? "Stop Dictation"
                              : "Start Dictation"
                          }
                          sx={{
                            backgroundColor: isDictatingDiscussion
                              ? "error.light"
                              : "transparent",
                            "&:hover": {
                              backgroundColor: isDictatingDiscussion
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
              {isDictatingDiscussion && (
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
              {dictationErrorDiscussion && (
                <Typography
                  variant="caption"
                  color="error.main"
                  sx={{ mt: 1, display: "block" }}
                >
                  {dictationErrorDiscussion}
                </Typography>
              )}
              {discussionLastSaved && (
                <Typography variant="body2" color="text.secondary">
                  Last saved:{" "}
                  {new Date(discussionLastSaved).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setDiscussionModalOpen(false)}
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
                  setSavingDiscussion(true);
                  await asbestosAssessmentService.update(id, {
                    projectId:
                      assessment?.projectId?._id || assessment?.projectId,
                    assessmentDate: assessment?.assessmentDate,
                    discussionConclusions:
                      assessment?.discussionConclusions || "",
                    reportApprovedBy: null,
                    reportIssueDate: null,
                  });
                  showSnackbar(
                    "Discussion/conclusions saved successfully",
                    "success",
                  );
                  setDiscussionLastSaved(new Date());
                  setDiscussionModalOpen(false);
                } catch (error) {
                  console.error("Error saving discussion/conclusions:", error);
                  showSnackbar(
                    "Failed to save discussion/conclusions",
                    "error",
                  );
                } finally {
                  setSavingDiscussion(false);
                }
              }}
              variant="contained"
              disabled={savingDiscussion}
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: "#7b1fa2",
                "&:hover": {
                  backgroundColor: "#6a1b9a",
                },
              }}
            >
              {savingDiscussion ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Save Discussion"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* No assessment items and no scope – cannot complete dialog */}
        <Dialog
          open={noItemsAndScopeDialogOpen}
          onClose={() => setNoItemsAndScopeDialogOpen(false)}
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
              <WarningIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Assessment items and scope required
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              At least one assessment item and at least one Scope of Assessment
              item are required before marking site works as completed.
              <br></br>
              <br></br>
              Please add assessment items and add scope via the Scope of
              Assessment button.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, border: "none" }}>
            <Button
              onClick={() => setNoItemsAndScopeDialogOpen(false)}
              variant="contained"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* No assessment items – cannot complete dialog */}
        <Dialog
          open={noItemsDialogOpen}
          onClose={() => setNoItemsDialogOpen(false)}
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
              <WarningIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Assessment items required
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              At least one assessment item is required before marking site works
              as completed. Please add assessment items first.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, border: "none" }}>
            <Button
              onClick={() => setNoItemsDialogOpen(false)}
              variant="contained"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* No scope of assessment – cannot complete dialog */}
        <Dialog
          open={noScopeDialogOpen}
          onClose={() => setNoScopeDialogOpen(false)}
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
              <WarningIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Scope of assessment required
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              At least one Scope of Assessment item is required before marking
              site works as completed. Please add scope via the Scope of
              Assessment button.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, border: "none" }}>
            <Button
              onClick={() => setNoScopeDialogOpen(false)}
              variant="contained"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              OK
            </Button>
          </DialogActions>
        </Dialog>

        {/* Complete Assessment Confirmation Dialog */}
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
              Site Works Completed
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              Are you sure you want to mark site works as completed? The
              assessment status will be set to Site Works Complete.
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
              onClick={confirmCompleteAssessment}
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
              Site Works Completed
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
                included in the assessment report.
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
              <IconButton onClick={() => setSitePlanDrawingDialogOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ p: 2, height: "100%" }}>
            <SitePlanDrawing
              onSave={handleSitePlanSave}
              onCancel={() => setSitePlanDrawingDialogOpen(false)}
              existingSitePlan={assessment?.sitePlanFile}
              existingLegend={assessment?.sitePlanLegend}
              existingLegendTitle={assessment?.sitePlanLegendTitle}
              existingFigureTitle={assessment?.sitePlanFigureTitle}
            />
          </DialogContent>
        </Dialog>

        {/* Samples Submitted to Lab Confirmation Dialog */}
        <Dialog
          open={showSamplesSubmittedDialog}
          onClose={() => setShowSamplesSubmittedDialog(false)}
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
              <CheckIcon sx={{ fontSize: 20 }} />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Confirm Samples Submitted to Lab & Turnaround Time
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ mb: 3, color: "text.primary" }}>
              Please confirm that the samples have been physically delivered to
              the laboratory and when analysis is due.
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Signature
              </Typography>
              <TextField
                fullWidth
                value={submittedBySignature}
                variant="outlined"
                disabled
                helperText="This will be automatically signed with your name"
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Turnaround
              </Typography>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <Button
                  variant={
                    turnaroundTime === "3 day" ? "contained" : "outlined"
                  }
                  onClick={() => {
                    const now = new Date();
                    const dueDate = addBusinessDays(now, 3);
                    setTurnaroundTime("3 day");
                    setAnalysisDueDate(dueDate);
                    setShowCustomTurnaround(false);
                  }}
                  sx={{
                    minWidth: 100,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 500,
                    backgroundColor:
                      turnaroundTime === "3 day" ? "#1976d2" : "transparent",
                    color: turnaroundTime === "3 day" ? "white" : "#1976d2",
                    borderColor: "#1976d2",
                    "&:hover": {
                      backgroundColor:
                        turnaroundTime === "3 day"
                          ? "#1565c0"
                          : "rgba(25, 118, 210, 0.04)",
                    },
                  }}
                >
                  3 day
                </Button>
                <Button
                  variant={
                    turnaroundTime === "24 hours" ? "contained" : "outlined"
                  }
                  onClick={() => {
                    const now = new Date();
                    const dueDate = addBusinessDays(now, 1);
                    setTurnaroundTime("24 hours");
                    setAnalysisDueDate(dueDate);
                    setShowCustomTurnaround(false);
                  }}
                  sx={{
                    minWidth: 100,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 500,
                    backgroundColor:
                      turnaroundTime === "24 hours" ? "#1976d2" : "transparent",
                    color: turnaroundTime === "24 hours" ? "white" : "#1976d2",
                    borderColor: "#1976d2",
                    "&:hover": {
                      backgroundColor:
                        turnaroundTime === "24 hours"
                          ? "#1565c0"
                          : "rgba(25, 118, 210, 0.04)",
                    },
                  }}
                >
                  24 hours
                </Button>
                <Button
                  variant={showCustomTurnaround ? "contained" : "outlined"}
                  onClick={() => {
                    setShowCustomTurnaround(true);
                    setTurnaroundTime("");
                    // Set to current date/time when custom is selected
                    setAnalysisDueDate(new Date());
                  }}
                  sx={{
                    minWidth: 100,
                    borderRadius: 2,
                    textTransform: "none",
                    fontWeight: 500,
                    backgroundColor: showCustomTurnaround
                      ? "#1976d2"
                      : "transparent",
                    color: showCustomTurnaround ? "white" : "#1976d2",
                    borderColor: "#1976d2",
                    "&:hover": {
                      backgroundColor: showCustomTurnaround
                        ? "#1565c0"
                        : "rgba(25, 118, 210, 0.04)",
                    },
                  }}
                >
                  Custom
                </Button>
              </Box>
              {/* Show calculated due date for preset options */}
              {(turnaroundTime === "3 day" || turnaroundTime === "24 hours") &&
                analysisDueDate && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1, fontStyle: "italic" }}
                  >
                    Analysis due date:{" "}
                    {format(analysisDueDate, "dd/MM/yyyy HH:mm")}
                  </Typography>
                )}
              {showCustomTurnaround && (
                <Box sx={{ mt: 2 }}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Analysis Due Date & Time"
                      value={analysisDueDate}
                      onChange={(newValue) => setAnalysisDueDate(newValue)}
                      slots={{ textField: TextField }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          inputProps: {
                            format: "dd/MM/yyyy HH:mm",
                          },
                        },
                      }}
                      format="dd/MM/yyyy HH:mm"
                    />
                  </LocalizationProvider>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => setShowSamplesSubmittedDialog(false)}
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
              onClick={handleConfirmSamplesSubmitted}
              variant="contained"
              color="primary"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Confirm Submission
            </Button>
          </DialogActions>
        </Dialog>

        {/* Finalise Assessment (No Samples) Confirmation Dialog */}
        <Dialog
          open={showFinaliseAssessmentDialog}
          onClose={() =>
            !finalisingAssessment && setShowFinaliseAssessmentDialog(false)
          }
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle sx={{ pb: 2, px: 3, pt: 3 }}>
            Finalise Assessment
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 0, pb: 1 }}>
            <Typography variant="body1" color="text.primary">
              No samples were collected during this assessment. Confirm that you
              wish to finalise and mark the assessment as ready for review?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2 }}>
            <Button
              onClick={() => setShowFinaliseAssessmentDialog(false)}
              variant="outlined"
              disabled={finalisingAssessment}
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
              onClick={handleConfirmFinaliseAssessment}
              variant="contained"
              color="primary"
              disabled={finalisingAssessment}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              {finalisingAssessment ? "Finalising…" : "Confirm"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default AssessmentItems;
