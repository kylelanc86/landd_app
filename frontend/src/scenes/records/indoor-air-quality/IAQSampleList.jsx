import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useSnackbar } from "../../../context/SnackbarContext";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  useTheme,
  Breadcrumbs,
  Link,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { iaqRecordService } from "../../../services/iaqRecordService";
import { iaqSampleService } from "../../../services/iaqSampleService";
import { formatDate, formatTime } from "../../../utils/dateUtils";
import PermissionGate from "../../../components/PermissionGate";
import { useAuth } from "../../../context/AuthContext";

const IAQSampleList = () => {
  const theme = useTheme();
  const { iaqRecordId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [samples, setSamples] = useState([]);
  const [sortField, setSortField] = useState("fullSampleID");
  const [sortAsc, setSortAsc] = useState(true);
  const [iaqRecord, setIaqRecord] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleteDisabled, setIsCompleteDisabled] = useState(true);
  const [nextSampleNumber, setNextSampleNumber] = useState(null);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState(null);
  const [showSamplingCompleteDialog, setShowSamplingCompleteDialog] = useState(false);
  const [showSamplesSubmittedDialog, setShowSamplesSubmittedDialog] = useState(false);
  const [submittedBySignature, setSubmittedBySignature] = useState("");
  const { showSnackbar } = useSnackbar();

  // Function to extract the numeric part from a sample number
  const extractSampleNumber = (sampleNumber) => {
    // Extract just the number part from AM prefix (e.g., "AM1" -> 1)
    const match = sampleNumber?.match(/AM(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  };

  // Load IAQ record and samples data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch IAQ record, all records (for reference calculation), and samples in parallel
        const [recordResponse, allRecordsResponse, samplesResponse] = await Promise.all([
          iaqRecordService.getById(iaqRecordId),
          iaqRecordService.getAll(),
          iaqSampleService.getByIAQRecord(iaqRecordId),
        ]);

        const recordData = recordResponse.data;
        setIaqRecord(recordData);
        setAllRecords(allRecordsResponse.data || []);

        const fetchedSamples = samplesResponse.data || [];
        setSamples(fetchedSamples);

        // Calculate next sample number
        if (fetchedSamples.length > 0) {
          const highestNumber = fetchedSamples.reduce((max, sample) => {
            const number = extractSampleNumber(sample.fullSampleID);
            return Math.max(max, number);
          }, 0);
          setNextSampleNumber(highestNumber + 1);
        } else {
          setNextSampleNumber(1);
        }

        setError(null);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
        setLoading(false);
      }
    };

    fetchData();
  }, [iaqRecordId]);

  // Memoize validation function to avoid recreating it on every render
  const validateSamplesCompleteMemo = useCallback((samplesToValidate) => {
    if (!samplesToValidate || samplesToValidate.length === 0) {
      return false;
    }

    return samplesToValidate.every((sample) => {
      // Handle sampler field - use sampler if available, fall back to collectedBy
      const sampler = sample.sampler || sample.collectedBy;

      // If it's a field blank sample, only validate basic required fields
      if (sample.location === "Field blank") {
        return (
          sample.sampleNumber && sample.location && sampler && sample.cowlNo
        );
      }

      // If sample has failed status, it's considered complete
      if (sample.status === "failed") {
        return (
          sample.sampleNumber &&
          sample.location &&
          sampler &&
          sample.pumpNo &&
          sample.flowmeter &&
          sample.cowlNo &&
          sample.filterSize &&
          sample.startTime &&
          sample.endTime &&
          sample.initialFlowrate &&
          sample.finalFlowrate &&
          sample.averageFlowrate
        );
      }

      // For non-field blank, non-failed samples, validate all required fields AND flowrates
      return (
        sample.sampleNumber &&
        sample.location &&
        sampler &&
        sample.pumpNo &&
        sample.flowmeter &&
        sample.cowlNo &&
        sample.filterSize &&
        sample.startTime &&
        sample.endTime &&
        sample.initialFlowrate &&
        sample.finalFlowrate &&
        sample.averageFlowrate &&
        parseFloat(sample.initialFlowrate) > 0 &&
        parseFloat(sample.finalFlowrate) > 0
      );
    });
  }, []);

  // Re-validate samples whenever samples change
  useEffect(() => {
    if (samples.length > 0) {
      const isValid = validateSamplesCompleteMemo(samples);
      setIsCompleteDisabled(!isValid);
    } else {
      setIsCompleteDisabled(true);
    }
  }, [samples, validateSamplesCompleteMemo]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDelete = (sampleId) => {
    const sample = samples.find((s) => s._id === sampleId);
    setSampleToDelete(sample);
    setDeleteConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!sampleToDelete) return;

    try {
      await iaqSampleService.delete(sampleToDelete._id);
      setSamples(
        samples.filter((sample) => sample._id !== sampleToDelete._id)
      );
      showSnackbar("Sample deleted successfully", "success");
    } catch (err) {
      console.error("Error deleting sample:", err);
      showSnackbar("Failed to delete sample. Please try again.", "error");
    } finally {
      setDeleteConfirmDialogOpen(false);
      setSampleToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmDialogOpen(false);
    setSampleToDelete(null);
  };

  const handleDownloadCSV = async () => {
    try {
      // TODO: Implement CSV download for IAQ samples
      showSnackbar("CSV download functionality coming soon", "info");
    } catch (err) {
      console.error("Error downloading CSV:", err);
      showSnackbar("Failed to download CSV.", "error");
    }
  };

  const handleSamplingComplete = () => {
    setShowSamplingCompleteDialog(true);
  };

  const handleConfirmSamplingComplete = async () => {
    if (!iaqRecord) return;

    try {
      const response = await iaqRecordService.update(iaqRecordId, {
        status: "Sampling Complete",
      });

      const updatedRecord = response.data;
      setIaqRecord(updatedRecord);
      setShowSamplingCompleteDialog(false);
      showSnackbar("Record status updated to Sampling Complete", "success");
    } catch (err) {
      console.error("Error updating record status:", err);
      showSnackbar("Failed to update record status", "error");
    }
  };

  const handleSamplesSubmittedToLab = () => {
    // Automatically set the current user's name
    const userName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : "";
    setSubmittedBySignature(userName);
    setShowSamplesSubmittedDialog(true);
  };

  const handleConfirmSamplesSubmitted = async () => {
    if (!iaqRecord) return;

    try {
      const response = await iaqRecordService.update(iaqRecordId, {
        status: "Samples Submitted to Lab",
      });

      const updatedRecord = response.data;
      setIaqRecord(updatedRecord);
      setShowSamplesSubmittedDialog(false);
      showSnackbar("Samples marked as submitted to lab", "success");
      
      // Navigate to indoor air quality records page
      navigate("/records/indoor-air-quality");
    } catch (err) {
      console.error("Error updating record status:", err);
      showSnackbar("Failed to update record status", "error");
    }
  };

  // Memoize sorted samples to avoid recalculating on every render
  const sortedSamples = useMemo(() => {
    return [...samples].sort((a, b) => {
      if (sortField === "sampleNumber" || sortField === "fullSampleID") {
        const aMatch = a.fullSampleID?.match(/AM(\d+)$/);
        const bMatch = b.fullSampleID?.match(/AM(\d+)$/);
        const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
        const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
        return sortAsc ? aNum - bNum : bNum - aNum;
      } else {
        const aValue = a[sortField];
        const bValue = b[sortField];
        if (aValue < bValue) return sortAsc ? -1 : 1;
        if (aValue > bValue) return sortAsc ? 1 : -1;
        return 0;
      }
    });
  }, [samples, sortField, sortAsc]);

  const handleAddSample = async () => {
    // If status is "Sampling Complete", revert to "In Progress" when adding a new sample
    if (iaqRecord && iaqRecord.status === "Sampling Complete") {
      try {
        await iaqRecordService.update(iaqRecordId, {
          status: "In Progress",
        });
        const updatedRecord = await iaqRecordService.getById(iaqRecordId);
        setIaqRecord(updatedRecord.data);
      } catch (err) {
        console.error("Error updating record status:", err);
        // Continue to navigate even if status update fails
      }
    }
    navigate(`/records/indoor-air-quality/${iaqRecordId}/samples/new`, {
      state: { nextSampleNumber },
    });
  };

  // Generate IAQ Reference for display
  const generateIAQReference = (record = null) => {
    const recordToUse = record || iaqRecord;
    if (!recordToUse) return "";
    
    const dateObj = new Date(recordToUse.monitoringDate);
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
        (r) => (r._id || r.id) === (recordToUse._id || recordToUse.id)
      ) + 1;

    return `${monthYear} - ${reportNumber}`;
  };

  // Format flowrate: 1 decimal place if whole number or 1.5, otherwise 2 decimal places
  const formatFlowrate = (flowrate) => {
    if (!flowrate || flowrate === "-") return "-";
    
    const num = parseFloat(flowrate);
    if (isNaN(num)) return flowrate;
    
    // Check if it's a whole number or exactly 1.5
    if (num % 1 === 0 || Math.abs(num - 1.5) < 0.001) {
      return num.toFixed(1);
    }
    return num.toFixed(2);
  };

  // Format sample number as {IAQREFERENCE} - {SampleNumber}
  const formatSampleNumber = (sample) => {
    if (!sample) return "-";
    const iaqRef = generateIAQReference();
    const sampleNum = sample.fullSampleID || sample.sampleNumber || "";
    return `${iaqRef} - ${sampleNum}`;
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ marginBottom: 3 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate("/records/indoor-air-quality")}
          sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          Indoor Air Quality Records
        </Link>
        <Typography color="text.primary">
          {generateIAQReference()}
        </Typography>
      </Breadcrumbs>

      <Typography
        variant="h4"
        sx={{
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 4,
        }}
      >
        Indoor Air Quality: {generateIAQReference()}
      </Typography>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 4,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSample}
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Add Sample
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCSV}
          sx={{
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            "&:hover": {
              borderColor: theme.palette.primary.dark,
              backgroundColor: theme.palette.primary.light,
            },
          }}
        >
          Download Sample Data
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
              <TableCell
                sx={{ width: "161px", minWidth: "161px", maxWidth: "161px" }}
                onClick={() => handleSort("sampleNumber")}
              >
                Sample Number
              </TableCell>
              <TableCell
                sx={{ width: "100px", minWidth: "100px", maxWidth: "100px" }}
                onClick={() => handleSort("cowlNo")}
              >
                Cowl Number
              </TableCell>
              <TableCell
                sx={{ minWidth: "200px", flex: 2 }}
                onClick={() => handleSort("location")}
              >
                Location
              </TableCell>
              <TableCell
                sx={{ minWidth: "70px", maxWidth: "110px" }}
                onClick={() => handleSort("startTime")}
              >
                Start Time
              </TableCell>
              <TableCell
                sx={{ minWidth: "70px", maxWidth: "110px" }}
                onClick={() => handleSort("endTime")}
              >
                End Time
              </TableCell>
              <TableCell
                sx={{ minWidth: "100px", maxWidth: "150px" }}
                onClick={() => handleSort("averageFlowrate")}
              >
                Flow Rate (L/min)
              </TableCell>
              <TableCell sx={{ width: "180px", minWidth: "200px", maxWidth: "200px" }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No samples found. Click 'Add Sample' to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedSamples.map((sample) => (
                <TableRow key={sample._id}>
                  <TableCell
                    sx={{ width: "161px", minWidth: "161px", maxWidth: "161px" }}
                  >
                    {formatSampleNumber(sample)}
                  </TableCell>
                  <TableCell
                    sx={{ width: "100px", minWidth: "100px", maxWidth: "100px" }}
                  >
                    {sample.cowlNo || "-"}
                  </TableCell>
                  <TableCell sx={{ minWidth: "200px", flex: 2 }}>
                    {sample.location}
                  </TableCell>
                  <TableCell sx={{ minWidth: "70px", maxWidth: "110px" }}>
                    {formatTime(sample.startTime)}
                  </TableCell>
                  <TableCell sx={{ minWidth: "70px", maxWidth: "110px" }}>
                    {sample.endTime ? formatTime(sample.endTime) : "-"}
                  </TableCell>
                  <TableCell sx={{ minWidth: "100px", maxWidth: "150px" }}>
                    {sample.status === "failed" ? (
                      <Typography
                        component="span"
                        sx={{
                          color: "error.main",
                          fontWeight: "bold",
                          fontSize: "inherit",
                        }}
                      >
                        Failed
                      </Typography>
                    ) : (
                      formatFlowrate(sample.averageFlowrate)
                    )}
                  </TableCell>
                  <TableCell
                    sx={{ width: "180px", minWidth: "180px", maxWidth: "180px" }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() =>
                        navigate(
                          `/records/indoor-air-quality/${iaqRecordId}/samples/edit/${sample._id}`
                        )
                      }
                      sx={{ mr: 1 }}
                    >
                      Edit Sample
                    </Button>
                    <PermissionGate
                      requiredPermissions={["admin.view"]}
                      fallback={null}
                    >
                      <IconButton
                        onClick={() => handleDelete(sample._id)}
                        title="Delete (Admin Only)"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Sampling Complete and Samples Submitted to Lab Buttons */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 3,
          gap: 2,
        }}
      >
        {iaqRecord && iaqRecord.status === "In Progress" && (
          <Button
            variant="contained"
            color="info"
            onClick={handleSamplingComplete}
            sx={{
              "&:hover": {
                backgroundColor: theme.palette.info.dark,
              },
            }}
          >
            Sampling Complete
          </Button>
        )}
        {iaqRecord && iaqRecord.status === "Sampling Complete" && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSamplesSubmittedToLab}
            sx={{
              backgroundColor: theme.palette.warning.main,
              color: theme.palette.warning.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.warning.dark,
              },
            }}
          >
            Samples Submitted to Lab
          </Button>
        )}
      </Box>

      {/* Sampling Complete Confirmation Dialog */}
      <Dialog
        open={showSamplingCompleteDialog}
        onClose={() => setShowSamplingCompleteDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Complete Sampling</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please review the sample summary before completing sampling.
          </Typography>

          {/* Sample Summary Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Sample Summary ({samples.length} samples)
            </Typography>
            {samples.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell>Sample Number</TableCell>
                    <TableCell>Cowl Number</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>End Time</TableCell>
                    <TableCell>Flow Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...samples]
                    .sort((a, b) => {
                      const aMatch = a.fullSampleID?.match(/AM(\d+)$/);
                      const bMatch = b.fullSampleID?.match(/AM(\d+)$/);
                      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
                      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
                      return aNum - bNum;
                    })
                    .map((sample) => (
                      <TableRow key={sample._id}>
                        <TableCell>{formatSampleNumber(sample)}</TableCell>
                        <TableCell>{sample.cowlNo || "-"}</TableCell>
                        <TableCell>
                          {sample.location || "Not specified"}
                        </TableCell>
                        <TableCell>
                          {sample.startTime
                            ? formatTime(sample.startTime)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {sample.endTime ? formatTime(sample.endTime) : "-"}
                        </TableCell>
                        <TableCell>
                          {sample.status === "failed" ? (
                            <Typography
                              component="span"
                              sx={{
                                color: "error.main",
                                fontWeight: "bold",
                                fontSize: "inherit",
                              }}
                            >
                              Failed
                            </Typography>
                          ) : sample.averageFlowrate
                          ? `${formatFlowrate(sample.averageFlowrate)} L/min`
                          : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No samples added yet
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowSamplingCompleteDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSamplingComplete}
            variant="contained"
            color="primary"
          >
            Complete Sampling
          </Button>
        </DialogActions>
      </Dialog>

      {/* Samples Submitted to Lab Confirmation Dialog */}
      <Dialog
        open={showSamplesSubmittedDialog}
        onClose={() => setShowSamplesSubmittedDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Confirm Samples Submitted to Lab</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Please confirm that the samples have been physically delivered to
            the laboratory and sign below to verify.
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Signature
            </Typography>
            <TextField
              fullWidth
              value={submittedBySignature}
              variant="outlined"
              disabled
              helperText="This will be automatically signed with your name"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setShowSamplesSubmittedDialog(false)}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSamplesSubmitted}
            variant="contained"
            color="primary"
          >
            Confirm Submission
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmDialogOpen}
        onClose={cancelDelete}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
          },
        }}
      >
        <DialogTitle
          sx={{
            pb: 2,
            px: 3,
            pt: 3,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: "error.main",
              color: "white",
            }}
          >
            <DeleteIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
            Delete Sample
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 3, pb: 1, border: "none" }}>
          <Typography variant="body1" sx={{ color: "text.primary" }}>
            Are you sure you want to delete this air monitoring sample? This
            action cannot be undone.
          </Typography>
          {sampleToDelete && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>Sample ID:</strong> {sampleToDelete.fullSampleID}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Location:</strong> {sampleToDelete.location}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 2, border: "none" }}>
          <Button
            onClick={cancelDelete}
            variant="outlined"
            sx={{
              minWidth: 100,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{
              minWidth: 120,
              borderRadius: 2,
              textTransform: "none",
              fontWeight: 500,
            }}
          >
            Delete Sample
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IAQSampleList;
