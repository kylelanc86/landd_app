import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import { formatDate, formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { graticuleService } from "../../../services/graticuleService";
import { efaService } from "../../../services/efaService";
import userService from "../../../services/userService";

const GraticulePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [calibrations, setCalibrations] = useState([]);

  // Graticule equipment state
  const [graticules, setGraticules] = useState([]);
  const [graticulesLoading, setGraticulesLoading] = useState(false);

  // Combined data for table display
  const [tableData, setTableData] = useState([]);

  // Lab signatories state
  const [labSignatories, setLabSignatories] = useState([]);
  const [labSignatoriesLoading, setLabSignatoriesLoading] = useState(false);

  // PCM microscopes state
  const [pcmMicroscopes, setPcmMicroscopes] = useState([]);
  const [pcmMicroscopesLoading, setPcmMicroscopesLoading] = useState(false);

  // Effective filter areas state (from EFA calibrations)
  const [effectiveArea13mm, setEffectiveArea13mm] = useState(null);
  const [effectiveArea25mm, setEffectiveArea25mm] = useState(null);

  const combineTableData = useCallback(() => {
    // Group calibrations by graticuleId and get the most recent one for each
    const calibrationsByGraticule = {};
    calibrations.forEach((cal) => {
      const graticuleId = cal.graticuleId;
      if (!calibrationsByGraticule[graticuleId]) {
        calibrationsByGraticule[graticuleId] = [];
      }
      calibrationsByGraticule[graticuleId].push(cal);
    });

    // Get the most recent calibration for each graticule (sorted by date descending)
    const mostRecentCalibrations = {};
    Object.keys(calibrationsByGraticule).forEach((graticuleId) => {
      const graticuleCals = calibrationsByGraticule[graticuleId];
      // Sort by date descending to get most recent first
      graticuleCals.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });
      mostRecentCalibrations[graticuleId] = graticuleCals[0];
    });

    // Combine graticule equipment with their most recent calibration data
    const combinedData = graticules.map((graticule) => {
      const calibration = mostRecentCalibrations[graticule.equipmentReference];

      if (calibration) {
        // Graticule has been calibrated - use most recent calibration
        // Status: Active if latest calibration is Pass, Out-of-Service if Fail
        const effectiveStatus =
          calibration.status === "Fail" ? "Out-of-Service" : "Active";
        return {
          ...calibration,
          graticuleEquipment: graticule,
          isCalibrated: true,
          effectiveStatus, // Add effective status for display
        };
      } else {
        // Graticule has not been calibrated yet
        return {
          _id: `uncalibrated-${graticule._id}`,
          graticuleId: graticule.equipmentReference,
          graticuleEquipment: graticule,
          date: null,
          scale: null,
          status: "Not Calibrated",
          effectiveStatus: "Not Calibrated",
          technician: null,
          technicianName: null,
          nextCalibration: null,
          microscopeId: null,
          microscopeReference: null,
          notes: null,
          calibratedBy: null,
          createdAt: null,
          updatedAt: null,
          isCalibrated: false,
        };
      }
    });

    // Sort by graticule ID
    combinedData.sort((a, b) => a.graticuleId.localeCompare(b.graticuleId));

    setTableData(combinedData);
  }, [calibrations, graticules]);

  // Fetch data on component mount
  useEffect(() => {
    fetchCalibrations();
    fetchGraticules();
    fetchLabSignatories();
    fetchPcmMicroscopes();
    fetchEffectiveFilterAreas();
  }, []);

  // Update table data when calibrations or graticules change
  useEffect(() => {
    combineTableData();
  }, [combineTableData]);

  const fetchCalibrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await graticuleService.getAll();
      setCalibrations(response.data || []);
    } catch (err) {
      console.error("Error fetching calibrations:", err);
      setError("Failed to load calibrations");
    } finally {
      setLoading(false);
    }
  };

  const fetchGraticules = async () => {
    try {
      setGraticulesLoading(true);

      // Fetch graticule equipment
      let response = await equipmentService.getAll({
        equipmentType: "Graticule",
        limit: 100,
      });

      // If no results, try without any filters to see all equipment
      if (!response.equipment || response.equipment.length === 0) {
        response = await equipmentService.getAll({
          limit: 100,
        });
      }

      // Filter for graticules from the equipment array
      const graticuleEquipment = (response.equipment || []).filter(
        (item) => item.equipmentType === "Graticule"
      );

      setGraticules(graticuleEquipment);
    } catch (err) {
      console.error("Error fetching graticules:", err);
      setError("Failed to load graticules");
    } finally {
      setGraticulesLoading(false);
    }
  };

  const fetchLabSignatories = async () => {
    try {
      setLabSignatoriesLoading(true);

      const response = await userService.getAll();
      const allUsers = response.data || response || [];

      // Filter users who have signatory=true OR calibration approval=true
      const labSignatoryUsers = allUsers.filter(
        (user) =>
          user.isActive &&
          (user.labSignatory === true || user.labApprovals?.calibrations === true)
      );

      // Sort alphabetically by name
      const sortedUsers = labSignatoryUsers.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setLabSignatories(sortedUsers);
    } catch (err) {
      console.error("Error fetching lab signatories:", err);
      setError("Failed to load lab signatories");
    } finally {
      setLabSignatoriesLoading(false);
    }
  };

  const fetchPcmMicroscopes = async () => {
    try {
      setPcmMicroscopesLoading(true);

      const response = await equipmentService.getAll({
        equipmentType: "Phase Contrast Microscope",
        limit: 100,
      });

      // Filter for PCM microscopes from the equipment array
      const pcmEquipment = (response.equipment || []).filter(
        (item) => item.equipmentType === "Phase Contrast Microscope"
      );

      // Sort by equipment reference
      const sortedPcm = pcmEquipment.sort((a, b) =>
        a.equipmentReference.localeCompare(b.equipmentReference)
      );

      setPcmMicroscopes(sortedPcm);
    } catch (err) {
      console.error("Error fetching PCM microscopes:", err);
      setError("Failed to load PCM microscopes");
    } finally {
      setPcmMicroscopesLoading(false);
    }
  };

  const fetchEffectiveFilterAreas = async () => {
    try {
      // Fetch all EFA calibrations
      const response = await efaService.getAll();
      const allEfaCalibrations = response.data || [];

      // Calculate effective filter area from EFA calibration data
      // Formula: π * (average diameter)² / 4
      const calculateEffectiveArea = (calibration) => {
        const filter1Avg =
          calibration.filter1Diameter1 && calibration.filter1Diameter2
            ? (calibration.filter1Diameter1 + calibration.filter1Diameter2) / 2
            : null;
        const filter2Avg =
          calibration.filter2Diameter1 && calibration.filter2Diameter2
            ? (calibration.filter2Diameter1 + calibration.filter2Diameter2) / 2
            : null;
        const filter3Avg =
          calibration.filter3Diameter1 && calibration.filter3Diameter2
            ? (calibration.filter3Diameter1 + calibration.filter3Diameter2) / 2
            : null;

        if (filter1Avg && filter2Avg && filter3Avg) {
          const overallAvg = (filter1Avg + filter2Avg + filter3Avg) / 3;
          // Area in mm²
          const area = (Math.PI * Math.pow(overallAvg, 2)) / 4;
          return area;
        }
        return null;
      };

      // Find calibrations for 13mm and 25mm filter holders
      // Filter holder models might contain "13" or "25" or be named "13mm" or "25mm"
      // Be careful: "13" might match "130" or "213", so check for word boundaries or exact matches
      const calibrations13mm = allEfaCalibrations.filter((cal) => {
        const model = (cal.filterHolderModel || "").toLowerCase();
        // Match "13mm" or "13 mm" or starts/ends with "13" (but not "130" or "213")
        return (
          model.includes("13mm") ||
          model.includes("13 mm") ||
          model === "13" ||
          /^13[^0-9]/.test(model) ||
          /[^0-9]13$/.test(model)
        );
      });

      const calibrations25mm = allEfaCalibrations.filter((cal) => {
        const model = (cal.filterHolderModel || "").toLowerCase();
        // Match "25mm" or "25 mm" or starts/ends with "25"
        return (
          model.includes("25mm") ||
          model.includes("25 mm") ||
          model === "25" ||
          /^25[^0-9]/.test(model) ||
          /[^0-9]25$/.test(model)
        );
      });

      // Get the most recent calibration for each size
      const latest13mm = calibrations13mm.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];
      const latest25mm = calibrations25mm.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      // Calculate effective areas from calibrations
      let area13mm = null;
      let area25mm = null;

      if (latest13mm) {
        const area = calculateEffectiveArea(latest13mm);
        if (area) {
          // Convert mm² to µm² (1 mm² = 1,000,000 µm²)
          area13mm = area * 1000000;
        }
      }

      if (latest25mm) {
        const area = calculateEffectiveArea(latest25mm);
        if (area) {
          // Convert mm² to µm² (1 mm² = 1,000,000 µm²)
          area25mm = area * 1000000;
        }
      }

      // Use calculated values or fallback to theoretical values
      // Theoretical: π * (13/2)² = 132.73 mm² = 132,730,000 µm²
      setEffectiveArea13mm(area13mm || 132730000);
      // Theoretical: π * (25/2)² = 490.87 mm² = 490,870,000 µm²
      setEffectiveArea25mm(area25mm || 490870000);

      console.log("Effective filter areas loaded:", {
        area13mm: area13mm || 132730000,
        area25mm: area25mm || 490870000,
        fromCalibration: {
          has13mm: !!latest13mm,
          has25mm: !!latest25mm,
        },
      });
    } catch (err) {
      console.error("Error fetching effective filter areas:", err);
      // Use theoretical values as fallback
      setEffectiveArea13mm(132730000); // 132.73 mm² in µm²
      setEffectiveArea25mm(490870000); // 490.87 mm² in µm²
    }
  };

  // Dialog states
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCalibration, setEditingCalibration] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    graticuleId: "",
    graticuleEquipmentId: "",
    date: formatDateForInput(new Date()),
    diameter: "",
    area: "",
    status: "Pass",
    technicianId: "",
    technicianName: "",
    nextCalibration: "",
    microscopeId: "",
    microscopeReference: "",
    constant13mm: "",
    constant25mm: "",
  });

  const handleAdd = () => {
    setEditingCalibration(null);
    const todayDate = formatDateForInput(new Date());
    setFormData({
      graticuleId: "",
      graticuleEquipmentId: "",
      date: todayDate,
      diameter: "",
      area: "",
      status: "Pass",
      technicianId: "",
      technicianName: "",
      nextCalibration: "", // Will be calculated when graticule is selected
      microscopeId: "",
      microscopeReference: "",
      constant13mm: "",
      constant25mm: "",
    });
    setOpenDialog(true);
  };

  const handleEdit = (id) => {
    const item = tableData.find((item) => item._id === id);
    if (item && item.isCalibrated) {
      const calibration = item;
      setEditingCalibration(calibration);

      // Parse scale field to extract diameter
      let diameter = "";
      let area = "";
      if (calibration.scale) {
        // Try to extract diameter from scale field (format: "100 µm (Area: 7853.98 µm²)")
        const diameterMatch = calibration.scale.match(/(\d+(?:\.\d+)?)\s*µm/);
        if (diameterMatch) {
          diameter = diameterMatch[1];
          area = calculateArea(diameter);
        } else {
          // Fallback: try to parse as just diameter value
          diameter = calibration.scale;
          area = calculateArea(diameter);
        }
      }

      // Calculate constants from area if not already set
      const constants =
        calibration.constant13mm && calibration.constant25mm
          ? {
              constant13mm: calibration.constant13mm.toString(),
              constant25mm: calibration.constant25mm.toString(),
            }
          : calculateConstants(area);

      // Find the graticule equipment ID by matching the graticule reference
      const graticuleEquipment = graticules.find(
        (g) => g.equipmentReference === calibration.graticuleId
      );

      // Recalculate next calibration using the correct calibration frequency
      let recalculatedNextCalibration = "";
      if (graticuleEquipment && graticuleEquipment.calibrationFrequency) {
        recalculatedNextCalibration = calculateNextCalibration(
          formatDateForInput(calibration.date),
          graticuleEquipment.calibrationFrequency
        );
        console.log(
          "Recalculated next calibration for edit:",
          recalculatedNextCalibration
        );
      }

      // Find the technician ID by matching the technician name
      const technicianName =
        calibration.technicianName || calibration.technician || "";
      const matchingTechnician = labSignatories.find(
        (tech) => `${tech.firstName} ${tech.lastName}` === technicianName
      );

      // Find the microscope if it exists
      let microscopeId = "";
      let microscopeReference = "";
      if (calibration.microscopeId || calibration.microscopeReference) {
        // Try to find by ID first
        if (calibration.microscopeId) {
          const matchingMicroscope = pcmMicroscopes.find(
            (m) => m._id === calibration.microscopeId
          );
          if (matchingMicroscope) {
            microscopeId = matchingMicroscope._id;
            microscopeReference = matchingMicroscope.equipmentReference;
          }
        }
        // If not found by ID, try by reference
        if (!microscopeId && calibration.microscopeReference) {
          const matchingMicroscope = pcmMicroscopes.find(
            (m) => m.equipmentReference === calibration.microscopeReference
          );
          if (matchingMicroscope) {
            microscopeId = matchingMicroscope._id;
            microscopeReference = matchingMicroscope.equipmentReference;
          } else {
            // Keep the reference even if not found in current list
            microscopeReference = calibration.microscopeReference;
          }
        }
      }

      setFormData({
        graticuleId: calibration.graticuleId,
        graticuleEquipmentId:
          calibration.graticuleEquipmentId || graticuleEquipment?._id || "",
        date: formatDateForInput(calibration.date),
        diameter: diameter,
        area: area,
        status: calibration.status,
        technicianId: matchingTechnician?._id || calibration.technicianId || "",
        technicianName: technicianName,
        nextCalibration:
          recalculatedNextCalibration ||
          formatDateForInput(calibration.nextCalibration),
        microscopeId: microscopeId,
        microscopeReference: microscopeReference,
        constant13mm: constants.constant13mm,
        constant25mm: constants.constant25mm,
      });
      setOpenDialog(true);
    }
  };

  const handleDelete = (id) => {
    const item = tableData.find((item) => item._id === id);
    if (item && item.isCalibrated) {
      setCalibrationToDelete(item);
      setDeleteDialog(true);
    }
  };

  const handleSubmit = async () => {
    console.log("handleSubmit called");
    console.log("Form data:", formData);

    try {
      setLoading(true);
      setError(null);

      // Validate form
      if (
        !formData.graticuleEquipmentId ||
        !formData.date ||
        !formData.diameter ||
        !formData.technicianId
      ) {
        console.log("Validation failed:", {
          graticuleEquipmentId: formData.graticuleEquipmentId,
          date: formData.date,
          diameter: formData.diameter,
          technicianId: formData.technicianId,
        });
        setError("Please fill in all required fields");
        return;
      }

      // Additional validation for backend requirements
      if (!formData.graticuleId && !formData.graticuleEquipmentId) {
        setError("Please select a graticule");
        return;
      }

      if (!formData.technicianName) {
        setError("Please select a technician");
        return;
      }

      // Get selected graticule for reference (calibration frequency is optional for graticules)
      const selectedGraticule = graticules.find(
        (g) => g._id === formData.graticuleEquipmentId
      );

      console.log("All validations passed, proceeding with submission");

      // Map form data to backend expected format
      // For graticules: nextCalibration is optional - graticules are active forever unless status is Fail
      const backendData = {
        graticuleId: formData.graticuleId, // Just the graticule ID
        graticuleEquipmentId: formData.graticuleEquipmentId, // Store original equipment ID for filtering
        date: new Date(formData.date), // Ensure date is a Date object
        scale: `${formData.diameter} µm`, // Just the diameter
        status: formData.status,
        technician: formData.technicianName, // Send technician name instead of ID
        // Calculate nextCalibration if frequency exists, otherwise use a far future date to indicate "active forever"
        nextCalibration: formData.nextCalibration
          ? new Date(formData.nextCalibration + "T00:00:00")
          : new Date("2099-12-31"), // Far future date to indicate active forever
        // Include microscope assignment if selected
        microscopeId: formData.microscopeId || null,
        microscopeReference: formData.microscopeReference || null,
        // Include constants for 13mm and 25mm filter holders
        constant13mm: formData.constant13mm
          ? parseFloat(formData.constant13mm)
          : null,
        constant25mm: formData.constant25mm
          ? parseFloat(formData.constant25mm)
          : null,
      };

      console.log("Backend data being sent:", backendData);
      console.log(
        "Next calibration in backend data:",
        backendData.nextCalibration
      );

      if (editingCalibration) {
        // Update existing calibration
        await graticuleService.update(editingCalibration._id, backendData);
      } else {
        // Add new calibration
        await graticuleService.create(backendData);
      }

      // Update the equipment record with new calibration date
      // For graticules: only update lastCalibration, not calibrationDue (they're active forever unless status is Fail)
      try {
        const equipmentUpdateData = {
          lastCalibration: new Date(formData.date),
          // Don't set calibrationDue for graticules - they're active forever unless latest calibration fails
        };

        console.log(
          "Updating equipment calibration date:",
          equipmentUpdateData
        );
        await equipmentService.update(
          formData.graticuleEquipmentId,
          equipmentUpdateData
        );
      } catch (equipmentError) {
        console.error(
          "Failed to update equipment calibration date:",
          equipmentError
        );
        // Don't fail the whole operation if equipment update fails
      }

      setOpenDialog(false);
      setEditingCalibration(null);
      // Refresh the data
      await fetchCalibrations();
      await fetchGraticules(); // Refresh graticule data to get updated calibration dates

      // Trigger a custom event to notify other components that equipment data has been updated
      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.graticuleEquipmentId },
        })
      );
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setLoading(true);
      setError(null);

      await graticuleService.delete(calibrationToDelete._id);
      setDeleteDialog(false);
      setCalibrationToDelete(null);
      // Refresh the data
      await fetchCalibrations();
    } catch (err) {
      setError(err.message || "Failed to delete calibration");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCalibration(null);
    setError(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog(false);
    setCalibrationToDelete(null);
  };

  const handleGraticuleChange = (graticuleEquipmentId) => {
    const selectedGraticule = graticules.find(
      (g) => g._id === graticuleEquipmentId
    );

    console.log("Graticule selected:", {
      graticuleEquipmentId,
      selectedGraticule,
      calibrationFrequency: selectedGraticule?.calibrationFrequency,
    });

    // Calculate next calibration date using current form date
    let nextCalibration = "";
    if (
      selectedGraticule &&
      selectedGraticule.calibrationFrequency &&
      formData.date
    ) {
      nextCalibration = calculateNextCalibration(
        formData.date,
        selectedGraticule.calibrationFrequency
      );
      console.log(
        "Next calibration calculated on graticule change:",
        nextCalibration
      );
    }

    setFormData((prev) => ({
      ...prev,
      graticuleEquipmentId: graticuleEquipmentId,
      graticuleId: selectedGraticule
        ? selectedGraticule.equipmentReference
        : "",
      nextCalibration: nextCalibration,
    }));

    // Clear any existing errors when selecting a new graticule
    setError(null);

    // Note: Calibration frequency is optional for graticules - they're active forever unless status is Fail
  };

  const handleTechnicianChange = (technicianId) => {
    const selectedTechnician = labSignatories.find(
      (t) => t._id === technicianId
    );
    setFormData((prev) => ({
      ...prev,
      technicianId: technicianId,
      technicianName: selectedTechnician
        ? `${selectedTechnician.firstName} ${selectedTechnician.lastName}`
        : "",
    }));
  };

  const handleMicroscopeChange = (microscopeEquipmentId) => {
    const selectedMicroscope = pcmMicroscopes.find(
      (m) => m._id === microscopeEquipmentId
    );
    setFormData((prev) => ({
      ...prev,
      microscopeId: microscopeEquipmentId,
      microscopeReference: selectedMicroscope
        ? selectedMicroscope.equipmentReference
        : "",
    }));
  };

  const calculateNextCalibration = (calibrationDate, calibrationFrequency) => {
    if (!calibrationDate || !calibrationFrequency) return "";

    const date = new Date(calibrationDate);
    const frequency = parseInt(calibrationFrequency);

    if (isNaN(frequency)) return "";

    // Add the frequency in months to the calibration date
    date.setMonth(date.getMonth() + frequency);

    return formatDateForInput(date);
  };

  const calculateArea = (diameter) => {
    if (!diameter || isNaN(parseFloat(diameter))) return "";

    const d = parseFloat(diameter);
    const area = (Math.PI * d * d) / 4;

    return area.toFixed(2);
  };

  // Calculate constants for 13mm and 25mm filter holders
  // Uses effective filter areas from EFA calibration data (or theoretical values as fallback)
  // Constants are rounded to the nearest multiple of 10 (no decimals)
  const calculateConstants = (areaInUm2) => {
    if (!areaInUm2 || isNaN(parseFloat(areaInUm2))) {
      return { constant13mm: "", constant25mm: "" };
    }

    const area = parseFloat(areaInUm2);
    if (area === 0) {
      return { constant13mm: "", constant25mm: "" };
    }

    // Use effective filter areas from state (fetched from EFA calibrations)
    // Fallback to theoretical values if not yet loaded
    const effectiveArea13mmValue = effectiveArea13mm || 132730000; // 132.73 mm² in µm²
    const effectiveArea25mmValue = effectiveArea25mm || 490870000; // 490.87 mm² in µm²

    // Calculate constants and round to nearest multiple of 10
    const constant13mmRaw = effectiveArea13mmValue / area;
    const constant25mmRaw = effectiveArea25mmValue / area;

    const constant13mm = Math.round(constant13mmRaw / 10) * 10;
    const constant25mm = Math.round(constant25mmRaw / 10) * 10;

    return {
      constant13mm: constant13mm.toString(),
      constant25mm: constant25mm.toString(),
    };
  };

  const calculateStatus = (diameter) => {
    if (!diameter || isNaN(parseFloat(diameter))) return "Pass";

    const d = parseFloat(diameter);

    // Pass if diameter is between 98 and 102 µm
    if (d >= 98 && d <= 102) {
      return "Pass";
    } else {
      return "Fail";
    }
  };

  const handleDiameterChange = (diameter) => {
    const area = calculateArea(diameter);
    const status = calculateStatus(diameter);
    // Recalculate constants whenever diameter/area changes
    const constants = calculateConstants(area);

    setFormData((prev) => ({
      ...prev,
      diameter: diameter,
      area: area,
      status: status,
      constant13mm: constants.constant13mm,
      constant25mm: constants.constant25mm,
    }));
  };

  // Recalculate constants when effective areas are loaded and form has area
  useEffect(() => {
    if (
      formData.area &&
      formData.diameter &&
      (effectiveArea13mm || effectiveArea25mm)
    ) {
      const constants = calculateConstants(formData.area);
      setFormData((prev) => {
        // Only update if constants have changed to avoid unnecessary re-renders
        if (
          prev.constant13mm !== constants.constant13mm ||
          prev.constant25mm !== constants.constant25mm
        ) {
          return {
            ...prev,
            constant13mm: constants.constant13mm,
            constant25mm: constants.constant25mm,
          };
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveArea13mm, effectiveArea25mm, formData.area]);

  const handleDateChange = (date) => {
    const selectedGraticule = graticules.find(
      (g) => g._id === formData.graticuleEquipmentId
    );

    console.log("Date change debug:", {
      date,
      graticuleEquipmentId: formData.graticuleEquipmentId,
      selectedGraticule,
      calibrationFrequency: selectedGraticule?.calibrationFrequency,
    });

    let nextCalibration = "";

    // Calculate next calibration if frequency exists (optional for graticules)
    if (selectedGraticule && selectedGraticule.calibrationFrequency) {
      nextCalibration = calculateNextCalibration(
        date,
        selectedGraticule.calibrationFrequency
      );
      console.log("Calculated next calibration:", nextCalibration);
    }
    // Note: If no calibration frequency, nextCalibration remains empty
    // Graticules are active forever unless latest calibration status is Fail

    setFormData((prev) => ({
      ...prev,
      date: date,
      nextCalibration: nextCalibration,
    }));
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations");
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  // Calculate days until calibration is due
  const calculateDaysUntilCalibration = (nextCalibrationDate) => {
    if (!nextCalibrationDate) return null;

    const today = new Date();
    const calibrationDate = new Date(nextCalibrationDate);

    // Reset time to start of day for accurate day calculation
    today.setHours(0, 0, 0, 0);
    calibrationDate.setHours(0, 0, 0, 0);

    const timeDiff = calibrationDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    return daysDiff;
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Graticule Calibrations
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
            Records Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToCalibrations}
            sx={{ cursor: "pointer" }}
          >
            Calibrations
          </Link>
          <Typography color="text.primary">Graticule Calibrations</Typography>
        </Breadcrumbs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        display="flex"
        justifyContent="flex-end"
        alignItems="center"
        mb="20px"
        gap={2}
      >
        <Button
          variant="outlined"
          startIcon={<HistoryIcon />}
          onClick={() =>
            navigate("/records/laboratory/calibrations/graticule/history")
          }
        >
          Historical Data
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Graticule ID</TableCell>
              <TableCell>Calibration Date</TableCell>
              <TableCell>Diameter (µm)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Next Calibration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : tableData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No graticules found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              tableData.map((item) => (
                <TableRow key={item._id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {item.graticuleId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.date ? formatDate(item.date) : "-"}
                  </TableCell>
                  <TableCell>
                    {item.scale
                      ? item.scale.replace(/ µm \(Area: [\d.]+ µm²\)/, " µm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        backgroundColor:
                          item.status === "Pass"
                            ? theme.palette.success.main
                            : item.status === "Fail"
                            ? theme.palette.error.main
                            : theme.palette.grey[500],
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        display: "inline-block",
                      }}
                    >
                      {item.status}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.technicianName || item.technician || "-"}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // For graticules: show "Active Forever" unless latest calibration failed
                      // Check if nextCalibration is a far future date (2099) indicating "active forever"
                      if (
                        !item.nextCalibration ||
                        new Date(item.nextCalibration).getFullYear() >= 2099
                      ) {
                        // Graticules are active forever unless latest calibration status is Fail
                        if (item.status === "Fail") {
                          return (
                            <Typography
                              variant="body2"
                              sx={{ color: theme.palette.error.main }}
                            >
                              Out of Service
                            </Typography>
                          );
                        }
                        return (
                          <Typography
                            variant="body2"
                            sx={{ color: theme.palette.success.main }}
                            fontWeight="medium"
                          >
                            Active Forever
                          </Typography>
                        );
                      }

                      // If there's a specific nextCalibration date, show it (for backward compatibility)
                      const daysUntil = calculateDaysUntilCalibration(
                        item.nextCalibration
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
                            {formatDate(item.nextCalibration)}
                          </Typography>
                        </Box>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {item.isCalibrated ? (
                      <>
                        <IconButton
                          onClick={() => handleEdit(item._id)}
                          size="small"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(item._id)}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Not calibrated
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCalibration ? "Edit Calibration" : "Add New Calibration"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Graticule</InputLabel>
              <Select
                value={formData.graticuleEquipmentId}
                onChange={(e) => handleGraticuleChange(e.target.value)}
                label="Graticule"
                disabled={graticulesLoading}
              >
                <MenuItem value="">
                  <em>Select a graticule</em>
                </MenuItem>
                {graticules.length > 0 ? (
                  graticules.map((graticule) => (
                    <MenuItem key={graticule._id} value={graticule._id}>
                      {graticule.equipmentReference}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {graticulesLoading ? "Loading..." : "No graticules found"}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Calibration Date"
              type="date"
              value={formData.date}
              onChange={(e) => handleDateChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              fullWidth
              label="Diameter (µm)"
              value={formData.diameter}
              onChange={(e) => handleDiameterChange(e.target.value)}
              placeholder="e.g., 100"
              type="number"
              inputProps={{ step: "0.01", min: "0" }}
              required
            />
            <TextField
              fullWidth
              label="Graticule Area (µm²)"
              value={formData.area}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Automatically calculated using (πd²)/4"
            />
            <TextField
              fullWidth
              label="Constant for 13mm Filter Holder"
              value={formData.constant13mm}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Calculated as: (Effective Filter Area 13mm) / (Graticule Area)"
            />
            <TextField
              fullWidth
              label="Constant for 25mm Filter Holder"
              value={formData.constant25mm}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Calculated as: (Effective Filter Area 25mm) / (Graticule Area)"
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={formData.status} label="Status" disabled>
                <MenuItem value="Pass">Pass</MenuItem>
                <MenuItem value="Fail">Fail</MenuItem>
              </Select>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block" }}
              >
                Pass: 98-102 µm
              </Typography>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Technician</InputLabel>
              <Select
                value={formData.technicianId}
                onChange={(e) => handleTechnicianChange(e.target.value)}
                label="Technician"
                disabled={labSignatoriesLoading}
              >
                <MenuItem value="">
                  <em>Select a technician</em>
                </MenuItem>
                {labSignatories.length > 0 ? (
                  labSignatories.map((technician) => (
                    <MenuItem key={technician._id} value={technician._id}>
                      {technician.firstName} {technician.lastName}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {labSignatoriesLoading
                      ? "Loading..."
                      : "No lab signatories found"}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>PCM Microscope</InputLabel>
              <Select
                value={formData.microscopeId}
                onChange={(e) => handleMicroscopeChange(e.target.value)}
                label="PCM Microscope"
                disabled={pcmMicroscopesLoading}
              >
                <MenuItem value="">
                  <em>Select a PCM microscope (optional)</em>
                </MenuItem>
                {pcmMicroscopes.length > 0 ? (
                  pcmMicroscopes.map((microscope) => (
                    <MenuItem key={microscope._id} value={microscope._id}>
                      {microscope.equipmentReference}
                    </MenuItem>
                  ))
                ) : (
                  <MenuItem disabled>
                    {pcmMicroscopesLoading
                      ? "Loading..."
                      : "No PCM microscopes found"}
                  </MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Next Calibration (Optional)"
              type="date"
              value={formData.nextCalibration}
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Graticules are active forever unless calibration status is Fail. This field is calculated if calibration frequency is set, but not required."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? (
              <CircularProgress size={20} />
            ) : editingCalibration ? (
              "Update"
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the calibration record for graticule{" "}
            {calibrationToDelete?.graticuleId}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GraticulePage;
