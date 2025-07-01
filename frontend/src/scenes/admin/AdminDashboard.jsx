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
  PeopleOutlined as PeopleIcon,
  Assessment as AssessmentIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";

const AdminDashboard = () => {
  const theme = useTheme();
  const colors = tokens;
  const { user } = useAuth();
  const navigate = useNavigate();

  const adminModules = [
    {
      id: "users",
      title: "User Management",
      description: "Manage user accounts, roles, and permissions",
      icon: <PeopleIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />,
      path: "/users",
      requiredPermission: "users.view",
    },
    {
      id: "report-templates",
      title: "Report Templates",
      description: "Manage standardized content for different report types",
      icon: (
        <AssessmentIcon sx={{ fontSize: 40, color: colors.secondary[500] }} />
      ),
      path: "/admin/report-templates",
      requiredPermission: "admin.view",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.path);
  };

  return (
    <PermissionGate requiredPermissions={["admin.view"]}>
      <Box m="20px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h2"
            color={colors.grey[100]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Admin Dashboard
          </Typography>
        </Box>
        <Typography variant="h5" color={colors.secondary[500]}>
          Manage system settings and configurations
        </Typography>

        <Box sx={{ mt: 4 }}>
          <Grid container spacing={3}>
            {adminModules.map((module) => (
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

        {/* Additional Admin Info */}
        <Box
          sx={{
            mt: 6,
            p: 3,
            backgroundColor: colors.grey[800],
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" color={colors.grey[100]} sx={{ mb: 2 }}>
            Admin Information
          </Typography>
          <Typography variant="body2" color={colors.grey[300]} sx={{ mb: 1 }}>
            <strong>Current User:</strong> {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="body2" color={colors.grey[300]} sx={{ mb: 1 }}>
            <strong>Role:</strong> {user?.role || "User"}
          </Typography>
          <Typography variant="body2" color={colors.grey[300]}>
            <strong>Permissions:</strong> Admin access granted
          </Typography>
        </Box>
      </Box>
    </PermissionGate>
  );
};

export default AdminDashboard;
