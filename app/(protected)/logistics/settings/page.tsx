'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import LogisticsSettings from '@/app/_views/LogisticsSettings';

export default function LogisticsSettingsPage() {
  return (
    <ProtectedRoute allowedRole="logistics">
      <LogisticsSettings />
    </ProtectedRoute>
  );
}
