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
import { useNavigate } from "react-router-dom";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HomeIcon from "@mui/icons-material/Home";
import ApartmentIcon from "@mui/icons-material/Apartment";
import BusinessIcon from "@mui/icons-material/Business";
import SecurityIcon from "@mui/icons-material/Security";
import PermissionGate from "../../components/PermissionGate";

const SurveysDashboard = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobileLandscape = useMediaQuery(
    "(orientation: landscape) and (max-height: 500px)"
  );
  const isSimplifiedWidget = isMobile || isMobileLandscape;

  const surveyModules = [
    {
      id: "asbestos-assessment",
      title: "Asbestos Assessment",
      description: "Access asbestos assessment surveys and reports",
      icon: <HomeIcon />,
      color: "#1976d2",
      onClick: () => navigate("/surveys/asbestos-assessment"),
      underDevelopment: false,
    },
    {
      id: "residential-asbestos",
      title: "Residential Asbestos Surveys",
      description: "Access residential asbestos survey records and reports",
      icon: <ApartmentIcon />,
      color: "#2e7d32",
      onClick: () => navigate("/surveys/residential-asbestos"),
      underDevelopment: false,
    },
    {
      id: "commercial-asbestos",
      title: "Commercial Asbestos Surveys",
      description: "Access commercial asbestos survey records and reports",
      icon: <BusinessIcon />,
      color: "#ed6c02",
      onClick: () => navigate("/surveys/commercial-asbestos"),
      underDevelopment: true,
    },
    {
      id: "hazmat",
      title: "HAZMAT Surveys",
      description: "Access hazardous materials survey records and reports",
      icon: <SecurityIcon />,
      color: "#d32f2f",
      onClick: () => navigate("/surveys/hazmat"),
      underDevelopment: true,
    },
  ];

  return (
    <PermissionGate requiredPermissions={["asbestos.view"]}>
      <Box m="20px">
        <Box sx={{ display: "flex", alignItems: "center", mb: { xs: 1, sm: 2 } }}>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ mt: 3, mb: { xs: 2, sm: 4 }, fontWeight: 600 }}
          >
            Surveys
          </Typography>
        </Box>

        <Box sx={{ mt: { xs: 2, sm: 4 } }}>
          {/* Mobile landscape: single row of simplified widgets (matches AdminDashboard) */}
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
              {surveyModules.map((module) => (
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
                    position: "relative",
                    "&:hover": module.underDevelopment
                      ? {}
                      : {
                          transform: "translateY(-2px)",
                          boxShadow:
                            "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
                        },
                  }}
                >
                  {module.underDevelopment && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                        borderRadius: "12px",
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          color: "white",
                          fontWeight: 600,
                          textAlign: "center",
                          textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        }}
                      >
                        Under Development
                      </Typography>
                    </Box>
                  )}
                  <CardActionArea
                    onClick={
                      module.underDevelopment ? undefined : module.onClick
                    }
                    disabled={module.underDevelopment}
                    sx={{
                      height: "100%",
                      minHeight: 160,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      cursor: module.underDevelopment
                        ? "not-allowed"
                        : "pointer",
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
            {surveyModules.map((module) => (
              <Grid item xs={6} sm={3} md={3} lg={3} key={module.id}>
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
                    position: "relative",
                    "&:hover": module.underDevelopment
                      ? {}
                      : {
                          transform: isSimplifiedWidget
                            ? "translateY(-2px)"
                            : "translateY(-4px)",
                          boxShadow:
                            "0 8px 25px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
                        },
                  }}
                >
                  {module.underDevelopment && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                        borderRadius: isSimplifiedWidget ? "12px" : "16px",
                      }}
                    >
                      <Typography
                        variant="h5"
                        sx={{
                          color: "white",
                          fontWeight: 600,
                          textAlign: "center",
                          textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        }}
                      >
                        Under Development
                      </Typography>
                    </Box>
                  )}
                  <CardActionArea
                    onClick={
                      module.underDevelopment ? undefined : module.onClick
                    }
                    disabled={module.underDevelopment}
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      cursor: module.underDevelopment
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    <Box
                      component="div"
                      sx={{
                        height: isSimplifiedWidget ? "100%" : isTablet ? 140 : 180,
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
                          width: isSimplifiedWidget ? 40 : isTablet ? 80 : 100,
                          height: isSimplifiedWidget ? 40 : isTablet ? 80 : 100,
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

export default SurveysDashboard;
