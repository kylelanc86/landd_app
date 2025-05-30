import React from "react";
import { usePermissions } from "../hooks/usePermissions";

const PermissionGate = ({
  children,
  requiredPermissions = [],
  requireAll = false,
  fallback = null,
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

  // If user doesn't have access, render fallback or nothing
  if (!hasAccess) {
    return fallback;
  }

  // If user has access, render the children
  return children;
};

export default PermissionGate;
