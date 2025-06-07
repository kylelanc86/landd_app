import React from "react";
import { Box, Typography } from "@mui/material";
import Header from "../../../components/Header";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

const CalibrationsPage = () => {
  return (
    <Box m="20px" position="relative" height="100%">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header
          title="FIBRE CALIBRATIONS"
          subtitle="Manage fibre calibration records"
        />
      </Box>

      {/* Under Construction Watermark */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 99999,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            opacity: 0.3,
            userSelect: "none",
            transform: "rotate(-45deg)",
            width: "100%",
            maxWidth: "800px",
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 120, color: "orange", mb: 2 }} />
          <Typography
            variant="h1"
            sx={{
              color: "orange",
              fontSize: "4rem",
              fontWeight: 900,
              textShadow: "2px 2px 4px rgba(0, 0, 0, 0.2)",
              textAlign: "center",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              lineHeight: 1.2,
            }}
          >
            Under Construction
          </Typography>
        </Box>
      </Box>

      {/* Interaction Blocker */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.1)",
          zIndex: 99998,
          cursor: "not-allowed",
        }}
      />

      {/* Page Content */}
      <Box mt="20px">
        <Typography variant="h4">Fibre Calibrations Content</Typography>
      </Box>
    </Box>
  );
};

export default CalibrationsPage;
