'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import LogisticsTracking from '@/app/_views/LogisticsTracking';

export default function LogisticsPage() {
  return (
    <ProtectedRoute allowedRole="logistics">
      <LogisticsTracking />
    </ProtectedRoute>
  );
}
