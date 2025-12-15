import React from "react";
import { Box, Typography, Paper, Breadcrumbs, Link } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const ApprovedSuppliers = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/records");
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        {" "}
        APPROVED SUPPLIERS{" "}
      </Typography>
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
