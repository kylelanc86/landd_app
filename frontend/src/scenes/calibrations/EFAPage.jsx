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
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Header from "../../components/Header";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";

const EFAPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [calibrations, setCalibrations] = useState([
    {
      id: 1,
      filterId: "F-001",
      date: "2024-02-15",
      area: "100 cm²",
      status: "Pass",
      technician: "John Doe",
      nextCalibration: "2024-08-15",
    },
    {
      id: 2,
      filterId: "F-002",
      date: "2024-02-10",
      area: "95 cm²",
      status: "Pass",
      technician: "Jane Smith",
      nextCalibration: "2024-08-10",
    },
  ]);

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
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Header
          title="EFA Calibrations"
          subtitle="Manage Effective Filter Area calibration records"
        />
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
              <TableCell>Filter ID</TableCell>
              <TableCell>Calibration Date</TableCell>
              <TableCell>Area</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Next Calibration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calibrations.map((calibration) => (
              <TableRow key={calibration.id}>
                <TableCell>{calibration.filterId}</TableCell>
                <TableCell>{calibration.date}</TableCell>
                <TableCell>{calibration.area}</TableCell>
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
    </Box>
  );
};

export default EFAPage;
