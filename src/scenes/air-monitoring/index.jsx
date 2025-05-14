import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrintIcon from "@mui/icons-material/Print";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { jobService, projectService } from "../../services/api";
import { DataGrid } from "@mui/x-data-grid";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const JOBS_KEY = "ldc_jobs";

const emptyForm = {
  projectId: "",
  status: "Pending",
  startDate: "",
  endDate: "",
  description: "",
  location: "",
  supervisor: "",
};

const AirMonitoring = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [jobsResponse, projectsResponse] = await Promise.all([
          jobService.getAll(),
          projectService.getAll(),
        ]);
        setJobs(jobsResponse.data);
        setProjects(projectsResponse.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch data");
        setLoading(false);
        console.error("Error fetching data:", err);
      }
    };

    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddJob = (e) => {
    e.preventDefault();
    if (!selectedProject) return;

    const newJob = {
      id: Date.now(),
      projectId: selectedProject.id,
      status: "Pending",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      description: `Air monitoring job for ${selectedProject.name}`,
      location: selectedProject.location || "",
      supervisor: "",
    };

    const updatedJobs = [newJob, ...jobs];
    setJobs(updatedJobs);
    localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
    setOpenDialog(false);
    setSelectedProject(null);
    setSearchQuery("");
  };

  const handleEditJob = (job) => {
    setEditId(job.id);
    setEditForm({ ...job });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updatedJobs = jobs.map((j) =>
      j.id === editId ? { ...editForm, id: editId } : j
    );
    setJobs(updatedJobs);
    localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  const handleViewShifts = (jobId) => {
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  const handleDeleteClick = (e, job) => {
    e.stopPropagation();
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (jobToDelete) {
      const updatedJobs = jobs.filter((job) => job.id !== jobToDelete.id);
      setJobs(updatedJobs);
      localStorage.setItem(JOBS_KEY, JSON.stringify(updatedJobs));
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  // Filtering and sorting
  const filteredJobs = jobs.filter((j) => {
    const q = search.toLowerCase();
    const project = projects.find((p) => p._id === j.projectId);

    return (
      (j.projectId?.toString() || "").toLowerCase().includes(q) ||
      (project?.name || "").toLowerCase().includes(q) ||
      (j.status || "").toLowerCase().includes(q) ||
      (j.startDate || "").toLowerCase().includes(q)
    );
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (!a[sortField] && !b[sortField]) return 0;
    if (!a[sortField]) return sortAsc ? 1 : -1;
    if (!b[sortField]) return sortAsc ? -1 : 1;

    if (a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Analysis":
        return theme.palette.warning.light;
      case "Complete":
        return theme.palette.success.light;
      case "Ready for Analysis":
        return theme.palette.info.light;
      default:
        return theme.palette.grey[300];
    }
  };

  const handleOpenJob = (jobId) => {
    navigate(`/air-monitoring/jobs/${jobId}/shifts`);
  };

  const handleCloseReport = (jobId) => {
    // Implement close report functionality
    console.log("Close report for job:", jobId);
  };

  const handlePrintReport = (jobId) => {
    // Implement print report functionality
    console.log("Print report for job:", jobId);
  };

  const columns = [
    { field: "name", headerName: "Job Name", flex: 1 },
    { field: "status", headerName: "Status", flex: 1 },
    { field: "location", headerName: "Location", flex: 1 },
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
            onClick={() =>
              navigate(`/air-monitoring/jobs/${params.row._id}/shifts`)
            }
          >
            View Details
          </Button>
        );
      },
    },
  ];

  if (loading) return <Typography>Loading jobs...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="AIR MONITORING" subtitle="Managing your monitoring jobs" />
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
          rows={filteredJobs}
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

export default AirMonitoring;
