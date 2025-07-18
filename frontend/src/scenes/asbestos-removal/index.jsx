import React from "react";
import Header from "../../components/Header";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  CardMedia,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MonitorIcon from "@mui/icons-material/Monitor";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";

const AsbestosRemovalWidget = ({
  title,
  icon,
  color = "#1976d2",
  chipLabel,
  onClick,
}) => (
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
      onClick={onClick}
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
          backgroundColor: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {React.cloneElement(icon, {
          sx: { fontSize: 80, color: "white" },
        })}
        <Chip
          label={chipLabel}
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            backgroundColor: "rgba(255,255,255,0.9)",
            fontWeight: "bold",
          }}
        />
      </CardMedia>
      <CardContent
        sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
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
            View {title}
          </Typography>
          <ArrowForwardIcon color="primary" />
        </Box>
      </CardContent>
    </CardActionArea>
  </Card>
);

const AsbestosRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const asbestosRemovalWidgets = [
    {
      title: "Air Monitoring",
      icon: <MonitorIcon />,
      color: "#1976d2",
      chipLabel: "Monitoring",
      onClick: () => navigate("/air-monitoring"),
    },
    {
      title: "Clearances",
      icon: <AssessmentIcon />,
      color: "#2e7d32",
      chipLabel: "Clearance",
      onClick: () => navigate("/clearances"),
    },
  ];

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Asbestos Removal
      </Typography>

      {/* Service Cards */}
      <Grid container spacing={4}>
        {asbestosRemovalWidgets.map((widget, index) => (
          <Grid item xs={12} md={6} key={index}>
            <AsbestosRemovalWidget
              {...widget}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AsbestosRemoval;
