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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { USER_LEVELS } from "../../data/userData";
import Header from "../../components/Header";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";
import { userService } from "../../services/api";

const USERS_KEY = "ldc_users";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "employee",
  isActive: true,
};

const Users = () => {
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
  const theme = useTheme();
  const colors = tokens;

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

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim())
      return;

    try {
      const userData = {
        ...form,
        password: "defaultPassword123", // You might want to implement a proper password setup
        phone: form.phone.trim() || "", // Ensure phone is included and trimmed
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

  const columns = [
    { field: "firstName", headerName: "First Name", flex: 1 },
    { field: "lastName", headerName: "Last Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    {
      field: "role",
      headerName: "User Level",
      flex: 1,
      renderCell: (params) => {
        const role = params.row.role || "employee";
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              width: "100%",
            }}
          >
            <Typography>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "isActive",
      headerName: "Status",
      flex: 1,
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
      renderCell: (params) => (
        <Box>
          <IconButton onClick={() => handleEditUser(params.row)}>
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() =>
              handleStatusChange(params.row._id, !params.row.isActive)
            }
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
      sortable: false,
      filterable: false,
    },
  ];

  const inactiveColumns = [
    { field: "firstName", headerName: "First Name", flex: 1 },
    { field: "lastName", headerName: "Last Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    {
      field: "role",
      headerName: "User Level",
      flex: 1,
      renderCell: (params) => {
        const role = params.row.role || "employee";
        return (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              height: "100%",
              width: "100%",
            }}
          >
            <Typography>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "reactivate",
      headerName: "Reactivate",
      flex: 1,
      renderCell: (params) => (
        <FormControlLabel
          control={
            <Switch
              checked={false}
              onChange={() => handleStatusChange(params.row._id, true)}
              color="primary"
            />
          }
          label="Reactivate"
        />
      ),
    },
  ];

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

      {/* Active Users Table */}
      <Box mt="20px">
        <Typography variant="h5" mb="10px" color={colors.grey[100]}>
          Active Users
        </Typography>
        <Box
          height="40vh"
          sx={{
            "& .MuiDataGrid-root": { border: "none" },
            "& .MuiDataGrid-cell": { borderBottom: "none" },
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
          }}
        >
          <DataGrid
            rows={users.filter((user) => user.isActive)}
            columns={columns}
            getRowId={(row) => row._id}
            pageSize={5}
            rowsPerPageOptions={[5]}
            autoHeight
            disableSelectionOnClick
          />
        </Box>
      </Box>

      {/* Inactive Users Table */}
      <Box mt="40px">
        <Typography variant="h5" mb="10px" color={colors.grey[100]}>
          Inactive Users
        </Typography>
        <Box
          height="30vh"
          sx={{
            "& .MuiDataGrid-root": { border: "none" },
            "& .MuiDataGrid-cell": { borderBottom: "none" },
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
          }}
        >
          <DataGrid
            rows={users.filter((user) => !user.isActive)}
            columns={inactiveColumns}
            getRowId={(row) => row._id}
            pageSize={5}
            rowsPerPageOptions={[5]}
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
