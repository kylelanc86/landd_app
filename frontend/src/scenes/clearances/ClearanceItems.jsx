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
  Alert,
  Snackbar,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  PhotoCamera as PhotoCameraIcon,
  Upload as UploadIcon,
  Delete as DeletePhotoIcon,
} from "@mui/icons-material";

import { useNavigate, useParams } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";
import asbestosClearanceReportService from "../../services/asbestosClearanceReportService";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import { compressImage, needsCompression } from "../../utils/imageCompression";

const ClearanceItems = () => {
  const colors = tokens;
  const navigate = useNavigate();
  const { clearanceId } = useParams();

  const [items, setItems] = useState([]);
  const [clearance, setClearance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [form, setForm] = useState({
    locationDescription: "",
    materialDescription: "",
    asbestosType: "non-friable",
    photograph: "",
    notes: "",
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [compressionStatus, setCompressionStatus] = useState(null);

  // Fetch items and clearance data on component mount
  useEffect(() => {
    fetchData();
  }, [clearanceId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, clearanceData] = await Promise.all([
        asbestosClearanceReportService.getByClearanceId(clearanceId),
        asbestosClearanceService.getById(clearanceId),
      ]);

      console.log("Clearance items API response:", itemsData);
      console.log("Clearance API response:", clearanceData);

      setItems(itemsData || []);
      setClearance(clearanceData);
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
      const itemData = {
        ...form,
        clearanceId: clearanceId,
      };

      if (editingItem) {
        await asbestosClearanceReportService.update(editingItem._id, itemData);
        setSnackbar({
          open: true,
          message: "Item updated successfully",
          severity: "success",
        });
      } else {
        await asbestosClearanceReportService.create(itemData);
        setSnackbar({
          open: true,
          message: "Item created successfully",
          severity: "success",
        });
      }

      setDialogOpen(false);
      setEditingItem(null);
      resetForm();
      fetchData();
    } catch (err) {
      console.error("Error saving item:", err);
      setSnackbar({
        open: true,
        message: "Failed to save item",
        severity: "error",
      });
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      locationDescription: item.locationDescription,
      materialDescription: item.materialDescription,
      asbestosType: item.asbestosType,
      photograph: item.photograph || "",
      notes: item.notes || "",
    });
    setPhotoPreview(item.photograph || null);
    setPhotoFile(null);
    setDialogOpen(true);
  };

  const handleDelete = async (item) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await asbestosClearanceReportService.delete(item._id);
        setSnackbar({
          open: true,
          message: "Item deleted successfully",
          severity: "success",
        });
        fetchData();
      } catch (err) {
        console.error("Error deleting item:", err);
        setSnackbar({
          open: true,
          message: "Failed to delete item",
          severity: "error",
        });
      }
    }
  };

  const resetForm = () => {
    setForm({
      locationDescription: "",
      materialDescription: "",
      asbestosType: "non-friable",
      photograph: "",
      notes: "",
    });
    setPhotoPreview(null);
    setPhotoFile(null);
    setCompressionStatus(null);
  };

  const getAsbestosTypeColor = (type) => {
    switch (type) {
      case "friable":
        return "error";
      case "non-friable":
        return "warning";
      default:
        return "default";
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setPhotoFile(file);
      setCompressionStatus({
        type: "processing",
        message: "Processing image...",
      });

      try {
        const originalSizeKB = Math.round(file.size / 1024);

        // Check if compression is needed
        const shouldCompress = needsCompression(file, 300); // 300KB threshold

        if (shouldCompress) {
          console.log("Compressing image...");
          setCompressionStatus({
            type: "compressing",
            message: "Compressing image...",
          });

          const compressedImage = await compressImage(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
            maxSizeKB: 300,
          });

          const compressedSizeKB = Math.round(
            (compressedImage.length * 0.75) / 1024
          );
          const reduction = Math.round(
            ((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100
          );

          setPhotoPreview(compressedImage);
          setForm({ ...form, photograph: compressedImage });
          setCompressionStatus({
            type: "success",
            message: `Compressed: ${originalSizeKB}KB → ${compressedSizeKB}KB (${reduction}% reduction)`,
          });

          console.log("Image compressed successfully");
        } else {
          // Use original if no compression needed
          const reader = new FileReader();
          reader.onload = (e) => {
            setPhotoPreview(e.target.result);
            setForm({ ...form, photograph: e.target.result });
            setCompressionStatus({
              type: "info",
              message: `No compression needed (${originalSizeKB}KB)`,
            });
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error processing image:", error);
        // Fallback to original image if compression fails
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreview(e.target.result);
          setForm({ ...form, photograph: e.target.result });
          setCompressionStatus({
            type: "warning",
            message: "Compression failed, using original image",
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleTakePhoto = () => {
    // Create a file input for camera access
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment"; // Use back camera
    input.onchange = handlePhotoUpload;
    input.click();
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm({ ...form, photograph: "" });
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
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
          <Box display="flex" alignItems="center" gap={2}>
            <IconButton
              onClick={() => navigate("/clearances/asbestos")}
              color="primary"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h2"
                color={colors.grey[100]}
                fontWeight="bold"
                sx={{ mb: "5px" }}
              >
                Clearance Items
              </Typography>
              {clearance && (
                <Typography variant="h6" color={colors.secondary[500]}>
                  {clearance.projectId?.name || "Unknown Project"} -{" "}
                  {clearance.clearanceDate
                    ? new Date(clearance.clearanceDate).toLocaleDateString()
                    : "Unknown Date"}
                </Typography>
              )}
            </Box>
          </Box>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              setEditingItem(null);
              resetForm();
              setDialogOpen(true);
            }}
            startIcon={<AddIcon />}
          >
            Add Item
          </Button>
        </Box>

        <Card sx={{ mt: 3 }}>
          <CardContent>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell>Material Description</TableCell>
                    <TableCell>Asbestos Type</TableCell>
                    <TableCell>Photograph</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(items || []).map((item) => (
                    <TableRow key={item._id}>
                      <TableCell>{item.locationDescription}</TableCell>
                      <TableCell>{item.materialDescription}</TableCell>
                      <TableCell>
                        <Chip
                          label={item.asbestosType}
                          color={getAsbestosTypeColor(item.asbestosType)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {item.photograph ? (
                          <Chip label="Yes" color="success" size="small" />
                        ) : (
                          <Chip label="No" color="default" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {item.notes ? (
                          <Typography variant="body2" noWrap>
                            {item.notes}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No notes
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleEdit(item)}
                          color="primary"
                          size="small"
                          title="Edit"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleDelete(item)}
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
            {editingItem ? "Edit Item" : "Add New Item"}
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Location Description"
                    value={form.locationDescription}
                    onChange={(e) =>
                      setForm({ ...form, locationDescription: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Material Description"
                    value={form.materialDescription}
                    onChange={(e) =>
                      setForm({ ...form, materialDescription: e.target.value })
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Asbestos Type</InputLabel>
                    <Select
                      value={form.asbestosType}
                      onChange={(e) =>
                        setForm({ ...form, asbestosType: e.target.value })
                      }
                      label="Asbestos Type"
                    >
                      <MenuItem value="non-friable">Non-friable</MenuItem>
                      <MenuItem value="friable">Friable</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Photograph
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                      <Button
                        variant="outlined"
                        startIcon={<PhotoCameraIcon />}
                        onClick={handleTakePhoto}
                        size="small"
                      >
                        Take Photo
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<UploadIcon />}
                        component="label"
                        size="small"
                      >
                        Upload Photo
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={handlePhotoUpload}
                        />
                      </Button>
                      {photoPreview && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeletePhotoIcon />}
                          onClick={handleRemovePhoto}
                          size="small"
                        >
                          Remove
                        </Button>
                      )}
                    </Box>
                    {photoPreview && (
                      <Box
                        sx={{
                          width: 200,
                          height: 150,
                          borderRadius: 1,
                          overflow: "hidden",
                          border: "1px solid #ddd",
                          mb: 2,
                        }}
                      >
                        <img
                          src={photoPreview}
                          alt="Preview"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </Box>
                    )}
                    {compressionStatus && (
                      <Alert
                        severity={compressionStatus.type}
                        sx={{ mb: 2 }}
                        icon={
                          compressionStatus.type === "processing" ||
                          compressionStatus.type === "compressing" ? (
                            <CircularProgress size={16} />
                          ) : undefined
                        }
                      >
                        {compressionStatus.message}
                      </Alert>
                    )}
                  </Box>
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
                {editingItem ? "Update" : "Create"}
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

export default ClearanceItems;
