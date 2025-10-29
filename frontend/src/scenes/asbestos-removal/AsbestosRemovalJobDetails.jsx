import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSnackbar } from "../../context/SnackbarContext";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Grid,
  Radio,
  RadioGroup,
  FormLabel,
  Autocomplete,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { tokens } from "../../theme/tokens";
import api from "../../services/api";
import {
  jobService,
  shiftService,
  sampleService,
  projectService,
  clientService,
} from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import userService from "../../services/userService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";
import { generateShiftReport } from "../../utils/generateShiftReport";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/dateFormat";
import { hasPermission } from "../../config/permissions";
import PermissionGate from "../../components/PermissionGate";

const AsbestosRemovalJobDetails = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { currentUser } = useAuth();

  // Debug logging for current user
  useEffect(() => {
    console.log("Current User in AsbestosRemovalJobDetails:", {
      id: currentUser?._id,
      firstName: currentUser?.firstName,
      lastName: currentUser?.lastName,
      role: currentUser?.role,
      labSignatory: currentUser?.labSignatory,
      fullUser: currentUser,
    });
  }, [currentUser]);

  const [job, setJob] = useState(null);
  const [airMonitoringShifts, setAirMonitoringShifts] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [asbestosAssessors, setAsbestosAssessors] = useState([]);
  const [creating, setCreating] = useState(false);

  // Clearance modal state
  const [clearanceDialogOpen, setClearanceDialogOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState(null);
  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const { showSnackbar } = useSnackbar();
  const [reportViewedShiftIds, setReportViewedShiftIds] = useState(new Set());
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState("");
  const [editingShift, setEditingShift] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetShiftId, setResetShiftId] = useState(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'clearance' or 'shift'

  const [clearanceForm, setClearanceForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "09:00 AM",
    clearanceType: "Non-friable",
    LAA: "",
    asbestosRemovalist: "",
    jurisdiction: "ACT",
    secondaryHeader: "",
    vehicleEquipmentDescription: "",
    airMonitoring: false,
    airMonitoringReport: null,
    airMonitoringReportType: "select",
    notes: "",
    useComplexTemplate: false,
    jobSpecificExclusions: "",
  });

  const fetchAsbestosAssessors = useCallback(async () => {
    try {
      const response = await userService.getAll();
      const users = response.data;

      // Filter users who have Asbestos Assessor licenses
      const assessors = users.filter(
        (user) =>
          user.isActive &&
          user.licences &&
          user.licences.some(
            (licence) =>
              licence.licenceType &&
              licence.licenceType.toLowerCase().includes("asbestos assessor")
          )
      );

      // Sort alphabetically by name
      const sortedAssessors = assessors.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setAsbestosAssessors(sortedAssessors);
    } catch (error) {
      console.error("Error fetching asbestos assessors:", error);
    }
  }, []);

  const fetchJobDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch the asbestos removal job
      const jobResponse = await asbestosRemovalJobService.getById(jobId);
      const jobData = jobResponse.data;
      setJob(jobData);

      // Fetch air monitoring jobs for this project
      const airMonitoringResponse = await jobService.getAll();
      const allAirMonitoringJobs =
        airMonitoringResponse.data || airMonitoringResponse.jobs || [];
      const projectAirMonitoringJobs = allAirMonitoringJobs.filter(
        (job) => job.projectId === jobData.projectId
      );

      // Fetch shifts for each air monitoring job
      const shiftsWithJobs = await Promise.all(
        projectAirMonitoringJobs.map(async (monitoringJob) => {
          try {
            const shiftsResponse = await shiftService.getByJob(
              monitoringJob._id
            );
            const shifts = shiftsResponse.data || [];
            return shifts.map((shift) => ({
              ...shift,
              jobName: monitoringJob.name,
              jobId: monitoringJob._id,
            }));
          } catch (error) {
            console.error(
              `Error fetching shifts for job ${monitoringJob._id}:`,
              error
            );
            return [];
          }
        })
      );

      // Fetch shifts for this asbestos removal job
      let jobShifts = [];
      try {
        console.log("Fetching shifts for asbestos removal job:", jobId);
        const allShiftsResponse = await shiftService.getAll();
        console.log("All shifts response:", allShiftsResponse);

        // Filter shifts that belong to this job (check job, jobId, and projectId fields)
        const filteredShifts = (allShiftsResponse.data || []).filter(
          (shift) => {
            const shiftJobId = shift.job?._id || shift.job || shift.jobId;
            const jobMatches = shiftJobId === jobId;

            // Fallback: if job field is null, try matching by projectId
            const projectMatches =
              shift.projectId === jobData.projectId ||
              shift.projectId === jobData.projectId._id ||
              shift.projectId?._id === jobData.projectId ||
              shift.projectId?._id === jobData.projectId._id;

            const matches = jobMatches || projectMatches;
            console.log(
              `Shift ${shift._id} fields:`,
              {
                job: shift.job,
                jobId: shift.jobId,
                projectId: shift.projectId,
                resolvedJobId: shiftJobId,
              },
              "jobMatches:",
              jobMatches,
              "projectMatches:",
              projectMatches,
              "final matches:",
              matches
            );
            return matches;
          }
        );

        // Fetch sample numbers for each shift
        jobShifts = await Promise.all(
          filteredShifts.map(async (shift) => {
            try {
              const samplesResponse = await sampleService.getByShift(shift._id);
              const sampleNumbers = (samplesResponse.data || [])
                .map((sample) => {
                  // Extract just the number part from AM prefix (e.g., "AM1" -> "1")
                  const match = sample.fullSampleID?.match(/AM(\d+)$/);
                  return match ? match[1] : null;
                })
                .filter(Boolean)
                .sort((a, b) => parseInt(a) - parseInt(b));

              return {
                ...shift,
                jobName: jobData.name || "Asbestos Removal Job",
                jobId: jobId,
                sampleNumbers,
              };
            } catch (error) {
              console.error(
                `Error fetching samples for shift ${shift._id}:`,
                error
              );
              return {
                ...shift,
                jobName: jobData.name || "Asbestos Removal Job",
                jobId: jobId,
                sampleNumbers: [],
              };
            }
          })
        );

        console.log("Job shifts:", jobShifts);
      } catch (error) {
        console.error("Error fetching job shifts:", error);
      }

      const allShifts = [...shiftsWithJobs.flat(), ...jobShifts];
      console.log("All shifts (air monitoring + job):", allShifts);
      setAirMonitoringShifts(allShifts);

      // Fetch clearances for this project
      const clearancesResponse = await asbestosClearanceService.getAll();
      console.log("Raw clearances response:", clearancesResponse);
      const allClearances =
        clearancesResponse.data ||
        clearancesResponse.jobs ||
        clearancesResponse.clearances ||
        [];
      console.log("All clearances:", allClearances);
      console.log("Job data projectId:", jobData.projectId);

      const projectClearances = allClearances.filter((clearance) => {
        const matches =
          clearance.projectId === jobData.projectId ||
          clearance.projectId === jobData.projectId._id ||
          clearance.projectId?._id === jobData.projectId ||
          clearance.projectId?._id === jobData.projectId._id;
        console.log(
          `Clearance ${clearance._id} projectId:`,
          clearance.projectId,
          "matches:",
          matches
        );
        return matches;
      });
      console.log("Filtered project clearances:", projectClearances);
      setClearances(projectClearances);
    } catch (err) {
      console.error("Error fetching job details:", err);
      setError(err.message || "Failed to fetch job details");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const fetchAsbestosRemovalists = useCallback(async () => {
    try {
      const data = await customDataFieldGroupService.getFieldsByType(
        "asbestos_removalist"
      );
      const sortedData = (data || []).sort((a, b) =>
        (a.text || "").localeCompare(b.text || "")
      );
      setAsbestosRemovalists(sortedData);
    } catch (error) {
      console.error("Error fetching asbestos removalists:", error);
      setAsbestosRemovalists([]);
    }
  }, []);

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
      fetchAsbestosRemovalists();
      fetchAsbestosAssessors();
    }
  }, [
    jobId,
    fetchJobDetails,
    fetchAsbestosRemovalists,
    fetchAsbestosAssessors,
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case "shift_complete":
      case "analysis_complete":
        return theme.palette.success.main;
      case "sampling_complete":
      case "samples_submitted_to_lab":
        return theme.palette.warning.main;
      case "sampling_in_progress":
        return theme.palette.primary.main;
      case "Complete":
        return theme.palette.success.main;
      case "In Progress":
        return theme.palette.warning.main;
      case "Active":
        return theme.palette.primary.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const formatStatusLabel = (status) => {
    if (!status) return "Unknown";

    // Handle specific status mappings
    const statusMap = {
      shift_complete: "Shift Complete",
      analysis_complete: "Analysis Complete",
      sampling_complete: "Sampling Complete",
      samples_submitted_to_lab: "Samples Submitted to Lab",
      sampling_in_progress: "Sampling In Progress",
      complete: "Complete",
      in_progress: "In Progress",
      active: "Active",
    };

    // Return mapped status or format by replacing underscores and capitalizing
    return (
      statusMap[status] ||
      status
        .split("_")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ")
    );
  };

  const getLaaName = (laaId) => {
    if (!laaId) return "N/A";

    // If it's already a name (backward compatibility), return as is
    if (typeof laaId === "string" && !laaId.match(/^[0-9a-fA-F]{24}$/)) {
      return laaId;
    }

    // If it's a user ID, look up the user's name
    const user = asbestosAssessors.find((assessor) => assessor._id === laaId);
    return user ? `${user.firstName} ${user.lastName}` : "Unknown User";
  };

  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return "09:00 AM";

    // If it's already in the new format (HH:MM AM/PM), return as is
    if (timeString.includes("AM") || timeString.includes("PM")) {
      return timeString;
    }

    // If it's in 24-hour format (HH:MM), convert to 12-hour format
    if (timeString.match(/^\d{1,2}:\d{2}$/)) {
      const [hours, minutes] = timeString.split(":");
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? "PM" : "AM";
      return `${hour12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
    }

    // Default fallback
    return "09:00 AM";
  };

  const handleBackToJobs = () => {
    navigate("/asbestos-removal");
  };

  const handleCompleteJob = async () => {
    try {
      // Update the job status to completed
      await asbestosRemovalJobService.update(jobId, { status: "completed" });

      // Show success message
      showSnackbar("Job marked as completed successfully", "success");

      // Navigate back to jobs page
      navigate("/asbestos-removal");
    } catch (error) {
      console.error("Error completing job:", error);
      setError("Failed to complete job. Please try again.");
    }
  };

  // Check if all shifts and clearances are complete
  const allShiftsComplete =
    airMonitoringShifts.length > 0 &&
    airMonitoringShifts.every((shift) => shift.status === "shift_complete");

  const allClearancesComplete =
    clearances.length > 0 &&
    clearances.every((clearance) => clearance.status === "complete");

  // Job can only be completed if:
  // 1. Job is not already completed
  // 2. At least one shift or clearance has been added
  // 3. All shifts are complete (if there are any)
  // 4. All clearances are complete (if there are any)
  const hasShiftsOrClearances =
    airMonitoringShifts.length > 0 || clearances.length > 0;

  const canCompleteJob =
    job &&
    job.status !== "completed" &&
    hasShiftsOrClearances &&
    (airMonitoringShifts.length === 0 || allShiftsComplete) &&
    (clearances.length === 0 || allClearancesComplete);

  const handleViewReport = async (shift) => {
    try {
      // Fetch the latest shift data
      const shiftResponse = await shiftService.getById(shift._id);
      const latestShift = shiftResponse.data;

      // Fetch job and samples for this shift - use correct service based on jobModel
      let jobResponse;
      if (latestShift.jobModel === "AsbestosRemovalJob") {
        jobResponse = await asbestosRemovalJobService.getById(
          latestShift.job?._id || latestShift.job
        );
      } else {
        jobResponse = await jobService.getById(
          latestShift.job?._id || latestShift.job
        );
      }
      const samplesResponse = await sampleService.getByShift(latestShift._id);

      // Ensure we have the complete sample data including analysis
      const samplesWithAnalysis = await Promise.all(
        samplesResponse.data.map(async (sample) => {
          if (!sample.analysis) {
            // If analysis data is missing, fetch the complete sample data
            const completeSample = await sampleService.getById(sample._id);
            return completeSample.data;
          }
          return sample;
        })
      );

      // Ensure project and client are fully populated
      let project = jobResponse.data.projectId;
      if (project && typeof project === "string") {
        const projectResponse = await projectService.getById(project);
        project = projectResponse.data;
      }
      if (project && project.client && typeof project.client === "string") {
        const clientResponse = await clientService.getById(project.client);
        project.client = clientResponse.data;
      }

      console.log(
        "AsbestosRemovalJobDetails - Latest shift data:",
        latestShift
      );
      console.log(
        "AsbestosRemovalJobDetails - Site plan flag:",
        latestShift.sitePlan
      );
      console.log(
        "AsbestosRemovalJobDetails - Site plan data:",
        latestShift.sitePlanData
      );

      generateShiftReport({
        shift: latestShift,
        job: jobResponse.data,
        samples: samplesWithAnalysis,
        project,
        openInNewTab: !shift.reportApprovedBy, // download if authorised, open if not
        sitePlanData: latestShift.sitePlan
          ? {
              sitePlan: latestShift.sitePlan,
              sitePlanData: latestShift.sitePlanData,
            }
          : null,
      });
      setReportViewedShiftIds((prev) => new Set(prev).add(shift._id));
    } catch (err) {
      console.error("Error generating report:", err);
      showSnackbar("Failed to generate report.", "error");
    }
  };

  const handleAuthoriseReport = async (shift) => {
    try {
      const now = new Date().toISOString();
      const approver =
        currentUser?.firstName && currentUser?.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser?.name || currentUser?.email || "Unknown";

      // First get the current shift data
      const currentShift = await shiftService.getById(shift._id);

      // Create the updated shift data by spreading the current data and updating the fields we want
      const updatedShiftData = {
        ...currentShift.data,
        job: currentShift.data.job._id, // Convert to string ID
        supervisor: currentShift.data.supervisor._id, // Convert to string ID
        defaultSampler: currentShift.data.defaultSampler, // Keep as is
        status: "shift_complete",
        reportApprovedBy: approver,
        reportIssueDate: now,
      };

      // Log the data being sent
      console.log("Updating shift with data:", updatedShiftData);

      // Update shift with report approval
      const response = await shiftService.update(shift._id, updatedShiftData);

      // Log the response
      console.log("Update response:", response.data);

      // Generate and download the report
      try {
        // Fetch job and samples for this shift - use correct service based on jobModel
        let jobResponse;
        if (currentShift.data.jobModel === "AsbestosRemovalJob") {
          jobResponse = await asbestosRemovalJobService.getById(
            shift.job?._id || shift.job
          );
        } else {
          jobResponse = await jobService.getById(shift.job?._id || shift.job);
        }
        const samplesResponse = await sampleService.getByShift(shift._id);

        // Ensure we have the complete sample data including analysis
        const samplesWithAnalysis = await Promise.all(
          samplesResponse.data.map(async (sample) => {
            if (!sample.analysis) {
              // If analysis data is missing, fetch the complete sample data
              const completeSample = await sampleService.getById(sample._id);
              return completeSample.data;
            }
            return sample;
          })
        );

        // Ensure project and client are fully populated
        let project = jobResponse.data.projectId;
        if (project && typeof project === "string") {
          const projectResponse = await projectService.getById(project);
          project = projectResponse.data;
        }
        if (project && project.client && typeof project.client === "string") {
          const clientResponse = await clientService.getById(project.client);
          project.client = clientResponse.data;
        }

        generateShiftReport({
          shift: updatedShiftData,
          job: jobResponse.data,
          samples: samplesWithAnalysis,
          project,
          openInNewTab: false, // Always download when authorised
          sitePlanData: updatedShiftData.sitePlan
            ? {
                sitePlan: updatedShiftData.sitePlan,
                sitePlanData: updatedShiftData.sitePlanData,
              }
            : null,
        });

        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success"
        );

        // Refresh the shifts data
        fetchJobDetails();
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Error authorising report:", error);
      showSnackbar("Failed to authorise report. Please try again.", "error");
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleCreateAirMonitoringShift = () => {
    setNewShiftDate("");
    setShiftDialogOpen(true);
  };

  const handleCreateClearance = () => {
    setEditingClearance(null);
    resetClearanceForm();
    setClearanceDialogOpen(true);
  };

  const handleSetToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    setNewShiftDate(formattedDate);
  };

  const handleShiftSubmit = async () => {
    try {
      // First update the job status to 'in_progress'
      await asbestosRemovalJobService.update(jobId, { status: "in_progress" });

      // Then create the new shift
      const shiftData = {
        job: jobId,
        jobModel: "AsbestosRemovalJob",
        projectId: job?.projectId?._id,
        name: `Shift ${airMonitoringShifts.length + 1}`,
        date: newShiftDate,
        startTime: "08:00",
        endTime: "16:00",
        supervisor: currentUser._id,
        status: "ongoing",
        descriptionOfWorks: "",
      };

      console.log("Creating shift with data:", shiftData);
      const response = await shiftService.create(shiftData);
      console.log("New shift created:", response.data);

      // Add the new shift directly to state since backend isn't saving job/projectId fields
      if (response.data) {
        const newShift = {
          ...response.data,
          job: jobId, // Ensure job field is set
          projectId: job?.projectId?._id, // Ensure projectId field is set
          jobName: job?.name || "Asbestos Removal Job",
          jobId: jobId,
        };
        setAirMonitoringShifts((prev) => [...prev, newShift]);
      }

      handleCloseShiftDialog();

      showSnackbar("Air monitoring shift created successfully", "success");
    } catch (error) {
      console.error("Error creating shift:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error message:", error.message);

      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create shift. Please try again.";

      showSnackbar(errorMessage, "error");
    }
  };

  const handleClearanceRowClick = (clearance) => {
    // Navigate to clearance items page
    navigate(`/clearances/${clearance._id}/items`);
  };

  const handleShiftRowClick = (shift) => {
    // Navigate to air monitoring sample list page for this shift
    navigate(`/air-monitoring/shift/${shift._id}/samples`);
  };

  const handleResetStatus = async (shiftId) => {
    setResetShiftId(shiftId);
    setResetDialogOpen(true);
  };

  const confirmResetStatus = async () => {
    if (!resetShiftId) return;
    try {
      // Get the current shift data first
      const currentShift = await shiftService.getById(resetShiftId);

      // Update shift status while preserving analysis data but clearing report authorization
      await shiftService.update(resetShiftId, {
        status: "ongoing",
        analysedBy: currentShift.data.analysedBy,
        analysisDate: currentShift.data.analysisDate,
        reportApprovedBy: null,
        reportIssueDate: null,
      });

      // Refetch job details to update UI
      await fetchJobDetails();
      setResetDialogOpen(false);
      setResetShiftId(null);

      showSnackbar("Shift status reset to ongoing successfully.", "success");
    } catch (err) {
      console.error("Error resetting shift status:", err);
      showSnackbar("Failed to reset shift status.", "error");
      setResetDialogOpen(false);
      setResetShiftId(null);
    }
  };

  const cancelResetStatus = () => {
    setResetDialogOpen(false);
    setResetShiftId(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !deleteType) return;

    try {
      if (deleteType === "clearance") {
        await asbestosClearanceService.delete(itemToDelete._id);
        showSnackbar("Clearance deleted successfully", "success");
      } else if (deleteType === "shift") {
        await shiftService.delete(itemToDelete._id);
        showSnackbar("Air monitoring shift deleted successfully", "success");
      }
      fetchJobDetails(); // Refresh the data
    } catch (error) {
      console.error(`Error deleting ${deleteType}:`, error);
      showSnackbar(`Failed to delete ${deleteType}`, "error");
    } finally {
      setDeleteConfirmDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialogOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
  };

  const handleSamplesClick = (shift) => {
    // Don't allow access to samples if report is authorized
    if (shift.reportApprovedBy) {
      showSnackbar(
        "Cannot access samples while report is authorized. Please reset the shift status to access samples.",
        "warning"
      );
      return;
    }
    console.log("Samples button clicked for shift:", shift._id);
    const path = `/air-monitoring/shift/${shift._id}/samples`;
    console.log("Attempting to navigate to:", path);
    try {
      navigate(path, { replace: false });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const handleDownloadCOC = async (shift, event) => {
    event.stopPropagation();

    try {
      // Use axios to fetch the PDF with authentication
      const response = await api.get(
        `/air-monitoring-shifts/${shift._id}/chain-of-custody`,
        {
          responseType: "blob",
        }
      );

      // Create a blob URL from the response
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `Chain_of_Custody_${shift._id}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar("Chain of Custody downloaded successfully", "success");
    } catch (error) {
      console.error("Error downloading COC:", error);
      showSnackbar("Failed to download Chain of Custody", "error");
    }
  };

  const handleGeneratePDF = async (clearance, event) => {
    // Prevent row click when clicking PDF icon
    event.stopPropagation();

    try {
      console.log("handleGeneratePDF called with clearance:", clearance);
      setGeneratingPDF(true);

      // Get the full clearance data with populated project
      console.log("Fetching full clearance data...");
      const fullClearance = await asbestosClearanceService.getById(
        clearance._id
      );
      console.log("Full clearance data:", fullClearance);

      // Use the new HTML template-based PDF generation
      console.log("Calling generateHTMLTemplatePDF...");
      const fileName = await generateHTMLTemplatePDF(
        "asbestos-clearance", // template type
        fullClearance // clearance data
      );
      console.log("PDF generation completed, fileName:", fileName);

      showSnackbar(
        `PDF generated successfully! Check your downloads folder for: ${
          fileName.filename || fileName
        }`,
        "success"
      );
    } catch (err) {
      console.error("Error generating PDF:", err);
      showSnackbar("Failed to generate PDF", "error");
    } finally {
      console.log("Setting generatingPDF to false");
      setGeneratingPDF(false);
    }
  };

  const handleEditClearance = (clearance, event) => {
    event.stopPropagation();
    setEditingClearance(clearance);
    const clearanceType = clearance.clearanceType || "Non-friable";
    setClearanceForm({
      projectId: clearance.projectId._id || clearance.projectId,
      clearanceDate: clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
        : "",
      inspectionTime: formatTimeForDisplay(clearance.inspectionTime),
      clearanceType: clearanceType,
      LAA: clearance.LAA || "",
      asbestosRemovalist: clearance.asbestosRemovalist || "",
      jurisdiction: clearance.jurisdiction || "ACT",
      secondaryHeader: clearance.secondaryHeader || "",
      vehicleEquipmentDescription: clearance.vehicleEquipmentDescription || "",
      notes: clearance.notes || "",
      useComplexTemplate: clearance.useComplexTemplate || false,
      jobSpecificExclusions: clearance.jobSpecificExclusions || "",
    });
    setClearanceDialogOpen(true);
  };

  const handleDeleteClearance = (clearance, event) => {
    event.stopPropagation();
    setItemToDelete(clearance);
    setDeleteType("clearance");
    setDeleteConfirmDialogOpen(true);
  };

  const handleEditShift = (shift, event) => {
    event.stopPropagation();
    setEditingShift(shift);
    const shiftDate = shift.date
      ? new Date(shift.date).toISOString().split("T")[0]
      : "";
    setNewShiftDate(shiftDate);
    setShiftDialogOpen(true);
  };

  const handleUpdateShiftDate = async () => {
    if (!editingShift || !newShiftDate) return;

    try {
      await shiftService.update(editingShift._id, { date: newShiftDate });
      await fetchJobDetails();
      showSnackbar("Shift date updated successfully", "success");
      handleCloseShiftDialog();
    } catch (error) {
      console.error("Error updating shift date:", error);
      showSnackbar("Failed to update shift date", "error");
    }
  };

  const handleCloseShiftDialog = () => {
    setShiftDialogOpen(false);
    setNewShiftDate("");
    setEditingShift(null);
  };

  const handleDeleteShift = (shift, event) => {
    event.stopPropagation();
    setItemToDelete(shift);
    setDeleteType("shift");
    setDeleteConfirmDialogOpen(true);
  };

  const handleReopenShift = async (shift) => {
    try {
      await shiftService.reopen(shift._id);
      showSnackbar("Shift reopened successfully", "success");
      await fetchJobDetails();
    } catch (error) {
      console.error("Error reopening shift:", error);
      showSnackbar(
        "Failed to reopen shift. Only admins can reopen shifts.",
        "error"
      );
    }
  };

  const resetClearanceForm = () => {
    setClearanceForm({
      projectId: job?.projectId._id || job?.projectId || "",
      clearanceDate: new Date().toISOString().split("T")[0],
      inspectionTime: "09:00 AM",
      clearanceType: "Non-friable",
      LAA: "",
      asbestosRemovalist: job?.asbestosRemovalist || "",
      jurisdiction: "ACT",
      secondaryHeader: "",
      vehicleEquipmentDescription: "",
      notes: "",
      useComplexTemplate: false,
      jobSpecificExclusions: "",
    });
  };

  const handleClearanceSubmit = async (e) => {
    e.preventDefault();

    if (!clearanceForm.inspectionTime.trim()) {
      setError("Inspection time is required");
      return;
    }
    if (!clearanceForm.LAA.trim()) {
      setError("LAA is required");
      return;
    }

    // Validate Vehicle/Equipment Description when Vehicle/Equipment is selected
    if (
      clearanceForm.clearanceType === "Vehicle/Equipment" &&
      !clearanceForm.vehicleEquipmentDescription.trim()
    ) {
      setError("Vehicle/Equipment Description is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const newClearanceData = {
        projectId: clearanceForm.projectId,
        clearanceDate: clearanceForm.clearanceDate,
        inspectionTime: clearanceForm.inspectionTime,
        clearanceType: clearanceForm.clearanceType,
        LAA: clearanceForm.LAA,
        asbestosRemovalist: clearanceForm.asbestosRemovalist,
        jurisdiction: clearanceForm.jurisdiction,
        secondaryHeader: clearanceForm.secondaryHeader,
        vehicleEquipmentDescription: clearanceForm.vehicleEquipmentDescription,
        notes: clearanceForm.notes,
        jobSpecificExclusions: clearanceForm.jobSpecificExclusions,
      };

      let response;
      if (editingClearance) {
        response = await asbestosClearanceService.update(
          editingClearance._id,
          newClearanceData
        );
        console.log("Clearance update response:", response);
      } else {
        response = await asbestosClearanceService.create(newClearanceData);
        console.log("Clearance creation response:", response);
      }

      // Close modal and refresh data regardless of response structure
      await fetchJobDetails();
      setClearanceDialogOpen(false);
      setEditingClearance(null);
      resetClearanceForm();
    } catch (err) {
      console.error("Error creating clearance:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          (editingClearance
            ? "Failed to update clearance"
            : "Failed to create clearance")
      );
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box
        m="20px"
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={handleBackToJobs} startIcon={<ArrowBackIcon />}>
          Back to Asbestos Removal Jobs
        </Button>
      </Box>
    );
  }

  if (!job) {
    return (
      <Box m="20px">
        <Alert severity="warning" sx={{ mb: 2 }}>
          Job not found
        </Alert>
        <Button onClick={handleBackToJobs} startIcon={<ArrowBackIcon />}>
          Back to Asbestos Removal Jobs
        </Button>
      </Box>
    );
  }

  return (
    <Box m="20px">
      {/* PDF Loading Overlay */}
      <PDFLoadingOverlay
        open={generatingPDF}
        message="Generating Asbestos Clearance PDF..."
      />

      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToJobs}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Asbestos Removal Jobs
        </Link>
        <Typography color="text.primary">
          {job?.projectId?.projectID || "Loading..."}:{" "}
          {job?.projectName || "Loading..."}
        </Typography>
      </Breadcrumbs>

      {/* Job Header */}
      <Box mb={3}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Asbestos Removal Job Details
            </Typography>
            <Typography variant="h5" color="text.secondary">
              Project: {job?.projectId?.projectID || "Loading..."} -{" "}
              {job?.projectName || "Loading..."}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Asbestos Removalist: {job?.asbestosRemovalist || "Loading..."}
            </Typography>
          </Box>
          {job && hasShiftsOrClearances && (
            <Button
              variant="contained"
              color="success"
              onClick={handleCompleteJob}
              disabled={!canCompleteJob}
              sx={{
                backgroundColor: canCompleteJob
                  ? theme.palette.success.main
                  : theme.palette.grey[400],
                color: canCompleteJob
                  ? theme.palette.common.white
                  : theme.palette.grey[600],
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                cursor: canCompleteJob ? "pointer" : "not-allowed",
                "&:hover": {
                  backgroundColor: canCompleteJob
                    ? theme.palette.success.dark
                    : theme.palette.grey[400],
                },
                "&:disabled": {
                  backgroundColor: theme.palette.grey[400],
                  color: theme.palette.grey[600],
                },
              }}
            >
              Complete Job
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs for Air Monitoring and Clearances */}
      <Paper sx={{ width: "100%" }}>
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab
              label={`Air Monitoring Shifts (${airMonitoringShifts.length})`}
              icon={<MonitorIcon />}
              iconPosition="start"
            />
            <Tab
              label={`Clearances (${clearances.length})`}
              icon={<AssessmentIcon />}
              iconPosition="start"
            />
          </Tabs>
          <Box sx={{ pr: 2 }}>
            {activeTab === 0 ? (
              <Button
                variant="contained"
                startIcon={<MonitorIcon />}
                onClick={handleCreateAirMonitoringShift}
                disabled={creating}
                sx={{
                  backgroundColor: colors.primary[700],
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: colors.primary[800],
                  },
                }}
              >
                {creating ? "Creating..." : "Add Air Monitoring Shift"}
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={handleCreateClearance}
                disabled={creating}
                sx={{
                  backgroundColor: colors.secondary[600],
                  color: colors.grey[100],
                  "&:hover": {
                    backgroundColor: colors.secondary[700],
                  },
                }}
              >
                {creating ? "Creating..." : "Add Clearance"}
              </Button>
            )}
          </Box>
        </Box>

        {/* Air Monitoring Tab */}
        {activeTab === 0 && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>
              Air Monitoring Shifts
            </Typography>
            {airMonitoringShifts.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No air monitoring shifts found for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ backgroundColor: theme.palette.primary.dark }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Shift Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Sample Numbers
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {airMonitoringShifts.map((shift) => (
                      <TableRow
                        key={shift._id}
                        hover
                        onClick={() => handleShiftRowClick(shift)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          {shift.date ? formatDate(shift.date) : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatusLabel(shift.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(shift.status),
                              color: "white",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {shift.sampleNumbers && shift.sampleNumbers.length > 0
                            ? shift.sampleNumbers.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditShift(shift, e);
                              }}
                              title="Edit Shift Date"
                            >
                              <EditIcon color="primary" />
                            </IconButton>
                            <PermissionGate
                              requiredPermissions={["admin.view"]}
                              fallback={null}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteShift(shift, e);
                                }}
                                title="Delete Shift (Admin Only)"
                              >
                                <DeleteIcon color="error" />
                              </IconButton>
                              {(shift.status === "analysis_complete" ||
                                shift.status === "shift_complete") && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReopenShift(shift);
                                  }}
                                  title="Reopen Shift for Editing (Admin Only)"
                                >
                                  <RefreshIcon color="warning" />
                                </IconButton>
                              )}
                            </PermissionGate>
                            {shift.status === "samples_submitted_to_lab" && (
                              <>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={(e) => handleDownloadCOC(shift, e)}
                                  sx={{
                                    backgroundColor: theme.palette.info.main,
                                    color: theme.palette.info.contrastText,
                                    mr: 1,
                                    "&:hover": {
                                      backgroundColor: theme.palette.info.dark,
                                    },
                                  }}
                                >
                                  COC
                                </Button>
                                <Button
                                  variant="contained"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(
                                      `/air-monitoring/shift/${shift._id}/analysis`
                                    );
                                  }}
                                  sx={{
                                    backgroundColor: theme.palette.success.main,
                                    color: theme.palette.success.contrastText,
                                    "&:hover": {
                                      backgroundColor:
                                        theme.palette.success.dark,
                                    },
                                  }}
                                >
                                  SAMPLE ANALYSIS
                                </Button>
                              </>
                            )}
                            {(shift.status === "analysis_complete" ||
                              shift.status === "shift_complete") && (
                              <>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewReport(shift);
                                  }}
                                  sx={{
                                    borderColor: theme.palette.success.main,
                                    color: theme.palette.success.main,
                                    "&:hover": {
                                      borderColor: theme.palette.success.dark,
                                      backgroundColor:
                                        theme.palette.success.light,
                                    },
                                  }}
                                >
                                  {shift.reportApprovedBy
                                    ? "Download Report"
                                    : "View Report"}
                                </Button>
                                {(() => {
                                  const conditions = {
                                    notApproved: !shift.reportApprovedBy,
                                    reportViewed: reportViewedShiftIds.has(
                                      shift._id
                                    ),
                                    hasAdminPermission: hasPermission(
                                      currentUser,
                                      "admin.view"
                                    ),
                                    isLabSignatory: currentUser?.labSignatory,
                                  };
                                  console.log(
                                    "Authorise Report Button Conditions:",
                                    {
                                      shiftId: shift._id,
                                      conditions,
                                      currentUser: {
                                        id: currentUser?._id,
                                        role: currentUser?.role,
                                        labSignatory: currentUser?.labSignatory,
                                      },
                                    }
                                  );
                                  // Temporarily test without lab signatory requirement
                                  const showButton =
                                    conditions.notApproved &&
                                    conditions.reportViewed &&
                                    conditions.hasAdminPermission;
                                  console.log(
                                    "Should show button:",
                                    showButton,
                                    "Lab signatory check:",
                                    conditions.isLabSignatory
                                  );
                                  return showButton;
                                })() && (
                                  <Button
                                    variant="contained"
                                    size="small"
                                    color="success"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAuthoriseReport(shift);
                                    }}
                                    sx={{
                                      backgroundColor:
                                        theme.palette.success.main,
                                      color: theme.palette.common.white,
                                      "&:hover": {
                                        backgroundColor:
                                          theme.palette.success.dark,
                                      },
                                    }}
                                  >
                                    Authorise
                                  </Button>
                                )}
                                {hasPermission(currentUser, "admin.view") && (
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleResetStatus(shift._id);
                                    }}
                                    title="Reset status to Ongoing"
                                    sx={{ color: theme.palette.error.main }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Clearances Tab */}
        {activeTab === 1 && (
          <Box p={3}>
            <Typography variant="h6" gutterBottom>
              Clearances
            </Typography>
            {clearances.length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No clearances found for this job.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow
                      sx={{ backgroundColor: theme.palette.primary.dark }}
                    >
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Clearance Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Clearance Type
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        LAA
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {clearances.map((clearance) => (
                      <TableRow
                        key={clearance._id}
                        hover
                        onClick={() => handleClearanceRowClick(clearance)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          {clearance.clearanceDate
                            ? formatDate(clearance.clearanceDate)
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {clearance.clearanceType || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatusLabel(clearance.status)}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(clearance.status),
                              color: "white",
                            }}
                          />
                        </TableCell>
                        <TableCell>{getLaaName(clearance.LAA)}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={(e) => handleEditClearance(clearance, e)}
                            title="Edit Clearance"
                            sx={{ mr: 1 }}
                          >
                            <EditIcon color="primary" />
                          </IconButton>
                          <PermissionGate
                            requiredPermissions={["admin.view"]}
                            fallback={null}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) =>
                                handleDeleteClearance(clearance, e)
                              }
                              title="Delete Clearance (Admin Only)"
                              sx={{ mr: 1 }}
                            >
                              <DeleteIcon color="error" />
                            </IconButton>
                          </PermissionGate>
                          {clearance.status === "complete" && (
                            <IconButton
                              size="small"
                              onClick={(e) => handleGeneratePDF(clearance, e)}
                              disabled={generatingPDF}
                              title="Generate PDF Report"
                            >
                              <PictureAsPdfIcon color="primary" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

      {/* Clearance Modal */}
      <Dialog
        open={clearanceDialogOpen}
        onClose={() => setClearanceDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingClearance ? "Edit Clearance" : "Add New Clearance"}
        </DialogTitle>
        <form onSubmit={handleClearanceSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Clearance Date"
                  type="date"
                  value={clearanceForm.clearanceDate}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      clearanceDate: e.target.value,
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <FormControl required sx={{ minWidth: 80 }}>
                    <InputLabel>Hour</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || ""
                          : ""
                      }
                      onChange={(e) => {
                        const hour = e.target.value;
                        const minutes = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[1] || "00"
                          : "00";
                        const ampm = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="Hour"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (hour) => (
                          <MenuItem
                            key={hour}
                            value={hour.toString().padStart(2, "0")}
                          >
                            {hour}
                          </MenuItem>
                        )
                      )}
                    </Select>
                  </FormControl>

                  <FormControl required sx={{ minWidth: 100 }}>
                    <InputLabel>Minutes</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime
                              .split(":")[1]
                              ?.split(" ")[0] || "00"
                          : "00"
                      }
                      onChange={(e) => {
                        const minutes = e.target.value;
                        const hour = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || "09"
                          : "09";
                        const ampm = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="Minutes"
                    >
                      {["00", "15", "30", "45"].map((minute) => (
                        <MenuItem key={minute} value={minute}>
                          {minute}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl required sx={{ minWidth: 80 }}>
                    <InputLabel>AM/PM</InputLabel>
                    <Select
                      value={
                        clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(" ")[1] || "AM"
                          : "AM"
                      }
                      onChange={(e) => {
                        const ampm = e.target.value;
                        const hour = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime.split(":")[0] || "09"
                          : "09";
                        const minutes = clearanceForm.inspectionTime
                          ? clearanceForm.inspectionTime
                              .split(":")[1]
                              ?.split(" ")[0] || "00"
                          : "00";
                        setClearanceForm({
                          ...clearanceForm,
                          inspectionTime: `${hour}:${minutes} ${ampm}`,
                        });
                      }}
                      label="AM/PM"
                    >
                      <MenuItem value="AM">AM</MenuItem>
                      <MenuItem value="PM">PM</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>Clearance Type</InputLabel>
                  <Select
                    value={clearanceForm.clearanceType}
                    onChange={(e) => {
                      const clearanceType = e.target.value;
                      const newForm = {
                        ...clearanceForm,
                        clearanceType,
                      };

                      // Add default text to job specific exclusions for Friable (Non-Friable Conditions)
                      if (
                        clearanceType === "Friable (Non-Friable Conditions)"
                      ) {
                        newForm.jobSpecificExclusions =
                          "The friable asbestos was removed using methods which kept the asbestos enclosed and therefore without disturbance of the material. As a result, the removal was undertaken under non-friable asbestos removal conditions.";
                      }

                      // Set asbestos removalist to "-" when Vehicle/Equipment is selected
                      if (clearanceType === "Vehicle/Equipment") {
                        newForm.asbestosRemovalist = "-";
                      } else if (clearanceForm.asbestosRemovalist === "-") {
                        // Reset to job's asbestos removalist if switching away from Vehicle/Equipment
                        newForm.asbestosRemovalist =
                          job?.asbestosRemovalist || "";
                      }

                      setClearanceForm(newForm);
                    }}
                    label="Clearance Type"
                  >
                    <MenuItem value="Non-friable">Non-friable</MenuItem>
                    <MenuItem value="Friable">Friable</MenuItem>
                    <MenuItem value="Friable (Non-Friable Conditions)">
                      Friable (Non-Friable Conditions)
                    </MenuItem>
                    <MenuItem value="Vehicle/Equipment">
                      Vehicle/Equipment
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                  <Select
                    value={clearanceForm.LAA}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        LAA: e.target.value,
                      })
                    }
                    label="LAA (Licensed Asbestos Assessor)"
                  >
                    <MenuItem value="">
                      <em>Select an Asbestos Assessor</em>
                    </MenuItem>
                    {asbestosAssessors.map((assessor) => (
                      <MenuItem key={assessor._id} value={assessor._id}>
                        {assessor.firstName} {assessor.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <TextField
                    fullWidth
                    label="Asbestos Removalist"
                    value={clearanceForm.asbestosRemovalist}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        asbestosRemovalist: e.target.value,
                      })
                    }
                    required
                  />
                  <Box sx={{ minWidth: 150 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        display: "block",
                        mb: 1,
                      }}
                    >
                      Jurisdiction
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                      <FormControlLabel
                        value="ACT"
                        control={
                          <Radio
                            size="small"
                            checked={clearanceForm.jurisdiction === "ACT"}
                            onChange={(e) =>
                              setClearanceForm({
                                ...clearanceForm,
                                jurisdiction: e.target.value,
                              })
                            }
                          />
                        }
                        label="ACT"
                        sx={{ margin: 0 }}
                      />
                      <FormControlLabel
                        value="NSW"
                        control={
                          <Radio
                            size="small"
                            checked={clearanceForm.jurisdiction === "NSW"}
                            onChange={(e) =>
                              setClearanceForm({
                                ...clearanceForm,
                                jurisdiction: e.target.value,
                              })
                            }
                          />
                        }
                        label="NSW"
                        sx={{ margin: 0 }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Grid>
              {clearanceForm.clearanceType === "Vehicle/Equipment" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Vehicle/Equipment Description"
                    value={clearanceForm.vehicleEquipmentDescription}
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        vehicleEquipmentDescription: e.target.value,
                      })
                    }
                    placeholder="Enter vehicle/equipment description"
                    helperText="This will replace the project name on the cover page"
                    required
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Secondary Header (Optional)"
                  value={clearanceForm.secondaryHeader}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      secondaryHeader: e.target.value,
                    })
                  }
                  placeholder="Enter secondary header text"
                  helperText="This will appear as a smaller header beneath the site name on the cover page"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notes"
                  multiline
                  rows={3}
                  value={clearanceForm.notes}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      notes: e.target.value,
                    })
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setClearanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              sx={{
                backgroundColor: colors.secondary[600],
                color: colors.grey[100],
                "&:hover": {
                  backgroundColor: colors.secondary[700],
                },
              }}
            >
              {creating
                ? editingClearance
                  ? "Updating..."
                  : "Creating..."
                : editingClearance
                ? "Update Clearance"
                : "Create Clearance"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Air Monitoring Shift Modal */}
      <Dialog
        open={shiftDialogOpen}
        onClose={handleCloseShiftDialog}
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
            <MonitorIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {editingShift
              ? "Edit Air Monitoring Shift"
              : "Add New Air Monitoring Shift"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", mb: 2 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Date"
              type="date"
              fullWidth
              value={newShiftDate}
              onChange={(e) => setNewShiftDate(e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />
            <Button
              variant="outlined"
              onClick={handleSetToday}
              sx={{ height: "56px" }}
            >
              Today
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={handleCloseShiftDialog}
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
            onClick={editingShift ? handleUpdateShiftDate : handleShiftSubmit}
            variant="contained"
            startIcon={<MonitorIcon />}
            disabled={!newShiftDate}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            {editingShift ? "Update Shift" : "Add Shift"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Status Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={cancelResetStatus}
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
              width: 40,
              height: 40,
              borderRadius: "50%",
              backgroundColor: theme.palette.error.light,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloseIcon sx={{ fontSize: 20, color: theme.palette.error.main }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Reset Shift Status?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to reset this shift's status to <b>Ongoing</b>
            ? This will allow editing of analysis data. No data will be deleted
            or cleared.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelResetStatus}
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
            onClick={confirmResetStatus}
            variant="contained"
            color="error"
            startIcon={<CloseIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Reset Status
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
            Delete{" "}
            {deleteType === "clearance" ? "Clearance" : "Air Monitoring Shift"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this {deleteType}? This action
            cannot be undone.
          </Typography>
          {itemToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              {deleteType === "clearance" ? (
                <>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Clearance Date:</strong>{" "}
                    {itemToDelete.clearanceDate
                      ? new Date(itemToDelete.clearanceDate).toLocaleDateString(
                          "en-AU"
                        )
                      : "Not specified"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Type:</strong>{" "}
                    {itemToDelete.clearanceType || "Not specified"}
                  </Typography>
                </>
              ) : (
                <>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    <strong>Shift Date:</strong>{" "}
                    {itemToDelete.date
                      ? new Date(itemToDelete.date).toLocaleDateString("en-AU")
                      : "Not specified"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Description:</strong>{" "}
                    {itemToDelete.descriptionOfWorks || "Not specified"}
                  </Typography>
                </>
              )}
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
            Delete {deleteType === "clearance" ? "Clearance" : "Shift"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AsbestosRemovalJobDetails;
