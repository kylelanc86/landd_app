import api from "./axios";

export { NOTIFICATION_CENTRE_REFRESH_EVENT } from "./notificationCentreEvents";

let notificationsCache = null;
let inFlightRequest = null;

const normalizeRows = (rows) =>
  (rows || []).map((row) => ({
    id: row.id,
    kind: row.recordType || "Calibration",
    recordDescription: row.recordDescription || "-",
    equipmentReference: row.equipmentReference || null,
    daysUntilDue: row.daysUntilDue,
    bucket: row.bucket,
    source: row.sourceType || "",
    recordId: row.recordId || null,
    dueDate: row.dueDate,
  }));

const buildSnapshot = (payload) => ({
  items: normalizeRows(payload.rows),
  urgentCount: payload.urgentCount || 0,
  generatedAt: payload.generatedAt || Date.now(),
});

export const getNotificationData = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && notificationsCache) {
    return notificationsCache;
  }

  if (forceRefresh) {
    notificationsCache = null;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = api
    .get("/calibration-canonical/notifications", {
      params: forceRefresh ? { refresh: "true" } : undefined,
    })
    .then((response) => {
      const payload = response.data || {};
      notificationsCache = buildSnapshot(payload);
      return notificationsCache;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
};

export const clearNotificationCache = () => {
  notificationsCache = null;
};
