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
  Assessment as AssessmentIcon,
  Science as ScienceIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import PermissionGate from "../../components/PermissionGate";

const ClearancesDashboard = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const clearanceModules = [
    {
      id: "asbestos-clearance",
      title: "Asbestos Clearance",
      description: "Conduct asbestos clearance inspections and reports",
      icon: (
        <AssessmentIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />
      ),
      path: "/clearances/asbestos",
      requiredPermission: "asbestos.view",
    },
    {
      id: "lead-clearance",
      title: "Lead Clearance",
      description: "Conduct lead clearance inspections and reports",
      icon: (
        <CheckCircleIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />
      ),
      path: "/clearances/lead",
      requiredPermission: "asbestos.view",
    },
    {
      id: "mould-validation",
      title: "Mould Validation",
      description: "Conduct mould validation inspections and reports",
      icon: <ScienceIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />,
      path: "/clearances/mould",
      requiredPermission: "asbestos.view",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.path);
  };

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h2"
            color={colors.grey[100]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Clearances Dashboard
          </Typography>
        </Box>
        <Typography variant="h5" color={colors.secondary[500]}>
          Manage and conduct various types of clearance inspections
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {clearanceModules.map((module) => (
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

export default ClearancesDashboard;
