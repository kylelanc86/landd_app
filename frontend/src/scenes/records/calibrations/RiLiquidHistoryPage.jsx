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
  CircularProgress,
  Breadcrumbs,
  Link,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate } from "../../../utils/dateFormat";
import { riLiquidCalibrationService } from "../../../services/riLiquidCalibrationService";

const RiLiquidHistoryPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all calibrations including empty bottles
      const calibrationResponse = await riLiquidCalibrationService.getAll({
        limit: 1000,
        sortBy: 'date',
        sortOrder: 'desc',
        includeEmpty: 'true'
      });

      const calibrationData = calibrationResponse.data || [];
      
      // Sort by date descending (most recent first)
      const sortedCalibrations = calibrationData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });

      setCalibrations(sortedCalibrations);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError(error.message || "Failed to load calibration history");
      setCalibrations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/ri-liquid");
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this calibration record?")) {
      return;
    }

    try {
      await riLiquidCalibrationService.delete(id);
      fetchData();
    } catch (error) {
      console.error("Error deleting calibration:", error);
      alert(error.response?.data?.message || error.message || "Failed to delete calibration");
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Box display="flex" justifyContent="center" alignItems="center" height="400px">
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h6" color="error">
          {error}
        </Typography>
        <Button onClick={handleBackToCalibrations} sx={{ mt: 2 }}>
          Back to RI Liquid Calibrations
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          RI Liquid Calibration History
        </Typography>
      </Box>

      <Box mb={3}>
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
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToCalibrations}
            sx={{ cursor: "pointer" }}
          >
            RI Liquid Calibrations
          </Link>
          <Typography color="text.primary">History</Typography>
        </Breadcrumbs>
      </Box>

      {calibrations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            No calibration records found.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Bottle ID</TableCell>
                <TableCell>Batch Number</TableCell>
                <TableCell>Date Opened</TableCell>
                <TableCell>Calibration Date</TableCell>
                <TableCell>Refractive Index</TableCell>
                <TableCell>Asbestos Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next Calibration</TableCell>
                <TableCell>Calibrated By</TableCell>
                <TableCell>Empty</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calibrations.map((calibration) => (
                <TableRow key={calibration._id}>
                  <TableCell>{calibration.bottleId}</TableCell>
                  <TableCell>{calibration.batchNumber || "-"}</TableCell>
                  <TableCell>
                    {calibration.dateOpened ? formatDate(calibration.dateOpened) : "-"}
                  </TableCell>
                  <TableCell>{formatDate(calibration.date)}</TableCell>
                  <TableCell>{calibration.refractiveIndex}</TableCell>
                  <TableCell>{calibration.asbestosTypeVerified || "-"}</TableCell>
                  <TableCell>
                    <Chip
                      label={calibration.status}
                      color={calibration.status === "Pass" ? "success" : "error"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {calibration.nextCalibration
                      ? formatDate(calibration.nextCalibration)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {calibration.calibratedBy
                      ? `${calibration.calibratedBy.firstName || ""} ${
                          calibration.calibratedBy.lastName || ""
                        }`.trim() || "N/A"
                      : "N/A"}
                  </TableCell>
                  <TableCell>
                    {calibration.isEmpty ? (
                      <Chip label="Empty" color="warning" size="small" />
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleDelete(calibration._id)}
                      size="small"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default RiLiquidHistoryPage;
