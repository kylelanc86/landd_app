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
import { invoiceService } from "../../services/api";
import Header from "../../components/Header";
import { tokens } from "../../theme";

const STATUS_OPTIONS = ["draft", "pending", "paid", "overdue", "cancelled"];

const emptyForm = {
  invoiceID: "",
  project: "",
  client: "",
  amount: "",
  status: "draft",
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

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await invoiceService.getAll();
        if (!Array.isArray(response.data)) {
          setError("Invalid data format received from server");
          setLoading(false);
          return;
        }
        setInvoices(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to fetch invoices");
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  // Add this effect to handle URL parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const statusParam = searchParams.get("status");

    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [location.search]);

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
      };
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
      date: invoice.date
        ? new Date(invoice.date).toISOString().split("T")[0]
        : "",
      dueDate: invoice.dueDate
        ? new Date(invoice.dueDate).toISOString().split("T")[0]
        : "",
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
      };
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
    .filter((inv) => inv.status === "pending" || inv.status === "overdue")
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
      ["Date:", new Date(invoice.date).toLocaleDateString()],
      ["Due Date:", new Date(invoice.dueDate).toLocaleDateString()],
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
      valueGetter: (params) => params?.row?.status || params || "draft",
      renderCell: (params) => {
        const status = params?.row?.status || params || "draft";
        return (
          <Chip
            label={status}
            color={
              status === "paid"
                ? "success"
                : status === "pending"
                ? "warning"
                : status === "overdue"
                ? "error"
                : "default"
            }
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
        if (!date) return "N/A";
        try {
          return new Date(date).toLocaleDateString();
        } catch (error) {
          return "Invalid Date";
        }
      },
    },
    {
      field: "dueDate",
      headerName: "Due Date",
      flex: 1,
      valueGetter: (params) => {
        const date = params?.row?.dueDate || params;
        if (!date) return "N/A";
        try {
          return new Date(date).toLocaleDateString();
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

  if (loading) return <Typography>Loading invoices...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box m="20px">
      <Header title="INVOICES" subtitle="Managing your invoices" />
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
              <TextField
                label="Project"
                name="project"
                value={form.project}
                onChange={handleChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Client"
                name="client"
                value={form.client}
                onChange={handleChange}
                required
                sx={{ flex: 1 }}
              />
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
                onChange={handleChange}
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
              <TextField
                label="Project"
                name="project"
                value={editForm.project}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Client"
                name="client"
                value={editForm.client}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
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
