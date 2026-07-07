import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { equipmentService } from "../../../../services/equipmentService";
import { acetoneVaporiserCalibrationService } from "../../../../services/acetoneVaporiserCalibrationService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import {
  computeAcetoneVaporiserWidgetStats,
  normalizeAcetoneVaporiserCalibrations,
} from "../acetoneVaporiserCalibrationUtils";

const CACHE_KEY = "acetone-vaporiser";

const AcetoneVaporiser = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchAcetoneVaporiserData();
  }, []);

  const applyStats = ({
    nextCalibrationDue: nextDue,
    itemsDueInNextMonth: dueCount,
  }) => {
    setNextCalibrationDue(nextDue);
    setItemsDueInNextMonth(dueCount);
  };

  const fetchFreshData = async () => {
    const [calibrationResponse, equipmentResponse] = await Promise.all([
      acetoneVaporiserCalibrationService.getAll({
        limit: 1000,
        sortBy: "date",
        sortOrder: "desc",
      }),
      equipmentService.getAll({
        equipmentType: "Acetone Vaporiser",
        limit: 1000,
      }),
    ]);

    const calibrations = normalizeAcetoneVaporiserCalibrations(
      calibrationResponse
    );
    const equipment = equipmentResponse.equipment || [];
    const stats = computeAcetoneVaporiserWidgetStats(calibrations, equipment);

    applyStats(stats);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchAcetoneVaporiserData = async () => {
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
            "Error refreshing Acetone Vaporiser calibration data:",
            error
          );
        });
        return;
      }

      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching acetone vaporiser data:", error);
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
      title="Acetone Vaporiser"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath ||
        "/records/laboratory/calibrations/acetone-vaporiser"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/vaporiser.png"}
      color="#00acc1"
    />
  );
};

export default AcetoneVaporiser;
