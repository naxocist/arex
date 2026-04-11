'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import FactorySettings from '@/app/views/FactorySettings';

export default function FactorySettingsPage() {
  return (
    <ProtectedRoute allowedRole="factory">
      <FactorySettings />
    </ProtectedRoute>
  );
}
