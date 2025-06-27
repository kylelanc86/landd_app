import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const MouldAssessment = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Mould Assessment
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Mould Assessment
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain mould assessment functionality. Content will
            be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default MouldAssessment;
