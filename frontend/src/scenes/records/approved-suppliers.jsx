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
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  Tabs,
  Tab,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDateFull, formatDateForInput } from "../../utils/dateFormat";
import { approvedSupplierService } from "../../services/approvedSupplierService";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";

const SUPPLIER_TYPES = [
  "Equipment Sales/Hire",
  "Consumables",
  "Calibration",
];

// Tab order: Equipment Sales/Hire, Calibration, Consumables
const TAB_SUPPLIER_TYPES = [
  "Equipment Sales/Hire",
  "Calibration",
  "Consumables",
];

const ApprovedSuppliers = () => {
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

  // Form state
  const [supplierType, setSupplierType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [accreditationRequired, setAccreditationRequired] = useState("");
  const [accreditationCheckedDate, setAccreditationCheckedDate] = useState("");
  const [notesItemSpecs, setNotesItemSpecs] = useState("");
  const [currentTab, setCurrentTab] = useState(0);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const response = await approvedSupplierService.getAll();
        setRecords(response.data || []);
      } catch (err) {
        console.error("Error fetching approved supplier records:", err);
        showSnackbar("Failed to load approved supplier records", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const resetForm = () => {
    setSupplierType("");
    setCompanyName("");
    setDescription("");
    setContactName("");
    setContactNumber("");
    setContactEmail("");
    setAccreditationRequired("");
    setAccreditationCheckedDate("");
    setNotesItemSpecs("");
    setFormErrors({});
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setEditingRecord(null);
    resetForm();
    setSupplierType(TAB_SUPPLIER_TYPES[currentTab]);
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
    setSupplierType(record.supplierType || "");
    setCompanyName(record.companyName || "");
    setDescription(record.description || "");
    setContactName(record.contactName || "");
    setContactNumber(record.contactNumber || "");
    setContactEmail(record.contactEmail || "");
    setAccreditationRequired(record.accreditationRequired || "");
    setAccreditationCheckedDate(
      record.accreditationCheckedDate
        ? formatDateForInput(new Date(record.accreditationCheckedDate))
        : ""
    );
    setNotesItemSpecs(record.notesItemSpecs || "");
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!supplierType) errors.supplierType = "Supplier type is required";
    if (!companyName?.trim()) errors.companyName = "Company name is required";
    if (!description?.trim()) errors.description = "Description is required";
    if (!accreditationRequired)
      errors.accreditationRequired = "Accreditation required is required";
    if (accreditationRequired === "yes" && !accreditationCheckedDate)
      errors.accreditationCheckedDate =
        "Date accreditation checked is required when accreditation is required";
    if (accreditationCheckedDate) {
      const d = new Date(accreditationCheckedDate);
      if (isNaN(d.getTime()))
        errors.accreditationCheckedDate = "Invalid date";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getPayload = () => {
    const payload = {
      supplierType,
      companyName: companyName.trim(),
      description: description.trim(),
      contactName: contactName.trim(),
      contactNumber: contactNumber.trim(),
      contactEmail: contactEmail.trim(),
      accreditationRequired,
      notesItemSpecs: notesItemSpecs.trim(),
    };
    if (accreditationRequired === "yes" && accreditationCheckedDate) {
      payload.accreditationCheckedDate = accreditationCheckedDate;
    } else {
      payload.accreditationCheckedDate = null;
    }
    return payload;
  };

  const handleAddRecord = async () => {
    if (!validateForm()) return;

    try {
      const response = await approvedSupplierService.create(getPayload());
      setRecords((prev) => [response.data, ...prev]);
      handleCloseModal();
      showSnackbar("Approved supplier added", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to add supplier",
        "error"
      );
    }
  };

  const handleSaveEdit = async () => {
    if (!validateForm() || !editingRecord) return;

    try {
      const response = await approvedSupplierService.update(
        editingRecord._id,
        getPayload()
      );
      setRecords((prev) =>
        prev.map((r) => (r._id === editingRecord._id ? response.data : r))
      );
      handleCloseModal();
      showSnackbar("Approved supplier updated", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to update supplier",
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
      await approvedSupplierService.delete(recordToDelete._id);
      setRecords((prev) =>
        prev.filter((r) => r._id !== recordToDelete._id)
      );
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      showSnackbar("Approved supplier deleted", "success");
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to delete supplier",
        "error"
      );
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) =>
      (a.companyName || "").localeCompare(b.companyName || "")
    );
  }, [records]);

  const tabRecords = useMemo(() => {
    const type = TAB_SUPPLIER_TYPES[currentTab];
    return sortedRecords.filter((r) => r.supplierType === type);
  }, [sortedRecords, currentTab]);

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
            Loading approved supplier records...
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
            Approved Suppliers
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddModal}
          >
            Add Approved Supplier
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
            General Records
          </Link>
        </Breadcrumbs>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Approved Supplier Records
          </Typography>
          <Tabs
            value={currentTab}
            onChange={(_, v) => setCurrentTab(v)}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
          >
            {TAB_SUPPLIER_TYPES.map((type, idx) => (
              <Tab key={type} label={type} id={`supplier-tab-${idx}`} />
            ))}
          </Tabs>
          {tabRecords.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No approved suppliers in this category. Click "Add Approved
              Supplier" to add one.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.primary.main }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Company Name
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Description
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Contact Details
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        width: 140,
                        minWidth: 140,
                      }}
                    >
                      Accreditation Last Checked
                    </TableCell>
                    <TableCell
                      sx={{ color: "white", fontWeight: "bold", width: 120 }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tabRecords.map((record) => (
                    <TableRow key={record._id} hover>
                      <TableCell>{record.companyName || "—"}</TableCell>
                      <TableCell
                        sx={{
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {record.description || "—"}
                      </TableCell>
                      <TableCell>
                        {[record.contactNumber, record.contactEmail]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </TableCell>
                      <TableCell
                        sx={
                          record.accreditationRequired === "yes" &&
                          record.accreditationCheckedDate
                            ? (() => {
                                const checkedDate = new Date(
                                  record.accreditationCheckedDate
                                );
                                const oneYearLater = new Date(checkedDate);
                                oneYearLater.setFullYear(
                                  oneYearLater.getFullYear() + 1
                                );
                                const isWithinOneYear =
                                  new Date() <= oneYearLater;
                                return {
                                  color: isWithinOneYear
                                    ? theme.palette.success.main
                                    : theme.palette.error.main,
                                  fontWeight: 700,
                                };
                              })()
                            : undefined
                        }
                      >
                        {record.accreditationRequired === "no"
                          ? "N/A"
                          : record.accreditationCheckedDate
                            ? formatDateFull(record.accreditationCheckedDate)
                            : "—"}
                      </TableCell>
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

      {/* Add/Edit Record Modal */}
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
              {editMode
                ? "Edit Approved Supplier"
                : "Add Approved Supplier"}
            </Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl fullWidth error={!!formErrors.supplierType}>
              <InputLabel>Supplier Type *</InputLabel>
              <Select
                value={supplierType}
                label="Supplier Type *"
                onChange={(e) => {
                  setSupplierType(e.target.value);
                  setFormErrors((prev) => ({ ...prev, supplierType: null }));
                }}
              >
                <MenuItem value="">
                  <em>Select supplier type</em>
                </MenuItem>
                {SUPPLIER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.supplierType && (
                <FormHelperText>{formErrors.supplierType}</FormHelperText>
              )}
            </FormControl>

            <TextField
              fullWidth
              label="Company Name *"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                setFormErrors((prev) => ({ ...prev, companyName: null }));
              }}
              error={!!formErrors.companyName}
              helperText={formErrors.companyName}
            />

            <TextField
              fullWidth
              label="Description *"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormErrors((prev) => ({ ...prev, description: null }));
              }}
              multiline
              minRows={2}
              error={!!formErrors.description}
              helperText={formErrors.description}
            />

            <TextField
              fullWidth
              label="Contact Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />

            <TextField
              fullWidth
              label="Contact Number"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. 02 1234 5678"
            />

            <TextField
              fullWidth
              label="Contact Email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />

            <FormControl component="fieldset" error={!!formErrors.accreditationRequired}>
              <FormLabel component="legend">Accreditation Required *</FormLabel>
              <RadioGroup
                row
                value={accreditationRequired}
                onChange={(e) => {
                  setAccreditationRequired(e.target.value);
                  if (e.target.value !== "yes") setAccreditationCheckedDate("");
                  setFormErrors((prev) => ({
                    ...prev,
                    accreditationRequired: null,
                    accreditationCheckedDate: null,
                  }));
                }}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                <FormControlLabel value="no" control={<Radio />} label="No" />
              </RadioGroup>
              {formErrors.accreditationRequired && (
                <FormHelperText>{formErrors.accreditationRequired}</FormHelperText>
              )}
            </FormControl>

            {accreditationRequired === "yes" && (
              <TextField
                fullWidth
                label="Date accreditation checked"
                type="date"
                value={accreditationCheckedDate}
                onChange={(e) => {
                  setAccreditationCheckedDate(e.target.value);
                  setFormErrors((prev) => ({
                    ...prev,
                    accreditationCheckedDate: null,
                  }));
                }}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.accreditationCheckedDate}
                helperText={formErrors.accreditationCheckedDate}
              />
            )}

            <TextField
              fullWidth
              label="Notes/Item Specs"
              value={notesItemSpecs}
              onChange={(e) => setNotesItemSpecs(e.target.value)}
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={editMode ? handleSaveEdit : handleAddRecord}
            variant="contained"
            color="primary"
          >
            {editMode ? "Save Changes" : "Add Supplier"}
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
            Are you sure you want to delete this approved supplier record? This
            action cannot be undone.
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

export default ApprovedSuppliers;
