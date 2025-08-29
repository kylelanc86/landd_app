import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const PermissionDeniedContext = createContext(null);

export const usePermissionDenied = () => {
  const context = useContext(PermissionDeniedContext);
  if (!context) {
    throw new Error('usePermissionDenied must be used within a PermissionDeniedProvider');
  }
  return context;
};

export const PermissionDeniedProvider = ({ children }) => {
  const [permissionDenied, setPermissionDenied] = useState({
    open: false,
    requiredPermissions: [],
    userRole: 'employee',
    userPermissions: [],
    action: 'perform this action'
  });

  const showPermissionDenied = useCallback(({
    requiredPermissions = [],
    userRole = 'employee',
    userPermissions = [],
    action = 'perform this action'
  }) => {
    setPermissionDenied({
      open: true,
      requiredPermissions,
      userRole,
      userPermissions,
      action
    });
  }, []);

  const hidePermissionDenied = useCallback(() => {
    setPermissionDenied(prev => ({ ...prev, open: false }));
  }, []);

  // Listen for permission denied events from the API interceptor
  useEffect(() => {
    const handlePermissionDenied = (event) => {
      const { requiredPermissions, userRole, userPermissions, action } = event.detail;
      showPermissionDenied({
        requiredPermissions,
        userRole,
        userPermissions,
        action
      });
    };

    window.addEventListener('permissionDenied', handlePermissionDenied);
    
    return () => {
      window.removeEventListener('permissionDenied', handlePermissionDenied);
    };
  }, [showPermissionDenied]);

  const value = {
    permissionDenied,
    showPermissionDenied,
    hidePermissionDenied
  };

  return (
    <PermissionDeniedContext.Provider value={value}>
      {children}
    </PermissionDeniedContext.Provider>
  );
};
