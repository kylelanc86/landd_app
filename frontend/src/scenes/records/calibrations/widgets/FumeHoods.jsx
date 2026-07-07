import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import fumeHoodCalibrationService from "../../../../services/fumeHoodCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeFumeHoodWidgetStats } from "../fumeHoodCalibrationUtils";

const CACHE_KEY = "fume-hood";

const FumeHoods = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchFumeHoodData();
  }, []);

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      fumeHoodCalibrationService.getAll(),
      equipmentService.getAll({ equipmentType: "Fume Hood", limit: 1000 }),
    ]);

    const stats = computeFumeHoodWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipmentResponse.equipment || []
    );

    setNextCalibrationDue(stats.nextCalibrationDue);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchFumeHoodData = async () => {
    try {
      setLoading(true);
      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Fume Hood calibration data:", error);
        });
        return;
      }
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Fume Hood calibration data:", error);
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
      title="Fume Hoods"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/fume-hoods"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/fume-hood.png"}
      color="#00796b"
    />
  );
};

export default FumeHoods;
