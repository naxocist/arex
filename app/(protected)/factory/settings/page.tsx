'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import FactorySettings from '@/app/_views/FactorySettings';

export default function FactorySettingsPage() {
  return (
    <ProtectedRoute allowedRole="factory">
      <FactorySettings />
    </ProtectedRoute>
  );
}