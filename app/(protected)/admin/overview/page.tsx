'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import ExecutiveDashboard from '@/app/_views/ExecutiveDashboard';

export default function AdminOverviewPage() {
  return (
    <ProtectedRoute allowedRole="admin">
      <ExecutiveDashboard />
    </ProtectedRoute>
  );
}
