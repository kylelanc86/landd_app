import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import asbestosClearanceService from "../../services/asbestosClearanceService";
import userService from "../../services/userService";
import projectService from "../../services/projectService";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import performanceMonitor from "../../utils/performanceMonitor";

const ASBESTOS_REMOVALISTS = [
  "AGH",
  "Aztech Services",
  "Capstone",
  "Crown Asbestos Removals",
  "Empire Contracting",
  "Glade Group",
  "IAR",
  "Jesco",
  "Ozbestos",
  "Spec Services",
];

const AsbestosClearanceList = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();

  const [clearances, setClearances] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClearance, setSelectedClearance] = useState(null);
  const [form, setForm] = useState({
    projectId: "",
    clearanceDate: "",
    status: "in progress",
    LAA: "",
    asbestosRemovalist: "",
    areas: [],
    notes: "",
  });

  useEffect(() => {
    performanceMonitor.startPageLoad("Asbestos Clearances");
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [clearancesResponse, projectsResponse, usersResponse] =
        await Promise.all([
          asbestosClearanceService.getAll(),
          projectService.getAll(),
          userService.getAll(),
        ]);

      console.log("Projects response:", projectsResponse);
      console.log("Projects data:", projectsResponse.data);
      console.log(
        "Projects array check:",
        Array.isArray(projectsResponse.data)
      );

      setClearances(clearancesResponse.clearances || []);
      setProjects(
        Array.isArray(projectsResponse.data) ? projectsResponse.data : []
      );
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);

      performanceMonitor.endPageLoad("Asbestos Clearances");
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch data");
      // Ensure arrays are set to empty arrays on error
      setClearances([]);
      setProjects([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClearance = async (e) => {
    e.preventDefault();
    try {
      const selectedUser = Array.isArray(users)
        ? users.find((user) => user._id === form.LAA)
        : null;
      const newClearanceData = {
        projectId: form.projectId,
        clearanceDate: form.clearanceDate,
        status: form.status,
        LAA: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`
          : form.LAA,
        asbestosRemovalist: form.asbestosRemovalist,
        areas: form.areas,
        notes: form.notes,
      };

      const response = await asbestosClearanceService.create(newClearanceData);
      console.log("New clearance created:", response);

      // Refresh the clearances list
      const clearancesResponse = await asbestosClearanceService.getAll();
      setClearances(clearancesResponse.clearances || []);

      setDialogOpen(false);
      setForm({
        projectId: "",
        clearanceDate: "",
        status: "in progress",
        LAA: "",
        asbestosRemovalist: "",
        areas: [],
        notes: "",
      });
    } catch (err) {
      console.error("Error adding clearance:", err);
      setError(err.message || "Failed to add clearance");
    }
  };

  const handleEditClearance = (clearance) => {
    setSelectedClearance(clearance);
    // Find the user by name for editing
    const user = Array.isArray(users)
      ? users.find((u) => `${u.firstName} ${u.lastName}` === clearance.LAA)
      : null;
    setForm({
      projectId: clearance.projectId._id || clearance.projectId,
      clearanceDate: clearance.clearanceDate
        ? new Date(clearance.clearanceDate).toISOString().split("T")[0]
        : "",
      status: clearance.status,
      LAA: user ? user._id : "",
      asbestosRemovalist: clearance.asbestosRemovalist || "",
      areas: Array.isArray(clearance.areas) ? clearance.areas : [],
      notes: clearance.notes,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const selectedUser = Array.isArray(users)
        ? users.find((user) => user._id === form.LAA)
        : null;
      const updateData = {
        projectId: form.projectId,
        clearanceDate: form.clearanceDate,
        status: form.status,
        LAA: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`
          : form.LAA,
        asbestosRemovalist: form.asbestosRemovalist,
        areas: form.areas,
        notes: form.notes,
      };

      await asbestosClearanceService.update(selectedClearance._id, updateData);

      // Refresh the clearances list
      const clearancesResponse = await asbestosClearanceService.getAll();
      setClearances(clearancesResponse.clearances || []);

      setEditDialogOpen(false);
      setSelectedClearance(null);
      setForm({
        projectId: "",
        clearanceDate: "",
        status: "in progress",
        LAA: "",
        asbestosRemovalist: "",
        areas: [],
        notes: "",
      });
    } catch (err) {
      console.error("Error editing clearance:", err);
      setError(err.message || "Failed to edit clearance");
    }
  };

  const handleDeleteClearance = async () => {
    try {
      await asbestosClearanceService.delete(selectedClearance._id);

      // Refresh the clearances list
      const clearancesResponse = await asbestosClearanceService.getAll();
      setClearances(clearancesResponse.clearances || []);

      setDeleteDialogOpen(false);
      setSelectedClearance(null);
    } catch (err) {
      console.error("Error deleting clearance:", err);
      setError(err.message || "Failed to delete clearance");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "complete":
        return theme.palette.success.main;
      case "in progress":
        return theme.palette.info.main;
      default:
        return theme.palette.grey[500];
    }
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Header
          title="Asbestos Clearances"
          subtitle="Manage asbestos clearance jobs"
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.common.white,
            fontSize: "14px",
            fontWeight: "bold",
            padding: "10px 20px",
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Add New Clearance
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {/* Clearances Table */}
      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": {
            border: "none",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.main,
            borderBottom: "none",
          },
          "& .MuiDataGrid-columnHeader": {
            whiteSpace: "normal",
            lineHeight: "1.2",
            padding: "8px",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: theme.palette.background.default,
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.main,
          },
        }}
      >
        <DataGrid
          rows={clearances}
          columns={[
            {
              field: "projectId.projectID",
              headerName: "Project ID",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => {
                return params.row.projectId?.projectID || "N/A";
              },
            },
            {
              field: "clearanceDate",
              headerName: "Clearance Date",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => {
                return params.row.clearanceDate
                  ? new Date(params.row.clearanceDate).toLocaleDateString(
                      "en-GB"
                    )
                  : "N/A";
              },
            },
            {
              field: "projectId.name",
              headerName: "Site Name",
              flex: 1.5,
              minWidth: 200,
              renderCell: (params) => {
                return params.row.projectId?.name || "N/A";
              },
            },
            {
              field: "areas",
              headerName: "Areas",
              flex: 1,
              minWidth: 150,
              renderCell: (params) => {
                const areas = params.row.areas || [];
                if (areas.length === 0) return "N/A";
                return areas.join(", ");
              },
            },
            {
              field: "status",
              headerName: "Status",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => {
                return (
                  <Chip
                    label={params.row.status}
                    sx={{
                      backgroundColor: getStatusColor(params.row.status),
                      color: theme.palette.common.white,
                      fontWeight: "bold",
                    }}
                  />
                );
              },
            },
            {
              field: "actions",
              headerName: "Actions",
              flex: 1.5,
              minWidth: 200,
              renderCell: ({ row }) => {
                return (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => navigate(`/clearances/${row._id}/reports`)}
                      title="Clearance Items"
                      sx={{
                        color: theme.palette.info.main,
                        borderColor: theme.palette.info.main,
                        fontSize: "0.75rem",
                        py: 0.5,
                        px: 1,
                        minWidth: "auto",
                      }}
                    >
                      Items
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => handleEditClearance(row)}
                      title="Edit Clearance"
                      sx={{ color: theme.palette.primary.main }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedClearance(row);
                        setDeleteDialogOpen(true);
                      }}
                      title="Delete Clearance"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              },
            },
          ]}
          getRowId={(row) => row._id}
          loading={loading}
          disableRowSelectionOnClick
          error={error}
          components={{
            NoRowsOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center" }}>No clearances found</Box>
            ),
            ErrorOverlay: () => (
              <Box sx={{ p: 2, textAlign: "center", color: "error.main" }}>
                {error || "An error occurred"}
              </Box>
            ),
          }}
        />
      </Box>

      {/* Add Clearance Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add New Clearance</Typography>
            <IconButton onClick={() => setDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleAddClearance}>
          <DialogContent>
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{error}</Typography>
              </Box>
            )}
            <Stack spacing={3}>
              <FormControl fullWidth required>
                <InputLabel>Project</InputLabel>
                <Select
                  value={form.projectId}
                  label="Project"
                  onChange={(e) =>
                    setForm({ ...form, projectId: e.target.value })
                  }
                >
                  {Array.isArray(projects) &&
                    projects.map((project) => (
                      <MenuItem key={project._id} value={project._id}>
                        {project.projectID} - {project.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <TextField
                label="Clearance Date"
                type="date"
                value={form.clearanceDate}
                onChange={(e) =>
                  setForm({ ...form, clearanceDate: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <FormControl fullWidth required>
                <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                <Select
                  value={form.LAA}
                  label="LAA (Licensed Asbestos Assessor)"
                  onChange={(e) => setForm({ ...form, LAA: e.target.value })}
                >
                  {Array.isArray(users) &&
                    users.map((user) => (
                      <MenuItem key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Asbestos Removalist</InputLabel>
                <Select
                  value={form.asbestosRemovalist}
                  label="Asbestos Removalist"
                  onChange={(e) =>
                    setForm({ ...form, asbestosRemovalist: e.target.value })
                  }
                >
                  {ASBESTOS_REMOVALISTS.map((removalist) => (
                    <MenuItem key={removalist} value={removalist}>
                      {removalist}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Areas (comma-separated)"
                value={Array.isArray(form.areas) ? form.areas.join(", ") : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    areas: e.target.value.split(",").map((area) => area.trim()),
                  })
                }
                fullWidth
                helperText="Enter areas separated by commas"
              />
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.projectId ||
                !form.clearanceDate ||
                !form.LAA ||
                !form.asbestosRemovalist
              }
            >
              Add Clearance
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit Clearance Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Edit Clearance</Typography>
            <IconButton onClick={() => setEditDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveEdit}>
          <DialogContent>
            {error && (
              <Box
                sx={{
                  mb: 2,
                  p: 2,
                  backgroundColor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2">{error}</Typography>
              </Box>
            )}
            <Stack spacing={3}>
              <FormControl fullWidth required>
                <InputLabel>Project</InputLabel>
                <Select
                  value={form.projectId}
                  label="Project"
                  onChange={(e) =>
                    setForm({ ...form, projectId: e.target.value })
                  }
                >
                  {Array.isArray(projects) &&
                    projects.map((project) => (
                      <MenuItem key={project._id} value={project._id}>
                        {project.projectID} - {project.name}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <TextField
                label="Clearance Date"
                type="date"
                value={form.clearanceDate}
                onChange={(e) =>
                  setForm({ ...form, clearanceDate: e.target.value })
                }
                required
                fullWidth
                InputLabelProps={{
                  shrink: true,
                }}
              />
              <FormControl fullWidth required>
                <InputLabel>LAA (Licensed Asbestos Assessor)</InputLabel>
                <Select
                  value={form.LAA}
                  label="LAA (Licensed Asbestos Assessor)"
                  onChange={(e) => setForm({ ...form, LAA: e.target.value })}
                >
                  {Array.isArray(users) &&
                    users.map((user) => (
                      <MenuItem key={user._id} value={user._id}>
                        {user.firstName} {user.lastName}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Asbestos Removalist</InputLabel>
                <Select
                  value={form.asbestosRemovalist}
                  label="Asbestos Removalist"
                  onChange={(e) =>
                    setForm({ ...form, asbestosRemovalist: e.target.value })
                  }
                >
                  {ASBESTOS_REMOVALISTS.map((removalist) => (
                    <MenuItem key={removalist} value={removalist}>
                      {removalist}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Areas (comma-separated)"
                value={Array.isArray(form.areas) ? form.areas.join(", ") : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    areas: e.target.value.split(",").map((area) => area.trim()),
                  })
                }
                fullWidth
                helperText="Enter areas separated by commas"
              />
              <TextField
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                fullWidth
                multiline
                rows={3}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !form.projectId ||
                !form.clearanceDate ||
                !form.LAA ||
                !form.asbestosRemovalist
              }
            >
              Save Changes
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this clearance? This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteClearance}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AsbestosClearanceList;
