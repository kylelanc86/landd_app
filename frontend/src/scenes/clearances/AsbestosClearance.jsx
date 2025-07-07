import React, { useState, useEffect } from "react";
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
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PictureAsPdf as PdfIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";

import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import projectService from "../../services/projectService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";

const AsbestosClearance = () => {
  const colors = tokens;
  const navigate = useNavigate();

  const [clearances, setClearances] = useState([]);
  const [projects, setProjects] = useState([]);
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
    clearanceType: "Non-friable",
    LAA: "",
    asbestosRemovalist: "",
    notes: "",
  });

  // Fetch clearances and projects on component mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clearancesData, projectsData] = await Promise.all([
        asbestosClearanceService.getAll(),
        projectService.getAll({
          limit: 1000,
          status:
            "Assigned,In progress,Samples submitted,Lab Analysis Complete,Report sent for review,Ready for invoicing,Invoice sent",
        }),
      ]);

      console.log("Clearances API response:", clearancesData);
      console.log("Projects API response:", projectsData);

      setClearances(
        clearancesData.clearances || clearancesData.data || clearancesData || []
      );
      setProjects(projectsData.data || projectsData);
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
      clearanceType: clearance.clearanceType,
      LAA: clearance.LAA,
      asbestosRemovalist: clearance.asbestosRemovalist,
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
      clearanceType: "Non-friable",
      LAA: "",
      asbestosRemovalist: "",
      notes: "",
    });
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
    // Handle case where projectId is an object with _id
    const projectIdValue = projectId?._id || projectId;
    const project = projects.find((p) => p._id === projectIdValue);
    return project ? project.projectID : "Unknown Project";
  };

  const getProjectDisplayName = (projectId) => {
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
            variant="h2"
            color={colors.grey[100]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Asbestos Clearance
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
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Project ID</TableCell>
                    <TableCell>Project Name</TableCell>
                    <TableCell>Clearance Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Removalist</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(clearances || []).map((clearance) => (
                    <TableRow key={clearance._id}>
                      <TableCell>
                        {getProjectName(clearance.projectId)}
                      </TableCell>
                      <TableCell>
                        {getProjectDisplayName(clearance.projectId)}
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
                      <TableCell>{clearance.clearanceType}</TableCell>
                      <TableCell>{clearance.asbestosRemovalist}</TableCell>
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
                          <ViewIcon />
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
                          <PdfIcon />
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
                  <FormControl fullWidth required>
                    <InputLabel>Project</InputLabel>
                    <Select
                      value={form.projectId}
                      onChange={(e) =>
                        setForm({ ...form, projectId: e.target.value })
                      }
                      label="Project"
                    >
                      {(projects || []).map((project) => (
                        <MenuItem key={project._id} value={project._id}>
                          {project.projectID}: {project.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
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
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Clearance Type</InputLabel>
                    <Select
                      value={form.clearanceType}
                      onChange={(e) =>
                        setForm({ ...form, clearanceType: e.target.value })
                      }
                      label="Clearance Type"
                    >
                      <MenuItem value="Non-friable">Non-friable</MenuItem>
                      <MenuItem value="Friable">Friable</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="LAA"
                    value={form.LAA}
                    onChange={(e) => setForm({ ...form, LAA: e.target.value })}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Asbestos Removalist"
                    value={form.asbestosRemovalist}
                    onChange={(e) =>
                      setForm({ ...form, asbestosRemovalist: e.target.value })
                    }
                    required
                  />
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
