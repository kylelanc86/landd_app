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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  InputAdornment,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid } from "@mui/x-data-grid";
import { shiftService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Shifts = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const response = await shiftService.getAll();
        setShifts(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch shifts");
        setLoading(false);
        console.error("Error fetching shifts:", err);
      }
    };

    fetchShifts();
  }, []);

  const columns = [
    { field: "projectName", headerName: "Project", flex: 1 },
    { field: "jobName", headerName: "Job", flex: 1 },
    { field: "technician", headerName: "Technician", flex: 1 },
    {
      field: "startTime",
      headerName: "Start Time",
      flex: 1,
      valueGetter: (params) => new Date(params.row.startTime).toLocaleString(),
    },
    {
      field: "endTime",
      headerName: "End Time",
      flex: 1,
      valueGetter: (params) =>
        params.row.endTime
          ? new Date(params.row.endTime).toLocaleString()
          : "Ongoing",
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(`/shifts/${params.row._id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  if (loading) return <Typography>Loading shifts...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="SHIFTS" subtitle="Managing your shifts" />
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
            backgroundColor: colors.blueAccent[700],
            borderBottom: "none",
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: colors.primary[400],
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: colors.blueAccent[700],
          },
          "& .MuiCheckbox-root": {
            color: `${colors.greenAccent[200]} !important`,
          },
        }}
      >
        <DataGrid
          rows={shifts}
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

export default Shifts;
