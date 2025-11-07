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

      // OPTIMIZATION: Fetch once instead of 3 separate API calls
      const allStatusesData = await projectStatusService.getAllStatuses();
      const fetchTime = performance.now() - startTime;
      
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
    fetchStatuses();
  }, [fetchStatuses]);

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
  };

  return (
    <ProjectStatusesContext.Provider value={value}>
      {children}
    </ProjectStatusesContext.Provider>
  );
};

export default ProjectStatusesContext;
