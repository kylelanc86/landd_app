import React, { useState, useMemo, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Container,
  Breadcrumbs,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  CircularProgress,
  Chip,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate, formatDateForInput } from "../../utils/dateFormat";
import { blankService } from "../../services/blankService";
import { useSnackbar } from "../../context/SnackbarContext";

const Blanks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "laboratory";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();

  // State for records and modal
  const [blanks, setBlanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [blankDate, setBlankDate] = useState(
    formatDateForInput(new Date())
  );
  const [dateError, setDateError] = useState(null);
  const [editingBlank, setEditingBlank] = useState(null);
  const [blankToDelete, setBlankToDelete] = useState(null);

  // Load blank records
  useEffect(() => {
    const fetchBlanks = async () => {
      try {
        setLoading(true);
        const response = await blankService.getAll();
        const fetchedBlanks = response.data || [];
        setBlanks(fetchedBlanks);
      } catch (err) {
        console.error("Error fetching blank records:", err);
        showSnackbar("Failed to load blank records", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchBlanks();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleOpenAddDialog = () => {
    setBlankDate(formatDateForInput(new Date()));
    setDateError(null);
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
    setBlankDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  const handleSetToday = () => {
    setBlankDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  // Generate Blank Reference: LDAB{BlankDate}-x
  // BlankDate format: YYYYMMDD
  // x starts at 1 for the first record on a given date and increases by 1 for each additional record
  const generateBlankReference = (blank, allBlanks) => {
    const dateObj = new Date(blank.blankDate);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const blankDateStr = `${year}${month}${day}`;

    // Find all blanks for the same date, sorted by creation time
    const sameDateBlanks = allBlanks
      .filter((b) => {
        const blankDate = new Date(b.blankDate);
        return (
          blankDate.getDate() === dateObj.getDate() &&
          blankDate.getMonth() === dateObj.getMonth() &&
          blankDate.getFullYear() === dateObj.getFullYear()
        );
      })
      .sort((a, b) => {
        // Sort by creation time to maintain order
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    // Find the position of the current blank (1-indexed)
    const blankNumber =
      sameDateBlanks.findIndex((b) => b._id === blank._id || b.id === blank.id) + 1;

    return `LDAB${blankDateStr}-${blankNumber}`;
  };

  const handleAddBlank = async () => {
    // Validate date
    if (!blankDate) {
      setDateError("Date is required");
      return;
    }

    const dateObj = new Date(blankDate);
    if (isNaN(dateObj.getTime())) {
      setDateError("Invalid date");
      return;
    }

    try {
      const response = await blankService.create({
        blankDate: blankDate,
      });

      const newBlank = response.data;
      setBlanks([...blanks, newBlank]);
      showSnackbar("Blank record created successfully", "success");
      handleCloseAddDialog();
    } catch (err) {
      console.error("Error creating blank record:", err);
      setDateError(err.response?.data?.message || "Failed to create record");
      showSnackbar("Failed to create blank record", "error");
    }
  };

  // Handle edit date
  const handleEditDate = (e, blank) => {
    e.stopPropagation();
    setEditingBlank(blank);
    setBlankDate(formatDateForInput(new Date(blank.blankDate)));
    setDateError(null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingBlank(null);
    setBlankDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  const handleSaveEdit = async () => {
    if (!blankDate) {
      setDateError("Date is required");
      return;
    }

    const dateObj = new Date(blankDate);
    if (isNaN(dateObj.getTime())) {
      setDateError("Invalid date");
      return;
    }

    try {
      const blankId = editingBlank._id || editingBlank.id;
      const response = await blankService.update(blankId, {
        blankDate: blankDate,
      });

      const updatedBlank = response.data;
      setBlanks(
        blanks.map((b) =>
          (b._id || b.id) === blankId ? updatedBlank : b
        )
      );
      showSnackbar("Blank record updated successfully", "success");
      handleCloseEditDialog();
    } catch (err) {
      console.error("Error updating blank record:", err);
      setDateError(err.response?.data?.message || "Failed to update record");
      showSnackbar("Failed to update blank record", "error");
    }
  };

  // Handle delete blank
  const handleDeleteBlank = (e, blank) => {
    e.stopPropagation();
    setBlankToDelete(blank);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!blankToDelete) return;

    try {
      const blankId = blankToDelete._id || blankToDelete.id;
      await blankService.delete(blankId);
      setBlanks(
        blanks.filter((b) => (b._id || b.id) !== blankId)
      );
      showSnackbar("Blank record deleted successfully", "success");
      setDeleteDialogOpen(false);
      setBlankToDelete(null);
    } catch (err) {
      console.error("Error deleting blank record:", err);
      showSnackbar("Failed to delete blank record", "error");
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Pass":
        return "success";
      case "Fail":
        return "error";
      case "N/A":
      default:
        return "default";
    }
  };

  // Sort blanks by blank date (most recent first)
  const sortedBlanks = useMemo(() => {
    return [...blanks].sort((a, b) => {
      const dateA = new Date(a.blankDate);
      const dateB = new Date(b.blankDate);
      return dateB - dateA;
    });
  }, [blanks]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1">
            Laboratory Blanks
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Analytical Blank Record
          </Button>
        </Box>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Laboratory Records
          </Link>
          <Typography color="text.primary">Analytical Blanks</Typography>
        </Breadcrumbs>

        {/* Blanks Table */}
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Analytical Blank Records
          </Typography>
          {blanks.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No records yet. Click "Add Analytical Blank Record" to get started.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white" }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Blank Reference
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Blank Date
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold", width: "20%" }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedBlanks.map((blank) => {
                    const blankReference = generateBlankReference(blank, blanks);
                    const blankId = blank._id || blank.id;
                    return (
                      <TableRow
                        key={blankId}
                        hover
                        onClick={() => navigate(`/records/blanks/${blankId}/analysis`)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {blankReference}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {formatDate(blank.blankDate)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={blank.status || "N/A"}
                            color={getStatusColor(blank.status || "N/A")}
                            size="small"
                          />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleEditDate(e, blank)}
                              title="Edit Date"
                              sx={{ color: theme.palette.primary.main }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => handleDeleteBlank(e, blank)}
                              title="Delete Record"
                              sx={{ color: theme.palette.error.main }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add Blank Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={handleCloseAddDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Add Analytical Blank Record</Typography>
            <IconButton onClick={handleCloseAddDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
            <TextField
              fullWidth
              label="Blank Date"
              type="date"
              value={blankDate}
              onChange={(e) => {
                setBlankDate(e.target.value);
                setDateError(null);
              }}
              InputLabelProps={{ shrink: true }}
              error={!!dateError}
              helperText={dateError}
            />
            <Button
              variant="outlined"
              onClick={handleSetToday}
              size="small"
              sx={{ mt: 0.5 }}
            >
              Today
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button onClick={handleAddBlank} variant="contained" color="primary">
            Add Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Blank Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Edit Blank Record</Typography>
            <IconButton onClick={handleCloseEditDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}>
            <TextField
              fullWidth
              label="Blank Date"
              type="date"
              value={blankDate}
              onChange={(e) => {
                setBlankDate(e.target.value);
                setDateError(null);
              }}
              InputLabelProps={{ shrink: true }}
              error={!!dateError}
              helperText={dateError}
            />
            <Button
              variant="outlined"
              onClick={handleSetToday}
              size="small"
              sx={{ mt: 0.5 }}
            >
              Today
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setBlankToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this blank record? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setBlankToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Blanks;
