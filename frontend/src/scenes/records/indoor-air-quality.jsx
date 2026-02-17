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
  Chip,
  CircularProgress,
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { formatDate, formatDateForInput } from "../../utils/dateFormat";
import { iaqRecordService } from "../../services/iaqRecordService";
import { iaqSampleService } from "../../services/iaqSampleService";
import { useSnackbar } from "../../context/SnackbarContext";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../config/permissions";
import { generateIAQReport } from "../../utils/generateIAQReport";
import MailIcon from "@mui/icons-material/Mail";

const IndoorAirQuality = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "laboratory";
  const theme = useTheme();
  const { showSnackbar } = useSnackbar();
  const { currentUser } = useAuth();

  // State for records and modal
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [monitoringDate, setMonitoringDate] = useState(
    formatDateForInput(new Date()),
  );
  const [dateError, setDateError] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [reportViewedRecordIds, setReportViewedRecordIds] = useState(new Set());
  const [authorisingReports, setAuthorisingReports] = useState({});
  const [sendingAuthorisationRequests, setSendingAuthorisationRequests] =
    useState({});

  // Load IAQ records
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        const response = await iaqRecordService.getAll();
        const fetchedRecords = response.data || [];
        setRecords(fetchedRecords);
      } catch (err) {
        console.error("Error fetching IAQ records:", err);
        showSnackbar("Failed to load IAQ records", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, [showSnackbar]);

  const handleBackToHome = () => {
    navigate(`/records?view=${view}`);
  };

  const handleOpenAddDialog = () => {
    setMonitoringDate(formatDateForInput(new Date()));
    setDateError(null);
    setAddDialogOpen(true);
  };

  const handleCloseAddDialog = () => {
    setAddDialogOpen(false);
    setMonitoringDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  const handleSetToday = () => {
    setMonitoringDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  // Generate IAQ Reference: {Month} - {Year} - {x}
  const generateIAQReference = (record, allRecords) => {
    const dateObj = new Date(record.monitoringDate);
    const month = dateObj.toLocaleString("default", { month: "short" });
    const year = dateObj.getFullYear();
    const monthYear = `${month} ${year}`;

    // Find all records for the same month-year, sorted by creation time
    const sameMonthYearRecords = allRecords
      .filter((r) => {
        const recordDate = new Date(r.monitoringDate);
        return (
          recordDate.getMonth() === dateObj.getMonth() &&
          recordDate.getFullYear() === dateObj.getFullYear()
        );
      })
      .sort((a, b) => {
        // Sort by creation time to maintain order
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

    // Find the position of the current record (1-indexed)
    const reportNumber =
      sameMonthYearRecords.findIndex(
        (r) => r._id === record._id || r.id === record.id,
      ) + 1;

    return `${monthYear} - ${reportNumber}`;
  };

  const handleAddRecord = async () => {
    // Validate date
    if (!monitoringDate) {
      setDateError("Date is required");
      return;
    }

    const dateObj = new Date(monitoringDate);
    if (isNaN(dateObj.getTime())) {
      setDateError("Invalid date");
      return;
    }

    try {
      const response = await iaqRecordService.create({
        monitoringDate: monitoringDate,
        status: "In Progress",
      });

      const newRecord = response.data;
      setRecords([...records, newRecord]);
      showSnackbar("IAQ record created successfully", "success");
      handleCloseAddDialog();
    } catch (err) {
      console.error("Error creating IAQ record:", err);
      setDateError(err.response?.data?.message || "Failed to create record");
      showSnackbar("Failed to create IAQ record", "error");
    }
  };

  // Handle row click to navigate to sample list
  const handleRowClick = (record) => {
    const recordId = record._id || record.id;
    navigate(`/records/indoor-air-quality/${recordId}/samples`);
  };

  // Handle edit date
  const handleEditDate = (e, record) => {
    e.stopPropagation();
    setEditingRecord(record);
    setMonitoringDate(formatDateForInput(new Date(record.monitoringDate)));
    setDateError(null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingRecord(null);
    setMonitoringDate(formatDateForInput(new Date()));
    setDateError(null);
  };

  const handleSaveEdit = async () => {
    if (!monitoringDate) {
      setDateError("Date is required");
      return;
    }

    const dateObj = new Date(monitoringDate);
    if (isNaN(dateObj.getTime())) {
      setDateError("Invalid date");
      return;
    }

    try {
      const recordId = editingRecord._id || editingRecord.id;
      const response = await iaqRecordService.update(recordId, {
        monitoringDate: monitoringDate,
      });

      const updatedRecord = response.data;
      setRecords(
        records.map((r) => ((r._id || r.id) === recordId ? updatedRecord : r)),
      );
      showSnackbar("IAQ record updated successfully", "success");
      handleCloseEditDialog();
    } catch (err) {
      console.error("Error updating IAQ record:", err);
      setDateError(err.response?.data?.message || "Failed to update record");
      showSnackbar("Failed to update IAQ record", "error");
    }
  };

  // Handle delete record
  const handleDeleteRecord = (e, record) => {
    e.stopPropagation();
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      const recordId = recordToDelete._id || recordToDelete.id;
      await iaqRecordService.delete(recordId);
      setRecords(records.filter((r) => (r._id || r.id) !== recordId));
      showSnackbar("IAQ record deleted successfully", "success");
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (err) {
      console.error("Error deleting IAQ record:", err);
      showSnackbar("Failed to delete IAQ record", "error");
    }
  };

  const handleGeneratePDF = async (e, record) => {
    e.stopPropagation();
    try {
      // Fetch the full record with populated samples
      const recordResponse = await iaqRecordService.getById(
        record._id || record.id,
      );
      const fullRecord = recordResponse.data;

      // Fetch all records for reference calculation
      const allRecordsResponse = await iaqRecordService.getAll();
      const allRecords = allRecordsResponse.data || [];

      // Fetch samples for this record
      const samplesResponse = await iaqSampleService.getByIAQRecord(
        record._id || record.id,
      );
      const samples = samplesResponse.data || [];

      if (samples.length === 0) {
        showSnackbar("No samples found for this record", "warning");
        return;
      }

      // Generate PDF - open in new tab if not approved, download if approved
      await generateIAQReport({
        record: fullRecord,
        allRecords: allRecords,
        samples: samples,
        openInNewTab: !fullRecord.reportApprovedBy,
        reportApprovedBy: fullRecord.reportApprovedBy || null,
        reportIssueDate: fullRecord.reportIssueDate || null,
      });

      if (!fullRecord.reportApprovedBy) {
        setReportViewedRecordIds((prev) =>
          new Set(prev).add(record._id || record.id),
        );
        try {
          await iaqRecordService.update(record._id || record.id, {
            reportViewedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn("Failed to persist report viewed:", e);
        }
      }

      if (fullRecord.reportApprovedBy) {
        showSnackbar("PDF downloaded successfully", "success");
      } else {
        showSnackbar("PDF opened in new tab", "info");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      showSnackbar("Failed to generate PDF", "error");
    }
  };

  const handleAuthoriseReport = async (record) => {
    try {
      setAuthorisingReports((prev) => ({
        ...prev,
        [record._id || record.id]: true,
      }));

      await iaqRecordService.authorise(record._id || record.id);

      // Refresh the records list
      const recordsResponse = await iaqRecordService.getAll();
      const fetchedRecords = recordsResponse.data || [];
      setRecords(fetchedRecords);

      // Generate and download the authorised report
      try {
        await handleGeneratePDF({ stopPropagation: () => {} }, record);
        showSnackbar(
          "Report authorised and downloaded successfully.",
          "success",
        );
      } catch (reportError) {
        console.error("Error generating authorised report:", reportError);
        showSnackbar(
          "Report authorised but failed to generate download.",
          "warning",
        );
      }
    } catch (error) {
      console.error("Error authorising report:", error);
      showSnackbar("Failed to authorise report. Please try again.", "error");
    } finally {
      setAuthorisingReports((prev) => ({
        ...prev,
        [record._id || record.id]: false,
      }));
    }
  };

  const handleSendForAuthorisation = async (record) => {
    try {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [record._id || record.id]: true,
      }));

      const response = await iaqRecordService.sendForAuthorisation(
        record._id || record.id,
      );

      showSnackbar(
        response.data?.message ||
          `Authorisation request emails sent successfully to ${
            response.data?.recipients?.length || 0
          } lab signatory user(s)`,
        "success",
      );
    } catch (error) {
      console.error("Error sending authorisation request emails:", error);
      showSnackbar(
        error.response?.data?.message ||
          "Failed to send authorisation request emails. Please try again.",
        "error",
      );
    } finally {
      setSendingAuthorisationRequests((prev) => ({
        ...prev,
        [record._id || record.id]: false,
      }));
    }
  };

  const handleAnalysis = (e, record) => {
    e.stopPropagation();
    const recordId = record._id || record.id;
    navigate(`/records/indoor-air-quality/${recordId}/analysis`);
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "Complete - Satisfactory":
        return "success";
      case "Complete - Failed":
        return "error";
      case "Sampling Complete":
        return "info";
      case "Samples Submitted to Lab":
        return "warning";
      case "In Progress":
      default:
        return "warning";
    }
  };

  // Sort records by monitoring date (most recent first)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = new Date(a.monitoringDate);
      const dateB = new Date(b.monitoringDate);
      return dateB - dateA;
    });
  }, [records]);

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
            Indoor Air Quality
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddDialog}
          >
            Add Indoor Air Quality Record
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
          <Typography color="text.primary">Indoor Air Quality</Typography>
        </Breadcrumbs>

        {/* Records Table */}
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Indoor Air Quality Records
          </Typography>
          {records.length === 0 ? (
            <Typography variant="body1" color="text.secondary">
              No records yet. Click "Add Indoor Air Quality Record" to get
              started.
            </Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{ background: "linear-gradient(to right, #045E1F, #96CC78) !important", color: "white", "&:hover": { backgroundColor: "transparent" } }}
                  >
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      IAQ Reference
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Sample Date
                    </TableCell>
                    <TableCell sx={{ color: "white", fontWeight: "bold" }}>
                      Status
                    </TableCell>
                    <TableCell
                      sx={{ color: "white", fontWeight: "bold", width: "35%" }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRecords.map((record) => {
                    const iaqReference = generateIAQReference(record, records);
                    const recordId = record._id || record.id;
                    return (
                      <TableRow
                        key={recordId}
                        hover
                        onClick={() => handleRowClick(record)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {iaqReference}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {formatDate(record.monitoringDate)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={record.status}
                            color={getStatusColor(record.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          sx={{ width: "35%" }}
                        >
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                          >
                            {record.status === "Samples Submitted to Lab" && (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={(e) => handleAnalysis(e, record)}
                                sx={{
                                  backgroundColor: "#2678D9",
                                  "&:hover": {
                                    backgroundColor: "#1F61B0",
                                  },
                                }}
                              >
                                SAMPLE ANALYSIS
                              </Button>
                            )}
                            <IconButton
                              size="small"
                              onClick={(e) => handleEditDate(e, record)}
                              title="Edit Date"
                              sx={{ color: theme.palette.primary.main }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => handleDeleteRecord(e, record)}
                              title="Delete Record"
                              sx={{ color: theme.palette.error.main }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                            <Box
                              display="flex"
                              flexDirection="column"
                              alignItems="center"
                              gap={0.5}
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => handleGeneratePDF(e, record)}
                                title={
                                  record.status === "Complete - Satisfactory" ||
                                  record.status === "Complete - Failed"
                                    ? "Generate PDF Report"
                                    : "Analysis must be completed before generating PDF"
                                }
                                disabled={
                                  record.status !== "Complete - Satisfactory" &&
                                  record.status !== "Complete - Failed"
                                }
                                sx={{
                                  color:
                                    record.status ===
                                      "Complete - Satisfactory" ||
                                    record.status === "Complete - Failed"
                                      ? theme.palette.info.main
                                      : theme.palette.action.disabled,
                                }}
                              >
                                <PictureAsPdfIcon fontSize="small" />
                              </IconButton>
                              {!record.reportApprovedBy &&
                                (record.status === "Complete - Satisfactory" ||
                                  record.status === "Complete - Failed") && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: "error.main",
                                      fontSize: "0.7rem",
                                    }}
                                  >
                                    Not approved
                                  </Typography>
                                )}
                            </Box>
                            {(() => {
                              const conditions = {
                                notApproved: !record.reportApprovedBy,
                                reportViewed:
                                  reportViewedRecordIds.has(
                                    record._id || record.id,
                                  ) || !!record.reportViewedAt,
                                alreadySentForAuthorisation: !!record.authorisationRequestedBy,
                                hasAdminPermission: hasPermission(
                                  currentUser,
                                  "admin.view",
                                ),
                                hasEditPermission: hasPermission(
                                  currentUser,
                                  "projects.edit",
                                ),
                                isLabSignatory: Boolean(
                                  currentUser?.labSignatory,
                                ),
                                isComplete:
                                  record.status === "Complete - Satisfactory" ||
                                  record.status === "Complete - Failed",
                              };
                              const baseVisible =
                                conditions.notApproved &&
                                conditions.reportViewed &&
                                conditions.isComplete;
                              const visibility = {
                                showAuthorise:
                                  baseVisible &&
                                  conditions.isLabSignatory &&
                                  conditions.hasEditPermission,
                                showSend:
                                  baseVisible &&
                                  !conditions.isLabSignatory &&
                                  conditions.hasEditPermission,
                              };
                              return (
                                <>
                                  {visibility.showAuthorise && (
                                    <Button
                                      variant="contained"
                                      size="small"
                                      color="success"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAuthoriseReport(record);
                                      }}
                                      disabled={
                                        authorisingReports[
                                          record._id || record.id
                                        ]
                                      }
                                      sx={{
                                        backgroundColor: "#4caf50",
                                        color: "white",
                                        "&:hover": {
                                          backgroundColor: "#45a049",
                                        },
                                      }}
                                    >
                                      {authorisingReports[
                                        record._id || record.id
                                      ]
                                        ? "Authorising..."
                                        : "Authorise Report"}
                                    </Button>
                                  )}
                                  {visibility.showSend && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color={conditions.alreadySentForAuthorisation ? "inherit" : "primary"}
                                      startIcon={<MailIcon />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSendForAuthorisation(record);
                                      }}
                                      disabled={
                                        sendingAuthorisationRequests[
                                          record._id || record.id
                                        ]
                                      }
                                      sx={
                                        conditions.alreadySentForAuthorisation
                                          ? { color: "text.secondary", borderColor: "grey.400" }
                                          : undefined
                                      }
                                    >
                                      {sendingAuthorisationRequests[
                                        record._id || record.id
                                      ]
                                        ? "Sending..."
                                        : conditions.alreadySentForAuthorisation
                                        ? "Re-send for Authorisation"
                                        : "Send for Authorisation"}
                                    </Button>
                                  )}
                                </>
                              );
                            })()}
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

      {/* Add Record Dialog */}
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
            <Typography variant="h6">Add Indoor Air Quality Record</Typography>
            <IconButton onClick={handleCloseAddDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}
          >
            <TextField
              fullWidth
              label="Monitoring Date"
              type="date"
              value={monitoringDate}
              onChange={(e) => {
                setMonitoringDate(e.target.value);
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
          <Button onClick={handleAddRecord} variant="contained" color="primary">
            Add Record
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Record Dialog */}
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
            <Typography variant="h6">Edit Indoor Air Quality Record</Typography>
            <IconButton onClick={handleCloseEditDialog} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ mt: 2, display: "flex", gap: 2, alignItems: "flex-start" }}
          >
            <TextField
              fullWidth
              label="Monitoring Date"
              type="date"
              value={monitoringDate}
              onChange={(e) => {
                setMonitoringDate(e.target.value);
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
          setRecordToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this IAQ record? This will also
            delete all associated samples. This action cannot be undone.
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

export default IndoorAirQuality;
