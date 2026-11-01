import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import projectStatusService from "../services/projectStatusService";

const ProjectStatusesContext = createContext();

const DEFAULT_STATUS_COLOR = "#1976d2";

/** Status entries may be `{ text }` objects or plain labels. */
function statusLabel(status) {
  if (typeof status === "string") return status.trim();
  if (status && typeof status.text === "string") return status.text.trim();
  return "";
}

/** Normalise API or cached payloads into active/inactive label lists. */
function listsFromStatusData(data) {
  if (Array.isArray(data)) {
    return {
      active: data
        .filter((status) => status?.isActiveStatus === true)
        .map(statusLabel)
        .filter(Boolean),
      inactive: data
        .filter((status) => status?.isActiveStatus === false)
        .map(statusLabel)
        .filter(Boolean),
      all: data,
    };
  }

  if (data && typeof data === "object") {
    return {
      active: (data.activeStatuses || []).map(statusLabel).filter(Boolean),
      inactive: (data.inactiveStatuses || []).map(statusLabel).filter(Boolean),
      all: data,
    };
  }

  return { active: [], inactive: [], all: data };
}

/** Build statusColors map from API response (single source of truth: database). */
function buildStatusColorsFromApiData(data) {
  if (!data) return {};
  const items = [];
  if (data.activeStatuses?.length) items.push(...data.activeStatuses);
  if (data.inactiveStatuses?.length) items.push(...data.inactiveStatuses);
  if (Array.isArray(data)) items.push(...data);
  return items.reduce((acc, s) => {
    const text = statusLabel(s);
    if (text && typeof s === "object") acc[text] = s.statusColor || DEFAULT_STATUS_COLOR;
    return acc;
  }, {});
}

export const useProjectStatuses = () => {
  const context = useContext(ProjectStatusesContext);
  if (!context) {
    throw new Error(
      "useProjectStatuses must be used within a ProjectStatusesProvider"
    );
  }
  return context;
};

export const ProjectStatusesProvider = ({ children }) => {
  const [activeStatuses, setActiveStatuses] = useState([]);
  const [inactiveStatuses, setInactiveStatuses] = useState([]);
  const [allStatuses, setAllStatuses] = useState([]);
  const [statusColors, setStatusColors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use refs to prevent multiple simultaneous API calls
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  const fetchStatuses = useCallback(async () => {
    // Prevent multiple simultaneous API calls
    if (fetchingRef.current) {
      return;
    }

    try {
      fetchingRef.current = true;
      const startTime = performance.now();
      console.log("Fetching project statuses...");
      setLoading(true);
      setError(null);

      // OPTIMIZATION: Try to load from localStorage cache first
      const CACHE_KEY = 'project_statuses_cache';
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
      
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_DURATION) {
            console.log(`⚡ Using cached statuses (age: ${Math.round(age / 1000)}s)`);
            const cacheTime = performance.now() - startTime;
            const { active, inactive, all } = listsFromStatusData(data);

            // An empty cache (failed fetch, or labels stored without text) must not
            // block the projects table and timesheet project search for 5 minutes.
            if (active.length > 0 || inactive.length > 0) {
              const colors = buildStatusColorsFromApiData(data);
              const colorsToUse = Object.keys(colors).length > 0 ? colors : projectStatusService.getAllHardcodedColors();

              if (mountedRef.current) {
                setActiveStatuses(active);
                setInactiveStatuses(inactive);
                setAllStatuses(all);
                setStatusColors(colorsToUse);
                setLoading(false);
              }

              console.log(`⚡ Cache load complete in ${cacheTime.toFixed(2)}ms (saved ~1000ms)`);
              fetchingRef.current = false;
              return;
            }

            console.log("Cached statuses were empty, fetching fresh data");
          } else {
            console.log(`Cache expired (age: ${Math.round(age / 1000)}s), fetching fresh data`);
          }
        }
      } catch (cacheError) {
        console.warn('Cache read failed, fetching from server:', cacheError);
      }

      // OPTIMIZATION: Fetch once instead of 3 separate API calls
      const allStatusesData = await projectStatusService.getAllStatuses();
      const fetchTime = performance.now() - startTime;
      
      const { active, inactive, all } = listsFromStatusData(allStatusesData);

      // Don't keep a failed or empty payload; it would hide every project list.
      if (active.length > 0 || inactive.length > 0) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: allStatusesData,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          console.warn('Failed to cache statuses:', cacheError);
        }
      } else {
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch (cacheError) {
          console.warn('Failed to clear empty status cache:', cacheError);
        }
      }

      // Only update state if component is still mounted
      if (!mountedRef.current) {
        return;
      }

      console.log("Raw status data from backend:", { active, inactive, all });
      console.log(`⚡ Status fetch optimized: 1 API call in ${fetchTime.toFixed(2)}ms (was 3 calls)`);

      // Single source of truth: use status colours from API (database) so all users see the same colours
      const colors = buildStatusColorsFromApiData(allStatusesData);
      const colorsToUse = Object.keys(colors).length > 0 ? colors : projectStatusService.getAllHardcodedColors();

      setActiveStatuses(active);
      setInactiveStatuses(inactive);
      setAllStatuses(all);
      setStatusColors(colorsToUse);
    } catch (err) {
      console.error("Error fetching project statuses:", err);
      if (mountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      fetchingRef.current = false;
    }
  }, []);

  const refreshStatuses = useCallback(() => {
    console.log("Refreshing project statuses...");
    projectStatusService.clearCache();
    // Clear localStorage cache
    try {
      localStorage.removeItem('project_statuses_cache');
      console.log("Cleared localStorage cache");
    } catch (e) {
      console.warn("Failed to clear cache:", e);
    }
    fetchStatuses();
  }, [fetchStatuses]);

  /** Update only status colors from the in-memory hardcoded map (no API call). Use after admin changes status colours. */
  const refreshStatusColorsOnly = useCallback(() => {
    setStatusColors(projectStatusService.getAllHardcodedColors());
  }, []);

  useEffect(() => {
    console.log("ProjectStatusesProvider mounted, fetching statuses...");
    mountedRef.current = true;
    fetchStatuses();

    // Cleanup function to prevent state updates after unmount.
    // Release the in-flight lock so a remount (React strict mode) can fetch again.
    return () => {
      mountedRef.current = false;
      fetchingRef.current = false;
    };
  }, [fetchStatuses]);

  // Debug logging for state changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("statusColors state changed:", statusColors);
    }
  }, [statusColors]);

  // Cross-tab sync (same user): when status colors are updated in another tab, this tab picks up from localStorage
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'statusColors' && e.newValue && mountedRef.current) {
        try {
          setStatusColors(JSON.parse(e.newValue));
        } catch (err) {
          console.warn('Failed to apply status colors from storage event:', err);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = {
    activeStatuses,
    inactiveStatuses,
    allStatuses,
    statusColors,
    loading,
    error,
    refreshStatuses,
    refreshStatusColorsOnly,
  };

  return (
    <ProjectStatusesContext.Provider value={value}>
      {children}
    </ProjectStatusesContext.Provider>
  );
};

export default ProjectStatusesContext;
