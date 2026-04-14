'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { clearAuthSession, getStoredRole } from '@/app/_lib/apiClient';

export type UserRole = 'farmer' | 'executive' | 'logistics' | 'factory' | 'warehouse' | 'admin';

interface UserContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(() => {
    const storedRole = getStoredRole();
    if (storedRole === 'farmer' || storedRole === 'executive' || storedRole === 'logistics' || storedRole === 'factory' || storedRole === 'warehouse' || storedRole === 'admin') {
      return storedRole;
    }
    return null;
  });

  const logout = () => {
    clearAuthSession();
    setRole(null);
  };

  return (
    <UserContext.Provider value={{ role, setRole, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
