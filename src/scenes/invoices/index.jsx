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
} from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import { formatDate, formatDateForInput } from "../../utils/dateFormat";

const STATUS_OPTIONS = ["paid", "unpaid"];

const emptyForm = {
  invoiceID: "",
  project: "",
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

  useEffect(() => {
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
        setError("Failed to fetch data");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Add this effect to handle URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get("status");

    if (statusParam) {
      setFilterStatus(statusParam);
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

  const handleAddInvoice = async (e) => {
    e.preventDefault();
    try {
      // Format dates before sending to API
      const formattedForm = {
        ...form,
        date: form.date ? new Date(form.date).toISOString() : null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        amount: parseFloat(form.amount), // Ensure amount is a number
        project: form.project, // This is already the ID from the Select
        client: form.client, // This is already the ID from the Select
      };
      console.log("Sending invoice data:", formattedForm);
      const response = await invoiceService.create(formattedForm);
      setInvoices([response.data, ...invoices]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (err) {
      console.error("Error creating invoice:", err);
      // Add error handling UI feedback here
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
      // Format dates before sending to API
      const formattedForm = {
        ...editForm,
        date: editForm.date ? new Date(editForm.date).toISOString() : null,
        dueDate: editForm.dueDate
          ? new Date(editForm.dueDate).toISOString()
          : null,
        amount: parseFloat(editForm.amount), // Ensure amount is a number
        project: editForm.project, // This is already the ID from the Select
        client: editForm.client, // This is already the ID from the Select
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
      // Add error handling UI feedback here
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

    // Apply status filter
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
  }, [invoices, filterStatus, sortBy, sortDir]);

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
      valueGetter: (params) => params || "N/A",
    },
    {
      field: "project",
      headerName: "Project",
      flex: 1,
      valueGetter: (params) => {
        const project = params?.row?.project || params;
        return project?.name || "N/A";
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
          return `$${Number(amount).toLocaleString()}`;
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
      project: invoice.project,
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

  if (loading) return <Typography>Loading invoices...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Header title="INVOICES" subtitle="Managing your invoices" />
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
        {validatedInvoices.length > 0 && (
          <DataGrid
            rows={validatedInvoices}
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Project</InputLabel>
                <Select
                  label="Project"
                  name="project"
                  value={form.project}
                  onChange={handleChange}
                  required
                >
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Project</InputLabel>
                <Select
                  label="Project"
                  name="project"
                  value={editForm.project}
                  onChange={handleEditChange}
                  required
                >
                  {projects.map((project) => (
                    <MenuItem key={project._id} value={project._id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
