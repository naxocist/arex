import ProtectedRoute from '@/app/_components/ProtectedRoute';

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRole="logistics">{children}</ProtectedRoute>;
}
