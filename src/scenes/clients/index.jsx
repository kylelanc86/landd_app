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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { clients as initialClients } from "../../data/mockData";

const CLIENTS_KEY = "ldc_clients";

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
  const [clients, setClients] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  // Load clients from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(CLIENTS_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setClients(JSON.parse(stored));
    } else {
      setClients(initialClients);
      localStorage.setItem(CLIENTS_KEY, JSON.stringify(initialClients));
    }
  }, []);

  // Save clients to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }, [clients]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddClient = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const newClient = {
      id: Date.now(),
      ...form,
    };
    setClients([newClient, ...clients]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditClient = (client) => {
    setEditId(client.id);
    setEditForm({ ...client });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setClients(
      clients.map((c) => (c.id === editId ? { ...editForm, id: editId } : c))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
  };

  // Filtering and sorting
  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.invoiceEmail.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      c.contact1Name.toLowerCase().includes(q) ||
      c.contact1Email.toLowerCase().includes(q) ||
      c.contact2Name.toLowerCase().includes(q) ||
      c.contact2Email.toLowerCase().includes(q)
    );
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            color:
              theme.palette.mode === "dark"
                ? "#fff"
                : theme.palette.secondary[200],
            fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
            wordBreak: "break-word",
            hyphens: "auto",
          }}
        >
          Clients
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            backgroundColor: theme.palette.primary[500],
            "&:hover": {
              backgroundColor: theme.palette.primary[600],
            },
          }}
          onClick={() => setDialogOpen(true)}
        >
          Add Client
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon
                  sx={{
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  }}
                />
              </InputAdornment>
            ),
          }}
          sx={{
            width: 300,
            "& .MuiInputLabel-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
            },
            "& .MuiOutlinedInput-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
              "& fieldset": {
                borderColor:
                  theme.palette.mode === "dark"
                    ? "#fff"
                    : theme.palette.secondary[200],
              },
            },
          }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: "8px" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort("name")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Name {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("invoiceEmail")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Invoice Email{" "}
                {sortField === "invoiceEmail" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("address")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Address {sortField === "address" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedClients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{
                    color: theme.palette.mode === "dark" ? "#fff" : "inherit",
                  }}
                >
                  No clients found.
                </TableCell>
              </TableRow>
            )}
            {sortedClients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>{client.name}</TableCell>
                <TableCell>{client.invoiceEmail}</TableCell>
                <TableCell>{client.address}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() => handleEditClient(client)}
                    sx={{
                      color:
                        theme.palette.mode === "dark"
                          ? "#fff"
                          : theme.palette.secondary[200],
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Client Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Add New Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="name"
              label="Company Name"
              value={form.name}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="invoiceEmail"
              label="Invoice Email"
              value={form.invoiceEmail}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="address"
              label="Address"
              value={form.address}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact1Name"
              label="Primary Contact Name"
              value={form.contact1Name}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact1Number"
              label="Primary Contact Number"
              value={form.contact1Number}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact1Email"
              label="Primary Contact Email"
              value={form.contact1Email}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact2Name"
              label="Secondary Contact Name"
              value={form.contact2Name}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact2Number"
              label="Secondary Contact Number"
              value={form.contact2Number}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              name="contact2Email"
              label="Secondary Contact Email"
              value={form.contact2Email}
              onChange={handleChange}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddClient} variant="contained">
            Add Client
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              name="name"
              label="Company Name"
              value={editForm.name}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="invoiceEmail"
              label="Invoice Email"
              value={editForm.invoiceEmail}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="address"
              label="Address"
              value={editForm.address}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact1Name"
              label="Primary Contact Name"
              value={editForm.contact1Name}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact1Number"
              label="Primary Contact Number"
              value={editForm.contact1Number}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact1Email"
              label="Primary Contact Email"
              value={editForm.contact1Email}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact2Name"
              label="Secondary Contact Name"
              value={editForm.contact2Name}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact2Number"
              label="Secondary Contact Number"
              value={editForm.contact2Number}
              onChange={handleEditChange}
              fullWidth
            />
            <TextField
              name="contact2Email"
              label="Secondary Contact Email"
              value={editForm.contact2Email}
              onChange={handleEditChange}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;
