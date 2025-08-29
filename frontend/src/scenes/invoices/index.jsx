import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
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
  useTheme,
  Autocomplete,
  InputAdornment,
  CircularProgress,
  Chip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useLocation, useNavigate } from "react-router-dom";
import {
  invoiceService,
  projectService,
  clientService,
  xeroService,
} from "../../services/api";
import { formatDate } from "../../utils/dateFormat";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useAuth } from "../../context/AuthContext";
import SyncIcon from "@mui/icons-material/Sync";
import { hasPermission } from "../../config/permissions";
import AddIcon from "@mui/icons-material/Add";
import LoadingSpinner from "../../components/LoadingSpinner";

const emptyForm = {
  projectID: "",
  invoiceNumber: "",
  client: "",
  amount: "",
  date: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
  dueDate: "",
  description: "",
  reference: "",
};

const Invoices = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroError, setXeroError] = useState(null);
  const [showXeroAlert, setShowXeroAlert] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [syncingXero, setSyncingXero] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Add permission check for Xero sync
  const canSyncXero = hasPermission(currentUser, "xero.sync");

  useEffect(() => {
    if (authLoading || !currentUser) {
      return;
    }

    const fetchData = async () => {
      try {
        const [invoicesRes, projectsRes, clientsRes] = await Promise.all([
          invoiceService.getAll(),
          projectService.getAll({
            limit: 10000,
            page: 1,
            status: "all_active",
          }), // Get all active projects
          clientService.getAll({ limit: 100 }),
        ]);

        if (!Array.isArray(invoicesRes.data)) {
          setError("Invalid data format received from server");
          setLoading(false);
          return;
        }

        setInvoices(invoicesRes.data);
        setProjects(
          Array.isArray(projectsRes.data?.data) ? projectsRes.data.data : []
        );
        setClients(
          Array.isArray(clientsRes.data.clients)
            ? clientsRes.data.clients
            : Array.isArray(clientsRes.data)
            ? clientsRes.data
            : []
        );
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
        setLoading(false);
      } finally {
      }
    };

    fetchData();
  }, [authLoading, currentUser]);

  // Auto-calculate due date when invoice date or client changes
  useEffect(() => {
    if (form.date && form.client && !dueDateManuallyChanged) {
      const selectedClient = clients.find(
        (client) => client._id === form.client
      );
      let paymentTerms = 30; // Default fallback

      if (selectedClient?.paymentTerms) {
        if (selectedClient.paymentTerms === "Standard (30 days)") {
          paymentTerms = 30;
        } else if (
          selectedClient.paymentTerms === "Payment before Report (7 days)"
        ) {
          paymentTerms = 7;
        }
      }

      const dateObj = new Date(form.date);
      dateObj.setDate(dateObj.getDate() + paymentTerms);
      setForm((prev) => ({
        ...prev,
        dueDate: dateObj.toISOString().split("T")[0], // format as yyyy-mm-dd for input
      }));
    }
  }, [form.date, form.client, clients, dueDateManuallyChanged]);

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
        console.error("Error checking Xero connection:", error);
        setXeroError("Failed to check Xero connection");
      } finally {
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
    const xeroStatus = searchParams.get("xero_connected");
    const xeroError = searchParams.get("xero_error");
    const clientFilter = searchParams.get("client");

    // Handle client filter from URL
    if (clientFilter) {
      // Set the search query to the client name from URL
      const clientName = decodeURIComponent(clientFilter);
      setSearchQuery(clientName);
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

  // Update client when client selection changes
  const handleClientChange = (e) => {
    const clientId = e.target.value;
    setForm((prev) => ({
      ...prev,
      client: clientId,
    }));
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Get all active projects (no filtering needed since backend provides active projects)
  const allActiveProjects = useMemo(() => {
    // Ensure projects is always an array
    const projectsArray = Array.isArray(projects) ? projects : [];

    console.log("=== ACTIVE PROJECTS DEBUG ===");
    console.log("Total active projects from backend:", projectsArray.length);
    console.log("Projects data:", projectsArray);

    if (projectsArray.length > 0) {
      console.log("Sample project structure:", projectsArray[0]);
      console.log("Available statuses:", [
        ...new Set(projectsArray.map((p) => p.status)),
      ]);
    }

    console.log("===============================");
    return projectsArray;
  }, [projects]);

  // Filter projects based on search text
  const filteredProjects = useMemo(() => {
    if (!projectSearch) return allActiveProjects;

    return allActiveProjects.filter(
      (project) =>
        project.projectID
          ?.toLowerCase()
          .includes(projectSearch.toLowerCase()) ||
        project.name?.toLowerCase().includes(projectSearch.toLowerCase())
    );
  }, [allActiveProjects, projectSearch]);

  // Create stable references for selected projects
  const selectedProject = useMemo(() => {
    if (!form.projectID) return null;
    return (
      allActiveProjects.find((p) => p.projectID === form.projectID) || null
    );
  }, [form.projectID, allActiveProjects]);

  const handleEditInvoice = (invoice) => {
    // Navigate to the edit invoice page instead of opening dialog
    navigate(`/invoices/edit/${invoice._id}`);
  };

  const handleViewInvoice = async (invoice) => {
    try {
      // Create a PDF document
      const doc = {
        content: [
          { text: "INVOICE", style: "header" },
          { text: "\n" },
          {
            columns: [
              {
                width: "*",
                text: [
                  { text: "Invoice ID: ", bold: true },
                  invoice.invoiceID,
                  "\n",
                  { text: "Date: ", bold: true },
                  formatDate(invoice.date),
                  "\n",
                  { text: "Due Date: ", bold: true },
                  formatDate(invoice.dueDate),
                ],
              },
              {
                width: "*",
                text: [
                  { text: "Status: ", bold: true },
                  invoice.status.toUpperCase(),
                  "\n",
                  { text: "Amount: ", bold: true },
                  `$${Number(invoice.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                ],
              },
            ],
          },
          { text: "\n\n" },
          { text: "Client Information", style: "subheader" },
          {
            text: [
              { text: "Client: ", bold: true },
              invoice.xeroClientName || invoice.client?.name || "N/A",
            ],
          },
          { text: "\n\n" },
          { text: "Project Information", style: "subheader" },
          {
            text: [
              { text: "Project ID: ", bold: true },
              invoice.projectId?.projectID || "N/A",
              "\n",
              { text: "Project Name: ", bold: true },
              invoice.projectId?.name || "N/A",
            ],
          },
          { text: "\n\n" },
          { text: "Description", style: "subheader" },
          { text: invoice.description || "No description provided" },
          { text: "\n\n" },
          { text: "Line Items", style: "subheader" },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "auto", "auto", "auto", "auto"],
              body: [
                [
                  { text: "Item No", style: "tableHeader" },
                  { text: "Description", style: "tableHeader" },
                  { text: "Quantity", style: "tableHeader" },
                  { text: "Unit Price", style: "tableHeader" },
                  { text: "Tax", style: "tableHeader" },
                  { text: "Amount", style: "tableHeader" },
                ],
                ...(invoice.lineItems || []).map((item) => [
                  item.itemNo || "",
                  item.description || "",
                  item.quantity?.toString() || "1",
                  `$${Number(item.unitPrice).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  `$${Number(item.taxAmount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  `$${Number(item.amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                ]),
              ],
            },
          },
          { text: "\n" },
          {
            columns: [
              { width: "*", text: "" },
              {
                width: "auto",
                table: {
                  widths: ["*", "auto"],
                  body: [
                    [
                      { text: "Subtotal:", bold: true },
                      {
                        text: `$${Number(
                          invoice.lineItems?.reduce(
                            (sum, item) =>
                              sum + (item.amount - (item.taxAmount || 0)),
                            0
                          ) || 0
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        alignment: "right",
                      },
                    ],
                    [
                      { text: "Tax:", bold: true },
                      {
                        text: `$${Number(
                          invoice.lineItems?.reduce(
                            (sum, item) => sum + (item.taxAmount || 0),
                            0
                          ) || 0
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`,
                        alignment: "right",
                      },
                    ],
                    [
                      { text: "Total:", bold: true },
                      {
                        text: `$${Number(invoice.amount).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}`,
                        alignment: "right",
                      },
                    ],
                  ],
                },
              },
            ],
          },
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: "center",
          },
          subheader: {
            fontSize: 16,
            bold: true,
            margin: [0, 10, 0, 5],
          },
          tableHeader: {
            fontSize: 12,
            bold: true,
            fillColor: "#f5f5f5",
            alignment: "center",
          },
        },
        defaultStyle: {
          fontSize: 12,
        },
      };

      // Generate PDF using the backend service
      const response = await fetch(
        `${
          process.env.REACT_APP_API_URL || "http://localhost:5000/api"
        }/pdf/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(doc),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      // Get the PDF blob
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Open in a new tab
      window.open(url, "_blank");

      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      setErrorMessage("Failed to generate invoice PDF");
      setErrorDialogOpen(true);
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
    // Apply search filtering first
    let filtered = [...invoices];

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((invoice) => {
        // Search in invoice ID
        if (invoice.invoiceID?.toLowerCase().includes(searchLower)) return true;

        // Search in project name/ID
        const project = projects.find((p) => p._id === invoice.projectId);
        if (project) {
          const projectText = `${project.projectID || ""} ${
            project.name || ""
          }`.toLowerCase();
          if (projectText.includes(searchLower)) return true;
        }

        // Search in client name
        if (invoice.xeroClientName?.toLowerCase().includes(searchLower))
          return true;
        if (
          invoice.projectId?.client?.name?.toLowerCase().includes(searchLower)
        )
          return true;
        if (invoice.client?.name?.toLowerCase().includes(searchLower))
          return true;

        // Search in status
        if (invoice.status?.toLowerCase().includes(searchLower)) return true;

        // Search in amount
        if (invoice.amount?.toString().includes(searchLower)) return true;

        // If no match found, exclude this invoice
        return false;
      });
    }

    // Apply sorting
    const sorted = filtered.sort((a, b) => {
      let valA = a[sortBy],
        valB = b[sortBy];

      // Handle amount sorting
      if (sortBy === "amount") {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }
      // Handle overdue column sorting (calculate days from dueDate)
      else if (sortBy === "dueDate") {
        const today = new Date();
        const dueDateA = a.dueDate ? new Date(a.dueDate) : null;
        const dueDateB = b.dueDate ? new Date(b.dueDate) : null;

        if (!dueDateA && !dueDateB) return 0;
        if (!dueDateA) return 1; // No due date goes to the end
        if (!dueDateB) return -1;

        const diffTimeA = dueDateA - today;
        const diffDaysA = Math.ceil(diffTimeA / (1000 * 60 * 60 * 24));
        const diffTimeB = dueDateB - today;
        const diffDaysB = Math.ceil(diffTimeB / (1000 * 60 * 60 * 24));

        valA = diffDaysA;
        valB = diffDaysB;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [invoices, sortBy, sortDir, searchQuery, projects]);

  // Sum of unpaid invoice amounts
  const totalUnpaid = invoices
    .filter((inv) => inv.status === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    .toFixed(2);

  const handleDeleteInvoice = async (invoice) => {
    try {
      const confirmDelete = window.confirm(
        `Are you sure you want to delete invoice ${invoice.invoiceID}? This action cannot be undone.`
      );

      if (!confirmDelete) {
        return; // User cancelled
      }

      // Immediately remove from local state for better UX
      setInvoices(invoices.filter((inv) => inv._id !== invoice._id));

      try {
        await invoiceService.hardDelete(invoice._id);
        // Show success message
        setErrorMessage("Invoice deleted successfully from the app.");
        setErrorDialogOpen(true);
      } catch (error) {
        console.error("Error deleting invoice:", error);
        // Even if the API call fails, the invoice is already removed from the UI
        // This handles cases where the invoice was already deleted or doesn't exist
        if (error.response?.status === 404) {
          setErrorMessage("Invoice was already deleted or not found.");
          setErrorDialogOpen(true);
        } else {
          setErrorMessage(
            "Failed to delete invoice: " +
              (error.response?.data?.message || error.message)
          );
          setErrorDialogOpen(true);
        }
      }
    } catch (error) {
      console.error("Error in handleDeleteInvoice:", error);
      setErrorMessage(
        "An unexpected error occurred while deleting the invoice."
      );
      setErrorDialogOpen(true);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.length === 0) {
      setErrorMessage("Please select invoices to delete");
      setErrorDialogOpen(true);
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete ${selectedInvoices.length} invoice(s)? This action cannot be undone.`
    );

    if (!confirmDelete) {
      return;
    }

    // Immediately remove selected invoices from local state for better UX
    setInvoices(invoices.filter((inv) => !selectedInvoices.includes(inv._id)));

    // Clear selection
    setSelectedInvoices([]);

    try {
      // Delete each selected invoice with better error handling
      const deleteResults = await Promise.allSettled(
        selectedInvoices.map((invoiceId) =>
          invoiceService.hardDelete(invoiceId)
        )
      );

      // Count successful and failed deletions
      const successful = deleteResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failed = deleteResults.filter(
        (result) => result.status === "rejected"
      ).length;

      if (failed === 0) {
        setErrorMessage(`Successfully deleted ${successful} invoice(s)`);
        setErrorDialogOpen(true);
      } else {
        setErrorMessage(
          `Deleted ${successful} invoice(s) successfully. ${failed} invoice(s) were already deleted or not found.`
        );
        setErrorDialogOpen(true);
      }
    } catch (error) {
      console.error("Error bulk deleting invoices:", error);
      setErrorMessage(
        "Failed to delete some invoices: " +
          (error.response?.data?.message || error.message)
      );
      setErrorDialogOpen(true);
    }
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedInvoices(newSelection);
  };

  const handleSyncDraftsToXero = async () => {
    try {
      console.log("Starting draft sync to Xero...");
      setXeroError(null);

      // Get all draft invoices that don't have a Xero ID and are not deleted
      const draftInvoices = invoices.filter(
        (invoice) =>
          invoice.status === "draft" &&
          !invoice.xeroInvoiceId &&
          !invoice.isDeleted
      );

      if (draftInvoices.length === 0) {
        setErrorMessage("No draft invoices found to sync to Xero");
        setErrorDialogOpen(true);
        return;
      }

      console.log(`Found ${draftInvoices.length} draft invoices to sync`);

      // Sync each draft invoice to Xero
      for (const invoice of draftInvoices) {
        try {
          console.log(
            "Sending invoice to Xero:",
            JSON.stringify(invoice, null, 2)
          );
          const response = await xeroService.createInvoice(invoice);
          console.log("Created Xero invoice:", response);

          // Note: Backend handles updating the invoice status automatically
        } catch (error) {
          console.error(`Failed to sync invoice ${invoice.invoiceID}:`, error);
        }
      }

      // Refresh the invoices list
      const invoicesRes = await invoiceService.getAll();
      setInvoices(invoicesRes.data);

      setErrorMessage(
        `Successfully synced ${draftInvoices.length} draft invoices to Xero`
      );
      setErrorDialogOpen(true);
    } catch (error) {
      console.error("Error syncing drafts to Xero:", error);
      let errorMessage = "Failed to sync drafts to Xero";

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setXeroError(errorMessage);
      setShowXeroAlert(true);
    }
  };

  const columns = [
    {
      field: "invoiceID",
      headerName: "Invoice ID",
      flex: 0.5,
      minWidth: 180,
      maxWidth: 240,
      sortable: true,
      valueGetter: (params) => {
        const invoiceID = params?.row?.invoiceID || params;
        return invoiceID || "N/A";
      },
    },
    {
      field: "client",
      headerName: "Client",
      flex: 2,
      minWidth: 200,
      maxWidth: 400,
      sortable: true,
      valueGetter: (params) => {
        const row = params?.row;
        let clientName = "N/A";

        // For Xero invoices, use xeroClientName
        if (row?.xeroClientName) {
          clientName = row.xeroClientName;
        }
        // For app-created invoices, try to get client name from project
        else if (row?.projectId?.client?.name) {
          clientName = row.projectId.client.name;
        }
        // Fallback to client object name
        else if (row?.client?.name) {
          clientName = row.client.name;
        }

        return clientName;
      },
    },
    // {
    //   field: "amount",
    //   headerName: "Amount",
    //   flex: 0.5,
    //   minWidth: 150,
    //   maxWidth: 180,
    //   sortable: true,
    //   valueGetter: (params) => {
    //     const amount = params?.row?.amount || params;
    //     if (amount !== undefined && amount !== null) {
    //       return `$${Number(amount).toLocaleString(undefined, {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2,
    //       })}`;
    //     }
    //     return "N/A";
    //   },
    // },
    {
      field: "date",
      headerName: "Invoice Date",
      flex: 1,
      minWidth: 120,
      maxWidth: 140,
      sortable: true,
      valueGetter: (params) => {
        const date = params?.row?.date || params;
        return formatDate(date);
      },
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 120,
      maxWidth: 220,
      sortable: true,
      valueGetter: (params) => {
        const status = params?.row?.status || params || "unpaid";
        if (status === "awaiting_approval") {
          return "Awaiting Approval";
        }
        return status.charAt(0).toUpperCase() + status.slice(1);
      },
      renderCell: (params) => {
        const status = params?.row?.status || params || "unpaid";
        // Format status text properly
        let displayText = status;
        if (status === "awaiting_approval") {
          displayText = "Awaiting Approval";
        } else {
          displayText = status.charAt(0).toUpperCase() + status.slice(1);
        }
        const isOverdue =
          params.row.dueDate && new Date(params.row.dueDate) < new Date();

        // Determine chip color and styling based on status
        let chipColor = "default";
        let chipVariant = "outlined";
        let textColor = "inherit";
        let backgroundColor = "transparent";

        switch (status) {
          case "paid":
            chipColor = "success";
            chipVariant = "filled";
            textColor = "white";
            break;
          case "unpaid":
            chipColor = "error";
            chipVariant = "filled";
            textColor = "white";
            backgroundColor = isOverdue ? "#d32f2f" : "#f44336";
            break;
          case "draft":
            chipColor = "warning";
            chipVariant = "filled";
            textColor = "white";
            backgroundColor = "#ff9800"; // Orange color
            break;
          case "awaiting_approval":
            chipColor = "primary";
            chipVariant = "filled";
            textColor = "white";
            backgroundColor = "#1976d2"; // Blue color
            break;
          default:
            chipColor = "default";
            chipVariant = "outlined";
        }

        return (
          <Chip
            label={displayText}
            color={chipColor}
            variant={chipVariant}
            sx={{
              color: textColor,
              backgroundColor: backgroundColor,
              fontWeight: isOverdue && status === "unpaid" ? "bold" : "normal",
              fontSize: "0.75rem",
              minWidth: "80px",
              "& .MuiChip-label": {
                color: textColor,
                fontWeight:
                  isOverdue && status === "unpaid" ? "bold" : "normal",
              },
            }}
          />
        );
      },
    },
    {
      field: "dueDate",
      headerName: "Due/Overdue",
      flex: 1,
      minWidth: 100,
      maxWidth: 120,
      sortable: true,
      valueGetter: (params) => {
        const date = params?.row?.dueDate || params;
        if (!date) return "N/A";
        try {
          const dueDate = new Date(date);
          const today = new Date();
          const diffTime = dueDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            return `${diffDays} days`;
          } else if (diffDays === 0) {
            return "Today";
          } else {
            return `${Math.abs(diffDays)} overdue`;
          }
        } catch (error) {
          return "Invalid Date";
        }
      },
      renderCell: (params) => {
        const date = params?.row?.dueDate || params;
        if (!date) return "N/A";
        try {
          const dueDate = new Date(date);
          const today = new Date();
          const diffTime = dueDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const isOverdue = diffDays < 0 && params.row.status === "unpaid";

          let displayText = "";
          let color = "inherit";

          if (diffDays > 0) {
            displayText = `${diffDays} days`;
            color = "success.main";
          } else if (diffDays === 0) {
            displayText = "Today";
            color = "warning.main";
          } else {
            displayText = `${Math.abs(diffDays)} overdue`;
            color = isOverdue ? "error.main" : "inherit";
          }

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
                  color: color,
                  fontWeight: isOverdue ? "bold" : "normal",
                  fontSize: "0.875rem", // Smaller font size
                }}
              >
                {displayText}
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
      headerName: "",
      flex: 1,
      minWidth: 120,
      maxWidth: 120,
      sortable: false,
      renderCell: (params) => {
        const row = params?.row || params;
        if (!row) return null;
        return (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              height: "100%",
            }}
          >
            {/* View button for all invoices */}
            <IconButton
              onClick={() => handleViewInvoice(row)}
              title="View Invoice"
              sx={{ mr: 1 }}
            >
              <VisibilityIcon />
            </IconButton>

            {/* Edit button for draft and awaiting approval invoices */}
            {row.status === "draft" && (
              <IconButton
                onClick={() => handleEditInvoice(row)}
                title="Edit Invoice"
                padding="3"
              >
                <EditIcon />
              </IconButton>
            )}

            {/* Delete button for draft and awaiting approval invoices */}
            {(row.status === "draft" || row.status === "awaiting_approval") && (
              <IconButton
                onClick={() => handleDeleteInvoice(row)}
                title="Delete Invoice"
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            )}
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

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    try {
      // Find the project object that matches the projectID
      const selectedProject = projects.find(
        (p) => p.projectID === form.projectID
      );

      if (!selectedProject) {
        console.error("Selected project not found");
        return;
      }

      // Calculate due date based on invoice date and client payment terms
      let dueDate = null;
      if (form.date) {
        const invoiceDate = new Date(form.date);
        const calculatedDueDate = new Date(invoiceDate);

        // Get payment terms from the selected client
        const selectedClient = clients.find(
          (client) => client._id === form.client
        );
        let paymentTerms = 30; // Default fallback

        if (selectedClient?.paymentTerms) {
          if (selectedClient.paymentTerms === "Standard (30 days)") {
            paymentTerms = 30;
          } else if (
            selectedClient.paymentTerms === "Payment before Report (7 days)"
          ) {
            paymentTerms = 7;
          }
        }

        calculatedDueDate.setDate(invoiceDate.getDate() + paymentTerms);
        dueDate = calculatedDueDate.toISOString();
      }

      // Create the combined invoice ID
      const invoiceID = `${selectedProject.projectID}-${form.invoiceNumber}`;

      // Get client name from the selected client ID
      const selectedClient = clients.find(
        (client) => client._id === form.client
      );
      const clientName =
        selectedClient?.name || selectedProject.client?.name || "";

      const formattedForm = {
        ...form,
        invoiceID,
        projectID: selectedProject.projectID,
        date: form.date ? new Date(form.date).toISOString() : null,
        dueDate: dueDate,
        amount: parseFloat(form.amount),
        projectId: selectedProject._id,
        xeroClientName: clientName, // Save the actual client name
        xeroReference: form.reference || "", // Save the reference field
        status: "draft", // Always save as draft
      };

      // Remove the invoiceNumber field as it's not needed in the database
      delete formattedForm.invoiceNumber;

      console.log("Saving draft invoice:", formattedForm);
      const response = await invoiceService.create(formattedForm);
      setInvoices([response.data, ...invoices]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (err) {
      console.error("Error saving draft invoice:", err);
    }
  };

  const handleFinaliseDraft = async (e) => {
    e.preventDefault();
    try {
      // Find the project object that matches the projectID
      const selectedProject = projects.find(
        (p) => p.projectID === form.projectID
      );

      if (!selectedProject) {
        console.error("Selected project not found");
        return;
      }

      // Calculate due date based on invoice date and client payment terms
      let dueDate = null;
      if (form.date) {
        const invoiceDate = new Date(form.date);
        const calculatedDueDate = new Date(invoiceDate);

        // Get payment terms from the selected client
        const selectedClient = clients.find(
          (client) => client._id === form.client
        );
        let paymentTerms = 30; // Default fallback

        if (selectedClient?.paymentTerms) {
          if (selectedClient.paymentTerms === "Standard (30 days)") {
            paymentTerms = 30;
          } else if (
            selectedClient.paymentTerms === "Payment before Report (7 days)"
          ) {
            paymentTerms = 7;
          }
        }

        calculatedDueDate.setDate(invoiceDate.getDate() + paymentTerms);
        dueDate = calculatedDueDate.toISOString();
      }

      // Create the combined invoice ID
      const invoiceID = `${selectedProject.projectID}-${form.invoiceNumber}`;

      // Get client name from the selected client ID
      const selectedClient = clients.find(
        (client) => client._id === form.client
      );
      const clientName =
        selectedClient?.name || selectedProject.client?.name || "";

      const formattedForm = {
        ...form,
        invoiceID,
        projectID: selectedProject.projectID,
        date: form.date ? new Date(form.date).toISOString() : null,
        dueDate: dueDate,
        amount: parseFloat(form.amount),
        projectId: selectedProject._id,
        xeroClientName: clientName, // Save the actual client name
        xeroReference: form.reference || "", // Save the reference field
        status: "awaiting_approval", // Set to awaiting approval
      };

      // Remove the invoiceNumber field as it's not needed in the database
      delete formattedForm.invoiceNumber;

      console.log("Finalising draft invoice:", formattedForm);
      const response = await invoiceService.create(formattedForm);
      setInvoices([response.data, ...invoices]);
      setForm(emptyForm);
      setDialogOpen(false);
    } catch (err) {
      console.error("Error finalising draft invoice:", err);
    }
  };

  // When opening the dialog, reset manual change flag

  const handleConnectXero = async () => {
    console.log("handleConnectXero called");
    console.log("Current user:", currentUser);
    console.log("Token in localStorage:", localStorage.getItem("token"));

    if (!currentUser) {
      console.log("No user found, redirecting to login");
      setError("Please log in to connect to Xero");
      setErrorMessage("Please log in to connect to Xero");
      setErrorDialogOpen(true);
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
      setSyncingXero(true);
      const response = await xeroService.syncInvoices();
      console.log("Sync response:", response);
      // Refresh the invoices list
      const invoicesRes = await invoiceService.getAll();
      setInvoices(invoicesRes.data);
      setXeroError(null);
      // setShowXeroAlert(true); // REMOVE this
    } catch (error) {
      console.error("Error syncing with Xero:", error);
      let errorMessage = "Failed to sync with Xero";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      if (
        errorMessage.includes("reconnect") ||
        errorMessage.includes("connect first")
      ) {
        setXeroConnected(false);
      }
      setXeroError(errorMessage);
      // setShowXeroAlert(true); // REMOVE this
    } finally {
      setSyncingXero(false);
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

  // Show UI immediately, data will load in background

  if (error) {
    return (
      <Box m="20px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <Typography variant="h3" component="h1" marginTop="20px" gutterBottom>
          Invoices
        </Typography>
        {loading && <CircularProgress size={24} sx={{ color: "#4CAF50" }} />}
      </Box>
      {/* Loading overlay for Xero sync */}
      {syncingXero && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            bgcolor: "rgba(255,255,255,0.7)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CircularProgress size={80} thickness={5} color="primary" />
          <Typography variant="h6" sx={{ ml: 3 }}>
            Syncing unpaid & awaiting approval invoices from Xero...
          </Typography>
        </Box>
      )}

      {/* Add Invoice Button - Full Width */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate("/invoices/draft")}
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
          ADD DRAFT INVOICE
        </Button>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box display="flex" gap={2}>
          {canSyncXero && !xeroConnected && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handleConnectXero}
              startIcon={<AccountBalanceIcon />}
              sx={{
                minWidth: "200px",
                color: "primary.main",
                borderColor: "primary.main",
                "&:hover": {
                  backgroundColor: "primary.main",
                  color: "white",
                  borderColor: "primary.main",
                },
              }}
            >
              Connect to Xero
            </Button>
          )}
          {xeroConnected && canSyncXero && (
            <Button
              variant="outlined"
              color="primary"
              onClick={handleSyncXero}
              startIcon={<SyncIcon />}
              sx={{ minWidth: "200px" }}
            >
              SYNC WITH XERO
            </Button>
          )}

          {selectedInvoices.length > 0 && (
            <Button
              variant="contained"
              color="error"
              onClick={handleBulkDelete}
              startIcon={<DeleteIcon />}
              sx={{ minWidth: "150px" }}
            >
              Delete ({selectedInvoices.length})
            </Button>
          )}
        </Box>

        {/* Sync Drafts to Xero button - separated at the end */}
        {xeroConnected && canSyncXero && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSyncDraftsToXero}
            startIcon={<SyncIcon />}
            sx={{ minWidth: "200px" }}
          >
            Sync Drafted Invoices to Xero
          </Button>
        )}
      </Box>

      {/* Search Bar */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search invoices by ID, project, client, status, or amount..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery("")}
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
            },
          }}
        />
      </Box>

      {/* Invoice Summary */}
      <Box
        sx={{
          mt: 2,
          mb: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="body1" color="text.secondary" fontWeight="bold">
          {invoices.length} invoices
        </Typography>
      </Box>

      <Box
        m="20px 0 0 0"
        height="75vh"
        sx={{
          "& .MuiDataGrid-root": { border: "none" },
          "& .MuiDataGrid-cell": {
            borderBottom: "none",
            color: "#000000",
          },
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: theme.palette.primary.main,
            borderBottom: "none",
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
        {validatedInvoices.length > 0 && (
          <DataGrid
            rows={getFilteredInvoices()}
            columns={columns}
            getRowId={(row) => row._id}
            pageSize={25}
            rowsPerPageOptions={[10, 25, 50, 100]}
            // checkboxSelection
            disableSelectionOnClick
            loading={loading}
            autoHeight
            onSelectionModelChange={handleSelectionChange}
            selectionModel={selectedInvoices}
            disableColumnMenu={false}
            disableColumnFilter={true}
            disableColumnSelector={true}
            disableDensitySelector={true}
            sortingMode="server"
            onSortModelChange={(model) => {
              if (model.length > 0) {
                const { field } = model[0];
                handleSort(field);
              }
            }}
            initialState={{
              sorting: {
                sortModel: [{ field: "date", sort: "desc" }],
              },
            }}
          />
        )}
      </Box>

      {/* Add Invoice Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setForm(emptyForm);
          setDueDateManuallyChanged(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "primary.main",
              color: "white",
            }}
          >
            <AddIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Create Invoice
          </Typography>
        </DialogTitle>
        <form>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Autocomplete
                options={filteredProjects || []}
                getOptionLabel={(option) => {
                  return `${option.projectID || ""} - ${option.name || ""}`;
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Project ID"
                    required
                    placeholder="Select an active project"
                    sx={{ flex: 1 }}
                  />
                )}
                value={selectedProject}
                onChange={(event, newValue) => {
                  if (newValue && newValue.projectID) {
                    // Find the client ID that matches the project's client name
                    const clientId =
                      clients.find((client) => client.name === newValue.client)
                        ?._id || "";

                    setForm((prev) => ({
                      ...prev,
                      projectID: newValue.projectID,
                      client: clientId, // Auto-populate client field
                      reference: newValue.workOrder || "", // Auto-populate reference with project workOrder
                    }));
                  } else {
                    setForm((prev) => ({
                      ...prev,
                      projectID: "",
                      client: "", // Clear client field
                      reference: "", // Clear reference field
                    }));
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setProjectSearch(newInputValue);
                }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Invoice Number"
                name="invoiceNumber"
                value={form.invoiceNumber}
                onChange={handleChange}
                type="number"
                required
                sx={{ flex: 1 }}
                InputProps={{
                  inputProps: { min: 1 },
                }}
                helperText="Enter a number (e.g., 1, 2, 3)"
              />
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Client</InputLabel>
                <Select
                  label="Client"
                  name="client"
                  value={form.client}
                  onChange={handleClientChange}
                  required
                >
                  {Array.isArray(clients)
                    ? clients.map((client) => (
                        <MenuItem key={client._id} value={client._id}>
                          {client.name}
                        </MenuItem>
                      ))
                    : []}
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
                InputProps={{
                  inputProps: { min: 0, step: "0.01" },
                }}
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
              {form.client && (
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Payment Terms:{" "}
                    {(() => {
                      const selectedClient = clients.find(
                        (client) => client._id === form.client
                      );
                      return (
                        selectedClient?.paymentTerms || "Standard (30 days)"
                      );
                    })()}
                  </Typography>
                </Box>
              )}
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
            <TextField
              label="Reference"
              name="reference"
              value={form.reference}
              onChange={handleChange}
              fullWidth
              sx={{ mt: 2 }}
              placeholder="Project reference will be auto-populated"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
            <Button
              onClick={() => {
                setDialogOpen(false);
                setForm(emptyForm);
                setDueDateManuallyChanged(false);
              }}
              variant="outlined"
              sx={{
                minWidth: 100,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDraft}
              variant="outlined"
              color="primary"
              sx={{
                minWidth: 120,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Save Draft
            </Button>
            <Button
              onClick={handleFinaliseDraft}
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              sx={{
                minWidth: 140,
                borderRadius: 2,
                textTransform: "none",
                fontWeight: 500,
              }}
            >
              Finalise Draft
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Error Dialog */}
      <Dialog
        open={errorDialogOpen}
        onClose={() => setErrorDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "error.main",
              color: "white",
            }}
          >
            <DeleteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Error
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            {errorMessage}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={() => setErrorDialogOpen(false)}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Invoices;
