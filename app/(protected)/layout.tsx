'use client';

import { UserProvider } from '@/app/contexts/UserContext';
import AppLoadingOverlay from '@/app/components/AppLoadingOverlay';
import Layout from '@/app/components/Layout';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <Layout>{children}</Layout>
      <AppLoadingOverlay />
    </UserProvider>
  );
}
