import React, { useState, useEffect, useMemo } from "react";
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
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatDate } from "../../../utils/dateFormat";
import { riLiquidCalibrationService } from "../../../services/riLiquidCalibrationService";
import { CALIBRATION_TABS } from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const getCalibratedByName = (calibratedBy) => {
  if (!calibratedBy) return "N/A";
  return (
    `${calibratedBy.firstName || ""} ${calibratedBy.lastName || ""}`.trim() ||
    "N/A"
  );
};

const CalibrationRecordsTable = ({ calibrations, onDelete }) => {
  const theme = useTheme();

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
            <TableCell>Calibration Date</TableCell>
            <TableCell>Asbestos Type</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Calibrated By</TableCell>
            {onDelete && <TableCell>Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {calibrations.map((calibration) => (
            <TableRow key={calibration._id}>
              <TableCell>{formatDate(calibration.date)}</TableCell>
              <TableCell>{calibration.asbestosTypeVerified || "-"}</TableCell>
              <TableCell>
                <Chip
                  label={calibration.status}
                  color={calibration.status === "Pass" ? "success" : "error"}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {getCalibratedByName(calibration.calibratedBy)}
              </TableCell>
              {onDelete && (
                <TableCell>
                  <IconButton
                    onClick={() => onDelete(calibration._id)}
                    size="small"
                    sx={{ color: theme.palette.error.main }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const BottleSubheader = ({ bottle }) => (
  <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
    Bottle ID: {bottle.bottleId}
    {" · "}
    Batch Number: {bottle.batchNumber || "-"}
    {" · "}
    Refractive Index: {bottle.refractiveIndex ?? "-"}
    {" · "}
    Date Opened:{" "}
    {bottle.dateOpened ? formatDate(bottle.dateOpened) : "-"}
  </Typography>
);

const RiLiquidHistoryPage = () => {
  const navigate = useNavigate();
  const { bottleId } = useParams();

  const [calibrations, setCalibrations] = useState([]);
  const [emptyBottleHistory, setEmptyBottleHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBottle, setSelectedBottle] = useState(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottleId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (bottleId) {
        const calibrationResponse =
          await riLiquidCalibrationService.getByBottle(bottleId, {
            limit: 1000,
          });
        const calibrationData = calibrationResponse.data || [];
        setCalibrations(
          calibrationData.sort(
            (a, b) => new Date(b.date) - new Date(a.date),
          ),
        );
        setEmptyBottleHistory([]);
      } else {
        const bottleResponse =
          await riLiquidCalibrationService.getEmptyBottles();
        setEmptyBottleHistory(bottleResponse.data || []);
        setCalibrations([]);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load calibration history");
      setCalibrations([]);
      setEmptyBottleHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const emptyBottles = useMemo(() => {
    if (bottleId) return [];
    return [...emptyBottleHistory].sort(
      (a, b) =>
        new Date(b.dateEmptied || 0).getTime() -
        new Date(a.dateEmptied || 0).getTime(),
    );
  }, [emptyBottleHistory, bottleId]);

  const bottleSpecificSummary = useMemo(() => {
    if (!bottleId || calibrations.length === 0) return null;
    const latest = calibrations[0];
    const earliestOpened = calibrations.reduce((earliest, cal) => {
      if (!cal.dateOpened) return earliest;
      if (!earliest) return cal.dateOpened;
      return new Date(cal.dateOpened) < new Date(earliest)
        ? cal.dateOpened
        : earliest;
    }, null);

    return {
      bottleId,
      batchNumber: latest.batchNumber,
      refractiveIndex: latest.refractiveIndex,
      dateOpened: earliestOpened || latest.dateOpened,
    };
  }, [bottleId, calibrations]);

  const handleBackToCalibrations = () => {
    navigate("/records/laboratory/calibrations/ri-liquid");
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this calibration record?",
      )
    ) {
      return;
    }

    try {
      await riLiquidCalibrationService.delete(id);
      fetchData();
    } catch (err) {
      console.error("Error deleting calibration:", err);
      alert(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete calibration",
      );
    }
  };

  const handleCloseModal = () => {
    setSelectedBottle(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="400px"
        >
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
        <Typography variant="h6" color="error">
          {error}
        </Typography>
        <Button onClick={handleBackToCalibrations} sx={{ mt: 2 }}>
          Back to RI Liquid Calibrations
        </Button>
      </Box>
    );
  }

  // Bottle-specific history (from active bottles page)
  if (bottleId) {
    return (
      <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
        <CalibrationPageHeader
          title="RI Liquid Calibration History"
          breadcrumbCurrent={bottleId}
          calibrationTab={CALIBRATION_TABS.INTERNAL}
          parents={[
            {
              label: "RI Liquid Calibrations",
              onClick: handleBackToCalibrations,
            },
          ]}
        />
        {bottleSpecificSummary && (
          <BottleSubheader bottle={bottleSpecificSummary} />
        )}

        {calibrations.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No calibration records found for this bottle.
            </Typography>
          </Paper>
        ) : (
          <CalibrationRecordsTable
            calibrations={calibrations}
            onDelete={handleDelete}
          />
        )}
      </Box>
    );
  }

  // Global history: one row per emptied bottle
  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title="RI Liquid Calibration History"
        breadcrumbCurrent="History"
        calibrationTab={CALIBRATION_TABS.INTERNAL}
        parents={[
          {
            label: "RI Liquid Calibrations",
            onClick: handleBackToCalibrations,
          },
        ]}
      />

      {emptyBottles.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="body1" color="text.secondary">
            No empty bottles found.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                <TableCell>Bottle ID</TableCell>
                <TableCell>Batch Number</TableCell>
                <TableCell>Date Opened</TableCell>
                <TableCell>Refractive Index</TableCell>
                <TableCell>Date Emptied</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {emptyBottles.map((bottle) => (
                <TableRow
                  key={bottle.bottleId}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => setSelectedBottle(bottle)}
                >
                  <TableCell>{bottle.bottleId}</TableCell>
                  <TableCell>{bottle.batchNumber || "-"}</TableCell>
                  <TableCell>
                    {bottle.dateOpened ? formatDate(bottle.dateOpened) : "-"}
                  </TableCell>
                  <TableCell>{bottle.refractiveIndex ?? "-"}</TableCell>
                  <TableCell>
                    {bottle.dateEmptied
                      ? formatDate(bottle.dateEmptied)
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={Boolean(selectedBottle)}
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Bottle Calibration Records</Typography>
            <IconButton onClick={handleCloseModal} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedBottle && (
            <>
              <BottleSubheader bottle={selectedBottle} />
              {selectedBottle.calibrations?.length > 0 ? (
                <CalibrationRecordsTable
                  calibrations={[...selectedBottle.calibrations].sort(
                    (a, b) => new Date(b.date) - new Date(a.date),
                  )}
                />
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No calibration records found for this bottle.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default RiLiquidHistoryPage;
