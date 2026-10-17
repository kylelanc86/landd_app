import React from "react";
import { Box, Button, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLocation, useNavigate, useParams } from "react-router-dom";

const ProjectSwms = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box m="20px">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() =>
          navigate(`/projects/${id}`, { state: location.state })
        }
        sx={{ mb: 2 }}
      >
        Back to Project
      </Button>
      <Typography variant="h4" gutterBottom>
        SWMS
      </Typography>
      <Typography variant="h5">UNDER CONSTRUCTION</Typography>
    </Box>
  );
};

export default ProjectSwms;
