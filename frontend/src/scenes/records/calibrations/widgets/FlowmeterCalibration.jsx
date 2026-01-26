import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { flowmeterCalibrationService } from "../../../../services/flowmeterCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const FlowmeterCalibration = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);

  useEffect(() => {
    fetchFlowmeterData();
  }, []);

  const fetchFlowmeterData = async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cached = getCachedCalibrationData("flowmeter");
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setLoading(false);
        // Still fetch fresh data in background to update cache
        fetchFreshData();
        return;
      }

      // No cache, fetch fresh data
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching flowmeter calibration data:", error);
      setNextCalibrationDue(null);
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch all flowmeter calibrations
      const response = await flowmeterCalibrationService.getAll({
        limit: 1000,
      });
      const calibrations = response.data || [];

      // Fetch equipment to check for items without calibration
      const equipmentResponse = await equipmentService.getAll({
        equipmentType: "Site flowmeter",
        limit: 1000,
      });
      const equipment = equipmentResponse.equipment || [];

      // Track which equipment has calibrations
      const equipmentWithCalibrations = new Set();
      calibrations.forEach((cal) => {
        if (cal.flowmeterId) {
          equipmentWithCalibrations.add(
            (cal.flowmeterId._id || cal.flowmeterId).toString()
          );
        }
      });

      // Calculate the next calibration due date (soonest nextCalibration date)
      let nextDue = null;
      const validNextCalibrations = calibrations
        .filter((cal) => cal.nextCalibration)
        .map((cal) => new Date(cal.nextCalibration))
        .sort((a, b) => a - b);

      if (validNextCalibrations.length > 0) {
        nextDue = validNextCalibrations[0];
      }

      setNextCalibrationDue(nextDue);

      // Cache the results
      setCachedCalibrationData("flowmeter", {
        nextCalibrationDue: nextDue,
      });
    } catch (error) {
      console.error("Error fetching fresh flowmeter calibration data:", error);
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
      title="Site Rotameters"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={viewCalibrationsPath}
      icon={process.env.PUBLIC_URL + "/air-mon-icons/fm.png"}
      color="#2e7d32"
    />
  );
};

export default FlowmeterCalibration;
