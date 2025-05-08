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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import TableSortLabel from "@mui/material/TableSortLabel";

const PROJECTS_KEY = "ldc_projects";
const PROJECT_TYPES = ["Air Monitoring", "Asbestos Assessment", "Other"];
const PROJECT_STATUSES = ["Active", "Completed", "On Hold", "Cancelled"];

const FAKE_PROJECTS = Array.from({ length: 15 }).map((_, i) => ({
  id: 1000 + i,
  name: `Project ${i + 1}`,
  client: `Client ${String.fromCharCode(65 + (i % 5))}`,
  type: PROJECT_TYPES[i % PROJECT_TYPES.length],
  address: `${100 + i} Example St, City ${(i % 3) + 1}`,
  users: [
    `user${i + 1}@example.com`,
    ...(i % 2 === 0 ? [`user${i + 2}@example.com`] : []),
  ],
  status: PROJECT_STATUSES[i % PROJECT_STATUSES.length],
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

const emptyForm = {
  name: "",
  client: "",
  type: PROJECT_TYPES[0],
  address: "",
  users: "",
  status: PROJECT_STATUSES[0], 
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
  const [filterStatus, setFilterStatus] = useState("Active");
  const [filterClient, setFilterClient] = useState("");

  // Load projects from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(PROJECTS_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setProjects(JSON.parse(stored));
    } else {
      setProjects(FAKE_PROJECTS);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(FAKE_PROJECTS));
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }, [projects]);

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
        .filter(Boolean),
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
      users: project.users ? project.users.join(", ") : "",
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
                .filter(Boolean),
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

  // Filtering and sorting
  const filteredProjects = projects.filter((p) => {
    // Only show not completed/cancelled by default
    const statusOk = !["Completed", "Cancelled"].includes(p.status);
    const statusMatch = !filterStatus || p.status === filterStatus;
    const clientMatch = !filterClient || p.client === filterClient;
    return statusOk && statusMatch && clientMatch;
  });
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (a[sortBy] < b[sortBy]) return sortDir === "asc" ? -1 : 1;
    if (a[sortBy] > b[sortBy]) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
  const uniqueClients = Array.from(new Set(projects.map((p) => p.client)));
  const uniqueStatuses = Array.from(new Set(projects.map((p) => p.status)));
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
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {uniqueStatuses.map((status) => (
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
                    Project Name
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
                <TableCell>Project Address</TableCell>
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
              {sortedProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No projects yet.
                  </TableCell>
                </TableRow>
              )}
              {sortedProjects.map((project) => (
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
                          <Chip key={idx} label={user} size="small" />
                        ))}
                      </Stack>
                    ) : null}
                  </TableCell>
                  <TableCell>{project.status}</TableCell>
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
                label="Project Address"
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
                  {PROJECT_STATUSES.map((status) => (
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
                label="Project Address"
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
                  {PROJECT_STATUSES.map((status) => (
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
