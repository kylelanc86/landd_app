import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import { formatDate } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import { openCertificateData } from "./externalEquipmentCalibrationUtils";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const ExternalCalibrationListPage = ({
  title,
  equipmentSectionTitle,
  equipmentType,
  equipmentTypes,
  emptyMessage,
  routeBase,
  referenceField,
  calibrationService,
  enrichWithCalibrations,
  metricColumns = [],
  historyColumns = [],
  historyEmptyMessage,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const resolvedEquipmentTypes = useMemo(
    () =>
      equipmentTypes?.length
        ? equipmentTypes
        : equipmentType
          ? [equipmentType]
          : [],
    [equipmentType, equipmentTypes]
  );

  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [history, setHistory] = useState([]);
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

    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  }, []);

  const calculateStatus = useCallback(
    (item) => {
      if (!item) return "Out-of-Service";
      if (item.status === "out-of-service") return "Out-of-Service";
      if (!item.lastCalibration || !item.calibrationDue) return "Out-of-Service";

      const daysUntil = calculateDaysUntilCalibration(item.calibrationDue);
      if (daysUntil !== null && daysUntil < 0) return "Calibration Overdue";
      return "Active";
    },
    [calculateDaysUntilCalibration]
  );

  const fetchEquipment = useCallback(async () => {
    try {
      setLoading(true);

      const [equipmentResponses, allCalibrations] = await Promise.all([
        Promise.all(
          resolvedEquipmentTypes.map((type) =>
            equipmentService.getAll({ equipmentType: type, limit: 1000 })
          )
        ),
        calibrationService.getAll(),
      ]);

      const equipmentList = equipmentResponses
        .flatMap((response) => response.equipment || [])
        .sort((a, b) =>
          a.equipmentReference.localeCompare(b.equipmentReference)
        );

      const calibrationsByReference = {};
      for (const cal of Array.isArray(allCalibrations) ? allCalibrations : []) {
        const ref = cal[referenceField];
        if (!ref) continue;
        if (!calibrationsByReference[ref]) calibrationsByReference[ref] = [];
        calibrationsByReference[ref].push(cal);
      }

      setEquipment(
        equipmentList.map((item) =>
          enrichWithCalibrations(
            item,
            calibrationsByReference[item.equipmentReference] || []
          )
        )
      );
    } catch (err) {
      const label = resolvedEquipmentTypes.join(", ") || "equipment";
      console.error(`Error fetching ${label} equipment:`, err);
      setError(err.message || `Failed to fetch ${label} equipment`);
    } finally {
      setLoading(false);
    }
  }, [
    calibrationService,
    enrichWithCalibrations,
    referenceField,
    resolvedEquipmentTypes,
  ]);

  useEffect(() => {
    fetchEquipment();
  }, [fetchEquipment]);

  useEffect(() => {
    const handleEquipmentDataUpdate = () => fetchEquipment();
    window.addEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);
    return () =>
      window.removeEventListener("equipmentDataUpdated", handleEquipmentDataUpdate);
  }, [fetchEquipment]);

  const handleAdd = () => navigate(`${routeBase}/new`);

  const handleEditFromTable = (item) => {
    if (item.latestCalibration?._id) {
      navigate(`${routeBase}/edit/${item.latestCalibration._id}`);
      return;
    }
    navigate(`${routeBase}/new?equipmentId=${item._id}`);
  };

  const handleViewAttachments = (certificates, dialogTitle) => {
    if (!certificates?.length) return;
    setAttachmentsDialogTitle(dialogTitle);
    setAttachmentsDialogItems(certificates);
    setAttachmentsDialogOpen(true);
  };

  const handleViewHistory = async (item) => {
    setSelectedEquipment(item);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setHistory([]);

    try {
      const response = await calibrationService.getByEquipment(
        item.equipmentReference
      );
      const historyData = response.data || response || [];
      setHistory(
        historyData.sort((a, b) => new Date(b.date) - new Date(a.date))
      );
    } catch (err) {
      console.error("Error fetching calibration history:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const renderCalibrationDue = (calibrationDue) => {
    if (!calibrationDue) return "-";

    const daysUntil = calculateDaysUntilCalibration(calibrationDue);
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
        daysUntil <= 30 ? theme.palette.warning.main : theme.palette.success.main;
    }

    return (
      <Box>
        <Typography variant="body2" fontWeight="medium" sx={{ color: daysColor }}>
          {daysText}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
          {formatDate(calibrationDue)}
        </Typography>
      </Box>
    );
  };

  const tableColSpan = 5 + metricColumns.length;

  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title={title}
        calibrationTab={CALIBRATION_TABS.EXTERNAL}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Calibration
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box mb="40px">
        <Typography variant="h6" sx={{ mb: 2 }}>
          {equipmentSectionTitle}
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Equipment Reference</TableCell>
                {metricColumns.map((col) => (
                  <TableCell key={col.header}>{col.header}</TableCell>
                ))}
                <TableCell>Status</TableCell>
                <TableCell>Last Calibration</TableCell>
                <TableCell>Calibration Due</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : equipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={tableColSpan} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                equipment.map((item) => {
                  const status = calculateStatus(item);
                  const statusColor =
                    status === "Active"
                      ? theme.palette.success.main
                      : status === "Calibration Overdue"
                      ? theme.palette.warning.main
                      : theme.palette.error.main;

                  return (
                    <TableRow key={item._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.equipmentReference}
                        </Typography>
                      </TableCell>
                      {metricColumns.map((col) => (
                        <TableCell key={col.header}>{col.getValue(item)}</TableCell>
                      ))}
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
                        {item.lastCalibration ? formatDate(item.lastCalibration) : "-"}
                      </TableCell>
                      <TableCell>{renderCalibrationDue(item.calibrationDue)}</TableCell>
                      <TableCell>
                        {item.latestCalibration?.certificates?.length > 0 && (
                          <IconButton
                            onClick={() =>
                              handleViewAttachments(
                                item.latestCalibration.certificates,
                                `${item.equipmentReference} - Attachments`
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
                          onClick={() => handleEditFromTable(item)}
                          size="small"
                          title={
                            item.latestCalibration
                              ? "Edit Latest Calibration"
                              : "Add Calibration"
                          }
                          sx={{ color: theme.palette.primary.main }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => handleViewHistory(item)}
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
        onClose={() => {
          setAttachmentsDialogOpen(false);
          setAttachmentsDialogTitle("");
          setAttachmentsDialogItems([]);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{attachmentsDialogTitle}</Typography>
            <IconButton
              onClick={() => {
                setAttachmentsDialogOpen(false);
                setAttachmentsDialogTitle("");
                setAttachmentsDialogItems([]);
              }}
            >
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
                    onClick={() => openCertificateData(cert.data, cert.fileType)}
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
          <Button
            onClick={() => {
              setAttachmentsDialogOpen(false);
              setAttachmentsDialogTitle("");
              setAttachmentsDialogItems([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedEquipment(null);
          setHistory([]);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Calibration History - {selectedEquipment?.equipmentReference}
            </Typography>
            <IconButton
              onClick={() => {
                setHistoryDialogOpen(false);
                setSelectedEquipment(null);
                setHistory([]);
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
          ) : history.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                {historyEmptyMessage}
              </Typography>
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell>Calibration Date</TableCell>
                    {historyColumns.map((col) => (
                      <TableCell key={col.header}>{col.header}</TableCell>
                    ))}
                    <TableCell>Calibrated By</TableCell>
                    <TableCell>Next Calibration</TableCell>
                    <TableCell>Attachments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((calibration) => (
                    <TableRow key={calibration._id}>
                      <TableCell>
                        {calibration.date ? formatDate(calibration.date) : "-"}
                      </TableCell>
                      {historyColumns.map((col) => (
                        <TableCell key={col.header}>
                          {col.getValue(calibration)}
                        </TableCell>
                      ))}
                      <TableCell>{calibration.calibratedBy?.name || "-"}</TableCell>
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
                                `${selectedEquipment?.equipmentReference} - ${formatDate(calibration.date)}`
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
              setSelectedEquipment(null);
              setHistory([]);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExternalCalibrationListPage;
