import React, { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Stack,
  TableSortLabel,
  Chip,
  useTheme,
  Autocomplete,
  Switch,
  FormControlLabel,
  InputAdornment,
  Alert,
  Snackbar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import FilterListIcon from "@mui/icons-material/FilterList";
import autoTable from "jspdf-autotable";
import { useLocation, useNavigate } from "react-router-dom";
import {
  invoiceService,
  projectService,
  clientService,
  xeroService,
} from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { formatDate, formatDateForInput } from "../../utils/dateFormat";
import SearchIcon from "@mui/icons-material/Search";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useAuth } from "../../context/AuthContext";
import SyncIcon from "@mui/icons-material/Sync";

const STATUS_OPTIONS = ["paid", "unpaid"];

const emptyForm = {
  invoiceID: "",
  projectID: "",
  client: "",
  amount: "",
  status: "unpaid",
  date: "",
  dueDate: "",
  description: "",
};

const Invoices = () => {
  const theme = useTheme();
  const colors = tokens;
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showPaidInvoices, setShowPaidInvoices] = useState(false);
  const [search, setSearch] = useState("");
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroError, setXeroError] = useState(null);
  const [showXeroAlert, setShowXeroAlert] = useState(false);

  useEffect(() => {
    if (authLoading || !currentUser) {
      return;
    }

    const fetchData = async () => {
      try {
        const [invoicesRes, projectsRes, clientsRes] = await Promise.all([
          invoiceService.getAll(),
          projectService.getAll(),
          clientService.getAll(),
        ]);

        if (!Array.isArray(invoicesRes.data)) {
          setError("Invalid data format received from server");
          setLoading(false);
          return;
        }

        setInvoices(invoicesRes.data);
        setProjects(projectsRes.data);
        setClients(clientsRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser]);

  // Add this effect to check Xero connection status
  useEffect(() => {
    // Don't check Xero connection if auth is still loading or no user
    if (authLoading || !currentUser) return;

    const checkXeroConnection = async () => {
      try {
        // Check Xero connection status
        const response = await xeroService.checkStatus();
        console.log("Xero status response:", response);

        if (response && response.data) {
          const { connected, details } = response.data;
          console.log("Xero connection details:", details);

          if (connected) {
            setXeroConnected(true);
            setXeroError(null);
            console.log("Xero connection verified");
          } else {
            setXeroConnected(false);
            setXeroError("Not connected to Xero");
            console.log("Xero connection not verified - not connected");

            // Log detailed status for debugging
            if (details) {
              console.log("Connection details:", {
                hasToken: details.hasToken,
                hasAccessToken: details.hasAccessToken,
                hasTenantId: details.hasTenantId,
                tokenExpiry: details.tokenExpiry,
              });
            }
          }
        } else {
          setXeroConnected(false);
          setXeroError("Failed to verify Xero connection");
          console.log("Xero connection not verified - invalid response");
        }
      } catch (error) {
        console.log("Xero connection check error:", error);
        setXeroConnected(false);

        // Handle different types of errors
        if (error.response?.status === 401) {
          setXeroError("Not connected to Xero. Please connect to continue.");
        } else {
          setXeroError(
            error.response?.data?.message || "Failed to verify Xero connection"
          );
        }

        // Only show error alert for non-auth errors
        if (error.response?.status !== 401) {
          setShowXeroAlert(true);
        }
      }
    };

    // Add a small delay before checking connection
    const timer = setTimeout(() => {
      checkXeroConnection();
    }, 1000);

    return () => clearTimeout(timer);
  }, [authLoading, currentUser]);

  // Update the URL parameters effect
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get("status");
    const xeroStatus = searchParams.get("xero_connected");
    const xeroError = searchParams.get("xero_error");

    if (statusParam) {
      setFilterStatus(statusParam);
    }

    if (xeroStatus === "true") {
      // Clear the URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);

      // Add a small delay before checking connection
      setTimeout(() => {
        const checkConnection = async () => {
          try {
            const response = await xeroService.checkStatus();
            console.log("Post-callback Xero status:", response);
            if (response && response.data && response.data.connected) {
              setXeroConnected(true);
              setXeroError(null);
              setShowXeroAlert(true);
            }
          } catch (error) {
            console.error(
              "Error checking Xero connection after callback:",
              error
            );
            setXeroError("Failed to verify Xero connection");
            setShowXeroAlert(true);
          }
        };

        checkConnection();
      }, 2000); // Wait 2 seconds after callback
    } else if (xeroError) {
      setXeroError(decodeURIComponent(xeroError));
      setShowXeroAlert(true);
      // Clear the URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [location.search]);

  // When invoice date changes, auto-set due date if not manually changed
  useEffect(() => {
    if (form.date && !dueDateManuallyChanged) {
      const dateObj = new Date(form.date);
      dateObj.setDate(dateObj.getDate() + 30);
      setForm((prev) => ({
        ...prev,
        dueDate: dateObj.toISOString().split("T")[0], // format as yyyy-mm-dd for input
      }));
    }
  }, [form.date, dueDateManuallyChanged]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // Filter projects based on search text
  const filteredProjects = useCallback(() => {
    if (!projectSearch) return projects;
    return projects.filter(
      (project) =>
        project.projectID
          ?.toLowerCase()
          .includes(projectSearch.toLowerCase()) ||
        project.name?.toLowerCase().includes(projectSearch.toLowerCase())
    );
  }, [projects, projectSearch]);

  const handleAddInvoice = async (e) => {
    e.preventDefault();
    try {
      // Find the project object that matches the projectID
      const selectedProject = projects.find(
        (p) => p.projectID === form.projectID
      );

      const formattedForm = {
        ...form,
        date: form.date ? new Date(form.date).toISOString() : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        amount: parseFloat(form.amount),
        project: selectedProject?._id || form.projectID, // Use project _id if found, otherwise use projectID
        client: form.client,
      };
      console.log("Sending invoice data:", formattedForm);
      const response = await invoiceService.create(formattedForm);
      setInvoices([response.data, ...invoices]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (err) {
      console.error("Error creating invoice:", err);
    }
  };

  const handleEditInvoice = (invoice) => {
    setEditId(invoice._id);
    // Format dates for the form
    const formattedInvoice = {
      ...invoice,
      date: invoice.date ? formatDateForInput(invoice.date) : "",
      dueDate: invoice.dueDate ? formatDateForInput(invoice.dueDate) : "",
    };
    setEditForm(formattedInvoice);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      // Find the project object that matches the projectID
      const selectedProject = projects.find(
        (p) => p.projectID === editForm.projectID
      );

      const formattedForm = {
        ...editForm,
        date: editForm.date ? new Date(editForm.date).toISOString() : null,
        dueDate: editForm.dueDate
          ? new Date(editForm.dueDate).toISOString()
          : null,
        amount: parseFloat(editForm.amount),
        project: selectedProject?._id || editForm.projectID, // Use project _id if found, otherwise use projectID
        client: editForm.client,
      };
      console.log("Sending updated invoice data:", formattedForm);
      const response = await invoiceService.update(editId, formattedForm);
      setInvoices(
        invoices.map((inv) => (inv._id === editId ? response.data : inv))
      );
      setEditDialogOpen(false);
      setEditId(null);
      setEditForm(emptyForm);
    } catch (err) {
      console.error("Error updating invoice:", err);
    }
  };

  // Sorting
  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const getFilteredInvoices = useCallback(() => {
    let filtered = [...invoices];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((invoice) => {
        return (
          invoice.invoiceID?.toLowerCase().includes(searchLower) ||
          invoice.client?.name?.toLowerCase().includes(searchLower) ||
          invoice.projectID?.toLowerCase().includes(searchLower) ||
          invoice.amount?.toString().includes(search) ||
          invoice.status?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Filter by paid/unpaid status
    if (!showPaidInvoices) {
      filtered = filtered.filter((invoice) => invoice.status === "unpaid");
    }

    // Apply status filter from URL if present
    if (filterStatus && filterStatus !== "All") {
      filtered = filtered.filter((invoice) => invoice.status === filterStatus);
    }

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      let valA = a[sortBy],
        valB = b[sortBy];
      if (sortBy === "amount") {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [invoices, filterStatus, sortBy, sortDir, showPaidInvoices, search]);

  // Sum of unpaid invoice amounts
  const totalUnpaid = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    .toFixed(2);

  const handleInvoicePDF = (invoice) => {
    const doc = new jsPDF();

    // Add header information
    doc.setFontSize(18);
    doc.text("Invoice", 14, 16);
    doc.setFontSize(12);

    // Add invoice details
    const details = [
      ["Invoice ID:", invoice._id],
      ["Project:", invoice.project?.name || "N/A"],
      ["Client:", invoice.client?.name || "N/A"],
      ["Amount:", `$${invoice.amount}`],
      ["Date:", formatDate(invoice.date)],
      ["Due Date:", formatDate(invoice.dueDate)],
      ["Status:", invoice.status],
      ["Description:", invoice.description],
    ];

    // Add details table
    autoTable(doc, {
      body: details,
      startY: 28,
      theme: "plain",
      styles: { fontSize: 12 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 60 },
      },
    });

    // Save the PDF
    doc.save(`Invoice_${invoice._id}.pdf`);
  };

  const columns = [
    {
      field: "invoiceID",
      headerName: "Invoice ID",
      flex: 1,
      valueGetter: (params) => {
        const invoiceID = params?.row?.invoiceID || params;
        return invoiceID || "N/A";
      },
    },
    {
      field: "client",
      headerName: "Client",
      flex: 1,
      valueGetter: (params) => {
        const client = params?.row?.client || params;
        return client?.name || "N/A";
      },
    },
    {
      field: "amount",
      headerName: "Amount",
      flex: 1,
      valueGetter: (params) => {
        const amount = params?.row?.amount || params;
        if (amount !== undefined && amount !== null) {
          return `$${Number(amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;
        }
        return "N/A";
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      valueGetter: (params) => params?.row?.status || params || "unpaid",
      renderCell: (params) => {
        const status = params?.row?.status || params || "unpaid";
        const isOverdue =
          params.row.dueDate && new Date(params.row.dueDate) < new Date();

        return (
          <Chip
            label={status}
            color={status === "paid" ? "success" : "error"}
            sx={{
              color: "white",
              fontWeight: isOverdue && status === "unpaid" ? "bold" : "normal",
              "& .MuiChip-label": {
                color: "white",
              },
            }}
          />
        );
      },
    },
    {
      field: "date",
      headerName: "Date",
      flex: 1,
      valueGetter: (params) => {
        const date = params?.row?.date || params;
        return formatDate(date);
      },
    },
    {
      field: "dueDate",
      headerName: "Due Date",
      flex: 1,
      valueGetter: (params) => {
        const date = params?.row?.dueDate || params;
        return formatDate(date);
      },
      renderCell: (params) => {
        const date = params?.row?.dueDate || params;
        if (!date) return "N/A";
        try {
          const dueDate = new Date(date);
          const isOverdue =
            dueDate < new Date() && params.row.status === "unpaid";
          return (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                height: "100%",
              }}
            >
              <Typography
                sx={{
                  color: isOverdue ? "error.main" : "inherit",
                  fontWeight: isOverdue ? "bold" : "normal",
                }}
              >
                {formatDate(dueDate)}
              </Typography>
            </Box>
          );
        } catch (error) {
          return "Invalid Date";
        }
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      renderCell: (params) => {
        const row = params?.row || params;
        if (!row) return null;
        return (
          <Box>
            <IconButton onClick={() => handleEditInvoice(row)}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => handleInvoicePDF(row)}>
              <PrintIcon />
            </IconButton>
          </Box>
        );
      },
    },
  ];

  // Add data validation before rendering
  const validatedInvoices = React.useMemo(() => {
    if (!Array.isArray(invoices)) {
      return [];
    }
    return invoices.map((invoice) => ({
      ...invoice,
      _id: invoice._id,
      invoiceID: invoice.invoiceID,
      projectID: invoice.projectID,
      client: invoice.client,
      amount: invoice.amount,
      status: invoice.status,
      date: invoice.date,
      dueDate: invoice.dueDate,
    }));
  }, [invoices]);

  const handleDueDateChange = (e) => {
    setDueDateManuallyChanged(true);
    setForm((prev) => ({
      ...prev,
      dueDate: e.target.value,
    }));
  };

  // When opening the dialog, reset manual change flag
  const handleOpenDialog = () => {
    setForm(emptyForm);
    setDueDateManuallyChanged(false);
    setDialogOpen(true);
  };

  const handleConnectXero = async () => {
    console.log("handleConnectXero called");
    console.log("Current user:", currentUser);
    console.log("Token in localStorage:", localStorage.getItem("token"));

    if (!currentUser) {
      console.log("No user found, redirecting to login");
      setError("Please log in to connect to Xero");
      alert("Please log in to connect to Xero");
      navigate("/login");
      return;
    }

    try {
      console.log("Calling xeroService.getAuthUrl()");
      const response = await xeroService.getAuthUrl();
      console.log("Raw response from server:", response);

      if (!response || !response.data) {
        console.error("Invalid response format:", response);
        throw new Error("Invalid response from server");
      }

      const { authUrl } = response.data;
      console.log("Auth URL from server:", authUrl);

      if (
        !authUrl ||
        typeof authUrl !== "string" ||
        !authUrl.startsWith("http")
      ) {
        console.error("Invalid auth URL format:", authUrl);
        throw new Error("Invalid auth URL received from server");
      }

      // Extract state from the auth URL
      const urlParams = new URLSearchParams(authUrl.split("?")[1]);
      const state = urlParams.get("state");

      if (!state) {
        console.error("No state parameter in auth URL");
        throw new Error("Invalid auth URL: missing state parameter");
      }

      // Store the state in localStorage
      localStorage.setItem("xero_state", state);
      console.log("Stored Xero state:", state);

      // Clear any existing Xero error
      setXeroError(null);
      setShowXeroAlert(false);

      console.log("Redirecting to Xero auth URL:", authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error in handleConnectXero:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      setXeroError(error.message || "Failed to connect to Xero");
      setShowXeroAlert(true);
    }
  };

  const handleSyncXero = async () => {
    try {
      console.log("Starting Xero sync...");
      setXeroError(null);

      const response = await xeroService.syncInvoices();
      console.log("Sync response:", response);

      // Refresh the invoices list
      const invoicesRes = await invoiceService.getAll();
      setInvoices(invoicesRes.data);

      setXeroError(null);
      setShowXeroAlert(true);
    } catch (error) {
      console.error("Error syncing with Xero:", error);
      let errorMessage = "Failed to sync with Xero";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // If the error indicates we need to reconnect, update the connection state
      if (
        errorMessage.includes("reconnect") ||
        errorMessage.includes("connect first")
      ) {
        setXeroConnected(false);
      }

      setXeroError(errorMessage);
      setShowXeroAlert(true);
    }
  };

  if (authLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!currentUser) {
    return null; // Will be redirected by the useEffect
  }

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Typography>Loading invoices...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box m="20px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="INVOICES" subtitle="Managing your invoices" />
        <Box>
          {!xeroConnected ? (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleConnectXero}
              sx={{
                backgroundColor: colors.secondary[500],
                "&:hover": {
                  backgroundColor: colors.secondary[600],
                },
                mr: 2,
              }}
            >
              <AccountBalanceIcon sx={{ mr: 1 }} />
              Connect to Xero
            </Button>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSyncXero}
              sx={{
                backgroundColor: colors.primary[500],
                "&:hover": {
                  backgroundColor: colors.primary[600],
                },
                mr: 2,
              }}
            >
              <SyncIcon sx={{ mr: 1 }} />
              Sync from Xero
            </Button>
          )}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleOpenDialog}
            sx={{
              backgroundColor: colors.secondary[500],
              "&:hover": {
                backgroundColor: colors.secondary[600],
              },
            }}
          >
            Add Invoice
          </Button>
        </Box>
      </Box>

      <Snackbar
        open={showXeroAlert}
        autoHideDuration={6000}
        onClose={() => setShowXeroAlert(false)}
      >
        <Alert
          onClose={() => setShowXeroAlert(false)}
          severity={xeroError ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {xeroError || "Successfully connected to Xero!"}
        </Alert>
      </Snackbar>

      {/* Search and Summary Section */}
      <Box
        sx={{
          backgroundColor: colors.primary[600],
          p: 2,
          borderRadius: 1,
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" color="white">
            Outstanding Invoices: ${totalUnpaid}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showPaidInvoices}
                onChange={(e) => setShowPaidInvoices(e.target.checked)}
                color="secondary"
              />
            }
            label="Show Paid Invoices"
            sx={{ color: "white" }}
          />
        </Box>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search invoices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            backgroundColor: colors.primary[400],
            borderRadius: 1,
            "& .MuiOutlinedInput-root": {
              "& fieldset": {
                borderColor: colors.primary[300],
              },
              "&:hover fieldset": {
                borderColor: colors.primary[200],
              },
              "&.Mui-focused fieldset": {
                borderColor: colors.secondary[500],
              },
            },
            "& .MuiInputBase-input": {
              color: colors.grey[100],
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: colors.grey[100] }} />
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
        {validatedInvoices.length > 0 && (
          <DataGrid
            rows={getFilteredInvoices()}
            columns={columns}
            getRowId={(row) => row._id}
            pageSize={10}
            rowsPerPageOptions={[10]}
            checkboxSelection
            disableSelectionOnClick
            loading={loading}
            autoHeight
          />
        )}
      </Box>

      {/* Add Invoice Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Invoice</DialogTitle>
        <form onSubmit={handleAddInvoice}>
          <DialogContent>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Invoice ID"
                name="invoiceID"
                value={form.invoiceID}
                onChange={handleChange}
                required
                sx={{ flex: 1 }}
              />
              <Autocomplete
                freeSolo
                options={filteredProjects()}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return `${option.projectID || ""} - ${option.name || ""}`;
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Project ID"
                    required
                    sx={{ flex: 1 }}
                  />
                )}
                value={form.projectID}
                onChange={(event, newValue) => {
                  if (typeof newValue === "string") {
                    setForm((prev) => ({ ...prev, projectID: newValue }));
                  } else if (newValue && newValue.projectID) {
                    setForm((prev) => ({
                      ...prev,
                      projectID: newValue.projectID,
                    }));
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setProjectSearch(newInputValue);
                }}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Client</InputLabel>
                <Select
                  label="Client"
                  name="client"
                  value={form.client}
                  onChange={handleChange}
                  required
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Amount"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                type="number"
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Date"
                name="date"
                value={form.date}
                onChange={handleChange}
                type="date"
                InputLabelProps={{ shrink: true }}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Due Date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleDueDateChange}
                type="date"
                InputLabelProps={{ shrink: true }}
                required
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              multiline
              rows={4}
              fullWidth
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Create Invoice
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Invoice</DialogTitle>
        <form onSubmit={handleSaveEdit}>
          <DialogContent>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Invoice ID"
                name="invoiceID"
                value={editForm.invoiceID}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <Autocomplete
                freeSolo
                options={filteredProjects()}
                getOptionLabel={(option) => {
                  if (typeof option === "string") return option;
                  return `${option.projectID || ""} - ${option.name || ""}`;
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Project ID"
                    required
                    sx={{ flex: 1 }}
                  />
                )}
                value={editForm.projectID}
                onChange={(event, newValue) => {
                  if (typeof newValue === "string") {
                    setEditForm((prev) => ({ ...prev, projectID: newValue }));
                  } else if (newValue && newValue.projectID) {
                    setEditForm((prev) => ({
                      ...prev,
                      projectID: newValue.projectID,
                    }));
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setProjectSearch(newInputValue);
                }}
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Client</InputLabel>
                <Select
                  label="Client"
                  name="client"
                  value={editForm.client}
                  onChange={handleEditChange}
                  required
                >
                  {clients.map((client) => (
                    <MenuItem key={client._id} value={client._id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Amount"
                name="amount"
                value={editForm.amount}
                onChange={handleEditChange}
                type="number"
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Date"
                name="date"
                value={editForm.date}
                onChange={handleEditChange}
                type="date"
                InputLabelProps={{ shrink: true }}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Due Date"
                name="dueDate"
                value={editForm.dueDate}
                onChange={handleEditChange}
                type="date"
                InputLabelProps={{ shrink: true }}
                required
                sx={{ flex: 1 }}
              />
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  name="status"
                  value={editForm.status}
                  onChange={handleEditChange}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <TextField
              label="Description"
              name="description"
              value={editForm.description}
              onChange={handleEditChange}
              multiline
              rows={4}
              fullWidth
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)} color="secondary">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary">
              Save Changes
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default Invoices;
