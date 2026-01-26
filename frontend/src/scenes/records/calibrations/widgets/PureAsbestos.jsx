import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { equipmentService } from "../../../../services/equipmentService";

const PureAsbestos = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchPureAsbestosData();
  }, []);

  const fetchPureAsbestosData = async () => {
    try {
      setLoading(true);

      // For now, set defaults until calibration service is available
      // TODO: Implement calibration service for Pure Asbestos
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
    } catch (error) {
      console.error("Error fetching Pure Asbestos data:", error);
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
      title="Pure Asbestos"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/pure-asbestos"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/asbestos.png"}
      color="#c62828"
    />
  );
};

export default PureAsbestos;
