import React, { useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  useTheme,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
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
      position: "relative",
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
        cursor: "pointer",
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: "center", p: 3 }}>
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          {React.cloneElement(icon, {
            sx: {
              fontSize: 48,
              color: `${color}.main`,
            },
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
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const [view, setView] = useState("home"); // "home", "general", "laboratory"

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
      title: "Client Feedback",
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

  const recordModules = [
    {
      id: "general",
      title: "General Records",
      description:
        "Access training records, staff meetings, document register, and more",
      icon: <DescriptionIcon />,
      color: "#1976d2",
      view: "general",
    },
    {
      id: "laboratory",
      title: "Laboratory Records",
      description:
        "Access equipment lists, calibrations, quality control, and more",
      icon: <ScienceIcon />,
      color: "#2e7d32",
      view: "laboratory",
    },
  ];

  const handleModuleClick = (module) => {
    setView(module.view);
  };

  const handleBackClick = () => {
    setView("home");
  };

  const getHeaderTitle = () => {
    if (view === "general") return "General Records";
    if (view === "laboratory") return "Laboratory Records";
    return "Records";
  };

  return (
    <Box m="20px">
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        {view !== "home" && (
          <IconButton
            onClick={handleBackClick}
            sx={{ mr: 2 }}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ mt: 3, mb: 4, fontWeight: 600 }}
        >
          {getHeaderTitle()}
        </Typography>
      </Box>

      {view === "home" ? (
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={isTablet ? 3 : 4}>
            {recordModules.map((module) => (
              <Grid item xs={12} sm={6} md={6} lg={6} key={module.id}>
                <Card
                  sx={{
                    height: "100%",
                    minHeight: isTablet ? "280px" : "320px",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    borderRadius: "16px",
                    boxShadow:
                      "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow:
                        "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleModuleClick(module)}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                    }}
                  >
                    <Box
                      component="div"
                      sx={{
                        height: isTablet ? 140 : 180,
                        background: `linear-gradient(135deg, ${module.color}15 0%, ${module.color}08 100%)`,
                        borderBottom: `2px solid ${module.color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        padding: isTablet ? "20px" : "24px",
                        transition: "all 0.3s ease-in-out",
                        "&:hover": {
                          background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}12 100%)`,
                          borderBottom: `2px solid ${module.color}40`,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: isTablet ? 80 : 100,
                          height: isTablet ? 80 : 100,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}10 100%)`,
                          border: `2px solid ${module.color}30`,
                          boxShadow: `0 4px 20px ${module.color}20, 0 2px 8px ${module.color}15`,
                          transition: "all 0.3s ease-in-out",
                        }}
                      >
                        {React.cloneElement(module.icon, {
                          sx: {
                            fontSize: isTablet ? 48 : 60,
                            color: module.color,
                            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                          },
                        })}
                      </Box>
                    </Box>
                    <CardContent
                      sx={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                        padding: isTablet ? "16px" : "20px",
                        "&:last-child": {
                          paddingBottom: isTablet ? "16px" : "20px",
                        },
                      }}
                    >
                      <Typography
                        variant="h5"
                        component="h2"
                        gutterBottom
                        sx={{
                          fontSize: isTablet ? "1.25rem" : "1.5rem",
                          marginBottom: isTablet ? "10px" : "12px",
                          fontWeight: 600,
                          color: "#1a1a1a",
                          lineHeight: 1.3,
                        }}
                      >
                        {module.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: isTablet ? 2 : 2.5,
                          fontSize: isTablet ? "0.875rem" : "0.9375rem",
                          lineHeight: 1.6,
                          flexGrow: 1,
                        }}
                      >
                        {module.description}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "auto",
                          paddingTop: isTablet ? "8px" : "12px",
                          borderTop: "1px solid rgba(0,0,0,0.08)",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            fontSize: isTablet ? "0.8125rem" : "0.875rem",
                            color: module.color,
                            transition: "all 0.2s ease-in-out",
                          }}
                        >
                          View {module.title}
                        </Typography>
                        <ArrowForwardIcon
                          sx={{
                            fontSize: isTablet ? "18px" : "20px",
                            color: module.color,
                            transition: "transform 0.2s ease-in-out",
                          }}
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      ) : (
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {(view === "general"
              ? generalRecordWidgets
              : laboratoryRecordWidgets
            ).map((widget, index) => (
              <Grid item xs={12} sm={6} md={4} lg={4} key={index}>
                <RecordWidget {...widget} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default Records;
