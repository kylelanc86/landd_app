import React from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
import ScienceIcon from "@mui/icons-material/Science";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import BusinessIcon from "@mui/icons-material/Business";

const LaboratoryServices = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const laboratoryModules = [
    {
      id: "client-supplied",
      title: "Client Supplied",
      description:
        "Manage and analyse client-supplied samples for fibre identification and fibre count analysis",
      icon: <ContactsOutlinedIcon />,
      color: "#1976d2",
      route: "/client-supplied",
    },
    {
      id: "ld-supplied",
      title: "L&D Supplied",
      description:
        "Manage and analyse L&D supplied samples for laboratory services",
      icon: <BusinessIcon />,
      color: "#2e7d32",
      route: "/laboratory-services/ld-supplied",
    },
  ];

  const handleModuleClick = (module) => {
    navigate(module.route);
  };

  return (
    <Box m="20px">
      <Typography
        variant="h3"
        component="h1"
        gutterBottom
        sx={{ mt: 3, mb: 4, fontWeight: 600 }}
      >
        Laboratory Services
      </Typography>

      <Box sx={{ mt: 4 }}>
        <Grid container spacing={isTablet ? 3 : 4}>
          {laboratoryModules.map((module) => (
            <Grid item xs={12} sm={6} md={6} lg={6} key={module.id}>
              <Card
                sx={{
                  height: "100%",
                  minHeight: isTablet ? "280px" : "320px",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  overflow: "hidden",
                  borderRadius: "16px",
                  boxShadow:
                    "0 4px 20px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
                  border: "1px solid rgba(0,0,0,0.05)",
                  "&:hover": {
                    transform: "translateY(-4px)",
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
                      height: isTablet ? 140 : 180,
                      background: `linear-gradient(135deg, ${module.color}15 0%, ${module.color}08 100%)`,
                      borderBottom: `2px solid ${module.color}30`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      padding: isTablet ? "20px" : "24px",
                      transition: "all 0.3s ease-in-out",
                      "&:hover": {
                        background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}12 100%)`,
                        borderBottom: `2px solid ${module.color}40`,
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: isTablet ? 80 : 100,
                        height: isTablet ? 80 : 100,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${module.color}20 0%, ${module.color}10 100%)`,
                        border: `2px solid ${module.color}30`,
                        boxShadow: `0 4px 20px ${module.color}20, 0 2px 8px ${module.color}15`,
                        transition: "all 0.3s ease-in-out",
                      }}
                    >
                      {React.cloneElement(module.icon, {
                        sx: {
                          fontSize: isTablet ? 48 : 60,
                          color: module.color,
                          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                        },
                      })}
                    </Box>
                  </Box>
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
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default LaboratoryServices;
