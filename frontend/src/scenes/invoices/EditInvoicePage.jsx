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
  Select,
  MenuItem,
  Breadcrumbs,
  Link,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

import {
  projectService,
  invoiceService,
  clientService,
} from "../../services/api";
import invoiceItemService from "../../services/invoiceItemService";
import { formatDateForInput } from "../../utils/dateFormat";

const EditInvoicePage = () => {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectInputValue, setProjectInputValue] = useState("");

  // Invoice header state
  const [invoiceHeader, setInvoiceHeader] = useState({
    invoiceNumber: "",
    invoiceDate: "",
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
  const [currentInvoice, setCurrentInvoice] = useState(null);

  // Available invoice items for dropdown
  const [availableInvoiceItems, setAvailableInvoiceItems] = useState([]);

  // Responsive column visibility state
  const [showTaxRateColumn, setShowTaxRateColumn] = useState(true);
  const [showAccountColumn, setShowAccountColumn] = useState(true);

  // Default values
  const defaultAccount = "191 - Consulting Fees";
  const defaultTaxRate = "GST on Income";

  useEffect(() => {
    fetchProjects();
    fetchClients();
    fetchAvailableInvoiceItems();
  }, [invoiceId]);

  // Monitor table width and adjust column visibility
  useEffect(() => {
    const handleResize = () => {
      const tableContainer = document.querySelector(".invoice-table-container");
      if (tableContainer) {
        const width = tableContainer.offsetWidth;

        // Calculate available space for description column
        // Fixed columns: Item No (80px) + Qty (60px) + Unit Price (100px) + Tax Amount (100px) + Amount (105px) + Actions (50px) = 495px
        // Variable columns: Account (120px) + Tax Rate (90px) = 210px
        const fixedColumnsWidth = 495;
        const availableWidth = width - fixedColumnsWidth;

        if (availableWidth < 240) {
          // Hide tax rate column first
          setShowTaxRateColumn(false);
          if (availableWidth < 150) {
            // Then hide account column
            setShowAccountColumn(false);
          } else {
            setShowAccountColumn(true);
          }
        } else {
          // Show both columns
          setShowTaxRateColumn(true);
          setShowAccountColumn(true);
        }
      }
    };

    // Initial check
    handleResize();

    // Add resize listener
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const fetchClients = async () => {
    try {
      const response = await clientService.getAll({ limit: 100 });
      setClients(response.data?.clients || response.data || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      setClients([]);
    }
  };

  const fetchInvoiceData = async () => {
    try {
      const response = await invoiceService.getById(invoiceId);
      const invoice = response.data;
      setCurrentInvoice(invoice); // Store the invoice data

      // Extract the actual project ID from the projectId object
      const actualProjectId = invoice.projectId?._id || invoice.projectId;

      // Find the project using the stored projectId
      const project = projects.find((p) => p._id === actualProjectId);

      if (project) {
        setSelectedProject(project);
        setSelectedClient({
          name: invoice.xeroClientName || project.client || "",
          _id: project.client || "",
        });
      }

      // Set invoice header data
      setInvoiceHeader({
        invoiceNumber: invoice.invoiceID || "",
        invoiceDate: invoice.date ? formatDateForInput(invoice.date) : "",
        dueDate: invoice.dueDate ? formatDateForInput(invoice.dueDate) : "",
        client: invoice.xeroClientName || "",
        project: project?.name || "",
        status: invoice.status || "draft",
        totalAmount: invoice.totalAmount || 0,
        totalTax: invoice.totalTax || 0,
        grandTotal: invoice.grandTotal || 0,
      });

      // Set invoice items
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        const items = invoice.lineItems.map((item, index) => ({
          id: Date.now() + index,
          itemNo: item.itemNo || "",
          description: item.description || "",
          qty: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          account: item.account || defaultAccount,
          taxRate: item.taxRate || defaultTaxRate,
          taxAmount: item.taxAmount || 0,
          amount: item.amount || 0,
        }));
        setInvoiceItems(items);
      } else {
        // Add a default invoice item row if no line items
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
      }
    } catch (error) {
      console.error("Error fetching invoice data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoice data after projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      fetchInvoiceData();
    }
  }, [projects, invoiceId]);

  const fetchProjects = async () => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found - user needs to log in");
        setProjects([]);
        return;
      }

      const response = await projectService.getAll({
        limit: 100000, // High limit to get all projects
      });

      // Handle different response structures
      const projectsData =
        response.data?.data || response.data?.projects || response.data || [];

      // Filter for active projects (in progress, report sent for review, ready for invoicing, invoice sent)
      const activeStatuses = [
        "in progress",
        "samples submitted to lab",
        "lab analysis completed",
        "report sent for review",
        "ready for invoicing",
        "invoice sent",
        "invoiced - awaiting payment",
      ];

      const activeProjects = Array.isArray(projectsData)
        ? projectsData.filter((project) => {
            const projectStatus = project.status?.toLowerCase();
            return activeStatuses.some(
              (status) => projectStatus === status.toLowerCase(),
            );
          })
        : [];

      // Sort projects by projectID in descending order (most recent first)
      const sortedActiveProjects = activeProjects.sort((a, b) => {
        return b.projectID.localeCompare(a.projectID, undefined, {
          numeric: true,
        });
      });

      setProjects(sortedActiveProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      if (error.response?.status === 401) {
        console.error("Authentication failed - user may need to log in");
      }
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
          const selectedClientObj = clients.find(
            (client) => client.name === selectedClient?.name,
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
              calculateTaxAmount(qty, unitPrice),
            );
            updatedItem.amount = parseFloat(
              calculateTotalAmount(qty, unitPrice),
            );
          }

          return updatedItem;
        }
        return item;
      }),
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
              calculateTaxAmount(qty, unitPrice),
            );
            updatedItem.amount = parseFloat(
              calculateTotalAmount(qty, unitPrice),
            );

            return updatedItem;
          }
          return item;
        }),
      );
    }
  };

  const handleUpdateInvoice = async () => {
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
            (client) => client.name === selectedClient?.name,
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

      // Prepare updated invoice data
      const updatedInvoiceData = {
        invoiceID: currentInvoice.invoiceID, // Include the existing invoiceID
        projectId: selectedProject._id, // MongoDB ObjectId reference
        client: null, // We'll handle client separately since it's a string, not ObjectId
        amount: calculateInvoiceTotal(), // Total amount
        status: "draft", // Keep or reset to draft
        date: new Date(invoiceHeader.invoiceDate), // Convert to Date object
        dueDate: new Date(effectiveDueDate), // Convert to Date object
        description: `Invoice for project ${selectedProject.name}`, // Description
        xeroClientName: selectedClient?.name, // Store client name in Xero field
        xeroReference:
          invoiceHeader.reference || selectedProject?.workOrder || "", // Store reference in Xero field
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

      // Update invoice via API
      const response = await invoiceService.update(
        invoiceId,
        updatedInvoiceData,
      );

      if (response.status === 200) {
        // Redirect to invoices page on successful update
        navigate("/invoices");
      } else {
        console.error("Failed to update invoice");
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
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
              `Line item ${index + 1}: Quantity must be greater than 0`,
            );
          if (!item.unitPrice || item.unitPrice <= 0)
            validationErrors.push(
              `Line item ${index + 1}: Unit price must be greater than 0`,
            );
          if (!item.amount || item.amount <= 0)
            validationErrors.push(
              `Line item ${index + 1}: Amount must be greater than 0`,
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
          error.response.data.details,
        );
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

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Typography>Loading invoice data...</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
        Edit Invoice
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
          <Typography color="text.primary">Edit Invoice</Typography>
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
                if (inputValue.length < 2) return options || [];
                const filterValue = inputValue.toLowerCase();
                const filtered = (options || []).filter(
                  (option) =>
                    option.name.toLowerCase().includes(filterValue) ||
                    option.projectID.toLowerCase().includes(filterValue),
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
                    projects.length === 0 && !loading
                      ? "No active projects found. Please ensure you're logged in and there are projects with active statuses."
                      : projects.length > 0
                        ? `Found ${projects.length} active projects. Type to filter or click to see all.`
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
              helperText="Auto-populated from project client (editable if different)"
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
                    (client) => client.name === selectedClient?.name,
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
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Invoice Items */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box mb={2}>
          <Typography variant="h5">Invoice Items</Typography>
        </Box>

        <TableContainer className="invoice-table-container">
          <Table sx={{ tableLayout: "fixed" }}>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell sx={{ width: "80px", minWidth: "80px" }}>
                  Item No
                </TableCell>
                <TableCell sx={{ minWidth: "230px" }}>Description</TableCell>
                <TableCell sx={{ width: "60px", minWidth: "60px" }}>
                  Qty
                </TableCell>
                <TableCell
                  sx={{ width: "100px", minWidth: "80px", maxWidth: "105px" }}
                >
                  Unit Price (AUD$)
                </TableCell>
                {showAccountColumn && (
                  <TableCell
                    sx={{
                      width: "120px",
                      minWidth: "90px",
                      wordWrap: "break-word",
                      whiteSpace: "normal",
                      lineHeight: "1.2",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Account
                  </TableCell>
                )}
                {showTaxRateColumn && (
                  <TableCell
                    sx={{
                      width: "90px",
                      minWidth: "85px",
                      maxWidth: "95px",
                      wordWrap: "break-word",
                      whiteSpace: "normal",
                      lineHeight: "1.2",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Tax Rate
                  </TableCell>
                )}
                <TableCell
                  sx={{ width: "100px", minWidth: "85px", maxWidth: "110px" }}
                >
                  Tax Amount (AUD$)
                </TableCell>
                <TableCell
                  sx={{ width: "105px", minWidth: "105px", maxWidth: "105px" }}
                >
                  Amount (AUD$)
                </TableCell>
                <TableCell sx={{ width: "50px", minWidth: "50px" }}>
                  {" "}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoiceItems.map((item) => (
                <TableRow
                  key={item.id}
                  sx={{ "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.04)" } }}
                >
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <Autocomplete
                      options={availableInvoiceItems}
                      getOptionLabel={(option) => option.itemNo || ""}
                      value={
                        availableInvoiceItems.find(
                          (ai) => ai.itemNo === item.itemNo,
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
                              fontSize: "0.75rem",
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
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <TextField
                      size="small"
                      value={item.description}
                      onChange={(e) =>
                        handleItemChange(item.id, "description", e.target.value)
                      }
                      fullWidth
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.75rem",
                          padding: "6px 8px",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <TextField
                      size="small"
                      type="number"
                      value={item.qty}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "qty",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      fullWidth
                      inputProps={{
                        style: { textAlign: "right" },
                        step: "any",
                      }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.75rem",
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
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <TextField
                      size="small"
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "unitPrice",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      fullWidth
                      inputProps={{
                        style: { textAlign: "right" },
                        step: "any",
                      }}
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.75rem",
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
                  {showAccountColumn && (
                    <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={item.account}
                          onChange={(e) =>
                            handleItemChange(item.id, "account", e.target.value)
                          }
                          sx={{ fontSize: "0.75rem" }}
                          variant="standard"
                        >
                          <MenuItem
                            value={defaultAccount}
                            sx={{ fontSize: "0.75rem" }}
                          >
                            {defaultAccount}
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                  )}
                  {showTaxRateColumn && (
                    <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                      <FormControl size="small" fullWidth>
                        <Select
                          value={item.taxRate}
                          onChange={(e) =>
                            handleItemChange(item.id, "taxRate", e.target.value)
                          }
                          sx={{ fontSize: "0.75rem" }}
                          variant="standard"
                        >
                          <MenuItem
                            value={defaultTaxRate}
                            sx={{ fontSize: "0.75rem" }}
                          >
                            {defaultTaxRate}
                          </MenuItem>
                        </Select>
                      </FormControl>
                    </TableCell>
                  )}
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <TextField
                      size="small"
                      value={item.taxAmount.toFixed(2)}
                      fullWidth
                      disabled
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.75rem",
                          padding: "6px 8px",
                        },
                      }}
                      variant="standard"
                    />
                  </TableCell>
                  <TableCell sx={{ padding: "8px", fontSize: "0.75rem" }}>
                    <TextField
                      size="small"
                      value={item.amount.toFixed(2)}
                      fullWidth
                      disabled
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "0.75rem",
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
                      sx={{ fontSize: "0.75rem" }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add Item Button - moved below the table */}
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-start" }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Add Item
          </Button>
        </Box>

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
                2,
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
          onClick={handleUpdateInvoice}
          disabled={!selectedProject || invoiceItems.length === 0}
        >
          Update Invoice
        </Button>
      </Box>
    </Box>
  );
};

export default EditInvoicePage;
