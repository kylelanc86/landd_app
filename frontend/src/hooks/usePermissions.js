import { useAuth } from '../context/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../config/permissions';
import { useMemo } from 'react';

export const usePermissions = () => {
  const { currentUser } = useAuth();

  return useMemo(() => {
    // If no user is logged in, return false for all permission checks
    if (!currentUser) {
      return {
        can: () => false,
        canAny: () => false,
        canAll: () => false,
        role: 'employee',
        isAdmin: false,
        isManager: false,
        isEmployee: true,
      };
    }

    return {
      // Check if user has a specific permission
      can: (permission) => hasPermission(currentUser, permission),
      
      // Check if user has any of the given permissions
      canAny: (permissions) => hasAnyPermission(currentUser, permissions),
      
      // Check if user has all of the given permissions
      canAll: (permissions) => hasAllPermissions(currentUser, permissions),
      
      // Get user's role
      role: currentUser.role || 'employee',
      
      // Check if user is admin
      isAdmin: currentUser.role === 'admin',
      
      // Check if user is manager
      isManager: currentUser.role === 'manager',
      
      // Check if user is employee
      isEmployee: currentUser.role === 'employee',
    };
  }, [currentUser]);
}; 