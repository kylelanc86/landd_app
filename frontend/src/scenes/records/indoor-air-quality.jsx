import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const IndoorAirQuality = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Indoor Air Quality
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Indoor Air Quality Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain indoor air quality functionality. Content
            will be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default IndoorAirQuality;
