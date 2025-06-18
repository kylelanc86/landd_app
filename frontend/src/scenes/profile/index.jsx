import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  Grid,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { currentUser, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Initialize form data when currentUser changes
  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        phone: currentUser.phone || "",
      }));
    }
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validate password if it's being changed
      if (formData.password) {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match");
        }
        if (formData.password.length < 6) {
          throw new Error("Password must be at least 6 characters long");
        }
        // Add password complexity validation
        const hasUpperCase = /[A-Z]/.test(formData.password);
        const hasLowerCase = /[a-z]/.test(formData.password);
        const hasNumbers = /\d/.test(formData.password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
          throw new Error(
            "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
          );
        }
      }

      // Update user data
      const updatedUser = {
        ...currentUser,
        phone: formData.phone,
      };

      if (formData.password) {
        updatedUser.password = formData.password;
      }

      await updateUser(updatedUser);
      setSuccess("Profile updated successfully");
      // Clear password fields after successful update
      setFormData((prev) => ({ ...prev, password: "", confirmPassword: "" }));
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Box
      sx={{
        maxWidth: 800,
        mx: "auto",
        p: 3,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 2,
        }}
      >
        <Typography variant="h4" gutterBottom>
          Profile Settings
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

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Profile Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Profile Information
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                value={currentUser?.email || ""}
                disabled
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                variant="outlined"
                autoComplete="off"
              />
            </Grid>
            <Divider sx={{ my: 3 }} />
            {/* Password Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="New Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                variant="outlined"
                autoComplete="new-password"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Confirm New Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                variant="outlined"
                autoComplete="new-password"
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{ mr: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : "Save Changes"}
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 3 }} />
            </Grid>

            {/* Logout Section */}
            <Grid item xs={12}>
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleLogout}
                  size="large"
                  sx={{
                    minWidth: 200,
                    py: 1.5,
                    fontSize: "1.1rem",
                  }}
                >
                  Logout
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default Profile;
