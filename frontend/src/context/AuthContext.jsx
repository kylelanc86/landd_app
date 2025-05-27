import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    // Only check localStorage on initial render
    const storedUser = localStorage.getItem("currentUser");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  // Function to restore user state from backend
  const restoreUserState = async () => {
    console.log("restoreUserState: called");
    const token = localStorage.getItem("token");
    if (token && !currentUser) {
      try {
        const response = await authService.getCurrentUser();
        const user = response.data;
        localStorage.setItem("currentUser", JSON.stringify(user));
        setCurrentUser(user);
        console.log("restoreUserState: user restored", user);
      } catch (error) {
        console.error("restoreUserState: failed to restore user state", error);
        // If we can't restore the user state, clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        setCurrentUser(null);
      }
    } else {
      console.log("restoreUserState: no token or user already set", {
        token,
        currentUser,
      });
    }
  };

  // Check and restore user state when the app loads
  useEffect(() => {
    restoreUserState();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData) => {
    setLoading(true);
    try {
      const response = await authService.updateUser(userData);
      const updatedUser = response.data;
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setCurrentUser(updatedUser);
      return updatedUser;
    } catch (error) {
      console.error("Update user failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
  };

  const value = {
    currentUser,
    login,
    logout,
    loading,
    updateUser,
    restoreUserState,
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
