'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import WarehouseApproval from '@/app/_views/WarehouseApproval';

export default function WarehousePage() {
  return (
    <ProtectedRoute allowedRole="warehouse">
      <WarehouseApproval />
    </ProtectedRoute>
  );
}
