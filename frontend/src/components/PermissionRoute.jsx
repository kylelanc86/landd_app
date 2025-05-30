import React from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

const PermissionRoute = ({
  children,
  requiredPermissions = [],
  requireAll = false,
  fallbackPath = "/dashboard",
}) => {
  const { canAny, canAll } = usePermissions();

  // If no permissions are required, just render the children
  if (requiredPermissions.length === 0) {
    return children;
  }

  // Check if user has required permissions
  const hasAccess = requireAll
    ? canAll(requiredPermissions)
    : canAny(requiredPermissions);

  // If user doesn't have access, redirect to fallback path
  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  // If user has access, render the children
  return children;
};

export default PermissionRoute;
