'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import ExecutiveSettings from '@/app/views/ExecutiveSettings';

export default function ExecutiveSettingsPage() {
  return (
    <ProtectedRoute allowedRole="executive">
      <ExecutiveSettings />
    </ProtectedRoute>
  );
}
