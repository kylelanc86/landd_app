import React, { useState, useEffect, useRef } from "react";
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
  FormLabel,
  FormControlLabel,
  InputLabel,
  InputAdornment,
  Select,
  MenuItem,
  Radio,
  RadioGroup,
  IconButton,
  useTheme,
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
import MicIcon from "@mui/icons-material/Mic";
import { formatDateForInput, formatDateFull } from "../../utils/dateFormat";
import { userService } from "../../services/api";
import { feedbackService } from "../../services/feedbackService";
import { useSnackbar } from "../../context/SnackbarContext";

const FEEDBACK_TYPE_POSITIVE = "positive";
const FEEDBACK_TYPE_NEGATIVE = "negative";
const NON_CONFORMANCE_PREFIX = "LD-NC";

const Feedback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();

  const [users, setUsers] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Form state
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [feedbackDescription, setFeedbackDescription] = useState("");
  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPE_POSITIVE);
  const [nonConformance, setNonConformance] = useState("");
  const [nonConformanceRefSuffix, setNonConformanceRefSuffix] = useState("");
  const [receivedBy, setReceivedBy] = useState("");

  // Dictation
  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await userService.getAll(true);
        setUsers(response.data || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        showSnackbar("Failed to load users", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [showSnackbar]);

  useEffect(() => {
    let cancelled = false;
    const fetchFeedback = async () => {
      try {
        setFeedbackLoading(true);
        const response = await feedbackService.getAll();
        if (!cancelled) setFeedbackList(response.data || []);
      } catch (err) {
        if (!cancelled) {
          const isNetworkError =
            err?.code === "ERR_NETWORK" || err?.message === "Network Error";
          const message = isNetworkError
            ? "Could not connect to server. Make sure the backend is running."
            : err.response?.data?.message || "Failed to load feedback";
          showSnackbar(message, "error");
        }
      } finally {
        if (!cancelled) setFeedbackLoading(false);
      }
    };
    fetchFeedback();
    return () => { cancelled = true; };
  }, [showSnackbar]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleOpenAddModal = () => {
    setDate(formatDateForInput(new Date()));
    setFeedbackDescription("");
    setFeedbackType(FEEDBACK_TYPE_POSITIVE);
    setNonConformance("");
    setNonConformanceRefSuffix("");
    setReceivedBy("");
    setFormErrors({});
    setDictationError("");
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isDictating && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
      setIsDictating(false);
    }
    setModalOpen(false);
    setFormErrors({});
  };

  const handleSetToday = () => {
    setDate(formatDateForInput(new Date()));
    setFormErrors((prev) => ({ ...prev, date: null }));
  };

  const startDictation = () => {
    if (isDictating && recognitionRef.current) {
      stopDictation();
      return;
    }
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      setDictationError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
      );
      return;
    }
    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-AU";
      recognition.onstart = () => {
        setIsDictating(true);
        setDictationError("");
      };
      recognition.onresult = (event) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTranscript += transcript;
        }
        if (finalTranscript) {
          setFeedbackDescription((prev) => {
            const current = prev || "";
            const isFirst = !current || current.trim().length === 0;
            const newText = isFirst
              ? finalTranscript.charAt(0).toUpperCase() + finalTranscript.slice(1)
              : finalTranscript;
            return current + (current ? " " : "") + newText;
          });
        }
      };
      recognition.onerror = (event) => {
        setDictationError(`Dictation error: ${event.error}`);
        setIsDictating(false);
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        setIsDictating(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      setDictationError("Failed to start dictation. Please try again.");
      recognitionRef.current = null;
    }
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsDictating(false);
  };

  const validateForm = () => {
    const errors = {};
    if (!date) errors.date = "Date is required";
    if (date && isNaN(new Date(date).getTime())) errors.date = "Invalid date";
    if (!feedbackDescription?.trim())
      errors.feedbackDescription = "Feedback Description is required";
    if (!feedbackType) errors.feedbackType = "Feedback Type is required";
    if (feedbackType === FEEDBACK_TYPE_NEGATIVE && nonConformance === "yes") {
      if (!nonConformanceRefSuffix?.trim())
        errors.nonConformanceRefSuffix =
          "Non-conformance Reference is required";
    }
    if (!receivedBy) errors.receivedBy = "Received by is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    const payload = {
      date,
      feedbackDescription: feedbackDescription.trim(),
      feedbackType,
      nonConformance: feedbackType === FEEDBACK_TYPE_NEGATIVE ? nonConformance : "",
      nonConformanceReference:
        feedbackType === FEEDBACK_TYPE_NEGATIVE &&
        nonConformance === "yes" &&
        nonConformanceRefSuffix?.trim()
          ? `${NON_CONFORMANCE_PREFIX}${nonConformanceRefSuffix.trim()}`
          : null,
      receivedBy,
    };
    try {
      const response = await feedbackService.create(payload);
      setFeedbackList((prev) => [response.data, ...prev]);
      showSnackbar("Feedback added", "success");
      handleCloseModal();
    } catch (err) {
      showSnackbar(
        err.response?.data?.message || "Failed to add feedback",
        "error"
      );
    }
  };

  const getReceivedByDisplay = (record) => {
    if (!record.receivedBy) return "—";
    const user = users.find((u) => u._id === record.receivedBy);
    return user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || record.receivedBy
      : record.receivedBy;
  };

  const showNonConformanceSection =
    feedbackType === FEEDBACK_TYPE_NEGATIVE;
  const showNonConformanceRef =
    feedbackType === FEEDBACK_TYPE_NEGATIVE && nonConformance === "yes";

  return (
    <Box m="20px">
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Client Feedback
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAddModal}
        >
          Add Feedback
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
          <Typography color="text.primary">Client Feedback</Typography>
        </Breadcrumbs>

        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Feedback Register
          </Typography>
          {feedbackLoading ? (
            <Typography variant="body1" color="text.secondary">
              Loading feedback...
            </Typography>
          ) : feedbackList.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No feedback recorded yet. Use &quot;Add Feedback&quot; to add an
              entry.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: theme.palette.primary.main }}>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Date
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Type
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Description
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Non-conformance Ref
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Received by
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feedbackList.map((row) => (
                    <TableRow key={row._id} hover>
                      <TableCell>{formatDateFull(row.date)}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>
                        {row.feedbackType}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        {row.feedbackDescription}
                      </TableCell>
                      <TableCell>
                        {row.nonConformanceReference || "—"}
                      </TableCell>
                      <TableCell>{getReceivedByDisplay(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add Feedback Modal */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Add Feedback</Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
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

            <TextField
              fullWidth
              label="Feedback Description *"
              value={feedbackDescription}
              onChange={(e) => {
                setFeedbackDescription(e.target.value);
                setFormErrors((prev) => ({ ...prev, feedbackDescription: null }));
              }}
              multiline
              rows={4}
              placeholder="Enter feedback description..."
              error={!!formErrors.feedbackDescription}
              helperText={formErrors.feedbackDescription}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" sx={{ alignSelf: "flex-end", mb: 1 }}>
                    <IconButton
                      onClick={isDictating ? stopDictation : startDictation}
                      color={isDictating ? "error" : "primary"}
                      title={isDictating ? "Stop dictation" : "Start dictation"}
                      size="small"
                    >
                      <MicIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {isDictating && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "error.main",
                    animation: "pulse 1.5s ease-in-out infinite",
                    "@keyframes pulse": {
                      "0%": { opacity: 1 },
                      "50%": { opacity: 0.5 },
                      "100%": { opacity: 1 },
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Dictating... Speak clearly into your microphone
                </Typography>
              </Box>
            )}
            {dictationError && (
              <Typography variant="caption" color="error">
                {dictationError}
              </Typography>
            )}

            <FormControl component="fieldset" error={!!formErrors.feedbackType}>
              <FormLabel component="legend">Feedback Type *</FormLabel>
              <RadioGroup
                row
                value={feedbackType}
                onChange={(e) => {
                  setFeedbackType(e.target.value);
                  setNonConformance("");
                  setNonConformanceRefSuffix("");
                  setFormErrors((prev) => ({
                    ...prev,
                    feedbackType: null,
                    nonConformanceRefSuffix: null,
                  }));
                }}
              >
                <FormControlLabel
                  value={FEEDBACK_TYPE_POSITIVE}
                  control={<Radio />}
                  label="Positive"
                />
                <FormControlLabel
                  value={FEEDBACK_TYPE_NEGATIVE}
                  control={<Radio />}
                  label="Negative"
                />
              </RadioGroup>
              {formErrors.feedbackType && (
                <FormHelperText>{formErrors.feedbackType}</FormHelperText>
              )}
            </FormControl>

            {showNonConformanceSection && (
              <FormControl component="fieldset">
                <FormLabel component="legend">Non-conformance?</FormLabel>
                <RadioGroup
                  row
                  value={nonConformance}
                  onChange={(e) => {
                    setNonConformance(e.target.value);
                    if (e.target.value !== "yes") setNonConformanceRefSuffix("");
                    setFormErrors((prev) => ({
                      ...prev,
                      nonConformanceRefSuffix: null,
                    }));
                  }}
                >
                  <FormControlLabel value="yes" control={<Radio />} label="Yes" />
                  <FormControlLabel value="no" control={<Radio />} label="No" />
                </RadioGroup>
              </FormControl>
            )}

            {showNonConformanceRef && (
              <TextField
                fullWidth
                label="Non-conformance Reference *"
                value={nonConformanceRefSuffix}
                onChange={(e) => {
                  setNonConformanceRefSuffix(e.target.value);
                  setFormErrors((prev) => ({
                    ...prev,
                    nonConformanceRefSuffix: null,
                  }));
                }}
                placeholder="e.g. 001"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {NON_CONFORMANCE_PREFIX}
                    </InputAdornment>
                  ),
                }}
                error={!!formErrors.nonConformanceRefSuffix}
                helperText={formErrors.nonConformanceRefSuffix}
              />
            )}

            <FormControl fullWidth error={!!formErrors.receivedBy}>
              <InputLabel>Received by *</InputLabel>
              <Select
                value={receivedBy}
                label="Received by *"
                onChange={(e) => {
                  setReceivedBy(e.target.value);
                  setFormErrors((prev) => ({ ...prev, receivedBy: null }));
                }}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Select user</em>
                </MenuItem>
                {users.map((u) => (
                  <MenuItem key={u._id} value={u._id}>
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown"}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.receivedBy && (
                <FormHelperText>{formErrors.receivedBy}</FormHelperText>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}>
            Add Feedback
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Feedback;
