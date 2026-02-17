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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  FormControl,
  FormHelperText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ScienceIcon from "@mui/icons-material/Science";
import { formatDateFull, formatDateForInput } from "../../utils/dateFormat";
import { assetRegisterService } from "../../services/assetRegisterService";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";

const AssetRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const canDelete = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [assetReference, setAssetReference] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [electrical, setElectrical] = useState("no");
  const [testAndTagDate, setTestAndTagDate] = useState("");
  const [status, setStatus] = useState("Active");

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const response = await assetRegisterService.getAll();
        setRecords(response.data || []);
      } catch (err) {
        console.error("Error fetching asset register records:", err);
        showSnackbar("Failed to load asset register records", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleLaboratoryEquipment = () => {
    navigate("/records/laboratory/equipment");
  };

  const resetForm = () => {
    setAssetReference("");
    setAssetDescription("");
    setElectrical("no");
    setTestAndTagDate("");
    setStatus("Active");
    setFormErrors({});
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setEditingRecord(null);
    resetForm();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditMode(false);
    setEditingRecord(null);
    resetForm();
  };

  const handleOpenEditModal = (record) => {
    setEditMode(true);
    setEditingRecord(record);
    setAssetReference(record.assetReference || "");
    setAssetDescription(record.assetDescription || "");
    setElectrical(record.electrical || "no");
    setTestAndTagDate(
      record.testAndTagDate
        ? formatDateForInput(new Date(record.testAndTagDate))
        : ""
    );
    setStatus(record.status || "Active");
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!assetReference?.trim()) errors.assetReference = "Asset reference is required";
    if (!assetDescription?.trim()) errors.assetDescription = "Asset description is required";
    if (electrical === "yes" && !testAndTagDate) {
      errors.testAndTagDate = "Test & Tag date is required when electrical is Yes";
    }
    if (testAndTagDate) {
      const d = new Date(testAndTagDate);
      if (isNaN(d.getTime())) errors.testAndTagDate = "Invalid date";
    }
    if (!status) errors.status = "Status is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getPayload = () => {
    const payload = {
      assetReference: assetReference.trim(),
      assetDescription: assetDescription.trim(),
      electrical,
      status,
    };
    if (electrical === "yes" && testAndTagDate) {
      payload.testAndTagDate = testAndTagDate;
    } else {
      payload.testAndTagDate = null;
    }
    return payload;
  };

  const handleAddRecord = async () => {
    if (!validateForm()) return;

    try {
      const response = await assetRegisterService.create(getPayload());
      setRecords((prev) => [response.data, ...prev]);
      handleCloseModal();
      showSnackbar("Asset added", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to add asset",
        "error"
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!validateForm() || !editingRecord) return;

    try {
      const response = await assetRegisterService.update(
        editingRecord._id,
        getPayload()
      );
      setRecords((prev) =>
        prev.map((r) => (r._id === editingRecord._id ? response.data : r))
      );
      handleCloseModal();
      showSnackbar("Asset updated", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to update asset",
        "error"
      );
    }
  };

  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await assetRegisterService.delete(recordToDelete._id);
      setRecords((prev) =>
        prev.filter((r) => r._id !== recordToDelete._id)
      );
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      showSnackbar("Asset deleted", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to delete asset",
        "error"
      );
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      (a.assetReference || "").localeCompare(b.assetReference || "")
    );
  }, [records]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box
          sx={{
            mt: 4,
            mb: 4,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <Typography color="text.secondary">
            Loading asset register...
          </Typography>
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
          <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
            Asset Register
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ScienceIcon />}
              onClick={handleLaboratoryEquipment}
            >
              Laboratory Equipment
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddModal}
            >
              Add Asset
            </Button>
          </Box>
        </Box>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            General Records
          </Link>
          <Typography color="text.primary">Asset Register</Typography>
        </Breadcrumbs>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Asset Register Records
          </Typography>
          {sortedRecords.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No assets yet. Click "Add Asset" to add one.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Asset Reference
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Asset Description
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Electrical
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        width: 140,
                        minWidth: 140,
                      }}
                    >
                      Test & Tag
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Status
                    </TableCell>
                    <TableCell
                      sx={{ color: "white", fontWeight: "bold", width: 120 }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRecords.map((record) => (
                    <TableRow key={record._id} hover>
                      <TableCell>{record.assetReference || "—"}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {record.assetDescription || "—"}
                      </TableCell>
                      <TableCell>
                        {record.electrical === "yes" ? "Yes" : "No"}
                      </TableCell>
                      <TableCell>
                        {record.electrical === "yes" && record.testAndTagDate
                          ? formatDateFull(record.testAndTagDate)
                          : "—"}
                      </TableCell>
                      <TableCell>{record.status || "—"}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditModal(record)}
                          title="Edit"
                          sx={{ color: theme.palette.primary.main }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {canDelete && (
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteClick(record)}
                            title="Delete"
                            sx={{ color: theme.palette.error.main }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add/Edit Asset Modal */}
      <Dialog
        open={modalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              {editMode ? "Edit Asset" : "Add Asset"}
            </Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              fullWidth
              label="Asset Reference *"
              value={assetReference}
              onChange={(e) => {
                setAssetReference(e.target.value);
                setFormErrors((prev) => ({ ...prev, assetReference: null }));
              }}
              error={!!formErrors.assetReference}
              helperText={formErrors.assetReference}
            />

            <TextField
              fullWidth
              label="Asset Description *"
              value={assetDescription}
              onChange={(e) => {
                setAssetDescription(e.target.value);
                setFormErrors((prev) => ({ ...prev, assetDescription: null }));
              }}
              multiline
              minRows={2}
              error={!!formErrors.assetDescription}
              helperText={formErrors.assetDescription}
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">Electrical</FormLabel>
              <RadioGroup
                row
                value={electrical}
                onChange={(e) => {
                  setElectrical(e.target.value);
                  if (e.target.value !== "yes") setTestAndTagDate("");
                  setFormErrors((prev) => ({
                    ...prev,
                    testAndTagDate: null,
                  }));
                }}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
            </FormControl>

            {electrical === "yes" && (
              <TextField
                fullWidth
                label="Test & Tag"
                type="date"
                value={testAndTagDate}
                onChange={(e) => {
                  setTestAndTagDate(e.target.value);
                  setFormErrors((prev) => ({ ...prev, testAndTagDate: null }));
                }}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.testAndTagDate}
                helperText={formErrors.testAndTagDate}
              />
            )}

            <FormControl
              component="fieldset"
              error={!!formErrors.status}
              required
            >
              <FormLabel component="legend">Status *</FormLabel>
              <RadioGroup
                row
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setFormErrors((prev) => ({ ...prev, status: null }));
                }}
              >
                <FormControlLabel
                  value="Active"
                  control={<Radio />}
                  label="Active"
                />
                <FormControlLabel
                  value="Inactive"
                  control={<Radio />}
                  label="Inactive"
                />
              </RadioGroup>
              {formErrors.status && (
                <FormHelperText>{formErrors.status}</FormHelperText>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={editMode ? handleSaveEdit : handleAddRecord}
            variant="contained"
            color="primary"
          >
            {editMode ? "Save Changes" : "Add Asset"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setRecordToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this asset? This action cannot be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setRecordToDelete(null);
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

export default AssetRegister;
