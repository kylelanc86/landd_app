import React, { useState, useEffect, useCallback } from "react";
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
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  DialogContentText,
  Menu,
  Divider,
  Checkbox,
  ListItemText,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TableSortLabel from "@mui/material/TableSortLabel";
import {
  JOB_STATUS,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  StatusChip,
  UserAvatar,
} from "../../components/JobStatus";
import { PROJECT_TYPES, fakeProjects } from "../../data/mockData";
import { useLocation } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

const PROJECTS_KEY = "ldc_projects";

const emptyForm = {
  name: "",
  client: "",
  type: PROJECT_TYPES[0],
  address: "",
  users: "",
  status: ACTIVE_STATUSES[0],
};

const EditableStatusCell = ({ project, onStatusChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setIsEditing(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setIsEditing(false);
  };

  const handleStatusSelect = (newStatus) => {
    onStatusChange(project.id, newStatus);
    handleClose();
  };

  return (
    <TableCell>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box
          onClick={handleClick}
          sx={{
            cursor: "pointer",
            "&:hover": {
              opacity: 0.8,
            },
          }}
        >
          <StatusChip status={project.status} />
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={isEditing}
          onClose={handleClose}
          PaperProps={{
            sx: {
              maxHeight: 300,
              width: 250,
            },
          }}
        >
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Active Jobs
            </Typography>
          </MenuItem>
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={project.status === status}
            >
              <StatusChip status={status} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Inactive Jobs
            </Typography>
          </MenuItem>
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={project.status === status}
            >
              <StatusChip status={status} />
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </TableCell>
  );
};

const Projects = ({ toggleColorMode, mode }) => {
  const [projects, setProjects] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterClient, setFilterClient] = useState("");
  const location = useLocation();
  const theme = useTheme();

  const initializeLocalStorage = () => {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (!stored) {
      console.log("Initializing localStorage with fake projects");
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(fakeProjects));
    }
  };

  const loadProjects = () => {
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      console.log("Loading projects from localStorage:", stored);

      if (stored) {
        const parsedProjects = JSON.parse(stored);
        if (Array.isArray(parsedProjects) && parsedProjects.length > 0) {
          console.log("Setting projects from localStorage:", parsedProjects);
          setProjects(parsedProjects);
        } else {
          console.error("Invalid stored data format");
          setProjects(fakeProjects);
        }
      } else {
        console.log("No stored data found");
        setProjects(fakeProjects);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      setProjects(fakeProjects);
    }
  };

  useEffect(() => {
    initializeLocalStorage();
    loadProjects();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchParam = searchParams.get("search");

    if (searchParam) {
      setFilterClient(searchParam);
    }
  }, [location.search]);

  // Add this effect to handle URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get("status");

    if (statusParam) {
      if (statusParam === "active") {
        setFilterStatus("Active");
      } else {
        setFilterStatus(statusParam);
      }
    }
  }, [location.search]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const newProject = {
      id: Date.now(),
      ...form,
      users: form.users
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((name) => ({ name })),
      createdAt: new Date().toISOString(),
    };
    setProjects([newProject, ...projects]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditProject = (project) => {
    setEditId(project.id);
    setEditForm({
      name: project.name,
      client: project.client,
      type: project.type,
      address: project.address,
      users: project.users ? project.users.map((u) => u.name).join(", ") : "",
      status: project.status,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setProjects(
      projects.map((p) =>
        p.id === editId
          ? {
              ...p,
              ...editForm,
              users: editForm.users
                .split(",")
                .map((u) => u.trim())
                .filter(Boolean)
                .map((name) => ({ name })),
            }
          : p
      )
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleDeleteProject = () => {
    setProjects(projects.filter((p) => p.id !== deleteId));
    setDeleteDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteId(null);
  };

  const handleStatusChange = (projectId, newStatus) => {
    try {
      console.log("Changing status for project:", projectId, "to:", newStatus);

      // Create new array with updated project
      const updatedProjects = projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              status: newStatus,
            }
          : p
      );

      // Update state first
      setProjects(updatedProjects);

      // Then save to localStorage
      const projectsString = JSON.stringify(updatedProjects);
      localStorage.setItem(PROJECTS_KEY, projectsString);

      // Verify the save
      const savedData = localStorage.getItem(PROJECTS_KEY);
      if (!savedData) {
        throw new Error("Failed to save to localStorage");
      }
    } catch (error) {
      console.error("Error updating project status:", error);
      // Revert state if save failed
      setProjects(projects);
    }
  };

  const handleStatusFilterChange = (event) => {
    const value = event.target.value;
    if (value === "Active") {
      // If "Active" is selected, add all active statuses
      setFilterStatus("Active");
    } else {
      // For other statuses, toggle them individually
      setFilterStatus((prev) => {
        // Remove the status if it's already selected
        if (prev.includes(value)) {
          return prev.filter((status) => status !== value);
        }
        // Add the status if it's not selected
        return [...prev, value];
      });
    }
  };

  // Filtering and sorting
  const getFilteredProjects = useCallback(() => {
    let filtered = [...projects];

    // Apply status filter
    if (filterStatus && filterStatus !== "All") {
      if (filterStatus === "Active") {
        filtered = filtered.filter((project) =>
          ACTIVE_STATUSES.includes(project.status)
        );
      } else {
        filtered = filtered.filter(
          (project) => project.status === filterStatus
        );
      }
    }

    // Apply client filter
    if (filterClient) {
      const searchLower = filterClient.toLowerCase();
      filtered = filtered.filter((project) =>
        project.client.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (sortDir === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [projects, filterStatus, filterClient, sortBy, sortDir]);

  const sortedProjects = [...getFilteredProjects()];
  const uniqueClients = Array.from(new Set(projects.map((p) => p.client)));
  const uniqueStatuses = [...ACTIVE_STATUSES, ...INACTIVE_STATUSES];
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };
  const handleGoToClient = (client) => {
    window.location.href = `/clients?search=${encodeURIComponent(client)}`;
  };
  const handleGoToProject = (projectId) => {
    window.location.href = `/projects?search=${encodeURIComponent(projectId)}`;
  };

  // Add a useEffect to monitor projects changes
  useEffect(() => {
    console.log("Projects state changed:", projects);
  }, [projects]);

  // Add a useEffect to monitor localStorage changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === PROJECTS_KEY) {
        console.log("localStorage changed:", e.newValue);
        try {
          const newProjects = JSON.parse(e.newValue);
          setProjects(newProjects);
        } catch (error) {
          console.error("Error parsing localStorage data:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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
          Projects
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setDialogOpen(true)}
        >
          Add Project
        </Button>
      </Box>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", mb: 2, gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="Active">Active Projects</MenuItem>
              <Divider />
              <MenuItem disabled>
                <Typography variant="subtitle2" color="text.secondary">
                  Individual Statuses
                </Typography>
              </MenuItem>
              {[...ACTIVE_STATUSES, ...INACTIVE_STATUSES].map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {uniqueClients.map((client) => (
                <MenuItem key={client} value={client}>
                  {client}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Typography variant="h6" sx={{ mb: 1, fontSize: { xs: 22, md: 28 } }}>
          Project Register
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell
                  onClick={() => handleSort("id")}
                  style={{ cursor: "pointer" }}
                >
                  <TableSortLabel
                    active={sortBy === "id"}
                    direction={sortBy === "id" ? sortDir : "asc"}
                  >
                    Project ID
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  onClick={() => handleSort("name")}
                  style={{ cursor: "pointer" }}
                >
                  <TableSortLabel
                    active={sortBy === "name"}
                    direction={sortBy === "name" ? sortDir : "asc"}
                  >
                    Address/Name
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  onClick={() => handleSort("client")}
                  style={{ cursor: "pointer" }}
                >
                  <TableSortLabel
                    active={sortBy === "client"}
                    direction={sortBy === "client" ? sortDir : "asc"}
                  >
                    Client
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  onClick={() => handleSort("type")}
                  style={{ cursor: "pointer" }}
                >
                  <TableSortLabel
                    active={sortBy === "type"}
                    direction={sortBy === "type" ? sortDir : "asc"}
                  >
                    Project Type
                  </TableSortLabel>
                </TableCell>
                <TableCell>Secondary Address/Name</TableCell>
                <TableCell>Users</TableCell>
                <TableCell
                  onClick={() => handleSort("status")}
                  style={{ cursor: "pointer" }}
                >
                  <TableSortLabel
                    active={sortBy === "status"}
                    direction={sortBy === "status" ? sortDir : "asc"}
                  >
                    Project Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getFilteredProjects().length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No projects yet.
                  </TableCell>
                </TableRow>
              )}
              {getFilteredProjects().map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToProject(project.id)}
                    >{`LDJ${String(project.id).padStart(5, "0")}`}</Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToProject(project.id)}
                    >
                      {project.name}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToClient(project.client)}
                    >
                      {project.client}
                    </Button>
                  </TableCell>
                  <TableCell>{project.type}</TableCell>
                  <TableCell>{project.address}</TableCell>
                  <TableCell>
                    {project.users && project.users.length > 0 ? (
                      <Stack direction="row" spacing={1}>
                        {project.users.map((user, idx) => (
                          <UserAvatar key={idx} user={user} />
                        ))}
                      </Stack>
                    ) : null}
                  </TableCell>
                  <EditableStatusCell
                    project={project}
                    onStatusChange={handleStatusChange}
                  />
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEditProject(project)}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {/* Add Project Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Project</DialogTitle>
        <form onSubmit={handleAddProject}>
          <DialogContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Address/Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Client"
                name="client"
                value={form.client}
                onChange={handleChange}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Project Type</InputLabel>
                <Select
                  label="Project Type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                >
                  {PROJECT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Secondary Address/Name"
                name="address"
                value={form.address}
                onChange={handleChange}
                sx={{ flex: 2 }}
              />
              <TextField
                label="Users (comma separated)"
                name="users"
                value={form.users}
                onChange={handleChange}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  <MenuItem disabled>
                    <Typography variant="subtitle2" color="text.secondary">
                      Active Jobs
                    </Typography>
                  </MenuItem>
                  {ACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                  <MenuItem disabled>
                    <Typography variant="subtitle2" color="text.secondary">
                      Inactive Jobs
                    </Typography>
                  </MenuItem>
                  {INACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Add Project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* Edit Project Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Project</DialogTitle>
        <form onSubmit={handleSaveEdit}>
          <DialogContent>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Address/Name"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Client"
                name="client"
                value={editForm.client}
                onChange={handleEditChange}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Project Type</InputLabel>
                <Select
                  label="Project Type"
                  name="type"
                  value={editForm.type}
                  onChange={handleEditChange}
                >
                  {PROJECT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Secondary Address/Name"
                name="address"
                value={editForm.address}
                onChange={handleEditChange}
                sx={{ flex: 2 }}
              />
              <TextField
                label="Users (comma separated)"
                name="users"
                value={editForm.users}
                onChange={handleEditChange}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                >
                  <MenuItem disabled>
                    <Typography variant="subtitle2" color="text.secondary">
                      Active Jobs
                    </Typography>
                  </MenuItem>
                  {ACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                  <MenuItem disabled>
                    <Typography variant="subtitle2" color="text.secondary">
                      Inactive Jobs
                    </Typography>
                  </MenuItem>
                  {INACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button
              color="error"
              onClick={() => {
                setDeleteId(editId);
                setDeleteDialogOpen(true);
              }}
            >
              Delete Project
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this project? This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="secondary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteProject}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;
