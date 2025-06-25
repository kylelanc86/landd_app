import React, { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Header from "../../../../components/Header";

const EquipmentList = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newEquipment, setNewEquipment] = useState({
    equipmentReference: "",
    equipmentType: "",
    brandModel: "",
    status: "Active",
  });

  const equipmentTypes = [
    "Air Pump",
    "Flowmeter",
    "Microscope",
    "Acetone Vaporiser",
    "Graticule",
    "Primary Flowmeter",
    "Effective Filter Area",
  ];

  const statusOptions = ["Active", "Inactive", "Under Maintenance", "Retired"];

  const handleAdd = () => {
    setEditingId(null);
    setNewEquipment({
      equipmentReference: "",
      equipmentType: "",
      brandModel: "",
      status: "Active",
    });
    setOpenModal(true);
  };

  const handleEdit = (id) => {
    const equipmentToEdit = equipment.find((item) => item.id === id);
    setEditingId(id);
    setNewEquipment(equipmentToEdit);
    setOpenModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this equipment?")) {
      setEquipment(equipment.filter((item) => item.id !== id));
    }
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setEditingId(null);
    setNewEquipment({
      equipmentReference: "",
      equipmentType: "",
      brandModel: "",
      status: "Active",
    });
  };

  const handleSaveEquipment = () => {
    if (
      newEquipment.equipmentReference &&
      newEquipment.equipmentType &&
      newEquipment.brandModel
    ) {
      if (editingId) {
        // Update existing equipment
        setEquipment(
          equipment.map((item) =>
            item.id === editingId ? { ...newEquipment, id: editingId } : item
          )
        );
      } else {
        // Add new equipment
        const equipmentItem = {
          id: Date.now(),
          ...newEquipment,
        };
        setEquipment([...equipment, equipmentItem]);
      }
      handleCloseModal();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return theme.palette.success.main;
      case "Inactive":
        return theme.palette.error.main;
      case "Under Maintenance":
        return theme.palette.warning.main;
      case "Retired":
        return theme.palette.grey[500];
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Header
          title="Equipment List"
          subtitle="Manage air monitoring equipment"
        />
      </Box>

      <Box display="flex" justifyContent="flex-end" mb="20px">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Equipment
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Equipment Reference</TableCell>
              <TableCell>Equipment Type</TableCell>
              <TableCell>Brand/Model</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No equipment found. Click "Add Equipment" to add a new
                    entry.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              equipment.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.equipmentReference}</TableCell>
                  <TableCell>{item.equipmentType}</TableCell>
                  <TableCell>{item.brandModel}</TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        backgroundColor: getStatusColor(item.status),
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        display: "inline-block",
                        fontSize: "0.875rem",
                      }}
                    >
                      {item.status}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleEdit(item.id)}
                      size="small"
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(item.id)}
                      size="small"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Equipment Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingId ? "Edit Equipment" : "Add New Equipment"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Equipment Reference"
              value={newEquipment.equipmentReference}
              onChange={(e) =>
                setNewEquipment({
                  ...newEquipment,
                  equipmentReference: e.target.value,
                })
              }
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Equipment Type</InputLabel>
              <Select
                value={newEquipment.equipmentType}
                label="Equipment Type"
                onChange={(e) =>
                  setNewEquipment({
                    ...newEquipment,
                    equipmentType: e.target.value,
                  })
                }
              >
                {equipmentTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Brand/Model"
              value={newEquipment.brandModel}
              onChange={(e) =>
                setNewEquipment({ ...newEquipment, brandModel: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={newEquipment.status}
                label="Status"
                onChange={(e) =>
                  setNewEquipment({ ...newEquipment, status: e.target.value })
                }
              >
                {statusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSaveEquipment}
            variant="contained"
            disabled={
              !newEquipment.equipmentReference ||
              !newEquipment.equipmentType ||
              !newEquipment.brandModel
            }
          >
            {editingId ? "Update Equipment" : "Save Equipment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EquipmentList;
