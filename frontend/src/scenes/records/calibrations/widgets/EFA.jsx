import React from "react";
import { Box, Typography, useTheme, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";

const EFA = ({ nextCalibrationDue, viewCalibrationsPath }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        p: 3,
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <img
            src={
              process.env.PUBLIC_URL +
              "/air-mon-icons/effective filter area.png"
            }
            alt="Effective Filter Area icon"
            style={{
              width: "32px",
              height: "32px",
              objectFit: "contain",
            }}
          />
          <Typography
            variant="h5"
            color={theme.palette.text.primary}
            fontWeight="bold"
          >
            Effective Filter Area
          </Typography>
        </Box>
      </Box>

      <Box mb={2}>
        <Typography variant="body2" color="red">
          Calibration due on integration of new filter holder models
        </Typography>
      </Box>

      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={() => navigate("/records/laboratory/calibrations/efa")}
        sx={{
          textTransform: "none",
          py: 1,
        }}
      >
        View Calibrations
      </Button>
    </Box>
  );
};

export default EFA;
