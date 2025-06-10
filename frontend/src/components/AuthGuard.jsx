import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const AuthGuard = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  // Don't redirect if we're already on the login page
  const isLoginPage = location.pathname === "/login";

  if (loading) {
    return <div>Loading...</div>;
  }

  // If we're on the login page and have a user, redirect to home
  if (isLoginPage && currentUser) {
    return <Navigate to="/" replace />;
  }

  // If we're not on the login page and don't have a user, redirect to login
  if (!isLoginPage && !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
