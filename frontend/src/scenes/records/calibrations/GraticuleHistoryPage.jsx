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
  Button,
  useTheme,
  CircularProgress,
  Breadcrumbs,
  Link,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { formatDate } from "../../../utils/dateFormat";
import { graticuleService } from "../../../services/graticuleService";

const GraticuleHistoryPage = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterGraticuleId, setFilterGraticuleId] = useState("all");

  useEffect(() => {
    fetchHistoricalData();
  }, [filterGraticuleId]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterGraticuleId !== "all") params.graticuleId = filterGraticuleId;

      const response = await graticuleService.getAllArchivedCalibrations(
        params
      );
      setHistoricalData(response.data || []);
      setError(null);
    } catch (error) {
      console.error("Error fetching historical data:", error);
      setError("Failed to fetch historical data");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToGraticules = () => {
    navigate("/records/laboratory/calibrations/graticule");
  };

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations");
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  // Get unique graticule IDs for filter
  const uniqueGraticuleIds = [
    ...new Set(historicalData.map((cal) => cal.graticuleId).filter(Boolean)),
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToHome}
          sx={{ textDecoration: "none" }}
        >
          Records
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToCalibrations}
          sx={{ textDecoration: "none" }}
        >
          Laboratory Calibrations
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={handleBackToGraticules}
          sx={{ textDecoration: "none" }}
        >
          Graticule Calibrations
        </Link>
        <Typography color="text.primary">Historical Data</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToGraticules}
          sx={{ mr: 2 }}
        >
          Back to Graticules
        </Button>
        <Typography variant="h4" component="h1">
          Historical Graticule Calibrations
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Graticule ID</InputLabel>
          <Select
            value={filterGraticuleId}
            label="Graticule ID"
            onChange={(e) => setFilterGraticuleId(e.target.value)}
          >
            <MenuItem value="all">All Graticules</MenuItem>
            {uniqueGraticuleIds.map((graticuleId) => (
              <MenuItem key={graticuleId} value={graticuleId}>
                {graticuleId}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Chip
          label={`${historicalData.length} records`}
          color="primary"
          variant="outlined"
          sx={{ alignSelf: "center" }}
        />
      </Box>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Graticule ID</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Diameter (µm)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Technician</TableCell>
              <TableCell>Archived Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : historicalData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No historical data available
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              historicalData.map((calibration) => (
                <TableRow key={calibration._id}>
                  <TableCell>{calibration.graticuleId}</TableCell>
                  <TableCell>{formatDate(calibration.date)}</TableCell>
                  <TableCell>
                    {calibration.scale
                      ? calibration.scale.replace(/ µm.*/, " µm")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        color:
                          calibration.status === "Pass"
                            ? theme.palette.success.main
                            : theme.palette.error.main,
                        fontWeight: "medium",
                      }}
                    >
                      {calibration.status}
                    </Typography>
                  </TableCell>
                  <TableCell>{calibration.technician}</TableCell>
                  <TableCell>{formatDate(calibration.archivedAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default GraticuleHistoryPage;
