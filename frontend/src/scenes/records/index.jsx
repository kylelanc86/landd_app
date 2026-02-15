import React, { useState, useEffect } from "react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import GroupIcon from "@mui/icons-material/Group";
import DescriptionIcon from "@mui/icons-material/Description";
import BusinessIcon from "@mui/icons-material/Business";
import InventoryIcon from "@mui/icons-material/Inventory";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import GavelIcon from "@mui/icons-material/Gavel";
import FeedbackIcon from "@mui/icons-material/Feedback";
import ScienceIcon from "@mui/icons-material/Science";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AirIcon from "@mui/icons-material/Air";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import AssignmentIcon from "@mui/icons-material/Assignment";

const RecordWidget = ({ title, icon, onClick, color = "#1976d2" }) => {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: isTablet ? "280px" : "320px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        borderRadius: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.05)",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
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
        <Box
          component="div"
          sx={{
            height: isTablet ? 140 : 180,
            background: `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
            borderBottom: `2px solid ${color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            padding: isTablet ? "20px" : "24px",
            transition: "all 0.3s ease-in-out",
            "&:hover": {
              background: `linear-gradient(135deg, ${color}20 0%, ${color}12 100%)`,
              borderBottom: `2px solid ${color}40`,
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
              background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`,
              border: `2px solid ${color}30`,
              boxShadow: `0 4px 20px ${color}20, 0 2px 8px ${color}15`,
              transition: "all 0.3s ease-in-out",
            }}
          >
            {React.cloneElement(icon, {
              sx: {
                fontSize: isTablet ? 48 : 60,
                color: color,
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
            {title}
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
                color: color,
                transition: "all 0.2s ease-in-out",
              }}
            >
              View Details
            </Typography>
            <ArrowForwardIcon
              sx={{
                fontSize: isTablet ? "18px" : "20px",
                color: color,
                transition: "transform 0.2s ease-in-out",
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const Records = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const { currentUser } = useAuth();

  // Initialize view from URL parameter or default to "home"
  const urlView = searchParams.get("view");
  const [view, setView] = useState(urlView || "home"); // "home", "general", "laboratory"

  // Update view when URL parameter changes
  useEffect(() => {
    const urlView = searchParams.get("view");
    const isAdminOrManager =
      currentUser?.role === "admin" ||
      currentUser?.role === "super_admin" ||
      currentUser?.role === "manager";
    const hasOnlyCalibrationsApproval =
      currentUser?.labApprovals?.calibrations === true && !isAdminOrManager;

    if (urlView && (urlView === "general" || urlView === "laboratory")) {
      // Check if user has access to laboratory view
      if (
        urlView === "laboratory" &&
        !currentUser?.labApprovals?.calibrations &&
        !isAdminOrManager
      ) {
        // Redirect to home if user doesn't have access
        setView("home");
        setSearchParams({});
      }
      // Check if user with only calibrations approval tries to access general records
      else if (urlView === "general" && hasOnlyCalibrationsApproval) {
        // Redirect to laboratory view if user only has calibrations approval
        setView("laboratory");
        setSearchParams({ view: "laboratory" });
      } else {
        setView(urlView);
      }
    } else if (!urlView) {
      // If no view specified and user only has calibrations approval, default to laboratory
      if (hasOnlyCalibrationsApproval) {
        setView("laboratory");
        setSearchParams({ view: "laboratory" });
      } else {
        setView("home");
      }
    }
  }, [searchParams, currentUser, setSearchParams]);

  const generalRecordWidgets = [
    // {
    //   title: "Training Records",
    //   icon: <SchoolIcon />,
    //   color: "#1976d2",
    //   onClick: () => navigate("/records/training?view=general"),
    // },
    {
      title: "Staff Meetings",
      icon: <GroupIcon />,
      color: "#9c27b0",
      onClick: () => navigate("/records/staff-meetings?view=general"),
    },
    {
      title: "Document Register",
      icon: <DescriptionIcon />,
      color: "#2e7d32",
      onClick: () => navigate("/records/document-register?view=general"),
    },
    {
      title: "Approved Suppliers",
      icon: <BusinessIcon />,
      color: "#0288d1",
      onClick: () => navigate("/records/approved-suppliers?view=general"),
    },
    {
      title: "Asset Register",
      icon: <InventoryIcon />,
      color: "#ed6c02",
      onClick: () => navigate("/records/asset-register?view=general"),
    },
    {
      title: "Incidents & Non-conformances",
      icon: <ReportProblemIcon />,
      color: "#d32f2f",
      onClick: () => navigate("/records/incidents?view=general"),
    },
    // {
    //   title: "OHS & Environmental Targets & Risks",
    //   icon: <SecurityIcon />,
    //   color: "#1565c0",
    //   onClick: () => navigate("/records/ohs-environmental?view=general"),
    // },
    {
      title: "Impartiality Risks",
      icon: <GavelIcon />,
      color: "#7b1fa2",
      onClick: () => navigate("/records/impartiality-risks?view=general"),
    },
    {
      title: "Client Feedback",
      icon: <FeedbackIcon />,
      color: "#388e3c",
      onClick: () => navigate("/records/feedback?view=general"),
    },
  ];

  const laboratoryRecordWidgets = [
    // {
    //   title: "Equipment List",
    //   icon: <ScienceIcon />,
    //   color: "#1976d2",
    //   onClick: () => navigate("/records/laboratory/equipment?view=laboratory"),
    // },
    {
      title: "Calibrations",
      icon: <TrendingUpIcon />,
      color: "#2e7d32",
      onClick: () =>
        navigate("/records/laboratory/calibrations?view=laboratory"),
    },
    // {
    //   title: "Quality Control",
    //   icon: <AssignmentIcon />,
    //   color: "#0288d1",
    //   onClick: () => navigate("/records/quality-control?view=laboratory"),
    // },
    {
      title: "Indoor Air Quality",
      icon: <AirIcon />,
      color: "#00acc1",
      onClick: () => navigate("/records/indoor-air-quality?view=laboratory"),
    },
    {
      title: "Analytical Blanks",
      icon: <FilterAltIcon />,
      color: "#ed6c02",
      onClick: () => navigate("/records/blanks?view=laboratory"),
    },
    {
      title: "Audits",
      icon: <AssignmentIcon />,
      color: "#7b1fa2",
      onClick: () => navigate("/records/audits?view=laboratory"),
    },
  ];

  const recordModules = [
    {
      id: "general",
      title: "General Records",
      description: "Access staff meetings, document register, and more",
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
      requiresCalibrationsApproval: true,
    },
  ];

  // Filter record modules based on user permissions
  const availableRecordModules = recordModules.filter((module) => {
    // Check if user is admin or manager - they can see all modules
    const isAdminOrManager =
      currentUser?.role === "admin" ||
      currentUser?.role === "super_admin" ||
      currentUser?.role === "manager";

    // If user only has calibrations approval (not admin/manager), hide general records
    const hasOnlyCalibrationsApproval =
      currentUser?.labApprovals?.calibrations === true &&
      currentUser?.role !== "admin" &&
      currentUser?.role !== "super_admin" &&
      currentUser?.role !== "manager";

    if (module.id === "general") {
      // General records: only show to admin/manager, not to users with only calibrations approval
      return isAdminOrManager;
    }

    if (module.requiresCalibrationsApproval) {
      return (
        currentUser?.labApprovals?.calibrations === true || isAdminOrManager
      );
    }
    return true;
  });

  const handleModuleClick = (module) => {
    setView(module.view);
    setSearchParams({ view: module.view });
  };

  const handleBackClick = () => {
    setView("home");
    setSearchParams({});
  };

  const getHeaderTitle = () => {
    if (view === "general") return "General Records";
    if (view === "laboratory") return "Laboratory Records";
    return "Records";
  };

  return (
    <Box m="20px">
      <Box sx={{ display: "flex", alignItems: "center", mb: { xs: 1, sm: 2 } }}>
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
          sx={{ mt: { xs: 1, sm: 3 }, mb: { xs: 1.5, sm: 2 }, fontWeight: 600 }}
        >
          {getHeaderTitle()}
        </Typography>
      </Box>

      {view === "home" ? (
        <Box sx={{ mt: 1 }}>
          <Grid container spacing={isTablet ? 3 : 4}>
            {availableRecordModules.map((module) => (
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
          {view === "laboratory" &&
          !currentUser?.labApprovals?.calibrations &&
          currentUser?.role !== "admin" &&
          currentUser?.role !== "super_admin" &&
          currentUser?.role !== "manager" ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="h6" color="error" gutterBottom>
                Access Denied
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You do not have permission to access Laboratory Records. Please
                contact an administrator to grant you the Calibrations approval.
              </Typography>
            </Box>
          ) : view === "general" &&
            currentUser?.labApprovals?.calibrations === true &&
            currentUser?.role !== "admin" &&
            currentUser?.role !== "super_admin" &&
            currentUser?.role !== "manager" ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="h6" color="error" gutterBottom>
                Access Denied
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You do not have permission to access General Records. You can
                only access Laboratory Records.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={isTablet ? 3 : 4}>
              {(view === "general"
                ? generalRecordWidgets
                : laboratoryRecordWidgets
              ).map((widget, index) => (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={view === "general" ? 3 : 4}
                  lg={view === "general" ? 3 : 4}
                  key={index}
                >
                  <RecordWidget {...widget} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Records;
