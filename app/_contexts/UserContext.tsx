'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuthSession, getStoredRole, registerAuthFailureHandler } from '@/app/_lib/api';

export type UserRole = 'farmer' | 'executive' | 'logistics' | 'factory' | 'warehouse' | 'admin';

interface UserContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(() => {
    const storedRole = getStoredRole();
    if (storedRole === 'farmer' || storedRole === 'executive' || storedRole === 'logistics' || storedRole === 'factory' || storedRole === 'warehouse' || storedRole === 'admin') {
      return storedRole;
    }
    return null;
  });

  useEffect(() => {
    registerAuthFailureHandler(() => {
      setRole(null);
      router.replace('/');
    });
  }, [router]);

  const logout = () => {
    clearAuthSession();
    setRole(null);
    router.replace('/');
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
