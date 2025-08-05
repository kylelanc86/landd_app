import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  useTheme,
  IconButton,
  Button,
  Breadcrumbs,
  Link,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../../theme/tokens";
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

  const handleBackToHome = () => {
    navigate("/records");
  };

  return (
    <Box p="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Calibrations
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Breadcrumbs>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Records Home
          </Link>
          <Typography color="text.primary">Calibrations</Typography>
        </Breadcrumbs>

        <Button
          variant="contained"
          startIcon={<ListAltIcon />}
          onClick={() => navigate("/records/laboratory/equipment")}
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
            viewCalibrationsPath="/records/laboratory/calibrations/air-pump"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <FlowmeterCalibration
            nextCalibrationDue="2024-03-20"
            viewCalibrationsPath="/records/laboratory/calibrations/flowmeter"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <EFA
            nextCalibrationDue="2024-03-25"
            viewCalibrationsPath="/records/laboratory/calibrations/efa"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <MicroscopeCalibration
            nextCalibrationDue="2024-03-30"
            viewCalibrationsPath="/records/laboratory/calibrations/microscope"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <AcetoneVaporiser
            nextCalibrationDue="2024-04-05"
            viewCalibrationsPath="/records/laboratory/calibrations/acetone-vaporiser"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <GraticuleCalibration
            nextCalibrationDue="2024-04-10"
            viewCalibrationsPath="/records/laboratory/calibrations/graticule"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <PrimaryFlowmeter
            nextCalibrationDue="2024-04-15"
            viewCalibrationsPath="/records/laboratory/calibrations/primary-flowmeter"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <PureAsbestos
            nextCalibrationDue="2024-04-20"
            viewCalibrationsPath="/records/laboratory/calibrations/pure-asbestos"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <RiLiquid
            nextCalibrationDue="2024-04-25"
            viewCalibrationsPath="/records/laboratory/calibrations/ri-liquid"
          />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <Sieves
            nextCalibrationDue="2024-04-30"
            viewCalibrationsPath="/records/laboratory/calibrations/sieves"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Calibrations;
