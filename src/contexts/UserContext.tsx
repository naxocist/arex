import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'farmer' | 'executive' | 'logistics' | 'factory';

interface UserContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);

  const logout = () => setRole(null);

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
