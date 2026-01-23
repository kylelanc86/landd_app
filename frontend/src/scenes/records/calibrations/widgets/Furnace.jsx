import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { equipmentService } from "../../../../services/equipmentService";

const Furnace = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchFurnaceData();
  }, []);

  const fetchFurnaceData = async () => {
    try {
      setLoading(true);

      // Fetch equipment of type Furnace
      const response = await equipmentService.getAll({
        equipmentType: "Furnace",
        limit: 1000,
      });
      const equipment = response.equipment || [];

      // For now, set defaults until calibration service is available
      // TODO: Implement calibration service for Furnace
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
    } catch (error) {
      console.error("Error fetching Furnace data:", error);
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
      title="Furnace"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath || "/records/laboratory/calibrations/furnace"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/furnace.png"}
      color="#795548"
    />
  );
};

export default Furnace;
