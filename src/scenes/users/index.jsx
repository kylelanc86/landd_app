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

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontSize: { xs: 32, md: 40 } }}>
          Users
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setDialogOpen(true)}
        >
          Add User
        </Button>
      </Box>
      <Paper sx={{ p: 2, mb: 4 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User ID</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "firstName"}
                    direction={sortBy === "firstName" ? sortDir : "asc"}
                    onClick={() => handleSort("firstName")}
                  >
                    First Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "lastName"}
                    direction={sortBy === "lastName" ? sortDir : "asc"}
                    onClick={() => handleSort("lastName")}
                  >
                    Last Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "email"}
                    direction={sortBy === "email" ? sortDir : "asc"}
                    onClick={() => handleSort("email")}
                  >
                    Email
                  </TableSortLabel>
                </TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "userLevel"}
                    direction={sortBy === "userLevel" ? sortDir : "asc"}
                    onClick={() => handleSort("userLevel")}
                  >
                    User Level
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.filter((user) => user.isActive).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No active users found.
                  </TableCell>
                </TableRow>
              )}
              {sortedUsers
                .filter((user) => user.isActive)
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.userID}</TableCell>
                    <TableCell>{user.firstName}</TableCell>
                    <TableCell>{user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.userLevel}
                        color={
                          user.userLevel === "admin"
                            ? "error"
                            : user.userLevel === "manager"
                            ? "warning"
                            : "success"
                        }
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleEditUser(user)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleStatusChange(user.id, false)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Inactive Users Section */}
      <Typography variant="h5" sx={{ mb: 2 }}>
        Inactive Users
      </Typography>
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>User ID</TableCell>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>User Level</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedUsers.filter((user) => !user.isActive).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No inactive users found.
                  </TableCell>
                </TableRow>
              )}
              {sortedUsers
                .filter((user) => !user.isActive)
                .map((user) => (
                  <TableRow
                    key={user.id}
                    sx={{
                      "& td": {
                        color: "text.secondary",
                        opacity: 0.7,
                      },
                    }}
                  >
                    <TableCell>{user.userID}</TableCell>
                    <TableCell>{user.firstName}</TableCell>
                    <TableCell>{user.lastName}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.userLevel}
                        color={
                          user.userLevel === "admin"
                            ? "error"
                            : user.userLevel === "manager"
                            ? "warning"
                            : "success"
                        }
                        sx={{ opacity: 0.7 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => handleStatusChange(user.id, true)}
                      >
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
