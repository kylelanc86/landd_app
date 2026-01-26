import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { efaService } from "../../../../services/efaService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const EFA = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchEFAData();
  }, []);

  const fetchEFAData = async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cached = getCachedCalibrationData("efa");
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
      console.error("Error fetching EFA calibration data:", error);
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch all EFA calibrations
      const response = await efaService.getAll({ limit: 1000 });
      const calibrations = response.data || [];

      // Fetch equipment to check for items without calibration
      const equipmentResponse = await equipmentService.getAll({
        equipmentType: "Effective Filter Area",
        limit: 1000,
      });
      const equipment = equipmentResponse.equipment || [];

      // Track which equipment has calibrations (by filterHolderModel or equipment reference)
      const equipmentWithCalibrations = new Set();
      calibrations.forEach((cal) => {
        if (cal.filterHolderModel) {
          equipmentWithCalibrations.add(cal.filterHolderModel);
        }
      });

      // Calculate the next calibration due date (soonest nextCalibration date)
      let nextDue = null;
      const validNextCalibrations = calibrations
        .filter((cal) => cal.nextCalibration)
        .map((cal) => new Date(cal.nextCalibration))
        .filter((date) => !isNaN(date.getTime())) // Filter out invalid dates
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
        // Check if date is valid before comparing
        if (isNaN(nextCalDate.getTime())) return false;
        return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
      }).length;

      // Count equipment without calibration data (and not out of service) as due
      // Note: EFA calibrations are tied to filter holder models, not individual equipment
      // So we'll count unique filter holder models that need calibration
      const uniqueModels = new Set(
        equipment
          .filter((eq) => eq.status !== "out-of-service")
          .map((eq) => eq.brandModel || eq.equipmentReference)
      );
      const modelsWithCalibration = new Set(
        calibrations.map((cal) => cal.filterHolderModel).filter(Boolean)
      );
      const modelsWithoutCalibration = Array.from(uniqueModels).filter(
        (model) => !modelsWithCalibration.has(model)
      );

      dueInNextMonth += modelsWithoutCalibration.length;

      setNextCalibrationDue(nextDue);
      setItemsDueInNextMonth(dueInNextMonth);

      // Cache the results
      setCachedCalibrationData("efa", {
        nextCalibrationDue: nextDue,
        itemsDueInNextMonth: dueInNextMonth,
      });
    } catch (error) {
      console.error("Error fetching fresh EFA calibration data:", error);
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
      title="Effective Filter Area"
      nextCalibrationDue={nextCalibrationDue}
      hideNextCalibrationDue={true}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/efa"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/effective filter area.png"}
      color="#0288d1"
    />
  );
};

export default EFA;
