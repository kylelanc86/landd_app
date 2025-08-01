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
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const FlowmeterPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [calibrations, setCalibrations] = useState([
    {
      id: 1,
      flowmeterId: "FM-001",
      date: "2024-02-15",
      flowRate: "2.0 L/min",
      status: "Pass",
      technician: "John Doe",
      nextCalibration: "2024-08-15",
    },
    {
      id: 2,
      flowmeterId: "FM-002",
      date: "2024-02-10",
      flowRate: "1.8 L/min",
      status: "Pass",
      technician: "Jane Smith",
      nextCalibration: "2024-08-10",
    },
  ]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calibrationToDelete, setCalibrationToDelete] = useState(null);

  const handleAdd = () => {
    console.log("Add new calibration");
  };

  const handleEdit = (id) => {
    console.log("Edit calibration:", id);
  };

  const handleDelete = (id) => {
    const calibration = calibrations.find((c) => c.id === id);
    setCalibrationToDelete(calibration);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (calibrationToDelete) {
      setCalibrations((prev) =>
        prev.filter((calibration) => calibration.id !== calibrationToDelete.id)
      );
      setDeleteDialogOpen(false);
      setCalibrationToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setCalibrationToDelete(null);
  };

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Flowmeter Calibrations
        </Typography>
      </Box>

      <Box display="flex" justifyContent="flex-end" mb="20px">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Flowmeter ID</TableCell>
              <TableCell>Calibration Date</TableCell>
              <TableCell>Flow Rate</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Next Calibration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calibrations.map((calibration) => (
              <TableRow key={calibration.id}>
                <TableCell>{calibration.flowmeterId}</TableCell>
                <TableCell>{calibration.date}</TableCell>
                <TableCell>{calibration.flowRate}</TableCell>
                <TableCell>
                  <Box
                    sx={{
                      backgroundColor:
                        calibration.status === "Pass"
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      display: "inline-block",
                    }}
                  >
                    {calibration.status}
                  </Box>
                </TableCell>
                <TableCell>{calibration.technician}</TableCell>
                <TableCell>{calibration.nextCalibration}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEdit(calibration.id)}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(calibration.id)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Flowmeter Calibration
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete the calibration record for flowmeter{" "}
            {calibrationToDelete?.flowmeterId}? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FlowmeterPage;
