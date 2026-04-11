'use client';

import ProtectedRoute from '@/app/components/ProtectedRoute';
import LogisticsTracking from '@/app/views/LogisticsTracking';

export default function LogisticsPage() {
  return (
    <ProtectedRoute allowedRole="logistics">
      <LogisticsTracking />
    </ProtectedRoute>
  );
}
