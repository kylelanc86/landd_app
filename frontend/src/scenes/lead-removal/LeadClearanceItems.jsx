import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
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
  CircularProgress,
  Chip,
  Link,
  Alert,
  Checkbox,
  FormControlLabel,
  Autocomplete,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
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
  Map as MapIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  RotateRight as RotateRightIcon,
  Hd as HdIcon,
  Download as DownloadIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import leadClearanceService from "../../services/leadClearanceService";
import {
  compressImage,
  needsCompression,
  saveFileToDevice,
} from "../../utils/imageCompression";
import { rotateDataUrl90Cw } from "../../utils/rotateImageDataUrl";
import { formatDate } from "../../utils/dateUtils";
import leadRemovalJobService from "../../services/leadRemovalJobService";
import PermissionGate from "../../components/PermissionGate";
import { usePermissions } from "../../hooks/usePermissions";
import SitePlanDrawing from "../../components/SitePlanDrawing";

const WORKS_COMPLETED_OPTIONS = ["All surfaces HEPA vacuumed and wet-wiped", "Flaking lead paint removed, and surfaces overpainted"];
const LEAD_VALIDATION_TYPES = [
  "Visual inspection",
  "Visual inspection and validation sampling",
];

const LeadClearanceItems = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { clearanceId } = useParams();
  const { showSnackbar } = useSnackbar();
  const { isSuperAdmin } = usePermissions();
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobileLandscape = useMediaQuery(
    "(orientation: landscape) and (max-width: 950px)",
  );

  const [items, setItems] = useState([]);
  const [clearance, setClearance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leadRemovalJobId, setLeadRemovalJobId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showLevelFloor, setShowLevelFloor] = useState(false);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [jobExclusionsModalOpen, setJobExclusionsModalOpen] = useState(false);
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [removingSitePlan, setRemovingSitePlan] = useState(false);
  const [photoGalleryDialogOpen, setPhotoGalleryDialogOpen] = useState(false);
  const [selectedItemForPhotos, setSelectedItemForPhotos] = useState(null);
  const [localPhotoChanges, setLocalPhotoChanges] = useState({});
  const [photosToDelete, setPhotosToDelete] = useState(new Set());
  const [localPhotoDescriptions, setLocalPhotoDescriptions] = useState({});
  const [editingDescriptionPhotoId, setEditingDescriptionPhotoId] = useState(null);
  const [fullSizePhotoDialogOpen, setFullSizePhotoDialogOpen] = useState(false);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState(null);
  const [fullSizePhotoId, setFullSizePhotoId] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [videoRef, setVideoRef] = useState(null);
  const [rotatingPhotoId, setRotatingPhotoId] = useState(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [leadMonitoringReportsDialogOpen, setLeadMonitoringReportsDialogOpen] =
    useState(false);
  const [leadMonitoringReports, setLeadMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReports, setSelectedReports] = useState([]);
  const [generatingLeadMonitoringPDF, setGeneratingLeadMonitoringPDF] =
    useState(false);

  const formatStatus = (status) => {
    if (!status) return "Unknown";
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const [preWorksSamples, setPreWorksSamples] = useState([]);
  const [validationSamples, setValidationSamples] = useState([]);
  const [form, setForm] = useState({
    locationDescription: "",
    levelFloor: "",
    roomArea: "",
    worksCompleted: WORKS_COMPLETED_OPTIONS[0],
    leadValidationType: "",
    samples: [],
    notes: "",
  });

  const fetchData = async () => {
    if (!clearanceId) {
      setError("Clearance ID is missing from URL");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [itemsData, clearanceData, samplingData] = await Promise.all([
        leadClearanceService.getItems(clearanceId),
        leadClearanceService.getById(clearanceId),
        leadClearanceService.getSampling(clearanceId).catch(() => ({ preWorksSamples: [], validationSamples: [] })),
      ]);

      setItems(itemsData || []);
      setClearance(clearanceData);
      setPreWorksSamples(Array.isArray(samplingData?.preWorksSamples) ? samplingData.preWorksSamples : []);
      setValidationSamples(Array.isArray(samplingData?.validationSamples) ? samplingData.validationSamples : []);
      setJobCompleted(clearanceData?.status === "complete");

      if (clearanceData?.leadRemovalJobId) {
        const jobId =
          clearanceData.leadRemovalJobId._id || clearanceData.leadRemovalJobId;
        setLeadRemovalJobId(jobId);
      } else if (clearanceData?.projectId) {
        try {
          const jobsResponse = await leadRemovalJobService.getAll();
          const projectId =
            clearanceData.projectId._id || clearanceData.projectId;
          const jobsArray = jobsResponse.jobs || jobsResponse.data || [];
          const matchingJob = jobsArray.find((job) => {
            const jobProjectId = job.projectId?._id || job.projectId;
            return jobProjectId === projectId;
          });
          if (matchingJob) setLeadRemovalJobId(matchingJob._id);
        } catch (jobErr) {
          console.error("Error fetching lead removal job:", jobErr);
        }
      }
    } catch (err) {
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clearanceId]);

  const canCompleteClearance = useMemo(() => {
    if (!items?.length) return false;

    const hasLeadContent = (sample) => {
      const v = sample?.leadContent;
      if (v == null || v === "") return false;
      if (v === "NaN" || (typeof v === "number" && Number.isNaN(v)))
        return false;
      return true;
    };

    const itemIds = new Set((items || []).map((i) => i._id));
    const preWorksSampleRefsOrIds = new Set();
    (items || []).forEach((item) => {
      (item.samples || []).forEach((s) => preWorksSampleRefsOrIds.add(s));
    });

    for (const s of preWorksSamples || []) {
      if (!hasLeadContent(s)) return false;
      const refOrId = s.sampleRef || s.id || s._id;
      if (!refOrId || !preWorksSampleRefsOrIds.has(refOrId)) return false;
    }
    for (const s of validationSamples || []) {
      if (!hasLeadContent(s)) return false;
      const itemId = s.linkedClearanceItemId?._id || s.linkedClearanceItemId;
      if (!itemId || !itemIds.has(itemId)) return false;
    }

    const validationTypeNeedingSampling = "Visual inspection and validation sampling";
    for (const item of items || []) {
      if (item.leadValidationType !== validationTypeNeedingSampling) continue;
      const hasLinkedValidation = (validationSamples || []).some(
        (s) => (s.linkedClearanceItemId?._id || s.linkedClearanceItemId) === item._id,
      );
      if (!hasLinkedValidation) return false;
    }

    return true;
  }, [items, preWorksSamples, validationSamples]);

  const resetForm = () => {
    setForm({
      locationDescription: "",
      levelFloor: "",
      roomArea: "",
      worksCompleted: WORKS_COMPLETED_OPTIONS[0],
      leadValidationType: "",
      samples: [],
      notes: "",
    });
    setShowLevelFloor(false);
  };

  const handleNotesBlur = async () => {
    if (!clearanceId || savingNotes) return;
    try {
      setSavingNotes(true);
      await leadClearanceService.update(clearanceId, {
        notes: clearance?.notes || "",
      });
    } catch (error) {
      console.error("Error saving notes:", error);
      showSnackbar("Failed to save notes", "error");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.roomArea.trim()) {
      showSnackbar("Room/Area is required", "error");
      return;
    }
    if (!form.locationDescription.trim()) {
      showSnackbar("Location Description is required", "error");
      return;
    }
    if (!form.worksCompleted.trim()) {
      showSnackbar("Works Completed is required", "error");
      return;
    }

    try {
      const itemData = {
        locationDescription: form.locationDescription,
        levelFloor: showLevelFloor ? form.levelFloor : "",
        roomArea: form.roomArea,
        worksCompleted: form.worksCompleted,
        leadValidationType: form.leadValidationType,
        samples: Array.isArray(form.samples) ? form.samples : [],
        notes: form.notes,
      };

      if (editingItem) {
        await leadClearanceService.updateItem(
          clearanceId,
          editingItem._id,
          itemData,
        );
        showSnackbar("Item updated successfully", "success");
      } else {
        await leadClearanceService.addItem(clearanceId, itemData);
        showSnackbar("Item created successfully. Add photos below.", "success");
      }

      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      await fetchData();

      if (!editingItem) {
        const updatedItems = await leadClearanceService.getItems(clearanceId);
        const createdItem = updatedItems.find(
          (item) =>
            item.locationDescription === itemData.locationDescription &&
            item.roomArea === itemData.roomArea &&
            item.worksCompleted === itemData.worksCompleted,
        );
        if (createdItem) {
          setSelectedItemForPhotos(createdItem);
          setPhotoGalleryDialogOpen(true);
        }
      }
    } catch (err) {
      showSnackbar("Failed to save item", "error");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      locationDescription: item.locationDescription || "",
      levelFloor: item.levelFloor || "",
      roomArea: item.roomArea || "",
      worksCompleted: item.worksCompleted || "",
      leadValidationType: item.leadValidationType || "",
      samples: Array.isArray(item.samples) ? item.samples : [],
      notes: item.notes || "",
    });
    setShowLevelFloor(!!item.levelFloor);
    setDialogOpen(true);
  };

  const handleDelete = (item) => {
    setItemToDelete(item);
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await leadClearanceService.deleteItem(clearanceId, itemToDelete._id);
      showSnackbar("Item deleted successfully", "success");
      await fetchData();
    } catch (err) {
      showSnackbar("Failed to delete item", "error");
    } finally {
      setDeleteConfirmDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleCompleteJob = () => setCompleteDialogOpen(true);
  const handleReopenJob = () => setReopenDialogOpen(true);

  const confirmCompleteJob = async () => {
    try {
      await leadClearanceService.update(clearanceId, { status: "complete" });
      setJobCompleted(true);
      showSnackbar("Clearance completed successfully!", "success");
      await fetchData();
      if (leadRemovalJobId) {
        navigate(`/lead-removal/jobs/${leadRemovalJobId}/details`);
      }
    } catch (err) {
      showSnackbar("Failed to complete clearance", "error");
    } finally {
      setCompleteDialogOpen(false);
    }
  };

  const confirmReopenJob = async () => {
    try {
      await leadClearanceService.update(clearanceId, { status: "in progress" });
      setJobCompleted(false);
      showSnackbar("Clearance reopened successfully!", "success");
      await fetchData();
    } catch (err) {
      showSnackbar("Failed to reopen clearance", "error");
    } finally {
      setReopenDialogOpen(false);
    }
  };

  const handleJobExclusionsSave = async (exclusions) => {
    try {
      await leadClearanceService.update(clearanceId, {
        jobSpecificExclusions: exclusions,
      });
      setClearance((prev) => ({ ...prev, jobSpecificExclusions: exclusions }));
      setJobExclusionsModalOpen(false);
      showSnackbar("Job specific exclusions saved", "success");
    } catch (err) {
      showSnackbar("Failed to save exclusions", "error");
    }
  };

  const handleSitePlanSave = async (sitePlanData) => {
    try {
      const imageData =
        typeof sitePlanData === "string"
          ? sitePlanData
          : sitePlanData?.imageData;
      const legendEntries = Array.isArray(sitePlanData?.legend)
        ? sitePlanData.legend.map((e) => ({
            color: e.color,
            description: e.description,
          }))
        : [];
      const legendTitle =
        sitePlanData?.legendTitle && sitePlanData.legendTitle.trim()
          ? sitePlanData.legendTitle.trim()
          : "Key";
      const figureTitle =
        sitePlanData?.figureTitle && sitePlanData.figureTitle.trim()
          ? sitePlanData.figureTitle.trim()
          : "Lead Clearance Site Plan";

      if (!imageData) {
        showSnackbar("No site plan image data was provided", "error");
        return;
      }

      const sitePlanPayload = {
        sitePlan: true,
        sitePlanFile: imageData,
        sitePlanLegend: legendEntries,
        sitePlanLegendTitle: legendTitle,
        sitePlanFigureTitle: figureTitle,
        sitePlanSource: "drawn",
      };

      await leadClearanceService.update(clearanceId, sitePlanPayload);
      setClearance((prev) => ({ ...prev, ...sitePlanPayload }));
      showSnackbar("Site plan saved successfully!", "success");
      setSitePlanDialogOpen(false);
    } catch (err) {
      showSnackbar("Failed to save site plan", "error");
    }
  };

  const handleRemoveSitePlan = async () => {
    if (!window.confirm("Are you sure you want to remove the site plan?")) return;
    try {
      setRemovingSitePlan(true);
      await leadClearanceService.update(clearanceId, {
        sitePlan: false,
        sitePlanFile: null,
        sitePlanSource: null,
        sitePlanLegend: [],
        sitePlanLegendTitle: null,
        sitePlanFigureTitle: null,
      });
      setClearance((prev) => ({
        ...prev,
        sitePlan: false,
        sitePlanFile: null,
        sitePlanSource: null,
        sitePlanLegend: [],
        sitePlanLegendTitle: null,
        sitePlanFigureTitle: null,
      }));
      showSnackbar("Site plan removed successfully", "success");
    } catch (err) {
      showSnackbar("Failed to remove site plan", "error");
    } finally {
      setRemovingSitePlan(false);
    }
  };

  const fetchLeadMonitoringReports = async () => {
    if (!clearance?.projectId?._id) {
      showSnackbar("No project found for this clearance", "error");
      return;
    }

    if (!leadRemovalJobId) {
      showSnackbar(
        "Unable to identify lead removal job for this clearance. Please ensure the clearance is properly linked to a lead removal job.",
        "error",
      );
      return;
    }

    try {
      setLoadingReports(true);
      const reports =
        await leadClearanceService.getLeadMonitoringReportsByJob(
          leadRemovalJobId,
        );
      setLeadMonitoringReports(reports);
    } catch (error) {
      console.error("Error fetching lead monitoring reports:", error);
      showSnackbar("Failed to fetch lead monitoring reports", "error");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleOpenLeadMonitoringReportsDialog = () => {
    setLeadMonitoringReportsDialogOpen(true);
    fetchLeadMonitoringReports();
  };

  const handleSelectLeadMonitoringReport = async (reportsToAttach) => {
    const list = Array.isArray(reportsToAttach)
      ? reportsToAttach
      : [reportsToAttach];
    if (list.length === 0) return;

    try {
      setGeneratingLeadMonitoringPDF(true);

      const { generateLeadMonitoringShiftReport } = await import(
        "../../utils/generateLeadMonitoringShiftReport"
      );
      const { shiftService, projectService, clientService, leadAirSampleService } =
        await import("../../services/api");

      const reportsPayload = [];
      for (const report of list) {
        const shiftResponse = await shiftService.getById(report._id);
        const shift = shiftResponse.data;
        const jobResponse = await leadRemovalJobService.getById(report.jobId);
        const job = jobResponse.data;
        const samplesResponse = await leadAirSampleService.getByShift(
          report._id,
        );
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

        const pdfDataUrl = await generateLeadMonitoringShiftReport({
          shift,
          job,
          samples,
          project: project || {},
          returnPdfData: true,
          openInNewTab: false,
        });
        const base64Data = pdfDataUrl.split(",")[1];
        reportsPayload.push({
          reportData: base64Data,
          shiftDate: shift.date,
          shiftId: shift._id,
        });
      }

      await leadClearanceService.uploadLeadMonitoringReport(clearanceId, {
        reports: reportsPayload,
        leadMonitoring: true,
      });

      showSnackbar(
        list.length === 1
          ? "Lead monitoring report attached successfully"
          : `${list.length} lead monitoring reports attached successfully`,
        "success",
      );

      setLeadMonitoringReportsDialogOpen(false);
      setSelectedReports([]);
      fetchData();
    } catch (error) {
      console.error("Error selecting lead monitoring report(s):", error);
      showSnackbar("Failed to attach lead monitoring report(s)", "error");
    } finally {
      setGeneratingLeadMonitoringPDF(false);
    }
  };

  const handleRemoveLeadMonitoringReport = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove the lead monitoring report?",
      )
    ) {
      return;
    }

    try {
      await leadClearanceService.update(clearanceId, {
        leadMonitoringReports: [],
        leadMonitoring: false,
      });
      showSnackbar("Lead monitoring report removed successfully", "success");
      fetchData();
    } catch (error) {
      console.error("Error removing lead monitoring report:", error);
      showSnackbar("Failed to remove lead monitoring report", "error");
    }
  };

  const handleAddPhotoToItem = async (photoData) => {
    if (!selectedItemForPhotos) return;
    try {
      await leadClearanceService.addPhotoToItem(
        clearanceId,
        selectedItemForPhotos._id,
        photoData,
        true,
      );
      const updatedItems = await leadClearanceService.getItems(clearanceId);
      const updatedItem = updatedItems.find(
        (i) => i._id === selectedItemForPhotos._id,
      );
      if (updatedItem) setSelectedItemForPhotos(updatedItem);
      setPhotoFile(null);
      setCompressionStatus(null);
      showSnackbar("Photo added successfully", "success");
    } catch (err) {
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

  const handleViewFullSizePhoto = (photo) => {
    const url = typeof photo === "string" ? photo : photo?.data;
    if (!url) return;
    setFullSizePhotoUrl(url);
    setFullSizePhotoId(typeof photo === "object" && photo?._id ? photo._id : null);
    setFullSizePhotoDialogOpen(true);
  };

  const handleDownloadPhoto = async (
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
      const filename = `lead-clearance-${fallbackLabel}-${quality}-${timestamp}.${extension}`;
      const response = await fetch(photoData);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: mimeType });
      await saveFileToDevice(file, filename);
      showSnackbar("Photo downloaded", "success");
    } catch (error) {
      console.error("Error downloading photo:", error);
      showSnackbar("Failed to download photo", "error");
    }
  };

  const fullSizePhoto =
    fullSizePhotoId && selectedItemForPhotos?.photographs
      ? selectedItemForPhotos.photographs.find((p) => p._id === fullSizePhotoId)
      : null;

  const handleRotatePhoto90Cw = async (photo) => {
    if (!photo?.data || rotatingPhotoId || !clearanceId || !selectedItemForPhotos) return;
    setRotatingPhotoId(photo._id);
    try {
      const newData = await rotateDataUrl90Cw(photo.data, 0.92);
      const payload = await leadClearanceService.updatePhotoContent(
        clearanceId,
        selectedItemForPhotos._id,
        photo._id,
        { photoData: newData },
      );
      if (payload?.item) setSelectedItemForPhotos(payload.item);
      if (fullSizePhotoId === photo._id) {
        const updated = payload.item?.photographs?.find(
          (p) => String(p._id) === String(photo._id),
        );
        if (updated?.data) setFullSizePhotoUrl(updated.data);
      }
      showSnackbar("Photo rotated", "success");
    } catch (err) {
      console.error("Error rotating photo:", err);
      showSnackbar("Failed to rotate photo", "error");
    } finally {
      setRotatingPhotoId(null);
    }
  };

  const getCurrentPhotoState = (photoId) => {
    const localChange = localPhotoChanges[photoId];
    if (localChange !== undefined) return localChange;
    const photo = selectedItemForPhotos?.photographs?.find((p) => p._id === photoId);
    return photo?.includeInReport ?? true;
  };

  const generateDefaultPhotoDescription = (item) => {
    const raw = item.locationDescription || "unknown location";
    const locationDescription = raw.charAt(0).toLowerCase() + raw.slice(1);
    const roomArea = item.roomArea || "unknown room/area";
    return `Photograph following lead abatement works to ${locationDescription} in ${roomArea}`;
  };

  const getCurrentPhotoDescription = (photoId, item) => {
    if (localPhotoDescriptions[photoId] !== undefined) return localPhotoDescriptions[photoId];
    const photo = selectedItemForPhotos?.photographs?.find((p) => p._id === photoId);
    if (photo?.description) return photo.description;
    return generateDefaultPhotoDescription(item);
  };

  const handleDescriptionChange = (photoId, newDescription) => {
    setLocalPhotoDescriptions((prev) => ({ ...prev, [photoId]: newDescription }));
  };

  const hasUnsavedChanges = () =>
    Object.keys(localPhotoChanges).length > 0 ||
    photosToDelete.size > 0 ||
    Object.keys(localPhotoDescriptions).length > 0;

  const isPhotoMarkedForDeletion = (photoId) => photosToDelete.has(photoId);

  const savePhotoChanges = async () => {
    if (!selectedItemForPhotos) return;
    try {
      const togglePromises = [];
      const descriptionPromises = [];
      Object.entries(localPhotoChanges).forEach(([photoId, includeInReport]) => {
        const photo = selectedItemForPhotos?.photographs?.find((p) => p._id === photoId);
        if (photo && photo.includeInReport !== includeInReport) {
          togglePromises.push(
            leadClearanceService.togglePhotoInReport(
              clearanceId,
              selectedItemForPhotos._id,
              photoId,
            ),
          );
        }
      });
      Object.entries(localPhotoDescriptions).forEach(([photoId, description]) => {
        descriptionPromises.push(
          leadClearanceService.updatePhotoDescription(
            clearanceId,
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
          await leadClearanceService.deletePhotoFromItem(
            clearanceId,
            selectedItemForPhotos._id,
            photoId,
          );
        } catch (err) {
          console.error("Error deleting photo:", err);
        }
      }
      showSnackbar("Photo changes saved successfully", "success");
      setLocalPhotoChanges({});
      setPhotosToDelete(new Set());
      setLocalPhotoDescriptions({});
      await fetchData();
      const updatedItems = await leadClearanceService.getItems(clearanceId);
      const updatedItem = updatedItems.find((i) => i._id === selectedItemForPhotos._id);
      if (updatedItem) setSelectedItemForPhotos(updatedItem);
    } catch (err) {
      showSnackbar("Failed to save photo changes", "error");
    }
  };

  const handlePhotoUploadForGallery = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setCompressionStatus({ type: "processing", message: "Processing image..." });
    try {
      if (needsCompression(file, 300)) {
        const compressed = await compressImage(file, {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: 0.75,
          maxSizeKB: 300,
        });
        await handleAddPhotoToItem(compressed);
        setCompressionStatus({ type: "success", message: "Image added." });
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          await handleAddPhotoToItem(e.target.result);
          setCompressionStatus({ type: "info", message: "Image added." });
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      setCompressionStatus({ type: "error", message: "Failed to process image" });
    }
  };

  const handleOpenPhotoGallery = (item) => {
    setSelectedItemForPhotos(item);
    setPhotoGalleryDialogOpen(true);
  };

  const handleClosePhotoGallery = async () => {
    setPhotoGalleryDialogOpen(false);
    setSelectedItemForPhotos(null);
    setRotatingPhotoId(null);
    setPhotoFile(null);
    setCompressionStatus(null);
    setLocalPhotoChanges({});
    setPhotosToDelete(new Set());
    setLocalPhotoDescriptions({});
    setEditingDescriptionPhotoId(null);
    await fetchData();
  };

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

  const handleTakePhoto = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.capture = "environment";
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        if (file) handlePhotoUploadForGallery({ target: { files: [file] } });
      };
      input.click();
      return;
    }
    try {
      document.documentElement.requestFullscreen?.().catch(() => {});
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
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
      setCameraDialogOpen(true);
    } catch (error) {
      let msg = "Failed to access camera. Please check permissions or use upload instead.";
      if (error.name === "NotAllowedError") msg = "Camera access denied. Please allow camera permissions and try again.";
      else if (error.name === "NotFoundError") msg = "No camera found. Please use upload instead.";
      showSnackbar(msg, "error");
    }
  };

  const handleCloseCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraDialogOpen(false);
    setPhotoGalleryDialogOpen(true);
    document.exitFullscreen?.().catch(() => {});
  };

  const handleCapturePhoto = async () => {
    if (!videoRef?.videoWidth) {
      handleCloseCamera();
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
          const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
          handlePhotoUploadForGallery({ target: { files: [file] } });
        }
        handleCloseCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const hasLevelFloor =
    items?.length > 0 &&
    items.some((i) => i.levelFloor && i.levelFloor.trim() !== "");

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
        <Box sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() =>
              navigate(
                leadRemovalJobId
                  ? `/lead-removal/jobs/${leadRemovalJobId}/details`
                  : "/lead-removal",
              )
            }
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            {leadRemovalJobId ? "Job Details" : "Lead Removal Jobs"}
          </Link>
        </Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Lead Clearance Items
        </Typography>

        <Typography variant="h6" sx={{ mb: 2, color: "text.secondary" }}>
          {clearance?.projectId?.name || "Unknown Project"}:{" "}
          {clearance?.clearanceDate
            ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
              })
            : "Unknown Date"}
        </Typography>
        
          <Typography variant="body1" fontStyle="italic" gutterBottom>
            <Box component="span" fontWeight="bold">Description:</Box> {clearance.descriptionOfWorks}
          </Typography>
      

        <Box
          display="flex"
          justifyContent="space-between"
          sx={{ mt: 2, mb: 2 }}
          flexWrap="wrap"
          gap={2}
        >
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <Button
              variant="outlined"
              color="primary"
              onClick={handleOpenLeadMonitoringReportsDialog}
              startIcon={<AssessmentIcon />}
            >
              Lead Monitoring Report
            </Button>
            {(clearance?.leadMonitoringReports?.length > 0) && (
              <Box display="flex" alignItems="center" gap={2}>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoveLeadMonitoringReport}
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
                  ✓ Lead Monitoring Report
                  {(clearance.leadMonitoringReports?.length ?? 0) > 1 ? "s" : ""}{" "}
                  Attached
                  <Box component="span" sx={{ ml: 1 }}>
                    (
                    {clearance.leadMonitoringReports
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.shiftDate || 0) - new Date(b.shiftDate || 0),
                      )
                      .map((r) => formatDate(r.shiftDate))
                      .join(", ")}
                    )
                  </Box>
                </Typography>
              </Box>
            )}
            {!(clearance?.leadMonitoringReports?.length > 0) && (
              <Typography
                variant="body2"
                color="warning.main"
                sx={{ fontWeight: "medium" }}
              >
                ⚠ No Lead Monitoring Report Attached
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            color={jobCompleted ? "error" : "primary"}
            onClick={jobCompleted ? handleReopenJob : handleCompleteJob}
            disabled={
              !items ||
              items.length === 0 ||
              (!jobCompleted && !canCompleteClearance)
            }
          >
            {jobCompleted ? "REOPEN CLEARANCE" : "COMPLETE CLEARANCE"}
          </Button>
        </Box>

        <Box
          display="flex"
          gap={2}
          sx={{ mt: 2, mb: 2 }}
          flexWrap="wrap"
          alignItems="center"
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setSitePlanDialogOpen(true)}
            startIcon={<MapIcon />}
          >
            {clearance?.sitePlanFile ? "Edit Site Plan" : "Site Plan"}
          </Button>
          {clearance?.sitePlanFile && (
            <Button
              variant="outlined"
              color="error"
              onClick={handleRemoveSitePlan}
              disabled={removingSitePlan}
              startIcon={
                removingSitePlan ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <DeleteIcon />
                )
              }
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

        <Box display="flex" gap={2} sx={{ mt: 2, mb: 2 }} flexWrap="wrap">
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
              backgroundColor: "#9c27b0",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Job Specific Exclusions
          </Button>
          {isSuperAdmin && (
            <Button
              variant="contained"
              sx={{
                backgroundColor: "#FF8B00",
                "&:hover": { backgroundColor: "#CD7000" },
              }}
              onClick={() =>
                navigate(`/lead-clearances/${clearanceId}/sampling`)
              }
            >
              Dust/Soil Sampling
            </Button>
          )}
        </Box>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      background: "linear-gradient(to right, #045E1F, #96CC78)",
                      color: "white",
                    }}
                  >
                    {hasLevelFloor && (
                      <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                        Level/Floor
                      </TableCell>
                    )}
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Room/Area
                    </TableCell>
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Location Description
                    </TableCell>
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Works Completed
                    </TableCell>
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Samples
                    </TableCell>
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Photograph
                    </TableCell>
                    <TableCell sx={{ color: "inherit", fontWeight: "bold" }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!items || items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={hasLevelFloor ? 7 : 6}
                        align="center"
                        sx={{
                          py: 4,
                          color: "text.secondary",
                          fontStyle: "italic",
                        }}
                      >
                        No clearance items added for report
                      </TableCell>
                    </TableRow>
                  ) : (
                    (items || []).map((item) => {
                      const photoCount = item.photographs?.length || 0;
                      const selectedCount =
                        item.photographs?.filter((p) => p.includeInReport)
                          .length || 0;
                      return (
                        <TableRow key={item._id}>
                          {hasLevelFloor && (
                            <TableCell>
                              {item.levelFloor || (
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
                          <TableCell>{item.roomArea || "—"}</TableCell>
                          <TableCell>
                            {item.locationDescription || "—"}
                          </TableCell>
                          <TableCell>{item.worksCompleted || "—"}</TableCell>
                          <TableCell>
                            {item.leadValidationType === "Visual inspection" ? (
                              "N/A"
                            ) : item.samples && item.samples.length > 0 ? (
                              <Box>
                                <Typography variant="body2">
                                  {(item.samples || []).join(", ")}
                                </Typography>
                                <Link
                                  component="button"
                                  variant="body2"
                                  onClick={() =>
                                    navigate(
                                      `/lead-clearances/${clearanceId}/sampling`,
                                    )
                                  }
                                >
                                  Manage samples
                                </Link>
                              </Box>
                            ) : (
                              <Link
                                component="button"
                                variant="body2"
                                onClick={() =>
                                  navigate(
                                    `/lead-clearances/${clearanceId}/sampling`,
                                  )
                                }
                              >
                                Add samples
                              </Link>
                            )}
                          </TableCell>
                          <TableCell>
                            {photoCount > 0 ? (
                              <Box>
                                <Chip
                                  label={`${photoCount} photo${photoCount !== 1 ? "s" : ""}`}
                                  color="success"
                                  size="small"
                                />
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                >
                                  {selectedCount} in report
                                </Typography>
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
                            <Box display="flex" gap={0.5}>
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
                                  title="Delete"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </PermissionGate>
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

        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Notes"
            value={clearance?.notes || ""}
            onChange={(e) =>
              setClearance((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            onBlur={handleNotesBlur}
            multiline
            rows={3}
            disabled={savingNotes}
            placeholder="Optional notes"
          />
        </Box>

        {/* Add/Edit Item Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        >
          <DialogTitle>
            {editingItem ? "Edit Item" : "Add New Item"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                {preWorksSamples.length > 0 && (
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      options={preWorksSamples}
                      getOptionLabel={(opt) =>
                        opt.sampleRef || `Sample ${opt.id || ""}`.trim()
                      }
                      value={preWorksSamples.filter((s) =>
                        form.samples.includes(s.sampleRef || s.id),
                      )}
                      onChange={(_, newValue) =>
                        setForm({
                          ...form,
                          samples: (newValue || []).map(
                            (s) => s.sampleRef || s.id,
                          ),
                        })
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Pre-works samples"
                          placeholder="Select one or more samples"
                        />
                      )}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
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
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Level/Floor"
                      value={form.levelFloor}
                      onChange={(e) =>
                        setForm({ ...form, levelFloor: e.target.value })
                      }
                      placeholder="e.g., Ground Floor, Level 1"
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Room/Area"
                    value={form.roomArea}
                    onChange={(e) =>
                      setForm({ ...form, roomArea: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Location Description"
                    value={form.locationDescription}
                    onChange={(e) =>
                      setForm({ ...form, locationDescription: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    freeSolo
                    options={WORKS_COMPLETED_OPTIONS}
                    value={form.worksCompleted}
                    onInputChange={(_, value) =>
                      setForm({ ...form, worksCompleted: value ?? "" })
                    }
                    onChange={(_, value) =>
                      setForm({
                        ...form,
                        worksCompleted:
                          typeof value === "string" ? value : (value ?? ""),
                      })
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Works Completed" required />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">
                      Lead Validation Type
                    </FormLabel>
                    <RadioGroup
                      row
                      value={form.leadValidationType}
                      onChange={(e) =>
                        setForm({ ...form, leadValidationType: e.target.value })
                      }
                    >
                      {LEAD_VALIDATION_TYPES.map((opt) => (
                        <FormControlLabel
                          key={opt}
                          value={opt}
                          control={<Radio />}
                          label={opt}
                        />
                      ))}
                    </RadioGroup>
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
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                type="submit"
                variant="contained"
                disabled={
                  !form.roomArea.trim() ||
                  !form.locationDescription.trim() ||
                  !form.worksCompleted.trim()
                }
              >
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog
          open={deleteConfirmDialogOpen}
          onClose={() => setDeleteConfirmDialogOpen(false)}
        >
          <DialogTitle>Delete Item?</DialogTitle>
          <DialogContent>
            {itemToDelete && (
              <Typography>
                Delete item: {itemToDelete.worksCompleted}?
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmDelete} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Complete Dialog */}
        <Dialog
          open={completeDialogOpen}
          onClose={() => setCompleteDialogOpen(false)}
        >
          <DialogTitle>Lead Clearance Complete?</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to mark this clearance as complete?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmCompleteJob} variant="contained">
              Complete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reopen Dialog */}
        <Dialog
          open={reopenDialogOpen}
          onClose={() => setReopenDialogOpen(false)}
        >
          <DialogTitle>Reopen Clearance?</DialogTitle>
          <DialogContent>
            <Typography>
              Reopen this clearance to make further changes.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReopenDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmReopenJob}
              color="error"
              variant="contained"
            >
              Reopen
            </Button>
          </DialogActions>
        </Dialog>

        {/* Job Exclusions Modal */}
        <Dialog
          open={jobExclusionsModalOpen}
          onClose={() => setJobExclusionsModalOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Job Specific Exclusions</DialogTitle>
          <DialogContent>
            <JobExclusionsForm
              value={clearance?.jobSpecificExclusions || ""}
              onSave={(exclusions) => {
                handleJobExclusionsSave(exclusions);
                setJobExclusionsModalOpen(false);
              }}
              onCancel={() => setJobExclusionsModalOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Lead Monitoring Reports Selection Dialog */}
        <Dialog
          open={leadMonitoringReportsDialogOpen}
          onClose={() => {
            setLeadMonitoringReportsDialogOpen(false);
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
              Select Lead Monitoring Report(s)
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select one or more lead monitoring reports from the list below.
                They will be included in the clearance PDF in chronological order
                (earliest to most recent).
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
              ) : leadMonitoringReports.length === 0 ? (
                <Alert severity="info">
                  No lead monitoring reports found for this job. Reports must be
                  completed and authorised to appear here.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {leadMonitoringReports.map((report) => {
                    const isSelected = selectedReports.some(
                      (r) => r._id === report._id,
                    );
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
                        }}
                        onClick={() => {
                          if (isAuthorised) {
                            setSelectedReports((prev) =>
                              isSelected
                                ? prev.filter((r) => r._id !== report._id)
                                : [...prev, report],
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
                                  Report requires authorisation before attachment
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
                setLeadMonitoringReportsDialogOpen(false);
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
                const authorised = selectedReports.filter(
                  (r) => r.reportApprovedBy,
                );
                if (authorised.length > 0) {
                  handleSelectLeadMonitoringReport(authorised);
                }
              }}
              variant="contained"
              disabled={
                selectedReports.length === 0 ||
                selectedReports.some((r) => !r.reportApprovedBy) ||
                generatingLeadMonitoringPDF
              }
              startIcon={
                generatingLeadMonitoringPDF ? (
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
              {generatingLeadMonitoringPDF
                ? "Attaching..."
                : selectedReports.length > 1
                  ? `Attach ${selectedReports.length} Reports`
                  : "Attach Report"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Site Plan Dialog */}
        <Dialog
          open={sitePlanDialogOpen}
          onClose={() => setSitePlanDialogOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{ sx: { height: "90vh", maxHeight: "90vh" } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">Site Plan Drawing</Typography>
            <IconButton onClick={() => setSitePlanDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2, height: "100%" }}>
            <SitePlanDrawing
              onSave={handleSitePlanSave}
              onCancel={() => setSitePlanDialogOpen(false)}
              existingSitePlan={clearance?.sitePlanFile}
              existingLegend={clearance?.sitePlanLegend}
              existingLegendTitle={clearance?.sitePlanLegendTitle}
              existingFigureTitle={
                clearance?.sitePlanFigureTitle || "Lead Clearance Site Plan"
              }
            />
          </DialogContent>
        </Dialog>

        {/* Photo Gallery Dialog */}
        <Dialog
          open={photoGalleryDialogOpen}
          onClose={handleClosePhotoGallery}
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
                  <input type="file" hidden accept="image/*" onChange={handlePhotoUploadForGallery} />
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
                {isPortrait && isMobile ? (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 4, px: 2, textAlign: "center" }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                        Please rotate your device to landscape mode
                      </Typography>
                      <Typography variant="body2" component="div">
                        The manage photos form is best viewed in landscape orientation.
                      </Typography>
                    </Alert>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ mb: 3, ...(isMobileLandscape && { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }) }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: isMobileLandscape ? 0 : 1 }}>
                        <strong>Location:</strong> {selectedItemForPhotos.locationDescription}
                      </Typography>
                      {isMobileLandscape && <Typography variant="body2" color="text.secondary"> | </Typography>}
                      <Typography variant="body2" color="text.secondary" sx={{ mb: isMobileLandscape ? 0 : 1 }}>
                        <strong>Room/Area:</strong> {selectedItemForPhotos.roomArea}
                      </Typography>
                      {isMobileLandscape && <Typography variant="body2" color="text.secondary"> | </Typography>}
                      <Typography variant="body2" color="text.secondary">
                        <strong>Works completed:</strong> {selectedItemForPhotos.worksCompleted}
                      </Typography>
                    </Box>

                    {!isMobileLandscape && (
                      <Box sx={{ mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                          Add New Photo
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button variant="outlined" startIcon={<PhotoCameraIcon />} onClick={handleTakePhoto} size="small">
                            Take Photo
                          </Button>
                          <Button variant="outlined" startIcon={<UploadIcon />} component="label" size="small">
                            Upload Photo
                            <input type="file" hidden accept="image/*" onChange={handlePhotoUploadForGallery} />
                          </Button>
                        </Box>
                        {compressionStatus && (
                          <Alert severity={compressionStatus.type === "error" ? "error" : "info"} sx={{ mt: 2 }}>
                            {compressionStatus.message}
                          </Alert>
                        )}
                      </Box>
                    )}

                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                      Photos ({(selectedItemForPhotos.photographs?.length || 0)})
                    </Typography>

                    {!selectedItemForPhotos.photographs?.length ? (
                      <Box sx={{ textAlign: "center", py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No photos yet. Add your first photo above.
                        </Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={2}>
                        {selectedItemForPhotos.photographs.map((photo, index) => (
                          <Grid item xs={12} sm={6} md={4} key={photo._id}>
                            <Card
                              sx={{
                                position: "relative",
                                height: "100%",
                                border: getCurrentPhotoState(photo._id) ? "3px solid #4caf50" : "3px solid transparent",
                                borderRadius: 2,
                                opacity: isPhotoMarkedForDeletion(photo._id) ? 0.5 : 1,
                                filter: isPhotoMarkedForDeletion(photo._id) ? "grayscale(50%)" : "none",
                              }}
                            >
                              <Box
                                sx={{
                                  position: "relative",
                                  paddingTop: "75%",
                                  cursor: "pointer",
                                  "&:hover": { opacity: 0.9 },
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
                                    <Typography variant="h6" sx={{ color: "white", fontWeight: "bold", textShadow: "2px 2px 4px rgba(0,0,0,0.8)" }}>
                                      Marked for Deletion
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0, 0, 0, 0.6)", borderRadius: 1, padding: 0.5, zIndex: 3 }}>
                                  <Checkbox
                                    checked={getCurrentPhotoState(photo._id)}
                                    size="small"
                                    sx={{ color: "white", "&.Mui-checked": { color: "#4caf50" } }}
                                    onChange={(e) => { e.stopPropagation(); handleTogglePhotoInReport(selectedItemForPhotos._id, photo._id); }}
                                    onClick={(e) => e.stopPropagation()}
                                    title={getCurrentPhotoState(photo._id) ? "Remove from report" : "Include in report"}
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
                                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.85)" },
                                    zIndex: 3,
                                  }}
                                  disabled={!!rotatingPhotoId || isPhotoMarkedForDeletion(photo._id)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRotatePhoto90Cw(photo);
                                  }}
                                  title="Rotate 90° clockwise"
                                >
                                  <RotateRightIcon sx={{ fontSize: "1.1rem" }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  sx={{
                                    position: "absolute",
                                    top: 88,
                                    right: 8,
                                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                                    color: "white",
                                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.85)" },
                                    zIndex: 3,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadPhoto(
                                      photo,
                                      `photo-${index + 1}`,
                                      "full",
                                    );
                                  }}
                                  title="Download full resolution"
                                >
                                  <HdIcon sx={{ fontSize: "1.1rem" }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  sx={{
                                    position: "absolute",
                                    top: 128,
                                    right: 8,
                                    backgroundColor: "rgba(0, 0, 0, 0.6)",
                                    color: "white",
                                    "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.85)" },
                                    zIndex: 3,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadPhoto(
                                      photo,
                                      `photo-${index + 1}`,
                                      "compressed",
                                    );
                                  }}
                                  title="Download compressed"
                                >
                                  <DownloadIcon sx={{ fontSize: "1.1rem" }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  sx={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    backgroundColor: isPhotoMarkedForDeletion(photo._id) ? "rgba(76, 175, 80, 0.8)" : "rgba(0, 0, 0, 0.6)",
                                    color: "white",
                                    "&:hover": { backgroundColor: isPhotoMarkedForDeletion(photo._id) ? "rgba(76, 175, 80, 1)" : "rgba(0, 0, 0, 0.8)" },
                                    zIndex: 3,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPhotoMarkedForDeletion(photo._id)) {
                                      setPhotosToDelete((prev) => {
                                        const next = new Set(prev);
                                        next.delete(photo._id);
                                        return next;
                                      });
                                    } else {
                                      handleDeletePhotoFromItem(selectedItemForPhotos._id, photo._id);
                                    }
                                  }}
                                  title={isPhotoMarkedForDeletion(photo._id) ? "Undo Deletion" : "Remove Photo"}
                                >
                                  {isPhotoMarkedForDeletion(photo._id) ? <CheckIcon fontSize="small" /> : <CloseIcon fontSize="small" />}
                                </IconButton>
                              </Box>
                              <CardContent sx={{ py: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                  Photo {index + 1}
                                </Typography>
                                {editingDescriptionPhotoId === photo._id ? (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={getCurrentPhotoDescription(photo._id, selectedItemForPhotos)}
                                    onChange={(e) => handleDescriptionChange(photo._id, e.target.value)}
                                    onBlur={() => setEditingDescriptionPhotoId(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setEditingDescriptionPhotoId(null); }
                                      if (e.key === "Escape") {
                                        setEditingDescriptionPhotoId(null);
                                        setLocalPhotoDescriptions((prev) => { const next = { ...prev }; delete next[photo._id]; return next; });
                                      }
                                    }}
                                    autoFocus
                                    multiline
                                    maxRows={3}
                                    variant="outlined"
                                    placeholder="Enter photo description..."
                                    sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.75rem" } }}
                                  />
                                ) : (
                                  <Box
                                    onClick={(e) => { e.stopPropagation(); setEditingDescriptionPhotoId(photo._id); }}
                                    sx={{
                                      cursor: "pointer",
                                      p: 1,
                                      borderRadius: 1,
                                      backgroundColor: "grey.50",
                                      "&:hover": { backgroundColor: "grey.100" },
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: "block", wordBreak: "break-word", fontStyle: photo.description || localPhotoDescriptions[photo._id] ? "normal" : "italic" }}
                                    >
                                      {getCurrentPhotoDescription(photo._id, selectedItemForPhotos)}
                                    </Typography>
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", mt: 0.5, display: "block" }}>
                                      Click to edit
                                    </Typography>
                                  </Box>
                                )}
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
                if (hasUnsavedChanges()) await savePhotoChanges();
                await handleClosePhotoGallery();
              }}
              variant="contained"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                backgroundColor: hasUnsavedChanges() ? "#ff9800" : "primary.main",
                "&:hover": { backgroundColor: hasUnsavedChanges() ? "#f57c00" : "primary.dark" },
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
            {fullSizePhoto && (
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
                <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<RotateRightIcon />}
                    disabled={!!rotatingPhotoId || !fullSizePhoto.data}
                    onClick={() => handleRotatePhoto90Cw(fullSizePhoto)}
                    sx={{
                      bgcolor: "rgba(0, 0, 0, 0.65)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.4)",
                      "&:hover": { bgcolor: "rgba(0, 0, 0, 0.85)" },
                    }}
                  >
                    Rotate 90°
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<HdIcon />}
                    disabled={!fullSizePhoto?.fullResolutionData}
                    onClick={() =>
                      handleDownloadPhoto(fullSizePhoto, "full-size", "full")
                    }
                    sx={{
                      bgcolor: "rgba(0, 0, 0, 0.65)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.4)",
                      "&:hover": { bgcolor: "rgba(0, 0, 0, 0.85)" },
                    }}
                  >
                    Download full
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon />}
                    disabled={!fullSizePhoto?.data}
                    onClick={() =>
                      handleDownloadPhoto(
                        fullSizePhoto,
                        "full-size",
                        "compressed",
                      )
                    }
                    sx={{
                      bgcolor: "rgba(0, 0, 0, 0.65)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.4)",
                      "&:hover": { bgcolor: "rgba(0, 0, 0, 0.85)" },
                    }}
                  >
                    Download compressed
                  </Button>
                </Box>
                <img
                  src={fullSizePhotoUrl || fullSizePhoto.data}
                  alt="Full size"
                  style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain" }}
                />
              </Box>
            )}
            {fullSizePhotoUrl && !fullSizePhoto && (
              <img src={fullSizePhotoUrl} alt="Full size" style={{ width: "100%", display: "block" }} />
            )}
          </DialogContent>
        </Dialog>

        {/* Camera: full-viewport overlay */}
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
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
                    "&:hover": { bgcolor: "rgba(0,0,0,0.6)", borderColor: "rgba(255,255,255,0.9)" },
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
                  sx={{ borderRadius: 2, textTransform: "none", fontWeight: 500 }}
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

function JobExclusionsForm({ value, onSave, onCancel }) {
  const [text, setText] = useState(value || "");
  useEffect(() => {
    setText(value || "");
  }, [value]);
  return (
    <Box>
      <TextField
        fullWidth
        multiline
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter job-specific exclusions..."
      />
      <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave(text)}>
          Save
        </Button>
      </Box>
    </Box>
  );
}

export default LeadClearanceItems;
