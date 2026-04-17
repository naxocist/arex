'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FarmerProfileSheet from '@/app/_components/FarmerProfileSheet';
import { FarmerProfileProvider } from '@/app/_contexts/FarmerProfileContext';
import ProtectedRoute from '@/app/_components/ProtectedRoute';

function FarmerLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showProfile, setShowProfile] = useState(false);

  const openProfile = useCallback(() => setShowProfile(true), []);

  const closeProfile = useCallback(() => {
    setShowProfile(false);
    if (searchParams.get('profile') === '1') {
      router.replace(window.location.pathname, { scroll: false });
    }
  }, [router, searchParams]);

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
  return (
    <ProtectedRoute allowedRole="farmer">
      <React.Suspense fallback={null}>
        <FarmerLayoutInner>{children}</FarmerLayoutInner>
      </React.Suspense>
    </ProtectedRoute>
  );
}
