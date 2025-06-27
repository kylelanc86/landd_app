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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const EquipmentList = () => {
  const theme = useTheme();
  const colors = tokens;

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [form, setForm] = useState({
    name: "",
    type: "",
    serialNumber: "",
    location: "",
    status: "active",
    notes: "",
  });

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      setError(null);

      // TODO: Implement API call to fetch equipment
      const mockEquipment = [
        {
          _id: "1",
          name: "Air Pump 001",
          type: "Air Pump",
          serialNumber: "AP001",
          location: "Lab A",
          status: "active",
          notes: "Primary air pump",
        },
        {
          _id: "2",
          name: "Microscope 001",
          type: "Microscope",
          serialNumber: "M001",
          location: "Lab B",
          status: "active",
          notes: "Primary microscope",
        },
      ];

      setEquipment(mockEquipment);
    } catch (err) {
      console.error("Error fetching equipment:", err);
      setError(err.message || "Failed to fetch equipment");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();
    try {
      // TODO: Implement API call to create equipment
      console.log("New equipment data:", form);

      setAddDialog(false);
      setForm({
        name: "",
        type: "",
        serialNumber: "",
        location: "",
        status: "active",
        notes: "",
      });
    } catch (err) {
      console.error("Error adding equipment:", err);
      setError(err.message || "Failed to add equipment");
    }
  };

  const handleEditEquipment = (equipment) => {
    setSelectedEquipment(equipment);
    setForm({
      name: equipment.name,
      type: equipment.type,
      serialNumber: equipment.serialNumber,
      location: equipment.location,
      status: equipment.status,
      notes: equipment.notes,
    });
    setEditDialog(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      // TODO: Implement API call to update equipment
      console.log("Update equipment data:", form);

      setEditDialog(false);
      setSelectedEquipment(null);
      setForm({
        name: "",
        type: "",
        serialNumber: "",
        location: "",
        status: "active",
        notes: "",
      });
    } catch (err) {
      console.error("Error editing equipment:", err);
      setError(err.message || "Failed to edit equipment");
    }
  };

  const handleDeleteEquipment = async (equipmentId) => {
    try {
      // TODO: Implement API call to delete equipment
      console.log("Deleting equipment:", equipmentId);
    } catch (err) {
      console.error("Error deleting equipment:", err);
      setError(err.message || "Failed to delete equipment");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return theme.palette.success.main;
      case "inactive":
        return theme.palette.grey[500];
      case "maintenance":
        return theme.palette.warning.main;
      case "broken":
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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header title="Equipment List" subtitle="Manage laboratory equipment" />
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
        }}
      >
        <DataGrid
          rows={equipment}
          columns={[
            {
              field: "name",
              headerName: "Equipment Name",
              flex: 1,
              minWidth: 150,
            },
            {
              field: "type",
              headerName: "Type",
              flex: 1,
              minWidth: 120,
            },
            {
              field: "serialNumber",
              headerName: "Serial Number",
              flex: 1,
              minWidth: 120,
            },
            {
              field: "location",
              headerName: "Location",
              flex: 1,
              minWidth: 120,
            },
            {
              field: "status",
              headerName: "Status",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => {
                return (
                  <Chip
                    label={params.row.status}
                    sx={{
                      backgroundColor: getStatusColor(params.row.status),
                      color: theme.palette.common.white,
                      fontWeight: "bold",
                    }}
                  />
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
                label="Equipment Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
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
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="broken">Broken</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.name || !form.type || !form.serialNumber || !form.location
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
                label="Equipment Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                required
                fullWidth
              />
              <TextField
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
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
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="broken">Broken</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.name || !form.type || !form.serialNumber || !form.location
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
