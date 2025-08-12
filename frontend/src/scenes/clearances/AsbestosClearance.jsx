import React, { useState, useEffect } from "react";
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
  Snackbar,
  Autocomplete,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DescriptionIcon from "@mui/icons-material/Description";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import VisibilityIcon from "@mui/icons-material/Visibility";
import TodayIcon from "@mui/icons-material/Today";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import { projectService, userService } from "../../services/api";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import PermissionGate from "../../components/PermissionGate";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";

// ASBESTOS_REMOVALISTS array from air monitoring modal
const ASBESTOS_REMOVALISTS = [
  "AGH",
  "Aztech Services",
  "Capstone",
  "Crown Asbestos Removals",
  "Empire Contracting",
  "Glade Group",
  "IAR",
  "Jesco",
  "Ozbestos",
  "Spec Services",
];

const AsbestosClearance = () => {
  const colors = tokens;
  const navigate = useNavigate();

  const [clearances, setClearances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClearance, setEditingClearance] = useState(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [form, setForm] = useState({
    projectId: "",
    clearanceDate: "",
    inspectionTime: "",
    clearanceType: "Non-friable",
    LAA: "",
    asbestosRemovalist: "",
    airMonitoring: false,
    airMonitoringReport: null,
    sitePlan: false,
    sitePlanFile: null,
    notes: "",
  });

  // Fetch clearances, projects, and users on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clearancesData, projectsData, usersData] = await Promise.all([
        asbestosClearanceService.getAll(),
        projectService.getAll({
          limit: 1000,
          status:
            "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClearance) {
        await asbestosClearanceService.update(editingClearance._id, form);
        setSnackbar({
          open: true,
          message: "Clearance updated successfully",
          severity: "success",
        });
      } else {
        await asbestosClearanceService.create(form);
        setSnackbar({
          open: true,
          message: "Clearance created successfully",
          severity: "success",
        });
      }

      setDialogOpen(false);
      setEditingClearance(null);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving clearance:", err);
      setSnackbar({
        open: true,
        message: "Failed to save clearance",
        severity: "error",
      });
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
      sitePlan: clearance.sitePlan || false,
      sitePlanFile: clearance.sitePlanFile || null,
      notes: clearance.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (clearance) => {
    if (window.confirm("Are you sure you want to delete this clearance?")) {
      try {
        await asbestosClearanceService.delete(clearance._id);
        setSnackbar({
          open: true,
          message: "Clearance deleted successfully",
          severity: "success",
        });
        fetchData();
      } catch (err) {
        console.error("Error deleting clearance:", err);
        setSnackbar({
          open: true,
          message: "Failed to delete clearance",
          severity: "error",
        });
      }
    }
  };

  const handleViewItems = (clearance) => {
    navigate(`/clearances/${clearance._id}/items`);
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

      setSnackbar({
        open: true,
        message: `PDF generated successfully: ${fileName}`,
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
      sitePlan: false,
      sitePlanFile: null,
      notes: "",
    });
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

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return "success";
      case "in progress":
        return "warning";
      case "Site Work Complete":
        return "info";
      default:
        return "default";
    }
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
          <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h4"
            color={colors.grey[500]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Asbestos Clearances
          </Typography>
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
        </Box>

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
                      <TableCell>Project ID</TableCell>
                      <TableCell>Clearance Date</TableCell>
                      <TableCell>Project Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(clearances) &&
                      (clearances || []).map((clearance) => (
                        <TableRow key={clearance._id}>
                          <TableCell>
                            {getProjectName(clearance.projectId)}
                          </TableCell>
                          <TableCell>
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
                          <TableCell>
                            {getProjectDisplayName(clearance.projectId)}
                          </TableCell>
                          <TableCell>{clearance.clearanceType}</TableCell>
                          <TableCell>
                            <Chip
                              label={clearance.status}
                              color={getStatusColor(clearance.status)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              onClick={() => handleViewItems(clearance)}
                              color="info"
                              size="small"
                              title="View Items"
                            >
                              <VisibilityIcon />
                            </IconButton>
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
                      setForm({
                        ...form,
                        projectId: newValue ? newValue._id : "",
                      })
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
                  <FormControl fullWidth required>
                    <InputLabel>Clearance Type</InputLabel>
                    <Select
                      value={form.clearanceType}
                      onChange={(e) => {
                        const newClearanceType = e.target.value;
                        setForm({
                          ...form,
                          clearanceType: newClearanceType,
                          // Automatically enable air monitoring for friable clearance
                          airMonitoring:
                            newClearanceType === "Friable"
                              ? true
                              : form.airMonitoring,
                        });
                      }}
                      label="Clearance Type"
                    >
                      <MenuItem value="Non-friable">Non-friable</MenuItem>
                      <MenuItem value="Friable">Friable</MenuItem>
                    </Select>
                  </FormControl>
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
                      {ASBESTOS_REMOVALISTS.map((removalist) => (
                        <MenuItem key={removalist} value={removalist}>
                          {removalist}
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
                        disabled={form.clearanceType === "Friable"}
                        color="primary"
                      />
                    }
                    label={`Include Air Monitoring Report${
                      form.clearanceType === "Friable"
                        ? " (Required for Friable Clearance)"
                        : ""
                    }`}
                  />
                </Grid>
                {form.airMonitoring && (
                  <Grid item xs={12}>
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
                    {form.airMonitoringReport && (
                      <Typography
                        variant="body2"
                        color="success.main"
                        sx={{ mt: 1 }}
                      >
                        ✓ Report uploaded successfully
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

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </PermissionGate>
  );
};

export default AsbestosClearance;
