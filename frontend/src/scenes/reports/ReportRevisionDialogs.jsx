import React, { useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { reportRevisionService } from "../../services/api";
import {
  getAxiosDownloadFilename,
  triggerBlobDownload,
} from "../../utils/downloadFilename";

export function revisionTarget(report) {
  if (!report || report.type === "uploaded") return null;
  if (report.type === "mycometer") {
    const sampleType = report.sampleType || report.data?.sampleType;
    const reportKey = sampleType === "Surface Fungi" ? "Surface Fungi" : "Air Sampling";
    return {
      reportType: "mycometer",
      reportId: report.jobId || report.data?.jobId,
      reportKey,
    };
  }
  const reportId =
    report.type === "shift" || report.type === "lead_shift"
      ? report.data?.shift?._id || report.data?._id || report.id
      : report.type === "fibre_id" || report.type === "fibre_count"
        ? report.data?._id || report.data?.id || report.id
        : report.id || report.data?.id || report.data?._id;
  return {
    reportType: report.type,
    reportId,
    reportKey: report.type,
  };
}

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function supportQuote(error, report) {
  const when = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney" });
  return [
    error?.code || "REVISION_FAILED",
    report?.type,
    report?.description,
    revisionTarget(report)?.reportId,
    when,
  ]
    .filter(Boolean)
    .join(" | ");
}

function RevisionError({ error, report }) {
  if (!error) return null;
  return (
    <Alert severity="error" sx={{ mt: 2 }}>
      <AlertTitle>The revision was not saved</AlertTitle>
      <Typography variant="body2">{error.message}</Typography>
      {error.detail ? (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {error.detail}
        </Typography>
      ) : null}
      <Typography variant="body2" sx={{ mt: 1 }}>
        The report is still authorised and the revision number has not changed.
        Try again. If this keeps happening, contact tech support and quote the
        details below.
      </Typography>
      <Typography
        variant="caption"
        component="div"
        sx={{ mt: 1, fontFamily: "monospace", wordBreak: "break-word" }}
      >
        {supportQuote(error, report)}
      </Typography>
    </Alert>
  );
}

function HistoryTable({
  entries,
  draftRevision,
  reason,
  onReasonChange,
  reasonError,
  downloadingId,
  onDownload,
}) {
  const headerSx = { "&:hover": { backgroundColor: "transparent" } };
  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={headerSx}>
          <TableCell>Revision</TableCell>
          <TableCell>Reason</TableCell>
          <TableCell>Revised by</TableCell>
          <TableCell>Date</TableCell>
          <TableCell align="right">PDF</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id || `rev-${entry.revisionNumber}`}>
            <TableCell>{entry.revisionNumber}</TableCell>
            <TableCell>{entry.reason}</TableCell>
            <TableCell>{entry.revisedByName || "—"}</TableCell>
            <TableCell>{formatWhen(entry.revisedAt)}</TableCell>
            <TableCell align="right">
              {entry.hasPdf ? (
                <Tooltip
                  title={`Download the report as it was issued at revision ${entry.supersededRevision}`}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={`Download revision ${entry.supersededRevision} PDF`}
                      disabled={downloadingId === entry.id}
                      onClick={() => onDownload(entry)}
                    >
                      {downloadingId === entry.id ? (
                        <CircularProgress size={18} />
                      ) : (
                        <DownloadIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  Not retained
                </Typography>
              )}
            </TableCell>
          </TableRow>
        ))}
        {draftRevision ? (
          <TableRow>
            <TableCell>{draftRevision}</TableCell>
            <TableCell colSpan={4}>
              <TextField
                autoFocus
                fullWidth
                required
                multiline
                minRows={2}
                label="Reason for this revision"
                value={reason}
                error={Boolean(reasonError)}
                helperText={reasonError || "Describe what is being changed and why."}
                onChange={(event) => onReasonChange(event.target.value)}
              />
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

export function ReportRevisionDialogs({
  reviseOpen,
  historyOpen,
  report,
  isAdmin,
  reason,
  onReasonChange,
  error,
  revising,
  onCloseRevise,
  onCloseHistory,
  onConfirm,
  onInformal,
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [informalOpen, setInformalOpen] = useState(false);
  const open = reviseOpen || historyOpen;
  const currentRevision = Number(report?.revision) || 0;

  useEffect(() => {
    if (!reviseOpen) setInformalOpen(false);
  }, [reviseOpen]);
  const nextRevision = currentRevision + 1;

  useEffect(() => {
    if (!open || !report) return undefined;
    const target = revisionTarget(report);
    if (!target?.reportId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    reportRevisionService
      .list(target)
      .then((response) => {
        if (!cancelled) setEntries(response.data?.entries || []);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "Revision history could not be loaded. You can still continue. If this keeps happening, contact tech support.",
          );
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, report]);

  const known = new Set(entries.map((entry) => entry.revisionNumber));
  const missing = [];
  for (let number = 1; number <= currentRevision; number += 1) {
    if (!known.has(number)) missing.push(number);
  }

  const handleDownload = async (entry) => {
    try {
      setDownloadingId(entry.id);
      const response = await reportRevisionService.downloadPdf(entry.id);
      const filename = getAxiosDownloadFilename(
        response,
        entry.pdfFilename || `revision-${entry.supersededRevision}.pdf`,
      );
      triggerBlobDownload(response.data, filename);
    } catch (err) {
      setLoadError(
        err.response?.data?.message ||
          "The retained PDF could not be downloaded. Contact tech support if this keeps happening.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <Dialog
        open={Boolean(reviseOpen || historyOpen)}
        onClose={revising ? undefined : reviseOpen ? onCloseRevise : onCloseHistory}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {reviseOpen ? "Revise report" : "Revision history"}
        </DialogTitle>
        <DialogContent>
          {reviseOpen ? (
            <DialogContentText sx={{ mb: 2 }}>
              Revision {nextRevision} will reopen this report for editing. The
              PDF saved now is the report as it stands before that change.
            </DialogContentText>
          ) : (
            <DialogContentText sx={{ mb: 2 }}>
              Each download is the report as it was issued before that revision.
            </DialogContentText>
          )}
          {loading ? <CircularProgress size={24} /> : null}
          {loadError ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {loadError}
            </Alert>
          ) : null}
          {missing.length > 0 ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {missing.length === 1
                ? `Revision ${missing[0]} was made before a PDF and reason were kept.`
                : `Revisions ${missing.join(", ")} were made before a PDF and reason were kept.`}
            </Alert>
          ) : null}
          {!loading ? (
            <HistoryTable
              entries={entries}
              draftRevision={reviseOpen ? nextRevision : null}
              reason={reason}
              onReasonChange={onReasonChange}
              downloadingId={downloadingId}
              onDownload={handleDownload}
            />
          ) : null}
          {reviseOpen ? <RevisionError error={error} report={report} /> : null}
          {revising ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">
                Generating and saving the report PDF…
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={reviseOpen ? onCloseRevise : onCloseHistory} disabled={revising}>
            {reviseOpen ? "Cancel" : "Close"}
          </Button>
          {reviseOpen && isAdmin ? (
            <Button
              color="inherit"
              disabled={revising}
              onClick={() => setInformalOpen(true)}
            >
              Reopen without a revision
            </Button>
          ) : null}
          {reviseOpen ? (
            <Button
              variant="contained"
              color="warning"
              disabled={revising}
              onClick={onConfirm}
            >
              {report?.type === "enclosure_certificate" ? "Revise certificate" : "Revise report"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog
        open={informalOpen}
        onClose={revising ? undefined : () => setInformalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reopen without a revision?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This reopens the report for editing. The revision number stays at{" "}
            {currentRevision}. A PDF is not kept, and this will not appear in
            the revision history.
          </DialogContentText>
          <RevisionError error={error} report={report} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInformalOpen(false)} disabled={revising}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            disabled={revising}
            onClick={() => onInformal()}
          >
            Reopen without a revision
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
