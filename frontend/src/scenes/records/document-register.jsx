import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const DocumentRegister = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Document Register
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Document Register Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain document register functionality. Content will
            be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default DocumentRegister;
