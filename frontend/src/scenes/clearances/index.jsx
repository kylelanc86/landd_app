import React from "react";
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Chip,
} from "@mui/material";
import {
  Assessment as AssessmentIcon,
  Science as ScienceIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import PermissionGate from "../../components/PermissionGate";

const ClearancesDashboard = () => {
  const navigate = useNavigate();

  const clearanceModules = [
    {
      id: "asbestos-clearance",
      title: "Asbestos Clearance",
      description: "Conduct asbestos clearance inspections and reports",
      icon: <AssessmentIcon sx={{ fontSize: 80, color: "white" }} />,
      path: "/clearances/asbestos",
      requiredPermission: "asbestos.view",
      color: "#1976d2",
      chipLabel: "Asbestos",
      isAvailable: true,
    },
    {
      id: "lead-clearance",
      title: "Lead Clearance",
      description: "Conduct lead clearance inspections and reports",
      icon: <CheckCircleIcon sx={{ fontSize: 80, color: "white" }} />,
      path: "/clearances/lead",
      requiredPermission: "asbestos.view",
      color: "#2e7d32",
      chipLabel: "Lead",
      isAvailable: false,
    },
    {
      id: "mould-validation",
      title: "Mould Validation",
      description: "Conduct mould validation inspections and reports",
      icon: <ScienceIcon sx={{ fontSize: 80, color: "white" }} />,
      path: "/clearances/mould",
      requiredPermission: "asbestos.view",
      color: "#ed6c02",
      chipLabel: "Mould",
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
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom marginBottom={4}>
            Clearances Dashboard
          </Typography>

          <Grid container spacing={4}>
            {clearanceModules.map((module) => (
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
                      {module.icon}

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
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2, flexGrow: 1 }}
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
      </Container>
    </PermissionGate>
  );
};

export default ClearancesDashboard;
