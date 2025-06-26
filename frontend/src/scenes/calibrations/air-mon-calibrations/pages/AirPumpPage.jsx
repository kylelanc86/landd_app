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
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Header from "../../../../components/Header";
import { tokens } from "../../../../theme";

const AirPumpPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [pumps, setPumps] = useState([]);

  const handleAdd = () => {
    console.log("Add new pump");
  };

  const handleEdit = (id) => {
    console.log("Edit pump:", id);
  };

  const handleDelete = (id) => {
    console.log("Delete pump:", id);
  };

  const getCalibrationStatus = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: "Overdue", color: "error" };
    } else if (diffDays <= 30) {
      return { status: "Due Soon", color: "warning" };
    } else {
      return { status: "Valid", color: "success" };
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "success";
      case "Out of Service":
        return "error";
      default:
        return "default";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Header
          title="Air Pump Calibrations"
          subtitle="Manage air pump calibration records"
        />
      </Box>

      <Box display="flex" justifyContent="flex-end" mb="20px">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Pump
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                L&D Pump Reference
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Pump Details
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Calibration Date
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Calibration Due
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Max Flowrate
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Status
              </TableCell>
              <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pumps.map((pump) => {
              const calibrationStatus = getCalibrationStatus(
                pump.calibrationDue
              );
              return (
                <TableRow key={pump.id} hover>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    {pump.pumpReference}
                  </TableCell>
                  <TableCell>{pump.pumpDetails}</TableCell>
                  <TableCell>{formatDate(pump.calibrationDate)}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{formatDate(pump.calibrationDue)}</span>
                      <Chip
                        label={calibrationStatus.status}
                        color={calibrationStatus.color}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>{pump.maxFlowrate}</TableCell>
                  <TableCell>
                    <Chip
                      label={pump.status}
                      color={getStatusColor(pump.status)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleEdit(pump.id)}
                      size="small"
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDelete(pump.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AirPumpPage;
