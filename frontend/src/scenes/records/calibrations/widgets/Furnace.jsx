import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import furnaceCalibrationService from "../../../../services/furnaceCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeFurnaceWidgetStats } from "../furnaceCalibrationUtils";

const CACHE_KEY = "furnace";

const Furnace = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchFurnaceData();
  }, []);

  const applyStats = ({
    nextCalibrationDue: nextDue,
    itemsDueInNextMonth: dueCount,
  }) => {
    setNextCalibrationDue(nextDue);
    setItemsDueInNextMonth(dueCount);
  };

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      furnaceCalibrationService.getAll(),
      equipmentService.getAll({
        equipmentType: "Furnace",
        limit: 1000,
      }),
    ]);

    const equipment = equipmentResponse.equipment || [];
    const stats = computeFurnaceWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipment
    );

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchFurnaceData = async () => {
    try {
      setLoading(true);

      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        applyStats({
          nextCalibrationDue: cached.nextCalibrationDue
            ? new Date(cached.nextCalibrationDue)
            : null,
          itemsDueInNextMonth: cached.itemsDueInNextMonth || 0,
        });
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Furnace calibration data:", error);
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Furnace calibration data:", error);
      applyStats({ nextCalibrationDue: null, itemsDueInNextMonth: 0 });
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
      title="Furnace"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/furnace"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/furnace.png"}
      color="#795548"
    />
  );
};

export default Furnace;
