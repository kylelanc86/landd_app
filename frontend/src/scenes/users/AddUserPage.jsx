import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Stack,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Paper,
  Breadcrumbs,
  Link,
  Checkbox,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { USER_LEVELS } from "../../data/userData";
import { userService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import {
  validateSignatureFile,
  compressSignatureImage,
} from "../../utils/signatureUtils";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "employee",
  isActive: true,
  licences: [],
  signature: "",
  workingHours: {
    monday: { enabled: false, hours: 0 },
    tuesday: { enabled: false, hours: 0 },
    wednesday: { enabled: false, hours: 0 },
    thursday: { enabled: false, hours: 0 },
    friday: { enabled: false, hours: 0 },
    saturday: { enabled: false, hours: 0 },
    sunday: { enabled: false, hours: 0 },
  },
  labApprovals: {
    fibreCounting: false,
    fibreIdentification: false,
  },
};

const AddUserPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleWorkingHoursChange = (day, field, value) => {
    setForm({
      ...form,
      workingHours: {
        ...form.workingHours,
        [day]: {
          ...form.workingHours[day],
          [field]: field === "enabled" ? value : parseFloat(value) || 0,
        },
      },
    });
  };

  const handleLabApprovalsChange = (field, value) => {
    setForm({
      ...form,
      labApprovals: {
        ...form.labApprovals,
        [field]: value,
      },
    });
  };

  const handleLaaLicenceChange = (index, field, value) => {
    const updatedLicences = [...form.licences];
    updatedLicences[index] = {
      ...updatedLicences[index],
      [field]: value,
    };
    setForm({ ...form, licences: updatedLicences });
  };

  const addLaaLicence = () => {
    setForm({
      ...form,
      licences: [
        ...form.licences,
        { licenceType: "", state: "", licenceNumber: "" },
      ],
    });
  };

  const removeLaaLicence = (index) => {
    const updatedLicences = form.licences.filter((_, i) => i !== index);
    setForm({ ...form, licences: updatedLicences });
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Validate the file
      const validationResult = await validateSignatureFile(file);
      if (!validationResult.isValid) {
        alert(validationResult.error);
        return;
      }

      // Compress the image
      const compressedImage = await compressSignatureImage(file);
      setForm({ ...form, signature: compressedImage });
    } catch (error) {
      console.error("Error processing signature:", error);
      alert("Error processing signature image");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);
      const userData = {
        ...form,
        phone: form.phone.trim() || "", // Ensure phone is included and trimmed
        licences: form.licences.filter(
          (licence) =>
            licence.state && licence.licenceNumber && licence.licenceType
        ), // Only include valid licences
        signature: form.signature || "",
        workingHours: form.workingHours,
      };

      console.log("Creating user with data:", userData);
      await userService.create(userData);

      // Show success message and navigate back to users list
      alert(
        "User created successfully! A welcome email with password setup instructions has been sent to the user's email address."
      );
      navigate("/users");
    } catch (error) {
      console.error("Error creating user:", error);
      alert(
        "Failed to create user: " +
          (error.response?.data?.message || error.message)
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate("/users");
  };

  // Check permissions
  if (!hasPermission(currentUser, "users.create")) {
    return (
      <Box m="20px">
        <Typography color="error">
          You don't have permission to create users.
        </Typography>
      </Box>
    );
  }

  const daysOfWeek = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Add New User
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate("/users")}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Back to Users
          </Link>
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3, maxWidth: "100%" }}>
        <form onSubmit={handleAddUser}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="First Name"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              required
              sx={{ flex: 1 }}
            />
            <TextField
              label="Last Name"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              required
              sx={{ flex: 1 }}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              sx={{ flex: 1 }}
            />
            <TextField
              label="Phone"
              name="phone"
              value={form.phone || ""}
              onChange={handleChange}
              sx={{ flex: 1 }}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>User Level</InputLabel>
              <Select
                label="User Level"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                {USER_LEVELS.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  color="primary"
                />
              }
              label="Active"
              sx={{ minWidth: "120px" }}
            />
          </Stack>

          {/* Working Hours Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Working Hours
            </Typography>
            <Box
              sx={{
                border: "1px solid #e0e0e0",
                borderRadius: 1,
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  backgroundColor: "#f5f5f5",
                  borderBottom: "1px solid #e0e0e0",
                }}
              >
                {daysOfWeek.map((day) => (
                  <Box
                    key={day.key}
                    sx={{
                      p: 1,
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "0.875rem",
                      borderRight:
                        day.key !== "sunday" ? "1px solid #e0e0e0" : "none",
                    }}
                  >
                    {day.label}
                  </Box>
                ))}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                }}
              >
                {daysOfWeek.map((day) => (
                  <Box
                    key={day.key}
                    sx={{
                      p: 1,
                      borderRight:
                        day.key !== "sunday" ? "1px solid #e0e0e0" : "none",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={form.workingHours[day.key].enabled}
                          onChange={(e) =>
                            handleWorkingHoursChange(
                              day.key,
                              "enabled",
                              e.target.checked
                            )
                          }
                          size="small"
                        />
                      }
                      label=""
                      sx={{ m: 0 }}
                    />
                    <TextField
                      label="Hours"
                      type="number"
                      value={form.workingHours[day.key].hours}
                      onChange={(e) =>
                        handleWorkingHoursChange(
                          day.key,
                          "hours",
                          e.target.value
                        )
                      }
                      disabled={!form.workingHours[day.key].enabled}
                      size="small"
                      sx={{ width: "80px" }}
                      inputProps={{ min: 0, max: 24, step: 0.5 }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Lab Approvals Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Lab Approvals
            </Typography>
            <Box
              sx={{
                border: "1px solid #e0e0e0",
                borderRadius: 1,
                p: 2,
                backgroundColor: "#fafafa",
              }}
            >
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labApprovals.fibreCounting}
                        onChange={(e) =>
                          handleLabApprovalsChange(
                            "fibreCounting",
                            e.target.checked
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Fibre Counting"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labApprovals.fibreIdentification}
                        onChange={(e) =>
                          handleLabApprovalsChange(
                            "fibreIdentification",
                            e.target.checked
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Fibre Identification"
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>

          {/* LAA Licences Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Licences
            </Typography>
            {form.licences.map((licence, index) => (
              <Card key={index} sx={{ mb: 2, p: 2 }}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Licence Type</InputLabel>
                        <Select
                          label="Licence Type"
                          value={licence.licenceType}
                          onChange={(e) =>
                            handleLaaLicenceChange(
                              index,
                              "licenceType",
                              e.target.value
                            )
                          }
                        >
                          <MenuItem value="Asbestos Assessor">
                            Asbestos Assessor
                          </MenuItem>
                          <MenuItem value="White Card">White Card</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        label="State"
                        value={licence.state}
                        onChange={(e) =>
                          handleLaaLicenceChange(index, "state", e.target.value)
                        }
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <TextField
                        label="Licence Number"
                        value={licence.licenceNumber}
                        onChange={(e) =>
                          handleLaaLicenceChange(
                            index,
                            "licenceNumber",
                            e.target.value
                          )
                        }
                        fullWidth
                        size="small"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
                <CardActions>
                  <IconButton
                    onClick={() => removeLaaLicence(index)}
                    color="error"
                    size="small"
                  >
                    <RemoveIcon />
                  </IconButton>
                </CardActions>
              </Card>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={addLaaLicence}
              variant="outlined"
              size="small"
            >
              Add Licence
            </Button>
          </Box>

          {/* Signature Upload Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Signature
            </Typography>
            <input
              accept="image/*"
              style={{ display: "none" }}
              id="signature-upload"
              type="file"
              onChange={handleSignatureUpload}
            />
            <label htmlFor="signature-upload">
              <Button variant="outlined" component="span">
                Upload Signature
              </Button>
            </label>
            {form.signature && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Current Signature:
                </Typography>
                <Box
                  component="img"
                  src={form.signature}
                  alt="Signature preview"
                  sx={{
                    maxWidth: 200,
                    maxHeight: 100,
                    border: "1px solid #ddd",
                    borderRadius: 1,
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{ mt: 4, display: "flex", gap: 2, justifyContent: "flex-end" }}
          >
            <Button onClick={handleCancel} color="secondary" variant="outlined">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={saving}
            >
              {saving ? "Creating..." : "Create User"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default AddUserPage;
