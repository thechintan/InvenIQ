import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('inveniq_token');
    const savedUser = localStorage.getItem('inveniq_user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch { /* invalid data */ }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data.data;
    localStorage.setItem('inveniq_token', token);
    localStorage.setItem('inveniq_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('inveniq_token');
    localStorage.removeItem('inveniq_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    const updated = { ...user, ...userData };
    localStorage.setItem('inveniq_user', JSON.stringify(updated));
    setUser(updated);
  };

  const hasRole = (...roles) => user && roles.includes(user.role);
  const isAdmin = () => user?.role === 'admin';
  const canEdit = () => ['admin', 'manager'].includes(user?.role);
  const canCreate = () => ['admin', 'manager', 'staff'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasRole, isAdmin, canEdit, canCreate }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
