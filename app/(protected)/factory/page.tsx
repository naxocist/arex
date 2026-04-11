'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import FactoryIntake from '@/app/views/FactoryIntake';

export default function FactoryPage() {
  return (
    <ProtectedRoute allowedRole="factory">
      <FactoryIntake />
    </ProtectedRoute>
  );
}
