import React, { useState, useEffect } from "react";
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
} from "@mui/icons-material";
import { Checkbox, FormControlLabel } from "@mui/material";

import { useNavigate, useParams } from "react-router-dom";
import PermissionGate from "../../components/PermissionGate";
import SitePlanDrawing from "../../components/SitePlanDrawing";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import {
  compressImage,
  needsCompression,
  saveFileToDevice,
} from "../../utils/imageCompression";
import { formatDate } from "../../utils/dateUtils";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const ClearanceItems = () => {
  const navigate = useNavigate();
  const { clearanceId } = useParams();

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
  const [fullSizePhotoDialogOpen, setFullSizePhotoDialogOpen] = useState(false);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [airMonitoringReportsDialogOpen, setAirMonitoringReportsDialogOpen] =
    useState(false);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [savingExclusions, setSavingExclusions] = useState(false);
  const [exclusionsLastSaved, setExclusionsLastSaved] = useState(null);
  const [sitePlanDialogOpen, setSitePlanDialogOpen] = useState(false);
  const [sitePlanFile, setSitePlanFile] = useState(null);
  const [uploadingSitePlan, setUploadingSitePlan] = useState(false);
  const [sitePlanDrawingDialogOpen, setSitePlanDrawingDialogOpen] =
    useState(false);
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

  const getProjectFolderName = () => {
    const project = clearance?.projectId;

    if (project) {
      if (typeof project === "string") {
        return project;
      }
      return (
        project.projectId ||
        project.externalId ||
        project._id ||
        project.name ||
        clearanceId ||
        "clearance-photos"
      );
    }

    return clearanceId || "clearance-photos";
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

  // Fetch items and clearance data on component mount
  useEffect(() => {
    if (clearanceId) {
      fetchData();
      fetchCustomDataFields();
    } else {
      console.error("No clearanceId provided in URL parameters");
      setError("No clearance ID provided");
      setLoading(false);
    }
  }, [clearanceId]);

  const fetchCustomDataFields = async () => {
    try {
      const [
        roomAreasData,
        locationDescriptionsData,
        materialsDescriptionsData,
      ] = await Promise.all([
        customDataFieldGroupService.getFieldsByType("room_area"),
        customDataFieldGroupService.getFieldsByType("location_description"),
        customDataFieldGroupService.getFieldsByType("materials_description"),
      ]);

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

      setCustomDataFields({
        roomAreas: processData(roomAreasData),
        locationDescriptions: processData(locationDescriptionsData),
        materialsDescriptions: processData(materialsDescriptionsData),
      });
    } catch (err) {
      console.error("Error fetching custom data fields:", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Check if clearanceId is valid
      if (!clearanceId) {
        throw new Error("Clearance ID is missing from URL");
      }

      console.log("Fetching data for clearance ID:", clearanceId);

      const [itemsData, clearanceData] = await Promise.all([
        asbestosClearanceService.getItems(clearanceId),
        asbestosClearanceService.getById(clearanceId),
      ]);

      setItems(itemsData || []);
      setClearance(clearanceData);

      // Debug: Log clearance data to check site plan fields
      console.log("Clearance data loaded:", {
        sitePlan: clearanceData?.sitePlan,
        sitePlanFile: clearanceData?.sitePlanFile ? "Present" : "Missing",
        sitePlanSource: clearanceData?.sitePlanSource,
        clearanceId,
      });

      // Set job completed state based on clearance status
      setJobCompleted(clearanceData?.status === "complete");

      // Fetch asbestos removal job ID for breadcrumb navigation (separate from main data loading)
      if (clearanceData?.projectId) {
        try {
          const asbestosRemovalJobService = (
            await import("../../services/asbestosRemovalJobService")
          ).default;
          const jobsResponse = await asbestosRemovalJobService.getAll();
          const projectId =
            clearanceData.projectId._id || clearanceData.projectId;

          // Handle different response structures - some APIs return {data: [...]} others return {jobs: [...]}
          const jobsArray = jobsResponse.data || jobsResponse.jobs || [];

          console.log(
            "Looking for asbestos removal job with projectId:",
            projectId
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
            }))
          );

          // Find the asbestos removal job that matches this project
          // Try multiple matching strategies to be more robust
          const matchingJob = jobsArray.find((job) => {
            const jobProjectId = job.projectId?._id || job.projectId;
            const clearanceProjectId =
              clearanceData.projectId._id || clearanceData.projectId;

            console.log(
              `Comparing job ${job._id} projectId (${jobProjectId}) with clearance projectId (${clearanceProjectId})`
            );

            return (
              jobProjectId === clearanceProjectId ||
              jobProjectId === projectId ||
              job.projectId === projectId ||
              job.projectId === clearanceData.projectId ||
              job.projectId?._id === projectId ||
              job.projectId?._id === clearanceData.projectId
            );
          });

          console.log("Matching job found:", matchingJob);

          if (matchingJob) {
            setAsbestosRemovalJobId(matchingJob._id);
            console.log("Set asbestosRemovalJobId to:", matchingJob._id);
          } else {
            console.log(
              "No matching asbestos removal job found for projectId:",
              projectId
            );
            console.log(
              "This might cause navigation to go to asbestos removal list instead of job details"
            );
          }
        } catch (jobError) {
          console.error("Error fetching asbestos removal job ID:", jobError);
          // Don't fail the entire data loading if job ID fetching fails
        }
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        clearanceId: clearanceId,
      });
      setError(`Failed to load data: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
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
          itemData
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
        const updatedItems = await asbestosClearanceService.getItems(
          clearanceId
        );
        const createdItem = updatedItems.find(
          (item) =>
            item.locationDescription === itemData.locationDescription &&
            item.roomArea === itemData.roomArea &&
            item.materialDescription === itemData.materialDescription
        );

        if (createdItem) {
          setSelectedItemForPhotos(createdItem);
          setPhotoGalleryDialogOpen(true);
        }
      }

      // Update clearance type based on all items (only for editing, since we already fetched items for new items)
      if (editingItem) {
        const updatedItems = await asbestosClearanceService.getItems(
          clearanceId
        );
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
      clearance?.clearanceType !== "Vehicle/Equipment" && !!item.levelFloor
    );
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
      (item) => item.asbestosType === "non-friable"
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
          `Clearance type automatically updated to: ${newClearanceType}`
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
          backCameraError
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

      // Draw the current video frame to canvas
      context.drawImage(videoRef, 0, 0, canvas.width, canvas.height);

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
            // Create a file from the blob (full quality)
            const fullQualityFile = new File([blob], filename, {
              type: "image/jpeg",
            });

            // Save full-size original to device
            try {
              await saveFileToDevice(fullQualityFile, filename, {
                projectId: getProjectFolderName(),
              });
            } catch (error) {
              console.error("Error saving photo to device:", error);
              // Continue with upload even if device save fails
            }

            // Now process the full-quality file for upload (will be compressed if needed)
            // Pass it with a special name to prevent double-saving in handlePhotoUploadForGallery
            const uploadFile = new File([blob], "camera-photo.jpg", {
              type: "image/jpeg",
            });
            handlePhotoUploadForGallery({ target: { files: [uploadFile] } });
          }
        },
        "image/jpeg",
        1.0 // Full quality for device storage
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
  };

  // Open photo gallery for an item
  const handleOpenPhotoGallery = (item) => {
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
    setLocalPhotoChanges({}); // Clear any unsaved changes
    setPhotosToDelete(new Set()); // Clear any photos marked for deletion

    // Refresh the main table data to update photo counts
    await fetchData();
  };

  // Handle site plan save
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

      if (!imageData) {
        showSnackbar("No site plan image data was provided", "error");
        return;
      }

      // Save the drawn site plan to the clearance
      const response = await asbestosClearanceService.update(clearanceId, {
        sitePlan: true, // Enable site plan functionality
        sitePlanFile: imageData, // Base64 image data
        sitePlanLegend: legendEntries,
        sitePlanLegendTitle: legendTitle,
        sitePlanSource: "drawn", // Mark it as a drawn site plan
      });

      console.log("Site plan save response:", response);

      showSnackbar("Drawn site plan saved successfully!", "success");
      setSitePlanDrawingDialogOpen(false);
      fetchData(); // Refresh clearance data to show the new site plan
    } catch (error) {
      console.error("Error saving site plan:", error);
      showSnackbar("Error saving site plan", "error");
    }
  };

  // Handle site plan drawing dialog close
  const handleSitePlanDrawingClose = () => {
    setSitePlanDrawingDialogOpen(false);
  };

  // Add photo to existing item
  const handleAddPhotoToItem = async (photoData) => {
    if (!selectedItemForPhotos) return;

    try {
      const response = await asbestosClearanceService.addPhotoToItem(
        clearanceId,
        selectedItemForPhotos._id,
        photoData,
        true // includeInReport default to true
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

  // View full-size photo
  const handleViewFullSizePhoto = (photoUrl) => {
    setFullSizePhotoUrl(photoUrl);
    setFullSizePhotoDialogOpen(true);
  };

  // Helper function to get current photo state (including local changes)
  const getCurrentPhotoState = (photoId) => {
    const localChange = localPhotoChanges[photoId];
    if (localChange !== undefined) {
      return localChange;
    }
    // Find the photo in the selected item
    const photo = selectedItemForPhotos?.photographs?.find(
      (p) => p._id === photoId
    );
    return photo?.includeInReport ?? true;
  };

  // Helper function to check if there are unsaved changes
  const hasUnsavedChanges = () => {
    return Object.keys(localPhotoChanges).length > 0 || photosToDelete.size > 0;
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
      const promises = [];

      // Handle photo inclusion changes
      Object.entries(localPhotoChanges).forEach(
        ([photoId, includeInReport]) => {
          const photo = selectedItemForPhotos?.photographs?.find(
            (p) => p._id === photoId
          );
          if (photo && photo.includeInReport !== includeInReport) {
            promises.push(
              asbestosClearanceService.togglePhotoInReport(
                clearanceId,
                selectedItemForPhotos._id,
                photoId
              )
            );
          }
        }
      );

      // Handle photo deletions
      photosToDelete.forEach((photoId) => {
        promises.push(
          asbestosClearanceService.deletePhotoFromItem(
            clearanceId,
            selectedItemForPhotos._id,
            photoId
          )
        );
      });

      await Promise.all(promises);

      // Clear local changes
      setLocalPhotoChanges({});
      setPhotosToDelete(new Set());

      // Refresh data
      await fetchData();

      // Update selected item
      const updatedItems = await asbestosClearanceService.getItems(clearanceId);
      const updatedItem = updatedItems.find(
        (item) => item._id === selectedItemForPhotos._id
      );
      setSelectedItemForPhotos(updatedItem);

      showSnackbar("Photo changes saved successfully", "success");
    } catch (error) {
      console.error("Error saving photo changes:", error);
      showSnackbar("Failed to save photo changes", "error");
    }
  };

  // Handle photo upload for photo gallery
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
            (compressedImage.length * 0.75) / 1024
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100
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
        console.error("Error processing image:", error);
        setCompressionStatus({
          type: "error",
          message: "Failed to process image",
        });
      }
    }
  };

  const fetchAirMonitoringReports = async () => {
    if (!clearance?.projectId?._id) {
      showSnackbar("No project found for this clearance", "error");
      return;
    }

    try {
      setLoadingReports(true);

      // Use asbestos removal job ID if available, otherwise fall back to project ID
      if (asbestosRemovalJobId) {
        console.log(
          "Fetching air monitoring reports for job:",
          asbestosRemovalJobId
        );
        const reports =
          await asbestosClearanceService.getAirMonitoringReportsByJob(
            asbestosRemovalJobId
          );
        setAirMonitoringReports(reports);
      } else {
        console.log(
          "No job ID found, falling back to project ID:",
          clearance.projectId._id
        );
        const reports = await asbestosClearanceService.getAirMonitoringReports(
          clearance.projectId._id
        );
        setAirMonitoringReports(reports);
      }
    } catch (error) {
      console.error("Error fetching air monitoring reports:", error);
      showSnackbar("Failed to fetch air monitoring reports", "error");
    } finally {
      setLoadingReports(false);
    }
  };

  const handleOpenAirMonitoringReportsDialog = () => {
    setAirMonitoringReportsDialogOpen(true);
    fetchAirMonitoringReports();
  };

  const handleSelectAirMonitoringReport = async (report) => {
    try {
      setSelectedReport(report);
      setGeneratingAirMonitoringPDF(true);

      // Generate the air monitoring report PDF
      const { generateShiftReport } = await import(
        "../../utils/generateShiftReport"
      );
      const { shiftService, sampleService, projectService, clientService } =
        await import("../../services/api");
      const asbestosRemovalJobService = (
        await import("../../services/asbestosRemovalJobService")
      ).default;

      // Get the shift data
      const shiftResponse = await shiftService.getById(report._id);
      const shift = shiftResponse.data;

      // Get the asbestos removal job data
      const jobResponse = await asbestosRemovalJobService.getById(report.jobId);
      const job = jobResponse.data;

      // Get samples for this shift
      const samplesResponse = await sampleService.getByShift(report._id);
      const samples = samplesResponse.data || [];

      // Get project data
      let project = job.projectId;
      if (project && typeof project === "string") {
        const projectResponse = await projectService.getById(project);
        project = projectResponse.data;
      }
      if (project && project.client && typeof project.client === "string") {
        const clientResponse = await clientService.getById(project.client);
        project.client = clientResponse.data;
      }

      // Generate the report and get the PDF data URL
      const pdfDataUrl = await generateShiftReport({
        shift: shift,
        job: job,
        samples: samples,
        projectId: project,
        returnPdfData: true, // This will return the PDF data URL instead of downloading
        sitePlanData: shift.sitePlan
          ? {
              sitePlan: shift.sitePlan,
              sitePlanData: shift.sitePlanData,
            }
          : null,
      });

      // Extract base64 data from data URL
      const base64Data = pdfDataUrl.split(",")[1];

      // Upload the report to the clearance and enable air monitoring
      await asbestosClearanceService.uploadAirMonitoringReport(clearanceId, {
        reportData: base64Data,
        shiftDate: shift.date,
        shiftId: shift._id,
        airMonitoring: true, // Enable air monitoring when report is uploaded
      });

      showSnackbar(
        "Air monitoring report selected and uploaded successfully",
        "success"
      );

      setAirMonitoringReportsDialogOpen(false);
      setAttachmentsModalOpen(false); // Close the main air monitoring modal
      setSelectedReport(null);
      fetchData(); // Refresh clearance data
    } catch (error) {
      console.error("Error selecting air monitoring report:", error);
      showSnackbar("Failed to select air monitoring report", "error");
    } finally {
      setGeneratingAirMonitoringPDF(false);
    }
  };

  const handleRemoveAirMonitoringReport = async () => {
    if (
      window.confirm(
        "Are you sure you want to remove the air monitoring report?"
      )
    ) {
      try {
        // Update the clearance to remove the air monitoring report and disable air monitoring
        await asbestosClearanceService.update(clearanceId, {
          airMonitoringReport: null,
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
        asbestosRemovalJobId
      );

      // Navigate to asbestos removal job details after completing clearance
      if (asbestosRemovalJobId) {
        console.log(
          "Navigating to asbestos removal job details:",
          `/asbestos-removal/jobs/${asbestosRemovalJobId}/details`
        );
        // Navigate to the asbestos removal job details using the already fetched job ID
        navigate(`/asbestos-removal/jobs/${asbestosRemovalJobId}/details`);
      } else {
        console.log(
          "No asbestosRemovalJobId found, attempting to find job ID again..."
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
              "Still no matching job found, navigating to asbestos removal list"
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
            onClick={() =>
              navigate(
                asbestosRemovalJobId
                  ? `/asbestos-removal/jobs/${asbestosRemovalJobId}/details`
                  : `/asbestos-removal`
              )
            }
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            Asbestos Removal Job Details
          </Link>
          <Typography color="text.primary">
            {clearance.projectId?.name || "Unknown Project"}:{" "}
            {clearance.clearanceDate
              ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "Unknown Date"}
          </Typography>
        </Breadcrumbs>

        {/* Project Info */}

        <Box display="flex" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box display="flex" gap={2} alignItems="center">
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setAttachmentsModalOpen(true)}
              startIcon={<AssessmentIcon />}
            >
              Air Monitoring Report
            </Button>
            {clearance?.airMonitoringReport && (
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
                  Delete Report
                </Button>
                <Typography
                  variant="body2"
                  color="success.main"
                  sx={{ fontWeight: "medium" }}
                >
                  ✓ Air Monitoring Report Attached
                  {clearance.airMonitoringShiftDate && (
                    <Box component="span" sx={{ ml: 1 }}>
                      ({formatDate(clearance.airMonitoringShiftDate)})
                    </Box>
                  )}
                </Typography>
              </Box>
            )}
            {!clearance?.airMonitoringReport && (
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
                  <TableRow>
                    {clearance?.clearanceType === "Vehicle/Equipment" ? (
                      <>
                        <TableCell>Item Description</TableCell>
                        <TableCell>Photo No.</TableCell>
                        <TableCell>Actions</TableCell>
                      </>
                    ) : (
                      <>
                        {items &&
                          items.length > 0 &&
                          items.some(
                            (item) =>
                              item.levelFloor && item.levelFloor.trim() !== ""
                          ) && <TableCell>Level/Floor</TableCell>}
                        <TableCell>Room/Area</TableCell>
                        <TableCell>Location Description</TableCell>
                        <TableCell>Materials Description</TableCell>
                        <TableCell>Asbestos Type</TableCell>
                        <TableCell>Photograph</TableCell>
                        <TableCell>Actions</TableCell>
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
                          item.levelFloor && item.levelFloor.trim() !== ""
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
                          (item) => item.text
                        )}
                        onOpen={() =>
                          console.log(
                            "Room areas options:",
                            customDataFields.roomAreas
                          )
                        }
                        freeSolo
                        renderInput={(params) => (
                          <TextField {...params} label="Room/Area" required />
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
                          (item) => item.text
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
                          (item) => item.text
                        )}
                        freeSolo
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Materials Description"
                            required
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
            setSelectedReport(null);
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
              Select Air Monitoring Report
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select an air monitoring report from the list below. This will
                be included in the clearance report as Appendix B.
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
                  be completed and authorized to appear here.
                </Alert>
              ) : (
                <Box sx={{ maxHeight: 400, overflow: "auto" }}>
                  {airMonitoringReports.map((report, index) => (
                    <Card
                      key={report._id}
                      sx={{
                        mb: 2,
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "action.hover",
                        },
                        border: selectedReport?._id === report._id ? 2 : 1,
                        borderColor:
                          selectedReport?._id === report._id
                            ? "primary.main"
                            : "divider",
                      }}
                      onClick={() => handleSelectAirMonitoringReport(report)}
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
                              <Typography
                                variant="subtitle1"
                                fontWeight="medium"
                              >
                                {formatDate(report.date)}
                              </Typography>
                              <Chip
                                label={
                                  report.reportApprovedBy
                                    ? "Authorized"
                                    : report.status
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
                            <Typography variant="body2" color="text.secondary">
                              <Box component="span" fontWeight="bold">
                                Description of Works:{" "}
                              </Box>
                              {report.descriptionOfWorks ||
                                "No description provided"}
                            </Typography>
                          </Box>
                          {selectedReport?._id === report._id && (
                            <CircularProgress size={20} />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => {
                setAirMonitoringReportsDialogOpen(false);
                setSelectedReport(null);
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
              Manage Air Monitoring Report
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            {/* Air Monitoring Section */}
            <Box sx={{ mb: 4 }}>
              {clearance.airMonitoringReport && (
                <Typography
                  variant="body2"
                  color="success.main"
                  sx={{ mb: 2, fontWeight: "medium" }}
                >
                  ✓ Air Monitoring Report Currently Attached
                  {clearance.airMonitoringShiftDate && (
                    <Box component="span" sx={{ ml: 1 }}>
                      Shift Date: {formatDate(clearance.airMonitoringShiftDate)}
                    </Box>
                  )}
                </Typography>
              )}
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleOpenAirMonitoringReportsDialog}
                  startIcon={<DescriptionIcon />}
                >
                  {clearance.airMonitoringReport
                    ? "Replace Air Monitoring Report"
                    : "Select Air Monitoring Report"}
                </Button>
                {clearance.airMonitoringReport && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleRemoveAirMonitoringReport}
                    startIcon={<DeleteIcon />}
                  >
                    Remove Report
                  </Button>
                )}
              </Box>
              {!clearance?.airMonitoringReport && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 2 }}
                >
                  No air monitoring report has been uploaded for this clearance
                  yet. Use the button above to upload a report.
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
                label="Job Specific Exclusions"
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
                  endAdornment: savingExclusions ? (
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                  ) : null,
                }}
                sx={{ mb: 2 }}
              />
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
                    "success"
                  );
                  setExclusionsLastSaved(new Date());
                  setJobExclusionsModalOpen(false);
                } catch (error) {
                  console.error("Error saving job specific exclusions:", error);
                  showSnackbar(
                    "Failed to save job specific exclusions",
                    "error"
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
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "300px",
                backgroundColor: "#000",
                borderRadius: 2,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {stream ? (
                <video
                  ref={(ref) => {
                    setVideoRef(ref);
                    if (ref && stream) {
                      ref.srcObject = stream;
                      console.log("Video element set up with stream:", stream);
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
                  onLoadedMetadata={() => {
                    console.log("Video metadata loaded");
                  }}
                  onCanPlay={() => {
                    console.log("Video can play");
                  }}
                  onError={(e) => {
                    console.error("Video error:", e);
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
              photo.
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
                    {selectedItemForPhotos.materialDescription}
                  </Typography>
                </Box>

                {/* Add Photo Section */}
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
                                    photo._id
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
                                  photo._id
                                )
                                  ? "rgba(76, 175, 80, 0.8)"
                                  : "rgba(0, 0, 0, 0.6)",
                                color: "white",
                                "&:hover": {
                                  backgroundColor: isPhotoMarkedForDeletion(
                                    photo._id
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
                                    photo._id
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
                            <Box
                              display="flex"
                              alignItems="center"
                              justifyContent="space-between"
                              flexWrap="wrap"
                              gap={1}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Photo {index + 1}
                              </Typography>
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
              existingSitePlan={clearance?.sitePlanFile}
              existingLegend={clearance?.sitePlanLegend}
              existingLegendTitle={clearance?.sitePlanLegendTitle}
            />
          </DialogContent>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default ClearanceItems;
