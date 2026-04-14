'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FarmerProfileSheet from '@/app/_components/FarmerProfileSheet';
import { FarmerProfileProvider } from '@/app/_contexts/FarmerProfileContext';

function FarmerLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showProfile, setShowProfile] = useState(false);

  const openProfile = useCallback(() => setShowProfile(true), []);

  const closeProfile = useCallback(() => {
    setShowProfile(false);
    // Clear ?profile=1 from URL if present
    if (searchParams.get('profile') === '1') {
      router.replace(window.location.pathname, { scroll: false });
    }
  }, [router, searchParams]);

  // Open from ?profile=1 query param (sidebar link)
  React.useEffect(() => {
    if (searchParams.get('profile') === '1') {
      setShowProfile(true);
    }
  }, [searchParams]);

  return (
    <FarmerProfileProvider onOpen={openProfile}>
      {children}
      <FarmerProfileSheet open={showProfile} onClose={closeProfile} />
    </FarmerProfileProvider>
  );
}

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return <FarmerLayoutInner>{children}</FarmerLayoutInner>;
}
