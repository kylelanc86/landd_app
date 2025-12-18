import React, { useState, useEffect } from "react";
import { Box, CircularProgress, useTheme } from "@mui/material";
import BaseCalibrationWidget from "./BaseCalibrationWidget";
import { equipmentService } from "../../../../services/equipmentService";

const AcetoneVaporiser = ({ viewCalibrationsPath }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [nextCalibrationDue, setNextCalibrationDue] = useState(null);
  const [itemsDueInNextMonth, setItemsDueInNextMonth] = useState(0);

  useEffect(() => {
    fetchAcetoneVaporiserData();
  }, []);

  const fetchAcetoneVaporiserData = async () => {
    try {
      setLoading(true);

      // Fetch equipment of type Acetone Vaporiser
      const response = await equipmentService.getAll({
        equipmentType: "Acetone Vaporiser",
        limit: 1000,
      });
      const equipment = response.equipment || [];

      // For now, set defaults until calibration service is available
      // TODO: Implement calibration service for Acetone Vaporiser
      setNextCalibrationDue(null);
      setItemsDueInNextMonth(0);
    } catch (error) {
      console.error("Error fetching acetone vaporiser data:", error);
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
      title="Acetone Vaporiser"
      nextCalibrationDue={nextCalibrationDue}
      itemsDueInNextMonth={itemsDueInNextMonth}
      viewCalibrationsPath={
        viewCalibrationsPath ||
        "/records/laboratory/calibrations/acetone-vaporiser"
      }
      icon={process.env.PUBLIC_URL + "/air-mon-icons/vaporiser.png"}
    />
  );
};

export default AcetoneVaporiser;
