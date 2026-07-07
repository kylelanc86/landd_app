export const NOTIFICATION_CENTRE_REFRESH_EVENT = "notificationCentre:refresh";

const CALIBRATION_MUTATION_PATTERN = /-calibrations(?:\/|$)/i;
const EXCLUDED_CALIBRATION_PATHS = ["calibration-canonical"];
const EXCLUDED_CALIBRATION_SUFFIXES = ["/pumps/bulk"];

export const isCalibrationMutationRequest = (config) => {
  const method = config?.method?.toLowerCase();
  if (!["post", "put", "patch", "delete"].includes(method)) {
    return false;
  }

  const url = `${config?.baseURL || ""}${config?.url || ""}`;
  if (!CALIBRATION_MUTATION_PATTERN.test(url)) {
    return false;
  }

  if (EXCLUDED_CALIBRATION_PATHS.some((segment) => url.includes(segment))) {
    return false;
  }

  return !EXCLUDED_CALIBRATION_SUFFIXES.some((suffix) => url.includes(suffix));
};

const parseRequestBody = (data) => {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data;
};

export const isEquipmentStatusMutationRequest = (config) => {
  const method = config?.method?.toLowerCase();
  if (!["put", "patch"].includes(method)) {
    return false;
  }

  const url = `${config?.baseURL || ""}${config?.url || ""}`;
  if (!/\/equipment(?:\/|$)/i.test(url)) {
    return false;
  }

  const body = parseRequestBody(config?.data);
  return body?.status !== undefined;
};

export const isNotificationCentreMutationRequest = (config) =>
  isCalibrationMutationRequest(config) ||
  isEquipmentStatusMutationRequest(config);

// TODO(iaq-notifications): Extend mutation detection for /iaq-records writes.
// TODO(audit-notifications): Extend mutation detection for /records/audits writes.

export const requestNotificationCentreRefresh = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATION_CENTRE_REFRESH_EVENT));
};
