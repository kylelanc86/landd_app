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
      description: "Conduct asbestos surveys and assessments",
      icon: <HomeIcon />,
      path: "/assessments", // changed from /surveys/asbestos
      requiredPermission: "asbestos.view",
      color: "#1976d2",
      chipLabel: "Assessment",
    },
    {
      id: "lead-assessment",
      title: "Lead Assessment",
      description: "Conduct lead paint surveys and assessments",
      icon: <AssessmentIcon />,
      path: "/surveys/lead",
      requiredPermission: "asbestos.view",
      color: "#2e7d32",
      chipLabel: "Lead",
    },
    {
      id: "mould-assessment",
      title: "Mould Assessment",
      description: "Conduct mould surveys and assessments",
      icon: <ScienceIcon />,
      path: "/surveys/mould",
      requiredPermission: "asbestos.view",
      color: "#ed6c02",
      chipLabel: "Mould",
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
                        position: "relative",
                      }}
                    >
                      {React.cloneElement(module.icon, {
                        sx: { fontSize: 80, color: "white" },
                      })}
                      <Chip
                        label={module.chipLabel}
                        sx={{
                          position: "absolute",
                          top: 16,
                          right: 16,
                          backgroundColor: "rgba(255,255,255,0.9)",
                          fontWeight: "bold",
                        }}
                      />
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
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {module.description}
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
