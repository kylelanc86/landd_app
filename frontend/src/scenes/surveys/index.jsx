import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Chip,
  useTheme,
  Button,
} from "@mui/material";
import {
  Home as HomeIcon,
  Science as ScienceIcon,
  Assessment as AssessmentIcon,
  ArrowForward as ArrowForwardIcon,
  Business as BusinessIcon,
  Security as SecurityIcon,
  Apartment as ApartmentIcon,
  WaterDrop as WaterDropIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";
import Header from "../../components/Header";

const SurveysDashboard = () => {
  const theme = useTheme();

  const navigate = useNavigate();

  const surveyModules = [
    {
      id: "asbestos-assessment",
      title: "Asbestos Assessment",
      icon: <HomeIcon />,
      path: "/assessments", // changed from /surveys/asbestos
      requiredPermission: "asbestos.view",
      color: "#1976d2",
      isAvailable: true, // Only this one is available
    },
    {
      id: "residential-asbestos-assessment",
      title: "Residential Asbestos Assessment",
      icon: <ApartmentIcon />,
      path: "/surveys/residential-asbestos",
      requiredPermission: "asbestos.view",
      color: "#388e3c",
      isAvailable: false,
    },
    {
      id: "asbestos-management-plan",
      title: "Asbestos Management Plan",
      icon: <BusinessIcon />,
      path: "/surveys/asbestos-management-plan",
      requiredPermission: "asbestos.view",
      color: "#7b1fa2",
      isAvailable: false,
    },
    {
      id: "hazardous-materials-management-plan",
      title: "Hazardous Materials Management Plan",
      icon: <SecurityIcon />,
      path: "/surveys/hazardous-materials-management-plan",
      requiredPermission: "asbestos.view",
      color: "#d32f2f",
      isAvailable: false,
    },
    {
      id: "lead-assessment",
      title: "Lead Assessment",
      icon: <AssessmentIcon />,
      path: "/surveys/lead",
      requiredPermission: "asbestos.view",
      color: "#2e7d32",
      isAvailable: false,
    },
    {
      id: "mould-moisture-assessment",
      title: "Mould & Moisture Assessment",
      icon: <WaterDropIcon />,
      path: "/surveys/mould-moisture",
      requiredPermission: "asbestos.view",
      color: "#ed6c02",
      isAvailable: false,
    },
  ];

  const handleModuleClick = (module) => {
    if (module.isAvailable) {
      navigate(module.path);
    }
  };

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          Surveys
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={4}>
            {surveyModules.map((module) => (
              <Grid item xs={12} md={6} lg={4} key={module.id}>
                <Card
                  sx={{
                    height: "100%",
                    transition: "all 0.3s ease-in-out",
                    "&:hover": module.isAvailable
                      ? {
                          transform: "translateY(-4px)",
                          boxShadow: 4,
                        }
                      : {},
                    position: "relative",
                    opacity: module.isAvailable ? 1 : 0.7,
                  }}
                >
                  <CardActionArea
                    onClick={() => handleModuleClick(module)}
                    disabled={!module.isAvailable}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      cursor: module.isAvailable ? "pointer" : "default",
                    }}
                  >
                    <CardMedia
                      component="div"
                      sx={{
                        height: 200,
                        backgroundColor: module.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                      }}
                    >
                      {React.cloneElement(module.icon, {
                        sx: { fontSize: 80, color: "white" },
                      })}

                      {/* Coming Soon Overlay */}
                      {!module.isAvailable && (
                        <Box
                          sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(0, 0, 0, 0.7)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                          }}
                        >
                          <Typography
                            variant="h6"
                            sx={{
                              color: "white",
                              fontWeight: "bold",
                              textAlign: "center",
                              mb: 1,
                            }}
                          >
                            Coming Soon
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: "white",
                              textAlign: "center",
                              opacity: 0.9,
                            }}
                          >
                            This feature is under development
                          </Typography>
                        </Box>
                      )}
                    </CardMedia>
                    <CardContent
                      sx={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <Typography variant="h5" component="h2" gutterBottom>
                        {module.title}
                      </Typography>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "auto",
                        }}
                      >
                        <Typography
                          variant="body2"
                          color={
                            module.isAvailable ? "primary" : "text.secondary"
                          }
                          sx={{ fontWeight: "bold" }}
                        >
                          {module.isAvailable
                            ? `View ${module.title}`
                            : "Coming Soon"}
                        </Typography>
                        {module.isAvailable && (
                          <ArrowForwardIcon color="primary" />
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </PermissionGate>
  );
};

export default SurveysDashboard;
