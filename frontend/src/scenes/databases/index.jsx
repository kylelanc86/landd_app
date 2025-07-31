import React, { useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  CardMedia,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import performanceMonitor from "../../utils/performanceMonitor";

const Databases = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.startPageLoad("databases-page");

    return () => {
      performanceMonitor.endPageLoad("databases-page");
    };
  }, []);

  const handleDatabaseClick = (database) => {
    performanceMonitor.startTimer(`database-navigation-${database}`);
    // Navigate to the individual page
    navigate(`/${database}`);
    performanceMonitor.endTimer(`database-navigation-${database}`);
  };

  const databaseModules = [
    {
      id: "projects",
      title: "Projects",
      icon: <AssignmentIcon />,
      path: "/projects",
      color: "#1976d2",
      description: "Manage and track all projects",
    },
    {
      id: "clients",
      title: "Clients",
      icon: <PeopleIcon />,
      path: "/clients",
      color: "#388e3c",
      description: "Manage client information and contacts",
    },
    {
      id: "invoices",
      title: "Invoices",
      icon: <ReceiptOutlinedIcon />,
      path: "/invoices",
      color: "#7b1fa2",
      description: "Create and manage invoices",
    },
  ];

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Databases
      </Typography>
      <Box sx={{ mt: 4 }}>
        <Grid container spacing={4}>
          {databaseModules.map((module) => (
            <Grid item xs={12} md={6} lg={4} key={module.id}>
              <Card
                sx={{
                  height: "100%",
                  transition: "all 0.3s ease-in-out",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                  position: "relative",
                }}
              >
                <CardActionArea
                  onClick={() => handleDatabaseClick(module.id)}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    cursor: "pointer",
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
  );
};

export default Databases;
