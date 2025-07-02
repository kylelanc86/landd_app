import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
} from "@mui/material";
import {
  Air as AirIcon,
  Science as ScienceIcon,
  Build as BuildIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";

const LaboratoryDashboard = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const laboratoryModules = [
    {
      id: "air-monitoring",
      title: "Air Monitoring",
      description: "Manage air monitoring samples and data",
      icon: <AirIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />,
      path: "/air-monitoring",
      requiredPermission: "fibre.view",
    },
    {
      id: "fibre-id-analysis",
      title: "Fibre ID Analysis",
      description: "Conduct fibre identification and analysis",
      icon: (
        <VisibilityIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />
      ),
      path: "/fibreID",
      requiredPermission: "fibre.view",
    },
    {
      id: "calibrations",
      title: "Calibrations",
      description: "Manage equipment calibrations and maintenance",
      icon: <ScienceIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />,
      path: "/calibrations",
      requiredPermission: "fibre.view",
    },
    {
      id: "laboratory-equipment",
      title: "Laboratory Equipment",
      description: "Manage laboratory equipment and inventory",
      icon: <BuildIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />,
      path: "/laboratory-equipment",
      requiredPermission: "fibre.view",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.path);
  };

  return (
    <PermissionGate requiredPermissions={["fibre.view"]}>
      <Box m="20px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h2"
            color={colors.grey[100]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Laboratory Dashboard
          </Typography>
        </Box>
        <Typography variant="h5" color={colors.secondary[500]}>
          Manage laboratory operations and equipment
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {laboratoryModules.map((module) => (
              <Grid item xs={12} md={6} lg={4} key={module.id}>
                <Card
                  sx={{
                    height: "100%",
                    transition:
                      "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: "0px 8px 25px rgba(0, 0, 0, 0.15)",
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleModuleClick(module)}
                    sx={{ height: "100%", p: 3 }}
                  >
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        p: 0,
                      }}
                    >
                      <Box sx={{ mb: 2 }}>{module.icon}</Box>
                      <Typography
                        variant="h5"
                        color={colors.grey[100]}
                        fontWeight="bold"
                        sx={{ mb: 1 }}
                      >
                        {module.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={colors.grey[300]}
                        sx={{ mb: 2 }}
                      >
                        {module.description}
                      </Typography>
                      <Box
                        sx={{
                          width: "100%",
                          height: 2,
                          backgroundColor: colors.secondary[500],
                          borderRadius: 1,
                        }}
                      />
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

export default LaboratoryDashboard;
