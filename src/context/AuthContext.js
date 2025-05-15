import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Initialize user from localStorage if available
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found in localStorage');
        setLoading(false);
        return;
      }

      try {
        const response = await authService.getCurrentUser();
        console.log("Auth check response:", response);
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid token and user data
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      console.log("AuthContext: Attempting login with:", { email, password });
      const response = await authService.login({ email, password });
      console.log("AuthContext: Login response:", response);
      
      // Store token and user data
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      setUser(user);
      return response.data;
    } catch (error) {
      console.error("AuthContext: Login failed", error);
      throw error;
    }
  };

  const logout = () => {
    console.log("AuthContext: Logging out");
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    setUser(null);
  };

  const register = async (userData) => {
    try {
      const data = await authService.register(userData);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 