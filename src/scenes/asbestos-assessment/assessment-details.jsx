import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const AssessmentDetails = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Assessment Details
      </Typography>

      {/* Assessment Details Grid */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Assessment Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Job ID:</strong> 12345
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Site Address:</strong> 123 Main St, City
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="body1">
              <strong>Assessor:</strong> John Doe
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => navigate("/asbestos-assessment")}
        >
          Back
        </Button>
      </Box>
    </Box>
  );
};

export default AssessmentDetails;
