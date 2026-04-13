'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import ExecutiveSettings from '@/app/_views/ExecutiveSettings';

export default function FactoryMaterialsPage() {
  return (
    <ProtectedRoute allowedRole="factory">
      <ExecutiveSettings mode="factory" />
    </ProtectedRoute>
  );
}
