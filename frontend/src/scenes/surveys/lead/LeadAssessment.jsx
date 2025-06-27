import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../../components/Header";

const LeadAssessment = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Header title="Lead Assessment" subtitle="Manage lead assessment jobs" />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <Typography variant="h6" color="text.secondary">
          Lead Assessment functionality coming soon...
        </Typography>
      </Box>
    </Box>
  );
};

export default LeadAssessment;