import React, { useState } from "react";
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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import Header from "../../components/Header";

const MicroscopePage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [calibrations, setCalibrations] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    servicingDate: "",
    microscopeReference: "",
    serviceReport: null,
  });

  const handleAdd = () => {
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setNewRecord({
      servicingDate: "",
      microscopeReference: "",
      serviceReport: null,
    });
  };

  const handleSaveRecord = () => {
    if (newRecord.servicingDate && newRecord.microscopeReference) {
      // Calculate next calibration due date (1 year after servicing date)
      const servicingDate = new Date(newRecord.servicingDate);
      const nextCalibrationDue = new Date(servicingDate);
      nextCalibrationDue.setFullYear(nextCalibrationDue.getFullYear() + 1);

      const record = {
        id: Date.now(), // Simple ID generation
        servicingDate: newRecord.servicingDate,
        microscopeReference: newRecord.microscopeReference,
        nextCalibrationDue: nextCalibrationDue.toISOString().split("T")[0], // Format as YYYY-MM-DD
        serviceReportUrl: newRecord.serviceReport
          ? URL.createObjectURL(newRecord.serviceReport)
          : null,
      };
      setCalibrations([...calibrations, record]);
      handleCloseModal();
    }
  };

  const handleServiceReport = (url) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setNewRecord({ ...newRecord, serviceReport: file });
  };

  return (
    <Box m="20px">
      <Box display="flex" alignItems="center" mb="20px">
        <IconButton onClick={() => navigate("/calibrations")}>
          <ArrowBackIcon />
        </IconButton>
        <Header
          title="Phase Contrast Microscope Records"
          subtitle="Manage microscope servicing records"
        />
      </Box>

      <Box display="flex" justifyContent="flex-end" mb="20px">
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add record
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Calibration Date</TableCell>
              <TableCell>Microscope Reference</TableCell>
              <TableCell>Next Calibration Due</TableCell>
              <TableCell>Service Report</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calibrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No calibration records found. Click "Add record" to add a
                    new entry.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              calibrations.map((calibration) => (
                <TableRow key={calibration.id}>
                  <TableCell>{calibration.servicingDate}</TableCell>
                  <TableCell>{calibration.microscopeReference}</TableCell>
                  <TableCell>{calibration.nextCalibrationDue}</TableCell>
                  <TableCell>
                    {calibration.serviceReportUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PictureAsPdfIcon />}
                        onClick={() =>
                          handleServiceReport(calibration.serviceReportUrl)
                        }
                        sx={{
                          borderColor: theme.palette.primary.main,
                          color: theme.palette.primary.main,
                          "&:hover": {
                            borderColor: theme.palette.primary.dark,
                            backgroundColor: theme.palette.primary.light,
                          },
                        }}
                      >
                        Service Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Record Modal */}
      <Dialog
        open={openModal}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add New Calibration Record</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Servicing Date"
              type="date"
              value={newRecord.servicingDate}
              onChange={(e) =>
                setNewRecord({ ...newRecord, servicingDate: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Microscope Reference"
              value={newRecord.microscopeReference}
              onChange={(e) =>
                setNewRecord({
                  ...newRecord,
                  microscopeReference: e.target.value,
                })
              }
              sx={{ mb: 2 }}
            />
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{ mb: 2 }}
            >
              Attach Service Report
              <input
                type="file"
                hidden
                accept=".pdf"
                onChange={handleFileChange}
              />
            </Button>
            {newRecord.serviceReport && (
              <Typography variant="body2" color="primary">
                File selected: {newRecord.serviceReport.name}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleSaveRecord}
            variant="contained"
            disabled={
              !newRecord.servicingDate || !newRecord.microscopeReference
            }
          >
            Save Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MicroscopePage;
