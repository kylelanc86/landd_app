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

      // Get color information for each status
      const colors = {};

      // Handle the new structure where all is an object with activeStatuses and inactiveStatuses
      if (all && typeof all === "object" && !Array.isArray(all)) {
        // Extract colors from the structured response
        if (all.activeStatuses) {
          all.activeStatuses.forEach((status) => {
            if (status.text && status.statusColor) {
              colors[status.text] = status.statusColor;
            }
          });
        }
        if (all.inactiveStatuses) {
          all.inactiveStatuses.forEach((status) => {
            if (status.text && status.statusColor) {
              colors[status.text] = status.statusColor;
            }
          });
        }
      } else if (Array.isArray(all)) {
        // Handle legacy array structure
        all.forEach((status) => {
          if (status.text && status.statusColor) {
            colors[status.text] = status.statusColor;
          }
        });
      }

      console.log("Processed status colors:", colors);
      console.log("Setting statusColors state with:", colors);

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
