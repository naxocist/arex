'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import FarmerHome from '@/app/views/FarmerHome';

export default function HomePage() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <FarmerHome />
    </ProtectedRoute>
  );
}
