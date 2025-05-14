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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { USER_LEVELS, fakeUsers } from "../../data/userData";
import Header from "../../components/Header";
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material/styles";

const USERS_KEY = "ldc_users";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  userLevel: USER_LEVELS[2], // Default to employee
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

  // Load users from localStorage on mount
  useEffect(() => {
    const loadUsers = () => {
      try {
        const stored = localStorage.getItem(USERS_KEY);
        if (stored) {
          const parsedUsers = JSON.parse(stored);
          if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
            setUsers(parsedUsers);
          } else {
            // Only initialize with fakeUsers if there's no valid data
            const initialUsers = fakeUsers.map((user) => ({
              ...user,
              isActive: true, // Ensure initial state is set
            }));
            setUsers(initialUsers);
            localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
          }
        } else {
          // Only initialize with fakeUsers if there's no stored data
          const initialUsers = fakeUsers.map((user) => ({
            ...user,
            isActive: true, // Ensure initial state is set
          }));
          setUsers(initialUsers);
          localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
        }
      } catch (error) {
        console.error("Error loading users:", error);
        // Only use fakeUsers as fallback if there's an error
        const initialUsers = fakeUsers.map((user) => ({
          ...user,
          isActive: true, // Ensure initial state is set
        }));
        setUsers(initialUsers);
        localStorage.setItem(USERS_KEY, JSON.stringify(initialUsers));
      }
    };

    loadUsers();
  }, []);

  // Save users to localStorage whenever they change
  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }, [users]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim())
      return;
    const newUser = {
      id: Date.now(),
      userID: `${form.firstName.charAt(0)}${form.lastName.charAt(0)}${String(
        Date.now()
      ).slice(-3)}`,
      ...form,
      isActive: true, // Explicitly set isActive to true for new users
    };
    const updatedUsers = [newUser, ...users];
    setUsers(updatedUsers);
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditUser = (user) => {
    setEditId(user.id);
    setEditForm({ ...user });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedUsers = users.map((u) =>
      u.id === editId ? { ...u, ...editForm, isActive: u.isActive } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleStatusChange = (userId, newStatus) => {
    // Check if trying to deactivate the last admin
    if (!newStatus) {
      const userToDeactivate = users.find((u) => u.id === userId);
      if (userToDeactivate.userLevel === "admin") {
        const activeAdmins = users.filter(
          (u) => u.isActive && u.userLevel === "admin"
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

  const confirmStatusChange = () => {
    const userToDeactivate = users.find((u) => u.id === statusChangeId);
    if (!statusChangeType && userToDeactivate.userLevel === "admin") {
      const activeAdmins = users.filter(
        (u) => u.isActive && u.userLevel === "admin"
      );
      if (activeAdmins.length <= 1) {
        // Show error dialog instead of proceeding
        setStatusDialogOpen(false);
        setStatusChangeId(null);
        setStatusChangeType(null);
        return;
      }
    }

    const updatedUsers = users.map((u) =>
      u.id === statusChangeId ? { ...u, isActive: statusChangeType } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
    setStatusDialogOpen(false);
    setStatusChangeId(null);
    setStatusChangeType(null);
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
    { field: "userID", headerName: "User ID", flex: 1 },
    { field: "firstName", headerName: "First Name", flex: 1 },
    { field: "lastName", headerName: "Last Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    { field: "userLevel", headerName: "User Level", flex: 1 },
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
              handleStatusChange(params.row.id, !params.row.isActive)
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
      <Box
        m="40px 0 0 0"
        height="75vh"
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
          rows={users}
          columns={columns}
          getRowId={(row) => row.id}
          pageSize={10}
          rowsPerPageOptions={[10]}
          autoHeight
          disableSelectionOnClick
        />
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
                name="userLevel"
                value={form.userLevel}
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
                value={editForm.phone}
                onChange={handleEditChange}
                sx={{ flex: 1 }}
              />
            </Stack>
            <FormControl fullWidth>
              <InputLabel>User Level</InputLabel>
              <Select
                label="User Level"
                name="userLevel"
                value={editForm.userLevel}
                onChange={handleEditChange}
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
              : users.find((u) => u.id === statusChangeId)?.userLevel ===
                  "admin" &&
                users.filter((u) => u.isActive && u.userLevel === "admin")
                  .length <= 1
              ? "Cannot deactivate the last active admin user. Please ensure another admin user is active before deactivating this user."
              : "Are you sure you want to deactivate this user? They will lose access to the system but can be restored later."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          {!(
            users.find((u) => u.id === statusChangeId)?.userLevel === "admin" &&
            users.filter((u) => u.isActive && u.userLevel === "admin").length <=
              1
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
