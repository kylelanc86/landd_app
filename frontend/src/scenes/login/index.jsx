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
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [step, setStep] = useState("password");
  const [loginCode, setLoginCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const navigate = useNavigate();
  const { login, verifyLoginCode, currentUser } = useAuth();

  // Check for session invalidation message from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get("message");

    if (message === "session_invalidated") {
      setError(
        "Your session has been invalidated due to a password change. Please log in again with your new password."
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (message === "session_expired") {
      setError("Your session has expired. Please log in again.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

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
    setInfo("");
    setSubmitting(true);

    try {
      const result = await login({ email, password });
      if (result?.requiresTwoFactor) {
        if (result.email) {
          setEmail(result.email);
        }
        setChallengeToken(result.challengeToken);
        setLoginCode("");
        setStep("code");
        setResendSeconds(30);
        setInfo("A 4-digit code has been sent to your email.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to login");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await verifyLoginCode({
        email,
        code: loginCode,
        challengeToken,
      });
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to verify code";
      setError(message);
      if (/Please log in again/i.test(message)) {
        setStep("password");
        setChallengeToken("");
        setLoginCode("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setSubmitting(true);

    try {
      await authService.resendLoginCode({ email, challengeToken });
      setInfo("A new 4-digit code has been sent to your email.");
      setLoginCode("");
      setResendSeconds(30);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to resend code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToPassword = () => {
    setStep("password");
    setLoginCode("");
    setChallengeToken("");
    setError("");
    setInfo("");
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
          {step === "code" ? "Check your email" : "Login"}
        </Typography>

        {info && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {info}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === "code" ? (
          <form onSubmit={handleVerifyCode}>
            <Typography variant="body2" color="text.secondary" align="center">
              Enter the 4-digit code sent to {email}.
            </Typography>
            <TextField
              label="Login code"
              type="text"
              fullWidth
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              autoFocus
              margin="normal"
              inputProps={{
                inputMode: "numeric",
                autoComplete: "one-time-code",
                maxLength: 4,
                pattern: "[0-9]*",
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={submitting || loginCode.length !== 4}
              sx={{ mt: 2 }}
            >
              {submitting ? <CircularProgress size={24} /> : "Verify code"}
            </Button>
            <Button
              type="button"
              variant="text"
              fullWidth
              disabled={submitting || resendSeconds > 0}
              onClick={handleResendCode}
              sx={{ mt: 1 }}
            >
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend code"}
            </Button>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
              <Link
                component="button"
                variant="body2"
                onClick={handleBackToPassword}
                sx={{ textDecoration: "none" }}
              >
                Back to login
              </Link>
            </Typography>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <TextField
                label=""
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                margin="normal"
              />
              <TextField
                label=""
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
                disabled={submitting}
                sx={{ mt: 2 }}
              >
                {submitting ? "Sending code..." : "Login"}
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
          </>
        )}

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
