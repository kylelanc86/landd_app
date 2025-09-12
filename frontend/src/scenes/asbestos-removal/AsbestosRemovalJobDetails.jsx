import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Snackbar,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { tokens } from "../../theme/tokens";
import { jobService, shiftService, sampleService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import userService from "../../services/userService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";
import { useAuth } from "../../context/AuthContext";

const AsbestosRemovalJobDetails = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();
  const { currentUser } = useAuth();

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
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState("");

  const [clearanceForm, setClearanceForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "09:00 AM",
    clearanceType: "Non-friable",
    LAA: "",
    asbestosRemovalist: "",
    airMonitoring: false,
    airMonitoringReport: null,
    airMonitoringReportType: "select",
    notes: "",
    useComplexTemplate: false,
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

  const handleCloseShiftDialog = () => {
    setShiftDialogOpen(false);
    setNewShiftDate("");
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
        projectId: job.projectId._id,
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
          projectId: job.projectId._id, // Ensure projectId field is set
          jobName: job.name || "Asbestos Removal Job",
          jobId: jobId,
        };
        setAirMonitoringShifts((prev) => [...prev, newShift]);
      }

      handleCloseShiftDialog();

      setSnackbar({
        open: true,
        message: "Air monitoring shift created successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("Error creating shift:", error);
      setSnackbar({
        open: true,
        message: "Failed to create shift. Please try again.",
        severity: "error",
      });
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

      setSnackbar({
        open: true,
        message: `PDF generated successfully! Check your downloads folder for: ${
          fileName.filename || fileName
        }`,
        severity: "success",
      });
    } catch (err) {
      console.error("Error generating PDF:", err);
      setSnackbar({
        open: true,
        message: "Failed to generate PDF",
        severity: "error",
      });
    } finally {
      console.log("Setting generatingPDF to false");
      setGeneratingPDF(false);
    }
  };

  const handleEditClearance = (clearance, event) => {
    event.stopPropagation();
    setEditingClearance(clearance);
    setClearanceForm({
      projectId: clearance.projectId._id || clearance.projectId,
      clearanceDate: clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
        : "",
      inspectionTime: formatTimeForDisplay(clearance.inspectionTime),
      clearanceType: clearance.clearanceType || "Non-friable",
      LAA: clearance.LAA || "",
      asbestosRemovalist: clearance.asbestosRemovalist || "",
      airMonitoring: clearance.airMonitoring || false,
      airMonitoringReport: clearance.airMonitoringReport || null,
      notes: clearance.notes || "",
      useComplexTemplate: clearance.useComplexTemplate || false,
    });
    setClearanceDialogOpen(true);
  };

  const handleDeleteClearance = async (clearance, event) => {
    event.stopPropagation();
    if (window.confirm(`Are you sure you want to delete this clearance?`)) {
      try {
        await asbestosClearanceService.delete(clearance._id);
        setSnackbar({
          open: true,
          message: "Clearance deleted successfully",
          severity: "success",
        });
        fetchJobDetails(); // Refresh the data
      } catch (error) {
        console.error("Error deleting clearance:", error);
        setSnackbar({
          open: true,
          message: "Failed to delete clearance",
          severity: "error",
        });
      }
    }
  };

  const handleEditShift = (shift, event) => {
    event.stopPropagation();
    // Navigate to shift edit page or open edit modal
    navigate(`/air-monitoring/shifts/${shift._id}/edit`);
  };

  const handleDeleteShift = async (shift, event) => {
    event.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete this air monitoring shift?`
      )
    ) {
      try {
        await shiftService.delete(shift._id);
        setSnackbar({
          open: true,
          message: "Air monitoring shift deleted successfully",
          severity: "success",
        });
        fetchJobDetails(); // Refresh the data
      } catch (error) {
        console.error("Error deleting shift:", error);
        setSnackbar({
          open: true,
          message: "Failed to delete air monitoring shift",
          severity: "error",
        });
      }
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
      airMonitoring: false,
      airMonitoringReport: null,
      airMonitoringReportType: "select",
      notes: "",
      useComplexTemplate: false,
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
        airMonitoring: clearanceForm.airMonitoring,
        airMonitoringReport: clearanceForm.airMonitoringReport,
        notes: clearanceForm.notes,
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
          {job.projectId.projectID}: {job.projectName}
        </Typography>
      </Breadcrumbs>

      {/* Job Header */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          Asbestos Removal Job Details
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Project: {job.projectId.projectID} - {job.projectName}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Asbestos Removalist: {job.asbestosRemovalist}
        </Typography>
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
                          {shift.date
                            ? new Date(shift.date).toLocaleDateString()
                            : "N/A"}
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
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditShift(shift, e);
                            }}
                            title="Edit Shift"
                            sx={{ mr: 1 }}
                          >
                            <EditIcon color="primary" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteShift(shift, e);
                            }}
                            title="Delete Shift"
                          >
                            <DeleteIcon color="error" />
                          </IconButton>
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
                            ? new Date(
                                clearance.clearanceDate
                              ).toLocaleDateString()
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
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteClearance(clearance, e)}
                            title="Delete Clearance"
                            sx={{ mr: 1 }}
                          >
                            <DeleteIcon color="error" />
                          </IconButton>
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
                    onChange={(e) =>
                      setClearanceForm({
                        ...clearanceForm,
                        clearanceType: e.target.value,
                      })
                    }
                    label="Clearance Type"
                  >
                    <MenuItem value="Non-friable">Non-friable</MenuItem>
                    <MenuItem value="Friable">Friable</MenuItem>
                    <MenuItem value="Mixed">Mixed</MenuItem>
                    <MenuItem value="Complex">Complex</MenuItem>
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
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={clearanceForm.airMonitoring}
                      onChange={(e) =>
                        setClearanceForm({
                          ...clearanceForm,
                          airMonitoring: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Air Monitoring Required"
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
            Add New Air Monitoring Shift
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
            onClick={handleShiftSubmit}
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
            Add Shift
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ zIndex: 9999 }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AsbestosRemovalJobDetails;
