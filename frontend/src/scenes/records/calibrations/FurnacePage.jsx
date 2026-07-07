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
import furnaceCalibrationService from "../../../services/furnaceCalibrationService";
import {
  UNCERTAINTY_LABEL,
  openCertificateData,
  formatUncertaintyOfMeasurement,
  enrichFurnaceWithCalibrations,
} from "./furnaceCalibrationUtils";
import {
  CALIBRATION_TABS,
  getCalibrationsListPath,
} from "./calibrationsNavigationUtils";

const FurnacePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const [furnaces, setFurnaces] = useState([]);
  const [furnacesLoading, setFurnacesLoading] = useState(false);
  const [error, setError] = useState(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedFurnaceForHistory, setSelectedFurnaceForHistory] =
    useState(null);
  const [furnaceHistory, setFurnaceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsDialogTitle, setAttachmentsDialogTitle] = useState("");
  const [attachmentsDialogItems, setAttachmentsDialogItems] = useState([]);

  const calculateDaysUntilCalibration = useCallback((calibrationDue) => {
    if (!calibrationDue) return null;

    const today = new Date();
    const dueDate = new Date(calibrationDue);

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }, []);

  const calculateStatus = useCallback(
    (equipment) => {
      if (!equipment) return "Out-of-Service";
      if (equipment.status === "out-of-service") return "Out-of-Service";
      if (!equipment.lastCalibration || !equipment.calibrationDue) {
        return "Out-of-Service";
      }

      const daysUntil = calculateDaysUntilCalibration(equipment.calibrationDue);
      if (daysUntil !== null && daysUntil < 0) return "Calibration Overdue";
      return "Active";
    },
    [calculateDaysUntilCalibration]
  );

  const fetchFurnaces = useCallback(async () => {
    try {
      setFurnacesLoading(true);

      const [equipmentResponse, allCalibrations] = await Promise.all([
        equipmentService.getAll({ equipmentType: "Furnace" }),
        furnaceCalibrationService.getAll(),
      ]);

      const furnaceEquipment = (equipmentResponse.equipment || []).sort(
        (a, b) => a.equipmentReference.localeCompare(b.equipmentReference)
      );

      const calibrationsByReference = {};
      for (const cal of Array.isArray(allCalibrations) ? allCalibrations : []) {
        const ref = cal.furnaceReference;
        if (!ref) continue;
        if (!calibrationsByReference[ref]) {
          calibrationsByReference[ref] = [];
        }
        calibrationsByReference[ref].push(cal);
      }

      const furnacesWithCalibrations = furnaceEquipment.map((furnace) =>
        enrichFurnaceWithCalibrations(
          furnace,
          calibrationsByReference[furnace.equipmentReference] || []
        )
      );

      setFurnaces(furnacesWithCalibrations);
    } catch (err) {
      console.error("Error fetching furnaces:", err);
      setError(err.message || "Failed to fetch furnace equipment");
    } finally {
      setFurnacesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFurnaces();
  }, [fetchFurnaces]);

  useEffect(() => {
    const handleEquipmentDataUpdate = () => {
      fetchFurnaces();
    };

    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);
    return () => {
      window.removeEventListener(
        "equipmentDataUpdated",
        handleEquipmentDataUpdate
      );
    };
  }, [fetchFurnaces]);

  const handleAdd = () => {
    navigate("/records/laboratory/calibrations/furnace/new");
  };

  const handleEditFromTable = (furnace) => {
    if (furnace.latestCalibration?._id) {
      navigate(
        `/records/laboratory/calibrations/furnace/edit/${furnace.latestCalibration._id}`
      );
      return;
    }

    navigate(
      `/records/laboratory/calibrations/furnace/new?equipmentId=${furnace._id}`
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

  const handleViewHistory = async (furnace) => {
    setSelectedFurnaceForHistory(furnace);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setFurnaceHistory([]);

    try {
      const response = await furnaceCalibrationService.getByEquipment(
        furnace.equipmentReference
      );
      const history = response.data || response || [];
      const sortedHistory = history.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setFurnaceHistory(sortedHistory);
    } catch (err) {
      console.error("Error fetching furnace history:", err);
      setFurnaceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
        Furnace Calibrations
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
            Furnace Calibrations
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
          Furnace Equipment
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Equipment Reference</TableCell>
                <TableCell>{UNCERTAINTY_LABEL}</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {furnacesLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : furnaces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No furnace equipment found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                furnaces.map((furnace) => {
                  const status = calculateStatus(furnace);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={furnace._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {furnace.equipmentReference}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {formatUncertaintyOfMeasurement(
                          furnace.latestUncertaintyOfMeasurement
                        )}
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
                        {furnace.lastCalibration
                          ? formatDate(furnace.lastCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {furnace.calibrationDue
                          ? (() => {
                              const daysUntil = calculateDaysUntilCalibration(
                                furnace.calibrationDue
                              );
                              let daysText;
                              let daysColor;

                              if (daysUntil === 0) {
                                daysText = "Due Today";
                                daysColor = theme.palette.warning.main;
                              } else if (daysUntil < 0) {
                                daysText = `${Math.abs(daysUntil)} days overdue`;
                                daysColor = theme.palette.error.main;
                              } else {
                                daysText = `${daysUntil} days`;
                                daysColor =
                                  daysUntil <= 30
                                    ? theme.palette.warning.main
                                    : theme.palette.success.main;
                              }

                              return (
                                <Box>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                    sx={{ color: daysColor }}
                                  >
                                    {daysText}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontSize: "0.7rem" }}
                                  >
                                    {formatDate(furnace.calibrationDue)}
                                  </Typography>
                                </Box>
                              );
                            })()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {furnace.latestCalibration?.certificates?.length > 0 && (
                          <IconButton
                            onClick={() =>
                              handleViewAttachments(
                                furnace.latestCalibration.certificates,
                                `${furnace.equipmentReference} - Attachments`
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
                          onClick={() => handleEditFromTable(furnace)}
                          size="small"
                          title={
                            furnace.latestCalibration
                              ? "Edit Latest Calibration"
                              : "Add Calibration"
                          }
                          sx={{ color: theme.palette.primary.main }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleViewHistory(furnace)}
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
          setSelectedFurnaceForHistory(null);
          setFurnaceHistory([]);
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
              {selectedFurnaceForHistory?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedFurnaceForHistory(null);
                setFurnaceHistory([]);
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
          ) : furnaceHistory.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No calibration history found for this furnace.
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell>Calibration Date</TableCell>
                    <TableCell>Calibration Company</TableCell>
                    <TableCell>{UNCERTAINTY_LABEL}</TableCell>
                    <TableCell>Calibrated By</TableCell>
                    <TableCell>Next Calibration</TableCell>
                    <TableCell>Attachments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {furnaceHistory.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.calibrationCompany || "-"}
                      </TableCell>
                      <TableCell>
                        {formatUncertaintyOfMeasurement(
                          calibration.uncertaintyOfMeasurement ?? calibration.error
                        )}
                      </TableCell>
                      <TableCell>
                        {calibration.calibratedBy?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.nextCalibration
                          ? formatDate(calibration.nextCalibration)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {calibration.certificates?.length > 0 ? (
                          <IconButton
                            onClick={() =>
                              handleViewAttachments(
                                calibration.certificates,
                                `${selectedFurnaceForHistory?.equipmentReference} - ${formatDate(calibration.date)}`
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
              setSelectedFurnaceForHistory(null);
              setFurnaceHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FurnacePage;
