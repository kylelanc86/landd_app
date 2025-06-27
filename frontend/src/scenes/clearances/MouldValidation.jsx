import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import Header from "../../components/Header";

const MouldValidation = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Header
        title="Mould Validation"
        subtitle="Manage mould validation jobs"
      />
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="60vh"
      >
        <Typography variant="h6" color="text.secondary">
          Mould Validation functionality coming soon...
        </Typography>
      </Box>
    </Box>
  );
};

export default MouldValidation;
