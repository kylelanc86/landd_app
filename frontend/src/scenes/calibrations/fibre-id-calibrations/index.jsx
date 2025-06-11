import React, { useState } from "react";
import { Box, Grid, Typography, useTheme, IconButton } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../../theme";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Header from "../../../components/Header";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

import FumeHoods from "./widgets/FumeHoods";
import IDMicroscopeCalibration from "./widgets/IDMicroscopeCalibration";
import RiLiquid from "./widgets/RiLiquid";

import PureAsbestos from "./widgets/PureAsbestos";
import Sieves from "./widgets/Sieves";

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
          <IDMicroscopeCalibration
            nextCalibrationDue="2024-03-30"
            viewCalibrationsPath="/calibrations/fibreIDmicroscope"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <RiLiquid
            nextCalibrationDue="2024-04-05"
            viewCalibrationsPath="/calibrations/RI-liquid"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <FumeHoods
            nextCalibrationDue="2024-04-10"
            viewCalibrationsPath="/calibrations/fumehoods"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <PureAsbestos
            nextCalibrationDue="N/A"
            viewCalibrationsPath="/calibrations/pure-asbestos"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <Sieves
            nextCalibrationDue="N/A"
            viewCalibrationsPath="/calibrations/sieves"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Calibrations;
