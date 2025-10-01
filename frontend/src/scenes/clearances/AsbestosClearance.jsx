import React, { useState, useEffect } from "react";
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Autocomplete,
  Radio,
  RadioGroup,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TodayIcon from "@mui/icons-material/Today";

import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import {
  projectService,
  userService,
  jobService,
  shiftService,
} from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import customDataFieldService from "../../services/customDataFieldService";
import PermissionGate from "../../components/PermissionGate";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const AsbestosClearance = () => {
  const colors = tokens;
  const navigate = useNavigate();

  const [clearances, setClearances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const { showSnackbar } = useSnackbar();

  const [form, setForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "",
    clearanceType: "Non-friable",
    LAA: "",
    asbestosRemovalist: "",
    airMonitoring: false,
    airMonitoringReport: null,
    airMonitoringReportType: "select", // "select" or "upload"
    sitePlan: false,
    sitePlanFile: null,
    notes: "",
    useComplexTemplate: false,
  });

  const [airMonitoringReports, setAirMonitoringReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Fetch asbestos removalists from CustomDataFields
  const fetchAsbestosRemovalists = async () => {
    try {
      const data = await customDataFieldService.getByType(
        "asbestos_removalist"
      );
      setAsbestosRemovalists(data || []);
    } catch (error) {
      console.error("Error fetching asbestos removalists:", error);
      setAsbestosRemovalists([]);
    }
  };

  // Helper function to get the correct value for the air monitoring report select
  const getAirMonitoringReportValue = () => {
    if (!form.airMonitoringReport) return "";

    // If it's a short string, it's likely a shift ID
    if (
      typeof form.airMonitoringReport === "string" &&
      form.airMonitoringReport.length < 100
    ) {
      // Check if this shift ID exists in our reports
      const reportExists = airMonitoringReports.find(
        (report) => report.id === form.airMonitoringReport
      );
      console.log("Air monitoring report value check:", {
        airMonitoringReport: form.airMonitoringReport,
        reportExists,
        availableReports: airMonitoringReports.map((r) => ({
          id: r.id,
          name: r.name,
        })),
      });
      return reportExists ? form.airMonitoringReport : "";
    }

    return "";
  };

  // Load data on component mount
  useEffect(() => {
    fetchData();
    fetchAsbestosRemovalists();
  }, []);

  // Update form when air monitoring reports are loaded (for edit mode)
  useEffect(() => {
    if (
      editingClearance &&
      airMonitoringReports.length > 0 &&
      form.airMonitoringReport
    ) {
      // If we're editing and have reports loaded, check if the current report is a valid shift ID
      if (
        typeof form.airMonitoringReport === "string" &&
        form.airMonitoringReport.length < 100
      ) {
        const reportExists = airMonitoringReports.find(
          (report) => report.id === form.airMonitoringReport
        );
        if (!reportExists) {
          // The shift ID doesn't exist in our reports, clear it
          console.log(
            "Clearing invalid air monitoring report ID:",
            form.airMonitoringReport
          );
          setForm((prev) => ({ ...prev, airMonitoringReport: null }));
        }
      }
    }
  }, [airMonitoringReports, editingClearance, form.airMonitoringReport]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clearancesData, projectsData, usersData] = await Promise.all([
        asbestosClearanceService.getAll(),
        projectService.getAll({
          limit: 1000,
          status:
            "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
          sortBy: "projectID",
          sortOrder: "desc",
        }),
        userService.getAll(),
      ]);

      console.log("Clearances API response:", clearancesData);
      console.log("Projects API response:", projectsData);
      console.log("Projects API response type:", typeof projectsData);
      console.log(
        "Projects API response keys:",
        projectsData ? Object.keys(projectsData) : "null/undefined"
      );
      console.log("Users API response:", usersData);

      setClearances(
        clearancesData.clearances || clearancesData.data || clearancesData || []
      );

      // Ensure projects is always an array - handle different response structures
      let projectsArray = [];
      if (projectsData) {
        // Handle the standard API response structure: { data: [...], pagination: {...} }
        if (projectsData.data && Array.isArray(projectsData.data)) {
          projectsArray = projectsData.data;
        } else if (Array.isArray(projectsData)) {
          projectsArray = projectsData;
        } else if (
          projectsData.data &&
          projectsData.data.data &&
          Array.isArray(projectsData.data.data)
        ) {
          projectsArray = projectsData.data.data;
        }
      }
      console.log("Projects array:", projectsArray);
      console.log("Projects array length:", projectsArray.length);
      console.log("First project (if any):", projectsArray[0]);
      setProjects(projectsArray);

      // Filter active users and transform for dropdown
      const activeUsers = (usersData.data || usersData).filter(
        (user) => user.isActive
      );
      setUsers(activeUsers);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch air monitoring reports for a specific project
  const fetchAirMonitoringReports = async (projectId) => {
    if (!projectId) {
      setAirMonitoringReports([]);
      return;
    }

    try {
      setLoadingReports(true);

      // Fetch air monitoring jobs for this project
      const jobsResponse = await jobService.getAll();
      const projectJobs =
        jobsResponse.data?.filter(
          (job) =>
            job.projectId?._id === projectId || job.projectId === projectId
        ) || [];

      // Fetch shifts for these jobs
      const jobIds = projectJobs.map((job) => job._id);
      let allShifts = [];

      if (jobIds.length > 0) {
        const shiftsResponse = await shiftService.getByJobs(jobIds);
        allShifts = shiftsResponse.data || [];
      }

      // Filter only completed shifts
      const completedShifts = allShifts.filter(
        (shift) => shift.status === "shift_complete"
      );

      // Fetch samples for all shifts
      const shiftIds = completedShifts.map((shift) => shift._id);
      let allSamples = [];

      if (shiftIds.length > 0) {
        try {
          const { sampleService } = await import("../../services/api");
          const samplesPromises = shiftIds.map((shiftId) =>
            sampleService.getByShift(shiftId).catch(() => ({ data: [] }))
          );
          const samplesResponses = await Promise.all(samplesPromises);
          allSamples = samplesResponses.reduce((acc, response) => {
            return acc.concat(response.data || []);
          }, []);
        } catch (error) {
          console.warn("Could not fetch samples:", error);
        }
      }

      // Create a list of available reports with complete data
      const reports = completedShifts.map((shift) => {
        const job = projectJobs.find((job) => job._id === shift.jobId) || {};
        const samples = allSamples.filter(
          (sample) => sample.shiftId === shift._id
        );

        return {
          id: shift._id,
          name: `Air Monitoring Report - ${
            shift.date
              ? new Date(shift.date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })
              : "Unknown Date"
          }`,
          shift: shift,
          job: job,
          samples: samples,
          projectName: job.projectId?.name || job.project?.name,
          projectId: job.projectId?._id || job.project?._id,
        };
      });

      setAirMonitoringReports(reports);
    } catch (error) {
      console.error("Error fetching air monitoring reports:", error);
      setAirMonitoringReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClearance) {
        await asbestosClearanceService.update(editingClearance._id, form);
        showSnackbar("Clearance updated successfully", "success");
      } else {
        await asbestosClearanceService.create(form);
        showSnackbar("Clearance created successfully", "success");
      }

      setDialogOpen(false);
      setEditingClearance(null);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving clearance:", err);
      showSnackbar("Failed to save clearance", "error");
    }
  };

  const handleEdit = (clearance) => {
    setEditingClearance(clearance);
    setForm({
      projectId: clearance.projectId._id || clearance.projectId,
      clearanceDate: clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
        : "",
      inspectionTime: clearance.inspectionTime || "",
      clearanceType: clearance.clearanceType,
      LAA: clearance.LAA,
      asbestosRemovalist: clearance.asbestosRemovalist,
      airMonitoring: clearance.airMonitoring || false,
      airMonitoringReport: clearance.airMonitoringReport || null,
      airMonitoringReportType: clearance.airMonitoringReport
        ? typeof clearance.airMonitoringReport === "string" &&
          clearance.airMonitoringReport.length < 100
          ? "select"
          : "upload"
        : "select",
      sitePlan: clearance.sitePlan || false,
      sitePlanFile: clearance.sitePlanFile || null,
      notes: clearance.notes || "",
      useComplexTemplate: clearance.useComplexTemplate || false,
    });

    // Fetch air monitoring reports for this project
    if (clearance.projectId) {
      console.log("Edit modal - clearance data:", {
        airMonitoringReport: clearance.airMonitoringReport,
        airMonitoringReportType:
          typeof clearance.airMonitoringReport === "string" &&
          clearance.airMonitoringReport.length < 100
            ? "select"
            : "upload",
      });
      fetchAirMonitoringReports(clearance.projectId._id || clearance.projectId);
    }

    setDialogOpen(true);
  };

  const handleDelete = async (clearance) => {
    if (window.confirm("Are you sure you want to delete this clearance?")) {
      try {
        await asbestosClearanceService.delete(clearance._id);
        showSnackbar("Clearance deleted successfully", "success");
        fetchData();
      } catch (err) {
        console.error("Error deleting clearance:", err);
        showSnackbar("Failed to delete clearance", "error");
      }
    }
  };

  const handleViewItems = (clearance) => {
    navigate(`/clearances/${clearance._id}/items`);
  };

  const handleCloseJob = async (clearance) => {
    if (
      window.confirm(
        "Are you sure you want to close this job? This will remove it from the asbestos clearances table."
      )
    ) {
      try {
        await asbestosClearanceService.update(clearance._id, {
          status: "closed",
        });
        showSnackbar(
          "Job closed successfully and removed from table",
          "success"
        );
        // Refresh the data to remove the closed job from the table
        fetchData();
      } catch (err) {
        console.error("Error closing job:", err);
        showSnackbar("Failed to close job", "error");
      }
    }
  };

  const handleGeneratePDF = async (clearance) => {
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

  const resetForm = () => {
    setForm({
      projectId: "",
      clearanceDate: "",
      inspectionTime: roundTimeToNearest5Minutes(),
      clearanceType: "Non-friable",
      LAA: "",
      asbestosRemovalist: "",
      airMonitoring: false,
      airMonitoringReport: null,
      airMonitoringReportType: "select",
      sitePlan: false,
      sitePlanFile: null,
      notes: "",
      useComplexTemplate: false,
    });
    setAirMonitoringReports([]);
  };

  const setDateToToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setForm({ ...form, clearanceDate: today });
  };

  const roundTimeToNearest5Minutes = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.round(minutes / 5) * 5;
    now.setMinutes(roundedMinutes);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now.toTimeString().slice(0, 5); // Returns HH:MM format
  };

  const setTimeToNow = () => {
    const currentTime = roundTimeToNearest5Minutes();
    setForm({ ...form, inspectionTime: currentTime });
  };

  // Handle project selection change
  const handleProjectChange = (projectId) => {
    setForm({ ...form, projectId });
    // Fetch air monitoring reports for the selected project
    fetchAirMonitoringReports(projectId);
  };

  // Function to automatically determine clearance type based on asbestos items
  const determineClearanceType = (items) => {
    if (!items || items.length === 0) {
      return "Non-friable"; // Default if no items
    }

    const hasFriable = items.some((item) => item.asbestosType === "Friable");
    const hasNonFriable = items.some(
      (item) => item.asbestosType === "Non-friable"
    );

    if (hasFriable && hasNonFriable) {
      return "Mixed";
    } else if (hasFriable) {
      return "Friable";
    } else {
      return "Non-friable";
    }
  };

  // Function to update clearance type and air monitoring based on asbestos items
  const updateClearanceTypeFromItems = (items) => {
    const newClearanceType = determineClearanceType(items);
    const requiresAirMonitoring =
      newClearanceType === "Friable" || newClearanceType === "Mixed";

    setForm((prev) => ({
      ...prev,
      clearanceType: newClearanceType,
      airMonitoring: requiresAirMonitoring ? true : prev.airMonitoring,
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return "success";
      case "in progress":
        return "warning";
      case "Site Work Complete":
        return "info";
      case "closed":
        return "default";
      default:
        return "default";
    }
  };

  // Helper function to capitalize status text
  const capitalizeStatus = (status) => {
    if (!status) return "";

    switch (status) {
      case "complete":
        return "Complete";
      case "in progress":
        return "In Progress";
      case "Site Work Complete":
        return "Site Work Complete";
      case "closed":
        return "Closed";
      default:
        // Capitalize first letter of each word for unknown statuses
        return status
          .split(" ")
          .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(" ");
    }
  };
  const handleBackToHome = () => {
    navigate("/asbestos-removal");
  };

  const getProjectName = (projectId) => {
    // Ensure projects is an array
    if (!Array.isArray(projects)) {
      console.warn("Projects is not an array:", projects);
      return "Unknown Project";
    }

    // Handle case where projectId is an object with _id
    const projectIdValue = projectId?._id || projectId;
    const project = projects.find((p) => p._id === projectIdValue);
    return project ? project.projectID : "Unknown Project";
  };

  const getProjectDisplayName = (projectId) => {
    // Ensure projects is an array
    if (!Array.isArray(projects)) {
      console.warn("Projects is not an array:", projects);
      return "Unknown Project";
    }

    // Handle case where projectId is an object with _id
    const projectIdValue = projectId?._id || projectId;
    const project = projects.find((p) => p._id === projectIdValue);
    return project ? project.name : "Unknown Project";
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
          open={generatingPDF}
          message="Generating Asbestos Clearance PDF..."
        />
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Asbestos Clearances
        </Typography>

        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ marginBottom: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Asbestos Removal
          </Link>
          <Typography color="text.primary">Asbestos Clearances</Typography>
        </Breadcrumbs>

        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            setEditingClearance(null);
            resetForm();
            setDialogOpen(true);
          }}
          startIcon={<AddIcon />}
        >
          Add Clearance
        </Button>
        <Card sx={{ mt: 3 }}>
          <CardContent>
            {loading ? (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                height="200px"
              >
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ maxWidth: "120px" }}>
                        Project ID
                      </TableCell>
                      <TableCell sx={{ maxWidth: "120px" }}>Date</TableCell>
                      <TableCell sx={{ minWidth: "200px", flex: 2 }}>
                        Project Name
                      </TableCell>
                      <TableCell>Asbestos Removalist</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        sx={{ textAlign: "center", py: 1 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ color: "white" }}
                        >
                          💡 Click any row to view clearance items
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(clearances) &&
                      (clearances || [])
                        .filter((clearance) => clearance.status !== "closed")
                        .map((clearance) => (
                          <TableRow
                            key={clearance._id}
                            onClick={() => handleViewItems(clearance)}
                            sx={{
                              cursor: "pointer",
                              transition: "background-color 0.2s ease",
                              "&:hover": {
                                backgroundColor: "action.hover",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                              },
                              "&:active": {
                                backgroundColor: "action.selected",
                              },
                            }}
                          >
                            <TableCell sx={{ maxWidth: "120px" }}>
                              {getProjectName(clearance.projectId)}
                            </TableCell>
                            <TableCell sx={{ maxWidth: "120px" }}>
                              {clearance.clearanceDate
                                ? new Date(
                                    clearance.clearanceDate
                                  ).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "N/A"}
                            </TableCell>
                            <TableCell sx={{ minWidth: "200px", flex: 2 }}>
                              <Box>
                                <Typography
                                  variant="body2"
                                  component="div"
                                  color="black"
                                >
                                  {getProjectDisplayName(clearance.projectId)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  component="div"
                                  color="text.secondary"
                                  sx={{ fontStyle: "italic" }}
                                >
                                  {clearance.clearanceType}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {clearance.asbestosRemovalist || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={capitalizeStatus(clearance.status)}
                                color={getStatusColor(clearance.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {clearance.status !== "complete" && (
                                <Button
                                  onClick={() => handleCloseJob(clearance)}
                                  color="success"
                                  size="small"
                                  variant="contained"
                                  sx={{ mr: 1 }}
                                >
                                  Close Job
                                </Button>
                              )}
                              <IconButton
                                onClick={() => handleEdit(clearance)}
                                color="primary"
                                size="small"
                                title="Edit"
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                onClick={() => handleGeneratePDF(clearance)}
                                color="secondary"
                                size="small"
                                disabled={generatingPDF}
                                title="Generate PDF"
                              >
                                <PictureAsPdfIcon />
                              </IconButton>
                              <IconButton
                                onClick={() => handleDelete(clearance)}
                                color="error"
                                size="small"
                                title="Delete"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingClearance ? "Edit Clearance" : "Add New Clearance"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Autocomplete
                    options={projects}
                    getOptionLabel={(option) =>
                      option.projectID + ": " + option.name
                    }
                    value={
                      projects.find((p) => p._id === form.projectId) || null
                    }
                    onChange={(_, newValue) =>
                      handleProjectChange(newValue ? newValue._id : "")
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Project"
                        margin="normal"
                        required
                      />
                    )}
                    isOptionEqualToValue={(option, value) =>
                      option._id === value._id
                    }
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      fullWidth
                      type="date"
                      label="Clearance Date"
                      value={form.clearanceDate}
                      onChange={(e) =>
                        setForm({ ...form, clearanceDate: e.target.value })
                      }
                      required
                      InputLabelProps={{ shrink: true }}
                    />
                    <Button
                      variant="outlined"
                      onClick={setDateToToday}
                      startIcon={<TodayIcon />}
                      sx={{ minWidth: "auto", px: 2 }}
                      title="Set date to today"
                    >
                      Today
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      fullWidth
                      type="time"
                      label="Inspection Time"
                      value={form.inspectionTime}
                      onChange={(e) =>
                        setForm({ ...form, inspectionTime: e.target.value })
                      }
                      required
                      InputLabelProps={{ shrink: true }}
                    />
                    <Button
                      variant="outlined"
                      onClick={setTimeToNow}
                      sx={{ minWidth: "auto", px: 2 }}
                      title="Set time to current time (rounded to nearest 5 minutes)"
                    >
                      Now
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Clearance Type (Auto-determined)</InputLabel>
                    <Select
                      value={form.clearanceType}
                      disabled
                      label="Clearance Type (Auto-determined)"
                    >
                      <MenuItem value="Non-friable">Non-friable</MenuItem>
                      <MenuItem value="Friable">Friable</MenuItem>
                      <MenuItem value="Mixed">
                        Mixed (Friable & Non-friable)
                      </MenuItem>
                      <MenuItem value="Complex">
                        Complex Clearance Certificate
                      </MenuItem>
                    </Select>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: "block" }}
                    >
                      Clearance type is automatically determined based on the
                      asbestos items added to this clearance. Non-friable: Only
                      non-friable items | Friable: Only friable items | Mixed:
                      Both friable and non-friable items
                    </Typography>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.useComplexTemplate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            useComplexTemplate: e.target.checked,
                          })
                        }
                        color="primary"
                      />
                    }
                    label="Use Complex Clearance Template"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>LAA</InputLabel>
                    <Select
                      value={form.LAA}
                      onChange={(e) =>
                        setForm({ ...form, LAA: e.target.value })
                      }
                      label="LAA"
                    >
                      {(users || []).map((user) => (
                        <MenuItem
                          key={user._id}
                          value={`${user.firstName} ${user.lastName}`}
                        >
                          {user.firstName} {user.lastName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Asbestos Removalist</InputLabel>
                    <Select
                      value={form.asbestosRemovalist}
                      onChange={(e) =>
                        setForm({ ...form, asbestosRemovalist: e.target.value })
                      }
                      label="Asbestos Removalist"
                    >
                      {asbestosRemovalists.map((removalist) => (
                        <MenuItem key={removalist._id} value={removalist.text}>
                          {removalist.text}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.airMonitoring}
                        onChange={(e) =>
                          setForm({ ...form, airMonitoring: e.target.checked })
                        }
                        color="primary"
                      />
                    }
                    label={`Include Air Monitoring Report${
                      form.clearanceType === "Friable" ||
                      form.clearanceType === "Mixed"
                        ? " (Required for Friable and Mixed Clearances)"
                        : ""
                    }`}
                  />
                </Grid>
                {form.airMonitoring && (
                  <Grid item xs={12}>
                    <Box sx={{ mb: 2 }}>
                      <FormControl component="fieldset">
                        <RadioGroup
                          row
                          name="reportType"
                          value={form.airMonitoringReportType}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              airMonitoringReportType: e.target.value,
                              airMonitoringReport: null,
                            })
                          }
                        >
                          <FormControlLabel
                            value="select"
                            control={<Radio />}
                            label="Select from existing reports"
                          />
                          <FormControlLabel
                            value="upload"
                            control={<Radio />}
                            label="Upload new report"
                          />
                        </RadioGroup>
                      </FormControl>
                    </Box>

                    {form.airMonitoringReportType === "select" ? (
                      <FormControl fullWidth>
                        <InputLabel>Select Air Monitoring Report</InputLabel>
                        <Select
                          value={getAirMonitoringReportValue()}
                          onChange={async (e) => {
                            const selectedShiftId = e.target.value;
                            if (selectedShiftId) {
                              try {
                                // Generate the PDF for the selected shift
                                const selectedReport =
                                  airMonitoringReports.find(
                                    (r) => r.id === selectedShiftId
                                  );
                                if (selectedReport) {
                                  // Import the generateShiftReport function
                                  const { generateShiftReport } = await import(
                                    "../../utils/generateShiftReport"
                                  );

                                  // Generate the PDF and get base64 data
                                  const pdfData = await generateShiftReport({
                                    shift: selectedReport.shift,
                                    job: selectedReport.job,
                                    samples: selectedReport.samples,
                                    project: {
                                      name: selectedReport.projectName,
                                      projectID: selectedReport.projectId,
                                    },
                                    returnPdfData: true,
                                    sitePlanData: selectedReport.shift?.sitePlan
                                      ? {
                                          sitePlan:
                                            selectedReport.shift.sitePlan,
                                          sitePlanData:
                                            selectedReport.shift.sitePlanData,
                                        }
                                      : null,
                                  });

                                  setForm({
                                    ...form,
                                    airMonitoringReport: pdfData,
                                  });
                                }
                              } catch (error) {
                                console.error(
                                  "Error generating air monitoring PDF:",
                                  error
                                );
                                // Fallback to storing the shift ID
                                setForm({
                                  ...form,
                                  airMonitoringReport: selectedShiftId,
                                });
                              }
                            } else {
                              setForm({
                                ...form,
                                airMonitoringReport: "",
                              });
                            }
                          }}
                          label="Select Air Monitoring Report"
                          disabled={loadingReports}
                        >
                          <MenuItem value="">
                            <em>Select a report...</em>
                          </MenuItem>
                          {airMonitoringReports.map((report) => (
                            <MenuItem key={report.id} value={report.id}>
                              {report.name}
                            </MenuItem>
                          ))}
                        </Select>
                        {loadingReports && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            Loading reports...
                          </Typography>
                        )}
                        {!loadingReports &&
                          airMonitoringReports.length === 0 &&
                          form.projectId && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              No completed air monitoring shifts found for this
                              project
                            </Typography>
                          )}
                        {!loadingReports && airMonitoringReports.length > 0 && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                          >
                            Only completed shifts are shown
                          </Typography>
                        )}
                        {!loadingReports &&
                          form.airMonitoringReport &&
                          typeof form.airMonitoringReport === "string" &&
                          form.airMonitoringReport.length < 100 &&
                          !airMonitoringReports.find(
                            (report) => report.id === form.airMonitoringReport
                          ) && (
                            <Typography
                              variant="body2"
                              color="error"
                              sx={{ mt: 1 }}
                            >
                              Previously selected shift is no longer available
                            </Typography>
                          )}
                      </FormControl>
                    ) : (
                      <>
                        <input
                          accept=".pdf"
                          style={{ display: "none" }}
                          id="air-monitoring-report-upload"
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                // Extract just the base64 data from the data URL
                                const dataUrl = event.target.result;
                                const base64Data = dataUrl.split(",")[1]; // Remove the "data:application/pdf;base64," prefix
                                setForm({
                                  ...form,
                                  airMonitoringReport: base64Data,
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label htmlFor="air-monitoring-report-upload">
                          <Button
                            variant="outlined"
                            component="span"
                            startIcon={<PictureAsPdfIcon />}
                          >
                            Upload Air Monitoring Report (PDF)
                          </Button>
                        </label>
                      </>
                    )}

                    {form.airMonitoringReport && (
                      <Typography
                        variant="body2"
                        color="success.main"
                        sx={{ mt: 1 }}
                      >
                        ✓{" "}
                        {form.airMonitoringReportType === "select"
                          ? "Report selected"
                          : "Report uploaded successfully"}
                      </Typography>
                    )}
                  </Grid>
                )}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.sitePlan}
                        onChange={(e) =>
                          setForm({ ...form, sitePlan: e.target.checked })
                        }
                        color="primary"
                      />
                    }
                    label="Include Site Plan"
                  />
                </Grid>
                {form.sitePlan && (
                  <Grid item xs={12}>
                    <input
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: "none" }}
                      id="site-plan-upload"
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            // Extract just the base64 data from the data URL
                            const dataUrl = event.target.result;
                            const base64Data = dataUrl.split(",")[1]; // Remove the "data:application/pdf;base64," prefix
                            setForm({
                              ...form,
                              sitePlanFile: base64Data,
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="site-plan-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<PictureAsPdfIcon />}
                      >
                        Upload Site Plan (PDF, JPG, PNG)
                      </Button>
                    </label>
                    {form.sitePlanFile && (
                      <Typography
                        variant="body2"
                        color="success.main"
                        sx={{ mt: 1 }}
                      >
                        ✓ Site plan uploaded successfully
                      </Typography>
                    )}
                  </Grid>
                )}
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
              <Button type="submit" variant="contained">
                {editingClearance ? "Update" : "Create"}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default AsbestosClearance;
