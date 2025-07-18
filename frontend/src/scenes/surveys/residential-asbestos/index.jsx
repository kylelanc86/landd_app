import React from "react";
import {
  Box,
  Typography,
  Paper,
  Container,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const ResidentialAsbestosAssessment = () => {
  const navigate = useNavigate();

  const handleBackToSurveys = () => {
    navigate("/surveys");
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Residential Asbestos Assessment
        </Typography>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToSurveys}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Surveys Home
          </Link>
          <Typography color="text.primary">
            Residential Asbestos Assessment
          </Typography>
        </Breadcrumbs>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Residential Asbestos Assessment Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain residential asbestos assessment
            functionality. Content will be implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResidentialAsbestosAssessment;
