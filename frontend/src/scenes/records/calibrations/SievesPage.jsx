import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Button,
  useTheme,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import { formatDate } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import sieveCalibrationService from "../../../services/sieveCalibrationService";
import {
  openCertificateData,
  enrichSieveWithCalibrations,
} from "./sieveCalibrationUtils";
import {
  CALIBRATION_TABS,
  getCalibrationsListPath,
} from "./calibrationsNavigationUtils";

const SievesPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [sieves, setSieves] = useState([]);
  const [sievesLoading, setSievesLoading] = useState(false);
  const [error, setError] = useState(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedSieveForHistory, setSelectedSieveForHistory] =
    useState(null);
  const [sieveHistory, setSieveHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsDialogTitle, setAttachmentsDialogTitle] = useState("");
  const [attachmentsDialogItems, setAttachmentsDialogItems] = useState([]);

  const calculateStatus = useCallback((equipment) => {
    if (!equipment) return "Out-of-Service";
    if (equipment.status === "out-of-service") return "Out-of-Service";
    return equipment.lastCalibration ? "Active" : "Out-of-Service";
  }, []);

  const fetchSieves = useCallback(async () => {
    try {
      setSievesLoading(true);

      const [equipmentResponse, allCalibrations] = await Promise.all([
        equipmentService.getAll({ equipmentType: "Sieves" }),
        sieveCalibrationService.getAll(),
      ]);

      const sieveEquipment = (equipmentResponse.equipment || []).sort(
        (a, b) => a.equipmentReference.localeCompare(b.equipmentReference)
      );

      const calibrationsByReference = {};
      for (const cal of Array.isArray(allCalibrations) ? allCalibrations : []) {
        const ref = cal.sieveReference;
        if (!ref) continue;
        if (!calibrationsByReference[ref]) {
          calibrationsByReference[ref] = [];
        }
        calibrationsByReference[ref].push(cal);
      }

      const sievesWithCalibrations = sieveEquipment.map((sieve) =>
        enrichSieveWithCalibrations(
          sieve,
          calibrationsByReference[sieve.equipmentReference] || []
        )
      );

      setSieves(sievesWithCalibrations);
    } catch (err) {
      console.error("Error fetching sieves:", err);
      setError(err.message || "Failed to fetch sieve equipment");
    } finally {
      setSievesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSieves();
  }, [fetchSieves]);

  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchSieves();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);
    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchSieves]);

  const handleAdd = () => {
    navigate("/records/laboratory/calibrations/sieves/new");
  };

  const handleEditFromTable = (sieve) => {
    if (sieve.latestCalibration?._id) {
      navigate(
        `/records/laboratory/calibrations/sieves/edit/${sieve.latestCalibration._id}`
      );
      return;
    }

    navigate(
      `/records/laboratory/calibrations/sieves/new?equipmentId=${sieve._id}`
    );
  };

  const handleBackToHome = () => {
    navigate("/records");
  };

  const handleBackToCalibrations = () => {
    navigate(getCalibrationsListPath(CALIBRATION_TABS.EXTERNAL));
  };

  const handleViewAttachments = (certificates, title) => {
    if (!certificates?.length) return;

    setAttachmentsDialogTitle(title);
    setAttachmentsDialogItems(certificates);
    setAttachmentsDialogOpen(true);
  };

  const handleCloseAttachmentsDialog = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsDialogTitle("");
    setAttachmentsDialogItems([]);
  };

  const handleViewHistory = async (sieve) => {
    setSelectedSieveForHistory(sieve);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setSieveHistory([]);

    try {
      const response = await sieveCalibrationService.getByEquipment(
        sieve.equipmentReference
      );
      const history = response.data || response || [];
      const sortedHistory = history.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setSieveHistory(sortedHistory);
    } catch (err) {
      console.error("Error fetching sieve history:", err);
      setSieveHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Sieves Calibrations
      </Typography>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb="20px"
      >
        <Breadcrumbs>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToHome}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Records Home
          </Link>
          <Link
            component="button"
            variant="body1"
            onClick={handleBackToCalibrations}
            sx={{ cursor: "pointer" }}
          >
            Calibrations
          </Link>
          <Typography color="text.primary">
            Sieves Calibrations
          </Typography>
        </Breadcrumbs>

        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Calibration
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          Sieves Equipment
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Equipment Reference</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Calibration Date</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sievesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : sieves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No sieves equipment found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sieves.map((sieve) => {
                  const status = calculateStatus(sieve);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={sieve._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {sieve.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            backgroundColor: statusColor,
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                          {status}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {sieve.lastCalibration
                          ? formatDate(sieve.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {sieve.latestCalibration?.certificates?.length > 0 && (
                          <IconButton
                            onClick={() =>
                              handleViewAttachments(
                                sieve.latestCalibration.certificates,
                                `${sieve.equipmentReference} - Attachments`
                              )
                            }
                            size="small"
                            title="View Attachments"
                            sx={{ color: theme.palette.text.secondary }}
                          >
                            <DescriptionIcon />
                          </IconButton>
                        )}
                        <IconButton
                          onClick={() => handleEditFromTable(sieve)}
                          size="small"
                          title={
                            sieve.latestCalibration
                              ? "Edit Latest Calibration"
                              : "Add Calibration"
                          }
                          sx={{ color: theme.palette.primary.main }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleViewHistory(sieve)}
                          size="small"
                          title="View Calibration History"
                          sx={{ color: theme.palette.info.main }}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog
        open={attachmentsDialogOpen}
        onClose={handleCloseAttachmentsDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">{attachmentsDialogTitle}</Typography>
            <IconButton onClick={handleCloseAttachmentsDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {attachmentsDialogItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No attachments found.
            </Typography>
          ) : (
            <List dense>
              {attachmentsDialogItems.map((cert, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemButton
                    onClick={() =>
                      openCertificateData(cert.data, cert.fileType)
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <PictureAsPdfIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary={cert.fileName || `Certificate ${index + 1}`}
                      secondary={
                        cert.uploadedAt
                          ? `Uploaded ${formatDate(cert.uploadedAt)}`
                          : "Certificate"
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAttachmentsDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedSieveForHistory(null);
          setSieveHistory([]);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              Calibration History -{" "}
              {selectedSieveForHistory?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedSieveForHistory(null);
                setSieveHistory([]);
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {historyLoading ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              minHeight="200px"
            >
              <CircularProgress />
            </Box>
          ) : sieveHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No calibration history found for this sieve set.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell>Calibration Date</TableCell>
                    <TableCell>Calibration Company</TableCell>
                    <TableCell>Calibrated By</TableCell>
                    <TableCell>Attachments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sieveHistory.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibrationCompany || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibratedBy?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.certificates?.length > 0 ? (
                          <IconButton
                            onClick={() =>
                              handleViewAttachments(
                                calibration.certificates,
                                `${selectedSieveForHistory?.equipmentReference} - ${formatDate(calibration.date)}`
                              )
                            }
                            size="small"
                            title="View Attachments"
                            sx={{ color: theme.palette.text.secondary }}
                          >
                            <DescriptionIcon />
                          </IconButton>
                        ) : (
                          "-"
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
          <Button
            onClick={() => {
              setHistoryDialogOpen(false);
              setSelectedSieveForHistory(null);
              setSieveHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SievesPage;
