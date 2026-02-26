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
            
            // Process cached data
            let active, inactive, all;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
              active = data.activeStatuses?.map(status => status.text) || [];
              inactive = data.inactiveStatuses?.map(status => status.text) || [];
              all = data;
            } else {
              active = data.filter(s => s.isActiveStatus === true).map(s => s.text).sort();
              inactive = data.filter(s => s.isActiveStatus === false).map(s => s.text).sort();
              all = data.sort((a, b) => a.text.localeCompare(b.text));
            }
            
            const colors = projectStatusService.getAllHardcodedColors();
            
            if (mountedRef.current) {
              setActiveStatuses(active);
              setInactiveStatuses(inactive);
              setAllStatuses(all);
              setStatusColors(colors);
              setLoading(false);
            }
            
            console.log(`⚡ Cache load complete in ${cacheTime.toFixed(2)}ms (saved ~1000ms)`);
            fetchingRef.current = false;
            return;
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
      
      // Cache the fetched data
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: allStatusesData,
          timestamp: Date.now()
        }));
      } catch (cacheError) {
        console.warn('Failed to cache statuses:', cacheError);
      }
      
      // Only update state if component is still mounted
      if (!mountedRef.current) {
        return;
      }

      // Process data locally instead of making additional API calls
      let active, inactive, all;
      
      if (allStatusesData && typeof allStatusesData === 'object' && !Array.isArray(allStatusesData)) {
        // New structure: {activeStatuses: [...], inactiveStatuses: [...]}
        active = allStatusesData.activeStatuses?.map(status => status.text) || [];
        inactive = allStatusesData.inactiveStatuses?.map(status => status.text) || [];
        all = allStatusesData;
      } else {
        // Fallback to old structure (array)
        active = allStatusesData
          .filter(status => status.isActiveStatus === true)
          .map(status => status.text)
          .sort();
        inactive = allStatusesData
          .filter(status => status.isActiveStatus === false)
          .map(status => status.text)
          .sort();
        all = allStatusesData.sort((a, b) => a.text.localeCompare(b.text));
      }

      console.log("Raw status data from backend:", { active, inactive, all });
      console.log(`⚡ Status fetch optimized: 1 API call in ${fetchTime.toFixed(2)}ms (was 3 calls)`);

      // Use hardcoded colors for fast loading (these are synced with database)
      // This prevents the need to fetch colors from database every time
      let colors = projectStatusService.getAllHardcodedColors();
      console.log("Using hardcoded status colors for fast loading:", colors);

      setActiveStatuses(active);
      setInactiveStatuses(inactive);
      setAllStatuses(all);
      setStatusColors(colors);
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

    // Cleanup function to prevent state updates after unmount
    return () => {
      mountedRef.current = false;
    };
  }, [fetchStatuses]);

  // Debug logging for state changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("statusColors state changed:", statusColors);
    }
  }, [statusColors]);

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
