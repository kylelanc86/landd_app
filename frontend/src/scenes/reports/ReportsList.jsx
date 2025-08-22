import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { format } from "date-fns";

const ReportsList = ({
  reports,
  loading,
  error,
  category,
  onView,
  onDownload,
  onPrint,
  onRevise,
}) => {
  const navigate = useNavigate();

  // Function to handle row clicks based on report type and status
  const handleRowClick = (report) => {
    // Only make clickable if not closed
    if (report.status === "closed") {
      return;
    }

    // Navigate based on report type
    switch (report.type) {
      case "clearance":
        navigate(`/clearances/${report.id}/items`);
        break;
      case "asbestos_assessment":
        // Navigate to asbestos assessment items page
        navigate(`/surveys/asbestos/${report.id}/items`);
        break;
      case "shift":
        // Navigate to air monitoring shift details
        navigate(`/air-monitoring/jobs/${report.data?.job?._id}/shifts`);
        break;
      case "fibre_id":
        // Check if it's client-supplied or L&D fibre ID based on the data structure
        // For now, we'll check if there's a specific field or use the description
        if (
          report.data?.jobType === "client-supplied" ||
          report.description?.toLowerCase().includes("client supplied") ||
          report.additionalInfo?.toLowerCase().includes("client supplied")
        ) {
          // Navigate to client-supplied fibre ID samples page
          navigate(`/fibre-id/client-supplied/${report.id}/samples`);
        } else {
          // Navigate to L&D fibre ID analysis page
          navigate(`/fibre-id/analysis/${report.id}`);
        }
        break;
      default:
        // For other types, don't navigate
        break;
    }
  };
  const getCategoryTitle = () => {
    switch (category) {
      case "asbestos-assessment":
        return "Asbestos Assessment Reports";
      case "air-monitoring":
        return "Air Monitoring Reports";
      case "clearance":
        return "Clearance Reports";
      case "fibre-id":
        return "Fibre ID Reports";
      case "invoices":
        return "Invoices";
      default:
        return "Reports";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "complete":
      case "completed":
      case "approved":
      case "final":
        return "success";
      case "in progress":
      case "in_progress":
      case "pending approval":
      case "pending_approval":
      case "awaiting approval":
      case "awaiting_approval":
      case "pending review":
      case "pending_review":
      case "under review":
      case "under_review":
        return "warning";
      case "draft":
      case "preliminary":
        return "info";
      case "rejected":
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  const formatStatus = (status) => {
    if (!status) return "";

    // Handle common status formats
    const statusMap = {
      in_progress: "In Progress",
      pending_approval: "Pending Approval",
      awaiting_approval: "Awaiting Approval",
      completed: "Completed",
      approved: "Approved",
      draft: "Draft",
      submitted: "Submitted",
      rejected: "Rejected",
      cancelled: "Cancelled",
      in_progress: "In Progress",
      pending_review: "Pending Review",
      under_review: "Under Review",
      final: "Final",
      preliminary: "Preliminary",
    };

    // Check if we have a direct mapping
    if (statusMap[status.toLowerCase()]) {
      return statusMap[status.toLowerCase()];
    }

    // Generic formatting: replace underscores with spaces and capitalize
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" sx={{ p: 3 }}>
        {error}
      </Typography>
    );
  }

  if (!reports?.length) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Reports Found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No {getCategoryTitle().toLowerCase()} are available for this project.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {getCategoryTitle()}
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => {
              const isClickable = report.status !== "closed";
              return (
                <TableRow
                  key={report.id}
                  onClick={() => handleRowClick(report)}
                  sx={{
                    cursor: isClickable ? "pointer" : "default",
                    transition: "background-color 0.2s ease",
                    "&:hover": isClickable
                      ? {
                          backgroundColor: "action.hover",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }
                      : {},
                    "&:active": isClickable
                      ? {
                          backgroundColor: "action.selected",
                        }
                      : {},
                  }}
                >
                  <TableCell>
                    {format(new Date(report.date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {report.description}
                    </Typography>
                    {report.additionalInfo && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        {report.additionalInfo}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatStatus(report.status)}
                      color={getStatusColor(report.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box
                      sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                    >
                      <Tooltip title="View Report">
                        <IconButton
                          size="small"
                          onClick={() => onView(report)}
                          color="primary"
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download Report">
                        <IconButton
                          size="small"
                          onClick={() => onDownload(report)}
                          color="secondary"
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print Report">
                        <IconButton
                          size="small"
                          onClick={() => onPrint(report)}
                          color="info"
                        >
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                      <Button
                        size="small"
                        onClick={() => onRevise(report)}
                        color="warning"
                        variant="outlined"
                        sx={{ minWidth: "auto", px: 1 }}
                      >
                        Revise Report
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ReportsList;
