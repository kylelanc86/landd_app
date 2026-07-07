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
  Chip,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate } from "../../../utils/dateFormat";
import { riLiquidCalibrationService } from "../../../services/riLiquidCalibrationService";
import { CALIBRATION_TABS } from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const RiLiquidHistoryPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { bottleId } = useParams();

  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottleId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const calibrationResponse = bottleId
        ? await riLiquidCalibrationService.getByBottle(bottleId, {
            limit: 1000,
          })
        : await riLiquidCalibrationService.getAll({
            limit: 1000,
            sortBy: "date",
            sortOrder: "desc",
            includeEmpty: "true",
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
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="RI Liquid Calibration History"
        breadcrumbCurrent={bottleId ? bottleId : "History"}
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        parents={[
          {
            label: "RI Liquid Calibrations",
            onClick: handleBackToCalibrations,
          },
        ]}
      />
      {bottleId && (
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Refractive Index Bottle: {bottleId}
        </Typography>
      )}

      {calibrations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            {bottleId
              ? "No calibration records found for this bottle."
              : "No calibration records found."}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                {!bottleId && <TableCell>Bottle ID</TableCell>}
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
                  {!bottleId && <TableCell>{calibration.bottleId}</TableCell>}
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
