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
        setCachedCalibrationData("air-pump", {
          nextCalibrationDue: null,
        });
        setLoading(false);
        return;
      }

      // Fetch calibrations for all air pumps in one request
      const pumpIds = airPumps
        .map((pump) => pump._id || pump.id)
        .filter(Boolean)
        .map((id) => id.toString());

      let allCalibrations = [];
      const pumpsWithCalibrations = new Set();

      if (pumpIds.length > 0) {
        try {
          const bulkResponse =
            await airPumpCalibrationService.getBulkPumpCalibrations(
              pumpIds,
              1000
            );

          if (bulkResponse && typeof bulkResponse === "object") {
            Object.entries(bulkResponse).forEach(([pumpId, calibrations]) => {
              if (Array.isArray(calibrations) && calibrations.length > 0) {
                allCalibrations = allCalibrations.concat(calibrations);
                pumpsWithCalibrations.add(pumpId);
              }
            });
          }
        } catch (error) {
          console.error(
            "Error bulk fetching air pump calibrations:",
            error.response?.data || error.message || error
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

      setNextCalibrationDue(nextDue);

      // Cache the results
      setCachedCalibrationData("air-pump", {
        nextCalibrationDue: nextDue,
      });
    } catch (error) {
      console.error("Error fetching fresh air pump calibration data:", error);
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
      title="Air Monitors"
      nextCalibrationDue={nextCalibrationDue}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/air-pump"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/airpump.png"}
      color="#1976d2"
    />
  );
};

export default AirPumpCalibration;
