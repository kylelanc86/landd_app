import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const Incidents = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Incidents & Non-conformances
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Incidents & Non-conformances Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain incidents and non-conformances functionality. Content will
            be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Incidents; 