import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { riLiquidCalibrationService } from "../../../../services/riLiquidCalibrationService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const CACHE_KEY = "ri-liquid";

const computeRiLiquidWidgetStats = (bottles = []) => {
  const calibratedBottles = bottles.filter(
    (bottle) => bottle.latestCalibration?.nextCalibration,
  );

  const validNextCalibrations = calibratedBottles
    .map((bottle) => new Date(bottle.latestCalibration.nextCalibration))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a - b);

  const nextCalibrationDue =
    validNextCalibrations.length > 0 ? validNextCalibrations[0] : null;

  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  );

  let itemsDueInNextMonth = calibratedBottles.filter((bottle) => {
    const nextCalDate = new Date(bottle.latestCalibration.nextCalibration);
    if (Number.isNaN(nextCalDate.getTime())) return false;
    return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
  }).length;

  // Bottles with no calibration yet still need attention
  itemsDueInNextMonth += bottles.filter(
    (bottle) => !bottle.latestCalibration?.nextCalibration,
  ).length;

  return { nextCalibrationDue, itemsDueInNextMonth };
};

const RiLiquid = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchRiLiquidData();
  }, []);

  const applyStats = ({
    nextCalibrationDue: nextDue,
    itemsDueInNextMonth: dueCount,
  }) => {
    setNextCalibrationDue(nextDue);
    setItemsDueInNextMonth(dueCount);
  };

  const fetchFreshData = async () => {
    const response = await riLiquidCalibrationService.getActiveBottles();
    const bottles = response.data || [];
    const stats = computeRiLiquidWidgetStats(bottles);

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchRiLiquidData = async () => {
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
          console.error("Error refreshing RI Liquid calibration data:", error);
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching RI Liquid data:", error);
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
      title="RI Liquids"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/ri-liquid"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/RiLiquid.png"}
      color="#ed6c02"
    />
  );
};

export default RiLiquid;
