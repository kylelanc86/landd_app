import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import sieveCalibrationService from "../../../../services/sieveCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeSieveWidgetStats } from "../sieveCalibrationUtils";

const CACHE_KEY = "sieves";

const Sieves = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchSievesData();
  }, []);

  const applyStats = ({ itemsDueInNextMonth: dueCount }) => {
    setItemsDueInNextMonth(dueCount);
  };

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      sieveCalibrationService.getAll(),
      equipmentService.getAll({
        equipmentType: "Sieves",
        limit: 1000,
      }),
    ]);

    const equipment = equipmentResponse.equipment || [];
    const stats = computeSieveWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipment
    );

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchSievesData = async () => {
    try {
      setLoading(true);

      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        applyStats({
          itemsDueInNextMonth: cached.itemsDueInNextMonth || 0,
        });
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Sieves calibration data:", error);
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Sieves calibration data:", error);
      applyStats({ itemsDueInNextMonth: 0 });
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
      title="Sieves"
      hideNextCalibrationDue
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/sieves"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/sieve.png"}
      color="#f57c00"
    />
  );
};

export default Sieves;
