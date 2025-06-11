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
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const CalibrationsList = () => {
  const theme = useTheme();
  const { type } = useParams();
  const navigate = useNavigate();

  // This would typically come from an API call
  const [equipment, setEquipment] = useState([
    {
      id: 1,
      name: "Equipment 1",
      serialNumber: "SN001",
      lastCalibration: "2024-02-15",
      nextCalibration: "2024-08-15",
      status: "Active",
    },
    {
      id: 2,
      name: "Equipment 2",
      serialNumber: "SN002",
      lastCalibration: "2024-01-20",
      nextCalibration: "2024-07-20",
      status: "Active",
    },
  ]);

  const getTitle = () => {
    switch (type) {
      case "air-pump":
        return "Air Pump Calibrations";
      case "flowmeter":
        return "Flowmeter Calibrations";
      case "efa":
        return "Effective Filter Area Measurements";
      case "microscope":
        return "Microscope Calibrations";
      case "acetone-vaporiser":
        return "Acetone Vaporiser Calibrations";
      case "graticule":
        return "Graticule Calibrations";
      case "primary-flowmeter":
        return "Primary Flowmeter Calibrations";
      default:
        return "Calibrations";
    }
  };

  const handleAdd = () => {
    console.log("Add new calibration");
  };

  const handleEdit = (id) => {
    console.log("Edit calibration:", id);
  };

  const handleDelete = (id) => {
    console.log("Delete calibration:", id);
  };

  return (
    <Box p={3}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" color={theme.palette.text.primary}>
          {getTitle()}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{ textTransform: "none" }}
        >
          Add New Calibration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Equipment Name</TableCell>
              <TableCell>Serial Number</TableCell>
              <TableCell>Last Calibration</TableCell>
              <TableCell>Next Calibration Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {equipment.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.serialNumber}</TableCell>
                <TableCell>{item.lastCalibration}</TableCell>
                <TableCell>{item.nextCalibration}</TableCell>
                <TableCell>
                  <Box
                    sx={{
                      backgroundColor:
                        item.status === "Active"
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      display: "inline-block",
                    }}
                  >
                    {item.status}
                  </Box>
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(item.id)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDelete(item.id)}
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
    </Box>
  );
};

export default CalibrationsList;
