import React, { useState, useEffect } from "react";
import { useSnackbar } from "../../context/SnackbarContext";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { USER_LEVELS, SUPER_ADMIN_ONLY_LEVELS } from "../../data/userData";
import { userService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import { useUserLists } from "../../context/UserListsContext";
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
    calibrations: false,
  },
  canSetJobComplete: false,
  labSignatory: false,
  reportProofer: false,
};

const AddUserPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { refreshUserLists } = useUserLists();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { showSnackbar } = useSnackbar();

  // State for tracking form changes and confirmation dialog
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalForm, setOriginalForm] = useState(null);
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] =
    useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Initialize original form when component mounts
  useEffect(() => {
    setOriginalForm(JSON.parse(JSON.stringify(emptyForm)));
  }, []);

  // Track form changes
  useEffect(() => {
    if (originalForm) {
      const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);
      setHasUnsavedChanges(hasChanges);

      // Set global variables for sidebar navigation
      window.hasUnsavedChanges = hasChanges;
      window.currentProjectPath = window.location.pathname;
      window.showUnsavedChangesDialog = () => {
        setUnsavedChangesDialogOpen(true);
      };
    } else {
      // Clean up global variables when no original form
      window.hasUnsavedChanges = false;
      window.currentProjectPath = null;
      window.showUnsavedChangesDialog = null;
    }

    return () => {
      // Clean up global variables when component unmounts
      window.hasUnsavedChanges = false;
      window.currentProjectPath = null;
      window.showUnsavedChangesDialog = null;
    };
  }, [form, originalForm]);

  // Handle page refresh and browser navigation
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    };

    // Handle browser back/forward buttons
    const handlePopState = (e) => {
      if (hasUnsavedChanges) {
        // Prevent the navigation
        window.history.pushState(null, "", window.location.pathname);
        setPendingNavigation("/users");
        setUnsavedChangesDialogOpen(true);
      }
    };

    // Handle refresh button clicks and F5 key
    const handleRefreshClick = (e) => {
      // Check if it's a refresh button click or F5 key
      const isRefreshButton = e.target.closest(
        'button[aria-label*="refresh"], button[title*="refresh"], .refresh-button',
      );
      const isF5Key = e.key === "F5";

      if ((isRefreshButton || isF5Key) && hasUnsavedChanges) {
        e.preventDefault();
        e.stopPropagation();
        setRefreshDialogOpen(true);
        return false;
      }
    };

    // Add a history entry when entering with unsaved changes
    if (hasUnsavedChanges) {
      window.history.pushState(null, "", window.location.pathname);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleRefreshClick, true);
    document.addEventListener("keydown", handleRefreshClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleRefreshClick, true);
      document.removeEventListener("keydown", handleRefreshClick, true);
    };
  }, [hasUnsavedChanges]);

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
        showSnackbar(validationResult.error, "error");
        return;
      }

      // Convert file to data URL first
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Compress the image
      const compressedImage = await compressSignatureImage(dataUrl);
      setForm({ ...form, signature: compressedImage });
    } catch (error) {
      console.error("Error processing signature:", error);
      showSnackbar("Error processing signature image", "error");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      showSnackbar("Please fill in all required fields", "warning");
      return;
    }

    try {
      setSaving(true);
      const userData = {
        ...form,
        phone: form.phone.trim() || "", // Ensure phone is included and trimmed
        licences: form.licences.filter(
          (licence) =>
            licence.state && licence.licenceNumber && licence.licenceType,
        ), // Only include valid licences
        signature: form.signature || "",
        workingHours: form.workingHours,
        labApprovals: form.labApprovals,
        canSetJobComplete: form.canSetJobComplete,
        labSignatory: form.labSignatory,
        reportProofer: form.reportProofer,
      };

      console.log("Creating user with data:", userData);
      await userService.create(userData);
      await refreshUserLists();

      // Show success message and navigate back to users list
      showSnackbar(
        "User created successfully! A welcome email with password setup instructions has been sent to the user's email address.",
        "success",
      );

      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      navigate("/users");
    } catch (error) {
      console.error("Error creating user:", error);
      showSnackbar(
        "Failed to create user: " +
          (error.response?.data?.message || error.message),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation("/users");
      setUnsavedChangesDialogOpen(true);
    } else {
      navigate("/users");
    }
  };

  // Confirm navigation and discard changes
  const confirmNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setHasUnsavedChanges(false);
    const targetPath = pendingNavigation || "/users";
    navigate(targetPath);
    setPendingNavigation(null);
  };

  // Cancel navigation and stay on page
  const cancelNavigation = () => {
    setUnsavedChangesDialogOpen(false);
    setPendingNavigation(null);
  };

  // Confirm page refresh and discard changes
  const confirmRefresh = () => {
    setRefreshDialogOpen(false);
    setHasUnsavedChanges(false);
    window.hasUnsavedChanges = false;
    window.location.reload();
  };

  // Cancel page refresh and stay on page
  const cancelRefresh = () => {
    setRefreshDialogOpen(false);
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

  const isSuperAdmin = currentUser?.role === "super_admin";
  const roleOptions = USER_LEVELS.filter((level) => {
    if (SUPER_ADMIN_ONLY_LEVELS.includes(level)) return isSuperAdmin;
    return true;
  });

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
                disabled={
                  currentUser.role !== "admin" &&
                  currentUser.role !== "super_admin"
                }
              >
                {roleOptions.map((level) => (
                  <MenuItem key={level} value={level}>
                    {level === "super_admin"
                      ? "Super Admin"
                      : level.charAt(0).toUpperCase() + level.slice(1)}
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
                              e.target.checked,
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
                          e.target.value,
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
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labApprovals.fibreCounting}
                        onChange={(e) =>
                          handleLabApprovalsChange(
                            "fibreCounting",
                            e.target.checked,
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Fibre Counting"
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labApprovals.fibreIdentification}
                        onChange={(e) =>
                          handleLabApprovalsChange(
                            "fibreIdentification",
                            e.target.checked,
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Fibre Identification"
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labApprovals.calibrations}
                        onChange={(e) =>
                          handleLabApprovalsChange(
                            "calibrations",
                            e.target.checked,
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Calibrations"
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={form.labSignatory}
                        onChange={(e) =>
                          setForm({ ...form, labSignatory: e.target.checked })
                        }
                        color="primary"
                      />
                    }
                    label="Lab Signatory"
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>

          {/* Job Complete Permission Section - Only for Employee users */}
          {form.role === "employee" && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Project Status Permissions
              </Typography>
              <Box
                sx={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: "#fafafa",
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.canSetJobComplete}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          canSetJobComplete: e.target.checked,
                        })
                      }
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Can Set "Job Complete" Status
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow this employee to change project status to "Job
                        Complete". Admin and Manager users can always set this
                        status.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start" }}
                />
              </Box>
            </Box>
          )}

          {/* Report Authorization Section - Available for all roles */}
          {hasPermission(currentUser, "users.create") && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Report Authorization
              </Typography>
              <Box
                sx={{
                  border: "1px solid #e0e0e0",
                  borderRadius: 1,
                  p: 2,
                  backgroundColor: "#fafafa",
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.reportProofer}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          reportProofer: e.target.checked,
                        })
                      }
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Report Proofer
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow this user to authorise air monitoring and asbestos
                        clearance reports. Requires admin permission to
                        authorise.
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: "flex-start" }}
                />
              </Box>
            </Box>
          )}

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
                              e.target.value,
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
                            e.target.value,
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

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={unsavedChangesDialogOpen}
        onClose={cancelNavigation}
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
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              !
            </Typography>
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Unsaved Changes
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to leave this page
            without saving? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelNavigation}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmNavigation}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Leave Without Saving
          </Button>
        </DialogActions>
      </Dialog>

      {/* Page Refresh Confirmation Dialog */}
      <Dialog
        open={refreshDialogOpen}
        onClose={cancelRefresh}
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
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
              !
            </Typography>
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Unsaved Changes
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            You have unsaved changes. Are you sure you want to refresh this
            page? All unsaved changes will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelRefresh}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Stay on Page
          </Button>
          <Button
            onClick={confirmRefresh}
            variant="contained"
            color="warning"
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
              boxShadow: "0 4px 12px rgba(255, 152, 0, 0.3)",
              "&:hover": {
                boxShadow: "0 6px 16px rgba(255, 152, 0, 0.4)",
              },
            }}
          >
            Refresh Page
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AddUserPage;
