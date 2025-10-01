import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Button,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../../../utils/dateFormat";
import { graticuleService } from "../../../../services/graticuleService";

const GraticuleCalibration = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchGraticuleData();
  }, []);

  const fetchGraticuleData = async () => {
    try {
      setLoading(true);

      // Fetch all graticule calibrations
      const response = await graticuleService.getAll({ limit: 1000 });
      const calibrations = response.data || [];

      if (calibrations.length === 0) {
        setNextCalibrationDue(null);
        setItemsDueInNextMonth(0);
        return;
      }

      // Calculate the next calibration due date (soonest nextCalibration date)
      const validNextCalibrations = calibrations
        .filter((cal) => cal.nextCalibration)
        .map((cal) => new Date(cal.nextCalibration))
        .sort((a, b) => a - b);

      if (validNextCalibrations.length > 0) {
        setNextCalibrationDue(validNextCalibrations[0]);
      }

      // Calculate items due in next month (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      const dueInNextMonth = calibrations.filter((cal) => {
        if (!cal.nextCalibration) return false;
        const nextCalDate = new Date(cal.nextCalibration);
        return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
      }).length;

      setItemsDueInNextMonth(dueInNextMonth);
    } catch (error) {
      console.error("Error fetching graticule calibration data:", error);
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          p: 3,
          borderRadius: 2,
          boxShadow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        p: 3,
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <img
            src={process.env.PUBLIC_URL + "/air-mon-icons/graticule.png"}
            alt="PCM Graticules icon"
            style={{
              width: "32px",
              height: "32px",
              objectFit: "contain",
            }}
          />
          <Typography
            variant="h5"
            color={theme.palette.text.primary}
            fontWeight="bold"
          >
            PCM Graticules
          </Typography>
        </Box>
      </Box>

      <Box mb={2}>
        <Typography variant="body2" color={theme.palette.text.secondary}>
          Next Calibration Due:{" "}
          {nextCalibrationDue
            ? formatDate(nextCalibrationDue)
            : "Not scheduled"}
        </Typography>
        <Typography variant="body2" color={theme.palette.text.secondary}>
          Items due in next month: {itemsDueInNextMonth}
        </Typography>
      </Box>

      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={() => navigate(viewCalibrationsPath)}
        sx={{
          textTransform: "none",
          py: 1,
        }}
      >
        View Calibrations
      </Button>
    </Box>
  );
};

export default GraticuleCalibration;
