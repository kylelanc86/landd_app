import React, { useState, useEffect } from "react";
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
  CircularProgress,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Header from "../../../../components/Header";
import { tokens } from "../../../../theme";
import airPumpService from "../../../../services/airPumpService";

const AirPumpPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [pumps, setPumps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOutOfService, setShowOutOfService] = useState(false);

  const fetchPumps = async () => {
    try {
      setLoading(true);
      const response = await airPumpService.getAll({ limit: 100 });
      console.log("API Response:", response);
      console.log("Pumps data:", response.data);
      if (response.data && response.data.length > 0) {
        console.log(
          "First pump calibration date:",
          response.data[0].calibrationDate
        );
        console.log(
          "First pump calibration date type:",
          typeof response.data[0].calibrationDate
        );

        // Debug status values
        const statusCounts = response.data.reduce((acc, pump) => {
          acc[pump.status] = (acc[pump.status] || 0) + 1;
          return acc;
        }, {});
        console.log("Status counts:", statusCounts);
      }
      setPumps(response.data || []);
      setError(null);
    } catch (err) {
      console.error("Error fetching air pumps:", err);
      setError(err.message || "Failed to fetch air pumps");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPumps();
  }, []);

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
      case "Inactive":
        return "error";
      default:
        return "default";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    try {
      let date;

      // If it's already a Date object
      if (dateString instanceof Date) {
        date = dateString;
      }
      // If it's a string, try to parse it
      else if (typeof dateString === "string") {
        // Handle dd/mm/yyyy format
        if (dateString.includes("/")) {
          const parts = dateString.split("/");
          if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Month is 0-indexed
            const year = parseInt(parts[2]);
            date = new Date(year, month, day);
          } else {
            date = new Date(dateString);
          }
        } else {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn("Invalid date:", dateString);
        return "Invalid Date";
      }

      return date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return "Error";
    }
  };

  // Filter pumps based on showOutOfService toggle
  const filteredPumps = showOutOfService
    ? pumps
    : pumps.filter(
        (pump) => pump.status !== "Out of Service" && pump.status !== "Inactive"
      );

  if (loading) {
    return (
      <Box
        m="20px"
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
        <Typography color="error" variant="h6">
          Error: {error}
        </Typography>
        <Button onClick={fetchPumps} variant="contained" sx={{ mt: 2 }}>
          Retry
        </Button>
      </Box>
    );
  }

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

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Switch
                checked={showOutOfService}
                onChange={(e) => setShowOutOfService(e.target.checked)}
                color="primary"
              />
            }
            label="Show Out of Service Pumps"
          />
          <Typography variant="body2" color="text.secondary">
            ({pumps.filter((p) => p.status === "Active").length} active,{" "}
            {
              pumps.filter(
                (p) => p.status === "Out of Service" || p.status === "Inactive"
              ).length
            }{" "}
            out of service)
          </Typography>
          {pumps.some((p) => p.status === "Inactive") && (
            <Button
              variant="outlined"
              size="small"
              onClick={async () => {
                if (
                  window.confirm(
                    'Update all "Inactive" statuses to "Out of Service"? This action cannot be undone.'
                  )
                ) {
                  try {
                    const result = await airPumpService.updateInactiveStatus();
                    alert(
                      `Updated ${result.modifiedCount} pumps from "Inactive" to "Out of Service"`
                    );
                    fetchPumps(); // Refresh the data
                  } catch (err) {
                    alert("Error updating statuses: " + err.message);
                  }
                }
              }}
            >
              Update Inactive → Out of Service
            </Button>
          )}
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Pump
        </Button>
      </Box>

      <TableContainer component={Paper} sx={{ boxShadow: 3 }}>
        <Table
          sx={{
            "& .MuiTableRow-root": {
              height: "42px", // Reduced by 30% from default ~60px
            },
            "& .MuiTableCell-root": {
              padding: "6px 8px", // Reduced padding
              fontSize: "0.875rem", // Slightly smaller font
            },
          }}
        >
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
              <TableCell
                sx={{ color: "white", fontWeight: "bold", minWidth: "120px" }}
              >
                L&D Pump Ref
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
            {filteredPumps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body1" color="text.secondary">
                    {showOutOfService
                      ? "No air pumps found"
                      : "No active air pumps found"}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredPumps.map((pump) => {
                const calibrationStatus = getCalibrationStatus(
                  pump.calibrationDue
                );
                const isOverdue = calibrationStatus.status === "Overdue";

                return (
                  <TableRow
                    key={pump._id}
                    hover
                    onClick={() =>
                      navigate(
                        `/calibrations/air-mon-calibrations/pump/${pump._id}`
                      )
                    }
                    sx={{
                      backgroundColor: isOverdue ? "#ffebee" : "inherit", // Light red background for overdue
                      "&:hover": {
                        backgroundColor: isOverdue ? "#ffcdd2" : undefined, // Darker red on hover for overdue
                        cursor: "pointer", // Add pointer cursor
                      },
                      cursor: "pointer", // Add pointer cursor
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        color: isOverdue ? "error.main" : "inherit",
                      }}
                    >
                      {pump.pumpReference}
                    </TableCell>
                    <TableCell
                      sx={{ color: isOverdue ? "error.main" : "inherit" }}
                    >
                      {pump.pumpDetails}
                    </TableCell>
                    <TableCell
                      sx={{ color: isOverdue ? "error.main" : "inherit" }}
                    >
                      {formatDate(pump.calibrationDate)}
                    </TableCell>
                    <TableCell
                      sx={{ color: isOverdue ? "error.main" : "inherit" }}
                    >
                      {formatDate(pump.calibrationDue)}
                    </TableCell>
                    <TableCell
                      sx={{ color: isOverdue ? "error.main" : "inherit" }}
                    >
                      {pump.maxFlowrate}
                    </TableCell>
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
                        onClick={() => handleEdit(pump._id)}
                        size="small"
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(pump._id)}
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AirPumpPage;
