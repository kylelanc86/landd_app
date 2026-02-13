import React from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery,
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
import PermissionGate from "../../components/PermissionGate";

const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // Mobile in landscape: short height, show simplified widgets in a single row
  const isMobileLandscape = useMediaQuery(
    "(orientation: landscape) and (max-height: 500px)",
  );
  const isSimplifiedWidget = isMobile || isMobileLandscape;

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
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ mt: 3, mb: 4, fontWeight: 600 }}
        >
          Admin Dashboard
        </Typography>
        <Box sx={{ mt: 4 }}>
          {/* Mobile landscape: single row of simplified widgets filling full width */}
          {isMobileLandscape ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "nowrap",
                gap: 2,
                width: "100%",
              }}
            >
              {adminModules.map((module) => (
                <Card
                  key={module.id}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 160,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    borderRadius: "12px",
                    boxShadow:
                      "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow:
                        "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => handleModuleClick(module)}
                    sx={{
                      height: "100%",
                      minHeight: 160,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                    }}
                  >
                    <Box
                      component="div"
                      sx={{
                        height: "100%",
                        minHeight: 160,
                        background: `linear-gradient(135deg, ${module.color}15 0%, ${module.color}08 100%)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "16px",
                        "&:hover": {
                          background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}12 100%)`,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}10 100%)`,
                          border: `2px solid ${module.color}30`,
                          boxShadow: `0 4px 20px ${module.color}20`,
                          flexShrink: 0,
                        }}
                      >
                        {React.cloneElement(module.icon, {
                          sx: {
                            fontSize: 28,
                            color: module.color,
                            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                          },
                        })}
                      </Box>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          mt: 1.5,
                          fontWeight: 600,
                          color: "#1a1a1a",
                          textAlign: "center",
                          lineHeight: 1.2,
                          fontSize: "0.8rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {module.title}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          ) : (
            <Grid container spacing={isMobile ? 2 : isTablet ? 3 : 4}>
              {adminModules.map((module) => (
                <Grid item xs={12} sm={6} md={4} lg={4} key={module.id}>
                  <Card
                    sx={{
                      height: "100%",
                      minHeight: isSimplifiedWidget
                        ? "120px"
                        : isTablet
                          ? "280px"
                          : "320px",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      overflow: "hidden",
                      borderRadius: isSimplifiedWidget ? "12px" : "16px",
                      boxShadow:
                        "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
                      border: "1px solid rgba(0,0,0,0.05)",
                      "&:hover": {
                        transform: isSimplifiedWidget
                          ? "translateY(-2px)"
                          : "translateY(-4px)",
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
                          height: isSimplifiedWidget
                            ? "100%"
                            : isTablet
                              ? 140
                              : 180,
                          minHeight: isSimplifiedWidget ? 120 : undefined,
                          background: `linear-gradient(135deg, ${module.color}15 0%, ${module.color}08 100%)`,
                          borderBottom: isSimplifiedWidget
                            ? "none"
                            : `2px solid ${module.color}30`,
                          display: "flex",
                          flexDirection: isSimplifiedWidget ? "column" : "row",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                          padding: isSimplifiedWidget
                            ? "12px"
                            : isTablet
                              ? "20px"
                              : "24px",
                          transition: "all 0.3s ease-in-out",
                          "&:hover": {
                            background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}12 100%)`,
                            borderBottom: isSimplifiedWidget
                              ? "none"
                              : `2px solid ${module.color}40`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: isSimplifiedWidget
                              ? 40
                              : isTablet
                                ? 80
                                : 100,
                            height: isSimplifiedWidget
                              ? 40
                              : isTablet
                                ? 80
                                : 100,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}10 100%)`,
                            border: `2px solid ${module.color}30`,
                            boxShadow: `0 4px 20px ${module.color}20, 0 2px 8px ${module.color}15`,
                            transition: "all 0.3s ease-in-out",
                            flexShrink: 0,
                          }}
                        >
                          {React.cloneElement(module.icon, {
                            sx: {
                              fontSize: isSimplifiedWidget
                                ? 24
                                : isTablet
                                  ? 48
                                  : 60,
                              color: module.color,
                              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                            },
                          })}
                        </Box>
                        {isSimplifiedWidget && (
                          <Typography
                            variant="subtitle2"
                            sx={{
                              mt: 1,
                              fontWeight: 600,
                              color: "#1a1a1a",
                              textAlign: "center",
                              lineHeight: 1.2,
                              fontSize: "0.75rem",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {module.title}
                          </Typography>
                        )}
                      </Box>
                      {!isSimplifiedWidget && (
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
                      )}
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>
    </PermissionGate>
  );
};

export default AdminDashboard;
