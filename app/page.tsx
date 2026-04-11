'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredRole } from '@/app/_lib/apiClient';
import { UserRole } from '@/app/_contexts/UserContext';

const rolePaths: Record<UserRole, string> = {
  farmer: '/farmer',
  executive: '/executive',
  logistics: '/logistics',
  factory: '/factory',
  warehouse: '/warehouse',
};

export default function RootPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const storedRole = getStoredRole() as UserRole | null;
    if (storedRole && rolePaths[storedRole]) {
      router.replace(rolePaths[storedRole]);
    } else {
      router.replace('/login');
    }
  }, [mounted, router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="animate-pulse text-sm text-stone-500">กำลังโหลด...</div>
      </div>
    );
  }

  return null;
}