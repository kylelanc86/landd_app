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
      case "approved":
        return "success";
      case "in progress":
      case "pending approval":
        return "warning";
      case "draft":
        return "info";
      default:
        return "default";
    }
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
              <TableCell>Reference</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  {new Date(report.date).toLocaleDateString()}
                </TableCell>
                <TableCell>{report.reference}</TableCell>
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
                    label={report.status}
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
