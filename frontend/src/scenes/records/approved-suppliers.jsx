import React from "react";
import { Box, Typography, Paper, Breadcrumbs, Link } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import Header from "../../components/Header";

const ApprovedSuppliers = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/records");
  };

  return (
    <Box m="20px">
      <Header
        title="APPROVED SUPPLIERS"
        subtitle="Manage approved supplier records"
      />
      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Records Home
          </Link>
          <Typography color="text.primary">
            Approved Suppliers Records
          </Typography>
        </Breadcrumbs>

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
    </Box>
  );
};

export default ApprovedSuppliers;
