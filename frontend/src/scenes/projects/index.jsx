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
  InputAdornment,
  Switch,
  FormControlLabel,
  Autocomplete,
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
import { projectService, clientService, userService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import AddIcon from "@mui/icons-material/Add";
import { useJobStatus } from "../../hooks/useJobStatus";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";

const PROJECTS_KEY = "ldc_projects";
const USERS_KEY = "ldc_users";

const PROJECT_TYPES = [
  "air_quality",
  "water_quality",
  "soil_analysis",
  "other",
];

const DEPARTMENTS = [
  "Asbestos & HAZMAT",
  "Occupational Hygiene",
  "Client Supplied",
];

const CATEGORIES = [
  "Asbestos Materials Assessment",
  "Asbestos & Lead Paint Assessment",
  "Lead Paint/Dust Assessment",
  "Air Monitoring and Clearance",
  "Clearance Certificate",
  "Commercial Asbestos Management Plan",
  "Hazardous Materials Management Plan",
  "Residential Asbestos Survey",
  "Silica Air Monitoring",
  "Mould/Moisture Assessment",
  "Other",
];

const emptyForm = {
  name: "",
  client: "",
  department: PROJECT_TYPES[0],
  category: "",
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

// Update the getInitials function
const getInitials = (user) => {
  if (!user) return "";

  let name = "";
  if (user.firstName && user.lastName) {
    name = `${user.firstName} ${user.lastName}`;
  } else if (user.name) {
    name = user.name;
  } else {
    return "";
  }

  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

// Update the getRandomColor function to be more robust
const getRandomColor = (user) => {
  // A more diverse and visually pleasing color palette
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFD93D", // golden yellow
    "#FF8B94", // soft pink
    "#6C5CE7", // purple
    "#00B894", // mint green
    "#FDCB6E", // amber
    "#E17055", // terracotta
    "#0984E3", // ocean blue
    "#6C5CE7", // royal purple
    "#00B894", // emerald
    "#FDCB6E", // marigold
    "#E17055", // rust
    "#00CEC9", // teal
    "#FF7675", // salmon
    "#74B9FF", // light blue
    "#A29BFE", // lavender
    "#55EFC4", // mint
  ];

  // Create a consistent hash from the user's name or ID
  let identifier;
  if (user.name) {
    identifier = user.name;
  } else if (user.firstName && user.lastName) {
    identifier = `${user.firstName} ${user.lastName}`;
  } else if (user._id) {
    identifier = user._id;
  } else {
    identifier = Math.random().toString();
  }

  // Create a hash from the identifier
  const hash = identifier.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  // Use the hash to select a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// Main Projects component
const Projects = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const location = useLocation();
  const { renderStatusCell, renderStatusSelect, renderEditStatusCell } =
    useJobStatus();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get("status") || "all";
  });
  const [showInactive, setShowInactive] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    invoiceEmail: "",
    contact1Name: "",
    contact1Number: "",
    contact1Email: "",
    contact2Name: "",
    contact2Number: "",
    contact2Email: "",
  });

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectService.getAll();
        console.log("Raw API response:", response.data);

        // Fetch all users first
        const usersResponse = await userService.getAll();
        const usersMap = new Map(
          usersResponse.data.map((user) => [user._id, user])
        );
        console.log("Users map:", usersMap);

        const formattedProjects = response.data.map((project) => {
          console.log("Processing project:", project);

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

          // Transform users data to include full user objects
          const transformedUsers = project.users
            ? project.users
                .map((user) => {
                  // Handle both string IDs and full user objects
                  const userId = typeof user === "string" ? user : user._id;
                  const userData = usersMap.get(userId);
                  if (!userData) {
                    console.warn("User not found:", user);
                    return null;
                  }
                  // Ensure we have the full user object with name
                  return {
                    _id: userData._id,
                    name:
                      userData.name ||
                      `${userData.firstName} ${userData.lastName}`.trim(),
                    firstName: userData.firstName || "",
                    lastName: userData.lastName || "",
                    email: userData.email || "",
                  };
                })
                .filter(Boolean)
            : [];

          // Create formatted project without overwriting type
          const formattedProject = {
            id: project._id,
            _id: project._id,
            projectID: project.projectID,
            name: project.name,
            client: project.client,
            department: project.department || "other",
            category: project.category || "",
            status: status,
            address: project.address,
            description: project.description,
            users: transformedUsers,
          };

          console.log("Formatted project:", formattedProject);
          return formattedProject;
        });

        setProjects(formattedProjects);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching projects:", err);
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

  // Add useEffect to fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        console.log("Fetching users...");
        const token = localStorage.getItem("token");
        if (!token) {
          console.error("No authentication token found");
          setLoadingUsers(false);
          return;
        }

        const response = await userService.getAll();
        console.log("Users fetched:", response.data);

        // Transform the user data to include full name
        const transformedUsers = response.data.map((user) => ({
          ...user,
          name: `${user.firstName} ${user.lastName}`,
        }));

        setUsers(transformedUsers);
        setLoadingUsers(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    console.log("Form field changed:", name, value);

    if (name === "users") {
      // For users, ensure we're storing an array of user IDs
      setEditForm((prev) => ({
        ...prev,
        users: value, // value is already an array of user IDs from the Select component
      }));
    } else {
      setEditForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("Submitting edit form:", editForm);

      // Create a clean update object with only the necessary fields
      const formattedData = {
        name: editForm.name,
        department: editForm.department,
        category: editForm.category || "",
        status: editForm.status,
        address: editForm.address,
        users: editForm.users || [],
      };

      console.log("Sending update to backend:", formattedData);
      const response = await projectService.update(
        selectedProject._id,
        formattedData
      );

      if (response.data) {
        console.log("Received response from backend:", response.data);
        // Update the projects state with the new data
        setProjects((prevProjects) =>
          prevProjects.map((p) => {
            if (p._id === selectedProject._id) {
              // Create a new project object with the updated data
              const updatedProject = {
                ...p,
                ...response.data,
                category: response.data.category || "",
                users: response.data.users || [],
                id: response.data._id,
              };
              console.log("Updated project in state:", updatedProject);
              return updatedProject;
            }
            return p;
          })
        );
        setDetailsDialogOpen(false);
      }
    } catch (err) {
      console.error("Error updating project:", err);
      if (err.response) {
        alert(
          `Error updating project: ${
            err.response.data.message || "Unknown error"
          }`
        );
      }
    }
  };

  const handleRemoveUser = async (projectId, userId) => {
    try {
      // Get the current project
      const project = projects.find((p) => p._id === projectId);
      if (!project) return;

      // Remove the user from the users array
      const updatedUsers = project.users.filter((user) => user._id !== userId);

      // Create update object
      const updateData = {
        ...project,
        users: updatedUsers.map((user) => user._id), // Send only user IDs to backend
      };

      // Send update to backend
      const response = await projectService.update(projectId, updateData);

      if (response.data) {
        // Update local state
        setProjects((prevProjects) =>
          prevProjects.map((p) => {
            if (p._id === projectId) {
              return {
                ...p,
                ...response.data,
                users: response.data.users || [],
              };
            }
            return p;
          })
        );
      }
    } catch (error) {
      console.error("Error removing user:", error);
      alert("Failed to remove user. Please try again.");
    }
  };

  const columns = [
    {
      field: "projectID",
      headerName: "Project ID",
      flex: 0.6,
    },
    {
      field: "name",
      headerName: "Project Name",
      flex: 1,
    },
    {
      field: "department",
      headerName: "Department",
      flex: 1,
      renderCell: (params) => {
        const department = params.row.department;
        if (!department) return "Other";

        // Handle air_quality specifically
        if (department === "air_quality") return "Air Quality";

        // Handle other types
        return department
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      },
    },
    {
      field: "category",
      headerName: "Category",
      flex: 1.5,
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
      field: "users",
      headerName: "Assigned Users",
      flex: 1,
      renderCell: (params) => {
        if (!params || !params.row) return null;
        const users = params.row.users || [];
        return (
          <UsersCell
            users={users}
            onRemoveUser={(userId) => handleRemoveUser(params.row._id, userId)}
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 0.5,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setSelectedProject(params.row);
            setEditForm({
              ...params.row,
              users: params.row.users.map((user) => user._id),
            });
            setDetailsDialogOpen(true);
          }}
        >
          Details
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
        users: form.users || [],
        category: form.category || "",
      };

      const response = await projectService.create(projectData);
      setProjects([response.data, ...projects]);
      setDialogOpen(false);
      setForm({
        name: "",
        client: "",
        department: PROJECT_TYPES[0],
        category: "",
        status: ACTIVE_STATUSES[0],
        address: "",
        description: "",
        users: [],
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

  // Filter projects based on search, status, and inactive toggle
  const filteredProjects = projects.filter((project) => {
    const searchTerm = search.toLowerCase();
    const projectName = project.name?.toLowerCase() || "";
    const projectAddress = project.address?.toLowerCase() || "";
    const clientName = (project.client?.name || "").toLowerCase();

    const matchesSearch =
      searchTerm === "" ||
      projectName.includes(searchTerm) ||
      projectAddress.includes(searchTerm) ||
      clientName.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;

    const matchesActiveFilter =
      showInactive || ACTIVE_STATUSES.includes(project.status);

    const matchesDepartment =
      departmentFilter === "all" || project.department === departmentFilter;

    return (
      matchesDepartment && matchesSearch && matchesStatus && matchesActiveFilter
    );
  });

  // Update the UsersCell component
  const UsersCell = ({ users, onRemoveUser }) => {
    if (loadingUsers)
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: "52px",
            justifyContent: "center",
          }}
        >
          <Typography>Loading users...</Typography>
        </Box>
      );

    if (!users || users.length === 0)
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: "52px",
            justifyContent: "center",
          }}
        >
          <Typography>No users assigned</Typography>
        </Box>
      );

    return (
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        gap={1}
        sx={{
          alignItems: "center",
          minHeight: "52px",
          py: 1,
        }}
      >
        {users.map((user) => {
          if (!user) return null;

          // Get user name and initials
          const userDisplayName =
            user.name || `${user.firstName} ${user.lastName}`.trim();
          if (!userDisplayName) return null;

          const userInitials = userDisplayName
            .split(" ")
            .map((word) => word[0])
            .join("")
            .toUpperCase();

          const bgColor = getRandomColor(user);

          return (
            <Box
              key={user._id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                backgroundColor: "background.paper",
                borderRadius: "50%",
                padding: "4px",
                border: "1px solid",
                borderColor: "divider",
                position: "relative",
                "&:hover .remove-button": {
                  opacity: 1,
                },
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: bgColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "0.875rem",
                  fontWeight: "bold",
                }}
              >
                {userInitials}
              </Box>
              <IconButton
                className="remove-button"
                size="small"
                onClick={() => onRemoveUser(user._id)}
                sx={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  backgroundColor: "error.main",
                  color: "white",
                  width: 20,
                  height: 20,
                  opacity: 0,
                  transition: "opacity 0.2s",
                  "&:hover": {
                    backgroundColor: "error.dark",
                  },
                }}
              >
                <Typography sx={{ fontSize: "0.75rem", lineHeight: 1 }}>
                  ×
                </Typography>
              </IconButton>
            </Box>
          );
        })}
      </Stack>
    );
  };

  // Update the renderUsersSelect function
  const renderUsersSelect = (value, onChange, name) => {
    console.log("Rendering users select with:", { value, users });

    // Ensure value is always an array of user IDs
    const selectedUserIds = Array.isArray(value) ? value : [];

    return (
      <FormControl fullWidth>
        <InputLabel>Assigned Users</InputLabel>
        <Select
          multiple
          name={name}
          value={selectedUserIds}
          onChange={onChange}
          label="Assigned Users"
          disabled={loadingUsers}
          renderValue={(selected) => (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {selected.map((userId) => {
                const user = users.find((u) => u._id === userId);
                if (!user) return null;
                const displayName =
                  user.name || `${user.firstName} ${user.lastName}`.trim();
                return <Chip key={userId} label={displayName} size="small" />;
              })}
            </Box>
          )}
        >
          {users && users.length > 0 ? (
            users.map((user) => {
              const displayName =
                user.name || `${user.firstName} ${user.lastName}`.trim();
              return (
                <MenuItem key={user._id} value={user._id}>
                  {displayName}
                </MenuItem>
              );
            })
          ) : (
            <MenuItem disabled>No users available</MenuItem>
          )}
        </Select>
      </FormControl>
    );
  };

  // Add function to handle new client creation
  const handleNewClientSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await clientService.create(newClient);
      setClients([...clients, response.data]);
      setForm({ ...form, client: response.data._id });
      setClientDialogOpen(false);
      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        invoiceEmail: "",
        contact1Name: "",
        contact1Number: "",
        contact1Email: "",
        contact2Name: "",
        contact2Number: "",
        contact2Email: "",
      });
    } catch (err) {
      if (err.response) {
        alert(
          `Error creating client: ${
            err.response.data.message || "Unknown error"
          }`
        );
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
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.secondary.main,
            "&:hover": { backgroundColor: theme.palette.secondary.dark },
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          Add Project
        </Button>
      </Box>

      {/* Search and Filter Section */}
      <Box
        mt="20px"
        mb="20px"
        sx={{
          backgroundColor: "background.paper",
          borderRadius: "4px",
          boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
          p: 2,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Search Projects"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              {ACTIVE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
              {INACTIVE_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                color="primary"
              />
            }
            label="Show Inactive Projects"
          />
        </Stack>
      </Box>

      {/* Department Filter Buttons */}
      <Box display="flex" gap={2} mb={2}>
        <Button
          variant={departmentFilter === "all" ? "contained" : "outlined"}
          color="primary"
          onClick={() => setDepartmentFilter("all")}
        >
          All Departments
        </Button>
        <Button
          variant={
            departmentFilter === "Asbestos & HAZMAT" ? "contained" : "outlined"
          }
          color="secondary"
          onClick={() => setDepartmentFilter("Asbestos & HAZMAT")}
        >
          Asbestos & HAZMAT
        </Button>
        <Button
          variant={
            departmentFilter === "Occupational Hygiene"
              ? "contained"
              : "outlined"
          }
          onClick={() => setDepartmentFilter("Occupational Hygiene")}
          sx={{
            backgroundColor:
              departmentFilter === "Occupational Hygiene"
                ? "#FF9800"
                : "transparent",
            color:
              departmentFilter === "Occupational Hygiene" ? "#fff" : "#FF9800",
            borderColor: "#FF9800",
            "&:hover": {
              backgroundColor: "#F57C00",
              color: "#fff",
              borderColor: "#F57C00",
            },
          }}
        >
          Occupational Hygiene
        </Button>
        <Button
          variant={
            departmentFilter === "Client Supplied" ? "contained" : "outlined"
          }
          onClick={() => setDepartmentFilter("Client Supplied")}
          sx={{
            backgroundColor:
              departmentFilter === "Client Supplied"
                ? "#9c27b0"
                : "transparent",
            color: departmentFilter === "Client Supplied" ? "#fff" : "#9c27b0",
            "&:hover": {
              backgroundColor: "#9c27b0",
              color: "#fff",
            },
          }}
        >
          Client Supplied
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
          rows={filteredProjects}
          columns={columns}
          getRowId={(row) => row._id}
          pageSize={10}
          rowsPerPageOptions={[10]}
          autoHeight
          disableSelectionOnClick
          components={{ Toolbar: GridToolbar }}
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
                  <InputLabel>Department</InputLabel>
                  <Select
                    name="department"
                    value={editForm?.department || ""}
                    onChange={handleEditChange}
                    label="Department"
                  >
                    {DEPARTMENTS.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    name="category"
                    value={editForm?.category || ""}
                    onChange={handleEditChange}
                    label="Category"
                  >
                    {CATEGORIES.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
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
                />
                <TextField
                  label="Client"
                  value={selectedProject.client?.name || "N/A"}
                  fullWidth
                  disabled
                />
                {renderUsersSelect(
                  editForm?.users || [],
                  handleEditChange,
                  "users"
                )}
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
              <Box>
                <Autocomplete
                  options={clients}
                  getOptionLabel={(option) => option.name || ""}
                  value={
                    clients.find((client) => client._id === form.client) || null
                  }
                  onChange={(event, newValue) => {
                    setForm({
                      ...form,
                      client: newValue ? newValue._id : "",
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Client" required fullWidth />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box>
                        <Typography variant="body1">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.address}
                        </Typography>
                      </Box>
                    </li>
                  )}
                  isOptionEqualToValue={(option, value) =>
                    option._id === value._id
                  }
                  filterOptions={(options, { inputValue }) => {
                    const searchTerm = inputValue.toLowerCase();
                    return options.filter(
                      (option) =>
                        option.name.toLowerCase().includes(searchTerm) ||
                        (option.address || "")
                          .toLowerCase()
                          .includes(searchTerm)
                    );
                  }}
                />
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setClientDialogOpen(true)}
                  sx={{ mt: 1 }}
                >
                  Add New Client
                </Button>
              </Box>
              <FormControl fullWidth required>
                <InputLabel>Department</InputLabel>
                <Select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  label="Department"
                >
                  {DEPARTMENTS.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  label="Category"
                >
                  {CATEGORIES.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
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
                fullWidth
              />
              {renderUsersSelect(form.users, handleChange, "users")}
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

      {/* Add New Client Dialog */}
      <Dialog
        open={clientDialogOpen}
        onClose={() => setClientDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Client</DialogTitle>
        <form onSubmit={handleNewClientSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Client Name"
                name="name"
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                type="email"
                value={newClient.invoiceEmail}
                onChange={(e) =>
                  setNewClient({ ...newClient, invoiceEmail: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Phone"
                name="phone"
                value={newClient.phone}
                onChange={(e) =>
                  setNewClient({ ...newClient, phone: e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Address"
                name="address"
                value={newClient.address}
                onChange={(e) =>
                  setNewClient({ ...newClient, address: e.target.value })
                }
                fullWidth
              />
              <Typography
                variant="subtitle1"
                sx={{ mt: 2, fontWeight: "bold" }}
              >
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={newClient.contact1Name}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact1Name: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={newClient.contact1Number}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact1Number: e.target.value })
                }
                required
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                type="email"
                value={newClient.contact1Email}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact1Email: e.target.value })
                }
                required
                fullWidth
              />
              <Typography
                variant="subtitle1"
                sx={{ mt: 2, fontWeight: "bold" }}
              >
                Secondary Contact (Optional)
              </Typography>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={newClient.contact2Name}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact2Name: e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={newClient.contact2Number}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact2Number: e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                type="email"
                value={newClient.contact2Email}
                onChange={(e) =>
                  setNewClient({ ...newClient, contact2Email: e.target.value })
                }
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setClientDialogOpen(false)}
              color="secondary"
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Add Client
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Projects;
