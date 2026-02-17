import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { userService } from "../services/api";

const UserListsContext = createContext();

export const useUserLists = () => {
  const context = useContext(UserListsContext);
  if (!context) {
    throw new Error("useUserLists must be used within a UserListsProvider");
  }
  return context;
};

const sortByName = (a, b) => {
  const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
  const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
  return nameA.localeCompare(nameB);
};

export const UserListsProvider = ({ children }) => {
  const [activeLAAs, setActiveLAAs] = useState([]);
  const [activeTechnicians, setActiveTechnicians] = useState([]);
  const [activeCounters, setActiveCounters] = useState([]);
  const [activeIdentifiers, setActiveIdentifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshUserLists = useCallback(async () => {
    try {
      setError(null);
      const [laaRes, techRes, countersRes, identifiersRes] = await Promise.all([
        userService.getAsbestosAssessors(),
        userService.getTechnicians(),
        userService.getFibreCounters(),
        userService.getFibreIdentifiers(),
      ]);
      const laas = (laaRes.data || []).sort(sortByName);
      const technicians = (techRes.data || []).sort(sortByName);
      const counters = (countersRes.data || []).sort(sortByName);
      const identifiers = (identifiersRes.data || []).sort(sortByName);
      setActiveLAAs(laas);
      setActiveTechnicians(technicians);
      setActiveCounters(counters);
      setActiveIdentifiers(identifiers);
    } catch (err) {
      console.error("Error refreshing user lists:", err);
      setError(err.message || "Failed to load user lists");
      setActiveLAAs([]);
      setActiveTechnicians([]);
      setActiveCounters([]);
      setActiveIdentifiers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUserLists();
  }, [refreshUserLists]);

  const value = {
    activeLAAs,
    activeTechnicians,
    activeCounters,
    activeIdentifiers,
    loading,
    error,
    refreshUserLists,
  };

  return (
    <UserListsContext.Provider value={value}>
      {children}
    </UserListsContext.Provider>
  );
};
