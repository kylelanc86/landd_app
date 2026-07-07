import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Box,
  Typography,
  useTheme,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import { formatDate } from "../../utils/dateFormat";
import { equipmentService } from "../../services/equipmentService";
import { calibrationFrequencyService } from "../../services/calibrationFrequencyService";
import { airPumpCalibrationService } from "../../services/airPumpCalibrationService";
import { flowmeterCalibrationService } from "../../services/flowmeterCalibrationService";
import { efaService } from "../../services/efaService";
import pcmMicroscopeService from "../../services/pcmMicroscopeService";
import plmMicroscopeService from "../../services/plmMicroscopeService";
import stereomicroscopeService from "../../services/stereomicroscopeService";
import { graticuleService } from "../../services/graticuleService";
import hseTestSlideService from "../../services/hseTestSlideService";
import furnaceCalibrationService from "../../services/furnaceCalibrationService";
import pneumaticTesterCalibrationService from "../../services/pneumaticTesterCalibrationService";
import primaryFlowmeterService from "../../services/primaryFlowmeterService";
import sieveCalibrationService from "../../services/sieveCalibrationService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const EquipmentList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "laboratory";

  const [equipment, setEquipment] = useState([]);
  const [cachedEquipment, setCachedEquipment] = useState([]); // Cache full equipment list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false); // Track if initial load has been done
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [equipmentToArchive, setEquipmentToArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [outOfServiceDialog, setOutOfServiceDialog] = useState(false);
  const [equipmentToMarkOutOfService, setEquipmentToMarkOutOfService] =
    useState(null);
  const [markingOutOfService, setMarkingOutOfService] = useState(false);
  const [outOfServiceLabellingConfirmed, setOutOfServiceLabellingConfirmed] =
    useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [calibrationFrequencies, setCalibrationFrequencies] = useState([]);
  const [referenceError, setReferenceError] = useState(null);
  const [duplicateReferenceDialog, setDuplicateReferenceDialog] = useState(false);
  const [duplicateExistingEquipment, setDuplicateExistingEquipment] =
    useState(null);
  const [form, setForm] = useState({
    equipmentReference: "",
    equipmentType: "",
    section: "",
    brandModel: "",
    serialNumber: "",
  });

  const [filters, setFilters] = useState({
    search: "",
    equipmentType: "All Types",
    status: "Active",
  });

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const fetchCalibrationFrequencies = async () => {
    try {
      const [fixedResponse, variableResponse] = await Promise.all([
        calibrationFrequencyService.getFixedFrequencies(),
        calibrationFrequencyService.getVariableFrequencies(),
      ]);

      const fixedFrequencies = fixedResponse.data || [];
      const variableFrequencies = variableResponse.data || [];

      // Combine both types of frequencies for easier lookup
      const allFrequencies = [
        ...fixedFrequencies.map((freq) => ({
          ...freq,
          type: "fixed",
          displayText: `Every ${freq.frequencyValue} ${freq.frequencyUnit}`,
        })),
        ...variableFrequencies.map((freq) => ({
          ...freq,
          type: "variable",
          displayText: freq.calibrationRequirements,
        })),
      ];

      setCalibrationFrequencies(allFrequencies);
    } catch (err) {
      console.error("Error fetching calibration frequencies:", err);
      // Don't set error state for calibration frequencies as it's not critical
      setCalibrationFrequencies([]);
    }
  };

  // Fetch full equipment list and cache it (only fetch once or when explicitly needed)
  const fetchEquipment = useCallback(
    async (forceRefresh = false) => {
      // If we have already loaded and not forcing refresh, skip
      if (hasLoadedRef.current && !forceRefresh) {
        console.log(
          "EquipmentList: Skipping fetch - already loaded and not forcing refresh",
        );
        return;
      }

      console.log(
        "EquipmentList: Starting fetchEquipment, forceRefresh:",
        forceRefresh,
      );
      try {
        setLoading(true);
        setError(null);

        // Fetch all equipment (no filters) to build cache
        console.log("EquipmentList: Fetching all equipment...");
        const response = await equipmentService.getAll({
          limit: 1000, // Get a large number to cache everything
        });
        const baseEquipment = response.equipment || [];
        console.log(
          `EquipmentList: Fetched ${baseEquipment.length} equipment items`,
        );

        // Keep table load fast: do not fetch calibration data here.
        const equipmentWithCalibrations = baseEquipment;
        console.log(
          `EquipmentList: Caching ${equipmentWithCalibrations.length} equipment items`,
        );
        setCachedEquipment(equipmentWithCalibrations);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error("Error fetching equipment:", err);
        setError(err.message || "Failed to fetch equipment");
      } finally {
        setLoading(false);
      }
    },
    [],
  ); // Stable callback - uses ref to track load state

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchCalibrationFrequencies();
    fetchEquipment(true); // Force initial fetch
  }, []); // Only run once on mount

  // Listen for equipment data updates from other components
  useEffect(() => {
    const handleEquipmentDataUpdate = (event) => {
      console.log(
        "Equipment data updated, refreshing Equipment List:",
        event.detail,
      );
      fetchEquipment(true); // Force refresh equipment data cache
      fetchCalibrationFrequencies(); // Also refresh calibration frequencies
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate,
      );
    };
  }, []); // Empty deps - fetchEquipment is stable

  const findExistingByReference = (reference, excludeId = null) => {
    if (!reference || !reference.trim()) return null;

    const trimmedReference = reference.trim();
    return (
      cachedEquipment.find(
        (item) =>
          item.equipmentReference?.toLowerCase() ===
            trimmedReference.toLowerCase() &&
          (!excludeId || item._id !== excludeId),
      ) || null
    );
  };

  const getEquipmentHiddenFilterReasons = (item) => {
    if (!item) return [];

    const reasons = [];
    const itemStatus = item.calculatedStatus || calculateStatus(item);

    if (filters.status && filters.status !== itemStatus) {
      reasons.push(
        `Status filter is "${filters.status}" but this equipment is "${itemStatus}"`,
      );
    }
    if (
      filters.equipmentType &&
      filters.equipmentType !== "All Types" &&
      item.equipmentType !== filters.equipmentType
    ) {
      reasons.push(
        `Equipment type filter is set to "${filters.equipmentType}"`,
      );
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        item.equipmentReference?.toLowerCase().includes(searchLower) ||
        item.brandModel?.toLowerCase().includes(searchLower);
      if (!matchesSearch) {
        reasons.push(`Search filter "${filters.search}" does not match`);
      }
    }

    return reasons;
  };

  const showDuplicateReferenceDialog = (existing) => {
    const itemWithStatus = {
      ...existing,
      calculatedStatus: existing.calculatedStatus || calculateStatus(existing),
    };
    setDuplicateExistingEquipment(itemWithStatus);
    setDuplicateReferenceDialog(true);
  };

  const handleCloseDuplicateReferenceDialog = () => {
    setDuplicateReferenceDialog(false);
    setDuplicateExistingEquipment(null);
  };

  const handleShowDuplicateInList = () => {
    if (!duplicateExistingEquipment) return;

    setFilters({
      search: duplicateExistingEquipment.equipmentReference || "",
      equipmentType: "All Types",
      status: "",
    });
    setAddDialog(false);
    setReferenceError(null);
    handleCloseDuplicateReferenceDialog();
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();

    const existing = findExistingByReference(form.equipmentReference);
    if (existing) {
      showDuplicateReferenceDialog(existing);
      return;
    }

    try {
      const formData = {
        ...form,
        status: "active",
      };

      await equipmentService.create(formData);

      setReferenceError(null);

      setAddDialog(false);
      setReferenceError(null);
      setForm({
        equipmentReference: "",
        equipmentType: "",
        section: "",
        brandModel: "",
        serialNumber: "",
      });

      fetchEquipment(true);
    } catch (err) {
      console.error("Error adding equipment:", err);
      const serverMessage = err.response?.data?.message || "";
      if (
        serverMessage.toLowerCase().includes("already exists") ||
        serverMessage.toLowerCase().includes("duplicate")
      ) {
        const existingFromCache = findExistingByReference(
          form.equipmentReference,
        );
        if (existingFromCache) {
          showDuplicateReferenceDialog(existingFromCache);
          return;
        }
      }
      setError(serverMessage || err.message || "Failed to add equipment");
    }
  };

  const handleEditEquipment = (equipment) => {
    setSelectedEquipment(equipment);
    setForm({
      equipmentReference: equipment.equipmentReference,
      equipmentType: equipment.equipmentType,
      section: equipment.section,
      brandModel: equipment.brandModel,
      serialNumber: equipment.serialNumber || "",
    });
    setReferenceError(null);
    setEditDialog(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();

    // Check uniqueness before submitting (excluding current equipment)
    if (
      !checkReferenceUniqueness(form.equipmentReference, selectedEquipment._id)
    ) {
      return;
    }

    try {
      const formData = {
        equipmentReference: form.equipmentReference,
        equipmentType: form.equipmentType,
        section: form.section,
        brandModel: form.brandModel,
        serialNumber: form.serialNumber?.trim() || "",
        status: form.status || selectedEquipment?.status || "active",
      };

      await equipmentService.update(selectedEquipment._id, formData);

      setReferenceError(null);

      setEditDialog(false);
      setSelectedEquipment(null);
      setReferenceError(null);
      setForm({
        equipmentReference: "",
        equipmentType: "",
        section: "",
        brandModel: "",
        serialNumber: "",
      });

      // Refresh the equipment list cache
      fetchEquipment(true);
    } catch (err) {
      console.error("Error editing equipment:", err);
      setError(err.message || "Failed to edit equipment");
    }
  };

  const handleDeleteClick = (equipment) => {
    setEquipmentToArchive(equipment);
    setArchiveDialog(true);
    setError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!equipmentToArchive || !equipmentToArchive._id) {
      setError("Equipment information not available");
      return;
    }

    try {
      setArchiving(true);
      setError(null);
      await equipmentService.archive(equipmentToArchive._id);

      // Close dialog and refresh the equipment list cache
      setArchiveDialog(false);
      setEquipmentToArchive(null);
      fetchEquipment(true);
    } catch (err) {
      console.error("Error archiving equipment:", err);
      setError(err.message || "Failed to archive equipment");
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteCancel = () => {
    setArchiveDialog(false);
    setEquipmentToArchive(null);
    setError(null);
  };

  const handleOutOfServiceClick = (equipment) => {
    setEquipmentToMarkOutOfService(equipment);
    setOutOfServiceLabellingConfirmed(false);
    setOutOfServiceDialog(true);
    setError(null);
  };

  const handleOutOfServiceCancel = () => {
    setOutOfServiceDialog(false);
    setEquipmentToMarkOutOfService(null);
    setOutOfServiceLabellingConfirmed(false);
    setError(null);
  };

  const handleOutOfServiceConfirm = async () => {
    if (!equipmentToMarkOutOfService?._id) {
      setError("Equipment information not available");
      return;
    }

    try {
      setMarkingOutOfService(true);
      setError(null);
      await equipmentService.update(equipmentToMarkOutOfService._id, {
        status: "out-of-service",
      });

      setOutOfServiceDialog(false);
      setEquipmentToMarkOutOfService(null);
      setOutOfServiceLabellingConfirmed(false);
      fetchEquipment(true);

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: equipmentToMarkOutOfService._id },
        }),
      );
    } catch (err) {
      console.error("Error marking equipment out of service:", err);
      setError(err.message || "Failed to mark equipment as out of service");
    } finally {
      setMarkingOutOfService(false);
    }
  };

  const fetchCalibrationHistory = async (equipment) => {
    try {
      setLoadingHistory(true);
      setCalibrationHistory([]);
      setError(null); // Clear any previous errors

      const equipmentType = equipment.equipmentType;
      const equipmentReference = equipment.equipmentReference;
      let history = [];

      // Fetch calibrations based on equipment type
      switch (equipmentType) {
        case "Air pump":
          try {
            // Use Equipment _id instead of equipmentReference for consistency
            const pumpData =
              await airPumpCalibrationService.getPumpCalibrations(
                equipment._id,
                1,
                1000,
              );
            console.log("Pump calibration data:", pumpData); // Debug log
            const calibrations = pumpData.data || pumpData || [];
            console.log("Calibrations array:", calibrations); // Debug log

            if (calibrations.length === 0) {
              console.log(
                "No calibrations found for pump:",
                equipment.equipmentReference,
              );
            }

            history = calibrations.map((cal) => ({
              date: cal.calibrationDate || cal.date,
              calibrationId: cal._id || cal.calibrationId,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy
                ? `${cal.calibratedBy.firstName || ""} ${
                    cal.calibratedBy.lastName || ""
                  }`.trim() || "N/A"
                : "N/A",
              type: "Air Pump Calibration",
            }));
          } catch (err) {
            console.error("Error fetching air pump calibrations:", err);
            console.error("Error details:", err.response?.data || err.message);
            setError(
              `Failed to fetch calibration history: ${
                err.response?.data?.message || err.message || "Unknown error"
              }`,
            );
          }
          break;

        case "Site flowmeter":
          try {
            const flowmeterData =
              await flowmeterCalibrationService.getByFlowmeter(
                equipmentReference,
              );
            history = (flowmeterData.calibrations || flowmeterData || []).map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || "N/A",
                type: "Flowmeter Calibration",
              }),
            );
          } catch (err) {
            console.error("Error fetching flowmeter calibrations:", err);
          }
          break;

        case "Bubble flowmeter":
          try {
            const primaryFlowmeterData =
              await primaryFlowmeterService.getByEquipment(equipmentReference);
            history = (
              primaryFlowmeterData.data ||
              primaryFlowmeterData ||
              []
            ).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "Primary Flowmeter Calibration",
            }));
          } catch (err) {
            console.error(
              "Error fetching primary flowmeter calibrations:",
              err,
            );
          }
          break;

        case "Effective Filter Area":
          try {
            const efaData = await efaService.getByEquipment(equipmentReference);
            history = (efaData.calibrations || efaData || []).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "EFA Calibration",
            }));
          } catch (err) {
            console.error("Error fetching EFA calibrations:", err);
          }
          break;

        case "Filter Holder":
          try {
            const [efaData, archivedEfaData] = await Promise.all([
              efaService.getByEquipment(equipmentReference),
              efaService.getAllArchivedCalibrations({
                filterHolderModel: equipmentReference,
                limit: 1000,
              }),
            ]);
            const activeCalibrations =
              efaData.data || efaData.calibrations || efaData || [];
            const archivedCalibrations = Array.isArray(archivedEfaData?.data)
              ? archivedEfaData.data
              : [];
            history = [...activeCalibrations, ...archivedCalibrations].map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || cal.technician || "N/A",
                type: "EFA Calibration",
              }),
            );
          } catch (err) {
            console.error("Error fetching filter holder calibrations:", err);
          }
          break;

        case "Phase Contrast Microscope":
          try {
            const pcmData =
              await pcmMicroscopeService.getByEquipment(equipmentReference);
            history = (pcmData.calibrations || pcmData || []).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "PCM Microscope Calibration",
            }));
          } catch (err) {
            console.error("Error fetching PCM calibrations:", err);
          }
          break;

        case "Polarised Light Microscope":
          try {
            const plmData =
              await plmMicroscopeService.getByEquipment(equipmentReference);
            history = (plmData.calibrations || plmData || []).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "PLM Microscope Calibration",
            }));
          } catch (err) {
            console.error("Error fetching PLM calibrations:", err);
          }
          break;

        case "Stereomicroscope":
          try {
            const stereoData =
              await stereomicroscopeService.getByEquipment(equipmentReference);
            history = (stereoData.calibrations || stereoData || []).map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || "N/A",
                type: "Stereomicroscope Calibration",
              }),
            );
          } catch (err) {
            console.error("Error fetching Stereomicroscope calibrations:", err);
          }
          break;

        case "Furnace":
          try {
            const furnaceData =
              await furnaceCalibrationService.getByEquipment(equipmentReference);
            history = (furnaceData.data || furnaceData || []).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "Furnace Calibration",
            }));
          } catch (err) {
            console.error("Error fetching furnace calibrations:", err);
          }
          break;

        case "Pneumatic tester":
          try {
            const pneumaticTesterData =
              await pneumaticTesterCalibrationService.getByEquipment(
                equipmentReference
              );
            history = (pneumaticTesterData.data || pneumaticTesterData || []).map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || "N/A",
                type: "Pneumatic Tester Calibration",
              })
            );
          } catch (err) {
            console.error("Error fetching pneumatic tester calibrations:", err);
          }
          break;

        case "Sieves":
          try {
            const sieveData =
              await sieveCalibrationService.getByEquipment(equipmentReference);
            history = (sieveData.data || sieveData || []).map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "Sieves Calibration",
            }));
          } catch (err) {
            console.error("Error fetching sieve calibrations:", err);
          }
          break;

        case "Graticule":
          try {
            // Try to get archived calibrations first, then active ones
            const archivedData =
              await graticuleService.getArchivedByEquipment(equipmentReference);
            const allData = await graticuleService.getAll();
            // Handle response structure: { data: [...], pagination: {...} } or direct array
            const calibrationsArray = Array.isArray(allData?.data)
              ? allData.data
              : Array.isArray(allData)
                ? allData
                : [];
            const filtered = calibrationsArray.filter(
              (cal) =>
                cal.graticuleId === equipmentReference ||
                cal.graticuleReference === equipmentReference,
            );
            // Handle archived data structure similarly
            const archived = Array.isArray(archivedData?.data)
              ? archivedData.data
              : Array.isArray(archivedData?.calibrations)
                ? archivedData.calibrations
                : Array.isArray(archivedData)
                  ? archivedData
                  : [];
            const combined = [...filtered, ...archived];
            history = combined.map((cal) => ({
              date: cal.date,
              calibrationId: cal.calibrationId || cal._id,
              notes: cal.notes || "",
              calibratedBy: cal.calibratedBy?.name || "N/A",
              type: "Graticule Calibration",
            }));
          } catch (err) {
            console.error("Error fetching graticule calibrations:", err);
          }
          break;

        default:
          // For other equipment types, try to find a generic endpoint or show message
          history = [];
          break;
      }

      // Sort by date descending (most recent first)
      history.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      console.log("Final history array:", history); // Debug log
      setCalibrationHistory(history);
    } catch (err) {
      console.error("Error fetching calibration history:", err);
      console.error("Error details:", err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch calibration history",
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = (equipment) => {
    setSelectedEquipment(equipment);
    setHistoryDialog(true);
    fetchCalibrationHistory(equipment);
  };

  // Calculate status from stored equipment status only.
  const calculateStatus = useCallback((equipment) => {
    if (!equipment) return "Out-of-Service";
    if (equipment.dueState === "out_of_service") return "Out-of-Service";
    if (equipment.dueState === "overdue") return "Calibration Overdue";
    if (equipment.dueState === "due") return "Calibration Overdue";
    if (equipment.dueState === "active") return "Active";
    if (equipment.status === "out-of-service") return "Out-of-Service";
    if (equipment.status === "calibration due") return "Calibration Overdue";
    return "Active";
  }, []);

  const getStatusColor = (calculatedStatus) => {
    switch (calculatedStatus) {
      case "Active":
        return theme.palette.success.main;
      case "Calibration Overdue":
        return theme.palette.warning.main; // Orange/warning color
      case "Out-of-Service":
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const isStatusBold = (calculatedStatus) => {
    return (
      calculatedStatus === "Calibration Overdue" ||
      calculatedStatus === "Out-of-Service"
    );
  };

  const getCalibrationFrequencyOptions = (equipmentType) => {
    return calibrationFrequencies.filter(
      (freq) =>
        freq.equipmentType.toLowerCase() === equipmentType.toLowerCase(),
    );
  };

  // Check if equipment reference is unique
  const checkReferenceUniqueness = (reference, excludeId = null) => {
    if (!reference || !reference.trim()) {
      setReferenceError(null);
      return true;
    }

    const existing = findExistingByReference(reference, excludeId);

    if (existing) {
      setReferenceError("Equipment reference already exists");
      return false;
    }

    setReferenceError(null);
    return true;
  };

  // Handle equipment reference change with uniqueness check
  const handleReferenceChange = (value, isEdit = false) => {
    const excludeId =
      isEdit && selectedEquipment ? selectedEquipment._id : null;
    setForm({ ...form, equipmentReference: value });
    checkReferenceUniqueness(value, excludeId);
  };

  // Filter equipment based on all filters including calculated status
  // Use cached equipment and apply all filters client-side
  // Memoize calculated statuses to avoid recalculating on every filter change
  const equipmentWithStatus = useMemo(() => {
    // Always use cached equipment if available
    const sourceEquipment = cachedEquipment.length > 0 ? cachedEquipment : [];

    return sourceEquipment.map((item) => ({
      ...item,
      calculatedStatus: calculateStatus(item),
    }));
  }, [cachedEquipment, calculateStatus]);

  const filteredEquipment = useMemo(() => {
    return equipmentWithStatus.filter((item) => {
      // Search filter - client-side
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          item.equipmentReference?.toLowerCase().includes(searchLower) ||
          item.brandModel?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Equipment type filter - client-side
      if (
        filters.equipmentType &&
        filters.equipmentType !== "All Types" &&
        item.equipmentType !== filters.equipmentType
      ) {
        return false;
      }

      // Status filter (based on calculated status) - always client-side
      if (filters.status) {
        if (item.calculatedStatus !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }, [equipmentWithStatus, filters]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Laboratory Equipment
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Breadcrumbs>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Laboratory Records
          </Link>
          <Typography color="text.primary">Laboratory Equipment</Typography>
        </Breadcrumbs>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            onClick={() => navigate("/records/laboratory/equipment/archived")}
          >
            Archived Equipment
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setForm({
                equipmentReference: "",
                equipmentType: "",
                section: "",
                brandModel: "",
                serialNumber: "",
              });
              setReferenceError(null);
              setAddDialog(true);
            }}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.common.white,
              fontSize: "14px",
              fontWeight: "bold",
              padding: "10px 20px",
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Add Equipment
          </Button>
        </Box>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Filters */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Filters
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            label="Search"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            size="small"
            sx={{ minWidth: 350 }}
            placeholder="Search by reference or brand/model"
          />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Equipment Types</InputLabel>
            <Select
              value={filters.equipmentType}
              label="Equipment Types"
              onChange={(e) =>
                handleFilterChange("equipmentType", e.target.value)
              }
            >
              <MenuItem value="All Types">All Types</MenuItem>
              {equipmentService.getEquipmentTypes().map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status}
              label="Status"
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Calibration Overdue">
                Calibration Overdue
              </MenuItem>
              <MenuItem value="Out-of-Service">Out-of-Service</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            onClick={() =>
              setFilters({
                search: "",
                equipmentType: "All Types",
                status: "Active",
              })
            }
            size="small"
          >
            Clear Filters
          </Button>
        </Box>
      </Box>

      {/* Equipment Table */}
      <Box
        m="40px 0 0 0"
        height="62vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
          },
          "& .MuiDataGrid-columnHeaders": {
            background: "linear-gradient(to right, #045E1F, #96CC78) !important",
            borderBottom: "none",
          },
          "& .MuiDataGrid-columnHeader": {
            whiteSpace: "normal",
            lineHeight: "1.2",
            padding: "8px",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            background: "linear-gradient(to right, #045E1F, #96CC78) !important",
          },
          "& .MuiDataGrid-row:nth-of-type(even)": {
            backgroundColor: "#f8f9fa",
          },
          "& .MuiDataGrid-row:nth-of-type(odd)": {
            backgroundColor: "#ffffff",
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "#e3f2fd",
          },
        }}
      >
        <DataGrid
          rows={filteredEquipment}
          sortingOrder={["desc", "asc"]}
          columns={[
            {
              field: "equipmentReference",
              headerName: "Equipment Ref",
              flex: 1,
              minWidth: 150,
            },
            {
              field: "equipmentType",
              headerName: "Equipment Type",
              flex: 1,
              minWidth: 150,
            },
            {
              field: "section",
              headerName: "Section",
              flex: 1,
              minWidth: 120,
            },
            {
              field: "brandModel",
              headerName: "Brand/Model",
              flex: 1,
              minWidth: 150,
            },
            {
              field: "status",
              headerName: "Status",
              flex: 1,
              minWidth: 120,
              valueGetter: (value, row) => {
                // Return calculated status for filtering and sorting
                if (!row) return "Out-of-Service";
                if (row.calculatedStatus) {
                  return row.calculatedStatus;
                }
                return calculateStatus(row);
              },
              renderCell: (params) => {
                if (!params || !params.row) {
                  return (
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.error.main,
                          fontWeight: "bold",
                        }}
                      >
                        Out-of-Service
                      </Typography>
                    </Box>
                  );
                }
                let calculatedStatus;
                if (params.row.calculatedStatus) {
                  calculatedStatus = params.row.calculatedStatus;
                } else {
                  calculatedStatus = calculateStatus(params.row);
                }
                const statusColor = getStatusColor(calculatedStatus);
                const isBold = isStatusBold(calculatedStatus);
                return (
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: statusColor,
                        fontWeight: isBold ? "bold" : "normal",
                      }}
                    >
                      {calculatedStatus}
                    </Typography>
                  </Box>
                );
              },
            },
            {
              field: "actions",
              headerName: "Actions",
              flex: 1.5,
              minWidth: 240,
              renderCell: ({ row }) => {
                const isAirPump = row.equipmentType === "Air pump";
                const isExplicitlyOutOfService = row.status === "out-of-service";

                return (
                  <Box display="flex" alignItems="center" gap={1}>
                    {isAirPump ? (
                      <IconButton
                        size="small"
                        onClick={() =>
                          navigate(
                            `/records/laboratory/calibrations/pump/${row.equipmentReference}`,
                          )
                        }
                        title="View Calibration History"
                        sx={{ color: theme.palette.info.main }}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => handleViewHistory(row)}
                        title="View Calibration History"
                        sx={{ color: theme.palette.info.main }}
                      >
                        <HistoryIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleEditEquipment(row)}
                      title="Edit Equipment"
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {!isExplicitlyOutOfService && (
                      <IconButton
                        size="small"
                        onClick={() => handleOutOfServiceClick(row)}
                        title="Set as Out of Service"
                        sx={{ color: theme.palette.error.main }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(row)}
                      title="Archive Equipment"
                      sx={{ color: theme.palette.warning.main }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              },
            },
          ]}
          getRowId={(row) => row._id}
          loading={loading}
          disableRowSelectionOnClick
          error={error}
          components={{
            NoRowsOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center" }}>No equipment found</Box>
            ),
            ErrorOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center", color: "error.main" }}>
                {error || "An error occurred"}
              </Box>
            ),
          }}
        />
      </Box>

      {/* Add Equipment Dialog */}
      <Dialog
        open={addDialog}
        onClose={() => {
          setAddDialog(false);
          setReferenceError(null);
          setForm({
            equipmentReference: "",
            equipmentType: "",
            section: "",
            brandModel: "",
            serialNumber: "",
          });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Equipment</Typography>
            <IconButton
              onClick={() => {
                setAddDialog(false);
                setReferenceError(null);
                setForm({
                  equipmentReference: "",
                  equipmentType: "",
                  section: "",
                  brandModel: "",
                  serialNumber: "",
                });
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleAddEquipment}>
          <DialogContent>
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{error}</Typography>
              </Box>
            )}
            <Stack spacing={3}>
              <TextField
                label="Equipment Reference"
                value={form.equipmentReference}
                onChange={(e) => handleReferenceChange(e.target.value, false)}
                required
                fullWidth
                error={!!referenceError}
                helperText={referenceError}
              />
              <FormControl fullWidth required>
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={form.equipmentType}
                  label="Equipment Type"
                  onChange={(e) =>
                    setForm({ ...form, equipmentType: e.target.value })
                  }
                >
                  {equipmentService.getEquipmentTypes().map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={(e) =>
                    setForm({ ...form, section: e.target.value })
                  }
                >
                  {equipmentService.getSections().map((section) => (
                    <MenuItem key={section} value={section}>
                      {section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Brand/Model"
                value={form.brandModel}
                onChange={(e) =>
                  setForm({ ...form, brandModel: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Serial number (optional)"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setAddDialog(false);
                setReferenceError(null);
                setForm({
                  equipmentReference: "",
                  equipmentType: "",
                  section: "",
                  brandModel: "",
                  serialNumber: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.equipmentReference ||
                !form.equipmentType ||
                !form.section ||
                !form.brandModel ||
                !!referenceError
              }
            >
              Add Equipment
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => {
          setEditDialog(false);
          setReferenceError(null);
          setForm({
            equipmentReference: "",
            equipmentType: "",
            section: "",
            brandModel: "",
            serialNumber: "",
          });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Edit Equipment</Typography>
            <IconButton
              onClick={() => {
                setEditDialog(false);
                setReferenceError(null);
                setForm({
                  equipmentReference: "",
                  equipmentType: "",
                  section: "",
                  brandModel: "",
                  serialNumber: "",
                });
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveEdit}>
          <DialogContent>
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{error}</Typography>
              </Box>
            )}
            <Stack spacing={3}>
              <TextField
                label="Equipment Reference"
                value={form.equipmentReference}
                onChange={(e) => handleReferenceChange(e.target.value, true)}
                required
                fullWidth
                error={!!referenceError}
                helperText={referenceError}
              />
              <FormControl fullWidth required>
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={form.equipmentType}
                  label="Equipment Type"
                  onChange={(e) =>
                    setForm({ ...form, equipmentType: e.target.value })
                  }
                >
                  {equipmentService.getEquipmentTypes().map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Section</InputLabel>
                <Select
                  value={form.section}
                  label="Section"
                  onChange={(e) =>
                    setForm({ ...form, section: e.target.value })
                  }
                >
                  {equipmentService.getSections().map((section) => (
                    <MenuItem key={section} value={section}>
                      {section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Brand/Model"
                value={form.brandModel}
                onChange={(e) =>
                  setForm({ ...form, brandModel: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Serial number (optional)"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEditDialog(false);
                setReferenceError(null);
                setForm({
                  equipmentReference: "",
                  equipmentType: "",
                  section: "",
                  brandModel: "",
                  serialNumber: "",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.equipmentReference ||
                !form.equipmentType ||
                !form.section ||
                !form.brandModel ||
                !!referenceError
              }
            >
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Calibration History Dialog */}
      <Dialog
        open={historyDialog}
        onClose={() => {
          setHistoryDialog(false);
          setCalibrationHistory([]);
          setSelectedEquipment(null);
          setError(null); // Clear error when closing dialog
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Calibration History - {selectedEquipment?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialog(false);
                setCalibrationHistory([]);
                setSelectedEquipment(null);
                setError(null); // Clear error when closing dialog
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {loadingHistory ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : calibrationHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                {error
                  ? "Error loading calibration history. Please try again."
                  : "No calibration history found for this equipment."}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                height: "60vh",
                width: "100%",
                "& .MuiDataGrid-root": {
                  border: "none",
                },
                "& .MuiDataGrid-cell": {
                  borderBottom: "none",
                },
                "& .MuiDataGrid-columnHeaders": {
                  background: "linear-gradient(to right, #045E1F, #96CC78) !important",
                  borderBottom: "none",
                  color: theme.palette.common.white,
                },
                "& .MuiDataGrid-columnHeader": {
                  whiteSpace: "normal",
                  lineHeight: "1.2",
                  padding: "8px",
                },
                "& .MuiDataGrid-virtualScroller": {
                  backgroundColor: theme.palette.background.default,
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "none",
                  background: "linear-gradient(to right, #045E1F, #96CC78) !important",
                },
                "& .MuiDataGrid-row:nth-of-type(even)": {
                  backgroundColor: "#f8f9fa",
                },
                "& .MuiDataGrid-row:nth-of-type(odd)": {
                  backgroundColor: "#ffffff",
                },
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "#e3f2fd",
                },
              }}
            >
              <DataGrid
                rows={calibrationHistory}
                columns={[
                  {
                    field: "date",
                    headerName: "Date",
                    flex: 1,
                    minWidth: 150,
                    renderCell: (params) => {
                      return params.value ? formatDate(params.value) : "N/A";
                    },
                  },
                  {
                    field: "calibrationId",
                    headerName: "Calibration ID",
                    flex: 1,
                    minWidth: 150,
                  },
                  {
                    field: "type",
                    headerName: "Type",
                    flex: 1,
                    minWidth: 200,
                  },
                  {
                    field: "calibratedBy",
                    headerName: "Calibrated By",
                    flex: 1,
                    minWidth: 150,
                  },
                  {
                    field: "notes",
                    headerName: "Notes",
                    flex: 2,
                    minWidth: 200,
                    renderCell: (params) => {
                      return (
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={params.value}
                        >
                          {params.value || "-"}
                        </Typography>
                      );
                    },
                  },
                ]}
                getRowId={(row, index) => row.calibrationId || index}
                disableRowSelectionOnClick
                components={{
                  NoRowsOverlay: () => (
                    <Box sx={{ p: 2, textAlign: "center" }}>
                      No calibration history found
                    </Box>
                  ),
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setHistoryDialog(false);
              setCalibrationHistory([]);
              setSelectedEquipment(null);
              setError(null); // Clear error when closing dialog
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog
        open={archiveDialog}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Archive Equipment</Typography>
            <IconButton onClick={handleDeleteCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to archive the following equipment? It will be
            moved to the archived equipment table and removed from the active
            equipment list.
          </Typography>
          {equipmentToArchive && (
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Equipment Reference:
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {equipmentToArchive.equipmentReference}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Equipment Type:
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {equipmentToArchive.equipmentType}
              </Typography>
              {equipmentToArchive.brandModel && (
                <>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold", mb: 1 }}
                  >
                    Brand/Model:
                  </Typography>
                  <Typography variant="body1">
                    {equipmentToArchive.brandModel}
                  </Typography>
                </>
              )}
            </Box>
          )}
          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Note:</strong> Archiving this equipment will move it to
              the archived equipment table. All calibration records and data
              will be preserved. You can restore archived equipment later if
              needed.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={archiving}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            color="warning"
            disabled={archiving}
            startIcon={archiving ? <CircularProgress size={20} /> : null}
          >
            {archiving ? "Archiving..." : "Archive Equipment"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Out-of-Service Confirmation Dialog */}
      <Dialog
        open={outOfServiceDialog}
        onClose={handleOutOfServiceCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Set Equipment as Out-of-Service</Typography>
            <IconButton onClick={handleOutOfServiceCancel}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to place{" "}
            <strong>
              {equipmentToMarkOutOfService?.equipmentReference || "this equipment"}
            </strong>{" "}
            out of service?
          </Typography>
          {equipmentToMarkOutOfService && (
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Equipment Type:
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {equipmentToMarkOutOfService.equipmentType}
              </Typography>
              {equipmentToMarkOutOfService.brandModel && (
                <>
                  <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                    Brand/Model:
                  </Typography>
                  <Typography variant="body1">
                    {equipmentToMarkOutOfService.brandModel}
                  </Typography>
                </>
              )}
            </Box>
          )}
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              Out-of-service equipment must not be used until it is returned to
              service. Confirm only if the item has been suitably labelled and
              stored.
            </Typography>
          </Alert>
          <FormControlLabel
            control={
              <Checkbox
                checked={outOfServiceLabellingConfirmed}
                onChange={(e) => setOutOfServiceLabellingConfirmed(e.target.checked)}
                color="error"
              />
            }
            label="I confirm this equipment has been suitably labelled and stored"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOutOfServiceCancel} disabled={markingOutOfService}>
            Cancel
          </Button>
          <Button
            onClick={handleOutOfServiceConfirm}
            variant="contained"
            color="error"
            disabled={markingOutOfService || !outOfServiceLabellingConfirmed}
            startIcon={markingOutOfService ? <CircularProgress size={20} /> : null}
          >
            {markingOutOfService ? "Updating..." : "Confirm Out-of-Service"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Reference Dialog */}
      <Dialog
        open={duplicateReferenceDialog}
        onClose={handleCloseDuplicateReferenceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Equipment Reference Already Exists</Typography>
            <IconButton onClick={handleCloseDuplicateReferenceDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            An item with reference{" "}
            <strong>{duplicateExistingEquipment?.equipmentReference}</strong>{" "}
            already exists in the equipment database. Each reference must be
            unique.
          </Typography>
          {duplicateExistingEquipment && (
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.grey[100],
                borderRadius: 1,
                mb: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Existing Equipment
              </Typography>
              <Typography variant="body2">
                <strong>Type:</strong> {duplicateExistingEquipment.equipmentType}
              </Typography>
              <Typography variant="body2">
                <strong>Section:</strong> {duplicateExistingEquipment.section}
              </Typography>
              <Typography variant="body2">
                <strong>Brand/Model:</strong>{" "}
                {duplicateExistingEquipment.brandModel || "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Status:</strong>{" "}
                {duplicateExistingEquipment.calculatedStatus ||
                  calculateStatus(duplicateExistingEquipment)}
              </Typography>
            </Box>
          )}
          {duplicateExistingEquipment &&
            getEquipmentHiddenFilterReasons(duplicateExistingEquipment).length >
              0 && (
              <Alert severity="info">
                <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                  This equipment may be hidden from the list
                </Typography>
                <Typography variant="body2" component="div">
                  It is not visible with your current filters:
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                    {getEquipmentHiddenFilterReasons(
                      duplicateExistingEquipment,
                    ).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </Typography>
              </Alert>
            )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDuplicateReferenceDialog}>Close</Button>
          <Button variant="contained" onClick={handleShowDuplicateInList}>
            Show in List
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EquipmentList;
