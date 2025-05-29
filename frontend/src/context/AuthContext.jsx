import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    // Check both token and user data on initial render
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("currentUser");
    if (token && storedUser) {
      return { ...JSON.parse(storedUser), token };
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  // Function to restore user state from backend
  const restoreUserState = async () => {
    console.log("restoreUserState: called");
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await authService.getCurrentUser();
        const user = response.data;
        const userWithToken = { ...user, token };
        localStorage.setItem("currentUser", JSON.stringify(userWithToken));
        setCurrentUser(userWithToken);
        console.log("restoreUserState: user restored", userWithToken);
      } catch (error) {
        console.error("restoreUserState: failed to restore user state", error);
        // If we can't restore the user state, clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        setCurrentUser(null);
      }
    } else {
      console.log("restoreUserState: no token found");
      localStorage.removeItem("currentUser");
      setCurrentUser(null);
    }
  };

  // Check and restore user state when the app loads
  useEffect(() => {
    restoreUserState();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authService.login(credentials);
      const { token, user } = response.data;
      const userWithToken = { ...user, token };
      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(userWithToken));
      setCurrentUser(userWithToken);
      return userWithToken;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
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
