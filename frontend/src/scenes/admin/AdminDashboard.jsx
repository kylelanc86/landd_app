import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  useTheme,
} from "@mui/material";
import {
  PeopleOutlined as PeopleIcon,
  Assessment as AssessmentIcon,
  ReceiptOutlined as ReceiptIcon,
  ArrowForward as ArrowForwardIcon,
  Storage as StorageIcon,
  Archive as ArchiveIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { tokens } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import Header from "../../components/Header";

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
      icon: <PeopleIcon />,
      path: "/users",
      requiredPermission: "users.view",
      color: "#1976d2",
    },
    {
      id: "report-templates",
      title: "Report Templates",
      description: "Manage standardised content for different report types",
      icon: <AssessmentIcon />,
      path: "/admin/report-templates",
      requiredPermission: "admin.view",
      color: "#2e7d32",
    },
    {
      id: "invoice-items",
      title: "Invoice Items",
      description: "Manage default invoice items for draft invoices",
      icon: <ReceiptIcon />,
      path: "/admin/invoice-items",
      requiredPermission: "admin.view",
      color: "#ed6c02",
    },
    {
      id: "custom-data-fields",
      title: "Custom Data Fields",
      description:
        "Manage reference data for asbestos removalists, locations, and materials",
      icon: <StorageIcon />,
      path: "/admin/custom-data-fields",
      requiredPermission: "admin.view",
      color: "#9c27b0",
    },
    {
      id: "archived-data",
      title: "Archived Data",
      description: "View and manage archived data across the system",
      icon: <ArchiveIcon />,
      path: "/admin/archived-data",
      requiredPermission: "admin.view",
      color: "#795548",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.path);
  };

  return (
    <PermissionGate requiredPermissions={["admin.view"]}>
      <Box m="20px">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          Admin Dashboard
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Grid container spacing={4}>
            {adminModules.map((module) => (
              <Grid item xs={12} md={4} lg={4} key={module.id}>
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

        {/* Additional Admin Info */}
        {/* <Box
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
        </Box> */}
      </Box>
    </PermissionGate>
  );
};

export default AdminDashboard;
