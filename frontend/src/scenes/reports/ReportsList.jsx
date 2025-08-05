import React from "react";
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
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
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
}) => {
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
              {category !== "fibre-id" && category !== "air-monitoring" && (
                <TableCell>Reference</TableCell>
              )}
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  {format(new Date(report.date), "dd/MM/yyyy")}
                </TableCell>
                {category !== "fibre-id" && category !== "air-monitoring" && (
                  <TableCell>{report.reference}</TableCell>
                )}
                <TableCell>
                  <Typography variant="body2">{report.description}</Typography>
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
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default ReportsList;
