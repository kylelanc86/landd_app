import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import invoiceItemService from "../../services/invoiceItemService";

const InvoiceItems = () => {
  const navigate = useNavigate();
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Default values
  const defaultAccount = "191 - Consulting Fees";
  const defaultTaxRate = "GST on Income";

  const [form, setForm] = useState({
    itemNo: "",
    description: "",
    unitPrice: 0,
    account: defaultAccount,
    taxRate: defaultTaxRate,
  });

  useEffect(() => {
    fetchInvoiceItems();
  }, []);

  const fetchInvoiceItems = async () => {
    try {
      setLoading(true);
      const response = await invoiceItemService.getAll();
      setInvoiceItems(response.data || []);
    } catch (error) {
      console.error("Error fetching invoice items:", error);
      // Fallback to empty array if API is not available
      setInvoiceItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await invoiceItemService.create(form);
      await fetchInvoiceItems();
      setDialogOpen(false);
      setForm({
        itemNo: "",
        description: "",
        unitPrice: 0,
        account: defaultAccount,
        taxRate: defaultTaxRate,
      });
    } catch (error) {
      console.error("Error creating invoice item:", error);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setForm({
      itemNo: item.itemNo,
      description: item.description,
      unitPrice: item.unitPrice || 0,
      account: item.account,
      taxRate: item.taxRate,
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await invoiceItemService.update(editingItem._id, form);
      await fetchInvoiceItems();
      setEditDialogOpen(false);
      setEditingItem(null);
      setForm({
        itemNo: "",
        description: "",
        unitPrice: 0,
        account: defaultAccount,
        taxRate: defaultTaxRate,
      });
    } catch (error) {
      console.error("Error updating invoice item:", error);
    }
  };

  const handleDeleteClick = (item) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await invoiceItemService.delete(itemToDelete._id);
      await fetchInvoiceItems();
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting invoice item:", error);
    }
  };

  if (loading) {
    return (
      <Box m="20px">
        <Typography>Loading invoice items...</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Invoice Items Management
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToAdmin}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Admin Home
          </Link>
          <Typography color="text.primary">Invoice Items</Typography>
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5">Default Invoice Items</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Add Invoice Item
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell sx={{ width: "15%" }}>Item No</TableCell>
                <TableCell sx={{ width: "40%" }}>Description</TableCell>
                <TableCell sx={{ width: "15%" }}>Unit Price (AUD$)</TableCell>
                <TableCell sx={{ width: "15%" }}>Account</TableCell>
                <TableCell sx={{ width: "10%" }}>Tax Rate</TableCell>
                <TableCell sx={{ width: "5%" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoiceItems.map((item) => (
                <TableRow
                  key={item._id}
                  sx={{ "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" } }}
                >
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {item.itemNo}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {item.description}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", textAlign: "right" }}>
                    ${(parseFloat(item.unitPrice) || 0).toFixed(2)}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {item.account}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem" }}>
                    {item.taxRate}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(item)}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(item)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Item Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Invoice Item</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                name="itemNo"
                label="Item No"
                value={form.itemNo}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                name="description"
                label="Description"
                value={form.description}
                onChange={handleChange}
                required
                fullWidth
                multiline
                rows={3}
              />
              <TextField
                name="unitPrice"
                label="Unit Price (AUD$)"
                type="number"
                value={form.unitPrice}
                onChange={handleChange}
                required
                fullWidth
                inputProps={{
                  step: "any",
                  min: 0,
                }}
                sx={{
                  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                    {
                      "-webkit-appearance": "none",
                      margin: 0,
                    },
                  "& input[type=number]": {
                    "-moz-appearance": "textfield",
                  },
                }}
              />
              <FormControl fullWidth>
                <InputLabel>Account</InputLabel>
                <Select
                  name="account"
                  value={form.account}
                  label="Account"
                  onChange={handleChange}
                >
                  <MenuItem value={defaultAccount}>{defaultAccount}</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Tax Rate</InputLabel>
                <Select
                  name="taxRate"
                  value={form.taxRate}
                  label="Tax Rate"
                  onChange={handleChange}
                >
                  <MenuItem value={defaultTaxRate}>{defaultTaxRate}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Add Item
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Invoice Item</DialogTitle>
        <form onSubmit={handleEditSubmit}>
          <DialogContent>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                name="itemNo"
                label="Item No"
                value={form.itemNo}
                onChange={handleChange}
                required
                fullWidth
              />
              <TextField
                name="description"
                label="Description"
                value={form.description}
                onChange={handleChange}
                required
                fullWidth
                multiline
                rows={3}
              />
              <TextField
                name="unitPrice"
                label="Unit Price (AUD$)"
                type="number"
                value={form.unitPrice}
                onChange={handleChange}
                required
                fullWidth
                inputProps={{
                  step: "any",
                  min: 0,
                }}
                sx={{
                  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                    {
                      "-webkit-appearance": "none",
                      margin: 0,
                    },
                  "& input[type=number]": {
                    "-moz-appearance": "textfield",
                  },
                }}
              />
              <FormControl fullWidth>
                <InputLabel>Account</InputLabel>
                <Select
                  name="account"
                  value={form.account}
                  label="Account"
                  onChange={handleChange}
                >
                  <MenuItem value={defaultAccount}>{defaultAccount}</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Tax Rate</InputLabel>
                <Select
                  name="taxRate"
                  value={form.taxRate}
                  label="Tax Rate"
                  onChange={handleChange}
                >
                  <MenuItem value={defaultTaxRate}>{defaultTaxRate}</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Update Item
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the invoice item "
            {itemToDelete?.description}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
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

export default InvoiceItems;
