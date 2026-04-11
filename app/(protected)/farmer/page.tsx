'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import FarmerHome from '@/app/_views/FarmerHome';

export default function FarmerPage() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <FarmerHome />
    </ProtectedRoute>
  );
}