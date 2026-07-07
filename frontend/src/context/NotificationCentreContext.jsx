import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { hasPermission } from "../config/permissions";
import {
  clearNotificationCache,
  getNotificationData,
  NOTIFICATION_CENTRE_REFRESH_EVENT,
} from "../services/notificationCentreService";

const NotificationCentreContext = createContext(null);

const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 1000;

export const useNotificationCentre = () => {
  const context = useContext(NotificationCentreContext);
  if (!context) {
    throw new Error(
      "useNotificationCentre must be used within a NotificationCentreProvider",
    );
  }
  return context;
};

const getMsUntilNextMidnight = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
};

export const NotificationCentreProvider = ({ children }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const canViewNotifications = hasPermission(currentUser, "calibrations.view");

  const [items, setItems] = useState([]);
  const [urgentCount, setUrgentCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const lastUpdatedAtRef = useRef(null);
  const midnightTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const applySnapshot = useCallback((data) => {
    if (!mountedRef.current || !data) return;
    setItems(data.items || []);
    setUrgentCount(data.urgentCount || 0);
    const updatedAt = data.generatedAt || Date.now();
    setLastUpdatedAt(updatedAt);
    lastUpdatedAtRef.current = updatedAt;
    setError("");
  }, []);

  const refreshNotifications = useCallback(
    async ({ forceRefresh = false, showLoading = true } = {}) => {
      if (!canViewNotifications || fetchingRef.current) {
        return null;
      }

      try {
        fetchingRef.current = true;
        if (forceRefresh) {
          clearNotificationCache();
        }
        if (mountedRef.current && showLoading) {
          setLoading(true);
        }

        const data = await getNotificationData({ forceRefresh });
        applySnapshot(data);
        return data;
      } catch (err) {
        if (mountedRef.current) {
          setError("Failed to load notification records.");
          setUrgentCount(0);
        }
        return null;
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
        fetchingRef.current = false;
      }
    },
    [applySnapshot, canViewNotifications],
  );

  const refreshIfStale = useCallback(
    (options = {}) => {
      const age = Date.now() - (lastUpdatedAtRef.current || 0);
      if (age >= STALE_AFTER_MS) {
        refreshNotifications({ forceRefresh: true, showLoading: false, ...options });
      }
    },
    [refreshNotifications],
  );

  const scheduleMidnightRefresh = useCallback(() => {
    if (midnightTimeoutRef.current) {
      clearTimeout(midnightTimeoutRef.current);
    }

    midnightTimeoutRef.current = setTimeout(async () => {
      await refreshNotifications({ forceRefresh: true, showLoading: false });
      scheduleMidnightRefresh();
    }, getMsUntilNextMidnight());
  }, [refreshNotifications]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading) {
      return undefined;
    }

    if (!canViewNotifications) {
      setItems([]);
      setUrgentCount(0);
      setError("");
      setLoading(false);
      return undefined;
    }

    refreshNotifications();
    scheduleMidnightRefresh();

    pollIntervalRef.current = setInterval(() => {
      refreshNotifications({ forceRefresh: true, showLoading: false });
    }, BACKGROUND_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfStale();
      }
    };

    const handleRefreshRequest = () => {
      refreshNotifications({ forceRefresh: true, showLoading: false });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(
      NOTIFICATION_CENTRE_REFRESH_EVENT,
      handleRefreshRequest,
    );

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(
        NOTIFICATION_CENTRE_REFRESH_EVENT,
        handleRefreshRequest,
      );
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [
    authLoading,
    canViewNotifications,
    refreshIfStale,
    refreshNotifications,
    scheduleMidnightRefresh,
  ]);

  const value = {
    items,
    urgentCount,
    loading,
    error,
    lastUpdatedAt,
    refreshNotifications,
  };

  return (
    <NotificationCentreContext.Provider value={value}>
      {children}
    </NotificationCentreContext.Provider>
  );
};

export default NotificationCentreContext;
