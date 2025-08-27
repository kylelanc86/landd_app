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
  Snackbar,
  Alert,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { clientService, userPreferencesService } from "../../services/api";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";
import { tokens } from "../../theme/tokens";
import AddIcon from "@mui/icons-material/Add";
import { useMemo } from "react";

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
  const [isFetching, setIsFetching] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const searchInputRef = useRef(null);

  // Column visibility state
  const [columnVisibilityModel, setColumnVisibilityModel] = useState({
    name: true,
    invoiceEmail: true,
    contact1Name: true,
    contact1Number: true,
    address: false, // Hide address column by default
    written_off: false, // Will be updated in useEffect
    actions: true,
  });
  const [columnVisibilityAnchor, setColumnVisibilityAnchor] = useState(null);

  // Extract permission check to avoid recreating functions
  const canWriteOff = can("clients.write_off");

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
            written_off: canWriteOff && savedVisibility.written_off,
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
              written_off: canWriteOff && parsed.written_off,
            });
          } catch (parseError) {
            console.error("Error parsing saved column visibility:", parseError);
          }
        }
      } finally {
      }
    };

    loadUserPreferences();
  }, [canWriteOff]);

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value) => {
      setSearch(value);
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
  const fetchClients = useCallback(async (page, pageSize, searchTerm) => {
    if (isFetching) return; // Prevent duplicate calls

    try {
      setIsFetching(true);
      setLoading(true);

      const response = await clientService.getAll({
        page: page + 1, // Backend uses 1-based pagination
        limit: pageSize,
        search: searchTerm,
      });

      setClients(response.data.clients || []);
      const totalCount = response.data.pagination?.total || 0;
      setRowCount(totalCount);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, []);

  // Fetch clients when search or pagination changes, including initial load
  useEffect(() => {
    fetchClients(paginationModel.page, paginationModel.pageSize, search);
  }, [paginationModel.page, paginationModel.pageSize, search]);

  // Reset to first page when search changes
  useEffect(() => {
    if (search !== searchInput) {
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    }
  }, [search, searchInput]);

  // Maintain focus on search bar after results are loaded
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // Cleanup function to prevent delays when navigating away
  useEffect(() => {
    return () => {
      // Clear any pending state updates when component unmounts
      setLoading(false);
      setSearchLoading(false);
      setIsFetching(false);
    };
  }, []);

  // Handle pagination model change
  const handlePaginationModelChange = useCallback((newModel) => {
    setPaginationModel(newModel);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "contact1Number" || name === "contact2Number") {
      setForm((prevForm) => ({
        ...prevForm,
        [name]: formatPhoneNumber(value),
      }));
    } else {
      setForm((prevForm) => ({ ...prevForm, [name]: value }));
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const response = await clientService.create(form);
        setClients((prevClients) => [response.data, ...prevClients]);
        setDialogOpen(false);
        setForm(emptyForm);
      } catch (err) {
        if (err.response) {
          setSnackbar({
            open: true,
            message: `Error creating client: ${
              err.response.data.message || "Unknown error"
            }`,
            severity: "error",
          });
        }
      }
    },
    [form]
  );

  const handleDeleteClick = useCallback((client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await clientService.delete(clientToDelete._id);
      setClients((prevClients) =>
        prevClients.filter((client) => client._id !== clientToDelete._id)
      );
      setDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (err) {
      if (err.response) {
        setSnackbar({
          open: true,
          message: `Error deleting client: ${
            err.response.data.message || "Unknown error"
          }`,
          severity: "error",
        });
      }
    }
  }, [clientToDelete]);

  // Column visibility handlers
  const handleColumnVisibilityClick = useCallback((event) => {
    setColumnVisibilityAnchor(event.currentTarget);
  }, []);

  const handleColumnVisibilityClose = useCallback(() => {
    setColumnVisibilityAnchor(null);
  }, []);

  const handleColumnToggle = useCallback(
    async (field) => {
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
    },
    [columnVisibilityModel]
  );

  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Client Name",
        flex: 1,
        renderCell: (params) => (
          <Typography sx={{ fontSize: "0.875rem" }}>
            {params.row.name}
          </Typography>
        ),
      },
      {
        field: "invoiceEmail",
        headerName: "Invoice Email",
        flex: 1,
        renderCell: (params) => (
          <Typography sx={{ fontSize: "0.875rem" }}>
            {params.row.invoiceEmail}
          </Typography>
        ),
      },
      {
        field: "contact1Name",
        headerName: "Primary Contact",
        flex: 1,
        renderCell: (params) => (
          <Typography sx={{ fontSize: "0.875rem" }}>
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
          <Typography sx={{ fontSize: "0.875rem" }}>
            {formatPhoneNumber(params.row.contact1Number)}
          </Typography>
        ),
      },
      {
        field: "address",
        headerName: "Address",
        flex: 1,
        renderCell: (params) => (
          <Typography sx={{ fontSize: "0.875rem" }}>
            {params.row.address}
          </Typography>
        ),
      },
      ...(canWriteOff
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
    ],
    [canWriteOff]
  );

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
          "& .written-off-row": {
            backgroundColor: "#ffebee !important",
          },
          "& .written-off-row:hover": {
            backgroundColor: "#ffcdd2 !important",
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
          getRowClassName={(params) =>
            params.row.written_off ? "written-off-row" : ""
          }
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
              {canWriteOff && (
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default memo(Clients);
