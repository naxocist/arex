'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import ExecutiveDashboard from '@/app/_views/ExecutiveDashboard';

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRole="executive">
      <ExecutiveDashboard />
    </ProtectedRoute>
  );
}
