import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('oram_user');
    const storedToken = localStorage.getItem('oram_token');
    if (storedUser && storedToken) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser({ ...parsed, token: storedToken });
      } catch {
        localStorage.removeItem('oram_user');
        localStorage.removeItem('oram_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    const { token, ...rest } = response.data;
    const authUser: AuthUser = { ...rest, token };
    localStorage.setItem('oram_token', token);
    localStorage.setItem('oram_user', JSON.stringify(rest));
    setUser(authUser);
  };

  const logout = () => {
    authApi.logout().catch(() => {});
    localStorage.removeItem('oram_token');
    localStorage.removeItem('oram_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
