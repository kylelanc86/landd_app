import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  Tabs,
  Tab,
  useTheme,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SchoolIcon from "@mui/icons-material/School";
import GroupIcon from "@mui/icons-material/Group";
import DescriptionIcon from "@mui/icons-material/Description";
import BusinessIcon from "@mui/icons-material/Business";
import InventoryIcon from "@mui/icons-material/Inventory";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import SecurityIcon from "@mui/icons-material/Security";
import GavelIcon from "@mui/icons-material/Gavel";
import FeedbackIcon from "@mui/icons-material/Feedback";
import ScienceIcon from "@mui/icons-material/Science";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AirIcon from "@mui/icons-material/Air";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AssignmentIcon from "@mui/icons-material/Assignment";

const RecordWidget = ({ title, icon, onClick, color = "primary" }) => (
  <Card
    sx={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      transition: "transform 0.2s, box-shadow 0.2s",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: 4,
      },
    }}
  >
    <CardActionArea
      onClick={onClick}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: "center", p: 3 }}>
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          {React.cloneElement(icon, {
            sx: { fontSize: 48, color: `${color}.main` },
          })}
        </Box>
        <Typography variant="h6" component="h2" gutterBottom>
          {title}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const Records = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const containerRef = useRef(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const generalRecordWidgets = [
    {
      title: "Training Records",
      icon: <SchoolIcon />,
      color: "primary",
      onClick: () => navigate("/records/training"),
    },
    {
      title: "Staff Meetings",
      icon: <GroupIcon />,
      color: "secondary",
      onClick: () => navigate("/records/staff-meetings"),
    },
    {
      title: "Document Register",
      icon: <DescriptionIcon />,
      color: "success",
      onClick: () => navigate("/records/document-register"),
    },
    {
      title: "Approved Suppliers",
      icon: <BusinessIcon />,
      color: "info",
      onClick: () => navigate("/records/approved-suppliers"),
    },
    {
      title: "Asset Register",
      icon: <InventoryIcon />,
      color: "warning",
      onClick: () => navigate("/records/asset-register"),
    },
    {
      title: "Incidents & Non-conformances",
      icon: <ReportProblemIcon />,
      color: "error",
      onClick: () => navigate("/records/incidents"),
    },
    {
      title: "OHS & Environmental Targets & Risks",
      icon: <SecurityIcon />,
      color: "primary",
      onClick: () => navigate("/records/ohs-environmental"),
    },
    {
      title: "Impartiality Risks",
      icon: <GavelIcon />,
      color: "secondary",
      onClick: () => navigate("/records/impartiality-risks"),
    },
    {
      title: "Feedback",
      icon: <FeedbackIcon />,
      color: "success",
      onClick: () => navigate("/records/feedback"),
    },
  ];

  const laboratoryRecordWidgets = [
    {
      title: "Equipment List",
      icon: <ScienceIcon />,
      color: "primary",
      onClick: () => navigate("/records/laboratory/equipment"),
    },
    {
      title: "Calibrations",
      icon: <TrendingUpIcon />,
      color: "secondary",
      onClick: () => navigate("/records/laboratory/calibrations"),
    },
    {
      title: "Quality Control",
      icon: <AssignmentIcon />,
      color: "success",
      onClick: () => navigate("/records/quality-control"),
    },
    {
      title: "Indoor Air Quality",
      icon: <AirIcon />,
      color: "info",
      onClick: () => navigate("/records/indoor-air-quality"),
    },
    {
      title: "Blanks",
      icon: <FilterAltIcon />,
      color: "warning",
      onClick: () => navigate("/records/blanks"),
    },
    {
      title: "Audits",
      icon: <AssignmentIcon />,
      color: "error",
      onClick: () => navigate("/records/audits"),
    },
  ];

  // Touch event handlers for swipe functionality
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeTab < 1) {
      setActiveTab(1); // Swipe to Laboratory Records
    } else if (isRightSwipe && activeTab > 0) {
      setActiveTab(0); // Swipe to General Records
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Tab panel component
  const TabPanel = ({ children, value, index, ...other }) => (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`records-tabpanel-${index}`}
      aria-labelledby={`records-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Records
      </Typography>

      {/* Tab Navigation */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            "& .MuiTab-root": {
              textTransform: "none",
              fontSize: "1rem",
              fontWeight: 600,
              py: 2,
              color: theme.palette.text.secondary,
              "&.Mui-selected": {
                backgroundColor: "#4caf50",
                color: "white !important",
              },
            },
            "& .MuiTabs-indicator": {
              backgroundColor: "#4caf50",
              height: 3,
            },
          }}
        >
          <Tab
            label="General Records"
            id="records-tab-0"
            aria-controls="records-tabpanel-0"
          />
          <Tab
            label="Laboratory Records"
            id="records-tab-1"
            aria-controls="records-tabpanel-1"
          />
        </Tabs>
      </Paper>

      {/* Swipeable Content Container */}
      <Box
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        sx={{
          position: "relative",
          overflow: "hidden",
          minHeight: "60vh",
        }}
      >
        {/* General Records Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box
            sx={{
              transform:
                activeTab === 0 ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.3s ease-in-out",
              position: "relative",
            }}
          >
            <Grid container spacing={3}>
              {generalRecordWidgets.map((widget, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                  <RecordWidget {...widget} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </TabPanel>

        {/* Laboratory Records Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box
            sx={{
              transform: activeTab === 1 ? "translateX(0)" : "translateX(100%)",
              transition: "transform 0.3s ease-in-out",
              position: "relative",
            }}
          >
            <Grid container spacing={3}>
              {laboratoryRecordWidgets.map((widget, index) => (
                <Grid item xs={12} sm={6} md={4} lg={4} key={index}>
                  <RecordWidget {...widget} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </TabPanel>
      </Box>

      {/* Swipe Instructions */}
      <Box
        sx={{
          mt: 3,
          textAlign: "center",
          color: theme.palette.text.secondary,
          fontSize: "0.875rem",
        }}
      >
        💡 Swipe left or right to switch between tabs
      </Box>
    </Box>
  );
};

export default Records;
