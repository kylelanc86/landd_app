import React from "react";
import { Box, Grid } from "@mui/material";
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
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 10,
          opacity: 0.25,
          flexDirection: "column",
          userSelect: "none",
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 80, color: "orange" }} />
        <Box
          sx={{
            fontSize: "2rem",
            fontWeight: "bold",
            color: "orange",
            textShadow: "1px 1px 8px #fff",
          }}
        >
          UNDER <br />
          CONSTRUCTION
        </Box>
      </Box>

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
