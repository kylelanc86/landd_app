import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
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
import DeleteIcon from "@mui/icons-material/Delete";

import {
  projectService,
  invoiceService,
  clientService,
} from "../../services/api";
import invoiceItemService from "../../services/invoiceItemService";

const DraftInvoicePage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectInputValue, setProjectInputValue] = useState("");

  // Invoice header state with initial due date calculation
  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0], // Today's date
    dueDate: "",
    client: "",
    project: "",
    status: "draft",
    totalAmount: 0,
    totalTax: 0,
    grandTotal: 0,
  });

  // Client state (auto-populated from project)
  const [selectedClient, setSelectedClient] = useState(null);

  // Invoice items state
  const [invoiceItems, setInvoiceItems] = useState([]);

  // Available invoice items for dropdown
  const [availableInvoiceItems, setAvailableInvoiceItems] = useState([]);

  // Default values
  const defaultAccount = "191 - Consulting Fees";
  const defaultTaxRate = "GST on Income";

  useEffect(() => {
    fetchProjects();
    fetchAvailableInvoiceItems();
    fetchClients(); // Fetch clients when the component mounts

    // Add a default invoice item row
    const defaultItem = {
      id: Date.now(),
      itemNo: "",
      description: "",
      qty: 1,
      unitPrice: 0,
      account: defaultAccount,
      taxRate: defaultTaxRate,
      taxAmount: 0,
      amount: 0,
    };
    setInvoiceItems([defaultItem]);
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);

      const response = await projectService.getAll({
        limit: 1000, // High limit to get all projects
      });

      // Handle different response structures
      const projectsData =
        response.data?.data || response.data?.projects || response.data || [];

      // Filter for active projects (in progress, report sent for review, ready for invoicing, invoice sent)
      const activeStatuses = [
        "in progress",
        "report sent for review",
        "ready for invoicing",
        "invoice sent",
      ];

      const activeProjects = Array.isArray(projectsData)
        ? projectsData.filter((project) => {
            const projectStatus = project.status?.toLowerCase();
            return activeStatuses.some(
              (status) => projectStatus === status.toLowerCase()
            );
          })
        : [];

      setProjects(activeProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableInvoiceItems = async () => {
    try {
      const response = await invoiceItemService.getAll();
      setAvailableInvoiceItems(response.data || []);
    } catch (error) {
      console.error("Error fetching available invoice items:", error);
      // For now, use empty array if API is not available
      setAvailableInvoiceItems([]);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await clientService.getAll({ limit: 100 });
      // Ensure we always set an array, handle different response structures
      const clientsData = response.data?.data || response.data || [];
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      setClients([]);
    }
  };

  const handleBackToInvoices = () => {
    navigate("/invoices");
  };

  const handleProjectChange = (event, newValue) => {
    setSelectedProject(newValue);
    // Auto-populate client from selected project
    if (newValue && newValue.client) {
      // Convert client string to object format expected by the UI
      setSelectedClient({
        name: newValue.client,
        _id: newValue.client, // Use client name as ID for now
      });

      // Auto-populate reference field with project's workOrder
      setInvoiceHeader((prev) => ({
        ...prev,
        reference: newValue.workOrder || "",
      }));
    } else {
      setSelectedClient(null);
      // Clear reference field when no project is selected
      setInvoiceHeader((prev) => ({
        ...prev,
        reference: "",
      }));
    }
  };

  const handleHeaderChange = (field, value) => {
    setInvoiceHeader((prev) => {
      const updatedHeader = { ...prev, [field]: value };

      // Auto-calculate due date when invoice date changes
      if (field === "invoiceDate") {
        if (updatedHeader.invoiceDate) {
          const invoiceDate = new Date(updatedHeader.invoiceDate);
          const dueDate = new Date(invoiceDate);

          // Get payment terms from the selected client
          const selectedClientObj = Array.isArray(clients)
            ? clients.find((client) => client.name === selectedClient?.name)
            : null;
          let paymentTerms = 30; // Default fallback

          if (selectedClientObj?.paymentTerms) {
            if (selectedClientObj.paymentTerms === "Standard (30 days)") {
              paymentTerms = 30;
            } else if (
              selectedClientObj.paymentTerms ===
              "Payment before Report (7 days)"
            ) {
              paymentTerms = 7;
            }
          }

          dueDate.setDate(invoiceDate.getDate() + paymentTerms);
          updatedHeader.dueDate = dueDate.toISOString().split("T")[0];
        }
      }

      return updatedHeader;
    });
  };

  const calculateTaxAmount = (qty, unitPrice) => {
    return (qty * unitPrice * 0.1).toFixed(2);
  };

  const calculateTotalAmount = (qty, unitPrice) => {
    return (qty * unitPrice).toFixed(2);
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      itemNo: "",
      description: "",
      qty: 1,
      unitPrice: 0,
      account: defaultAccount,
      taxRate: defaultTaxRate,
      taxAmount: 0,
      amount: 0,
    };
    setInvoiceItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = (itemId) => {
    setInvoiceItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleItemChange = (itemId, field, value) => {
    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };

          // Auto-calculate tax amount and total amount
          if (field === "qty" || field === "unitPrice") {
            const qty = field === "qty" ? value : item.qty;
            const unitPrice = field === "unitPrice" ? value : item.unitPrice;
            updatedItem.taxAmount = parseFloat(
              calculateTaxAmount(qty, unitPrice)
            );
            updatedItem.amount = parseFloat(
              calculateTotalAmount(qty, unitPrice)
            );
          }

          return updatedItem;
        }
        return item;
      })
    );
  };

  const handleInvoiceItemSelect = (itemId, selectedItem) => {
    if (selectedItem) {
      setInvoiceItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const updatedItem = {
              ...item,
              itemNo: selectedItem.itemNo,
              description: selectedItem.description,
              unitPrice: selectedItem.unitPrice,
              account: selectedItem.account,
              taxRate: selectedItem.taxRate,
            };

            // Auto-calculate tax amount and total amount
            const qty = item.qty || 0;
            const unitPrice = selectedItem.unitPrice || 0;
            updatedItem.taxAmount = parseFloat(
              calculateTaxAmount(qty, unitPrice)
            );
            updatedItem.amount = parseFloat(
              calculateTotalAmount(qty, unitPrice)
            );

            return updatedItem;
          }
          return item;
        })
      );
    }
  };

  const handleSaveDraft = async () => {
    try {
      // Validate required fields first
      if (!selectedProject?._id) {
        console.error("Project is required");
        return;
      }
      if (!invoiceHeader.invoiceDate) {
        console.error("Invoice date is required");
        return;
      }

      // Calculate due date if not set
      let effectiveDueDate = invoiceHeader.dueDate;
      if (!effectiveDueDate) {
        if (invoiceHeader.invoiceDate) {
          const invoiceDate = new Date(invoiceHeader.invoiceDate);
          const calculatedDueDate = new Date(invoiceDate);

          // Get payment terms from the selected client
          const selectedClientObj = clients.find(
            (client) => client.name === selectedClient?.name
          );
          let paymentTerms = 30; // Default fallback

          if (selectedClientObj?.paymentTerms) {
            if (selectedClientObj.paymentTerms === "Standard (30 days)") {
              paymentTerms = 30;
            } else if (
              selectedClientObj.paymentTerms ===
              "Payment before Report (7 days)"
            ) {
              paymentTerms = 7;
            }
          }

          calculatedDueDate.setDate(invoiceDate.getDate() + paymentTerms);
          effectiveDueDate = calculatedDueDate.toISOString().split("T")[0];
        } else {
          console.error("Due date is required");
          return;
        }
      }

      // Create unique invoiceID with date suffix
      const today = new Date();
      const dateSuffix =
        today.getDate().toString().padStart(2, "0") +
        (today.getMonth() + 1).toString().padStart(2, "0") +
        today.getFullYear().toString().slice(-2);
      // Add timestamp to ensure uniqueness
      const timestamp = Date.now().toString().slice(-2);
      const uniqueInvoiceID = `${selectedProject.projectID}-${dateSuffix}-${timestamp}`;

      // Prepare draft invoice data
      const draftInvoiceData = {
        invoiceID: uniqueInvoiceID, // Use projectID + date suffix for uniqueness
        projectId: selectedProject._id, // MongoDB ObjectId reference
        client: null, // We'll handle client separately since it's a string, not ObjectId
        amount: calculateInvoiceTotal(), // Total amount
        status: "draft", // Save as draft for Xero sync
        date: new Date(invoiceHeader.invoiceDate), // Convert to Date object
        dueDate: new Date(effectiveDueDate), // Convert to Date object
        description: `Invoice for project ${selectedProject.name}`, // Description
        xeroClientName: selectedClient?.name, // Store client name in Xero field
        xeroReference:
          invoiceHeader.reference ||
          selectedProject.workOrder ||
          selectedProject.name, // Store reference in Xero field
        lineItems: invoiceItems.map((item) => ({
          itemNo: item.itemNo,
          description: item.description,
          quantity: item.qty,
          unitPrice: item.unitPrice,
          account: item.account,
          taxRate: item.taxRate,
          taxAmount: item.taxAmount,
          amount: item.amount,
        })),
      };

      // Save draft invoice via API
      const response = await invoiceService.create(draftInvoiceData);

      if (response.status === 201 || response.status === 200) {
        // Redirect to invoices page on successful save
        navigate("/invoices");
      } else {
        console.error("Failed to save draft invoice");
      }
    } catch (error) {
      console.error("Error saving draft invoice:", error);
      console.error("Error response data:", error.response?.data);

      // Validate the data being sent
      const validationErrors = [];

      // Check required fields
      if (!selectedProject?._id) validationErrors.push("Project is required");
      if (!invoiceHeader.invoiceDate)
        validationErrors.push("Invoice date is required");
      if (!invoiceHeader.dueDate) validationErrors.push("Due date is required");

      // Check line items
      if (!invoiceItems.length) {
        validationErrors.push("At least one line item is required");
      } else {
        invoiceItems.forEach((item, index) => {
          if (!item.qty || item.qty <= 0)
            validationErrors.push(
              `Line item ${index + 1}: Quantity must be greater than 0`
            );
          if (!item.unitPrice || item.unitPrice <= 0)
            validationErrors.push(
              `Line item ${index + 1}: Unit price must be greater than 0`
            );
          if (!item.amount || item.amount <= 0)
            validationErrors.push(
              `Line item ${index + 1}: Amount must be greater than 0`
            );
        });
      }

      if (validationErrors.length > 0) {
        console.error("Validation errors:", validationErrors);
        return;
      }

      // Handle specific error types
      if (error.response?.data?.message === "Invoice validation failed") {
        console.error(
          "Backend validation failed:",
          error.response.data.details
        );
        return;
      }

      if (error.response?.data?.message === "Duplicate invoice ID") {
        console.error("Duplicate invoice ID:", error.response.data.details);
        return;
      }
    }
  };

  const calculateInvoiceTotal = () => {
    return invoiceItems.reduce((total, item) => total + item.amount, 0);
  };

  const calculateInvoiceTaxTotal = () => {
    return invoiceItems.reduce((total, item) => total + item.taxAmount, 0);
  };

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Create Draft Invoice
      </Typography>

      <Box sx={{ mt: 4, mb: 4 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToInvoices}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Invoices Home
          </Link>
          <Typography color="text.primary">Create Draft Invoice</Typography>
        </Breadcrumbs>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Invoice Details
        </Typography>

        <Grid container spacing={3}>
          {/* Project Selection */}
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={projects || []}
              getOptionLabel={(option) =>
                `${option.projectID} - ${option.name}` || ""
              }
              value={selectedProject}
              onChange={handleProjectChange}
              inputValue={projectInputValue}
              onInputChange={(event, newInputValue) =>
                setProjectInputValue(newInputValue)
              }
              filterOptions={(options, { inputValue }) => {
                if (inputValue.length < 2) return [];
                const filterValue = inputValue.toLowerCase();
                const filtered = (options || []).filter(
                  (option) =>
                    option.name.toLowerCase().includes(filterValue) ||
                    option.projectID.toLowerCase().includes(filterValue)
                );
                return filtered;
              }}
              includeInputInList
              filterSelectedOptions
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Project"
                  required
                  fullWidth
                  helperText={
                    projectInputValue.length < 2
                      ? "Type at least 2 characters to search projects"
                      : ""
                  }
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <div>
                    <strong>{option.projectID}</strong> - {option.name}
                  </div>
                </li>
              )}
              isOptionEqualToValue={(option, value) =>
                option.projectID === value.projectID
              }
              loading={loading}
            />
          </Grid>

          {/* Client Field (Auto-populated from Project) */}
          <Grid item xs={12} md={6}>
            <TextField
              label="Client"
              value={selectedClient?.name || ""}
              onChange={(e) => {
                // Allow editing the client name for cases where invoiced client differs from project client
                setSelectedClient((prev) => ({
                  ...prev,
                  name: e.target.value,
                }));
              }}
              fullWidth
              helperText={
                selectedClient?.name
                  ? ""
                  : "Auto-populated from project client (editable if different)"
              }
            />
          </Grid>

          {/* Invoice Header Fields */}
          <Grid item xs={12} md={3}>
            <TextField
              label="Invoice Date"
              type="date"
              value={invoiceHeader.invoiceDate}
              onChange={(e) =>
                handleHeaderChange("invoiceDate", e.target.value)
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Box
              sx={{
                p: 2,
                border: "1px solid #e0e0e0",
                borderRadius: 1,
                backgroundColor: "#f5f5f5",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Payment Terms:{" "}
                {(() => {
                  const selectedClientObj = clients.find(
                    (client) => client.name === selectedClient?.name
                  );
                  return (
                    selectedClientObj?.paymentTerms || "Standard (30 days)"
                  );
                })()}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              label="Due Date"
              type="date"
              value={invoiceHeader.dueDate}
              onChange={(e) => handleHeaderChange("dueDate", e.target.value)}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              label="Reference"
              value={invoiceHeader.reference}
              onChange={(e) => handleHeaderChange("reference", e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Invoice Items */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5">Invoice Items</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: "10%" }}>Item No</TableCell>
                <TableCell sx={{ width: "30%" }}>Description</TableCell>
                <TableCell sx={{ width: "5%" }}>Qty</TableCell>
                <TableCell sx={{ width: "5%" }}>Unit Price (AUD$)</TableCell>
                <TableCell sx={{ width: "15%" }}>Account</TableCell>
                <TableCell sx={{ width: "10%" }}>Tax Rate</TableCell>
                <TableCell sx={{ width: "10%" }}>Tax Amount (AUD$)</TableCell>
                <TableCell sx={{ width: "10%" }}>Amount (AUD$)</TableCell>
                <TableCell sx={{ width: "5%" }}> </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoiceItems.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{ "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" } }}
                >
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <Autocomplete
                      options={availableInvoiceItems}
                      getOptionLabel={(option) => option.itemNo || ""}
                      value={
                        availableInvoiceItems.find(
                          (ai) => ai.itemNo === item.itemNo
                        ) || null
                      }
                      onChange={(event, newValue) =>
                        handleInvoiceItemSelect(item.id, newValue)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select item"
                          sx={{
                            "& .MuiInputBase-input": {
                              fontSize: "0.875rem",
                              padding: "6px 8px",
                            },
                          }}
                          variant="standard"
                        />
                      )}
                      isOptionEqualToValue={(option, value) =>
                        option.itemNo === value.itemNo
                      }
                      slotProps={{
                        popper: {
                          sx: {
                            width: "300px !important",
                            "& .MuiAutocomplete-paper": {
                              width: "300px !important",
                            },
                            "& .MuiAutocomplete-listbox": {
                              fontSize: "0.75rem",
                            },
                          },

                          placement: "bottom-start",
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <TextField
                      size="small"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(item.id, "description", e.target.value)
                      }
                      fullWidth
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.875rem",
                          padding: "6px 8px",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <TextField
                      size="small"
                      type="number"
                      value={item.qty}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "qty",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      fullWidth
                      inputProps={{
                        style: { textAlign: "right" },
                        step: "any",
                      }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.875rem",
                          padding: "6px 8px",
                        },
                        "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                          {
                            WebkitAppearance: "none",
                            margin: 0,
                          },
                        "& input[type=number]": {
                          MozAppearance: "textfield",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <TextField
                      size="small"
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "unitPrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      fullWidth
                      inputProps={{
                        style: { textAlign: "right" },
                        step: "any",
                      }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.875rem",
                          padding: "6px 8px",
                        },
                        "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                          {
                            WebkitAppearance: "none",
                            margin: 0,
                          },
                        "& input[type=number]": {
                          MozAppearance: "textfield",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={item.account}
                        onChange={(e) =>
                          handleItemChange(item.id, "account", e.target.value)
                        }
                        sx={{ fontSize: "0.875rem" }}
                        variant="standard"
                      >
                        <MenuItem
                          value={defaultAccount}
                          sx={{ fontSize: "0.875rem" }}
                        >
                          {defaultAccount}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={item.taxRate}
                        onChange={(e) =>
                          handleItemChange(item.id, "taxRate", e.target.value)
                        }
                        sx={{ fontSize: "0.875rem" }}
                        variant="standard"
                      >
                        <MenuItem
                          value={defaultTaxRate}
                          sx={{ fontSize: "0.875rem" }}
                        >
                          {defaultTaxRate}
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <TextField
                      size="small"
                      value={item.taxAmount.toFixed(2)}
                      fullWidth
                      disabled
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.875rem",
                          padding: "6px 8px",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.875rem" }}>
                    <TextField
                      size="small"
                      value={item.amount.toFixed(2)}
                      fullWidth
                      disabled
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.875rem",
                          padding: "6px 8px",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px" }}>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteItem(item.id)}
                      color="error"
                      sx={{ fontSize: "0.875rem" }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Invoice Totals */}
        {invoiceItems.length > 0 && (
          <Box sx={{ mt: 3, textAlign: "right" }}>
            <Typography variant="h6">
              Subtotal: AUD$ {calculateInvoiceTotal().toFixed(2)}
            </Typography>
            <Typography variant="h6">
              Tax Total: AUD$ {calculateInvoiceTaxTotal().toFixed(2)}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: "bold" }}>
              Total: AUD${" "}
              {(calculateInvoiceTotal() + calculateInvoiceTaxTotal()).toFixed(
                2
              )}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Action Buttons */}
      <Box display="flex" gap={2} justifyContent="flex-end">
        <Button variant="outlined" onClick={handleBackToInvoices}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSaveDraft}
          disabled={!selectedProject || invoiceItems.length === 0}
        >
          Save Draft
        </Button>
      </Box>
    </Box>
  );
};

export default DraftInvoicePage;
