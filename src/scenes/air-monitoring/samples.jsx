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
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import { format, differenceInMinutes, parse } from "date-fns";
import { DataGrid } from "@mui/x-data-grid";
import { sampleService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Samples = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSamples = async () => {
      try {
        const response = await sampleService.getAll();
        setSamples(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch samples");
        setLoading(false);
        console.error("Error fetching samples:", err);
      }
    };

    fetchSamples();
  }, []);

  const columns = [
    { field: "projectName", headerName: "Project", flex: 1 },
    { field: "jobName", headerName: "Job", flex: 1 },
    { field: "shiftId", headerName: "Shift ID", flex: 1 },
    { field: "sampleType", headerName: "Sample Type", flex: 1 },
    { field: "location", headerName: "Location", flex: 1 },
    {
      field: "collectionTime",
      headerName: "Collection Time",
      flex: 1,
      valueGetter: (params) =>
        new Date(params.row.collectionTime).toLocaleString(),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(`/samples/${params.row._id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  if (loading) return <Typography>Loading samples...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="SAMPLES" subtitle="Managing your samples" />
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
          rows={samples}
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

export default Samples;
