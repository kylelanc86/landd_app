import React, { useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import performanceMonitor from "../../utils/performanceMonitor";



const DatabaseWidget = ({
  title,
  icon,
  onClick,
  color = "primary",
  isActive = false,
}) => (
  <Card
    sx={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      transition: "all 0.3s ease",
      backgroundColor: isActive ? `${color}.light` : "background.paper",
      border: isActive ? `3px solid ${color}.main` : "2px solid transparent",
      boxShadow: isActive
        ? `0 6px 20px ${color}.main`
        : "0 2px 8px rgba(0, 0, 0, 0.1)",
      "&:hover": {
        transform: isActive ? "none" : "translateY(-4px)",
        boxShadow: isActive ? `0 6px 20px ${color}.main` : 4,
      },
    }}
  >
    <CardActionArea
      onClick={onClick}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <CardContent sx={{ flexGrow: 1, textAlign: "center", p: 1 }}>
        <Box sx={{ m: 1, display: "flex", justifyContent: "center" }}>
          {React.cloneElement(icon, {
            sx: {
              fontSize: 30,
              color: isActive ? `${color}.dark` : `${color}.main`,
            },
          })}
        </Box>
        <Typography
          fontSize={22}
          fontWeight={"bold"}
          component="h2"
          gutterBottom
          sx={{
            color: isActive ? `${color}.dark` : "text.primary",
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {title}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const Databases = () => {
  const navigate = useNavigate();

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

  const databaseWidgets = [
    {
      title: "PROJECTS",
      icon: <AssignmentIcon />,
      color: "primary",
      onClick: () => handleDatabaseClick("projects"),
    },
    {
      title: "CLIENTS",
      icon: <PeopleIcon />,
      color: "primary",
      onClick: () => handleDatabaseClick("clients"),
    },
    {
      title: "INVOICES",
      icon: <ReceiptOutlinedIcon />,
      color: "primary",
      onClick: () => handleDatabaseClick("invoices"),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Widgets Section */}
      <Box
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "8px",
          boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
          p: 3,
          mb: 3,
        }}
      >
        <Grid container spacing={3}>
          {databaseWidgets.map((widget, index) => (
            <Grid item xs={12} md={4} key={index}>
              <DatabaseWidget {...widget} isActive={false} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};

export default Databases;
