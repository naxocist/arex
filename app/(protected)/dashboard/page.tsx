'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import ExecutiveDashboard from '@/app/views/ExecutiveDashboard';

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRole="executive">
      <ExecutiveDashboard />
    </ProtectedRoute>
  );
}
