'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import FactoryIntake from '@/app/_views/FactoryIntake';

export default function FactoryPage() {
  return (
    <ProtectedRoute allowedRole="factory">
      <FactoryIntake />
    </ProtectedRoute>
  );
}