import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { authService } from "../services/api";

// Create and export the context
export const AuthContext = createContext(null);

// Export the hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Export the provider
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const restoreAttempted = useRef(false);

  // Function to restore user state from backend
  const restoreUserState = async () => {
    // If we've already attempted to restore, don't try again
    if (restoreAttempted.current) {
      return;
    }
    restoreAttempted.current = true;

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await authService.getCurrentUser();
        const user = response.data;

        if (!user || !user._id) {
          throw new Error("Invalid user data");
        }

        // Normalize user ID format
        const normalizedUser = {
          ...user,
          _id: user._id || user.id,
          id: user._id || user.id,
          token,
        };

        localStorage.setItem("currentUser", JSON.stringify(normalizedUser));
        setCurrentUser(normalizedUser);
      } catch (error) {
        // If we can't restore the user state, clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        setCurrentUser(null);
      }
    } else {
      localStorage.removeItem("currentUser");
      setCurrentUser(null);
    }
    setLoading(false);
  };

  // Check and restore user state when the app loads
  useEffect(() => {
    restoreUserState();
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await authService.login(credentials);

      const { token, user } = response.data;

      if (!user) {
        throw new Error("No user data received");
      }

      if (!user._id && !user.id) {
        throw new Error("No user ID found in user data");
      }

      // Normalize user ID format
      const normalizedUser = {
        ...user,
        _id: user._id || user.id,
        id: user._id || user.id,
        token,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(normalizedUser));
      setCurrentUser(normalizedUser);
      return normalizedUser;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
    restoreAttempted.current = false; // Reset the restore attempt flag
  };

  const value = {
    currentUser,
    login,
    logout,
    restoreUserState,
    loading,
    setLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
