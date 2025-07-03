import React, { useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";

// Import components for inline display
import AirMonitoring from "../air-monitoring";
import AsbestosClearance from "../clearances/AsbestosClearanceList";

const AsbestosRemovalWidget = ({ title, icon, onClick, color = "primary" }) => (
  <Card
    sx={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      transition: "transform 0.2s, box-shadow 0.2s",
      "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: 4,
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
      <CardContent sx={{ flexGrow: 1, textAlign: "center", p: 3 }}>
        <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
          {React.cloneElement(icon, {
            sx: { fontSize: 48, color: `${color}.main` },
          })}
        </Box>
        <Typography variant="h6" component="h2" gutterBottom>
          {title}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const AsbestosRemoval = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedSection, setSelectedSection] = useState(null);

  const asbestosRemovalWidgets = [
    {
      title: "Air Monitoring",
      icon: <MonitorIcon />,
      color: "primary",
      onClick: () => setSelectedSection("air-monitoring"),
    },
    {
      title: "Clearances",
      icon: <AssessmentIcon />,
      color: "secondary",
      onClick: () => setSelectedSection("clearances"),
    },
  ];

  const renderSelectedContent = () => {
    switch (selectedSection) {
      case "air-monitoring":
        return <AirMonitoring />;
      case "clearances":
        return <AsbestosClearance />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Asbestos Removal
      </Typography>

      <Grid container spacing={3}>
        {asbestosRemovalWidgets.map((widget, index) => (
          <Grid item xs={12} md={6} key={index}>
            <AsbestosRemovalWidget {...widget} />
          </Grid>
        ))}
      </Grid>

      {selectedSection && <Box sx={{ mt: 4 }}>{renderSelectedContent()}</Box>}
    </Box>
  );
};

export default AsbestosRemoval;
