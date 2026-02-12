import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import asbestosRemovalJobService from "../../services/asbestosRemovalJobService";
import { formatDate } from "../../utils/dateFormat";
import { useSnackbar } from "../../context/SnackbarContext";

const ArchivedDataDialog = ({ open, onClose, projectId }) => {
  const { showSnackbar } = useSnackbar();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchArchivedData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await asbestosRemovalJobService.getArchivedData(projectId);
      setItems(response.data?.items || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load archived data"
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchArchivedData();
    }
  }, [open, fetchArchivedData]);

  const handleDownloadCSV = async (item) => {
    setDownloadingId(item._id);
    try {
      let response;
      if (item.itemType === "shift") {
        response = await asbestosRemovalJobService.exportArchivedShiftCSV(
          item._id
        );
      } else if (item.itemType === "clearance") {
        response = await asbestosRemovalJobService.exportArchivedClearanceCSV(
          item._id
        );
      } else {
        showSnackbar("CSV export not available for this item type.", "info");
        return;
      }

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8",
      });
      const disposition = response.headers?.["content-disposition"];
      let filename = `${item.reportType}_${item._id}.csv`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSnackbar("CSV file downloaded successfully", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to download CSV",
        "error"
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Deleted / Archived Data</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : items.length === 0 ? (
          <Typography color="text.secondary">
            No archived data found.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>Report Type</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>LAA</TableCell>
                  <TableCell sx={{ fontWeight: "bold" }} align="center">
                    Data (CSV)
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.itemType}-${item._id}`} hover>
                    <TableCell>{item.reportType}</TableCell>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>{item.client}</TableCell>
                    <TableCell>{item.LAA}</TableCell>
                    <TableCell align="center">
                      {(item.itemType === "shift" ||
                        item.itemType === "clearance") ? (
                        <Button
                          size="small"
                          startIcon={
                            downloadingId === item._id ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DownloadIcon />
                            )
                          }
                          onClick={() => handleDownloadCSV(item)}
                          disabled={downloadingId === item._id}
                        >
                          Download
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ArchivedDataDialog;
