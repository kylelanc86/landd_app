import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";

const ApprovedSuppliers = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Approved Suppliers
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Approved Suppliers Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain approved suppliers functionality. Content
            will be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default ApprovedSuppliers;
