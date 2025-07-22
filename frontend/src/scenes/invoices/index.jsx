import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  InputAdornment,
  Alert,
  Snackbar,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
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
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useAuth } from "../../context/AuthContext";
import SyncIcon from "@mui/icons-material/Sync";
import { hasPermission } from "../../config/permissions";
import AddIcon from "@mui/icons-material/Add";
import performanceMonitor from "../../utils/performanceMonitor";

const TERMS_OPTIONS = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 7 days", days: 7 },
  { label: "Net 14 days", days: 14 },
  { label: "Net 30 days", days: 30 },
  { label: "Net 45 days", days: 45 },
  { label: "Net 60 days", days: 60 },
  { label: "Net 90 days", days: 90 },
];

const emptyForm = {
  projectID: "",
  invoiceNumber: "",
  client: "",
  amount: "",
  date: new Date().toISOString().split("T")[0], // Today's date in YYYY-MM-DD format
  dueDate: "",
  terms: 30, // Default to Net 30 days
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
  const [dueDateManuallyChanged, setDueDateManuallyChanged] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroError, setXeroError] = useState(null);
  const [showXeroAlert, setShowXeroAlert] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [syncingXero, setSyncingXero] = useState(false);

  // Add permission check for Xero sync
  const canSyncXero = hasPermission(currentUser, "xero.sync");

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.startPageLoad("invoices-page");

    return () => {
      performanceMonitor.endPageLoad("invoices-page");
    };
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser) {
      return;
    }

    const fetchData = async () => {
      performanceMonitor.startTimer("fetch-invoices-data");
      try {
        const [invoicesRes, projectsRes, clientsRes] = await Promise.all([
          invoiceService.getAll(),
          projectService.getAll({
            limit: 10000,
            page: 1,
            status: "all_active",
          }), // Get all active projects
          clientService.getAll(),
        ]);

        if (!Array.isArray(invoicesRes.data)) {
          setError("Invalid data format received from server");
          setLoading(false);
          return;
        }

        console.log("=== FRONTEND DATA DEBUG ===");
        console.log("Invoices data:", invoicesRes.data);
        console.log("Projects response:", projectsRes.data);
        console.log("Projects data array:", projectsRes.data?.data);
        console.log("Clients data:", clientsRes.data);

        // Check if invoices have client data
        if (Array.isArray(invoicesRes.data)) {
          invoicesRes.data.forEach((invoice, index) => {
            console.log(`Invoice ${index + 1}:`, {
              invoiceID: invoice.invoiceID,
              xeroClientName: invoice.xeroClientName,
              client: invoice.client,
              clientName: invoice.client?.name,
              clientId: invoice.client?._id,
            });
          });
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
        performanceMonitor.endTimer("fetch-invoices-data");
      }
    };

    fetchData();
  }, [authLoading, currentUser]);

  // Add this effect to check Xero connection status
  useEffect(() => {
    // Don't check Xero connection if auth is still loading or no user
    if (authLoading || !currentUser) return;

    const checkXeroConnection = async () => {
      performanceMonitor.startTimer("check-xero-connection");
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
        performanceMonitor.endTimer("check-xero-connection");
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

  {
    /* Removed client filter from URL handling */
  }

  // When invoice date changes, auto-set due date if not manually changed
  useEffect(() => {
    if (form.date && !dueDateManuallyChanged) {
      const dateObj = new Date(form.date);
      dateObj.setDate(dateObj.getDate() + (form.terms || 30));
      setForm((prev) => ({
        ...prev,
        dueDate: dateObj.toISOString().split("T")[0], // format as yyyy-mm-dd for input
      }));
    }
  }, [form.date, form.terms, dueDateManuallyChanged]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
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

  const selectedEditProject = useMemo(() => {
    console.log("selectedEditProject debug:", {
      editFormProjectID: editForm.projectID,
      allActiveProjectsCount: allActiveProjects.length,
      availableProjectIDs: allActiveProjects
        .map((p) => p.projectID)
        .slice(0, 5), // Show first 5 for debugging
    });

    if (!editForm.projectID) return null;

    const foundProject = allActiveProjects.find(
      (p) => p.projectID === editForm.projectID
    );
    console.log("Found project for edit:", foundProject);
    return foundProject || null;
  }, [editForm.projectID, allActiveProjects]);

  const handleEditInvoice = (invoice) => {
    setEditId(invoice._id);

    // Extract project ID and invoice number from invoiceID (e.g., "LDJ04694-1" -> projectID: "LDJ04694", invoiceNumber: "1")
    const invoiceParts = invoice.invoiceID ? invoice.invoiceID.split("-") : [];
    const projectID =
      invoiceParts.length > 1
        ? invoiceParts.slice(0, -1).join("-")
        : invoice.projectID || "";
    const invoiceNumber =
      invoiceParts.length > 0 ? invoiceParts[invoiceParts.length - 1] : "";

    console.log("Edit invoice debug:", {
      originalInvoiceID: invoice.invoiceID,
      extractedProjectID: projectID,
      extractedInvoiceNumber: invoiceNumber,
      storedProjectID: invoice.projectID,
      xeroClientName: invoice.xeroClientName,
      client: invoice.client,
    });

    // Find the client ID that matches the project's client name or xeroClientName
    const clientName = invoice.xeroClientName || invoice.client?.name || "";
    const clientId =
      clients.find((client) => client.name === clientName)?._id || "";

    console.log("Client lookup debug:", {
      clientName: clientName,
      foundClientId: clientId,
      availableClients: clients
        .map((c) => ({ name: c.name, id: c._id }))
        .slice(0, 3),
    });

    // Format dates for the form and set client from project or xeroClientName
    const formattedInvoice = {
      ...invoice,
      projectID: projectID, // Set the projectID so selectedEditProject can find it
      invoiceNumber: invoiceNumber, // Add invoice number field
      date: invoice.date ? formatDateForInput(invoice.date) : "",
      dueDate: invoice.dueDate ? formatDateForInput(invoice.dueDate) : "",
      client: clientId, // Set client ID for the Select dropdown
      terms: 30, // Default terms
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

      if (!selectedProject) {
        console.error("Selected project not found");
        return;
      }

      // Calculate due date based on invoice date and terms
      let dueDate = null;
      if (editForm.date) {
        const invoiceDate = new Date(editForm.date);
        const calculatedDueDate = new Date(invoiceDate);
        calculatedDueDate.setDate(
          invoiceDate.getDate() + (editForm.terms || 30)
        );
        dueDate = calculatedDueDate.toISOString();
      }

      // Create the combined invoice ID
      const invoiceID = `${selectedProject.projectID}-${editForm.invoiceNumber}`;

      const formattedForm = {
        ...editForm,
        invoiceID,
        projectID: selectedProject.projectID,
        date: editForm.date ? new Date(editForm.date).toISOString() : null,
        dueDate: dueDate,
        amount: parseFloat(editForm.amount),
        project: selectedProject._id,
        xeroClientName: selectedProject.client?.name || editForm.client, // Get client name from selected project
      };

      // Remove the invoiceNumber field as it's not needed in the database
      delete formattedForm.invoiceNumber;

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
    // Apply sorting only
    const sorted = [...invoices].sort((a, b) => {
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
  }, [invoices, sortBy, sortDir]);

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
        alert("Invoice deleted successfully from the app.");
      } catch (error) {
        console.error("Error deleting invoice:", error);
        // Even if the API call fails, the invoice is already removed from the UI
        // This handles cases where the invoice was already deleted or doesn't exist
        if (error.response?.status === 404) {
          alert("Invoice was already deleted or not found.");
        } else {
          alert(
            "Failed to delete invoice: " +
              (error.response?.data?.message || error.message)
          );
        }
      }
    } catch (error) {
      console.error("Error in handleDeleteInvoice:", error);
      alert("An unexpected error occurred while deleting the invoice.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedInvoices.length === 0) {
      alert("Please select invoices to delete");
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
        alert(`Successfully deleted ${successful} invoice(s)`);
      } else {
        alert(
          `Deleted ${successful} invoice(s) successfully. ${failed} invoice(s) were already deleted or not found.`
        );
      }
    } catch (error) {
      console.error("Error bulk deleting invoices:", error);
      alert(
        "Failed to delete some invoices: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedInvoices(newSelection);
  };

  const handleClearAll = async () => {
    try {
      const confirmClear = window.confirm(
        `Are you sure you want to delete ALL ${invoices.length} invoices? This action cannot be undone and will clear all current data.`
      );

      if (!confirmClear) {
        return; // User cancelled
      }

      // Delete all invoices with better error handling
      const deleteResults = await Promise.allSettled(
        invoices.map((invoice) => invoiceService.hardDelete(invoice._id))
      );

      // Count successful and failed deletions
      const successful = deleteResults.filter(
        (result) => result.status === "fulfilled"
      ).length;
      const failed = deleteResults.filter(
        (result) => result.status === "rejected"
      ).length;

      // Clear local state regardless of individual failures
      setInvoices([]);
      setSelectedInvoices([]);

      if (failed === 0) {
        alert(
          `Successfully deleted all ${invoices.length} invoices. You can now resync with Xero for clean data.`
        );
      } else {
        alert(
          `Deleted ${successful} invoices successfully. ${failed} invoices were already deleted or not found. You can now resync with Xero for clean data.`
        );
      }
    } catch (error) {
      console.error("Error clearing all invoices:", error);
      alert(
        "Failed to clear all invoices: " +
          (error.response?.data?.message || error.message)
      );
    }
  };

  const handleSyncDraftsToXero = async () => {
    try {
      console.log("Starting draft sync to Xero...");
      setXeroError(null);

      // Get all draft invoices that don't have a Xero ID
      const draftInvoices = invoices.filter(
        (invoice) => invoice.status === "draft" && !invoice.xeroInvoiceId
      );

      if (draftInvoices.length === 0) {
        alert("No draft invoices found to sync to Xero");
        return;
      }

      console.log(`Found ${draftInvoices.length} draft invoices to sync`);

      // Sync each draft invoice to Xero
      for (const invoice of draftInvoices) {
        try {
          const response = await xeroService.createInvoice(invoice);
          console.log("Created Xero invoice:", response);

          // Update the local invoice with Xero ID
          await invoiceService.update(invoice._id, {
            ...invoice,
            xeroInvoiceId: response.InvoiceID,
            xeroStatus: "DRAFT",
          });
        } catch (error) {
          console.error(`Failed to sync invoice ${invoice.invoiceID}:`, error);
        }
      }

      // Refresh the invoices list
      const invoicesRes = await invoiceService.getAll();
      setInvoices(invoicesRes.data);

      alert(
        `Successfully synced ${draftInvoices.length} draft invoices to Xero`
      );
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
      flex: 1,
      minWidth: 100,
      maxWidth: 100,
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
        else if (row?.project?.client?.name) {
          clientName = row.project.client.name;
        }
        // Fallback to client object name
        else if (row?.client?.name) {
          clientName = row.client.name;
        }

        console.log("Client column valueGetter:", {
          invoiceID: row?.invoiceID,
          xeroClientName: row?.xeroClientName,
          projectClientName: row?.project?.client?.name,
          clientObjectName: row?.client?.name,
          finalClientName: clientName,
        });

        return clientName;
      },
    },
    {
      field: "amount",
      headerName: "Amount",
      flex: 1,
      minWidth: 150,
      maxWidth: 200,
      sortable: true,
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
      maxWidth: 180,
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
      headerName: "Overdue",
      flex: 1,
      minWidth: 150,
      maxWidth: 200,
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
      headerName: "Actions",
      flex: 1,
      sortable: false,
      renderCell: (params) => {
        const row = params?.row || params;
        if (!row) return null;
        return (
          <Box>
            {/* Only show edit button for draft and awaiting approval invoices */}
            {(row.status === "draft" || row.status === "awaiting_approval") && (
              <IconButton
                onClick={() => handleEditInvoice(row)}
                title="Edit Invoice"
              >
                <EditIcon />
              </IconButton>
            )}
            <IconButton onClick={() => handleInvoicePDF(row)} title="Print PDF">
              <PrintIcon />
            </IconButton>
            {/* Show delete button for draft and awaiting approval invoices */}
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

  const handleTermsChange = (e) => {
    const selectedTerms = parseInt(e.target.value);
    setForm((prev) => ({ ...prev, terms: selectedTerms }));

    // Auto-calculate due date based on terms and invoice date
    if (form.date) {
      const invoiceDate = new Date(form.date);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(invoiceDate.getDate() + selectedTerms);

      setForm((prev) => ({
        ...prev,
        terms: selectedTerms,
        dueDate: dueDate.toISOString().split("T")[0],
      }));
    }
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

      // Calculate due date based on invoice date and terms
      let dueDate = null;
      if (form.date) {
        const invoiceDate = new Date(form.date);
        const calculatedDueDate = new Date(invoiceDate);
        calculatedDueDate.setDate(invoiceDate.getDate() + (form.terms || 30));
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
        project: selectedProject._id,
        xeroClientName: clientName, // Save the actual client name
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

      // Calculate due date based on invoice date and terms
      let dueDate = null;
      if (form.date) {
        const invoiceDate = new Date(form.date);
        const calculatedDueDate = new Date(invoiceDate);
        calculatedDueDate.setDate(invoiceDate.getDate() + (form.terms || 30));
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
        project: selectedProject._id,
        xeroClientName: clientName, // Save the actual client name
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

  const handleDisconnectXero = async () => {
    try {
      await xeroService.disconnect();
      setXeroConnected(false);
      setXeroError("Disconnected from Xero.");
      setShowXeroAlert(true);
      console.log("Xero disconnected successfully.");
    } catch (error) {
      console.error("Error disconnecting from Xero:", error);
      setXeroError(
        error.response?.data?.message ||
          error.message ||
          "Failed to disconnect from Xero"
      );
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
          onClick={handleOpenDialog}
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
          {canSyncXero && (
            <Button
              variant="outlined"
              color={xeroConnected ? "error" : "primary"}
              onClick={xeroConnected ? handleDisconnectXero : handleConnectXero}
              startIcon={<AccountBalanceIcon />}
              sx={{
                minWidth: "200px",
                color: xeroConnected ? "error.main" : "primary.main",
                borderColor: xeroConnected ? "error.main" : "primary.main",
                "&:hover": {
                  backgroundColor: xeroConnected
                    ? "error.main"
                    : "primary.main",
                  color: "white",
                  borderColor: xeroConnected ? "error.main" : "primary.main",
                },
              }}
            >
              {xeroConnected ? "Disconnect from Xero" : "Connect to Xero"}
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

      {/* Removed all filtering UI elements */}

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
        <Typography variant="body2" color="text.secondary">
          Showing {getFilteredInvoices().length} of {invoices.length} invoices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total Unpaid: ${totalUnpaid}
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
            checkboxSelection
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
                const { field, sort } = model[0];
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
      >
        <DialogTitle>Create Invoice</DialogTitle>
        <form>
          <DialogContent>
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
                    }));
                  } else {
                    setForm((prev) => ({
                      ...prev,
                      projectID: "",
                      client: "", // Clear client field
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
                  onChange={handleChange}
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Terms</InputLabel>
                <Select
                  label="Terms"
                  name="terms"
                  value={form.terms}
                  onChange={handleTermsChange}
                >
                  {TERMS_OPTIONS.map((term) => (
                    <MenuItem key={term.days} value={term.days}>
                      {term.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDialogOpen(false);
                setForm(emptyForm);
                setDueDateManuallyChanged(false);
              }}
              color="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDraft}
              variant="outlined"
              color="primary"
            >
              Save Draft
            </Button>
            <Button
              onClick={handleFinaliseDraft}
              variant="contained"
              color="primary"
            >
              Finalise Draft
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
                value={selectedEditProject}
                onChange={(event, newValue) => {
                  if (newValue && newValue.projectID) {
                    // Find the client ID that matches the project's client name
                    const clientId =
                      clients.find((client) => client.name === newValue.client)
                        ?._id || "";

                    setEditForm((prev) => ({
                      ...prev,
                      projectID: newValue.projectID,
                      client: clientId, // Auto-populate client field
                    }));
                  } else {
                    setEditForm((prev) => ({
                      ...prev,
                      projectID: "",
                      client: "", // Clear client field
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
                value={editForm.invoiceNumber}
                onChange={handleEditChange}
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
                  value={editForm.client}
                  onChange={handleEditChange}
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
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Terms</InputLabel>
                <Select
                  label="Terms"
                  name="terms"
                  value={editForm.terms}
                  onChange={handleEditChange}
                >
                  {TERMS_OPTIONS.map((term) => (
                    <MenuItem key={term.days} value={term.days}>
                      {term.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
