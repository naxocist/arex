import ProtectedRoute from '@/app/_components/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRole="admin">{children}</ProtectedRoute>;
}
