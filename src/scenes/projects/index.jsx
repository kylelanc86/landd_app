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
import { DataGrid } from "@mui/x-data-grid";
import { projectService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const PROJECTS_KEY = "ldc_projects";
const USERS_KEY = "ldc_users";

const PROJECT_TYPES = [
  "Air Monitoring",
  "Asbestos",
  "Lead",
  "Mold",
  "Radon",
  "Other",
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

// Main Projects component
const Projects = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectService.getAll();
        setProjects(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch projects");
        setLoading(false);
        console.error("Error fetching projects:", err);
      }
    };

    fetchProjects();
  }, []);

  const columns = [
    { field: "name", headerName: "Project Name", flex: 1 },
    { field: "type", headerName: "Type", flex: 1 },
    { field: "status", headerName: "Status", flex: 1 },
    { field: "address", headerName: "Location", flex: 1 },
    {
      field: "startDate",
      headerName: "Start Date",
      flex: 1,
      valueGetter: (params) => {
        if (!params || !params.row) return "Not set";
        return params.row.startDate
          ? new Date(params.row.startDate).toLocaleDateString()
          : "Not set";
      },
    },
    {
      field: "endDate",
      headerName: "End Date",
      flex: 1,
      valueGetter: (params) => {
        if (!params || !params.row) return "Not set";
        return params.row.endDate
          ? new Date(params.row.endDate).toLocaleDateString()
          : "Ongoing";
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => {
        if (!params || !params.row) return null;
        return (
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/projects/${params.row._id}`)}
          >
            View Details
          </Button>
        );
      },
    },
  ];

  if (loading) return <Typography>Loading projects...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="PROJECTS" subtitle="Managing your projects" />
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
          getRowId={(row) => row._id}
          pageSize={10}
          rowsPerPageOptions={[10]}
          checkboxSelection
          disableSelectionOnClick
        />
      </Box>
    </Box>
  );
};

export default Projects;
