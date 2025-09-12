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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { tokens } from "../../theme/tokens";
import { jobService, shiftService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import customDataFieldGroupService from "../../services/customDataFieldGroupService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";
import PDFLoadingOverlay from "../../components/PDFLoadingOverlay";

const AsbestosRemovalJobDetails = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { jobId } = useParams();

  const [job, setJob] = useState(null);
  const [airMonitoringShifts, setAirMonitoringShifts] = useState([]);
  const [clearances, setClearances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [asbestosRemovalists, setAsbestosRemovalists] = useState([]);
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

  const [clearanceForm, setClearanceForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "",
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

      const allShifts = shiftsWithJobs.flat();
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
    }
  }, [jobId, fetchJobDetails, fetchAsbestosRemovalists]);

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

  const handleBackToJobs = () => {
    navigate("/asbestos-removal");
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleCreateAirMonitoringShift = () => {
    // Navigate to air monitoring page to create a new job
    navigate("/air-monitoring");
  };

  const handleCreateClearance = () => {
    setEditingClearance(null);
    resetClearanceForm();
    setClearanceDialogOpen(true);
  };

  const handleClearanceRowClick = (clearance) => {
    // Navigate to clearance items page
    navigate(`/clearances/${clearance._id}/items`);
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

  const resetClearanceForm = () => {
    setClearanceForm({
      projectId: job?.projectId._id || job?.projectId || "",
      clearanceDate: new Date().toISOString().split("T")[0],
      inspectionTime: "",
      clearanceType: "Non-friable",
      LAA: "",
      asbestosRemovalist: job?.asbestosRemovalist || "",
      airMonitoring: false,
      airMonitoringReport: null,
      airMonitoringReportType: "select",
      sitePlan: false,
      sitePlanFile: null,
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
        sitePlan: clearanceForm.sitePlan,
        sitePlanFile: clearanceForm.sitePlanFile,
        notes: clearanceForm.notes,
      };

      const response = await asbestosClearanceService.create(newClearanceData);
      console.log("Clearance creation response:", response);

      // Close modal and refresh data regardless of response structure
      await fetchJobDetails();
      setClearanceDialogOpen(false);
      resetClearanceForm();
    } catch (err) {
      console.error("Error creating clearance:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create clearance"
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
                        Job Name
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Shift Date
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Status
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Sample Count
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {airMonitoringShifts.map((shift) => (
                      <TableRow key={shift._id} hover>
                        <TableCell>{shift.jobName}</TableCell>
                        <TableCell>
                          {shift.shiftDate
                            ? new Date(shift.shiftDate).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={shift.status || "Unknown"}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(shift.status),
                              color: "white",
                            }}
                          />
                        </TableCell>
                        <TableCell>{shift.sampleCount || 0}</TableCell>
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
                            label={clearance.status || "Unknown"}
                            size="small"
                            sx={{
                              backgroundColor: getStatusColor(clearance.status),
                              color: "white",
                            }}
                          />
                        </TableCell>
                        <TableCell>{clearance.LAA || "N/A"}</TableCell>
                        <TableCell>
                          {clearance.status === "complete" && (
                            <Button
                              variant="text"
                              size="small"
                              onClick={(e) => handleGeneratePDF(clearance, e)}
                              disabled={generatingPDF}
                              sx={{ minWidth: "auto", p: 0.5 }}
                              title="Generate PDF Report"
                            >
                              <PictureAsPdfIcon color="primary" />
                            </Button>
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
                <TextField
                  fullWidth
                  label="Inspection Time"
                  value={clearanceForm.inspectionTime}
                  onChange={(e) =>
                    setClearanceForm({
                      ...clearanceForm,
                      inspectionTime: e.target.value,
                    })
                  }
                  placeholder="e.g., 09:00"
                  required
                />
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
                <TextField
                  fullWidth
                  label="LAA (Licensed Asbestos Assessor)"
                  value={clearanceForm.LAA}
                  onChange={(e) =>
                    setClearanceForm({ ...clearanceForm, LAA: e.target.value })
                  }
                  required
                />
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={clearanceForm.sitePlan}
                      onChange={(e) =>
                        setClearanceForm({
                          ...clearanceForm,
                          sitePlan: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Site Plan Required"
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
              {creating ? "Creating..." : "Create Clearance"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
        severity={snackbar.severity}
      />
    </Box>
  );
};

export default AsbestosRemovalJobDetails;
