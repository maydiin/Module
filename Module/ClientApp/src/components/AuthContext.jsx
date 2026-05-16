import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, login as apiLogin, logout as apiLogout } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await getMe();
      setUser(prev => {
        if (prev?.username === data.username && prev?.tenantId === data.tenantId) return prev;
        return { username: data.username, tenantId: data.tenantId };
      });
      setPermissions(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data.permissions || [])) return prev;
        return data.permissions || [];
      });
      setIsSuperAdmin(data.isSuperAdmin || false);
    } catch (error) {
      setUser(null);
      setPermissions([]);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (username, password) => {
    const data = await apiLogin(username, password);
    setUser({ username: data.username, tenantId: data.tenantId });
    setPermissions(data.permissions || []);
    setIsSuperAdmin(data.isSuperAdmin || false);
    return data;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setPermissions([]);
    setIsSuperAdmin(false);
  };

  const hasPermission = (permission) => {
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      permissions, 
      isSuperAdmin, 
      loading, 
      login, 
      logout, 
      hasPermission,
      refreshSession 
    }}>
      {children}
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
