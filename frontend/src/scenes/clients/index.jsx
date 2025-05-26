import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  IconButton,
  DialogContentText,
  InputAdornment,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { clientService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";

const emptyForm = {
  name: "",
  invoiceEmail: "",
  address: "",
  contact1Name: "",
  contact1Number: "",
  contact1Email: "",
  contact2Name: "",
  contact2Number: "",
  contact2Email: "",
};

const Clients = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [search, setSearch] = useState("");

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await clientService.create(form);
      setClients([response.data, ...clients]);
      setDialogOpen(false);
      setForm(emptyForm);
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

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await clientService.update(editId, editForm);
      setClients(
        clients.map((client) =>
          client._id === editId ? response.data : client
        )
      );
      setEditDialogOpen(false);
      setEditForm(emptyForm);
      setEditId(null);
    } catch (err) {
      if (err.response) {
        alert(
          `Error updating client: ${
            err.response.data.message || "Unknown error"
          }`
        );
      }
    }
  };

  const handleEdit = (client) => {
    setEditForm({
      name: client.name,
      invoiceEmail: client.invoiceEmail,
      address: client.address,
      contact1Name: client.contact1Name,
      contact1Number: client.contact1Number,
      contact1Email: client.contact1Email,
      contact2Name: client.contact2Name || "",
      contact2Number: client.contact2Number || "",
      contact2Email: client.contact2Email || "",
    });
    setEditId(client._id);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = () => {
    setClientToDelete(clients.find((client) => client._id === editId));
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await clientService.delete(editId);
      setClients(clients.filter((client) => client._id !== editId));
      setDeleteDialogOpen(false);
      setEditDialogOpen(false);
      setClientToDelete(null);
      setEditId(null);
    } catch (err) {
      if (err.response) {
        alert(
          `Error deleting client: ${
            err.response.data.message || "Unknown error"
          }`
        );
      }
    }
  };

  // Filter clients based on search
  const filteredClients = clients.filter((client) => {
    const searchLower = search.toLowerCase();
    return (
      searchLower === "" ||
      client.name.toLowerCase().includes(searchLower) ||
      client.invoiceEmail.toLowerCase().includes(searchLower) ||
      client.contact1Name.toLowerCase().includes(searchLower) ||
      client.contact1Number.toLowerCase().includes(searchLower) ||
      client.address.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    { field: "name", headerName: "Client Name", flex: 1 },
    { field: "invoiceEmail", headerName: "Invoice Email", flex: 1 },
    { field: "contact1Name", headerName: "Primary Contact", flex: 1 },
    { field: "contact1Number", headerName: "Primary Phone", flex: 1 },
    { field: "address", headerName: "Address", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Box>
          <IconButton onClick={() => handleEdit(params.row)}>
            <EditIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) return <Typography>Loading clients...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="CLIENTS" subtitle="Managing your clients" />
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
          Add Client
        </Button>
      </Box>

      {/* Search Section */}
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
        <TextField
          label="Search Clients"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
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
          rows={filteredClients}
          columns={columns}
          getRowId={(row) => row._id}
          pageSize={10}
          rowsPerPageOptions={[10]}
          autoHeight
          disableSelectionOnClick
          components={{ Toolbar: GridToolbar }}
        />
      </Box>

      {/* Add Client Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Client</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Client Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                type="email"
                value={form.invoiceEmail}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                required
                fullWidth
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={form.contact1Name}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={form.contact1Number}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                type="email"
                value={form.contact1Email}
                onChange={handleChange}
                required
                fullWidth
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Secondary Contact (Optional)
              </Typography>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={form.contact2Name}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={form.contact2Number}
                onChange={handleChange}
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                type="email"
                value={form.contact2Email}
                onChange={handleChange}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Create Client
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Client</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              <TextField
                label="Client Name"
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <TextField
                label="Invoice Email"
                name="invoiceEmail"
                type="email"
                value={editForm.invoiceEmail}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <TextField
                label="Address"
                name="address"
                value={editForm.address}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={editForm.contact1Name}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={editForm.contact1Number}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                type="email"
                value={editForm.contact1Email}
                onChange={handleEditChange}
                required
                fullWidth
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Secondary Contact (Optional)
              </Typography>
              <TextField
                label="Contact Name"
                name="contact2Name"
                value={editForm.contact2Name}
                onChange={handleEditChange}
                fullWidth
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={editForm.contact2Number}
                onChange={handleEditChange}
                fullWidth
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                type="email"
                value={editForm.contact2Email}
                onChange={handleEditChange}
                fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={handleDeleteClick}
              color="error"
              startIcon={<DeleteIcon />}
            >
              Delete Client
            </Button>
            <Box sx={{ flex: "1" }} />
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
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {clientToDelete?.name}? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
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

export default Clients;
