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
import { acetoneVaporiserCalibrationService } from "../../../services/acetoneVaporiserCalibrationService";
import { equipmentService } from "../../../services/equipmentService";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const AcetoneVaporiserHistoryPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { equipmentId } = useParams();

  const [calibrations, setCalibrations] = useState([]);
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (equipmentId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch equipment details
      const equipmentResponse = await equipmentService.getById(equipmentId);
      setEquipment(equipmentResponse.equipment);

      // Fetch calibrations for this equipment
      const calibrationResponse = await acetoneVaporiserCalibrationService.getByEquipment(
        equipmentId
      );

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

  const handleBackToVaporisers = () => {
    navigate("/records/laboratory/calibrations/acetone-vaporiser");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this calibration record?")) {
      return;
    }

    try {
      await acetoneVaporiserCalibrationService.delete(id);
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
        <Button onClick={handleBackToVaporisers} sx={{ mt: 2 }}>
          Back to Acetone Vaporiser Calibrations
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="Acetone Vaporiser Calibration History"
        breadcrumbCurrent="History"
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        parents={[
          {
            label: "Acetone Vaporiser Calibrations",
            onClick: handleBackToVaporisers,
          },
        ]}
      />
      {equipment && (
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          {equipment.equipmentReference}
        </Typography>
      )}

      {calibrations.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            No calibration records found for this equipment.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Calibration Date</TableCell>
                <TableCell>Temperature (°C)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Calibrated By</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {calibrations.map((calibration) => (
                <TableRow key={calibration._id}>
                  <TableCell>{formatDate(calibration.date)}</TableCell>
                  <TableCell>{calibration.temperature}°C</TableCell>
                  <TableCell>
                    <Chip
                      label={calibration.status}
                      color={calibration.status === "Pass" ? "success" : "error"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {calibration.calibratedBy
                      ? `${calibration.calibratedBy.firstName || ""} ${
                          calibration.calibratedBy.lastName || ""
                        }`.trim() || "N/A"
                      : "N/A"}
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

export default AcetoneVaporiserHistoryPage;
