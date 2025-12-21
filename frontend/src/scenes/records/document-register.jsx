import React from "react";
import { Box, Typography, Paper, Breadcrumbs, Link } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const DocumentRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  return (
    <Box m="20px">
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        {" "}
        DOCUMENT REGISTER{" "}
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
            General Records
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
