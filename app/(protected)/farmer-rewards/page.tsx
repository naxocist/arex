'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import FarmerRewards from '@/app/_views/FarmerRewards';

export default function FarmerRewardsPage() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <FarmerRewards />
    </ProtectedRoute>
  );
}
