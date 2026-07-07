import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import massBalanceCalibrationService from "../../../../services/massBalanceCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import { computeMassBalanceWidgetStats } from "../massBalanceCalibrationUtils";

const CACHE_KEY = "mass-balance";

const MassBalances = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchMassBalanceData();
  }, []);

  const fetchFreshData = async () => {
    const [calibrations, equipmentResponse] = await Promise.all([
      massBalanceCalibrationService.getAll(),
      equipmentService.getAll({ equipmentType: "Mass Balance", limit: 1000 }),
    ]);

    const stats = computeMassBalanceWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipmentResponse.equipment || []
    );

    setNextCalibrationDue(stats.nextCalibrationDue);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchMassBalanceData = async () => {
    try {
      setLoading(true);
      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Mass Balance calibration data:", error);
        });
        return;
      }
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Mass Balance calibration data:", error);
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
      title="Mass Balances"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/mass-balances"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/mass-balance.png"}
      color="#5d4037"
    />
  );
};

export default MassBalances;
