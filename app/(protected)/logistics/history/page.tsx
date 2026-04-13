'use client';

import ProtectedRoute from '@/app/_components/ProtectedRoute';
import LogisticsHistory from '@/app/_views/LogisticsHistory';

export default function LogisticsHistoryPage() {
  return (
    <ProtectedRoute allowedRole="logistics">
      <LogisticsHistory />
    </ProtectedRoute>
  );
}
