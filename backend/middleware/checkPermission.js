const { PERMISSIONS, ROLE_PERMISSIONS } = require('../config/permissions');

const checkPermission = (requiredPermissions = [], requireAll = false) => {
  return (req, res, next) => {
    try {
      // Get user from request (set by auth middleware)
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // If no permissions are required, allow access
      if (requiredPermissions.length === 0) {
        return next();
      }

      // Filter out non-restricted permissions
      const restrictedPermissions = requiredPermissions.filter(
        permission => Object.keys(PERMISSIONS).includes(permission)
      );

      // If all required permissions are non-restricted, allow access
      if (restrictedPermissions.length === 0) {
        return next();
      }

      // Get user's role permissions
      const rolePermissions = ROLE_PERMISSIONS[user.role] || [];

      // Check if user has required permissions
      const hasAccess = requireAll
        ? restrictedPermissions.every(permission => rolePermissions.includes(permission))
        : restrictedPermissions.some(permission => rolePermissions.includes(permission));

      if (!hasAccess) {
        return res.status(403).json({ 
          message: 'Forbidden',
          required: restrictedPermissions,
          userRole: user.role,
          userPermissions: rolePermissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
};

module.exports = checkPermission; 