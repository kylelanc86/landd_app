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
    },
    {
      id: "residential-asbestos-assessment",
      title: "Residential Asbestos Assessment",
      icon: <ApartmentIcon />,
      path: "/surveys/residential-asbestos",
      requiredPermission: "asbestos.view",
      color: "#388e3c",
    },
    {
      id: "asbestos-management-plan",
      title: "Asbestos Management Plan",
      icon: <BusinessIcon />,
      path: "/surveys/asbestos-management-plan",
      requiredPermission: "asbestos.view",
      color: "#7b1fa2",
    },
    {
      id: "hazardous-materials-management-plan",
      title: "Hazardous Materials Management Plan",
      icon: <SecurityIcon />,
      path: "/surveys/hazardous-materials-management-plan",
      requiredPermission: "asbestos.view",
      color: "#d32f2f",
    },
    {
      id: "lead-assessment",
      title: "Lead Assessment",
      icon: <AssessmentIcon />,
      path: "/surveys/lead",
      requiredPermission: "asbestos.view",
      color: "#2e7d32",
    },
    {
      id: "mould-moisture-assessment",
      title: "Mould & Moisture Assessment",
      icon: <WaterDropIcon />,
      path: "/surveys/mould-moisture",
      requiredPermission: "asbestos.view",
      color: "#ed6c02",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.path);
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
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 4,
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
                    <CardMedia
                      component="div"
                      sx={{
                        height: 200,
                        backgroundColor: module.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {React.cloneElement(module.icon, {
                        sx: { fontSize: 80, color: "white" },
                      })}
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
                          color="primary"
                          sx={{ fontWeight: "bold" }}
                        >
                          View {module.title}
                        </Typography>
                        <ArrowForwardIcon color="primary" />
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
