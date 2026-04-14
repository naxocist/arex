'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import AdminSettingsView from '@/app/_views/AdminSettings';

export default function AdminApprovalSettingsPage() {
  return (
    <ProtectedRoute allowedRole="admin">
      <AdminSettingsView />
    </ProtectedRoute>
  );
}
