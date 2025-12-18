import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { airPumpCalibrationService } from "../../../../services/airPumpCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";
import {
  getCachedCalibrationData,
  setCachedCalibrationData,
} from "../../../../utils/calibrationCache";

const AirPumpCalibration = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchAirPumpData();
  }, []);

  const fetchAirPumpData = async () => {
    try {
      setLoading(true);

      // Try to load from cache first
      const cached = getCachedCalibrationData("air-pump");
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
      console.error("Error fetching air pump calibration data:", error);
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      // Fetch all air pump equipment
      const equipmentResponse = await equipmentService.getAll({
        equipmentType: "Air pump",
        limit: 1000,
      });
      const airPumps = equipmentResponse.equipment || [];

      if (airPumps.length === 0) {
        setNextCalibrationDue(null);
        setItemsDueInNextMonth(0);
        setCachedCalibrationData("air-pump", {
          nextCalibrationDue: null,
          itemsDueInNextMonth: 0,
        });
        setLoading(false);
        return;
      }

      // Fetch calibrations for all air pumps
      const allCalibrations = [];
      const pumpsWithCalibrations = new Set();

      for (const pump of airPumps) {
        try {
          const pumpId = pump._id || pump.id;
          const response = await airPumpCalibrationService.getPumpCalibrations(
            pumpId,
            1,
            1000
          );
          if (response.data && response.data.length > 0) {
            allCalibrations.push(...response.data);
            pumpsWithCalibrations.add(pumpId.toString());
          }
        } catch (error) {
          console.error(
            `Error fetching calibrations for pump ${pump.equipmentReference}:`,
            error
          );
        }
      }

      // Calculate the next calibration due date (soonest nextCalibrationDue date)
      let nextDue = null;
      const validNextCalibrations = allCalibrations
        .filter((cal) => cal.nextCalibrationDue)
        .map((cal) => new Date(cal.nextCalibrationDue))
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
      let dueInNextMonth = allCalibrations.filter((cal) => {
        if (!cal.nextCalibrationDue) return false;
        const nextCalDate = new Date(cal.nextCalibrationDue);
        return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
      }).length;

      // Count equipment without calibration data (and not out of service) as due
      const equipmentWithoutCalibration = airPumps.filter((pump) => {
        const pumpId = (pump._id || pump.id).toString();
        const hasCalibration = pumpsWithCalibrations.has(pumpId);
        const isOutOfService = pump.status === "out-of-service";
        return !hasCalibration && !isOutOfService;
      });

      dueInNextMonth += equipmentWithoutCalibration.length;

      setNextCalibrationDue(nextDue);
      setItemsDueInNextMonth(dueInNextMonth);

      // Cache the results
      setCachedCalibrationData("air-pump", {
        nextCalibrationDue: nextDue,
        itemsDueInNextMonth: dueInNextMonth,
      });
    } catch (error) {
      console.error("Error fetching fresh air pump calibration data:", error);
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
      title="Air Monitors"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/air-pump"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/airpump.png"}
    />
  );
};

export default AirPumpCalibration;
