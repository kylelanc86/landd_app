import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import pneumaticTesterCalibrationService from "../../../../services/pneumaticTesterCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computePneumaticTesterWidgetStats } from "../pneumaticTesterCalibrationUtils";

const CACHE_KEY = "pneumatic-tester";

const PneumaticTester = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchPneumaticTesterData();
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
      pneumaticTesterCalibrationService.getAll(),
      equipmentService.getAll({
        equipmentType: "Pneumatic tester",
        limit: 1000,
      }),
    ]);

    const equipment = equipmentResponse.equipment || [];
    const stats = computePneumaticTesterWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipment
    );

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchPneumaticTesterData = async () => {
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
          console.error(
            "Error refreshing Pneumatic Tester calibration data:",
            error
          );
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Pneumatic Tester calibration data:", error);
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
      title="Pneumatic Tester"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath ||
        "/records/laboratory/calibrations/pneumatic-tester"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/pressure-gauge.png"}
      color="#455A64"
    />
  );
};

export default PneumaticTester;
