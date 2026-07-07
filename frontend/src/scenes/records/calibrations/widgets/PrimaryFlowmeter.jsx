import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import primaryFlowmeterService from "../../../../services/primaryFlowmeterService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computePrimaryFlowmeterWidgetStats } from "../primaryFlowmeterUtils";

const CACHE_KEY = "primary-flowmeter";

const PrimaryFlowmeter = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchPrimaryFlowmeterData();
  }, []);

  const applyStats = ({ nextCalibrationDue: nextDue, itemsDueInNextMonth: dueCount }) => {
    setNextCalibrationDue(nextDue);
    setItemsDueInNextMonth(dueCount);
  };

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      primaryFlowmeterService.getAll(),
      equipmentService.getAll({
        equipmentType: "Bubble flowmeter",
        limit: 1000,
      }),
    ]);

    const equipment = equipmentResponse.equipment || [];
    const stats = computePrimaryFlowmeterWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipment
    );

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchPrimaryFlowmeterData = async () => {
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
            "Error refreshing Primary Flowmeter calibration data:",
            error
          );
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error(
        "Error fetching Primary Flowmeter calibration data:",
        error
      );
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
      title="Primary Flowmeter"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath ||
        "/records/laboratory/calibrations/primary-flowmeter"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/primary flowmeter.png"}
      color="#388e3c"
    />
  );
};

export default PrimaryFlowmeter;
