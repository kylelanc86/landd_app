import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  IconButton,
  Button,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../../theme";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Header from "../../../components/Header";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AirPumpCalibration from "./widgets/AirPumpCalibration";
import FlowmeterCalibration from "./widgets/FlowmeterCalibration";
import EFA from "./widgets/EFA";
import MicroscopeCalibration from "./widgets/MicroscopeCalibration";
import AcetoneVaporiser from "./widgets/AcetoneVaporiser";
import GraticuleCalibration from "./widgets/GraticuleCalibration";
import PrimaryFlowmeter from "./widgets/PrimaryFlowmeter";
import PureAsbestos from "./widgets/PureAsbestos";
import RiLiquid from "./widgets/RiLiquid";
import Sieves from "./widgets/Sieves";

const Calibrations = () => {
  const navigate = useNavigate();

  return (
    <Box p="20px">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header
          title="Equipment Calibrations"
          subtitle="Air Monitoring & Fibre ID Equipment Calibrations"
        />
        <Button
          variant="contained"
          startIcon={<ListAltIcon />}
          onClick={() => navigate("/calibrations/equipment-list")}
          sx={{
            backgroundColor: tokens.primary[700],
            color: tokens.grey[100],
            fontSize: "14px",
            fontWeight: "bold",
            padding: "10px 20px",
            "&:hover": {
              backgroundColor: tokens.primary[800],
            },
          }}
        >
          Equipment List
        </Button>
      </Box>
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
            viewCalibrationsPath="/calibrations/air-mon-microscope"
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
        <Grid item xs={12} md={6} lg={4}>
          <PureAsbestos
            nextCalibrationDue="2024-04-20"
            viewCalibrationsPath="/calibrations/pure-asbestos"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <RiLiquid
            nextCalibrationDue="2024-04-25"
            viewCalibrationsPath="/calibrations/ri-liquid"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <Sieves
            nextCalibrationDue="2024-04-30"
            viewCalibrationsPath="/calibrations/sieves"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Calibrations;
