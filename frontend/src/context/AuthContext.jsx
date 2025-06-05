import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

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

    console.log("Auth Debug - restoreUserState: called");
    const token = localStorage.getItem("token");
    if (token) {
      try {
        console.log(
          "Auth Debug - restoreUserState: Found token, attempting to restore user"
        );
        const response = await authService.getCurrentUser();
        const user = response.data;
        const userWithToken = { ...user, token };
        localStorage.setItem("currentUser", JSON.stringify(userWithToken));
        setCurrentUser(userWithToken);
        console.log(
          "Auth Debug - restoreUserState: User restored successfully"
        );
      } catch (error) {
        console.error(
          "Auth Debug - restoreUserState: Failed to restore user state",
          error
        );
        // If we can't restore the user state, clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        setCurrentUser(null);
      }
    } else {
      console.log("Auth Debug - restoreUserState: No token found");
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
      console.log("Auth Debug - Login attempt");
      const response = await authService.login(credentials);
      const { token, user } = response.data;
      const userWithToken = { ...user, token };
      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(userWithToken));
      setCurrentUser(userWithToken);
      console.log("Auth Debug - Login successful");
      return userWithToken;
    } catch (error) {
      console.error("Auth Debug - Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    console.log("Auth Debug - Logout called");
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
