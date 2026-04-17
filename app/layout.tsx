import type { Metadata } from 'next';
import { UserProvider } from '@/app/_contexts/UserContext';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'PMUC Zero Burn to Earn',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
