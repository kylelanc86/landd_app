import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import hseTestSlideService from "../../../../services/hseTestSlideService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const HSETestSlideCalibration = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchHSEData();
  }, []);

  const fetchHSEData = async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cached = getCachedCalibrationData("hse-test-slide");
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
      console.error("Error fetching HSE Test Slide calibration data:", error);
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch all HSE Test Slide calibrations
      const response = await hseTestSlideService.getAll({ limit: 1000 });
      const calibrations = response.data || [];

      // Fetch equipment to check for items without calibration
      const equipmentResponse = await equipmentService.getAll({
        equipmentType: "HSE Test Slide",
        limit: 1000,
      });
      const equipment = equipmentResponse.equipment || [];

      // Track which equipment has calibrations
      const equipmentWithCalibrations = new Set();
      calibrations.forEach((cal) => {
        if (cal.testSlideReference) {
          equipmentWithCalibrations.add(cal.testSlideReference);
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
      setCachedCalibrationData("hse-test-slide", {
        nextCalibrationDue: nextDue,
        itemsDueInNextMonth: dueInNextMonth,
      });
    } catch (error) {
      console.error(
        "Error fetching fresh HSE Test Slide calibration data:",
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
      title="HSE Test Slides"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath ||
        "/records/laboratory/calibrations/hse-test-slide"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/test-slide.png"}
    />
  );
};

export default HSETestSlideCalibration;
