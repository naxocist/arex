'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/_contexts/UserContext';

const rolePaths: Record<string, string> = {
  farmer: '/farmer',
  executive: '/executive',
  logistics: '/logistics',
  factory: '/factory',
  warehouse: '/warehouse',
};

export default function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: string;
}) {
  const { role } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!role) {
      router.replace('/login');
    } else if (role !== allowedRole) {
      router.replace(rolePaths[role] ?? '/login');
    }
  }, [mounted, role, allowedRole, router]);

  if (!mounted || !role || role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
