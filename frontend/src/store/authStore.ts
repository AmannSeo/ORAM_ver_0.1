import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '../types';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loginAt: string | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loginAt: null,
      isAuthenticated: false,
      setAuth: (token, user) => set({ token, user, loginAt: new Date().toISOString(), isAuthenticated: true }),
      logout: () => set({ token: null, user: null, loginAt: null, isAuthenticated: false }),
    }),
    { name: 'oram-auth' }
  )
);
