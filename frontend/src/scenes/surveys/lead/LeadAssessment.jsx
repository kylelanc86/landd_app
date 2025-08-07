import React from "react";
import { Box, Typography } from "@mui/material";

const LeadAssessment = () => {
  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        {" "}
        Lead Assessment{" "}
      </Typography>
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
