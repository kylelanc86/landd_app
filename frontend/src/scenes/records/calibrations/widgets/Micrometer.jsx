import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import micrometerCalibrationService from "../../../../services/micrometerCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeMicrometerWidgetStats } from "../micrometerCalibrationUtils";

const CACHE_KEY = "micrometer";

const Micrometer = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchMicrometerData();
  }, []);

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      micrometerCalibrationService.getAll(),
      equipmentService.getAll({ equipmentType: "Micrometer", limit: 1000 }),
    ]);

    const stats = computeMicrometerWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipmentResponse.equipment || []
    );

    setNextCalibrationDue(stats.nextCalibrationDue);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchMicrometerData = async () => {
    try {
      setLoading(true);
      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Micrometer calibration data:", error);
        });
        return;
      }
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Micrometer calibration data:", error);
      setNextCalibrationDue(null);
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
    <BaseCalibrationWidget
      title="Micrometer"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/micrometer"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/micrometer.png"}
      color="#455a64"
    />
  );
};

export default Micrometer;
