import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import caliperCalibrationService from "../../../../services/caliperCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeCaliperWidgetStats } from "../caliperCalibrationUtils";

const CACHE_KEY = "caliper";

const Calipers = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchCaliperData();
  }, []);

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      caliperCalibrationService.getAll(),
      equipmentService.getAll({ equipmentType: "Caliper", limit: 1000 }),
    ]);

    const stats = computeCaliperWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipmentResponse.equipment || []
    );

    setNextCalibrationDue(stats.nextCalibrationDue);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchCaliperData = async () => {
    try {
      setLoading(true);
      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Caliper calibration data:", error);
        });
        return;
      }
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Caliper calibration data:", error);
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
      title="Calipers"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/calipers"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/caliper.png"}
      color="#6a1b9a"
    />
  );
};

export default Calipers;
