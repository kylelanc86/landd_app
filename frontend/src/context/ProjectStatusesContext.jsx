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
      console.log("Fetching project statuses...");
      setLoading(true);
      setError(null);

      const [active, inactive, all] = await Promise.all([
        projectStatusService.getActiveStatuses(),
        projectStatusService.getInactiveStatuses(),
        projectStatusService.getAllStatusesWithData(),
      ]);

      // Only update state if component is still mounted
      if (!mountedRef.current) {
        return;
      }

      console.log("Raw status data from backend:", { active, inactive, all });

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
