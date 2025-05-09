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
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

const PROJECTS_KEY = "ldc_projects";
const USERS_KEY = "ldc_users";

const emptyForm = {
  name: "",
  client: "",
  type: PROJECT_TYPES[0],
  address: "",
  users: [],
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

// Update the ProjectIdDisplay component to ensure proper formatting
const ProjectIdDisplay = ({ projectId }) => {
  // Ensure projectId is a number and format it
  const formattedId =
    typeof projectId === "number" ? projectId : parseInt(projectId);
  return (
    <Typography
      variant="body1"
      sx={{
        color: "text.secondary",
        mb: 2,
        fontFamily: "monospace",
        fontSize: "1.1rem",
      }}
    >
      Project ID: {`LDJ${String(formattedId).padStart(5, "0")}`}
    </Typography>
  );
};

// Helper functions outside the component
const generateProjectId = (projects) => {
  if (projects.length === 0) return 1;

  // Find the highest existing project ID
  const highestId = Math.max(
    ...projects.map((project) => {
      // Convert any existing IDs to numbers and get the numeric part
      const idStr = String(project.id);
      const numericPart = parseInt(idStr.replace(/\D/g, ""));
      return isNaN(numericPart) ? 0 : numericPart;
    })
  );
  return highestId + 1;
};

const resetProjectIds = (projects) => {
  return projects.map((project, index) => ({
    ...project,
    id: index + 1, // Start fresh from 1
  }));
};

// Main Projects component
const Projects = ({ toggleColorMode, mode }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterClient, setFilterClient] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState("asc");

  const initializeLocalStorage = () => {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (!stored) {
      console.log("Initializing localStorage with fake projects");
      const projectsWithIds = resetProjectIds(fakeProjects);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projectsWithIds));
    } else {
      // Reset IDs for existing projects
      const existingProjects = JSON.parse(stored);
      const resetProjects = resetProjectIds(existingProjects);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(resetProjects));
    }
  };

  const loadProjects = () => {
    try {
      const stored = localStorage.getItem(PROJECTS_KEY);
      console.log("Loading projects from localStorage:", stored);

      if (stored) {
        const parsedProjects = JSON.parse(stored);
        if (Array.isArray(parsedProjects) && parsedProjects.length > 0) {
          // Reset IDs for existing projects
          const resetProjects = resetProjectIds(parsedProjects);
          console.log("Setting projects with reset IDs:", resetProjects);
          setProjects(resetProjects);
        } else {
          console.error("Invalid stored data format");
          const projectsWithIds = resetProjectIds(fakeProjects);
          setProjects(projectsWithIds);
        }
      } else {
        console.log("No stored data found");
        const projectsWithIds = resetProjectIds(fakeProjects);
        setProjects(projectsWithIds);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
      const projectsWithIds = resetProjectIds(fakeProjects);
      setProjects(projectsWithIds);
    }
  };

  const loadUsers = () => {
    try {
      const stored = localStorage.getItem(USERS_KEY);
      if (stored) {
        const parsedUsers = JSON.parse(stored);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          setUsers(parsedUsers.filter((user) => user.isActive));
        }
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  useEffect(() => {
    initializeLocalStorage();
    loadProjects();
    loadUsers();
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchParam = searchParams.get("search");

    if (searchParam) {
      setFilterClient(searchParam);
    }
  }, [location.search]);

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

    const projectId = generateProjectId(projects);
    const newProject = {
      id: projectId,
      ...form,
      createdAt: new Date().toISOString(),
    };

    // Update state and localStorage
    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));

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
      users: project.users || [],
      status: project.status,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedProjects = projects.map((p) =>
      p.id === editId
        ? {
            ...p,
            ...editForm,
          }
        : p
    );

    // Update state and localStorage
    setProjects(updatedProjects);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));

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

  const handleGoToClient = (clientName) => {
    navigate(`/clients?search=${encodeURIComponent(clientName)}`);
  };

  const handleGoToProject = (projectId) => {
    navigate(`/projects/${projectId}`);
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

      <Paper sx={{ p: 2, mb: 4 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={filterStatus}
              label="Status Filter"
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="All">All Statuses</MenuItem>
              <MenuItem value="Active">Active</MenuItem>
              {INACTIVE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Client Filter</InputLabel>
            <Select
              value={filterClient}
              label="Client Filter"
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <MenuItem value="">All Clients</MenuItem>
              {uniqueClients.map((client) => (
                <MenuItem key={client} value={client}>
                  {client}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "id"}
                    direction={sortBy === "id" ? sortDir : "asc"}
                    onClick={() => handleSort("id")}
                  >
                    Project ID
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "name"}
                    direction={sortBy === "name" ? sortDir : "asc"}
                    onClick={() => handleSort("name")}
                  >
                    Project Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "client"}
                    direction={sortBy === "client" ? sortDir : "asc"}
                    onClick={() => handleSort("client")}
                  >
                    Client
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "type"}
                    direction={sortBy === "type" ? sortDir : "asc"}
                    onClick={() => handleSort("type")}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No projects found.
                  </TableCell>
                </TableRow>
              )}
              {sortedProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToProject(project.id)}
                    >
                      {`LDJ${String(project.id).padStart(5, "0")}`}
                    </Button>
                  </TableCell>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToClient(project.client)}
                    >
                      {project.client}
                    </Button>
                  </TableCell>
                  <TableCell>{project.type}</TableCell>
                  <EditableStatusCell
                    project={project}
                    onStatusChange={handleStatusChange}
                  />
                  <TableCell>
                    <IconButton
                      onClick={() => handleEditProject(project)}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        setDeleteId(project.id);
                        setDeleteDialogOpen(true);
                      }}
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
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Project Name"
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
                required
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <FormControl sx={{ flex: 1 }}>
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  {ACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Address"
              name="address"
              value={form.address}
              onChange={handleChange}
              fullWidth
              multiline
              rows={2}
            />
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
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Project Name"
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
                required
                sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <FormControl sx={{ flex: 1 }}>
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                >
                  {ACTIVE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Address"
              name="address"
              value={editForm.address}
              onChange={handleEditChange}
              fullWidth
              multiline
              rows={2}
            />
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
          <Button onClick={handleDeleteProject} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Projects;
