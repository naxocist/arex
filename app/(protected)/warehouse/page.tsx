'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import WarehouseApproval from '@/app/views/WarehouseApproval';

export default function WarehousePage() {
  return (
    <ProtectedRoute allowedRole="warehouse">
      <WarehouseApproval />
    </ProtectedRoute>
  );
}
