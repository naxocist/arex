'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/app/contexts/UserContext';

const rolePaths: Record<string, string> = {
  farmer: '/',
  executive: '/dashboard',
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

  useEffect(() => {
    if (!role) {
      router.replace('/login');
    } else if (role !== allowedRole) {
      router.replace(rolePaths[role] ?? '/login');
    }
  }, [role, allowedRole, router]);

  if (!role || role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
