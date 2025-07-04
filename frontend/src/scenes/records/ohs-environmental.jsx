import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const OHSEnvironmental = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          OHS & Environmental Targets & Risks
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            OHS & Environmental Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain OHS & Environmental targets and risks
            functionality. Content will be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default OHSEnvironmental;
