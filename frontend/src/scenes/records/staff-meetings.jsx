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
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { formatDateFull, formatDateForInput } from "../../utils/dateFormat";
import { userService } from "../../services/api";
import { staffMeetingService } from "../../services/staffMeetingService";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";

const StaffMeetings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "general";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();
  const canDelete = currentUser?.role === "admin";

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Users for Meeting Leader dropdown
  const [users, setUsers] = useState([]);

  // Form state
  const [meetingDate, setMeetingDate] = useState(formatDateForInput(new Date()));
  const [meetingLeaderId, setMeetingLeaderId] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileRemoved, setFileRemoved] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Fetch users and records on mount
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
        const response = await staffMeetingService.getAll();
        setRecords(response.data || []);
      } catch (err) {
        console.error("Error fetching staff meeting records:", err);
        showSnackbar("Failed to load staff meeting records", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleOpenAddModal = () => {
    setEditMode(false);
    setEditingRecord(null);
    setMeetingDate(formatDateForInput(new Date()));
    setMeetingLeaderId("");
    setUploadedFile(null);
    setFileRemoved(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditMode(false);
    setEditingRecord(null);
    setMeetingDate(formatDateForInput(new Date()));
    setMeetingLeaderId("");
    setUploadedFile(null);
    setFileRemoved(false);
    setFormErrors({});
  };

  const handleOpenEditModal = (record) => {
    setEditMode(true);
    setEditingRecord(record);
    setMeetingDate(formatDateForInput(new Date(record.date)));
    const leaderId = record.meetingLeaderId?._id || record.meetingLeaderId || record.meetingLeader || "";
    setMeetingLeaderId(leaderId);
    setUploadedFile(
      record.fileName
        ? { name: record.fileName, data: record.fileData }
        : null
    );
    setFileRemoved(false);
    setFormErrors({});
    setModalOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!meetingDate) errors.date = "Date of meeting is required";
    if (!meetingLeaderId) errors.leader = "Meeting leader is required";
    const dateObj = new Date(meetingDate);
    if (meetingDate && isNaN(dateObj.getTime())) errors.date = "Invalid date";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getMeetingLeaderDisplay = (record) => {
    const leader = record.meetingLeaderId;
    if (leader) {
      if (typeof leader === "object" && (leader.firstName || leader.lastName)) {
        return `${leader.firstName || ""} ${leader.lastName || ""}`.trim() || "Unknown";
      }
      const user = users.find((u) => u._id === (leader._id || leader));
      return user ? `${user.firstName} ${user.lastName}` : "Unknown";
    }
    return record.meetingLeader || "—";
  };

  const handleAddRecord = async () => {
    if (!validateForm()) return;

    try {
      const response = await staffMeetingService.create({
        date: meetingDate,
        meetingLeaderId: meetingLeaderId,
        fileName: uploadedFile?.name || null,
        fileData: uploadedFile?.data || null,
      });
      setRecords((prev) => [response.data, ...prev]);
      handleCloseModal();
      showSnackbar("Staff meeting record added", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to add record", "error");
    }
  };

  const handleSaveEdit = async () => {
    if (!validateForm() || !editingRecord) return;

    const getFilePayload = () => {
      if (fileRemoved) return { fileName: null, fileData: null };
      if (uploadedFile) return { fileName: uploadedFile.name, fileData: uploadedFile.data };
      return { fileName: editingRecord?.fileName ?? null, fileData: editingRecord?.fileData ?? null };
    };
    const filePayload = getFilePayload();

    try {
      const response = await staffMeetingService.update(editingRecord._id, {
        date: meetingDate,
        meetingLeaderId: meetingLeaderId,
        ...filePayload,
      });
      setRecords((prev) =>
        prev.map((r) => (r._id === editingRecord._id ? response.data : r))
      );
      handleCloseModal();
      showSnackbar("Staff meeting record updated", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to update record", "error");
    }
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

  const handleDeleteClick = (record) => {
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await staffMeetingService.delete(recordToDelete._id);
      setRecords((prev) => prev.filter((r) => r._id !== recordToDelete._id));
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
      showSnackbar("Staff meeting record deleted", "success");
    } catch (err) {
      showSnackbar(err.response?.data?.message || "Failed to delete record", "error");
    }
  };

  const handleDownloadFile = (record) => {
    if (record.fileData) {
      const link = document.createElement("a");
      link.href = record.fileData;
      link.download = record.fileName || "staff-meeting-file";
      link.click();
    }
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [records]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
          <Typography color="text.secondary">Loading staff meeting records...</Typography>
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
            Staff Meetings
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddModal}
          >
            Add Staff Meeting Record
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
            Staff Meeting Records
          </Typography>
          {records.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No staff meeting records yet. Click "Add Staff Meeting Record" to
              get started.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ backgroundColor: theme.palette.primary.main }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Date of Meeting
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Meeting Leader
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
                  {sortedRecords.map((record) => (
                    <TableRow key={record._id} hover>
                      <TableCell>
                        {formatDateFull(record.date)}
                      </TableCell>
                      <TableCell>{getMeetingLeaderDisplay(record)}</TableCell>
                      <TableCell>
                        {record.fileName ? (
                          <Button
                            size="small"
                            startIcon={<UploadFileIcon />}
                            onClick={() => handleDownloadFile(record)}
                            disabled={!record.fileData}
                          >
                            {record.fileName}
                          </Button>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            —
                          </Typography>
                        )}
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
              {editMode ? "Edit Staff Meeting Record" : "Add Staff Meeting Record"}
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
              label="Date of Meeting"
              type="date"
              value={meetingDate}
              onChange={(e) => {
                setMeetingDate(e.target.value);
                setFormErrors((prev) => ({ ...prev, date: null }));
              }}
              InputLabelProps={{ shrink: true }}
              error={!!formErrors.date}
              helperText={formErrors.date}
            />
            <FormControl fullWidth error={!!formErrors.leader}>
              <InputLabel>Meeting Leader</InputLabel>
              <Select
                value={meetingLeaderId}
                label="Meeting Leader"
                onChange={(e) => {
                  setMeetingLeaderId(e.target.value);
                  setFormErrors((prev) => ({ ...prev, leader: null }));
                }}
              >
                <MenuItem value="">
                  <em>Select meeting leader</em>
                </MenuItem>
                {users.map((user) => (
                  <MenuItem key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.leader && (
                <FormHelperText>{formErrors.leader}</FormHelperText>
              )}
            </FormControl>
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
            onClick={editMode ? handleSaveEdit : handleAddRecord}
            variant="contained"
            color="primary"
          >
            {editMode ? "Save Changes" : "Add Record"}
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
            Are you sure you want to delete this staff meeting record? This
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

export default StaffMeetings;
