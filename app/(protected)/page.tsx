'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import FarmerHome from '@/app/_views/FarmerHome';

export default function HomePage() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <FarmerHome />
    </ProtectedRoute>
  );
}
