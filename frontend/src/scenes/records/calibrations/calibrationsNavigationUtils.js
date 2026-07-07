export const CALIBRATIONS_LIST_BASE = "/records/laboratory/calibrations/list";
const SESSION_KEY = "calibrationsActiveTab";

export const CALIBRATION_TABS = {
  INTERNAL: 0,
  EXTERNAL: 1,
};

const tabIndexToParam = (index) => (index === 1 ? "external" : "internal");

const paramToTabIndex = (param) => {
  if (param === "external") return CALIBRATION_TABS.EXTERNAL;
  if (param === "internal") return CALIBRATION_TABS.INTERNAL;
  return null;
};

export const getStoredCalibrationsTab = () => {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return CALIBRATION_TABS.INTERNAL;
  }
  try {
    return paramToTabIndex(sessionStorage.getItem(SESSION_KEY)) ?? CALIBRATION_TABS.INTERNAL;
  } catch {
    return CALIBRATION_TABS.INTERNAL;
  }
};

export const storeCalibrationsTab = (index) => {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_KEY, tabIndexToParam(index));
  } catch {
    // ignore storage errors
  }
};

export const resolveCalibrationsTab = (tabParam) => {
  const fromParam = paramToTabIndex(tabParam);
  if (fromParam !== null) return fromParam;
  return getStoredCalibrationsTab();
};

export const getCalibrationsListPath = (tabIndex = getStoredCalibrationsTab()) => {
  const params = new URLSearchParams();
  params.set("tab", tabIndexToParam(tabIndex));

  if (typeof window !== "undefined") {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view) params.set("view", view);
  }

  return `${CALIBRATIONS_LIST_BASE}?${params.toString()}`;
};
