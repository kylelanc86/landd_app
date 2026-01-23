import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { flowmeterCalibrationService } from "../../../../services/flowmeterCalibrationService";
import { equipmentService } from "../../../../services/equipmentService";

const PrimaryFlowmeter = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchPrimaryFlowmeterData();
  }, []);

  const fetchPrimaryFlowmeterData = async () => {
    try {
      setLoading(true);

      // Fetch all flowmeter calibrations (Primary Flowmeters may be included)
      const response = await flowmeterCalibrationService.getAll({
        limit: 1000,
      });
      const calibrations = response.data || [];

      // Filter for primary flowmeters if there's a way to distinguish them
      // For now, use all flowmeter calibrations
      if (calibrations.length === 0) {
        setNextCalibrationDue(null);
        setItemsDueInNextMonth(0);
        return;
      }

      // Calculate the next calibration due date (soonest nextCalibration date)
      const validNextCalibrations = calibrations
        .filter((cal) => cal.nextCalibration)
        .map((cal) => new Date(cal.nextCalibration))
        .sort((a, b) => a - b);

      if (validNextCalibrations.length > 0) {
        setNextCalibrationDue(validNextCalibrations[0]);
      }

      // Calculate items due in next month (next 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      const dueInNextMonth = calibrations.filter((cal) => {
        if (!cal.nextCalibration) return false;
        const nextCalDate = new Date(cal.nextCalibration);
        return nextCalDate >= now && nextCalDate <= thirtyDaysFromNow;
      }).length;

      setItemsDueInNextMonth(dueInNextMonth);
    } catch (error) {
      console.error(
        "Error fetching Primary Flowmeter calibration data:",
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
