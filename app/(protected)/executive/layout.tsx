import ProtectedRoute from '@/app/_components/ProtectedRoute';

export default function ExecutiveLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute allowedRole="executive">{children}</ProtectedRoute>;
}
