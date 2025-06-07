import React from "react";
import { Box, Grid, Typography } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AirPumpCalibration from "./widgets/AirPumpCalibration";
import FlowmeterCalibration from "./widgets/FlowmeterCalibration";
import EFA from "./widgets/EFA";
import MicroscopeCalibration from "./widgets/MicroscopeCalibration";
import AcetoneVaporiser from "./widgets/AcetoneVaporiser";
import GraticuleCalibration from "./widgets/GraticuleCalibration";
import PrimaryFlowmeter from "./widgets/PrimaryFlowmeter";
import Header from "../../components/Header";

const Calibrations = () => {
  return (
    <Box p="20px" position="relative">
      {/* Under Construction Watermark */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 99999,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            opacity: 0.3,
            userSelect: "none",
            transform: "rotate(-45deg)",
            width: "100%",
            maxWidth: "800px",
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 120, color: "orange", mb: 2 }} />
          <Typography
            variant="h1"
            sx={{
              color: "orange",
              fontSize: "4rem",
              fontWeight: 900,
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)",
              textAlign: "center",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Under Construction
          </Typography>
        </Box>
      </Box>

      {/* Interaction Blocker */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          zIndex: 99998,
          cursor: "not-allowed",
        }}
      />

      <Header title="Equipment Calibrations" subtitle="Air Monitoring" />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={4}>
          <AirPumpCalibration
            nextCalibrationDue="2024-03-15"
            viewCalibrationsPath="/calibrations/air-pump"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <FlowmeterCalibration
            nextCalibrationDue="2024-03-20"
            viewCalibrationsPath="/calibrations/flowmeter"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <EFA
            nextCalibrationDue="2024-03-25"
            viewCalibrationsPath="/calibrations/efa"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <MicroscopeCalibration
            nextCalibrationDue="2024-03-30"
            viewCalibrationsPath="/calibrations/microscope"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <AcetoneVaporiser
            nextCalibrationDue="2024-04-05"
            viewCalibrationsPath="/calibrations/acetone-vaporiser"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <GraticuleCalibration
            nextCalibrationDue="2024-04-10"
            viewCalibrationsPath="/calibrations/graticule"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <PrimaryFlowmeter
            nextCalibrationDue="2024-04-15"
            viewCalibrationsPath="/calibrations/primary-flowmeter"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Calibrations;
