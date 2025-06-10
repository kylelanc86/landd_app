import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import userService from "../services/userService";
import { performanceLogger } from "../utils/performanceLogger";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restoreAttempted, setRestoreAttempted] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await userService.getCurrentUser();
      if (response.data) {
        setCurrentUser(response.data);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      try {
        const response = await userService.login({ email, password });
        if (response.data?.token) {
          localStorage.setItem("token", response.data.token);
          await fetchCurrentUser(); // Fetch user data after successful login
          return response.data;
        }
        throw new Error("No token received");
      } catch (error) {
        console.error("Login error:", error);
        throw error;
      }
    },
    [fetchCurrentUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setCurrentUser(null);
  }, []);

  useEffect(() => {
    if (!restoreAttempted) {
      setRestoreAttempted(true);
      const token = localStorage.getItem("token");
      if (token) {
        fetchCurrentUser();
      } else {
        setLoading(false);
      }
    }
  }, [restoreAttempted, fetchCurrentUser]);

  const value = {
    currentUser,
    setCurrentUser,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
