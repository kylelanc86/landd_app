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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "../../services/api";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import WarningIcon from "@mui/icons-material/Warning";

const ResetPassword = () => {
  console.log("ResetPassword component rendering");
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  console.log("URL params extracted - token:", token, "email:", email);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [expiredDialogOpen, setExpiredDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Validate token when component mounts
  useEffect(() => {
    console.log("=== TOKEN VALIDATION START ===");
    console.log("Token:", token);
    console.log("Email:", email);

    const validateToken = async () => {
      try {
        console.log("Starting token validation...");
        setValidatingToken(true);
        await authService.validateResetToken(token, email);
        console.log("Token validation SUCCESS - setting tokenValid to true");
        setTokenValid(true);
      } catch (err) {
        console.error("Token validation FAILED:", err);
        console.log("Error response data:", err.response?.data);
        if (err.response?.data?.expired) {
          console.log("Token is EXPIRED - setting expiredDialogOpen to true");
          setExpiredDialogOpen(true);
        } else {
          console.log("Token is INVALID - setting error");
          setError("Invalid or expired reset token");
        }
      } finally {
        console.log(
          "Token validation complete - setting validatingToken to false"
        );
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [token, email]);

  // Check if token/email are missing immediately
  if (!token || !email) {
    return (
      <>
        <Dialog
          open={true}
          onClose={() => navigate("/login")}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "error.main",
                color: "white",
              }}
            >
              <WarningIcon />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Invalid Link
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              This password reset link is invalid or missing required
              parameters.
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
              Please request a new password reset link from the login page.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => navigate("/login")}
              variant="contained"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Go to Login
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, password, email);
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleExpiredDialogClose = () => {
    setExpiredDialogOpen(false);
    navigate("/login");
  };

  // Show loading while validating token
  if (validatingToken) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "background.default",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "center",
          }}
        >
          <CircularProgress />
          <Typography>Validating reset link...</Typography>
        </Paper>
      </Box>
    );
  }

  if (!token || !email) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "background.default",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Alert severity="error">
            Invalid or missing reset token or email
          </Alert>
          <Button variant="contained" onClick={() => navigate("/login")}>
            Return to Login
          </Button>
        </Paper>
      </Box>
    );
  }

  // Show expired dialog if token validation failed
  console.log("=== RENDER LOGIC ===");
  console.log("validatingToken:", validatingToken);
  console.log("tokenValid:", tokenValid);
  console.log("expiredDialogOpen:", expiredDialogOpen);
  console.log("error:", error);

  if (expiredDialogOpen) {
    console.log("RENDERING: Expired dialog");
    return (
      <>
        {/* Expired Link Dialog - Show immediately if token is invalid */}
        <Dialog
          open={true}
          onClose={handleExpiredDialogClose}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
            },
          }}
        >
          <DialogTitle
            sx={{
              pb: 2,
              px: 3,
              pt: 3,
              border: "none",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "warning.main",
                color: "white",
              }}
            >
              <WarningIcon />
            </Box>
            <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
              Link Expired
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Typography variant="body1" sx={{ color: "text.primary" }}>
              This password reset link has expired. For security reasons, reset
              links are only valid for 1 hour.
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
              Please request a new password reset link from the login page.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={handleExpiredDialogClose}
              variant="contained"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Request New Link
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {/* Only show the form if token is valid */}
      {tokenValid && (
        <Box
          sx={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "background.default",
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              width: "100%",
              maxWidth: 400,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h4" component="h1" align="center" gutterBottom>
              Reset Password
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Password has been reset successfully. Redirecting to login...
              </Alert>
            )}

            {!success && (
              <form onSubmit={handleSubmit}>
                <TextField
                  label="New Password"
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
                <TextField
                  label="Confirm New Password"
                  type={showPassword ? "text" : "password"}
                  fullWidth
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  margin="normal"
                  error={password !== confirmPassword && confirmPassword !== ""}
                  helperText={
                    password !== confirmPassword && confirmPassword !== ""
                      ? "Passwords do not match"
                      : ""
                  }
                />
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={loading || !password || !confirmPassword}
                  sx={{ mt: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : "Reset Password"}
                </Button>
              </form>
            )}
          </Paper>
        </Box>
      )}

      {/* Expired Link Dialog - Always render so it can show when needed */}
      <Dialog
        open={expiredDialogOpen}
        onClose={handleExpiredDialogClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "warning.main",
              color: "white",
            }}
          >
            <WarningIcon />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Link Expired
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            This password reset link has expired. For security reasons, reset
            links are only valid for 1 hour.
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
            Please request a new password reset link from the login page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={handleExpiredDialogClose}
            variant="contained"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Request New Link
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ResetPassword;
