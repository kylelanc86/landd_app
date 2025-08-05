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
import { DataGrid } from "@mui/x-data-grid";
import { tokens } from "../../theme/tokens";
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
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
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

  const handleEditUser = (user) => {
    navigate(`/users/edit/${user._id}`);
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
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          User Management
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate("/users/add")}
          sx={{
            backgroundColor: theme.palette.primary.main,
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
          <Typography variant="h5" color="black">
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
            sx={{ color: "black" }}
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
