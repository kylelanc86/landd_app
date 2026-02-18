import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Chip,
  Switch,
  FormControlLabel,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AssignmentIcon from "@mui/icons-material/Assignment";
import WarningIcon from "@mui/icons-material/Warning";

import { DataGrid } from "@mui/x-data-grid";

import { useTheme } from "@mui/material/styles";
import { userService } from "../../services/api";
import TruncatedCell from "../../components/TruncatedCell";
import { useNavigate } from "react-router-dom";
import { hasPermission } from "../../config/permissions";
import { useAuth } from "../../context/AuthContext";
import { useUserLists } from "../../context/UserListsContext";

const Users = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { refreshUserLists } = useUserLists();
  const [users, setUsers] = useState([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusChangeId, setStatusChangeId] = useState(null);
  const [statusChangeType, setStatusChangeType] = useState(null);

  const [showInactive, setShowInactive] = useState(false);
  const theme = useTheme();

  const [loading, setLoading] = useState(true);

  // Fetch users from the API on mount
  useEffect(() => {
    let cancelled = false;
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const startTime = performance.now();
        const response = await userService.getAll(showInactive);
        const fetchTime = performance.now() - startTime;

        if (!cancelled) {
          // Backend already returns role, no need to transform
          setUsers(response.data || []);
          console.log(
            `[USERS] Loaded ${
              response.data?.length || 0
            } users in ${fetchTime.toFixed(0)}ms`,
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching users:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchUsers();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      cancelled = true;
    };
  }, [showInactive]);

  const confirmStatusChange = async () => {
    const userToUpdate = users.find((u) => u._id === statusChangeId);
    if (!statusChangeType && userToUpdate?.role === "admin") {
      const activeAdmins = users.filter(
        (u) => u.isActive && u.role === "admin",
      );
      if (activeAdmins.length <= 1) {
        setStatusDialogOpen(false);
        setStatusChangeId(null);
        setStatusChangeType(null);
        return;
      }
    }
    if (!statusChangeType && userToUpdate?.role === "super_admin") {
      const activeSuperAdmins = users.filter(
        (u) => u.isActive && u.role === "super_admin",
      );
      if (activeSuperAdmins.length <= 1) {
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
        users.map((u) => (u._id === statusChangeId ? response.data : u)),
      );
      await refreshUserLists();
      setStatusDialogOpen(false);
      setStatusChangeId(null);
      setStatusChangeType(null);
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  };

  const handleEditUser = useCallback(
    (user) => {
      navigate(`/users/edit/${user._id}`);
    },
    [navigate],
  );

  const handleStatusChange = useCallback(
    (userId, newStatus) => {
      // Check if trying to deactivate the last admin or last super_admin
      if (!newStatus) {
        const userToDeactivate = users.find((u) => u._id === userId);
        if (userToDeactivate?.role === "admin") {
          const activeAdmins = users.filter(
            (u) => u.isActive && u.role === "admin",
          );
          if (activeAdmins.length <= 1) {
            setStatusDialogOpen(true);
            setStatusChangeId(userId);
            setStatusChangeType(newStatus);
            return;
          }
        }
        if (userToDeactivate?.role === "super_admin") {
          const activeSuperAdmins = users.filter(
            (u) => u.isActive && u.role === "super_admin",
          );
          if (activeSuperAdmins.length <= 1) {
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
    },
    [users],
  );

  // Memoize columns to prevent unnecessary re-renders
  const columns = useMemo(
    () => [
      {
        field: "firstName",
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
          const formattedRole =
            role === "super_admin"
              ? "Super Admin"
              : role.charAt(0).toUpperCase() + role.slice(1);

          // Define colors for different user levels
          let roleColor;
          switch (role.toLowerCase()) {
            case "super_admin":
              roleColor = "#6a1b9a"; // Purple
              break;
            case "admin":
              roleColor = "#d32f2f"; // Red
              break;
            case "manager":
              roleColor = "#ed6c02"; // Orange
              break;
            case "employee":
            default:
              roleColor = "#1976d2"; // Blue
              break;
          }

          return (
            <Chip
              label={formattedRole}
              sx={{
                backgroundColor: roleColor,
                color: "white",
              }}
            />
          );
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
            sx={{
              backgroundColor: params.value ? "green" : "red",
              color: "white",
            }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        flex: 1,
        minWidth: 150,
        renderCell: (params) => {
          const isTargetSuperAdmin = params.row.role === "super_admin";
          const canChangeStatus =
            !isTargetSuperAdmin || currentUser.role === "super_admin";
          return (
            <Box>
              {/* Show edit button for admin and super_admin users */}
              {(currentUser.role === "admin" ||
                currentUser.role === "super_admin") && (
                <IconButton
                  onClick={() => handleEditUser(params.row)}
                  sx={{
                    color: "rgba(97, 90, 90, 0.87) !important",
                    "& .MuiSvgIcon-root": {
                      color: "rgba(97, 90, 90, 0.87) !important",
                    },
                  }}
                >
                  <EditIcon />
                </IconButton>
              )}
              {canChangeStatus && (
                <IconButton
                  onClick={() =>
                    handleStatusChange(params.row._id, !params.row.isActive)
                  }
                  title={
                    params.row.isActive ? "Deactivate User" : "Activate User"
                  }
                  sx={{
                    color: "rgba(97, 90, 90, 0.87) !important",
                    "& .MuiSvgIcon-root": {
                      color: "rgba(97, 90, 90, 0.87) !important",
                    },
                  }}
                >
                  {params.row.isActive ? <DeleteIcon /> : <CheckCircleIcon />}
                </IconButton>
              )}
            </Box>
          );
        },
        sortable: false,
        filterable: false,
      },
    ],
    [currentUser, handleEditUser, handleStatusChange],
  );

  // Users are filtered by the backend API based on showInactive state
  const filteredUsers = users;

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          User Management
        </Typography>
        <Box display="flex" gap={2}>
          {/* Show Timesheet Review button for users with timesheet approval permission */}
          {hasPermission(currentUser, "timesheets.approve") && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate("/timesheets/review")}
              startIcon={<AssignmentIcon />}
              sx={{
                backgroundColor: theme.palette.success.main,
                "&:hover": { backgroundColor: theme.palette.success.dark },
              }}
            >
              Timesheet Review
            </Button>
          )}
          {/* Show Add User button for admin and super_admin users */}
          {(currentUser.role === "admin" ||
            currentUser.role === "super_admin") && (
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
          )}
        </Box>
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
              background: "linear-gradient(to right, #045E1F, #96CC78) !important",
              borderBottom: "none",
            },
            "& .MuiDataGrid-virtualScroller": {
              backgroundColor: theme.palette.background.default,
            },
            "& .MuiDataGrid-footerContainer": {
              borderTop: "none",
              background: "linear-gradient(to right, #045E1F, #96CC78) !important",
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
            "& .MuiDataGrid-cell[data-field='actions'] .MuiIconButton-root, & .MuiDataGrid-cell[data-field='actions'] .MuiSvgIcon-root": {
              color: "rgba(97, 90, 90, 0.87) !important",
              fill: "rgba(97, 90, 90, 0.87) !important",
            },
          }}
        >
          <DataGrid
            rows={filteredUsers}
            columns={columns}
            getRowId={(row) => row._id}
            pageSize={10}
            rowsPerPageOptions={[10]}
            loading={loading}
            autoHeight
            disableSelectionOnClick
            sortingOrder={["desc", "asc"]}
            disableColumnMenu
            disableDensitySelector
            disableColumnFilter
            disableRowSelectionOnClick
            hideFooterSelectedRowCount
            disableVirtualization={filteredUsers.length < 100} // Disable virtualization for small datasets
            experimentalFeatures={{ ariaV7: false }} // Disable experimental features that add overhead
          />
        </Box>
      </Box>

      {/* Status Change Confirmation Dialog */}
      <Dialog
        open={statusDialogOpen}
        onClose={() => setStatusDialogOpen(false)}
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
              bgcolor: statusChangeType ? "success.main" : "warning.main",
              color: "white",
            }}
          >
            {statusChangeType ? (
              <CheckCircleIcon sx={{ fontSize: 20 }} />
            ) : (
              <WarningIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            {statusChangeType ? "Confirm Restore" : "Confirm Deactivate"}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            {statusChangeType
              ? "Are you sure you want to restore this user? They will regain access to the system."
              : users.find((u) => u._id === statusChangeId)?.role === "admin" &&
                  users.filter((u) => u.isActive && u.role === "admin")
                    .length <= 1
                ? "Cannot deactivate the last active admin user. Please ensure another admin user is active before deactivating this user."
                : users.find((u) => u._id === statusChangeId)?.role ===
                      "super_admin" &&
                    users.filter((u) => u.isActive && u.role === "super_admin")
                      .length <= 1
                  ? "Cannot deactivate the last active super admin user. There must always be at least one super admin."
                  : "Are you sure you want to deactivate this user? They will lose access to the system but can be restored later."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => setStatusDialogOpen(false)}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          {!(
            (users.find((u) => u._id === statusChangeId)?.role === "admin" &&
              users.filter((u) => u.isActive && u.role === "admin").length <=
                1) ||
            (users.find((u) => u._id === statusChangeId)?.role ===
              "super_admin" &&
              users.filter((u) => u.isActive && u.role === "super_admin")
                .length <= 1)
          ) && (
            <Button
              onClick={confirmStatusChange}
              variant="contained"
              color={statusChangeType ? "success" : "error"}
              startIcon={
                statusChangeType ? <CheckCircleIcon /> : <WarningIcon />
              }
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
                boxShadow: statusChangeType
                  ? "0 4px 12px rgba(76, 175, 80, 0.3)"
                  : "0 4px 12px rgba(255, 152, 0, 0.3)",
                "&:hover": {
                  boxShadow: statusChangeType
                    ? "0 6px 16px rgba(76, 175, 80, 0.4)"
                    : "0 6px 16px rgba(255, 152, 0, 0.4)",
                },
              }}
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
