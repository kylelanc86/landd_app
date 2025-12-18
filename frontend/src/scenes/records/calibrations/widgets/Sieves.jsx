import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { equipmentService } from "../../../../services/equipmentService";

const Sieves = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchSievesData();
  }, []);

  const fetchSievesData = async () => {
    try {
      setLoading(true);

      // For now, set defaults until calibration service is available
      // TODO: Implement calibration service for Sieves
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
    } catch (error) {
      console.error("Error fetching Sieves data:", error);
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
      title="Sieves"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/sieves"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/Sieves.png"}
    />
  );
};

export default Sieves;
