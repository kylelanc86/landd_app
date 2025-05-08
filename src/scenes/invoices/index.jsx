import React, { useState, useEffect } from "react";
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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import FilterListIcon from "@mui/icons-material/FilterList";
import autoTable from "jspdf-autotable";

const INVOICES_KEY = "ldc_invoices";
const STATUS_OPTIONS = ["Paid", "Unpaid"];

// Fake data for demo
const FAKE_INVOICES = Array.from({ length: 12 }).map((_, i) => ({
  id: 2000 + i,
  projectId: `LDJ${String(1000 + i).padStart(5, "0")}`,
  projectName: `Project ${i + 1}`,
  client: `Client ${String.fromCharCode(65 + (i % 5))}`,
  amount: (Math.random() * 5000 + 500).toFixed(2),
  invoiceDate: new Date(Date.now() - i * 86400000 * 3)
    .toISOString()
    .slice(0, 10),
  dueDate: new Date(Date.now() + (i % 5) * 86400000 * 7)
    .toISOString()
    .slice(0, 10),
  status: STATUS_OPTIONS[i % 2],
}));

const emptyForm = {
  projectId: "",
  projectName: "",
  client: "",
  amount: "",
  invoiceDate: "",
  dueDate: "",
  status: STATUS_OPTIONS[1],
};

const handleInvoicePDF = (invoice) => {
  const doc = new jsPDF();

  // Add header information
  doc.setFontSize(18);
  doc.text("Invoice", 14, 16);
  doc.setFontSize(12);

  // Add invoice details
  const details = [
    ["Invoice ID:", invoice.id],
    ["Project Name:", invoice.projectName],
    ["Client:", invoice.client],
    ["Amount:", `$${invoice.amount}`],
    ["Invoice Date:", invoice.invoiceDate],
    ["Due Date:", invoice.dueDate],
    ["Status:", invoice.status],
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
  doc.save(`Invoice_${invoice.id}.pdf`);
};

const Invoices = ({ toggleColorMode, mode }) => {
  const [invoices, setInvoices] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [sortBy, setSortBy] = useState("invoiceDate");
  const [sortDir, setSortDir] = useState("desc");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClient, setFilterClient] = useState("");

  // Load invoices from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(INVOICES_KEY);
    if (stored && JSON.parse(stored).length > 0) {
      setInvoices(JSON.parse(stored));
    } else {
      setInvoices(FAKE_INVOICES);
      localStorage.setItem(INVOICES_KEY, JSON.stringify(FAKE_INVOICES));
    }
  }, []);

  // Save invoices to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  }, [invoices]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleAddInvoice = (e) => {
    e.preventDefault();
    if (
      !form.projectId.trim() ||
      !form.projectName.trim() ||
      !form.client.trim()
    )
      return;
    const newInvoice = {
      id: Date.now(),
      ...form,
    };
    setInvoices([newInvoice, ...invoices]);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const handleEditInvoice = (invoice) => {
    setEditId(invoice.id);
    setEditForm({ ...invoice });
    setEditDialogOpen(true);
  };
  const handleSaveEdit = (e) => {
    e.preventDefault();
    setInvoices(
      invoices.map((inv) => (inv.id === editId ? { ...editForm } : inv))
    );
    setEditDialogOpen(false);
    setEditId(null);
    setEditForm(emptyForm);
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

  // Only show unpaid invoices by default
  const unpaidInvoices = invoices.filter((inv) => inv.status !== "Paid");
  const sortedInvoices = [...unpaidInvoices]
    .filter(
      (inv) =>
        (!filterStatus || inv.status === filterStatus) &&
        (!filterClient || inv.client === filterClient)
    )
    .sort((a, b) => {
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

  // Unique clients for filter
  const uniqueClients = Array.from(new Set(invoices.map((inv) => inv.client)));

  // Sum of unpaid invoice amounts
  const totalUnpaid = unpaidInvoices
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    .toFixed(2);

  // Print to PDF function (placeholder)
  const handlePrintPDF = () => {
    window.print();
  };

  // Navigation for client/project links (assume react-router-dom v6)
  const handleGoToClient = (client) => {
    // You may want to use client ID if available
    window.location.href = `/clients?search=${encodeURIComponent(client)}`;
  };
  const handleGoToProject = (projectName) => {
    window.location.href = `/projects?search=${encodeURIComponent(
      projectName
    )}`;
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", mt: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4" sx={{ fontSize: { xs: 32, md: 40 } }}>
          Invoices
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setDialogOpen(true)}
        >
          Create Invoice
        </Button>
      </Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <FilterListIcon />
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Client</InputLabel>
            <Select
              label="Client"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {uniqueClients.map((client) => (
                <MenuItem key={client} value={client}>
                  {client}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ ml: 2, fontWeight: 600 }}>
            Total Unpaid: ${totalUnpaid}
          </Typography>
        </Stack>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "id"}
                    direction={sortBy === "id" ? sortDir : "asc"}
                    onClick={() => handleSort("id")}
                  >
                    Invoice ID
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "projectName"}
                    direction={sortBy === "projectName" ? sortDir : "asc"}
                    onClick={() => handleSort("projectName")}
                  >
                    Project Name
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "client"}
                    direction={sortBy === "client" ? sortDir : "asc"}
                    onClick={() => handleSort("client")}
                  >
                    Client
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "amount"}
                    direction={sortBy === "amount" ? sortDir : "asc"}
                    onClick={() => handleSort("amount")}
                  >
                    Invoice Amount
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "invoiceDate"}
                    direction={sortBy === "invoiceDate" ? sortDir : "asc"}
                    onClick={() => handleSort("invoiceDate")}
                  >
                    Invoice Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "dueDate"}
                    direction={sortBy === "dueDate" ? sortDir : "asc"}
                    onClick={() => handleSort("dueDate")}
                  >
                    Invoice Due Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortBy === "status"}
                    direction={sortBy === "status" ? sortDir : "asc"}
                    onClick={() => handleSort("status")}
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedInvoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
              {sortedInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.id}</TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToProject(invoice.projectName)}
                    >
                      {invoice.projectName}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="text"
                      onClick={() => handleGoToClient(invoice.client)}
                    >
                      {invoice.client}
                    </Button>
                  </TableCell>
                  <TableCell>${invoice.amount}</TableCell>
                  <TableCell>{invoice.invoiceDate}</TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>{invoice.status}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEditInvoice(invoice)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleInvoicePDF(invoice)}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Project ID"
                name="projectId"
                value={form.projectId}
                onChange={handleChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Project Name"
                name="projectName"
                value={form.projectName}
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
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Invoice Amount"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                type="number"
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Invoice Date"
                name="invoiceDate"
                value={form.invoiceDate}
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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{ mb: 2 }}
            >
              <TextField
                label="Project ID"
                name="projectId"
                value={editForm.projectId}
                onChange={handleEditChange}
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Project Name"
                name="projectName"
                value={editForm.projectName}
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
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Invoice Amount"
                name="amount"
                value={editForm.amount}
                onChange={handleEditChange}
                type="number"
                required
                sx={{ flex: 1 }}
              />
              <TextField
                label="Invoice Date"
                name="invoiceDate"
                value={editForm.invoiceDate}
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
