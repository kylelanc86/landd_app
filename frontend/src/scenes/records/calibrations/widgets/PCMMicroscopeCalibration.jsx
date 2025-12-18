import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import pcmMicroscopeService from "../../../../services/pcmMicroscopeService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const MicroscopeCalibration = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchPCMData();
  }, []);

  const fetchPCMData = async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cached = getCachedCalibrationData("pcm-microscope");
      if (cached) {
        setNextCalibrationDue(
          cached.nextCalibrationDue ? new Date(cached.nextCalibrationDue) : null
        );
        setItemsDueInNextMonth(cached.itemsDueInNextMonth || 0);
        setLoading(false);
        // Still fetch fresh data in background to update cache
        fetchFreshData();
        return;
      }

      // No cache, fetch fresh data
      await fetchFreshData();
    } catch (error) {
      console.error("Error fetching PCM microscope calibration data:", error);
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch all PCM microscope calibrations
      const response = await pcmMicroscopeService.getAll({ limit: 1000 });
      const calibrations = response.data || [];

      // Fetch equipment to check for items without calibration
      const equipmentResponse = await equipmentService.getAll({
        equipmentType: "Phase Contrast Microscope",
        limit: 1000,
      });
      const equipment = equipmentResponse.equipment || [];

      // Track which equipment has calibrations
      const equipmentWithCalibrations = new Set();
      calibrations.forEach((cal) => {
        if (cal.microscopeReference) {
          equipmentWithCalibrations.add(cal.microscopeReference);
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

      // Calculate items due in next month (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      // Count calibrations due in next month
      let dueInNextMonth = calibrations.filter((cal) => {
        if (!cal.nextCalibration) return false;
        const nextCalDate = new Date(cal.nextCalibration);
        return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
      }).length;

      // Count equipment without calibration data (and not out of service) as due
      const equipmentWithoutCalibration = equipment.filter((eq) => {
        const eqRef = eq.equipmentReference;
        const hasCalibration = equipmentWithCalibrations.has(eqRef);
        const isOutOfService = eq.status === "out-of-service";
        return !hasCalibration && !isOutOfService;
      });

      dueInNextMonth += equipmentWithoutCalibration.length;

      setNextCalibrationDue(nextDue);
      setItemsDueInNextMonth(dueInNextMonth);

      // Cache the results
      setCachedCalibrationData("pcm-microscope", {
        nextCalibrationDue: nextDue,
        itemsDueInNextMonth: dueInNextMonth,
      });
    } catch (error) {
      console.error(
        "Error fetching fresh PCM microscope calibration data:",
        error
      );
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
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
      title="PCM Microscopes"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/microscope"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/microscope.png"}
    />
  );
};

export default MicroscopeCalibration;
