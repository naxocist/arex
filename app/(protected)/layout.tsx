'use client';

import AppLoadingOverlay from '@/app/_components/AppLoadingOverlay';
import Layout from '@/app/_components/Layout';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Layout>{children}</Layout>
      <AppLoadingOverlay />
    </>
  );
}
