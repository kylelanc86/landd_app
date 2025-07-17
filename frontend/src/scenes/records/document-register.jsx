import React from "react";
import { Box, Typography, Paper, Breadcrumbs, Link } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import Header from "../../components/Header";

const DocumentRegister = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/records");
  };

  return (
    <Box m="20px">
      <Header title="DOCUMENT REGISTER" subtitle="Manage document records and registrations" />
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
          <Typography color="text.primary">Document Register</Typography>
        </Breadcrumbs>

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
    </Box>
  );
};

export default DocumentRegister;
