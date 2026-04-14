'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

export interface FarmerProfileData {
  display_name: string | null;
  phone: string | null;
  province: string | null;
}

interface FarmerProfileContextType {
  openProfile: () => void;
  cachedProfile: FarmerProfileData | null;
  setCachedProfile: (profile: FarmerProfileData) => void;
}

const FarmerProfileContext = createContext<FarmerProfileContextType | undefined>(undefined);

export function useFarmerProfile() {
  const ctx = useContext(FarmerProfileContext);
  if (!ctx) throw new Error('useFarmerProfile must be used within FarmerProfileProvider');
  return ctx;
}

export function FarmerProfileProvider({
  children,
  onOpen,
}: {
  children: React.ReactNode;
  onOpen: () => void;
}) {
  const [cachedProfile, setCachedProfile] = useState<FarmerProfileData | null>(null);
  const openProfile = useCallback(() => onOpen(), [onOpen]);
  return (
    <FarmerProfileContext.Provider value={{ openProfile, cachedProfile, setCachedProfile }}>
      {children}
    </FarmerProfileContext.Provider>
  );
}
