import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
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
  useTheme,
  Breadcrumbs,
  Link,
  Alert,
  Snackbar,
  Chip,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as ViewIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { clientService } from "../../services/api";
import { formatDate } from "../../utils/dateFormat";

// Tab panel component
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`archived-data-tabpanel-${index}`}
      aria-labelledby={`archived-data-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ArchivedData = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Tab configuration
  const tabs = [
    { label: "Clients", value: 0 },
    // Add more tabs here as needed
    // { label: "Projects", value: 1 },
    // { label: "Invoices", value: 2 },
  ];

  // Fetch archived clients
  const fetchArchivedClients = async () => {
    setLoading(true);
    try {
      const response = await clientService.getAll({ showInactive: true });
      console.log("Archived clients response:", response.data);

      // Handle different response formats
      let allClients = [];
      if (response.data.clients) {
        // When showInactive is true, data comes in { clients: [], pagination: {} } format
        allClients = response.data.clients;
      } else if (Array.isArray(response.data)) {
        // When no params, data comes as array directly
        allClients = response.data;
      }

      // Filter for archived/inactive clients
      const archivedClients = allClients.filter(
        (client) => client.isActive === false,
      );
      console.log("Archived clients found:", archivedClients.length);
      setClients(archivedClients);
    } catch (err) {
      setError("Failed to fetch archived clients");
      console.error("Error fetching archived clients:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedClients();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleRestore = async (item) => {
    try {
      await clientService.restore(item._id);
      setSuccess(`${item.name || item.title} has been restored successfully`);
      setRestoreDialogOpen(false);
      setSelectedItem(null);
      fetchArchivedClients(); // Refresh the list
    } catch (err) {
      setError("Failed to restore item");
      console.error("Error restoring item:", err);
    }
  };

  const handleDelete = async (item) => {
    try {
      // Implement permanent delete logic here
      // await clientService.delete(item._id);
      setSuccess(`${item.name || item.title} has been permanently deleted`);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      fetchArchivedClients(); // Refresh the list
    } catch (err) {
      setError("Failed to delete item");
      console.error("Error deleting item:", err);
    }
  };

  const handleView = (item) => {
    // Navigate to view the archived item
    console.log("View item:", item);
  };

  // Filter clients based on search term
  const filteredClients = clients.filter(
    (client) =>
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact1Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contact1Email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const renderClientsTable = () => (
    <Box>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">Archived Clients</Typography>
        <TextField
          size="small"
          placeholder="Search clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Contact Person</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Archived Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredClients.map((client) => (
              <TableRow key={client._id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {client.name}
                  </Typography>
                </TableCell>
                <TableCell>{client.contact1Name || "-"}</TableCell>
                <TableCell>{client.contact1Email || "-"}</TableCell>
                <TableCell>{client.contact1Phone || "-"}</TableCell>
                <TableCell>
                  {client.updatedAt ? formatDate(client.updatedAt) : "-"}
                </TableCell>
                <TableCell>
                  <Chip
                    label="Archived"
                    color="default"
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedItem(client);
                      handleView(client);
                    }}
                    title="View Details"
                  >
                    <ViewIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedItem(client);
                      setRestoreDialogOpen(true);
                    }}
                    title="Restore"
                    color="primary"
                  >
                    <RestoreIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSelectedItem(client);
                      setDeleteDialogOpen(true);
                    }}
                    title="Delete Permanently"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredClients.length === 0 && (
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            {searchTerm
              ? "No archived clients match your search."
              : "No archived clients found."}
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Box m="20px">
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate("/admin")}
          sx={{ textDecoration: "none" }}
        >
          Admin Dashboard
        </Link>
        <Typography color="text.primary">Archived Data</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <IconButton onClick={() => navigate("/admin")} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          Archived Data
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ width: "100%" }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} label={tab.label} />
          ))}
        </Tabs>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          {renderClientsTable()}
        </TabPanel>

        {/* Add more tab panels here as needed */}
      </Paper>

      {/* Restore Confirmation Dialog */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => setRestoreDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Restore Item</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to restore "
            {selectedItem?.name || selectedItem?.title}"? This will make it
            active again in the system.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleRestore(selectedItem)}
            variant="contained"
            color="primary"
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Permanently</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to permanently delete "
            {selectedItem?.name || selectedItem?.title}"? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleDelete(selectedItem)}
            variant="contained"
            color="error"
          >
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{
          position: "fixed",
          zIndex: 9999999,
          bottom: "20px !important",
          right: "20px !important",
          left: "252px !important", // 232px sidebar width + 20px margin
          transform: "none !important",
          width: "auto",
          maxWidth: "400px",
        }}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{
          position: "fixed",
          zIndex: 9999999,
          bottom: "20px !important",
          right: "20px !important",
          left: "252px !important", // 232px sidebar width + 20px margin
          transform: "none !important",
          width: "auto",
          maxWidth: "400px",
        }}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ArchivedData;
