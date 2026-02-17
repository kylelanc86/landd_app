import React, { useState, useEffect } from "react";
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
  InputAdornment,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Tabs,
  Tab,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DeleteIcon from "@mui/icons-material/Delete";
import TodayIcon from "@mui/icons-material/Today";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { formatDate, formatDateFull, formatDateForInput } from "../../utils/dateFormat";
import { controlledDocumentService } from "../../services/controlledDocumentService";
import { useSnackbar } from "../../context/SnackbarContext";

const SECTION_OPTIONS = ["HAZMAT", "Lab Services", "Occ Hygiene"];
const DOC_TYPE_INTERNAL = "internal";
const DOC_TYPE_EXTERNAL = "external";
const PREFIX_INTERNAL = "LDHM - ";
const PREFIX_EXTERNAL = "LDEX - ";

const DocumentRegister = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // 0 = Internal, 1 = External
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [documentForHistory, setDocumentForHistory] = useState(null);
  const [obsoleteModalOpen, setObsoleteModalOpen] = useState(false);
  const [obsoleteDocuments, setObsoleteDocuments] = useState([]);
  const [obsoleteLoading, setObsoleteLoading] = useState(false);

  // Form state
  const [docType, setDocType] = useState(DOC_TYPE_INTERNAL);
  const [documentRefSuffix, setDocumentRefSuffix] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentDescription, setDocumentDescription] = useState("");
  const [section, setSection] = useState("");
  const [currentRevision, setCurrentRevision] = useState("");
  const [lastReviewDate, setLastReviewDate] = useState(formatDateForInput(new Date()));
  const [hardCopyLocationInput, setHardCopyLocationInput] = useState("");
  const [hardCopyLocations, setHardCopyLocations] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileRemoved, setFileRemoved] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const getDocumentRefPrefix = () =>
    docType === DOC_TYPE_INTERNAL ? PREFIX_INTERNAL : PREFIX_EXTERNAL;

  const getFullDocumentRef = () => {
    const suffix = documentRefSuffix?.trim() || "";
    return suffix ? `${getDocumentRefPrefix()}${suffix}` : "";
  };

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const response = await controlledDocumentService.getAll();
        setDocuments(response.data || []);
      } catch (err) {
        console.error("Error fetching controlled documents:", err);
        showSnackbar("Failed to load controlled documents", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [showSnackbar]);

  const resetForm = () => {
    setDocType(DOC_TYPE_INTERNAL);
    setDocumentRefSuffix("");
    setDocumentTitle("");
    setDocumentDescription("");
    setSection("");
    setCurrentRevision("");
    setLastReviewDate(formatDateForInput(new Date()));
    setHardCopyLocationInput("");
    setHardCopyLocations([]);
    setUploadedFile(null);
    setFileRemoved(false);
    setFormErrors({});
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setEditingDocument(null);
    resetForm();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditMode(false);
    setEditingDocument(null);
    resetForm();
  };

  const handleOpenEditModal = (doc) => {
    setEditMode(true);
    setEditingDocument(doc);
    setDocType(doc.type === DOC_TYPE_EXTERNAL ? DOC_TYPE_EXTERNAL : DOC_TYPE_INTERNAL);
    const prefix = doc.type === DOC_TYPE_EXTERNAL ? PREFIX_EXTERNAL : PREFIX_INTERNAL;
    setDocumentRefSuffix(doc.documentRef?.replace(prefix, "") || "");
    setDocumentTitle(doc.documentTitle || "");
    setDocumentDescription(doc.documentDescription || "");
    setSection(doc.section || "");
    setCurrentRevision(doc.currentRevision != null ? Number(doc.currentRevision) + 1 : 1);
    setLastReviewDate(
      doc.lastReviewDate ? formatDateForInput(new Date(doc.lastReviewDate)) : formatDateForInput(new Date())
    );
    setHardCopyLocations(doc.hardCopyLocations && doc.hardCopyLocations.length > 0 ? [...doc.hardCopyLocations] : []);
    setHardCopyLocationInput("");
    setUploadedFile(
      doc.fileName ? { name: doc.fileName, data: doc.fileData } : null
    );
    setFileRemoved(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleAddHardCopyLocation = () => {
    const trimmed = hardCopyLocationInput?.trim();
    if (trimmed && !hardCopyLocations.includes(trimmed)) {
      setHardCopyLocations((prev) => [...prev, trimmed]);
      setHardCopyLocationInput("");
    }
  };

  const handleRemoveHardCopyLocation = (index) => {
    setHardCopyLocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFile({
          name: file.name,
          data: reader.result,
        });
        setFileRemoved(false);
      };
      reader.readAsDataURL(file);
    } else {
      setUploadedFile(null);
    }
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileRemoved(true);
  };

  const handleDownloadFile = (doc) => {
    if (doc.fileData) {
      const link = document.createElement("a");
      link.href = doc.fileData;
      link.download = doc.fileName || "document";
      link.click();
    }
  };

  const handleSetToday = () => {
    setLastReviewDate(formatDateForInput(new Date()));
    setFormErrors((prev) => ({ ...prev, lastReviewDate: null }));
  };

  const validateForm = () => {
    const errors = {};
    const fullRef = getFullDocumentRef();

    if (!documentRefSuffix?.trim()) {
      errors.documentRef = "Document reference is required";
    } else {
      const existingDocs = editMode
        ? documents.filter((d) => (d._id || d.id) !== (editingDocument?._id || editingDocument?.id))
        : documents;
      const isDuplicate = existingDocs.some(
        (d) => d.documentRef?.toLowerCase() === fullRef.toLowerCase()
      );
      if (isDuplicate) {
        errors.documentRef = "This document reference already exists";
      }
    }

    if (!documentTitle?.trim()) errors.documentTitle = "Document title is required";
    if (!documentDescription?.trim()) errors.documentDescription = "Document description is required";
    if (!section) errors.section = "Section is required";

    if (docType === DOC_TYPE_INTERNAL) {
      const dateObj = new Date(lastReviewDate);
      if (!lastReviewDate) errors.lastReviewDate = "Last review date is required";
      else if (isNaN(dateObj.getTime())) errors.lastReviewDate = "Invalid date";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddDocument = async () => {
    if (!validateForm()) return;

    const payload = {
      type: docType,
      documentRef: getFullDocumentRef(),
      documentTitle: documentTitle.trim(),
      documentDescription: documentDescription.trim(),
      section,
      hardCopyLocations: hardCopyLocations.length > 0 ? [...hardCopyLocations] : [],
      fileName: uploadedFile?.name || null,
      fileData: uploadedFile?.data || null,
    };

    if (docType === DOC_TYPE_INTERNAL) {
      payload.currentRevision = currentRevision ? Number(currentRevision) : null;
      payload.lastReviewDate = lastReviewDate || null;
    }

    try {
      const response = await controlledDocumentService.create(payload);
      setDocuments((prev) => [...prev, response.data]);
      handleCloseModal();
      showSnackbar("Controlled document added", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to add document", "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!validateForm() || !editingDocument) return;

    const getFilePayload = () => {
      if (fileRemoved) return { fileName: null, fileData: null };
      if (uploadedFile) return { fileName: uploadedFile.name, fileData: uploadedFile.data };
      return { fileName: editingDocument?.fileName ?? null, fileData: editingDocument?.fileData ?? null };
    };
    const filePayload = getFilePayload();

    const payload = {
      type: docType,
      documentRef: getFullDocumentRef(),
      documentTitle: documentTitle.trim(),
      documentDescription: documentDescription.trim(),
      section,
      hardCopyLocations: hardCopyLocations.length > 0 ? [...hardCopyLocations] : [],
      ...filePayload,
    };

    if (docType === DOC_TYPE_INTERNAL) {
      payload.currentRevision = (editingDocument?.currentRevision ?? 0) + 1;
      payload.lastReviewDate = lastReviewDate || null;
    } else {
      payload.currentRevision = null;
      payload.lastReviewDate = null;
    }

    try {
      const response = await controlledDocumentService.update(editingDocument._id, payload);
      setDocuments((prev) =>
        prev.map((d) => (d._id === editingDocument._id ? response.data : d))
      );
      handleCloseModal();
      showSnackbar("Controlled document updated", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to update document", "error");
    }
  };

  const handleDeleteClick = (doc) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleOpenHistoryModal = async (doc) => {
    try {
      const response = await controlledDocumentService.getById(doc._id);
      setDocumentForHistory(response.data);
      setHistoryModalOpen(true);
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to load document history", "error");
    }
  };

  const handleCloseHistoryModal = () => {
    setHistoryModalOpen(false);
    setDocumentForHistory(null);
  };

  const handleOpenObsoleteModal = async () => {
    setObsoleteModalOpen(true);
    setObsoleteLoading(true);
    try {
      const response = await controlledDocumentService.getObsolete();
      setObsoleteDocuments(response.data || []);
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to load obsolete documents", "error");
      setObsoleteDocuments([]);
    } finally {
      setObsoleteLoading(false);
    }
  };

  const handleCloseObsoleteModal = () => {
    setObsoleteModalOpen(false);
    setObsoleteDocuments([]);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    try {
      await controlledDocumentService.delete(documentToDelete._id);
      setDocuments((prev) => prev.filter((d) => d._id !== documentToDelete._id));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      showSnackbar("Controlled document deleted", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to delete document", "error");
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
          <Typography color="text.secondary">Loading controlled documents...</Typography>
        </Box>
      </Container>
    );
  }

  const renderHardCopyLocationsField = () => (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Hard copy Locations
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Enter location and press Add"
          value={hardCopyLocationInput}
          onChange={(e) => setHardCopyLocationInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddHardCopyLocation();
            }
          }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleAddHardCopyLocation}
          disabled={!hardCopyLocationInput?.trim()}
        >
          Add
        </Button>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {hardCopyLocations.map((loc, idx) => (
            <Chip
              key={idx}
              label={loc}
              size="small"
              onDelete={() => handleRemoveHardCopyLocation(idx)}
            />
          ))
        }
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
            Document Register
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleOpenObsoleteModal}
            >
              Obsolete Documents
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenAddModal}
            >
              Add Controlled Document
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
        </Breadcrumbs>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              aria-label="document type tabs"
            >
              <Tab
                label={`Internal (${documents.filter((d) => d.type === DOC_TYPE_INTERNAL).length})`}
                id="doc-tab-internal"
                aria-controls="doc-tabpanel-internal"
              />
              <Tab
                label={`External (${documents.filter((d) => d.type === DOC_TYPE_EXTERNAL).length})`}
                id="doc-tab-external"
                aria-controls="doc-tabpanel-external"
              />
            </Tabs>
          </Box>
          {activeTab === 0 ? (
            documents.filter((d) => d.type === DOC_TYPE_INTERNAL).length === 0 ? (
              <Typography variant="body1" color="text.secondary">
                No internal documents yet. Click "Add Controlled Document" to get
                started.
              </Typography>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", "&:hover": { backgroundColor: "transparent" } }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Document Ref
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Document Title
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Section
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Current Rev
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Last Review
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Hard copy Locations
                      </TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                        Upload
                      </TableCell>
                      <TableCell
                        sx={{ color: "white", fontWeight: "bold", width: 120 }}
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {documents
                      .filter((d) => d.type === DOC_TYPE_INTERNAL)
                      .map((doc) => (
                        <TableRow key={doc._id} hover>
                          <TableCell>{doc.documentRef}</TableCell>
                          <TableCell>{doc.documentTitle}</TableCell>
                          <TableCell>{doc.section}</TableCell>
                          <TableCell>
                            {doc.currentRevision != null ? doc.currentRevision : "—"}
                          </TableCell>
                          <TableCell>
                            {doc.lastReviewDate
                              ? formatDate(doc.lastReviewDate)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {doc.hardCopyLocations?.length
                              ? doc.hardCopyLocations.join(", ")
                              : "None"}
                          </TableCell>
                          <TableCell>
                            {doc.fileName ? (
                              <Button
                                size="small"
                                startIcon={<UploadFileIcon />}
                                onClick={() => handleDownloadFile(doc)}
                                disabled={!doc.fileData}
                              >
                                {doc.fileName}
                              </Button>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                —
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenHistoryModal(doc)}
                                title="Doc History"
                              >
                                <AccessTimeIcon fontSize="small" />
                              </IconButton>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleOpenEditModal(doc)}
                              >
                                Update
                              </Button>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(doc)}
                                title="Delete"
                                sx={{ color: theme.palette.error.main }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )
          ) : documents.filter((d) => d.type === DOC_TYPE_EXTERNAL).length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No external documents yet. Click "Add Controlled Document" to get
              started.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Document Ref
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Document Title
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Section
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Hard copy Locations
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Upload
                    </TableCell>
                    <TableCell
                      sx={{ color: "white", fontWeight: "bold", width: 120 }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents
                    .filter((d) => d.type === DOC_TYPE_EXTERNAL)
                    .map((doc) => (
                      <TableRow key={doc._id} hover>
                        <TableCell>{doc.documentRef}</TableCell>
                        <TableCell>{doc.documentTitle}</TableCell>
                        <TableCell>{doc.section}</TableCell>
                        <TableCell>
                          {doc.hardCopyLocations?.length
                            ? doc.hardCopyLocations.join(", ")
                            : "None"}
                        </TableCell>
                        <TableCell>
                          {doc.fileName ? (
                            <Button
                              size="small"
                              startIcon={<UploadFileIcon />}
                              onClick={() => handleDownloadFile(doc)}
                              disabled={!doc.fileData}
                            >
                              {doc.fileName}
                            </Button>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenHistoryModal(doc)}
                              title="Doc History"
                            >
                              <AccessTimeIcon fontSize="small" />
                            </IconButton>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleOpenEditModal(doc)}
                            >
                              Update
                            </Button>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(doc)}
                              title="Delete"
                              sx={{ color: theme.palette.error.main }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add/Edit Controlled Document Modal */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              {editMode ? "Update Controlled Document" : "Add Controlled Document"}
            </Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            {!editMode && (
              <>
                <FormControl component="fieldset">
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Document Type
                  </Typography>
                  <RadioGroup
                    row
                    value={docType}
                    onChange={(e) => {
                      setDocType(e.target.value);
                      setFormErrors({});
                    }}
                  >
                    <FormControlLabel
                      value={DOC_TYPE_INTERNAL}
                      control={<Radio />}
                      label="Internal"
                    />
                    <FormControlLabel
                      value={DOC_TYPE_EXTERNAL}
                      control={<Radio />}
                      label="External"
                    />
                  </RadioGroup>
                </FormControl>

                <TextField
                  fullWidth
                  required
                  label="Document Ref"
                  placeholder="e.g. 001"
                  value={documentRefSuffix}
                  onChange={(e) => {
                    setDocumentRefSuffix(e.target.value);
                    setFormErrors((prev) => ({ ...prev, documentRef: null }));
                  }}
                  error={!!formErrors.documentRef}
                  helperText={formErrors.documentRef}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.5 }}>
                        <Box
                          component="span"
                          sx={{
                            fontSize: "1rem",
                            color: "text.secondary",
                            alignSelf: "center",
                          }}
                        >
                          {getDocumentRefPrefix()}
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  required
                  label="Document Title"
                  value={documentTitle}
                  onChange={(e) => {
                    setDocumentTitle(e.target.value);
                    setFormErrors((prev) => ({ ...prev, documentTitle: null }));
                  }}
                  error={!!formErrors.documentTitle}
                  helperText={formErrors.documentTitle}
                />

                <TextField
                  fullWidth
                  required
                  label="Document Description"
                  multiline
                  rows={2}
                  value={documentDescription}
                  onChange={(e) => {
                    setDocumentDescription(e.target.value);
                    setFormErrors((prev) => ({ ...prev, documentDescription: null }));
                  }}
                  error={!!formErrors.documentDescription}
                  helperText={formErrors.documentDescription}
                />

                <FormControl fullWidth required error={!!formErrors.section}>
                  <InputLabel>Section</InputLabel>
                  <Select
                    value={section}
                    label="Section"
                    onChange={(e) => {
                      setSection(e.target.value);
                      setFormErrors((prev) => ({ ...prev, section: null }));
                    }}
                  >
                    <MenuItem value="">
                      <em>Select section</em>
                    </MenuItem>
                    {SECTION_OPTIONS.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.section && (
                    <FormHelperText>{formErrors.section}</FormHelperText>
                  )}
                </FormControl>
              </>
            )}

            {docType === DOC_TYPE_INTERNAL && (
              <>
                <TextField
                  fullWidth
                  label="Current Revision"
                  type="number"
                  inputProps={{ min: 0, step: 1, readOnly: editMode }}
                  value={currentRevision}
                  onChange={(e) => !editMode && setCurrentRevision(e.target.value)}
                  helperText={editMode ? "Automatically incremented on update" : undefined}
                />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Review Date *
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      fullWidth
                      type="date"
                      value={lastReviewDate}
                      onChange={(e) => {
                        setLastReviewDate(e.target.value);
                        setFormErrors((prev) => ({ ...prev, lastReviewDate: null }));
                      }}
                      InputLabelProps={{ shrink: true }}
                      error={!!formErrors.lastReviewDate}
                      helperText={formErrors.lastReviewDate}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<TodayIcon />}
                      onClick={handleSetToday}
                    >
                      Today
                    </Button>
                  </Box>
                </Box>
              </>
            )}

            {renderHardCopyLocationsField()}

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Upload
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFileIcon />}
                  size="small"
                >
                  {uploadedFile ? "Change File" : "Choose File"}
                  <input
                    type="file"
                    hidden
                    onChange={handleFileChange}
                  />
                </Button>
                {uploadedFile && (
                  <>
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                      {uploadedFile.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleRemoveFile}
                      title="Remove file"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={editMode ? handleSaveEdit : handleAddDocument}
            variant="contained"
            color="primary"
          >
            {editMode ? "Save Changes" : "Add Document"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Doc History Modal */}
      <Dialog
        open={historyModalOpen}
        onClose={handleCloseHistoryModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Doc History {documentForHistory?.documentRef && `- ${documentForHistory.documentRef}`}
            </Typography>
            <IconButton onClick={handleCloseHistoryModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {documentForHistory && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: theme.palette.grey[200], "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ fontWeight: "bold" }}>Revision</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Updated By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...(documentForHistory.history || [])]
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                    .map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{entry.revision}</TableCell>
                        <TableCell>
                          {entry.updatedAt ? formatDateFull(entry.updatedAt) : "—"}
                        </TableCell>
                        <TableCell>{entry.updatedBy || "—"}</TableCell>
                      </TableRow>
                    ))}
                  {(!documentForHistory.history || documentForHistory.history.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          No history recorded yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* Obsolete Documents Modal */}
      <Dialog
        open={obsoleteModalOpen}
        onClose={handleCloseObsoleteModal}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Obsolete Documents</Typography>
            <IconButton onClick={handleCloseObsoleteModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {obsoleteLoading ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">Loading obsolete documents...</Typography>
            </Box>
          ) : obsoleteDocuments.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No obsolete documents.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: theme.palette.grey[200], "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Document Ref</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Document Title</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Document Description</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Section</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Current Rev</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Last Review</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Hard copy Locations</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Deleted Date</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Deleted By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {obsoleteDocuments.map((doc) => (
                    <TableRow key={doc._id}>
                      <TableCell>{doc.type === DOC_TYPE_EXTERNAL ? "External" : "Internal"}</TableCell>
                      <TableCell>{doc.documentRef}</TableCell>
                      <TableCell>{doc.documentTitle}</TableCell>
                      <TableCell>{doc.documentDescription}</TableCell>
                      <TableCell>{doc.section}</TableCell>
                      <TableCell>
                        {doc.type === DOC_TYPE_INTERNAL && doc.currentRevision != null
                          ? doc.currentRevision
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {doc.type === DOC_TYPE_INTERNAL && doc.lastReviewDate
                          ? formatDateFull(doc.lastReviewDate)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {doc.hardCopyLocations?.length
                          ? doc.hardCopyLocations.join(", ")
                          : "none"}
                      </TableCell>
                      <TableCell>
                        {doc.deletedAt ? formatDateFull(doc.deletedAt) : "—"}
                      </TableCell>
                      <TableCell>{doc.deletedBy || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDocumentToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this controlled document? This action
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDocumentToDelete(null);
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

export default DocumentRegister;
