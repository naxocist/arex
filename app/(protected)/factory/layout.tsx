import ProtectedRoute from '@/app/_components/ProtectedRoute';

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRole="factory">{children}</ProtectedRoute>;
}
