import { useState, useEffect, useCallback, memo, useRef } from "react";
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
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Divider,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { clientService, userPreferencesService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import {
  formatPhoneNumber,
  isValidAustralianMobile,
} from "../../utils/formatters";
import { debounce } from "lodash";

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
  console.log("Clients component rendering");

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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    pages: 0,
  });
  const searchInputRef = useRef(null);

  // Column visibility state
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    name: true,
    invoiceEmail: true,
    contact1Name: true,
    contact1Number: true,
    address: true,
    actions: true,
  });
  const [columnVisibilityAnchor, setColumnVisibilityAnchor] = useState(null);

  // Load user preferences from database
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await userPreferencesService.getPreferences();
        if (response.data?.columnVisibility?.clients) {
          setColumnVisibilityModel(response.data.columnVisibility.clients);
        }
      } catch (error) {
        console.error("Error loading user preferences:", error);
        // Fallback to localStorage if API fails
        const savedColumnVisibility = localStorage.getItem(
          "clients-column-visibility"
        );
        if (savedColumnVisibility) {
          try {
            const parsed = JSON.parse(savedColumnVisibility);
            setColumnVisibilityModel(parsed);
          } catch (parseError) {
            console.error("Error parsing saved column visibility:", parseError);
          }
        }
      }
    };

    loadUserPreferences();
  }, []);

  // Debug mount/unmount
  useEffect(() => {
    console.log("Clients component mounted");
    return () => console.log("Clients component unmounted");
  }, []);

  // Debug search state changes
  useEffect(() => {
    console.log("Search state changed:", { searchInput, search });
  }, [searchInput, search]);

  // Debug pagination changes
  useEffect(() => {
    console.log("Pagination state changed:", pagination);
  }, [pagination]);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300),
    []
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (event) => {
      const value = event.target.value;
      setSearchInput(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Handle key press
  const handleKeyPress = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  // Fetch clients with search and pagination
  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const response = await clientService.getAll({
        page: pagination.page,
        limit: pagination.limit,
        search: search,
      });
      setClients(response.data);
      setPagination((prev) => ({
        ...prev,
        total: response.pagination.total,
        pages: response.pagination.pages,
      }));
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  // Fetch clients when search or pagination changes
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Maintain focus on search bar after results are loaded
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPagination((prev) => ({ ...prev, limit: newPageSize, page: 1 }));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "contact1Number" || name === "contact2Number") {
      setForm({ ...form, [name]: formatPhoneNumber(value) });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    if (name === "contact1Number" || name === "contact2Number") {
      setEditForm({ ...editForm, [name]: formatPhoneNumber(value) });
    } else {
      setEditForm({ ...editForm, [name]: value });
    }
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

  const handleDeleteClick = (client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await clientService.delete(clientToDelete._id);
      setClients(clients.filter((client) => client._id !== clientToDelete._id));
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      // Also close edit dialog if it's open
      if (editDialogOpen) {
        setEditDialogOpen(false);
        setEditForm(emptyForm);
        setEditId(null);
      }
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

  // Column visibility handlers
  const handleColumnVisibilityClick = (event) => {
    setColumnVisibilityAnchor(event.currentTarget);
  };

  const handleColumnVisibilityClose = () => {
    setColumnVisibilityAnchor(null);
  };

  const handleColumnToggle = async (field) => {
    const newModel = {
      ...columnVisibilityModel,
      [field]: !columnVisibilityModel[field],
    };

    setColumnVisibilityModel(newModel);

    try {
      // Save to database
      await userPreferencesService.updatePreferences({
        columnVisibility: {
          clients: newModel,
        },
      });
    } catch (error) {
      console.error("Error saving column visibility preferences:", error);
      // Fallback to localStorage if API fails
      localStorage.setItem(
        "clients-column-visibility",
        JSON.stringify(newModel)
      );
    }
  };

  const columns = [
    { field: "name", headerName: "Client Name", flex: 1 },
    { field: "invoiceEmail", headerName: "Invoice Email", flex: 1 },
    { field: "contact1Name", headerName: "Primary Contact", flex: 1 },
    {
      field: "contact1Number",
      headerName: "Primary Phone",
      flex: 1,
      valueGetter: (params) => formatPhoneNumber(params.row.contact1Number),
    },
    { field: "address", headerName: "Address", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Box>
          <IconButton
            onClick={() => navigate(`/invoices?client=${params.row._id}`)}
            title="View Invoices"
          >
            <AttachMoneyIcon />
          </IconButton>
          <IconButton
            onClick={() => handleEdit(params.row)}
            title="Edit Client"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteClick(params.row)}
            title="Delete Client"
            color="error"
          >
            <DeleteIcon />
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
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            inputRef={searchInputRef}
            label="Search by Client Name"
            value={searchInput}
            onChange={handleSearchChange}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* Column Visibility Button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<ViewColumnIcon />}
            onClick={handleColumnVisibilityClick}
            sx={{
              height: 56, // Match the height of the search field
              minWidth: 140,
              color: colors.blueAccent[500],
              borderColor: colors.blueAccent[500],
              "&:hover": {
                backgroundColor: colors.blueAccent[500],
                color: "white",
                borderColor: colors.blueAccent[500],
              },
            }}
          >
            Columns
          </Button>
        </Stack>
      </Box>

      {/* Column Visibility Dropdown */}
      <Popover
        open={Boolean(columnVisibilityAnchor)}
        anchorEl={columnVisibilityAnchor}
        onClose={handleColumnVisibilityClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{
          sx: {
            minWidth: 200,
            maxHeight: 400,
          },
        }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="subtitle2" sx={{ p: 1, fontWeight: "bold" }}>
            Show/Hide Columns
          </Typography>
          <Divider sx={{ mb: 1 }} />
          <List dense>
            {columns.map((column) => (
              <ListItem key={column.field} disablePadding>
                <ListItemButton
                  dense
                  onClick={() => handleColumnToggle(column.field)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Checkbox
                      edge="start"
                      checked={columnVisibilityModel[column.field] !== false}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={column.headerName}
                    primaryTypographyProps={{ fontSize: "0.875rem" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Popover>

      <Box
        m="40px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": { border: "none" },
          "& .MuiDataGrid-cell": {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
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
          rows={clients}
          columns={columns}
          getRowId={(row) => row._id}
          pageSize={pagination.limit}
          page={pagination.page - 1}
          rowCount={pagination.total}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          paginationMode="server"
          loading={loading}
          autoHeight
          disableSelectionOnClick
          components={{ Toolbar: GridToolbar }}
          keepNonExistentRowsSelected
          disableColumnMenu
          disableColumnFilter
          disableColumnSelector
          disableDensitySelector
          columnVisibilityModel={columnVisibilityModel}
          onColumnVisibilityModelChange={setColumnVisibilityModel}
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
                placeholder="04xx xxx xxx"
                error={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                }
                helperText={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                    ? "Please enter a valid Australian mobile number"
                    : ""
                }
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
                placeholder="04xx xxx xxx"
                error={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                }
                helperText={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                    ? "Please enter a valid Australian mobile number"
                    : ""
                }
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
                placeholder="04xx xxx xxx"
                error={
                  editForm.contact1Number &&
                  !isValidAustralianMobile(editForm.contact1Number)
                }
                helperText={
                  editForm.contact1Number &&
                  !isValidAustralianMobile(editForm.contact1Number)
                    ? "Please enter a valid Australian mobile number"
                    : ""
                }
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
                placeholder="04xx xxx xxx"
                error={
                  editForm.contact2Number &&
                  !isValidAustralianMobile(editForm.contact2Number)
                }
                helperText={
                  editForm.contact2Number &&
                  !isValidAustralianMobile(editForm.contact2Number)
                    ? "Please enter a valid Australian mobile number"
                    : ""
                }
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

export default memo(Clients);
