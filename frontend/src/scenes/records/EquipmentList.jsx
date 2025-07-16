import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
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
  Breadcrumbs,
  Link,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { equipmentService } from "../../services/equipmentService";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const EquipmentList = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [form, setForm] = useState({
    equipmentReference: "",
    equipmentType: "",
    section: "",
    brandModel: "",
    status: "active",
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
    navigate("/records");
  };

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await equipmentService.getAll({
        limit: 100,
        ...filters,
      });
      console.log("Equipment data:", response);
      console.log("First equipment item:", response.equipment?.[0]);
      console.log(
        "Equipment fields:",
        response.equipment?.[0] ? Object.keys(response.equipment[0]) : []
      );
      setEquipment(response.equipment || []);
    } catch (err) {
      console.error("Error fetching equipment:", err);
      setError(err.message || "Failed to fetch equipment");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetchEquipment();
  }, [filters]);

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    try {
      await equipmentService.create(form);

      setAddDialog(false);
      setForm({
        equipmentReference: "",
        equipmentType: "",
        section: "",
        brandModel: "",
        status: "active",
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
      status: equipment.status,
      lastCalibration: equipment.lastCalibration
        ? new Date(equipment.lastCalibration).toISOString().split("T")[0]
        : "",
      calibrationDue: equipment.calibrationDue
        ? new Date(equipment.calibrationDue).toISOString().split("T")[0]
        : "",
      calibrationFrequency: equipment.calibrationFrequency,
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await equipmentService.update(selectedEquipment._id, form);

      setEditDialog(false);
      setSelectedEquipment(null);
      setForm({
        equipmentReference: "",
        equipmentType: "",
        section: "",
        brandModel: "",
        status: "active",
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

  const getCalibrationStatus = (calibrationDue) => {
    const dueDate = new Date(calibrationDue);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) {
      return { status: "Overdue", color: theme.palette.error.main };
    } else if (daysUntilDue <= 30) {
      return { status: "Due Soon", color: theme.palette.warning.main };
    } else {
      return { status: "OK", color: theme.palette.success.main };
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return theme.palette.success.main;
      case "calibration due":
        return theme.palette.warning.main;
      case "out-of-service":
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
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
            Records Home
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
              {equipmentService.getStatusOptions().map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
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
          rows={equipment}
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
              renderCell: (params) => {
                const status = getStatusColor(params.row.status);
                return (
                  <Box>
                    <Typography variant="body2" sx={{ color: status }}>
                      {params.row.status.charAt(0).toUpperCase() +
                        params.row.status.slice(1)}
                    </Typography>
                  </Box>
                );
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
                const status = getCalibrationStatus(params.row.calibrationDue);
                return (
                  <Box>
                    <Typography variant="body2">
                      {new Date(params.row.calibrationDue).toLocaleDateString()}
                    </Typography>
                    <Chip
                      label={status.status}
                      size="small"
                      sx={{
                        backgroundColor: status.color,
                        color: theme.palette.common.white,
                        fontSize: "0.7rem",
                        height: "20px",
                      }}
                    />
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
        onClose={() => setAddDialog(false)}
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
            <IconButton onClick={() => setAddDialog(false)}>
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
                onChange={(e) =>
                  setForm({ ...form, equipmentReference: e.target.value })
                }
                required
                fullWidth
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
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {equipmentService.getStatusOptions().map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Last Calibration Date"
                type="date"
                value={form.lastCalibration}
                onChange={(e) =>
                  setForm({ ...form, lastCalibration: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Calibration Due Date"
                type="date"
                value={form.calibrationDue}
                onChange={(e) =>
                  setForm({ ...form, calibrationDue: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Calibration Frequency (months)"
                type="number"
                value={form.calibrationFrequency}
                onChange={(e) =>
                  setForm({ ...form, calibrationFrequency: e.target.value })
                }
                required
                fullWidth
                inputProps={{ min: 1, max: 60 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.equipmentReference ||
                !form.equipmentType ||
                !form.section ||
                !form.brandModel ||
                !form.status ||
                !form.lastCalibration ||
                !form.calibrationDue ||
                !form.calibrationFrequency
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
        onClose={() => setEditDialog(false)}
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
            <IconButton onClick={() => setEditDialog(false)}>
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
                onChange={(e) =>
                  setForm({ ...form, equipmentReference: e.target.value })
                }
                required
                fullWidth
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
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {equipmentService.getStatusOptions().map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Last Calibration Date"
                type="date"
                value={form.lastCalibration}
                onChange={(e) =>
                  setForm({ ...form, lastCalibration: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Calibration Due Date"
                type="date"
                value={form.calibrationDue}
                onChange={(e) =>
                  setForm({ ...form, calibrationDue: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Calibration Frequency (months)"
                type="number"
                value={form.calibrationFrequency}
                onChange={(e) =>
                  setForm({ ...form, calibrationFrequency: e.target.value })
                }
                required
                fullWidth
                inputProps={{ min: 1, max: 60 }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.equipmentReference ||
                !form.equipmentType ||
                !form.section ||
                !form.brandModel ||
                !form.status ||
                !form.lastCalibration ||
                !form.calibrationDue ||
                !form.calibrationFrequency
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

export default EquipmentList;
