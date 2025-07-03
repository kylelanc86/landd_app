import React from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  Divider,
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Records
      </Typography>

      {/* General Records Section */}
      <Typography
        variant="h5"
        component="h2"
        gutterBottom
        sx={{ mb: 3, mt: 4 }}
      >
        General Records
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {generalRecordWidgets.map((widget, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
            <RecordWidget {...widget} />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* Laboratory Records Section */}
      <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 3 }}>
        Laboratory Records
      </Typography>
      <Grid container spacing={3}>
        {laboratoryRecordWidgets.map((widget, index) => (
          <Grid item xs={12} sm={6} md={4} lg={4} key={index}>
            <RecordWidget {...widget} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Records;
