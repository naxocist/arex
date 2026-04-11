'use client';

import { UserProvider } from '@/app/_contexts/UserContext';
import UserSelection from '@/app/_views/UserSelection';

export default function LoginPage() {
  return (
    <UserProvider>
      <UserSelection />
    </UserProvider>
  );
}
