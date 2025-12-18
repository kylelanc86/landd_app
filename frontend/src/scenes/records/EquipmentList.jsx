import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const EquipmentList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "laboratory";

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [historyDialog, setHistoryDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [calibrationHistory, setCalibrationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [calibrationFrequencies, setCalibrationFrequencies] = useState([]);
  const [referenceError, setReferenceError] = useState(null);
  const [form, setForm] = useState({
    equipmentReference: "",
    equipmentType: "",
    section: "",
    brandModel: "",
    lastCalibration: "",
    calibrationDue: "",
    calibrationFrequency: "",
  });

  const [filters, setFilters] = useState({
    search: "",
    equipmentType: "",
    section: "",
    status: "",
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

  // Helper function to fetch calibration data for an equipment item
  const fetchCalibrationDataForEquipment = async (equipmentItem) => {
    try {
      let calibrations = [];
      const equipmentReference = equipmentItem.equipmentReference;
      const equipmentType = equipmentItem.equipmentType;

      switch (equipmentType) {
        case "Site flowmeter":
        case "Bubble flowmeter":
          try {
            const response = await flowmeterCalibrationService.getByFlowmeter(
              equipmentReference
            );
            calibrations = response.data || response || [];
          } catch (err) {
            console.error(
              `Error fetching flowmeter calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Graticule":
          try {
            const allData = await graticuleService.getAll();
            const filtered = (allData.calibrations || allData || []).filter(
              (cal) =>
                cal.graticuleId === equipmentReference ||
                cal.graticuleReference === equipmentReference
            );
            calibrations = filtered;
          } catch (err) {
            console.error(
              `Error fetching graticule calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Effective Filter Area":
          try {
            const efaData = await efaService.getByEquipment(equipmentReference);
            calibrations = efaData.calibrations || efaData || [];
          } catch (err) {
            console.error(
              `Error fetching EFA calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Phase Contrast Microscope":
          try {
            const pcmData = await pcmMicroscopeService.getByEquipment(
              equipmentReference
            );
            calibrations = pcmData.calibrations || pcmData || [];
          } catch (err) {
            console.error(
              `Error fetching PCM calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Polarised Light Microscope":
          try {
            const plmData = await plmMicroscopeService.getByEquipment(
              equipmentReference
            );
            calibrations = plmData.calibrations || plmData || [];
          } catch (err) {
            console.error(
              `Error fetching PLM calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Stereomicroscope":
          try {
            const stereoData = await stereomicroscopeService.getByEquipment(
              equipmentReference
            );
            calibrations = stereoData.calibrations || stereoData || [];
          } catch (err) {
            console.error(
              `Error fetching Stereomicroscope calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "HSE Test Slide":
          try {
            const hseData = await hseTestSlideService.getByEquipment(
              equipmentReference
            );
            calibrations = hseData.data || hseData || [];
          } catch (err) {
            console.error(
              `Error fetching HSE Test Slide calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        case "Air pump":
          try {
            // Use Equipment _id instead of equipmentReference for consistency
            const pumpData =
              await airPumpCalibrationService.getPumpCalibrations(
                equipmentItem._id,
                1,
                1000
              );
            calibrations = pumpData.data || pumpData || [];
          } catch (err) {
            console.error(
              `Error fetching air pump calibrations for ${equipmentReference}:`,
              err
            );
          }
          break;

        default:
          // For other equipment types, no calibration data
          calibrations = [];
          break;
      }

      // Calculate lastCalibration and calibrationDue from calibrations
      let lastCalibration = null;
      let calibrationDue = null;

      if (calibrations.length > 0) {
        // Get most recent calibration date
        const calibrationDates = calibrations
          .map((cal) => new Date(cal.date || cal.calibrationDate))
          .filter((date) => !isNaN(date.getTime()));
        if (calibrationDates.length > 0) {
          lastCalibration = new Date(
            Math.max(...calibrationDates.map((d) => d.getTime()))
          );
        }

        // Get most recent nextCalibration or calibrationDue date
        const dueDates = calibrations
          .map((cal) => {
            const dueDate =
              cal.nextCalibration ||
              cal.calibrationDue ||
              cal.nextCalibrationDue;
            return dueDate ? new Date(dueDate) : null;
          })
          .filter((date) => date && !isNaN(date.getTime()));
        if (dueDates.length > 0) {
          calibrationDue = new Date(
            Math.max(...dueDates.map((d) => d.getTime()))
          );
        }
      }

      return {
        ...equipmentItem,
        lastCalibration,
        calibrationDue,
      };
    } catch (err) {
      console.error(
        `Error fetching calibration data for ${equipmentItem.equipmentReference}:`,
        err
      );
      // Return equipment without calibration data if fetch fails
      return {
        ...equipmentItem,
        lastCalibration: null,
        calibrationDue: null,
      };
    }
  };

  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Exclude status filter from backend call since it's calculated on frontend
      const { status, ...backendFilters } = filters;
      const response = await equipmentService.getAll({
        limit: 100,
        ...backendFilters,
      });
      const baseEquipment = response.equipment || [];

      // Fetch calibration data for each equipment item
      const equipmentWithCalibrations = await Promise.all(
        baseEquipment.map((equipmentItem) =>
          fetchCalibrationDataForEquipment(equipmentItem)
        )
      );

      setEquipment(equipmentWithCalibrations);
    } catch (err) {
      console.error("Error fetching equipment:", err);
      setError(err.message || "Failed to fetch equipment");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchCalibrationFrequencies();
    fetchEquipment();
  }, [fetchEquipment]);

  // Listen for equipment data updates from other components
  useEffect(() => {
    const handleEquipmentDataUpdate = (event) => {
      console.log(
        "Equipment data updated, refreshing Equipment List:",
        event.detail
      );
      fetchEquipment(); // Refresh equipment data
      fetchCalibrationFrequencies(); // Also refresh calibration frequencies
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);

    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchEquipment]);

  const handleAddEquipment = async (e) => {
    e.preventDefault();

    // Check uniqueness before submitting
    if (!checkReferenceUniqueness(form.equipmentReference)) {
      return;
    }

    try {
      // Auto-populate calibration frequency based on equipment type
      const frequencyOptions = getCalibrationFrequencyOptions(
        form.equipmentType
      );

      // Auto-calculate calibration dates if not provided (using obviously wrong defaults)
      const defaultDate = "1900-01-01";

      // Convert calibration frequency to months if needed
      let calibrationFrequencyInMonths = null;
      if (frequencyOptions.length > 0) {
        const freq = frequencyOptions[0];
        if (freq.frequencyUnit === "years") {
          calibrationFrequencyInMonths = freq.frequencyValue * 12;
        } else {
          calibrationFrequencyInMonths = freq.frequencyValue;
        }
      }

      const formData = {
        ...form,
        calibrationFrequency: calibrationFrequencyInMonths,
        // Use obviously wrong default dates to indicate they need proper calculation
        lastCalibration: form.lastCalibration || defaultDate,
        calibrationDue:
          frequencyOptions.length > 0
            ? form.calibrationDue || defaultDate
            : null,
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
        lastCalibration: "",
        calibrationDue: "",
        calibrationFrequency: "",
      });

      // Refresh the equipment list
      fetchEquipment();
    } catch (err) {
      console.error("Error adding equipment:", err);
      setError(err.message || "Failed to add equipment");
    }
  };

  const handleEditEquipment = (equipment) => {
    setSelectedEquipment(equipment);
    setForm({
      equipmentReference: equipment.equipmentReference,
      equipmentType: equipment.equipmentType,
      section: equipment.section,
      brandModel: equipment.brandModel,
      // Note: lastCalibration and calibrationDue are now calculated from calibration records
      // Display them but don't allow editing
      lastCalibration: equipment.lastCalibration
        ? new Date(equipment.lastCalibration).toISOString().split("T")[0]
        : "",
      calibrationDue: equipment.calibrationDue
        ? new Date(equipment.calibrationDue).toISOString().split("T")[0]
        : "",
      calibrationFrequency: equipment.calibrationFrequency,
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
      // Auto-populate calibration frequency based on equipment type
      const frequencyOptions = getCalibrationFrequencyOptions(
        form.equipmentType
      );

      // Auto-calculate calibration due if not provided

      // Note: lastCalibration and calibrationDue are now calculated from calibration records
      // Don't include them in the update
      // Convert calibration frequency to months if needed
      // For Graticules: allow null calibration frequency (they're active forever)
      // For other equipment: preserve existing or use default from frequency options
      let calibrationFrequencyInMonths = null;

      // Check if user explicitly set calibration frequency (including empty string for null)
      const hasExplicitFrequency =
        form.calibrationFrequency !== undefined &&
        form.calibrationFrequency !== null &&
        form.calibrationFrequency !== "";

      // If equipment type is Graticule, allow null calibration frequency
      if (form.equipmentType === "Graticule") {
        // Allow null - graticules don't need calibration frequency
        // If user explicitly cleared it (empty string), set to null
        if (
          form.calibrationFrequency === "" ||
          form.calibrationFrequency === undefined ||
          form.calibrationFrequency === null
        ) {
          calibrationFrequencyInMonths = null;
        } else {
          calibrationFrequencyInMonths = Number(form.calibrationFrequency);
        }
      } else {
        // For other equipment types
        if (hasExplicitFrequency) {
          // User explicitly set a value
          calibrationFrequencyInMonths = Number(form.calibrationFrequency);
        } else {
          // Preserve existing or use default
          calibrationFrequencyInMonths =
            selectedEquipment.calibrationFrequency || null;

          // Only auto-populate if no existing value and frequency options are available
          if (!calibrationFrequencyInMonths && frequencyOptions.length > 0) {
            const freq = frequencyOptions[0];
            if (freq.frequencyUnit === "years") {
              calibrationFrequencyInMonths = freq.frequencyValue * 12;
            } else {
              calibrationFrequencyInMonths = freq.frequencyValue;
            }
          }
        }
      }

      // Ensure we send null (not undefined) to backend
      if (
        calibrationFrequencyInMonths === undefined ||
        calibrationFrequencyInMonths === ""
      ) {
        calibrationFrequencyInMonths = null;
      }

      const formData = {
        equipmentReference: form.equipmentReference,
        equipmentType: form.equipmentType,
        section: form.section,
        brandModel: form.brandModel,
        status: form.status || "active",
        calibrationFrequency: calibrationFrequencyInMonths,
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
        lastCalibration: "",
        calibrationDue: "",
        calibrationFrequency: "",
      });

      // Refresh the equipment list
      fetchEquipment();
    } catch (err) {
      console.error("Error editing equipment:", err);
      setError(err.message || "Failed to edit equipment");
    }
  };

  const handleDeleteEquipment = async (equipmentId) => {
    try {
      await equipmentService.delete(equipmentId);

      // Refresh the equipment list
      fetchEquipment();
    } catch (err) {
      console.error("Error deleting equipment:", err);
      setError(err.message || "Failed to delete equipment");
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
                1000
              );
            console.log("Pump calibration data:", pumpData); // Debug log
            const calibrations = pumpData.data || pumpData || [];
            console.log("Calibrations array:", calibrations); // Debug log

            if (calibrations.length === 0) {
              console.log(
                "No calibrations found for pump:",
                equipment.equipmentReference
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
              }`
            );
          }
          break;

        case "Bubble flowmeter":
        case "Site flowmeter":
          try {
            const flowmeterData =
              await flowmeterCalibrationService.getByFlowmeter(
                equipmentReference
              );
            history = (flowmeterData.calibrations || flowmeterData || []).map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || "N/A",
                type: "Flowmeter Calibration",
              })
            );
          } catch (err) {
            console.error("Error fetching flowmeter calibrations:", err);
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

        case "Phase Contrast Microscope":
          try {
            const pcmData = await pcmMicroscopeService.getByEquipment(
              equipmentReference
            );
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
            const plmData = await plmMicroscopeService.getByEquipment(
              equipmentReference
            );
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
            const stereoData = await stereomicroscopeService.getByEquipment(
              equipmentReference
            );
            history = (stereoData.calibrations || stereoData || []).map(
              (cal) => ({
                date: cal.date,
                calibrationId: cal.calibrationId || cal._id,
                notes: cal.notes || "",
                calibratedBy: cal.calibratedBy?.name || "N/A",
                type: "Stereomicroscope Calibration",
              })
            );
          } catch (err) {
            console.error("Error fetching Stereomicroscope calibrations:", err);
          }
          break;

        case "Graticule":
          try {
            // Try to get archived calibrations first, then active ones
            const archivedData = await graticuleService.getArchivedByEquipment(
              equipmentReference
            );
            const allData = await graticuleService.getAll();
            const filtered = (allData.calibrations || allData || []).filter(
              (cal) =>
                cal.graticuleId === equipmentReference ||
                cal.graticuleReference === equipmentReference
            );
            const archived = archivedData.calibrations || archivedData || [];
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
          "Failed to fetch calibration history"
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

  // Calculate days until calibration is due
  const calculateDaysUntilCalibration = (calibrationDue) => {
    if (!calibrationDue) return null;

    const today = new Date();
    const dueDate = new Date(calibrationDue);

    // Reset time to start of day for accurate day calculation
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  };

  // Calculate the actual status based on calibration data and stored status
  const calculateStatus = useCallback((equipment) => {
    // Handle null/undefined equipment
    if (!equipment) {
      return "Out-of-Service";
    }

    // If explicitly marked as out-of-service, return that
    if (equipment.status === "out-of-service") {
      return "Out-of-Service";
    }

    // If no calibration data (no lastCalibration or no calibrationDue), return out-of-service
    if (!equipment.lastCalibration || !equipment.calibrationDue) {
      return "Out-of-Service";
    }

    // Check if calibration is overdue
    const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
    if (daysUntil !== null && daysUntil < 0) {
      return "Calibration Overdue";
    }

    // If calibrated and not yet due, return active
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
      (freq) => freq.equipmentType.toLowerCase() === equipmentType.toLowerCase()
    );
  };

  // Check if equipment reference is unique
  const checkReferenceUniqueness = (reference, excludeId = null) => {
    if (!reference || !reference.trim()) {
      setReferenceError(null);
      return true;
    }

    const trimmedReference = reference.trim();
    const existing = equipment.find(
      (item) =>
        item.equipmentReference?.toLowerCase() ===
          trimmedReference.toLowerCase() &&
        (!excludeId || item._id !== excludeId)
    );

    if (existing) {
      setReferenceError("Equipment reference already exists");
      return false;
    } else {
      setReferenceError(null);
      return true;
    }
  };

  // Handle equipment reference change with uniqueness check
  const handleReferenceChange = (value, isEdit = false) => {
    const excludeId =
      isEdit && selectedEquipment ? selectedEquipment._id : null;
    setForm({ ...form, equipmentReference: value });
    checkReferenceUniqueness(value, excludeId);
  };

  // Filter equipment based on all filters including calculated status
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          item.equipmentReference?.toLowerCase().includes(searchLower) ||
          item.brandModel?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Equipment type filter
      if (
        filters.equipmentType &&
        item.equipmentType !== filters.equipmentType
      ) {
        return false;
      }

      // Section filter
      if (filters.section && item.section !== filters.section) {
        return false;
      }

      // Status filter (based on calculated status)
      if (filters.status) {
        const calculatedStatus = calculateStatus(item);
        if (calculatedStatus !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }, [equipment, filters, calculateStatus]);

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

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialog(true)}
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
            sx={{ minWidth: 200 }}
            placeholder="Search by reference or brand/model"
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Equipment Type</InputLabel>
            <Select
              value={filters.equipmentType}
              label="Equipment Type"
              onChange={(e) =>
                handleFilterChange("equipmentType", e.target.value)
              }
            >
              <MenuItem value="">All Types</MenuItem>
              {equipmentService.getEquipmentTypes().map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Section</InputLabel>
            <Select
              value={filters.section}
              label="Section"
              onChange={(e) => handleFilterChange("section", e.target.value)}
            >
              <MenuItem value="">All Sections</MenuItem>
              {equipmentService.getSections().map((section) => (
                <MenuItem key={section} value={section}>
                  {section}
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
                equipmentType: "",
                section: "",
                status: "",
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
            backgroundColor: theme.palette.primary.main,
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
            backgroundColor: theme.palette.primary.main,
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
                const calculatedStatus = calculateStatus(params.row);
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
              field: "lastCalibration",
              headerName: "Last Calibration",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                if (!params.row.lastCalibration) {
                  return "-";
                }
                return formatDate(params.row.lastCalibration);
              },
            },
            {
              field: "calibrationDue",
              headerName: "Calibration Due",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                if (!params.row.calibrationDue) {
                  return "-";
                }
                const daysUntil = calculateDaysUntilCalibration(
                  params.row.calibrationDue
                );

                let daysText;
                let daysColor;

                if (daysUntil === 0) {
                  daysText = "Due Today";
                  daysColor = theme.palette.warning.main;
                } else if (daysUntil < 0) {
                  daysText = `${Math.abs(daysUntil)} days overdue`;
                  daysColor = theme.palette.error.main;
                } else {
                  daysText = `${daysUntil} days`;
                  daysColor =
                    daysUntil <= 30
                      ? theme.palette.warning.main
                      : theme.palette.success.main;
                }

                return (
                  <Box>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ color: daysColor }}
                    >
                      {daysText}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: "0.7rem" }}
                    >
                      {formatDate(params.row.calibrationDue)}
                    </Typography>
                  </Box>
                );
              },
            },
            {
              field: "actions",
              headerName: "Actions",
              flex: 1.5,
              minWidth: 200,
              renderCell: ({ row }) => {
                return (
                  <Box display="flex" alignItems="center" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleViewHistory(row)}
                      title="View Calibration History"
                      sx={{ color: theme.palette.info.main }}
                    >
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditEquipment(row)}
                      title="Edit Equipment"
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteEquipment(row._id)}
                      title="Delete Equipment"
                      sx={{ color: theme.palette.error.main }}
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
                label="Last Calibration Date"
                type="date"
                value={form.lastCalibration}
                disabled
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Automatically calculated from calibration records"
              />
              <TextField
                label="Calibration Due Date"
                type="date"
                value={form.calibrationDue}
                disabled
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Automatically calculated from calibration records"
              />
              <TextField
                label="Calibration Frequency (months)"
                type="number"
                value={form.calibrationFrequency || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string or valid number
                  setForm({
                    ...form,
                    calibrationFrequency: value === "" ? "" : Number(value),
                  });
                }}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
                helperText={
                  form.equipmentType === "Graticule"
                    ? "Optional for graticules - leave empty for 'active forever'"
                    : "Leave empty to use default from equipment type, or enter custom value in months"
                }
              />
            </Stack>

            {/* Calibration Frequency Info Display */}
            {form.equipmentType &&
              (form.calibrationFrequency === "" ||
                form.calibrationFrequency === null ||
                form.calibrationFrequency === undefined) && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    backgroundColor: theme.palette.grey[100],
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Default Calibration Frequency for {form.equipmentType}:
                  </Typography>
                  <Typography variant="body2">
                    {getCalibrationFrequencyOptions(form.equipmentType).length >
                    0
                      ? getCalibrationFrequencyOptions(form.equipmentType)
                          .map((freq) => freq.displayText)
                          .join(", ")
                      : "No calibration frequency configured for this equipment type"}
                  </Typography>
                </Box>
              )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setAddDialog(false);
                setReferenceError(null);
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
                label="Last Calibration Date"
                type="date"
                value={form.lastCalibration}
                disabled
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Automatically calculated from calibration records"
              />
              <TextField
                label="Calibration Due Date"
                type="date"
                value={form.calibrationDue}
                disabled
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Automatically calculated from calibration records"
              />
              <TextField
                label="Calibration Frequency (months)"
                type="number"
                value={form.calibrationFrequency || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty string or valid number
                  setForm({
                    ...form,
                    calibrationFrequency: value === "" ? "" : Number(value),
                  });
                }}
                fullWidth
                inputProps={{ min: 0, step: 1 }}
                helperText={
                  form.equipmentType === "Graticule"
                    ? "Optional for graticules - leave empty for 'active forever'"
                    : "Leave empty to use default from equipment type, or enter custom value in months"
                }
              />
            </Stack>

            {/* Calibration Frequency Info Display */}
            {form.equipmentType && form.calibrationFrequency === "" && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  backgroundColor: theme.palette.grey[100],
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  gutterBottom
                >
                  Default Calibration Frequency for {form.equipmentType}:
                </Typography>
                <Typography variant="body2">
                  {getCalibrationFrequencyOptions(form.equipmentType).length > 0
                    ? getCalibrationFrequencyOptions(form.equipmentType)
                        .map((freq) => freq.displayText)
                        .join(", ")
                    : "No calibration frequency configured for this equipment type"}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setEditDialog(false);
                setReferenceError(null);
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
                  backgroundColor: theme.palette.primary.main,
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
                  backgroundColor: theme.palette.primary.main,
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
    </Box>
  );
};

export default EquipmentList;
