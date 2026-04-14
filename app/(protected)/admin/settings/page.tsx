'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import ExecutiveSettings from '@/app/_views/ExecutiveSettings';

export default function AdminSettingsPage() {
  return (
    <ProtectedRoute allowedRole="admin">
      <ExecutiveSettings />
    </ProtectedRoute>
  );
}
