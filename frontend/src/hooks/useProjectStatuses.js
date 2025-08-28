import { useState, useEffect } from 'react';
import projectStatusService from '../services/projectStatusService';

export const useProjectStatuses = () => {
  const [activeStatuses, setActiveStatuses] = useState([]);
  const [inactiveStatuses, setInactiveStatuses] = useState([]);
  const [allStatuses, setAllStatuses] = useState([]);
  const [statusColors, setStatusColors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [active, inactive, all] = await Promise.all([
        projectStatusService.getActiveStatuses(),
        projectStatusService.getInactiveStatuses(),
        projectStatusService.getAllStatusesWithData()
      ]);
      
      // Get color information for each status
      const colors = {};
      for (const status of all) {
        colors[status.text] = status.statusColor || '#1976d2';
      }
      
      setActiveStatuses(active);
      setInactiveStatuses(inactive);
      setAllStatuses(all);
      setStatusColors(colors);
    } catch (err) {
      console.error('Error fetching project statuses:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatuses = () => {
    projectStatusService.clearCache();
    fetchStatuses();
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  return {
    activeStatuses,
    inactiveStatuses,
    allStatuses,
    statusColors,
    loading,
    error,
    refreshStatuses
  };
};

export default useProjectStatuses;
