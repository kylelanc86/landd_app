import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import mycometerCalibrationService from "../../../../services/mycometerCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";
import {
  computeMycometerWidgetStats,
  MYCOMETER_EQUIPMENT_TYPES,
} from "../mycometerCalibrationUtils";

const CACHE_KEY = "mycometer";

const Mycometers = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchMycometerData();
  }, []);

  const fetchFreshData = async () => {
    const [calibrations, ...equipmentResponses] = await Promise.all([
      mycometerCalibrationService.getAll(),
      ...MYCOMETER_EQUIPMENT_TYPES.map((equipmentType) =>
        equipmentService.getAll({ equipmentType, limit: 1000 })
      ),
    ]);

    const equipment = equipmentResponses.flatMap(
      (response) => response.equipment || []
    );

    const stats = computeMycometerWidgetStats(
      Array.isArray(calibrations) ? calibrations : [],
      equipment
    );

    setNextCalibrationDue(stats.nextCalibrationDue);
    setCachedCalibrationData(CACHE_KEY, stats);
  };

  const fetchMycometerData = async () => {
    try {
      setLoading(true);
      const cached = getCachedCalibrationData(CACHE_KEY);
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        fetchFreshData().catch((error) => {
          console.error("Error refreshing Mycometer calibration data:", error);
        });
        return;
      }
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching Mycometer calibration data:", error);
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
      title="Mycometers"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/mycometers"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/pressure-gauge.png"}
      color="#00695c"
    />
  );
};

export default Mycometers;
