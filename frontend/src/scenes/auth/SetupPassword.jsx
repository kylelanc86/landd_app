import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authService } from "../../services/api";

const SetupPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  useEffect(() => {
    if (!token || !email) {
      setError("Invalid setup link. Please contact your administrator.");
    }
  }, [token, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await authService.setupPassword(token, password, email);

      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Failed to set up password. Please try again or contact support."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }}>
          <Alert severity="error">
            Invalid setup link. Please contact your administrator.
          </Alert>
        </Paper>
      </Box>
    );
  }

  if (success) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }}>
          <Alert severity="success">
            Password set up successfully! Redirecting to login page...
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{ backgroundColor: "#f5f5f5" }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Set Up Your Password
        </Typography>

        <Typography variant="body1" sx={{ mb: 3, textAlign: "center" }}>
          Welcome to L&D Consulting! Please set up your account password.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
            inputProps={{ minLength: 6 }}
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
            inputProps={{ minLength: 6 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: "rgb(25, 138, 44)",
              "&:hover": { backgroundColor: "rgb(20, 110, 35)" },
            }}
          >
            {loading ? <CircularProgress size={24} /> : "Set Password"}
          </Button>
        </form>

        <Typography
          variant="body2"
          sx={{ mt: 2, textAlign: "center", color: "text.secondary" }}
        >
          This link will expire in 24 hours for security reasons.
        </Typography>
      </Paper>
    </Box>
  );
};

export default SetupPassword;
