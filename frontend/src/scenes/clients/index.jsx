import { useState, useEffect, useCallback, memo, useRef } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import {
  Box,
  Button,
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
  LinearProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { clientService, userPreferencesService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import AddIcon from "@mui/icons-material/Add";

import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  formatPhoneNumber,
  isValidAustralianMobile,
  isValidEmailOrDash,
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
  paymentTerms: "Standard (30 days)",
  written_off: false,
};

const Clients = () => {
  console.log("Clients component rendering");

  const theme = useTheme();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 25,
  });
  const [rowCount, setRowCount] = useState(0);

  console.log("Current state:", {
    paginationModel,
    rowCount,
    clients: clients.length,
  });
  const searchInputRef = useRef(null);

  // Column visibility state
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    name: true,
    invoiceEmail: true,
    contact1Name: true,
    contact1Number: true,
    address: false, // Hide address column by default
    written_off: can("clients.write_off"),
    actions: true,
  });
  const [columnVisibilityAnchor, setColumnVisibilityAnchor] = useState(null);

  // Load user preferences from database
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const response = await userPreferencesService.getPreferences();
        if (response.data?.columnVisibility?.clients) {
          const savedVisibility = response.data.columnVisibility.clients;
          // Ensure written_off column visibility respects permissions
          setColumnVisibilityModel({
            ...savedVisibility,
            written_off:
              can("clients.write_off") && savedVisibility.written_off,
          });
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
            // Ensure written_off column visibility respects permissions
            setColumnVisibilityModel({
              ...parsed,
              written_off: can("clients.write_off") && parsed.written_off,
            });
          } catch (parseError) {
            console.error("Error parsing saved column visibility:", parseError);
          }
        }
      } finally {
      }
    };

    loadUserPreferences();
  }, [can]);

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
    console.log("Pagination model changed:", paginationModel);
  }, [paginationModel]);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearch(value);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
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
      console.log("Fetching clients with:", {
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        search: search,
      });

      const response = await clientService.getAll({
        page: paginationModel.page + 1, // Backend uses 1-based pagination
        limit: paginationModel.pageSize,
        search: search,
      });

      console.log("Clients response:", {
        clientsCount: response.data.clients?.length || 0,
        total: response.data.pagination?.total || 0,
        page: response.data.pagination?.page || 0,
        fullResponse: response.data,
      });

      setClients(response.data.clients || []);
      const totalCount = response.data.pagination?.total || 0;
      console.log("Setting rowCount to:", totalCount);
      setRowCount(totalCount);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [paginationModel.page, paginationModel.pageSize, search]);

  // Fetch clients when search or pagination changes, including initial load
  useEffect(() => {
    console.log("useEffect triggered - fetching clients");
    console.log("Current state:", { paginationModel, search });
    fetchClients();
  }, [paginationModel.page, paginationModel.pageSize, search]);

  // Reset to first page when search changes
  useEffect(() => {
    console.log("Search changed, resetting to page 0");
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    // Note: The main useEffect will automatically fetch due to paginationModel.page change
  }, [search]);

  // Maintain focus on search bar after results are loaded
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // Handle pagination model change
  const handlePaginationModelChange = useCallback(
    (newModel) => {
      console.log("Pagination model changed:", newModel);
      console.log("Current paginationModel:", paginationModel);
      setPaginationModel(newModel);
    },
    [paginationModel]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "contact1Number" || name === "contact2Number") {
      setForm({ ...form, [name]: formatPhoneNumber(value) });
    } else {
      setForm({ ...form, [name]: value });
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
    {
      field: "name",
      headerName: "Client Name",
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.row.written_off ? "red" : "inherit",
            fontWeight: params.row.written_off ? "bold" : "normal",
            fontSize: "0.875rem",
          }}
        >
          {params.row.name}
        </Typography>
      ),
    },
    {
      field: "invoiceEmail",
      headerName: "Invoice Email",
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.row.written_off ? "red" : "inherit",
            fontWeight: params.row.written_off ? "bold" : "normal",
            fontSize: "0.875rem",
          }}
        >
          {params.row.invoiceEmail}
        </Typography>
      ),
    },
    {
      field: "contact1Name",
      headerName: "Primary Contact",
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.row.written_off ? "red" : "inherit",
            fontWeight: params.row.written_off ? "bold" : "normal",
            fontSize: "0.875rem",
          }}
        >
          {params.row.contact1Name}
        </Typography>
      ),
    },
    {
      field: "contact1Number",
      headerName: "Primary Phone",
      flex: 1,
      valueGetter: (params) => formatPhoneNumber(params.row.contact1Number),
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.row.written_off ? "red" : "inherit",
            fontWeight: params.row.written_off ? "bold" : "normal",
            fontSize: "0.875rem",
          }}
        >
          {formatPhoneNumber(params.row.contact1Number)}
        </Typography>
      ),
    },
    {
      field: "address",
      headerName: "Address",
      flex: 1,
      renderCell: (params) => (
        <Typography
          sx={{
            color: params.row.written_off ? "red" : "inherit",
            fontWeight: params.row.written_off ? "bold" : "normal",
            fontSize: "0.875rem",
          }}
        >
          {params.row.address}
        </Typography>
      ),
    },
    ...(can("clients.write_off")
      ? [
          {
            field: "written_off",
            headerName: "Written Off",
            flex: 0.5,
            renderCell: (params) => (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {params.row.written_off && (
                  <CheckCircleIcon
                    sx={{
                      color: "red",
                      fontSize: 20,
                    }}
                  />
                )}
              </Box>
            ),
          },
        ]
      : []),
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => (
        <Box>
          <IconButton
            onClick={() =>
              navigate(
                `/invoices?client=${encodeURIComponent(params.row.name)}`
              )
            }
            title="View Invoices"
          >
            <AttachMoneyIcon />
          </IconButton>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/clients/${params.row._id}`)}
            title="View Details"
            sx={{ mr: 1 }}
          >
            Details
          </Button>
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
    <Box m="5px 0px 20px 20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Clients
      </Typography>
      {/* Search Loading Animation - Only shows during searches */}
      {searchLoading && (
        <Box sx={{ width: "100%", mb: 2 }}>
          <LinearProgress
            sx={{
              height: 3,
              borderRadius: 1.5,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              "& .MuiLinearProgress-bar": {
                backgroundColor: "#1976d2",
              },
            }}
          />
        </Box>
      )}

      {/* Search and Filter Section */}
      {/* Add Client Button - Full Width */}

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => setDialogOpen(true)}
          fullWidth
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": { backgroundColor: theme.palette.primary.dark },
            height: 60,
            fontSize: "1.2rem",
            fontWeight: "bold",
            border: "2px solid rgb(83, 84, 85)",
            py: 2,
          }}
        >
          <AddIcon sx={{ mr: 1 }} />
          ADD CLIENT
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
              color: theme.palette.primary.main,
              borderColor: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: theme.palette.primary.main,
                color: "white",
                borderColor: theme.palette.primary.main,
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
            fontSize: "0.875rem",
            color: "#000000",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.main,
            borderBottom: "none",
            fontSize: "0.875rem",
            color: "#FFFFFF",
          },
          "& .MuiDataGrid-columnHeader": {
            color: "#FFFFFF",
            fontWeight: 600,
          },
          "& .MuiDataGrid-virtualScroller": {
            backgroundColor: "#FFFFFF",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "none",
            backgroundColor: theme.palette.primary.main,
            fontSize: "0.875rem",
            color: "#FFFFFF",
          },
          "& .MuiCheckbox-root": {
            color: `${theme.palette.secondary.main} !important`,
          },
          "& .MuiDataGrid-row:nth-of-type(even)": {
            backgroundColor: "#f8f9fa",
          },
          "& .MuiDataGrid-row:nth-of-type(odd)": {
            backgroundColor: "#ffffff",
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "#e3f2fd",
          },
        }}
      >
        <DataGrid
          rows={clients}
          columns={columns}
          getRowId={(row) => row._id}
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
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
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                }
                helperText={
                  form.invoiceEmail && !isValidEmailOrDash(form.invoiceEmail)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <TextField
                label="Address"
                name="address"
                value={form.address}
                onChange={handleChange}
                fullWidth
                placeholder="Address or '-' for no address"
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Primary Contact
              </Typography>
              <TextField
                label="Contact Name"
                name="contact1Name"
                value={form.contact1Name}
                onChange={handleChange}
                fullWidth
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact1Number"
                value={form.contact1Number}
                onChange={handleChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                }
                helperText={
                  form.contact1Number &&
                  !isValidAustralianMobile(form.contact1Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact1Email"
                value={form.contact1Email}
                onChange={handleChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                }
                helperText={
                  form.contact1Email && !isValidEmailOrDash(form.contact1Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
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
                placeholder="Contact name or '-' for no contact"
              />
              <TextField
                label="Contact Phone"
                name="contact2Number"
                value={form.contact2Number}
                onChange={handleChange}
                fullWidth
                placeholder="04xx xxx xxx or '-' for no phone"
                error={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                }
                helperText={
                  form.contact2Number &&
                  !isValidAustralianMobile(form.contact2Number)
                    ? "Please enter a valid Australian mobile number or use '-' for no phone"
                    : ""
                }
              />
              <TextField
                label="Contact Email"
                name="contact2Email"
                value={form.contact2Email}
                onChange={handleChange}
                fullWidth
                placeholder="email@example.com or '-' for no email"
                error={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                }
                helperText={
                  form.contact2Email && !isValidEmailOrDash(form.contact2Email)
                    ? "Please enter a valid email address or use '-' for no email"
                    : ""
                }
              />
              <Typography variant="h6" sx={{ mt: 2 }}>
                Payment Terms
              </Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  name="paymentTerms"
                  value={form.paymentTerms}
                  onChange={handleChange}
                  row
                >
                  <FormControlLabel
                    value="Standard (30 days)"
                    control={<Radio />}
                    label="Standard (30 days)"
                  />
                  <FormControlLabel
                    value="Payment before Report (7 days)"
                    control={<Radio />}
                    label="Payment before Report (7 days)"
                  />
                </RadioGroup>
              </FormControl>
              {can("clients.write_off") && (
                <Box sx={{ mt: 2, display: "flex", alignItems: "center" }}>
                  <Checkbox
                    name="written_off"
                    checked={form.written_off}
                    onChange={(e) =>
                      setForm({ ...form, written_off: e.target.checked })
                    }
                    sx={{
                      color: "red",
                      "&.Mui-checked": {
                        color: "red",
                      },
                    }}
                  />
                  <Typography
                    variant="body1"
                    sx={{ color: "red", fontWeight: "bold" }}
                  >
                    WRITTEN OFF?
                  </Typography>
                </Box>
              )}
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
