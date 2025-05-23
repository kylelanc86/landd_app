import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(email);
      setSuccess(true);
      setError("");
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Typography component="h1" variant="h5">
            Reset Password
          </Typography>
          {success ? (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Typography color="success.main">
                Password reset email sent! Please check your inbox.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                sx={{ mt: 3 }}
                onClick={() => navigate("/login")}
              >
                Back to Login
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {error && (
                <Typography color="error" sx={{ mt: 2 }}>
                  {error}
                </Typography>
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
              >
                Send Reset Link
              </Button>
              <Button
                fullWidth
                variant="text"
                onClick={() => navigate("/login")}
              >
                Back to Login
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;
