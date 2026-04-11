'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import FarmerRewards from '@/app/views/FarmerRewards';

export default function FarmerRewardsPage() {
  return (
    <ProtectedRoute allowedRole="farmer">
      <FarmerRewards />
    </ProtectedRoute>
  );
}
