import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../../components/Header";

const AsbestosAssessment = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Header title="Asbestos Assessment" subtitle="Manage asbestos assessment jobs" />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <Typography variant="h6" color="text.secondary">
          Asbestos Assessment functionality coming soon...
        </Typography>
      </Box>
    </Box>
  );
};

export default AsbestosAssessment;
