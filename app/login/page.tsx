'use client';

import { UserProvider } from '@/app/contexts/UserContext';
import UserSelection from '@/app/views/UserSelection';

export default function LoginPage() {
  return (
    <UserProvider>
      <UserSelection />
    </UserProvider>
  );
}
