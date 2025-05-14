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
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { projectService, clientService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import AddIcon from "@mui/icons-material/Add";
import { useJobStatus } from "../../hooks/useJobStatus";

const PROJECTS_KEY = "ldc_projects";
const USERS_KEY = "ldc_users";

const PROJECT_TYPES = [
  "air_quality",
  "water_quality",
  "soil_analysis",
  "other",
];

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

const StatusCell = ({ params, onStatusChange }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleStatusSelect = async (newStatus) => {
    try {
      const response = await projectService.update(params.row._id, {
        status: newStatus,
      });
      if (response.data) {
        onStatusChange(params.row._id, response.data.status);
      }
      handleClose();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    }
  };

  return (
    <Box>
      <Box
        onClick={handleClick}
        sx={{
          cursor: "pointer",
          "&:hover": {
            opacity: 0.8,
          },
        }}
      >
        <StatusChip status={params.value} />
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
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
            selected={params.value === status}
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
            selected={params.value === status}
          >
            <StatusChip status={status} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

// Main Projects component
const Projects = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { renderStatusCell, renderStatusSelect, renderEditStatusCell } =
    useJobStatus();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    client: "",
    type: PROJECT_TYPES[0],
    status: ACTIVE_STATUSES[0],
    address: "",
    startDate: "",
    endDate: "",
    description: "",
    projectManager: "",
  });
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectService.getAll();
        const formattedProjects = response.data.map((project) => {
          // Ensure status is one of the allowed values
          let status = project.status;
          if (
            ![
              "Assigned",
              "In progress",
              "Samples submitted",
              "Lab Analysis Complete",
              "Report sent for review",
              "Ready for invoicing",
              "Invoice sent",
              "Job complete",
              "On hold",
              "Quote sent",
              "Cancelled",
            ].includes(status)
          ) {
            status = "Assigned"; // Default to Assigned if status is invalid
          }

          return {
            id: project._id,
            ...project,
            status: status,
          };
        });
        setProjects(formattedProjects);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch projects");
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Fetch clients and users when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        const clientsResponse = await clientService.getAll();
        setClients(clientsResponse.data);
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    };
    fetchData();
  }, []);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    console.log("Form field changed:", name, value);
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("Submitting form with data:", editForm);

      const formattedData = {
        ...editForm,
        startDate: editForm.startDate
          ? new Date(editForm.startDate).toISOString()
          : null,
        endDate: editForm.endDate
          ? new Date(editForm.endDate).toISOString()
          : null,
      };

      console.log("Sending update with data:", formattedData);

      const response = await projectService.update(
        selectedProject._id,
        formattedData
      );

      if (response.data) {
        console.log("Update successful, response:", response.data);
        setProjects(
          projects.map((p) =>
            p._id === selectedProject._id ? { ...p, ...response.data } : p
          )
        );
        setDetailsDialogOpen(false);
      } else {
        throw new Error("No data received from server");
      }
    } catch (err) {
      console.error("Error updating project:", err);
      if (err.response) {
        alert(
          `Error updating project: ${
            err.response.data.message || "Unknown error"
          }`
        );
      } else {
        alert("Failed to update project. Please try again.");
      }
    }
  };

  const columns = [
    {
      field: "projectID",
      headerName: "Project ID",
      flex: 1,
    },
    {
      field: "name",
      headerName: "Project Name",
      flex: 1,
    },
    {
      field: "type",
      headerName: "Type",
      flex: 1,
      valueGetter: (params) => {
        const type = params;
        return type
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params) => (
        <StatusCell
          params={params}
          onStatusChange={(projectId, newStatus) => {
            setProjects((prevProjects) =>
              prevProjects.map((p) =>
                p._id === projectId ? { ...p, status: newStatus } : p
              )
            );
          }}
        />
      ),
      editable: false,
    },
    {
      field: "address",
      headerName: "Location",
      flex: 1,
    },
    {
      field: "startDate",
      headerName: "Start Date",
      flex: 1,
      valueGetter: (params) => {
        return new Date(params).toLocaleDateString();
      },
    },
    {
      field: "endDate",
      headerName: "End Date",
      flex: 1,
      valueGetter: (params) => {
        return params ? new Date(params).toLocaleDateString() : "Ongoing";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setSelectedProject(params.row);
            setEditForm(params.row);
            setDetailsDialogOpen(true);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const projectData = {
        ...form,
        startDate: form.startDate
          ? new Date(form.startDate).toISOString()
          : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        projectManager: form.projectManager || undefined,
      };

      const response = await projectService.create(projectData);
      setProjects([response.data, ...projects]);
      setDialogOpen(false);
      setForm({
        name: "",
        client: "",
        type: PROJECT_TYPES[0],
        status: ACTIVE_STATUSES[0],
        address: "",
        startDate: "",
        endDate: "",
        description: "",
        projectManager: "",
      });
    } catch (err) {
      if (err.response) {
        alert(
          `Error creating project: ${
            err.response.data.message || "Unknown error"
          }`
        );
      }
    }
  };

  const handleCellEditCommit = async (params) => {
    if (params.field === "status") {
      try {
        console.log("Cell edit commit params:", params);

        // Get the project ID from the row
        const projectId = params.row._id;
        if (!projectId) {
          throw new Error("No project ID found in row data");
        }

        // Create update object with only the status field
        const updateData = {
          status: params.value,
        };

        console.log("Sending update to backend:", {
          projectId,
          updateData,
        });

        // Send update to backend
        const response = await projectService.update(projectId, updateData);
        console.log("Backend response:", response);

        if (!response.data) {
          throw new Error("No data received from server");
        }

        // Update local state
        setProjects((prevProjects) => {
          const updatedProjects = prevProjects.map((p) => {
            if (p._id === projectId) {
              console.log("Updating project in state:", {
                before: p.status,
                after: response.data.status,
              });
              return { ...p, status: response.data.status };
            }
            return p;
          });
          return updatedProjects;
        });
      } catch (error) {
        console.error("Error in handleCellEditCommit:", error);
        alert("Failed to update project status. Please try again.");
      }
    }
  };

  if (loading) return <Typography>Loading projects...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="PROJECTS" subtitle="Managing your projects" />
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Create Project
        </Button>
      </Box>

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
            backgroundColor: colors.primary[600],
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: colors.primary[400],
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: colors.primary[600],
          },
          "& .MuiCheckbox-root": {
            color: `${colors.secondary[500]} !important`,
          },
        }}
      >
        <DataGrid
          rows={projects}
          columns={columns}
          components={{
            Toolbar: GridToolbar,
          }}
          getRowId={(row) => row._id}
          onCellEditCommit={handleCellEditCommit}
          editMode="cell"
          experimentalFeatures={{ newEditingApi: true }}
          processRowUpdate={async (newRow, oldRow) => {
            console.log("Processing row update:", { newRow, oldRow });
            try {
              const response = await projectService.update(newRow._id, {
                status: newRow.status,
              });
              console.log("Update response:", response);
              return response.data;
            } catch (error) {
              console.error("Error updating row:", error);
              throw error;
            }
          }}
          onProcessRowUpdateError={(error) => {
            console.error("Error processing row update:", error);
            alert("Failed to update project status. Please try again.");
          }}
        />
      </Box>

      {/* Project Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Project Details</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            {selectedProject && (
              <Stack spacing={2} sx={{ mt: 2 }}>
                <TextField
                  label="Project ID"
                  name="projectID"
                  value={editForm?.projectID || ""}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Project Name"
                  name="name"
                  value={editForm?.name || ""}
                  onChange={handleEditChange}
                  fullWidth
                  required
                />
                <FormControl fullWidth required>
                  <InputLabel>Type</InputLabel>
                  <Select
                    name="type"
                    value={editForm?.type || ""}
                    onChange={handleEditChange}
                    label="Type"
                  >
                    {PROJECT_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type
                          .split("_")
                          .map(
                            (word) =>
                              word.charAt(0).toUpperCase() + word.slice(1)
                          )
                          .join(" ")}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  {renderStatusSelect(editForm?.status, handleEditChange)}
                </FormControl>
                <TextField
                  label="Address"
                  name="address"
                  value={editForm?.address || ""}
                  onChange={handleEditChange}
                  fullWidth
                  required
                />
                <TextField
                  label="Start Date"
                  name="startDate"
                  type="date"
                  value={
                    editForm?.startDate
                      ? new Date(editForm.startDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={handleEditChange}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  name="endDate"
                  type="date"
                  value={
                    editForm?.endDate
                      ? new Date(editForm.endDate).toISOString().split("T")[0]
                      : ""
                  }
                  onChange={handleEditChange}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Client"
                  value={selectedProject.client?.name || "N/A"}
                  fullWidth
                  disabled
                />
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setDetailsDialogOpen(false)}
              color="secondary"
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Project</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Project ID"
                value="Will be auto-generated"
                disabled
                fullWidth
                sx={{
                  "& .MuiInputBase-input.Mui-disabled": {
                    WebkitTextFillColor: "#666",
                    fontStyle: "italic",
                  },
                }}
              />
              <TextField
                label="Project Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
              />
              <FormControl fullWidth required>
                <InputLabel>Client</InputLabel>
                <Select
                  name="client"
                  value={form.client}
                  onChange={handleChange}
                  label="Client"
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Project Type</InputLabel>
                <Select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  label="Project Type"
                >
                  {PROJECT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace("_", " ").toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                {renderStatusSelect(form.status, handleChange)}
              </FormControl>
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label="Start Date"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={handleChange}
                required
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Date"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth>
                <InputLabel>Project Manager</InputLabel>
                <Select
                  name="projectManager"
                  value={form.projectManager}
                  onChange={handleChange}
                  label="Project Manager"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user._id} value={user._id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Description"
                name="description"
                value={form.description}
                onChange={handleChange}
                multiline
                rows={4}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Create Project
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Projects;
