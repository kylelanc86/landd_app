import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { tokens } from "../../../../theme";

const PureAsbestos = () => {
  const theme = useTheme();
  const colors = tokens;

  const [formData, setFormData] = useState({
    calibrationDate: "",
    nextCalibrationDate: "",
    certificateNumber: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // TODO: Implement API call to save calibration data
      console.log("Pure Asbestos calibration data:", formData);

      setSuccess("Pure Asbestos calibration data saved successfully!");
      setFormData({
        calibrationDate: "",
        nextCalibrationDate: "",
        certificateNumber: "",
        notes: "",
      });
    } catch (err) {
      setError(err.message || "Failed to save calibration data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.default,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
      }}
    >
      <Typography
        variant="h5"
        sx={{
          mb: 3,
          color: theme.palette.primary.main,
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        Pure Asbestos Calibration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              label="Calibration Date"
              type="date"
              value={formData.calibrationDate}
              onChange={(e) =>
                handleInputChange("calibrationDate", e.target.value)
              }
              fullWidth
              required
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Next Calibration Date"
              type="date"
              value={formData.nextCalibrationDate}
              onChange={(e) =>
                handleInputChange("nextCalibrationDate", e.target.value)
              }
              fullWidth
              required
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Certificate Number"
              value={formData.certificateNumber}
              onChange={(e) =>
                handleInputChange("certificateNumber", e.target.value)
              }
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              fullWidth
              multiline
              rows={4}
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              disabled={
                loading ||
                !formData.calibrationDate ||
                !formData.nextCalibrationDate ||
                !formData.certificateNumber
              }
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.common.white,
                fontSize: "16px",
                fontWeight: "bold",
                padding: "12px 24px",
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
                "&:disabled": {
                  backgroundColor: theme.palette.grey[400],
                },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Save Calibration"
              )}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default PureAsbestos;
