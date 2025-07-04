import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Stack,
  TableSortLabel,
  Chip,
  alpha,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { USER_LEVELS } from "../../data/userData";
import Header from "../../components/Header";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { userService } from "../../services/api";
import TruncatedCell from "../../components/TruncatedCell";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import {
  validateSignatureFile,
  compressSignatureImage,
} from "../../utils/signatureUtils";

const USERS_KEY = "ldc_users";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "employee",
  isActive: true,
  licences: [],
  signature: "",
};

const Users = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [statusChangeId, setStatusChangeId] = useState(null);
  const [statusChangeType, setStatusChangeType] = useState(null);
  const [sortBy, setSortBy] = useState("lastName");
  const [sortDir, setSortDir] = useState("asc");
  const [showInactive, setShowInactive] = useState(false);
  const theme = useTheme();

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Fetch users from the API on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userService.getAll();
        console.log("Users data from API:", response.data);
        // Transform the data to ensure role is properly set
        const transformedUsers = response.data.map((user) => ({
          ...user,
          role: user.role || "employee",
        }));
        setUsers(transformedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // Handle LAA licence changes
  const handleLaaLicenceChange = (index, field, value) => {
    const updatedLicences = [...form.licences];
    updatedLicences[index] = { ...updatedLicences[index], [field]: value };
    setForm({ ...form, licences: updatedLicences });
  };

  const handleEditLaaLicenceChange = (index, field, value) => {
    const updatedLicences = [...editForm.licences];
    updatedLicences[index] = { ...updatedLicences[index], [field]: value };
    setEditForm({ ...editForm, licences: updatedLicences });
  };

  const addLaaLicence = () => {
    setForm({
      ...form,
      licences: [
        ...form.licences,
        { state: "", licenceNumber: "", licenceType: "" },
      ],
    });
  };

  const addEditLaaLicence = () => {
    setEditForm({
      ...editForm,
      licences: [
        ...editForm.licences,
        { state: "", licenceNumber: "", licenceType: "" },
      ],
    });
  };

  const removeLaaLicence = (index) => {
    const updatedLicences = form.licences.filter((_, i) => i !== index);
    setForm({ ...form, licences: updatedLicences });
  };

  const removeEditLaaLicence = (index) => {
    const updatedLicences = editForm.licences.filter((_, i) => i !== index);
    setEditForm({ ...editForm, licences: updatedLicences });
  };

  // Handle signature file upload
  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      const validation = validateSignatureFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Compress the image
          const compressedSignature = await compressSignatureImage(
            event.target.result
          );
          setForm({ ...form, signature: compressedSignature });
        } catch (error) {
          console.error("Error compressing signature:", error);
          // Fallback to original if compression fails
          setForm({ ...form, signature: event.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file
      const validation = validateSignatureFile(file);
      if (!validation.isValid) {
        alert(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Compress the image
          const compressedSignature = await compressSignatureImage(
            event.target.result
          );
          setEditForm({ ...editForm, signature: compressedSignature });
        } catch (error) {
          console.error("Error compressing signature:", error);
          // Fallback to original if compression fails
          setEditForm({ ...editForm, signature: event.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim())
      return;

    try {
      const userData = {
        ...form,
        password: "defaultPassword123", // You might want to implement a proper password setup
        phone: form.phone.trim() || "", // Ensure phone is included and trimmed
        licences: form.licences.filter(
          (licence) =>
            licence.state && licence.licenceNumber && licence.licenceType
        ), // Only include valid licences
        signature: form.signature || "",
      };
      console.log("Creating user with data:", userData);
      const response = await userService.create(userData);
      setUsers([response.data, ...users]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (error) {
      console.error("Error adding user:", error);
    }
  };

  const handleEditUser = (user) => {
    console.log("Editing user:", user);
    setEditId(user._id);
    setEditForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "employee",
      isActive: user.isActive,
      licences: user.licences || [],
      signature: user.signature || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone.trim() || "",
        role: editForm.role,
        isActive: editForm.isActive,
        licences: editForm.licences.filter(
          (licence) =>
            licence.state && licence.licenceNumber && licence.licenceType
        ), // Only include valid licences
        signature: editForm.signature || "",
      };
      console.log("Updating user with data:", updateData);
      const response = await userService.update(editId, updateData);
      setUsers(users.map((u) => (u._id === editId ? response.data : u)));
      setEditDialogOpen(false);
      setEditId(null);
      setEditForm(emptyForm);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleStatusChange = (userId, newStatus) => {
    // Check if trying to deactivate the last admin
    if (!newStatus) {
      const userToDeactivate = users.find((u) => u._id === userId);
      if (userToDeactivate.role === "admin") {
        const activeAdmins = users.filter(
          (u) => u.isActive && u.role === "admin"
        );
        if (activeAdmins.length <= 1) {
          setStatusDialogOpen(true);
          setStatusChangeId(userId);
          setStatusChangeType(newStatus);
          return;
        }
      }
    }
    setStatusChangeId(userId);
    setStatusChangeType(newStatus);
    setStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    const userToDeactivate = users.find((u) => u._id === statusChangeId);
    if (!statusChangeType && userToDeactivate.role === "admin") {
      const activeAdmins = users.filter(
        (u) => u.isActive && u.role === "admin"
      );
      if (activeAdmins.length <= 1) {
        setStatusDialogOpen(false);
        setStatusChangeId(null);
        setStatusChangeType(null);
        return;
      }
    }

    try {
      const response = await userService.update(statusChangeId, {
        isActive: statusChangeType,
      });
      setUsers(
        users.map((u) => (u._id === statusChangeId ? response.data : u))
      );
      setStatusDialogOpen(false);
      setStatusChangeId(null);
      setStatusChangeType(null);
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  // Sorting
  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let valA = a[sortBy],
      valB = b[sortBy];
    if (valA < valB) return sortDir === "asc" ? -1 : 1;
    if (valA > valB) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const handleViewTimesheets = (userId) => {
    navigate(`/timesheets/review?userId=${userId}`);
  };

  const columns = [
    {
      field: "name",
      headerName: "Name",
      flex: 1.5,
      maxWidth: 180,
      renderCell: (params) => {
        const fullName = `${params.row.firstName || ""} ${
          params.row.lastName || ""
        }`.trim();
        return <TruncatedCell value={fullName} />;
      },
    },
    {
      field: "email",
      headerName: "Email",
      flex: 1,
      renderCell: (params) => <TruncatedCell value={params.value} />,
    },
    {
      field: "role",
      headerName: "User Level",
      flex: 1,
      minWidth: 120,
      renderCell: (params) => {
        const role = params.row.role || "employee";
        const formattedRole = role.charAt(0).toUpperCase() + role.slice(1);
        return <TruncatedCell value={formattedRole} />;
      },
    },
    {
      field: "licences",
      headerName: "Licences",
      flex: 1.5,
      minWidth: 150,
      renderCell: (params) => {
        const licences = params.row.licences || [];
        if (licences.length === 0) {
          return (
            <Typography variant="body2" color="textSecondary">
              No licences
            </Typography>
          );
        }
        return (
          <Box>
            {licences.map((licence, index) => (
              <Typography key={index} variant="body2">
                {licence.licenceType}
              </Typography>
            ))}
          </Box>
        );
      },
    },

    {
      field: "isActive",
      headerName: "Status",
      flex: 1,
      maxWidth: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? "Active" : "Inactive"}
          color={params.value ? "success" : "error"}
          sx={{ color: "white" }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Box>
          <IconButton onClick={() => handleEditUser(params.row)}>
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() =>
              handleStatusChange(params.row._id, !params.row.isActive)
            }
            title={params.row.isActive ? "Deactivate User" : "Activate User"}
          >
            {params.row.isActive ? <DeleteIcon /> : <CheckCircleIcon />}
          </IconButton>
          {hasPermission(currentUser, "timesheets.approve") &&
            params.row._id !== currentUser._id && (
              <IconButton
                onClick={() => handleViewTimesheets(params.row._id)}
                title="View Timesheets"
              >
                <AccessTimeIcon />
              </IconButton>
            )}
        </Box>
      ),
      sortable: false,
      filterable: false,
    },
  ];

  // Filter users based on active/inactive status
  const filteredUsers = users.filter((user) => showInactive || user.isActive);

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="USER MANAGEMENT" subtitle="Manage your users" />
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.secondary.main,
            "&:hover": { backgroundColor: theme.palette.secondary.dark },
          }}
        >
          Add User
        </Button>
      </Box>

      {/* Users Table with Toggle */}
      <Box mt="20px">
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb="10px"
        >
          <Typography variant="h5" color="#000000">
            Users
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                color="secondary"
              />
            }
            label="Show Inactive Users"
            sx={{ color: "#000000" }}
          />
        </Box>
        <Box
          height="75vh"
          sx={{
            "& .MuiDataGrid-root": { border: "none" },
            "& .MuiDataGrid-cell": {
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: theme.palette.primary.dark,
              borderBottom: "none",
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: theme.palette.background.default,
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: "none",
              backgroundColor: theme.palette.primary.dark,
            },
            "& .MuiCheckbox-root": {
              color: `${theme.palette.secondary.main} !important`,
            },
            "& .MuiDataGrid-row:nth-of-type(even)": {
              backgroundColor: "#f8f9fa",
            },
            "& .MuiDataGrid-row:nth-of-type(odd)": {
              backgroundColor: "#ffffff",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "#e3f2fd",
            },
          }}
        >
          <DataGrid
            rows={filteredUsers}
            columns={columns}
            getRowId={(row) => row._id}
            pageSize={10}
            rowsPerPageOptions={[10]}
            autoHeight
            disableSelectionOnClick
          />
        </Box>
      </Box>

      {/* Add User Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New User</DialogTitle>
        <form onSubmit={handleAddUser}>
          <DialogContent>
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
                value={form.phone}
                onChange={handleChange}
                sx={{ flex: 1 }}
              />
            </Stack>
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
                            handleLaaLicenceChange(
                              index,
                              "state",
                              e.target.value
                            )
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
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Add User
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit User</DialogTitle>
        <form onSubmit={handleSaveEdit}>
          <DialogContent>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="First Name"
                name="firstName"
                value={editForm.firstName}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Last Name"
                name="lastName"
                value={editForm.lastName}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Email"
                name="email"
                type="email"
                value={editForm.email}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Phone"
                name="phone"
                value={editForm.phone || ""}
                onChange={handleEditChange}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <InputLabel>User Level</InputLabel>
                <Select
                  label="User Level"
                  name="role"
                  value={editForm.role}
                  onChange={handleEditChange}
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
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                    color="primary"
                  />
                }
                label="Active"
                sx={{ minWidth: "120px" }}
              />
            </Stack>

            {/* LAA Licences Section */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Licences
              </Typography>
              {editForm.licences.map((licence, index) => (
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
                              handleEditLaaLicenceChange(
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
                            handleEditLaaLicenceChange(
                              index,
                              "state",
                              e.target.value
                            )
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
                            handleEditLaaLicenceChange(
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
                      onClick={() => removeEditLaaLicence(index)}
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
                onClick={addEditLaaLicence}
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
                id="edit-signature-upload"
                type="file"
                onChange={handleEditSignatureUpload}
              />
              <label htmlFor="edit-signature-upload">
                <Button variant="outlined" component="span">
                  Upload Signature
                </Button>
              </label>
              {editForm.signature && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Current Signature:
                  </Typography>
                  <Box
                    component="img"
                    src={editForm.signature}
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
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
      >
        <DialogTitle>
          {statusChangeType ? "Confirm Restore" : "Confirm Deactivate"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {statusChangeType
              ? "Are you sure you want to restore this user? They will regain access to the system."
              : users.find((u) => u._id === statusChangeId)?.role === "admin" &&
                users.filter((u) => u.isActive && u.role === "admin").length <=
                  1
              ? "Cannot deactivate the last active admin user. Please ensure another admin user is active before deactivating this user."
              : "Are you sure you want to deactivate this user? They will lose access to the system but can be restored later."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          {!(
            users.find((u) => u._id === statusChangeId)?.role === "admin" &&
            users.filter((u) => u.isActive && u.role === "admin").length <= 1
          ) && (
            <Button
              onClick={confirmStatusChange}
              color={statusChangeType ? "success" : "error"}
              variant="contained"
            >
              {statusChangeType ? "Restore" : "Deactivate"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Users;
