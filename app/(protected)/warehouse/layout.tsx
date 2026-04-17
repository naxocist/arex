import ProtectedRoute from '@/app/_components/ProtectedRoute';

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRole="warehouse">{children}</ProtectedRoute>;
}
