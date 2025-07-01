import React, { useState, useEffect } from "react";
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
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import userService from "../../services/userService";
import Header from "../../components/Header";
import performanceMonitor from "../../utils/performanceMonitor";
import { generateClearanceReport } from "../../utils/generateClearanceReport";

const ClearanceReports = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { clearanceId } = useParams();

  const [clearance, setClearance] = useState(null);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addReportDialog, setAddReportDialog] = useState(false);
  const [editReportDialog, setEditReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [addItemDialog, setAddItemDialog] = useState(false);
  const [editItemDialog, setEditItemDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState({
    clearanceDate: "",
    status: "in_progress",
    LAA: "",
    notes: "",
  });
  const [itemForm, setItemForm] = useState({
    locationDescription: "",
    materialDescription: "",
    asbestosType: "",
    notes: "",
  });

  useEffect(() => {
    performanceMonitor.startPageLoad("Clearance Reports");
    fetchClearanceData();
    fetchUsers();
  }, [clearanceId]);

  const fetchClearanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clearance details
      const clearanceResponse = await asbestosClearanceService.getById(
        clearanceId
      );
      console.log("Clearance response:", clearanceResponse);
      console.log("Project ID data:", clearanceResponse?.projectId);
      setClearance(clearanceResponse);

      // Fetch reports for this clearance
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      console.log("Reports response:", reportsResponse);
      setReports(reportsResponse);

      performanceMonitor.endPageLoad("Clearance Reports");
    } catch (err) {
      console.error("Error fetching clearance data:", err);
      setError(err.message || "Failed to fetch clearance data");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersResponse = await userService.getAll();
      console.log("Users response:", usersResponse);
      setUsers(usersResponse.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      // Don't set error here as it's not critical for the main functionality
    }
  };

  const handleAddReport = async (e) => {
    e.preventDefault();
    try {
      const selectedUser = users.find((user) => user._id === form.LAA);
      const newReportData = {
        clearanceId: clearanceId,
        clearanceDate: form.clearanceDate,
        status: form.status,
        LAA: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`
          : form.LAA,
        notes: form.notes,
      };

      const response = await asbestosClearanceReportService.create(
        newReportData
      );
      console.log("New report created:", response);

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);

      setAddReportDialog(false);
      setForm({
        clearanceDate: "",
        status: "in_progress",
        LAA: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error adding report:", err);
      setError(err.message || "Failed to add report");
    }
  };

  const handleEditReport = (report) => {
    setSelectedReport(report);
    // Find the user by name for editing
    const user = users.find(
      (u) => `${u.firstName} ${u.lastName}` === report.LAA
    );
    setForm({
      clearanceDate: report.clearanceDate,
      status: report.status,
      LAA: user ? user._id : "",
      notes: report.notes,
    });
    setEditReportDialog(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const selectedUser = users.find((user) => user._id === form.LAA);
      const updateData = {
        clearanceDate: form.clearanceDate,
        status: form.status,
        LAA: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`
          : form.LAA,
        notes: form.notes,
      };

      await asbestosClearanceReportService.update(
        selectedReport._id,
        updateData
      );

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);

      setEditReportDialog(false);
      setSelectedReport(null);
      setForm({
        clearanceDate: "",
        status: "in_progress",
        LAA: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error editing report:", err);
      setError(err.message || "Failed to edit report");
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await asbestosClearanceReportService.delete(reportId);

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);
    } catch (err) {
      console.error("Error deleting report:", err);
      setError(err.message || "Failed to delete report");
    }
  };

  const handlePrintReport = (report) => {
    // TODO: Implement print functionality
    console.log("Printing report:", report);
  };

  const handleDownloadReport = (report) => {
    // TODO: Implement download functionality
    console.log("Downloading report:", report);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return theme.palette.success.main;
      case "in_progress":
        return theme.palette.info.main;
      case "pending":
        return theme.palette.warning.main;
      case "failed":
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getReportTypeLabel = (type) => {
    switch (type) {
      case "clearance_certificate":
        return "Clearance Certificate";
      case "final_report":
        return "Final Report";
      case "interim_report":
        return "Interim Report";
      default:
        return type;
    }
  };

  // Clearance Item Handlers
  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const newItemData = {
        clearanceId: clearanceId,
        locationDescription: itemForm.locationDescription,
        materialDescription: itemForm.materialDescription,
        asbestosType: itemForm.asbestosType,
        photograph: photoPreview,
        notes: itemForm.notes,
      };

      // Create the clearance report item
      await asbestosClearanceReportService.create(newItemData);

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);

      setAddItemDialog(false);
      setItemForm({
        locationDescription: "",
        materialDescription: "",
        asbestosType: "",
        notes: "",
      });
      setPhotoPreview(null);
    } catch (err) {
      console.error("Error adding item:", err);
      setError(err.message || "Failed to add item");
    }
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setItemForm({
      locationDescription: item.locationDescription,
      materialDescription: item.materialDescription,
      asbestosType: item.asbestosType || "",
      notes: item.notes,
    });
    setPhotoPreview(item.photograph);
    setEditItemDialog(true);
  };

  const handleSaveEditItem = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        locationDescription: itemForm.locationDescription,
        materialDescription: itemForm.materialDescription,
        asbestosType: itemForm.asbestosType,
        photograph: photoPreview,
        notes: itemForm.notes,
      };

      // Update the clearance report item
      await asbestosClearanceReportService.update(selectedItem._id, updateData);

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);

      setEditItemDialog(false);
      setSelectedItem(null);
      setItemForm({
        locationDescription: "",
        materialDescription: "",
        asbestosType: "",
        notes: "",
      });
      setPhotoPreview(null);
    } catch (err) {
      console.error("Error editing item:", err);
      setError(err.message || "Failed to edit item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      // Delete the clearance report item
      await asbestosClearanceReportService.delete(itemId);

      // Refresh the reports list
      const reportsResponse =
        await asbestosClearanceReportService.getByClearanceId(clearanceId);
      setReports(reportsResponse);
    } catch (err) {
      console.error("Error deleting item:", err);
      setError(err.message || "Failed to delete item");
    }
  };

  const generatePDFReport = async () => {
    if (!clearance) {
      setError("No clearance data available for PDF generation");
      return;
    }
    await generateClearanceReport(clearance, setError, {
      includePhotographs: true,
    });
  };

  const handleSiteWorkComplete = async () => {
    try {
      setError(null);
      await asbestosClearanceService.updateStatus(
        clearanceId,
        "Site Work Complete"
      );

      // Navigate back to the asbestos clearance list
      navigate("/clearances/asbestos");
    } catch (err) {
      console.error("Error updating clearance status:", err);
      setError(err.message || "Failed to update clearance status");
    }
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (limit to 10MB before compression)
      if (file.size > 10 * 1024 * 1024) {
        setError("Photo file size must be less than 10MB");
        return;
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        setError("Please select a valid image file");
        return;
      }

      try {
        setError(null); // Clear any previous errors

        // Show loading state
        setPhotoPreview("loading");

        // Compress the image
        const compressedImage = await compressImage(file, 1200, 1200, 0.8);

        // Set the compressed image as preview
        setPhotoPreview(compressedImage);

        console.log("Image compressed successfully");
      } catch (error) {
        console.error("Error compressing image:", error);
        setError("Failed to process the photo file");
        setPhotoPreview(null);
      }
    }
  };

  // Detect if device is mobile/tablet
  const isMobileDevice = () => {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2)
    );
  };

  // Compress image function
  const compressImage = (
    file,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8
  ) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

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
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/clearances/asbestos")}
        sx={{ mb: 4 }}
      >
        Back to Clearances
      </Button>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Box>
          <Header
            title="Clearance Items"
            subtitle={`Project: ${
              clearance?.projectId?.projectID || "Loading..."
            }`}
            secondarySubtitle={clearance?.projectId?.name || "Loading..."}
          />
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddItemDialog(true)}
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
            Add Clearance Item
          </Button>
          {clearance?.status !== "Site Work Complete" && (
            <Button
              variant="contained"
              startIcon={<CheckCircleIcon />}
              onClick={handleSiteWorkComplete}
              sx={{
                backgroundColor: theme.palette.success.main,
                color: theme.palette.common.white,
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                "&:hover": {
                  backgroundColor: theme.palette.success.dark,
                },
              }}
            >
              Site Work Complete
            </Button>
          )}
          {clearance?.status === "Site Work Complete" && (
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={generatePDFReport}
              sx={{
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                "&:hover": {
                  borderColor: theme.palette.primary.dark,
                  backgroundColor: theme.palette.primary.light,
                },
              }}
            >
              Generate PDF Report
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Typography
          color={error.includes("successfully") ? "success" : "error"}
          sx={{ mb: 2 }}
        >
          {error}
        </Typography>
      )}

      {/* Reports Table */}
      <Box
        m="40px 0 0 0"
        height="75vh"
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
        }}
      >
        <DataGrid
          rows={reports}
          columns={[
            {
              field: "locationDescription",
              headerName: "Location",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                return params.row.locationDescription || "N/A";
              },
            },
            {
              field: "materialDescription",
              headerName: "Material Description",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                return params.row.materialDescription || "N/A";
              },
            },
            {
              field: "asbestosType",
              headerName: "Asbestos Type",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => {
                return (
                  <Chip
                    label={params.row.asbestosType || "N/A"}
                    sx={{
                      backgroundColor:
                        params.row.asbestosType === "friable"
                          ? theme.palette.warning.main
                          : theme.palette.success.main,
                      color: theme.palette.common.white,
                      fontWeight: "bold",
                    }}
                  />
                );
              },
            },
            {
              field: "photograph",
              headerName: "Item Photographs",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                return params.row.photograph ? "Photo Available" : "No Photo";
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
                      onClick={() => handleEditItem(row)}
                      title="Edit Item"
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteItem(row._id)}
                      title="Delete Item"
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
              <Box sx={{ p: 2, textAlign: "center" }}>No items found</Box>
            ),
            ErrorOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center", color: "error.main" }}>
                {error || "An error occurred"}
              </Box>
            ),
          }}
        />
      </Box>

      {/* Add Report Dialog */}
      <Dialog
        open={addReportDialog}
        onClose={() => setAddReportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Report</DialogTitle>
        <form onSubmit={handleAddReport}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Clearance Date"
                type="date"
                value={form.clearanceDate}
                onChange={(e) =>
                  setForm({ ...form, clearanceDate: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <FormControl fullWidth required>
                <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                <Select
                  value={form.LAA}
                  label="LAA (Licensed Asbestos Assessor)"
                  onChange={(e) => setForm({ ...form, LAA: e.target.value })}
                >
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddReportDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!form.clearanceDate || !form.LAA}
            >
              Add Report
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Report Dialog */}
      <Dialog
        open={editReportDialog}
        onClose={() => setEditReportDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Report</DialogTitle>
        <form onSubmit={handleSaveEdit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Clearance Date"
                type="date"
                value={form.clearanceDate}
                onChange={(e) =>
                  setForm({ ...form, clearanceDate: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <FormControl fullWidth required>
                <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                <Select
                  value={form.LAA}
                  label="LAA (Licensed Asbestos Assessor)"
                  onChange={(e) => setForm({ ...form, LAA: e.target.value })}
                >
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.firstName} {user.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditReportDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!form.clearanceDate || !form.LAA}
            >
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Add Clearance Item Dialog */}
      <Dialog
        open={addItemDialog}
        onClose={() => setAddItemDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Clearance Item</Typography>
            <IconButton onClick={() => setAddItemDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleAddItem}>
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
                label="Location Description"
                value={itemForm.locationDescription}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    locationDescription: e.target.value,
                  })
                }
                required
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                label="Material Description"
                value={itemForm.materialDescription}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    materialDescription: e.target.value,
                  })
                }
                required
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth required>
                <InputLabel>Asbestos Type</InputLabel>
                <Select
                  value={itemForm.asbestosType}
                  label="Asbestos Type"
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      asbestosType: e.target.value,
                    })
                  }
                >
                  <MenuItem value="friable">Friable</MenuItem>
                  <MenuItem value="non-friable">Non-friable</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Photograph
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  {isMobileDevice() ? (
                    <>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<PhotoCameraIcon />}
                        sx={{ mb: 2 }}
                      >
                        Take Photo (Camera)
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoChange}
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<PhotoCameraIcon />}
                        sx={{ mb: 2 }}
                      >
                        Choose from Gallery
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCameraIcon />}
                      sx={{ mb: 2 }}
                    >
                      Choose Photo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                    </Button>
                  )}
                </Box>
                {photoPreview && (
                  <Box sx={{ mt: 2 }}>
                    {photoPreview === "loading" ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 2,
                          border: "1px dashed #ccc",
                          borderRadius: "4px",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          Compressing image...
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <img
                          src={photoPreview}
                          alt="Preview"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "200px",
                            borderRadius: "4px",
                          }}
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => setPhotoPreview(null)}
                          sx={{ mt: 1 }}
                        >
                          Remove Photo
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </Box>
              <TextField
                label="Notes"
                value={itemForm.notes}
                onChange={(e) =>
                  setItemForm({ ...itemForm, notes: e.target.value })
                }
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddItemDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !itemForm.locationDescription ||
                !itemForm.materialDescription ||
                !itemForm.asbestosType
              }
            >
              Add Item
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Clearance Item Dialog */}
      <Dialog
        open={editItemDialog}
        onClose={() => setEditItemDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Edit Clearance Item</Typography>
            <IconButton onClick={() => setEditItemDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveEditItem}>
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
                label="Location Description"
                value={itemForm.locationDescription}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    locationDescription: e.target.value,
                  })
                }
                required
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                label="Material Description"
                value={itemForm.materialDescription}
                onChange={(e) =>
                  setItemForm({
                    ...itemForm,
                    materialDescription: e.target.value,
                  })
                }
                required
                fullWidth
                multiline
                rows={2}
              />
              <FormControl fullWidth required>
                <InputLabel>Asbestos Type</InputLabel>
                <Select
                  value={itemForm.asbestosType}
                  label="Asbestos Type"
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      asbestosType: e.target.value,
                    })
                  }
                >
                  <MenuItem value="friable">Friable</MenuItem>
                  <MenuItem value="non-friable">Non-friable</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Photograph
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  {isMobileDevice() ? (
                    <>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<PhotoCameraIcon />}
                        sx={{ mb: 2 }}
                      >
                        Take Photo (Camera)
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoChange}
                        />
                      </Button>
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<PhotoCameraIcon />}
                        sx={{ mb: 2 }}
                      >
                        Choose from Gallery
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handlePhotoChange}
                        />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCameraIcon />}
                      sx={{ mb: 2 }}
                    >
                      Choose Photo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                    </Button>
                  )}
                </Box>
                {photoPreview && (
                  <Box sx={{ mt: 2 }}>
                    {photoPreview === "loading" ? (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          p: 2,
                          border: "1px dashed #ccc",
                          borderRadius: "4px",
                          backgroundColor: "#f5f5f5",
                        }}
                      >
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          Compressing image...
                        </Typography>
                      </Box>
                    ) : (
                      <>
                        <img
                          src={photoPreview}
                          alt="Preview"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "200px",
                            borderRadius: "4px",
                          }}
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => setPhotoPreview(null)}
                          sx={{ mt: 1 }}
                        >
                          Remove Photo
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </Box>
              <TextField
                label="Notes"
                value={itemForm.notes}
                onChange={(e) =>
                  setItemForm({ ...itemForm, notes: e.target.value })
                }
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditItemDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !itemForm.locationDescription ||
                !itemForm.materialDescription ||
                !itemForm.asbestosType
              }
            >
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
};

export default ClearanceReports;
