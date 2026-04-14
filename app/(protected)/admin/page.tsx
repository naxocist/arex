'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import AdminDashboard from '@/app/_views/AdminDashboard';

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
