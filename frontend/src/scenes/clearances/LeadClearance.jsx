import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";

const LeadClearance = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Header title="Lead Clearance" subtitle="Manage lead clearance jobs" />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <Typography variant="h6" color="text.secondary">
          Lead Clearance functionality coming soon...
        </Typography>
      </Box>
    </Box>
  );
};

export default LeadClearance;
