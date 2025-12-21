import React from "react";
import {
  Box,
  Typography,
  Paper,
  Container,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";

const Feedback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Client Feedback
        </Typography>
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
          <Typography color="text.primary">Client Feedback</Typography>
        </Breadcrumbs>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Feedback Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            This page will contain feedback functionality. Content will be
            implemented shortly.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default Feedback;
