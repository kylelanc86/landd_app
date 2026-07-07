import React, { useEffect, useState } from "react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { useAuth } from "../../../context/AuthContext";
import { hasPermission } from "../../../config/permissions";
import AirPumpCalibration from "./widgets/AirPumpCalibration";
import FlowmeterCalibration from "./widgets/FlowmeterCalibration";
import EFA from "./widgets/EFA";
import MicroscopeCalibration from "./widgets/PCMMicroscopeCalibration";
import PLMMicroscopeCalibration from "./widgets/PLMMicroscopeCalibration";
import StereomicroscopeCalibration from "./widgets/StereomicroscopeCalibration";
import HSETestSlideCalibration from "./widgets/HSETestSlideCalibration";
import AcetoneVaporiser from "./widgets/AcetoneVaporiser";
import GraticuleCalibration from "./widgets/GraticuleCalibration";
import PrimaryFlowmeter from "./widgets/PrimaryFlowmeter";
import PureAsbestos from "./widgets/PureAsbestos";
import RiLiquid from "./widgets/RiLiquid";
import Sieves from "./widgets/Sieves";
import Furnace from "./widgets/Furnace";
import PneumaticTester from "./widgets/PneumaticTester";
import MassBalances from "./widgets/MassBalances";
import Micrometer from "./widgets/Micrometer";
import FumeHoods from "./widgets/FumeHoods";
import Calipers from "./widgets/Calipers";
import {
  resolveCalibrationsTab,
  storeCalibrationsTab,
} from "./calibrationsNavigationUtils";

const Calibrations = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") || "laboratory";
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(() =>
    resolveCalibrationsTab(searchParams.get("tab"))
  );

  useEffect(() => {
    const resolvedTab = resolveCalibrationsTab(searchParams.get("tab"));
    setActiveTab(resolvedTab);
    storeCalibrationsTab(resolvedTab);
  }, [searchParams]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    storeCalibrationsTab(newValue);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", newValue === 1 ? "external" : "internal");
        if (!next.get("view")) {
          next.set("view", view);
        }
        return next;
      },
      { replace: true }
    );
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
            Laboratory Records
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
            <AirPumpCalibration viewCalibrationsPath="/records/laboratory/calibrations/air-pump" />
          </Grid>
          {/* Site Rotameters */}
          <Grid item xs={12} md={6} lg={4}>
            <FlowmeterCalibration viewCalibrationsPath="/records/laboratory/calibrations/flowmeter" />
          </Grid>
          {/* Acetone Vaporiser */}
          <Grid item xs={12} md={6} lg={4}>
            <AcetoneVaporiser viewCalibrationsPath="/records/laboratory/calibrations/acetone-vaporiser" />
          </Grid>
          {/* RI Liquids */}
          <Grid item xs={12} md={6} lg={4}>
            <RiLiquid viewCalibrationsPath="/records/laboratory/calibrations/ri-liquid" />
          </Grid>
          {/* PCM Graticules */}
          <Grid item xs={12} md={6} lg={4}>
            <GraticuleCalibration viewCalibrationsPath="/records/laboratory/calibrations/graticule" />
          </Grid>
          {/* Effective Filter Area */}
          <Grid item xs={12} md={6} lg={4}>
            <EFA viewCalibrationsPath="/records/laboratory/calibrations/efa" />
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          {/* Calipers */}
          <Grid item xs={12} md={6} lg={3}>
            <Calipers viewCalibrationsPath="/records/laboratory/calibrations/calipers" />
          </Grid>
          {/* Fume Hoods */}
          <Grid item xs={12} md={6} lg={3}>
            <FumeHoods viewCalibrationsPath="/records/laboratory/calibrations/fume-hoods" />
          </Grid>
          {/* Furnace */}
          <Grid item xs={12} md={6} lg={3}>
            <Furnace viewCalibrationsPath="/records/laboratory/calibrations/furnace" />
          </Grid>
          {/* HSE Test Slide */}
          <Grid item xs={12} md={6} lg={3}>
            <HSETestSlideCalibration viewCalibrationsPath="/records/laboratory/calibrations/hse-test-slide" />
          </Grid>
          {/* Mass Balances */}
          <Grid item xs={12} md={6} lg={3}>
            <MassBalances viewCalibrationsPath="/records/laboratory/calibrations/mass-balances" />
          </Grid>
          {/* Micrometer */}
          <Grid item xs={12} md={6} lg={3}>
            <Micrometer viewCalibrationsPath="/records/laboratory/calibrations/micrometer" />
          </Grid>
          {/* PCM Microscope */}
          <Grid item xs={12} md={6} lg={3}>
            <MicroscopeCalibration viewCalibrationsPath="/records/laboratory/calibrations/microscope" />
          </Grid>
          {/* PLM Microscope */}
          <Grid item xs={12} md={6} lg={3}>
            <PLMMicroscopeCalibration viewCalibrationsPath="/records/laboratory/calibrations/plm-microscope" />
          </Grid>
          {/* Pneumatic Tester */}
          <Grid item xs={12} md={6} lg={3}>
            <PneumaticTester viewCalibrationsPath="/records/laboratory/calibrations/pneumatic-tester" />
          </Grid>
          {/* Primary Flowmeter */}
          <Grid item xs={12} md={6} lg={3}>
            <PrimaryFlowmeter viewCalibrationsPath="/records/laboratory/calibrations/primary-flowmeter" />
          </Grid>
          {/* Pure Asbestos */}
          <Grid item xs={12} md={6} lg={3}>
            <PureAsbestos viewCalibrationsPath="/records/laboratory/calibrations/pure-asbestos" />
          </Grid>
          {/* Sieves */}
          <Grid item xs={12} md={6} lg={3}>
            <Sieves viewCalibrationsPath="/records/laboratory/calibrations/sieves" />
          </Grid>
          {/* Stereomicroscope */}
          <Grid item xs={12} md={6} lg={3}>
            <StereomicroscopeCalibration viewCalibrationsPath="/records/laboratory/calibrations/stereomicroscope" />
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Calibrations;
