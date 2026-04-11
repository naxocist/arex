'use client';

import { UserProvider } from '@/app/_contexts/UserContext';
import AppLoadingOverlay from '@/app/_components/AppLoadingOverlay';
import Layout from '@/app/_components/Layout';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <Layout>{children}</Layout>
      <AppLoadingOverlay />
    </UserProvider>
  );
}
