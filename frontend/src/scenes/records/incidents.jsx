import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
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
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  IconButton,
  useTheme,
  Autocomplete,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import TodayIcon from "@mui/icons-material/Today";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import { formatDateForInput, formatDateFull } from "../../utils/dateFormat";
import { userService } from "../../services/api";
import { incidentService } from "../../services/incidentService";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";

const TYPE_NON_CONFORMANCE = "non-conformance";
const TYPE_INCIDENT = "incident";
const PREFIX_NC = "LD-NC";
const PREFIX_IN = "LD-IN";
const CATEGORY_OPTIONS = ["Low", "Medium", "High"];

const Incidents = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const [users, setUsers] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = Non-conformances, 1 = Incidents
  const [modalOpen, setModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Sign-off modal
  const [signOffModalOpen, setSignOffModalOpen] = useState(false);
  const [recordForSignOff, setRecordForSignOff] = useState(null);
  const [signOffDate, setSignOffDate] = useState(formatDateForInput(new Date()));
  const [signOffEvidence, setSignOffEvidence] = useState("");
  const [signOffEvidenceFile, setSignOffEvidenceFile] = useState(null);
  const [signOffErrors, setSignOffErrors] = useState({});

  // Form: type (non-conformance | incident)
  const [recordType, setRecordType] = useState(TYPE_NON_CONFORMANCE);
  const [refSuffix, setRefSuffix] = useState("");
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [reportedBy, setReportedBy] = useState("");
  const [reportedByInput, setReportedByInput] = useState("");
  const [nature, setNature] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [correctiveActionRequired, setCorrectiveActionRequired] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [personResponsible, setPersonResponsible] = useState("");
  const [correctiveActionDue, setCorrectiveActionDue] = useState("");
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userService.getAll(true);
        setUsers(response.data || []);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const response = await incidentService.getAll();
        setRecords(response.data || []);
      } catch (err) {
        console.error("Error fetching incidents:", err);
        showSnackbar("Failed to load incidents & non-conformances", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const userOptions = users.map((u) => ({
    id: u._id,
    label: `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Unknown",
  }));

  const getReportedByValue = () => {
    if (!reportedBy && !reportedByInput) return null;
    const opt = userOptions.find((o) => o.id === reportedBy);
    if (opt) return opt;
    return { id: reportedBy || reportedByInput, label: reportedBy || reportedByInput };
  };

  const handleOpenAddModal = () => {
    setRecordType(TYPE_NON_CONFORMANCE);
    setRefSuffix("");
    setDate(formatDateForInput(new Date()));
    setReportedBy("");
    setReportedByInput("");
    setNature("");
    setDescription("");
    setCategory("");
    setCorrectiveActionRequired("");
    setCorrectiveAction("");
    setPersonResponsible("");
    setCorrectiveActionDue("");
    setAttachments([]);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormErrors({});
  };

  const handleSetToday = () => {
    setDate(formatDateForInput(new Date()));
    setFormErrors((prev) => ({ ...prev, date: null }));
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files?.length) {
      const newFiles = Array.from(files).map((file) => ({
        name: file.name,
        file,
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const errors = {};
    if (!refSuffix?.trim()) errors.refSuffix = "Reference is required";
    if (!date) errors.date = "Date is required";
    const dateObj = new Date(date);
    if (date && isNaN(dateObj.getTime())) errors.date = "Invalid date";
    if (!reportedBy?.trim() && !reportedByInput?.trim()) errors.reportedBy = "Reported by is required";
    if (!nature?.trim()) errors.nature = recordType === TYPE_INCIDENT ? "Nature of Incident is required" : "Nature of Non-conformance is required";
    if (!description?.trim()) errors.description = "Description is required";
    if (!category) errors.category = "Category is required";
    if (!correctiveActionRequired) errors.correctiveActionRequired = "Corrective Action Required is required";
    if (correctiveActionRequired === "yes") {
      if (!correctiveAction?.trim()) errors.correctiveAction = "Corrective Action is required";
      if (!personResponsible) errors.personResponsible = "Person Responsible is required";
      if (!correctiveActionDue) errors.correctiveActionDue = "Corrective Action due is required";
      if (correctiveActionDue) {
        const d = new Date(correctiveActionDue);
        if (isNaN(d.getTime())) errors.correctiveActionDue = "Invalid date";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const reportedByValue = reportedBy && userOptions.some((o) => o.id === reportedBy) ? reportedBy : (reportedByInput || reportedBy);
      const attachmentsWithData = await Promise.all(
        attachments.map(async (a) => ({
          name: a.name,
          fileData: a.file ? await readFileAsDataURL(a.file) : null,
        }))
      );
      const record = {
        type: recordType,
        ref: recordType === TYPE_INCIDENT ? `${PREFIX_IN}${refSuffix.trim()}` : `${PREFIX_NC}${refSuffix.trim()}`,
        date,
        reportedBy: reportedByValue,
        nature: nature.trim(),
        description: description.trim(),
        category,
        correctiveActionRequired: correctiveActionRequired === "yes",
        attachments: attachmentsWithData,
      };
      if (correctiveActionRequired === "yes") {
        record.correctiveAction = correctiveAction.trim();
        record.personResponsible = personResponsible;
        record.correctiveActionDue = correctiveActionDue;
      }
      const response = await incidentService.create(record);
      setRecords((prev) => [response.data, ...prev]);
      showSnackbar(recordType === TYPE_INCIDENT ? "Incident added" : "Non-conformance added", "success");
      handleCloseModal();
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to add record", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const nonConformances = useMemo(
    () => records.filter((r) => r.type === TYPE_NON_CONFORMANCE).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [records]
  );
  const incidents = useMemo(
    () => records.filter((r) => r.type === TYPE_INCIDENT).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [records]
  );

  const getReportedByDisplay = (record) => {
    if (!record.reportedBy) return "—";
    const id = typeof record.reportedBy === "object" ? record.reportedBy?._id : record.reportedBy;
    const user = users.find((u) => u._id === id);
    if (user) return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "—";
    return typeof record.reportedBy === "string" ? record.reportedBy : "—";
  };

  const handleOpenSignOff = (record) => {
    setRecordForSignOff(record);
    setSignOffDate(formatDateForInput(new Date()));
    setSignOffEvidence("");
    setSignOffEvidenceFile(null);
    setSignOffErrors({});
    setSignOffModalOpen(true);
  };

  const handleCloseSignOffModal = () => {
    setSignOffModalOpen(false);
    setRecordForSignOff(null);
    setSignOffEvidence("");
    setSignOffEvidenceFile(null);
    setSignOffErrors({});
  };

  const validateSignOff = () => {
    const errors = {};
    if (!signOffEvidence?.trim()) errors.signOffEvidence = "Evidence is required";
    setSignOffErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmSignOff = async () => {
    if (!recordForSignOff || !validateSignOff()) return;
    setSubmitting(true);
    try {
      const signOffPayload = {
        signedOffBy: currentUser?._id,
        signedOffByName: currentUser ? `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() : "",
        signedOffAt: signOffDate,
        signOffEvidence: signOffEvidence.trim(),
        signOffEvidenceFileName: signOffEvidenceFile?.name || null,
        signOffEvidenceFileData: signOffEvidenceFile ? await readFileAsDataURL(signOffEvidenceFile) : null,
      };
      const response = await incidentService.signOff(recordForSignOff._id, signOffPayload);
      setRecords((prev) => prev.map((r) => (r._id === recordForSignOff._id ? response.data : r)));
      handleCloseSignOffModal();
      showSnackbar("Sign-off recorded", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to record sign-off", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOffEvidenceFileChange = (e) => {
    const file = e.target.files?.[0];
    setSignOffEvidenceFile(file || null);
    e.target.value = "";
  };

  const prefix = recordType === TYPE_INCIDENT ? PREFIX_IN : PREFIX_NC;
  const natureLabel = recordType === TYPE_INCIDENT ? "Nature of Incident" : "Nature of Non-conformance";
  const refLabel = recordType === TYPE_INCIDENT ? "Non-conformance Ref (LD-IN)" : "Non-conformance Ref (LD-NC)";

  if (loading) {
    return (
      <Box m="20px" sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <Typography color="text.secondary">Loading incidents &amp; non-conformances…</Typography>
      </Box>
    );
  }

  return (
    <Box m="20px">
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          INCIDENTS & NON-CONFORMANCES
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddModal}
          disabled={loading || submitting}
        >
          Add Incident / Non-Conformance
        </Button>
      </Box>
      <Box sx={{ mt: 2, mb: 4 }}>
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

        <Paper sx={{ p: 0, mt: 2 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
            <Tab label={`Non-conformances (${nonConformances.length})`} id="incidents-tab-0" aria-controls="incidents-tabpanel-0" />
            <Tab label={`Incidents (${incidents.length})`} id="incidents-tab-1" aria-controls="incidents-tabpanel-1" />
          </Tabs>
          <Box role="tabpanel" hidden={activeTab !== 0} id="incidents-tabpanel-0" aria-labelledby="incidents-tab-0" sx={{ p: 3 }}>
            {activeTab === 0 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Non-conformances
                </Typography>
                {nonConformances.length === 0 ? (
                  <Typography variant="body1" color="text.secondary">
                    No non-conformances yet. Use &quot;Add Incident / Non-Conformance&quot; to add one.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Ref</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Date</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Reported by</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Nature</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Category</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Corrective action</TableCell>
                          {isAdmin && (
                            <TableCell sx={{ color: "white", fontWeight: "bold", width: 120 }}>Actions</TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {nonConformances.map((r) => (
                          <TableRow key={r._id} hover>
                            <TableCell>{r.ref}</TableCell>
                            <TableCell>{formatDateFull(r.date)}</TableCell>
                            <TableCell>{getReportedByDisplay(r)}</TableCell>
                            <TableCell>{r.nature}</TableCell>
                            <TableCell>{r.category}</TableCell>
                            <TableCell>{r.correctiveActionRequired ? "Yes" : "No"}</TableCell>
                            {isAdmin && (
                              <TableCell>
                                {r.signedOffAt ? (
                                  <Typography variant="body2" color="text.secondary">
                                    Signed off {formatDateFull(r.signedOffAt)}
                                  </Typography>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AssignmentTurnedInIcon />}
                                    onClick={() => handleOpenSignOff(r)}
                                  >
                                    Sign off
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
          <Box role="tabpanel" hidden={activeTab !== 1} id="incidents-tabpanel-1" aria-labelledby="incidents-tab-1" sx={{ p: 3 }}>
            {activeTab === 1 && (
              <>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Incidents
                </Typography>
                {incidents.length === 0 ? (
                  <Typography variant="body1" color="text.secondary">
                    No incidents yet. Use &quot;Add Incident / Non-Conformance&quot; to add one.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Ref</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Date</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Reported by</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Nature</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Category</TableCell>
                          <TableCell sx={{ color: "white", fontWeight: "bold" }}>Corrective action</TableCell>
                          {isAdmin && (
                            <TableCell sx={{ color: "white", fontWeight: "bold", width: 120 }}>Actions</TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {incidents.map((r) => (
                          <TableRow key={r._id} hover>
                            <TableCell>{r.ref}</TableCell>
                            <TableCell>{formatDateFull(r.date)}</TableCell>
                            <TableCell>{getReportedByDisplay(r)}</TableCell>
                            <TableCell>{r.nature}</TableCell>
                            <TableCell>{r.category}</TableCell>
                            <TableCell>{r.correctiveActionRequired ? "Yes" : "No"}</TableCell>
                            {isAdmin && (
                              <TableCell>
                                {r.signedOffAt ? (
                                  <Typography variant="body2" color="text.secondary">
                                    Signed off {formatDateFull(r.signedOffAt)}
                                  </Typography>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AssignmentTurnedInIcon />}
                                    onClick={() => handleOpenSignOff(r)}
                                  >
                                    Sign off
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Add Incident / Non-Conformance Modal */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Incident / Non-Conformance</Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Type</FormLabel>
              <RadioGroup
                row
                value={recordType}
                onChange={(e) => {
                  setRecordType(e.target.value);
                  setFormErrors((prev) => ({ ...prev, nature: null }));
                }}
              >
                <FormControlLabel value={TYPE_NON_CONFORMANCE} control={<Radio />} label="Non-conformance" />
                <FormControlLabel value={TYPE_INCIDENT} control={<Radio />} label="Incident" />
              </RadioGroup>
            </FormControl>

            <TextField
              fullWidth
              label={refLabel + " *"}
              value={refSuffix}
              onChange={(e) => {
                setRefSuffix(e.target.value);
                setFormErrors((prev) => ({ ...prev, refSuffix: null }));
              }}
              placeholder={recordType === TYPE_INCIDENT ? "e.g. 001" : "e.g. 001"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">{prefix}</InputAdornment>
                ),
              }}
              error={!!formErrors.refSuffix}
              helperText={formErrors.refSuffix}
            />

            <Box>
              <TextField
                fullWidth
                label="Date *"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setFormErrors((prev) => ({ ...prev, date: null }));
                }}
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.date}
                helperText={formErrors.date}
              />
              <Button
                size="small"
                startIcon={<TodayIcon />}
                onClick={handleSetToday}
                sx={{ mt: 0.5 }}
              >
                Today
              </Button>
            </Box>

            <Autocomplete
              freeSolo
              options={userOptions}
              value={getReportedByValue()}
              inputValue={reportedByInput}
              onInputChange={(_, newInput) => {
                setReportedByInput(newInput);
                setReportedBy("");
                setFormErrors((prev) => ({ ...prev, reportedBy: null }));
              }}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  setReportedBy(newValue);
                  setReportedByInput(newValue);
                } else if (newValue?.id) {
                  setReportedBy(newValue.id);
                  setReportedByInput("");
                } else {
                  setReportedBy("");
                  setReportedByInput("");
                }
                setFormErrors((prev) => ({ ...prev, reportedBy: null }));
              }}
              getOptionLabel={(option) => (typeof option === "string" ? option : option?.label ?? "")}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.label}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Reported by *"
                  error={!!formErrors.reportedBy}
                  helperText={formErrors.reportedBy}
                />
              )}
            />

            <TextField
              fullWidth
              label={natureLabel + " *"}
              value={nature}
              onChange={(e) => {
                setNature(e.target.value);
                setFormErrors((prev) => ({ ...prev, nature: null }));
              }}
              error={!!formErrors.nature}
              helperText={formErrors.nature}
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
              rows={3}
              error={!!formErrors.description}
              helperText={formErrors.description}
            />

            <FormControl fullWidth error={!!formErrors.category}>
              <InputLabel>{(recordType === TYPE_INCIDENT ? "Incident" : "Non-conformance") + " Category *"}</InputLabel>
              <Select
                value={category}
                label={(recordType === TYPE_INCIDENT ? "Incident" : "Non-conformance") + " Category *"}
                onChange={(e) => {
                  const newCategory = e.target.value;
                  setCategory(newCategory);
                  setFormErrors((prev) => ({ ...prev, category: null }));
                  if (newCategory === "Medium" || newCategory === "High") {
                    setCorrectiveActionRequired("yes");
                    setFormErrors((prev) => ({ ...prev, correctiveActionRequired: null }));
                  }
                }}
              >
                <MenuItem value=""><em>Select</em></MenuItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
              {formErrors.category && <FormHelperText>{formErrors.category}</FormHelperText>}
            </FormControl>

            <FormControl component="fieldset" error={!!formErrors.correctiveActionRequired}>
              <FormLabel component="legend">Corrective Action Required *</FormLabel>
              {(category === "Medium" || category === "High") && (
                <FormHelperText sx={{ mb: 0.5 }}>Required for Medium and High category.</FormHelperText>
              )}
              <RadioGroup
                row
                value={category === "Medium" || category === "High" ? "yes" : correctiveActionRequired}
                onChange={(e) => {
                  if (category === "Medium" || category === "High") return;
                  setCorrectiveActionRequired(e.target.value);
                  setFormErrors((prev) => ({ ...prev, correctiveActionRequired: null, correctiveAction: null, personResponsible: null, correctiveActionDue: null }));
                }}
              >
                <FormControlLabel value="yes" control={<Radio />} label="Yes" disabled={category === "Medium" || category === "High"} />
                <FormControlLabel value="no" control={<Radio />} label="No" disabled={category === "Medium" || category === "High"} />
              </RadioGroup>
              {formErrors.correctiveActionRequired && (
                <FormHelperText>{formErrors.correctiveActionRequired}</FormHelperText>
              )}
            </FormControl>

            {correctiveActionRequired === "yes" && (
              <Box sx={{ pl: 2, borderLeft: 2, borderColor: "divider" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Corrective Actions</Typography>
                <TextField
                  fullWidth
                  label="Corrective Action *"
                  value={correctiveAction}
                  onChange={(e) => {
                    setCorrectiveAction(e.target.value);
                    setFormErrors((prev) => ({ ...prev, correctiveAction: null }));
                  }}
                  multiline
                  rows={2}
                  error={!!formErrors.correctiveAction}
                  helperText={formErrors.correctiveAction}
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth error={!!formErrors.personResponsible} sx={{ mb: 2 }}>
                  <InputLabel>Person Responsible *</InputLabel>
                  <Select
                    value={personResponsible}
                    label="Person Responsible *"
                    onChange={(e) => {
                      setPersonResponsible(e.target.value);
                      setFormErrors((prev) => ({ ...prev, personResponsible: null }));
                    }}
                  >
                    <MenuItem value=""><em>Select</em></MenuItem>
                    {users.map((u) => (
                      <MenuItem key={u._id} value={u._id}>
                        {u.firstName} {u.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.personResponsible && <FormHelperText>{formErrors.personResponsible}</FormHelperText>}
                </FormControl>
                <TextField
                  fullWidth
                  label="Corrective Action due *"
                  type="date"
                  value={correctiveActionDue}
                  onChange={(e) => {
                    setCorrectiveActionDue(e.target.value);
                    setFormErrors((prev) => ({ ...prev, correctiveActionDue: null }));
                  }}
                  InputLabelProps={{ shrink: true }}
                  error={!!formErrors.correctiveActionDue}
                  helperText={formErrors.correctiveActionDue}
                  sx={{ mb: 2 }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Attachments</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} size="small">
                    Upload
                    <input type="file" hidden multiple onChange={handleFileChange} />
                  </Button>
                  {attachments.map((a, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{a.name}</Typography>
                      <IconButton size="small" onClick={() => handleRemoveAttachment(i)} sx={{ color: theme.palette.error.main }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {correctiveActionRequired !== "yes" && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Attachments</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} size="small">
                    Upload
                    <input type="file" hidden multiple onChange={handleFileChange} />
                  </Button>
                  {attachments.map((a, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{a.name}</Typography>
                      <IconButton size="small" onClick={() => handleRemoveAttachment(i)} sx={{ color: theme.palette.error.main }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sign-off verification modal */}
      <Dialog open={signOffModalOpen} onClose={handleCloseSignOffModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Sign off {recordForSignOff?.type === TYPE_INCIDENT ? "Incident" : "Non-conformance"} — {recordForSignOff?.ref}
            </Typography>
            <IconButton onClick={handleCloseSignOffModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {recordForSignOff && (
            <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body1">
                You are signing off as{" "}
                <strong>
                  {currentUser?.firstName} {currentUser?.lastName}
                </strong>
                . Please confirm the sign-off date and provide evidence below.
              </Typography>
              <Box>
                <TextField
                  fullWidth
                  label="Sign-off date"
                  type="date"
                  value={signOffDate}
                  onChange={(e) => setSignOffDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Button
                  size="small"
                  startIcon={<TodayIcon />}
                  onClick={() => setSignOffDate(formatDateForInput(new Date()))}
                  sx={{ mt: 0.5 }}
                >
                  Today
                </Button>
              </Box>
              <TextField
                fullWidth
                label="Evidence *"
                value={signOffEvidence}
                onChange={(e) => {
                  setSignOffEvidence(e.target.value);
                  setSignOffErrors((prev) => ({ ...prev, signOffEvidence: null }));
                }}
                multiline
                rows={3}
                placeholder="Describe or paste evidence for this sign-off"
                error={!!signOffErrors.signOffEvidence}
                helperText={signOffErrors.signOffEvidence}
              />
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Evidence attachment (optional)
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} size="small">
                    {signOffEvidenceFile ? "Change file" : "Upload"}
                    <input type="file" hidden onChange={handleSignOffEvidenceFileChange} />
                  </Button>
                  {signOffEvidenceFile && (
                    <Typography variant="body2" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {signOffEvidenceFile.name}
                      <IconButton
                        size="small"
                        onClick={() => setSignOffEvidenceFile(null)}
                        sx={{ color: theme.palette.error.main }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSignOffModal} disabled={submitting}>Cancel</Button>
          <Button onClick={handleConfirmSignOff} variant="contained" color="primary" disabled={submitting}>
            {submitting ? "Saving…" : "Confirm sign-off"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Incidents;
