import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotificationCentre } from "../../context/NotificationCentreContext";
import { sendTestNotificationDigest } from "../../services/notificationCentreService";
import { getNotificationTargetPath } from "../../utils/notificationCentreRoutes";

const DAYS_AHEAD = 30;

const NC_COLORS = {
  overdue: "#c62828",
  dueSoon: "#f9a825",
  dueThisMonth: "#2e7d32",
};

const formatDueText = (daysUntilDue) => {
  if (daysUntilDue < 0) {
    return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`;
  }
  if (daysUntilDue === 0) {
    return "Due today";
  }
  return `Due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
};

const getRowTextColor = (daysUntilDue, bucket) => {
  if (typeof daysUntilDue === "number") {
    if (daysUntilDue < 0) return NC_COLORS.overdue;
    if (daysUntilDue < 7) return NC_COLORS.dueSoon;
    return NC_COLORS.dueThisMonth;
  }
  if (bucket === "overdue") return NC_COLORS.overdue;
  if (bucket === "dueSoon") return NC_COLORS.dueSoon;
  return NC_COLORS.dueThisMonth;
};

const summaryCountSx = (color) => ({
  color,
  fontWeight: 700,
});

const rowTextSx = (color) => ({
  color,
  fontWeight: 500,
});

const NotificationCentre = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { items: rows, loading, error, lastUpdatedAt } = useNotificationCentre();
  const [testSending, setTestSending] = useState(false);
  const [testMessage, setTestMessage] = useState(null);

  const isSuperAdmin = currentUser?.role === "super_admin";

  const counts = useMemo(
    () => ({
      overdue: rows.filter((row) => row.bucket === "overdue").length,
      dueSoon: rows.filter((row) => row.bucket === "dueSoon").length,
      dueThisMonth: rows.filter((row) => row.bucket === "dueThisMonth").length,
    }),
    [rows],
  );

  const lastUpdatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleString()
    : null;

  const handleSendTestDigest = async () => {
    setTestSending(true);
    setTestMessage(null);
    try {
      const result = await sendTestNotificationDigest();
      setTestMessage({
        severity: "success",
        text: `Test digest sent to ${result.testEmail || "kylelanc86@gmail.com"} (${result.itemCount ?? 0} items).`,
      });
    } catch (err) {
      setTestMessage({
        severity: "error",
        text:
          err.response?.data?.message ||
          err.message ||
          "Failed to send test digest email.",
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          mb: 1,
        }}
      >
        <Typography variant="h3" component="h1" sx={{ fontWeight: 600 }}>
          Notification Centre
        </Typography>
        {isSuperAdmin && (
          <Button
            variant="contained"
            onClick={handleSendTestDigest}
            disabled={testSending}
            sx={{
              backgroundColor: "#045E1F",
              "&:hover": { backgroundColor: "#034a18" },
              textTransform: "none",
              whiteSpace: "nowrap",
            }}
          >
            {testSending ? "Sending test…" : "Send test digest email"}
          </Button>
        )}
      </Box>
      <Typography variant="body1" sx={{ mb: 2 }}>
        {lastUpdatedLabel ? `Last updated: ${lastUpdatedLabel}` : ""}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, ...summaryCountSx(NC_COLORS.overdue) }}>
        Overdue: {counts.overdue}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, ...summaryCountSx(NC_COLORS.dueSoon) }}>
        Due in {"<7"} days: {counts.dueSoon}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1, ...summaryCountSx(NC_COLORS.dueThisMonth) }}>
        Due in 7-{DAYS_AHEAD} days: {counts.dueThisMonth}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {testMessage && (
        <Alert
          severity={testMessage.severity}
          sx={{ mb: 2 }}
          onClose={() => setTestMessage(null)}
        >
          {testMessage.text}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
              <TableCell sx={{ fontWeight: 600 }}>Record Type</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Record Description</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Equipment Reference</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>
                Days Until Due / Days Overdue
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 120 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No records are overdue or expiring within the next {DAYS_AHEAD} days.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const textColor = getRowTextColor(row.daysUntilDue, row.bucket);
                const targetPath = getNotificationTargetPath(row);
                return (
                  <TableRow key={row.id} hover={false}>
                    <TableCell sx={rowTextSx(textColor)}>{row.kind}</TableCell>
                    <TableCell sx={rowTextSx(textColor)}>
                      {row.recordDescription || "-"}
                    </TableCell>
                    <TableCell sx={rowTextSx(textColor)}>
                      {row.equipmentReference || "-"}
                    </TableCell>
                    <TableCell sx={rowTextSx(textColor)}>
                      {formatDueText(row.daysUntilDue)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {targetPath ? (
                        <Link
                          component="button"
                          type="button"
                          underline="always"
                          onClick={() => navigate(targetPath)}
                          sx={{
                            color: "#045E1F",
                            cursor: "pointer",
                            fontWeight: 500,
                            border: 0,
                            background: "none",
                            padding: 0,
                            font: "inherit",
                            verticalAlign: "baseline",
                          }}
                        >
                          Open
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default NotificationCentre;
