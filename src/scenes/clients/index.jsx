import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { clientService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const Clients = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await clientService.getAll();
        setClients(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch clients");
        setLoading(false);
        console.error("Error fetching clients:", err);
      }
    };

    fetchClients();
  }, []);

  const columns = [
    { field: "name", headerName: "Client Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    { field: "address", headerName: "Address", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate(`/clients/${params.row._id}`)}
        >
          View Details
        </Button>
      ),
    },
  ];

  if (loading) return <Typography>Loading clients...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="CLIENTS" subtitle="Managing your clients" />
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
          rows={clients}
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

export default Clients;
