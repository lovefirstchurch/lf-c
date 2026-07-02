'use client';
import { LoginGate } from '@lfc/shared';

export default function AuthenticatedLayout({ children }) {
  return (
    <LoginGate appName="Synago">
      {children}
    </LoginGate>
  );
}
