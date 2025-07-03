import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { authService } from "../../services/api";
import { grey } from "@mui/material/colors";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const navigate = useNavigate();
  const { login, currentUser, loading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) {
      console.log("User logged in, redirecting to home");
      navigate("/");
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      console.log("Login component: Attempting login");
      const result = await login({ email, password });
      console.log("Login component: Login successful", result);
      // Navigation will be handled by the useEffect above
    } catch (err) {
      console.error("Login component: Login error details:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        stack: err.stack,
      });
      setError(err.response?.data?.message || err.message || "Failed to login");
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotPasswordError("");
    setForgotPasswordSuccess(false);
    setForgotPasswordLoading(true);

    try {
      await authService.forgotPassword(forgotPasswordEmail);
      setForgotPasswordSuccess(true);
      setForgotPasswordEmail("");
    } catch (err) {
      setForgotPasswordError(
        err.response?.data?.message ||
          err.message ||
          "Failed to send reset email"
      );
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: grey[600],
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)", // Dark overlay for better text readability
          zIndex: 1,
        },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          width: "70%",
          maxWidth: 800,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          position: "relative",
          zIndex: 2,
          backgroundColor: "rgba(0, 0, 0, 0.95)", // Slightly transparent white
          backdropFilter: "blur(10px)", // Glass effect
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <img
            src="/logo.png"
            alt="Company Logo"
            style={{
              maxWidth: "400px",
              height: "auto",
            }}
          />
        </Box>
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            margin="normal"
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            margin="normal"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : "Login"}
          </Button>
        </form>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 2 }}
        >
          <Link
            component="button"
            variant="body2"
            onClick={() => setForgotPasswordOpen(true)}
            sx={{ textDecoration: "none" }}
          >
            Forgot Password?
          </Link>
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 2 }}
        >
          Contact admin{" "}
          <Link href="mailto:kylelanc86@gmail.com" color="primary">
            here
          </Link>
        </Typography>
      </Paper>

      {/* Forgot Password Dialog */}
      <Dialog
        open={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
      >
        <DialogTitle>Reset Password</DialogTitle>
        <DialogContent>
          {forgotPasswordSuccess ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              If an account exists with that email, you will receive password
              reset instructions.
            </Alert>
          ) : (
            <form onSubmit={handleForgotPassword}>
              <TextField
                autoFocus
                margin="dense"
                label="Email Address"
                type="email"
                fullWidth
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                sx={{ mt: 2 }}
              />
              {forgotPasswordError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {forgotPasswordError}
                </Alert>
              )}
            </form>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForgotPasswordOpen(false)}>
            {forgotPasswordSuccess ? "Close" : "Cancel"}
          </Button>
          {!forgotPasswordSuccess && (
            <Button
              onClick={handleForgotPassword}
              disabled={forgotPasswordLoading || !forgotPasswordEmail}
            >
              {forgotPasswordLoading ? (
                <CircularProgress size={24} />
              ) : (
                "Send Reset Link"
              )}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Login;
