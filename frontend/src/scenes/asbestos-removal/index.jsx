import React, { useState } from "react";
import Header from "../../components/Header";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import AirMonitoring from "../air-monitoring";
import AsbestosClearance from "../clearances/AsbestosClearance";

const AsbestosRemovalWidget = ({
  title,
  icon,
  color = "primary",
  onClick,
  active,
}) => (
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
      ...(active && {
        backgroundColor: `${color}.light`,
        border: `2px solid ${color}.main`,
      }),
    }}
  >
    <CardActionArea
      onClick={onClick}
      sx={{ height: "100%", display: "flex", flexDirection: "column" }}
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
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);

  const asbestosRemovalWidgets = [
    {
      title: "Air Monitoring",
      icon: <MonitorIcon />,
      color: "primary",
      onClick: () => setActiveSection("air-monitoring"),
    },
    {
      title: "Clearances",
      icon: <AssessmentIcon />,
      color: "secondary",
      onClick: () => setActiveSection("clearances"),
    },
  ];

  const renderAirMonitoringSection = () => {
    return <AirMonitoring />;
  };

  const renderClearancesSection = () => {
    return <AsbestosClearance />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Header title="Asbestos Removal Jobs" />


      {/* Service Cards */}
      <Grid container spacing={3}>
        {asbestosRemovalWidgets.map((widget, index) => (
          <Grid item xs={12} md={6} key={index}>
            <AsbestosRemovalWidget
              {...widget}
              active={
                activeSection ===
                (widget.title === "Air Monitoring"
                  ? "air-monitoring"
                  : "clearances")
              }
            />
          </Grid>
        ))}
      </Grid>

      {/* Content Sections */}
      {activeSection === "air-monitoring" && renderAirMonitoringSection()}
      {activeSection === "clearances" && renderClearancesSection()}
    </Box>
  );
};

export default AsbestosRemoval;
