import React, { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Button,
  Breadcrumbs,
  Link,
  Tabs,
  Tab,
} from "@mui/material";
import { tokens } from "../../../theme/tokens";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../config/permissions";
import AirPumpCalibration from "./widgets/AirPumpCalibration";
import FlowmeterCalibration from "./widgets/FlowmeterCalibration";
import EFA from "./widgets/EFA";
import MicroscopeCalibration from "./widgets/PCMMicroscopeCalibration";
import AcetoneVaporiser from "./widgets/AcetoneVaporiser";
import GraticuleCalibration from "./widgets/GraticuleCalibration";
import PrimaryFlowmeter from "./widgets/PrimaryFlowmeter";
import PureAsbestos from "./widgets/PureAsbestos";
import RiLiquid from "./widgets/RiLiquid";
import Sieves from "./widgets/Sieves";
import Furnace from "./widgets/Furnace";
import { formatDate } from "../../../utils/dateFormat";

const Calibrations = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Check if user has admin access
  const canAccessCalibrationFrequency = hasPermission(
    currentUser,
    "admin.access"
  );

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

        <Box display="flex" gap={2}>
          {canAccessCalibrationFrequency && (
            <Button
              variant="contained"
              startIcon={<ScheduleIcon />}
              onClick={() =>
                navigate("/records/laboratory/calibrations/frequency")
              }
              sx={{
                backgroundColor: "#357ECA",
                color: tokens.grey[100],
                fontSize: "14px",
                fontWeight: "bold",
                padding: "10px 20px",
                "&:hover": {
                  backgroundColor: "#3D3DC2",
                },
              }}
            >
              Calibration Frequency
            </Button>
          )}
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
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Internal Calibrations" />
          <Tab label="External Calibrations/Servicing" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Air Monitors */}
          <Grid item xs={12} md={6} lg={4}>
            <AirPumpCalibration
              nextCalibrationDue={formatDate("2024-03-15")}
              viewCalibrationsPath="/records/laboratory/calibrations/air-pump"
            />
          </Grid>
          {/* Site Rotameters */}
          <Grid item xs={12} md={6} lg={4}>
            <FlowmeterCalibration
              nextCalibrationDue={formatDate("2024-03-20")}
              viewCalibrationsPath="/records/laboratory/calibrations/flowmeter"
            />
          </Grid>
          {/* Acetone Vaporiser */}
          <Grid item xs={12} md={6} lg={4}>
            <AcetoneVaporiser
              nextCalibrationDue={formatDate("2024-04-05")}
              viewCalibrationsPath="/records/laboratory/calibrations/acetone-vaporiser"
            />
          </Grid>
          {/* RI Liquids */}
          <Grid item xs={12} md={6} lg={4}>
            <RiLiquid
              nextCalibrationDue={formatDate("2024-04-25")}
              viewCalibrationsPath="/records/laboratory/calibrations/ri-liquid"
            />
          </Grid>
          {/* PCM Graticules */}
          <Grid item xs={12} md={6} lg={4}>
            <GraticuleCalibration viewCalibrationsPath="/records/laboratory/calibrations/graticule" />
          </Grid>
          {/* Effective Filter Area */}
          <Grid item xs={12} md={6} lg={4}>
            <EFA
              viewCalibrationsPath="/records/laboratory/calibrations/efa"
            />
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Microscope */}
          <Grid item xs={12} md={6} lg={4}>
            <MicroscopeCalibration
              nextCalibrationDue={formatDate("2024-03-30")}
              viewCalibrationsPath="/records/laboratory/calibrations/microscope"
            />
          </Grid>
          {/* Primary Flowmeter */}
          <Grid item xs={12} md={6} lg={4}>
            <PrimaryFlowmeter
              nextCalibrationDue={formatDate("2024-04-15")}
              viewCalibrationsPath="/records/laboratory/calibrations/primary-flowmeter"
            />
          </Grid>
          {/* Sieves */}
          <Grid item xs={12} md={6} lg={4}>
            <Sieves
              nextCalibrationDue={formatDate("2024-04-30")}
              viewCalibrationsPath="/records/laboratory/calibrations/sieves"
            />
          </Grid>
          {/* Pure Asbestos */}
          <Grid item xs={12} md={6} lg={4}>
            <PureAsbestos
              nextCalibrationDue={formatDate("2024-04-20")}
              viewCalibrationsPath="/records/laboratory/calibrations/pure-asbestos"
            />
          </Grid>
          {/* Furnace */}
          <Grid item xs={12} md={6} lg={4}>
            <Furnace />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Calibrations;
